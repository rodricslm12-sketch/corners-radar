// server.js (COMPLETO / ATUALIZADO — IA + FAVORITO FORA BLOQUEADO 100%)
// ✅ Mantém suas regras e bloqueios
// ✅ FAVORITO FORA: NUNCA entra (nem lista, nem Top6, nem IA)
// ✅ IA opcional: escolhe Top 6 entre candidatos já filtrados (OPÇÃO A = base completa)
// ✅ /quentes mantém retorno (ai opcional)
// ✅ /quentes_ai retorna só Top 6
// ✅ ai_score multifator (leve)
// ✅ POSIÇÃO NA TABELA funcionando
// ✅ fallback APIV2 para odds / statistics / H2H
// ✅ modo "semi" quando não houver H2H/Stats/Odds (não mata o jogo)
// ✅ /ia_card -> 1 melhor sugestão do dia (IA “pensa” + explica)
// ✅ FIX: nomes dos times sempre vêm (normalização robusta do EVENT)
// ✅ NOVO: WHITELIST DINÂMICA POR DIA (só ligas com jogos na data)
// ✅ NOVO: Pode usar TODAS as ligas da sua API (get_leagues) sem travar
// ✅ NOVO: /ia_match -> escolhe 1 jogo ENTRE O TOP6 e explica por que é o melhor (comparativo)
// ✅ NOVO: funil extra home_response (sem alterar sua lógica central)


// ---------------- Imports ----------------
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --------- Static (site) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// --------- Config ----------
const APIKEY = process.env.APIFOOTBALL_KEY;

// ✅ separa bases (v3 p/ events/standings; v2 fallback p/ odds/stats/h2h)
const API_BASE_V3 = "https://apiv3.apifootball.com/";
const API_BASE_V2 = "https://apiv2.apifootball.com/";

// ====== WHITELIST DINÂMICA / TODAS LIGAS ======
const USE_DYNAMIC_LEAGUES = String(process.env.USE_DYNAMIC_LEAGUES || "0") === "1";
// Cap de ligas analisadas no dia (segurança contra travar)
const DYNAMIC_LEAGUES_MAX_PER_DAY = Number(process.env.DYNAMIC_LEAGUES_MAX_PER_DAY || 40);
// Cache “quais ligas têm jogos hoje” (min)
const DYNAMIC_DAYLIST_TTL_MIN = Number(process.env.DYNAMIC_DAYLIST_TTL_MIN || 30);

// ====== IA (OpenAI) ======
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const AI_DEFAULT_ON = String(process.env.AI_DEFAULT_ON || "0") === "1";
const AI_TIMEOUT_MS = 15000;
const AI_MAX_CANDIDATES = 30;

// ====== Performance knobs ======
const CACHE_TTL_MIN = 25;       // cache em memória
const PERSIST_TTL_MIN = 60;     // cache em disco
const HEAVY_PER_LEAGUE = 1;     // base (leve)
const CONCURRENCY = 3;          // limite de chamadas simultâneas
const FETCH_TIMEOUT_MS = 10000; // 10s timeout

// ✅ funil mais forte pro Brasileirão
const PRESELECT_PER_LEAGUE_DEFAULT = 8;
const PRESELECT_OVERRIDE = new Map([
  [99, 14], // Brasileirão: pré-seleção maior
]);

const HEAVY_PRIORITY_LEAGUES = new Set([99]); // Brasileirão
const HEAVY_PRIORITY_PER_LEAGUE = 3;          // analisa 3 jogos do BR no pesado

// ✅ lastN maior só pro BR (mais robusto)
const LASTN_DEFAULT = 2;
const LASTN_OVERRIDE = new Map([
  [99, 4], // Brasileirão: usa 4 jogos recentes
]);

// ✅ garantia de BR forte (até 2) no Top6, só se passar um threshold
const BR_ENSURE_MAX = 2;
const BR_STRENGTH_THRESHOLD = 150;

// =========================================================
// ✅ FILTRO ANTI “FAVORITO FORA vs FRACO” (armadilha)
// =========================================================
const AWAY_FAV_TRAP = {
  ENABLE: true,

  GAP_POS_MIN: 8,
  GAP_POS_HARD_BLOCK: 12,
  ODDS_AWAY_FAV_MAX: 1.55,

  REQUIRE_ANY_2_OF_3: true,

  MIN_PROJ_TO_RELEASE: 10.9,
  MIN_HOME_CONCEDES_TO_RELEASE: 5.7,
  MIN_BOTH_CREATE_HOME: 4.2,
  MIN_BOTH_CREATE_AWAY: 4.7,

  SOFT_PENALTY_SCORE: 10,
  HARD_BLOCK_IF_FAILS: true,
};

function awayFavTrapGuard({
  posHome, posAway,
  oddsInfo,
  proj_cantos,
  homeRecent, awayRecent,
  perfil_laterais
}){
  if (!AWAY_FAV_TRAP.ENABLE) return { isTrap:false, hard:false, release:false, reason:null, penalty:0 };

  const ph = Number.isFinite(posHome) ? posHome : null;
  const pa = Number.isFinite(posAway) ? posAway : null;

  const favSide = oddsInfo?.fav?.side || null;
  const favOdd = Number(oddsInfo?.fav?.odd ?? NaN);

  const isAwayFavByOdds = (favSide === "AWAY");
  let isAwayFavByPos = false;
  let gap = null;

  if (ph !== null && pa !== null) {
    gap = ph - pa; // positivo => visitante melhor colocado
    if (gap >= AWAY_FAV_TRAP.GAP_POS_MIN) isAwayFavByPos = true;
  }

  const isAwayFav = isAwayFavByOdds || isAwayFavByPos;
  if (!isAwayFav) return { isTrap:false, hard:false, release:false, reason:null, penalty:0 };

  const isCentral = String(perfil_laterais || "") === "TENDENCIA_CENTRAL";
  const veryLowFavOdd = Number.isFinite(favOdd) && isAwayFavByOdds && favOdd <= AWAY_FAV_TRAP.ODDS_AWAY_FAV_MAX;
  const hardGap = (gap !== null && gap >= AWAY_FAV_TRAP.GAP_POS_HARD_BLOCK);
  const hard = Boolean(hardGap || veryLowFavOdd);

  const projOk = Number.isFinite(proj_cantos) && proj_cantos >= AWAY_FAV_TRAP.MIN_PROJ_TO_RELEASE;

  const homeConcedesOk =
    Number.isFinite(homeRecent?.cornersAgainstAvg) &&
    homeRecent.cornersAgainstAvg >= AWAY_FAV_TRAP.MIN_HOME_CONCEDES_TO_RELEASE;

  const bothCreateOk =
    Number.isFinite(homeRecent?.cornersForAvg) &&
    Number.isFinite(awayRecent?.cornersForAvg) &&
    homeRecent.cornersForAvg >= AWAY_FAV_TRAP.MIN_BOTH_CREATE_HOME &&
    awayRecent.cornersForAvg >= AWAY_FAV_TRAP.MIN_BOTH_CREATE_AWAY;

  const passCount = [projOk, homeConcedesOk, bothCreateOk].filter(Boolean).length;
  const release = AWAY_FAV_TRAP.REQUIRE_ANY_2_OF_3 ? (passCount >= 2) : (projOk && homeConcedesOk && bothCreateOk);

  if (release) {
    const penalty = isCentral ? 6 : 4;
    return { isTrap:true, hard, release:true, reason:"away_fav_trap_released", penalty };
  }

  const penalty = AWAY_FAV_TRAP.SOFT_PENALTY_SCORE + (isCentral ? 6 : 0) + (hard ? 6 : 0);
  return { isTrap:true, hard, release:false, reason:"away_fav_trap", penalty };
}


/* =========================================================
   🔒 NOVO — TRAVAS PRÉ-JOGO DE CANTOS + SUBSTITUIÇÃO INTELIGENTE
   ========================================================= */

const PRE_GAME_CORNER_TRAPS = {
  ENABLE: true,

  MIN_H2H_GAMES: 2,
  H2H_LOW_AVG: 8.5,
  H2H_OVER95_LOW_RATE: 45,

  PASSIVE_UNDERDOG_CORNERS_FOR: 3.8,
  LOW_EXPECTED_CORNERS: 9.2,
  CONTROL_FAVORITE_CORNERS_FOR: 5.8,

  // ✅ agora considera os 4 primeiros colocados, não apenas o líder isolado
  TOP_FAVORITE_MAX_POSITION: 5,

  BLOCK_SCORE_LIMIT: 5
};

const ELITE_AWAY_REPLACEMENT = {
  ENABLE: true,

  MIN_POSITION: 4,
  MIN_CORNERS_FOR: 6.1,
  MIN_SHOTS: 13,
  MIN_EXPECTED_CORNERS: 9.7,
  MIN_UNDERDOG_CONCEDES: 4.5,
  MIN_PRESSURE_HITS: 3,

  MIN_SCORE: 6
};

function calcH2HCornersProfile(h2hBlock) {
  const list = Array.isArray(h2hBlock?.firstTeam_VS_secondTeam)
    ? h2hBlock.firstTeam_VS_secondTeam
    : [];

  let games = 0;
  let totalCorners = 0;
  let over95 = 0;

  for (const m of list) {
    const c1 = Number(
      m.match_hometeam_corner ??
      m.match_hometeam_corners ??
      m.hometeam_corner ??
      m.home_corners ??
      NaN
    );

    const c2 = Number(
      m.match_awayteam_corner ??
      m.match_awayteam_corners ??
      m.awayteam_corner ??
      m.away_corners ??
      NaN
    );

    if (!Number.isFinite(c1) || !Number.isFinite(c2)) continue;

    const total = c1 + c2;
    totalCorners += total;
    if (total >= 10) over95++;
    games++;
  }

  if (!games) {
    return { games: 0, avgCorners: null, over95Rate: null };
  }

  return {
    games,
    avgCorners: totalCorners / games,
    over95Rate: (over95 / games) * 100
  };
}

function getFavoriteSidePreGame(oddsInfo, posHome, posAway) {
  return getFavSideSimple(oddsInfo, posHome, posAway);
}

function getFavoriteRecent({ favSide, homeRecent, awayRecent }) {
  if (favSide === "HOME") return homeRecent;
  if (favSide === "AWAY") return awayRecent;
  return null;
}

function getUnderdogRecent({ favSide, homeRecent, awayRecent }) {
  if (favSide === "HOME") return awayRecent;
  if (favSide === "AWAY") return homeRecent;
  return null;
}

function preGameLowCornerTrapCheck({
  h2hProfile,
  favSide,
  favoriteRecent,
  underdogRecent,
  proj_cantos,
  posHome,
  posAway,
  perfil_laterais
}) {
  if (!PRE_GAME_CORNER_TRAPS.ENABLE) {
    return { block: false, score: 0, flags: [], reason: null };
  }

  let score = 0;
  const flags = [];

  const favPos = favSide === "HOME" ? posHome : favSide === "AWAY" ? posAway : null;
  const dogPos = favSide === "HOME" ? posAway : favSide === "AWAY" ? posHome : null;

  const favoriteIsLeader = Number.isFinite(favPos) && favPos <= PRE_GAME_CORNER_TRAPS.TOP_FAVORITE_MAX_POSITION;
  const underdogLowerTable = Number.isFinite(dogPos) && dogPos >= 8;

  const underdogPassive =
    Number.isFinite(underdogRecent?.cornersForAvg) &&
    underdogRecent.cornersForAvg < PRE_GAME_CORNER_TRAPS.PASSIVE_UNDERDOG_CORNERS_FOR;

  const h2hLow =
    h2hProfile?.games >= PRE_GAME_CORNER_TRAPS.MIN_H2H_GAMES &&
    Number.isFinite(h2hProfile.avgCorners) &&
    h2hProfile.avgCorners < PRE_GAME_CORNER_TRAPS.H2H_LOW_AVG;

  const h2hOverBad =
    h2hProfile?.games >= PRE_GAME_CORNER_TRAPS.MIN_H2H_GAMES &&
    Number.isFinite(h2hProfile.over95Rate) &&
    h2hProfile.over95Rate < PRE_GAME_CORNER_TRAPS.H2H_OVER95_LOW_RATE;

  const lowExpected =
    Number.isFinite(proj_cantos) &&
    proj_cantos < PRE_GAME_CORNER_TRAPS.LOW_EXPECTED_CORNERS;

  const favoriteControlsButNotExplodes =
    Number.isFinite(favoriteRecent?.cornersForAvg) &&
    favoriteRecent.cornersForAvg < PRE_GAME_CORNER_TRAPS.CONTROL_FAVORITE_CORNERS_FOR;

  const oneSidedBad =
    Number.isFinite(favoriteRecent?.cornersForAvg) &&
    Number.isFinite(underdogRecent?.cornersForAvg) &&
    favoriteRecent.cornersForAvg >= 5 &&
    underdogRecent.cornersForAvg < 3.5;

  const centralStyle = perfil_laterais === "TENDENCIA_CENTRAL";

  if (favoriteIsLeader && underdogPassive) {
    score += 2;
    flags.push("top4_vs_passive_underdog");
  }

  if (favoriteIsLeader && underdogLowerTable) {
    score += 1;
    flags.push("top4_vs_lower_table_team");
  }

  if (h2hLow) {
    score += 2;
    flags.push("h2h_low_corners");
  }

  if (h2hOverBad) {
    score += 1;
    flags.push("h2h_low_over95_rate");
  }

  if (lowExpected) {
    score += 2;
    flags.push("low_expected_corners");
  }

  if (favoriteControlsButNotExplodes) {
    score += 2;
    flags.push("favorite_control_no_corner_explosion");
  }

  if (oneSidedBad) {
    score += 1;
    flags.push("one_sided_corner_profile");
  }

  if (centralStyle) {
    score += 1;
    flags.push("central_style_corner_risk");
  }

  const block = score >= PRE_GAME_CORNER_TRAPS.BLOCK_SCORE_LIMIT;

  return {
    block,
    score,
    flags,
    reason: block
      ? "Pré-jogo bloqueado: líder/favorito com controle sem pressão, H2H baixo, adversário passivo ou projeção fraca para Over 9.5."
      : null
  };
}

function eliteAwayReplacementCheck({
  favSide,
  posAway,
  awayRecent,
  homeRecent,
  proj_cantos,
  pressureHits,
  perfil_laterais
}) {
  if (!ELITE_AWAY_REPLACEMENT.ENABLE) {
    return { ok: false, score: 0, flags: [] };
  }

  if (favSide !== "AWAY") {
    return { ok: false, score: 0, flags: [] };
  }

  let score = 0;
  const flags = [];

  if (Number.isFinite(posAway) && posAway <= ELITE_AWAY_REPLACEMENT.MIN_POSITION) {
    score += 2;
    flags.push("elite_away_leader");
  }

  if (Number.isFinite(awayRecent?.cornersForAvg) && awayRecent.cornersForAvg >= ELITE_AWAY_REPLACEMENT.MIN_CORNERS_FOR) {
    score += 2;
    flags.push("elite_away_corners_for");
  }

  if (Number.isFinite(awayRecent?.shotsTotalAvg) && awayRecent.shotsTotalAvg >= ELITE_AWAY_REPLACEMENT.MIN_SHOTS) {
    score += 1;
    flags.push("elite_away_shots");
  }

  if (Number.isFinite(proj_cantos) && proj_cantos >= ELITE_AWAY_REPLACEMENT.MIN_EXPECTED_CORNERS) {
    score += 2;
    flags.push("elite_away_high_projection");
  }

  if (Number.isFinite(homeRecent?.cornersAgainstAvg) && homeRecent.cornersAgainstAvg >= ELITE_AWAY_REPLACEMENT.MIN_UNDERDOG_CONCEDES) {
    score += 1;
    flags.push("home_concedes_corners");
  }

  if (Number.isFinite(pressureHits) && pressureHits >= ELITE_AWAY_REPLACEMENT.MIN_PRESSURE_HITS) {
    score += 1;
    flags.push("elite_away_pressure");
  }

  if (perfil_laterais === "LATERAIS_FORTES") {
    score += 1;
    flags.push("wide_pressure_profile");
  }

  return {
    ok: score >= ELITE_AWAY_REPLACEMENT.MIN_SCORE,
    score,
    flags
  };
}

