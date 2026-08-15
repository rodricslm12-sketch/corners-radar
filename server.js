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
import { auth, db, FieldValue } from "./firebase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Permite receber JSON nas rotas de autenticação.
app.use(express.json({ limit: "1mb" }));

// --------- Static (site) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// --------- Config ----------
const APIKEY = process.env.APIFOOTBALL_KEY;

// ✅ separa bases (v3 p/ events/standings; v2 fallback p/ odds/stats/h2h)
const API_BASE_V3 = "https://apiv3.apifootball.com/";
const API_BASE_V2 = "https://apiv2.apifootball.com/";

// Todos os horários de eventos devem chegar já convertidos para Manaus.
const API_TIMEZONE = "America/Manaus";
const QUENTES_CACHE_VERSION = "tz-manaus-v27-history-fallback";

const CORNER_LEARNING_VERSION = "corner-online-v1";

const OFFICIAL_CORNER_PICK_VERSION = "official-corner-pick-v1";

const CORNER_PREGAME_LOCK_VERSION = "corner-pregame-lock-v4-confidence-gate";
const CORNER_PREGAME_LOCK_FILE = path.join(
  __dirname,
  "corner-pregame-locks.json"
);

const OFFICIAL_CORNER_PICK_FILE = path.join(
  __dirname,
  "official-corner-picks.json"
);
const OFFICIAL_CORNER_MIN_CONFIDENCE = Number(
  process.env.OFFICIAL_CORNER_MIN_CONFIDENCE || 66
);
const OFFICIAL_CORNER_MIN_PROJECTION = Number(
  process.env.OFFICIAL_CORNER_MIN_PROJECTION || 9.6
);
const OFFICIAL_CORNER_MIN_ELITE_SCORE = Number(
  process.env.OFFICIAL_CORNER_MIN_ELITE_SCORE || 125
);

const CORNER_LEARNING_FILE = path.join(
  __dirname,
  "corner-learning-model.json"
);
const CORNER_LEARNING_RATE = Number(
  process.env.CORNER_LEARNING_RATE || 0.035
);
const CORNER_MIN_TRAINING_SAMPLES = Number(
  process.env.CORNER_MIN_TRAINING_SAMPLES || 8
);
const CORNER_MAX_PREDICTION_MEMORY = Number(
  process.env.CORNER_MAX_PREDICTION_MEMORY || 1500
);


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

/* =========================================================
   TOP 1 DE CANTOS — FUNIL PREMIUM / CONSERVADOR
   - O card principal só usa ligas fortes.
   - Over 8.5 nunca é Top 1.
   - Jogos de volta UEFA são excluídos do Top 1.
   - Favoritos do usuário recebem prioridade APENAS se passarem
     por todos os filtros de qualidade; nunca furam uma trava.
   ========================================================= */
const TOP1_CORNER_PREMIUM_LEAGUES = new Set([
  152, // Premier League
  302, // La Liga
  175, // Bundesliga
  207, // Serie A
  168, // Ligue 1
  244, // Eredivisie
  266, // Primeira Liga
  99,  // Brasileirão Série A
  18,  // Libertadores
  3,   // Champions League
  4    // Europa League
]);

const TOP1_CORNER_BLOCK_SECOND_LEG_UEFA = new Set([3, 4, 683]);
const TOP1_CORNER_MIN_DATA_QUALITY = Number(
  process.env.TOP1_CORNER_MIN_DATA_QUALITY || 4
);
const TOP1_CORNER_MIN_SAMPLE_GAMES = Number(
  process.env.TOP1_CORNER_MIN_SAMPLE_GAMES || 4
);
const TOP1_CORNER_FAVORITE_BONUS = Number(
  process.env.TOP1_CORNER_FAVORITE_BONUS || 12
);

function top1NormalizeTeam(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function top1FavoriteSet(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); }
    catch { source = source.split(','); }
  }

  return new Set(
    (Array.isArray(source) ? source : [])
      .map(top1NormalizeTeam)
      .filter(Boolean)
      .slice(0, 40)
  );
}

function top1GameHasFavorite(game, favoriteTeams) {
  if (!(favoriteTeams instanceof Set) || !favoriteTeams.size) return false;
  const home = top1NormalizeTeam(game?.casa ?? game?.home ?? game?.home_name);
  const away = top1NormalizeTeam(game?.fora ?? game?.away ?? game?.away_name);
  return favoriteTeams.has(home) || favoriteTeams.has(away);
}


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
      to,
      timezone: API_TIMEZONE
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

// ---------------- Cache persistente: Firestore + disco local de fallback ----------------
const CACHE_DIR = path.join(__dirname, ".cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function persistPath(date){
  return path.join(CACHE_DIR, `quentes-${date}-${QUENTES_CACHE_VERSION}.json`);
}

function firestoreSafeId(value){
  return String(value || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function readPersist(date){
  // 1) Firestore: funciona tanto localmente quanto no Render.
  try {
    const snap = await db.collection("cache_quentes").doc(firestoreSafeId(`${date}-${QUENTES_CACHE_VERSION}`)).get();
    if (snap.exists) {
      const parsed = snap.data();
      if (parsed?.savedAt && Array.isArray(parsed?.data)) {
        const savedAtMs = Number(parsed.savedAtMs ?? new Date(parsed.savedAt).getTime());
        const ageMs = Date.now() - savedAtMs;
        if (Number.isFinite(ageMs) && ageMs <= PERSIST_TTL_MIN * 60 * 1000) {
          return parsed.data;
        }
      }
    }
  } catch (err) {
    console.warn("Firestore cache read falhou; usando disco:", err?.message || err);
  }

  // 2) Disco: fallback útil no desenvolvimento local.
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

async function writePersist(date, data){
  const payload = {
    date,
    savedAt: new Date().toISOString(),
    savedAtMs: Date.now(),
    data
  };

  // Firestore é o armazenamento principal.
  try {
    await db.collection("cache_quentes").doc(firestoreSafeId(`${date}-${QUENTES_CACHE_VERSION}`)).set(payload, { merge: true });
  } catch (err) {
    console.warn("Firestore cache write falhou; mantendo fallback local:", err?.message || err);
  }

  // Mantém uma cópia local para desenvolvimento e contingência.
  const fp = persistPath(date);
  try{
    fs.writeFileSync(fp, JSON.stringify({ savedAt: payload.savedAtMs, data }, null, 2));
  } catch {}
}

function firestoreSanitize(value){
  if (value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;

  if (Array.isArray(value)) {
    return value.map(firestoreSanitize);
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [
        String(key),
        firestoreSanitize(item)
      ])
    );
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = firestoreSanitize(item);
    }
    return out;
  }

  return value;
}

function matchCenterPairHasData(pair){
  return Boolean(
    pair &&
    typeof pair === "object" &&
    (pair.home !== null && pair.home !== undefined ||
     pair.away !== null && pair.away !== undefined)
  );
}

function matchCenterHasUsefulStats(payload){
  if (!payload || typeof payload !== "object") return false;

  return [
    payload.corners,
    payload.shots,
    payload.shots_on_target,
    payload.possession,
    payload.dangerous_attacks,
    payload.attacks,
    payload.passes,
    payload.fouls,
    payload.yellow_cards,
    payload.red_cards
  ].some(matchCenterPairHasData);
}

function preferStoredPair(incoming, stored){
  const incomingHasData = matchCenterPairHasData(incoming);
  const storedHasData = matchCenterPairHasData(stored);

  if (!incomingHasData && storedHasData) return stored;
  if (!incoming || typeof incoming !== "object") return stored || incoming;

  return {
    ...stored,
    ...incoming,
    home: incoming.home ?? stored?.home ?? null,
    away: incoming.away ?? stored?.away ?? null
  };
}

function mergeMatchCenterPayload(stored, incoming){
  if (!stored || typeof stored !== "object") return incoming;
  if (!incoming || typeof incoming !== "object") return stored;

  const merged = {
    ...stored,
    ...incoming
  };

  const pairFields = [
    "corners",
    "shots",
    "shots_on_target",
    "possession",
    "dangerous_attacks",
    "attacks",
    "passes",
    "fouls",
    "accurate_passes",
    "yellow_cards",
    "red_cards",
    "pressure"
  ];

  for (const field of pairFields) {
    merged[field] = preferStoredPair(incoming[field], stored[field]);
  }

  merged.cards = {
    ...(stored.cards || {}),
    ...(incoming.cards || {})
  };

  for (const key of [
    "home", "away", "yellow_home", "yellow_away", "red_home", "red_away"
  ]) {
    merged.cards[key] = incoming.cards?.[key] ?? stored.cards?.[key] ?? null;
  }

  const incomingEvents = Array.isArray(incoming.events) ? incoming.events : [];
  const storedEvents = Array.isArray(stored.events) ? stored.events : [];
  merged.events = incomingEvents.length ? incomingEvents : storedEvents;

  merged.sources = {
    ...(stored.sources || {}),
    ...(incoming.sources || {})
  };

  merged.stats_available = Boolean(
    incoming.stats_available ||
    stored.stats_available ||
    matchCenterHasUsefulStats(merged)
  );

  return merged;
}

async function readMatchCenterPersist(matchId){
  try {
    const snap = await db.collection("match_center").doc(firestoreSafeId(matchId)).get();
    if (!snap.exists) return null;

    const data = snap.data();
    const payload = data?.payload && typeof data.payload === "object"
      ? data.payload
      : null;

    if (!payload) return null;

    return {
      ...payload,
      _firestore: {
        updatedAt: data?.updatedAt || null,
        updatedAtMs: Number(data?.updatedAtMs || 0) || null
      }
    };
  } catch (err) {
    console.warn("Firestore Match Center read falhou:", err?.message || err);
    return null;
  }
}

async function writeMatchCenterPersist(matchId, payload){
  try {
    const stored = await readMatchCenterPersist(matchId);
    const storedClean = stored ? { ...stored } : null;
    if (storedClean) delete storedClean._firestore;

    const mergedPayload = mergeMatchCenterPayload(storedClean, payload);
    const sanitizedPayload = firestoreSanitize(mergedPayload);

    await db.collection("match_center").doc(firestoreSafeId(matchId)).set({
      match_id: String(matchId),
      status: sanitizedPayload?.status || "",
      live: Boolean(sanitizedPayload?.live),
      finished: Boolean(sanitizedPayload?.finished),
      stats_available: matchCenterHasUsefulStats(sanitizedPayload),
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
      payload: sanitizedPayload
    }, { merge: true });

    return sanitizedPayload;
  } catch (err) {
    console.warn("Firestore Match Center write falhou:", err?.message || err);
    return payload;
  }
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


// Match Center precisa sempre de dados atuais. Estas chamadas ignoram o cache
// de 25 minutos usado pelo motor pré-jogo.
async function apiGetFreshBase(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("APIkey", APIKEY);
  url.searchParams.set("_ts", String(Date.now()));

  const data = await fetchJson(url.toString());
  const errMsg = apiHasError(data);
  if (errMsg) throw new Error(`API retornou erro: ${errMsg}`);
  return data;
}

async function apiGetFreshV3(params) {
  return await apiGetFreshBase(API_BASE_V3, params);
}

async function apiGetFreshV2(params) {
  return await apiGetFreshBase(API_BASE_V2, params);
}

async function apiGetFreshAny(params) {
  try { return await apiGetFreshV3(params); } catch {}
  return await apiGetFreshV2(params);
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
  const data = await apiGetV3({ action: "get_events", from: date, to: date, league_id: leagueId, timezone: API_TIMEZONE });
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

// ✅ STATS: tenta v3 e cai pro v2 — parser robusto para formatos diferentes da API
function normalizeStatType(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function statRawValue(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") {
    const nested =
      value.value ??
      value.total ??
      value.count ??
      value.stat ??
      value.number ??
      value.result ??
      value.display ??
      value.text ??
      null;

    if (nested !== null && nested !== undefined && nested !== "") {
      return nested;
    }
  }

  return value;
}

function statSideValue(row, side) {
  if (!row || typeof row !== "object") return null;

  const keys = side === "home"
    ? [
        "home", "hometeam", "home_team", "homeTeam", "local", "casa",
        "value_home", "home_value", "homeValue", "valueHome",
        "match_hometeam", "match_hometeam_value", "hometeam_value",
        "team_home", "home_stat", "homeStat", "home_total"
      ]
    : [
        "away", "awayteam", "away_team", "awayTeam", "visitor", "visitante", "fora",
        "value_away", "away_value", "awayValue", "valueAway",
        "match_awayteam", "match_awayteam_value", "awayteam_value",
        "team_away", "away_stat", "awayStat", "away_total"
      ];

  for (const key of keys) {
    if (!(key in row)) continue;
    const value = statRawValue(row[key]);
    if (value !== null && value !== undefined && value !== "") return value;
  }

  const list =
    (Array.isArray(row.values) && row.values) ||
    (Array.isArray(row.value) && row.value) ||
    (Array.isArray(row.data) && row.data) ||
    null;

  if (list?.length >= 2) {
    return statRawValue(side === "home" ? list[0] : list[1]);
  }

  return null;
}

function statisticsTypeFromNode(node, inheritedType = "") {
  if (!node || typeof node !== "object") return inheritedType;

  return (
    node.type ??
    node.name ??
    node.statistic ??
    node.stat_name ??
    node.statType ??
    node.stat_type ??
    node.label ??
    node.title ??
    node.key ??
    node.metric ??
    node.description ??
    inheritedType
  );
}

function setStatisticsPair(out, type, home, away) {
  const key = normalizeStatType(type);
  if (!key) return;

  const current = out.get(key) || { home: null, away: null };
  out.set(key, {
    home: home ?? current.home ?? null,
    away: away ?? current.away ?? null
  });
}

function collectStatisticsRows(node, out, inheritedType = "") {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    if (
      inheritedType &&
      node.length >= 2 &&
      node.every(item => item === null || ["string", "number"].includes(typeof item))
    ) {
      setStatisticsPair(out, inheritedType, node[0], node[1]);
      return;
    }

    for (const item of node) collectStatisticsRows(item, out, inheritedType);
    return;
  }

  if (typeof node !== "object") return;

  const explicitType = statisticsTypeFromNode(node, inheritedType);
  const home = statSideValue(node, "home");
  const away = statSideValue(node, "away");

  if (explicitType && (home !== null || away !== null)) {
    setStatisticsPair(out, explicitType, home, away);
  }

  const ignored = new Set([
    "type", "name", "statistic", "stat_name", "statType", "stat_type",
    "label", "title", "key", "metric", "description",
    "home", "away", "hometeam", "awayteam", "home_team", "away_team",
    "homeTeam", "awayTeam", "local", "visitor", "visitante", "casa", "fora",
    "value_home", "value_away", "home_value", "away_value",
    "homeValue", "awayValue", "valueHome", "valueAway",
    "match_hometeam", "match_awayteam", "match_hometeam_value",
    "match_awayteam_value", "team_home", "team_away",
    "values", "value"
  ]);

  for (const [key, value] of Object.entries(node)) {
    if (ignored.has(key)) continue;

    if (value && typeof value === "object") {
      const nestedHome = statSideValue(value, "home");
      const nestedAway = statSideValue(value, "away");

      if (nestedHome !== null || nestedAway !== null) {
        setStatisticsPair(out, key, nestedHome, nestedAway);
      } else if (
        Array.isArray(value) &&
        value.length >= 2 &&
        value.every(item => item === null || ["string", "number"].includes(typeof item))
      ) {
        setStatisticsPair(out, key, value[0], value[1]);
      }

      collectStatisticsRows(value, out, key);
    }
  }
}

async function getStats(matchId) {
  const data = await apiGetAny({ action: "get_statistics", match_id: matchId });
  if (!data) return null;

  const map = new Map();
  collectStatisticsRows(data, map);
  return map.size ? map : null;
}


async function getStatsFresh(matchId, event = null) {
  const map = new Map();

  // Algumas respostas de get_events já trazem statistics dentro do próprio jogo.
  if (event) {
    collectStatisticsRows(event?.statistics, map);
    collectStatisticsRows(event?.stats, map);
    collectStatisticsRows(event?.match_statistics, map);
  }

  const attempts = [
    { action: "get_statistics", match_id: matchId },
    { action: "get_statistics", event_id: matchId }
  ];

  for (const params of attempts) {
    try {
      const data = await apiGetFreshAny(params);
      collectStatisticsRows(data, map);
      if (map.size) break;
    } catch {}
  }

  return map.size ? map : null;
}

/* =========================================================
   MATCH CENTER — ESTATÍSTICAS POR PERÍODO
   A API pode devolver 1º tempo, 2º tempo e jogo completo.
   O parser antigo misturava os blocos e podia exibir o 1º tempo
   como se fosse o resultado final.
   ========================================================= */

function mcPeriodPriority(text) {
  const s = normalizeStatType(text);

  if (
    s.includes("full time") ||
    s.includes("fulltime") ||
    s.includes("match total") ||
    s.includes("total match") ||
    s.includes("whole match") ||
    s.includes("90 min") ||
    s.includes("90 minutes") ||
    s === "match" ||
    s === "total" ||
    s.includes("jogo completo") ||
    s.includes("tempo regulamentar")
  ) return 100;

  if (
    s.includes("second half") ||
    s.includes("2nd half") ||
    s.includes("2 half") ||
    s.includes("segundo tempo")
  ) return 30;

  if (
    s.includes("first half") ||
    s.includes("1st half") ||
    s.includes("1 half") ||
    s.includes("primeiro tempo") ||
    s.includes("half time")
  ) return 10;

  return 50;
}

function collectStatisticsRowsByPeriod(node, state, context = "") {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) collectStatisticsRowsByPeriod(item, state, context);
    return;
  }

  if (typeof node !== "object") return;

  const ownPeriod = [
    node.period,
    node.half,
    node.time,
    node.stage,
    node.section,
    node.title,
    node.group,
    node.name
  ].filter(Boolean).join(" ");

  const currentContext = `${context} ${ownPeriod}`.trim();
  const priority = mcPeriodPriority(currentContext);

  const explicitType = statisticsTypeFromNode(node, "");

  const home = statSideValue(node, "home");
  const away = statSideValue(node, "away");

  if (explicitType && (home !== null || away !== null)) {
    const key = normalizeStatType(explicitType);
    if (key) {
      const previous = state.get(key);
      if (!previous || priority > previous.priority) {
        state.set(key, {
          home,
          away,
          priority,
          period: currentContext || "generic"
        });
      }
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if ([
      "type","statistic","stat_name","label","key",
      "home","away","hometeam","awayteam","home_team","away_team",
      "local","visitor","casa","fora","value_home","value_away"
    ].includes(key)) continue;

    if (value && typeof value === "object") {
      collectStatisticsRowsByPeriod(value, state, `${currentContext} ${key}`.trim());
    }
  }
}

async function getMatchCenterStatsFresh(matchId, event = null, finished = false) {
  const ranked = new Map();
  const usedSources = [];
  let rawShape = null;

  // Partida encerrada: V2 primeiro, pois normalmente guarda o consolidado final.
  // Ao vivo: V3 primeiro. As outras tentativas apenas completam campos ausentes.
  const providers = finished
    ? [
        { name: "v2_final", fn: apiGetFreshV2 },
        { name: "v3_fallback", fn: apiGetFreshV3 }
      ]
    : [
        { name: "v3_live", fn: apiGetFreshV3 },
        { name: "v2_fallback", fn: apiGetFreshV2 }
      ];

  const paramAttempts = [
    { action: "get_statistics", match_id: matchId },
    { action: "get_statistics", event_id: matchId }
  ];

  for (const provider of providers) {
    let providerAdded = false;

    for (const params of paramAttempts) {
      try {
        const data = await provider.fn(params);
        if (data === null || data === undefined) continue;

        rawShape = Array.isArray(data)
          ? "array"
          : data && typeof data === "object"
            ? "object"
            : typeof data;

        const before = ranked.size;
        collectStatisticsRowsByPeriod(
          data,
          ranked,
          `${provider.name} full match`
        );

        if (ranked.size > before) providerAdded = true;
      } catch {}
    }

    if (providerAdded) usedSources.push(provider.name);
  }

  // Completa somente campos ausentes com estatísticas embutidas no evento.
  // Isso é útil porque alguns campeonatos entregam o resultado final em get_events.
  if (event) {
    const before = ranked.size;
    collectStatisticsRowsByPeriod(event?.statistics, ranked, "event statistics");
    collectStatisticsRowsByPeriod(event?.stats, ranked, "event stats");
    collectStatisticsRowsByPeriod(event?.match_statistics, ranked, "event match statistics");
    if (ranked.size > before) usedSources.push("event_embedded");
  }

  if (!ranked.size) {
    return {
      map: null,
      periods: {},
      source: "unavailable",
      rawShape
    };
  }

  const map = new Map();
  const periods = {};

  for (const [key, value] of ranked.entries()) {
    map.set(key, { home: value.home, away: value.away });
    periods[key] = {
      period: value.period,
      priority: value.priority
    };
  }

  return {
    map,
    periods,
    source: usedSources.join("+") || "statistics",
    rawShape
  };
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


function badgeFromEvent(e, side) {
  const home = side === "home";
  const values = home
    ? [
        e?.team_home_badge, e?.home_team_badge, e?.home_badge,
        e?.match_hometeam_badge, e?.home_team_logo, e?.hometeam_logo
      ]
    : [
        e?.team_away_badge, e?.away_team_badge, e?.away_badge,
        e?.match_awayteam_badge, e?.away_team_logo, e?.awayteam_logo
      ];
  return values.find(v => /^https?:\/\//i.test(String(v || ""))) || null;
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
    home_badge: badgeFromEvent(e, "home"),
    away_badge: badgeFromEvent(e, "away"),
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
    .filter(Boolean)
    .filter(x => {
      const ai = x?.corners_ai;
      if (ai && !ai.skip) return true;
      return isEligibleForIaCard(x);
    })
    .map(x => ({
      ...x,
      ai_score:
        Number.isFinite(x?.ai_score)
          ? x.ai_score
          : aiScoreFromMatch(x),
      corner_elite_score: Number(
        x?.corner_elite_score ??
        cornerEliteScore(x)
      )
    }));

  arr.sort((a,b) => {
    const eliteDiff =
      Number(b?.corner_elite_score ?? -999) -
      Number(a?.corner_elite_score ?? -999);

    if (eliteDiff !== 0) return eliteDiff;

    const projectionDiff =
      Number(b?.corners_ai?.projection ?? b?.proj_cantos ?? 0) -
      Number(a?.corners_ai?.projection ?? a?.proj_cantos ?? 0);

    if (projectionDiff !== 0) return projectionDiff;

    const confidenceDiff =
      Number(b?.corners_ai?.confidence ?? b?.over95_prob_adj ?? 0) -
      Number(a?.corners_ai?.confidence ?? a?.over95_prob_adj ?? 0);

    return confidenceDiff;
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

// =========================================================
// FIREBASE AUTH — validação segura no servidor
// =========================================================
function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function verifyFirebaseToken(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Token de autenticação não enviado."
      });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (err) {
    console.warn("Firebase Auth inválido:", err?.message || err);
    return res.status(401).json({
      ok: false,
      error: "Token de autenticação inválido ou expirado."
    });
  }
}

async function requirePremium(req, res, next) {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({
        ok: false,
        error: "Usuário não autenticado."
      });
    }

    const snap = await db.collection("users").doc(req.user.uid).get();

    if (!snap.exists) {
      return res.status(403).json({
        ok: false,
        error: "Cadastro do usuário não encontrado."
      });
    }

    const userData = snap.data() || {};
    if (userData.premium !== true) {
      return res.status(403).json({
        ok: false,
        error: "Esta área exige um plano Premium."
      });
    }

    req.userProfile = userData;
    return next();
  } catch (err) {
    console.error("Erro ao consultar plano Premium:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Não foi possível verificar o plano do usuário."
    });
  }
}


function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminUser(decodedToken, profile = null) {
  const email = String(decodedToken?.email || profile?.email || "").trim().toLowerCase();
  const adminEmails = getAdminEmails();
  return Boolean(profile?.admin === true || (email && adminEmails.has(email)));
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ ok: false, error: "Usuário não autenticado." });
    }

    const snap = await db.collection("users").doc(req.user.uid).get();
    const profile = snap.exists ? (snap.data() || {}) : {};

    if (!isAdminUser(req.user, profile)) {
      return res.status(403).json({
        ok: false,
        error: "Acesso permitido somente para administradores."
      });
    }

    req.adminProfile = profile;
    return next();
  } catch (err) {
    console.error("Erro ao validar administrador:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Não foi possível validar o acesso administrativo."
    });
  }
}