function isEliteAwayReplacementGame(x) {
  return Array.isArray(x?.flags) && x.flags.includes("elite_away_replacement");
}

function isBlockedAwayFavoriteForSelection(x) {
  return isAwayFavoriteStrict(x?.odds, x?.pos_home, x?.pos_away) && !isEliteAwayReplacementGame(x);
}

// Blindagem única da seleção final. Também atua sobre jogos LITE/SEMI e caches antigos.
function isBlockedForSelection(x) {
  if (!x) return true;

  const flags = Array.isArray(x?.flags) ? x.flags : [];
  const posHome = Number(x?.pos_home);
  const posAway = Number(x?.pos_away);
  const perfil = String(x?.perfil_laterais || "");

  // Nunca permite flags vermelhas, salvo a exceção controlada do favorito fora elite.
  const hasForbiddenRed = flags.some(flag => {
    if (!String(flag).startsWith("red_")) return false;
    if (flag === "red_away_favorite" && isEliteAwayReplacementGame(x)) return false;
    return true;
  });
  if (hasForbiddenRed) return true;

  // Bloqueio direto por posição, inclusive quando o LITE não possui flags.
  if (isMidTable(posHome) && isMidTable(posAway)) return true;

  // Perfil central não entra na seleção principal.
  if (perfil === "TENDENCIA_CENTRAL") return true;

  // Mantém a regra absoluta de favorito visitante.
  if (isBlockedAwayFavoriteForSelection(x)) return true;

  return false;
}

function sanitizeSelectionList(list) {
  return (Array.isArray(list) ? list : []).filter(x => !isBlockedForSelection(x));
}

function hasLowCornerTrapFlag(x) {
  const flags = Array.isArray(x?.flags) ? x.flags : [];
  return flags.some(f => [
    "top4_vs_passive_underdog",
    "top4_vs_lower_table_team",
    "h2h_low_corners",
    "h2h_low_over95_rate",
    "low_expected_corners",
    "favorite_control_no_corner_explosion",
    "one_sided_corner_profile",
    "central_style_corner_risk"
  ].includes(f));
}

function shouldTryEliteAwayReplacement(list) {
  const full = (list || []).filter(isFullBaseGame);
  if (!full.length) return true;
  const reliable = full.filter(x => !hasLowCornerTrapFlag(x));
  return reliable.length < 6;
}


// ======================================================
// FUNIL EXTRA — TIME FORTE EM CANTOS PERDEU FORA
// ======================================================
const HOME_RESPONSE = {
  ENABLE: true,

  // mandante precisa ser forte em cantos
  MIN_HOME_CORNERS_FOR_AVG: 5.6,

  // adversário precisa ceder cantos
  MIN_AWAY_CONCEDES: 4.8,

  // projeção mínima
  MIN_PROJ: 10.8,

  // bônus leve
  SCORE_BONUS: 6
};

// ====== LIGAS (base clássica / overrides fortes) ======
const LEAGUES_IDS = [
  152,302,175,207,168,244,
  56,63,135,307,253,266,308,322,134,259,279,178,124,272,
  99,18,3,4,683
];

// 🔥 MAPA BASE (tradição do seu sistema)
const LEAGUE_META = {
  152: { name: "Premier League", baseCorners: 10.8, importance: 95 },
  302: { name: "La Liga", baseCorners: 10.4, importance: 90 },
  175: { name: "Bundesliga", baseCorners: 10.9, importance: 92 },
  207: { name: "Serie A", baseCorners: 9.8, importance: 88 },
  168: { name: "Ligue 1", baseCorners: 10.1, importance: 87 },
  244: { name: "Eredivisie", baseCorners: 10.6, importance: 89 },

  63:  { name: "Belgium First Division A", baseCorners: 10.3, importance: 86 },
  135: { name: "Denmark Superliga", baseCorners: 10.4, importance: 86 },
  253: { name: "Eliteserien", baseCorners: 10.5, importance: 85 },
  307: { name: "Allsvenskan", baseCorners: 10.2, importance: 82 },

  56:  { name: "Austria Bundesliga", baseCorners: 10.0, importance: 83 },
  266: { name: "Primeira Liga", baseCorners: 9.9, importance: 85 },
  308: { name: "Super League (Suíça)", baseCorners: 9.8, importance: 81 },
  322: { name: "Süper Lig", baseCorners: 10.0, importance: 84 },
  134: { name: "Czech Liga", baseCorners: 9.9, importance: 80 },
  259: { name: "Ekstraklasa", baseCorners: 10.0, importance: 81 },
  279: { name: "Premiership", baseCorners: 10.1, importance: 82 },
  178: { name: "Super League 1", baseCorners: 9.7, importance: 80 },
  124: { name: "HNL", baseCorners: 9.7, importance: 79 },
  272: { name: "Liga I", baseCorners: 9.6, importance: 78 },

  99:  { name: "Brasileirão Série A", baseCorners: 10.2, importance: 93 },
  18:  { name: "Libertadores", baseCorners: 9.8, importance: 94 },

  3:   { name: "Champions League", baseCorners: 10.3, importance: 96 },
  4:   { name: "Europa League", baseCorners: 10.0, importance: 90 },
  683: { name: "Conference League", baseCorners: 10.1, importance: 88 },
};

// 🔥 CONVERSÃO AUTOMÁTICA (isso é o segredo)
const LEAGUES = LEAGUES_IDS.map(id => {
  const meta = LEAGUE_META[id] || {
    name: `Liga ${id}`,
    baseCorners: 9.6,
    importance: 75
  };

  return {
    id,
    ...meta
  };
});

// ✅ overrides “fortes” garantidos quando vier liga dinâmica
const LEAGUE_OVERRIDES = new Map(
  LEAGUES.map(l => [Number(l.id), { ...l }])
);

// ====== fallback controlado ======
const LITE_FALLBACK_LEAGUE_IDS = new Set([18, 99]);

// ====== Times “grandes” ======
const BIG_TEAMS = new Set([
  "Real Madrid","Barcelona","Atletico Madrid",
  "Manchester City","Liverpool","Arsenal","Chelsea","Manchester United","Tottenham",
  "PSG","Marseille","Bayern Munich","Borussia Dortmund",
  "AC Milan","Inter","Juventus","Napoli",
  "Flamengo","Palmeiras","Corinthians","São Paulo","Santos","Grêmio","Internacional",
  "Atlético Mineiro","Cruzeiro","Vasco","Botafogo","Fluminense","Athletico Paranaense"
]);

/* =========================================================
   ✅ BLOQUEIO DE CLÁSSICOS EUROPEUS
   ========================================================= */

   const BLOCK_CLASSICS = {
    ENABLE: true,
    MODE: "block", // "block" ou "penalty"
    PENALTY_SCORE: 25
  };
  
  function normClassic(x){
    return normTeamKey(x)
      .replace(/\b(fc|cf|club|clube|football|futebol)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  // 🔥 APENAS EUROPA (como você pediu)
  const CLASSIC_PAIRS_EU = [
    // Espanha
    ["real madrid", "barcelona"],
    ["real madrid", "atletico madrid"],
    ["barcelona", "espanyol"],
    ["sevilla", "real betis"],
  
    // Inglaterra
    ["arsenal", "tottenham"],
    ["liverpool", "everton"],
    ["manchester united", "manchester city"],
    ["chelsea", "tottenham"],
    ["newcastle united", "sunderland"],
  
    // Itália
    ["inter", "ac milan"],
    ["juventus", "torino"],
    ["roma", "lazio"],
    ["napoli", "juventus"],
  
    // Alemanha
    ["bayern munich", "borussia dortmund"],
    ["schalke", "borussia dortmund"],
    ["hamburger", "werder bremen"],
  
    // França
    ["psg", "marseille"],
    ["lyon", "saint etienne"],
  
    // Portugal
    ["benfica", "porto"],
    ["benfica", "sporting"],
    ["porto", "sporting"],
  
    // Holanda
    ["ajax", "feyenoord"],
    ["ajax", "psv"],
    ["psv", "feyenoord"],
  ];
  
  // 🔍 detector
  function isEuropeanClassic(casa, fora){
    if (!BLOCK_CLASSICS.ENABLE) return false;
  
    const h = normClassic(casa);
    const a = normClassic(fora);
  
    for (const [t1, t2] of CLASSIC_PAIRS_EU){
      if (
        (h.includes(t1) && a.includes(t2)) ||
        (h.includes(t2) && a.includes(t1))
      ){
        return true;
      }
    }
  
    return false;
  }

// ====== PERFIL (por dentro vs laterais) ======
const CENTRAL_TEAMS = new Set([
  "Bayern Munich","Manchester City","PSG","Inter","Napoli","Barcelona",
  "Flamengo","Corinthians","São Paulo"
]);
const WIDE_TEAMS = new Set([
  "Liverpool","Tottenham","Arsenal","Real Madrid","Borussia Dortmund","Marseille",
  "Palmeiras","Grêmio","Atlético Mineiro","Fluminense","Internacional","Athletico Paranaense"
]);

// ====== REGRAS (seu núcleo) ======
const RULES = {
  minProjCombined: 10.5,
  minTeamCornersFor: 5.0,
  minTeamCornersForFloor: 3.5,
  minLeagueAvg: 9.0,

  pressureNeed: 2,
  oneTeamShotsTotalGTE: 14,
  combinedShotsTotalGTE: 25,
  oneTeamPossessionGTE: 55,
  oneTeamCornersAgainstGTE: 5,
  combinedShotsOnGoalGTE: 9,
  favOddMin: 1.40,
  favOddMax: 1.80,

  over9CountNeed: 3,
  recentAvgCombinedGTE: 10.0,
  trendUpDelta: 0.6,

  excludeIfBothLowShotsTotal: 20,
  excludeIfLowCornersForBoth: 4.0,
};

/* =========================================================
   🔥 ANTI-RED GLOBAL (APLICA EM TODOS OS JOGOS)
   ========================================================= */

function isMidTable(pos){
  return Number.isFinite(pos) && pos >= 7 && pos <= 14;
}

function getFavSideSimple(oddsInfo, posHome, posAway){
  if (oddsInfo?.fav?.side) return oddsInfo.fav.side;
  if (Number.isFinite(posHome) && Number.isFinite(posAway)) {
    if (posHome < posAway) return "HOME";
    if (posAway < posHome) return "AWAY";
  }
  return null;
}

// ✅ favorito fora ABSOLUTO (bloqueio)
function isAwayFavoriteStrict(oddsInfo, posHome, posAway){
  const favSide = getFavSideSimple(oddsInfo, posHome, posAway);
  return favSide === "AWAY";
}

function antiRedGlobalCheck({
  posHome,
  posAway,
  oddsInfo,
  perfil_laterais,
  pressureHits,
  homeRecent,
  awayRecent,
  recentCombinedAvg
}){
  const flags = [];
  const favSide = getFavSideSimple(oddsInfo, posHome, posAway);

  // 🚫 1. Meio de tabela vs meio de tabela
  if (isMidTable(posHome) && isMidTable(posAway)) {
    flags.push("red_mid_table");
  }

  // 🚫 2. Favorito fora (REGRA MAIS IMPORTANTE)
  if (favSide === "AWAY") {
    flags.push("red_away_favorite");
  }

  // 🚫 3. Jogo central
  if (perfil_laterais === "TENDENCIA_CENTRAL") {
    flags.push("red_central_style");
  }

  // ⚠️ 4. Baixa pressão
  if (Number.isFinite(pressureHits) && pressureHits < 3) {
    flags.push("warn_low_pressure");
  }

  // ⚠️ 5. Histórico ruim
  if (homeRecent && awayRecent) {
    const minOver9 = Math.min(homeRecent.over9Count, awayRecent.over9Count);
    const rate = minOver9 / Math.max(2, homeRecent.games);

    if (rate < 0.5) flags.push("warn_bad_history");

    if (Number.isFinite(recentCombinedAvg) && recentCombinedAvg < 9.8) {
      flags.push("warn_low_avg");
    }
  }

  // 🔥 REGRA DOS 3 PILARES
  let pillars = 0;

  // Dominância
  if (Number.isFinite(posHome) && Number.isFinite(posAway)) {
    if (posHome <= 6 && posAway >= 10) pillars++;
  }

  // Pressão
  if (Number.isFinite(pressureHits) && pressureHits >= 3) pillars++;

  // Laterais
  if (perfil_laterais === "LATERAIS_FORTES") pillars++;

  if (pillars < 2) {
    flags.push("red_no_pillars");
  }

  return {
    flags,
    block: flags.some(f => f.startsWith("red"))
  };
}

// ---------------- Helpers ----------------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function toISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateMinusDays(dateStr, days = 1) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function isBigTeam(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  for (const t of BIG_TEAMS) {
    const tl = t.toLowerCase();
    if (n === tl || n.includes(tl)) return true;
  }
  return false;
}

function isInSetByLooseMatch(teamSet, teamName) {
  if (!teamName) return false;
  const key = teamName.toLowerCase();
  for (const t of teamSet) {
    const tl = t.toLowerCase();
    if (key === tl || key.includes(tl) || tl.includes(key)) return true;
  }
  return false;
}

function probFromProjection(proj) {
  const p = 50 + (proj - 9.5) * 10;
  return clamp(Math.round(p), 5, 95);
}

function nivelFromProb(p) {
  if (p >= 78) return "MUITO_FORTE";
  if (p >= 68) return "FORTE";
  if (p >= 60) return "BOA";
  return "ARRISCADO";
}

function isTop5DirectClash(posHome, posAway) {
  return (
    Number.isFinite(posHome) &&
    Number.isFinite(posAway) &&
    posHome <= 5 &&
    posAway <= 5
  );
}

function projCornersHeuristic(baseCorners, isBigMatch, posHome, posAway) {
  let proj = baseCorners ?? 9.8;
  if (isBigMatch) proj += 0.7;

  if (posHome && posAway) {
    const diff = Math.abs(posHome - posAway);
    if (diff >= 10) proj += 0.6;
    else if (diff >= 6) proj += 0.3;
    if (posHome <= 5 || posAway <= 5) proj += 0.3;
  }

  proj = clamp(proj, 7.5, 13.8);
  return Math.round(proj * 10) / 10;
}

function lateralizacaoIndex(casa, fora, baseCorners, proj_cantos) {
  let idx = 55;

  const homeCentral = isInSetByLooseMatch(CENTRAL_TEAMS, casa);
  const awayCentral = isInSetByLooseMatch(CENTRAL_TEAMS, fora);
  const homeWide = isInSetByLooseMatch(WIDE_TEAMS, casa);
  const awayWide = isInSetByLooseMatch(WIDE_TEAMS, fora);

  if (homeCentral) idx -= 14;
  if (awayCentral) idx -= 14;
  if (homeWide) idx += 12;
  if (awayWide) idx += 12;

  if (Number.isFinite(baseCorners) && Number.isFinite(proj_cantos)) {
    const diff = proj_cantos - baseCorners;
    idx += clamp(diff * 6, -12, 12);
  }
  return clamp(Math.round(idx), 0, 100);
}

function perfilLaterais(idx) {
  if (idx >= 70) return "LATERAIS_FORTES";
  if (idx >= 55) return "EQUILIBRADO";
  return "TENDENCIA_CENTRAL";
}

function aplicarAntiRed({ over95_prob, score, perfil }) {
  let pAdj = over95_prob;
  let sAdj = score;

  if (perfil === "TENDENCIA_CENTRAL") {
    pAdj = clamp(over95_prob - 7, 5, 95);
    sAdj = clamp(score - 18, 40, 150);
  } else if (perfil === "EQUILIBRADO") {
    pAdj = clamp(over95_prob - 2, 5, 95);
    sAdj = clamp(score - 4, 40, 150);
  }
  return { over95_prob_adj: pAdj, score_adj: sAdj };
}

/* =========================================================
   ✅ FIX: NORMALIZAÇÃO ROBUSTA DE NOMES (EVENT)
   ========================================================= */
function cleanText(v) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function pickName(v) {
  if (!v) return "";
  if (typeof v === "object") {
    return cleanText(
      v.name ??
      v.team_name ??
      v.teamName ??
      v.short_name ??
      v.shortName ??
      v.common_name ??
      v.commonName ??
      v.value ??
      ""
    );
  }
  return cleanText(v);
}

function teamFromEvent(e, side /* "home" | "away" */) {
  const isHome = side === "home";

  const candidates = [
    isHome ? e?.match_hometeam_name : e?.match_awayteam_name,
    isHome ? e?.home_team_name : e?.away_team_name,
    isHome ? e?.match_hometeam : e?.match_awayteam,

    isHome ? e?.homeTeam : e?.awayTeam,
    isHome ? e?.home : e?.away,
    isHome ? e?.home_team : e?.away_team,
    isHome ? e?.homeTeamName : e?.awayTeamName,
    isHome ? e?.hometeam : e?.awayteam,

    isHome ? e?.teams?.home : e?.teams?.away,
    isHome ? e?.team_home : e?.team_away,
  ];

  for (const c of candidates) {
    const name = pickName(c);
    if (name) return name;
  }
  return "";
}

function normalizeTeamsOnGame(obj) {
  const casa = cleanText(obj?.casa);
  const fora = cleanText(obj?.fora);
  return { ...obj, casa: casa || "Time A", fora: fora || "Time B" };
}

/* =========================================================
   ✅ IA SCORE (MULTIFATOR) — leve, sem chamadas extras
   ========================================================= */
function norm01(v, min, max){
  if (!Number.isFinite(v)) return 0;
  if (max === min) return 0;
  return clamp((v - min) / (max - min), 0, 1);
}

function perfilPenalty(perfil){
  if (perfil === "LATERAIS_FORTES") return 0;
  if (perfil === "EQUILIBRADO") return 0.06;
  return 0.18; // TENDENCIA_CENTRAL
}

function oddsPressureScore(odd){
  if (!Number.isFinite(odd) || odd <= 1.01) return 0.5;
  if (odd >= RULES.favOddMin && odd <= RULES.favOddMax) return 1.0;
  if (odd < RULES.favOddMin) return 0.72;
  if (odd <= 2.20) return 0.65;
  return 0.5;
}

function aiScoreFromMatch(x){
  const p = (x?.over95_prob_adj ?? x?.over95_prob ?? 0) / 100;
  const proj = norm01(Number(x?.proj_cantos ?? 0), 8.8, 13.2);
  const recent = norm01(Number(x?.real?.recentCombinedAvg ?? 0), 8.8, 13.2);
  const pressure = norm01(Number(x?.real?.pressureHits ?? 0), 0, 6);

  const oddsFav = Number(x?.odds?.fav?.odd ?? 0);
  const oddsPress = oddsPressureScore(oddsFav);

  let s =
    (p * 34) +
    (proj * 22) +
    (recent * 22) +
    (pressure * 14) +
    (oddsPress * 8);

  const pen = perfilPenalty(String(x?.perfil_laterais ?? ""));
  s = s * (1 - pen);

  const isCentral = String(x?.perfil_laterais ?? "") === "TENDENCIA_CENTRAL";
  if (isCentral && Number(x?.real?.pressureHits ?? 0) <= 2) s -= 10;

  // penaliza ausência de base completa, mas NÃO mata
  const src = x?.sources || {};
  const missing = [!src.h2h, !src.stats].filter(Boolean).length;
  if (missing === 2) s -= 16;
  else if (missing === 1) s -= 8;

  // ✅ favorito fora só passa se for substituto elite real
  const favSide = x?.odds?.fav?.side || null;
  if (favSide === "AWAY" && !isEliteAwayReplacementGame(x)) s -= 35;
  if (favSide === "AWAY" && isEliteAwayReplacementGame(x)) s += 10;

  return clamp(Math.round(s), 0, 100);
}

/* =========================================================
   ✅ BLOQUEIO Champions mata-mata (pré-jogo)
   ========================================================= */