function timestampToISO(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicUserProfile(doc) {
  const data = doc.data() || {};
  return {
    uid: doc.id,
    nome: data.nome || data.displayName || "Usuário",
    email: data.email || "",
    foto: data.foto || data.photoURL || "",
    premium: data.premium === true,
    admin: data.admin === true,
    bloqueado: data.bloqueado === true,
    criadoEm: timestampToISO(data.criadoEm),
    ultimoLogin: timestampToISO(data.ultimoLogin),
    atualizadoEm: timestampToISO(data.atualizadoEm)
  };
}

async function saveAuthenticatedUser(decodedToken) {
  const userRef = db.collection("users").doc(decodedToken.uid);
  const snap = await userRef.get();

  const commonData = {
    uid: decodedToken.uid,
    email: decodedToken.email || "",
    nome: decodedToken.name || "",
    foto: decodedToken.picture || "",
    emailVerificado: decodedToken.email_verified === true,
    provedor: decodedToken.firebase?.sign_in_provider || "firebase",
    ultimoLogin: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp()
  };

  if (!snap.exists) {
    await userRef.set({
      ...commonData,
      premium: false,
      criadoEm: FieldValue.serverTimestamp()
    });
  } else {
    await userRef.set(commonData, { merge: true });
  }

  const updated = await userRef.get();
  return updated.data() || { ...commonData, premium: false };
}

// Recebe o ID token gerado pelo Firebase no navegador, valida e registra o usuário.
app.post("/auth/firebase", async (req, res) => {
  try {
    const bodyToken = String(req.body?.token || "").trim();
    const token = bodyToken || getBearerToken(req);

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: "Envie o token do Firebase."
      });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const profile = await saveAuthenticatedUser(decodedToken);

    return res.json({
      ok: true,
      user: {
        uid: decodedToken.uid,
        nome: profile.nome || decodedToken.name || "",
        email: profile.email || decodedToken.email || "",
        foto: profile.foto || decodedToken.picture || "",
        premium: profile.premium === true,
        admin: isAdminUser(decodedToken, profile)
      }
    });
  } catch (err) {
    console.warn("Falha no login Firebase:", err?.message || err);
    return res.status(401).json({
      ok: false,
      error: "Não foi possível autenticar com o Firebase."
    });
  }
});

// Retorna os dados atuais do usuário autenticado.
app.get("/auth/me", verifyFirebaseToken, async (req, res) => {
  try {
    const profile = await saveAuthenticatedUser(req.user);
    return res.json({
      ok: true,
      user: {
        uid: req.user.uid,
        nome: profile.nome || req.user.name || "",
        email: profile.email || req.user.email || "",
        foto: profile.foto || req.user.picture || "",
        premium: profile.premium === true,
        admin: isAdminUser(req.user, profile)
      }
    });
  } catch (err) {
    console.error("Erro em /auth/me:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Não foi possível carregar o usuário."
    });
  }
});

// Rota simples para o front-end confirmar se o usuário possui Premium.
app.get(
  "/auth/premium",
  verifyFirebaseToken,
  requirePremium,
  (req, res) => res.json({ ok: true, premium: true })
);



// =========================================================
// ADMIN — usuários e planos controlados pelo Firestore
// Configure no Render: ADMIN_EMAILS=seuemail@gmail.com
// =========================================================
app.get("/admin/me", verifyFirebaseToken, requireAdmin, async (req, res) => {
  return res.json({
    ok: true,
    admin: true,
    user: {
      uid: req.user.uid,
      nome: req.adminProfile?.nome || req.user.name || "Administrador",
      email: req.adminProfile?.email || req.user.email || "",
      foto: req.adminProfile?.foto || req.user.picture || ""
    }
  });
});

app.get("/admin/users", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
    const search = String(req.query.search || "").trim().toLowerCase();
    const snap = await db.collection("users").orderBy("ultimoLogin", "desc").limit(limit).get();

    let users = snap.docs.map(publicUserProfile);
    if (search) {
      users = users.filter(user =>
        user.nome.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.uid.toLowerCase().includes(search)
      );
    }

    return res.json({ ok: true, users });
  } catch (err) {
    // Se documentos antigos não tiverem ultimoLogin, evita quebrar o painel.
    try {
      const snap = await db.collection("users").limit(500).get();
      return res.json({ ok: true, users: snap.docs.map(publicUserProfile) });
    } catch (fallbackErr) {
      console.error("Erro ao listar usuários:", fallbackErr?.message || fallbackErr);
      return res.status(500).json({ ok: false, error: "Não foi possível listar os usuários." });
    }
  }
});

app.patch("/admin/users/:uid/plan", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    const premium = req.body?.premium === true;

    if (!uid) {
      return res.status(400).json({ ok: false, error: "UID do usuário não enviado." });
    }

    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
    }

    await ref.set({
      premium,
      plano: premium ? "pro" : "free",
      planoAtualizadoEm: FieldValue.serverTimestamp(),
      planoAtualizadoPor: req.user.email || req.user.uid,
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    const updated = await ref.get();
    return res.json({ ok: true, user: publicUserProfile(updated) });
  } catch (err) {
    console.error("Erro ao atualizar plano:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Não foi possível atualizar o plano." });
  }
});

app.get("/admin/stats", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("users").get();
    const users = snap.docs.map(publicUserProfile);
    const premiumUsers = users.filter(user => user.premium).length;
    const freeUsers = users.length - premiumUsers;

    return res.json({
      ok: true,
      totalUsers: users.length,
      premiumUsers,
      freeUsers,
      onlineUsers: users.filter(user => {
        if (!user.ultimoLogin) return false;
        return Date.now() - new Date(user.ultimoLogin).getTime() <= 15 * 60 * 1000;
      }).length,
      matchesToday: 0,
      aiAccuracy: 74,
      apiStatus: "ATIVA"
    });
  } catch (err) {
    console.error("Erro em /admin/stats:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Não foi possível carregar as estatísticas." });
  }
});

app.get("/admin/online-users", verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const since = Date.now() - 15 * 60 * 1000;
    const snap = await db.collection("users").get();
    const users = snap.docs
      .map(publicUserProfile)
      .filter(user => user.ultimoLogin && new Date(user.ultimoLogin).getTime() >= since)
      .map(user => ({
        uid: user.uid,
        name: user.nome,
        device: user.nome,
        browser: user.premium ? "PRO" : "FREE",
        location: user.email
      }));
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Não foi possível carregar usuários online." });
  }
});


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

    const data = await apiGetV3({ action: "get_events", from: date, to: date, league_id, timezone: API_TIMEZONE });
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
    const persisted = await readPersist(date);
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
        home_badge: badgeFromEvent(e, "home"),
        away_badge: badgeFromEvent(e, "away"),
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

  await writePersist(date, out);
  return out;
}

// ---------------- Ranking estável para o aplicativo ----------------
// A API entrega a lista principal pela força de cantos. O horário continua
// disponível como informação e só deve ordenar quando o usuário pedir no app.
function cornerStrengthForClient(game) {
  const ai = Number(game?.ai_score ?? game?.score_adj ?? game?.local_score ?? game?.score ?? 0);
  const prob = Number(game?.prob_over_95 ?? game?.prob_over95 ?? game?.probabilidade ?? game?.confidence ?? 0);
  const proj = Number(game?.proj_cantos ?? game?.projected_corners ?? game?.projection ?? 0);
  return (Number.isFinite(ai) ? ai : 0) * 0.45
    + (Number.isFinite(prob) ? prob : 0) * 0.35
    + (Number.isFinite(proj) ? proj : 0) * 2.0;
}


const DEFAULT_CORNER_LEARNING_MODEL = {
  version: CORNER_LEARNING_VERSION,
  updated_at: null,
  samples: 0,
  greens: 0,
  reds: 0,
  pushes: 0,
  projection_bias: 0,
  confidence_bias: 0,
  elite_bias: 0,
  feature_weights: {
    projection: 1.00,
    confidence: 1.00,
    pressure: 1.00,
    recent: 1.00,
    team_creation: 1.00,
    opponent_concede: 1.00,
    sample: 1.00
  },
  line_bias: {
    "OVER 8.5": 0,
    "OVER 9.5": 0,
    "OVER 10.5": 0,
    "OVER 11.5": 0,
    "UNDER 9.5": 0,
    "UNDER 10.5": 0,
    "UNDER 11.5": 0
  },
  league_memory: {},
  team_memory: {},
  line_memory: {},
  predictions: {}
};

let cornerLearningModel = null;
let cornerLearningWriteTimer = null;

function cornerLearningCloneDefault() {
  return JSON.parse(
    JSON.stringify(DEFAULT_CORNER_LEARNING_MODEL)
  );
}

function cornerLearningClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadCornerLearningModel() {
  if (cornerLearningModel) return cornerLearningModel;

  try {
    if (fs.existsSync(CORNER_LEARNING_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(CORNER_LEARNING_FILE, "utf8")
      );

      cornerLearningModel = {
        ...cornerLearningCloneDefault(),
        ...parsed,
        feature_weights: {
          ...DEFAULT_CORNER_LEARNING_MODEL.feature_weights,
          ...(parsed?.feature_weights || {})
        },
        line_bias: {
          ...DEFAULT_CORNER_LEARNING_MODEL.line_bias,
          ...(parsed?.line_bias || {})
        },
        league_memory:
          parsed?.league_memory &&
          typeof parsed.league_memory === "object"
            ? parsed.league_memory
            : {},
        team_memory:
          parsed?.team_memory &&
          typeof parsed.team_memory === "object"
            ? parsed.team_memory
            : {},
        line_memory:
          parsed?.line_memory &&
          typeof parsed.line_memory === "object"
            ? parsed.line_memory
            : {},
        predictions:
          parsed?.predictions &&
          typeof parsed.predictions === "object"
            ? parsed.predictions
            : {}
      };

      return cornerLearningModel;
    }
  } catch (error) {
    console.warn(
      "[corner-learning] Não foi possível carregar o modelo:",
      error?.message || error
    );
  }

  cornerLearningModel = cornerLearningCloneDefault();
  return cornerLearningModel;
}

function scheduleCornerLearningSave() {
  if (cornerLearningWriteTimer) return;

  cornerLearningWriteTimer = setTimeout(() => {
    cornerLearningWriteTimer = null;

    try {
      const model = loadCornerLearningModel();
      model.updated_at = new Date().toISOString();

      const temporary = `${CORNER_LEARNING_FILE}.tmp`;

      fs.writeFileSync(
        temporary,
        JSON.stringify(model, null, 2),
        "utf8"
      );

      fs.renameSync(temporary, CORNER_LEARNING_FILE);
    } catch (error) {
      console.warn(
        "[corner-learning] Não foi possível salvar o modelo:",
        error?.message || error
      );
    }
  }, 500);
}

function cornerLearningStatusText() {
  const model = loadCornerLearningModel();

  if (model.samples < CORNER_MIN_TRAINING_SAMPLES) {
    return "COLETANDO DADOS";
  }

  if (model.samples < 40) {
    return "APRENDENDO";
  }

  return "MODELO ADAPTATIVO";
}