function normStr(x){
  return String(x || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeFirstLeg(e){
  const a = [
    e.match_round, e.round, e.league_round, e.stage, e.match_stage,
    e.event_round, e.match_name, e.match_type
  ].map(normStr).join(" | ");

  return (
    a.includes("1st leg") ||
    a.includes("first leg") ||
    a.includes("leg 1") ||
    a.includes("ida") ||
    a.includes("jogo de ida") ||
    a.includes("1a mao") ||
    a.includes("1ª mao")
  );
}

function looksLikeSecondLeg(e){
  const a = [
    e.match_round, e.round, e.league_round, e.stage, e.match_stage,
    e.event_round, e.match_name, e.match_type
  ].map(normStr).join(" | ");

  return (
    a.includes("2nd leg") ||
    a.includes("second leg") ||
    a.includes("leg 2") ||
    a.includes("volta") ||
    a.includes("jogo de volta") ||
    a.includes("2a mao") ||
    a.includes("2ª mao")
  );
}

function looksLikeGroupStage(e){
  const a = [
    e.match_round, e.round, e.league_round, e.stage, e.match_stage,
    e.event_round, e.match_name, e.match_type
  ].map(normStr).join(" | ");

  return (
    a.includes("group") ||
    a.includes("group stage") ||
    a.includes("league phase") ||
    (a.includes("fase") && a.includes("grup"))
  );
}

function looksLikeKnockout(e){
  const a = [
    e.match_round, e.round, e.league_round, e.stage, e.match_stage,
    e.event_round, e.match_name, e.match_type
  ].map(normStr).join(" | ");

  return (
    a.includes("knockout") ||
    a.includes("playoff") ||
    a.includes("play-offs") ||
    a.includes("eliminat") ||
    a.includes("round of") ||
    a.includes("oitavas") ||
    a.includes("quartas") ||
    a.includes("semif") ||
    a.includes("semi") ||
    a.includes("final")
  );
}

function intScore(v){
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function findFirstLegInH2H(h2hBlock, leagueId){
  const a1 = Array.isArray(h2hBlock?.firstTeam_lastResults) ? h2hBlock.firstTeam_lastResults : [];
  const a2 = Array.isArray(h2hBlock?.secondTeam_lastResults) ? h2hBlock.secondTeam_lastResults : [];
  const all = [...a1, ...a2];

  const filtered = all.filter(m => {
    if (!m?.match_id) return false;
    const lid = Number(m.match_league_id ?? m.league_id ?? m.leagueId);
    if (Number.isFinite(lid) && Number.isFinite(leagueId) && lid !== leagueId) return false;
    const r = normStr(m.match_round || m.round || m.stage || m.match_stage || m.match_type || "");
    return (
      r.includes("1st leg") ||
      r.includes("first leg") ||
      r.includes("ida") ||
      r.includes("jogo de ida") ||
      r.includes("leg 1")
    );
  });

  if (!filtered.length) return null;

  filtered.sort((x, y) => {
    const dx = new Date(x.match_date || x.match_start || x.match_time || 0).getTime();
    const dy = new Date(y.match_date || y.match_start || y.match_time || 0).getTime();
    return dy - dx;
  });

  return filtered[0] || null;
}

function favoriteLostFirstLeg(firstLegMatch, favoriteTeamName){
  if (!firstLegMatch || !favoriteTeamName) return false;

  const homeName = String(firstLegMatch.match_hometeam_name || firstLegMatch.home_team_name || firstLegMatch.home || "").toLowerCase();
  const awayName = String(firstLegMatch.match_awayteam_name || firstLegMatch.away_team_name || firstLegMatch.away || "").toLowerCase();

  const fav = String(favoriteTeamName).toLowerCase();
  const isFavHome = homeName && (homeName === fav || homeName.includes(fav) || fav.includes(homeName));
  const isFavAway = awayName && (awayName === fav || awayName.includes(fav) || fav.includes(awayName));

  const hs = intScore(firstLegMatch.match_hometeam_score);
  const as = intScore(firstLegMatch.match_awayteam_score);
  if (hs === null || as === null) return false;
  if (hs === as) return false;

  if (isFavHome) return hs < as;
  if (isFavAway) return as < hs;

  return false;
}

// Champions only (liga_id 3)
async function shouldBlockUCLKnockoutPreGame({ leagueId, e, oddsInfo, posHome, posAway, casa, fora, getH2HFn }){
  if (leagueId !== 3) return { block: false, reason: null };
  if (looksLikeGroupStage(e)) return { block: false, reason: null };
  if (!looksLikeKnockout(e)) return { block: false, reason: null };

  // ida: anula
  if (looksLikeFirstLeg(e)) return { block: true, reason: "ucl_first_leg" };

  // se não dá pra afirmar que é volta: bloqueia
  if (!looksLikeSecondLeg(e)) return { block: true, reason: "ucl_unknown_leg_blocked" };

  // precisa favorito
  const favSide = getFavSideSimple(oddsInfo, posHome, posAway);
  if (!favSide) return { block: true, reason: "ucl_no_favorite" };

  const favoriteTeam = favSide === "HOME" ? casa : fora;

  let h2h = null;
  try { h2h = await getH2HFn(casa, fora); } catch { h2h = null; }
  if (!h2h) return { block: true, reason: "ucl_no_h2h" };

  const firstLeg = findFirstLegInH2H(h2h, leagueId);
  if (!firstLeg) return { block: true, reason: "ucl_no_first_leg_found" };

  // se favorito não está atrás, anula
  const favLost = favoriteLostFirstLeg(firstLeg, favoriteTeam);
  if (!favLost) return { block: true, reason: "ucl_fav_not_behind" };

  return { block: false, reason: null, h2hReuse: h2h };
}

/* =========================================================
   ✅ FUNIL EXTRA — HOME RESPONSE (sem mudar sua lógica)
   ========================================================= */

async function getLastMatchOfTeam(teamName, date){
  try {
    const from = dateMinusDays(date, 10);
    const to = dateMinusDays(date, 1);
    if (!from || !to) return null;

    const events = await apiGetAny({
      action: "get_events",
      from,
      to
    });

    if (!Array.isArray(events)) return null;

    const norm = normTeamKey(teamName);

    const list = events.filter(e => {
      const home = normTeamKey(teamFromEvent(e, "home"));
      const away = normTeamKey(teamFromEvent(e, "away"));
      return home === norm || away === norm;
    });

    if (!list.length) return null;

    list.sort((a, b) => {
      const da = new Date(`${a.match_date || "1970-01-01"}T${a.match_time || "00:00"}`);
      const db = new Date(`${b.match_date || "1970-01-01"}T${b.match_time || "00:00"}`);
      return db - da;
    });

    return list[0] || null;
  } catch {
    return null;
  }
}

function detectHomeResponse({
  lastMatch,
  casa,
  homeRecent,
  awayRecent,
  proj_cantos
}){
  if (!HOME_RESPONSE.ENABLE) return { active:false };
  if (!lastMatch) return { active:false };

  const home = teamFromEvent(lastMatch, "home");
  const away = teamFromEvent(lastMatch, "away");

  const hs = intScore(lastMatch.match_hometeam_score);
  const as = intScore(lastMatch.match_awayteam_score);

  if (hs === null || as === null) return { active:false };

  const casaNorm = normTeamKey(casa);
  const awayNorm = normTeamKey(away);

  const lostAway = awayNorm === casaNorm && as < hs;
  if (!lostAway) return { active:false };

  if ((homeRecent?.cornersForAvg ?? 0) < HOME_RESPONSE.MIN_HOME_CORNERS_FOR_AVG) {
    return { active:false };
  }

  if ((awayRecent?.cornersAgainstAvg ?? 0) < HOME_RESPONSE.MIN_AWAY_CONCEDES) {
    return { active:false };
  }

  if ((proj_cantos ?? 0) < HOME_RESPONSE.MIN_PROJ) {
    return { active:false };
  }

  return {
    active: true,
    scoreBonus: HOME_RESPONSE.SCORE_BONUS
  };
}

/* =========================================================
   Comentários
   ========================================================= */
function fmt(n, d = 1){
  if (!Number.isFinite(n)) return "—";
  const p = Math.pow(10, d);
  return (Math.round(n * p) / p).toString();
}

function seedFromMatch(match_id, casa, fora){
  const s = `${match_id || ""}|${casa || ""}|${fora || ""}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(arr, seed = 0){
  if (!arr?.length) return "";
  return arr[Math.abs(seed) % arr.length];
}

function commentLiteFrom({ match_id, casa, fora, proj_cantos, over95_prob, bigMatch, perfil_laterais, leagueBase }){
  const seed = seedFromMatch(match_id, casa, fora);
  const baseTxt = Number.isFinite(leagueBase) ? `Média liga ${fmt(leagueBase,1)}` : `Média liga —`;
  const projTxt = Number.isFinite(proj_cantos) ? `Proj ${fmt(proj_cantos,1)}` : `Proj —`;
  const probTxt = Number.isFinite(over95_prob) ? `${Math.round(over95_prob)}%` : `—%`;

  const perfilTxt =
    (perfil_laterais === "LATERAIS_FORTES") ? "Lados fortes"
    : (perfil_laterais === "EQUILIBRADO") ? "Equilibrado"
    : "Centro (atenção)";

  const call = pick([
    "Bom se tiver pressão cedo.",
    "Pode depender do 1º gol.",
    "Tende a crescer no 2º tempo.",
    "Confirme ritmo nos 15'.",
  ], seed);

  return `${baseTxt} • ${projTxt} • Over9.5 ${probTxt} • ${bigMatch ? "Jogo grande" : "Jogo normal"} • ${perfilTxt}. ${call}`;
}

function commentFullFrom({ match_id, casa, fora, ligaBase, proj_cantos, over95_prob_adj, perfil_laterais, oddsInfo, recentCombinedAvg }){
  const seed = seedFromMatch(match_id, casa, fora);
  const probTxt = Number.isFinite(over95_prob_adj) ? `${Math.round(over95_prob_adj)}%` : "—%";
  const projTxt = Number.isFinite(proj_cantos) ? fmt(proj_cantos, 1) : "—";
  const recentTxt = Number.isFinite(recentCombinedAvg) ? fmt(recentCombinedAvg, 1) : "—";
  const baseTxt = Number.isFinite(ligaBase) ? fmt(ligaBase, 1) : "—";

  const perfilTxt =
    (perfil_laterais === "LATERAIS_FORTES") ? "Lados fortes"
    : (perfil_laterais === "EQUILIBRADO") ? "Equilibrado"
    : "Centro (cuidado)";

  const oddsTxt = oddsInfo?.fav?.odd
    ? `Fav ${oddsInfo.fav.side === "HOME" ? "casa" : "fora"} @${fmt(oddsInfo.fav.odd,2)}`
    : `Odds —`;

  const call = pick([
    "Se começar intenso, linha fica boa.",
    "Se travar cedo, pode ficar pra depois.",
    "Gol cedo ajuda cantos.",
    "Ritmo é o ponto chave.",
  ], seed);

  return `Over9.5 ${probTxt} • Proj ${projTxt} • Recent ${recentTxt} vs liga ${baseTxt} • ${perfilTxt} • ${oddsTxt}. ${call}`;
}

function commentSemiFrom({ match_id, casa, fora, ligaBase, proj_cantos, over95_prob_adj, perfil_laterais, oddsInfo }){
  const seed = seedFromMatch(match_id, casa, fora);
  const probTxt = Number.isFinite(over95_prob_adj) ? `${Math.round(over95_prob_adj)}%` : "—%";
  const projTxt = Number.isFinite(proj_cantos) ? fmt(proj_cantos, 1) : "—";
  const baseTxt = Number.isFinite(ligaBase) ? fmt(ligaBase, 1) : "—";

  const perfilTxt =
    (perfil_laterais === "LATERAIS_FORTES") ? "Lados fortes"
    : (perfil_laterais === "EQUILIBRADO") ? "Equilibrado"
    : "Centro (atenção)";

  const oddsTxt = oddsInfo?.fav?.odd
    ? `Fav ${oddsInfo.fav.side === "HOME" ? "casa" : "fora"} @${fmt(oddsInfo.fav.odd,2)}`
    : `Odds indisponível`;

  const call = pick([
    "Sem histórico completo: confirme ritmo nos 10–15'.",
    "Boa leitura por projeção/perfil; evite se travar cedo.",
    "Se houver pressão lateral, a linha tende a bater.",
    "Jogo pode crescer no 2º tempo.",
  ], seed);

  return `SEMI: Over9.5 ${probTxt} • Proj ${projTxt} vs liga ${baseTxt} • ${perfilTxt} • ${oddsTxt}. ${call}`;
}

// ---------------- Cache memória ----------------
const cache = new Map();
function cacheGet(key) {
  const it = cache.get(key);
  if (!it) return null;
  if (Date.now() > it.exp) { cache.delete(key); return null; }
  return it.val;
}
function cacheSet(key, val, ttlMs = CACHE_TTL_MIN * 60 * 1000) {
  cache.set(key, { val, exp: Date.now() + ttlMs });
}

// ---------------- Cache disco ----------------
const CACHE_DIR = path.join(__dirname, ".cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function persistPath(date){
  return path.join(CACHE_DIR, `quentes-${date}.json`);
}

function readPersist(date){
  const fp = persistPath(date);
  if (!fs.existsSync(fp)) return null;
  try{
    const raw = fs.readFileSync(fp, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || !Array.isArray(parsed.data)) return null;
    const ageMs = Date.now() - parsed.savedAt;
    if (ageMs > PERSIST_TTL_MIN * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writePersist(date, data){
  const fp = persistPath(date);
  try{
    fs.writeFileSync(fp, JSON.stringify({ savedAt: Date.now(), data }, null, 2));
  } catch {}
}

// ---------------- fetch com timeout ----------------
async function fetchJson(url){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try{
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------------- fetch OpenAI com timeout ----------------
async function fetchOpenAIJson(url, body){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try{
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${r.status} ${txt ? `- ${txt.slice(0,300)}` : ""}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function apiHasError(data){
  if (!data) return "Resposta vazia";
  if (typeof data === "object" && !Array.isArray(data)) {
    if (data.error) return String(data.error);
    if (data.message) return String(data.message);
    if (data.errors) return JSON.stringify(data.errors);
  }
  return null;
}

// ✅ apiGet com base configurável (v3 / v2)
async function apiGetBase(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("APIkey", APIKEY);

  const cacheKey = `BASE:${baseUrl}|${url.toString()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(url.toString());
  const errMsg = apiHasError(data);
  if (errMsg) throw new Error(`API retornou erro: ${errMsg}`);

  cacheSet(cacheKey, data);
  return data;
}

async function apiGetV3(params){ return apiGetBase(API_BASE_V3, params); }
async function apiGetV2(params){ return apiGetBase(API_BASE_V2, params); }

// ✅ tenta v3 e cai pro v2
async function apiGetAny(params){
  try { return await apiGetV3(params); } catch {}
  return await apiGetV2(params);
}

// ---------------- Concurrency ----------------
async function mapLimit(items, limit, fn){
  const out = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length){
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------- API calls ----------------
async function getEventsByLeagueDate(leagueId, date) {
  const data = await apiGetV3({ action: "get_events", from: date, to: date, league_id: leagueId });
  return Array.isArray(data) ? data : [];
}

const standingsCache = new Map();
function standingsKey(leagueId){ return `stand_${leagueId}`; }
function standingsGet(leagueId){
  const it = standingsCache.get(standingsKey(leagueId));
  if (!it) return null;
  if (Date.now() > it.exp){ standingsCache.delete(standingsKey(leagueId)); return null; }
  return it.val;
}
function standingsSet(leagueId, val){
  standingsCache.set(standingsKey(leagueId), { val, exp: Date.now() + 12*60*60*1000 });
}

/* =========================================================
   ✅ POSIÇÃO NA TABELA (normalização de nomes)
   ========================================================= */
function normTeamKey(x){
  return String(x || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(fc|sc|ac|ec|cf|afc|cfc|club|clube|sport|futebol|football)\b/g, " ")
    .replace(/\b(rj|sp|mg|rs|pr|sc|ba|ce|pe|go|df|pa|am|mt|ms|es|pb|rn|al|se|ma|pi|ro|rr|ap|to)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(a, b){
  const A = new Set(normTeamKey(a).split(" ").filter(Boolean));
  const B = new Set(normTeamKey(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

async function getStandings(leagueId) {
  const cached = standingsGet(leagueId);
  if (cached) return cached;

  const data = await apiGetV3({ action: "get_standings", league_id: leagueId });
  if (!Array.isArray(data)) return null;

  const map = new Map();
  for (const row of data) {
    const team = row.team_name || row.team || row.teamName;
    const pos = Number(row.overall_league_position || row.position || row.league_position);
    if (team && Number.isFinite(pos)) {
      map.set(normTeamKey(team), pos);
    }
  }

  const val = map.size ? map : null;
  standingsSet(leagueId, val);
  return val;
}

function findTeamPos(standMap, teamName) {
  if (!standMap || !teamName) return null;

  const key = normTeamKey(teamName);
  if (!key) return null;

  if (standMap.has(key)) return standMap.get(key);

  for (const [k, v] of standMap.entries()) {
    if (k === key) return v;
    if (k.includes(key) || key.includes(k)) return v;
  }

  let best = null;
  let bestScore = 0;
  for (const [k, v] of standMap.entries()) {
    const s = tokenScore(k, key);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return bestScore >= 0.66 ? best : null;
}

// ✅ ODDS: tenta v3 e cai pro v2
async function getOdds1x2(matchId) {
  const data = await apiGetAny({ action: "get_odds", match_id: matchId });
  if (!Array.isArray(data) || !data.length) return null;

  const o = data[0];
  const odd1 = Number(String(o.odd_1 || "").replace(",", "."));
  const odd2 = Number(String(o.odd_2 || "").replace(",", "."));
  const oddX = Number(String(o.odd_x || "").replace(",", "."));
  if (!Number.isFinite(odd1) || !Number.isFinite(odd2)) return null;

  const fav = (odd1 <= odd2) ? { side: "HOME", odd: odd1 } : { side: "AWAY", odd: odd2 };
  return { fav, odd1, oddX, odd2, bookmaker: o.odd_bookmakers || null };
}

// ✅ H2H: tenta v3 e cai pro v2
async function getH2H(firstTeam, secondTeam) {
  const data = await apiGetAny({ action: "get_H2H", firstTeam, secondTeam });
  if (!Array.isArray(data) || !data.length) return null;
  return data[0];
}

// ✅ STATS: tenta v3 e cai pro v2
async function getStats(matchId) {
  const data = await apiGetAny({ action: "get_statistics", match_id: matchId });
  if (!Array.isArray(data) || !data.length) return null;

  const root = data[0];
  const arr = root.statistics || root.match_statistics || root;
  const list = Array.isArray(arr) ? arr : (Array.isArray(root.statistics) ? root.statistics : null);
  if (!list) return null;

  const map = new Map();
  for (const row of list) {
    const type = String(row.type || row.name || "").trim().toLowerCase();
    if (!type) continue;
    map.set(type, { home: row.home, away: row.away });
  }
  return map;
}

function numFromStat(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace("%", "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function extractMatchMetrics(statsMap) {
  if (!statsMap) return null;
  const get = (keys) => keys.map(k => statsMap.get(k)).find(Boolean) || null;

  const corners = get(["corner kicks", "corners"]);
  const shotsTotal = get(["shots total", "total shots", "shots"]);
  const shotsOnGoal = get(["shots on goal", "shots on target", "shots on goal "]);
  const possession = get(["ball possession", "possession"]);

  return {
    cornersHome: corners ? numFromStat(corners.home) : null,
    cornersAway: corners ? numFromStat(corners.away) : null,
    shotsTotalHome: shotsTotal ? numFromStat(shotsTotal.home) : null,
    shotsTotalAway: shotsTotal ? numFromStat(shotsTotal.away) : null,
    shotsOnGoalHome: shotsOnGoal ? numFromStat(shotsOnGoal.home) : null,
    shotsOnGoalAway: shotsOnGoal ? numFromStat(shotsOnGoal.away) : null,
    possHome: possession ? numFromStat(possession.home) : null,
    possAway: possession ? numFromStat(possession.away) : null,
  };
}

async function recentTeamAverages(teamName, h2hBlock, which, lastN) {
  const list = Array.isArray(h2hBlock?.[which]) ? h2hBlock[which] : [];
  const slice = list.slice(0, lastN);

  let games = 0;
  let cornersFor = 0;
  let cornersAgainst = 0;
  let shotsTotal = 0;
  let shotsOnGoal = 0;
  let possSum = 0;
  let possCount = 0;
  let over9Count = 0;
  let combinedCornersSum = 0;

  for (const g of slice) {
    const matchId = g.match_id;
    if (!matchId) continue;

    let statsMap = null;
    try { statsMap = await getStats(matchId); } catch { statsMap = null; }
    const m = extractMatchMetrics(statsMap);
    if (!m) continue;

    const home = String(g.match_hometeam_name || "").toLowerCase();
    const isHome = home && teamName && home.includes(String(teamName).toLowerCase());

    const cf = isHome ? m.cornersHome : m.cornersAway;
    const ca = isHome ? m.cornersAway : m.cornersHome;

    const st = isHome ? m.shotsTotalHome : m.shotsTotalAway;
    const sog = isHome ? m.shotsOnGoalHome : m.shotsOnGoalAway;
    const poss = isHome ? m.possHome : m.possAway;

    const cc = (m.cornersHome ?? 0) + (m.cornersAway ?? 0);

    if (cf !== null) cornersFor += cf;
    if (ca !== null) cornersAgainst += ca;
    if (st !== null) shotsTotal += st;
    if (sog !== null) shotsOnGoal += sog;
    if (poss !== null) { possSum += poss; possCount += 1; }

    if (Number.isFinite(cc)) {
      combinedCornersSum += cc;
      if (cc >= 10) over9Count += 1;
    }

    games += 1;
  }

  if (!games) return null;

  return {
    games,
    cornersForAvg: cornersFor / games,
    cornersAgainstAvg: cornersAgainst / games,
    shotsTotalAvg: shotsTotal / games,
    shotsOnGoalAvg: shotsOnGoal / games,
    possAvg: possCount ? (possSum / possCount) : null,
    combinedCornersAvg: combinedCornersSum / games,
    over9Count,
  };
}

// ======= suas regras =======
function baseStatsPass({ leagueAvg, home, away, projCombined }) {
  if (leagueAvg < RULES.minLeagueAvg) return { ok: false, why: "Liga com média baixa" };
  const oneTeamGte5 = (home.cornersForAvg >= RULES.minTeamCornersFor) || (away.cornersForAvg >= RULES.minTeamCornersFor);
  if (!oneTeamGte5) return { ok: false, why: "Nenhum time com cantos a favor >= 5" };
  if (home.cornersForAvg < RULES.minTeamCornersForFloor) return { ok: false, why: "Casa com cantos a favor < 3.5" };
  if (away.cornersForAvg < RULES.minTeamCornersForFloor) return { ok: false, why: "Fora com cantos a favor < 3.5" };
  if (projCombined < RULES.minProjCombined) return { ok: false, why: "Projeção combinada < 10.5" };
  return { ok: true, why: null };
}

function pressurePass({ home, away, oddsInfo }) {
  let hits = 0;

  if ((home.shotsTotalAvg >= RULES.oneTeamShotsTotalGTE) || (away.shotsTotalAvg >= RULES.oneTeamShotsTotalGTE)) hits++;
  if ((home.shotsTotalAvg + away.shotsTotalAvg) >= RULES.combinedShotsTotalGTE) hits++;

  const onePoss55 = (home.possAvg !== null && home.possAvg >= RULES.oneTeamPossessionGTE) ||
                    (away.possAvg !== null && away.possAvg >= RULES.oneTeamPossessionGTE);
  if (onePoss55) hits++;

  if ((home.cornersAgainstAvg >= RULES.oneTeamCornersAgainstGTE) || (away.cornersAgainstAvg >= RULES.oneTeamCornersAgainstGTE)) hits++;
  if ((home.shotsOnGoalAvg + away.shotsOnGoalAvg) >= RULES.combinedShotsOnGoalGTE) hits++;

  const favOk = oddsInfo?.fav?.odd && oddsInfo.fav.odd >= RULES.favOddMin && oddsInfo.fav.odd <= RULES.favOddMax;
  if (favOk) hits++;

  return { ok: hits >= RULES.pressureNeed, hits };
}

function formPass({ recentCombinedAvg, over9Count, leagueAvg }) {
  const cond1 = over9Count >= RULES.over9CountNeed;
  const cond2 = recentCombinedAvg >= RULES.recentAvgCombinedGTE;
  const cond3 = (recentCombinedAvg - leagueAvg) >= RULES.trendUpDelta;
  const ok = cond1 || cond2 || cond3;
  return { ok, cond1, cond2, cond3 };
}

function exclusionFlags({ home, away, perfil }) {
  const flags = [];
  if (perfil === "TENDENCIA_CENTRAL") flags.push("tendencia_central");

  const combinedShots = home.shotsTotalAvg + away.shotsTotalAvg;
  if (combinedShots <= RULES.excludeIfBothLowShotsTotal) flags.push("baixas_finalizacoes");

  if (home.cornersForAvg <= RULES.excludeIfLowCornersForBoth &&
      away.cornersForAvg <= RULES.excludeIfLowCornersForBoth) flags.push("ambos_baixos_em_cantos");

  const possOk = (home.possAvg !== null && away.possAvg !== null);
  if (possOk) {
    if (home.possAvg < 50 && away.possAvg < 50 &&
        (home.shotsOnGoalAvg + away.shotsOnGoalAvg) < 7) flags.push("reativos");
  }
  return flags;
}

// ---------------- LITE ----------------
function liteFromEvent(e, league, posHome = null, posAway = null, lite_reason = "no_base"){
  // 🚫 Confronto direto entre equipes do Top 5 nunca entra, nem em modo LITE
  if (isTop5DirectClash(posHome, posAway)) return null;

  const casa = teamFromEvent(e, "home");
  const fora = teamFromEvent(e, "away");
  const hora = (e.match_time || e.match_status || e.time || "").toString() || "—";
  if (!casa || !fora) return null;

  // evita Champions KO no lite
  if (league.id === 3 && looksLikeKnockout(e)) return null;

  const bigMatch = isBigTeam(casa) || isBigTeam(fora);
  const proj_cantos = projCornersHeuristic(league.baseCorners, bigMatch, posHome, posAway);
  const over95_prob = probFromProjection(proj_cantos);

  const indice_lateralizacao = lateralizacaoIndex(casa, fora, league.baseCorners, proj_cantos);
  const perfil_laterais = perfilLaterais(indice_lateralizacao);

  const lite = {
    mode: "lite",
    lite_reason,

    match_id: e.match_id || null,
    casa,
    fora,
    liga: league.name,
    league_id: league.id,
    hora,

    round_raw: e.match_round ?? e.round ?? null,
    stage_raw: e.stage ?? e.match_stage ?? e.match_type ?? null,
    type_raw: e.match_type ?? null,

    score: league.importance,
    score_adj: league.importance,

    posicao: (Number.isFinite(posHome) && Number.isFinite(posAway)) ? `${posHome}º x ${posAway}º` : "—",
    pos_home: Number.isFinite(posHome) ? posHome : null,
    pos_away: Number.isFinite(posAway) ? posAway : null,

    proj_cantos,

    over95_prob,
    over95_nivel: nivelFromProb(over95_prob),
    over95_prob_adj: over95_prob,
    over95_nivel_adj: nivelFromProb(over95_prob),

    chance_2t: clamp(Math.round(over95_prob + 10), 40, 90),
    indice_lateralizacao,
    perfil_laterais,

    odds: null,
    real: null,

    sources: { odds: false, h2h: false, stats: false },

    comentario: commentLiteFrom({
      match_id: e.match_id || null,
      casa,
      fora,
      proj_cantos,
      over95_prob,
      bigMatch,
      perfil_laterais,
      leagueBase: league.baseCorners
    }),
  };

  return { ...lite, ai_score: aiScoreFromMatch(lite) };
}

/* =========================================================
   ✅ IA + Garantia de BR forte
   ========================================================= */
function stableKey(x){
  return `${x.match_id || ""}|${x.league_id || ""}|${x.casa || ""}|${x.fora || ""}`;
}

function fallbackPickTop6(list){
  const arr = [...(list || [])]
    .filter(x => !isBlockedForSelection(x)) // ✅ blindagem completa
    .map(x => ({ ...x, ai_score: Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x) }));
  arr.sort((a,b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
  return arr.slice(0, 6).map((x, i) => ({ ...x, ai_pick: true, ai_rank: i+1, ai_reason: "fallback_ai_score" }));
}

function isBR(x){ return Number(x?.league_id) === 99; }

function brCornerStrengthScore(x){
  const prob = Number(x?.over95_prob_adj ?? x?.over95_prob ?? 0);
  const proj = Number(x?.proj_cantos ?? 0);
  const perfil = String(x?.perfil_laterais ?? "");
  const pressureHits = Number(x?.real?.pressureHits ?? 0);
  const recent = Number(x?.real?.recentCombinedAvg ?? 0);

  let s = 0;
  s += prob * 1.4;
  s += proj * 6.0;
  s += recent * 3.5;
  s += pressureHits * 8.0;

  if (perfil === "LATERAIS_FORTES") s += 20;
  else if (perfil === "EQUILIBRADO") s += 6;
  else s -= 18;

  const favOdd = Number(x?.odds?.fav?.odd ?? 0);
  if (favOdd >= RULES.favOddMin && favOdd <= RULES.favOddMax) s += 6;

  const src = x?.sources || {};
  if (!src.h2h && !src.stats) s -= 25;

  const aiScore = Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x);
  s += aiScore * 2.2;

  return Math.round(s);
}

function pickTopBRStrong(allList, k = 2){
  const br = (allList || [])
    .filter(isBR)
    .filter(x => !isBlockedForSelection(x)); // ✅ blindagem completa
  br.sort((a,b) => brCornerStrengthScore(b) - brCornerStrengthScore(a));

  const out = [];
  for (const x of br){
    const s = brCornerStrengthScore(x);
    if (s < BR_STRENGTH_THRESHOLD) continue;
    out.push({ ...x, br_strength: s });
    if (out.length >= k) break;
  }
  return out;
}

function ensureBRStrongInTop6(top6, allList){
  let out = [...(top6 || [])].slice(0, 6);

  // ✅ nunca deixa favorito fora passar (blindagem final)
  out = sanitizeSelectionList(out);

  const brStrong = pickTopBRStrong(allList, BR_ENSURE_MAX);
  if (!brStrong.length) return out.slice(0,6).map((x,i)=>({ ...x, ai_rank: i+1 }));

  const already = new Set(out.map(stableKey));
  const strongToInsert = brStrong.filter(x => !already.has(stableKey(x)));

  for (const brPick of strongToInsert){
    if (out.length < 6){
      out.push({ ...brPick, ai_pick:true, ai_reason:"ensure_br_strong" });
      continue;
    }

    let worstIdx = 0;
    let worstVal = Infinity;

    for (let i=0;i<out.length;i++){
      const v = Number.isFinite(out[i].ai_score) ? out[i].ai_score : aiScoreFromMatch(out[i]);
      if (v < worstVal){ worstVal = v; worstIdx = i; }
    }

    out[worstIdx] = {
      ...brPick,
      ai_pick: true,
      ai_reason: "ensure_br_strong",
    };
  }

  return out.slice(0, 6).map((x,i)=>({ ...x, ai_rank: i+1 }));
}

/* =========================================================
   ✅ OPÇÃO A — Só pode entrar no TOP6 se tiver base completa
   ========================================================= */
function isFullBaseGame(x){
  const src = x?.sources || {};
  return x?.mode === "full" && !!src.h2h && !!src.stats;
}

function onlyFullBaseCandidates(list){
  return (list || [])
    .filter(isFullBaseGame)
    .filter(x => !isBlockedAwayFavoriteForSelection(x)); // ✅ favorito fora nunca entra
}

/* =========================================================
   ✅ IA TOP6: escolhe apenas entre FULL BASE (OPÇÃO A)
   ========================================================= */
async function aiPickTop6(list, date){
  const fullOnly = onlyFullBaseCandidates(list);
  if (fullOnly.length < 1) return [];

  const candidatesList = [...fullOnly]
    .map(x => ({ ...x, ai_score: Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x) }))
    .sort((a,b)=> (b.ai_score ?? 0) - (a.ai_score ?? 0));

  if (candidatesList.length <= 6) {
    return ensureBRStrongInTop6(
      candidatesList.slice(0, 6).map((x,i)=>({ ...x, ai_pick:true, ai_rank:i+1, ai_reason:"full_base_auto" })),
      candidatesList
    );
  }

  if (!OPENAI_API_KEY) {
    const fb = fallbackPickTop6(candidatesList);
    return ensureBRStrongInTop6(fb, candidatesList);
  }

  const candidates = candidatesList.slice(0, AI_MAX_CANDIDATES).map((x) => ({
    id: stableKey(x),
    match_id: x.match_id ?? null,
    league_id: x.league_id ?? null,
    liga: x.liga ?? "",
    hora: x.hora ?? "",
    casa: x.casa ?? "",
    fora: x.fora ?? "",
    mode: x.mode ?? "full",
    ai_score: Number.isFinite(x.ai_score) ? x.ai_score : aiScoreFromMatch(x),
    score_adj: x.score_adj ?? x.score ?? null,
    proj_cantos: x.proj_cantos ?? null,
    over95_prob_adj: x.over95_prob_adj ?? x.over95_prob ?? null,
    perfil_laterais: x.perfil_laterais ?? "",
    posicao: x.posicao ?? "—",
    odds_fav: x.odds?.fav?.odd ?? null,
    odds_side: x.odds?.fav?.side ?? null,
    flags: Array.isArray(x.flags) ? x.flags : [],
    sources: x.sources ?? {},
    br_bonus: Number(x.league_id) === 99 ? 1 : 0
  }));

  const system = [
    "Você é um analista PROFISSIONAL e CONSERVADOR de apostas de escanteios.",
    "Escolha os 6 melhores jogos (TOP6) apenas entre os candidatos fornecidos.",
    "IMPORTANTE: todos os candidatos têm base completa (H2H + Stats).",
    "REGRA RÍGIDA 1: NÃO selecione nenhum jogo que tenha qualquer flag começando com 'red_'.",
    "REGRA RÍGIDA 2: NÃO selecione favorito visitante, EXCETO se o candidato tiver flag 'elite_away_replacement'.",
    "REGRA RÍGIDA 3: Evite 'TENDENCIA_CENTRAL'. Só aceite se não houver opções suficientes e coloque sempre nas últimas posições.",
    "REGRA RÍGIDA 4: Evite jogos com 'warn_low_pressure', 'warn_bad_history' ou 'warn_low_avg'. Só use se faltar jogo e coloque no fim.",
    "Critério #1: ai_score mais alto.",
    "Critério #2: perfil_laterais (prefira LATERAIS_FORTES, depois EQUILIBRADO, por último TENDENCIA_CENTRAL).",
    "Critério #3: over95_prob_adj e proj_cantos altos.",
    "Critério #4: pressureHits alto e histórico consistente.",
    "Critério #5: score_adj como desempate.",
    "Evite redundância: tente no máximo 2 jogos por liga, se possível.",
    "Quando houver candidatos equivalentes e limpos, dê leve preferência ao Brasileirão (league_id 99).",
    "Retorne APENAS JSON válido no schema pedido."
  ].join(" ");

  const user = { date, candidates };

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "Top6CornersSelection",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            top6: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  reason: { type: "string" }
                },
                required: ["id","reason"]
              }
            }
          },
          required: ["top6"]
        }
      }
    }
  };

  let data = null;
  try{
    data = await fetchOpenAIJson("https://api.openai.com/v1/responses", body);
  } catch {
    const fb = fallbackPickTop6(candidatesList);
    return ensureBRStrongInTop6(fb, candidatesList);
  }

  const rawText =
    (typeof data?.output_text === "string" && data.output_text) ||
    (Array.isArray(data?.output) ? data.output.map(o => {
      const c = o?.content;
      if (Array.isArray(c)) return c.map(ci => ci?.text).filter(Boolean).join("");
      return "";
    }).join("") : "");

  let parsed = null;
  try { parsed = JSON.parse(rawText); } catch { parsed = null; }
  if (!parsed?.top6 || !Array.isArray(parsed.top6)) {
    const fb = fallbackPickTop6(candidatesList);
    return ensureBRStrongInTop6(fb, candidatesList);
  }

  const byId = new Map();
  for (const x of candidatesList) byId.set(stableKey(x), x);

  const top = [];
  for (let i = 0; i < parsed.top6.length; i++){
    const item = parsed.top6[i];
    const original = byId.get(item.id);
    if (!original) continue;

    // ✅ blindagem: se por algum motivo veio favorito fora, ignora
    if (isBlockedAwayFavoriteForSelection(original)) continue;

    top.push({
      ...original,
      ai_pick: true,
      ai_rank: i + 1,
      ai_reason: String(item.reason || "selected"),
      ai_score: Number.isFinite(original.ai_score) ? original.ai_score : aiScoreFromMatch(original),
    });
  }

  if (top.length < 3){
    const fb = fallbackPickTop6(candidatesList);
    return ensureBRStrongInTop6(fb, candidatesList);
  }

  return ensureBRStrongInTop6(top.slice(0, 6), candidatesList);
}

/* =========================================================
   ✅ IA HUMANA: Analisa os 6 do Top6 como “ser humano”
   ========================================================= */
function humanFallbackFromGame(x){
  const mode = x?.mode === "full" ? "FULL" : "SEMI";
  const perfil = String(x?.perfil_laterais || "");
  const p = Number(x?.over95_prob_adj ?? x?.over95_prob ?? 0);
  const proj = Number(x?.proj_cantos ?? 0);
  const press = Number(x?.real?.pressureHits ?? 0);
  const recent = Number(x?.real?.recentCombinedAvg ?? 0);
  const oddsFav = Number(x?.odds?.fav?.odd ?? NaN);
  const oddsSide = x?.odds?.fav?.side ?? null;

  let risk = "Média";
  if (mode === "FULL" && p >= 78 && perfil === "LATERAIS_FORTES" && press >= 3) risk = "Baixa";
  if (p < 70 || perfil === "TENDENCIA_CENTRAL") risk = "Alta";
  if (oddsSide === "AWAY") risk = "Alta"; // extra

  const chips = [];
  if (risk !== "Baixa") chips.push("CUIDADO");
  if (perfil === "LATERAIS_FORTES") chips.push("LATERAIS MUITO FORTES");
  else if (perfil === "EQUILIBRADO") chips.push("PERFIL EQUILIBRADO");
  else chips.push("TENDÊNCIA CENTRAL");

  if (mode === "SEMI") chips.push("CONFIRMAR 10–15'");

  const summary = (() => {
    const base = `Proj ${fmt(proj,1)} • Over9.5 ${Math.round(p)}%`;
    const extra = [];
    if (Number.isFinite(recent) && recent > 0) extra.push(`Recent ${fmt(recent,1)}`);
    if (Number.isFinite(press) && press > 0) extra.push(`Pressão ${press}/6`);
    if (Number.isFinite(oddsFav)) extra.push(`Fav ${oddsSide === "HOME" ? "casa" : "fora"} @${fmt(oddsFav,2)}`);
    return `${mode}: ${base}${extra.length ? " • " + extra.join(" • ") : ""}. ${mode==="SEMI" ? "Confirme ritmo 10–15'." : "Boa leitura se ritmo vier forte."}`;
  })();

  const pros = [];
  if (proj >= 11.2) pros.push("Projeção alta para cantos");
  if (p >= 75) pros.push("Probabilidade forte para Over 9.5");
  if (perfil === "LATERAIS_FORTES") pros.push("Perfil de jogo favorece cruzamentos");
  if (press >= 3) pros.push("Pressão suficiente pelos indicadores");

  const cons = [];
  if (mode === "SEMI") cons.push("Base incompleta (modo SEMI)");
  if (perfil === "TENDENCIA_CENTRAL") cons.push("Estilo central costuma reduzir cantos");
  if (oddsSide === "AWAY") cons.push("Favorito visitante é armadilha clássica");

  const confirm = (mode === "SEMI" || risk !== "Baixa")
    ? "Aos 10–15’: pressão real, laterais acionadas e 1–2 cantos/chegadas claras. Se travar, evitar."
    : "Aos 10–15’: manter se houver volume e 1+ canto cedo; se ficar morno, esperar 2º tempo.";

  const confidence = clamp((Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x)) / 100, 0.35, 0.85);

  return { risk, chips: chips.slice(0,3), summary, pros: pros.slice(0,3), cons: cons.slice(0,3), confirm, confidence: Number(confidence.toFixed(2)) };
}

async function aiHumanAnalyzeTop6(top6, date){
  const safeTop6 = (top6 || [])
    .slice(0,6)
    .filter(Boolean)
    .filter(x => !isBlockedForSelection(x)); // ✅ blindagem completa
  if (safeTop6.length < 1) return new Map();

  const fallbackMap = new Map();
  for (const x of safeTop6) fallbackMap.set(stableKey(x), humanFallbackFromGame(x));
  if (!OPENAI_API_KEY) return fallbackMap;

  const dossier = safeTop6.map(x => ({
    id: stableKey(x),
    match: `${x.casa} x ${x.fora}`,
    liga: x.liga,
    league_id: x.league_id,
    hora: x.hora,
    mode: x.mode === "full" ? "FULL" : "SEMI",
    ai_score: Number.isFinite(x.ai_score) ? x.ai_score : aiScoreFromMatch(x),

    proj_cantos: x.proj_cantos ?? null,
    over95_prob_adj: x.over95_prob_adj ?? x.over95_prob ?? null,
    perfil_laterais: x.perfil_laterais ?? "",

    pressureHits: x?.real?.pressureHits ?? null,
    recentCombinedAvg: x?.real?.recentCombinedAvg ?? null,

    odds_fav: x?.odds?.fav?.odd ?? null,
    odds_side: x?.odds?.fav?.side ?? null,

    pos_home: x?.pos_home ?? null,
    pos_away: x?.pos_away ?? null,

    flags: Array.isArray(x.flags) ? x.flags : [],
    sources: x.sources ?? {}
  }));

  const system = [
    "Você é um analista humano, experiente e CONSERVADOR de escanteios.",
    "Analise apenas os 6 jogos do TOP6 fornecidos.",
    "REGRAS:",
    "- Use SOMENTE os dados do payload; não invente estatísticas, lesões ou contexto externo.",
    "- Faça um parecer curto, prático e de linguagem simples.",
    "- Sempre diga prós e contras (2 itens cada).",
    "- Sempre diga o que confirmar ao vivo aos 10–15’.",
    "- Se mode=SEMI, seja mais cauteloso e peça confirmação.",
    "Retorne APENAS JSON válido no schema."
  ].join(" ");

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ date, top6: dossier }) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "Top6HumanAnalysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            analysis: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  risk: { type: "string" },       // "Baixa"|"Média"|"Alta"
                  chips: { type: "array", items: { type:"string" }, minItems: 2, maxItems: 3 },
                  summary: { type: "string" },     // 2–3 linhas
                  pros: { type: "array", items: { type:"string" }, minItems: 1, maxItems: 3 },
                  cons: { type: "array", items: { type:"string" }, minItems: 1, maxItems: 3 },
                  confirm: { type: "string" },     // 10–15'
                  confidence: { type: "number" }   // 0..1
                },
                required: ["id","risk","chips","summary","pros","cons","confirm","confidence"]
              }
            }
          },
          required: ["analysis"]
        }
      }
    }
  };

  try{
    const data = await fetchOpenAIJson("https://api.openai.com/v1/responses", body);

    const rawText =
      (typeof data?.output_text === "string" && data.output_text) ||
      (Array.isArray(data?.output) ? data.output.map(o => {
        const c = o?.content;
        if (Array.isArray(c)) return c.map(ci => ci?.text).filter(Boolean).join("");
        return "";
      }).join("") : "");

    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }

    const out = new Map();
    const arr = Array.isArray(parsed?.analysis) ? parsed.analysis : null;
    if (!arr || !arr.length) return fallbackMap;

    for (const item of arr){
      if (!item?.id) continue;
      const conf = clamp(Number(item.confidence ?? 0.55), 0, 1);
      out.set(String(item.id), {
        risk: String(item.risk || "Média"),
        chips: Array.isArray(item.chips) ? item.chips.slice(0,3) : ["CUIDADO"],
        summary: String(item.summary || ""),
        pros: Array.isArray(item.pros) ? item.pros.slice(0,3) : [],
        cons: Array.isArray(item.cons) ? item.cons.slice(0,3) : [],
        confirm: String(item.confirm || "Confirmar 10–15'."),
        confidence: Number(conf.toFixed(2))
      });
    }

    for (const x of safeTop6){
      const id = stableKey(x);
      if (!out.has(id)) out.set(id, fallbackMap.get(id));
    }
    return out;
  } catch {
    return fallbackMap;
  }
}

/* =========================================================
   ✅ IA CARD (1 melhor aposta do dia) — OPÇÃO A
   ========================================================= */
function isEligibleForIaCard(j){
  if (!j) return false;
  if (!isFullBaseGame(j)) return false;

  // ✅ favorito fora nunca
  if (isBlockedAwayFavoriteForSelection(j)) return false;

  if (Number(j.league_id) === 3 && looksLikeKnockout({
    match_round: j.round_raw, round: j.round_raw, stage: j.stage_raw, match_stage: j.stage_raw, match_type: j.type_raw
  })) return false;

  const flags = Array.isArray(j.flags) ? j.flags : [];
  if (flags.includes("away_fav_trap") && !flags.includes("away_fav_trap_released")) return false;

  return true;
}

function pickBestDeterministic(list){
  const arr = (list || [])
    .filter(isEligibleForIaCard)
    .map(x => ({ ...x, ai_score: Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x) }));

  arr.sort((a,b) => {
    const sa = a.ai_score ?? 0, sb = b.ai_score ?? 0;
    if (sb !== sa) return sb - sa;
    const pa = a.over95_prob_adj ?? a.over95_prob ?? 0;
    const pb = b.over95_prob_adj ?? b.over95_prob ?? 0;
    return pb - pa;
  });

  return arr[0] || null;
}