function cornerLearningLineNumber(line) {
  const match = String(line || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function cornerLearningFeatures(game, decision) {
  const homeProfile = game?.engine_profiles?.home || {};
  const awayProfile = game?.engine_profiles?.away || {};

  return {
    projection:
      Number(decision?.projection || 0) / 12,
    confidence:
      Number(decision?.confidence || 0) / 100,
    pressure:
      Number(
        decision?.pressure_hits ??
        decision?.extra?.pressure_hits ??
        game?.real?.pressureHits ??
        game?.pressureHits ??
        0
      ) / 5,
    recent:
      Number(
        game?.real?.recentCombinedAvg ??
        game?.recentCombinedAvg ??
        0
      ) / 12,
    team_creation:
      (
        Number(homeProfile?.cornersForAvg || 0) +
        Number(awayProfile?.cornersForAvg || 0)
      ) / 12,
    opponent_concede:
      (
        Number(homeProfile?.cornersAgainstAvg || 0) +
        Number(awayProfile?.cornersAgainstAvg || 0)
      ) / 12,
    sample:
      Math.min(
        1,
        Number(
          decision?.sample_games ??
          decision?.extra?.sample_games ??
          0
        ) / 6
      )
  };
}


function cornerLearningNormalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cornerLearningMemoryEntry(memory, key) {
  if (!key) return null;
  const entry = memory?.[key];
  if (!entry || typeof entry !== "object") return null;
  return entry;
}

function cornerLearningMemoryRate(entry) {
  const samples = Number(entry?.samples || 0);
  const greens = Number(entry?.greens || 0);

  if (samples <= 0) return 0.5;

  // Suavização tradicional para não exagerar com amostra pequena.
  return (greens + 2) / (samples + 4);
}

function cornerLearningMemoryImpact(entry, maxImpact = 5) {
  if (!entry) return 0;

  const samples = Number(entry.samples || 0);
  if (samples < 3) return 0;

  const rate = cornerLearningMemoryRate(entry);
  const reliability = Math.min(1, samples / 25);

  return cornerLearningClamp(
    (rate - 0.5) * 2 * maxImpact * reliability,
    -maxImpact,
    maxImpact
  );
}

function cornerLearningContextKeys(game, decision) {
  const league = cornerLearningNormalizeKey(
    game?.liga ??
    game?.league_name ??
    game?.event_raw?.league_name ??
    ""
  );

  const home = cornerLearningNormalizeKey(
    game?.casa ??
    game?.home ??
    game?.event_home_team ??
    ""
  );

  const away = cornerLearningNormalizeKey(
    game?.fora ??
    game?.away ??
    game?.event_away_team ??
    ""
  );

  const line = String(decision?.line || "").toUpperCase();

  return { league, home, away, line };
}

function cornerLearningContextAdjustment(game, decision) {
  const model = loadCornerLearningModel();
  const keys = cornerLearningContextKeys(game, decision);

  const leagueEntry = cornerLearningMemoryEntry(
    model.league_memory,
    keys.league
  );

  const homeEntry = cornerLearningMemoryEntry(
    model.team_memory,
    keys.home
  );

  const awayEntry = cornerLearningMemoryEntry(
    model.team_memory,
    keys.away
  );

  const lineEntry = cornerLearningMemoryEntry(
    model.line_memory,
    keys.line
  );

  const leagueImpact =
    cornerLearningMemoryImpact(leagueEntry, 4.5);

  const homeImpact =
    cornerLearningMemoryImpact(homeEntry, 3.5);

  const awayImpact =
    cornerLearningMemoryImpact(awayEntry, 3.5);

  const lineImpact =
    cornerLearningMemoryImpact(lineEntry, 4.0);

  return {
    confidence:
      leagueImpact +
      homeImpact * 0.65 +
      awayImpact * 0.65 +
      lineImpact,
    elite:
      leagueImpact * 1.8 +
      homeImpact * 1.2 +
      awayImpact * 1.2 +
      lineImpact * 1.5,
    details: {
      league: leagueImpact,
      home: homeImpact,
      away: awayImpact,
      line: lineImpact
    }
  };
}

function cornerLearningUpdateMemory(memory, key, result, totalCorners) {
  if (!key) return;

  const current = memory[key] || {
    samples: 0,
    greens: 0,
    reds: 0,
    total_corners_sum: 0,
    average_corners: 0,
    updated_at: null
  };

  current.samples += 1;

  if (result > 0) current.greens += 1;
  else if (result < 0) current.reds += 1;

  current.total_corners_sum += Number(totalCorners || 0);
  current.average_corners =
    current.samples > 0
      ? Number(
          (
            current.total_corners_sum /
            current.samples
          ).toFixed(2)
        )
      : 0;

  current.hit_rate =
    current.samples > 0
      ? Number(
          (
            current.greens /
            current.samples *
            100
          ).toFixed(1)
        )
      : 0;

  current.updated_at = new Date().toISOString();
  memory[key] = current;
}

function cornerLearningAdjustment(game, decision) {
  const model = loadCornerLearningModel();
  const features = cornerLearningFeatures(game, decision);
  const context = cornerLearningContextAdjustment(
    game,
    decision
  );

  let weighted = 0;

  for (const [feature, value] of Object.entries(features)) {
    weighted +=
      Number(value || 0) *
      (
        Number(model.feature_weights?.[feature] || 1) -
        1
      );
  }

  const line = String(decision?.line || "").toUpperCase();
  const lineBias = Number(model.line_bias?.[line] || 0);

  return {
    projection:
      Number(model.projection_bias || 0) +
      weighted * 0.9,
    confidence:
      Number(model.confidence_bias || 0) +
      weighted * 5 +
      lineBias +
      Number(context.confidence || 0),
    elite:
      Number(model.elite_bias || 0) +
      weighted * 10 +
      lineBias * 1.5 +
      Number(context.elite || 0),
    context_details: context.details,
    samples: Number(model.samples || 0),
    status: cornerLearningStatusText(),
    version: model.version
  };
}

function cornerLearningApply(game, decision) {
  if (!decision || decision.skip) return decision;

  const adjustment = cornerLearningAdjustment(game, decision);

  const projection = cornerLearningClamp(
    Number(decision.projection || 0) +
      adjustment.projection,
    6.5,
    16.5
  );

  const confidence = cornerLearningClamp(
    Number(decision.confidence || 0) +
      adjustment.confidence,
    55,
    88
  );

  return {
    ...decision,
    projection: Number(projection.toFixed(2)),
    confidence: Math.round(confidence),
    learning_adjustment: {
      projection:
        Number(adjustment.projection.toFixed(3)),
      confidence:
        Number(adjustment.confidence.toFixed(2)),
      elite:
        Number(adjustment.elite.toFixed(2)),
      context: adjustment.context_details || {}
    },
    learning_samples: adjustment.samples,
    learning_status: adjustment.status,
    learning_version: adjustment.version
  };
}

function cornerLearningPredictionKey(game) {
  return String(
    game?.match_id ??
    game?.event_key ??
    game?.event_raw?.match_id ??
    `${game?.casa || ""}|${game?.fora || ""}|${game?.horario || ""}`
  );
}

function cornerLearningGameStatus(game) {
  return String(
    game?.match_status ??
    game?.status ??
    game?.event_raw?.match_status ??
    ""
  ).toLowerCase();
}

function cornerLearningIsFinished(game) {
  const status = cornerLearningGameStatus(game);

  return /finished|finish|ended|encerrado|full.?time|\bft\b|after/.test(
    status
  );
}

function cornerLearningIsLive(game) {
  const status = cornerLearningGameStatus(game);

  return /live|ao vivo|halftime|intervalo|[1-9]\d?['’]/.test(
    status
  );
}

function cornerLearningRememberPrediction(game, decision, date) {
  if (
    !decision ||
    decision.skip ||
    cornerLearningIsFinished(game) ||
    cornerLearningIsLive(game)
  ) {
    return;
  }

  const model = loadCornerLearningModel();
  const key = cornerLearningPredictionKey(game);

  if (model.predictions[key]?.settled) return;

  model.predictions[key] = {
    match_id:
      game?.match_id ??
      game?.event_key ??
      game?.event_raw?.match_id ??
      null,
    date,
    league:
      game?.liga ??
      game?.league_name ??
      game?.event_raw?.league_name ??
      "",
    home: game?.casa || "",
    away: game?.fora || "",
    line: decision.line,
    projection: Number(decision.projection || 0),
    confidence: Number(decision.confidence || 0),
    features: cornerLearningFeatures(game, decision),
    created_at:
      model.predictions[key]?.created_at ||
      new Date().toISOString(),
    settled: false
  };

  const keys = Object.keys(model.predictions);

  if (keys.length > CORNER_MAX_PREDICTION_MEMORY) {
    keys
      .sort((a, b) =>
        String(
          model.predictions[a]?.created_at || ""
        ).localeCompare(
          String(model.predictions[b]?.created_at || "")
        )
      )
      .slice(
        0,
        keys.length - CORNER_MAX_PREDICTION_MEMORY
      )
      .forEach(oldKey => {
        delete model.predictions[oldKey];
      });
  }

  scheduleCornerLearningSave();
}

function cornerLearningEvaluateLine(line, totalCorners) {
  const normalized = String(line || "").toUpperCase();
  const number = cornerLearningLineNumber(normalized);

  if (!Number.isFinite(number)) return null;

  if (normalized.startsWith("OVER")) {
    return totalCorners > number ? 1 : -1;
  }

  if (normalized.startsWith("UNDER")) {
    return totalCorners < number ? 1 : -1;
  }

  return null;
}

function cornerLearningTrain(prediction, totalCorners) {
  const result = cornerLearningEvaluateLine(
    prediction.line,
    totalCorners
  );

  if (result === null) return;

  const model = loadCornerLearningModel();
  const error =
    totalCorners -
    Number(prediction.projection || 0);

  model.samples += 1;

  if (result > 0) model.greens += 1;
  else if (result < 0) model.reds += 1;
  else model.pushes += 1;

  model.projection_bias = cornerLearningClamp(
    Number(model.projection_bias || 0) +
      CORNER_LEARNING_RATE *
      cornerLearningClamp(error, -4, 4),
    -1.5,
    1.5
  );

  model.confidence_bias = cornerLearningClamp(
    Number(model.confidence_bias || 0) +
      CORNER_LEARNING_RATE *
      (
        result > 0
          ? 0.65
          : -0.9
      ),
    -8,
    8
  );

  model.elite_bias = cornerLearningClamp(
    Number(model.elite_bias || 0) +
      CORNER_LEARNING_RATE *
      (
        result > 0
          ? 0.9
          : -1.1
      ),
    -12,
    12
  );

  const features = prediction.features || {};

  for (const feature of Object.keys(model.feature_weights)) {
    const featureValue = Number(features?.[feature] || 0);

    model.feature_weights[feature] = cornerLearningClamp(
      Number(model.feature_weights[feature] || 1) +
        CORNER_LEARNING_RATE *
        result *
        featureValue *
        0.08,
      0.72,
      1.28
    );
  }

  const line = String(prediction.line || "").toUpperCase();

  if (Object.prototype.hasOwnProperty.call(model.line_bias, line)) {
    model.line_bias[line] = cornerLearningClamp(
      Number(model.line_bias[line] || 0) +
        CORNER_LEARNING_RATE *
        (
          result > 0
            ? 1.2
            : -1.5
        ),
      -10,
      10
    );
  }

  const leagueKey = cornerLearningNormalizeKey(
    prediction.league
  );
  const homeKey = cornerLearningNormalizeKey(
    prediction.home
  );
  const awayKey = cornerLearningNormalizeKey(
    prediction.away
  );

  cornerLearningUpdateMemory(
    model.league_memory,
    leagueKey,
    result,
    totalCorners
  );

  cornerLearningUpdateMemory(
    model.team_memory,
    homeKey,
    result,
    totalCorners
  );

  cornerLearningUpdateMemory(
    model.team_memory,
    awayKey,
    result,
    totalCorners
  );

  cornerLearningUpdateMemory(
    model.line_memory,
    line,
    result,
    totalCorners
  );

  scheduleCornerLearningSave();
}

async function cornerLearningFinalCorners(game) {
  const matchId =
    game?.match_id ??
    game?.event_key ??
    game?.event_raw?.match_id ??
    null;

  if (!matchId) return null;

  try {
    const statsMap = await getStats(matchId);
    const metrics = extractMatchMetrics(statsMap);

    if (
      Number.isFinite(metrics?.cornersHome) &&
      Number.isFinite(metrics?.cornersAway)
    ) {
      return (
        Number(metrics.cornersHome) +
        Number(metrics.cornersAway)
      );
    }
  } catch {
    return null;
  }

  return null;
}

async function cornerLearningSettleFinishedGames(games) {
  const model = loadCornerLearningModel();

  const finished = (Array.isArray(games) ? games : [])
    .filter(cornerLearningIsFinished)
    .filter(game => {
      const key = cornerLearningPredictionKey(game);
      const prediction = model.predictions[key];
      return prediction && !prediction.settled;
    })
    .slice(0, 8);

  await mapLimit(
    finished,
    Math.min(CONCURRENCY, 2),
    async game => {
      const key = cornerLearningPredictionKey(game);
      const prediction = model.predictions[key];

      if (!prediction || prediction.settled) return;

      const totalCorners =
        await cornerLearningFinalCorners(game);

      if (!Number.isFinite(totalCorners)) return;

      cornerLearningTrain(prediction, totalCorners);

      prediction.settled = true;
      prediction.total_corners = totalCorners;
      prediction.result =
        cornerLearningEvaluateLine(
          prediction.line,
          totalCorners
        );
      prediction.settled_at =
        new Date().toISOString();
    }
  );

  scheduleCornerLearningSave();
}

function cornerEliteScore(game) {
  const decision = game?.corners_ai || {};
  const learning = cornerLearningAdjustment(
    game,
    decision
  );

  if (
    decision?.skip ||
    String(decision?.line || "").toUpperCase() === "SEM APOSTA" ||
    String(decision?.line || "").toUpperCase() === "DADOS EM ATUALIZAÇÃO"
  ) {
    return -999;
  }

  const projection = Number(
    decision?.projection ??
    game?.proj_cantos ??
    game?.projected_corners ??
    game?.projection ??
    0
  );

  const confidence = Number(
    decision?.confidence ??
    game?.confidence ??
    game?.over95_prob_adj ??
    game?.over95_prob ??
    0
  );

  const engineScore = Number(
    decision?.score ??
    game?.ai_score ??
    game?.score_adj ??
    game?.score ??
    0
  );

  const pressure = Number(
    decision?.pressure_hits ??
    decision?.extra?.pressure_hits ??
    game?.real?.pressureHits ??
    game?.pressureHits ??
    0
  );

  const recentCombined = Number(
    game?.real?.recentCombinedAvg ??
    game?.recentCombinedAvg ??
    0
  );

  const sampleGames = Number(
    decision?.sample_games ??
    decision?.extra?.sample_games ??
    0
  );

  const homeProfile = game?.engine_profiles?.home || {};
  const awayProfile = game?.engine_profiles?.away || {};

  const homeFor = Number(homeProfile?.cornersForAvg ?? 0);
  const awayFor = Number(awayProfile?.cornersForAvg ?? 0);
  const homeAgainst = Number(homeProfile?.cornersAgainstAvg ?? 0);
  const awayAgainst = Number(awayProfile?.cornersAgainstAvg ?? 0);

  const teamsCreation =
    (Number.isFinite(homeFor) ? homeFor : 0) +
    (Number.isFinite(awayFor) ? awayFor : 0);

  const opponentsConcede =
    (Number.isFinite(homeAgainst) ? homeAgainst : 0) +
    (Number.isFinite(awayAgainst) ? awayAgainst : 0);

  const line = String(decision?.line || "").toUpperCase();

  let lineBonus = 0;
  if (line === "OVER 11.5") lineBonus = 22;
  else if (line === "OVER 10.5") lineBonus = 17;
  else if (line === "OVER 9.5") lineBonus = 11;
  else if (line === "OVER 8.5") lineBonus = 3;
  else if (line.startsWith("UNDER")) lineBonus = -14;

  const source =
    decision?.calculation_source ??
    decision?.extra?.calculation_source ??
    "";

  const sourceBonus =
    source === "recent_form"
      ? 9
      : source === "fallback"
        ? 1
        : 4;

  const status = String(
    game?.match_status ??
    game?.status ??
    game?.event_raw?.match_status ??
    ""
  ).toLowerCase();

  // O card principal é pré-jogo. Jogos já encerrados ou ao vivo
  // não devem tomar o lugar da melhor oportunidade futura.
  const statusPenalty =
    /finish|ended|encerrado|ft|after/.test(status)
      ? 80
      : /live|ao vivo|[1-9]\d?'/.test(status)
        ? 35
        : 0;

  // Não existe qualquer bônus ou penalização por posição na tabela.
  const score =
    projection * 6.5 +
    confidence * 0.82 +
    engineScore * 0.18 +
    pressure * 3.8 +
    recentCombined * 1.6 +
    teamsCreation * 2.6 +
    opponentsConcede * 1.4 +
    Math.min(sampleGames, 6) * 2.2 +
    lineBonus +
    sourceBonus +
    Number(learning.elite || 0) -
    statusPenalty;

  return Number.isFinite(score) ? score : -999;
}

function rankGamesByCornerStrength(list) {
  return (Array.isArray(list) ? list.slice() : [])
    .map(game => ({
      ...game,
      corner_elite_score: Number(cornerEliteScore(game).toFixed(2))
    }))
    .sort((a, b) => {
      const eliteDiff =
        Number(b?.corner_elite_score ?? -999) -
        Number(a?.corner_elite_score ?? -999);

      if (eliteDiff !== 0) return eliteDiff;

      return cornerStrengthForClient(b) - cornerStrengthForClient(a);
    })
    .map((game, index) => ({
      ...game,
      corner_strength: Number(cornerStrengthForClient(game).toFixed(2)),
      corner_rank: index + 1,
      corner_elite_rank: index + 1
    }));
}

// ---------------- Mercado amplo (gols e cartões) ----------------
// Diferente de /quentes, esta rota NÃO aplica o funil de Top 5 de escanteios.
// Assim gols e cartões podem usar equipes de qualquer posição da tabela.
function marketGameFromEvent(e, league, posHome = null, posAway = null) {
  const casa = teamFromEvent(e, "home");
  const fora = teamFromEvent(e, "away");
  if (!casa || !fora) return null;

  const hora = cleanText(e?.match_time ?? e?.time ?? e?.event_time ?? "—") || "—";
  const homeGoals = Number(e?.match_hometeam_score ?? e?.home_score ?? NaN);
  const awayGoals = Number(e?.match_awayteam_score ?? e?.away_score ?? NaN);

  return {
    mode: "market",
    match_id: e?.match_id ?? e?.event_key ?? null,
    casa,
    fora,
    liga: league?.name || cleanText(e?.league_name) || `Liga ${league?.id ?? ""}`,
    league_id: Number(league?.id ?? e?.league_id ?? 0) || null,
    hora,
    match_status: cleanText(e?.match_status ?? e?.status ?? ""),
    pos_home: Number.isFinite(posHome) ? posHome : null,
    pos_away: Number.isFinite(posAway) ? posAway : null,
    posicao: Number.isFinite(posHome) && Number.isFinite(posAway) ? `${posHome}º x ${posAway}º` : "—",
    score_home: Number.isFinite(homeGoals) ? homeGoals : null,
    score_away: Number.isFinite(awayGoals) ? awayGoals : null,
    // Campos crus são preservados para o frontend aproveitar estatísticas
    // que algumas ligas já devolvem diretamente em get_events.
    home_team_id:
      e?.match_hometeam_id ??
      e?.home_team_key ??
      e?.home_team_id ??
      e?.teams?.home?.id ??
      null,

    away_team_id:
      e?.match_awayteam_id ??
      e?.away_team_key ??
      e?.away_team_id ??
      e?.teams?.away?.id ??
      null,

    event_raw: e,
    markets_scope: "full_table"
  };
}

async function buildMarketGamesList({ date }) {
  if (!APIKEY) throw new Error("Falta APIFOOTBALL_KEY no .env");
  const leagues = await getLeaguesForDate(date);

  const packs = await mapLimit(leagues, CONCURRENCY, async (league) => {
    let events = [];
    let standings = null;
    try { events = await getEventsByLeagueDate(league.id, date); } catch { events = []; }
    try { standings = await getStandings(league.id); } catch { standings = null; }
    return { league, events, standings };
  });

  const out = [];
  const seen = new Set();
  for (const { league, events, standings } of packs) {
    for (const e of events || []) {
      const casa = teamFromEvent(e, "home");
      const fora = teamFromEvent(e, "away");
      const posHome = findTeamPos(standings, casa);
      const posAway = findTeamPos(standings, fora);
      const game = marketGameFromEvent(e, league, posHome, posAway);
      if (!game) continue;
      const key = String(game.match_id || `${game.league_id}|${game.casa}|${game.fora}`);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(game);
    }
  }

  return out.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
}


/* =========================================================
   HANDICAP ASIÁTICO — MOTOR PRÓPRIO, CONSERVADOR E PRÉ-JOGO
   ========================================================= */

const HANDICAP_ENGINE = {
  MAX_GAMES: Number(process.env.HANDICAP_MAX_GAMES || 30),
  RECENT_N: Number(process.env.HANDICAP_RECENT_N || 5),
  MIN_DATA_QUALITY: 5,
  MIN_EDGE: 7.5,
  MAX_CONFIDENCE: 84,
  HOME_ADVANTAGE: 2.4
};

function handicapSafeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace("%", "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function handicapScoreFromMatch(match) {
  const home = handicapSafeNumber(
    match?.match_hometeam_score ??
    match?.home_score ??
    match?.score_home ??
    match?.goals?.home
  );

  const away = handicapSafeNumber(
    match?.match_awayteam_score ??
    match?.away_score ??
    match?.score_away ??
    match?.goals?.away
  );

  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function handicapRecentProfile(teamName, matches, limit = HANDICAP_ENGINE.RECENT_N) {
  const teamKey = normTeamKey(teamName);
  const list = Array.isArray(matches) ? matches.slice(0, limit) : [];

  let games = 0;
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let awayGames = 0;
  let homeGames = 0;

  for (const match of list) {
    const score = handicapScoreFromMatch(match);
    if (!score) continue;

    const homeName = teamFromEvent(match, "home");
    const awayName = teamFromEvent(match, "away");
    const isHome = normTeamKey(homeName) === teamKey;
    const isAway = normTeamKey(awayName) === teamKey;

    if (!isHome && !isAway) continue;

    const scored = isHome ? score.home : score.away;
    const conceded = isHome ? score.away : score.home;

    games++;
    goalsFor += scored;
    goalsAgainst += conceded;

    if (isHome) homeGames++;
    if (isAway) awayGames++;

    if (scored > conceded) {
      wins++;
      points += 3;
    } else if (scored === conceded) {
      draws++;
      points += 1;
    } else {
      losses++;
    }
  }

  if (!games) return null;

  return {
    games,
    pointsPerGame: points / games,
    goalsForAvg: goalsFor / games,
    goalsAgainstAvg: goalsAgainst / games,
    goalDiffAvg: (goalsFor - goalsAgainst) / games,
    winRate: wins / games,
    drawRate: draws / games,
    lossRate: losses / games,
    homeGames,
    awayGames
  };
}

function handicapOddsProfile(oddsInfo) {
  const homeOdd = handicapSafeNumber(oddsInfo?.odd1);
  const drawOdd = handicapSafeNumber(oddsInfo?.oddX);
  const awayOdd = handicapSafeNumber(oddsInfo?.odd2);

  if (!Number.isFinite(homeOdd) || !Number.isFinite(awayOdd)) {
    return null;
  }

  const homeRaw = 1 / Math.max(1.01, homeOdd);
  const drawRaw = Number.isFinite(drawOdd) ? 1 / Math.max(1.01, drawOdd) : 0;
  const awayRaw = 1 / Math.max(1.01, awayOdd);
  const total = homeRaw + drawRaw + awayRaw;

  if (!(total > 0)) return null;

  return {
    homeOdd,
    drawOdd,
    awayOdd,
    homeProb: homeRaw / total,
    drawProb: drawRaw / total,
    awayProb: awayRaw / total,
    favorite: homeRaw >= awayRaw ? "HOME" : "AWAY"
  };
}


function handicapOddsFromGame(game) {
  const raw = game?.event_raw || game || {};

  const homeOdd = handicapSafeNumber(
    game?.odds?.odd1 ??
    game?.odd1 ??
    game?.home_od ??
    game?.home_odd ??
    raw?.odd1 ??
    raw?.home_od ??
    raw?.home_odd ??
    raw?.match_hometeam_odd
  );

  const drawOdd = handicapSafeNumber(
    game?.odds?.oddX ??
    game?.oddX ??
    game?.draw_od ??
    game?.draw_odd ??
    raw?.oddX ??
    raw?.draw_od ??
    raw?.draw_odd ??
    raw?.match_draw_odd
  );

  const awayOdd = handicapSafeNumber(
    game?.odds?.odd2 ??
    game?.odd2 ??
    game?.away_od ??
    game?.away_odd ??
    raw?.odd2 ??
    raw?.away_od ??
    raw?.away_odd ??
    raw?.match_awayteam_odd
  );

  if (!Number.isFinite(homeOdd) || !Number.isFinite(awayOdd)) {
    return null;
  }

  return handicapOddsProfile({
    odd1: homeOdd,
    oddX: drawOdd,
    odd2: awayOdd
  });
}

function handicapTableFallback({ game, posHome, posAway }) {
  if (!Number.isFinite(posHome) || !Number.isFinite(posAway)) {
    return null;
  }

  const gap = Math.abs(posAway - posHome);
  if (gap < 4) return null;

  const side = posHome < posAway ? "HOME" : "AWAY";
  const team = side === "HOME" ? game.casa : game.fora;

  let line = "+0.25";
  let confidence = 61;

  if (gap >= 11) {
    line = "-0.5";
    confidence = 68;
  } else if (gap >= 7) {
    line = "-0.25";
    confidence = 65;
  }

  return {
    skip: false,
    market: "HANDICAP ASIÁTICO",
    line,
    side,
    side_key: side === "HOME" ? "home" : "away",
    team,
    confidence,
    score: Number((gap * 2.2).toFixed(2)),
    reason:
      `${side === "HOME" ? "Casa" : "Fora"} ${line}: ` +
      `leitura conservadora pela diferença de ${gap} posições na tabela.`,
    data_quality: 2,
    calculation_source: "table_fallback",
    factors: {
      odds: false,
      table: true,
      home_form: false,
      away_form: false
    }
  };
}

function handicapLineFromEdge({ side, edge, favoriteProb, drawProb, dataQuality }) {
  // Linhas agressivas exigem vantagem clara, odds e forma.
  if (edge >= 30 && favoriteProb >= 0.66 && dataQuality >= 8) return "-1.0";
  if (edge >= 24 && favoriteProb >= 0.61 && dataQuality >= 7) return "-0.75";
  if (edge >= 17 && favoriteProb >= 0.55 && dataQuality >= 6) return "-0.5";
  if (edge >= 11 && favoriteProb >= 0.49) return "-0.25";

  // Em jogos mais equilibrados, protege o lado com melhor sustentação.
  if (edge >= HANDICAP_ENGINE.MIN_EDGE) {
    return drawProb >= 0.29 ? "+0.25" : "-0.25";
  }

  return "SEM APOSTA";
}

function handicapDecision({
  game,
  oddsInfo,
  h2hBlock,
  posHome,
  posAway
}) {
  const homeRecent = handicapRecentProfile(
    game.casa,
    h2hBlock?.firstTeam_lastResults
  );

  const awayRecent = handicapRecentProfile(
    game.fora,
    h2hBlock?.secondTeam_lastResults
  );

  const odds =
    handicapOddsProfile(oddsInfo) ||
    handicapOddsFromGame(game);

  const hasTable =
    Number.isFinite(posHome) &&
    Number.isFinite(posAway);

  const hasBothForm = Boolean(homeRecent && awayRecent);

  let dataQuality = 0;
  if (odds) dataQuality += 4;
  if (hasTable) dataQuality += 2;
  if (homeRecent) dataQuality += 2;
  if (awayRecent) dataQuality += 2;

  // Quando só existe tabela, ainda permite uma leitura muito conservadora.
  if (!odds && !homeRecent && !awayRecent && hasTable) {
    const fallback = handicapTableFallback({
      game,
      posHome,
      posAway
    });

    if (fallback) return fallback;
  }

  // Odds reais sozinhas já são suficientes para uma linha cautelosa.
  if (odds && dataQuality === 4) {
    const side =
      odds.homeProb >= odds.awayProb
        ? "HOME"
        : "AWAY";

    const favoriteProb =
      side === "HOME"
        ? odds.homeProb
        : odds.awayProb;

    const probabilityGap =
      Math.abs(odds.homeProb - odds.awayProb);

    let line = "SEM APOSTA";
    let confidence = 0;

    if (favoriteProb >= 0.62 && probabilityGap >= 0.22) {
      line = "-0.5";
      confidence = 69;
    } else if (favoriteProb >= 0.55 && probabilityGap >= 0.14) {
      line = "-0.25";
      confidence = 66;
    } else if (favoriteProb >= 0.48 && probabilityGap >= 0.08) {
      line = "+0.25";
      confidence = 63;
    }

    if (line !== "SEM APOSTA") {
      return {
        skip: false,
        market: "HANDICAP ASIÁTICO",
        line,
        side,
        side_key: side === "HOME" ? "home" : "away",
        team: side === "HOME" ? game.casa : game.fora,
        confidence,
        score: Number((probabilityGap * 100).toFixed(2)),
        reason:
          `${side === "HOME" ? "Casa" : "Fora"} ${line}: ` +
          `linha conservadora baseada nas probabilidades reais das odds.`,
        data_quality: dataQuality,
        calculation_source: "odds_fallback",
        odds: {
          home: odds.homeOdd,
          draw: odds.drawOdd,
          away: odds.awayOdd,
          home_prob: Number((odds.homeProb * 100).toFixed(1)),
          draw_prob: Number((odds.drawProb * 100).toFixed(1)),
          away_prob: Number((odds.awayProb * 100).toFixed(1))
        },
        factors: {
          odds: true,
          table: false,
          home_form: false,
          away_form: false
        }
      };
    }
  }

  // V77: jogos futuros podem ser analisados pelo histórico disponível.
  // Não inventa linha: exige ao menos 4 pontos reais de qualidade.
  // Forma recente e tabela continuam valendo mesmo sem odds/H2H completos.
  if (dataQuality < 4) {
    return {
      skip: true,
      market: "HANDICAP ASIÁTICO",
      line: "SEM APOSTA",
      side: null,
      team: null,
      confidence: 0,
      score: 0,
      reason: "Dados insuficientes para uma recomendação confiável.",
      factors: {
        odds: Boolean(odds),
        table: hasTable,
        home_form: Boolean(homeRecent),
        away_form: Boolean(awayRecent)
      }
    };
  }

  let homeScore = HANDICAP_ENGINE.HOME_ADVANTAGE;
  let awayScore = 0;
  const reasons = [];

  if (odds) {
    const oddsEdge =
      (odds.homeProb - odds.awayProb) * 100;

    homeScore += oddsEdge * 1.05;
    awayScore -= oddsEdge * 1.05;
    reasons.push("probabilidade das odds");
  }

  if (hasTable) {
    const positionEdge = clamp(
      (posAway - posHome) * 1.35,
      -20,
      20
    );

    homeScore += positionEdge;
    awayScore -= positionEdge;
    reasons.push("posição na tabela");
  }

  if (hasBothForm) {
    const ppgEdge =
      (homeRecent.pointsPerGame -
        awayRecent.pointsPerGame) * 10;

    const goalEdge =
      (homeRecent.goalDiffAvg -
        awayRecent.goalDiffAvg) * 12;

    const attackEdge =
      (homeRecent.goalsForAvg -
        awayRecent.goalsForAvg) * 5;

    const defenseEdge =
      (awayRecent.goalsAgainstAvg -
        homeRecent.goalsAgainstAvg) * 5;

    const formEdge =
      ppgEdge +
      goalEdge +
      attackEdge +
      defenseEdge;

    homeScore += formEdge;
    awayScore -= formEdge;
    reasons.push("forma recente e saldo de gols");
  } else if (homeRecent || awayRecent) {
    const profile = homeRecent || awayRecent;
    const sign = homeRecent ? 1 : -1;

    const partial =
      (profile.pointsPerGame - 1.35) * 7 +
      profile.goalDiffAvg * 8;

    homeScore += partial * sign;
    awayScore -= partial * sign;
    reasons.push("forma recente parcial");
  }

  const side =
    homeScore >= awayScore
      ? "HOME"
      : "AWAY";

  const edge = Math.abs(homeScore - awayScore);

  const favoriteProb = odds
    ? side === "HOME"
      ? odds.homeProb
      : odds.awayProb
    : 0.50;

  const drawProb = odds?.drawProb ?? 0.28;

  const line = handicapLineFromEdge({
    side,
    edge,
    favoriteProb,
    drawProb,
    dataQuality
  });

  if (line === "SEM APOSTA") {
    return {
      skip: true,
      market: "HANDICAP ASIÁTICO",
      line,
      side,
      team: side === "HOME" ? game.casa : game.fora,
      confidence: 0,
      score: Number(edge.toFixed(2)),
      reason: "Confronto sem vantagem estatística suficiente para entrada.",
      factors: {
        odds: Boolean(odds),
        table: hasTable,
        home_form: Boolean(homeRecent),
        away_form: Boolean(awayRecent)
      }
    };
  }

  let confidence =
    57 +
    Math.min(18, edge * 0.55) +
    Math.min(6, dataQuality * 0.65);

  if (line === "-1.0") confidence -= 5;
  else if (line === "-0.75") confidence -= 3;
  else if (line === "+0.25") confidence -= 1;

  confidence = clamp(
    Math.round(confidence),
    61,
    HANDICAP_ENGINE.MAX_CONFIDENCE
  );

  if (confidence < 63) {
    return {
      skip: true,
      market: "HANDICAP ASIÁTICO",
      line: "SEM APOSTA",
      side,
      team: side === "HOME" ? game.casa : game.fora,
      confidence,
      score: Number(edge.toFixed(2)),
      reason: "A confiança ficou abaixo do limite mínimo de segurança.",
      factors: {
        odds: Boolean(odds),
        table: hasTable,
        home_form: Boolean(homeRecent),
        away_form: Boolean(awayRecent)
      }
    };
  }

  return {
    skip: false,
    market: "HANDICAP ASIÁTICO",
    line,
    side,
    side_key: side === "HOME" ? "home" : "away",
    team: side === "HOME" ? game.casa : game.fora,
    confidence,
    score: Number((edge + dataQuality * 3).toFixed(2)),
    reason:
      `${side === "HOME" ? "Casa" : "Fora"} ${line}: ` +
      `vantagem baseada em ${reasons.join(", ")}.`,
    data_quality: dataQuality,
    calculation_source: "full_engine",
    odds: odds ? {
      home: odds.homeOdd,
      draw: odds.drawOdd,
      away: odds.awayOdd,
      home_prob: Number((odds.homeProb * 100).toFixed(1)),
      draw_prob: Number((odds.drawProb * 100).toFixed(1)),
      away_prob: Number((odds.awayProb * 100).toFixed(1))
    } : null,
    form: {
      home: homeRecent,
      away: awayRecent
    },
    factors: {
      odds: Boolean(odds),
      table: hasTable,
      home_form: Boolean(homeRecent),
      away_form: Boolean(awayRecent)
    }
  };
}

async function buildHandicapGamesList({ date }) {
  const baseGames = await buildMarketGamesList({ date });
  const candidates = baseGames.slice(0, HANDICAP_ENGINE.MAX_GAMES);

  const analyzed = await mapLimit(candidates, CONCURRENCY, async game => {
    let oddsInfo = null;
    let h2hBlock = null;

    try {
      if (game.match_id) oddsInfo = await getOdds1x2(game.match_id);
    } catch {}

    try {
      h2hBlock = await getH2H(game.casa, game.fora);
    } catch {}

    const handicap_ai = handicapDecision({
      game,
      oddsInfo,
      h2hBlock,
      posHome: game.pos_home,
      posAway: game.pos_away
    });

    return {
      ...game,
      handicap_ai,
      handicap_line: handicap_ai.line,
      handicap_side: handicap_ai.side_key || null,
      handicap_confidence: handicap_ai.confidence,
      handicap_skip: Boolean(handicap_ai.skip)
    };
  });

  return analyzed.sort((a, b) => {
    const aSkip = Boolean(a?.handicap_ai?.skip);
    const bSkip = Boolean(b?.handicap_ai?.skip);

    if (aSkip !== bSkip) return aSkip ? 1 : -1;

    return Number(b?.handicap_ai?.score || 0) -
      Number(a?.handicap_ai?.score || 0);
  });
}


/* =========================================================
   MOTORES INDEPENDENTES — GOLS, CANTOS, CARTÕES E BTTS
   ========================================================= */

const MULTI_MARKET_ENGINE = {
  MAX_GAMES: Number(process.env.MARKET_ENGINE_MAX_GAMES || 20),
  RECENT_N: Number(process.env.MARKET_ENGINE_RECENT_N || 4),
  MIN_CONFIDENCE: Number(process.env.MARKET_ENGINE_MIN_CONFIDENCE || 62),
  MAX_CONFIDENCE: Number(process.env.MARKET_ENGINE_MAX_CONFIDENCE || 86)
};

function engineClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function engineDecision({
  market,
  line = "SEM APOSTA",
  confidence = 0,
  score = 0,
  reason = "",
  projection = null,
  skip = false,
  extra = {}
}) {
  const finalSkip =
    Boolean(skip) ||
    !line ||
    line === "SEM APOSTA" ||
    confidence < MULTI_MARKET_ENGINE.MIN_CONFIDENCE;

  return {
    market,
    line: finalSkip ? "SEM APOSTA" : line,
    confidence: finalSkip ? 0 : Math.round(confidence),
    score: Number(Number(score || 0).toFixed(2)),
    projection:
      Number.isFinite(Number(projection))
        ? Number(Number(projection).toFixed(2))
        : null,
    skip: finalSkip,
    reason: finalSkip
      ? reason || "A IA não encontrou vantagem estatística suficiente."
      : reason,
    source: "server",
    ...extra
  };
}

function enginePairFromStats(statsMap, keys) {
  if (!statsMap || typeof statsMap.get !== "function") {
    return { home: null, away: null };
  }

  for (const key of keys) {
    const row = statsMap.get(key);
    if (!row) continue;

    const home = numFromStat(row.home);
    const away = numFromStat(row.away);

    if (home !== null || away !== null) {
      return { home, away };
    }
  }

  return { home: null, away: null };
}


const teamRecentEventsCache = new Map();

function engineDateShift(dateString, days) {
  const base = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateString;

  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

async function engineRecentEventsByTeam(teamId, date, limit = 8) {
  const numericId = Number(teamId);
  if (!Number.isFinite(numericId) || numericId <= 0) return [];

  const key = `${numericId}|${date}|${limit}`;
  const cached = teamRecentEventsCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const from = engineDateShift(date, -210);
  const to = engineDateShift(date, -1);

  let events = [];

  try {
    const data = await apiGetV3({
      action: "get_events",
      from,
      to,
      team_id: numericId,
      timezone: API_TIMEZONE
    });

    events = Array.isArray(data) ? data : [];
  } catch {
    try {
      const data = await apiGetAny({
        action: "get_events",
        from,
        to,
        team_id: numericId,
        timezone: API_TIMEZONE
      });

      events = Array.isArray(data) ? data : [];
    } catch {
      events = [];
    }
  }

  const finished = events
    .filter(event => {
      const status = String(
        event?.match_status ??
        event?.status ??
        ""
      ).toLowerCase();

      const home = handicapSafeNumber(
        event?.match_hometeam_score ??
        event?.home_score
      );

      const away = handicapSafeNumber(
        event?.match_awayteam_score ??
        event?.away_score
      );

      return (
        Number.isFinite(home) &&
        Number.isFinite(away) &&
        !/postpon|cancel|aband/.test(status)
      );
    })
    .sort((a, b) => {
      const dateA = String(a?.match_date ?? a?.date ?? "");
      const dateB = String(b?.match_date ?? b?.date ?? "");
      const timeA = String(a?.match_time ?? a?.time ?? "");
      const timeB = String(b?.match_time ?? b?.time ?? "");
      return `${dateB} ${timeB}`.localeCompare(`${dateA} ${timeA}`);
    })
    .slice(0, limit);

  teamRecentEventsCache.set(key, {
    value: finished,
    expires: Date.now() + 12 * 60 * 1000
  });

  return finished;
}

async function engineRecentProfile(teamName, matches, limit = MULTI_MARKET_ENGINE.RECENT_N) {
  const teamKey = normTeamKey(teamName);
  const list = Array.isArray(matches) ? matches.slice(0, limit) : [];

  let games = 0;
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cornersFor = 0;
  let cornersAgainst = 0;
  let cardsFor = 0;
  let cardsAgainst = 0;

  let goalGames = 0;
  let cornerGames = 0;
  let cardGames = 0;
  let bttsCount = 0;
  let cleanSheetCount = 0;

  for (const match of list) {
    const homeName = teamFromEvent(match, "home");
    const awayName = teamFromEvent(match, "away");
    const isHome = normTeamKey(homeName) === teamKey;
    const isAway = normTeamKey(awayName) === teamKey;

    if (!isHome && !isAway) continue;

    games++;

    const score = handicapScoreFromMatch(match);

    if (score) {
      const scored = isHome ? score.home : score.away;
      const conceded = isHome ? score.away : score.home;

      goalsFor += scored;
      goalsAgainst += conceded;
      goalGames++;

      if (scored > conceded) points += 3;
      else if (scored === conceded) points += 1;

      if (score.home > 0 && score.away > 0) bttsCount++;
      if (conceded === 0) cleanSheetCount++;
    }

    const matchId = match?.match_id ?? match?.event_key ?? null;
    if (!matchId) continue;

    let statsMap = null;
    try {
      statsMap = await getStats(matchId);
    } catch {
      statsMap = null;
    }

    if (!statsMap) continue;

    const metrics = extractMatchMetrics(statsMap);

    if (
      metrics &&
      metrics.cornersHome !== null &&
      metrics.cornersAway !== null
    ) {
      cornersFor += isHome
        ? metrics.cornersHome
        : metrics.cornersAway;

      cornersAgainst += isHome
        ? metrics.cornersAway
        : metrics.cornersHome;

      cornerGames++;
    }

    const yellow = enginePairFromStats(statsMap, [
      "yellow cards",
      "yellow card",
      "yellowcards",
      "bookings"
    ]);

    const red = enginePairFromStats(statsMap, [
      "red cards",
      "red card",
      "redcards",
      "sendings off"
    ]);

    if (
      yellow.home !== null ||
      yellow.away !== null ||
      red.home !== null ||
      red.away !== null
    ) {
      const homeCards =
        (yellow.home ?? 0) +
        (red.home ?? 0) * 2;

      const awayCards =
        (yellow.away ?? 0) +
        (red.away ?? 0) * 2;

      cardsFor += isHome ? homeCards : awayCards;
      cardsAgainst += isHome ? awayCards : homeCards;
      cardGames++;
    }
  }

  if (!games) return null;

  return {
    games,
    pointsPerGame: points / games,

    goalGames,
    goalsForAvg: goalGames ? goalsFor / goalGames : null,
    goalsAgainstAvg: goalGames ? goalsAgainst / goalGames : null,
    goalDiffAvg: goalGames
      ? (goalsFor - goalsAgainst) / goalGames
      : null,
    bttsRate: goalGames ? bttsCount / goalGames : null,
    cleanSheetRate: goalGames
      ? cleanSheetCount / goalGames
      : null,

    cornerGames,
    cornersForAvg: cornerGames
      ? cornersFor / cornerGames
      : null,
    cornersAgainstAvg: cornerGames
      ? cornersAgainst / cornerGames
      : null,

    cardGames,
    cardsForAvg: cardGames
      ? cardsFor / cardGames
      : null,
    cardsAgainstAvg: cardGames
      ? cardsAgainst / cardGames
      : null
  };
}

function engineDataQuality(home, away, fields, oddsInfo = null) {
  let quality = 0;

  if (oddsInfo) quality += 2;

  for (const field of fields) {
    if (Number.isFinite(home?.[field])) quality++;
    if (Number.isFinite(away?.[field])) quality++;
  }

  return quality;
}


function engineGameNumber(game, keys, fallback = null) {
  for (const key of keys) {
    const value = key
      .split(".")
      .reduce((obj, part) => obj?.[part], game);

    const number = handicapSafeNumber(value);
    if (Number.isFinite(number)) return number;
  }

  return fallback;
}

function engineExistingConfidence(game, fallback = 64) {
  return engineClamp(
    engineGameNumber(game, [
      "confidence",
      "confianca",
      "ai_confidence",
      "score_confidence",
      "handicap_confidence"
    ], fallback),
    55,
    82
  );
}

function engineOddsGoalProjection(oddsInfo) {
  const homeOdd = handicapSafeNumber(oddsInfo?.odd1);
  const drawOdd = handicapSafeNumber(oddsInfo?.oddX);
  const awayOdd = handicapSafeNumber(oddsInfo?.odd2);

  if (!Number.isFinite(homeOdd) || !Number.isFinite(awayOdd)) {
    return null;
  }

  const favoriteOdd = Math.min(homeOdd, awayOdd);
  const draw = Number.isFinite(drawOdd) ? drawOdd : 3.35;

  let projection = 2.25;

  if (favoriteOdd <= 1.35) projection += 0.75;
  else if (favoriteOdd <= 1.55) projection += 0.48;
  else if (favoriteOdd <= 1.80) projection += 0.25;

  if (draw >= 4.0) projection += 0.25;
  if (draw <= 3.0) projection -= 0.18;

  return engineClamp(projection, 1.65, 3.65);
}

function engineFallbackGoalProjection(game, oddsInfo) {
  const direct = engineGameNumber(game, [
    "proj_gols",
    "goals_projection",
    "projection_goals",
    "expected_goals",
    "xg_total",
    "market_projection.goals"
  ]);

  if (Number.isFinite(direct)) {
    return engineClamp(direct, 0.8, 5.5);
  }

  const oddsProjection = engineOddsGoalProjection(oddsInfo);
  if (Number.isFinite(oddsProjection)) return oddsProjection;

  const score = engineGameNumber(game, [
    "ai_score",
    "score",
    "strength",
    "market_score"
  ]);

  if (Number.isFinite(score)) {
    return engineClamp(1.8 + ((score % 35) / 35) * 1.45, 1.8, 3.25);
  }

  const homePos = engineGameNumber(game, [
    "pos_home",
    "event_raw.home_position"
  ]);

  const awayPos = engineGameNumber(game, [
    "pos_away",
    "event_raw.away_position"
  ]);

  const tableGap =
    Number.isFinite(homePos) &&
    Number.isFinite(awayPos)
      ? Math.abs(homePos - awayPos)
      : 0;

  const leagueId = engineGameNumber(game, [
    "league_id",
    "event_raw.league_id"
  ], 0);

  const leagueAdjustment =
    Number.isFinite(leagueId)
      ? ((leagueId % 7) - 3) * 0.06
      : 0;

  return engineClamp(
    2.28 +
      Math.min(0.42, tableGap * 0.035) +
      leagueAdjustment,
    1.95,
    3.05
  );
}

function engineFallbackCornersProjection(game) {
  const direct = engineGameNumber(game, [
    "proj_cantos",
    "corners_projection",
    "projCorners",
    "market_projection.corners",
    "projection_corners",
    "expected_corners"
  ]);

  if (Number.isFinite(direct)) {
    return engineClamp(direct, 5.5, 16.5);
  }

  const baseCorners = engineGameNumber(game, [
    "baseCorners",
    "base_corners",
    "league_base_corners",
    "event_raw.baseCorners"
  ]);

  const aiScore = engineGameNumber(game, [
    "ai_score",
    "score",
    "strength",
    "market_score"
  ]);

  const pressureHits = engineGameNumber(game, [
    "pressureHits",
    "pressure_hits",
    "pressao",
    "pressure"
  ]);

  const over95 = engineGameNumber(game, [
    "over95_prob_adj",
    "over95_prob",
    "over95",
    "over_95",
    "over9_5",
    "over95_rate"
  ]);

  const recentCombined = engineGameNumber(game, [
    "real.recentCombinedAvg",
    "recentCombinedAvg",
    "recent_combined_avg",
    "avg_total_corners"
  ]);

  const homeCorners = engineGameNumber(game, [
    "home_corners_avg",
    "homeCornersAvg",
    "casa_cantos",
    "stats.home.corners_for_avg"
  ]);

  const awayCorners = engineGameNumber(game, [
    "away_corners_avg",
    "awayCornersAvg",
    "fora_cantos",
    "stats.away.corners_for_avg"
  ]);

  const signals = [
    baseCorners,
    aiScore,
    pressureHits,
    over95,
    recentCombined,
    homeCorners,
    awayCorners
  ].filter(Number.isFinite).length;

  // Sem pelo menos dois indicadores reais, não cria projeção artificial.
  if (signals < 2) {
    return null;
  }

  let projection = Number.isFinite(baseCorners)
    ? baseCorners
    : Number.isFinite(recentCombined)
      ? recentCombined
      : (
          Number.isFinite(homeCorners) &&
          Number.isFinite(awayCorners)
            ? homeCorners + awayCorners
            : null
        );

  if (!Number.isFinite(projection)) {
    return null;
  }

  if (Number.isFinite(aiScore)) {
    projection += engineClamp(
      (aiScore - 60) / 34,
      -0.65,
      1.25
    );
  }

  if (Number.isFinite(pressureHits)) {
    projection += engineClamp(
      (pressureHits - 2) * 0.28,
      -0.45,
      1.05
    );
  }

  if (Number.isFinite(over95)) {
    const normalizedRate =
      over95 > 1 ? over95 / 100 : over95;

    projection += engineClamp(
      (normalizedRate - 0.5) * 2.1,
      -0.7,
      0.9
    );
  }

  if (
    Number.isFinite(homeCorners) &&
    Number.isFinite(awayCorners)
  ) {
    const teamsProjection = homeCorners + awayCorners;
    projection =
      projection * 0.52 +
      teamsProjection * 0.48;
  }

  if (Number.isFinite(recentCombined)) {
    projection =
      projection * 0.58 +
      recentCombined * 0.42;
  }

  return engineClamp(projection, 6.5, 15.5);
}
function engineFallbackCardsProjection(game) {
  return engineGameNumber(game, [
    "proj_cartoes",
    "cards_projection",
    "projection_cards",
    "market_projection.cards",
    "cards_avg"
  ]);
}

function goalsEngineDecision({ game, home, away, oddsInfo }) {
  const quality = engineDataQuality(
    home,
    away,
    ["goalsForAvg", "goalsAgainstAvg", "bttsRate"],
    oddsInfo
  );

  const completeProfile =
    Number.isFinite(home?.goalsForAvg) &&
    Number.isFinite(home?.goalsAgainstAvg) &&
    Number.isFinite(away?.goalsForAvg) &&
    Number.isFinite(away?.goalsAgainstAvg);

  let projection = null;
  let homeExpected = null;
  let awayExpected = null;
  let source = "fallback";

  if (completeProfile) {
    homeExpected =
      (home.goalsForAvg + away.goalsAgainstAvg) / 2;

    awayExpected =
      (away.goalsForAvg + home.goalsAgainstAvg) / 2;

    projection = homeExpected + awayExpected;
    source = "recent_form";
  } else {
    projection = engineFallbackGoalProjection(game, oddsInfo);
  }

  if (!Number.isFinite(projection)) {
    return engineDecision({
      market: "GOLS",
      skip: true,
      reason: "Não há projeção confiável disponível para este confronto."
    });
  }

  let line = "SEM APOSTA";
  let edge = 0;

  if (projection >= 3.45) {
    line = "OVER 3.5";
    edge = projection - 3.5;
  } else if (projection >= 2.68) {
    line = "OVER 2.5";
    edge = projection - 2.5;
  } else if (projection >= 1.92) {
    line = "OVER 1.5";
    edge = projection - 1.5;
  } else if (projection <= 2.05) {
    line = "UNDER 2.5";
    edge = 2.5 - projection;
  }

  if (line === "SEM APOSTA") {
    return engineDecision({
      market: "GOLS",
      skip: true,
      projection,
      reason: "A projeção ficou próxima demais da linha principal."
    });
  }

  let confidence =
    engineExistingConfidence(game, 63) +
    edge * (source === "recent_form" ? 10 : 6) +
    Math.max(0, quality - 2) * 0.8;

  if (source === "fallback") confidence = Math.min(confidence, 68);

  confidence = engineClamp(
    confidence,
    62,
    MULTI_MARKET_ENGINE.MAX_CONFIDENCE
  );

  return engineDecision({
    market: "GOLS",
    line,
    confidence,
    score: confidence + projection,
    projection,
    reason:
      source === "recent_form"
        ? `${line}: projeção de ${projection.toFixed(1)} gols com base na forma recente.`
        : `${line}: projeção de ${projection.toFixed(1)} gols usando odds e indicadores do servidor.`,
    extra: {
      home_expected: Number.isFinite(homeExpected)
        ? Number(homeExpected.toFixed(2))
        : null,
      away_expected: Number.isFinite(awayExpected)
        ? Number(awayExpected.toFixed(2))
        : null,
      data_quality: quality,
      calculation_source: source
    }
  });
}

function bttsEngineDecision({ game, home, away, oddsInfo, goalsDecision }) {
  const quality = engineDataQuality(
    home,
    away,
    [
      "goalsForAvg",
      "goalsAgainstAvg",
      "bttsRate",
      "cleanSheetRate"
    ],
    oddsInfo
  );

  const hasBtts =
    Number.isFinite(home?.bttsRate) &&
    Number.isFinite(away?.bttsRate);

  const fallbackProjection =
    Number.isFinite(Number(goalsDecision?.projection))
      ? Number(goalsDecision.projection)
      : engineFallbackGoalProjection(game, oddsInfo);

  let yesIndex = null;
  let noIndex = null;
  let source = "fallback";

  if (hasBtts) {
    const homeAttack = home?.goalsForAvg ?? 1;
    const awayAttack = away?.goalsForAvg ?? 1;
    const homeConcedes = home?.goalsAgainstAvg ?? 1;
    const awayConcedes = away?.goalsAgainstAvg ?? 1;

    yesIndex =
      ((home.bttsRate + away.bttsRate) / 2) * 50 +
      engineClamp(homeAttack / 1.6, 0, 1) * 12.5 +
      engineClamp(awayAttack / 1.6, 0, 1) * 12.5 +
      engineClamp(homeConcedes / 1.5, 0, 1) * 12.5 +
      engineClamp(awayConcedes / 1.5, 0, 1) * 12.5;

    noIndex =
      ((home?.cleanSheetRate ?? 0.2) +
        (away?.cleanSheetRate ?? 0.2)) / 2 * 55 +
      (100 - yesIndex) * 0.45;

    source = "recent_form";
  } else if (Number.isFinite(fallbackProjection)) {
    const drawOdd = handicapSafeNumber(oddsInfo?.oddX);
    const homeOdd = handicapSafeNumber(oddsInfo?.odd1);
    const awayOdd = handicapSafeNumber(oddsInfo?.odd2);
    const balancedOdds =
      Number.isFinite(homeOdd) &&
      Number.isFinite(awayOdd) &&
      Math.abs(homeOdd - awayOdd) <= 0.9;

    const favoriteGap =
      Number.isFinite(homeOdd) &&
      Number.isFinite(awayOdd)
        ? Math.abs(homeOdd - awayOdd)
        : 0;

    yesIndex =
      47 +
      (fallbackProjection - 2.05) * 17 +
      (balancedOdds ? 7 : 0) +
      (
        Number.isFinite(drawOdd) &&
        drawOdd >= 3.35
          ? 4
          : 0
      ) -
      (
        favoriteGap >= 1.5
          ? 6
          : 0
      );

    yesIndex = engineClamp(yesIndex, 32, 80);
    noIndex = 100 - yesIndex;
  }

  if (!Number.isFinite(yesIndex) || !Number.isFinite(noIndex)) {
    return engineDecision({
      market: "AMBAS MARCAM",
      skip: true,
      reason: "Não há dados suficientes para definir SIM ou NÃO."
    });
  }

  let line = "SEM APOSTA";
  let confidence = 0;

  if (yesIndex >= 55 && yesIndex - noIndex >= 6) {
    line = "AMBAS SIM";
    confidence = 58 + (yesIndex - 50) * 0.62;
  } else if (noIndex >= 55 && noIndex - yesIndex >= 6) {
    line = "AMBAS NÃO";
    confidence = 58 + (noIndex - 50) * 0.62;
  }

  if (line === "SEM APOSTA") {
    // V79 — BTTS nunca fica preso em "AGUARDANDO" quando já existe
    // uma projeção real calculada. Em cenário equilibrado publica a leitura
    // mais conservadora do próprio índice, com confiança mínima controlada.
    const diff = Math.abs(yesIndex - noIndex);
    if (Number.isFinite(fallbackProjection) || hasBtts) {
      if (yesIndex > noIndex) {
        line = "AMBAS SIM";
      } else if (noIndex > yesIndex) {
        line = "AMBAS NÃO";
      } else {
        line = Number(fallbackProjection || 0) >= 2.35
          ? "AMBAS SIM"
          : "AMBAS NÃO";
      }

      confidence = 62 + Math.min(4, diff * 0.25);
      source = source === "fallback" ? "fallback_conservative" : source;
    } else {
      return engineDecision({
        market: "AMBAS MARCAM",
        skip: true,
        reason: "Não há base estatística mínima para definir SIM ou NÃO."
      });
    }
  }

  confidence = engineClamp(
    confidence + Math.max(0, quality - 2) * 0.7,
    62,
    (source === "fallback" || source === "fallback_conservative") ? 72 : MULTI_MARKET_ENGINE.MAX_CONFIDENCE
  );

  return engineDecision({
    market: "AMBAS MARCAM",
    line,
    confidence,
    score: confidence + Math.abs(yesIndex - noIndex),
    reason:
      `${line}: índice SIM ${yesIndex.toFixed(0)} e índice NÃO ${noIndex.toFixed(0)}.`,
    extra: {
      yes_index: Number(yesIndex.toFixed(1)),
      no_index: Number(noIndex.toFixed(1)),
      data_quality: quality,
      calculation_source: source
    }
  });
}


function cornersPoissonCdf(k, lambda) {
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;

  const limit = Math.max(0, Math.floor(k));
  let term = Math.exp(-lambda);
  let sum = term;

  for (let index = 1; index <= limit; index++) {
    term *= lambda / index;
    sum += term;
  }

  return engineClamp(sum, 0, 1);
}

function cornersLineProbability(projection, line, direction) {
  const threshold = Math.floor(Number(line));

  if (direction === "OVER") {
    return 1 - cornersPoissonCdf(threshold, projection);
  }

  return cornersPoissonCdf(threshold, projection);
}

function cornersCompareLines(candidates) {
  const ranked = candidates
    .filter(candidate =>
      Number.isFinite(candidate.probability) &&
      candidate.probability >= candidate.minProbability
    )
    .map(candidate => {
      const expectedValue =
        candidate.probability * candidate.estimatedOdd - 1;

      const score =
        candidate.probability * 30 +
        expectedValue * 100 +
        Number(candidate.ambitionBonus || 0) +
        Number(candidate.contextBonus || 0) -
        Number(candidate.riskPenalty || 0);

      return {
        ...candidate,
        expectedValue,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] || null;

  return {
    best: best && best.score >= 8 ? best : null,
    ranked
  };
}

function cornersComparisonSummary(ranked, limit = 7) {
  return (ranked || [])
    .slice(0, limit)
    .map(candidate => ({
      line: candidate.label,
      probability: Number(
        (candidate.probability * 100).toFixed(1)
      ),
      estimated_odd: Number(
        candidate.estimatedOdd.toFixed(2)
      ),
      expected_value: Number(
        (candidate.expectedValue * 100).toFixed(1)
      ),
      score: Number(candidate.score.toFixed(2))
    }));
}


const cornersStableDecisionCache = new Map();

function cornersStableKey(game) {
  return String(
    game?.match_id ??
    game?.event_key ??
    game?.event_raw?.match_id ??
    `${game?.casa || ""}|${game?.fora || ""}|${game?.horario || ""}`
  );
}

function cornersDecisionQuality(decision) {
  if (!decision || decision.skip) return 0;

  const source =
    decision?.calculation_source ||
    decision?.extra?.calculation_source ||
    "";

  const sampleGames = Number(
    decision?.sample_games ??
    decision?.extra?.sample_games ??
    0
  );

  const projection = Number(decision?.projection || 0);
  const confidence = Number(decision?.confidence || 0);

  let quality = 0;

  if (source === "recent_form") quality += 5;
  else if (source === "fallback") quality += 2;

  quality += Math.min(5, sampleGames);
  quality += confidence / 20;

  if (projection >= 9.4 && projection <= 13.8) {
    quality += 2;
  }

  if (decision.line === "OVER 8.5") {
    quality -= 1.5;
  }

  return quality;
}

function cornersStoreStableDecision(game, decision) {
  if (!decision || decision.skip) return decision;

  const key = cornersStableKey(game);
  const existing = cornersStableDecisionCache.get(key);
  const incomingQuality = cornersDecisionQuality(decision);
  const existingQuality = cornersDecisionQuality(existing?.decision);

  const existingLine = String(existing?.decision?.line || "").toUpperCase();
  const incomingLine = String(decision?.line || "").toUpperCase();

  const existingIsOver = existingLine.startsWith("OVER");
  const incomingIsUnder = incomingLine.startsWith("UNDER");

  const incomingSource =
    decision?.calculation_source ||
    decision?.extra?.calculation_source ||
    "";

  const incomingSampleGames = Number(
    decision?.sample_games ??
    decision?.extra?.sample_games ??
    0
  );

  const incomingProjection = Number(decision?.projection);

  const incomingRobustUnder = Boolean(
    decision?.robust_under_evidence ??
    decision?.extra?.robust_under_evidence
  );

  const canReplaceOverWithUnder =
    incomingSource === "recent_form" &&
    incomingSampleGames >= 4 &&
    incomingRobustUnder &&
    Number.isFinite(incomingProjection) &&
    incomingProjection <= 9.35 &&
    incomingQuality >= existingQuality + 0.75;

  if (
    existing &&
    existing.expires > Date.now() &&
    existingIsOver &&
    incomingIsUnder &&
    !canReplaceOverWithUnder
  ) {
    return {
      ...existing.decision,
      stable_cache_used: true,
      under_flip_blocked: true,
      reason:
        `${existing.decision.reason} A leitura OVER foi preservada porque o novo UNDER ainda não possui evidência robusta suficiente.`
    };
  }

  if (
    existing &&
    existing.expires > Date.now() &&
    existingQuality > incomingQuality + 1.5
  ) {
    return {
      ...existing.decision,
      stable_cache_used: true,
      reason:
        `${existing.decision.reason} Última leitura completa preservada enquanto os dados são atualizados.`
    };
  }

  cornersStableDecisionCache.set(key, {
    decision,
    expires: Date.now() + 90 * 60 * 1000
  });

  return decision;
}


/*
 * Fallback de cantos permanece propositalmente conservador:
 * nunca gera UNDER 10.5/11.5. UNDER só pode surgir do motor completo
 * com recent_form + evidência robusta + gate de projeção.
 */
function cornersFallbackLineFromProjection(projection) {
  if (!Number.isFinite(projection)) {
    return null;
  }

  if (projection >= 11.9) {
    return {
      line: "OVER 11.5",
      confidence: 67
    };
  }

  if (projection >= 10.8) {
    return {
      line: "OVER 10.5",
      confidence: 68
    };
  }

  if (projection >= 9.7) {
    return {
      line: "OVER 9.5",
      confidence: 67
    };
  }

  if (projection >= 8.9) {
    return {
      line: "OVER 8.5",
      confidence: 63
    };
  }

  if (projection <= 7.45) {
    return {
      line: "UNDER 9.5",
      confidence: 62
    };
  }

  return null;
}

function cornersUsePreviousOrUpdating(game, draftDecision) {
  const key = cornersStableKey(game);
  const existing = cornersStableDecisionCache.get(key);

  if (existing && existing.expires > Date.now()) {
    return {
      ...existing.decision,
      stable_cache_used: true,
      reason:
        `${existing.decision.reason} Última leitura válida mantida durante a atualização dos dados.`
    };
  }

  const projection = Number(draftDecision?.projection);
  const fallback = cornersFallbackLineFromProjection(projection);

  if (fallback) {
    const decision = {
      ...draftDecision,
      skip: false,
      updating: false,
      line: fallback.line,
      confidence: fallback.confidence,
      score:
        Number(draftDecision?.score || 0) +
        fallback.confidence +
        projection,
      fallback_line_used: true,
      reason:
        `${fallback.line}: linha conservadora escolhida pela projeção disponível de ${projection.toFixed(1)} escanteios.`
    };

    cornersStableDecisionCache.set(key, {
      decision,
      expires: Date.now() + 45 * 60 * 1000
    });

    return decision;
  }

  return {
    ...draftDecision,
    skip: true,
    line: "DADOS EM ATUALIZAÇÃO",
    confidence: 0,
    score: 0,
    updating: true,
    reason:
      "A API ainda não entregou uma projeção mínima para este confronto."
  };
}

function cornersEngineDecision({ game, home, away }) {
  const homeGames = Number(home?.cornerGames || 0);
  const awayGames = Number(away?.cornerGames || 0);
  const sampleGames = Math.min(homeGames, awayGames);

  const hasCornerAverages =
    Number.isFinite(home?.cornersForAvg) &&
    Number.isFinite(home?.cornersAgainstAvg) &&
    Number.isFinite(away?.cornersForAvg) &&
    Number.isFinite(away?.cornersAgainstAvg);

  const leagueBase = engineClamp(
    engineGameNumber(game, [
      "baseCorners",
      "base_corners",
      "league_base_corners",
      "event_raw.baseCorners"
    ], 9.8),
    8.6,
    11.4
  );

  const fallbackProjection =
    engineFallbackCornersProjection(game);

  let rawRecentProjection = null;

  if (hasCornerAverages) {
    const homeExpected =
      (home.cornersForAvg + away.cornersAgainstAvg) / 2;

    const awayExpected =
      (away.cornersForAvg + home.cornersAgainstAvg) / 2;

    rawRecentProjection = homeExpected + awayExpected;
  }

  let projection = null;
  let source = "fallback";

  if (
    Number.isFinite(rawRecentProjection) &&
    sampleGames >= 3
  ) {
    const recentWeight =
      sampleGames >= 5
        ? 0.72
        : sampleGames === 4
          ? 0.62
          : 0.52;

    projection =
      rawRecentProjection * recentWeight +
      leagueBase * (1 - recentWeight);

    source = "recent_form";
  } else if (Number.isFinite(fallbackProjection)) {
    projection =
      fallbackProjection * 0.76 +
      leagueBase * 0.24;
  } else {
    return cornersUsePreviousOrUpdating(
      game,
      {
        market: "ESCANTEIOS",
        skip: true,
        projection: null,
        confidence: 0,
        score: 0,
        line: "DADOS EM ATUALIZAÇÃO",
        reason:
          "A API ainda não entregou indicadores reais suficientes para calcular a linha de escanteios.",
        extra: {
          sample_games: sampleGames,
          calculation_source: "insufficient_data"
        }
      }
    );
  }

  projection = engineClamp(projection, 7.2, 15.8);

  const pressureHits = engineGameNumber(game, [
    "pressureHits",
    "pressure_hits",
    "pressao",
    "pressure"
  ]);

  const over95 = engineGameNumber(game, [
    "over95_prob_adj",
    "over95_prob",
    "over95",
    "over_95",
    "over9_5",
    "over95_rate"
  ]);

  const normalizedOver95 =
    Number.isFinite(over95)
      ? (over95 > 1 ? over95 / 100 : over95)
      : null;

  const robustUnderEvidence =
    hasCornerAverages &&
    homeGames >= 5 &&
    awayGames >= 5 &&
    Number.isFinite(rawRecentProjection) &&
    Number.isFinite(pressureHits) &&
    pressureHits <= 1 &&
    Number.isFinite(normalizedOver95) &&
    normalizedOver95 <= 0.30;

  const candidates = [
    {
      label: "OVER 8.5",
      direction: "OVER",
      line: 8.5,
      estimatedOdd: 1.52,
      ambitionBonus: 0,
      minProbability: 0.57
    },
    {
      label: "OVER 9.5",
      direction: "OVER",
      line: 9.5,
      estimatedOdd: 1.72,
      ambitionBonus: 8,
      minProbability: 0.48
    },
    {
      label: "OVER 10.5",
      direction: "OVER",
      line: 10.5,
      estimatedOdd: 1.98,
      ambitionBonus: 16,
      minProbability: 0.39
    },
    {
      label: "OVER 11.5",
      direction: "OVER",
      line: 11.5,
      estimatedOdd: 2.28,
      ambitionBonus: 23,
      minProbability: 0.31
    },
    {
      label: "UNDER 9.5",
      direction: "UNDER",
      line: 9.5,
      estimatedOdd: 1.72,
      ambitionBonus: 7,
      minProbability: 0.54,
      riskPenalty: robustUnderEvidence ? 0 : 30
    },
    {
      label: "UNDER 10.5",
      direction: "UNDER",
      line: 10.5,
      estimatedOdd: 1.55,
      ambitionBonus: 2,
      minProbability: 0.62,
      riskPenalty: robustUnderEvidence ? 0 : 24
    },
    {
      label: "UNDER 11.5",
      direction: "UNDER",
      line: 11.5,
      estimatedOdd: 1.40,
      ambitionBonus: 0,
      minProbability: 0.70,
      riskPenalty: robustUnderEvidence ? 0 : 22
    }
  ].map(candidate => {
    let projectionGate = true;

    if (candidate.label === "OVER 8.5") {
      projectionGate =
        projection >= 8.9 &&
        projection < 10.15;
    } else if (candidate.label === "OVER 9.5") {
      projectionGate = projection >= 9.75;
    } else if (candidate.label === "OVER 10.5") {
      projectionGate = projection >= 10.75;
    } else if (candidate.label === "OVER 11.5") {
      projectionGate = projection >= 11.75;
    } else if (candidate.label === "UNDER 9.5") {
      // UNDER 9.5 é uma linha agressiva: só entra com amostra forte
      // e projeção realmente baixa. Nunca entra por simples piso do motor.
      projectionGate =
        source === "recent_form" &&
        robustUnderEvidence &&
        sampleGames >= 5 &&
        Number.isFinite(rawRecentProjection) &&
        rawRecentProjection <= 7.95 &&
        projection <= 8.05 &&
        normalizedOver95 <= 0.25;
    } else if (candidate.label === "UNDER 10.5") {
      projectionGate =
        source === "recent_form" &&
        robustUnderEvidence &&
        sampleGames >= 5 &&
        Number.isFinite(rawRecentProjection) &&
        projection <= 9.10 &&
        normalizedOver95 <= 0.28;
    } else if (candidate.label === "UNDER 11.5") {
      projectionGate =
        source === "recent_form" &&
        robustUnderEvidence &&
        sampleGames >= 5 &&
        Number.isFinite(rawRecentProjection) &&
        projection <= 9.85 &&
        normalizedOver95 <= 0.30;
    }

    return {
      ...candidate,
      probability: projectionGate
        ? cornersLineProbability(
            projection,
            candidate.line,
            candidate.direction
          )
        : 0,
      contextBonus:
        source === "recent_form"
          ? Math.min(5, sampleGames)
          : 0
    };
  });

  const comparison = cornersCompareLines(candidates);

  if (!comparison.best) {
    return cornersUsePreviousOrUpdating(
      game,
      {
        market: "ESCANTEIOS",
        skip: true,
        projection,
        confidence: 0,
        score: 0,
        line: "SEM APOSTA",
        reason:
          `A projeção de ${projection.toFixed(1)} cantos será convertida em uma linha conservadora.`,
        extra: {
          sample_games: sampleGames,
          calculation_source: source,
          compared_lines:
            cornersComparisonSummary(comparison.ranked)
        }
      }
    );
  }

  const best = comparison.best;

  let confidence =
    54 +
    best.probability * 28 +
    Math.max(0, best.expectedValue) * 35 +
    Math.min(6, sampleGames * 0.9);

  if (source === "fallback") {
    confidence = Math.min(confidence, 74);
  }

  if (best.label.startsWith("UNDER")) {
    // V3: não achata todo UNDER em 69%.
    // O teto varia com a quantidade de dados e com a força da evidência.
    const underEvidenceBonus =
      Math.min(6, Math.max(0, sampleGames - 3) * 1.5) +
      (
        Number.isFinite(normalizedOver95)
          ? Math.min(
              3,
              Math.max(0, (0.34 - normalizedOver95) * 12)
            )
          : 0
      );

    confidence = Math.min(
      confidence,
      69 + underEvidenceBonus
    );
  }

  // V4: NÃO força mais qualquer leitura de cantos para 62%.
  // engineDecision() já possui o MIN_CONFIDENCE oficial.
  // Se a confiança calculada for menor, a saída correta será SEM APOSTA.
  confidence = engineClamp(
    confidence,
    0,
    MULTI_MARKET_ENGINE.MAX_CONFIDENCE
  );

  const decision = engineDecision({
    market: "ESCANTEIOS",
    line: best.label,
    confidence,
    score: best.score + confidence,
    projection,
    reason:
      `${best.label}: melhor linha entre ${candidates.length} opções comparadas, ` +
      `com probabilidade estimada de ${(best.probability * 100).toFixed(0)}%.`,
    extra: {
      data_quality: hasCornerAverages ? 4 : 1,
      calculation_source: source,
      sample_games: sampleGames,
      raw_recent_projection:
        Number.isFinite(rawRecentProjection)
          ? Number(rawRecentProjection.toFixed(2))
          : null,
      league_base: Number(leagueBase.toFixed(2)),
      pressure_hits:
        Number.isFinite(pressureHits)
          ? pressureHits
          : null,
      over95_rate:
        Number.isFinite(normalizedOver95)
          ? Number((normalizedOver95 * 100).toFixed(1))
          : null,
      robust_under_evidence: robustUnderEvidence,
      corner_engine_version: "corners-strict-v4-confidence-gate",
      under_gate_version: "strict-v4-confidence-gate",
      compared_lines:
        cornersComparisonSummary(comparison.ranked),
      selected_expected_value:
        Number((best.expectedValue * 100).toFixed(1))
    }
  });

  const weakFallbackOver85 =
    decision.line === "OVER 8.5" &&
    source === "fallback" &&
    sampleGames < 3 &&
    projection < 8.45;

  if (weakFallbackOver85) {
    return cornersUsePreviousOrUpdating(game, decision);
  }

  return cornersStoreStableDecision(game, decision);
}

function cardsEngineDecision({ game, home, away }) {
  const quality = engineDataQuality(
    home,
    away,
    ["cardsForAvg", "cardsAgainstAvg"]
  );

  const completeProfile =
    Number.isFinite(home?.cardsForAvg) &&
    Number.isFinite(home?.cardsAgainstAvg) &&
    Number.isFinite(away?.cardsForAvg) &&
    Number.isFinite(away?.cardsAgainstAvg);

  let projection = null;
  let source = "fallback";

  if (completeProfile) {
    const homeExpected =
      (home.cardsForAvg + away.cardsAgainstAvg) / 2;

    const awayExpected =
      (away.cardsForAvg + home.cardsAgainstAvg) / 2;

    projection = homeExpected + awayExpected;
    source = "recent_form";
  } else {
    projection = engineFallbackCardsProjection(game);
  }

  if (!Number.isFinite(projection)) {
    return engineDecision({
      market: "CARTÕES",
      skip: true,
      reason: "Dados disciplinares ainda não estão disponíveis."
    });
  }

  projection = engineClamp(projection, 1.5, 9);

  let line = "SEM APOSTA";
  let edge = 0;

  if (projection >= 5.65) {
    line = "OVER 5.5";
    edge = projection - 5.5;
  } else if (projection >= 4.65) {
    line = "OVER 4.5";
    edge = projection - 4.5;
  } else if (projection >= 3.65) {
    line = "OVER 3.5";
    edge = projection - 3.5;
  } else if (projection >= 2.7) {
    line = "OVER 2.5";
    edge = projection - 2.5;
  } else if (projection <= 3.65) {
    line = "UNDER 4.5";
    edge = 4.5 - projection;
  }

  let confidence =
    engineExistingConfidence(game, 62) +
    edge * (source === "recent_form" ? 7 : 4);

  if (source === "fallback") confidence = Math.min(confidence, 70);

  confidence = engineClamp(
    confidence,
    62,
    MULTI_MARKET_ENGINE.MAX_CONFIDENCE
  );

  return engineDecision({
    market: "CARTÕES",
    line,
    confidence,
    score: confidence + projection,
    projection,
    reason:
      `${line}: projeção de ${projection.toFixed(1)} cartões.`,
    extra: {
      data_quality: quality,
      calculation_source: source
    }
  });
}


const FUTURE_MARKET_READY_CACHE_TTL_MS =
  Number(process.env.FUTURE_MARKET_READY_CACHE_TTL_MIN || 720) *
  60 *
  1000;

const futureMarketReadyCache = new Map();

/* =========================================================
   CORNER PRO — SNAPSHOT PERSISTENTE DOS MERCADOS V1
   - Uma análise válida nunca volta para "SEM APOSTA".
   - O snapshot é separado por DATA + JOGO + MERCADO.
   - Firestore é a fonte persistente; disco é fallback local.
   - O dia seguinte é pré-calculado automaticamente.
   ========================================================= */
const MARKET_ENGINE_SNAPSHOT_VERSION =
  process.env.MARKET_ENGINE_SNAPSHOT_VERSION ||
  "market-engine-snapshot-v3-corner-lock-reset";

const MARKET_ENGINE_SNAPSHOT_COLLECTION =
  process.env.MARKET_ENGINE_SNAPSHOT_COLLECTION ||
  "market_engine_snapshots";

const MARKET_ENGINE_PREWARM_INTERVAL_MIN = Math.max(
  30,
  Number(process.env.MARKET_ENGINE_PREWARM_INTERVAL_MIN || 60)
);

const MARKET_ENGINE_PREWARM_START_DELAY_MS = Math.max(
  5000,
  Number(process.env.MARKET_ENGINE_PREWARM_START_DELAY_MS || 15000)
);

const MARKET_ENGINE_DECISION_FIELDS = {
  corners: "corners_ai",
  goals: "goals_ai",
  cards: "cards_ai",
  btts: "btts_ai",
  handicap: "handicap_ai"
};

/*
 * MARKET ENGINE ISOLATION V2
 * Cada lista de /market_engines expõe apenas a decisão da própria IA.
 */
function marketEngineMarketFromDecisionField(decisionField) {
  return Object.entries(MARKET_ENGINE_DECISION_FIELDS)
    .find(([, field]) => field === decisionField)?.[0] || "";
}

function marketEngineStripForeignDecisions(game, decisionField) {
  const isolated = { ...(game || {}) };

  for (const field of Object.values(MARKET_ENGINE_DECISION_FIELDS)) {
    if (field !== decisionField) delete isolated[field];
  }

  isolated.market_engine =
    marketEngineMarketFromDecisionField(decisionField);
  isolated.market_decision_field = decisionField;
  isolated.market_isolated = true;

  return isolated;
}

function marketEngineIsolatePayload(payload) {
  const isolated = { ...(payload || {}) };

  for (const [market, decisionField] of Object.entries(
    MARKET_ENGINE_DECISION_FIELDS
  )) {
    isolated[market] = (
      Array.isArray(payload?.[market])
        ? payload[market]
        : []
    ).map(game =>
      marketEngineStripForeignDecisions(
        game,
        decisionField
      )
    );
  }

  isolated.market_contract_version = "market-isolation-v2";
  isolated.market_lists_are_isolated = true;

  return isolated;
}

let marketEnginePrewarmRunning = false;

function marketEngineSnapshotPath(date) {
  return path.join(
    CACHE_DIR,
    `market-engines-${date}-${MARKET_ENGINE_SNAPSHOT_VERSION}.json`
  );
}

function marketEngineSnapshotId(date) {
  return firestoreSafeId(
    `${date}-${MARKET_ENGINE_SNAPSHOT_VERSION}`
  );
}

function marketEngineDateShift(date, days = 1) {
  const base = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return date;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function marketEngineGameIdentity(game) {
  return String(
    game?.match_id ??
    game?.event_id ??
    game?.event_key ??
    game?.fixture_id ??
    game?.event_raw?.match_id ??
    game?.event_raw?.event_id ??
    [
      game?.casa || game?.home || "",
      game?.fora || game?.away || "",
      game?.hora || game?.hora_manaus || game?.match_time || ""
    ].join("|")
  );
}

function marketEngineGameFinished(game) {
  const status = String(
    game?.status ??
    game?.match_status ??
    game?.event_status ??
    game?.event_raw?.match_status ??
    game?.event_raw?.status ??
    ""
  ).trim().toLowerCase();

  return Boolean(
    game?.finished ||
    game?.event_raw?.finished ||
    /finished|full.?time|\bft\b|encerr|finaliz|ended|after penalties/.test(status)
  );
}

function marketEngineDecisionIsStable(decision) {
  if (!decision || typeof decision !== "object") return false;

  const line = String(decision.line || "").trim().toUpperCase();

  return Boolean(
    !decision.skip &&
    !decision.updating &&
    line &&
    line !== "SEM APOSTA" &&
    line !== "DADOS EM ATUALIZAÇÃO" &&
    line !== "ANALISANDO PARTIDA"
  );
}

function marketEnginePreserveDecision(storedDecision) {
  if (!marketEngineDecisionIsStable(storedDecision)) {
    return storedDecision;
  }

  return {
    ...storedDecision,
    snapshot_preserved: true,
    snapshot_locked: true,
    preserved_at: new Date().toISOString()
  };
}

async function readMarketEngineSnapshot(date) {
  const docId = marketEngineSnapshotId(date);

  // 1) Firestore: persiste mesmo se o Render reiniciar.
  try {
    const snap = await db
      .collection(MARKET_ENGINE_SNAPSHOT_COLLECTION)
      .doc(docId)
      .get();

    if (snap.exists) {
      const data = snap.data();
      if (
        data?.version === MARKET_ENGINE_SNAPSHOT_VERSION &&
        data?.date === date &&
        data?.payload &&
        typeof data.payload === "object"
      ) {
        return data.payload;
      }
    }
  } catch (err) {
    console.warn(
      "Snapshot de mercados: leitura Firestore falhou; usando disco:",
      err?.message || err
    );
  }

  // 2) Disco local: fallback de desenvolvimento/contingência.
  const fp = marketEngineSnapshotPath(date);

  if (!fs.existsSync(fp)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf-8"));

    if (
      parsed?.version === MARKET_ENGINE_SNAPSHOT_VERSION &&
      parsed?.date === date &&
      parsed?.payload &&
      typeof parsed.payload === "object"
    ) {
      return parsed.payload;
    }
  } catch {}

  return null;
}

async function writeMarketEngineSnapshot(date, payload) {
  if (!payload || typeof payload !== "object") return;

  const wrapper = {
    version: MARKET_ENGINE_SNAPSHOT_VERSION,
    date,
    saved_at: new Date().toISOString(),
    saved_at_ms: Date.now(),
    payload: firestoreSanitize(payload)
  };

  try {
    await db
      .collection(MARKET_ENGINE_SNAPSHOT_COLLECTION)
      .doc(marketEngineSnapshotId(date))
      .set(wrapper, { merge: false });
  } catch (err) {
    console.warn(
      "Snapshot de mercados: gravação Firestore falhou; mantendo disco:",
      err?.message || err
    );
  }

  try {
    fs.writeFileSync(
      marketEngineSnapshotPath(date),
      JSON.stringify(wrapper, null, 2)
    );
  } catch {}
}

function mergeMarketEngineList(incomingList, storedList, decisionField) {
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  const stored = Array.isArray(storedList) ? storedList : [];

  const storedById = new Map(
    stored.map(game => [marketEngineGameIdentity(game), game])
  );

  const seen = new Set();

  const merged = incoming.map(game => {
    const id = marketEngineGameIdentity(game);
    seen.add(id);

    const oldGame = storedById.get(id);
    const currentDecision = game?.[decisionField];
    let oldDecision = oldGame?.[decisionField];

    // V4 — invalidação CIRÚRGICA apenas de corners_ai antigo.
    // goals_ai, btts_ai, handicap_ai e cards_ai continuam preservados.
    if (decisionField === "corners_ai") {
      const oldCornerVersion =
        oldDecision?.corner_engine_version ??
        oldDecision?.extra?.corner_engine_version ??
        "";

      if (oldCornerVersion !== "corners-strict-v4-confidence-gate") {
        oldDecision = null;
      }
    }

    const finished = marketEngineGameFinished(game);
    const lockPregameAtFinal =
      finished &&
      (decisionField === "btts_ai" || decisionField === "handicap_ai") &&
      marketEngineDecisionIsStable(oldDecision);

    // BTTS e Handicap encerrados preservam a última indicação pré-jogo.
    // Assim o front liquida GREEN/RED pelo placar real, sem recalcular
    // a aposta depois que o jogo terminou.
    if (lockPregameAtFinal) {
      return marketEngineStripForeignDecisions({
        ...oldGame,
        ...game,
        [decisionField]: {
          ...marketEnginePreserveDecision(oldDecision),
          final_settlement_locked: true
        },
        analysis_snapshot_preserved: true
      }, decisionField);
    }

    // Em pré-jogo/ao vivo, uma análise nova válida pode substituir a anterior.
    if (marketEngineDecisionIsStable(currentDecision)) {
      return marketEngineStripForeignDecisions(
        game,
        decisionField
      );
    }

    // Se a leitura atual falhou, mantém somente a última decisão
    // válida DO MESMO MERCADO.
    if (marketEngineDecisionIsStable(oldDecision)) {
      return marketEngineStripForeignDecisions({
        ...oldGame,
        ...game,
        [decisionField]:
          marketEnginePreserveDecision(oldDecision),
        analysis_snapshot_preserved: true
      }, decisionField);
    }

    return marketEngineStripForeignDecisions(
      game,
      decisionField
    );
  });

  // Jogo temporariamente ausente: preserva apenas o snapshot
  // do próprio mercado, sem decisões estrangeiras.
  for (const oldGame of stored) {
    const id = marketEngineGameIdentity(oldGame);
    if (seen.has(id)) continue;

    let oldDecision = oldGame?.[decisionField];

    if (decisionField === "corners_ai") {
      const oldCornerVersion =
        oldDecision?.corner_engine_version ??
        oldDecision?.extra?.corner_engine_version ??
        "";

      if (oldCornerVersion !== "corners-strict-v4-confidence-gate") {
        oldDecision = null;
      }
    }

    if (!marketEngineDecisionIsStable(oldDecision)) continue;

    merged.push(
      marketEngineStripForeignDecisions({
        ...oldGame,
        [decisionField]:
          marketEnginePreserveDecision(oldDecision),
        analysis_snapshot_preserved: true,
        upstream_temporarily_missing: true
      }, decisionField)
    );
  }

  return merged;
}

async function mergeAndSaveMarketEngineSnapshot(date, payload) {
  payload = marketEngineIsolatePayload(payload);
  const previous = await readMarketEngineSnapshot(date);

  if (!previous) {
    await writeMarketEngineSnapshot(date, payload);
    return {
      ...payload,
      snapshot_date: date,
      snapshot_saved: true
    };
  }

  const merged = {
    ...previous,
    ...payload,
    date,
    generated_at: payload.generated_at || new Date().toISOString()
  };

  for (const [market, decisionField] of Object.entries(
    MARKET_ENGINE_DECISION_FIELDS
  )) {
    merged[market] = mergeMarketEngineList(
      payload?.[market],
      previous?.[market],
      decisionField
    );
  }

  merged.snapshot_date = date;
  merged.snapshot_saved = true;
  merged.snapshot_preserves_valid_analysis = true;

  await writeMarketEngineSnapshot(date, merged);

  return merged;
}

async function prewarmTomorrowMarketEngines() {
  if (marketEnginePrewarmRunning) return;

  marketEnginePrewarmRunning = true;

  const today = futureMarketTodayManaus();
  const tomorrow = marketEngineDateShift(today, 1);

  try {
    console.log(
      `[market-prewarm] Preparando análises de ${tomorrow}...`
    );

    const payload = await buildAllMarketEngines({
      date: tomorrow
    });

    const counts = Object.fromEntries(
      Object.keys(MARKET_ENGINE_DECISION_FIELDS).map(market => [
        market,
        (Array.isArray(payload?.[market])
          ? payload[market]
          : []
        ).filter(game =>
          marketEngineDecisionIsStable(
            game?.[MARKET_ENGINE_DECISION_FIELDS[market]]
          )
        ).length
      ])
    );

    console.log(
      `[market-prewarm] ${tomorrow} pronto:`,
      counts
    );
  } catch (err) {
    console.warn(
      `[market-prewarm] Falha ao preparar ${tomorrow}:`,
      err?.message || err
    );
  } finally {
    marketEnginePrewarmRunning = false;
  }
}

function installMarketEnginePrewarm() {
  setTimeout(() => {
    prewarmTomorrowMarketEngines().catch(() => {});
  }, MARKET_ENGINE_PREWARM_START_DELAY_MS);

  setInterval(() => {
    prewarmTomorrowMarketEngines().catch(() => {});
  }, MARKET_ENGINE_PREWARM_INTERVAL_MIN * 60 * 1000);
}

function futureMarketTodayManaus() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function futureMarketIsFutureDate(date) {
  return String(date || "") > futureMarketTodayManaus();
}

function futureMarketGameKey(game, market) {
  return [
    market,
    game?.match_id ??
      game?.event_key ??
      game?.event_raw?.match_id ??
      `${game?.casa || ""}|${game?.fora || ""}|${game?.hora || game?.horario || ""}`
  ].join(":");
}

function futureMarketGetStable(game, market) {
  const key = futureMarketGameKey(game, market);
  const cached = futureMarketReadyCache.get(key);

  if (!cached) return null;

  if (cached.expires <= Date.now()) {
    futureMarketReadyCache.delete(key);
    return null;
  }

  return cached.decision;
}

function futureMarketSaveStable(game, market, decision) {
  if (
    !decision ||
    decision.skip ||
    decision.updating ||
    !decision.line ||
    decision.line === "SEM APOSTA" ||
    decision.line === "DADOS EM ATUALIZAÇÃO" ||
    decision.line === "ANALISANDO PARTIDA"
  ) {
    return decision;
  }

  futureMarketReadyCache.set(
    futureMarketGameKey(game, market),
    {
      decision: {
        ...decision,
        future_ready_cache: true,
        cached_at: new Date().toISOString()
      },
      expires: Date.now() + FUTURE_MARKET_READY_CACHE_TTL_MS
    }
  );

  return decision;
}

function futureMarketUpdatingDecision(market, reason) {
  return {
    market,
    line: "ANALISANDO PARTIDA",
    confidence: 0,
    score: 0,
    projection: null,
    skip: true,
    updating: true,
    future_waiting_data: true,
    calculation_source: "future_data_pending",
    source: "server",
    reason:
      reason ||
      "A IA está coletando as estatísticas necessárias antes de publicar uma recomendação."
  };
}

function futureMarketProfileReady(profile, market) {
  if (!profile || typeof profile !== "object") return false;

  if (market === "corners") {
    return (
      Number(profile.cornerGames || 0) >= 3 &&
      Number.isFinite(profile.cornersForAvg) &&
      Number.isFinite(profile.cornersAgainstAvg)
    );
  }

  if (market === "goals" || market === "btts") {
    return (
      Number(profile.goalGames || profile.games || 0) >= 3 ||
      (
        Number.isFinite(profile.goalsForAvg) &&
        Number.isFinite(profile.goalsAgainstAvg)
      )
    );
  }

  if (market === "cards") {
    return (
      Number(profile.cardGames || profile.games || 0) >= 3 ||
      (
        Number.isFinite(profile.cardsForAvg) &&
        Number.isFinite(profile.cardsAgainstAvg)
      )
    );
  }

  return false;
}

function futureMarketDecisionGate({
  date,
  game,
  market,
  decision,
  homeProfile,
  awayProfile,
  oddsInfo
}) {
  if (!futureMarketIsFutureDate(date)) {
    return futureMarketSaveStable(
      game,
      market,
      decision
    );
  }

  const stable = futureMarketGetStable(game, market);

  const homeReady =
    market === "handicap"
      ? true
      : futureMarketProfileReady(homeProfile, market);

  const awayReady =
    market === "handicap"
      ? true
      : futureMarketProfileReady(awayProfile, market);

  const oddsReady =
    market !== "handicap" ||
    Boolean(
      oddsInfo &&
      (
        Number.isFinite(Number(oddsInfo.home)) ||
        Number.isFinite(Number(oddsInfo.away)) ||
        Number.isFinite(Number(oddsInfo.draw)) ||
        Number.isFinite(Number(oddsInfo.odd_home)) ||
        Number.isFinite(Number(oddsInfo.odd_away)) ||
        Number.isFinite(Number(oddsInfo.odd1)) ||
        Number.isFinite(Number(oddsInfo.odd2)) ||
        Number.isFinite(Number(oddsInfo.oddX))
      )
    );

  const source =
    decision?.calculation_source ??
    decision?.extra?.calculation_source ??
    "";

  const decisionReady =
    decision &&
    !decision.skip &&
    !decision.updating &&
    decision.line &&
    decision.line !== "SEM APOSTA" &&
    decision.line !== "DADOS EM ATUALIZAÇÃO" &&
    decision.line !== "ANALISANDO PARTIDA" &&
    source !== "insufficient_data" &&
    source !== "future_data_pending" &&
    (
      market !== "corners" ||
      Number.isFinite(Number(decision.projection))
    );

  const profileSignals =
    Number(Boolean(homeReady)) +
    Number(Boolean(awayReady));

  const handicapHistoricalReady =
    market === "handicap" &&
    decisionReady &&
    (
      Number(decision?.data_quality || 0) >= 4 ||
      Boolean(decision?.factors?.home_form) ||
      Boolean(decision?.factors?.away_form) ||
      Boolean(decision?.factors?.table)
    );

  const dataReady =
    decisionReady &&
    (
      market === "handicap"
        ? (oddsReady || handicapHistoricalReady)
        : market === "btts"
          // BTTS já possui fallback próprio por projeção de gols/odds.
          // Se o motor conseguiu publicar AMBAS SIM/NÃO, não bloqueia
          // a decisão apenas porque o perfil futuro ainda não atingiu
          // o selo de pronto. Isso evita "AGUARDANDO DADOS" eterno.
          ? true
          : profileSignals >= 1
    );

  if (dataReady) {
    return futureMarketSaveStable(
      game,
      market,
      {
        ...decision,
        future_data_ready: true
      }
    );
  }

  if (stable) {
    return {
      ...stable,
      stable_cache_used: true,
      reason:
        `${stable.reason} Última análise completa preservada enquanto os dados futuros são atualizados.`
    };
  }

  const marketLabel = {
    corners: "ESCANTEIOS",
    goals: "GOLS",
    btts: "AMBAS MARCAM",
    cards: "CARTÕES",
    handicap: "HANDICAP ASIÁTICO"
  }[market] || String(market || "").toUpperCase();

  return futureMarketUpdatingDecision(
    marketLabel,
    `A IA ainda está coletando dados completos para este jogo futuro de ${marketLabel.toLowerCase()}.`
  );
}

async function buildAllMarketEngines({ date }) {
  const baseGames = await buildMarketGamesList({ date });
  const candidates = baseGames.slice(0, MULTI_MARKET_ENGINE.MAX_GAMES);

  const analyzed = await mapLimit(
    candidates,
    CONCURRENCY,
    async game => {
      let oddsInfo = null;
      let h2hBlock = null;

      try {
        if (game.match_id) {
          oddsInfo = await getOdds1x2(game.match_id);
        }
      } catch {
        oddsInfo = null;
      }

      try {
        h2hBlock = await getH2H(game.casa, game.fora);
      } catch {
        h2hBlock = null;
      }

      let homeMatches = Array.isArray(
        h2hBlock?.firstTeam_lastResults
      )
        ? h2hBlock.firstTeam_lastResults
        : [];

      let awayMatches = Array.isArray(
        h2hBlock?.secondTeam_lastResults
      )
        ? h2hBlock.secondTeam_lastResults
        : [];

      if (homeMatches.length < 3) {
        homeMatches = await engineRecentEventsByTeam(
          game.home_team_id,
          date,
          8
        );
      }

      if (awayMatches.length < 3) {
        awayMatches = await engineRecentEventsByTeam(
          game.away_team_id,
          date,
          8
        );
      }

      const [homeProfile, awayProfile] = await Promise.all([
        engineRecentProfile(
          game.casa,
          homeMatches,
          MULTI_MARKET_ENGINE.RECENT_N
        ),
        engineRecentProfile(
          game.fora,
          awayMatches,
          MULTI_MARKET_ENGINE.RECENT_N
        )
      ]);

      const handicapHistoryBlock = {
        ...(h2hBlock || {}),
        firstTeam_lastResults: homeMatches,
        secondTeam_lastResults: awayMatches
      };

      const rawHandicapDecision = handicapDecision({
        game,
        oddsInfo,
        h2hBlock: handicapHistoryBlock,
        posHome: game.pos_home,
        posAway: game.pos_away
      });

      const handicap_ai = futureMarketDecisionGate({
        date,
        game,
        market: "handicap",
        decision: rawHandicapDecision,
        homeProfile,
        awayProfile,
        oddsInfo
      });

      const rawGoalsDecision = goalsEngineDecision({
        game,
        home: homeProfile,
        away: awayProfile,
        oddsInfo
      });

      const goals_ai = futureMarketDecisionGate({
        date,
        game,
        market: "goals",
        decision: rawGoalsDecision,
        homeProfile,
        awayProfile,
        oddsInfo
      });

      const rawBttsDecision = bttsEngineDecision({
        game,
        home: homeProfile,
        away: awayProfile,
        oddsInfo,
        goalsDecision: rawGoalsDecision
      });

      const btts_ai = futureMarketDecisionGate({
        date,
        game,
        market: "btts",
        decision: rawBttsDecision,
        homeProfile,
        awayProfile,
        oddsInfo
      });

      const rawCornersDecision = cornersEngineDecision({
        game,
        home: homeProfile,
        away: awayProfile
      });

      const learnedCornersDecision = cornerLearningApply(
        {
          ...game,
          engine_profiles: {
            home: homeProfile,
            away: awayProfile
          }
        },
        rawCornersDecision
      );

      const lockedCornersDecision = cornerPregameApplyLock(
        game,
        learnedCornersDecision
      );

      const corners_ai = futureMarketDecisionGate({
        date,
        game,
        market: "corners",
        decision: lockedCornersDecision,
        homeProfile,
        awayProfile,
        oddsInfo
      });

      cornerLearningRememberPrediction(
        game,
        corners_ai,
        date
      );

      const rawCardsDecision = cardsEngineDecision({
        game,
        home: homeProfile,
        away: awayProfile
      });

      const cards_ai = futureMarketDecisionGate({
        date,
        game,
        market: "cards",
        decision: rawCardsDecision,
        homeProfile,
        awayProfile,
        oddsInfo
      });

      return {
        ...game,
        goals_ai,
        btts_ai,
        corners_ai,
        cards_ai,
        handicap_ai,
        engine_profiles: {
          home: homeProfile,
          away: awayProfile
        }
      };
    }
  );


  const rank = (items, field) =>
    items
      .slice()
      .sort((a, b) => {
        const aiA = a?.[field] || {};
        const aiB = b?.[field] || {};

        const aUpdating = Boolean(aiA.updating);
        const bUpdating = Boolean(aiB.updating);

        if (aUpdating !== bUpdating) {
          return aUpdating ? 1 : -1;
        }

        if (Boolean(aiA.skip) !== Boolean(aiB.skip)) {
          return aiA.skip ? 1 : -1;
        }

        return Number(aiB.score || 0) -
          Number(aiA.score || 0);
      });

  await cornerLearningSettleFinishedGames(analyzed);

  let cornerEliteRanked = rankGamesByCornerStrength(
    rank(analyzed, "corners_ai")
  );

  const validCornerPicks = cornerEliteRanked.filter(
    game =>
      game?.corners_ai &&
      !game.corners_ai.skip
  );

  const over85Fallbacks = validCornerPicks.filter(game => {
    const ai = game.corners_ai;
    const source =
      ai?.calculation_source ??
      ai?.extra?.calculation_source ??
      "";

    return (
      ai?.line === "OVER 8.5" &&
      source !== "recent_form" &&
      Number(
        ai?.sample_games ??
        ai?.extra?.sample_games ??
        0
      ) < 3
    );
  });

  if (
    validCornerPicks.length >= 4 &&
    over85Fallbacks.length / validCornerPicks.length >= 0.55
  ) {
    cornerEliteRanked = cornerEliteRanked.map(game => {
      const ai = game?.corners_ai;
      if (!over85Fallbacks.includes(game)) return game;

      return {
        ...game,
        corners_ai: {
          ...ai,
          skip: true,
          updating: true,
          line: "DADOS EM ATUALIZAÇÃO",
          confidence: 0,
          score: 0,
          reason:
            "Over 8.5 bloqueado porque a API não entregou uma base individual suficiente para esta partida."
        }
      };
    });
  }

  const learningModel = loadCornerLearningModel();

  const payload = {
    date,
    generated_at: new Date().toISOString(),
    corner_learning: {
      version: learningModel.version,
      status: cornerLearningStatusText(),
      samples: learningModel.samples,
      greens: learningModel.greens,
      reds: learningModel.reds,
      accuracy:
        learningModel.samples > 0
          ? Number(
              (
                learningModel.greens /
                learningModel.samples *
                100
              ).toFixed(1)
            )
          : 0,
      projection_bias:
        Number(
          Number(
            learningModel.projection_bias || 0
          ).toFixed(3)
        ),
      updated_at: learningModel.updated_at
    },
    corners: cornerEliteRanked,
    goals: rank(analyzed, "goals_ai"),
    cards: rank(analyzed, "cards_ai"),
    btts: rank(analyzed, "btts_ai"),
    handicap: rank(analyzed, "handicap_ai")
  };

  // Persiste a última recomendação válida de cada jogo/mercado.
  // Se uma atualização futura ou ao vivo vier como "SEM APOSTA",
  // a recomendação anteriormente publicada permanece no card.
  return await mergeAndSaveMarketEngineSnapshot(date, payload);
}




app.get("/corner_pregame_locks", (req, res) => {
  const store = loadCornerPregameLockStore();

  return res.json({
    ok: true,
    version: store.version,
    total: Object.keys(store.locks || {}).length,
    locks: store.locks
  });
});

app.get("/official_corner_pick", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";
  const favoriteTeams = top1FavoriteSet(req.query.favorites || "[]");

  try {
    const out = await buildQuentesList({ date, fresh });
    const official = resolveOfficialCornerPick({
      date,
      games: rankGamesByCornerStrength(out),
      favoriteTeams
    });

    return res.json({
      ok: true,
      date,
      ...official
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Falha ao carregar a aposta oficial",
      details: String(error?.message || error)
    });
  }
});

app.get("/corner_learning_status", (req, res) => {
  const model = loadCornerLearningModel();

  return res.json({
    version: model.version,
    status: cornerLearningStatusText(),
    samples: model.samples,
    greens: model.greens,
    reds: model.reds,
    pushes: model.pushes,
    accuracy:
      model.samples > 0
        ? Number(
            (
              model.greens /
              model.samples *
              100
            ).toFixed(1)
          )
        : 0,
    projection_bias:
      Number(
        Number(model.projection_bias || 0).toFixed(3)
      ),
    confidence_bias:
      Number(
        Number(model.confidence_bias || 0).toFixed(3)
      ),
    feature_weights: model.feature_weights,
    line_bias: model.line_bias,
    learned_leagues: Object.keys(
      model.league_memory || {}
    ).length,
    learned_teams: Object.keys(
      model.team_memory || {}
    ).length,
    league_memory: model.league_memory,
    team_memory: model.team_memory,
    line_memory: model.line_memory,
    updated_at: model.updated_at
  });
});

app.get("/market_engines", async (req, res) => {
  const date = req.query.date || toISODate();

  try {
    const payload = await buildAllMarketEngines({ date });

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    return res.json(payload);
  } catch (err) {
    // Se a API ou um motor falhar temporariamente, não apaga as análises.
    const snapshot = await readMarketEngineSnapshot(date);

    if (snapshot) {
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );

      return res.json({
        ...snapshot,
        snapshot_fallback: true,
        snapshot_fallback_reason: String(err?.message || err)
      });
    }

    return res.status(500).json({
      error: "Erro ao calcular os motores dos mercados",
      details: String(err?.message || err)
    });
  }
});


app.get("/handicap_ai", async (req, res) => {
  const date = req.query.date || toISODate();

  try {
    const games = await buildHandicapGamesList({ date });

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    return res.json(games);
  } catch (err) {
    return res.status(500).json({
      error: "Erro ao calcular Handicap Asiático",
      details: String(err?.message || err)
    });
  }
});


app.get("/mercados", async (req, res) => {
  const date = req.query.date || toISODate();
  try {
    const games = await buildMarketGamesList({ date });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return res.json(games);
  } catch (err) {
    return res.status(500).json({
      error: "Erro ao buscar mercados do dia",
      details: String(err?.message || err)
    });
  }
});


// =========================================================
// MOBILE FAST PATH
// O carregador mobile envia o parâmetro "_mobile".
// Em vez de executar imediatamente todo o funil pesado de ligas,
// standings, H2H, odds e estatísticas, esta rota monta uma resposta
// inicial com uma única consulta de eventos do dia.
// =========================================================
const MOBILE_FAST_TIMEOUT_MS = Number(process.env.MOBILE_FAST_TIMEOUT_MS || 12000);

function withTimeout(promise, ms, label = "operação") {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function leagueMetaFromEvent(e) {
  const leagueId = Number(e?.league_id ?? e?.match_league_id ?? e?.leagueId ?? 0) || null;
  const known = LEAGUE_OVERRIDES.get(Number(leagueId));
  if (known) return known;

  return guessLeagueMeta({
    league_id: leagueId,
    league_name: e?.league_name ?? e?.match_league_name ?? e?.league ?? `Liga ${leagueId || ""}`,
    country_name: e?.country_name ?? e?.country ?? ""
  });
}

function mobileFastGameFromEvent(e) {
  const casa = teamFromEvent(e, "home");
  const fora = teamFromEvent(e, "away");
  const match_id = e?.match_id ?? e?.event_key ?? e?.id ?? null;
  if (!casa || !fora || !match_id) return null;

  const league = leagueMetaFromEvent(e);
  const hora = cleanText(e?.match_time ?? e?.time ?? e?.event_time ?? "—") || "—";
  const bigMatch = isBigTeam(casa) || isBigTeam(fora);
  const proj_cantos = projCornersHeuristic(league?.baseCorners ?? 9.6, bigMatch, null, null);
  const over95_prob = probFromProjection(proj_cantos);
  const lateralizacao = lateralizacaoIndex(
    casa,
    fora,
    league?.baseCorners ?? 9.6,
    proj_cantos
  );
  const perfil_laterais = perfilLaterais(lateralizacao);
  const adjusted = aplicarAntiRed({
    over95_prob,
    score: (league?.importance ?? 72) + Math.round((over95_prob - 50) * 0.6),
    perfil: perfil_laterais
  });

  return normalizeTeamsOnGame({
    mode: "semi",
    match_id,
    casa,
    fora,
    liga: league?.name || cleanText(e?.league_name) || "Liga",
    league_id: Number(league?.id ?? e?.league_id ?? 0) || null,
    hora,
    pos_home: null,
    pos_away: null,
    proj_cantos,
    over95_prob,
    over95_prob_adj: adjusted.over95_prob_adj,
    score: adjusted.score_adj,
    score_adj: adjusted.score_adj,
    perfil_laterais,
    lateralizacao_index: lateralizacao,
    nivel: nivelFromProb(adjusted.over95_prob_adj),
    sources: {
      event: true,
      h2h: false,
      stats: false,
      odds: false,
      mobile_fast: true
    },
    flags: ["mobile_fast_initial"],
    comment: commentLiteFrom({
      match_id,
      casa,
      fora,
      proj_cantos,
      over95_prob: adjusted.over95_prob_adj,
      bigMatch,
      perfil_laterais,
      leagueBase: league?.baseCorners
    })
  });
}

async function buildMobileFastList(date) {
  const cacheKey = `mobile-fast:${date}`;
  const cached = cacheGet(cacheKey);
  if (Array.isArray(cached)) return cached;

  const events = await withTimeout(
    apiGetAny({
      action: "get_events",
      from: date,
      to: date,
      timezone: API_TIMEZONE
    }),
    MOBILE_FAST_TIMEOUT_MS,
    "consulta rápida mobile"
  );

  const seen = new Set();
  const out = [];

  for (const e of Array.isArray(events) ? events : []) {
    const game = mobileFastGameFromEvent(e);
    if (!game) continue;

    const key = String(game.match_id || `${game.league_id}|${game.casa}|${game.fora}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(game);
  }

  const ranked = rankGamesByCornerStrength(out)
    .filter(game => String(game?.perfil_laterais || "") !== "TENDENCIA_CENTRAL")
    .slice(0, 30);

  cacheSet(cacheKey, ranked, 8 * 60 * 1000);
  return ranked;
}



// =========================================================
// DIAGNÓSTICO DE CARREGAMENTO — MOBILE V7
// Acesse /health e /debug-quentes?date=AAAA-MM-DD para testar o servidor.
// =========================================================
app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "Corner Pro",
    apiKeyConfigured: Boolean(APIKEY),
    time: new Date().toISOString()
  });
});

app.get("/debug-quentes", async (req, res) => {
  const date = req.query.date || toISODate();
  const startedAt = Date.now();

  try {
    const games = await buildMobileFastList(date);
    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      date,
      elapsedMs: Date.now() - startedAt,
      count: Array.isArray(games) ? games.length : 0,
      games: Array.isArray(games) ? games.slice(0, 5) : []
    });
  } catch (error) {
    console.error("[debug-quentes]", error);
    return res.status(500).json({
      ok: false,
      date,
      elapsedMs: Date.now() - startedAt,
      error: String(error?.message || error)
    });
  }
});

// ---------------- Endpoints ----------------
app.get("/quentes", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";
  const mobileFast = Object.prototype.hasOwnProperty.call(req.query, "_mobile")
    || String(req.query.mobile || "") === "1";

  const ai = String(req.query.ai || "") === "1" || (AI_DEFAULT_ON && String(req.query.ai || "") !== "0");
  const onlyTop = String(req.query.onlyTop || "") === "1";

  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  try {
    // O dashboard mobile precisa de resposta rápida para remover o skeleton.
    // A análise pesada continua disponível no desktop e nas demais rotas.
    if (mobileFast && !ai && !onlyTop) {
      try {
        const persisted = !fresh
          ? await withTimeout(readPersist(date), 2500, "cache mobile")
          : null;

        if (Array.isArray(persisted) && persisted.length) {
          return res.json(rankGamesByCornerStrength(
            sanitizeSelectionList(persisted).map(normalizeTeamsOnGame)
          ));
        }
      } catch (cacheError) {
        console.warn("Cache mobile indisponível:", cacheError?.message || cacheError);
      }

      const fastGames = await buildMobileFastList(date);
      return res.json(fastGames);
    }

    const out = await buildQuentesList({ date, fresh });

    const safeOut = rankGamesByCornerStrength(sanitizeSelectionList(out));

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
    let fallback = null;
    if (!fresh) {
      try {
        fallback = await withTimeout(readPersist(date), 2500, "fallback persistido");
      } catch {}
    }

    if (Array.isArray(fallback) && fallback.length) {
      return res.json(rankGamesByCornerStrength(
        sanitizeSelectionList(fallback).map(normalizeTeamsOnGame)
      ));
    }

    // Para o mobile, devolve lista vazia com HTTP 200. Assim o JS encerra
    // o estado de carregamento e mostra "sem jogos", em vez de skeleton infinito.
    if (mobileFast) {
      console.error("Falha no carregamento mobile:", err);
      return res.json([]);
    }

    return res.status(500).json({
      error: "Erro ao buscar jogos quentes",
      details: String(err?.message || err)
    });
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



let cornerPregameLockStore = null;
let cornerPregameLockWriteTimer = null;

function loadCornerPregameLockStore() {
  if (cornerPregameLockStore) return cornerPregameLockStore;

  try {
    if (fs.existsSync(CORNER_PREGAME_LOCK_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(CORNER_PREGAME_LOCK_FILE, "utf8")
      );

      const sameVersion =
        parsed?.version === CORNER_PREGAME_LOCK_VERSION;

      cornerPregameLockStore = {
        version: CORNER_PREGAME_LOCK_VERSION,

        // V3: locks antigos são descartados de propósito.
        // Assim uma linha UNDER gravada por uma versão anterior
        // não continua congelando o mercado de escanteios.
        locks:
          sameVersion &&
          parsed?.locks &&
          typeof parsed.locks === "object"
            ? parsed.locks
            : {}
      };

      return cornerPregameLockStore;
    }
  } catch (error) {
    console.warn(
      "[corner-pregame-lock] Falha ao carregar:",
      error?.message || error
    );
  }

  cornerPregameLockStore = {
    version: CORNER_PREGAME_LOCK_VERSION,
    locks: {}
  };

  return cornerPregameLockStore;
}

function saveCornerPregameLockStore() {
  if (cornerPregameLockWriteTimer) return;

  cornerPregameLockWriteTimer = setTimeout(() => {
    cornerPregameLockWriteTimer = null;

    try {
      const store = loadCornerPregameLockStore();
      const temporary = `${CORNER_PREGAME_LOCK_FILE}.tmp`;

      fs.writeFileSync(
        temporary,
        JSON.stringify(store, null, 2),
        "utf8"
      );

      fs.renameSync(temporary, CORNER_PREGAME_LOCK_FILE);
    } catch (error) {
      console.warn(
        "[corner-pregame-lock] Falha ao salvar:",
        error?.message || error
      );
    }
  }, 250);
}

function cornerPregameLockKey(game) {
  return String(
    game?.match_id ??
    game?.event_key ??
    game?.event_raw?.match_id ??
    `${game?.casa || ""}|${game?.fora || ""}|${game?.hora || game?.horario || ""}`
  );
}

function cornerPregameLockStatus(game) {
  return String(
    game?.match_status ??
    game?.status ??
    game?.event_raw?.match_status ??
    game?.event_raw?.status ??
    ""
  ).trim().toLowerCase();
}

function cornerPregameLockIsFinished(game) {
  const status = cornerPregameLockStatus(game);

  if (
    /finished|finish|ended|encerrado|full.?time|\bft\b|after|aet|penalties/.test(
      status
    )
  ) {
    return true;
  }

  const elapsed = Number(
    game?.elapsed ??
    game?.match_elapsed ??
    game?.event_raw?.match_elapsed
  );

  return Number.isFinite(elapsed) && elapsed >= 120;
}

function cornerPregameLockIsLive(game) {
  if (cornerPregameLockIsFinished(game)) return false;

  const status = cornerPregameLockStatus(game);

  const elapsedRaw =
    game?.elapsed ??
    game?.minute ??
    game?.match_minute ??
    game?.match_elapsed ??
    game?.event_raw?.match_elapsed ??
    game?.event_raw?.match_live ??
    "";

  const elapsed = Number(
    String(elapsedRaw).replace(/[^\d]/g, "")
  );

  return (
    (Number.isFinite(elapsed) && elapsed > 0) ||
    /live|ao vivo|halftime|intervalo|interval|half.?time|1st half|2nd half|[1-9]\d?['’]/.test(
      status
    )
  );
}

function cornerPregameLockSnapshot(game, decision) {
  return {
    id: cornerPregameLockKey(game),
    match_id:
      game?.match_id ??
      game?.event_key ??
      game?.event_raw?.match_id ??
      null,
    home: game?.casa || "",
    away: game?.fora || "",
    line: decision?.line || null,
    projection: Number(decision?.projection || 0),
    confidence: Number(decision?.confidence || 0),
    score: Number(decision?.score || 0),
    reason: decision?.reason || "",
    selected_at: new Date().toISOString(),
    source:
      decision?.calculation_source ??
      decision?.extra?.calculation_source ??
      "",
    sample_games: Number(
      decision?.sample_games ??
      decision?.extra?.sample_games ??
      0
    ),
    robust_under_evidence: Boolean(
      decision?.robust_under_evidence ??
      decision?.extra?.robust_under_evidence
    ),
    corner_engine_version:
      decision?.corner_engine_version ??
      decision?.extra?.corner_engine_version ??
      "corners-strict-v4-confidence-gate",
    lock_version: CORNER_PREGAME_LOCK_VERSION
  };
}

/*
 * Um UNDER só pode virar linha fixa quando veio do motor completo,
 * com amostra individual suficiente e evidência robusta.
 * Isso é EXCLUSIVO de Escanteios.
 */
function cornerPregameDecisionCanLock(decision) {
  if (!decision || decision.skip || decision.updating) return false;

  const line = String(decision.line || "").trim().toUpperCase();

  if (!/^(OVER|UNDER)\s+(8\.5|9\.5|10\.5|11\.5)$/.test(line)) {
    return false;
  }

  const source =
    decision?.calculation_source ??
    decision?.extra?.calculation_source ??
    "";

  const sampleGames = Number(
    decision?.sample_games ??
    decision?.extra?.sample_games ??
    0
  );

  const robustUnder = Boolean(
    decision?.robust_under_evidence ??
    decision?.extra?.robust_under_evidence
  );

  if (line.startsWith("UNDER")) {
    const projection = Number(decision?.projection);

    if (line === "UNDER 9.5") {
      return (
        source === "recent_form" &&
        sampleGames >= 5 &&
        robustUnder &&
        Number.isFinite(projection) &&
        projection <= 8.05 &&
        Number(decision.confidence || 0) >=
          MULTI_MARKET_ENGINE.MIN_CONFIDENCE
      );
    }

    return (
      source === "recent_form" &&
      sampleGames >= 5 &&
      robustUnder &&
      Number(decision.confidence || 0) >=
        MULTI_MARKET_ENGINE.MIN_CONFIDENCE
    );
  }

  // OVER pode ser travado com recent_form; fallback só é travado
  // se já houver confiança/projeção suficientemente claras.
  if (source === "recent_form") return sampleGames >= 3;

  return (
    Number(decision.confidence || 0) >= 66 &&
    Number(decision.projection || 0) >= 9.6
  );
}

function cornerPregameExistingLockIsValid(lock) {
  if (!lock?.line) return false;

  if (
    lock.lock_version &&
    lock.lock_version !== CORNER_PREGAME_LOCK_VERSION
  ) {
    return false;
  }

  const line = String(lock.line || "").trim().toUpperCase();

  if (line.startsWith("UNDER")) {
    const projection = Number(lock.projection);

    if (line === "UNDER 9.5") {
      return (
        lock.source === "recent_form" &&
        Number(lock.sample_games || 0) >= 5 &&
        Boolean(lock.robust_under_evidence) &&
        Number.isFinite(projection) &&
        projection <= 8.05 &&
        Number(lock.confidence || 0) >=
          MULTI_MARKET_ENGINE.MIN_CONFIDENCE
      );
    }

    return (
      lock.source === "recent_form" &&
      Number(lock.sample_games || 0) >= 5 &&
      Boolean(lock.robust_under_evidence) &&
      Number(lock.confidence || 0) >=
        MULTI_MARKET_ENGINE.MIN_CONFIDENCE
    );
  }

  return /^(OVER)\s+(8\.5|9\.5|10\.5|11\.5)$/.test(line);
}

function cornerPregameApplyLock(game, decision) {
  const store = loadCornerPregameLockStore();
  const key = cornerPregameLockKey(game);
  let existing = store.locks[key];
  const live = cornerPregameLockIsLive(game);
  const finished = cornerPregameLockIsFinished(game);

  // Remove imediatamente lock antigo/fraco do próprio jogo.
  if (existing && !cornerPregameExistingLockIsValid(existing)) {
    delete store.locks[key];
    saveCornerPregameLockStore();
    existing = null;
  }

  if ((live || finished) && existing?.line) {
    return {
      ...decision,
      line: existing.line,
      projection: existing.projection,
      confidence: existing.confidence,
      score: existing.score,
      reason:
        `${existing.reason} Recomendação pré-jogo preservada após o início da partida.`,
      skip: false,
      pregame_locked: true,
      pregame_locked_at: existing.selected_at
    };
  }

  if ((live || finished) && !existing?.line) {
    return {
      ...decision,
      skip: true,
      line: "SEM RECOMENDAÇÃO PRÉ-JOGO",
      confidence: 0,
      score: 0,
      pregame_missing: true,
      reason:
        "A partida começou antes de uma recomendação pré-jogo válida ser registrada."
    };
  }

  if (
    !live &&
    !finished &&
    decision &&
    cornerPregameDecisionCanLock(decision)
  ) {
    if (!existing?.line) {
      const snapshot = cornerPregameLockSnapshot(
        game,
        decision
      );

      store.locks[key] = snapshot;
      saveCornerPregameLockStore();

      return {
        ...decision,
        pregame_locked: true,
        pregame_locked_at: snapshot.selected_at
      };
    }

    return {
      ...decision,
      line: existing.line,
      projection: existing.projection,
      confidence: existing.confidence,
      score: existing.score,
      reason:
        `${existing.reason} Primeira recomendação pré-jogo mantida.`,
      skip: false,
      pregame_locked: true,
      pregame_locked_at: existing.selected_at
    };
  }

  return decision;
}


let officialCornerPickStore = null;
let officialCornerPickWriteTimer = null;

function loadOfficialCornerPickStore() {
  if (officialCornerPickStore) return officialCornerPickStore;

  try {
    if (fs.existsSync(OFFICIAL_CORNER_PICK_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(OFFICIAL_CORNER_PICK_FILE, "utf8")
      );

      officialCornerPickStore = {
        version: OFFICIAL_CORNER_PICK_VERSION,
        dates:
          parsed?.dates && typeof parsed.dates === "object"
            ? parsed.dates
            : {}
      };

      return officialCornerPickStore;
    }
  } catch (error) {
    console.warn(
      "[official-corner-pick] Falha ao carregar:",
      error?.message || error
    );
  }

  officialCornerPickStore = {
    version: OFFICIAL_CORNER_PICK_VERSION,
    dates: {}
  };

  return officialCornerPickStore;
}

function saveOfficialCornerPickStore() {
  if (officialCornerPickWriteTimer) return;

  officialCornerPickWriteTimer = setTimeout(() => {
    officialCornerPickWriteTimer = null;

    try {
      const store = loadOfficialCornerPickStore();
      const temporary = `${OFFICIAL_CORNER_PICK_FILE}.tmp`;

      fs.writeFileSync(
        temporary,
        JSON.stringify(store, null, 2),
        "utf8"
      );

      fs.renameSync(temporary, OFFICIAL_CORNER_PICK_FILE);
    } catch (error) {
      console.warn(
        "[official-corner-pick] Falha ao salvar:",
        error?.message || error
      );
    }
  }, 250);
}

function officialCornerGameId(game) {
  return String(
    game?.match_id ??
    game?.event_key ??
    game?.event_raw?.match_id ??
    `${game?.casa || ""}|${game?.fora || ""}|${game?.hora || game?.horario || ""}`
  );
}

function officialCornerStatus(game) {
  return String(
    game?.match_status ??
    game?.status ??
    game?.event_raw?.match_status ??
    game?.event_raw?.status ??
    ""
  ).trim().toLowerCase();
}

function officialCornerIsFinished(game) {
  const status = officialCornerStatus(game);

  if (
    /finished|finish|ended|encerrado|full.?time|\bft\b|after|aet|penalties/.test(
      status
    )
  ) {
    return true;
  }

  const elapsed = Number(
    game?.elapsed ??
    game?.match_elapsed ??
    game?.event_raw?.match_elapsed
  );

  return Number.isFinite(elapsed) && elapsed >= 120;
}

function officialCornerIsLive(game) {
  if (officialCornerIsFinished(game)) return false;

  const status = officialCornerStatus(game);

  return /live|ao vivo|halftime|intervalo|1st half|2nd half|[1-9]\d?['’]/.test(
    status
  );
}

function officialCornerKickoffMinutes(game) {
  const raw = String(
    game?.kickoff_manaus ??
    game?.hora_manaus ??
    game?.hora ??
    game?.horario ??
    game?.match_time ??
    ""
  );

  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function officialCornerCurrentMinutesManaus() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const hour = Number(
    parts.find(part => part.type === "hour")?.value
  );
  const minute = Number(
    parts.find(part => part.type === "minute")?.value
  );

  return hour * 60 + minute;
}

function officialCornerIsFuture(game, date) {
  if (officialCornerIsFinished(game) || officialCornerIsLive(game)) {
    return false;
  }

  const today = toISODate();
  if (date > today) return true;
  if (date < today) return false;

  const kickoff = officialCornerKickoffMinutes(game);
  if (!Number.isFinite(kickoff)) return true;

  return kickoff >= officialCornerCurrentMinutesManaus() - 2;
}


function officialCornerContext(game) {
  const raw = game?.event_raw || game?.raw || {};
  return {
    ...raw,
    match_round: game?.round_raw ?? raw?.match_round ?? raw?.round,
    round: game?.round_raw ?? raw?.round ?? raw?.match_round,
    league_round: raw?.league_round,
    stage: game?.stage_raw ?? raw?.stage ?? raw?.match_stage,
    match_stage: game?.stage_raw ?? raw?.match_stage ?? raw?.stage,
    event_round: raw?.event_round,
    match_name: raw?.match_name,
    match_type: game?.type_raw ?? raw?.match_type
  };
}

function officialCornerPremiumLeague(game) {
  const leagueId = Number(
    game?.league_id ??
    game?.event_raw?.league_id ??
    game?.event_raw?.match_league_id ??
    0
  );

  if (!TOP1_CORNER_PREMIUM_LEAGUES.has(leagueId)) return false;

  // Conference League fica fora do Top 1 premium. O mercado continua no app.
  if (leagueId === 683) return false;

  return true;
}

function officialCornerBlockedReturnLeg(game) {
  const leagueId = Number(
    game?.league_id ??
    game?.event_raw?.league_id ??
    game?.event_raw?.match_league_id ??
    0
  );

  if (!TOP1_CORNER_BLOCK_SECOND_LEG_UEFA.has(leagueId)) return false;

  const context = officialCornerContext(game);
  if (looksLikeGroupStage(context)) return false;

  // Trava dura: detectou jogo de volta UEFA, não concorre ao Top 1.
  return looksLikeSecondLeg(context);
}

function officialCornerFavoriteBonus(game, favoriteTeams) {
  if (!top1GameHasFavorite(game, favoriteTeams)) return 0;
  return TOP1_CORNER_FAVORITE_BONUS;
}

function officialCornerRank(games, favoriteTeams = new Set()) {
  return rankGamesByCornerStrength(games || [])
    .map(game => ({
      ...game,
      top1_favorite: top1GameHasFavorite(game, favoriteTeams),
      top1_score: Number(
        (
          Number(game?.corner_elite_score ?? -999) +
          officialCornerFavoriteBonus(game, favoriteTeams)
        ).toFixed(2)
      )
    }))
    .sort((a, b) => {
      const scoreDiff = Number(b?.top1_score ?? -999) - Number(a?.top1_score ?? -999);
      if (scoreDiff !== 0) return scoreDiff;
      return Number(b?.corner_elite_score ?? -999) - Number(a?.corner_elite_score ?? -999);
    });
}

function officialCornerIsStrong(game, date) {
  if (!game || !officialCornerIsFuture(game, date)) return false;
  if (!officialCornerPremiumLeague(game)) return false;
  if (officialCornerBlockedReturnLeg(game)) return false;

  const decision = game?.corners_ai || {};
  if (decision.skip || decision.updating) return false;

  const line = String(decision.line || '').toUpperCase().trim();

  // Top 1 não trabalha com 8.5. A menor linha aceita é Over 9.5.
  if (!['OVER 9.5', 'OVER 10.5', 'OVER 11.5'].includes(line)) return false;

  const confidence = Number(
    decision.confidence ??
    game?.over95_prob_adj ??
    game?.over95_prob ??
    0
  );

  const projection = Number(
    decision.projection ??
    game?.proj_cantos ??
    game?.projection ??
    0
  );

  const eliteScore = Number(
    game?.corner_elite_score ??
    cornerEliteScore(game)
  );

  const dataQuality = Number(
    decision?.data_quality ??
    decision?.extra?.data_quality ??
    0
  );

  const sampleGames = Number(
    decision?.sample_games ??
    decision?.extra?.sample_games ??
    0
  );

  const source = String(
    decision?.calculation_source ??
    decision?.extra?.calculation_source ??
    ''
  );

  const flags = Array.isArray(game?.flags) ? game.flags : [];
  const weakSource = source === 'fallback' || source === 'mobile_fast' || flags.includes('mobile_fast_initial');
  if (weakSource) return false;

  const dataApproved =
    dataQuality >= TOP1_CORNER_MIN_DATA_QUALITY ||
    sampleGames >= TOP1_CORNER_MIN_SAMPLE_GAMES ||
    (source === 'recent_form' && sampleGames >= 3);

  if (!dataApproved) return false;

  // A linha sobe junto com a exigência. Não basta projetar 9.7 e vender 10.5/11.5.
  const lineProjectionFloor =
    line === 'OVER 11.5' ? 12.35 :
    line === 'OVER 10.5' ? 11.35 :
    10.25;

  const lineConfidenceFloor =
    line === 'OVER 11.5' ? 74 :
    line === 'OVER 10.5' ? 71 :
    Math.max(68, OFFICIAL_CORNER_MIN_CONFIDENCE);

  const strongBase =
    confidence >= lineConfidenceFloor &&
    projection >= Math.max(OFFICIAL_CORNER_MIN_PROJECTION, lineProjectionFloor) &&
    eliteScore >= OFFICIAL_CORNER_MIN_ELITE_SCORE;

  return strongBase;
}

function officialCornerSnapshot(game) {
  return {
    id: officialCornerGameId(game),
    match_id: game?.match_id ?? game?.event_key ?? null,
    casa: game?.casa || "",
    fora: game?.fora || "",
    home_badge: game?.home_badge || null,
    away_badge: game?.away_badge || null,
    hora:
      game?.kickoff_manaus ??
      game?.hora_manaus ??
      game?.hora ??
      game?.horario ??
      "",
    liga: game?.liga || game?.league_name || "",
    league_id: game?.league_id ?? null,
    corners_ai: game?.corners_ai || null,
    corner_elite_score: Number(
      game?.corner_elite_score ??
      cornerEliteScore(game)
    ),
    selected_at: new Date().toISOString()
  };
}

function officialCornerFindCurrent(games, current) {
  if (!current) return null;

  return (games || []).find(
    game => officialCornerGameId(game) === current.id
  ) || null;
}

function resolveOfficialCornerPick({ date, games, favoriteTeams = new Set() }) {
  const store = loadOfficialCornerPickStore();
  const favoriteSignature = [...favoriteTeams].sort().join('|');
  const day =
    store.dates[date] ||
    {
      current: null,
      history: [],
      updated_at: null,
      favorite_signature: ''
    };

  let currentGame = officialCornerFindCurrent(games, day.current);

  // Depois de uma atualização de regras, uma fotografia antiga que hoje seria
  // reprovada (8.5, liga fraca, volta UEFA etc.) é descartada antes do kickoff.
  if (
    day.current &&
    currentGame &&
    !officialCornerIsFinished(currentGame) &&
    !officialCornerIsLive(currentGame) &&
    !officialCornerIsStrong(currentGame, date)
  ) {
    day.history = Array.isArray(day.history) ? day.history : [];
    day.history.push({
      ...day.current,
      invalidated_at: new Date().toISOString(),
      invalidated_reason: 'top1_premium_filter'
    });
    day.current = null;
    currentGame = null;
  }

  // Se os favoritos mudaram antes do jogo começar, a IA pode repensar o Top 1.
  // Isso NÃO acontece com partida ao vivo: ao vivo a indicação permanece travada.
  if (
    day.current &&
    currentGame &&
    !officialCornerIsLive(currentGame) &&
    !officialCornerIsFinished(currentGame) &&
    String(day.favorite_signature || '') !== favoriteSignature
  ) {
    day.current = null;
    currentGame = null;
  }

  // A seleção oficial permanece travada durante o jogo.
  if (day.current && currentGame && !officialCornerIsFinished(currentGame)) {
    return {
      game: currentGame,
      locked: true,
      selected_at: day.current.selected_at,
      no_more_opportunities: false,
      favorite_considered: Boolean(day.current.top1_favorite)
    };
  }

  // Se a API temporariamente não devolver a partida, preserva a fotografia
  // enquanto os favoritos do usuário não mudaram.
  if (
    day.current &&
    !currentGame &&
    String(day.favorite_signature || '') === favoriteSignature
  ) {
    return {
      game: day.current,
      locked: true,
      snapshot_only: true,
      selected_at: day.current.selected_at,
      no_more_opportunities: false,
      favorite_considered: Boolean(day.current.top1_favorite)
    };
  }

  // Somente após o encerramento a seleção é liberada.
  if (day.current && currentGame && officialCornerIsFinished(currentGame)) {
    day.history = Array.isArray(day.history) ? day.history : [];
    day.history.push({
      ...day.current,
      finished_at: new Date().toISOString(),
      final_status: officialCornerStatus(currentGame)
    });

    day.current = null;
  }

  const ranked = officialCornerRank(games || [], favoriteTeams);
  const next = ranked.find(game => officialCornerIsStrong(game, date));

  if (!next) {
    day.current = null;
    day.favorite_signature = favoriteSignature;
    day.updated_at = new Date().toISOString();
    store.dates[date] = day;
    saveOfficialCornerPickStore();

    return {
      game: null,
      locked: false,
      no_more_opportunities: true,
      favorite_considered: favoriteTeams.size > 0,
      message: 'A IA não encontrou um Top 1 de cantos suficientemente forte. Nenhuma entrada é melhor do que forçar um jogo fraco.'
    };
  }

  day.current = {
    ...officialCornerSnapshot(next),
    top1_favorite: Boolean(next.top1_favorite),
    top1_score: Number(next.top1_score ?? next.corner_elite_score ?? 0),
    favorite_signature: favoriteSignature,
    started_or_locked: false
  };
  day.favorite_signature = favoriteSignature;
  day.updated_at = new Date().toISOString();
  store.dates[date] = day;
  saveOfficialCornerPickStore();

  return {
    game: next,
    locked: true,
    selected_at: day.current.selected_at,
    no_more_opportunities: false,
    favorite_considered: Boolean(next.top1_favorite),
    top1_reason: next.top1_favorite
      ? 'Favorito analisado e aprovado pelos mesmos filtros premium.'
      : 'Melhor combinação de linha, projeção, confiança e qualidade de dados entre os jogos premium.'
  };
}


// ✅ IA Card (compat) — OPÇÃO A
app.get("/ia_card", async (req, res) => {
  const date = req.query.date || toISODate();
  const fresh = String(req.query.fresh || "") === "1";
  const favoriteTeams = top1FavoriteSet(req.query.favorites || "[]");

  try{
    const out = await buildQuentesList({ date, fresh });
    const top6 = await aiPickTop6(out, date);

    const rankedUniverse = rankGamesByCornerStrength(out);
    const official = resolveOfficialCornerPick({
      date,
      games: rankedUniverse,
      favoriteTeams
    });

    if (!official.game) {
      return res.json({
        ok: true,
        best: null,
        official_locked: false,
        no_more_opportunities: true,
        blockedCount: 0,
        sugestao: "Sem novas oportunidades",
        confianca: "—",
        why:
          official.message ||
          "A IA não encontrou mais jogos fortes de escanteios para hoje."
      });
    }

    const pack = await aiThinkBestPick(
      official.game,
      top6,
      date
    );

    res.json({
      ...pack,
      best: official.game,
      official_locked: true,
      official_selected_at: official.selected_at,
      official_snapshot_only: Boolean(
        official.snapshot_only
      ),
      no_more_opportunities: false
    });
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

function mcKickoffDate(event) {
  const date = cleanText(mcFirst(event, [
    "match_date", "date", "event_date", "fixture_date"
  ], ""));

  const time = cleanText(mcFirst(event, [
    "match_time", "time", "event_time", "fixture_time"
  ], ""));

  if (!date) return null;

  const normalizedTime = /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5) : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-04:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mcStatusInfo(event) {
  const statusFields = [
    "match_status", "status", "event_status", "fixture_status",
    "status_long", "status_short", "match_state", "state",
    "match_live", "match_minute", "minute", "elapsed",
    "time_live", "match_elapsed", "fixture_elapsed"
  ];

  const statusValues = statusFields
    .map(key => cleanText(event?.[key]))
    .filter(Boolean);

  const combinedStatus = statusValues.join(" | ");
  const s = combinedStatus.toLowerCase().trim();

  const minuteCandidates = statusValues
    .flatMap(value => String(value).match(/\d+/g) || [])
    .map(Number)
    .filter(Number.isFinite);

  const minute = minuteCandidates.length
    ? Math.max(...minuteCandidates)
    : null;

  const explicitFinished = [
    "finished", "match finished", "ft", "full time", "full-time",
    "after penalties", "after penalty", "aet", "after extra time",
    "penalties", "ended", "encerrado", "finalizado",
    "resultado final"
  ].some(value => s.includes(value));

  const has90Plus =
    /(^|\D)90\+?(\D|$)/.test(s) ||
    /(^|\D)90\s*min/.test(s);

  const cancelled = [
    "postponed", "cancelled", "canceled", "abandoned",
    "suspended", "interrupted", "adiado", "cancelado", "suspenso"
  ].some(value => s.includes(value));

  const explicitNotStarted = !s || [
    "not started", "ns", "scheduled", "time to be defined",
    "tbd", "aguardando", "pré-jogo", "pre-game", "pregame"
  ].some(value => s === value || s.includes(value));

  const explicitLive = [
    "live", "1st half", "first half", "2nd half", "second half",
    "half time", "halftime", "ht", "extra time", "break",
    "in progress", "in play", "playing", "ao vivo", "intervalo"
  ].some(value => s.includes(value));

  const kickoff = mcKickoffDate(event);
  const elapsedMinutes = kickoff
    ? Math.floor((Date.now() - kickoff.getTime()) / 60000)
    : null;

  /*
   * Regra de segurança:
   * - 90+ com mais de 110 minutos desde o início => encerrado.
   * - minuto >= 90 e mais de 125 minutos => encerrado.
   * - qualquer partida com mais de 195 minutos => encerrada.
   */
  const finishedByClock =
    !cancelled &&
    Number.isFinite(elapsedMinutes) &&
    (
      (has90Plus && elapsedMinutes >= 110) ||
      (Number.isFinite(minute) && minute >= 90 && elapsedMinutes >= 125) ||
      elapsedMinutes >= 195
    );

  const finished = explicitFinished || finishedByClock;

  const startedByClock =
    !cancelled &&
    Number.isFinite(elapsedMinutes) &&
    elapsedMinutes >= -5 &&
    elapsedMinutes < 195;

  const live = !finished && !cancelled && (
    explicitLive ||
    (Number.isFinite(minute) && minute > 0) ||
    (!explicitNotStarted && startedByClock)
  );

  const notStarted = !finished && !live && (
    explicitNotStarted ||
    (Number.isFinite(elapsedMinutes) && elapsedMinutes < 0)
  );

  const resolvedRaw = finished
    ? "Finished"
    : live
      ? (combinedStatus || "Live")
      : cancelled
        ? (combinedStatus || "Cancelled")
        : (combinedStatus || "Not Started");

  return {
    raw: resolvedRaw,
    original_raw: combinedStatus,
    finished,
    live,
    not_started: notStarted,
    cancelled,
    minute: finished
      ? 90
      : Number.isFinite(minute)
        ? minute
        : live && Number.isFinite(elapsedMinutes)
          ? Math.max(1, Math.min(120, elapsedMinutes))
          : null,
    elapsed_since_kickoff: Number.isFinite(elapsedMinutes) ? elapsedMinutes : null,
    inferred_by_clock: Boolean(finishedByClock),
    has_90_plus: has90Plus
  };
}

function mcAliasMatches(statKey, alias) {
  const key = normalizeStatType(statKey);
  const wanted = normalizeStatType(alias);
  if (!key || !wanted) return false;

  if (key === wanted) return true;
  if (key.includes(wanted) || wanted.includes(key)) return true;

  const keyTokens = new Set(key.split(" ").filter(Boolean));
  const aliasTokens = wanted.split(" ").filter(Boolean);
  return aliasTokens.length > 0 && aliasTokens.every(token => keyTokens.has(token));
}

function mcStatPair(statsMap, aliases) {
  if (!statsMap) return { home: null, away: null };

  for (const alias of aliases) {
    const row = statsMap.get(normalizeStatType(alias));
    if (row) return { home: mcNumber(row.home), away: mcNumber(row.away) };
  }

  for (const [key, row] of statsMap.entries()) {
    if (aliases.some(alias => mcAliasMatches(key, alias))) {
      return { home: mcNumber(row.home), away: mcNumber(row.away) };
    }
  }

  return { home: null, away: null };
}

function mcEventPair(event, homeKeys, awayKeys) {
  return {
    home: mcNumber(mcFirst(event, homeKeys, null)),
    away: mcNumber(mcFirst(event, awayKeys, null))
  };
}

function mcPreferPair(primary, fallback) {
  return {
    home: primary?.home ?? fallback?.home ?? null,
    away: primary?.away ?? fallback?.away ?? null
  };
}

function mcCountCards(event) {
  const result = { yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0, found: false };
  const homeName = normTeamKey(teamFromEvent(event, "home"));
  const awayName = normTeamKey(teamFromEvent(event, "away"));
  const cards = Array.isArray(event?.cards) ? event.cards : [];
  for (const card of cards) {
    const label = cleanText(mcFirst(card, ["card", "type", "info"], "")).toLowerCase();
    const team = normTeamKey(mcFirst(card, ["team", "team_name", "card_team"], ""));
    let side = cleanText(mcFirst(card, ["side", "team_side"], "")).toLowerCase();
    if (!side && team) {
      if (team === homeName) side = "home";
      else if (team === awayName) side = "away";
    }
    if (side !== "home" && side !== "away") continue;
    result.found = true;
    const isRed = label.includes("red") || label.includes("vermelho");
    if (side === "home") isRed ? result.redHome++ : result.yellowHome++;
    else isRed ? result.redAway++ : result.yellowAway++;
  }
  return result;
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

  const forceFresh = String(req.query.fresh || "") === "1";
  if (!forceFresh) {
    const stored = await readMatchCenterPersist(matchId);
    if (stored?.finished && matchCenterHasUsefulStats(stored)) {
      const { _firestore, ...storedPayload } = stored;
      return res.json({
        ...storedPayload,
        source: "firestore_finished",
        firestore_updated_at: _firestore?.updatedAt || null
      });
    }
  }

  try {
    let data = await apiGetFreshAny({ action: "get_events", match_id: matchId, timezone: API_TIMEZONE });
    let event = Array.isArray(data) ? data.find(e => String(e?.match_id ?? e?.event_key ?? e?.id ?? "") === String(matchId)) : null;
    if (!event && Array.isArray(data) && data.length === 1) event = data[0];

    // Algumas versões da API usam event_id em vez de match_id.
    if (!event) {
      data = await apiGetFreshAny({ action: "get_events", event_id: matchId, timezone: API_TIMEZONE });
      event = Array.isArray(data) ? data.find(e => String(e?.match_id ?? e?.event_key ?? e?.id ?? "") === String(matchId)) : null;
      if (!event && Array.isArray(data) && data.length === 1) event = data[0];
    }

    if (!event) return res.status(404).json({ error: "Partida não encontrada na API", match_id: matchId });

    const status = mcStatusInfo(event);
    const statsResult = await getMatchCenterStatsFresh(
      matchId,
      event,
      status.finished
    ).catch(() => ({
      map: null,
      periods: {},
      source: "error",
      rawShape: null
    }));
    const statsMap = statsResult.map;
    const statsPeriods = statsResult.periods;
    const statsSource = statsResult.source;
    const statsRawShape = statsResult.rawShape;

    // Usa primeiro o bloco de JOGO COMPLETO da rota get_statistics.
    // Os campos diretos de get_events ficam apenas como fallback.
    const cornersStats = mcStatPair(
      statsMap,
      ["corner kicks", "corner kick", "corners", "corners total", "total corners", "corner count", "escanteios", "tiros de canto"]
    );

    const cornersEvent = mcEventPair(
      event,
      [
        "match_hometeam_corner",
        "match_hometeam_corners",
        "match_hometeam_corner_count",
        "home_corners",
        "hometeam_corner"
      ],
      [
        "match_awayteam_corner",
        "match_awayteam_corners",
        "match_awayteam_corner_count",
        "away_corners",
        "awayteam_corner"
      ]
    );

    const statsHasCorners =
      cornersStats.home !== null && cornersStats.away !== null;
    const eventHasCorners =
      cornersEvent.home !== null && cornersEvent.away !== null;

    const corners = statsHasCorners
      ? cornersStats
      : eventHasCorners
        ? cornersEvent
        : { home: null, away: null };

    const cornersSource = statsHasCorners
      ? `${statsSource}_official`
      : eventHasCorners
        ? (status.finished ? "event_final_fallback" : "event_live_fallback")
        : "unavailable";
    const shots = mcPreferPair(
      mcStatPair(statsMap, ["shots total", "total shots", "shots", "goal attempts", "attempts", "total attempts", "shot attempts", "finalizacoes", "finalizacoes totais"]),
      mcEventPair(event,
        ["match_hometeam_shots", "match_hometeam_shots_total", "home_shots", "home_total_shots"],
        ["match_awayteam_shots", "match_awayteam_shots_total", "away_shots", "away_total_shots"])
    );
    const shotsOnTarget = mcPreferPair(
      mcStatPair(statsMap, ["shots on goal", "shots on target", "on target", "shots on goal total", "target shots", "finalizacoes no gol", "finalizacoes certas"]),
      mcEventPair(event,
        ["match_hometeam_shots_on_target", "home_shots_on_target"],
        ["match_awayteam_shots_on_target", "away_shots_on_target"])
    );
    const possession = mcPreferPair(
      mcStatPair(statsMap, ["ball possession", "possession", "possession percentage", "posse de bola", "posse"]),
      mcEventPair(event,
        ["match_hometeam_possession", "home_possession"],
        ["match_awayteam_possession", "away_possession"])
    );
    const dangerousAttacks = mcPreferPair(
      mcStatPair(statsMap, ["dangerous attacks", "dangerous attack", "danger attacks", "dangerous attacks total", "ataques perigosos"]),
      mcEventPair(event,
        ["match_hometeam_dangerous_attacks", "home_dangerous_attacks", "dangerous_attacks_home"],
        ["match_awayteam_dangerous_attacks", "away_dangerous_attacks", "dangerous_attacks_away"])
    );
    const attacks = mcPreferPair(
      mcStatPair(statsMap, ["attacks", "total attacks", "attack", "attacks total", "ataques"]),
      mcEventPair(event,
        ["match_hometeam_attacks", "home_attacks", "attacks_home"],
        ["match_awayteam_attacks", "away_attacks", "attacks_away"])
    );
    const passes = mcPreferPair(
      mcStatPair(statsMap, ["passes accurate", "accurate passes", "successful passes", "passes completed", "completed passes", "total passes", "passes", "passes certos"]),
      mcEventPair(event,
        ["match_hometeam_passes", "match_hometeam_passes_completed", "home_passes", "home_accurate_passes"],
        ["match_awayteam_passes", "match_awayteam_passes_completed", "away_passes", "away_accurate_passes"])
    );
    const fouls = mcPreferPair(
      mcStatPair(statsMap, ["fouls", "fouls committed", "total fouls", "foul", "faltas", "faltas cometidas"]),
      mcEventPair(event,
        ["match_hometeam_fouls", "home_fouls", "fouls_home"],
        ["match_awayteam_fouls", "away_fouls", "fouls_away"])
    );
    const yellowStats = mcStatPair(statsMap, ["yellow cards", "yellow card", "yellowcards", "bookings", "cartoes amarelos"]);
    const redStats = mcStatPair(statsMap, ["red cards", "red card", "redcards", "sendings off", "cartoes vermelhos"]);
    const countedCards = mcCountCards(event);
    const yellow = mcPreferPair(yellowStats, countedCards.found ? { home: countedCards.yellowHome, away: countedCards.yellowAway } : null);
    const red = mcPreferPair(redStats, countedCards.found ? { home: countedCards.redHome, away: countedCards.redAway } : null);

    const homeScore = mcNumber(mcFirst(event, ["match_hometeam_score", "home_score", "score_home"], 0)) ?? 0;
    const awayScore = mcNumber(mcFirst(event, ["match_awayteam_score", "away_score", "score_away"], 0)) ?? 0;

    const payload = {
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
      not_started: status.not_started,
      cancelled: status.cancelled,
      minute: status.minute,
      status_inferred_by_clock: status.inferred_by_clock,
      elapsed_since_kickoff: status.elapsed_since_kickoff,
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
      accurate_passes: passes,
      yellow_cards: { home: yellow.home, away: yellow.away },
      red_cards: { home: red.home, away: red.away },
      stats_available: Boolean(statsMap || eventHasCorners),
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

      home_score: homeScore,
      away_score: awayScore,
      score_home: homeScore,
      score_away: awayScore,

      home_corners: corners.home,
      away_corners: corners.away,
      corners_home: corners.home,
      corners_away: corners.away,

      home_cards: yellow.home,
      away_cards: yellow.away,
      cards_home: yellow.home,
      cards_away: yellow.away,

      home_yellow_cards: yellow.home,
      away_yellow_cards: yellow.away,
      home_red_cards: red.home,
      away_red_cards: red.away,

      home_shots: shots.home,
      away_shots: shots.away,
      shots_home: shots.home,
      shots_away: shots.away,

      home_shots_on_target: shotsOnTarget.home,
      away_shots_on_target: shotsOnTarget.away,
      shots_on_target_home: shotsOnTarget.home,
      shots_on_target_away: shotsOnTarget.away,

      home_possession: possession.home,
      away_possession: possession.away,
      possession_home: possession.home,
      possession_away: possession.away,

      home_attacks: attacks.home,
      away_attacks: attacks.away,
      home_dangerous_attacks: dangerousAttacks.home,
      away_dangerous_attacks: dangerousAttacks.away,
      home_passes: passes.home,
      away_passes: passes.away,
      home_fouls: fouls.home,
      away_fouls: fouls.away,

      statistics: {
        home: {
          corners: corners.home,
          cards: yellow.home,
          yellow_cards: yellow.home,
          red_cards: red.home,
          shots: shots.home,
          shots_on_target: shotsOnTarget.home,
          possession: possession.home,
          attacks: attacks.home,
          dangerous_attacks: dangerousAttacks.home,
          passes: passes.home,
          fouls: fouls.home
        },
        away: {
          corners: corners.away,
          cards: yellow.away,
          yellow_cards: yellow.away,
          red_cards: red.away,
          shots: shots.away,
          shots_on_target: shotsOnTarget.away,
          possession: possession.away,
          attacks: attacks.away,
          dangerous_attacks: dangerousAttacks.away,
          passes: passes.away,
          fouls: fouls.away
        }
      },

      events: mcNormalizeEvents(event),
      sources: {
        event: true,
        statistics: Boolean(statsMap),
        statistics_count: statsMap?.size || 0,
        statistics_keys: statsMap ? Array.from(statsMap.keys()) : [],
        statistics_periods: statsPeriods,
        statistics_source: statsSource,
        statistics_raw_shape: statsRawShape,
        corners_source: cornersSource,
        corners_statistics: cornersStats,
        corners_event_fallback: cornersEvent
      }
    };

    const persistedPayload = await writeMatchCenterPersist(matchId, payload);
    return res.json(persistedPayload);
  } catch (err) {
    const stored = await readMatchCenterPersist(matchId);
    if (stored) {
      const { _firestore, ...storedPayload } = stored;
      return res.json({
        ...storedPayload,
        source: "firestore_fallback",
        stale: true,
        firestore_updated_at: _firestore?.updatedAt || null
      });
    }

    return res.status(500).json({
      error: "Erro ao carregar Match Center",
      details: String(err?.message || err),
      match_id: matchId
    });
  }
});


app.get("/match_result", (req, res) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  params.set("fresh", "1");
  return res.redirect(307, `/match_center?${params.toString()}`);
});


app.get("/", (req, res) => res.send("Servidor rodando com API ⚽"));

// ---------------- Start ----------------
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);

  // Prepara automaticamente as análises do dia seguinte e as mantém
  // persistidas no Firestore antes da virada do dia.
  installMarketEnginePrewarm();
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