function decideSuggestion(best){
  if (!best) return { sugestao: "Aguardar ao vivo", confianca: "Baixa", why: "Sem jogos com base completa (H2H+Stats)." };

  // ✅ se por algum bug veio favorito fora, corta
  if (isBlockedAwayFavoriteForSelection(best)) {
    return { sugestao: "Aguardar ao vivo", confianca: "Baixa", why: "Favorito visitante (bloqueado)." };
  }

  const p = Number(best.over95_prob_adj ?? best.over95_prob ?? 0);
  const perfil = String(best.perfil_laterais ?? "");

  if (perfil === "TENDENCIA_CENTRAL" && p < 78) {
    return { sugestao: "Aguardar ao vivo", confianca: "Baixa", why: "Tendência central pede confirmação de ritmo." };
  }

  if (p >= 78) return { sugestao: "Pré-jogo: Over 9.5", confianca: "Alta", why: "Prob forte e base completa." };
  if (p >= 72) return { sugestao: "Pré-jogo com cuidado / ou live 10–15'", confianca: "Moderada", why: "Boa leitura; confirme ritmo." };
  return { sugestao: "Aguardar ao vivo", confianca: "Baixa", why: "Probabilidade abaixo do ideal para pré-jogo." };
}

// ✅ NOVO: escolhe o #1 do Top6 (rank/score) de forma robusta
function pickBestFromTop6(top6){
  const arr = (top6 || [])
    .slice()
    .filter(Boolean)
    .filter(x => !isBlockedForSelection(x)); // ✅ blindagem completa

  arr.sort((a,b) => {
    const ar = Number.isFinite(a?.ai_rank) ? a.ai_rank : null;
    const br = Number.isFinite(b?.ai_rank) ? b.ai_rank : null;
    if (ar && br) return ar - br;
    if (ar && !br) return -1;
    if (!ar && br) return 1;

    const sa = Number.isFinite(a?.ai_score) ? a.ai_score : aiScoreFromMatch(a);
    const sb = Number.isFinite(b?.ai_score) ? b.ai_score : aiScoreFromMatch(b);
    if (sb !== sa) return sb - sa;

    const pa = a.over95_prob_adj ?? a.over95_prob ?? 0;
    const pb = b.over95_prob_adj ?? b.over95_prob ?? 0;
    return pb - pa;
  });

  return arr[0] || null;
}

// ✅ NOVO: explicação determinística (quando não tem OpenAI)
function explainBestDeterministic(best, top6){
  if (!best) return "Sem jogos elegíveis hoje com base completa.";
  const p = Number(best.over95_prob_adj ?? best.over95_prob ?? 0);
  const proj = Number(best.proj_cantos ?? 0);
  const press = Number(best?.real?.pressureHits ?? 0);
  const recent = Number(best?.real?.recentCombinedAvg ?? 0);
  const perfil = String(best.perfil_laterais ?? "");

  const parts = [];
  parts.push(`Ele lidera o Top 6 por consistência (ai_score mais alto).`);
  if (Number.isFinite(p)) parts.push(`Prob ajustada ${Math.round(p)}%.`);
  if (Number.isFinite(proj)) parts.push(`Projeção ${fmt(proj,1)} cantos.`);
  if (Number.isFinite(press) && press>0) parts.push(`Pressão ${press}/6.`);
  if (Number.isFinite(recent) && recent>0) parts.push(`Histórico recente ${fmt(recent,1)} cantos combinados.`);
  parts.push(`Perfil ${perfil === "LATERAIS_FORTES" ? "mais favorável (laterais fortes)" : perfil === "EQUILIBRADO" ? "ok (equilibrado)" : "mais arriscado (central)"}.`);
  parts.push(`Regra conservadora respeitada: não é favorito visitante.`);
  return parts.join(" ");
}

// ✅ NOVO: IA pensa por que é o melhor ENTRE OS 6 (comparativo)
async function aiExplainBestAmongTop6(best, top6, date){
  const fallback = (() => {
    const d = decideSuggestion(best);
    return {
      ok: true,
      game: best ? `${best.casa} x ${best.fora}` : "—",
      sugestao: d.sugestao,
      confianca: d.confianca,
      why: best ? explainBestDeterministic(best, top6) : d.why,
      risco: "Risco padrão"
    };
  })();

  if (!best) return fallback;
  if (!OPENAI_API_KEY) return fallback;

  const system = [
    "Você é um analista profissional e CONSERVADOR de escanteios.",
    "Sua tarefa: explicar por que o jogo escolhido é o MELHOR entre os 6 do Top6 (comparação direta).",
    "Regras:",
    "- Seja objetivo e tradicional: fale de consistência, pilares (projeção, prob, perfil, pressão e histórico).",
    "- Se houver um 2º lugar forte, cite uma fraqueza dele em comparação.",
    "- Não invente dados fora do payload.",
    "Retorne APENAS JSON válido."
  ].join(" ");

  const payload = {
    date,
    best: {
      id: stableKey(best),
      liga: best.liga,
      league_id: best.league_id,
      hora: best.hora,
      casa: best.casa,
      fora: best.fora,
      ai_score: Number.isFinite(best.ai_score) ? best.ai_score : aiScoreFromMatch(best),
      proj_cantos: best.proj_cantos ?? null,
      over95_prob_adj: best.over95_prob_adj ?? best.over95_prob ?? null,
      perfil_laterais: best.perfil_laterais ?? "",
      pressureHits: best?.real?.pressureHits ?? null,
      recentCombinedAvg: best?.real?.recentCombinedAvg ?? null,
      odds_fav: best?.odds?.fav?.odd ?? null,
      odds_side: best?.odds?.fav?.side ?? null,
      posicao: best.posicao ?? "—",
      flags: best.flags ?? []
    },
    top6: (top6 || []).slice(0,6).map(x => ({
      id: stableKey(x),
      liga: x.liga,
      casa: x.casa,
      fora: x.fora,
      ai_score: Number.isFinite(x.ai_score) ? x.ai_score : aiScoreFromMatch(x),
      proj_cantos: x.proj_cantos ?? null,
      over95_prob_adj: x.over95_prob_adj ?? x.over95_prob ?? null,
      perfil_laterais: x.perfil_laterais ?? "",
      pressureHits: x?.real?.pressureHits ?? null,
      recentCombinedAvg: x?.real?.recentCombinedAvg ?? null,
      odds_fav: x?.odds?.fav?.odd ?? null,
      odds_side: x?.odds?.fav?.side ?? null,
      flags: x.flags ?? []
    }))
  };

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "Top6BestExplain",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            sugestao: { type: "string" },
            confianca: { type: "string" },
            why: { type: "string" },
            risco: { type: "string" }
          },
          required: ["sugestao","confianca","why","risco"]
        }
      }
    }
  };

  try{
    const data = await fetchOpenAIJson("https://api.openai.com/v1/responses", body);

    const rawText =
      (typeof data?.output_text === "string" && data.output_text) ||
      (Array.isArray(data?.output) ? data.output.map(o => {
        const c = o?.content;
        if (Array.isArray(c)) return c.map(ci => ci?.text).filter(Boolean).join("");
        return "";
      }).join("") : "");

    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }

    const d = decideSuggestion(best);
    return {
      ok: true,
      game: `${best.casa} x ${best.fora}`,
      sugestao: parsed?.sugestao || d.sugestao,
      confianca: parsed?.confianca || d.confianca,
      why: parsed?.why || explainBestDeterministic(best, top6),
      risco: parsed?.risco || "Risco padrão"
    };
  } catch {
    return fallback;
  }
}

/* =========================================================
   ✅ IA THINK (melhor do dia) — mantém o seu /ia_card (compat)
   ========================================================= */
async function aiThinkBestPick(best, top6, date){
  if (!OPENAI_API_KEY || !best) {
    const d = decideSuggestion(best);
    return {
      ok: true,
      best,
      blockedCount: 0,
      sugestao: d.sugestao,
      confianca: d.confianca,
      why: d.why,
      risco: "Risco padrão"
    };
  }

  const system = [
    "Você é um analista profissional de cantos (escanteios).",
    "Sua tarefa: recomendar UMA melhor ação do dia (aposta ou espera), com base nos dados do jogo escolhido e no Top6.",
    "Regras obrigatórias:",
    "- Só existem jogos com base completa (H2H + Stats).",
    "- Nunca sugerir favorito visitante, EXCETO se tiver flag 'elite_away_replacement'.",
    "- Evite mata-mata ida (não sugerir pré-jogo nesses casos).",
    "Retorne APENAS JSON válido."
  ].join(" ");

  const payload = {
    date,
    best: {
      id: stableKey(best),
      match_id: best.match_id,
      liga: best.liga,
      league_id: best.league_id,
      hora: best.hora,
      casa: best.casa,
      fora: best.fora,
      mode: best.mode,
      ai_score: best.ai_score,
      proj_cantos: best.proj_cantos,
      over95_prob_adj: best.over95_prob_adj ?? best.over95_prob,
      chance_2t: best.chance_2t,
      perfil_laterais: best.perfil_laterais,
      posicao: best.posicao,
      odds: best.odds ?? null,
      flags: best.flags ?? [],
      sources: best.sources ?? {},
      comentario: best.comentario ?? ""
    },
    top6: (top6 || []).slice(0, 6).map(x => ({
      id: stableKey(x),
      liga: x.liga,
      casa: x.casa,
      fora: x.fora,
      ai_score: x.ai_score,
      over95_prob_adj: x.over95_prob_adj ?? x.over95_prob,
      perfil_laterais: x.perfil_laterais,
      mode: x.mode
    }))
  };

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "BestCornersRecommendation",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            sugestao: { type: "string" },
            confianca: { type: "string" },
            why: { type: "string" },
            risco: { type: "string" }
          },
          required: ["sugestao","confianca","why","risco"]
        }
      }
    }
  };

  try{
    const data = await fetchOpenAIJson("https://api.openai.com/v1/responses", body);

    const rawText =
      (typeof data?.output_text === "string" && data.output_text) ||
      (Array.isArray(data?.output) ? data.output.map(o => {
        const c = o?.content;
        if (Array.isArray(c)) return c.map(ci => ci?.text).filter(Boolean).join("");
        return "";
      }).join("") : "");

    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }

    const d = decideSuggestion(best);

    return {
      ok: true,
      best,
      blockedCount: 0,
      sugestao: parsed?.sugestao || d.sugestao,
      confianca: parsed?.confianca || d.confianca,
      why: parsed?.why || d.why,
      risco: parsed?.risco || "Risco padrão"
    };
  } catch {
    const d = decideSuggestion(best);
    return {
      ok: true,
      best,
      blockedCount: 0,
      sugestao: d.sugestao,
      confianca: d.confianca,
      why: d.why,
      risco: "Risco padrão"
    };
  }
}

/* =========================================================
   ✅ NOVO: LIGAS DINÂMICAS + WHITELIST POR DIA
   ========================================================= */

// heurística leve pra dar “peso” e “baseCorners” quando a liga é desconhecida
function guessLeagueMeta({ id, name, country }){
  const nm = String(name || "").toLowerCase();
  const ct = String(country || "").toLowerCase();

  let baseCorners = 9.6;
  let importance = 72;

  if (nm.includes("premier")) { baseCorners = 10.8; importance = 95; }
  if (nm.includes("la liga")) { baseCorners = 10.4; importance = 90; }
  if (nm.includes("bundesliga")) { baseCorners = 10.9; importance = 92; }
  if (nm.includes("serie a") || nm.includes("seria a")) { baseCorners = 9.8; importance = 88; }
  if (nm.includes("ligue 1")) { baseCorners = 10.1; importance = 87; }
  if (nm.includes("eredivisie")) { baseCorners = 10.6; importance = 89; }

  if (nm.includes("champions")) { baseCorners = 10.3; importance = 96; }
  if (nm.includes("libertadores")) { baseCorners = 9.8; importance = 94; }
  if (ct.includes("brazil") || ct.includes("brasil") || nm.includes("brasile")) { baseCorners = 10.2; importance = 86; }

  if (importance < 78) baseCorners = clamp(baseCorners, 8.9, 10.2);

  baseCorners = clamp(baseCorners, 8.8, 11.2);
  importance = clamp(importance, 60, 96);

  const ov = LEAGUE_OVERRIDES.get(Number(id));
  if (ov) return { ...ov };

  return { id: Number(id), name: String(name || `Liga ${id}`), baseCorners, importance };
}

// tenta buscar TODAS as ligas via API (v3 -> v2)
async function getAllLeaguesFromAPI(){
  const data = await apiGetAny({ action: "get_leagues" });
  if (!Array.isArray(data)) return null;

  const out = [];
  for (const row of data){
    const id = Number(row.league_id ?? row.leagueId ?? row.id);
    const name = row.league_name ?? row.leagueName ?? row.name ?? row.league ?? "";
    const country = row.country_name ?? row.country ?? row.countryName ?? "";
    if (!Number.isFinite(id) || !name) continue;
    out.push({ id, name: String(name), country: String(country || "") });
  }
  return out.length ? out : null;
}

// cache do whitelist do dia
function daylistCacheKey(date){ return `daylist:${date}`; }

async function getLeaguesForDate(date){
  const ck = daylistCacheKey(date);
  const cached = cacheGet(ck);
  if (cached) return cached;

  let leaguesBase = LEAGUES;

  if (USE_DYNAMIC_LEAGUES){
    const all = await getAllLeaguesFromAPI().catch(()=>null);
    if (all && all.length){
      leaguesBase = all.map(x => guessLeagueMeta(x));
    }
  }

  const checks = await mapLimit(leaguesBase, CONCURRENCY, async (L) => {
    try{
      const ev = await getEventsByLeagueDate(L.id, date);
      return { L, count: Array.isArray(ev) ? ev.length : 0 };
    } catch {
      return { L, count: 0 };
    }
  });

  const withGames = checks
    .filter(x => x.count > 0)
    .map(x => x.L);

  withGames.sort((a,b) => (Number(b.importance||0) - Number(a.importance||0)));

  const limited = withGames.slice(0, DYNAMIC_LEAGUES_MAX_PER_DAY);

  cacheSet(ck, limited, DYNAMIC_DAYLIST_TTL_MIN * 60 * 1000);
  return limited;
}

// ---------------- Routes ----------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/debug/match_base", async (req, res) => {
  const match_id = String(req.query.match_id || "");
  if (!match_id) return res.status(400).json({ ok:false, error:"match_id obrigatório" });
  try{
    const odds = await getOdds1x2(match_id).catch(()=>null);
    const stats = await getStats(match_id).catch(()=>null);
    res.json({
      ok:true,
      match_id,
      odds_ok: !!odds,
      stats_ok: !!stats,
      odds_sample: odds,
      stats_keys: stats ? Array.from(stats.keys()).slice(0, 10) : null
    });
  } catch (e){
    res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

app.get("/debug/leagues", async (req, res) => {
  const date = req.query.date || toISODate();
  try{
    const L = await getLeaguesForDate(date);
    res.json({
      ok: true,
      date,
      use_dynamic: USE_DYNAMIC_LEAGUES,
      max_per_day: DYNAMIC_LEAGUES_MAX_PER_DAY,
      leagues_count: L.length,
      leagues: L.map(l => ({
        id: l.id,
        name: l.name,
        baseCorners: l.baseCorners,
        importance: l.importance
      }))
    });
  } catch (e){
    res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

app.get("/debug/league", async (req, res) => {
  try {
    if (!APIKEY) return res.status(500).json({ ok: false, error: "Falta APIFOOTBALL_KEY no .env" });
    const league_id = Number(req.query.league_id);
    const date = req.query.date || toISODate();
    if (!Number.isFinite(league_id)) return res.status(400).json({ ok: false, error: "league_id inválido" });

    const data = await apiGetV3({ action: "get_events", from: date, to: date, league_id });
    const arr = Array.isArray(data) ? data : [];
    res.json({
      ok: true,
      date,
      league_id,
      count: arr.length,
      sample: arr.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ---------------- Build principal ----------------
const EXTRA_HEAVY_MAX_TOTAL = 12;
const EXTRA_HEAVY_MIN_FULL_WANT = 6;

async function buildQuentesList({ date, fresh }) {
  if (!fresh) {
    const persisted = readPersist(date);
    if (persisted) {
      // Filtra também caches gravados por versões anteriores do servidor.
      const cleanedPersisted = sanitizeSelectionList(persisted).map(normalizeTeamsOnGame);
      if (cleanedPersisted.length) return cleanedPersisted;
    }
  }

  if (!APIKEY) throw new Error("Falta APIFOOTBALL_KEY no .env");

  const DAY_LEAGUES = await getLeaguesForDate(date);

  // 1) eventos + standings por liga
  const leagueResults = await mapLimit(DAY_LEAGUES, CONCURRENCY, async (L) => {
    let events = [];
    try { events = await getEventsByLeagueDate(L.id, date); } catch { events = []; }

    let standings = null;
    try { standings = await getStandings(L.id); } catch { standings = null; }

    return { league: L, events, standings };
  });

  // 2) pré-seleção
  const candidatesByLeague = [];
  for (const pack of leagueResults) {
    const { league, events, standings } = pack;

    const cands = (events || []).map((e) => {
      const match_id = e.match_id;
      const casa = teamFromEvent(e, "home");
      const fora = teamFromEvent(e, "away");
      if (!match_id || !casa || !fora) return null;

      if (league.id === 3 && looksLikeKnockout(e) && looksLikeFirstLeg(e)) return null;
      if (league.id === 3 && looksLikeKnockout(e) && !looksLikeSecondLeg(e)) return null;

      const posHome = findTeamPos(standings, casa);
      const posAway = findTeamPos(standings, fora);

      // 🚫 Os cinco primeiros podem enfrentar times do 6º para baixo,
      // mas confrontos Top 5 x Top 5 ficam totalmente fora da seleção.
      if (isTop5DirectClash(posHome, posAway)) return null;

      const bigMatch = isBigTeam(casa) || isBigTeam(fora);

      const proj = projCornersHeuristic(league.baseCorners, bigMatch, posHome, posAway);
      const prob = probFromProjection(proj);

      let scoreLight = league.importance + (bigMatch ? 10 : 0) + Math.round((prob - 50) * 0.6);
      if (league.id === 99) scoreLight += 6;

      return { league, e, casa, fora, posHome, posAway, bigMatch, proj, prob, scoreLight };
    }).filter(Boolean);

    cands.sort((a,b) => b.scoreLight - a.scoreLight);

    const preN = PRESELECT_OVERRIDE.get(league.id) ?? PRESELECT_PER_LEAGUE_DEFAULT;
    candidatesByLeague.push({ league, top: cands.slice(0, preN) });
  }

  // 3) fase pesada + fila extra
  const heavyJobs = [];
  const extraQueue = [];
  for (const pack of candidatesByLeague) {
    const isPriority = HEAVY_PRIORITY_LEAGUES.has(pack.league.id);
    const limit = isPriority ? HEAVY_PRIORITY_PER_LEAGUE : HEAVY_PER_LEAGUE;
    heavyJobs.push(...pack.top.slice(0, limit));
    extraQueue.push(...pack.top.slice(limit));
  }

  async function analyzeCandidate(c, opts = {}){
    const allowEliteAwayReplacement = opts.allowEliteAwayReplacement === true;
    const { league, e, casa, fora, posHome, posAway, bigMatch } = c;
    const casaN = cleanText(casa);
    const foraN = cleanText(fora);

    // 🚫 Segurança final: nenhum Top 5 x Top 5 entra na fase pesada,
    // mesmo que chegue por fila extra, fallback ou substituição.
    if (isTop5DirectClash(posHome, posAway)) return null;

    // 🚫 BLOQUEIO DE CLÁSSICO EUROPEU
if (isEuropeanClassic(casaN, foraN)) {
  return null;
}

    const match_id = e.match_id;
    const hora = (e.match_time || e.match_status || e.time || "").toString() || "—";

    // odds (PRIMEIRO)
    let oddsInfo = null;
    try { oddsInfo = await getOdds1x2(match_id); } catch { oddsInfo = null; }

    // ✅ FAVORITO FORA BLOQUEADO 100% (por odds OU por posição)
    // - se odds disser AWAY -> block
    // - se odds não existir mas posição indicar AWAY -> block
    if (isAwayFavoriteStrict(oddsInfo, posHome, posAway) && !allowEliteAwayReplacement) {
      return null;
    }

    // Bloqueio Champions KO completo
    let h2hReuse = null;
    if (league.id === 3 && looksLikeKnockout(e)) {
      const ko = await shouldBlockUCLKnockoutPreGame({
        leagueId: league.id,
        e,
        oddsInfo,
        posHome,
        posAway,
        casa: casaN,
        fora: foraN,
        getH2HFn: getH2H
      });
      if (ko.block) return null;
      if (ko.h2hReuse) h2hReuse = ko.h2hReuse;
    }

    // H2H
    let h2h = h2hReuse;
    if (!h2h) {
      try { h2h = await getH2H(casaN, foraN); } catch { h2h = null; }
    }

    const lastN = LASTN_OVERRIDE.get(league.id) ?? LASTN_DEFAULT;

    let homeRecent = null;
    let awayRecent = null;
    let recentCombinedAvg = null;

    if (h2h) {
      try {
        homeRecent = await recentTeamAverages(casaN, h2h, "firstTeam_lastResults", lastN);
        awayRecent = await recentTeamAverages(foraN, h2h, "secondTeam_lastResults", lastN);
      } catch {
        homeRecent = null;
        awayRecent = null;
      }
      if (homeRecent && awayRecent) {
        recentCombinedAvg = (homeRecent.combinedCornersAvg + awayRecent.combinedCornersAvg) / 2;
      }
    }

    let proj_cantos = projCornersHeuristic(league.baseCorners, bigMatch, posHome, posAway);
    if (Number.isFinite(recentCombinedAvg)) {
      proj_cantos = Math.max(proj_cantos, Math.round(recentCombinedAvg * 10) / 10);
    }

    const indice_lateralizacao = lateralizacaoIndex(casaN, foraN, league.baseCorners, proj_cantos);
    const perfil_laterais = perfilLaterais(indice_lateralizacao);

    const over95_prob = probFromProjection(proj_cantos);

    let score = league.importance;
    if (bigMatch) score += 15;
    score += Math.round((over95_prob - 50) * 0.9);
    if (league.id === 99) score += 6;
    score = clamp(score, 60, 150);

    const anti = aplicarAntiRed({ over95_prob, score, perfil: perfil_laterais });
    const over95_prob_adj = anti.over95_prob_adj;
    const score_adj_base = anti.score_adj;

    // ✅ anti-armadilha (mesmo com favorito em casa, ainda pode ser trap por posições)
    const trap = awayFavTrapGuard({
      posHome, posAway,
      oddsInfo,
      proj_cantos,
      homeRecent, awayRecent,
      perfil_laterais
    });

    // 🔥 bloqueio forte trap não liberada
    if (trap.isTrap && !trap.release) return null;

    const flags = [];
    if (trap.isTrap) flags.push("away_fav_trap");
    if (trap.release) flags.push("away_fav_trap_released");

    let score_adj = clamp(score_adj_base - (trap.penalty || 0), 40, 150);
    const chance_2t = clamp(Math.round(over95_prob_adj + 10), 40, 90);

    const hasFullBase = !!homeRecent && !!awayRecent && Number.isFinite(recentCombinedAvg);

    if (hasFullBase) {
      // ✅ ACRÉSCIMO APENAS: detector extra, sem mexer nas suas regras
      let lastHomeMatch = null;
      try {
        lastHomeMatch = await getLastMatchOfTeam(casaN, date);
      } catch {}

      const homeResponse = detectHomeResponse({
        lastMatch: lastHomeMatch,
        casa: casaN,
        homeRecent,
        awayRecent,
        proj_cantos
      });

      const baseCheck = baseStatsPass({ leagueAvg: league.baseCorners, home: homeRecent, away: awayRecent, projCombined: proj_cantos });
      const pressureCheck = pressurePass({ home: homeRecent, away: awayRecent, oddsInfo });

      // 🔒 NOVO: análise pré-jogo contra armadilhas de cantos baixos
      const h2hProfile = calcH2HCornersProfile(h2h);
      const favSidePG = getFavoriteSidePreGame(oddsInfo, posHome, posAway);
      const favoriteRecentPG = getFavoriteRecent({ favSide: favSidePG, homeRecent, awayRecent });
      const underdogRecentPG = getUnderdogRecent({ favSide: favSidePG, homeRecent, awayRecent });

      const preGameTrap = preGameLowCornerTrapCheck({
        h2hProfile,
        favSide: favSidePG,
        favoriteRecent: favoriteRecentPG,
        underdogRecent: underdogRecentPG,
        proj_cantos,
        posHome,
        posAway,
        perfil_laterais
      });

      for (const f of preGameTrap.flags) flags.push(f);

      const eliteAway = eliteAwayReplacementCheck({
        favSide: favSidePG,
        posAway,
        awayRecent,
        homeRecent,
        proj_cantos,
        pressureHits: pressureCheck.hits,
        perfil_laterais
      });

      let eliteAwayScoreBonus = 0;

      if (preGameTrap.block && !allowEliteAwayReplacement) {
        return null;
      }

      if (allowEliteAwayReplacement) {
        if (!eliteAway.ok) return null;

        flags.push("elite_away_replacement");
        for (const f of eliteAway.flags) flags.push(f);

        eliteAwayScoreBonus = eliteAway.score * 3;
      }

      const formCheck = formPass({
        recentCombinedAvg,
        over9Count: Math.min(homeRecent.over9Count, awayRecent.over9Count),
        leagueAvg: league.baseCorners,
      });
      const exFlags = exclusionFlags({ home: homeRecent, away: awayRecent, perfil: perfil_laterais });

      let passed = baseCheck.ok && pressureCheck.ok && formCheck.ok && exFlags.length === 0;

      // 🔥 ANTI-RED GLOBAL
      const antiRed = antiRedGlobalCheck({
        posHome,
        posAway,
        oddsInfo,
        perfil_laterais,
        pressureHits: pressureCheck.hits,
        homeRecent,
        awayRecent,
        recentCombinedAvg
      });

      for (const f of antiRed.flags) {
        if (allowEliteAwayReplacement && eliteAway?.ok && f === "red_away_favorite") continue;
        flags.push(f);
      }

      // ✅ favorito fora só é aceito quando é substituto elite real
      if (antiRed.flags.includes("red_away_favorite") && !(allowEliteAwayReplacement && eliteAway?.ok)) return null;

      const antiRedHardBlock = antiRed.flags.some(f =>
        f.startsWith("red") && !(allowEliteAwayReplacement && eliteAway?.ok && f === "red_away_favorite")
      );

      if (antiRedHardBlock) {
        if (LITE_FALLBACK_LEAGUE_IDS.has(league.id)) {
          // ⚠️ aqui também não deixa favorito fora (já passou pelo bloqueio acima)
          return liteFromEvent(e, league, posHome, posAway, "anti_red_block");
        }
        return null;
      }

      if (!passed) {
        if (LITE_FALLBACK_LEAGUE_IDS.has(league.id)) return liteFromEvent(e, league, posHome, posAway, "rules_failed_lite_allowed");
        return null;
      }

      // ✅ ACRÉSCIMO APENAS: bônus leve no score, sem mudar sua lógica
      score_adj = clamp(
        score_adj_base
        - (trap.penalty || 0)
        + (homeResponse?.scoreBonus || 0)
        + (eliteAwayScoreBonus || 0),
        40,
        150
      );

      if (homeResponse?.active) {
        flags.push("home_response");
      }

      const obj = {
        mode: "full",
        match_id,
        casa: casaN,
        fora: foraN,
        liga: league.name,
        league_id: league.id,
        hora,

        round_raw: e.match_round ?? e.round ?? null,
        stage_raw: e.stage ?? e.match_stage ?? e.match_type ?? null,
        type_raw: e.match_type ?? null,

        score,
        score_adj,

        posicao: (Number.isFinite(posHome) && Number.isFinite(posAway)) ? `${posHome}º x ${posAway}º` : "—",
        pos_home: Number.isFinite(posHome) ? posHome : null,
        pos_away: Number.isFinite(posAway) ? posAway : null,

        proj_cantos,
        chance_2t,

        over95_prob,
        over95_nivel: nivelFromProb(over95_prob),

        over95_prob_adj,
        over95_nivel_adj: nivelFromProb(over95_prob_adj),

        indice_lateralizacao,
        perfil_laterais,

        flags,

        odds: oddsInfo ? {
          fav: oddsInfo.fav,
          odd1: oddsInfo.odd1,
          oddX: oddsInfo.oddX,
          odd2: oddsInfo.odd2,
          bookmaker: oddsInfo.bookmaker,
        } : null,

        real: {
          recentCombinedAvg,
          pressureHits: pressureCheck.hits,
          form: formCheck,
          baseWhy: baseCheck.why,
          lastN_used: lastN
        },

        sources: { odds: !!oddsInfo, h2h: true, stats: true },

        comentario: commentFullFrom({
          match_id,
          casa: casaN,
          fora: foraN,
          ligaBase: league.baseCorners,
          proj_cantos,
          over95_prob_adj,
          perfil_laterais,
          oddsInfo,
          recentCombinedAvg
        }) + (homeResponse?.active
          ? " • Mandante vem de derrota fora e tende a pressionar em casa."
          : "") + (allowEliteAwayReplacement && eliteAway?.ok
          ? " • Substituto elite: visitante forte em pressão e escanteios mesmo fora."
          : ""),
      };

      return { ...obj, ai_score: aiScoreFromMatch(obj) };
    }

    // ✅ SEM BASE COMPLETA => modo SEMI (mas continua proibindo favorito fora)
    const semi = {
      mode: "semi",
      lite_reason: (!h2h ? "no_h2h" : "no_stats_recent"),

      match_id,
      casa: casaN,
      fora: foraN,
      liga: league.name,
      league_id: league.id,
      hora,

      round_raw: e.match_round ?? e.round ?? null,
      stage_raw: e.stage ?? e.match_stage ?? e.match_type ?? null,
      type_raw: e.match_type ?? null,

      score,
      score_adj,

      posicao: (Number.isFinite(posHome) && Number.isFinite(posAway)) ? `${posHome}º x ${posAway}º` : "—",
      pos_home: Number.isFinite(posHome) ? posHome : null,
      pos_away: Number.isFinite(posAway) ? posAway : null,

      proj_cantos,
      chance_2t,

      over95_prob,
      over95_nivel: nivelFromProb(over95_prob),

      over95_prob_adj,
      over95_nivel_adj: nivelFromProb(over95_prob_adj),

      indice_lateralizacao,
      perfil_laterais,

      flags,

      odds: oddsInfo ? {
        fav: oddsInfo.fav,
        odd1: oddsInfo.odd1,
        oddX: oddsInfo.oddX,
        odd2: oddsInfo.odd2,
        bookmaker: oddsInfo.bookmaker,
      } : null,

      real: null,

      sources: { odds: !!oddsInfo, h2h: !!h2h, stats: false },

      comentario: commentSemiFrom({
        match_id,
        casa: casaN,
        fora: foraN,
        ligaBase: league.baseCorners,
        proj_cantos,
        over95_prob_adj,
        perfil_laterais,
        oddsInfo
      }),
    };

    return { ...semi, ai_score: aiScoreFromMatch(semi) };
  }

  // 4) Analisa o primeiro lote
  const eliteReplacementPool = [...heavyJobs, ...extraQueue];
  let analyzed = await mapLimit(heavyJobs, CONCURRENCY, async (c) => analyzeCandidate(c));
  let completos = analyzed.filter(Boolean);

  // 5) Reforço: tenta completar FULL BASE
  let fullCount = completos.filter(isFullBaseGame).length;
  if (fullCount < EXTRA_HEAVY_MIN_FULL_WANT && extraQueue.length) {
    const extraTry = extraQueue.slice(0, EXTRA_HEAVY_MAX_TOTAL);
    const more = await mapLimit(extraTry, CONCURRENCY, async (c) => analyzeCandidate(c));
    completos = completos.concat(more.filter(Boolean));
    fullCount = completos.filter(isFullBaseGame).length;
  }

  // 🔁 NOVO: se o funil ficou fraco ou bloqueou líderes ruins,
  // procura substituto visitante elite em pressão/cantos.
  if (shouldTryEliteAwayReplacement(completos) && eliteReplacementPool.length) {
    const eliteTry = eliteReplacementPool.slice(0, EXTRA_HEAVY_MAX_TOTAL + 12);
    const eliteMore = await mapLimit(eliteTry, CONCURRENCY, async (c) =>
      analyzeCandidate(c, { allowEliteAwayReplacement: true })
    );

    const seen = new Set(completos.map(x => `${x.league_id}|${x.match_id}`));
    for (const x of eliteMore.filter(Boolean)) {
      const k = `${x.league_id}|${x.match_id}`;
      if (!seen.has(k)) {
        completos.push(x);
        seen.add(k);
      }
    }

    fullCount = completos.filter(isFullBaseGame).length;
  }

  // LITE pool
  const litePool = [];
  for (const pack of candidatesByLeague) {
    for (const c of pack.top) {
      const lite = liteFromEvent(c.e, c.league, c.posHome, c.posAway, "pool_lite");
      if (lite && !isBlockedForSelection(lite)) litePool.push(lite);
    }
  }

  completos = completos
    .map(x => ({ ...x, ai_score: Number.isFinite(x?.ai_score) ? x.ai_score : aiScoreFromMatch(x) }))
    .filter(x => !isBlockedForSelection(x)); // ✅ blindagem final completa

  completos.sort((a,b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  let out = (completos.length >= 6)
    ? completos
    : [...completos, ...litePool].slice(0, 30);

  // ✅ blindagem final na saída geral
  out = sanitizeSelectionList(out);

  const prefer = litePool.filter(j =>
    LITE_FALLBACK_LEAGUE_IDS.has(j.league_id) && !isBlockedForSelection(j)
  );
  if (prefer.length) {
    const seen = new Set(out.map(x => `${x.league_id}|${x.match_id}`));
    const add = prefer.filter(x => !seen.has(`${x.league_id}|${x.match_id}`));
    out = [...add, ...out].slice(0, 30);
  }

  out = out.map(normalizeTeamsOnGame);

  if (!fresh) writePersist(date, out);
  return out;
}

// ---------------- Endpoints ----------------
app.get("/quentes", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";

  const ai = String(req.query.ai || "") === "1" || (AI_DEFAULT_ON && String(req.query.ai || "") !== "0");
  const onlyTop = String(req.query.onlyTop || "") === "1";

  try {
    const out = await buildQuentesList({ date, fresh });

    const safeOut = sanitizeSelectionList(out);

    if (!ai) return res.json(safeOut);

    const top6 = await aiPickTop6(safeOut, date);

    const humanMap = await aiHumanAnalyzeTop6(top6, date);

    const top6_enriched = top6.map(x => ({
      ...x,
      ai_human: humanMap.get(stableKey(x)) || humanFallbackFromGame(x)
    }));

    if (onlyTop) return res.json(top6_enriched);

    const topKeys = new Set(top6_enriched.map(stableKey));
    const rest = safeOut.filter(x => !topKeys.has(stableKey(x)));

    // ✅ retorna top6 + resto (já sem favorito fora)
    return res.json([...top6_enriched, ...rest]);

  } catch (err) {
    const fallback = !fresh ? readPersist(date) : null;
    if (fallback) return res.json(sanitizeSelectionList(fallback));
    res.status(500).json({ error: "Erro ao buscar jogos quentes", details: String(err?.message || err) });
  }
});

app.get("/quentes_ai", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";

  try {
    const out = await buildQuentesList({ date, fresh });
    const top6 = await aiPickTop6(out, date);

    const humanMap = await aiHumanAnalyzeTop6(top6, date);

    const top6_enriched = top6.map(x => ({
      ...x,
      ai_human: humanMap.get(stableKey(x)) || humanFallbackFromGame(x)
    }));

    res.json(top6_enriched);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar top6 IA", details: String(err?.message || err) });
  }
});

// ✅ IA Card (compat) — OPÇÃO A
app.get("/ia_card", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";

  try{
    const out = await buildQuentesList({ date, fresh });
    const top6 = await aiPickTop6(out, date);

    const best = pickBestDeterministic(top6) || pickBestDeterministic(out);

    if (!best) {
      return res.json({
        ok: true,
        best: null,
        blockedCount: 0,
        sugestao: "Aguardar ao vivo",
        confianca: "Baixa",
        why: "Sem jogos com base completa (H2H+Stats)."
      });
    }

    const pack = await aiThinkBestPick(best, top6, date);
    res.json(pack);
  } catch (e){
    res.status(500).json({ ok:false, error:"Falha no ia_card", details: String(e?.message || e) });
  }
});

// ✅ IA Match (Top6->Best): explicação comparativa
app.get("/ia_match", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";

  try{
    const out = await buildQuentesList({ date, fresh });
    const top6 = await aiPickTop6(out, date);

    const best = pickBestFromTop6(top6);

    if (!best) {
      return res.json({
        ok: true,
        game: "—",
        sugestao: "Aguardar",
        confianca: "Baixa",
        why: "Sem Top 6 com base completa (H2H+Stats) para análise comparativa.",
        risco: "Risco padrão"
      });
    }

    const pack = await aiExplainBestAmongTop6(best, top6, date);
    res.json(pack);
  } catch (e){
    res.status(500).json({ ok:false, error:"Falha no ia_match", details: String(e?.message || e) });
  }
});



/* =========================================================
   MATCH CENTER — 3 ETAPAS: PRÉ-JOGO / AO VIVO / ENCERRADO
   Dados reais da API. Não interfere no motor de seleção.
   ========================================================= */
function mcNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function mcFirst(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function mcStatusInfo(event) {
  const raw = cleanText(mcFirst(event, [
    "match_status", "status", "event_status", "fixture_status", "status_long", "status_short"
  ], ""));
  const s = raw.toLowerCase();

  const finished = [
    "finished", "ft", "after penalties", "aet", "penalties", "encerrado", "finalizado"
  ].some(x => s === x || s.includes(x));

  const notStarted = !s || [
    "not started", "ns", "scheduled", "time to be defined", "tbd", "postponed", "cancelled", "canceled"
  ].some(x => s === x || s.includes(x));

  const liveByText = !finished && !notStarted && [
    "live", "1st half", "2nd half", "half time", "halftime", "extra time", "break", "in progress"
  ].some(x => s.includes(x));

  const minuteRaw = mcFirst(event, [
    "match_live", "match_minute", "minute", "elapsed", "time_live"
  ], "");
  const minuteMatch = String(minuteRaw).match(/\d+/);
  const minute = minuteMatch ? Number(minuteMatch[0]) : null;
  const live = !finished && (liveByText || (Number.isFinite(minute) && minute > 0));

  return {
    raw: raw || (finished ? "Finished" : live ? "Live" : "Not Started"),
    finished,
    live,
    minute: Number.isFinite(minute) ? minute : (finished ? 90 : null)
  };
}

function mcStatPair(statsMap, aliases) {
  if (!statsMap) return { home: null, away: null };
  for (const alias of aliases) {
    const row = statsMap.get(String(alias).toLowerCase());
    if (row) return { home: mcNumber(row.home), away: mcNumber(row.away) };
  }
  return { home: null, away: null };
}

function mcNormalizeEvents(event) {
  const output = [];
  const homeName = teamFromEvent(event, "home");
  const awayName = teamFromEvent(event, "away");

  const add = (items, type) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const team = cleanText(mcFirst(item, ["team", "team_name", "score_info", "card_team", "substitution_team"], ""));
      const minute = cleanText(mcFirst(item, ["time", "minute", "score_time", "card_time", "substitution_time"], ""));
      let side = cleanText(mcFirst(item, ["side", "team_side"], "")).toLowerCase();
      if (!side && team) {
        const t = normTeamKey(team);
        if (t && t === normTeamKey(homeName)) side = "home";
        else if (t && t === normTeamKey(awayName)) side = "away";
      }
      output.push({
        minute,
        type,
        label: cleanText(mcFirst(item, ["type", "info", "score_info", "card", "substitution"], type)),
        team,
        side
      });
    }
  };

  add(event?.goalscorer, "goal");
  add(event?.cards, "card");
  add(event?.substitutions?.home, "substitution");
  add(event?.substitutions?.away, "substitution");
  add(event?.events, "event");

  output.sort((a, b) => {
    const ma = Number(String(a.minute).match(/\d+/)?.[0] || 0);
    const mb = Number(String(b.minute).match(/\d+/)?.[0] || 0);
    return ma - mb;
  });
  return output;
}

app.get("/match_center", async (req, res) => {
  const matchId = cleanText(req.query.match_id || req.query.event_id || "");
  if (!matchId) return res.status(400).json({ error: "match_id obrigatório" });

  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  try {
    let data = await apiGetAny({ action: "get_events", match_id: matchId });
    let event = Array.isArray(data) ? data.find(e => String(e?.match_id ?? e?.event_key ?? e?.id ?? "") === String(matchId)) : null;
    if (!event && Array.isArray(data) && data.length === 1) event = data[0];

    // Algumas versões da API usam event_id em vez de match_id.
    if (!event) {
      data = await apiGetAny({ action: "get_events", event_id: matchId });
      event = Array.isArray(data) ? data.find(e => String(e?.match_id ?? e?.event_key ?? e?.id ?? "") === String(matchId)) : null;
      if (!event && Array.isArray(data) && data.length === 1) event = data[0];
    }

    if (!event) return res.status(404).json({ error: "Partida não encontrada na API", match_id: matchId });

    const status = mcStatusInfo(event);
    const statsMap = await getStats(matchId).catch(() => null);

    const corners = mcStatPair(statsMap, ["corner kicks", "corners"]);
    const shots = mcStatPair(statsMap, ["shots total", "total shots", "shots"]);
    const shotsOnTarget = mcStatPair(statsMap, ["shots on goal", "shots on target"]);
    const possession = mcStatPair(statsMap, ["ball possession", "possession"]);
    const dangerousAttacks = mcStatPair(statsMap, ["dangerous attacks"]);
    const attacks = mcStatPair(statsMap, ["attacks"]);
    const passes = mcStatPair(statsMap, ["passes accurate", "accurate passes", "passes"]);
    const fouls = mcStatPair(statsMap, ["fouls"]);
    const yellow = mcStatPair(statsMap, ["yellow cards"]);
    const red = mcStatPair(statsMap, ["red cards"]);

    const homeScore = mcNumber(mcFirst(event, ["match_hometeam_score", "home_score", "score_home"], 0)) ?? 0;
    const awayScore = mcNumber(mcFirst(event, ["match_awayteam_score", "away_score", "score_away"], 0)) ?? 0;

    return res.json({
      ok: true,
      match_id: String(matchId),
      home: teamFromEvent(event, "home"),
      away: teamFromEvent(event, "away"),
      league: cleanText(mcFirst(event, ["league_name", "league", "competition_name"], "Liga")),
      date: cleanText(mcFirst(event, ["match_date", "date"], "")),
      time: cleanText(mcFirst(event, ["match_time", "time"], "")),
      status: status.raw,
      status_raw: status.raw,
      live: status.live,
      finished: status.finished,
      minute: status.minute,
      goals: { home: homeScore, away: awayScore },
      score: { home: homeScore, away: awayScore },
      corners,
      shots,
      shots_on_target: shotsOnTarget,
      possession,
      dangerous_attacks: dangerousAttacks,
      attacks,
      passes,
      fouls,
      cards: {
        home: yellow.home,
        away: yellow.away,
        yellow_home: yellow.home,
        yellow_away: yellow.away,
        red_home: red.home,
        red_away: red.away
      },
      pressure: {
        home: dangerousAttacks.home ?? attacks.home,
        away: dangerousAttacks.away ?? attacks.away
      },
      events: mcNormalizeEvents(event),
      sources: {
        event: true,
        statistics: Boolean(statsMap)
      }
    });
  } catch (err) {
    return res.status(500).json({
      error: "Erro ao carregar Match Center",
      details: String(err?.message || err),
      match_id: matchId
    });
  }
});

app.get("/", (req, res) => res.send("Servidor rodando com API ⚽"));

// ---------------- Start ----------------
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`- Teste sem cache: /quentes?date=YYYY-MM-DD&fresh=1`);
  console.log(`- IA: ${OPENAI_API_KEY ? "ON (key ok)" : "OFF (sem OPENAI_API_KEY)"}`);
  console.log(`- Modelo IA: ${OPENAI_MODEL}`);
  console.log(`- AI timeout: ${AI_TIMEOUT_MS}ms`);
  console.log(`- IA Top6 (OPÇÃO A): /quentes_ai?date=YYYY-MM-DD&fresh=1`);
  console.log(`- IA Card (OPÇÃO A): /ia_card?date=YYYY-MM-DD&fresh=1`);
  console.log(`- IA Match (Top6->Best): /ia_match?date=YYYY-MM-DD&fresh=1`);
  console.log(`- Dynamic leagues: ${USE_DYNAMIC_LEAGUES ? "ON" : "OFF"} | max/day=${DYNAMIC_LEAGUES_MAX_PER_DAY}`);
  console.log(`- Debug leagues of day: /debug/leagues?date=YYYY-MM-DD`);
  console.log(`- Debug match base: /debug/match_base?match_id=XXXX`);
});