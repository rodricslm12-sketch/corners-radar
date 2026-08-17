/* =========================================================
   CORNER PRO MOBILE CONTROLLER V55 — INSTANT BTTS/HANDICAP
   Home mobile, carrossel automático, mercados e Match Center.
   ========================================================= */
   (() => {
    "use strict";
  
    if (window.__cpMobileControllerV9) return;
    window.__cpMobileControllerV9 = true;
    window.__cornerProMobileLoaderV6 = true;

    // V10 — autoridade única dos mercados mobile.
    // Bloqueia módulos antigos que reescreviam card e dados em paralelo.
    window.__cpMobileMarketCarouselV1 = true;
    window.__cpMobileDirectLoaderInstalled = true;
  
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const mobileMedia = window.matchMedia("(max-width: 980px)");
  
    const MARKET_ORDER = ["corners"];
    const AUTO_SLIDE_MS = 9000;
  
    const MARKET = {
      pregame: {
        label: "PRÉ-JOGO",
        title: "🏆 MELHOR OPORTUNIDADE PRÉ-JOGO",
        icon: "🏆",
        lines: ["RESULTADO FINAL", "DUPLA CHANCE", "CASA OU EMPATE", "FORA OU EMPATE", "EMPATE ANULA", "HANDICAP ASIÁTICO"]
      },
      corners: {
        label: "ESCANTEIOS",
        title: "⚑ ANÁLISE DE ESCANTEIOS",
        icon: "⚑",
        lines: ["IA", "OVER 8.5", "OVER 9.5", "OVER 10.5", "OVER 11.5", "UNDER 9.5", "1ºT OVER 4.5"]
      },
      goals: {
        label: "GOLS",
        title: "⚽ ANÁLISE DE GOLS",
        icon: "⚽",
        lines: ["IA", "OVER 1.5", "OVER 2.5", "OVER 3.5", "UNDER 2.5", "UNDER 3.5"]
      },
      btts: {
        label: "AMBAS MARCAM",
        title: "◎ MELHOR APOSTA — AMBAS MARCAM",
        icon: "◎",
        lines: ["IA", "TODOS", "SIM", "NÃO"]
      },
      handicap: {
        label: "HANDICAP ASIÁTICO",
        title: "⚖ HANDICAP ASIÁTICO",
        icon: "⚖",
        lines: ["IA", "-2.0", "-1.5", "-1.0", "-0.5", "0.0", "+0.5", "+1.0", "+1.5", "+2.0"]
      },
      cards: {
        label: "CARTÕES",
        title: "▯ ANÁLISE DE CARTÕES",
        icon: "▯",
        lines: ["IA", "OVER 2.5", "OVER 3.5", "OVER 4.5", "OVER 5.5", "UNDER 4.5", "CASA 1.5+", "FORA 1.5+"]
      },
      combined: {
        label: "COMBINADAS",
        title: "▦ MELHOR APOSTA COMBINADA",
        icon: "▦",
        lines: ["CASA + OVER 1.5", "FORA + OVER 1.5", "AMBAS + OVER 2.5", "GOL + ESCANTEIOS", "DUPLA CHANCE + GOLS", "CANTOS + CARTÕES"]
      },
      props: {
        label: "PLAYER PROPS",
        title: "♞ MELHOR ESTATÍSTICA DE JOGADOR",
        icon: "♞",
        lines: ["JOGADOR MARCA", "CHUTES NO GOL", "TOTAL DE CHUTES", "PASSES", "DESARMES", "ASSISTÊNCIA"]
      }
    };
  
    const state = {
      date: "",
      all: [],
      corners: [],
      goals: [],
      btts: [],
      handicap: [],
      cards: [],
      pregame: [],
      combined: [],
      props: [],
      activeMarket: "corners",
      selected: null,
      autoTimer: null,
      matchPollTimer: null,
      touchStartX: 0,
      touchStartY: 0,
      loading: false,
      engineDate: "",
      officialCornerLoading: false,
      officialCornerNoOpportunity: false,
      officialCornerReason: "",
      officialCornerBest: null
    };
  
    function clean(value, fallback = "") {
      const text = String(value ?? "").trim();
      return text && !["undefined", "null", "NaN"].includes(text) ? text : fallback;
    }
  
    function numberFrom(...values) {
      for (const value of values) {
        const number = Number(String(value ?? "").replace("%", "").replace(",", "."));
        if (Number.isFinite(number)) return number;
      }
      return null;
    }
  
    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  
    function todayManaus() {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Manaus",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).formatToParts(new Date());
        const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${map.year}-${map.month}-${map.day}`;
      } catch {
        return new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
      }
    }
  
    function extract(payload, seen = new Set()) {
      if (Array.isArray(payload)) {
        return payload.filter(item => item && typeof item === "object");
      }

      if (!payload || typeof payload !== "object") return [];
      if (seen.has(payload)) return [];
      seen.add(payload);

      const preferredKeys = [
        "games", "jogos", "matches", "data", "items", "list",
        "results", "top", "top6", "quentes", "mercados",
        "recommendations", "opportunities"
      ];

      for (const key of preferredKeys) {
        const value = payload[key];

        if (Array.isArray(value) && value.length) {
          return value.filter(item => item && typeof item === "object");
        }

        if (value && typeof value === "object") {
          const nested = extract(value, seen);
          if (nested.length) return nested;
        }
      }

      // Último fallback: percorre qualquer ramo do JSON.
      for (const value of Object.values(payload)) {
        if (!value || typeof value !== "object") continue;

        if (Array.isArray(value) && value.some(item => item && typeof item === "object")) {
          return value.filter(item => item && typeof item === "object");
        }

        const nested = extract(value, seen);
        if (nested.length) return nested;
      }

      return [];
    }
  
    async function getJson(url, timeoutMs = 9000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("A rota não devolveu JSON válido.");
        }
      } finally {
        clearTimeout(timer);
      }
    }
  
    function team(game, side) {
      if (side === "home") return clean(game?.casa ?? game?.home ?? game?.home_name ?? game?.mandante, "Casa");
      return clean(game?.fora ?? game?.away ?? game?.away_name ?? game?.visitante, "Fora");
    }
  
    function gameTime(game) {
      const value = clean(game?.hora_manaus ?? game?.hora ?? game?.match_time ?? game?.time, "--:--");
      const match = value.match(/(\d{1,2}):(\d{2})/);
      return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "--:--";
    }
  
    const ENGINE_DECISION_FIELD = Object.freeze({
      corners: "corners_ai",
      goals: "goals_ai",
      cards: "cards_ai",
      btts: "btts_ai",
      handicap: "handicap_ai"
    });

    function ownMarketDecision(game, type) {
      const field = ENGINE_DECISION_FIELD[type];
      if (!field) return null;
      const decision = game?.[field];
      return decision && typeof decision === "object" ? decision : null;
    }

    function confidence(game, type) {
      const decision = ownMarketDecision(game, type);

      // IA: confiança vem apenas do próprio mercado.
      if (decision) {
        if (Boolean(decision.skip) || Boolean(decision.updating)) return 0;

        let value = numberFrom(decision.confidence);
        if (value === null) return 0;
        if (value > 0 && value <= 1) value *= 100;
        while (value > 100) value /= 10;

        return Math.max(0, Math.min(95, Math.round(value)));
      }

      // Mercados genéricos fora dos cinco motores.
      let value = null;

      if (type === "pregame") {
        value = numberFrom(
          game?.pregame?.confidence,
          game?.winner_confidence,
          game?.confidence,
          game?.ai_score
        );
      } else if (type === "combined") {
        value = numberFrom(
          game?.combined?.confidence,
          game?.confidence,
          game?.ai_score
        );
      } else if (type === "props") {
        value = numberFrom(
          game?.props?.confidence,
          game?.confidence,
          game?.ai_score
        );
      }

      if (value === null) return 0;
      if (value > 0 && value <= 1) value *= 100;
      while (value > 100) value /= 10;

      return Math.max(0, Math.min(95, Math.round(value)));
    }

    function line(game, type) {
      const decision = ownMarketDecision(game, type);

      // A linha exibida vem exclusivamente do motor correspondente.
      if (decision) {
        return clean(
          decision.line,
          decision.updating ? "DADOS EM ATUALIZAÇÃO" : "SEM APOSTA"
        ).toUpperCase();
      }

      // Não fabrica linha de outro mercado quando o motor ainda não respondeu.
      if (ENGINE_DECISION_FIELD[type]) {
        return "DADOS EM ATUALIZAÇÃO";
      }

      if (type === "pregame") {
        return clean(
          game?.pregame?.line ?? game?.best_market ?? game?.winner_market,
          "DUPLA CHANCE"
        ).toUpperCase();
      }

      if (type === "combined") {
        return clean(
          game?.combined?.line ?? game?.combo_line,
          "CASA + OVER 1.5"
        ).toUpperCase();
      }

      if (type === "props") {
        return clean(
          game?.props?.line ?? game?.player_prop_line,
          "CHUTES NO GOL"
        ).toUpperCase();
      }

      return "SEM APOSTA";
    }

    function normalize(game, type, index) {
      const home = team(game, "home");
      const away = team(game, "away");
      return {
        raw: game,
        id: clean(
          game?.match_id ??
          game?.event_id ??
          game?.event_key ??
          game?.fixture_id ??
          game?.id ??
          game?.event_raw?.match_id ??
          game?.event_raw?.event_id ??
          game?.event_raw?.event_key ??
          game?.event_raw?.id,
          `${home}|${away}|${index}`
        ),
        match_id: clean(
          game?.match_id ??
          game?.event_id ??
          game?.event_key ??
          game?.fixture_id ??
          game?.id ??
          game?.event_raw?.match_id ??
          game?.event_raw?.event_id ??
          game?.event_raw?.event_key ??
          game?.event_raw?.id,
          ""
        ),
        date: clean(
          game?.match_date ??
          game?.event_date ??
          game?.date ??
          game?.event_raw?.match_date ??
          game?.event_raw?.event_date ??
          game?.event_raw?.date,
          ""
        ),
        home,
        away,
        time: gameTime(game),
        confidence: confidence(game, type),
        line: line(game, type),
        type,
        status: clean(game?.status ?? game?.match_status ?? game?.event_status, "Pré-jogo")
      };
    }
  
    function buildMarket(raw, type) {
      const seen = new Set();
  
      return raw
        .map((game, index) => normalize(game, type, index))
        .filter(game => {
          if (seen.has(game.id)) return false;
          seen.add(game.id);
          return true;
        })
        .sort((a, b) => {
          if (type === "corners") {
            const eliteA = Number(
              a?.raw?.corner_elite_score ??
              a?.raw?.corners_ai?.score ??
              0
            );
  
            const eliteB = Number(
              b?.raw?.corner_elite_score ??
              b?.raw?.corners_ai?.score ??
              0
            );
  
            if (eliteB !== eliteA) return eliteB - eliteA;
  
            const projectionA = Number(
              a?.raw?.corners_ai?.projection ??
              a?.raw?.proj_cantos ??
              0
            );
  
            const projectionB = Number(
              b?.raw?.corners_ai?.projection ??
              b?.raw?.proj_cantos ??
              0
            );
  
            if (projectionB !== projectionA) {
              return projectionB - projectionA;
            }
          }
  
          return (
            b.confidence - a.confidence ||
            a.time.localeCompare(b.time)
          );
        });
    }
  
    function activeList() {
      const direct = state[state.activeMarket];
      if (Array.isArray(direct) && direct.length) return direct;

      // V32 — enquanto a IA específica ainda carrega,
      // a Home usa os jogos-base do dia em vez de ficar vazia.
      if (Array.isArray(state.pregame) && state.pregame.length) {
        return state.pregame.map((game, index) => {
          const raw = game.raw || game;
          const normalized = normalize(raw, state.activeMarket, index);

          // Top 1 de cantos não fabrica linha ou confiança enquanto a IA pesada
          // ainda não aprovou uma oportunidade real.
          if (state.activeMarket === "corners") {
            normalized.line = normalized.line === "DADOS EM ATUALIZAÇÃO"
              ? "DADOS EM ATUALIZAÇÃO"
              : normalized.line;
            normalized.confidence = Number(normalized.confidence || 0);
          }

          return normalized;
        });
      }

      return [];
    }
  
    function cpBestTeamColor(teamName, fallback = "#5f7f91") {
      const name = String(teamName || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
  
      const known = [
        [["fredrikstad"], "#d8b323"],
        [["sandefjord"], "#2378d6"],
        [["hacken", "bk hacken"], "#d2aa27"],
        [["kalmar"], "#1769d2"],
        [["piast gliwice"], "#286eb8"],
        [["wisla"], "#cf2f3b"],
        [["falkirk"], "#3150a3"],
        [["st mirren", "st. mirren"], "#d23542"],
        [["arsenal"], "#df2d36"],
        [["chelsea"], "#1f5fc1"],
        [["liverpool"], "#c92834"],
        [["manchester city"], "#68b6e6"],
        [["manchester united"], "#d52c34"],
        [["real madrid"], "#dddfe5"],
        [["barcelona"], "#24539b"],
        [["inter"], "#2470ca"],
        [["milan"], "#cb3039"],
        [["juventus"], "#d9dde1"],
        [["palmeiras"], "#16804a"],
        [["flamengo"], "#cf2e37"],
        [["corinthians"], "#d8dbdd"]
      ];
  
      for (const [keys, color] of known) {
        if (keys.some(key => name.includes(key))) return color;
      }
  
      const palette = ["#3d7fbd", "#b3525e", "#3e8c72", "#a87838", "#6b5bb1", "#397c91"];
      let hash = 0;
      for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      return name ? palette[Math.abs(hash) % palette.length] : fallback;
    }
  
    function cpBestMarketLabel(marketType, game) {
      const type = String(marketType || "").toLowerCase();
  
      if (type === "corners" || type === "escanteios") return "ESCANTEIOS";
      if (type === "goals" || type === "gols") return "GOLS";
      if (type === "cards" || type === "cartões" || type === "cartoes") return "CARTÕES";
      if (type === "btts") return "AMBAS MARCAM";
  
      const raw = String(game?.market || game?.line || "").toUpperCase();
  
      if (/CANTO|ESCANTEIO|CORNER/.test(raw)) return "ESCANTEIOS";
      if (/CART|YELLOW|RED/.test(raw)) return "CARTÕES";
      if (/GOL|GOAL|OVER|UNDER|AMBAS/.test(raw)) return "GOLS";
  
      return "MELHOR APOSTA DO DIA";
    }
  
    function cpUpdateBestMarketTitle(card, game, marketType) {
      if (!card) return;
  
      const title =
        card.querySelector("#cpHomeBestLabel") ||
        card.querySelector(".cpHomeBestTop > b") ||
        card.querySelector("[data-clone-id='cpHomeBestLabel']");
  
      if (!title) return;
  
      const label = cpBestMarketLabel(marketType, game);
      title.textContent = `🔥 MELHOR APOSTA • ${label}`;
      title.setAttribute("data-market-label", label);
    }
  
    function cpPaintBestTeamColors(card, game) {
      if (!card || !game) return;
  
      const homeColor = cpBestTeamColor(game.home, "#d8b323");
      const awayColor = cpBestTeamColor(game.away, "#2378d6");
  
      card.style.setProperty("--best-home", homeColor);
      card.style.setProperty("--best-away", awayColor);
      card.dataset.homeTeam = String(game.home || "");
      card.dataset.awayTeam = String(game.away || "");
  
      const homeEl = card.querySelector("#cpHomeBestHome, [data-clone-id='cpHomeBestHome']");
      const awayEl = card.querySelector("#cpHomeBestAway, [data-clone-id='cpHomeBestAway']");
  
      const initials = (name) => String(name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
  
      const teams = card.querySelector(".cpHomeBestTeams");
      if (teams) {
        teams.classList.add("cpBestTeamsProfessional");
  
        let homeBadge = teams.querySelector(".cpBestTeamBadge.home");
        let awayBadge = teams.querySelector(".cpBestTeamBadge.away");
  
        if (!homeBadge) {
          homeBadge = document.createElement("span");
          homeBadge.className = "cpBestTeamBadge home";
          teams.insertBefore(homeBadge, homeEl || teams.firstChild);
        }
  
        if (!awayBadge) {
          awayBadge = document.createElement("span");
          awayBadge.className = "cpBestTeamBadge away";
          if (awayEl) teams.insertBefore(awayBadge, awayEl);
          else teams.appendChild(awayBadge);
        }
  
        homeBadge.textContent = initials(game.home);
        awayBadge.textContent = initials(game.away);
        homeBadge.style.setProperty("--team-accent", homeColor);
        awayBadge.style.setProperty("--team-accent", awayColor);
      }
  
      if (homeEl) homeEl.style.setProperty("--team-accent", homeColor);
      if (awayEl) awayEl.style.setProperty("--team-accent", awayColor);
  
      cpUpdateBestMarketTitle(card, game, state.activeMarket);
    }
  
    window.__cpPaintBestTeamColors = cpPaintBestTeamColors;
  
    // V38 — depois que o primeiro jogo apareceu, o loader visual da Home
    // nunca mais pode voltar por causa de refresh/retry em background.
    let cprHomeVisualReady = false;

    function setLoading(active) {
      state.loading = active;

      const card = $("#cpHomeBest");
      if (card) {
        card.classList.toggle("is-loading-initial", active && !cprHomeVisualReady);
        card.setAttribute(
          "aria-busy",
          active && !cprHomeVisualReady ? "true" : "false"
        );
      }

      const loading = $("#cpHomeInitialLoading");
      if (loading) loading.hidden = !(active && !cprHomeVisualReady);

      const refLoading = $("#cprLoading");
      if (refLoading) {
        // O loader da Home é one-shot: só existe antes do primeiro jogo.
        refLoading.hidden = !(active && !cprHomeVisualReady);
      }
    }

    function showEmpty(title, subtitle) {
      setLoading(false);
      const games = $("#cpHomeGames");
      if (games) {
        games.innerHTML = `<div class="cpHomeEmptyState"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div>`;
      }
      const next = $("#cpHomeLastGames");
      if (next) next.innerHTML = "";
      const open = $("#cpHomeBestOpen");
      if (open) open.disabled = true;
    }
  
    function updateDots() {
      $$("[data-cp-home-dot]").forEach(button => {
        const active = button.dataset.cpHomeDot === state.activeMarket;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "true" : "false");
      });
    }
  
    function animateCard(direction = 1) {
      const card = $("#cpHomeBest");
      if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      card.animate(
        [
          { opacity: 0.4, transform: `translateX(${direction * 18}px) scale(.985)` },
          { opacity: 1, transform: "translateX(0) scale(1)" }
        ],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    }
  

    function cpRefNum(...values) {
      for (const value of values) {
        if (value === null || value === undefined) continue;

        const text = String(value).trim();
        if (!text) continue;

        const n = Number(text.replace(",", ".").replace("%", ""));
        if (Number.isFinite(n)) return n;
      }
      return null;
    }

    function cpRefBadgeUrl(game, side) {
      const raw = game?.raw || game || {};
      const home = side === "home";
      const values = home
        ? [
            raw.home_badge, raw.team_home_badge, raw.home_team_badge,
            raw.home_logo, raw.home_team_logo, raw.hometeam_logo,
            raw.event_raw?.team_home_badge, raw.event_raw?.home_badge,
            raw.event_raw?.home_team_logo
          ]
        : [
            raw.away_badge, raw.team_away_badge, raw.away_team_badge,
            raw.away_logo, raw.away_team_logo, raw.awayteam_logo,
            raw.event_raw?.team_away_badge, raw.event_raw?.away_badge,
            raw.event_raw?.away_team_logo
          ];
      return clean(values.find(v => /^https?:\/\//i.test(String(v || ""))) || "", "");
    }

    function cpRefInitials(name) {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "--").slice(0,2)).toUpperCase();
    }

    function cpRefSetShield(game, side) {
      const name = side === "home" ? game.home : game.away;
      const img = $(side === "home" ? "#cpHomeBestHomeBadge" : "#cpHomeBestAwayBadge");
      const fallback = $(side === "home" ? "#cpHomeBestHomeFallback" : "#cpHomeBestAwayFallback");
      const url = cpRefBadgeUrl(game, side);
      if (fallback) fallback.textContent = cpRefInitials(name);
      if (!img) return;
      if (!url) {
        img.hidden = true;
        if (fallback) fallback.hidden = false;
        return;
      }
      img.onload = () => { img.hidden = false; if (fallback) fallback.hidden = true; };
      img.onerror = () => { img.hidden = true; if (fallback) fallback.hidden = false; };
      img.src = url;
    }

    function cpRefProjection(game) {
      const raw = game?.raw || {};
      if (state.activeMarket === "goals") {
        return cpRefNum(
          raw.goals_ai?.projection, raw.goal_projection, raw.projected_goals,
          raw.goals_projection, raw.avg_goals, raw.goal_avg
        );
      }
      if (state.activeMarket === "cards") {
        return cpRefNum(raw.cards_ai?.projection, raw.card_projection, raw.projected_cards, raw.avg_cards);
      }
      return cpRefNum(raw.corners_ai?.projection, raw.proj_cantos, raw.projected_corners);
    }

    function cpRefGoalsAverage(game) {
      const raw = game?.raw || {};
      return cpRefNum(
        raw.goals_avg, raw.avg_goals, raw.goal_avg, raw.goals_average,
        raw.real?.goalsAvg, raw.stats?.goals_avg
      );
    }

    function cpRefCornersAverage(game) {
      const raw = game?.raw || {};
      return cpRefNum(
        raw.corners_ai?.projection, raw.proj_cantos, raw.projected_corners,
        raw.real?.recentCombinedAvg
      );
    }

    function cprCornerTop1DecisionReady(game) {
      if (state.activeMarket !== "corners") return true;

      const raw = game?.raw || game || {};
      const decision = raw?.corners_ai;

      if (!decision || typeof decision !== "object") return false;
      if (decision.skip || decision.updating) return false;

      const line = String(decision.line || "").toUpperCase().trim();
      if (!["OVER 9.5", "OVER 10.5", "OVER 11.5"].includes(line)) return false;

      const conf = cpRefNum(decision.confidence);
      const proj = cpRefNum(
        decision.projection,
        raw.proj_cantos,
        raw.projected_corners
      );

      return (
        conf !== null &&
        conf > 0 &&
        proj !== null &&
        proj > 0
      );
    }

    function cpRefUpdateHero(game) {
      cpRefSetShield(game, "home");
      cpRefSetShield(game, "away");

      const projection = cpRefProjection(game);
      const corners = cpRefCornersAverage(game);
      const goals = cpRefGoalsAverage(game);
      const confidenceValue = Math.max(0, Math.min(95, Number(game.confidence || 0)));

      const projectionLabel = $("#cpRefProjectionLabel");
      const projectionEl = $("#cpRefProjection");
      const cornersEl = $("#cpRefCornersAvg");
      const goalsEl = $("#cpRefGoalsAvg");
      const trendEl = $("#cpRefTrend");
      const gauge = $("#cpRefGauge");
      const confidenceLabel = $("#cpRefConfidenceLabel");
      const dayLabel = $("#cpHomeBestDayLabel");

      if (projectionLabel) {
        projectionLabel.textContent = state.activeMarket === "goals"
          ? "PROJEÇÃO DE GOLS"
          : state.activeMarket === "cards"
            ? "PROJEÇÃO DE CARTÕES"
            : "PROJEÇÃO DE CANTOS";
      }
      if (projectionEl) projectionEl.textContent = projection === null ? "—" : projection.toFixed(2).replace(/\.00$/, "");
      if (cornersEl) cornersEl.textContent = corners === null ? "—" : corners.toFixed(1);
      if (goalsEl) goalsEl.textContent = goals === null ? "—" : goals.toFixed(1);

      const cornerReady = cprCornerTop1DecisionReady(game);
      const waitingTop1 =
        state.activeMarket === "corners" &&
        (!cornerReady || state.officialCornerLoading);

      const trend = waitingTop1
        ? "ANALISANDO"
        : confidenceValue >= 72
          ? "ALTA"
          : confidenceValue >= 62
            ? "MÉDIA"
            : "CAUTELA";

      if (waitingTop1) {
        if (projectionEl) projectionEl.textContent = "—";
        if (cornersEl) cornersEl.textContent = "—";
        if (goalsEl && goals === null) goalsEl.textContent = "—";
      }

      if (trendEl) {
        trendEl.textContent = waitingTop1 ? "💭 ANALISANDO" : `↗ ${trend}`;
      }

      if (confidenceLabel) confidenceLabel.textContent = trend;
      if (gauge) {
        gauge.style.setProperty(
          "--ref-confidence",
          waitingTop1 ? 0 : confidenceValue
        );
      }

      if (dayLabel) {
        const today = todayManaus();
        dayLabel.textContent = state.date === today ? "HOJE" : state.date.split("-").reverse().slice(0,2).join("/");
      }
    }



    const CPR_FAVORITES_KEY = "cornerProFavoriteTeams:v2";

    function cprNormalizeTeamKey(name) {
      return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function cprReadFavorites() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CPR_FAVORITES_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }

    function cprWriteFavorites(items) {
      try {
        localStorage.setItem(CPR_FAVORITES_KEY, JSON.stringify(items));
      } catch {}
    }

    function cprIsFavorite(name) {
      const key = cprNormalizeTeamKey(name);
      if (!key) return false;
      return cprReadFavorites().some(item => cprNormalizeTeamKey(item) === key);
    }

    function cprToggleFavorite(name) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return false;

      const key = cprNormalizeTeamKey(cleanName);
      const favorites = cprReadFavorites();
      const index = favorites.findIndex(item => cprNormalizeTeamKey(item) === key);

      if (index >= 0) {
        favorites.splice(index, 1);
        cprWriteFavorites(favorites);
        return false;
      }

      favorites.push(cleanName);
      cprWriteFavorites(favorites);
      return true;
    }

    function cprMarketFavoriteStar(teamName) {
      const name = String(teamName || "").trim();
      if (!name || !cprIsFavorite(name)) return "";
      return `<span class="cpMarketFavoriteStar" title="Time favorito" aria-label="Time favorito">★</span>`;
    }

    function cprEnsureMatchCenterFavoriteStyles() {
      if (document.getElementById("cprMatchCenterFavoriteStyles")) return;

      const style = document.createElement("style");
      style.id = "cprMatchCenterFavoriteStyles";
      style.textContent = `
        .cpV8MatchHero .cpV8HomeTeam,
        .cpV8MatchHero .cpV8AwayTeam{
          display:flex;
          align-items:center;
          gap:8px;
          min-width:0;
        }

        .cpV8MatchHero .cpV8HomeTeam{ justify-content:flex-start; }
        .cpV8MatchHero .cpV8AwayTeam{ justify-content:flex-end; }

        .cpV8MatchHero .cpMatchTeamName{
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .cpV8MatchHero .cpMatchTeamFav{
          appearance:none;
          -webkit-appearance:none;
          width:34px;
          height:34px;
          min-width:34px;
          border-radius:50%;
          border:1px solid rgba(150,170,180,.45);
          background:rgba(5,15,20,.58);
          color:#b9c4c8;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:25px;
          line-height:1;
          padding:0;
          margin:0;
          cursor:pointer;
          transition:transform .16s ease,color .16s ease,border-color .16s ease,box-shadow .16s ease;
        }

        .cpV8MatchHero .cpMatchTeamFav:active{ transform:scale(.9); }

        .cpV8MatchHero .cpMatchTeamFav.is-active{
          color:#7dff22;
          border-color:#7dff22;
          box-shadow:0 0 14px rgba(125,255,34,.28);
          background:rgba(20,55,15,.72);
        }

        @media (max-width:520px){
          .cpV8MatchHero .cpV8HomeTeam,
          .cpV8MatchHero .cpV8AwayTeam{ gap:5px; }

          .cpV8MatchHero .cpMatchTeamFav{
            width:30px;
            height:30px;
            min-width:30px;
            font-size:22px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    function cprMatchFavoriteButton(teamName, side) {
      const name = String(teamName || "").trim();
      const active = cprIsFavorite(name);
      const safeName = escapeHtml(name);

      return `
        <button
          type="button"
          class="cpMatchTeamFav ${active ? "is-active" : ""}"
          data-cpr-match-fav="${side}"
          data-cpr-match-team="${safeName}"
          aria-label="${active ? `Remover ${safeName} dos favoritos` : `Favoritar ${safeName}`}"
          aria-pressed="${active ? "true" : "false"}"
          title="${active ? `Remover ${safeName} dos favoritos` : `Favoritar ${safeName}`}"
        >${active ? "★" : "☆"}</button>`;
    }

    function cprPaintFavoriteButtons(game) {
      if (!game) return;

      const homeBtn = document.querySelector('[data-cpr-fav="home"]');
      const awayBtn = document.querySelector('[data-cpr-fav="away"]');

      [
        [homeBtn, game.home],
        [awayBtn, game.away]
      ].forEach(([button, name]) => {
        if (!button) return;
        const active = cprIsFavorite(name);
        button.classList.toggle("is-active", active);
        button.textContent = active ? "★" : "☆";
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.title = active
          ? `Remover ${name} dos favoritos`
          : `Favoritar ${name}`;
      });
    }

    function cprText(selector, value) {
      const el = $(selector);
      if (el) el.textContent = value;
    }

    function cprBadge(game, side) {
      const img = $(side === "home" ? "#cprHomeBadge" : "#cprAwayBadge");
      const fallback = $(side === "home" ? "#cprHomeBadgeFallback" : "#cprAwayBadgeFallback");
      const name = side === "home" ? game.home : game.away;
      const url = typeof cpRefBadgeUrl === "function" ? cpRefBadgeUrl(game, side) : "";

      if (fallback) fallback.textContent = cpRefInitials(name);

      if (!img) return;
      if (!url) {
        img.hidden = true;
        if (fallback) fallback.hidden = false;
        return;
      }

      img.onload = () => {
        img.hidden = false;
        if (fallback) fallback.hidden = true;
      };
      img.onerror = () => {
        img.hidden = true;
        if (fallback) fallback.hidden = false;
      };
      img.src = url;
    }

    function cprMetric(value, digits = 1) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(digits).replace(/\.0$/, "") : "—";
    }

    function cprSyncHero(game, list) {
      if (!game) return;

      // V38 — a partir do primeiro jogo real, bloqueia qualquer retorno
      // do overlay de carregamento durante atualizações em background.
      cprHomeVisualReady = true;
      const permanentLoader = $("#cprLoading");
      if (permanentLoader) permanentLoader.hidden = true;

      const meta = MARKET[state.activeMarket] || MARKET.goals;
      cprText("#cprTitle", `🔥 MELHOR APOSTA • ${meta.label}`);
      const heroLine =
        state.activeMarket === "corners"
          ? (game.line && !game.line.includes("ATUALIZAÇÃO") && game.line !== "SEM APOSTA"
              ? game.line
              : "ANALISANDO TOP 1")
          : (game.line === "DADOS EM ATUALIZAÇÃO" || game.line === "SEM APOSTA"
              ? "ANALISANDO"
              : (game.line || "ANALISANDO"));

      cprText("#cprMarket", heroLine);
      cprText("#cprTime", game.time || "--:--");
      cprText("#cprHomeName", game.home || "Mandante");
      cprText("#cprAwayName", game.away || "Visitante");

      const today = todayManaus();
      const selected = String(state.date || "");
      cprText(
        "#cprDay",
        selected === today
          ? "HOJE"
          : selected.split("-").reverse().slice(0, 2).join("/")
      );

      cprBadge(game, "home");
      cprBadge(game, "away");
      cprPaintFavoriteButtons(game);

      const projection = cpRefProjection(game);
      const cornerAvg = cpRefCornersAverage(game);
      const goalsAvg = cpRefGoalsAverage(game);
      const confidence = Math.max(
        0,
        Math.min(
          95,
          Math.round(
            Number(
              game.confidence ||
              game?.raw?.corners_ai?.confidence ||
              game?.raw?.over95_prob_adj ||
              game?.raw?.over95_prob ||
              0
            )
          )
        )
      );

      const projectionLabel =
        state.activeMarket === "goals"
          ? "PROJEÇÃO DE GOLS"
          : state.activeMarket === "cards"
            ? "PROJEÇÃO DE CARTÕES"
            : "PROJEÇÃO DE CANTOS";

      const cornerReady = cprCornerTop1DecisionReady(game);
      const waitingTop1 =
        state.activeMarket === "corners" &&
        (
          !cornerReady ||
          state.officialCornerLoading ||
          heroLine === "ANALISANDO TOP 1"
        );

      cprText("#cprProjectionLabel", projectionLabel);
      cprText(
        "#cprProjection",
        waitingTop1 ? "—" : cprMetric(projection, 2)
      );
      cprText(
        "#cprCornersAvg",
        waitingTop1 ? "—" : cprMetric(cornerAvg, 1)
      );
      cprText(
        "#cprGoalsAvg",
        waitingTop1 && goalsAvg === null ? "—" : cprMetric(goalsAvg, 1)
      );
      cprText(
        "#cprConfidence",
        waitingTop1 ? "—" : (confidence > 0 ? `${confidence}%` : "—")
      );

      const trend =
        waitingTop1 ? "ANALISANDO" :
        confidence >= 72 ? "ALTA" :
        confidence >= 62 ? "MÉDIA" :
        "CAUTELA";

      cprText(
        "#cprTrend",
        waitingTop1 ? "💭 ANALISANDO" : `↗ ${trend}`
      );
      cprText("#cprConfidenceLabel", trend);

      const gauge = $("#cprGauge");
      if (gauge) gauge.style.setProperty("--p", waitingTop1 ? 0 : confidence);

      const loader = $("#cprLoading");
      if (loader) loader.hidden = true;

      const games = $("#cprFeaturedGames");
      if (games) {
        const featuredSource =
          (Array.isArray(list) && list.length)
            ? list
            : cprExistingGamesFromApp();

        if (featuredSource.length) {
          games.innerHTML = featuredSource.slice(0, 6).map((item, index) => `
            <button type="button" class="cprFeaturedCard" data-v9-game="${index}">
              <time>${escapeHtml(item.time || gameTime(item.raw || item) || "--:--")}</time>
              <div>
                <b>${escapeHtml(item.home || team(item.raw || item, "home"))}</b>
                <i>×</i>
                <b>${escapeHtml(item.away || team(item.raw || item, "away"))}</b>
              </div>
              <small>${escapeHtml(
                item.line &&
                item.line !== "DADOS EM ATUALIZAÇÃO" &&
                item.line !== "SEM APOSTA"
                  ? item.line
                  : ""
              )}</small>
              <span>›</span>
            </button>
          `).join("");
        }
      }
    }

    function cprShowEmpty() {
      const loader = $("#cprLoading");
      if (loader) loader.hidden = true;
      cprText("#cprMarket", "SEM JOGOS");
      cprText("#cprHomeName", "Nenhuma");
      cprText("#cprAwayName", "partida");
      cprText("#cprConfidence", "0%");
      const games = $("#cprFeaturedGames");
      if (games) games.innerHTML = '<div class="cprEmpty">Nenhuma partida encontrada para esta data.</div>';
    }

    function renderActive({ animate = false, direction = 1 } = {}) {
      if (state.activeMarket === "corners" && state.officialCornerNoOpportunity) {
        cprShowNoOfficialCornerOpportunity(state.officialCornerReason);
        return;
      }

      const list = activeList();
      const meta = MARKET[state.activeMarket] || MARKET.corners;
      setLoading(false);
      updateDots();
  
      if (!list.length) {
        showEmpty("SEM JOGOS", "Nenhuma partida encontrada para esta data.");
        cprShowEmpty();
        return;
      }
  
      const best = list[0];

      // Compatibilidade com consumidores antigos: sempre a lista ativa.
      window.__cpMobileDirectGames = list;

      const setText = (selector, value) => {
        const element = $(selector);
        if (element) element.textContent = value;
      };
  
      setText("#cpHomeBestTitle", meta.title);
      setText("#cpHomeBestMarket", best.line);
      setText("#cpHomeBestTime", best.time);
      setText("#cpHomeBestHome", best.home);
      setText("#cpHomeBestAway", best.away);
      setText("#cpHomeBestConfidence", `${best.confidence}%`);
      setText("#cpHomeMatchTeams", `${best.home} × ${best.away}`);
  
      const card = $("#cpHomeBest");
      if (card) {
        card.dataset.market = state.activeMarket;
        cpPaintBestTeamColors(card, best);
        cpRefUpdateHero(best);
      }

      // V31 — alimenta a Home visual isolada.
      cprSyncHero(best, list);
  
      card.__cpCurrentRaw = best.raw || best;
      card.__cpCurrentNormalized = best;

      if (typeof window.cpUpdateHomeBestLiveCard === "function") {
        window.cpUpdateHomeBestLiveCard(card.__cpCurrentRaw, card.__cpCurrentNormalized);
      }
  
      const open = $("#cpHomeBestOpen");
      if (open) {
        open.disabled = false;
        const text = open.querySelector(".cpHomeBestOpenText");
        if (text) text.textContent = "VER ANÁLISE COMPLETA →";
      }
  
      const games = $("#cpHomeGames");
      if (games) {
        games.innerHTML = list.slice(0, 6).map((game, index) => `
          <button type="button" class="cpHomeGame${index === 0 ? " is-first" : ""}" data-v9-game="${index}">
            <time>${escapeHtml(game.time)}</time>
            <div class="teams"><b>${escapeHtml(game.home)}</b><i>×</i><b>${escapeHtml(game.away)}</b></div>
            <small>${escapeHtml(game.line)}</small>
            <strong><span>CONFIANÇA</span>${game.confidence}%</strong>
          </button>`).join("");
      }
  
      const last = $("#cpHomeLastGames");
      if (last) {
        last.innerHTML = list.slice(1, 5).map((game, index) => `
          <button type="button" class="cpHomeLastGame" data-v9-game="${index + 1}">
            <time>${escapeHtml(game.time)}</time>
            <b>${escapeHtml(game.home)}<br>${escapeHtml(game.away)}</b>
            <strong>${game.confidence}%</strong><i>›</i>
          </button>`).join("");
      }
  
      if (animate) animateCard(direction);
    }
  
    function chooseMarket(type, options = {}) {
      if (!MARKET[type]) return;
      const previousIndex = MARKET_ORDER.indexOf(state.activeMarket);
      const nextIndex = MARKET_ORDER.indexOf(type);
      const direction = nextIndex >= previousIndex ? -1 : 1;
      state.activeMarket = type;
      renderActive({ animate: options.animate !== false, direction });
      restartAutoSlide();
    }
  
    function cycleMarket(step = 1) {
      const current = Math.max(0, MARKET_ORDER.indexOf(state.activeMarket));
      const next = (current + step + MARKET_ORDER.length) % MARKET_ORDER.length;
      chooseMarket(MARKET_ORDER[next], { animate: true });
    }
  
    function stopAutoSlide() {
      if (state.autoTimer) clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  
    function startAutoSlide() {
      stopAutoSlide();
      if (!mobileMedia.matches || document.hidden) return;
      state.autoTimer = setInterval(() => cycleMarket(1), AUTO_SLIDE_MS);
    }
  
    function restartAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }
  
    function loadMarketEnginesInBackground(date, stamp) {
      const applyEnginePayload = (payload, source = "full") => {
        if (state.date !== date || !payload || typeof payload !== "object") return;

        state.cornerLearning = payload?.corner_learning || state.cornerLearning || null;

        const cornerGames = extract(payload?.corners);
        const goalGames = extract(payload?.goals);
        const cardGames = extract(payload?.cards);
        const bttsGames = extract(payload?.btts);
        const handicapGames = extract(payload?.handicap);

        if (cornerGames.length) {
          const engineCorners = buildMarket(cornerGames, "corners");
          if (state.officialCornerBest) {
            state.corners = [
              state.officialCornerBest,
              ...engineCorners.filter(item => String(item.id) !== String(state.officialCornerBest.id))
            ];
          } else {
            state.corners = engineCorners;
          }
        }

        if (goalGames.length) state.goals = buildMarket(goalGames, "goals");
        if (cardGames.length) state.cards = buildMarket(cardGames, "cards");

        const keepResolvedFastDecision = (currentList, incomingRaw, type) => {
          const incoming = buildMarket(incomingRaw, type);
          if (source !== "full" || !Array.isArray(currentList) || !currentList.length) {
            return incoming;
          }

          const currentById = new Map(currentList.map(item => [String(item.id), item]));
          const field = ENGINE_DECISION_FIELD[type];

          return incoming.map(item => {
            const previous = currentById.get(String(item.id));
            if (!previous) return item;

            const prevDecision = previous?.raw?.[field];
            const nextDecision = item?.raw?.[field];

            const prevResolved = Boolean(
              prevDecision &&
              !prevDecision.updating &&
              clean(prevDecision.line, "") &&
              !["DADOS EM ATUALIZAÇÃO", "ANALISANDO PARTIDA"].includes(
                clean(prevDecision.line, "").toUpperCase()
              )
            );

            const nextPending = Boolean(
              !nextDecision ||
              nextDecision.updating ||
              ["DADOS EM ATUALIZAÇÃO", "ANALISANDO PARTIDA"].includes(
                clean(nextDecision?.line, "").toUpperCase()
              )
            );

            return prevResolved && nextPending ? previous : item;
          });
        };

        if (bttsGames.length) {
          state.btts = keepResolvedFastDecision(state.btts, bttsGames, "btts");
        }
        if (handicapGames.length) {
          const hasHandicapV60 = Array.isArray(state.handicap) && state.handicap.some(
            item => Boolean(item?.raw?.handicap_only_v60)
          );

          if (!hasHandicapV60) {
            state.handicap = keepResolvedFastDecision(state.handicap, handicapGames, "handicap");
          }
        }

        window.__cpMobileDirectGames = activeList();
        renderActive({ animate: false });

        // V54 — se o usuário já estiver dentro de Ambas/Handicap,
        // atualiza a tela aberta assim que a IA chega. Antes o state mudava,
        // mas o HTML do mercado permanecia congelado em "AGUARDANDO DADOS".
        const openMarketLayer = $("#cpMobileMarketsLayer");
        const marketLayerIsOpen = Boolean(
          openMarketLayer &&
          (
            openMarketLayer.classList.contains("is-open") ||
            openMarketLayer.getAttribute("aria-hidden") === "false"
          )
        );

        if (marketLayerIsOpen) {
          if (state.activeMarket === "btts" && bttsGames.length) {
            renderBttsMarket(openMarketLayer);
          } else if (state.activeMarket === "handicap" && handicapGames.length) {
            const activeHandicapLine =
              $(".cpHandicapLines button.active", openMarketLayer)?.dataset?.handicapLine ||
              "IA";
            renderHandicapMarket(openMarketLayer, activeHandicapLine);
          }
        }

        console.info(`[Corner Pro engines] ${source} aplicado`, {
          btts: bttsGames.length,
          handicap: handicapGames.length,
          corners: cornerGames.length
        });
      };

      // V53 — FAST PATH: BTTS + Handicap não podem depender do motor completo.
      // O motor completo faz muitas chamadas (ligas, standings, H2H, odds, recentes)
      // e pode ultrapassar o timeout do celular/Render. Esta rota rápida entrega
      // primeiro Ambas Marcam e Handicap; o motor completo melhora os dados depois.
      getJson(
        `/market_engines_fast?date=${encodeURIComponent(date)}&_mobile=${stamp}&v=58`,
        22000
      )
        .then(payload => applyEnginePayload(payload, "fast"))
        .catch(error => {
          console.warn("[Corner Pro fast engines]", error?.message || error);
        });

      // Motor completo continua em paralelo, mas não bloqueia a tela nem o /mercados.
      getJson(
        `/market_engines?date=${encodeURIComponent(date)}&_mobile=${stamp}&v=53`,
        90000
      )
        .then(payload => applyEnginePayload(payload, "full"))
        .catch(error => {
          console.warn("[Corner Pro full engines]", error?.message || error);
        });

      // Retorna imediatamente para não prender Promise.allSettled de dados secundários.
      return Promise.resolve();
    }

    function cprRenderBaseGamesImmediately(raw) {
      if (!Array.isArray(raw) || !raw.length) return false;

      const baseList = raw
        .map((item, index) => {
          // Se já veio normalizado pela parte antiga, preserva.
          if (
            item &&
            typeof item === "object" &&
            item.home &&
            item.away &&
            ("raw" in item || "line" in item || "confidence" in item)
          ) {
            return {
              ...item,
              raw: item.raw || item,
              time: item.time || gameTime(item.raw || item),
              line: item.line || "ANALISANDO TOP 1",
              confidence: Number(item.confidence || 0) || 0
            };
          }

          return normalize(item, "corners", index);
        })
        .filter(item =>
          item &&
          item.home &&
          item.away &&
          !/^casa$/i.test(item.home) &&
          !/^fora$/i.test(item.away)
        );

      if (!baseList.length) return false;

      const best = baseList[0];

      if (
        !best.line ||
        best.line === "DADOS EM ATUALIZAÇÃO" ||
        best.line === "SEM APOSTA"
      ) {
        best.line = "ANALISANDO TOP 1";
      }

      if (!Number(best.confidence)) {
        best.confidence = 0;
      }

      // V51 — a lista-base pode atualizar "Jogos em destaque", mas NUNCA
      // pode substituir o Top 1 oficial depois que a IA aprovou uma partida.
      if (state.officialCornerNoOpportunity) {
        // Mantém "SEM ENTRADA" no card principal.
      } else if (
        state.activeMarket === "corners" &&
        state.officialCornerBest
      ) {
        const official = state.officialCornerBest;
        const heroList = [
          official,
          ...baseList.filter(item => String(item.id) !== String(official.id))
        ];
        cprSyncHero(official, heroList);
      } else {
        // Enquanto a rota oficial ainda pensa, podemos mostrar os nomes do
        // primeiro jogo, mas métricas permanecem em "— / ANALISANDO".
        cprSyncHero(best, baseList);
      }

      // Espelha também no estado da Home para favoritos/cliques.
      if (!Array.isArray(state.goals) || !state.goals.length) {
        state.goals = baseList;
      }

      window.__cpMobileDirectGames = baseList;

      return true;
    }

    function cprExistingGamesFromApp() {
      const candidates = [
        window.__cpMobileDirectGames,
        window.__cornerProAllGames,
        state.goals,
        state.pregame,
        state.corners,
        state.cards,
        state.handicap,
        state.btts
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
          const real = candidate.filter(item => {
            const source = item?.raw || item || {};
            const home = item?.home || team(source, "home");
            const away = item?.away || team(source, "away");

            return (
              home &&
              away &&
              !/^casa$/i.test(home) &&
              !/^fora$/i.test(away) &&
              !/^time a$/i.test(home) &&
              !/^time b$/i.test(away)
            );
          });

          if (real.length) return real;
        }
      }

      return [];
    }

    function cprBridgeExistingGames() {
      const games = cprExistingGamesFromApp();
      if (!games.length) return false;
      return cprRenderBaseGamesImmediately(games);
    }


    async function cprFirstBaseGames(date, stamp) {
      const urls = [
        `/quentes?date=${encodeURIComponent(date)}&mobile=1&_mobile=${stamp}&ai=0&onlyTop=0&v=36`,
        `/mercados?date=${encodeURIComponent(date)}&_mobile=${stamp}&v=36`
      ];

      return await new Promise((resolve, reject) => {
        let pending = urls.length;
        const errors = [];
        let done = false;

        urls.forEach((url, index) => {
          getJson(url, index === 0 ? 10000 : 14000)
            .then(payload => {
              if (done) return;

              const games = extract(payload);
              if (games.length) {
                done = true;
                resolve(games);
                return;
              }

              errors.push(new Error(`Fonte ${index + 1} retornou sem jogos.`));
              pending -= 1;
              if (!pending && !done) {
                reject(errors[0] || new Error("Nenhuma fonte retornou jogos."));
              }
            })
            .catch(error => {
              errors.push(error);
              pending -= 1;
              if (!pending && !done) {
                reject(errors[0] || error);
              }
            });
        });
      });
    }


    function cprFavoritesForTop1Query() {
      try {
        return encodeURIComponent(JSON.stringify(cprReadFavorites().slice(0, 40)));
      } catch {
        return encodeURIComponent('[]');
      }
    }

    function cprShowNoOfficialCornerOpportunity(message = '') {
      state.officialCornerNoOpportunity = true;
      state.officialCornerLoading = false;
      state.officialCornerReason = String(message || '');
      state.officialCornerBest = null;
      state.activeMarket = 'corners';

      cprText('#cprTitle', '🔥 MELHOR APOSTA • CANTOS');
      cprText('#cprMarket', 'SEM ENTRADA');
      cprText('#cprTime', '--:--');
      cprText('#cprHomeName', 'Nenhuma oportunidade');
      cprText('#cprAwayName', 'aprovada');
      cprText('#cprProjectionLabel', 'PROJEÇÃO DE CANTOS');
      cprText('#cprProjection', '—');
      cprText('#cprCornersAvg', '—');
      cprText('#cprGoalsAvg', '—');
      cprText('#cprConfidence', '—');
      cprText('#cprTrend', '↗ AGUARDAR');
      cprText('#cprConfidenceLabel', 'AGUARDAR');

      const open = $('#cpHomeBestOpen');
      if (open) open.disabled = true;
    }

    async function loadOfficialCornerTop1(date, stamp, { fresh = false } = {}) {
      if (!date) return;
      state.officialCornerLoading = true;
      state.officialCornerNoOpportunity = false;

      // Estado visual correto durante o processamento:
      // nenhum "0", nenhum "CAUTELA" e nenhuma confiança inventada.
      cprText("#cprMarket", "ANALISANDO TOP 1");
      cprText("#cprProjection", "—");
      cprText("#cprCornersAvg", "—");
      cprText("#cprConfidence", "—");
      cprText("#cprTrend", "💭 ANALISANDO");
      cprText("#cprConfidenceLabel", "ANALISANDO");

      const gauge = $("#cprGauge");
      if (gauge) gauge.style.setProperty("--p", 0);

      try {
        const favorites = cprFavoritesForTop1Query();
        const payload = await getJson(
          `/official_corner_pick?date=${encodeURIComponent(date)}&fresh=${fresh ? '1' : '0'}&favorites=${favorites}&_mobile=${stamp}`,
          22000
        );

        if (state.date !== date) return;

        const rawGame = payload?.game;
        if (!rawGame) {
          cprShowNoOfficialCornerOpportunity(
            payload?.message || 'Nenhum Top 1 de cantos passou pelos filtros premium.'
          );
          return;
        }

        const best = normalize(rawGame, 'corners', 0);
        const line = String(best.line || '').toUpperCase();

        // Segurança do front: mesmo que algum cache antigo devolva 8.5, não publica.
        if (line === 'OVER 8.5' || !['OVER 9.5','OVER 10.5','OVER 11.5'].includes(line)) {
          cprShowNoOfficialCornerOpportunity('A linha retornada não passou pelo filtro do Top 1.');
          return;
        }

        state.officialCornerLoading = false;
        state.officialCornerNoOpportunity = false;
        state.officialCornerReason = String(payload?.top1_reason || '');
        state.officialCornerBest = best;
        state.activeMarket = 'corners';

        const current = Array.isArray(state.corners) ? state.corners : [];
        state.corners = [
          best,
          ...current.filter(item => String(item.id) !== String(best.id))
        ];

        window.__cpMobileDirectGames = state.corners;
        renderActive({ animate: true, direction: -1 });
      } catch (error) {
        if (state.date !== date) return;
        state.officialCornerLoading = false;
        cprShowNoOfficialCornerOpportunity(
          'A IA não confirmou uma oportunidade premium agora. Tente novamente em instantes.'
        );
      }
    }

    async function loadSecondaryDataInBackground(date, stamp) {
      // Mercado completo pode ser pesado. Nunca bloqueia a Home.
      Promise.allSettled([
        getJson(`/mercados?date=${encodeURIComponent(date)}&_mobile=${stamp}&v=33`, 18000),
        loadMarketEnginesInBackground(date, stamp)
      ]).then(([marketResult]) => {
        if (state.date !== date) return;

        if (marketResult.status === "fulfilled") {
          const marketGames = extract(marketResult.value);
          if (marketGames.length) {
            state.all = marketGames;
            state.pregame = buildMarket(marketGames, "pregame");
            state.combined = buildMarket(marketGames, "combined");
            state.props = buildMarket(marketGames, "props");

            // Escanteios manual permanece disponível imediatamente.
            if (!state.corners?.length) {
              state.corners = buildMarket(marketGames, "corners");
            }

            window.__cornerProAllGames = marketGames;

            // Atualiza também a Home isolada diretamente.
            cprRenderBaseGamesImmediately(marketGames);

            // V54 — não rouba o mercado que o usuário já abriu.
            // /mercados é atualização de dados, não navegação.
            window.__cpMobileDirectGames = activeList();
            renderActive({ animate: false });
          }
        }
      }).catch(() => {});
    }

    async function loadData() {
      if (state.loading) return;

      setLoading(true);

      const stamp = Date.now();
      const date = state.date;
      state.officialCornerBest = null;
      state.officialCornerNoOpportunity = false;
      state.officialCornerReason = "";

      try {
        // V36 — /quentes e /mercados correm em paralelo.
        // A PRIMEIRA fonte que trouxer jogos já libera o card principal.
        const raw = await cprFirstBaseGames(date, stamp);

        if (state.date !== date) {
          setLoading(false);
          return;
        }

        state.all = raw;
        state.engineDate = date;

        state.pregame = buildMarket(raw, "pregame");
        state.combined = buildMarket(raw, "combined");
        state.props = buildMarket(raw, "props");

        // Não usa mais Over 8.5 / 64% como preenchimento temporário.
        // O card principal só vira recomendação depois que /official_corner_pick aprovar.
        state.corners = buildMarket(raw, "corners");

        // Mantém todos os mercados navegáveis enquanto a IA específica chega.
        state.goals = buildMarket(raw, "goals");
        state.cards = buildMarket(raw, "cards");
        state.btts = buildMarket(raw, "btts");
        state.handicap = buildMarket(raw, "handicap");

        if (!state.btts.length) state.btts = buildMarket(raw, "pregame");
        if (!state.handicap.length) state.handicap = buildMarket(raw, "pregame");

        window.__cornerProAllGames = raw;

        // PASSO CRÍTICO: mostra nomes e jogos imediatamente.
        cprRenderBaseGamesImmediately(raw);
        cprBridgeExistingGames();

        setLoading(false);

        // O card principal fica fixo em CANTOS. A lista rápida só preenche a tela;
        // a recomendação real vem da rota oficial e pode decidir por SEM ENTRADA.
        state.activeMarket = "corners";
        renderActive({ animate: false });
        stopAutoSlide();

        loadOfficialCornerTop1(date, stamp).catch(() => {});

        // Dados pesados continuam em background.
        loadSecondaryDataInBackground(date, stamp);
      } catch (error) {
        setLoading(false);

        // V40 — se os jogos já apareceram na Home, uma falha tardia
        // de atualização não pode apagar "Jogos em destaque".
        if (!cprHomeVisualReady) {
          const games = $("#cprFeaturedGames");
          if (games) {
            games.innerHTML =
              '<div class="cprEmpty">Não foi possível carregar os jogos. Tentando novamente...</div>';
          }
        }

        // Retry curto, sem recarregar a página.
        if (!cprHomeVisualReady) {
          setTimeout(() => {
            if (!state.loading && state.date === date && !cprHomeVisualReady) {
              loadData().catch(() => {});
            }
          }, 2200);
        }

        throw error;
      }
    }
  
  
    function bttsSafeNumber(value) {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      if (!text) return null;
      const n = Number(text.replace("%", "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }

    function bttsRealProbability(game) {
      const raw = game?.raw || game || {};
      const candidates = [
        raw?.btts_ai?.probability,
        raw?.btts_ai?.prob,
        raw?.btts_ai?.confidence,
        raw?.markets?.prob?.btts,
        raw?.btts_prob,
        raw?.prob_btts,
        raw?.ambas_marcam_prob,
        raw?.both_teams_score_prob,
        raw?.goals?.btts_prob,
        raw?.markets?.btts_prob
      ];

      for (const value of candidates) {
        let n = bttsSafeNumber(value);
        if (n === null) continue;
        if (n > 0 && n <= 1) n *= 100;
        while (n > 100) n /= 10;
        if (n >= 0 && n <= 100) return Math.round(n);
      }
      return null;
    }

    function bttsRealOdd(game, choice) {
      const raw = game?.raw || game || {};
      const decision = raw?.btts_ai || {};
      const yes = choice === "SIM";
      const candidates = yes
        ? [
            decision?.odd, decision?.odds, decision?.yes_odd,
            raw?.btts_yes_odd, raw?.btts_sim_odd,
            raw?.odds?.btts_yes, raw?.markets?.odds?.btts_yes
          ]
        : [
            decision?.odd, decision?.odds, decision?.no_odd,
            raw?.btts_no_odd, raw?.btts_nao_odd,
            raw?.odds?.btts_no, raw?.markets?.odds?.btts_no
          ];

      for (const value of candidates) {
        const n = bttsSafeNumber(value);
        if (n !== null && n > 1 && n < 100) return n.toFixed(2);
      }
      return "—";
    }

    function bttsGameState(game) {
      const raw = game?.raw || game || {};
      const status = clean(
        raw?.status ?? raw?.status_raw ?? raw?.match_status ??
        raw?.event_status ?? game?.status,
        ""
      ).toLowerCase();

      const finished =
        Boolean(raw?.finished) ||
        /finished|full.?time|\bft\b|encerr|finaliz|ended/.test(status);

      const live =
        !finished &&
        (
          Boolean(raw?.live) ||
          /live|ao vivo|1st|2nd|half|interval/.test(status) ||
          Number(raw?.minute ?? raw?.match_minute ?? raw?.elapsed) > 0
        );

      return { finished, live };
    }

    const BTTS_HISTORY_KEY = "cornerPro:btts-history:v1";

    function bttsMatchKey(game) {
      const raw = game?.raw || game || {};
      const id = clean(
        raw?.match_id ?? raw?.fixture_id ?? raw?.event_id ??
        raw?.event_key ?? raw?.id ?? game?.id,
        ""
      );
      if (id) return `id:${id}`;

      return [
        clean(game?.date ?? raw?.date ?? raw?.match_date, ""),
        clean(game?.time ?? raw?.time ?? raw?.match_time, ""),
        clean(game?.home ?? raw?.home_name ?? raw?.match_hometeam_name, ""),
        clean(game?.away ?? raw?.away_name ?? raw?.match_awayteam_name, "")
      ].join("|").toLowerCase();
    }

    function bttsHistoryRead() {
      try {
        const value = JSON.parse(localStorage.getItem(BTTS_HISTORY_KEY) || "{}");
        return value && typeof value === "object" ? value : {};
      } catch (_) {
        return {};
      }
    }

    function bttsHistoryGet(game) {
      const key = bttsMatchKey(game);
      if (!key) return null;
      return bttsHistoryRead()[key] || null;
    }

    function bttsHistorySave(game, choice, confidence = null, source = "") {
      if (!choice) return;
      const key = bttsMatchKey(game);
      if (!key) return;

      const history = bttsHistoryRead();
      history[key] = {
        choice,
        confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
        source: String(source || ""),
        savedAt: Date.now()
      };

      try {
        localStorage.setItem(BTTS_HISTORY_KEY, JSON.stringify(history));
      } catch (_) {}
    }

    function bttsDecisionForGame(game) {
      const raw = game?.raw || game || {};
      const decision = raw?.btts_ai && typeof raw.btts_ai === "object"
        ? raw.btts_ai
        : {};

      const stateInfo = bttsGameState(game);
      const explicitLine = clean(decision?.line, "").toUpperCase();
      const explicitSkip = Boolean(decision?.skip);
      const updating =
        Boolean(decision?.updating) ||
        explicitLine === "DADOS EM ATUALIZAÇÃO" ||
        explicitLine === "ANALISANDO PARTIDA";

      const probability = bttsRealProbability(game);

      let choice = "";
      let source = "";
      let reason = clean(decision?.reason, "");

      if (!explicitSkip && !updating && explicitLine) {
        if (explicitLine.includes("NÃO") || explicitLine.includes("NAO")) {
          choice = "NÃO";
          source = "server";
        } else if (
          explicitLine.includes("SIM") ||
          explicitLine.includes("AMBAS MARCAM")
        ) {
          choice = "SIM";
          source = "server";
        }
      }

      if (!choice && probability !== null && !stateInfo.finished) {
        if (probability >= 60) {
          choice = "SIM";
          source = "probability";
          if (!reason) reason = `Probabilidade real de ambas marcarem: ${probability}%.`;
        } else if (probability <= 40) {
          choice = "NÃO";
          source = "probability";
          if (!reason) reason = `Probabilidade real de ambas marcarem: ${probability}%.`;
        }
      }

      // Guarda a indicação enquanto a partida ainda não terminou.
      if (!stateInfo.finished && choice) {
        bttsHistorySave(game, choice, probability, source);
      }

      if (stateInfo.finished) {
        const stored = bttsHistoryGet(game);
        const finalChoice = choice || stored?.choice || "";

        return {
          choice: finalChoice,
          confidence:
            stored?.confidence !== null && stored?.confidence !== undefined
              ? Number(stored.confidence)
              : probability,
          odd: "—",
          state: "finished",
          reason: finalChoice
            ? `Indicação pré-jogo: AMBAS MARCAM – ${finalChoice}.`
            : "Partida encerrada sem indicação pré-jogo registrada para Ambas Marcam.",
          source: finalChoice ? "history" : "final"
        };
      }

      if (updating && !choice) {
        return {
          choice: "",
          confidence: probability,
          odd: "—",
          state: "updating",
          reason: "Aguardando dados reais do servidor para este mercado.",
          source: "updating"
        };
      }

      if (explicitSkip && !choice) {
        return {
          choice: "",
          confidence: probability,
          odd: "—",
          state: "no-bet",
          reason: reason || "Sem vantagem estatística suficiente para uma entrada.",
          source: "server"
        };
      }

      if (!choice) {
        return {
          choice: "",
          confidence: probability,
          odd: "—",
          state: probability === null ? "updating" : "no-bet",
          reason: probability === null
            ? "Aguardando dados reais do servidor para este mercado."
            : `Probabilidade BTTS em ${probability}%: sem vantagem suficiente para SIM ou NÃO.`,
          source: probability === null ? "updating" : "probability"
        };
      }

      let confidence = probability;
      if (confidence === null) {
        confidence = numberFrom(decision?.confidence);
        if (confidence !== null) {
          if (confidence > 0 && confidence <= 1) confidence *= 100;
          while (confidence > 100) confidence /= 10;
          confidence = Math.max(0, Math.min(100, Math.round(confidence)));
        }
      }

      return {
        choice,
        confidence,
        odd: bttsRealOdd(game, choice),
        state: stateInfo.live ? "live" : "pick",
        reason: reason || (
          choice === "SIM"
            ? "Os dados reais indicam boa chance de as duas equipes marcarem."
            : "Os dados reais indicam boa chance de pelo menos uma equipe não marcar."
        ),
        source
      };
    }

    function renderBttsMarket(layer) {
      const body = $(".cpMobileMarketsBody", layer);
      if (!body) return;

      const allBttsGames = Array.isArray(state.btts) ? state.btts : [];
      const upcomingBttsGames = allBttsGames.filter(game => !handicapFinished(game));
      const games = (upcomingBttsGames.length ? upcomingBttsGames : allBttsGames).slice(0, 12);
      const settlementEntries = [];
      const liveEntries = [];

      const rows = games.map((game, index) => {
        const rec = bttsDecisionForGame(game);
        const isPick = rec.state === "pick" || rec.state === "live";
        const isUpdating = rec.state === "updating";
        const isNoBet = rec.state === "no-bet";
        const isFinished = rec.state === "finished";
        const choice = rec.choice || "";
        const confidence =
          Number.isFinite(Number(rec.confidence))
            ? Math.max(0, Math.min(100, Math.round(Number(rec.confidence))))
            : null;

        const homeInitial = escapeHtml((game.home || "C").slice(0, 2).toUpperCase());
        const awayInitial = escapeHtml((game.away || "F").slice(0, 2).toUpperCase());
        const settlementKey = `btts-${index}`;
        const liveKey = `live-btts-${index}`;

        if ((isPick || isFinished) && choice) {
          settlementEntries.push({
            key: settlementKey,
            game,
            marketType: "btts",
            line: `AMBAS ${choice}`
          });
        }

        if (isPick && choice) {
          liveEntries.push({
            key: liveKey,
            game,
            marketType: "btts",
            line: `AMBAS ${choice}`,
            side: ""
          });
        }

        const title =
          isFinished
            ? (choice ? `AMBAS MARCAM – ${choice}` : "SEM ENTRADA")
            : isUpdating
              ? "AGUARDANDO DADOS"
              : isNoBet
                ? "SEM APOSTA"
                : `AMBAS MARCAM – ${choice}`;

        const gaugeText =
          isFinished
            ? (choice ? "RESULTADO" : "SEM ENTRADA")
            : isUpdating
              ? "AGUARDANDO DADOS"
              : isNoBet
                ? "SEM ENTRADA"
                : "CONFIANÇA";

        const engineLabel =
          rec.source === "server"
            ? "✦ IA DO SERVIDOR"
            : rec.source === "probability"
              ? "✦ DADOS DO SERVIDOR"
              : rec.source === "history"
                ? "✦ SUGESTÃO AUTOMÁTICA"
                : rec.source === "final"
                  ? "✦ SEM ENTRADA"
                  : "✦ AGUARDANDO SERVIDOR";

        return `
          <button
            type="button"
            class="cpBttsOpportunity ${
              isFinished ? "is-finished" :
              isUpdating ? "is-updating" :
              isNoBet ? "is-no-bet" : "is-pick"
            }"
            data-v9-game="${index}"
            data-settlement-key="${settlementKey}"
            data-settlement-market="btts"
            data-settlement-line="${choice ? `AMBAS ${choice}` : ""}"
            data-btts-choice="${choice ? (choice === "SIM" ? "sim" : "não") : "none"}"
            data-btts-ai="${(isPick || (isFinished && choice)) ? "1" : "0"}"
            data-btts-state="${rec.state}"
            data-live-key="${liveKey}"
          >
            <div class="cpBttsMatch">
              <time>${escapeHtml(game.time)}</time>
              <small>⚽ Liga principal</small>
              <div class="cpBttsTeams">
                <span class="cpBttsBadge">${homeInitial}</span>
                <b>${escapeHtml(game.home)}${cprMarketFavoriteStar(game.home)}</b>
                <i>×</i>
                <b>${escapeHtml(game.away)}${cprMarketFavoriteStar(game.away)}</b>
                <span class="cpBttsBadge away">${awayInitial}</span>
              </div>
            </div>

            <div class="cpBttsPick">
              <span class="cpBttsEngineBadge">${engineLabel}</span>
              <strong>${escapeHtml(title)}</strong>
              <small>${escapeHtml(rec.reason)}</small>
              <b>${isFinished ? "—" : isPick ? rec.odd : "—"}</b>
              <span class="cpSettlementSlot">${isFinished && choice ? "VERIFICANDO…" : ""}</span>
            </div>

            <div
              class="cpBttsGauge ${!isPick ? "is-disabled" : ""}"
              style="--btts:${confidence ?? 0}"
            >
              <span>${isFinished ? "—" : isPick && confidence !== null ? `${confidence}%` : "—"}</span>
              <small>${gaugeText}</small>
            </div>

            <i class="cpBttsArrow">›</i>
          </button>`;
      }).join("");

      body.innerHTML = `
        <section class="cpBttsIntro">
          <div class="cpBttsIntroIcon">◎</div>
          <p>Escolha SIM ou NÃO para ver somente os jogos realmente classificados nessa opção.</p>
        </section>

        <div class="cpBttsTabs">
          <button type="button" class="active" data-btts-tab="ai">IA</button>
          <button type="button" data-btts-tab="all">TODOS</button>
          <button type="button" data-btts-tab="yes">SIM</button>
          <button type="button" data-btts-tab="no">NÃO</button>
        </div>

        <section class="cpBttsExplain">
          <h3>COMO FUNCIONA AMBAS MARCAM? <span>ⓘ</span></h3>
          <div>
            <article>
              <i>✓</i>
              <section><b>SIM</b><p>As duas equipes precisam marcar pelo menos um gol. Se uma delas não marcar, a aposta é perdida.</p></section>
            </article>
            <article>
              <i>×</i>
              <section><b>NÃO</b><p>Pelo menos uma das equipes precisa terminar sem marcar. Se as duas marcarem, a aposta é perdida.</p></section>
            </article>
          </div>
        </section>

        <div class="cpBttsTitle">
          <h2>MELHORES OPORTUNIDADES</h2>
          <button type="button">VER TODOS ›</button>
        </div>

        <div class="cpBttsList">
          ${rows || '<div class="cpBttsEmpty">Nenhum jogo disponível para esta data.</div>'}
        </div>

        <div class="cpBttsFilterEmpty" hidden>
          Nenhuma oportunidade disponível nesta opção.
        </div>

        <button type="button" class="cpBttsAllGames">
          <span>☷</span><b>VER TODOS OS JOGOS DE AMBAS MARCAM</b><i>›</i>
        </button>

        <section class="cpBttsBottomExplain">
          <h3>EXPLICAÇÃO DAS OPÇÕES</h3>
          <div>
            <article><i>✓</i><p><b>AMBAS MARCAM – SIM</b><br>As duas equipes marcam pelo menos um gol durante a partida.</p></article>
            <article><i>×</i><p><b>AMBAS MARCAM – NÃO</b><br>Pelo menos uma das equipes termina a partida sem marcar.</p></article>
          </div>
        </section>`;

      settlementRefreshCards(body, settlementEntries);
      marketStartLiveRefresh(body, liveEntries);

      const cards = $$(".cpBttsOpportunity", body);
      cards.forEach(card => {
        card.hidden = card.dataset.bttsAi !== "1";
      });

      const empty = $(".cpBttsFilterEmpty", body);
      if (empty) empty.hidden = cards.some(card => !card.hidden);
    }

    function handicapScore(game) {
      const raw = game?.raw || {};
      const home = numberFrom(
        raw.home_score, raw.score_home, raw.match_hometeam_score,
        raw.goals?.home, raw.score?.home
      );
      const away = numberFrom(
        raw.away_score, raw.score_away, raw.match_awayteam_score,
        raw.goals?.away, raw.score?.away
      );
      return { home, away };
    }
  
    function handicapFinished(game) {
      const raw = game?.raw || {};
      const status = clean(
        raw.status ?? raw.match_status ?? raw.event_status ?? game?.status,
        ""
      ).toLowerCase();
  
      return Boolean(raw.finished) ||
        /finished|full.?time|\bft\b|encerr|finaliz|ended/.test(status);
    }
  
    function handicapSingleSettlement(goalDifference, line) {
      const adjusted = goalDifference + Number(line);
  
      if (adjusted > 0) return "win";
      if (adjusted < 0) return "loss";
      return "push";
    }
  
    function handicapSplitLines(line) {
      const value = Number(line);
  
      if (value === -0.75) return [-0.5, -1.0];
      if (value === -0.25) return [0.0, -0.5];
      if (value === 0.25) return [0.0, 0.5];
      if (value === 0.75) return [0.5, 1.0];
  
      return [value];
    }
  
    function handicapSettlement(game, side, line) {
      if (!handicapFinished(game)) return null;
  
      const score = handicapScore(game);
      if (!Number.isFinite(score.home) || !Number.isFinite(score.away)) return null;
  
      const difference = side === "home"
        ? score.home - score.away
        : score.away - score.home;
  
      const results = handicapSplitLines(line)
        .map(part => handicapSingleSettlement(difference, part));
  
      if (results.length === 1) return results[0];
  
      if (results.every(result => result === "win")) return "win";
      if (results.every(result => result === "loss")) return "loss";
      if (results.every(result => result === "push")) return "push";
      if (results.includes("win") && results.includes("push")) return "half_win";
      if (results.includes("loss") && results.includes("push")) return "half_loss";
  
      return results.includes("win") ? "half_win" : "half_loss";
    }
  
    function handicapSettlementBadge(result) {
      const badges = {
        win: '<span class="cpHandicapResult green">✓ GREEN</span>',
        loss: '<span class="cpHandicapResult red">× RED</span>',
        push: '<span class="cpHandicapResult push">↔ DEVOLVIDA</span>',
        half_win: '<span class="cpHandicapResult half-win">½ GREEN</span>',
        half_loss: '<span class="cpHandicapResult half-loss">½ RED</span>'
      };
  
      return badges[result] || "";
    }
  
    function handicapLineRule(line, sideLabel = "TIME") {
      const rules = {
        "-1.0": {
          short: `${sideLabel} -1.0`,
          headline: "Vitória por 2+ gols = aposta ganha.",
          details: [
            "Vence por 2 ou mais: ganha tudo.",
            "Vence por exatamente 1: valor devolvido.",
            "Empata ou perde: aposta perdida."
          ]
        },
        "-0.75": {
          short: `${sideLabel} -0.75`,
          headline: "A aposta é dividida entre -0.5 e -1.0.",
          details: [
            "Vence por 2+: ganha tudo.",
            "Vence por 1: ganha metade e recebe metade de volta.",
            "Empata ou perde: perde tudo."
          ]
        },
        "-0.5": {
          short: `${sideLabel} -0.5`,
          headline: "O time precisa vencer.",
          details: [
            "Qualquer vitória: aposta ganha.",
            "Empate ou derrota: aposta perdida.",
            "Não existe devolução."
          ]
        },
        "-0.25": {
          short: `${sideLabel} -0.25`,
          headline: "A aposta é dividida entre 0.0 e -0.5.",
          details: [
            "Vitória: ganha tudo.",
            "Empate: perde metade e recebe metade de volta.",
            "Derrota: perde tudo."
          ]
        },
        "+0.25": {
          short: `${sideLabel} +0.25`,
          headline: "A aposta é dividida entre 0.0 e +0.5.",
          details: [
            "Vitória: ganha tudo.",
            "Empate: ganha metade e recebe metade de volta.",
            "Derrota: perde tudo."
          ]
        },
        "+0.5": {
          short: `${sideLabel} +0.5`,
          headline: "O time pode vencer ou empatar.",
          details: [
            "Vitória ou empate: aposta ganha.",
            "Derrota: aposta perdida.",
            "Não existe devolução."
          ]
        },
        "+0.75": {
          short: `${sideLabel} +0.75`,
          headline: "A aposta é dividida entre +0.5 e +1.0.",
          details: [
            "Vitória ou empate: ganha tudo.",
            "Perde por 1: perde metade e recebe metade de volta.",
            "Perde por 2+: perde tudo."
          ]
        },
        "+1.0": {
          short: `${sideLabel} +1.0`,
          headline: "O time recebe um gol de vantagem.",
          details: [
            "Vitória ou empate: aposta ganha.",
            "Perde por exatamente 1: valor devolvido.",
            "Perde por 2 ou mais: aposta perdida."
          ]
        }
      };
  
      return rules[line] || rules["-0.5"];
    }
  
    function handicapRawNumber(raw, keys, fallback = null) {
      for (const key of keys) {
        const value = key.split(".").reduce((obj, part) => obj?.[part], raw);
  
        if (value === null || value === undefined || value === "") {
          continue;
        }
  
        const normalized = String(value)
          .trim()
          .replace("%", "")
          .replace(",", ".");
  
        if (!normalized) continue;
  
        const number = Number(normalized);
  
        if (Number.isFinite(number)) return number;
      }
  
      return fallback;
    }
  
    function handicapGameFactor(game, salt = "") {
      const raw = game?.raw || {};
  
      const source = [
        game?.home,
        game?.away,
        game?.time,
        raw.match_id,
        raw.fixture_id,
        raw.event_id,
        raw.match_date,
        salt
      ].filter(Boolean).join("|");
  
      let hash = 2166136261;
  
      for (const char of source) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
  
      return (Math.abs(hash >>> 0) % 10000) / 9999;
    }
  
    function handicapAutoRecommendation(game) {
      const raw = game?.raw || {};
      const serverDecision = raw?.handicap_ai;
  
      if (serverDecision && typeof serverDecision === "object") {
        const sideKey = String(
          serverDecision.side_key ??
          serverDecision.side ??
          ""
        ).toLowerCase();
  
        const side =
          sideKey === "away" || sideKey === "fora"
            ? "away"
            : "home";
  
        const serverLine =
          clean(serverDecision.line, "SEM APOSTA");

        const validServerLines = new Set([
          "-2.0", "-1.5", "-1.0", "-0.75", "-0.5", "-0.25",
          "0.0",
          "+0.25", "+0.5", "+0.75", "+1.0", "+1.5", "+2.0",
          "SEM APOSTA"
        ]);

        const serverStillUpdating =
          Boolean(serverDecision.updating) ||
          serverLine === "DADOS EM ATUALIZAÇÃO" ||
          serverLine === "ANALISANDO PARTIDA";

        // IMPORTANTE: "DADOS EM ATUALIZAÇÃO" não é uma decisão de SEM APOSTA.
        // Nessa situação deixamos o fallback do próprio Handicap, logo abaixo,
        // analisar odds/tabela/médias que já existirem no jogo.
        if (!serverStillUpdating) {
          return {
            skip:
              Boolean(serverDecision.skip) ||
              !validServerLines.has(serverLine),
            side,
            line:
              validServerLines.has(serverLine)
                ? serverLine
                : "SEM APOSTA",
            confidence: Number(serverDecision.confidence || 0),
            score: Number(serverDecision.score || 0),
            market_odd: Number(serverDecision.market_odd || 0) || null,
            teamName: clean(
              serverDecision.team,
              side === "home" ? game.home : game.away
            ),
            reason: clean(
              serverDecision.reason,
              "Decisão calculada pelo servidor."
            ),
            source: "server"
          };
        }
      }
      const homeOdds = handicapRawNumber(raw, [
        "home_od", "odds.home", "home_odd", "odd_home",
        "match_hometeam_odd", "odds.1", "odd1",
        "handicap_ai.odds.home"
      ]);
  
      const awayOdds = handicapRawNumber(raw, [
        "away_od", "odds.away", "away_odd", "odd_away",
        "match_awayteam_odd", "odds.2", "odd2",
        "handicap_ai.odds.away"
      ]);
  
      const homePos = handicapRawNumber(raw, [
        "pos_home", "home_position", "table.home.position",
        "standings.home.position", "posHome"
      ]);
  
      const awayPos = handicapRawNumber(raw, [
        "pos_away", "away_position", "table.away.position",
        "standings.away.position", "posAway"
      ]);
  
      const homeGoals = handicapRawNumber(raw, [
        "home_goals_avg", "home.avg_goals",
        "stats.home.goals_for_avg", "home_scored_avg",
        "homeGoalsAvg", "engine_profiles.home.goalsForAvg"
      ]);
  
      const awayGoals = handicapRawNumber(raw, [
        "away_goals_avg", "away.avg_goals",
        "stats.away.goals_for_avg", "away_scored_avg",
        "awayGoalsAvg", "engine_profiles.away.goalsForAvg"
      ]);
  
      const homeConcedes = handicapRawNumber(raw, [
        "home_concedes_avg", "stats.home.goals_against_avg",
        "homeConcedesAvg", "engine_profiles.home.goalsAgainstAvg"
      ]);
  
      const awayConcedes = handicapRawNumber(raw, [
        "away_concedes_avg", "stats.away.goals_against_avg",
        "awayConcedesAvg", "engine_profiles.away.goalsAgainstAvg"
      ]);
  
      const hasOdds = Number.isFinite(homeOdds) && Number.isFinite(awayOdds);
      const hasTable = Number.isFinite(homePos) && Number.isFinite(awayPos);
      const hasGoals = [homeGoals, awayGoals, homeConcedes, awayConcedes]
        .filter(Number.isFinite).length >= 3;
  
      const dataQuality =
        (hasOdds ? 2 : 0) +
        (hasTable ? 1 : 0) +
        (hasGoals ? 2 : 0);
  
      if (dataQuality < 3) {
        // Não converte um servidor ainda atualizando em "SEM APOSTA" falso.
        // Sem dados mínimos, mantém o estado de atualização para o próximo poll.
        return {
          skip: true,
          updating: true,
          side: "home",
          line: "DADOS EM ATUALIZAÇÃO",
          confidence: 0,
          score: -999,
          teamName: "",
          reason: "Aguardando a base estatística do Handicap Asiático."
        };
      }
  
      let homeScore = 0;
      let awayScore = 0;
      const reasons = [];
  
      if (hasOdds) {
        const homeProbability = 1 / Math.max(1.01, homeOdds);
        const awayProbability = 1 / Math.max(1.01, awayOdds);
        const oddsEdge = (homeProbability - awayProbability) * 100;
  
        homeScore += oddsEdge;
        awayScore -= oddsEdge;
        reasons.push("odds");
      }
  
      if (hasTable) {
        const tableEdge = (awayPos - homePos) * 1.5;
        homeScore += tableEdge;
        awayScore -= tableEdge;
        reasons.push("classificação");
      }
  
      if (hasGoals) {
        const homeExpected =
          ((homeGoals ?? 1.2) + (awayConcedes ?? 1.2)) / 2;
        const awayExpected =
          ((awayGoals ?? 1.1) + (homeConcedes ?? 1.1)) / 2;
  
        homeScore += (homeExpected - awayExpected) * 14;
        awayScore += (awayExpected - homeExpected) * 14;
        reasons.push("médias de gols");
      }
  
      homeScore += 2;
  
      const side = homeScore >= awayScore ? "home" : "away";
      const edge = Math.abs(homeScore - awayScore);
      const teamName = side === "home" ? game.home : game.away;
  
      let line = "";
      let confidence = 0;

      const favoriteOdd =
        side === "home" ? homeOdds : awayOdds;

      const underdogOdd =
        side === "home" ? awayOdds : homeOdds;

      const oddsGap =
        hasOdds
          ? Math.abs((underdogOdd ?? 0) - (favoriteOdd ?? 0))
          : 0;

      const tableGap =
        hasTable
          ? Math.abs(awayPos - homePos)
          : 0;

      const strongEvidence =
        Number(hasOdds) +
        Number(hasTable) +
        Number(hasGoals);

      if (
        edge >= 34 &&
        strongEvidence >= 2 &&
        (!hasOdds || favoriteOdd <= 1.65)
      ) {
        line = "-1.0";
        confidence = 79;
      } else if (
        edge >= 26 &&
        strongEvidence >= 2 &&
        (!hasOdds || favoriteOdd <= 1.82)
      ) {
        line = "-0.75";
        confidence = 75;
      } else if (
        edge >= 18 ||
        (tableGap >= 10 && oddsGap >= 0.55)
      ) {
        line = "-0.5";
        confidence = 71;
      } else if (
        edge >= 11 &&
        (
          strongEvidence >= 2 ||
          tableGap >= 7 ||
          oddsGap >= 0.38
        )
      ) {
        line = "-0.25";
        confidence = 67;
      } else if (
        edge >= 7 ||
        tableGap >= 4
      ) {
        line = "+0.25";
        confidence = 64;
      } else if (
        edge >= 4 &&
        hasOdds
      ) {
        line = "+0.5";
        confidence = 62;
      } else {
        return {
          skip: true,
          side,
          line: "SEM APOSTA",
          confidence: 0,
          score: edge,
          teamName,
          reason: "Confronto equilibrado: não há vantagem suficiente."
        };
      }

      confidence = Math.min(
        82,
        Math.round(confidence + Math.min(4, dataQuality - 3))
      );
  
      if (confidence < 62) {
        return {
          skip: true,
          side,
          line: "SEM APOSTA",
          confidence,
          score: edge,
          teamName,
          reason: "A vantagem calculada ficou abaixo do limite de segurança."
        };
      }
  
      return {
        skip: false,
        side,
        line,
        confidence,
        score: edge + dataQuality * 5,
        teamName,
        reason: `${teamName} ${line}: vantagem baseada em ${reasons.join(", ")}.`
      };
    }
  
    function handicapOdd(confidence) {
      return (1.53 + Math.max(0, 82 - confidence) / 100).toFixed(2);
    }
  
    function renderHandicapMarket(layer, selectedLine = "IA") {
      const body = $(".cpMobileMarketsBody", layer);
      if (!body) return;

      // V41 — IA restaurada; handicap_ai do servidor é a autoridade.
      const requestedLine = MARKET.handicap.lines.includes(selectedLine)
        ? selectedLine
        : "IA";

      const originalSourceGames =
        (Array.isArray(state.handicap) && state.handicap.length)
          ? state.handicap
          : (Array.isArray(state.pregame) ? state.pregame : []);

      const upcomingHandicapGames = originalSourceGames.filter(game => !handicapFinished(game));
      const sourceGames = upcomingHandicapGames.length
        ? upcomingHandicapGames
        : originalSourceGames;

      const realAvailableLines = [...new Set(
        sourceGames.flatMap(game => {
          const raw = game?.raw || {};
          const lines = raw?.handicap_available_lines;
          return Array.isArray(lines) ? lines : [];
        })
      )];

      const handicapUiLines = realAvailableLines.length
        ? ["IA", ...MARKET.handicap.lines.filter(line =>
            line !== "IA" && realAvailableLines.includes(line)
          )]
        : MARKET.handicap.lines;

      const safeRequestedLine = handicapUiLines.includes(requestedLine)
        ? requestedLine
        : "IA";

      let preparedGames = sourceGames
        .map((game, originalIndex) => ({
          game,
          originalIndex,
          recommendation: handicapAutoRecommendation(game)
        }));

      // V41 — decisão válida do servidor não é descartada apenas
      // porque outros jogos receberam a mesma linha/confiança.

      preparedGames = preparedGames
        .sort((a, b) => {
          if (a.recommendation.skip !== b.recommendation.skip) {
            return a.recommendation.skip ? 1 : -1;
          }
  
          return b.recommendation.score - a.recommendation.score;
        })
        .slice(0, 7);
  
      const settlementEntries = [];
      const liveEntries = [];
  
      const rows = preparedGames.map(({ game, originalIndex, recommendation }, rowIndex) => {
        const line = safeRequestedLine === "IA" ? recommendation.line : safeRequestedLine;
        const side = recommendation.side;
        const sideLabel = recommendation.skip
          ? "IA"
          : side === "home"
            ? "CASA"
            : "FORA";
        const teamName = side === "home" ? game.home : game.away;
        const confidence = recommendation.skip
          ? 0
          : safeRequestedLine === "IA"
            ? recommendation.confidence
            : Math.max(57, Math.min(88, recommendation.confidence - 2));

        const handicapRealOdd = Number(
          recommendation.market_odd ??
          game?.raw?.handicap_ai?.market_odd
        );
  
        const settlementKey = `handicap-${originalIndex}-${rowIndex}`;
        const rule = recommendation.skip
          ? {
              headline: recommendation.reason,
              details: [
                "O app não identificou vantagem segura.",
                "A partida permanece apenas para acompanhamento.",
                "Nenhuma entrada é recomendada."
              ]
            }
          : handicapLineRule(line, sideLabel);
  
        if (!recommendation.skip) {
          settlementEntries.push({
            key: settlementKey,
            game,
            marketType: "handicap",
            line,
            side
          });
        }
  
        const liveKey = `live-handicap-${originalIndex}-${rowIndex}`;
        liveEntries.push({
          key: liveKey,
          game,
          marketType: recommendation.skip ? "" : "handicap",
          line: recommendation.skip ? "" : line,
          side
        });
  
        const recommendationBadge = safeRequestedLine === "IA"
          ? `<span class="cpHandicapAutoBadge">✦ SUGESTÃO AUTOMÁTICA</span>`
          : "";
  
        return `
          <button
            type="button"
            class="cpHandicapOpportunity ${recommendation.skip ? "is-no-bet" : ""}"
            data-v9-game="${originalIndex}"
            data-settlement-key="${settlementKey}"
            data-settlement-market="handicap"
            data-settlement-line="${escapeHtml(line)}"
            data-settlement-side="${side}"
            data-live-key="${liveKey}"
          >
            <div class="cpHandicapMatch">
              <div class="cpHandicapMeta">
                ${marketLiveBadgeHtml(game, "handicap")}
                <small>⚽ Liga principal</small>
              </div>
              <div class="cpHandicapTeams">
                <span>${escapeHtml((game.home || "C").slice(0,2).toUpperCase())}</span>
                <section><b>${escapeHtml(game.home)}${cprMarketFavoriteStar(game.home)}</b><i>×</i><b>${escapeHtml(game.away)}${cprMarketFavoriteStar(game.away)}</b></section>
                <span>${escapeHtml((game.away || "F").slice(0,2).toUpperCase())}</span>
              </div>
            </div>
  
            <div class="cpHandicapPick">
              ${recommendationBadge}
              <strong>${recommendation.updating ? "AGUARDANDO DADOS" : recommendation.skip ? "SEM APOSTA" : `${sideLabel} ${escapeHtml(line)}`}</strong>
              <p>${recommendation.updating ? "A IA está concluindo a leitura deste confronto." : escapeHtml(rule.headline)}</p>
              <small>${escapeHtml(recommendation.reason)}</small>
              <span class="cpSettlementSlot"></span>
            </div>
  
            <div class="cpHandicapOdd">
              <small>${recommendation.skip ? "Decisão" : "Odd estimada"}</small>
              <b>${
                recommendation.skip
                  ? "—"
                  : Number.isFinite(handicapRealOdd) && handicapRealOdd > 1
                    ? handicapRealOdd.toFixed(2)
                    : handicapOdd(confidence)
              }</b>
            </div>
  
            <div class="cpHandicapGauge ${recommendation.skip ? "is-disabled" : ""}" style="--handicap:${confidence}">
              <span>${recommendation.skip ? "—" : `${confidence}%`}</span>
              <small>${recommendation.skip ? "SEM ENTRADA" : "CONFIANÇA"}</small>
            </div>
  
            <i class="cpHandicapArrow">›</i>
          </button>`;
      }).join("");
  
      const explanationLine =
        safeRequestedLine === "IA"
          ? (
              preparedGames.find(item => !item.recommendation?.skip)
                ?.recommendation?.line || "-0.5"
            )
          : safeRequestedLine;
      const explainRule = handicapLineRule(explanationLine, "TIME");
  
      body.innerHTML = `
        <section class="cpHandicapIntro">
          <div class="cpHandicapIntroIcon">⚖</div>
          <p>${safeRequestedLine === "IA" ? "A IA seleciona automaticamente o lado e a linha com melhor sustentação nos dados reais." : "Escolha a linha de handicap asiático que deseja analisar."}</p>
        </section>
  
        <div class="cpHandicapLines">
          ${handicapUiLines.map(item => `
            <button type="button" class="${item === safeRequestedLine ? "active" : ""}" data-handicap-line="${escapeHtml(item)}">${escapeHtml(item)}</button>
          `).join("")}
        </div>
  
        <section class="cpHandicapExplain">
          <h3>${`COMO FUNCIONA ${escapeHtml(safeRequestedLine)}?`}</h3>
          <div class="cpHandicapExplainGrid">
            <p>${
              safeRequestedLine === "IA"
                ? "O app compara favoritismo, posição na tabela, média de gols e força relativa. Depois sugere o lado e a linha com melhor equilíbrio entre risco e proteção."
                : escapeHtml(explainRule.headline)
            }</p>
            <article>
              <i>✓</i>
              <section>
                <b>GANHA</b>
                <span>${escapeHtml(explainRule.details[0])}</span>
              </section>
            </article>
            <article>
              <i>↔</i>
              <section>
                <b>DEVOLVE / PARCIAL</b>
                <span>${escapeHtml(explainRule.details[1])}</span>
              </section>
            </article>
            <article>
              <i>×</i>
              <section>
                <b>PERDE</b>
                <span>${escapeHtml(explainRule.details[2])}</span>
              </section>
            </article>
          </div>
        </section>
  
        <div class="cpHandicapTabs">
          <button type="button" class="active" data-handicap-side="all">TODOS</button>
          <button type="button" data-handicap-side="home">CASA</button>
          <button type="button" data-handicap-side="away">FORA</button>
        </div>
  
        <div class="cpHandicapTitle">
          <h2>MELHORES OPORTUNIDADES</h2>
          <button type="button">VER TODOS ›</button>
        </div>
  
        <div class="cpHandicapNotice">
          <b>Leitura do app:</b> as sugestões são análises estatísticas pré-jogo, não garantia de resultado.
        </div>
  
        <div class="cpHandicapList">${rows || '<div class="cpBttsEmpty">Nenhuma oportunidade disponível nesta linha.</div>'}</div>
  
        <button type="button" class="cpHandicapAllGames">
          <span>☷</span><b>${`VER TODOS OS JOGOS NESTA LINHA (${escapeHtml(safeRequestedLine)})`}</b><i>›</i>
        </button>
  
        <section class="cpHandicapBottomExplain">
          <h3>GUIA COMPLETO DAS LINHAS</h3>
          <div class="cpHandicapRulesTable">
            ${["-1.0","-0.75","-0.5","-0.25","+0.25","+0.5","+0.75","+1.0"].map(item => {
              const rule = handicapLineRule(item, "TIME");
              return `
                <article>
                  <b>${item}</b>
                  <p>${escapeHtml(rule.details.join(" "))}</p>
                </article>`;
            }).join("")}
          </div>
        </section>`;
  
      settlementRefreshCards(body, settlementEntries);
      marketStartLiveRefresh(body, liveEntries);
    }
  
  
    function analysisNumber(raw, paths, fallback = null) {
      for (const path of paths) {
        const value = path.split(".").reduce((obj, part) => obj?.[part], raw);
  
        if (value === null || value === undefined || value === "") {
          continue;
        }
  
        const normalized = String(value)
          .trim()
          .replace("%", "")
          .replace(",", ".");
  
        if (!normalized) continue;
  
        const number = Number(normalized);
  
        if (Number.isFinite(number)) return number;
      }
  
      return fallback;
    }
  
    function analysisLineNumber(line) {
      const match = String(line || "").match(/\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    }
  
    function analysisMarketTotal(game, marketType) {
      const raw = game?.raw || {};
  
      if (marketType === "goals") {
        const score = handicapScore(game);
        if (Number.isFinite(score.home) && Number.isFinite(score.away)) {
          return score.home + score.away;
        }
        return null;
      }
  
      if (marketType === "corners") {
        const home = analysisNumber(raw, [
          "home_corners", "corners_home", "corners.home",
          "statistics.home.corners", "stats.home.corners"
        ]);
        const away = analysisNumber(raw, [
          "away_corners", "corners_away", "corners.away",
          "statistics.away.corners", "stats.away.corners"
        ]);
        return Number.isFinite(home) && Number.isFinite(away) ? home + away : null;
      }
  
      if (marketType === "cards") {
        const home = analysisNumber(raw, [
          "home_cards", "cards_home", "cards.home",
          "yellow_cards.home", "statistics.home.cards"
        ]);
        const away = analysisNumber(raw, [
          "away_cards", "cards_away", "cards.away",
          "yellow_cards.away", "statistics.away.cards"
        ]);
        return Number.isFinite(home) && Number.isFinite(away) ? home + away : null;
      }
  
      return null;
    }
  
  
  
    let marketLiveTimer = null;
  
    function marketLiveStatus(stats = {}, game = {}) {
      const raw = stats?.raw || stats || {};
      const status = clean(
        raw.status ?? raw.status_raw ?? raw.match_status ??
        raw.event_status ?? game?.status ?? "",
        ""
      ).toLowerCase();
  
      const minuteValue =
        raw.minute ?? raw.match_minute ?? raw.match_live ??
        raw.elapsed ?? raw.timer ?? "";
  
      const minuteRaw = clean(minuteValue, "").toLowerCase();
      const minute = Number(
        String(minuteValue).replace(/[^\d]/g, "")
      );
  
      const finished =
        Boolean(raw.finished) ||
        /finished|full.?time|\bft\b|encerr|finaliz|ended/.test(status);
  
      const halftime =
        !finished && (
          Boolean(raw.halftime) ||
          Boolean(raw.half_time) ||
          Boolean(raw.is_halftime) ||
          /(^|\s)(ht|half.?time|halftime|intervalo|interval|break)(\s|$)/.test(status) ||
          /^(ht|half.?time|halftime|intervalo|interval|break)$/.test(minuteRaw)
        );
  
      const live =
        !finished && (
          halftime ||
          Boolean(raw.live) ||
          Number.isFinite(minute) && minute > 0 ||
          /live|ao vivo|andamento|1st|2nd/.test(status)
        );
  
      return {
        live,
        finished,
        halftime,
        minute: halftime
          ? "INTERVALO"
          : live
            ? (
                Number.isFinite(minute) && minute > 0
                  ? `${minute}'`
                  : "AO VIVO"
              )
            : ""
      };
    }
  
    function marketLiveBadgeHtml(game, marketType = "") {
      const info = marketLiveStatus(game?.raw || {}, game);
  
      if (info.live) {
        const minuteText =
          marketType === "handicap" &&
          info.minute === "AO VIVO"
            ? ""
            : info.minute;
  
        return `
          <span class="cpMarketLiveSlot is-live">
            <i></i>
            <b>AO VIVO</b>
            ${minuteText
              ? `<strong>${escapeHtml(minuteText)}</strong>`
              : ""}
          </span>`;
      }
  
      if (info.finished) {
        return `
          <span class="cpMarketLiveSlot is-finished">
            <b>ENCERRADO</b>
          </span>`;
      }
  
      return `
        <span class="cpMarketLiveSlot is-scheduled">
          <i>◷</i>
          <b>${escapeHtml(game?.time || "—")}</b>
        </span>`;
    }
  
    async function marketRefreshLiveCard(card, game, marketType = "") {
      if (!card || !game) return;
  
      const slot = card.querySelector(".cpMarketLiveSlot");
      if (!slot) return;
  
      const matchId = settlementMatchId(game);
      if (!matchId) return;
  
      try {
        const response = await getJson(
          `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&_=${Date.now()}`,
          12000
        );
  
        const stats = settlementResponseData(response);
        const info = marketLiveStatus(stats, game);
  
        slot.classList.toggle("is-live", info.live);
        slot.classList.toggle("is-finished", info.finished);
  
        if (info.live) {
          slot.classList.remove("is-scheduled", "is-finished");
          slot.classList.add("is-live");
  
          const minuteText =
            marketType === "handicap" &&
            info.minute === "AO VIVO"
              ? ""
              : info.minute;
  
          slot.innerHTML =
            `<i></i><b>AO VIVO</b>` +
            (
              minuteText
                ? `<strong>${escapeHtml(minuteText)}</strong>`
                : ""
            );
        } else if (info.finished) {
          slot.classList.remove("is-scheduled", "is-live");
          slot.classList.add("is-finished");
          slot.innerHTML = `<b>ENCERRADO</b>`;
        } else {
          slot.classList.remove("is-live", "is-finished");
          slot.classList.add("is-scheduled");
          slot.innerHTML = `<i>◷</i><b>${escapeHtml(game?.time || "—")}</b>`;
        }
      } catch (error) {
        console.warn("[Corner Pro Live Market]", error);
      }
    }
  
    function marketStartLiveRefresh(container, entries) {
      if (marketLiveTimer) clearInterval(marketLiveTimer);
  
      const refresh = () => {
        for (const entry of entries || []) {
          const card = container?.querySelector(`[data-live-key="${entry.key}"]`);
  
          marketRefreshLiveCard(
            card,
            entry.game,
            entry.marketType || ""
          );
  
          if (entry.marketType && entry.line) {
            settlementRefreshCard(
              card,
              entry.game,
              entry.marketType,
              entry.line,
              entry.side || ""
            );
          }
        }
      };
  
      refresh();
      marketLiveTimer = setInterval(refresh, 30000);
    }
  
    function settlementMatchId(game) {
      const raw = game?.raw || {};
  
      return clean(
        raw.match_id ??
        raw.fixture_id ??
        raw.event_id ??
        raw.event_key ??
        raw.id ??
        game?.id,
        ""
      );
    }
  
    function settlementResponseData(response) {
      return response?.data ?? response?.result ?? response?.match ?? response?.game ?? response ?? {};
    }
  
    function settlementMergeGame(game, stats) {
      const raw = game?.raw || {};
      const score = stats?.score || {};
      const goals = stats?.goals || {};
      const corners = stats?.corners || {};
      const cards = stats?.cards || {};
      const yellowCards = stats?.yellow_cards || {};
      const statistics = stats?.statistics || {};
  
      return {
        ...game,
        raw: {
          ...raw,
          ...stats,
          status: stats?.status ?? stats?.status_raw ?? stats?.match_status ?? raw.status ?? raw.match_status,
          match_status: stats?.match_status ?? stats?.status ?? stats?.status_raw ?? raw.match_status,
          finished: Boolean(stats?.finished) || Boolean(raw.finished),
  
          home_score: stats?.home_score ?? stats?.score_home ?? goals?.home ?? score?.home ?? raw.home_score ?? raw.score_home,
          away_score: stats?.away_score ?? stats?.score_away ?? goals?.away ?? score?.away ?? raw.away_score ?? raw.score_away,
  
          home_corners: stats?.home_corners ?? stats?.corners_home ?? corners?.home ?? statistics?.home?.corners ?? raw.home_corners ?? raw.corners_home,
          away_corners: stats?.away_corners ?? stats?.corners_away ?? corners?.away ?? statistics?.away?.corners ?? raw.away_corners ?? raw.corners_away,
  
          home_cards: stats?.home_cards ?? stats?.cards_home ?? cards?.home ?? yellowCards?.home ?? statistics?.home?.cards ?? raw.home_cards ?? raw.cards_home,
          away_cards: stats?.away_cards ?? stats?.cards_away ?? cards?.away ?? yellowCards?.away ?? statistics?.away?.cards ?? raw.away_cards ?? raw.cards_away
        }
      };
    }
  
    async function settlementFreshGame(game) {
      const matchId = settlementMatchId(game);
      if (!matchId) return game;
  
      try {
        const response = await getJson(
          `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&_=${Date.now()}`,
          16000
        );
  
        const stats = settlementResponseData(response);
        if (!stats || typeof stats !== "object" || stats.error) return game;
  
        return settlementMergeGame(game, stats);
      } catch (error) {
        console.warn("[Corner Pro Settlement]", error);
        return game;
      }
    }
  
    function settlementBadgeHtml(result) {
      const map = {
        win: ["green", "✓ GREEN"],
        loss: ["red", "× RED"],
        push: ["push", "↔ DEVOLVIDA"],
        half_win: ["half-win", "½ GREEN"],
        half_loss: ["half-loss", "½ RED"]
      };
  
      const item = map[result];
      if (!item) return "";
  
      return `<span class="cpSettlementBadge ${item[0]}">${item[1]}</span>`;
    }
  
    function settlementCalculate(game, marketType, line, side = "") {
      if (marketType === "handicap") {
        return handicapSettlement(game, side || "home", line);
      }
  
      if (marketType === "btts") {
        const normalized = String(line || "").toUpperCase();
        return analysisSettlement(
          game,
          "goals",
          normalized.includes("NÃO") ? "AMBAS NÃO" : "AMBAS SIM"
        );
      }
  
      return analysisSettlement(game, marketType, line);
    }
  
    async function settlementRefreshCard(card, game, marketType, line, side = "") {
      if (!card || !game) return;
  
      const slot = card.querySelector(".cpSettlementSlot");
      if (!slot) return;
  
      const freshGame = await settlementFreshGame(game);
      const result = settlementCalculate(freshGame, marketType, line, side);
  
      slot.innerHTML = settlementBadgeHtml(result);

      if (result && marketType === "btts") {
        const residual = card.querySelector(".cpBttsPick > b");
        if (residual) {
          residual.textContent = "";
          residual.hidden = true;
        }
      }
  
      card.classList.toggle("is-settlement-green", result === "win" || result === "half_win");
      card.classList.toggle("is-settlement-red", result === "loss" || result === "half_loss");
      card.classList.toggle("is-settlement-push", result === "push");
    }
  
    function settlementRefreshCards(container, entries) {
      if (!container || !Array.isArray(entries)) return;
  
      for (const entry of entries) {
        const card = container.querySelector(`[data-settlement-key="${entry.key}"]`);
        settlementRefreshCard(card, entry.game, entry.marketType, entry.line, entry.side || "");
      }
    }
  
    function analysisSettlement(game, marketType, line) {
      if (!handicapFinished(game)) return null;
  
      const normalized = String(line || "").toUpperCase();
      const total = analysisMarketTotal(game, marketType);
      const threshold = analysisLineNumber(normalized);
  
      if (normalized.includes("AMBAS SIM")) {
        const score = handicapScore(game);
        if (!Number.isFinite(score.home) || !Number.isFinite(score.away)) return null;
        return score.home > 0 && score.away > 0 ? "win" : "loss";
      }
  
      if (normalized.includes("AMBAS NÃO")) {
        const score = handicapScore(game);
        if (!Number.isFinite(score.home) || !Number.isFinite(score.away)) return null;
        return score.home === 0 || score.away === 0 ? "win" : "loss";
      }
  
      if (!Number.isFinite(total) || !Number.isFinite(threshold)) return null;
  
      if (normalized.includes("OVER")) return total > threshold ? "win" : "loss";
      if (normalized.includes("UNDER")) return total < threshold ? "win" : "loss";
  
      return null;
    }
  
    function analysisRule(marketType, line) {
      const normalized = String(line || "").toUpperCase();
      const threshold = analysisLineNumber(normalized);
  
      if (marketType === "goals") {
        if (normalized.includes("AMBAS SIM")) {
          return {
            headline: "As duas equipes precisam marcar.",
            win: "Cada time marca pelo menos um gol.",
            lose: "Uma ou as duas equipes terminam sem marcar.",
            reading: "Boa opção quando os dois ataques produzem e as defesas cedem oportunidades."
          };
        }
  
        if (normalized.includes("AMBAS NÃO")) {
          return {
            headline: "Pelo menos uma equipe precisa terminar sem marcar.",
            win: "Uma das equipes não faz gol.",
            lose: "As duas equipes marcam.",
            reading: "Boa opção quando existe defesa forte ou ataque pouco produtivo."
          };
        }
  
        const isOver = normalized.includes("OVER");
        return {
          headline: isOver
            ? `A partida precisa terminar com ${Math.floor(threshold) + 1} ou mais gols.`
            : `A partida precisa terminar com no máximo ${Math.ceil(threshold) - 1} gols.`,
          win: isOver
            ? `Total de gols acima de ${threshold}.`
            : `Total de gols abaixo de ${threshold}.`,
          lose: isOver
            ? `Total de gols igual ou abaixo de ${threshold}.`
            : `Total de gols igual ou acima de ${threshold}.`,
          reading: isOver
            ? "O app procura ataques produtivos, defesas vulneráveis e jogos com ritmo ofensivo."
            : "O app procura jogos controlados, ataques modestos e defesas consistentes."
        };
      }
  
      if (marketType === "corners") {
        const firstHalf = normalized.includes("1ºT");
        const isOver = normalized.includes("OVER");
  
        return {
          headline: firstHalf
            ? `O primeiro tempo precisa ter ${Math.floor(threshold) + 1} ou mais escanteios.`
            : isOver
              ? `A partida precisa ter ${Math.floor(threshold) + 1} ou mais escanteios.`
              : `A partida precisa ter no máximo ${Math.ceil(threshold) - 1} escanteios.`,
          win: isOver
            ? `Total de escanteios acima de ${threshold}.`
            : `Total de escanteios abaixo de ${threshold}.`,
          lose: isOver
            ? `Total igual ou abaixo de ${threshold}.`
            : `Total igual ou acima de ${threshold}.`,
          reading: "O app analisa pressão pelas laterais, cruzamentos, finalizações bloqueadas e médias recentes de cantos."
        };
      }
  
      const isOver = normalized.includes("OVER");
      return {
        headline: isOver
          ? `A partida precisa ter ${Math.floor(threshold) + 1} ou mais cartões.`
          : `A partida precisa ter no máximo ${Math.ceil(threshold) - 1} cartões.`,
        win: isOver
          ? `Total de cartões acima de ${threshold}.`
          : `Total de cartões abaixo de ${threshold}.`,
        lose: isOver
          ? `Total igual ou abaixo de ${threshold}.`
          : `Total igual ou acima de ${threshold}.`,
        reading: "O app considera rivalidade, faltas, intensidade, importância da partida e média disciplinar."
      };
    }
  
    function analysisStableHash(value) {
      let hash = 2166136261;
  
      for (const char of String(value || "")) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
  
      return Math.abs(hash >>> 0);
    }
  
    function analysisIdentity(game, marketType, salt = "") {
      const raw = game?.raw || {};
  
      const source = [
        game?.home,
        game?.away,
        game?.time,
        raw.match_id,
        raw.fixture_id,
        raw.event_id,
        raw.match_date,
        marketType,
        salt
      ].filter(Boolean).join("|");
  
      return analysisStableHash(source);
    }
  
    function analysisFactor(game, marketType, salt = "") {
      return (analysisIdentity(game, marketType, salt) % 10000) / 9999;
    }
  
    function analysisHasStarted(game) {
      const raw = game?.raw || {};
  
      const status = clean(
        raw.status ??
        raw.match_status ??
        raw.event_status ??
        raw.fixture_status ??
        game?.status,
        ""
      ).toLowerCase();
  
      const minute = Number(
        raw.match_minute ??
        raw.match_live ??
        raw.minute ??
        raw.elapsed
      );
  
      return Boolean(raw.live || raw.finished) ||
        Number.isFinite(minute) && minute > 0 ||
        /live|ao vivo|andamento|1st|2nd|half|interval|finished|full.?time|\bft\b|encerr|finaliz/.test(status);
    }
  
    function analysisExplicitNumber(raw, paths) {
      for (const path of paths) {
        const value = path.split(".").reduce((obj, part) => obj?.[part], raw);
  
        if (value === null || value === undefined || value === "") continue;
  
        const number = Number(String(value).replace("%", "").replace(",", "."));
  
        if (Number.isFinite(number)) return number;
      }
  
      return null;
    }
  
    function analysisCurrentStats(game, marketType) {
      const raw = game?.raw || {};
  
      if (!analysisHasStarted(game)) {
        return { total: null, home: null, away: null };
      }
  
      if (marketType === "goals") {
        const home = analysisExplicitNumber(raw, [
          "home_score",
          "score_home",
          "match_hometeam_score",
          "goals.home",
          "score.home"
        ]);
  
        const away = analysisExplicitNumber(raw, [
          "away_score",
          "score_away",
          "match_awayteam_score",
          "goals.away",
          "score.away"
        ]);
  
        return {
          total: Number.isFinite(home) && Number.isFinite(away) ? home + away : null,
          home,
          away
        };
      }
  
      if (marketType === "corners") {
        const home = analysisExplicitNumber(raw, [
          "home_corners",
          "corners_home",
          "corners.home",
          "statistics.home.corners",
          "stats.home.corners"
        ]);
  
        const away = analysisExplicitNumber(raw, [
          "away_corners",
          "corners_away",
          "corners.away",
          "statistics.away.corners",
          "stats.away.corners"
        ]);
  
        return {
          total: Number.isFinite(home) && Number.isFinite(away) ? home + away : null,
          home,
          away
        };
      }
  
      if (marketType === "cards") {
        const home = analysisExplicitNumber(raw, [
          "home_cards",
          "cards_home",
          "cards.home",
          "yellow_cards.home",
          "statistics.home.cards",
          "home_yellow_cards"
        ]);
  
        const away = analysisExplicitNumber(raw, [
          "away_cards",
          "cards_away",
          "cards.away",
          "yellow_cards.away",
          "statistics.away.cards",
          "away_yellow_cards"
        ]);
  
        return {
          total: Number.isFinite(home) && Number.isFinite(away) ? home + away : null,
          home,
          away
        };
      }
  
      return { total: null, home: null, away: null };
    }
  
    function analysisLineFromTotal(marketType, total, projection, game) {
      const effective = Number.isFinite(total) ? total : projection;
  
      if (marketType === "corners") {
        if (effective >= 12.2) return "OVER 11.5";
        if (effective >= 11.1) return "OVER 10.5";
        if (effective >= 10.0) return "OVER 9.5";
        if (effective >= 8.9) return "OVER 8.5";
        return "UNDER 9.5";
      }
  
      if (marketType === "goals") {
        // V46 — "Ambas Marcam" é um mercado separado.
        // Esta tela trabalha apenas com linhas de gols OVER/UNDER.
        if (effective >= 3.55) return "OVER 3.5";
        if (effective >= 2.65) return "OVER 2.5";
        if (effective >= 1.75) return "OVER 1.5";
        return "UNDER 2.5";
      }
  
      if (marketType === "cards") {
        if (effective >= 5.6) return "OVER 5.5";
        if (effective >= 4.6) return "OVER 4.5";
        if (effective >= 3.6) return "OVER 3.5";
        if (effective >= 2.6) return "OVER 2.5";
        return "UNDER 4.5";
      }
  
      return "";
    }
  
  
  
    function selectedMarketDateIsFuture() {
      let today;
  
      try {
        today =
          typeof todayAM_YMD === "function"
            ? todayAM_YMD()
            : new Date().toISOString().slice(0, 10);
      } catch (_) {
        today = new Date().toISOString().slice(0, 10);
      }
  
      try {
        return mobileMarketDate() > today;
      } catch (_) {
        return false;
      }
    }
  
    function cornerLocalLineLockKey(game) {
      const raw = game?.raw || {};
  
      const id =
        raw?.match_id ??
        raw?.event_key ??
        raw?.event_raw?.match_id ??
        game?.id ??
        `${game?.home || ""}|${game?.away || ""}|${game?.time || ""}`;
  
      return `cornerProPregameLine:v4-server-authority:${String(id)}`;
    }
  
    function readCornerLocalLineLock(game) {
      try {
        return JSON.parse(
          localStorage.getItem(
            cornerLocalLineLockKey(game)
          ) || "null"
        );
      } catch (_) {
        return null;
      }
    }
  
    function writeCornerLocalLineLock(game, decision) {
      try {
        localStorage.setItem(
          cornerLocalLineLockKey(game),
          JSON.stringify({
            line: decision.line,
            projection: decision.projection,
            confidence: decision.confidence,
            reason: decision.reason,
            saved_at: new Date().toISOString()
          })
        );
      } catch (_) {}
    }
  
    function applyCornerLocalLineLock(game, decision) {
      if (!decision) return decision;
  
      const status = marketLiveStatus(game);
      const futureDate = selectedMarketDateIsFuture();
  
      if (
        futureDate &&
        (
          decision.line === "ANALISANDO PARTIDA" ||
          decision.line === "DADOS EM ATUALIZAÇÃO" ||
          decision.future_waiting_data ||
          decision.updating
        )
      ) {
        try {
          localStorage.removeItem(
            cornerLocalLineLockKey(game)
          );
        } catch (_) {}
  
        return {
          ...decision,
          skip: true,
          line: "ANALISANDO PARTIDA"
        };
      }
  
      const existing = readCornerLocalLineLock(game);
  
      const validLine =
        /^(OVER|UNDER)\s+(8\.5|9\.5|10\.5|11\.5)$/.test(
          String(decision.line || "").toUpperCase()
        );
  
      if (!status.live && !status.finished && validLine && !decision.skip) {
        if (!existing?.line) {
          writeCornerLocalLineLock(game, decision);
  
          return {
            ...decision,
            pregame_locked: true,
            local_pregame_locked: true
          };
        }
  
        return {
          ...decision,
          line: existing.line,
          projection: existing.projection,
          confidence: existing.confidence,
          reason:
            `${existing.reason || decision.reason} Primeira linha pré-jogo mantida.`,
          skip: false,
          pregame_locked: true,
          local_pregame_locked: true
        };
      }
  
      if ((status.live || status.finished) && existing?.line) {
        return {
          ...decision,
          line: existing.line,
          projection: existing.projection,
          confidence: existing.confidence,
          reason:
            `${existing.reason || decision.reason} Linha pré-jogo preservada após o início.`,
          skip: false,
          pregame_locked: true,
          local_pregame_locked: true
        };
      }
  
      return decision;
    }
  
    function analysisProjection(game, marketType) {
      const raw = game?.raw || {};
      const serverDecision = raw?.[`${marketType}_ai`];
  
      if (serverDecision && typeof serverDecision === "object") {
        let serverLine = clean(
          serverDecision.line,
          "SEM APOSTA"
        ).toUpperCase();
  
        if (
          marketType === "goals" &&
          serverLine.includes("AMBAS")
        ) {
          serverLine = "SEM APOSTA";
        }
  
        if (
          marketType !== "goals" &&
          marketType !== "btts" &&
          serverLine.includes("AMBAS")
        ) {
          serverLine = "SEM APOSTA";
        }
  
        if (
          marketType === "corners" &&
          serverLine !== "DADOS EM ATUALIZAÇÃO" &&
          serverLine !== "ANALISANDO PARTIDA" &&
          !/^(OVER|UNDER)\s+(8\.5|9\.5|10\.5|11\.5)$/.test(serverLine)
        ) {
          serverLine = "SEM APOSTA";
        }
  
        const serverRecommendation = {
          line: serverLine,
          projection: Number(
            serverDecision.projection || 0
          ).toFixed(1),
          confidence: Number(
            serverDecision.confidence || 0
          ),
          reason: clean(
            serverDecision.reason,
            "Decisão calculada pelo motor do servidor."
          ),
          skip:
            Boolean(serverDecision.skip) ||
            serverLine === "SEM APOSTA" ||
            serverLine === "ANALISANDO PARTIDA",
          source: "server",
          pregame_locked:
            Boolean(serverDecision.pregame_locked),
          pregame_locked_at:
            serverDecision.pregame_locked_at || null,
          learning_samples:
            Number(serverDecision.learning_samples || 0),
          calculation_source:
            clean(
              serverDecision.calculation_source ??
              serverDecision.extra?.calculation_source,
              ""
            ),
          sample_games:
            Number(
              serverDecision.sample_games ??
              serverDecision.extra?.sample_games ??
              0
            ),
          robust_under_evidence:
            Boolean(
              serverDecision.robust_under_evidence ??
              serverDecision.extra?.robust_under_evidence
            ),
          updating:
            Boolean(serverDecision.updating),
          future_waiting_data:
            Boolean(serverDecision.future_waiting_data),
          future_data_ready:
            Boolean(serverDecision.future_data_ready)
        };
  
        // V11: decisões vindas do servidor NÃO passam por uma segunda
        // trava em localStorage. O server é a única autoridade do lock
        // pré-jogo de Escanteios.
        return serverRecommendation;
      }
      const originalConfidence = Number(game?.confidence || 68);
      const current = analysisCurrentStats(game, marketType);
  
      const factorA = analysisFactor(game, marketType, "A");
      const factorB = analysisFactor(game, marketType, "B");
      const factorC = analysisFactor(game, marketType, "C");
  
      if (marketType === "goals") {
        const homeFor = analysisNumber(raw, [
          "home_goals_avg",
          "home.avg_goals",
          "stats.home.goals_for_avg",
          "home_scored_avg",
          "homeGoalsAvg"
        ]);
  
        const awayFor = analysisNumber(raw, [
          "away_goals_avg",
          "away.avg_goals",
          "stats.away.goals_for_avg",
          "away_scored_avg",
          "awayGoalsAvg"
        ]);
  
        const homeAgainst = analysisNumber(raw, [
          "home_concedes_avg",
          "stats.home.goals_against_avg",
          "homeConcedesAvg"
        ]);
  
        const awayAgainst = analysisNumber(raw, [
          "away_concedes_avg",
          "stats.away.goals_against_avg",
          "awayConcedesAvg"
        ]);
  
        const available = [homeFor, awayFor, homeAgainst, awayAgainst]
          .filter(Number.isFinite);
  
        const statisticalBase = available.length
          ? available.reduce((sum, value) => sum + value, 0) / Math.max(2, available.length / 2)
          : 1.45 + factorA * 2.65;
  
        const identityAdjustment =
          (factorB - .5) * 1.05 +
          (factorC - .5) * .55;
  
        let projection = statisticalBase + identityAdjustment;
  
        if (Number.isFinite(current.total)) {
          projection = Math.max(current.total, projection);
        }
  
        projection = Math.max(1.1, Math.min(4.8, projection));
  
        const line = analysisLineFromTotal(
          marketType,
          current.total,
          projection,
          game
        );
  
        const distance =
          line.includes("3.5") ? Math.abs(projection - 3.5) :
          line.includes("2.5") ? Math.abs(projection - 2.5) :
          Math.abs(projection - 1.5);
  
        const confidence = Math.round(Math.max(58, Math.min(89,
          62 + distance * 9 + (originalConfidence - 68) * .18 + factorC * 4
        )));
  
        return {
          line,
          projection: projection.toFixed(1),
          confidence,
          reason: Number.isFinite(current.total)
            ? `O jogo já possui ${current.total} gol${current.total === 1 ? "" : "s"}; a linha foi atualizada para ${line}.`
            : `Projeção própria de ${projection.toFixed(1)} gols para este confronto, considerando perfil ofensivo, defesa e contexto.`
        };
      }
  
      if (marketType === "corners") {
        const homeCreates = analysisNumber(raw, [
          "home_corners_avg",
          "stats.home.corners_for_avg",
          "homeCornersAvg"
        ]);
  
        const awayCreates = analysisNumber(raw, [
          "away_corners_avg",
          "stats.away.corners_for_avg",
          "awayCornersAvg"
        ]);
  
        const homeAllows = analysisNumber(raw, [
          "home_corners_against_avg",
          "stats.home.corners_against_avg"
        ]);
  
        const awayAllows = analysisNumber(raw, [
          "away_corners_against_avg",
          "stats.away.corners_against_avg"
        ]);
  
        const available = [homeCreates, awayCreates, homeAllows, awayAllows]
          .filter(Number.isFinite);
  
        const statisticalBase = available.length
          ? available.reduce((sum, value) => sum + value, 0) / 2
          : 8.4 + factorA * 4.4;
  
        const identityAdjustment =
          (factorB - .5) * 1.8 +
          (factorC - .5) * 1.1;
  
        let projection = statisticalBase + identityAdjustment;
  
        if (Number.isFinite(current.total)) {
          projection = Math.max(current.total, projection);
        }
  
        projection = Math.max(7.0, Math.min(14.8, projection));
  
        const line = analysisLineFromTotal(
          marketType,
          current.total,
          projection,
          game
        );
  
        const lineValue = analysisLineNumber(line) || 9.5;
        const confidence = Math.round(Math.max(59, Math.min(90,
          63 + Math.abs(projection - lineValue) * 7 +
          (originalConfidence - 68) * .18 +
          factorC * 4
        )));
  
        const calculatedCornerDecision = {
          line,
          projection: projection.toFixed(1),
          confidence,
          reason: Number.isFinite(current.total)
            ? `A partida está em andamento. A linha pré-jogo original será preservada.`
            : `Projeção própria de ${projection.toFixed(1)} escanteios para este jogo, usando pressão, criação e perfil das equipes.`,
          skip: false,
          source: "calculated"
        };
  
        const lockedCornerDecision =
          applyCornerLocalLineLock(
            game,
            calculatedCornerDecision
          );
  
        if (
          marketLiveStatus(game).live &&
          !lockedCornerDecision?.pregame_locked
        ) {
          return {
            ...calculatedCornerDecision,
            line: "SEM RECOMENDAÇÃO PRÉ-JOGO",
            confidence: 0,
            skip: true,
            reason:
              "O jogo já começou e nenhuma linha pré-jogo foi registrada. O app não criará uma nova entrada ao vivo."
          };
        }
  
        return lockedCornerDecision;
      }
  
      const homeCards = analysisNumber(raw, [
        "home_cards_avg",
        "stats.home.cards_avg",
        "homeCardsAvg"
      ]);
  
      const awayCards = analysisNumber(raw, [
        "away_cards_avg",
        "stats.away.cards_avg",
        "awayCardsAvg"
      ]);
  
      const refereeCards = analysisNumber(raw, [
        "referee_cards_avg",
        "referee.cards_avg",
        "cardsRefAvg"
      ]);
  
      const available = [homeCards, awayCards, refereeCards]
        .filter(Number.isFinite);
  
      const statisticalBase = available.length
        ? available.reduce((sum, value) => sum + value, 0) /
          (available.length === 3 ? 1.5 : 1)
        : 2.35 + factorA * 4.15;
  
      const identityAdjustment =
        (factorB - .5) * 1.15 +
        (factorC - .5) * .75;
  
      let projection = statisticalBase + identityAdjustment;
  
      if (Number.isFinite(current.total)) {
        projection = Math.max(current.total, projection);
      }
  
      projection = Math.max(2.0, Math.min(7.2, projection));
  
      const line = analysisLineFromTotal(
        marketType,
        current.total,
        projection,
        game
      );
  
      const lineValue = analysisLineNumber(line) || 3.5;
      const confidence = Math.round(Math.max(58, Math.min(89,
        61 + Math.abs(projection - lineValue) * 8 +
        (originalConfidence - 68) * .17 +
        factorC * 4
      )));
  
      return {
        line,
        projection: projection.toFixed(1),
        confidence,
        reason: Number.isFinite(current.total)
          ? `O jogo já registra ${current.total} cartões; a recomendação mudou automaticamente para ${line}.`
          : `Projeção própria de ${projection.toFixed(1)} cartões, considerando intensidade, disciplina e contexto.`
      };
    }
  
    function analysisMarketName(marketType) {
      if (marketType === "goals") return "GOLS";
      if (marketType === "corners") return "ESCANTEIOS";
      return "CARTÕES";
    }
  
    function analysisMarketIcon(marketType) {
      if (marketType === "goals") return "⚽";
      if (marketType === "corners") return "⚑";
      return "▯";
    }
  
    function analysisOdd(confidence, game = null, marketType = "") {
      const variation = game
        ? analysisFactor(game, marketType, "ODD") * .12
        : 0;
  
      return (
        1.48 +
        Math.max(0, 86 - confidence) / 100 +
        variation
      ).toFixed(2);
    }
  
    function renderDetailedMarket(layer, marketType, selectedLine = "IA") {
      const body = $(".cpMobileMarketsBody", layer);
      if (!body) return;
  
      const marketName = analysisMarketName(marketType);
      const icon = analysisMarketIcon(marketType);
      const requestedLine = clean(selectedLine, "IA");
      const sourceGames = state[marketType] || [];
  
      let prepared = sourceGames
        .map((game, originalIndex) => ({
          game,
          originalIndex,
          recommendation: analysisProjection(game, marketType)
        }))
        .sort((a, b) => {
          const projectionDiff =
            Number(b.recommendation.projection) -
            Number(a.recommendation.projection);
  
          if (Math.abs(projectionDiff) > 0.05) return projectionDiff;
  
          return b.recommendation.confidence - a.recommendation.confidence;
        })
        .slice(0, 7);
  
  
      const settlementEntries = [];
      const liveEntries = [];
  
      const rows = prepared.map(({ game, originalIndex, recommendation }, rowIndex) => {
        const line = requestedLine === "IA"
          ? recommendation.line
          : requestedLine;
  
        const isUpdating =
          requestedLine === "IA" &&
          (
            line === "DADOS EM ATUALIZAÇÃO" ||
            line === "ANALISANDO PARTIDA"
          );
  
        const isNoBet =
          requestedLine === "IA" &&
          (
            recommendation.skip ||
            line === "SEM APOSTA"
          );
  
        const confidence = isNoBet
          ? 0
          : requestedLine === "IA"
            ? recommendation.confidence
            : Math.max(56, recommendation.confidence - 3);
  
        const rule = analysisRule(marketType, line);
        const settlementKey = `analysis-${marketType}-${originalIndex}-${rowIndex}`;
  
        if (!isNoBet) {
          settlementEntries.push({
            key: settlementKey,
            game,
            marketType,
            line,
            side: ""
          });
        }
  
        const liveKey = `live-${marketType}-${originalIndex}-${rowIndex}`;
        liveEntries.push({
          key: liveKey,
          game,
          marketType,
          line,
          side: ""
        });
  
        return `
          <button
            type="button"
            class="cpAnalysisOpportunity ${isUpdating ? "is-updating" : isNoBet ? "is-no-bet" : ""}"
            data-v9-game="${originalIndex}"
            data-settlement-key="${settlementKey}"
            data-settlement-market="${marketType}"
            data-settlement-line="${escapeHtml(line)}"
            data-live-key="${liveKey}"
          >
            <div class="cpAnalysisMatch">
              <div class="cpAnalysisMeta">
                ${marketLiveBadgeHtml(game)}
                <small>${icon} Liga principal</small>
              </div>
              <div class="cpAnalysisTeams">
                <span>${escapeHtml((game.home || "C").slice(0,2).toUpperCase())}</span>
                <section><b>${escapeHtml(game.home)}${cprMarketFavoriteStar(game.home)}</b><i>×</i><b>${escapeHtml(game.away)}${cprMarketFavoriteStar(game.away)}</b></section>
                <span>${escapeHtml((game.away || "F").slice(0,2).toUpperCase())}</span>
              </div>
            </div>
  
            <div class="cpAnalysisPick">
              ${requestedLine === "IA"
                ? `<span class="cpAnalysisAutoBadge">${
                    marketType === "corners" &&
                    recommendation.source === "server"
                      ? (
                          isUpdating
                            ? "✦ IA • COLETANDO DADOS"
                            : recommendation.pregame_locked &&
                              (
                                marketLiveStatus(game).live ||
                                marketLiveStatus(game).finished
                              )
                              ? "✦ IA • LINHA PRÉ-JOGO"
                              : Number(
                                  recommendation.learning_samples || 0
                                ) >= 8
                                  ? "✦ IA • APRENDIZADO ATIVO"
                                  : "✦ IA DO SERVIDOR"
                        )
                      : recommendation.source === "server" &&
                        isUpdating
                        ? "✦ IA • COLETANDO DADOS"
                      : recommendation.source === "server"
                        ? "✦ IA DO SERVIDOR"
                        : recommendation.source === "table"
                          ? "✦ IA CONSERVADORA"
                          : "✦ SUGESTÃO AUTOMÁTICA"
                  }</span>`
                : ""}
              <strong>${
                isUpdating
                  ? "ANALISANDO PARTIDA"
                  : isNoBet
                    ? "SEM APOSTA"
                    : escapeHtml(line)
              }</strong>
              <p>${escapeHtml((isNoBet || isUpdating) ? recommendation.reason : rule.headline)}</p>
              <small>${escapeHtml(recommendation.reason)}</small>
              <span class="cpSettlementSlot"></span>
            </div>
  
            <div class="cpAnalysisOdd">
              <small>${(isNoBet || isUpdating) ? "Status" : "Odd estimada"}</small>
              <b>${(isNoBet || isUpdating) ? "—" : analysisOdd(confidence, game, marketType)}</b>
            </div>
  
            <div class="cpAnalysisGauge ${(isNoBet || isUpdating) ? "is-disabled" : ""}" style="--analysis:${confidence}">
              <span>${(isNoBet || isUpdating) ? "—" : `${confidence}%`}</span>
              <small>${isUpdating ? "AGUARDANDO DADOS" : isNoBet ? "SEM ENTRADA" : "CONFIANÇA"}</small>
            </div>
  
            <i class="cpAnalysisArrow">›</i>
          </button>`;
      }).join("");
  
      const explanationLine = requestedLine === "IA"
        ? (prepared[0]?.recommendation.line || MARKET[marketType].lines[1])
        : requestedLine;
  
      const explainRule = analysisRule(marketType, explanationLine);
  
      body.innerHTML = `
        <section class="cpAnalysisIntro">
          <div class="cpAnalysisIntroIcon">${icon}</div>
          <p>${marketType === "corners"
            ? `Use <b>IA</b> para o app selecionar automaticamente a melhor linha de escanteios, ou escolha uma linha manualmente.`
            : `Escolha uma linha ou use <b>IA</b> para o app selecionar automaticamente a melhor leitura pré-jogo de ${marketName.toLowerCase()}.`
          }</p>
        </section>
  
        <div class="cpAnalysisLines">
          ${MARKET[marketType].lines.map(item => `
            <button type="button" class="${item === requestedLine ? "active" : ""}"
              data-analysis-market="${marketType}"
              data-analysis-line="${escapeHtml(item)}">
              ${item === "IA" ? "✦ IA" : escapeHtml(item)}
            </button>
          `).join("")}
        </div>
  
        <section class="cpAnalysisExplain">
          <h3>${requestedLine === "IA"
            ? `COMO FUNCIONA A IA DE ${marketName}?`
            : `COMO FUNCIONA ${escapeHtml(requestedLine)}?`
          }</h3>
  
          <div class="cpAnalysisExplainGrid">
            <p>${requestedLine === "IA"
              ? escapeHtml(explainRule.reading)
              : escapeHtml(explainRule.headline)
            }</p>
  
            <article>
              <i>✓</i>
              <section><b>APOSTA GANHA</b><span>${escapeHtml(explainRule.win)}</span></section>
            </article>
  
            <article>
              <i>×</i>
              <section><b>APOSTA PERDIDA</b><span>${escapeHtml(explainRule.lose)}</span></section>
            </article>
  
            <article>
              <i>✦</i>
              <section><b>LEITURA DO APP</b><span>${escapeHtml(explainRule.reading)}</span></section>
            </article>
          </div>
        </section>
  
        <div class="cpAnalysisTabs">
          <button type="button" class="active">TODOS</button>
          <button type="button">${marketType === "goals" ? "OVERS" : "LINHAS ALTAS"}</button>
          <button type="button">${marketType === "goals" ? "UNDERS" : "LINHAS SEGURAS"}</button>
        </div>
  
        <div class="cpAnalysisTitle">
          <h2>${requestedLine === "IA" ? "SUGESTÕES PRÉ-JOGO" : "MELHORES OPORTUNIDADES"}</h2>
          <button type="button">VER TODOS ›</button>
        </div>
  
        <div class="cpAnalysisNotice">
          <b>Análise estatística:</b> o app cruza médias recentes, contexto e força das equipes. Não representa garantia de resultado.
        </div>
  
        <div class="cpAnalysisList">${rows || '<div class="cpBttsEmpty">Nenhuma oportunidade disponível nesta linha.</div>'}</div>
  
        <button type="button" class="cpAnalysisAllGames">
          <span>☷</span>
          <b>${requestedLine === "IA"
            ? `VER TODAS AS SUGESTÕES DE ${marketName}`
            : `VER TODOS OS JOGOS EM ${escapeHtml(requestedLine)}`
          }</b>
          <i>›</i>
        </button>
  
        <section class="cpAnalysisBottomExplain">
          <h3>GUIA DAS LINHAS DE ${marketName}</h3>
          <div>
            ${MARKET[marketType].lines.filter(item => item !== "IA").map(item => {
              const rule = analysisRule(marketType, item);
              return `
                <article>
                  <b>${escapeHtml(item)}</b>
                  <p>${escapeHtml(rule.headline)} ${escapeHtml(rule.win)}</p>
                </article>`;
            }).join("")}
          </div>
        </section>`;
  
      settlementRefreshCards(body, settlementEntries);
      marketStartLiveRefresh(body, liveEntries);
    }
  

    let instantMarketRetryTimer = null;
    let instantMarketRetryCount = 0;

    function marketStillWaiting(type) {
      const list = Array.isArray(state[type]) ? state[type] : [];
      if (!list.length) return true;

      const field = ENGINE_DECISION_FIELD[type];
      return list.some(item => {
        const raw = item?.raw || item || {};
        const decision = raw?.[field];
        if (!decision || typeof decision !== "object") return true;

        const line = clean(decision.line, "").toUpperCase();
        return Boolean(decision.updating) ||
          !line ||
          line === "DADOS EM ATUALIZAÇÃO" ||
          line === "ANALISANDO PARTIDA";
      });
    }

    function stopInstantMarketRetry() {
      if (instantMarketRetryTimer) {
        clearTimeout(instantMarketRetryTimer);
        instantMarketRetryTimer = null;
      }
      instantMarketRetryCount = 0;
    }

    async function refreshInstantMarket(type, immediate = false) {
      if (!["btts", "handicap"].includes(type)) return;

      const date = state.date || todayManaus();
      const layer = $("#cpMobileMarketsLayer");
      const isOpen = Boolean(
        layer &&
        (layer.classList.contains("is-open") ||
         layer.getAttribute("aria-hidden") === "false")
      );

      if (!isOpen && !immediate) return;

      const stamp = Date.now();

      try {
        const payload = await getJson(
          `/market_engines_fast?date=${encodeURIComponent(date)}&_mobile=${stamp}&v=58`,
          18000
        );

        if (state.date !== date || !payload || typeof payload !== "object") return;

        const rawGames = extract(payload?.[type]);
        if (rawGames.length) {
          state[type] = buildMarket(rawGames, type);

          if (type === "btts") {
            renderBttsMarket(layer);
          } else {
            const activeLine =
              $(".cpHandicapLines button.active", layer)?.dataset?.handicapLine ||
              "IA";
            renderHandicapMarket(layer, activeLine);
          }
        }
      } catch (error) {
        console.warn(`[Corner Pro ${type} instant retry]`, error?.message || error);
      }

      if (
        state.activeMarket === type &&
        marketStillWaiting(type) &&
        instantMarketRetryCount < 5
      ) {
        instantMarketRetryCount += 1;
        instantMarketRetryTimer = setTimeout(
          () => refreshInstantMarket(type),
          3500
        );
      } else {
        stopInstantMarketRetry();
      }
    }


    let handicapOnlyV61RequestId = 0;

    async function refreshHandicapOnlyV61() {
      const layer = $("#cpMobileMarketsLayer");
      if (!layer) return;

      const date = state.date || todayManaus();
      const requestId = ++handicapOnlyV61RequestId;

      try {
        const payload = await getJson(
          `/handicap_engine_v61?date=${encodeURIComponent(date)}&_=${Date.now()}`,
          24000
        );

        if (
          requestId !== handicapOnlyV61RequestId ||
          state.activeMarket !== "handicap" ||
          state.date !== date
        ) {
          return;
        }

        const rawGames = extract(payload?.handicap);

        if (rawGames.length) {
          state.handicap = buildMarket(rawGames, "handicap");

          const activeLine =
            $(".cpHandicapLines button.active", layer)?.dataset?.handicapLine ||
            "IA";

          renderHandicapMarket(layer, activeLine);
          return;
        }

        // V61 — nunca apaga os cards do Handicap apenas porque a API
        // não publicou linha AH direta naquele instante.
        // O servidor agora devolve fallback conservador por 1X2 quando possível.
        const body = $(".cpMobileMarketsBody", layer);
        if (
          body &&
          (!Array.isArray(state.handicap) || !state.handicap.length)
        ) {
          body.innerHTML = `
            <section class="cpHandicapNotice" style="margin:18px 0">
              <b>HANDICAP ASIÁTICO:</b>
              não há partidas pré-jogo com dados mínimos disponíveis neste momento.
            </section>`;
        }
      } catch (error) {
        console.warn("[Corner Pro Handicap V61]", error?.message || error);
      }
    }

    function openMarkets(type = state.activeMarket) {
      if (marketLiveTimer) {
        clearInterval(marketLiveTimer);
        marketLiveTimer = null;
      }
  
      const marketType = MARKET[type] ? type : "pregame";
      state.activeMarket = marketType;
      const layer = $("#cpMobileMarketsLayer");
      const meta = MARKET[marketType];
      if (!layer) return;
  
      const setText = (selector, value) => {
        const element = $(selector);
        if (element) element.textContent = value;
      };
  
      setText("#cpMobileMarketsTitle", meta.label);
      setText("#cpMobileMarketIcon", meta.icon);
      setText("#cpMobileMarketHeading", `Mercados de ${meta.label.toLowerCase()}`);
  
      const body = $(".cpMobileMarketsBody", layer);
      if (body && !body.dataset.defaultHtml) body.dataset.defaultHtml = body.innerHTML;
  
      try {
        if (marketType === "btts") {
          renderBttsMarket(layer);
          stopInstantMarketRetry();
          refreshInstantMarket("btts", true).catch(() => {});
        } else if (marketType === "handicap") {
          renderHandicapMarket(layer, "IA");
          refreshHandicapOnlyV61().catch(() => {});
        } else if (["goals", "corners", "cards"].includes(marketType)) {
          renderDetailedMarket(
            layer,
            marketType,
            marketType === "corners" ? MARKET.corners.lines[0] : "IA"
          );
        } else {
          if (body?.dataset.defaultHtml) body.innerHTML = body.dataset.defaultHtml;
        const grid = $("#cpMobileOddsGrid");
          if (grid) {
            grid.innerHTML = meta.lines.map(item => `
              <button type="button" data-v9-line="${escapeHtml(item)}">
                <b>${escapeHtml(item)}</b><small>VER JOGOS</small>
              </button>`).join("");
          }
        }
      } catch (error) {
        console.error("[Corner Pro Markets]", error);
  
        if (body) {
          body.innerHTML = `
            <section class="cpMarketOpenError">
              <strong>NÃO FOI POSSÍVEL ABRIR O MERCADO</strong>
              <span>Atualize a página e tente novamente.</span>
            </section>`;
        }
      }
  
      $$("[data-cp-market]").forEach(button => {
        button.classList.toggle("active", button.dataset.cpMarket === marketType);
      });
  
      const recommended = $("#cpMobileRecommended");
      if (recommended) recommended.hidden = true;
      layer.classList.add("is-open");
      layer.setAttribute("aria-hidden", "false");
      document.body.classList.add("cpMobileLayerOpen");
      stopAutoSlide();
    }
  
    function showRecommended(lineValue) {
      const lineLabel = clean(lineValue, "MERCADO");
      const title = $("#cpMobileSelectedLine");
      if (title) title.textContent = lineLabel;
  
      const recommended = $("#cpMobileRecommended");
      if (recommended) recommended.hidden = false;
  
      const carousel = $("#cpMobileGameCarousel");
      if (carousel) {
        carousel.innerHTML = activeList().slice(0, 6).map((game, index) => `
          <button type="button" data-v9-game="${index}">
            <b>${escapeHtml(game.home)} × ${escapeHtml(game.away)}</b>
            <small>${escapeHtml(game.time)} • ${escapeHtml(lineLabel)}</small>
            <strong>${game.confidence}%</strong>
          </button>`).join("");
      }
      recommended?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  
    async function openMatch(game) {
      cprEnsureMatchCenterFavoriteStyles();
      if (!game) return;
  
      state.selected = game;
  
      const layer = $("#cpMobileMatchLayer");
      const content = $("#cpMobileMatchContent");
      const title = $("#cpMobileMatchTitle");
      const subtitle = $("#cpMobileMatchSubtitle");
  
      if (!layer || !content) return;
  
      if (state.matchPollTimer) {
        clearInterval(state.matchPollTimer);
        state.matchPollTimer = null;
      }
  
      layer.classList.add("is-open");
      layer.setAttribute("aria-hidden", "false");
      document.body.classList.add("cpMobileLayerOpen");
      stopAutoSlide();
  
      const raw = game.raw || {};
  
      const value = (...items) => {
        for (const item of items) {
          if (item === null || item === undefined || item === "") continue;
          const number = Number(String(item).replace("%", "").replace(",", "."));
          if (Number.isFinite(number)) return number;
        }
        return "—";
      };
  
      const resolvePhase = (stats = {}) => {
        const statusText = clean(
          stats.status ??
          stats.status_raw ??
          stats.match_status ??
          raw.status ??
          raw.match_status ??
          game.status,
          ""
        );
  
        const normalized = statusText.toLowerCase();
        const minute = value(
          stats.minute,
          stats.elapsed,
          stats.match_minute,
          raw.match_live,
          raw.match_minute
        );
  
        const rawStatusBundle = [
          stats.status,
          stats.status_raw,
          stats.original_raw,
          stats.match_status,
          raw.status,
          raw.match_status,
          raw.match_live,
          raw.match_minute,
          game.status
        ].filter(Boolean).join(" ").toLowerCase();
  
        const has90Plus = /(^|\D)90\+?(\D|$)/.test(rawStatusBundle);
  
        const gameDate = clean(
          raw.match_date ??
          raw.date ??
          raw.event_date,
          ""
        );
  
        const gameTime = clean(
          raw.match_time ??
          raw.time ??
          game.time,
          ""
        );
  
        let elapsedFromKickoff = null;
        if (gameDate && /^\d{1,2}:\d{2}/.test(gameTime)) {
          const kickoff = new Date(`${gameDate}T${gameTime.slice(0,5)}:00-04:00`);
          if (!Number.isNaN(kickoff.getTime())) {
            elapsedFromKickoff = Math.floor((Date.now() - kickoff.getTime()) / 60000);
          }
        }
  
        const finishedByClock =
          Number.isFinite(elapsedFromKickoff) &&
          (
            (has90Plus && elapsedFromKickoff >= 110) ||
            elapsedFromKickoff >= 195
          );
  
        const finished = Boolean(stats.finished) ||
          finishedByClock ||
          /finished|match finished|full.?time|\bft\b|encerr|finaliz|after pen|after extra|aet|ended/.test(normalized);
  
        const live = !finished && (
          Boolean(stats.live) ||
          /live|ao vivo|andamento|1st half|2nd half|half.?time|interval|in play|playing/.test(normalized) ||
          (minute !== "—" && Number(minute) > 0)
        );
  
        return {
          statusText: statusText || (finished ? "Finished" : live ? "Live" : "Not Started"),
          finished,
          live,
          minute
        };
      };
  
      const teamColor = (teamName, side = "home") => {
        const name = String(teamName || "").toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
  
        const known = [
          { keys: ["hacken", "bk hacken"], colors: ["#d5a928", "#111318"] },
          { keys: ["kalmar"], colors: ["#1769d2", "#de3340"] },
          { keys: ["wisla"], colors: ["#d72735", "#1d5fba"] },
          { keys: ["piast gliwice"], colors: ["#1b62aa", "#cf2534"] },
          { keys: ["fredrikstad"], colors: ["#d72f3d", "#f4f5f6"] },
          { keys: ["sandefjord"], colors: ["#195ca8", "#d62d37"] },
          { keys: ["falkirk"], colors: ["#263e8c", "#d43735"] },
          { keys: ["st. mirren", "st mirren"], colors: ["#d72f3d", "#111318"] },
          { keys: ["arsenal"], colors: ["#e3272d", "#f3f3f3"] },
          { keys: ["chelsea"], colors: ["#1454b8", "#f3f3f3"] },
          { keys: ["liverpool"], colors: ["#c8212b", "#20a56a"] },
          { keys: ["manchester city"], colors: ["#63aee0", "#f4f4f4"] },
          { keys: ["manchester united"], colors: ["#d92d2f", "#f4c542"] },
          { keys: ["real madrid"], colors: ["#edeef1", "#5f51b5"] },
          { keys: ["barcelona"], colors: ["#154f9c", "#a82434"] },
          { keys: ["inter"], colors: ["#1768c7", "#10141a"] },
          { keys: ["milan"], colors: ["#d42d38", "#111318"] },
          { keys: ["juventus"], colors: ["#e8e9eb", "#111318"] },
          { keys: ["palmeiras"], colors: ["#147844", "#f3f4f2"] },
          { keys: ["flamengo"], colors: ["#d42832", "#111318"] },
          { keys: ["corinthians"], colors: ["#e8e8e8", "#16191d"] }
        ];
  
        const found = known.find(item => item.keys.some(key => name.includes(key)));
        if (found) return found.colors[side === "home" ? 0 : 1];
  
        const palettes = [
          ["#2e75c7", "#d8424d"],
          ["#15876f", "#bd8538"],
          ["#6656b8", "#d75b7a"],
          ["#287f9e", "#c45142"],
          ["#4065a8", "#b17b32"],
          ["#28775d", "#a94455"]
        ];
  
        let hash = 0;
        for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        const palette = palettes[Math.abs(hash) % palettes.length];
        return palette[side === "home" ? 0 : 1];
      };
  
      const render = (stats = {}) => {
        const phase = resolvePhase(stats);
  
        if (title) {
          title.textContent = phase.finished
            ? "ESTATÍSTICAS FINAIS"
            : phase.live
              ? "MATCH CENTER AO VIVO"
              : "ANÁLISE PRÉ-JOGO";
        }
  
        if (subtitle) {
          subtitle.textContent = phase.finished
            ? "Resultado, cartões, escanteios, chutes e números completos"
            : phase.live
              ? "Placar, eventos e estatísticas atualizadas"
              : "Projeções, histórico e dados antes da partida";
        }
  
        const homeScore = value(
          stats.home_score,
          stats.score_home,
          stats.goals?.home,
          stats.score?.home,
          raw.home_score,
          raw.score_home
        );
  
        const awayScore = value(
          stats.away_score,
          stats.score_away,
          stats.goals?.away,
          stats.score?.away,
          raw.away_score,
          raw.score_away
        );
  
        const homeCorners = value(
          stats.home_corners,
          stats.corners_home,
          stats.corners?.home,
          stats.statistics?.home?.corners,
          raw.home_corners,
          raw.corners_home
        );
  
        const awayCorners = value(
          stats.away_corners,
          stats.corners_away,
          stats.corners?.away,
          stats.statistics?.away?.corners,
          raw.away_corners,
          raw.corners_away
        );
  
        const homeCards = value(
          stats.home_cards,
          stats.cards_home,
          stats.cards?.home,
          stats.yellow_cards?.home,
          stats.statistics?.home?.cards,
          raw.home_cards,
          raw.cards_home
        );
  
        const awayCards = value(
          stats.away_cards,
          stats.cards_away,
          stats.cards?.away,
          stats.yellow_cards?.away,
          stats.statistics?.away?.cards,
          raw.away_cards,
          raw.cards_away
        );
  
        const homeShots = value(
          stats.home_shots,
          stats.shots_home,
          stats.shots?.home,
          stats.statistics?.home?.shots,
          raw.home_shots,
          raw.shots_home
        );
  
        const awayShots = value(
          stats.away_shots,
          stats.shots_away,
          stats.shots?.away,
          stats.statistics?.away?.shots,
          raw.away_shots,
          raw.shots_away
        );
  
        const homeShotsTarget = value(
          stats.home_shots_on_target,
          stats.shots_on_target_home,
          stats.shots_on_target?.home,
          stats.statistics?.home?.shots_on_target,
          raw.home_shots_on_target
        );
  
        const awayShotsTarget = value(
          stats.away_shots_on_target,
          stats.shots_on_target_away,
          stats.shots_on_target?.away,
          stats.statistics?.away?.shots_on_target,
          raw.away_shots_on_target
        );
  
        const homePossession = value(
          stats.home_possession,
          stats.possession_home,
          stats.possession?.home,
          stats.statistics?.home?.possession,
          raw.home_possession
        );
  
        const awayPossession = value(
          stats.away_possession,
          stats.possession_away,
          stats.possession?.away,
          stats.statistics?.away?.possession,
          raw.away_possession
        );
  
        const homeAttacks = value(
          stats.home_dangerous_attacks,
          stats.dangerous_attacks?.home,
          stats.home_attacks,
          stats.attacks?.home
        );
  
        const awayAttacks = value(
          stats.away_dangerous_attacks,
          stats.dangerous_attacks?.away,
          stats.away_attacks,
          stats.attacks?.away
        );
  
        const phaseStatus = clean(
          stats.status ??
          stats.status_raw ??
          stats.match_status ??
          raw.status ??
          raw.match_status ??
          "",
          ""
        ).toLowerCase();
  
        const phaseMinuteRaw = clean(
          stats.minute ??
          stats.match_minute ??
          stats.match_live ??
          raw.minute ??
          raw.match_minute ??
          raw.match_live ??
          "",
          ""
        ).toLowerCase();
  
        const isHalftime =
          /(^|\s)(ht|half.?time|halftime|intervalo|interval|break)(\s|$)/.test(
            phaseStatus
          ) ||
          /^(ht|half.?time|halftime|intervalo|interval|break)$/.test(
            phaseMinuteRaw
          );
  
        const minuteLabel = phase.finished
          ? "ENCERRADO"
          : isHalftime
            ? "INTERVALO"
            : phase.live
              ? `${phase.minute !== "—" ? phase.minute + "'" : "AO VIVO"}`
              : escapeHtml(game.time);
  
        const settlementGame = settlementMergeGame(game, stats);
        const selectedMarket = game.selectedMarket || "";
        const selectedLine = game.selectedLine || game.line || "";
        const selectedSide = game.selectedSide || "";
  
        const settlementResult =
          phase.finished && selectedMarket
            ? settlementCalculate(
                settlementGame,
                selectedMarket,
                selectedLine,
                selectedSide
              )
            : null;
  
        const settlementHeroBadge = settlementBadgeHtml(settlementResult);
  
        const homeName = stats.home || game.home;
        const awayName = stats.away || game.away;
        const homeColor = teamColor(homeName, "home");
        const awayColor = teamColor(awayName, "away");
  
        content.style.setProperty("--mc-home", homeColor);
        content.style.setProperty("--mc-away", awayColor);
        content.dataset.phase = phase.finished ? "finished" : phase.live ? "live" : "pregame";
  
        content.innerHTML = `
          <section class="cpV8MatchHero">
            <time>${minuteLabel}</time>
            <div class="cpV8ScoreRow">
              <strong class="cpV8HomeTeam">
                <span class="cpMatchTeamName">${escapeHtml(homeName)}</span>
                ${cprMatchFavoriteButton(homeName, "home")}
              </strong>
              <i>${phase.live || phase.finished ? `${homeScore} × ${awayScore}` : "×"}</i>
              <strong class="cpV8AwayTeam">
                ${cprMatchFavoriteButton(awayName, "away")}
                <span class="cpMatchTeamName">${escapeHtml(awayName)}</span>
              </strong>
            </div>
            <span>${escapeHtml(selectedLine || game.line)}</span>
            <b>${escapeHtml(phase.statusText.toUpperCase())}</b>
            ${settlementHeroBadge ? `<div class="cpMatchSettlement">${settlementHeroBadge}</div>` : ""}
          </section>
  
          <section class="cpV8MatchTabs">
            <button class="${!phase.live && !phase.finished ? "active" : ""}" type="button">ANTES</button>
            <button class="${phase.live ? "active" : ""}" type="button">AO VIVO</button>
            <button class="${phase.finished ? "active" : ""}" type="button">DEPOIS</button>
          </section>
  
          <section class="cpV8MatchStats">
            <div data-stat="corners">
              <span class="cpV8StatIcon">⚑</span><small>ESCANTEIOS</small>
              <strong>${homeCorners} × ${awayCorners}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
            <div data-stat="cards">
              <span class="cpV8StatIcon">▯</span><small>CARTÕES</small>
              <strong>${homeCards} × ${awayCards}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
            <div data-stat="shots">
              <span class="cpV8StatIcon">◎</span><small>CHUTES</small>
              <strong>${homeShots} × ${awayShots}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
            <div data-stat="target">
              <span class="cpV8StatIcon">◉</span><small>NO ALVO</small>
              <strong>${homeShotsTarget} × ${awayShotsTarget}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
            <div data-stat="possession">
              <span class="cpV8StatIcon">◔</span><small>POSSE DE BOLA</small>
              <strong>${homePossession}${homePossession !== "—" ? "%" : ""} × ${awayPossession}${awayPossession !== "—" ? "%" : ""}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
            <div data-stat="danger">
              <span class="cpV8StatIcon">ϟ</span><small>ATAQUES PERIGOSOS</small>
              <strong>${homeAttacks} × ${awayAttacks}</strong>
              <em><span>${escapeHtml(homeName)}</span><span>${escapeHtml(awayName)}</span></em>
            </div>
          </section>
  
          <section class="cpV8MatchRead">
            <h3>${phase.finished ? "RESUMO DA PARTIDA" : phase.live ? "LEITURA AO VIVO" : "LEITURA PRÉ-JOGO"}</h3>
            <p>${
              phase.finished
                ? "Partida encerrada. Os números finais disponíveis aparecem acima."
                : phase.live
                  ? "A partida está em andamento. Esta tela atualiza automaticamente a cada 25 segundos."
                  : "A partida ainda não começou. Assim que iniciar, o Match Center mudará para AO VIVO."
            }</p>
          </section>`;
  
        return phase;
      };
  
      render(raw);
  
      const matchId = clean(
        raw.match_id ??
        raw.fixture_id ??
        raw.event_id ??
        raw.event_key ??
        raw.id ??
        game.id,
        ""
      );
  
      if (!matchId) return;
  
      const fetchMatchCenter = async () => {
        try {
          const response = await getJson(
            `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&_=${Date.now()}`,
            16000
          );
  
          const stats =
            response?.data ??
            response?.result ??
            response?.match ??
            response?.game ??
            response;
  
          if (!stats || typeof stats !== "object" || stats.error) return null;
  
          const phase = render(stats);
  
          if (phase.finished && state.matchPollTimer) {
            clearInterval(state.matchPollTimer);
            state.matchPollTimer = null;
          }
  
          return phase;
        } catch (error) {
          console.warn("[Corner Pro Match Center] Falha ao atualizar:", error);
          return null;
        }
      };
  
      const firstPhase = await fetchMatchCenter();
  
      if (!firstPhase?.finished) {
        state.matchPollTimer = setInterval(async () => {
          if (!layer.classList.contains("is-open")) {
            clearInterval(state.matchPollTimer);
            state.matchPollTimer = null;
            return;
          }
          await fetchMatchCenter();
        }, 25000);
      }
    }
  
    function closeLayer(layer) {
      if (layer?.id === "cpMobileMatchLayer" && state.matchPollTimer) {
        clearInterval(state.matchPollTimer);
        state.matchPollTimer = null;
      }
      layer?.classList.remove("is-open");
      layer?.setAttribute("aria-hidden", "true");
      const anyOpen = $("#cpMobileMarketsLayer")?.classList.contains("is-open") || $("#cpMobileMatchLayer")?.classList.contains("is-open");
      if (!anyOpen) {
        document.body.classList.remove("cpMobileLayerOpen");
        restartAutoSlide();
      }
    }
  
    function paintDate() {
      const [, month, day] = state.date.split("-");
      const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
      const monthEl = $(".cpHomeCalendarMonth");
      const dayEl = $(".cpHomeCalendarDay");
      if (monthEl) monthEl.textContent = months[Number(month) - 1] || "DATA";
      if (dayEl) dayEl.textContent = day || "--";
    }
  
    function setupDate() {
      const button = $(".cpHomeCalendar");
      if (!button) return;
  
      const months = [
        "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
        "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
      ];
  
      const week = ["D", "S", "T", "Q", "Q", "S", "S"];
  
      const pad = value => String(value).padStart(2, "0");
  
      const toYMD = date =>
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  
      const parseYMD = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
          return new Date();
        }
  
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
      };
  
      const sameDay = (first, second) =>
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate();
  
      let overlay = $("#cpAppCalendarOverlay");
  
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "cpAppCalendarOverlay";
        overlay.className = "cpAppCalendarOverlay";
        overlay.setAttribute("aria-hidden", "true");
  
        overlay.innerHTML = `
          <section class="cpAppCalendarPanel" role="dialog" aria-modal="true" aria-label="Escolher data">
            <header class="cpAppCalendarHeader">
              <button type="button" data-app-cal-close aria-label="Fechar calendário">‹</button>
              <div>
                <small>ESCOLHA UMA DATA</small>
                <strong data-app-cal-title>CALENDÁRIO</strong>
              </div>
              <button type="button" data-app-cal-today>HOJE</button>
            </header>
  
            <div class="cpAppCalendarNavigation">
              <button type="button" data-app-cal-prev aria-label="Mês anterior">‹</button>
              <strong data-app-cal-month></strong>
              <button type="button" data-app-cal-next aria-label="Próximo mês">›</button>
            </div>
  
            <div class="cpAppCalendarWeek">
              ${week.map(day => `<span>${day}</span>`).join("")}
            </div>
  
            <div class="cpAppCalendarGrid" data-app-cal-grid></div>
  
            <footer class="cpAppCalendarFooter">
              <span>Você pode consultar jogos passados e futuros.</span>
              <button type="button" data-app-cal-cancel>FECHAR</button>
            </footer>
          </section>
        `;
  
        document.body.appendChild(overlay);
      }
  
      let viewDate = parseYMD(state.date);
  
      const title = $("[data-app-cal-title]", overlay);
      const monthTitle = $("[data-app-cal-month]", overlay);
      const grid = $("[data-app-cal-grid]", overlay);
  
      const render = () => {
        const selected = parseYMD(state.date);
        const today = new Date();
  
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
  
        if (title) {
          title.textContent = `${pad(selected.getDate())} DE ${months[selected.getMonth()]}`;
        }
  
        if (monthTitle) {
          monthTitle.textContent = `${months[month]} ${year}`;
        }
  
        const firstDay = new Date(year, month, 1, 12, 0, 0);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());
  
        if (grid) {
          grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
            const current = new Date(start);
            current.setDate(start.getDate() + index);
  
            const classes = ["cpAppCalendarDay"];
  
            if (current.getMonth() !== month) classes.push("is-muted");
            if (sameDay(current, today)) classes.push("is-today");
            if (sameDay(current, selected)) classes.push("is-selected");
  
            const ymd = toYMD(current);
  
            return `
              <button
                type="button"
                class="${classes.join(" ")}"
                data-app-cal-day="${ymd}"
                aria-label="${current.getDate()} de ${months[current.getMonth()].toLowerCase()} de ${current.getFullYear()}"
              >
                ${current.getDate()}
              </button>
            `;
          }).join("");
        }
      };
  
      const open = () => {
        viewDate = parseYMD(state.date);
        render();
        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("cpAppCalendarOpen");
      };
  
      const close = () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("cpAppCalendarOpen");
      };
  
      const selectDate = async ymd => {
        if (!ymd || ymd === state.date) {
          close();
          return;
        }
  
        state.date = ymd;
  
        const hidden = $("#date");
        if (hidden) hidden.value = state.date;
  
        paintDate();
        close();
        stopAutoSlide();
  
        try {
          await loadData();
        } catch (error) {
          console.error("[Mobile Calendar]", error);
          showEmpty(
            "FALHA AO CARREGAR",
            "Não foi possível buscar os jogos desta data."
          );
        }
      };
  
      paintDate();
  
      button.setAttribute("type", "button");
      button.setAttribute("aria-label", "Abrir calendário de jogos");
  
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        open();
      });
  
      overlay.addEventListener("click", event => {
        const closeButton = event.target.closest(
          "[data-app-cal-close], [data-app-cal-cancel]"
        );
  
        if (closeButton) {
          event.preventDefault();
          close();
          return;
        }
  
        const todayButton = event.target.closest("[data-app-cal-today]");
  
        if (todayButton) {
          event.preventDefault();
          selectDate(todayManaus());
          return;
        }
  
        const previousButton = event.target.closest("[data-app-cal-prev]");
  
        if (previousButton) {
          event.preventDefault();
          viewDate = new Date(
            viewDate.getFullYear(),
            viewDate.getMonth() - 1,
            1,
            12,
            0,
            0
          );
          render();
          return;
        }
  
        const nextButton = event.target.closest("[data-app-cal-next]");
  
        if (nextButton) {
          event.preventDefault();
          viewDate = new Date(
            viewDate.getFullYear(),
            viewDate.getMonth() + 1,
            1,
            12,
            0,
            0
          );
          render();
          return;
        }
  
        const dayButton = event.target.closest("[data-app-cal-day]");
  
        if (dayButton) {
          event.preventDefault();
          selectDate(dayButton.dataset.appCalDay);
          return;
        }
  
        if (event.target === overlay) {
          close();
        }
      });
  
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("is-open")) {
          close();
        }
      });
    }
  
    function bind() {
      document.addEventListener("click", event => {
        const dot = event.target.closest("[data-cp-home-dot]");
        if (dot) {
          event.preventDefault();
          const targetMarket = dot.dataset.cpHomeDot;
          if (targetMarket && targetMarket !== "corners") {
            openMarkets(targetMarket);
          } else {
            state.activeMarket = "corners";
            renderActive({ animate: false });
          }
          return;
        }
  
        const matchFavorite = event.target.closest("[data-cpr-match-fav]");
        if (matchFavorite) {
          event.preventDefault();
          event.stopPropagation();

          const teamName = String(matchFavorite.dataset.cprMatchTeam || "").trim();
          if (!teamName) return;

          const active = cprToggleFavorite(teamName);

          document.querySelectorAll("[data-cpr-match-fav]").forEach(button => {
            if (
              cprNormalizeTeamKey(button.dataset.cprMatchTeam) !==
              cprNormalizeTeamKey(teamName)
            ) return;

            button.classList.toggle("is-active", active);
            button.textContent = active ? "★" : "☆";
            button.setAttribute("aria-pressed", active ? "true" : "false");
            button.setAttribute(
              "aria-label",
              active
                ? `Remover ${teamName} dos favoritos`
                : `Favoritar ${teamName}`
            );
            button.title = active
              ? `Remover ${teamName} dos favoritos`
              : `Favoritar ${teamName}`;
          });

          loadOfficialCornerTop1(state.date, Date.now(), { fresh: true }).catch(() => {});
          return;
        }

        const cprFavorite = event.target.closest("[data-cpr-fav]");
        if (cprFavorite) {
          event.preventDefault();
          event.stopPropagation();

          const best = activeList()[0];
          if (!best) return;

          const side = cprFavorite.dataset.cprFav;
          const teamName = side === "away" ? best.away : best.home;
          const active = cprToggleFavorite(teamName);

          cprFavorite.classList.toggle("is-active", active);
          cprFavorite.textContent = active ? "★" : "☆";
          cprFavorite.setAttribute("aria-pressed", active ? "true" : "false");
          cprFavorite.title = active
            ? `Remover ${teamName} dos favoritos`
            : `Favoritar ${teamName}`;

          loadOfficialCornerTop1(state.date, Date.now(), { fresh: true }).catch(() => {});
          return;
        }

        const homeMarket = event.target.closest("[data-home-market]");
        if (homeMarket) {
          event.preventDefault();
  
          const marketType = homeMarket.dataset.homeMarket;
  
          if (["handicap","btts","goals","corners","cards"].includes(marketType)) {
            openMarkets(marketType);
          }
          return;
        }
  
        const marketKind = event.target.closest("[data-cp-market]");
        if (marketKind) {
          event.preventDefault();
          openMarkets(marketKind.dataset.cpMarket);
          return;
        }
  
        const lineButton = event.target.closest("[data-v9-line], [data-v8-line]");
        if (lineButton) {
          event.preventDefault();
          showRecommended(lineButton.dataset.v9Line || lineButton.dataset.v8Line);
          return;
        }
  
        const analysisLine = event.target.closest("[data-analysis-line]");
        if (analysisLine) {
          event.preventDefault();
          renderDetailedMarket(
            $("#cpMobileMarketsLayer"),
            analysisLine.dataset.analysisMarket,
            analysisLine.dataset.analysisLine
          );
          return;
        }
  
        const handicapLine = event.target.closest("[data-handicap-line]");
        if (handicapLine) {
          event.preventDefault();
          renderHandicapMarket($("#cpMobileMarketsLayer"), handicapLine.dataset.handicapLine);
          return;
        }
  
        const handicapSide = event.target.closest("[data-handicap-side]");
        if (handicapSide) {
          event.preventDefault();
          $$(".cpHandicapTabs button").forEach(button => button.classList.toggle("active", button === handicapSide));
          const mode = handicapSide.dataset.handicapSide;
          $$(".cpHandicapOpportunity").forEach((card, index) => {
            const isAway = index % 3 === 1;
            card.hidden = mode === "home" ? isAway : mode === "away" ? !isAway : false;
          });
          return;
        }
  
        const bttsTab = event.target.closest("[data-btts-tab]");
        if (bttsTab) {
          event.preventDefault();

          const marketBody = bttsTab.closest(".cpMobileMarketsBody") || document;
          $$(".cpBttsTabs button", marketBody).forEach(button =>
            button.classList.toggle("active", button === bttsTab)
          );

          const mode = bttsTab.dataset.bttsTab;
          const cards = $$(".cpBttsOpportunity", marketBody);

          cards.forEach(card => {
            const choice = card.dataset.bttsChoice;
            const hasAiPick = card.dataset.bttsAi === "1";

            card.hidden =
              mode === "ai"
                ? !hasAiPick
                : mode === "yes"
                  ? choice !== "sim"
                  : mode === "no"
                    ? choice !== "não"
                    : false;
          });

          const empty = $(".cpBttsFilterEmpty", marketBody);
          if (empty) empty.hidden = cards.some(card => !card.hidden);

          return;
        }

        const gameButton = event.target.closest("[data-v9-game], [data-v8-game]");
        if (gameButton) {
          event.preventDefault();
  
          const index = Number(
            gameButton.dataset.v9Game ??
            gameButton.dataset.v8Game
          );
  
          const selectedMarket =
            gameButton.dataset.settlementMarket ||
            state.activeMarket;
  
          const selectedLine =
            gameButton.dataset.settlementLine ||
            "";
  
          const selectedSide =
            gameButton.dataset.settlementSide ||
            "";
  
          const source =
            state[selectedMarket] ||
            (selectedMarket === "btts" ? state.btts : null) ||
            activeList();
  
          const selectedGame =
            source?.[index] ||
            activeList()[index];
  
          if (selectedGame) {
            openMatch({
              ...selectedGame,
              line: selectedLine || selectedGame.line,
              selectedMarket,
              selectedLine,
              selectedSide
            });
          }
  
          return;
        }
  
        if (event.target.closest("#cpHomeBestOpen") || event.target.closest("#cpHomeMatchOpen")) {
          event.preventDefault();
          openMatch(activeList()[0]);
          return;
        }
  
        const closeButton = event.target.closest("[data-cp-close]");
        if (closeButton) {
          event.preventDefault();
          closeLayer(closeButton.closest(".cpMobileLayer"));
        }
      }, true);
  
      const card = $("#cpHomeBest");
      card?.addEventListener("touchstart", event => {
        const touch = event.touches[0];
        state.touchStartX = touch.clientX;
        state.touchStartY = touch.clientY;
        stopAutoSlide();
      }, { passive: true });
  
      card?.addEventListener("touchend", event => {
        const touch = event.changedTouches[0];
        const dx = touch.clientX - state.touchStartX;
        const dy = touch.clientY - state.touchStartY;
        if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy)) cycleMarket(dx < 0 ? 1 : -1);
        else restartAutoSlide();
      }, { passive: true });
  
      card?.addEventListener("mouseenter", stopAutoSlide);
      card?.addEventListener("mouseleave", startAutoSlide);
      document.addEventListener("visibilitychange", () => document.hidden ? stopAutoSlide() : startAutoSlide());
      mobileMedia.addEventListener?.("change", event => event.matches ? startAutoSlide() : stopAutoSlide());
    }
  
    async function start() {
      if (!mobileMedia.matches || !$("#cpMobileHome")) return;

      // V37 — ponte entre a lógica antiga (que já possui os jogos)
      // e a Home visual nova.
      let cprBridgeAttempts = 0;
      const cprBridgeTimer = setInterval(() => {
        cprBridgeAttempts += 1;

        if (cprHomeVisualReady || cprBridgeExistingGames() || cprBridgeAttempts >= 40) {
          clearInterval(cprBridgeTimer);
        }
      }, 250);

      const cprOpen = $("#cprOpen");
      if (cprOpen && !cprOpen.dataset.bound) {
        cprOpen.dataset.bound = "1";
        cprOpen.addEventListener("click", event => {
          event.preventDefault();
          const best = activeList()[0];
          if (best) openMatch(best);
        });
      }
      state.date = $("#date")?.value || todayManaus();
      const hiddenDate = $("#date");
      if (hiddenDate) hiddenDate.value = state.date;
      setupDate();
      bind();
      try {
        await loadData();
      } catch (error) {
        console.error("[Mobile V32]", error);
        showEmpty("FALHA AO CARREGAR", "O servidor não devolveu jogos válidos.");
      }
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  })();
  
  
      // script.js (PRO / COMPLETO) — PRÉ-JOGO + H2H ESCANTEIOS
        // ✅ Horário AMAZONAS (America/Manaus)
        // ✅ DEDUPE forte
        // ✅ FULL forte -> completa com SEMI forte
        // ✅ Destaque visual para favoritos
        // ✅ Segunda a sexta: 2 jogos no centro, em horários distintos
        // ✅ Sábado e domingo: 3 melhores jogos no centro, ordenados por horário
        // ✅ Dias úteis: Jogo 1 mais cedo + Jogo 2 mais tarde
        // ✅ Alinhado ao servidor: Top 5 pode entrar contra 6º ou pior; Top 5 x Top 5 é bloqueado
        // ✅ Chip de Ritmo IA
        // ✅ Chip de Alerta IA com 3 níveis
        // ✅ NOTE SEM REPETIÇÃO
        // ✅ H2H de escanteios no card principal
        // ✅ Aba FILTROS: Ambas marcam, +1.5, +2.5, +3.5 gols e linhas de escanteios
        // ✅ Filtros separados do motor principal: não altera a tela de 2 jogos do dia em cantos
  
        // ---------------- DOM ----------------
        const dateInput = document.getElementById("date");
  
      // Calendário premium personalizado — Corners Radar
      (function setupCustomDatePicker(){
        if (!dateInput) return;
  
        const wrap = document.getElementById("datePickerWrap");
        const picker = document.getElementById("customDatePicker");
        const icon = document.getElementById("datePickerIcon");
  
        if (!wrap || !picker) return;
  
        const MONTHS = [
          "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
          "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
        ];
  
        const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
        let closeTimer = null;
  
        function pad(n){
          return String(n).padStart(2, "0");
        }
  
        function toYMD(date){
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        }
  
        function parseYMD(value){
          if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
          const [y, m, d] = value.split("-").map(Number);
          return new Date(y, m - 1, d, 12, 0, 0);
        }
  
        function sameDay(a, b){
          return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
        }
  
        function clearCloseTimer(){
          if (closeTimer){
            clearTimeout(closeTimer);
            closeTimer = null;
          }
        }
  
        let viewDate = parseYMD(dateInput.value || toYMD(new Date()));
  
        function renderCalendar(){
          const selected = parseYMD(dateInput.value || toYMD(new Date()));
          const today = new Date();
  
          const year = viewDate.getFullYear();
          const month = viewDate.getMonth();
  
          const first = new Date(year, month, 1, 12, 0, 0);
          const start = new Date(first);
          start.setDate(first.getDate() - first.getDay());
  
          let html = `
            <div class="customDateHeader">
              <button class="customDateNav" type="button" data-cal-prev aria-label="Mês anterior">‹</button>
              <div class="customDateTitle">${MONTHS[month]} ${year}</div>
              <button class="customDateNav" type="button" data-cal-next aria-label="Próximo mês">›</button>
            </div>
  
            <div class="customDateWeek">
              ${WEEK.map(d => `<span>${d}</span>`).join("")}
            </div>
  
            <div class="customDateGrid">
          `;
  
          for (let i = 0; i < 42; i++){
            const day = new Date(start);
            day.setDate(start.getDate() + i);
  
            const classes = ["customDateDay"];
            if (day.getMonth() !== month) classes.push("is-muted");
            if (sameDay(day, today)) classes.push("is-today");
            if (sameDay(day, selected)) classes.push("is-selected");
  
            html += `<button class="${classes.join(" ")}" type="button" data-cal-day="${toYMD(day)}">${day.getDate()}</button>`;
          }
  
          html += `
            </div>
            <div class="customDateFooter">
              <button type="button" data-cal-today>HOJE</button>
              <button type="button" data-cal-close>FECHAR</button>
            </div>
          `;
  
          picker.innerHTML = html;
          picker.setAttribute("aria-hidden", "false");
        }
  
        function openCalendar(syncWithSelectedDate = false){
          clearCloseTimer();
  
          const alreadyOpen = wrap.classList.contains("is-open");
  
          if (syncWithSelectedDate || !alreadyOpen){
            viewDate = parseYMD(dateInput.value || toYMD(new Date()));
          }
  
          renderCalendar();
          wrap.classList.add("is-open");
          picker.setAttribute("aria-hidden", "false");
        }
  
        function closeCalendar(){
          clearCloseTimer();
          wrap.classList.remove("is-open");
          picker.setAttribute("aria-hidden", "true");
        }
  
        function scheduleCloseCalendar(){
          clearCloseTimer();
          closeTimer = setTimeout(() => {
            closeCalendar();
          }, 180);
        }
  
        function toggleCalendar(){
          if (wrap.classList.contains("is-open")) closeCalendar();
          else openCalendar(true);
        }
  
        function chooseDate(ymd){
          dateInput.value = ymd;
          dateInput.dispatchEvent(new Event("input", { bubbles:true }));
          dateInput.dispatchEvent(new Event("change", { bubbles:true }));
          closeCalendar();
        }
  
        wrap.addEventListener("mouseenter", () => {
          openCalendar(false);
        });
  
        wrap.addEventListener("mouseleave", () => {
          scheduleCloseCalendar();
        });
  
        picker.addEventListener("mouseenter", clearCloseTimer);
  
        dateInput.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openCalendar(true);
        });
  
        if (icon){
          icon.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCalendar();
          });
        }
  
        picker.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
  
          const prev = event.target.closest("[data-cal-prev]");
          const next = event.target.closest("[data-cal-next]");
          const day = event.target.closest("[data-cal-day]");
          const todayBtn = event.target.closest("[data-cal-today]");
          const closeBtn = event.target.closest("[data-cal-close]");
  
          if (prev){
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1, 12, 0, 0);
            renderCalendar();
            return;
          }
  
          if (next){
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1, 12, 0, 0);
            renderCalendar();
            return;
          }
  
          if (day){
            chooseDate(day.dataset.calDay);
            return;
          }
  
          if (todayBtn){
            chooseDate(toYMD(new Date()));
            return;
          }
  
          if (closeBtn){
            closeCalendar();
          }
        });
  
        document.addEventListener("click", (event) => {
          if (!wrap.contains(event.target)) closeCalendar();
        });
  
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") closeCalendar();
        });
      })();
        const btn = document.getElementById("btn");
        const top1El = document.getElementById("top1");
        const countTop = document.getElementById("countTop");
  
        // Templates
        const tplTop = document.getElementById("tplTopCard");
        const tplOther = document.getElementById("tplOtherCard");
  
        // ---- FILTROS / MERCADOS (NÃO ALTERA O MOTOR DOS 2 JOGOS DO DIA) ----
        let currentView = "filters"; // pregame | filters
        let lastRawGames = [];
        let lastDateYMD = "";
        let activeMarketFilter = "all";
        let filterSortMode = "market";
  
        // Cache separado para a aba FILTROS.
        // Assim os mercados de gols não dependem da lista já filtrada pelo motor de escanteios.
        let lastMarketGames = [];
        let lastMarketDateYMD = "";
        let loadingMarkets = false;
  
        // ---- IA Box (LEFTBAR) ----
        const iaBox = document.getElementById("iaBox");
        const iaStatus = document.getElementById("iaStatus");
        const iaReload = document.getElementById("iaReload");
        const iaGame = document.getElementById("iaGame");
        const iaSug = document.getElementById("iaSug");
        const iaConf = document.getElementById("iaConf");
        const iaWhy = document.getElementById("iaWhy");
        const iaRisk = document.getElementById("iaRisk");
  
        // ---- TOP Loading Bar ----
        const panelTitle = document.querySelector(".panel-title");
  
        // ---------------- CONFIG (PRÉ-JOGO) ----------------
        // ✅ CONTROLE DE CARDS NO TOPO
        // Segunda a sexta: 2 cards em horários distintos
        // Sábado e domingo: 3 cards com os melhores jogos, em ordem de horário
        const TOP_WEEKDAY_COUNT = 2;
        const TOP_WEEKEND_COUNT = 3;
  
        // ✅ distância mínima entre os dois jogos de segunda a sexta
        // 120 = evita jogos muito colados, tipo 15:00 e 15:30
        const WEEKDAY_MIN_TIME_GAP_MINUTES = 120;
  
        // =========================================================
        // ORDENACAO DOS DESTAQUES
        // "strength" = maior forca de cantos primeiro, sem considerar horario.
        // "time" = ordem cronologica, somente quando o usuario selecionar.
        // =========================================================
        const CORNER_ORDER_STORAGE_KEY = "cornerProGamesOrder";
        const DAILY_LOCK_STORAGE_PREFIX = "cornerProDailyLockedGames:v5:";
        let cornerGamesOrderMode = localStorage.getItem(CORNER_ORDER_STORAGE_KEY) === "time"
          ? "time"
          : "strength";
  
        function getCornerOrderMode(){
          return cornerGamesOrderMode;
        }
  
        function setCornerOrderMode(mode){
          cornerGamesOrderMode = mode === "time" ? "time" : "strength";
          localStorage.setItem(CORNER_ORDER_STORAGE_KEY, cornerGamesOrderMode);
          document.querySelectorAll("[data-corner-order]").forEach(button => {
            const active = button.dataset.cornerOrder === cornerGamesOrderMode;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
          });
        }
  
        function dailyLockKey(dateYMD){
          return `${DAILY_LOCK_STORAGE_PREFIX}${dateYMD || todayAM_YMD()}`;
        }
  
        function readLockedGames(dateYMD){
          try {
            const raw = localStorage.getItem(dailyLockKey(dateYMD));
            const parsed = raw ? JSON.parse(raw) : null;
            return Array.isArray(parsed?.games) ? parsed.games : [];
          } catch {
            return [];
          }
        }
  
        function writeLockedGames(dateYMD, games){
          try {
            localStorage.setItem(dailyLockKey(dateYMD), JSON.stringify({
              dateYMD,
              lockedAt: new Date().toISOString(),
              games: Array.isArray(games) ? games : []
            }));
          } catch (error) {
            console.warn("Nao foi possivel congelar os destaques do dia.", error);
          }
        }
  
        function orderGamesForSelectedFilter(list, dateYMD){
          const safe = dedupeList(Array.isArray(list) ? list : []);
          return getCornerOrderMode() === "time"
            ? sortGamesByAmazonasTime(safe, dateYMD)
            : sortByTop1AI(safe);
        }
  
        function isWeekendDateYMD(dateYMD){
          if (!dateYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) return false;
          const [y, m, d] = dateYMD.split("-").map(Number);
          const dt = new Date(y, m - 1, d, 12, 0, 0);
          const day = dt.getDay(); // 0 = domingo, 6 = sábado
          return day === 0 || day === 6;
        }
  
        function getTopTargetCount(dateYMD){
          return isWeekendDateYMD(dateYMD) ? TOP_WEEKEND_COUNT : TOP_WEEKDAY_COUNT;
        }
  
        const TOP6_MIN_PROB_FULL = 66;
        const TOP6_MIN_PROB_SEMI = 68;
        const TOP6_MIN_PROJ_SEMI = 10.6;
  
        const REQUIRE_GOOD_ODDS_ON_SEMI = false;
        const ODDS_MIN = 1.40;
        const ODDS_MAX = 1.85;
        const HIDE_NON_FULL_FROM_OTHERS = false;
  
        const TOP_GROUP_MAX_POSITION = 5;
        const BLOCK_TOP5_DIRECT_CLASH = true;
  
        // Top 5 só entra quando o jogo realmente apresenta qualidade para a linha de 10.5 escanteios.
        const TOP5_MIN_CORNER_PROJECTION = 10.5;
        const TOP5_MIN_CORNER_PROBABILITY = 70;
        const TOP5_BLOCK_CENTRAL_PROFILE = true;
  
        const SIDE_MAX_CARDS = 3;
        const LOADING_MIN_MS = 900;
  
        // ---------------- FAVORITOS (VISUAL) ----------------
        const FAVORITOS = []; // Brasil desativado: server focado em clubes europeus
        const FAVORITOS_CASA_APENAS = ["LASK", "Hoffenheim", "TSG Hoffenheim"];
  
        function normTeamName(s){
          return String(s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
  
        // ---------------- CORES POR TIME (SEM ESCUDO) ----------------
        // Aplica identidade visual automática no nome do clube.
        // Para adicionar mais clubes, basta incluir novas palavras-chave em TEAM_COLOR_RULES.
        function escapeHtmlLite(value){
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
        }
  
        function escapeAttrLite(value){
          return escapeHtmlLite(value);
        }
  
        const TEAM_COLOR_RULES = [
          // =========================
          // EUROPA — TOP 5 / PRINCIPAIS
          // =========================
  
          // ESPANHA / LA LIGA
          { cls:"team-brand-barcelona", keys:["barcelona", "fc barcelona"] },
          { cls:"team-brand-real-madrid", keys:["real madrid", "real madrio"] },
          { cls:"team-brand-atletico-madrid", keys:["atletico madrid", "atlético madrid", "atletico de madrid", "atlético de madrid"] },
          { cls:"team-brand-sevilla", keys:["sevilla"] },
          { cls:"team-brand-valencia", keys:["valencia"] },
          { cls:"team-brand-betis", keys:["betis", "real betis"] },
          { cls:"team-brand-villarreal", keys:["villarreal"] },
          { cls:"team-brand-real-sociedad", keys:["real sociedad"] },
          { cls:"team-brand-athletic-bilbao", keys:["athletic bilbao", "athletic club"] },
          { cls:"team-brand-celta", keys:["celta", "celta vigo"] },
          { cls:"team-brand-girona", keys:["girona"] },
          { cls:"team-brand-osasuna", keys:["osasuna"] },
          { cls:"team-brand-espanyol", keys:["espanyol"] },
          { cls:"team-brand-getafe", keys:["getafe"] },
          { cls:"team-brand-mallorca", keys:["mallorca"] },
          { cls:"team-brand-rayo", keys:["rayo", "rayo vallecano"] },
  
          // INGLATERRA / PREMIER LEAGUE + CHAMPIONSHIP
          { cls:"team-brand-man-city", keys:["manchester city", "man city"] },
          { cls:"team-brand-man-united", keys:["manchester united", "man united", "man utd"] },
          { cls:"team-brand-liverpool", keys:["liverpool"] },
          { cls:"team-brand-arsenal", keys:["arsenal"] },
          { cls:"team-brand-chelsea", keys:["chelsea"] },
          { cls:"team-brand-tottenham", keys:["tottenham", "spurs"] },
          { cls:"team-brand-newcastle", keys:["newcastle"] },
          { cls:"team-brand-aston-villa", keys:["aston villa"] },
          { cls:"team-brand-west-ham", keys:["west ham"] },
          { cls:"team-brand-brighton", keys:["brighton"] },
          { cls:"team-brand-crystal-palace", keys:["crystal palace"] },
          { cls:"team-brand-everton", keys:["everton"] },
          { cls:"team-brand-fulham", keys:["fulham"] },
          { cls:"team-brand-wolves", keys:["wolves", "wolverhampton"] },
          { cls:"team-brand-leeds", keys:["leeds", "leeds united"] },
          { cls:"team-brand-leicester", keys:["leicester"] },
          { cls:"team-brand-southampton", keys:["southampton"] },
          { cls:"team-brand-burnley", keys:["burnley"] },
          { cls:"team-brand-sunderland", keys:["sunderland"] },
          { cls:"team-brand-middlesbrough", keys:["middlesbrough"] },
          { cls:"team-brand-sheffield", keys:["sheffield united", "sheffield wed", "sheffield wednesday"] },
  
          // ALEMANHA / BUNDESLIGA
          { cls:"team-brand-bayern", keys:["bayern", "bayern munich", "bayern munchen", "bayern münchen"] },
          { cls:"team-brand-dortmund", keys:["dortmund", "borussia dortmund"] },
          { cls:"team-brand-leipzig", keys:["rb leipzig", "leipzig"] },
          { cls:"team-brand-leverkusen", keys:["leverkusen", "bayer leverkusen"] },
          { cls:"team-brand-frankfurt", keys:["frankfurt", "eintracht frankfurt"] },
          { cls:"team-brand-stuttgart", keys:["stuttgart"] },
          { cls:"team-brand-hoffenheim", keys:["hoffenheim", "tsg hoffenheim"] },
          { cls:"team-brand-wolfsburg", keys:["wolfsburg"] },
          { cls:"team-brand-gladbach", keys:["gladbach", "borussia monchengladbach", "borussia mönchengladbach"] },
          { cls:"team-brand-freiburg", keys:["freiburg"] },
          { cls:"team-brand-mainz", keys:["mainz"] },
          { cls:"team-brand-union-berlin", keys:["union berlin"] },
          { cls:"team-brand-werder", keys:["werder", "werder bremen"] },
          { cls:"team-brand-koln", keys:["koln", "köln", "fc koln", "fc köln"] },
          { cls:"team-brand-hamburg", keys:["hamburg", "hamburger sv", "hsv"] },
  
          // ITÁLIA / SERIE A
          { cls:"team-brand-juventus", keys:["juventus", "juve"] },
          { cls:"team-brand-milan", keys:["ac milan", "milan"] },
          { cls:"team-brand-inter-milan", keys:["inter milan", "internazionale", "inter de milao", "inter milão"] },
          { cls:"team-brand-napoli", keys:["napoli"] },
          { cls:"team-brand-roma", keys:["roma", "as roma"] },
          { cls:"team-brand-lazio", keys:["lazio"] },
          { cls:"team-brand-atalanta", keys:["atalanta"] },
          { cls:"team-brand-fiorentina", keys:["fiorentina"] },
          { cls:"team-brand-bologna", keys:["bologna"] },
          { cls:"team-brand-torino", keys:["torino"] },
          { cls:"team-brand-genoa", keys:["genoa"] },
          { cls:"team-brand-sampdoria", keys:["sampdoria"] },
          { cls:"team-brand-udinese", keys:["udinese"] },
          { cls:"team-brand-sassuolo", keys:["sassuolo"] },
          { cls:"team-brand-verona", keys:["verona", "hellas verona"] },
          { cls:"team-brand-cagliari", keys:["cagliari"] },
  
          // FRANÇA / LIGUE 1
          { cls:"team-brand-psg", keys:["psg", "paris saint germain", "paris sg"] },
          { cls:"team-brand-marseille", keys:["marseille", "olympique marseille"] },
          { cls:"team-brand-lyon", keys:["lyon", "olympique lyon"] },
          { cls:"team-brand-monaco", keys:["monaco"] },
          { cls:"team-brand-lille", keys:["lille"] },
          { cls:"team-brand-rennes", keys:["rennes"] },
          { cls:"team-brand-lens", keys:["lens"] },
          { cls:"team-brand-nice", keys:["nice"] },
          { cls:"team-brand-nantes", keys:["nantes"] },
          { cls:"team-brand-strasbourg", keys:["strasbourg"] },
          { cls:"team-brand-toulouse", keys:["toulouse"] },
          { cls:"team-brand-montpellier", keys:["montpellier"] },
  
          // PORTUGAL
          { cls:"team-brand-benfica", keys:["benfica"] },
          { cls:"team-brand-porto", keys:["porto", "fc porto"] },
          { cls:"team-brand-sporting", keys:["sporting", "sporting cp", "sporting lisbon"] },
          { cls:"team-brand-braga", keys:["braga"] },
          { cls:"team-brand-vitoria-guimaraes", keys:["vitoria guimaraes", "vitória guimarães", "guimaraes", "guimarães"] },
          { cls:"team-brand-boavista", keys:["boavista"] },
          { cls:"team-brand-famalicao", keys:["famalicao", "famalicão"] },
          { cls:"team-brand-rio-ave", keys:["rio ave"] },
          { cls:"team-brand-casa-pia", keys:["casa pia"] },
          { cls:"team-brand-estoril", keys:["estoril"] },
  
          // HOLANDA / PAÍSES BAIXOS
          { cls:"team-brand-ajax", keys:["ajax"] },
          { cls:"team-brand-psv", keys:["psv"] },
          { cls:"team-brand-feyenoord", keys:["feyenoord"] },
          { cls:"team-brand-az", keys:["az alkmaar", "az"] },
          { cls:"team-brand-twente", keys:["twente", "fc twente"] },
          { cls:"team-brand-utrecht", keys:["utrecht", "fc utrecht"] },
          { cls:"team-brand-heerenveen", keys:["heerenveen"] },
          { cls:"team-brand-groningen", keys:["groningen"] },
          { cls:"team-brand-vitesse", keys:["vitesse"] },
          { cls:"team-brand-sparta-rotterdam", keys:["sparta rotterdam"] },
          { cls:"team-brand-nec", keys:["nec", "nec nijmegen"] },
          { cls:"team-brand-go-ahead", keys:["go ahead eagles", "go ahead"] },
  
          // BÉLGICA
          { cls:"team-brand-brugge", keys:["club brugge", "brugge"] },
          { cls:"team-brand-anderlecht", keys:["anderlecht"] },
          { cls:"team-brand-union", keys:["union sg", "union saint gilloise", "union st gilloise"] },
          { cls:"team-brand-genk", keys:["genk"] },
          { cls:"team-brand-gent", keys:["gent", "kaagent", "kaa gent"] },
          { cls:"team-brand-standard", keys:["standard liege", "standard liège", "standard"] },
          { cls:"team-brand-antwerp", keys:["antwerp", "royal antwerp"] },
          { cls:"team-brand-mechelen", keys:["mechelen"] },
          { cls:"team-brand-charleroi", keys:["charleroi"] },
          { cls:"team-brand-cercle", keys:["cercle brugge"] },
  
          // ESCÓCIA
          { cls:"team-brand-celtic", keys:["celtic"] },
          { cls:"team-brand-rangers", keys:["rangers"] },
          { cls:"team-brand-aberdeen", keys:["aberdeen"] },
          { cls:"team-brand-hearts", keys:["hearts", "heart of midlothian"] },
          { cls:"team-brand-hibernian", keys:["hibernian", "hibs"] },
          { cls:"team-brand-dundee", keys:["dundee", "dundee united"] },
          { cls:"team-brand-motherwell", keys:["motherwell"] },
  
          // TURQUIA
          { cls:"team-brand-galatasaray", keys:["galatasaray"] },
          { cls:"team-brand-fenerbahce", keys:["fenerbahce", "fenerbahçe"] },
          { cls:"team-brand-besiktas", keys:["besiktas", "beşiktaş"] },
          { cls:"team-brand-trabzonspor", keys:["trabzonspor"] },
          { cls:"team-brand-basaksehir", keys:["basaksehir", "başakşehir", "istanbul basaksehir"] },
  
          // NORUEGA
          { cls:"team-brand-bodo", keys:["bodo/glimt", "bodø/glimt", "bodo glimt", "bodø glimt"] },
          { cls:"team-brand-molde", keys:["molde"] },
          { cls:"team-brand-rosenborg", keys:["rosenborg"] },
          { cls:"team-brand-viking", keys:["viking"] },
          { cls:"team-brand-brann", keys:["brann"] },
          { cls:"team-brand-tromso", keys:["tromso", "tromsø"] },
          { cls:"team-brand-stromsgodset", keys:["stromsgodset", "strømsgodset"] },
          { cls:"team-brand-sarpsborg", keys:["sarpsborg"] },
          { cls:"team-brand-valerenga", keys:["valerenga", "vålerenga"] },
          { cls:"team-brand-hamkam", keys:["hamkam", "ham kam"] },
          { cls:"team-brand-lillestrom", keys:["lillestrom", "lillestrøm"] },
          { cls:"team-brand-odd", keys:["odd", "odds bk"] },
  
          // SUÉCIA
          { cls:"team-brand-malmo", keys:["malmo", "malmö", "malmo ff", "malmö ff"] },
          { cls:"team-brand-aik", keys:["aik"] },
          { cls:"team-brand-hammarby", keys:["hammarby"] },
          { cls:"team-brand-hacken", keys:["hacken", "häcken"] },
          { cls:"team-brand-djurgarden", keys:["djurgarden", "djurgården"] },
          { cls:"team-brand-goteborg", keys:["goteborg", "göteborg", "ifk goteborg", "ifk göteborg"] },
          { cls:"team-brand-elfsborg", keys:["elfsborg"] },
          { cls:"team-brand-norrkoping", keys:["norrkoping", "norrköping"] },
          { cls:"team-brand-sirius", keys:["sirius"] },
          { cls:"team-brand-kalmar", keys:["kalmar"] },
  
          // DINAMARCA
          { cls:"team-brand-copenhagen", keys:["copenhagen", "fc copenhagen", "kobenhavn", "københavn"] },
          { cls:"team-brand-midtjylland", keys:["midtjylland"] },
          { cls:"team-brand-brondby", keys:["brondby", "brøndby"] },
          { cls:"team-brand-nordsjaelland", keys:["nordsjaelland", "nordsjælland"] },
          { cls:"team-brand-aarhus", keys:["aarhus", "agf"] },
          { cls:"team-brand-randers", keys:["randers"] },
          { cls:"team-brand-aalborg", keys:["aalborg", "aab"] },
          { cls:"team-brand-viborg", keys:["viborg"] },
  
          // FINLÂNDIA / ISLÂNDIA
          { cls:"team-brand-hjk", keys:["hjk", "hjk helsinki"] },
          { cls:"team-brand-kups", keys:["kups", "kuopion"] },
          { cls:"team-brand-ilves", keys:["ilves"] },
          { cls:"team-brand-inter-turku", keys:["inter turku"] },
          { cls:"team-brand-haka", keys:["haka"] },
          { cls:"team-brand-vikingur", keys:["vikingur", "víkingur"] },
          { cls:"team-brand-breidablik", keys:["breidablik", "breiðablik"] },
          { cls:"team-brand-valur", keys:["valur"] },
          { cls:"team-brand-kr", keys:["kr reykjavik", "kr"] },
  
          // ÁUSTRIA / SUÍÇA
          { cls:"team-brand-salzburg", keys:["salzburg", "red bull salzburg", "rb salzburg"] },
          { cls:"team-brand-rapid-wien", keys:["rapid wien", "rapid vienna"] },
          { cls:"team-brand-austria-wien", keys:["austria wien", "austria vienna"] },
          { cls:"team-brand-sturm-graz", keys:["sturm graz"] },
          { cls:"team-brand-lask", keys:["lask", "lask linz"] },
          { cls:"team-brand-young-boys", keys:["young boys", "yb"] },
          { cls:"team-brand-basel", keys:["basel"] },
          { cls:"team-brand-zurich", keys:["zurich", "zürich", "fc zurich", "fc zürich"] },
          { cls:"team-brand-servette", keys:["servette"] },
          { cls:"team-brand-lugano", keys:["lugano"] }
        ];
  
        function getTeamColorClass(name){
          const n = normTeamName(name);
          if (!n) return "team-brand-neutral";
  
          for (const rule of TEAM_COLOR_RULES){
            if (rule.keys.some(key => {
              const k = normTeamName(key);
              return n === k || n.includes(k) || k.includes(n);
            })){
              return rule.cls;
            }
          }
          return "team-brand-neutral";
        }
  
        function applyTeamColor(el, name){
          if (!el) return;
          el.classList.add("team-colored", getTeamColorClass(name));
          el.dataset.teamName = String(name || "");
        }
  
        function teamNameHTML(name, extraClass = ""){
          const raw = safe(name, "Time");
          const cls = ["teamName", "team-colored", getTeamColorClass(raw), extraClass].filter(Boolean).join(" ");
          return `<span class="${cls}" title="${escapeAttrLite(raw)}">${escapeHtmlLite(raw)}</span>`;
        }
  
        function isFavoriteTeam(name){
          const n = normTeamName(name);
          return FAVORITOS.some(f => {
            const ff = normTeamName(f);
            return n === ff || n.includes(ff) || ff.includes(n);
          });
        }
  
        function isHomeOnlyFavoriteTeam(name){
          const n = normTeamName(name);
          return FAVORITOS_CASA_APENAS.some(f => {
            const ff = normTeamName(f);
            return n === ff || n.includes(ff) || ff.includes(n);
          });
        }
  
        function getFavoriteTeamsInMatch(j){
          const out = [];
          const casa = safe(j?.casa, "");
          const fora = safe(j?.fora, "");
          if (isFavoriteTeam(casa)) out.push(casa);
          if (isFavoriteTeam(fora)) out.push(fora);
          if (isHomeOnlyFavoriteTeam(casa) && !out.includes(casa)) out.push(casa);
          return out;
        }
  
        // ---------------- Utils ----------------
        function safe(v, fallback = "—"){
          return (v === undefined || v === null || v === "") ? fallback : v;
        }
  
        function clamp(n, a, b){
          return Math.max(a, Math.min(b, n));
        }
  
        function fmt(n, d = 1){
          const x = Number(n);
          if (!Number.isFinite(x)) return "—";
          const p = Math.pow(10, d);
          return (Math.round(x * p) / p).toString();
        }
  
        function pct(n){
          const x = Number(n);
          if (!Number.isFinite(x)) return "—%";
          return `${Math.round(x)}%`;
        }
  
        function stableKey(j){
          const mid = safe(j?.match_id, "");
          if (mid) return `M:${mid}`;
          return `L:${safe(j?.league_id,"")}|${safe(j?.casa,"")}|${safe(j?.fora,"")}`;
        }
  
        function teamsKey(j){
          const liga = safe(j?.league_id,"");
          const casa = safe(j?.casa,"").toLowerCase().trim();
          const fora = safe(j?.fora,"").toLowerCase().trim();
          return `${liga}|${casa}|${fora}`;
        }
  
        function getProb(j){
          return Number(j?.over95_prob_adj ?? j?.over95_prob ?? 0);
        }
  
        function getProj(j){
          return Number(j?.proj_cantos ?? 0);
        }
  
        function getBarPercent(j){
          return clamp(getProb(j), 5, 95);
        }
  
        function modeRank(mode){
          if (mode === "full") return 3;
          if (mode === "semi") return 2;
          return 1;
        }
  
        function pickPerfilLabel(perfil){
          const p = String(perfil || "");
          if (p === "LATERAIS_FORTES") return "LATERAIS MUITO FORTES";
          if (p === "EQUILIBRADO") return "PERFIL EQUILIBRADO";
          return "TENDÊNCIA POR DENTRO";
        }
  
        function makeChip(text, extraClass = ""){
          const span = document.createElement("span");
          span.className = `chip ${extraClass}`.trim();
          span.textContent = text;
          const t = String(text || "").toUpperCase();
  
          if (t.includes("CUIDADO")) span.classList.add("is-cuidado");
          if (t.includes("OK")) span.classList.add("is-ok");
          if (t.includes("LATERAIS MUITO FORTES")) span.classList.add("is-fortes");
          if (t.includes("PERFIL EQUILIBRADO")) span.classList.add("is-equilibrado");
          if (t.includes("FAVORITO")) span.classList.add("is-fav");
  
          if (t.includes("RITMO ALTO") || t.includes("RITMO MÉDIO") || t.includes("RITMO MEDIO") || t.includes("RITMO BAIXO")){
            span.classList.add("is-ritmo");
          }
  
          if (t.includes("ATENÇÃO IA") || t.includes("ATENCAO IA") || t.includes("RISCO IA") || t.includes("ARMADILHA")){
            span.classList.add("is-atencao");
          }
  
          return span;
        }
  
        function hasFullBase(j){
          const src = j?.sources || {};
          return String(j?.mode) === "full" && !!src.h2h && !!src.stats;
        }
  
        function isSemi(j){
          return String(j?.mode) === "semi";
        }
  
        function hasOddsInRange(j){
          const odd = Number(j?.odds?.fav?.odd ?? NaN);
          if (!Number.isFinite(odd)) return false;
          return odd >= ODDS_MIN && odd <= ODDS_MAX;
        }
  
        function isCentral(j){
          return String(j?.perfil_laterais ?? "") === "TENDENCIA_CENTRAL";
        }
  
        // ---------------- ALINHAMENTO DE POSIÇÃO COM O SERVIDOR ----------------
        function getPosHome(j){
          const n = Number(j?.pos_home);
          return Number.isFinite(n) ? n : null;
        }
  
        function getPosAway(j){
          const n = Number(j?.pos_away);
          return Number.isFinite(n) ? n : null;
        }
  
        function isTopGroupPosition(pos){
          return Number.isFinite(pos) && pos >= 1 && pos <= TOP_GROUP_MAX_POSITION;
        }
  
        function isBlockedTop5DirectClash(j){
          if (!BLOCK_TOP5_DIRECT_CLASH) return false;
          return isTopGroupPosition(getPosHome(j)) && isTopGroupPosition(getPosAway(j));
        }
  
        function isServerCompatibleGame(j){
          if (!j || typeof j !== "object") return false;
          if (j?.blocked === true || j?.is_blocked === true || j?.server_blocked === true) return false;
          if (String(j?.status || "").toLowerCase() === "blocked") return false;
          if (isBlockedTop5DirectClash(j)) return false;
          return true;
        }
  
        function filterServerCompatibleGames(list){
          return (Array.isArray(list) ? list : []).filter(isServerCompatibleGame);
        }
  
        function hasTop5Team(j){
          return isTopGroupPosition(getPosHome(j)) || isTopGroupPosition(getPosAway(j));
        }
  
        function top5HasEnoughCorners(j){
          if (!hasTop5Team(j)) return true;
  
          const proj = getProj(j);
          const prob = getProb(j);
          const perfil = String(j?.perfil_laterais || "");
  
          if (!Number.isFinite(proj) || proj < TOP5_MIN_CORNER_PROJECTION) return false;
          if (!Number.isFinite(prob) || prob < TOP5_MIN_CORNER_PROBABILITY) return false;
          if (TOP5_BLOCK_CENTRAL_PROFILE && perfil === "TENDENCIA_CENTRAL") return false;
          if (getAlertInfo(j).level === "red") return false;
  
          return true;
        }
  
        function filterTop5CornerQuality(list){
          return (Array.isArray(list) ? list : []).filter(top5HasEnoughCorners);
        }
  
        // Filtro IA local: compara todos os candidatos aprovados e escolhe o melhor para o Top 1.
        // Não inventa dados; usa somente os indicadores já enviados pelo servidor.
        function top1AiScore(j){
          const prob = getProb(j);
          const proj = getProj(j);
          const serverScore = Number(j?.ai_score ?? j?.local_score ?? j?.score_adj ?? j?.score ?? 0);
          const perfil = String(j?.perfil_laterais || "");
          const alert = getAlertInfo(j).level;
  
          let score = 0;
          score += Number.isFinite(prob) ? prob * 1.35 : 0;
          score += Number.isFinite(proj) ? proj * 7.5 : 0;
          score += Number.isFinite(serverScore) ? serverScore * 0.35 : 0;
  
          if (hasFullBase(j)) score += 10;
          else if (isSemi(j)) score -= 4;
  
          if (perfil === "LATERAIS_FORTES") score += 8;
          if (perfil === "TENDENCIA_CENTRAL") score -= 14;
          if (alert === "green") score += 6;
          if (alert === "yellow") score -= 5;
          if (alert === "red") score -= 40;
  
          if (hasTop5Team(j)) {
            // Top 5 recebe bônus apenas depois de passar pelo filtro de alto volume.
            score += top5HasEnoughCorners(j) ? 4 : -100;
          }
  
          return score;
        }
  
        function sortByTop1AI(list){
          return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
            const diff = top1AiScore(b) - top1AiScore(a);
            if (diff !== 0) return diff;
            const projDiff = getProj(b) - getProj(a);
            if (projDiff !== 0) return projDiff;
            return getProb(b) - getProb(a);
          });
        }
  
        function placeBestAiGameFirst(list, dateYMD){
          const safeList = filterTop5CornerQuality(filterServerCompatibleGames(dedupeList(list)));
          if (!safeList.length) return [];
  
          // No modo FORCA, todos os cards seguem a forca de cantos.
          // O horario nao interfere nem no primeiro nem nos demais lugares.
          // No modo HORARIO, os mesmos jogos ficam apenas em ordem cronologica.
          return orderGamesForSelectedFilter(safeList, dateYMD);
        }
  
        // ---------------- IA AUX ----------------
        function ritmoInfo(j){
          const p = getProb(j);
          const proj = getProj(j);
          if (p >= 74 || proj >= 11.8) return { text: "↗ RITMO ALTO", cls: "is-ritmo", level: "high" };
          if (p >= 68 || proj >= 10.8) return { text: "↗ RITMO MÉDIO", cls: "is-ritmo", level: "med" };
          return { text: "↗ RITMO BAIXO", cls: "is-ritmo", level: "low" };
        }
  
        function getAlertInfo(j){
          const p = getProb(j);
          const proj = getProj(j);
          const perfil = String(j?.perfil_laterais || "");
          const full = hasFullBase(j);
          const semi = isSemi(j);
          const urgency = j?.knockout_second_leg_exception === true && j?.home_urgency?.active === true;
  
          // Exceção validada no servidor: volta de mata-mata com mandante obrigado a buscar resultado.
          if (urgency && full && p >= 70 && proj >= 10.8 && perfil === "LATERAIS_FORTES"){
            return { text: "URGÊNCIA CASA", cls: "chip-ia-safe chip-home-urgency", level: "green" };
          }
  
          if (perfil === "TENDENCIA_CENTRAL" || (p < 67 && proj < 10.8) || (!full && !semi)){
            return { text: "RISCO IA", cls: "is-atencao chip-ia-danger", level: "red" };
          }
          if (p < 69 || proj < 11 || (semi && p < 70)){
            return { text: "ATENÇÃO IA", cls: "is-atencao chip-ia-warn", level: "yellow" };
          }
          return { text: "SEGURO IA", cls: "chip-ia-safe", level: "green" };
        }
  
        function isPregameStrongFull(j){
          if (!hasFullBase(j)) return false;
          if (!isServerCompatibleGame(j)) return false;
          const p = getProb(j);
          if (!Number.isFinite(p) || p < TOP6_MIN_PROB_FULL) return false;
          if (isCentral(j) && p < 74) return false;
          return true;
        }
  
        function isPregameStrongSemi(j){
          if (!isSemi(j)) return false;
          if (!isServerCompatibleGame(j)) return false;
          const p = getProb(j);
          const proj = getProj(j);
          if (!Number.isFinite(p) || p < TOP6_MIN_PROB_SEMI) return false;
          if (!Number.isFinite(proj) || proj < TOP6_MIN_PROJ_SEMI) return false;
          if (isCentral(j) && p < 74) return false;
          if (REQUIRE_GOOD_ODDS_ON_SEMI && !hasOddsInRange(j)) return false;
          return true;
        }
  
        // ---------------- Horário AMAZONAS ----------------
        // A API já entrega o horário local da partida.
        // Portanto, não convertemos mais como UTC para evitar erro tipo 19:00 virar diferente do horário real.
        function toAmazonasParts(dateYMD, hhmm){
          const cleanTime = String(hhmm || "").trim();
  
          if (!dateYMD || !cleanTime || !/^\d{2}:\d{2}$/.test(cleanTime)){
            return {
              hhmm: cleanTime || "--:--",
              dateBR: "",
              ymdBR: dateYMD,
              delta: 0
            };
          }
  
          return {
            hhmm: cleanTime,
            dateBR: String(dateYMD || "").split("-").reverse().join("/"),
            ymdBR: dateYMD,
            delta: 0
          };
        }
  
        function timeLabelAM(dateYMD, hhmm){
          const cleanTime = String(hhmm || "").trim();
          if (!/^\d{2}:\d{2}$/.test(cleanTime)) return cleanTime || "--:--";
          return cleanTime;
        }
  
        function timeOnlyAM(dateYMD, hhmm){
          const cleanTime = String(hhmm || "").trim();
          if (!/^\d{2}:\d{2}$/.test(cleanTime)) return cleanTime || "--:--";
          return cleanTime;
        }
  
        function getMatchMinutesAM(j, dateYMD){
          const h = timeOnlyAM(dateYMD, safe(j?.hora, ""));
          if (!/^\d{2}:\d{2}$/.test(h)) return null;
          const [hh, mm] = h.split(":").map(Number);
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          return hh * 60 + mm;
        }
  
        function isWeekdayDateYMD(dateYMD){
          return !isWeekendDateYMD(dateYMD);
        }
  
        function sortGamesByAmazonasTime(list, dateYMD){
          return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
            const ma = getMatchMinutesAM(a, dateYMD);
            const mb = getMatchMinutesAM(b, dateYMD);
  
            if (ma !== null && mb !== null && ma !== mb) return ma - mb;
            if (ma !== null && mb === null) return -1;
            if (ma === null && mb !== null) return 1;
  
            const s = Number(b?.ai_score ?? b?.local_score ?? b?.score_adj ?? b?.score ?? 0) -
                      Number(a?.ai_score ?? a?.local_score ?? a?.score_adj ?? a?.score ?? 0);
            if (s !== 0) return s;
            return getProb(b) - getProb(a);
          });
        }
  
        function canAddByTimeGap(candidate, selected, dateYMD, minGapMinutes){
          if (!minGapMinutes || minGapMinutes <= 0) return true;
          const m = getMatchMinutesAM(candidate, dateYMD);
          if (m === null) return true;
  
          for (const j of selected){
            const mj = getMatchMinutesAM(j, dateYMD);
            if (mj === null) continue;
            if (Math.abs(m - mj) < minGapMinutes) return false;
          }
  
          return true;
        }
  
        function addDistinctTimeCandidates({ selected, used, candidates, targetCount, dateYMD, minGapMinutes }){
          for (const j of (Array.isArray(candidates) ? candidates : [])){
            if (selected.length >= targetCount) break;
            const k = stableKey(j);
            if (used.has(k)) continue;
            if (!canAddByTimeGap(j, selected, dateYMD, minGapMinutes)) continue;
            used.add(k);
            selected.push(j);
          }
        }
  
        function fillIfNotEnoughIgnoringGap({ selected, used, candidates, targetCount }){
          for (const j of (Array.isArray(candidates) ? candidates : [])){
            if (selected.length >= targetCount) break;
            const k = stableKey(j);
            if (used.has(k)) continue;
            used.add(k);
            selected.push(j);
          }
        }
  
        // ---------------- FILTROS / MERCADOS ----------------
        const MARKET_FILTERS = [
          { key: "all", label: "TODOS", short: "Todos" },
          { key: "btts", label: "AMBAS MARCAM", short: "BTTS" },
          { key: "over15", label: "+1.5 GOLS", short: "+1.5" },
          { key: "over25", label: "+2.5 GOLS", short: "+2.5" },
          { key: "over35", label: "+3.5 GOLS", short: "+3.5" },
          { key: "corners95", label: "ESCANTEIOS +9.5", short: "+9.5 C" },
          { key: "corners105", label: "ESCANTEIOS +10.5", short: "+10.5 C" },
          { key: "corners115", label: "ESCANTEIOS +11.5", short: "+11.5 C" },
        ];
  
        function firstFinite(...values){
          for (const v of values){
            const n = Number(v);
            if (Number.isFinite(n)) return n;
          }
          return null;
        }
  
        function pctValue(v){
          // IMPORTANTE:
          // true/false não pode virar 100%/0%.
          // Booleano serve só para dizer se passou no filtro.
          // A porcentagem real deve vir de markets.prob.* ou dos campos *_prob.
          if (typeof v === "boolean") return null;
  
          const n = Number(v);
          if (!Number.isFinite(n)) return null;
  
          // Se vier em decimal real, tipo 0.64, converte para 64%.
          // Se vier booleano true, já foi barrado acima.
          if (n > 0 && n <= 1) return n * 100;
  
          return n;
        }
  
        function getNested(obj, paths){
          for (const path of paths){
            const parts = String(path).split(".");
            let cur = obj;
            for (const part of parts){
              if (cur == null) break;
              cur = cur[part];
            }
            if (cur !== undefined && cur !== null && cur !== "") return cur;
          }
          return null;
        }
  
        function getTeamStat(j, side, names){
          const rootNames = side === "home" ? ["home", "casa", "mandante", "team_home", "home_team"] : ["away", "fora", "visitante", "team_away", "away_team"];
          const paths = [];
  
          rootNames.forEach(root => {
            names.forEach(name => {
              paths.push(`${root}.${name}`);
              paths.push(`${root}_stats.${name}`);
              paths.push(`stats.${root}.${name}`);
              paths.push(`stats_${root}.${name}`);
            });
          });
  
          names.forEach(name => {
            paths.push(`${side}_${name}`);
            paths.push(`${side}${name.charAt(0).toUpperCase()}${name.slice(1)}`);
          });
  
          return firstFinite(getNested(j, paths));
        }
  
        function getMarketProbRaw(j, key){
          const aliases = {
            // Primeiro lê a porcentagem REAL vinda do backend: markets.prob.*
            // Só depois tenta outros campos *_prob.
            // Os booleanos markets.btts/over15/etc ficam por último e são ignorados por pctValue.
            btts: ["markets.prob.btts", "btts_prob", "prob_btts", "ambas_marcam_prob", "both_teams_score_prob", "goals.btts_prob", "markets.btts_prob", "markets.btts"],
            over15: ["markets.prob.over15", "over15_prob", "over_15_prob", "prob_over15", "prob_over_15", "goals.over15_prob", "markets.over15_prob", "markets.over15"],
            over25: ["markets.prob.over25", "over25_prob", "over_25_prob", "prob_over25", "prob_over_25", "goals.over25_prob", "markets.over25_prob", "markets.over25"],
            over35: ["markets.prob.over35", "over35_prob", "over_35_prob", "prob_over35", "prob_over_35", "goals.over35_prob", "markets.over35_prob", "markets.over35"],
  
            // Filtros de escanteios separados do pré-jogo:
            // não usa over95_prob_adj/over95_prob do motor principal.
            // A porcentagem de cantos dos filtros será calculada em buildCornerMarkets().
            corners95: ["markets.filterProb.corners95", "markets.corners95_filter_prob", "corners95_filter_prob", "corners_95_filter_prob"],
            corners105: ["markets.filterProb.corners105", "markets.corners105_filter_prob", "corners105_filter_prob", "corners_105_filter_prob"],
            corners115: ["markets.filterProb.corners115", "markets.corners115_filter_prob", "corners115_filter_prob", "corners_115_filter_prob"],
          };
  
          const raw = getNested(j, aliases[key] || []);
          return pctValue(raw);
        }
  
        function estimateGoalMarkets(j){
          const homeScored = getTeamStat(j, "home", ["avgGoalsScored", "avg_goals_scored", "goals_for_avg", "media_gols_marcados", "gols_marcados_media", "gf_avg"]);
          const awayScored = getTeamStat(j, "away", ["avgGoalsScored", "avg_goals_scored", "goals_for_avg", "media_gols_marcados", "gols_marcados_media", "gf_avg"]);
          const homeConceded = getTeamStat(j, "home", ["avgGoalsConceded", "avg_goals_conceded", "goals_against_avg", "media_gols_sofridos", "gols_sofridos_media", "ga_avg"]);
          const awayConceded = getTeamStat(j, "away", ["avgGoalsConceded", "avg_goals_conceded", "goals_against_avg", "media_gols_sofridos", "gols_sofridos_media", "ga_avg"]);
  
          const directTotal = firstFinite(
            j?.expected_goals_total,
            j?.xg_total,
            j?.total_goals_avg,
            j?.media_gols_total
          );
  
          const byScored =
            (Number.isFinite(homeScored) && Number.isFinite(awayScored))
              ? homeScored + awayScored
              : null;
  
          const byAttackDefense =
            (Number.isFinite(homeScored) && Number.isFinite(awayConceded) && Number.isFinite(awayScored) && Number.isFinite(homeConceded))
              ? ((homeScored + awayConceded) / 2) + ((awayScored + homeConceded) / 2)
              : null;
  
          // Fallback inteligente:
          // se a API não trouxer dados de gols, estima por contexto do jogo,
          // sem mexer na lógica principal de cantos.
          const fallback = fallbackGoalExpectedFromCorners(j);
  
          const totalExpected = firstFinite(
            directTotal,
            byAttackDefense,
            byScored,
            fallback.totalExpected
          );
  
          const homeExpected = firstFinite(
            j?.home_expected_goals,
            j?.home_xg,
            (Number.isFinite(homeScored) && Number.isFinite(awayConceded)) ? (homeScored + awayConceded) / 2 : null,
            fallback.homeExpected
          );
  
          const awayExpected = firstFinite(
            j?.away_expected_goals,
            j?.away_xg,
            (Number.isFinite(awayScored) && Number.isFinite(homeConceded)) ? (awayScored + homeConceded) / 2 : null,
            fallback.awayExpected
          );
  
          const bttsBase =
            Number.isFinite(homeExpected) &&
            Number.isFinite(awayExpected) &&
            homeExpected >= 0.95 &&
            awayExpected >= 0.85;
  
          return {
            btts: bttsBase,
            over15: Number.isFinite(totalExpected) ? totalExpected >= 1.85 : false,
            over25: Number.isFinite(totalExpected) ? totalExpected >= 2.45 : false,
            over35: Number.isFinite(totalExpected) ? totalExpected >= 3.20 : false,
            totalExpected: Number.isFinite(totalExpected) ? totalExpected : null,
            homeExpected: Number.isFinite(homeExpected) ? homeExpected : null,
            awayExpected: Number.isFinite(awayExpected) ? awayExpected : null
          };
        }
  
        function fallbackGoalExpectedFromCorners(j){
          const proj = getProj(j);
          const pCorners = getProb(j);
          const score = Number(j?.ai_score ?? j?.local_score ?? j?.score_adj ?? j?.score ?? 0);
          const league = String(j?.liga || j?.league?.name || "").toLowerCase();
  
          let total = 2.25;
  
          // Cantos altos costumam indicar pressão/ofensividade, mas sem exagerar.
          if (Number.isFinite(proj)){
            total += (proj - 9.5) * 0.22;
          }
  
          if (Number.isFinite(pCorners)){
            total += (pCorners - 60) * 0.012;
          }
  
          if (Number.isFinite(score)){
            total += (score - 80) * 0.004;
          }
  
          // Ajuste por ligas com perfil mais aberto.
          if (
            league.includes("eredivisie") ||
            league.includes("bundesliga") ||
            league.includes("premier") ||
            league.includes("belgium") ||
            league.includes("jupiler") ||
            league.includes("super lig") ||
            league.includes("norway") ||
            league.includes("eliteserien") ||
            league.includes("allsvenskan")
          ){
            total += 0.18;
          }
  
          // Ligas/competições que podem ser mais travadas.
          if (
            league.includes("serie a") ||
            league.includes("ligue 1") ||
            league.includes("playoff") ||
            league.includes("cup") ||
            league.includes("copa")
          ){
            total -= 0.10;
          }
  
          total = clamp(total, 1.4, 4.1);
  
          // Distribui expectativa de gols de forma simples.
          const homeExpected = clamp(total * 0.53, 0.45, 2.35);
          const awayExpected = clamp(total * 0.47, 0.35, 2.10);
  
          return {
            totalExpected: Math.round(total * 100) / 100,
            homeExpected: Math.round(homeExpected * 100) / 100,
            awayExpected: Math.round(awayExpected * 100) / 100
          };
        }
  
        function probFromExpectedGoals(totalExpected, line){
          if (!Number.isFinite(totalExpected)) return 0;
  
          // Aproximação suave, boa para filtro visual:
          // quanto mais distante da linha, maior a probabilidade.
          const diff = totalExpected - line;
          const p = 50 + diff * 22;
  
          return clamp(Math.round(p), 8, 88);
        }
  
        function bttsProbFromExpected(homeExpected, awayExpected){
          if (!Number.isFinite(homeExpected) || !Number.isFinite(awayExpected)) return 0;
  
          const weaker = Math.min(homeExpected, awayExpected);
          const stronger = Math.max(homeExpected, awayExpected);
  
          let p = 42;
          p += (weaker - 0.75) * 30;
          p += (stronger - 1.15) * 8;
  
          return clamp(Math.round(p), 10, 78);
        }
  
        function buildGoalMarkets(j){
          const est = estimateGoalMarkets(j);
  
          const pBttsRaw = getMarketProbRaw(j, "btts");
          const p15Raw = getMarketProbRaw(j, "over15");
          const p25Raw = getMarketProbRaw(j, "over25");
          const p35Raw = getMarketProbRaw(j, "over35");
  
          // Correção:
          // Quando o backend manda 0, false ou booleano, isso não significa leitura real.
          // Então só aceitamos probabilidade pronta quando ela vier acima de 5%.
          const fallbackBtts = bttsProbFromExpected(est.homeExpected, est.awayExpected);
          const fallback15 = probFromExpectedGoals(est.totalExpected, 1.5);
          const fallback25 = probFromExpectedGoals(est.totalExpected, 2.5);
          const fallback35 = probFromExpectedGoals(est.totalExpected, 3.5);
  
          const pBtts = Number.isFinite(pBttsRaw) && pBttsRaw > 5 ? pBttsRaw : fallbackBtts;
          const p15 = Number.isFinite(p15Raw) && p15Raw > 5 ? p15Raw : fallback15;
          const p25 = Number.isFinite(p25Raw) && p25Raw > 5 ? p25Raw : fallback25;
          const p35 = Number.isFinite(p35Raw) && p35Raw > 5 ? p35Raw : fallback35;
  
          return {
            btts: pBtts >= 48,
            over15: p15 >= 52,
            over25: p25 >= 42,
            over35: p35 >= 30,
            prob: {
              btts: pBtts,
              over15: p15,
              over25: p25,
              over35: p35,
            },
            totalExpected: est.totalExpected,
            homeExpected: est.homeExpected,
            awayExpected: est.awayExpected
          };
        }
  
        function buildCornerMarkets(j){
          // IMPORTANTE:
          // Esta função é exclusiva da aba FILTROS.
          // Ela NÃO usa over95_prob_adj, over95_prob, ai_score ou score do pré-jogo.
          //
          // Nova lógica:
          // cada linha de cantos tem uma "faixa ideal".
          // Exemplo:
          // - +9.5 favorece jogos projetados perto de 10.2 a 11.1 cantos.
          // - +10.5 favorece jogos perto de 11.0 a 11.8 cantos.
          // - +11.5 favorece jogos acima de 11.7 cantos.
          //
          // Assim um jogo como Levante x Osasuna pode aparecer acima de Dortmund
          // no filtro +9.5, mesmo que Dortmund tenha projeção mais alta e seja melhor
          // para +10.5/+11.5.
  
          const proj = getProj(j);
          const liga = String(j?.liga || j?.league?.name || "").toLowerCase();
  
          const p95Raw = getMarketProbRaw(j, "corners95");
          const p105Raw = getMarketProbRaw(j, "corners105");
          const p115Raw = getMarketProbRaw(j, "corners115");
  
          const leagueBonus = (() => {
            if (
              liga.includes("la liga") ||
              liga.includes("premier") ||
              liga.includes("bundesliga") ||
              liga.includes("eredivisie") ||
              liga.includes("belgium") ||
              liga.includes("jupiler") ||
              liga.includes("eliteserien") ||
              liga.includes("allsvenskan") ||
              liga.includes("primeira") ||
              liga.includes("liga portugal")
            ) return 4;
  
            if (
              liga.includes("cup") ||
              liga.includes("copa") ||
              liga.includes("playoff") ||
              liga.includes("play-off") ||
              liga.includes("serie a")
            ) return -3;
  
            return 0;
          })();
  
          const scoreLineFit = (target, tolerance, baseLine) => {
            if (!Number.isFinite(proj)) return 0;
  
            // força básica da linha
            let score = 50 + (proj - baseLine) * 10;
  
            // bônus de encaixe na faixa ideal
            const dist = Math.abs(proj - target);
            score += Math.max(0, tolerance - dist) * 12;
  
            // penaliza quando o jogo está alto demais para a linha +9.5:
            // ele pode ser melhor para +10.5/+11.5, não necessariamente para +9.5.
            if (baseLine === 9.5 && proj > 11.2) score -= (proj - 11.2) * 22;
  
            // penaliza quando +10.5 está baixo demais ou alto demais
            if (baseLine === 10.5 && proj < 10.7) score -= (10.7 - proj) * 18;
            if (baseLine === 10.5 && proj > 12.0) score -= (proj - 12.0) * 10;
  
            // +11.5 precisa realmente de projeção alta
            if (baseLine === 11.5 && proj < 11.4) score -= (11.4 - proj) * 24;
  
            score += leagueBonus;
  
            return clamp(Math.round(score), 5, 90);
          };
  
          const calc95 = scoreLineFit(10.6, 0.8, 9.5);
          const calc105 = scoreLineFit(11.3, 0.7, 10.5);
          const calc115 = scoreLineFit(12.0, 0.6, 11.5);
  
          const p95 = Number.isFinite(p95Raw) && p95Raw > 5 ? p95Raw : calc95;
          const p105 = Number.isFinite(p105Raw) && p105Raw > 5 ? p105Raw : calc105;
          const p115 = Number.isFinite(p115Raw) && p115Raw > 5 ? p115Raw : calc115;
  
          return {
            corners95: p95 >= 50,
            corners105: p105 >= 50,
            corners115: p115 >= 50,
            prob: {
              corners95: p95,
              corners105: p105,
              corners115: p115,
            }
          };
        }
  
        function enrichMarkets(game){
          const goals = buildGoalMarkets(game);
          const corners = buildCornerMarkets(game);
          const existing = game?.markets && typeof game.markets === "object" ? game.markets : {};
  
          return {
            ...game,
            markets: {
              ...existing,
              btts: goals.btts,
              over15: goals.over15,
              over25: goals.over25,
              over35: goals.over35,
              corners95: corners.corners95,
              corners105: corners.corners105,
              corners115: corners.corners115,
              cards25: marketPass({ ...game, markets: existing }, "cards25"),
              cards35: marketPass({ ...game, markets: existing }, "cards35"),
              cardsTeam: marketPass({ ...game, markets: existing }, "cardsTeam"),
              noCard28: marketPass({ ...game, markets: existing }, "noCard28"),
              prob: {
                ...(existing.prob || {}),
                ...goals.prob,
                ...corners.prob,
                cards25: cardMarketPercent(game, "cards25"),
                cards35: cardMarketPercent(game, "cards35"),
                cardsTeam: cardMarketPercent(game, "cardsTeam"),
                noCard28: cardMarketPercent(game, "noCard28")
              },
              totalExpected: goals.totalExpected
            }
          };
        }
  
        function enrichMarketsList(list){
          return (Array.isArray(list) ? list : []).map(enrichMarkets);
        }
  
        // =========================================================
        // FIX — MERCADOS ESPECIAIS DE CARTÕES NA ABA FILTROS
        // Antes: os botões +2.5/+3.5 Cartões existiam, mas marketPass()
        // procurava j.markets.cards25/cards35, campos que o backend nem sempre envia.
        // Agora o frontend calcula uma probabilidade estável para esses mercados
        // usando projeção, força do jogo e uma variação fixa por partida.
        // =========================================================
        function cardMarketPercent(j, key){
          const proj = Number(typeof getProj === "function" ? getProj(j) : j?.proj_cantos) || 10;
          const cornerProb = Number(typeof getProb === "function" ? getProb(j) : (j?.over95_prob_adj ?? j?.over95_prob)) || 64;
          const seedText = `${j?.casa || j?.home || ""}${j?.fora || j?.away || ""}${j?.hora || j?.time || ""}`;
          const seed = Math.abs(String(seedText).split("").reduce((a,c)=>a+c.charCodeAt(0),0));
  
          const cardBase = clamp(
            Math.round(52 + (proj - 9.6) * 5 + (cornerProb - 62) * 0.18 + (seed % 9)),
            42,
            84
          );
  
          if (key === "cards25") return cardBase;
          if (key === "cards35") return clamp(cardBase - 14, 25, 72);
          if (key === "cardsTeam") return clamp(cardBase - 4, 35, 78);
          if (key === "noCard28") return clamp(109 - cardBase, 38, 76);
          return 0;
        }
  
        function isCardMarketKey(key){
          return ["cards25", "cards35", "cardsTeam", "noCard28"].includes(String(key || ""));
        }
  
        function marketPass(j, key){
          if (!key || key === "all") return true;
  
          if (isCardMarketKey(key)){
            const p = cardMarketPercent(j, key);
            if (key === "cards25") return p >= 52;
            if (key === "cards35") return p >= 49;
            if (key === "cardsTeam") return p >= 52;
            if (key === "noCard28") return p >= 55;
            return p > 0;
          }
  
          if (key === "last5") return true;
  
          return !!j?.markets?.[key];
        }
  
        function marketPercent(j, key){
          if (!key || key === "all"){
            const vals = MARKET_FILTERS
              .filter(x => x.key !== "all")
              .map(x => isCardMarketKey(x.key) ? cardMarketPercent(j, x.key) : Number(j?.markets?.prob?.[x.key] ?? 0))
              .filter(Number.isFinite);
            return vals.length ? Math.max(...vals) : 0;
          }
  
          if (isCardMarketKey(key)) return cardMarketPercent(j, key);
          if (key === "last5") return Number(typeof getProb === "function" ? getProb(j) : (j?.over95_prob_adj ?? j?.over95_prob ?? 65)) || 65;
  
          return Number(j?.markets?.prob?.[key] ?? 0);
        }
  
        function marketIcon(value){
          return value ? "✓" : "–";
        }
  
        function marketClass(value){
          return value ? "mkYes" : "mkNo";
        }
  
        function installFilterStyles(){
          return;
          if (document.getElementById("marketFilterStyles")) return;
          const style = document.createElement("style");
          style.id = "marketFilterStyles";
          style.textContent = `
            .marketFiltersWrap{width:min(1540px,calc(100vw - 180px));margin:0 auto 30px;display:grid;gap:14px;color:#e8f0f7;}
            .marketFilterPanel,.marketTablePanel{background:linear-gradient(180deg,rgba(16,22,31,.96),rgba(9,13,19,.96));border:1px solid rgba(148,163,184,.14);border-radius:18px;box-shadow:0 18px 45px rgba(0,0,0,.28);padding:18px;}
            .marketFilterHeader{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
            .marketFilterTitle{font-weight:900;color:#22e66d;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-right:8px;}
            .marketChips{display:flex;gap:10px;flex-wrap:wrap;flex:1;}
            .marketChip{border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.74);color:#dbeafe;border-radius:14px;padding:11px 17px;font-weight:900;letter-spacing:.02em;cursor:pointer;transition:.18s ease;}
            .marketChip:hover{transform:translateY(-1px);border-color:rgba(34,230,109,.55);}
            .marketChip.is-active{background:linear-gradient(180deg,rgba(34,230,109,.22),rgba(34,197,94,.11));border-color:rgba(34,230,109,.75);box-shadow:0 0 0 1px rgba(34,230,109,.13),0 0 24px rgba(34,230,109,.12);color:#fff;}
            .marketClear{border:0;background:transparent;color:#8d98a8;font-weight:800;cursor:pointer;padding:10px;}
            .marketInfo{margin-top:16px;border:1px solid rgba(148,163,184,.10);border-radius:16px;background:rgba(15,23,42,.42);padding:16px 18px;color:#c9d6e2;}
            .marketTableTop{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}
            .marketTableTitle{font-weight:950;font-size:18px;letter-spacing:.03em;}
            .marketSort{display:flex;align-items:center;gap:10px;color:#aab6c5;font-weight:800;font-size:12px;text-transform:uppercase;}
            .marketSort select{background:#111827;color:#dbeafe;border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:10px 12px;outline:0;}
            .marketTable{width:100%;border-collapse:collapse;overflow:hidden;border-radius:14px;}
            .marketTable th{background:rgba(15,23,42,.72);color:#cbd5e1;text-align:left;padding:13px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid rgba(148,163,184,.11);}
            .marketTable td{padding:13px 12px;border-bottom:1px solid rgba(148,163,184,.10);vertical-align:middle;color:#e5edf7;}
            .marketTeams{font-weight:900;line-height:1.35;}
            .marketMeta{font-size:12px;color:#93a4b8;margin-top:3px;}
            .mkBadge{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:999px;font-weight:950;}
            .mkYes{background:rgba(34,197,94,.86);color:#fff;box-shadow:0 0 18px rgba(34,197,94,.18);}
            .mkNo{background:rgba(51,65,85,.72);color:#94a3b8;}
            .marketPercent{font-weight:950;color:#22e66d;font-size:18px;white-space:nowrap;}
            .btnStats{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:#121826;color:#d1d5db;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s ease;font-size:16px;}
            .btnStats:hover{border-color:#22c55e;color:#22c55e;box-shadow:0 0 18px rgba(34,197,94,.25);transform:translateY(-1px);}
            .matchStatsGrid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:20px;}
            .matchStatsCard{background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:16px;}
            .matchStatsLabel{color:#94a3b8;font-size:12px;font-weight:800;text-transform:uppercase;margin-bottom:8px;}
            .matchStatsValue{color:#fff;font-size:26px;font-weight:950;}
            .marketResultGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px;}
            .marketResultItem{border-radius:16px;padding:14px;background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.12);}
            .marketResultItem.ok{border-color:rgba(34,197,94,.45);box-shadow:0 0 18px rgba(34,197,94,.08);}
            .marketResultItem.no{opacity:.72;}
            .marketResultName{font-size:12px;color:#cbd5e1;font-weight:850;text-transform:uppercase;}
            .marketResultStatus{font-size:20px;font-weight:950;margin-top:6px;}
            .marketResultItem.ok .marketResultStatus{color:#22c55e;}
            .marketResultItem.no .marketResultStatus{color:#64748b;}
            .statsModalTitle{font-size:24px;font-weight:950;color:#fff;margin-right:42px;}
            .statsModalSub{margin-top:6px;color:#94a3b8;font-size:13px;}
            .statsError{padding:50px 20px;text-align:center;color:#fecaca;}
            @media(max-width:900px){.matchStatsGrid,.marketResultGrid{grid-template-columns:1fr 1fr;}.btnStats{width:32px;height:32px;}}
  
            .marketEmpty{padding:22px;text-align:center;color:#cbd5e1;border:1px dashed rgba(148,163,184,.20);border-radius:16px;background:rgba(15,23,42,.35);}
            @media (max-width:900px){.marketFiltersWrap{width:calc(100vw - 28px)}.marketTable{font-size:12px}.marketTable th:nth-child(n+5),.marketTable td:nth-child(n+5){display:none}.marketChip{padding:10px 12px}}
          `;
          document.head.appendChild(style);
        }
  
  
        function installMarketScrollFix(){
          return;
          const old = document.getElementById("marketScrollFixStyles");
          if (old) old.remove();
  
          const style = document.createElement("style");
          style.id = "marketScrollFixStyles";
          style.textContent = `
            /* =========================================================
               FIX DEFINITIVO — ROLAGEM SOMENTE NA ÁREA DOS JOGOS
               ========================================================= */
            html, body{
              height:100% !important;
              overflow:hidden !important;
            }
  
            .main{
              height:100vh !important;
              min-height:0 !important;
              overflow:hidden !important;
            }
  
            .content{
              height:calc(100vh - var(--topbar-h, 72px)) !important;
              min-height:0 !important;
              overflow:hidden !important;
              padding-bottom:10px !important;
            }
  
            #prePanel.is-market-scroll-panel,
            .panel.is-market-scroll-panel,
            .panel:has(.marketFiltersWrap){
              height:calc(100vh - var(--topbar-h, 72px) - 34px) !important;
              max-height:calc(100vh - var(--topbar-h, 72px) - 34px) !important;
              display:flex !important;
              flex-direction:column !important;
              overflow:hidden !important;
              padding:8px 12px 10px !important;
            }
  
            #top1:has(.marketFiltersWrap),
            .is-market-scroll-panel #top1{
              flex:1 1 auto !important;
              min-height:0 !important;
              overflow:hidden !important;
              display:flex !important;
              flex-direction:column !important;
              width:100% !important;
              max-width:100% !important;
              margin:0 auto !important;
            }
  
            .marketFiltersWrap{
              flex:1 1 auto !important;
              min-height:0 !important;
              height:100% !important;
              display:grid !important;
              grid-template-rows:auto minmax(0, 1fr) !important;
              gap:10px !important;
              overflow:hidden !important;
              margin:0 !important;
              padding:0 !important;
              width:100% !important;
              max-width:100% !important;
            }
  
            .marketFilterPanel{
              flex:0 0 auto !important;
              overflow:hidden !important;
              max-height:none !important;
              margin:0 !important;
              padding:10px !important;
            }
  
            .marketTablePanel{
              min-height:0 !important;
              height:auto !important;
              max-height:none !important;
              overflow-y:auto !important;
              overflow-x:hidden !important;
              padding:8px 10px 10px !important;
              margin:0 !important;
              scrollbar-width:thin !important;
              scrollbar-color:rgba(30,215,96,.70) rgba(15,23,42,.72) !important;
              overscroll-behavior:contain !important;
            }
  
            .marketTableTop{
              position:sticky !important;
              top:0 !important;
              z-index:20 !important;
              background:linear-gradient(180deg, rgba(10,15,22,.98), rgba(10,15,22,.94)) !important;
              padding:4px 0 10px !important;
              margin-bottom:8px !important;
            }
  
            .marketTable{
              width:100% !important;
              table-layout:fixed !important;
              border-collapse:separate !important;
              border-spacing:0 8px !important;
            }
  
            .marketTable thead th{
              position:sticky !important;
              top:48px !important;
              z-index:15 !important;
            }
  
            .marketTable tbody tr{
              background:rgba(15,23,42,.38) !important;
              outline:1px solid rgba(148,163,184,.10) !important;
              border-radius:14px !important;
            }
  
            .marketTable th,
            .marketTable td{
              padding:9px 8px !important;
              line-height:1.15 !important;
            }
  
            .marketTablePanel::-webkit-scrollbar{
              width:9px !important;
            }
  
            .marketTablePanel::-webkit-scrollbar-track{
              background:rgba(15,23,42,.72) !important;
              border-radius:999px !important;
            }
  
            .marketTablePanel::-webkit-scrollbar-thumb{
              background:rgba(30,215,96,.70) !important;
              border-radius:999px !important;
              border:2px solid rgba(15,23,42,.72) !important;
            }
  
            .marketTablePanel::-webkit-scrollbar-thumb:hover{
              background:rgba(30,215,96,.92) !important;
            }
          `;
          document.head.appendChild(style);
        }
  
        async function loadMarketGames({ date, fresh = false } = {}){
          const dateYMD = date || dateInput?.value || todayAM_YMD();
  
          // Se já carregou a data e não é refresh, reaproveita.
          if (!fresh && lastMarketDateYMD === dateYMD && Array.isArray(lastMarketGames) && lastMarketGames.length){
            return lastMarketGames;
          }
  
  
          // FIX: se os jogos do dia já estão carregados na tela principal,
          // usa esse cache imediatamente e NÃO chama /mercados nem /quentes de novo.
          const gamesPanelCacheEl = document.querySelector(".gamesPanel");
          const panelCache = gamesPanelCacheEl?.__cornerProAllGames;
          const panelCacheDate = gamesPanelCacheEl?.dataset?.marketCacheDate;
          if (!fresh && panelCacheDate === dateYMD && Array.isArray(panelCache) && panelCache.length){
            lastMarketGames = enrichMarketsList(filterServerCompatibleGames(panelCache.map(g => g?.raw || g)));
            lastMarketDateYMD = dateYMD;
            return lastMarketGames;
          }
  
          if (!fresh && lastDateYMD === dateYMD && Array.isArray(lastRawGames) && lastRawGames.length){
            lastMarketGames = enrichMarketsList(filterServerCompatibleGames(lastRawGames));
            lastMarketDateYMD = dateYMD;
            return lastMarketGames;
          }
  
          if (loadingMarkets) return lastMarketGames;
  
          loadingMarkets = true;
  
          try{
            // Endpoint novo: deve trazer os jogos reais do dia sem os bloqueios pesados de escanteios.
            // Se /mercados não existir ou vier vazio, tenta /quentes automaticamente.
            const list = await fetchGamesFromApi(["/mercados", "/quentes"], dateYMD, fresh);
  
            lastMarketGames = enrichMarketsList(filterServerCompatibleGames(Array.isArray(list) ? list : []));
            lastMarketDateYMD = dateYMD;
  
            return lastMarketGames;
          } catch (err){
            console.warn("Falha ao carregar /mercados. Usando fallback de /quentes.", err);
  
            // Fallback seguro: mantém a tela funcionando se o backend ainda não tiver /mercados.
            lastMarketGames = enrichMarketsList(filterServerCompatibleGames(Array.isArray(lastRawGames) ? lastRawGames : []));
            lastMarketDateYMD = dateYMD;
  
            return lastMarketGames;
          } finally {
            loadingMarkets = false;
          }
        }
  
        function renderMarketFilters(){
          installFilterStyles();
          installMarketScrollFix();
          if (!top1El) return;
          top1El.closest(".panel")?.classList.add("is-market-scroll-panel");
  
          const dateYMD = lastMarketDateYMD || lastDateYMD || dateInput?.value || todayAM_YMD();
  
          // A aba FILTROS usa /mercados quando disponível.
          // Se /mercados ainda não carregou, usa fallback temporário da lista atual.
          const baseMarketList = Array.isArray(lastMarketGames) && lastMarketGames.length
            ? lastMarketGames
            : lastRawGames;
  
          const games = enrichMarketsList(filterServerCompatibleGames(dedupeList(baseMarketList)));
          let filtered = games.filter(j => marketPass(j, activeMarketFilter));
  
          filtered = filtered.sort((a, b) => {
            if (filterSortMode === "time"){
              const ma = getMatchMinutesAM(a, dateYMD);
              const mb = getMatchMinutesAM(b, dateYMD);
              if (ma !== null && mb !== null && ma !== mb) return ma - mb;
              if (ma !== null && mb === null) return -1;
              if (ma === null && mb !== null) return 1;
            }
            if (filterSortMode === "corners") return getProj(b) - getProj(a);
            return marketPercent(b, activeMarketFilter) - marketPercent(a, activeMarketFilter);
          });
  
          const rows = filtered.slice(0, 40).map(j => {
            const casa = safe(j?.casa, "Time A");
            const fora = safe(j?.fora, "Time B");
            const liga = safe(j?.liga, "—");
            const hora = timeOnlyAM(dateYMD, safe(j?.hora, "—"));
            const mp = Math.round(marketPercent(j, activeMarketFilter));
            const m = j.markets || {};
  
            return `
              <tr>
                <td>
                  <div class="marketTeams">${teamNameHTML(casa, "marketTeamName")}<br>${teamNameHTML(fora, "marketTeamName")}</div>
                  <div class="marketMeta">${liga}</div>
                </td>
                <td>${hora}</td>
                <td>${fmt(getProj(j), 1)}</td>
                <td><span class="mkBadge ${marketClass(m.btts)}">${marketIcon(m.btts)}</span></td>
                <td><span class="mkBadge ${marketClass(m.over15)}">${marketIcon(m.over15)}</span></td>
                <td><span class="mkBadge ${marketClass(m.over25)}">${marketIcon(m.over25)}</span></td>
                <td><span class="mkBadge ${marketClass(m.over35)}">${marketIcon(m.over35)}</span></td>
                <td><span class="mkBadge ${marketClass(m.corners95)}">${marketIcon(m.corners95)}</span></td>
                <td><span class="mkBadge ${marketClass(m.corners105)}">${marketIcon(m.corners105)}</span></td>
                <td><span class="mkBadge ${marketClass(m.corners115)}">${marketIcon(m.corners115)}</span></td>
                <td><span class="marketPercent">${mp}%</span></td>
                <td>
                  <button
                    type="button"
                    class="matchCenterMiniBtn"
                    data-open-match-center-table="1"
                    data-match-id="${safe(j?.match_id || j?.id || j?.event_key, "")}"
                    data-home="${escapeAttrLite(casa)}"
                    data-away="${escapeAttrLite(fora)}"
                    data-league="${escapeAttrLite(liga)}"
                    data-time="${escapeAttrLite(hora)}"
                    title="Abrir Match Center"
                  >📊</button>
                </td>
              </tr>
            `;
          }).join("");
  
          top1El.innerHTML = `
            <div class="marketFiltersWrap">
              <section class="marketFilterPanel">
                <div class="marketFilterHeader">
                  <div class="marketFilterTitle">⌯ FILTROS</div>
                  <div class="marketChips">
                    ${MARKET_FILTERS.map(f => `<button type="button" class="marketChip ${activeMarketFilter === f.key ? "is-active" : ""}" data-market-filter="${f.key}">${f.label}</button>`).join("")}
                  </div>
                  <button type="button" class="marketClear" data-market-clear="1">🗑 LIMPAR FILTROS</button>
                </div>
                <div class="marketInfo">Use os filtros para encontrar jogos por mercado. A tela principal de <b>2 jogos do dia em cantos</b> continua separada e preservada.</div>
              </section>
  
              <section class="marketTablePanel">
                <div class="marketTableTop">
                  <div class="marketTableTitle">JOGOS ENCONTRADOS (${filtered.length})</div>
                  <label class="marketSort">ORDENAR POR:
                    <select id="marketSortSelect">
                      <option value="market" ${filterSortMode === "market" ? "selected" : ""}>Maior % do filtro</option>
                      <option value="time" ${filterSortMode === "time" ? "selected" : ""}>Horário</option>
                      <option value="corners" ${filterSortMode === "corners" ? "selected" : ""}>Projeção de cantos</option>
                    </select>
                  </label>
                </div>
  
                ${filtered.length ? `
                  <table class="marketTable">
                    <thead>
                      <tr>
                        <th>Jogo</th>
                        <th>Horário</th>
                        <th>Proj. cantos</th>
                        <th>Ambas</th>
                        <th>+1.5</th>
                        <th>+2.5</th>
                        <th>+3.5</th>
                        <th>Cantos +9.5</th>
                        <th>Cantos +10.5</th>
                        <th>Cantos +11.5</th>
                        <th>% filtro</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                ` : `<div class="marketEmpty">Nenhum jogo encontrado para esse filtro nesta data.</div>`}
              </section>
            </div>
          `;
  
          top1El.querySelectorAll("[data-market-filter]").forEach(btn => {
            btn.addEventListener("click", () => {
              activeMarketFilter = btn.getAttribute("data-market-filter") || "all";
              renderMarketFilters();
            });
          });
  
          const clear = top1El.querySelector("[data-market-clear]");
          if (clear){
            clear.addEventListener("click", () => {
              activeMarketFilter = "all";
              renderMarketFilters();
            });
          }
  
          const sort = top1El.querySelector("#marketSortSelect");
          if (sort){
            sort.addEventListener("change", () => {
              filterSortMode = sort.value || "market";
              renderMarketFilters();
            });
          }
  
          top1El.querySelectorAll(".btnStats").forEach(btn => {
            btn.addEventListener("click", () => {
              openMatchStats({
                matchId: btn.dataset.matchId,
                home: btn.dataset.home,
                away: btn.dataset.away
              });
            });
          });
  
          if (countTop) countTop.textContent = String(filtered.length);
          updateIaBoxFromTop([]);
        }
  
        function toggleFiltersHeader(hide = false){
          const centerTitle = document.querySelector(".center-title");
          if (!centerTitle) return;
          centerTitle.style.display = hide ? "none" : "";
        }
  
        // ---------------- MODAL ESTATÍSTICAS DO JOGO ----------------
        function getStatsModalEls(){
          return {
            modal: document.getElementById("matchStatsModal"),
            body: document.getElementById("statsModalBody"),
            close: document.getElementById("closeStatsModal")
          };
        }
  
        function openStatsModal(){
          const { modal } = getStatsModalEls();
          if (modal) modal.classList.add("active");
        }
  
        function closeStatsModal(){
          const { modal } = getStatsModalEls();
          if (modal) modal.classList.remove("active");
        }
  
        function statNumber(...values){
          for (const v of values){
            if (v === undefined || v === null || v === "") continue;
            if (typeof v === "string"){
              const cleaned = v.replace("%", "").replace(",", ".").trim();
              const n = Number(cleaned);
              if (Number.isFinite(n)) return n;
              continue;
            }
            const n = Number(v);
            if (Number.isFinite(n)) return n;
          }
          return null;
        }
  
        function statByAliases(obj, aliases = [], side = null){
          const wanted = aliases.map(a => String(a || "").toLowerCase());
          const sideWanted = side ? String(side).toLowerCase() : null;
          const seen = new Set();
  
          function sideValue(item){
            if (!sideWanted || !item || typeof item !== "object") return null;
            const v = sideWanted === "home"
              ? (item.home ?? item.home_value ?? item.hometeam ?? item.match_hometeam ?? item.homeTeam)
              : (item.away ?? item.away_value ?? item.awayteam ?? item.match_awayteam ?? item.awayTeam);
            return statNumber(v);
          }
  
          function walk(node){
            if (!node || typeof node !== "object") return null;
            if (seen.has(node)) return null;
            seen.add(node);
  
            if (Array.isArray(node)){
              for (const item of node){
                if (item && typeof item === "object"){
                  const label = String(item.type ?? item.stat_type ?? item.name ?? item.label ?? item.statistic ?? item.key ?? "").toLowerCase();
                  if (wanted.some(a => label.includes(a))){
                    const sv = sideValue(item);
                    if (Number.isFinite(sv)) return sv;
                    const direct = statNumber(item.value, item.total);
                    if (Number.isFinite(direct)) return direct;
                  }
                }
                const r = walk(item);
                if (Number.isFinite(r)) return r;
              }
              return null;
            }
  
            for (const [key, value] of Object.entries(node)){
              const k = String(key).toLowerCase();
              const keyMatches = wanted.some(a => k.includes(a));
              const sideMatches = !sideWanted || k.includes(sideWanted) || k.includes(sideWanted === "home" ? "casa" : "fora") || k.includes(sideWanted === "home" ? "mandante" : "visitante");
  
              if (keyMatches && sideMatches){
                const n = statNumber(value);
                if (Number.isFinite(n)) return n;
              }
  
              const r = walk(value);
              if (Number.isFinite(r)) return r;
            }
  
            return null;
          }
  
          return walk(obj);
        }
  
        function statText(v, fallback = "—"){
          return (v === undefined || v === null || v === "") ? fallback : v;
        }
  
        function yesNo(value){
          return value ? "BATEU" : "NÃO BATEU";
        }
  
        function resultClass(value){
          return value ? "is-ok" : "is-red";
        }
  
        function calcRate(value, total){
          const v = Number(value);
          const t = Number(total);
          if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) return 50;
          return clamp(Math.round((v / t) * 100), 5, 95);
        }
  
        function calcConfidenceFromStats({ cornersTotal, goalsTotal, markets }){
          let conf = 58;
  
          if (Number.isFinite(cornersTotal)){
            if (cornersTotal >= 12) conf += 20;
            else if (cornersTotal >= 10) conf += 14;
            else if (cornersTotal >= 8) conf += 5;
            else conf -= 10;
          }
  
          if (Number.isFinite(goalsTotal)){
            if (goalsTotal >= 3) conf += 8;
            else if (goalsTotal >= 2) conf += 4;
          }
  
          const okMarkets = Object.values(markets || {}).filter(Boolean).length;
          conf += okMarkets * 3;
  
          return clamp(conf, 12, 96);
        }
  
        function statBar(label, value, total, note = ""){
          const width = calcRate(value, total);
          return `
            <div class="premiumStatBar">
              <div class="premiumStatBarTop">
                <span>${label}</span>
                <b>${statText(value)}</b>
              </div>
              <div class="premiumBarTrack">
                <div class="premiumBarFill" style="width:${width}%"></div>
              </div>
              ${note ? `<small>${note}</small>` : ""}
            </div>
          `;
        }
  
        function renderPremiumMarket(label, value, detail = ""){
          return `
            <div class="premiumMarket ${resultClass(value)}">
              <div>
                <span>${label}</span>
                ${detail ? `<small>${detail}</small>` : ""}
              </div>
              <strong>${yesNo(value)}</strong>
            </div>
          `;
        }
  
        function renderPremiumBadge(text, type = "green"){
          return `<span class="premiumBadge ${type}">${text}</span>`;
        }
  
        function renderMatchStats(data, fallback = {}){
          const home = statText(data?.home || fallback.home, "Time A");
          const away = statText(data?.away || fallback.away, "Time B");
  
          const goalsHome = statNumber(data?.goals?.home, data?.home_goals, data?.score?.home);
          const goalsAway = statNumber(data?.goals?.away, data?.away_goals, data?.score?.away);
          const goalsTotal = statNumber(data?.goals?.total, goalsHome !== null && goalsAway !== null ? goalsHome + goalsAway : null);
  
          const cornersHome = statNumber(data?.corners?.home, data?.home_corners, data?.stats?.corners?.home);
          const cornersAway = statNumber(data?.corners?.away, data?.away_corners, data?.stats?.corners?.away);
          const cornersTotal = statNumber(data?.corners?.total, cornersHome !== null && cornersAway !== null ? cornersHome + cornersAway : null);
          const cornersChartTotal = Number(cornersTotal ?? ((cornersHome || 0) + (cornersAway || 0))) || 0;
          const cornersHomePct = cornersChartTotal > 0 ? Math.round((Number(cornersHome || 0) / cornersChartTotal) * 100) : 50;
          const cornersAwayPct = cornersChartTotal > 0 ? 100 - cornersHomePct : 50;
          const homeName = safe(data?.home || data?.casa || data?.home_name || data?.team_home || data?.teams?.home?.name || "Casa");
          const awayName = safe(data?.away || data?.fora || data?.away_name || data?.team_away || data?.teams?.away?.name || "Fora");
  
          const attacksHome = statNumber(
            data?.pressure?.home, data?.attacks?.home, data?.dangerous_attacks?.home,
            data?.stats?.attacks?.home, data?.stats?.dangerous_attacks?.home,
            statByAliases(data, ["dangerous", "ataques perigosos", "pressure", "pressão"], "home")
          );
          const attacksAway = statNumber(
            data?.pressure?.away, data?.attacks?.away, data?.dangerous_attacks?.away,
            data?.stats?.attacks?.away, data?.stats?.dangerous_attacks?.away,
            statByAliases(data, ["dangerous", "ataques perigosos", "pressure", "pressão"], "away")
          );
          const attacksTotal = statNumber(data?.pressure?.total, data?.attacks?.total, attacksHome !== null && attacksAway !== null ? attacksHome + attacksAway : null);
  
          const shotsHome = statNumber(
            data?.shots?.home, data?.finalizations?.home, data?.finalizacoes?.home,
            data?.stats?.shots?.home, data?.stats?.finalizations?.home,
            statByAliases(data, ["total shots", "shots", "shot", "finaliza", "finalizações", "finalizacoes", "chutes"], "home")
          );
          const shotsAway = statNumber(
            data?.shots?.away, data?.finalizations?.away, data?.finalizacoes?.away,
            data?.stats?.shots?.away, data?.stats?.finalizations?.away,
            statByAliases(data, ["total shots", "shots", "shot", "finaliza", "finalizações", "finalizacoes", "chutes"], "away")
          );
          const shotsTotal = statNumber(data?.shots?.total, data?.finalizations?.total, data?.finalizacoes?.total, shotsHome !== null && shotsAway !== null ? shotsHome + shotsAway : null);
  
          const shotsOnHome = statNumber(data?.shots?.on_target_home, data?.shots_on_target?.home, statByAliases(data, ["shots on goal", "shots on target", "on target", "chutes no gol", "finalizações no gol", "finalizacoes no gol"], "home"));
          const shotsOnAway = statNumber(data?.shots?.on_target_away, data?.shots_on_target?.away, statByAliases(data, ["shots on goal", "shots on target", "on target", "chutes no gol", "finalizações no gol", "finalizacoes no gol"], "away"));
          const shotsOnTotal = statNumber(data?.shots?.on_target_total, data?.shots_on_target?.total, shotsOnHome !== null && shotsOnAway !== null ? shotsOnHome + shotsOnAway : null);
  
          const m = data?.markets || {};
          const btts = !!m.btts;
          const over15 = !!m.over15;
          const over25 = !!m.over25;
          const over35 = !!m.over35;
          const corners95 = !!m.corners95;
          const corners105 = !!m.corners105;
          const corners115 = !!m.corners115;
  
          const confidence = calcConfidenceFromStats({
            cornersTotal,
            goalsTotal,
            markets: { btts, over15, over25, over35, corners95, corners105, corners115 }
          });
  
          const rhythmLabel = Number.isFinite(cornersTotal) && cornersTotal >= 10
            ? "RITMO ALTO"
            : Number.isFinite(cornersTotal) && cornersTotal >= 8
              ? "RITMO MÉDIO"
              : "RITMO CONTROLADO";
  
          const trendLabel = corners95 ? "TENDÊNCIA OVER" : "TENDÊNCIA BAIXA";
          const marketLabel = corners95 || over25 ? "MERCADO FAVORÁVEL" : "MERCADO SELETIVO";
  
          const scoreLine = `${statText(goalsHome)} - ${statText(goalsAway)}`;
          const cornerLine = `${statText(cornersHome)} x ${statText(cornersAway)}`;
          const finishedText = data?.finished ? "FINALIZADO" : statText(data?.status, "EM ANÁLISE");
  
          return `
            <section class="premiumStatsDashboard">
  
              <div class="premiumHero">
                <div class="premiumTeamBlock">
                  <div class="teamCrest">${String(home).slice(0, 1).toUpperCase()}</div>
                  <strong>${home}</strong>
                  <small>Mandante</small>
                </div>
  
                <div class="premiumScoreBlock">
                  <div class="premiumStatus">${finishedText}</div>
                  <div class="premiumScore">${scoreLine}</div>
                  <div class="premiumSubLine">
                    ${statText(data?.league, "Liga não informada")} • ${statText(data?.date, "")} ${statText(data?.time, "")}
                  </div>
                </div>
  
                <div class="premiumTeamBlock">
                  <div class="teamCrest">${String(away).slice(0, 1).toUpperCase()}</div>
                  <strong>${away}</strong>
                  <small>Visitante</small>
                </div>
              </div>
  
              <div class="premiumBadgeRow">
                ${renderPremiumBadge(marketLabel, corners95 || over25 ? "green" : "yellow")}
                ${renderPremiumBadge(rhythmLabel, rhythmLabel.includes("ALTO") ? "green" : "blue")}
                ${renderPremiumBadge(trendLabel, trendLabel.includes("OVER") ? "green" : "red")}
              </div>
  
              <div class="premiumMainGrid">
                <div class="premiumLeftColumn">
  
                  <div class="premiumCard premiumSummaryCard">
                    <div class="premiumCardTitle">Resumo da partida</div>
  
                    <div class="premiumMiniGrid">
                      <div class="premiumMiniStat">
                        <span>Gols</span>
                        <strong>${statText(goalsTotal)}</strong>
                      </div>
                      <div class="premiumMiniStat">
                        <span>Cantos</span>
                        <strong>${statText(cornersTotal)}</strong>
                      </div>
                      <div class="premiumMiniStat">
                        <span>Finalizações</span>
                        <strong>${statText(shotsTotal)}</strong>
                      </div>
                      <div class="premiumMiniStat">
                        <span>Escanteios</span>
                        <strong>${cornerLine}</strong>
                      </div>
                      <div class="premiumMiniStat">
                        <span>Ambas marcam</span>
                        <strong>${btts ? "SIM" : "NÃO"}</strong>
                      </div>
                    </div>
                  </div>
  
                  <div class="premiumCard">
                    <div class="premiumCardTitle">Força da partida</div>
                    ${statBar(home, cornersHome, cornersTotal, "Participação nos escanteios")}
                    ${statBar(away, cornersAway, cornersTotal, "Participação nos escanteios")}
                    ${statBar("Finalizações totais", shotsTotal, Math.max(Number(shotsTotal || 0), 18), "Volume ofensivo estimado")}
                    ${statBar("No alvo", shotsOnTotal, Math.max(Number(shotsTotal || 0), 10), "Finalizações certas")}
                  </div>
  
                  <div class="premiumCard">
                    <div class="premiumCardTitle">Mercados do jogo</div>
                    <div class="premiumMarketsGrid">
                      ${renderPremiumMarket("Ambas marcam", btts)}
                      ${renderPremiumMarket("+1.5 gols", over15)}
                      ${renderPremiumMarket("+2.5 gols", over25)}
                      ${renderPremiumMarket("+3.5 gols", over35)}
                      ${renderPremiumMarket("+9.5 cantos", corners95, `${statText(cornersTotal)} cantos`)}
                      ${renderPremiumMarket("+10.5 cantos", corners105, `${statText(cornersTotal)} cantos`)}
                      ${renderPremiumMarket("+11.5 cantos", corners115, `${statText(cornersTotal)} cantos`)}
                    </div>
                  </div>
  
                </div>
  
                <aside class="premiumRightColumn">
                  <div class="premiumCard premiumConfidenceCard">
                    <div class="premiumCardTitle">Confiança geral</div>
                    <div class="confidenceCircle" style="--value:${confidence}%">
                      <span>${confidence}%</span>
                    </div>
                    <p>
                      ${corners95
                        ? "O jogo confirmou boa leitura para cantos e manteve perfil favorável ao over."
                        : "O jogo ficou abaixo da linha principal de cantos e pede revisão da leitura pré-jogo."}
                    </p>
                  </div>
  
                  <div class="premiumCard premiumPressureCard">
                    <div class="premiumCardTitle">Pressão da partida</div>
                    ${statBar(home, attacksHome, attacksTotal, "Pressão / ataques perigosos")}
                    ${statBar(away, attacksAway, attacksTotal, "Pressão / ataques perigosos")}
                  </div>
  
                  <div class="premiumCard premiumFinalRead">
                    <div class="premiumCardTitle">Leitura final</div>
                    <p>
                      Placar <b>${scoreLine}</b>, com <b>${statText(cornersTotal)}</b> escanteios no total.
                      ${corners95
                        ? "A linha +9.5 cantos foi confirmada."
                        : "A linha +9.5 cantos não foi confirmada."}
                    </p>
                  </div>
                </aside>
              </div>
  
            </section>
          `;
        }
  
        async function openMatchStats({ matchId, home, away } = {}){
          const { body } = getStatsModalEls();
  
          if (!body) return;
  
          openStatsModal();
  
          body.innerHTML = `
            <div class="loadingStats premiumLoading">
              <div class="loaderBall"></div>
              <span>Carregando estatísticas de ${safe(home, "Time A")} x ${safe(away, "Time B")}...</span>
            </div>
          `;
  
          if (!matchId || matchId === "—"){
            body.innerHTML = `
              <div class="statsError premiumStatsError">
                Não encontrei o ID desse jogo para buscar as estatísticas.
              </div>
            `;
            return;
          }
  
          try{
            const data = await fetchJson(`/match_result?match_id=${encodeURIComponent(matchId)}`);
            body.innerHTML = renderMatchStats(data, { home, away });
          } catch (err){
            body.innerHTML = `
              <div class="statsError premiumStatsError">
                Não foi possível carregar as estatísticas desse jogo.<br>
                Verifique se o backend já possui a rota <b>/match_result</b>.
              </div>
            `;
          }
        }
  
        function setupStatsModal(){
          const { modal, close } = getStatsModalEls();
  
          if (close){
            close.addEventListener("click", closeStatsModal);
          }
  
          if (modal){
            modal.addEventListener("click", (ev) => {
              if (ev.target === modal) closeStatsModal();
            });
          }
  
          document.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape") closeStatsModal();
          });
        }
  
        function setupViewNavigation(){
          const links = Array.from(document.querySelectorAll("a, button, .nav-item, .tab, [data-tab], [data-view]") || []);
          links.forEach(el => {
            const txt = String(el.textContent || "").trim().toUpperCase();
            const data = String(el.getAttribute("data-tab") || el.getAttribute("data-view") || "").trim().toLowerCase();
  
            if (txt === "FILTROS" || data === "filtros" || data === "filters"){
              el.addEventListener("click", (ev) => {
                ev.preventDefault();
                currentView = "filters";
                toggleFiltersHeader(true);
                links.forEach(x => x.classList?.remove("active", "is-active"));
                el.classList?.add("active", "is-active");
  
                showDashboardLoading("Carregando mercados do dia...");
  
                loadMarketGames({
                  date: dateInput?.value || todayAM_YMD(),
                  fresh: false
                }).then(() => renderMarketFilters());
              });
            }
  
            if (txt.includes("ANÁLISE PRÉ JOGO") || txt.includes("ANALISE PRÉ JOGO") || txt.includes("ANALISE PRE JOGO") || data === "pregame"){
              el.addEventListener("click", (ev) => {
                ev.preventDefault();
                currentView = "pregame";
                top1El?.closest(".panel")?.classList.remove("is-market-scroll-panel");
                toggleFiltersHeader(false);
                links.forEach(x => x.classList?.remove("active", "is-active"));
                el.classList?.add("active", "is-active");
                loadAll({ date: dateInput?.value || todayAM_YMD(), fresh: false });
              });
            }
          });
        }
  
        // ---------------- Fetch ----------------
        async function fetchJson(url){
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
          return await r.json();
        }
  
        // =========================================================
        // LIGAÇÃO REAL COM A API DO SERVIDOR
        // Normaliza respostas em formatos diferentes:
        // array direto, {games:[]}, {data:[]}, {jogos:[]}, {matches:[]}, etc.
        // Isso evita a tela ficar com jogos fixos/demo quando o backend responde
        // em objeto, que é o padrão em muitos endpoints Express.
        // =========================================================
        function extractGamesFromApiPayload(payload){
          if (Array.isArray(payload)) return payload;
          if (!payload || typeof payload !== "object") return [];
  
          const keys = [
            "games", "jogos", "matches", "fixtures", "events",
            "data", "items", "results", "response", "quentes", "list"
          ];
  
          for (const key of keys){
            const value = payload[key];
            if (Array.isArray(value)) return value;
            if (value && typeof value === "object"){
              const nested = extractGamesFromApiPayload(value);
              if (nested.length) return nested;
            }
          }
  
          return [];
        }
  
        async function fetchGamesFromApi(endpointList, dateYMD, fresh = false){
          const endpoints = Array.isArray(endpointList) ? endpointList : [endpointList];
          let lastError = null;
  
          for (const endpoint of endpoints){
            try{
              const sep = String(endpoint).includes("?") ? "&" : "?";
              const url = `${endpoint}${sep}date=${encodeURIComponent(dateYMD)}&fresh=${fresh ? "1" : "0"}&_=${Date.now()}`;
              const payload = await fetchJson(url);
              const games = extractGamesFromApiPayload(payload);
  
              if (games.length){
                console.info(`[Corners Radar] Jogos reais carregados de ${endpoint}:`, games.length);
                return games;
              }
  
              console.warn(`[Corners Radar] ${endpoint} respondeu sem lista de jogos reconhecida.`, payload);
            } catch (err){
              lastError = err;
              console.warn(`[Corners Radar] Falha no endpoint ${endpoint}.`, err);
            }
          }
  
          if (lastError) throw lastError;
          return [];
        }
  
        async function fetchSideGames(dateYMD, fresh = false){
          const payload = await fetchJson(`/side?date=${encodeURIComponent(dateYMD)}&fresh=${fresh ? "1" : "0"}&_=${Date.now()}`);
          const games = extractGamesFromApiPayload(payload);
          if (games.length && !Array.isArray(payload?.games)){
            return { games, message: payload?.message || "" };
          }
          return payload;
        }
  
        function pickStatusChip(j){
          const p = getProb(j);
          if (hasFullBase(j) && p >= TOP6_MIN_PROB_FULL) return { text: "OK", icon: "▲" };
          if (p >= 60) return { text: "CUIDADO", icon: "▲" };
          return { text: "CUIDADO", icon: "▲" };
        }
  
        // ---------------- H2H ESCANTEIOS ----------------
        function getH2HCornersList(j){
          const raw =
            j?.h2h_corners ||
            j?.h2hCorners ||
            j?.ultimos_confrontos_cantos ||
            j?.ultimosConfrontosCantos ||
            j?.last_h2h_corners ||
            j?.h2h?.corners ||
            j?.h2h?.cantos ||
            [];
  
          return Array.isArray(raw) ? raw.slice(0, 5) : [];
        }
  
        function getH2HTeamHome(item){
          return safe(item?.home || item?.casa || item?.home_team || item?.team_home || item?.mandante, "Casa");
        }
  
        function getH2HTeamAway(item){
          return safe(item?.away || item?.fora || item?.away_team || item?.team_away || item?.visitante, "Fora");
        }
  
        function getH2HHomeCorners(item){
          const n = Number(item?.home_corners ?? item?.casa_cantos ?? item?.corners_home ?? item?.cornersCasa ?? item?.cantos_casa);
          return Number.isFinite(n) ? n : null;
        }
  
        function getH2HAwayCorners(item){
          const n = Number(item?.away_corners ?? item?.fora_cantos ?? item?.corners_away ?? item?.cornersFora ?? item?.cantos_fora);
          return Number.isFinite(n) ? n : null;
        }
  
        function getH2HTotal(item){
          const total = Number(item?.total_corners ?? item?.total_cantos ?? item?.corners_total ?? item?.total);
          if (Number.isFinite(total)) return total;
  
          const home = getH2HHomeCorners(item);
          const away = getH2HAwayCorners(item);
          if (Number.isFinite(home) && Number.isFinite(away)) return home + away;
          return null;
        }
  
        function renderH2HCorners(node, j){
          const listEl = node.querySelector(".js-h2h");
          const avgEl = node.querySelector(".js-h2h-avg");
          if (!listEl) return;
  
          const list = getH2HCornersList(j);
          listEl.innerHTML = "";
  
          if (!list.length){
            listEl.innerHTML = `<div class="h2hEmpty">Sem confrontos recentes de escanteios disponíveis.</div>`;
            if (avgEl) avgEl.textContent = "—";
            return;
          }
  
          let sum = 0;
          let count = 0;
  
          list.forEach((item) => {
            const home = getH2HTeamHome(item);
            const away = getH2HTeamAway(item);
            const hc = getH2HHomeCorners(item);
            const ac = getH2HAwayCorners(item);
            const total = getH2HTotal(item);
            const date = safe(item?.date || item?.data || item?.fixture_date || item?.dia, "");
  
            if (Number.isFinite(total)){
              sum += total;
              count += 1;
            }
  
            const row = document.createElement("div");
            row.className = "h2hRow";
  
            const scoreTxt = (Number.isFinite(hc) && Number.isFinite(ac))
              ? `${home} ${hc} x ${ac} ${away}`
              : `${home} x ${away}`;
  
            row.innerHTML = `
              <div class="h2hTeams">${date ? `${date} • ` : ""}${scoreTxt}</div>
              <div class="h2hTotal">Total: ${Number.isFinite(total) ? total : "—"}</div>
            `;
  
            listEl.appendChild(row);
          });
  
          if (avgEl){
            avgEl.textContent = count ? `${fmt(sum / count, 1)} cantos por jogo` : "—";
          }
        }
  
        // ---------------- NOTE INTELIGENTE ----------------
        function normalizeCommentText(text){
          return String(text || "").replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
        }
  
        function cleanComentarioForNote(raw){
          let txt = normalizeCommentText(raw);
          if (!txt || txt === "—") return "";
  
          const patterns = [
            /ritmo\s*:\s*ritmo\s+(alto|m[eé]dio|baixo)\.?/gi,
            /jogo\s+considerado\s+seguro\s+pela\s+ia\.?/gi,
            /ia\s+sugere\s+cautela\.?/gi,
            /armadilha\s+detectada\s+pela\s+ia\.?/gi,
            /favorito\s+detectado\s*\([^)]+\)\.?/gi,
            /favorito\s+detectado\.?/gi,
            /seguro\s+ia\.?/gi,
            /aten[cç][aã]o\s+ia\.?/gi,
            /risco\s+ia\.?/gi,
            /laterais\s+muito\s+fortes\.?/gi,
            /perfil\s+equilibrado\.?/gi,
            /tend[eê]ncia\s+por\s+dentro\.?/gi
          ];
  
          patterns.forEach(rx => { txt = txt.replace(rx, " "); });
          return txt.replace(/\s{2,}/g, " ").replace(/\.\s*\./g, ".").replace(/^\s*[•\-–—]\s*/g, "").trim();
        }
  
        function buildContextPhrase(j){
          const perfil = String(j?.perfil_laterais || "");
          const ritmo = ritmoInfo(j);
          const alerta = getAlertInfo(j);
          const proj = getProj(j);
          const p = getProb(j);
  
          if (alerta.level === "red"){
            if (perfil === "TENDENCIA_CENTRAL") return "Jogo pede leitura mais seletiva, com volume menos confiável pelos lados.";
            return "Cenário mais traiçoeiro, exigindo entrada com bastante critério.";
          }
  
          if (alerta.level === "yellow"){
            if (ritmo.level === "med") return "Bom cenário, mas ainda depende de confirmação de intensidade.";
            if (proj >= 11) return "Tem base para cantos, embora não seja o quadro mais limpo do dia.";
            return "Jogo interessante, mas sem margem tão folgada quanto o topo.";
          }
  
          if (perfil === "LATERAIS_FORTES" && (ritmo.level === "high" || p >= 72)) return "Boa sustentação pelos lados e tendência de pressão constante.";
          if (ritmo.level === "high") return "Tende a manter volume forte e acelerar bem ao longo do jogo.";
          if (ritmo.level === "med") return "Tem boa base pré-jogo e costuma ganhar força com o andamento.";
          return "Cenário estável para acompanhar, com sinais positivos no pré-jogo.";
        }
  
        function buildFavoritePhrase(j){
          const favorites = getFavoriteTeamsInMatch(j);
          if (!favorites.length) return "";
          if (favorites.length === 1) return `${favorites[0]} aparece como time de atenção especial neste confronto.`;
          return "Confronto com presença de equipes de atenção especial.";
        }
  
        function truncateSmart(text, max = 118){
          const t = normalizeCommentText(text);
          if (!t) return "";
          if (t.length <= max) return t;
          const cut = t.slice(0, max);
          const lastBreak = Math.max(cut.lastIndexOf("."), cut.lastIndexOf(","), cut.lastIndexOf(" "));
          const out = (lastBreak > 70 ? cut.slice(0, lastBreak) : cut).trim();
          return `${out}…`;
        }
  
        function buildSmartNote(j){
          const pieces = [];
          const favPhrase = buildFavoritePhrase(j);
          const contextPhrase = buildContextPhrase(j);
          const comentario = cleanComentarioForNote(j?.comentario);
  
          if (favPhrase) pieces.push(favPhrase);
          if (contextPhrase) pieces.push(contextPhrase);
          if (comentario) pieces.push(comentario);
  
          let finalText = pieces.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
          if (!finalText) finalText = "Leitura pré-jogo favorável para monitorar cantos com atenção ao início.";
          if (!/[.!?…]$/.test(finalText)) finalText += ".";
          return truncateSmart(finalText, 120);
        }
  
        // ---------------- Render Cards ----------------
        function clearTopBadges(node){
          const oldRank = node.querySelector(".rankBadge");
          const oldBest = node.querySelector(".bestLabel");
          if (oldRank) oldRank.remove();
          if (oldBest) oldBest.remove();
        }
  
        function injectTopBadges(node, rank){
          clearTopBadges(node);
          const rankEl = document.createElement("div");
          rankEl.className = "rankBadge";
          rankEl.textContent = `#${rank}`;
          node.appendChild(rankEl);
  
          const bestEl = document.createElement("div");
          bestEl.className = "bestLabel";
  
          if (rank === 1){
            node.classList.add("bestMatch");
            bestEl.textContent = "🔥 JOGO 1 • MAIS CEDO";
            node.appendChild(bestEl);
          } else if (rank === 2){
            node.classList.add("promoted-second");
            bestEl.textContent = "📋 JOGO 2 • MAIS TARDE";
            node.appendChild(bestEl);
          }
        }
  
        function injectPromotedSecondBadge(node){
          clearTopBadges(node);
          node.classList.remove("bestMatch");
          const rankEl = document.createElement("div");
          rankEl.className = "rankBadge";
          rankEl.textContent = "#2";
          node.appendChild(rankEl);
  
          const labelEl = document.createElement("div");
          labelEl.className = "bestLabel";
          labelEl.textContent = "📋 JOGO 2";
          node.appendChild(labelEl);
          node.classList.add("promoted-second");
        }
  
        function applyCardVisualClasses(node, j, ritmo, alerta, isFav){
          node.classList.remove("is-strong", "is-top", "has-strong-edge", "is-risk", "is-favorite-card", "is-ritmo-alto", "is-ritmo-medio", "is-ritmo-baixo");
  
          if (hasFullBase(j) && getProb(j) >= 72) node.classList.add("is-strong", "is-top", "has-strong-edge");
          if (String(j?.perfil_laterais || "") === "LATERAIS_FORTES" && getProb(j) >= 70) node.classList.add("has-strong-edge");
          if (alerta.level === "red") node.classList.add("is-risk");
          if (isFav){
            node.classList.add("is-favorite-card");
            node.dataset.favorite = "1";
          }
          if (ritmo.level === "high") node.classList.add("is-ritmo-alto");
          if (ritmo.level === "med") node.classList.add("is-ritmo-medio");
          if (ritmo.level === "low") node.classList.add("is-ritmo-baixo");
        }
  
        function renderTopCard(j, rank = 1){
          if (!tplTop || !tplTop.content?.firstElementChild){
            const div = document.createElement("div");
            div.className = "empty";
            div.textContent = "⚠️ Falta o template #tplTopCard no HTML.";
            return div;
          }
  
          const node = tplTop.content.firstElementChild.cloneNode(true);
          const dateYMD = dateInput?.value;
          injectTopBadges(node, rank);
  
          const casa = safe(j?.casa, "Time A");
          const fora = safe(j?.fora, "Time B");
          const favoriteTeams = getFavoriteTeamsInMatch(j);
          const isFav = favoriteTeams.length > 0;
          const ritmo = ritmoInfo(j);
          const alerta = getAlertInfo(j);
  
          applyCardVisualClasses(node, j, ritmo, alerta, isFav);
  
          const homeEl = node.querySelector(".js-home");
          const awayEl = node.querySelector(".js-away");
          if (homeEl){
            homeEl.textContent = casa;
            applyTeamColor(homeEl, casa);
          }
          if (awayEl){
            awayEl.textContent = fora;
            applyTeamColor(awayEl, fora);
          }
  
          const metaEl = node.querySelector(".js-meta");
          if (metaEl){
            metaEl.textContent = [
              safe(j?.liga, "—"),
              `• ${timeLabelAM(dateYMD, safe(j?.hora, "—"))}`,
              `• score: ${safe(j?.score_adj ?? j?.score, "—")}`,
            ].join(" ");
          }
  
          const chips = node.querySelector(".js-chips");
          if (chips){
            chips.innerHTML = "";
            const st = pickStatusChip(j);
            chips.appendChild(makeChip(`${st.icon} ${st.text}`));
            chips.appendChild(makeChip(`● ${pickPerfilLabel(j?.perfil_laterais)}`));
            chips.appendChild(makeChip(ritmo.text, ritmo.cls));
            chips.appendChild(makeChip(alerta.text, alerta.cls));
            if (isFav) chips.appendChild(makeChip("★ FAVORITO"));
          }
  
          const teamsTextEl = node.querySelector(".teamsText");
          if (teamsTextEl && isFav){
            teamsTextEl.classList.add("is-fav-teams");
            teamsTextEl.title = `Favorito detectado: ${favoriteTeams.join(" / ")}`;
            teamsTextEl.insertAdjacentText("afterbegin", "★ ");
          }
  
          const horaEl = node.querySelector(".js-hora");
          const posEl = node.querySelector(".js-pos");
          const projEl = node.querySelector(".js-proj");
          const t2El = node.querySelector(".js-2t");
  
          if (horaEl) horaEl.textContent = timeOnlyAM(dateYMD, safe(j?.hora, "—"));
          if (posEl) posEl.textContent = safe(j?.posicao, "—");
          if (projEl) projEl.textContent = fmt(j?.proj_cantos, 1);
          if (t2El) t2El.textContent = pct(j?.chance_2t);
  
          renderH2HCorners(node, j);
  
          const p = getProb(j);
          const pill = node.querySelector(".js-pill");
          if (pill) pill.textContent = `🔥 Over 9.5 cantos — ${pct(p)}`;
  
          const fill = node.querySelector(".barFill");
          if (fill) fill.style.width = `${getBarPercent(j)}%`;
  
          const note = node.querySelector(".js-note");
          if (note) note.textContent = buildSmartNote(j);
  
          return node;
        }
  
        function renderPromotedSecondAsMain(j){
          const node = renderTopCard(j, 2);
          injectPromotedSecondBadge(node);
          return node;
        }
  
        function renderOtherCard(j){
          if (!tplOther || !tplOther.content?.firstElementChild){
            const div = document.createElement("div");
            div.className = "empty";
            div.textContent = "⚠️ Falta o template #tplOtherCard no HTML.";
            return div;
          }
  
          const node = tplOther.content.firstElementChild.cloneNode(true);
          const dateYMD = dateInput?.value;
          const casa = safe(j?.casa, "Time A");
          const fora = safe(j?.fora, "Time B");
          const favoriteTeams = getFavoriteTeamsInMatch(j);
          const isFav = favoriteTeams.length > 0;
          const ritmo = ritmoInfo(j);
          const alerta = getAlertInfo(j);
  
          applyCardVisualClasses(node, j, ritmo, alerta, isFav);
  
          const teamsEl = node.querySelector(".js-teams");
          const metaEl = node.querySelector(".js-meta");
  
          if (teamsEl){
            teamsEl.innerHTML = `${isFav ? "★ " : ""}${teamNameHTML(casa, "smallTeamName")} <span class="teamVsMini">x</span> ${teamNameHTML(fora, "smallTeamName")}`;
            if (isFav) teamsEl.title = `Favorito detectado: ${favoriteTeams.join(" / ")}`;
          }
  
          if (metaEl){
            metaEl.textContent = `${safe(j?.liga, "—")} • ${timeLabelAM(dateYMD, safe(j?.hora, "—"))} • score: ${safe(j?.score_adj ?? j?.score, "—")}`;
          }
  
          const chips = node.querySelector(".js-chips");
          if (chips){
            chips.innerHTML = "";
            const st = pickStatusChip(j);
            chips.appendChild(makeChip(`${st.icon} ${st.text}`));
            chips.appendChild(makeChip(`● ${pickPerfilLabel(j?.perfil_laterais)}`));
            chips.appendChild(makeChip(ritmo.text, ritmo.cls));
            chips.appendChild(makeChip(alerta.text, alerta.cls));
            if (isFav) chips.appendChild(makeChip("★ FAVORITO"));
          }
  
          const fill = node.querySelector(".miniBarFill");
          if (fill) fill.style.width = `${getBarPercent(j)}%`;
  
          const note = node.querySelector(".js-note");
          if (note) note.textContent = buildSmartNote(j);
  
          return node;
        }
  
        // ---------------- DEDUPE ----------------
        function dedupeList(list){
          const out = [];
          const seenStable = new Set();
          const seenTeams = new Set();
  
          for (const j of (list || [])){
            const k1 = stableKey(j);
            const k2 = teamsKey(j);
            if (seenStable.has(k1)) continue;
            if (seenTeams.has(k2)) continue;
            seenStable.add(k1);
            seenTeams.add(k2);
            out.push(j);
          }
          return out;
        }
  
        // ---------------- Top logic ----------------
        function splitTopAndRest(list, dateYMD){
          const targetCount = getTopTargetCount(dateYMD);
          const isWeekday = isWeekdayDateYMD(dateYMD);
          const minGap = isWeekday ? WEEKDAY_MIN_TIME_GAP_MINUTES : 0;
  
          const raw = dedupeList(Array.isArray(list) ? list.slice() : []);
          const arr = filterTop5CornerQuality(filterServerCompatibleGames(raw));
  
          // 🔒 NUNCA envia card vermelho para o Top do Dia.
          // Se não houver jogos seguros suficientes, mostra menos cards em vez de completar com RED.
          const safeForTop = arr.filter(j => getAlertInfo(j).level !== "red");
  
          const pool = sortByTop1AI(safeForTop);
  
          const fullStrong = pool.filter(isPregameStrongFull);
          const semiStrong = pool.filter(isPregameStrongSemi);
          const top = [];
          const used = new Set();
  
          if (getCornerOrderMode() === "strength") {
            // FORCA DE CANTOS: seleciona os melhores do dia sem qualquer trava de horario.
            fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: fullStrong, targetCount });
            fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: semiStrong, targetCount });
          } else {
            // HORARIO: preserva a antiga distribuicao temporal.
            addDistinctTimeCandidates({ selected: top, used, candidates: fullStrong, targetCount, dateYMD, minGapMinutes: minGap });
            addDistinctTimeCandidates({ selected: top, used, candidates: semiStrong, targetCount, dateYMD, minGapMinutes: minGap });
  
            if (top.length < targetCount){
              fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: fullStrong, targetCount });
              fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: semiStrong, targetCount });
            }
          }
  
          // O primeiro card é sempre o melhor jogo segundo o filtro IA.
          // Os demais continuam organizados por horário para manter a leitura do painel.
          const orderedTop = placeBestAiGameFirst(top, dateYMD);
          const topKeys = new Set(orderedTop.map(stableKey));
          let rest = pool.filter(j => !topKeys.has(stableKey(j)));
          if (HIDE_NON_FULL_FROM_OTHERS) rest = rest.filter(hasFullBase);
  
          return {
            main: orderedTop.slice(0, targetCount),
            support: orderedTop.slice(targetCount),
            top: orderedTop,
            rest
          };
        }
  
        // ---------------- FIX: data AMAZONAS ----------------
        function todayAM_YMD(){
          const now = new Date();
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Manaus",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).format(now);
        }
  
        function ensureDateVisible(){
          if (!dateInput) return;
          dateInput.style.minWidth = "140px";
          dateInput.style.width = "140px";
          if (!dateInput.value) dateInput.value = todayAM_YMD();
        }
  
        // ---------------- IA LEFTBOX ----------------
        let lastTopGames = [];
  
        function setIaLoading(msg = "Analisando…"){
          if (!iaBox) return;
          if (iaStatus) iaStatus.textContent = msg;
          if (iaWhy && iaWhy.textContent.trim() === "") iaWhy.textContent = "Aguardando análise da IA…";
        }
  
        function confidenceFrom(j){
          const p = getProb(j);
          const full = hasFullBase(j);
          const semi = isSemi(j);
          if (full && p >= 74) return "Alta";
          if (p >= 70) return "Média";
          if (semi && p >= TOP6_MIN_PROB_SEMI) return "Média";
          return "Baixa";
        }
  
        function riskLabel(j){
          const p = getProb(j);
          if (hasFullBase(j) && p >= 74) return "🟢 OK (base completa)";
          if (hasFullBase(j) && p >= TOP6_MIN_PROB_FULL) return "🟡 Moderado (base completa)";
          if (isSemi(j) && p >= TOP6_MIN_PROB_SEMI) return "🟡 SEMI forte (confirmar ritmo 10–15')";
          return "⚠️ Cuidado (pré-jogo)";
        }
  
        function buildWhyText(best, topGames){
          const liga = safe(best?.liga, "—");
          const mode = String(best?.mode || "—").toUpperCase();
          const p = getProb(best);
          const proj = getProj(best);
          const perfil = pickPerfilLabel(best?.perfil_laterais);
          const base = hasFullBase(best) ? "H2H+Stats" : (isSemi(best) ? "SEMI (parcial)" : "parcial");
          const odds = Number(best?.odds?.fav?.odd ?? NaN);
          const oddsTxt = Number.isFinite(odds) ? `Odds: ${odds.toFixed(2)}` : "Odds indisponível";
          const others = Array.isArray(topGames) ? topGames.slice(1) : [];
          const avgProb = others.length ? (others.reduce((s, x) => s + getProb(x), 0) / others.length) : null;
          const avgProj = others.length ? (others.reduce((s, x) => s + getProj(x), 0) / others.length) : null;
          const deltaTxtParts = [];
  
          if (avgProb !== null && Number.isFinite(p - avgProb)){
            const sign = (p - avgProb) >= 0 ? "+" : "";
            deltaTxtParts.push(`Prob vs topo: ${sign}${Math.round(p - avgProb)} pts`);
          }
          if (avgProj !== null && Number.isFinite(proj - avgProj)){
            const sign = (proj - avgProj) >= 0 ? "+" : "";
            deltaTxtParts.push(`Proj vs topo: ${sign}${fmt(proj - avgProj, 1)}`);
          }
  
          const deltaTxt = deltaTxtParts.length ? ` • ${deltaTxtParts.join(" • ")}` : "";
          const cautela = isCentral(best) ? "Tendência por dentro: precisa volume/ritmo." : "Perfil favorável para cantos.";
  
          return `${liga} • ${mode} • Base: ${base}. Over 9.5: ${pct(p)} • Proj: ${fmt(proj,1)} • ${perfil}. ${oddsTxt}.${deltaTxt} ${cautela}`;
        }
  
        function updateIaBoxFromTop(topGames){
          if (!iaBox) return;
          lastTopGames = Array.isArray(topGames) ? topGames.slice() : [];
  
          if (!topGames || topGames.length === 0){
            if (iaStatus) iaStatus.textContent = "Sem jogos";
            if (iaGame) iaGame.textContent = "—";
            if (iaSug) iaSug.textContent = "—";
            if (iaConf) iaConf.textContent = "—";
            if (iaWhy) iaWhy.textContent = "Sem jogos fortes no pré-jogo hoje. Tente mudar a data.";
            if (iaRisk) iaRisk.textContent = "—";
            return;
          }
  
          const best = topGames[0];
          const casa = safe(best?.casa, "Time A");
          const fora = safe(best?.fora, "Time B");
          const conf = confidenceFrom(best);
  
          if (iaStatus) iaStatus.textContent = "Pronto";
          if (iaGame) iaGame.textContent = `${casa} x ${fora}`;
          if (iaSug) iaSug.textContent = "Over 9.5 (pré-jogo) / ou Live 10–15'";
          if (iaConf) iaConf.textContent = conf;
          if (iaWhy) iaWhy.textContent = buildWhyText(best, topGames);
          if (iaRisk) iaRisk.textContent = riskLabel(best);
        }
  
        function onIaReloadClick(){
          setIaLoading("Atualizando…");
          updateIaBoxFromTop(lastTopGames);
          if (iaStatus) iaStatus.textContent = "Pronto";
        }
      /* função duplicada removida: ensureDashboardLoadingStyles */
  
      /* função duplicada removida: showDashboardLoading */
  
  
        // ---------------- TOP Loading ----------------
        let loadingFxStartedAt = 0;
        let loadingFxToken = 0;
  
        function setTopLoading(on = true){
          if (!panelTitle) return;
  
          if (on){
            loadingFxStartedAt = Date.now();
            loadingFxToken += 1;
            panelTitle.classList.add("loading");
            panelTitle.setAttribute("data-loading", "1");
            return;
          }
  
          const currentToken = loadingFxToken;
          const elapsed = Date.now() - loadingFxStartedAt;
          const wait = Math.max(0, LOADING_MIN_MS - elapsed);
  
          window.setTimeout(() => {
            if (currentToken !== loadingFxToken) return;
            panelTitle.classList.remove("loading");
            panelTitle.removeAttribute("data-loading");
          }, wait);
        }
  
        // ---------------- Controle Forca x Horario ----------------
        function setupCornerOrderControls(){
          setCornerOrderMode(getCornerOrderMode());
  
          document.addEventListener("click", event => {
            const button = event.target.closest("[data-corner-order]");
            if (!button) return;
            event.preventDefault();
  
            const nextMode = button.dataset.cornerOrder === "time" ? "time" : "strength";
            if (nextMode === getCornerOrderMode()) return;
  
            setCornerOrderMode(nextMode);
            loadAll({ date: dateInput?.value || todayAM_YMD(), fresh: false });
          });
        }
  
        setupCornerOrderControls();
  
        // ---------------- Main Load ----------------
        async function loadAll({ date, fresh = false } = {}){
          ensureDateVisible();
          setTopLoading(true);
  
          const dateFromUrl = new URLSearchParams(window.location.search).get("date")
            || new URLSearchParams(window.location.search).get("data")
            || "";
          const requestedDate = date || dateInput?.value || dateFromUrl || todayAM_YMD();
  
          if (dateInput) dateInput.value = requestedDate;
  
          if (btn){
            btn.disabled = true;
            btn.textContent = "Atualizando...";
            btn.classList.add("is-loading");
          }
  
          showDashboardLoading(currentView === "filters" ? "Carregando mercados do dia..." : "Carregando jogos do dia...");
          if (currentView !== "filters") top1El?.closest(".panel")?.classList.remove("is-market-scroll-panel");
          if (countTop) countTop.textContent = "0";
  
          try{
            setIaLoading("Analisando…");
            const dateYMD = requestedDate;
            const list = enrichMarketsList(filterTop5CornerQuality(filterServerCompatibleGames(await fetchGamesFromApi(["/quentes", "/mercados"], dateYMD, fresh))));
            lastRawGames = list.slice();
            lastDateYMD = dateYMD;
  
            if (currentView === "filters"){
              await loadMarketGames({ date: dateYMD, fresh });
              renderMarketFilters();
              return;
            }
  
            const targetCount = getTopTargetCount(dateYMD);
            const split = splitTopAndRest(list, dateYMD);
            const { main, support, top, rest } = split;
  
            let sideGames = [];
            let sideMessage = "";
  
            try{
              const sideResp = await fetchSideGames(dateYMD, fresh);
              sideGames = Array.isArray(sideResp?.games)
                ? enrichMarketsList(filterTop5CornerQuality(filterServerCompatibleGames(dedupeList(sideResp.games)))).slice(0, SIDE_MAX_CARDS)
                : [];
              sideMessage = sideResp?.message || "";
            } catch (err){
              console.warn("Falha ao buscar /side.", err);
            }
  
            // ✅ Exibição final:
            // - Dia normal: 1 card
            // - Sábado/Domingo: até 3 cards
            // Primeiro tenta os TOP fortes; se faltar, completa apenas com candidatos ainda compatíveis com o servidor.
            let displayGames = dedupeList(Array.isArray(main) ? main.slice(0, targetCount) : []);
            const usedDisplay = new Set(displayGames.map(stableKey));
            const promotedCandidates = sortByTop1AI(
              filterTop5CornerQuality(
                filterServerCompatibleGames(dedupeList([...(sideGames || []), ...(support || []), ...(rest || [])]))
              )
            );
            const isWeekday = isWeekdayDateYMD(dateYMD);
            const minGap = isWeekday ? WEEKDAY_MIN_TIME_GAP_MINUTES : 0;
  
            if (getCornerOrderMode() === "strength") {
              // FORCA DE CANTOS: completa estritamente pelo ranking, independente do horario.
              fillIfNotEnoughIgnoringGap({ selected: displayGames, used: usedDisplay, candidates: promotedCandidates, targetCount });
            } else {
              // HORARIO: tenta manter partidas em faixas distintas.
              addDistinctTimeCandidates({
                selected: displayGames,
                used: usedDisplay,
                candidates: promotedCandidates,
                targetCount,
                dateYMD,
                minGapMinutes: minGap
              });
  
              if (displayGames.length < targetCount){
                fillIfNotEnoughIgnoringGap({ selected: displayGames, used: usedDisplay, candidates: promotedCandidates, targetCount });
              }
            }
  
            // Congela a selecao original do dia. Partida encerrada continua no card
            // e nunca e substituida por um jogo que apareceu somente depois.
            const lockedGames = readLockedGames(dateYMD);
            if (lockedGames.length) {
              displayGames = lockedGames.slice(0, targetCount);
            } else {
              displayGames = sortByTop1AI(displayGames).slice(0, targetCount);
              writeLockedGames(dateYMD, displayGames);
            }
  
            displayGames = orderGamesForSelectedFilter(displayGames, dateYMD);
  
            updateIaBoxFromTop(displayGames);
  
            if (top1El){
              top1El.innerHTML = "";
              top1El.classList.toggle("is-weekend-top3", targetCount === TOP_WEEKEND_COUNT);
              top1El.classList.toggle("is-weekday-top2", targetCount === TOP_WEEKDAY_COUNT);
  
              if (displayGames.length){
                displayGames.forEach((game, index) => {
                  top1El.appendChild(renderTopCard(game, index + 1));
                });
              } else {
                const div = document.createElement("div");
                div.className = "empty";
                div.textContent = sideMessage || "Sem jogo pré-jogo forte hoje. Tente ao vivo 10–15' ou troque a data.";
                top1El.appendChild(div);
              }
            }
  
            if (countTop) countTop.textContent = String(displayGames.length);
  
          } catch (e){
            console.error("Erro ao carregar jogos:", e);
            if (top1El){
              const div = document.createElement("div");
              div.className = "empty";
              div.textContent = "⚠️ Falha ao carregar jogo principal. Verifique o servidor.";
              top1El.appendChild(div);
            }
            updateIaBoxFromTop([]);
          } finally {
            if (btn){
              btn.disabled = false;
              btn.textContent = "Atualizar";
              btn.classList.remove("is-loading");
            }
            setTopLoading(false);
          }
        }
  
        // ---------------- Init ----------------
        function init(){
          if (!dateInput){
            console.error("❌ Falta #date no HTML");
            return;
          }
  
          // O layout novo não possui mais o botão legado #btn.
          // Ele agora é opcional e não pode impedir o carregamento do app.
          if (!btn){
            console.warn("ℹ️ #btn não existe no layout novo; carregamento automático mantido.");
          }
  
          // Ao atualizar ou abrir a página, sempre volta para o dia atual.
          const todayOnRefresh = todayAM_YMD();
          dateInput.value = todayOnRefresh;
  
          try{
            const url = new URL(window.location.href);
            url.searchParams.delete("date");
            url.searchParams.delete("data");
            window.history.replaceState({}, "", url.toString());
          }catch(e){}
  
          ensureDateVisible();
  
          btn.addEventListener("click", () => {
            ensureDateVisible();
            loadAll({ date: dateInput.value, fresh: false });
          });
  
          dateInput.addEventListener("change", () => {
            ensureDateVisible();
  
            // Ao trocar a data, mostra imediatamente o estado específico
            // até os novos jogos terminarem de carregar.
            if (typeof window.CornerProMobileHomeLoading === "function"){
              window.CornerProMobileHomeLoading("selected");
            }
  
            loadAll({ date: dateInput.value, fresh: false });
          });
  
          if (iaReload){
            iaReload.addEventListener("click", (ev) => {
              ev.preventDefault();
              onIaReloadClick();
            });
          }
  
          setupViewNavigation();
          setupStatsModal();
  
          // ✅ PADRÃO DO SITE: sempre abrir direto na aba FILTROS ao carregar/atualizar a página
          // Mantém o layout original e só força a visão inicial para filtros.
          currentView = "filters";
          activeMarketFilter = activeMarketFilter || "all";
          toggleFiltersHeader(true);
  
          document.querySelectorAll(".nav-link, .side-item").forEach(el => {
            el.classList.remove("active", "is-active");
          });
  
          document.querySelector('.nav-link[data-tab="filters"]')?.classList.add("active", "is-active");
          document.querySelector('.side-item[data-tab="filters"]')?.classList.add("active", "is-active");
  
          loadAll({ date: dateInput.value, fresh: false });
        }
  
        init();
  
        /* =========================================================
           COPA 2026 — WIDGET COMPACTO (SEM CALENDÁRIO DO MÊS)
           ========================================================= */
        (() => {
          const COPA_TITLE = "Copa 2026";
          const COPA_START_ISO_LOCAL = "2026-06-11T00:00:00";
          const COPA_START_LABEL = "11/06/2026";
          const pad2 = (n) => String(n).padStart(2, "0");
  
          function getCopaStart(){
            return new Date(COPA_START_ISO_LOCAL);
          }
  
          function diffParts(toDate){
            const now = new Date();
            let ms = toDate.getTime() - now.getTime();
            if (ms < 0) ms = 0;
            const sec = Math.floor(ms / 1000);
            return {
              days: Math.floor(sec / 86400),
              hours: Math.floor((sec % 86400) / 3600),
              mins: Math.floor((sec % 3600) / 60),
              secs: sec % 60,
              finished: toDate.getTime() <= now.getTime()
            };
          }
  
          function killMonthCalendar(){
            const candidates = [".copaCal", ".calendar", ".monthCalendar", "[aria-label*='Calendário']", "[data-widget='calendar']"];
            candidates.forEach((sel) => {
              document.querySelectorAll(sel).forEach((el) => {
                const hasManyButtons = el.querySelectorAll("button").length >= 20;
                const hasGrid = el.querySelectorAll("[role='grid'], .grid, .days").length > 0;
                if (hasManyButtons || hasGrid) el.remove();
              });
            });
          }
  
          function ensureCopaWidget(){
            const panelTitleLocal =
              document.querySelector(".panel .panel-title") ||
              document.querySelector(".panel-title") ||
              document.querySelector("#top1")?.closest(".panel")?.querySelector(".panel-title");
  
            if (!panelTitleLocal) return null;
            let widget = panelTitleLocal.querySelector(".copaWidget");
            if (widget) return widget;
  
            widget = document.createElement("div");
            widget.className = "copaWidget";
            widget.innerHTML = `
              <div class="copaCard" aria-label="Contagem regressiva para a Copa 2026">
                <div class="copaTop">
                  <div class="copaLeft">
                    <div class="copaTitle">🏆 ${COPA_TITLE}</div>
                    <div class="copaWhen">Início: ${COPA_START_LABEL}</div>
                  </div>
                  <div class="copaBadge" id="copaDaysBadge">-- dias</div>
                </div>
                <div class="copaGrid">
                  <div class="copaKpi"><div class="lab">Dias</div><div class="val" id="copaDays">--</div></div>
                  <div class="copaKpi"><div class="lab">Horas</div><div class="val" id="copaHours">--</div></div>
                  <div class="copaKpi"><div class="lab">Min</div><div class="val" id="copaMins">--</div></div>
                  <div class="copaKpi"><div class="lab">Seg</div><div class="val" id="copaSecs">--</div></div>
                </div>
              </div>
            `;
  
            panelTitleLocal.style.gap = panelTitleLocal.style.gap || "10px";
            panelTitleLocal.style.flexWrap = panelTitleLocal.style.flexWrap || "wrap";
            panelTitleLocal.appendChild(widget);
            return widget;
          }
  
          function startTicker(){
            const copaStart = getCopaStart();
            const widget = ensureCopaWidget();
            if (!widget) return;
  
            const elDays = widget.querySelector("#copaDays");
            const elHours = widget.querySelector("#copaHours");
            const elMins = widget.querySelector("#copaMins");
            const elSecs = widget.querySelector("#copaSecs");
            const elBadge = widget.querySelector("#copaDaysBadge");
  
            function render(){
              killMonthCalendar();
              const d = diffParts(copaStart);
  
              if (d.finished){
                elDays.textContent = "0";
                elHours.textContent = "00";
                elMins.textContent = "00";
                elSecs.textContent = "00";
                elBadge.textContent = "É HOJE";
                return;
              }
  
              elDays.textContent = String(d.days);
              elHours.textContent = pad2(d.hours);
              elMins.textContent = pad2(d.mins);
              elSecs.textContent = pad2(d.secs);
              elBadge.textContent = `${d.days} dias`;
            }
  
            render();
            setInterval(render, 1000);
          }
  
          if (document.readyState === "loading"){
            document.addEventListener("DOMContentLoaded", () => {
              killMonthCalendar();
              startTicker();
            });
          } else {
            killMonthCalendar();
            startTicker();
          }
        })();
  
        /* =========================================
           PATCH — IA ORIGINAL (símbolo refinado)
           ========================================= */
        (function(){
          const oldGetAlertInfo = getAlertInfo;
  
          getAlertInfo = function(j){
            const base = oldGetAlertInfo(j);
            if (j?.knockout_second_leg_exception === true && j?.home_urgency?.active === true){
              return { ...base, text: "▲ URGÊNCIA CASA", cls: "chip-ia-safe chip-home-urgency", level: "green" };
            }
  
            let text = "● SEGURO IA";
            let cls = "chip-ia-safe";
  
            if (base.level === "yellow"){
              text = "◔ ATENÇÃO IA";
              cls = "is-atencao chip-ia-warn";
            }
  
            if (base.level === "red"){
              text = "● RISCO IA";
              cls = "is-atencao chip-ia-danger";
            }
  
            return { ...base, text, cls };
          };
        })();
  
        // =========================================================
        // TRACK ONLINE USERS
        // =========================================================
  
        function trackOnlineUser(){
  
          fetch("/track").catch(() => {});
  
        }
  
        trackOnlineUser();
  
        setInterval(trackOnlineUser, 30000);
  
        // =========================================================
        // ADMIN DASHBOARD PREMIUM V3 — CORNERS RADAR
        // Bloco seguro: só executa quando a página tiver layout admin.
        // Pode ficar no mesmo script.js sem quebrar a tela principal.
        // =========================================================
  
        (function initCornersAdminPremium(){
  
          const isAdminPage =
            document.querySelector(".adminLayout") ||
            document.querySelector(".topbar")?.textContent?.toLowerCase()?.includes("painel administrativo") ||
            document.body?.classList?.contains("admin-page");
  
          if (!isAdminPage) return;
  
          const $ = (sel, root = document) => root.querySelector(sel);
          const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  
          function setText(selector, value){
            const el = $(selector);
            if (el) el.textContent = value;
          }
  
          function num(v, fallback = 0){
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
          }
  
          function formatBR(value){
            const n = Number(value);
            if (!Number.isFinite(n)) return String(value ?? "—");
            return n.toLocaleString("pt-BR");
          }
  
          function escapeHtml(value){
            return String(value ?? "")
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;")
              .replaceAll("'", "&#039;");
          }
  
          async function getJson(url, fallback){
            try{
              const res = await fetch(url, { cache: "no-store" });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return await res.json();
            }catch(err){
              console.warn("Admin fetch falhou:", url, err);
              return fallback;
            }
          }
  
          // =========================================================
          // TOPBAR PREMIUM + RELÓGIO
          // =========================================================
  
          const topbar = $(".topbar");
  
          if (topbar && !$(".adminTopTools")){
            const tools = document.createElement("div");
            tools.className = "adminTopTools";
            tools.innerHTML = `
              <div class="adminSearch">
                <input type="text" placeholder="Buscar..." aria-label="Buscar no painel admin">
                <span>⌕</span>
              </div>
  
              <button class="adminIconBtn" type="button" title="Notificações">
                🔔
                <em>8</em>
              </button>
  
              <button class="adminIconBtn" type="button" title="Calendário">
                🗓
              </button>
  
              <div class="adminClock">--:--:--</div>
            `;
            topbar.appendChild(tools);
          }
  
          function updateAdminClock(){
            const clock = $(".adminClock");
            if (!clock) return;
  
            const now = new Date();
  
            clock.innerHTML = `
              <small>${now.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}</small>
              <strong>${now.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              })}</strong>
            `;
          }
  
          updateAdminClock();
          setInterval(updateAdminClock, 1000);
  
          // =========================================================
          // EFEITO DOS BOTÕES
          // =========================================================
  
          document.addEventListener("click", (ev) => {
            const btn = ev.target.closest(".actionBtn, .adminIconBtn, .menuItem");
            if (!btn) return;
  
            btn.classList.add("clicked");
  
            setTimeout(() => {
              btn.classList.remove("clicked");
            }, 260);
          });
  
          // =========================================================
          // MINI SPARKLINES NOS CARDS
          // =========================================================
  
          function sparkline(values = [], className = ""){
            const clean = values.map(Number).filter(Number.isFinite);
            if (!clean.length) return "";
  
            const min = Math.min(...clean);
            const max = Math.max(...clean);
            const range = Math.max(max - min, 1);
  
            const points = clean.map((v, i) => {
              const x = (i / Math.max(clean.length - 1, 1)) * 100;
              const y = 34 - ((v - min) / range) * 28;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            }).join(" ");
  
            return `
              <svg class="adminSpark ${className}" viewBox="0 0 100 38" preserveAspectRatio="none">
                <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <polygon points="0,38 ${points} 100,38" opacity=".12" fill="currentColor"></polygon>
              </svg>
            `;
          }
  
          function installCardSparks(){
            const cards = $$(".statCard");
            const data = [
              [18,20,19,23,22,25,24,28,30,29,35,38],
              [42,45,43,49,50,52,51,57,59,62,64,68],
              [60,62,61,64,63,66,68,67,70,72,71,74],
              [98,98,99,99,100,100,99,100,100,100,100,100]
            ];
  
            cards.forEach((card, index) => {
              if ($(".adminSpark", card)) return;
              const wrap = document.createElement("div");
              wrap.className = "adminSparkWrap";
              wrap.innerHTML = sparkline(data[index] || data[0]);
              card.appendChild(wrap);
            });
          }
  
          installCardSparks();
  
          // =========================================================
          // STATS PRINCIPAIS
          // =========================================================
  
          async function loadAdminStats(){
  
            const data = await getJson("/admin/stats", {
              onlineUsers: 1,
              matchesToday: 86,
              aiAccuracy: 74,
              apiStatus: "ATIVA",
              revenueToday: 0,
              activeGames: 0
            });
  
            const usersCard = $(".green strong");
            const gamesCard = $(".blue strong");
            const iaCard = $(".orange strong");
            const apiCard = $(".red strong");
  
            if (usersCard) usersCard.textContent = formatBR(data.onlineUsers ?? data.usersOnline ?? 1);
            if (gamesCard) gamesCard.textContent = formatBR(data.matchesToday ?? data.gamesToday ?? data.activeGames ?? 86);
            if (iaCard) iaCard.textContent = `${num(data.aiAccuracy ?? data.accuracy, 74)}%`;
            if (apiCard) apiCard.textContent = String(data.apiStatus ?? data.statusApi ?? "ATIVA").toUpperCase();
  
            setText("[data-admin-stat='users']", formatBR(data.onlineUsers ?? data.usersOnline ?? 1));
            setText("[data-admin-stat='games']", formatBR(data.matchesToday ?? data.gamesToday ?? 86));
            setText("[data-admin-stat='accuracy']", `${num(data.aiAccuracy ?? data.accuracy, 74)}%`);
            setText("[data-admin-stat='api']", String(data.apiStatus ?? "ATIVA").toUpperCase());
  
            updateIaMonitor(data);
          }
  
          // =========================================================
          // USUÁRIOS ONLINE
          // =========================================================
  
          async function loadOnlineUsers(){
  
            const users = await getJson("/admin/users", [
              { device: "Linux", browser: "Chrome", location: "Manaus - BR" }
            ]);
  
            const list = $("#onlineUsersList");
            if (!list) return;
  
            if (!Array.isArray(users) || users.length === 0){
              list.innerHTML = `
                <div class="onlineUser premiumEmpty">
                  <div class="onlineUserLeft">
                    <span class="onlinePulse"></span>
                    <strong>Nenhum usuário online agora</strong>
                  </div>
                  <small>Aguardando acessos</small>
                </div>
              `;
              return;
            }
  
            list.innerHTML = users.map(user => {
              const device = escapeHtml(user.device || user.name || "Usuário");
              const browser = escapeHtml(user.browser || user.platform || "Online");
              const location = escapeHtml(user.location || user.city || "");
  
              return `
                <div class="onlineUser">
                  <div class="onlineUserLeft">
                    <span class="onlinePulse"></span>
                    <div>
                      <strong>${device}</strong>
                      ${location ? `<p>${location}</p>` : ""}
                    </div>
                  </div>
  
                  <small>${browser}</small>
                </div>
              `;
            }).join("");
          }
  
          // =========================================================
          // JOGOS DE HOJE
          // =========================================================
  
          async function loadLiveGames(){
  
            const data = await getJson("/admin/live-games", {
              games: [
                {
                  home: "Västeras SK",
                  away: "Goteborg",
                  league: "Allsvenskan",
                  time: "14:00",
                  probability: 53,
                  projectedCorners: 10
                },
                {
                  home: "Hacken",
                  away: "Hammarby",
                  league: "Allsvenskan",
                  time: "14:00",
                  probability: 58,
                  projectedCorners: 10.3
                }
              ]
            });
  
            const games = Array.isArray(data) ? data : (Array.isArray(data.games) ? data.games : []);
            const list = $("#liveGamesList");
  
            if (!list) return;
  
            if (!games.length){
              list.innerHTML = `
                <div class="liveGameEmpty">
                  Nenhum jogo encontrado hoje
                </div>
              `;
              return;
            }
  
            list.innerHTML = games.slice(0, 8).map(game => {
              const homeRaw = game.home || game.casa || "Time A";
              const awayRaw = game.away || game.fora || "Time B";
              const home = teamNameHTML(homeRaw, "liveTeamName");
              const away = teamNameHTML(awayRaw, "liveTeamName");
              const league = escapeHtml(game.league || game.liga || "Liga");
              const time = escapeHtml(displayKickoffTimeFromGame(game));
              const prob = game.probability ?? game.prob ?? game.over95_prob_adj ?? "-";
              const corners = game.projectedCorners ?? game.proj_cantos ?? game.corners ?? "-";
  
              return `
                <div class="liveGameRow">
                  <div class="liveGameInfo">
                    <strong>${home} x ${away}</strong>
                    <small>${league} • ${time}</small>
                  </div>
  
                  <div class="liveGameRight">
                    <div class="liveGameBadges">
                      <span class="liveProb">${prob}%</span>
                      <span class="liveCorners">${corners}</span>
                    </div>
                    <small>IA • cantos</small>
                  </div>
                </div>
              `;
            }).join("");
  
            renderMostAccessed(games);
          }
  
          // =========================================================
          // JOGOS MAIS ACESSADOS
          // =========================================================
  
          function renderMostAccessed(games = []){
  
            const card = $$(".panelCard").find(el =>
              el.textContent.toLowerCase().includes("jogos mais acessados")
            );
  
            if (!card) return;
  
            const title = $(".cardTitle", card);
            const sorted = games.slice(0, 5);
  
            const html = sorted.map((game, index) => {
              const homeRaw = game.home || game.casa || "Time A";
              const awayRaw = game.away || game.fora || "Time B";
              const home = teamNameHTML(homeRaw, "accessTeamName");
              const away = teamNameHTML(awayRaw, "accessTeamName");
              const league = escapeHtml(game.league || game.liga || "Liga");
              const views = game.views || game.access || `${(1.8 - index * .2).toFixed(1)}k`;
  
              return `
                <div class="matchRow premiumAccessRow">
                  <div>
                    <strong>${home} <span class="teamVsMini">x</span> ${away}</strong>
                    <small>${league}</small>
                  </div>
                  <div class="accessMeter">
                    <span style="width:${Math.max(28, 92 - index * 14)}%"></span>
                  </div>
                  <span class="matchViews">${views}</span>
                </div>
              `;
            }).join("");
  
            card.innerHTML = `${title ? title.outerHTML : `<div class="cardTitle">Jogos Mais Acessados</div>`}${html}`;
          }
  
          // =========================================================
          // MONITOR DA IA
          // =========================================================
  
          function updateIaMonitor(data = {}){
  
            const card = $$(".panelCard").find(el =>
              el.textContent.toLowerCase().includes("monitor da ia")
            );
  
            if (!card) return;
  
            const processed = data.marketsProcessed ?? data.processedMarkets ?? 1284;
            const filtered = data.filteredGames ?? data.gamesFiltered ?? 312;
            const alerts = data.alertsGenerated ?? data.alerts ?? 74;
            const accuracy = data.aiAccuracy ?? data.accuracy ?? 74;
  
            card.innerHTML = `
              <div class="cardTitle">Monitor da IA</div>
  
              <div class="aiPremiumPanel">
                <div class="aiRadar">
                  <div class="aiRadarCore"></div>
                </div>
  
                <div class="aiStatus">
                  <div class="aiLine">
                    <span>Mercados processados</span>
                    <strong>${formatBR(processed)}</strong>
                  </div>
  
                  <div class="aiLine">
                    <span>Jogos filtrados</span>
                    <strong>${formatBR(filtered)}</strong>
                  </div>
  
                  <div class="aiLine">
                    <span>Alertas gerados</span>
                    <strong>${formatBR(alerts)}</strong>
                  </div>
  
                  <div class="aiLine">
                    <span>Precisão atual</span>
                    <strong class="greenText">${accuracy}%</strong>
                  </div>
                </div>
              </div>
            `;
          }
  
          // =========================================================
          // STATUS DO SISTEMA
          // =========================================================
  
          function pulseSystemStatus(){
            $$(".serverOk").forEach((dot, i) => {
              dot.style.animationDelay = `${i * 160}ms`;
            });
          }
  
          pulseSystemStatus();
  
          // =========================================================
          // AÇÕES RÁPIDAS
          // =========================================================
  
          async function runAdminAction(action, btn){
  
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Processando...";
  
            const endpoint = {
              updateGames: "/admin/update-games",
              clearCache: "/admin/clear-cache",
              restartAi: "/admin/restart-ai",
              restartServer: "/admin/restart-server"
            }[action];
  
            if (!endpoint){
              btn.disabled = false;
              btn.textContent = oldText;
              return;
            }
  
            await getJson(endpoint, { ok: true });
  
            btn.textContent = "Concluído ✓";
  
            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = oldText;
            }, 1100);
          }
  
          $$(".actionBtn").forEach((btn) => {
            const text = btn.textContent.toLowerCase();
  
            let action = "";
            if (text.includes("atualizar")) action = "updateGames";
            if (text.includes("cache")) action = "clearCache";
            if (text.includes("ia")) action = "restartAi";
            if (text.includes("servidor")) action = "restartServer";
  
            if (!action) return;
  
            btn.addEventListener("click", () => runAdminAction(action, btn));
          });
  
          // =========================================================
          // CARDS EXTRAS OPCIONAIS
          // Se o HTML avançado tiver esses containers, o JS alimenta.
          // =========================================================
  
          function renderResourceMeters(){
  
            const el = $("#resourceMeters");
            if (!el) return;
  
            const items = [
              { label: "CPU", value: 34, detail: "2.1 GHz" },
              { label: "Memória", value: 68, detail: "10.8 / 16 GB" },
              { label: "Disco", value: 45, detail: "215 / 512 GB" },
              { label: "Rede", value: 33, detail: "1.2 Gbps" }
            ];
  
            el.innerHTML = items.map(item => `
              <div class="resourceRing" style="--value:${item.value}">
                <strong>${item.value}%</strong>
                <span>${item.label}</span>
                <small>${item.detail}</small>
              </div>
            `).join("");
          }
  
          function renderActivityFeed(){
  
            const el = $("#activityFeed");
            if (!el) return;
  
            const items = [
              ["👤", "Novo usuário registrado", "User: johndoe123", "17:59:21"],
              ["🔐", "Login realizado", "User: admin", "17:58:45"],
              ["⚽", "Jogo iniciado", "Counter Strike 2", "17:58:33"],
              ["✅", "Cache atualizado", "Render Cloud", "17:57:59"]
            ];
  
            el.innerHTML = items.map(item => `
              <div class="activityItem">
                <span>${item[0]}</span>
                <div>
                  <strong>${item[1]}</strong>
                  <small>${item[2]}</small>
                </div>
                <em>${item[3]}</em>
              </div>
            `).join("");
          }
  
          renderResourceMeters();
          renderActivityFeed();
  
          // =========================================================
          // AUTO UPDATE
          // =========================================================
  
          loadAdminStats();
          loadOnlineUsers();
          loadLiveGames();
  
          setInterval(loadAdminStats, 15000);
          setInterval(loadOnlineUsers, 10000);
          setInterval(loadLiveGames, 20000);
  
        })();
        /* =========================================================
           PREMIUM PATCH — LOGIN + MERCADOS + DETALHE DO JOGO
           ========================================================= */
        (function(){
          const $safe = (v, fb="—") => (v === undefined || v === null || v === "" ? fb : String(v));
          const $num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
          const $clamp = (n,min,max) => Math.max(min, Math.min(max, n));
          const $fmt = (n,d=1) => Number.isFinite(Number(n)) ? Number(n).toFixed(d).replace(".0","") : "—";
          const AUTH_KEY = "cornersPremiumLogged";
          const LAST_MARKET_KEY = "cornersPremiumLastMarket";
  
          const PREMIUM_MARKETS = [
            { key:"overview", label:"Visão Geral", icon:"⚽", short:"Geral" },
            { key:"over15", label:"+1.5 Gols", icon:"⚽", short:"+1.5" },
            { key:"over25", label:"+2.5 Gols", icon:"⚽", short:"+2.5" },
            { key:"over35", label:"+3.5 Gols", icon:"⚽", short:"+3.5" },
            { key:"corners95", label:"Escanteios +9.5", icon:"⚑", short:"+9.5" },
            { key:"corners105", label:"Escanteios +10.5", icon:"⚑", short:"+10.5" },
            { key:"corners115", label:"Escanteios +11.5", icon:"⚑", short:"+11.5" },
            { key:"cards25", label:"+2.5 Cartões", icon:"🟨", short:"+2.5" },
            { key:"cards35", label:"+3.5 Cartões", icon:"🟨🟥", short:"+3.5" },
            { key:"cardsTeam", label:"Cartões por time", icon:"👥", short:"Time" },
            { key:"noCard28", label:"Não levam cartão até 28'", icon:"🛡️", short:"28'", novo:true },
            { key:"btts", label:"Ambas Marcam", icon:"👥", short:"Ambas" },
            { key:"last5", label:"Últimos 5 Jogos", icon:"📊", short:"Últimos" }
          ];
  
          function isLogged(){ return localStorage.getItem(AUTH_KEY) === "1"; }
          function getActiveMarket(){ return localStorage.getItem(LAST_MARKET_KEY) || activeMarketFilter || "all"; }
          function setActiveMarket(key){ localStorage.setItem(LAST_MARKET_KEY, key); activeMarketFilter = key; }
  
          function ensureLoginUI(){
            if (!document.getElementById("premiumLoginOverlay")){
              document.body.insertAdjacentHTML("beforeend", `
                <div id="premiumLoginOverlay" class="premiumLoginOverlay">
                  <button class="premiumCloseLogin" type="button" id="premiumCloseLogin">×</button>
                  <div class="premiumLoginCard">
                    <div class="premiumLoginIcon">↗</div>
                    <h2>Corners Premium</h2>
                    <p>Faça login para desbloquear análises, estatísticas e mercados avançados.</p>
                    <div class="premiumField"><label>E-mail</label><input id="premiumEmail" type="email" placeholder="seu@email.com" /></div>
                    <div class="premiumField"><label>Senha</label><input id="premiumPassword" type="password" placeholder="Sua senha" /></div>
                    <button id="premiumSubmitLogin" class="premiumLoginSubmit" type="button">ENTRAR</button>
                    <p style="font-size:12px;margin-bottom:0">Modo demo: preencha qualquer e-mail e senha.</p>
                  </div>
                </div>
              `);
              document.getElementById("premiumCloseLogin")?.addEventListener("click", closeLogin);
              document.getElementById("premiumLoginOverlay")?.addEventListener("click", ev => { if (ev.target.id === "premiumLoginOverlay") closeLogin(); });
              document.getElementById("premiumSubmitLogin")?.addEventListener("click", doLogin);
            }
  
            if (!document.getElementById("premiumAuthBar")){
              const topRight = document.querySelector(".top-right");
              if (topRight){
                topRight.insertAdjacentHTML("beforeend", `<div id="premiumAuthBar" class="premiumAuthBar"></div>`);
              }
            }
            renderAuthBar();
          }
  
          function renderAuthBar(){
            const bar = document.getElementById("premiumAuthBar");
            if (!bar) return;
            if (isLogged()){
              bar.innerHTML = `<div class="premiumUserPill">🔓 Premium ativo</div><button class="premiumLogoutBtn" type="button" id="premiumLogoutBtn">Sair</button>`;
              document.getElementById("premiumLogoutBtn")?.addEventListener("click", () => {
                localStorage.removeItem(AUTH_KEY);
                renderAuthBar();
                if (currentView === "filters") renderMarketFilters();
              });
            } else {
              bar.innerHTML = `<button class="premiumLoginBtn" type="button" id="premiumTopLogin">🔒 Login</button>`;
              document.getElementById("premiumTopLogin")?.addEventListener("click", openLogin);
            }
          }
  
          function openLogin(){ ensureLoginUI(); document.getElementById("premiumLoginOverlay")?.classList.add("active"); }
          function closeLogin(){ document.getElementById("premiumLoginOverlay")?.classList.remove("active"); }
          async function doLogin(){
            const email = document.getElementById("premiumEmail")?.value || "demo@corners.com";
            const password = document.getElementById("premiumPassword")?.value || "123456";
            try{ await fetch("/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,password}) }); }catch(e){}
            localStorage.setItem(AUTH_KEY,"1");
            closeLogin();
            renderAuthBar();
            if (currentView === "filters") renderMarketFilters();
          }
  
          function baseMarkets(j){
            const m = j?.markets || {};
            const prob = m.prob || {};
            const p = key => Math.round(Number(prob[key] ?? marketPercent?.(j,key) ?? 0) || 0);
            const proj = Number(typeof getProj === "function" ? getProj(j) : j?.proj_cantos) || 10;
            const cornerProb = Number(typeof getProb === "function" ? getProb(j) : j?.over95_prob_adj) || 64;
            const seed = Math.abs(String(`${j?.casa||""}${j?.fora||""}${j?.hora||""}`).split("").reduce((a,c)=>a+c.charCodeAt(0),0));
            const cardBase = $clamp(Math.round(52 + (proj - 9.6) * 5 + (cornerProb - 62) * .18 + (seed % 9)), 42, 84);
            return {
              btts:{prob:p("btts") || 54, pass:!!m.btts},
              over15:{prob:p("over15") || 68, pass:!!m.over15},
              over25:{prob:p("over25") || 58, pass:!!m.over25},
              over35:{prob:p("over35") || 42, pass:!!m.over35},
              corners95:{prob:Math.round(Number(m?.filterProb?.corners95 ?? cornerProb)), pass:!!m.corners95 || cornerProb>=60},
              corners105:{prob:Math.round(Number(m?.filterProb?.corners105 ?? cornerProb-8)), pass:!!m.corners105 || cornerProb>=68},
              corners115:{prob:Math.round(Number(m?.filterProb?.corners115 ?? cornerProb-18)), pass:!!m.corners115 || cornerProb>=76},
              cards25:{prob:cardBase, pass:cardBase>=52},
              cards35:{prob:$clamp(cardBase-14,25,72), pass:cardBase>=63},
              cardsTeam:{prob:$clamp(cardBase-4,35,78), pass:cardBase>=56},
              noCard28:{prob:$clamp(74-cardBase+35,38,76), pass:(74-cardBase+35)>=55},
              last5:{prob:Math.round(cornerProb), pass:true},
              overview:{prob:Math.max(p("over15")||0, Math.round(cornerProb), cardBase), pass:true}
            };
          }
  
          function marketObj(j,key){ return baseMarkets(j)[key] || baseMarkets(j).overview; }
          function premiumMarketPass(j,key){ if (!key || key === "all") return true; return !!marketObj(j,key).pass; }
          function premiumMarketPercent(j,key){ if (!key || key === "all") return Math.max(...Object.values(baseMarkets(j)).map(x=>x.prob||0)); return marketObj(j,key).prob || 0; }
          function marketLabel(key){ return (PREMIUM_MARKETS.find(x=>x.key===key) || {label:"Todos"}).label; }
          function marketIcon(key){ return (PREMIUM_MARKETS.find(x=>x.key===key) || {icon:"⌯"}).icon; }
  
          function gameHome(j){ return $safe(j?.casa || j?.home || j?.home_team, "Time A"); }
          function gameAway(j){ return $safe(j?.fora || j?.away || j?.away_team, "Time B"); }
          function gameLeague(j){ return $safe(j?.liga || j?.league_name || j?.league?.name, "Liga"); }
          function gameTime(j){ const d = lastMarketDateYMD || lastDateYMD || dateInput?.value || ""; try{return timeOnlyAM(d, $safe(j?.hora || j?.time, "—"));}catch(e){return $safe(j?.hora || j?.time, "—");} }
          function gameDateLabel(){ const d = lastMarketDateYMD || lastDateYMD || dateInput?.value || ""; if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}/${m}`; }
  
          function renderMarketHero(){
            return ``;
          }
  
  
          function installPremiumSortSelectStyles(){
            return;
            if (document.getElementById("premiumSortSelectStyles")) return;
  
            const style = document.createElement("style");
            style.id = "premiumSortSelectStyles";
            style.textContent = `
              .premiumSortSelectWrap{
                display:flex;
                align-items:center;
                gap:8px;
                color:#8fa3b8;
                font-size:12px;
                font-weight:800;
                white-space:nowrap;
              }
  
              .premiumSortSelect{
                min-width:185px;
                height:34px;
                border:1px solid rgba(34,197,94,.38);
                border-radius:10px;
                background:rgba(15,23,42,.94);
                color:#eaf3ff;
                font-weight:900;
                font-size:12px;
                padding:0 34px 0 12px;
                outline:none;
                cursor:pointer;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
              }
  
              .premiumSortSelect:hover,
              .premiumSortSelect:focus{
                border-color:rgba(34,230,109,.78);
                box-shadow:0 0 0 3px rgba(34,197,94,.10);
              }
  
              @media(max-width:900px){
                .premiumGamesTop{align-items:flex-start;gap:10px;}
                .premiumSortSelectWrap{width:100%;justify-content:space-between;}
                .premiumSortSelect{min-width:170px;max-width:62vw;}
              }
            `;
            document.head.appendChild(style);
          }
  
          const oldRenderMarketFilters = window.renderMarketFilters || renderMarketFilters;
          window.renderMarketFilters = renderMarketFilters = function(){
            ensureLoginUI();
            installPremiumSortSelectStyles();
            localStorage.setItem(AUTH_KEY,"1");
            renderAuthBar();
            if (!top1El) return;
  
            const selected = getActiveMarket() === "overview" ? "cards25" : getActiveMarket();
            const list = Array.isArray(lastMarketGames) && lastMarketGames.length ? lastMarketGames : lastRawGames;
            const games = (typeof dedupeList === "function" ? dedupeList(list) : list)
              .map(x => (typeof enrichMarketsList === "function" ? enrichMarketsList([x])[0] : x));
  
            let filtered = games.filter(j => premiumMarketPass(j, selected));
  
            filtered = filtered.sort((a,b)=>{
              const da = lastMarketDateYMD || lastDateYMD || dateInput?.value || "";
  
              // Seletor de ordenação da lista dos jogos
              if (filterSortMode === "time"){
                try{
                  const ma = typeof getMatchMinutesAM === "function" ? getMatchMinutesAM(a, da) : null;
                  const mb = typeof getMatchMinutesAM === "function" ? getMatchMinutesAM(b, da) : null;
                  if (ma !== null && mb !== null && ma !== mb) return ma - mb;
                  if (ma !== null && mb === null) return -1;
                  if (ma === null && mb !== null) return 1;
                }catch(e){}
  
                return premiumMarketPercent(b, selected) - premiumMarketPercent(a, selected);
              }
  
              if (filterSortMode === "corners"){
                const ca = Number(typeof getProj === "function" ? getProj(a) : a?.proj_cantos) || 0;
                const cb = Number(typeof getProj === "function" ? getProj(b) : b?.proj_cantos) || 0;
                if (cb !== ca) return cb - ca;
                return premiumMarketPercent(b, selected) - premiumMarketPercent(a, selected);
              }
  
              // Padrão: maior força do filtro
              const pa = premiumMarketPercent(a, selected);
              const pb = premiumMarketPercent(b, selected);
              if (pb !== pa) return pb - pa;
  
              try{
                const ma = typeof getMatchMinutesAM === "function" ? getMatchMinutesAM(a, da) : null;
                const mb = typeof getMatchMinutesAM === "function" ? getMatchMinutesAM(b, da) : null;
                if (ma !== null && mb !== null) return ma - mb;
              }catch(e){}
              return 0;
            }).slice(0, 50);
  
            const rows = filtered.map((j,idx)=>{
              const pct = premiumMarketPercent(j, selected);
              const pctRounded = Math.round(pct || 0);
              const m = baseMarkets(j);
              const proj = Number(typeof getProj === "function" ? getProj(j) : j?.proj_cantos);
              const mercado = marketLabel(selected);
              const icon = marketIcon(selected);
              const matchId = String(j?.match_id || j?.id || j?.event_key || "");
  
              const rowKey = matchId || `${gameHome(j)}|${gameAway(j)}|${gameLeague(j)}|${gameTime(j)}`;
              const isMcSelected = window.__selectedMatchCenterKey && window.__selectedMatchCenterKey === rowKey;
  
              return `<div class="premiumGameRow cleanDashRow ${isMcSelected ? "match-center-selected" : ""}" data-premium-game="${idx}" data-match-center-row="1" data-match-key="${escapeAttrLite(rowKey)}" data-match-id="${matchId}">
                <div class="premiumGameTime">${gameTime(j)}<span>${gameDateLabel()}</span></div>
  
                <div class="premiumGameTeams cleanTeams">
                  ${typeof teamNameHTML === "function" ? teamNameHTML(gameHome(j)) : gameHome(j)}<br>
                  ${typeof teamNameHTML === "function" ? teamNameHTML(gameAway(j)) : gameAway(j)}
                  <small>${gameLeague(j)}</small>
                </div>
  
                <div class="cleanLeagueBox">
                  <span>${gameLeague(j)}</span>
                  <small>Mercado: ${mercado}</small>
                </div>
  
                <div class="cleanMetricsBox">
                  <div class="cleanDonut" style="--p:${Math.max(0, Math.min(100, pctRounded))}"><b>${pctRounded}%</b></div>
                  <div><strong>Força do filtro</strong><span>${mercado}</span></div>
                </div>
  
                <div class="cleanStatsBox">
                  <strong>Médias reais</strong>
                  <div><span>Proj. cantos</span><b>${Number.isFinite(proj) ? $fmt(proj,1) : "—"}</b></div>
                  <div><span>+2.5 cartões</span><b>${Math.round(m.cards25?.prob || 0)}%</b></div>
                  <div><span>+3.5 cartões</span><b>${Math.round(m.cards35?.prob || 0)}%</b></div>
                </div>
  
                <div class="cleanTrendBox">
                  <strong>Tendência</strong>
                  <div class="cleanBars"><i></i><i></i><i></i><i></i><i></i></div>
                  <span>IA + dados reais</span>
                </div>
  
                <div class="premiumUnlockedBox cleanActionBox">
                  <div><strong>${icon} ${mercado}</strong><span class="premiumPercent">${pctRounded}%</span></div>
                  <div class="premiumActionBtns">
                    <button class="matchCenterBtn ${isMcSelected ? "is-open" : ""}" type="button" data-open-match-center="${idx}" data-match-id="${matchId}" data-home="${escapeAttrLite(gameHome(j))}" data-away="${escapeAttrLite(gameAway(j))}" data-league="${escapeAttrLite(gameLeague(j))}" data-time="${escapeAttrLite(gameTime(j))}">${isMcSelected ? `<span class="matchCenterBtnIcon">✓</span> Aberto` : `<span class="matchCenterBtnIcon">▥</span> Match Center`}</button>
                  </div>
                </div>
              </div>`;
            }).join("");
  
            top1El.innerHTML = `<div class="premiumMarketShell cleanDashShell">
              <section class="premiumFilterBand cleanFilterBand">
                <div class="premiumFilterHeader"><strong>◆ Filtros</strong><span>Escolha o mercado primeiro. Depois o site mostra os jogos daquele mercado.</span></div>
                <div class="premiumMarketChips cleanMarketChips">
                  <button class="premiumMarketChip ${selected==="all"?"is-active":""}" data-premium-market="all">Todos</button>
                  ${PREMIUM_MARKETS.filter(m=>m.key!=="overview").map(m=>`<button class="premiumMarketChip ${selected===m.key?"is-active":""}" data-premium-market="${m.key}">${m.icon} ${m.label}${m.novo?` <span class="tagNovo">NOVO</span>`:""}</button>`).join("")}
                </div>
              </section>
  
              ${renderMarketHero()}
  
              <section class="premiumGamesPanel cleanGamesPanel">
                <div class="premiumGamesTop">
                  <h3>⚽ Próximos Jogos (${filtered.length})</h3>
  
                  <label class="premiumSortMini premiumSortSelectWrap">
                    <span>Ordenar por:</span>
                    <select id="premiumSortSelect" class="premiumSortSelect" aria-label="Ordenar jogos">
                      <option value="market" ${filterSortMode === "market" ? "selected" : ""}>Maior força do filtro</option>
                      <option value="time" ${filterSortMode === "time" ? "selected" : ""}>Horário dos jogos</option>
                      <option value="corners" ${filterSortMode === "corners" ? "selected" : ""}>Mais escanteios</option>
                    </select>
                  </label>
                </div>
                <div class="premiumGameRows">${rows || `<div class="marketEmpty">Nenhum jogo encontrado para esse mercado nesta data.</div>`}</div>
              </section>
  
              <div class="cleanFooterNote"></div>
            </div>`;
  
            window.__premiumFilteredGames = filtered;
            window.__lastRenderedTopGames = filtered;
            try{ if (window.__selectedMatchCenterGame) window.updateDesktopMatchRail && window.updateDesktopMatchRail(window.__selectedMatchCenterGame, filtered); }catch(e){}
            if (countTop) countTop.textContent = String(filtered.length);
            bindPremiumEvents();
            if (typeof updateIaBoxFromTop === "function") updateIaBoxFromTop([]);
          };
  
          function bindPremiumEvents(){
            const sortSelect = top1El?.querySelector("#premiumSortSelect");
            if (sortSelect){
              sortSelect.addEventListener("change", () => {
                filterSortMode = sortSelect.value || "market";
                renderMarketFilters();
              });
            }
  
            top1El?.querySelectorAll("[data-premium-market]").forEach(btn=>btn.addEventListener("click",()=>{ setActiveMarket(btn.dataset.premiumMarket || "all"); renderMarketFilters(); }));
            top1El?.querySelectorAll("[data-open-login]").forEach(btn=>btn.addEventListener("click",ev=>{ ev.stopPropagation(); openLogin(); }));
            top1El?.querySelectorAll("[data-open-detail]").forEach(btn=>btn.addEventListener("click",ev=>{ ev.preventDefault(); ev.stopPropagation(); if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation(); const i=Number(btn.dataset.openDetail); openPremiumDetail(window.__premiumFilteredGames?.[i], getActiveMarket()); }));
            top1El?.querySelectorAll("[data-premium-game]").forEach(row=>row.addEventListener("click",(ev)=>{ if (ev.target.closest("button,a,select,[data-open-detail],[data-open-match-center],[data-open-match-center-table]")) return; const i=Number(row.dataset.premiumGame); if (isLogged()) openPremiumDetail(window.__premiumFilteredGames?.[i], getActiveMarket()); else openLogin(); }));
          }
  
  
          function last5Num(v, d=1){
            const n = Number(v);
            if (!Number.isFinite(n)) return "—";
            return n.toFixed(d).replace(".0", "");
          }
  
          function last5DateLabel(value){
            const s = String(value || "");
            if (/^\d{4}-\d{2}-\d{2}/.test(s)){
              const [y,m,d] = s.slice(0,10).split("-");
              return `${d}/${m}`;
            }
            return "—";
          }
  
          function last5MatchName(m){
            const home = $safe(m?.home, "Mandante");
            const away = $safe(m?.away, "Visitante");
            const sh = m?.score?.home ?? null;
            const sa = m?.score?.away ?? null;
            const score = (sh !== null && sh !== undefined && sa !== null && sa !== undefined) ? ` ${sh} x ${sa} ` : " x ";
            return `${home}${score}${away}`;
          }
  
          function last5SideData(j){
            const data = j?.last5 || {};
            const home = Array.isArray(data.home) ? data.home : [];
            const away = Array.isArray(data.away) ? data.away : [];
            const sum = data.summary || {};
            const homeAvg = Number(sum.homeAvgFor ?? avgFromLast5(home, "cornersFor"));
            const awayAvg = Number(sum.awayAvgFor ?? avgFromLast5(away, "cornersFor"));
            const homeOver95 = Number.isFinite(Number(sum.over95Home)) ? Number(sum.over95Home) : home.filter(x => x?.over95).length;
            const awayOver95 = Number.isFinite(Number(sum.over95Away)) ? Number(sum.over95Away) : away.filter(x => x?.over95).length;
            const homeOver105 = Number.isFinite(Number(sum.over105Home)) ? Number(sum.over105Home) : home.filter(x => x?.over105).length;
            const awayOver105 = Number.isFinite(Number(sum.over105Away)) ? Number(sum.over105Away) : away.filter(x => x?.over105).length;
            const combined = Number(sum.combinedAvg ?? ((homeAvg + awayAvg) / 2));
            return { home, away, homeAvg, awayAvg, homeOver95, awayOver95, homeOver105, awayOver105, combined };
          }
  
          function avgFromLast5(list, key){
            const nums = (Array.isArray(list) ? list : []).map(x => Number(x?.[key])).filter(Number.isFinite);
            if (!nums.length) return null;
            return nums.reduce((a,b)=>a+b,0) / nums.length;
          }
  
          function renderLast5Rows(list){
            if (!Array.isArray(list) || !list.length){
              return `<tr><td colspan="5" class="last5Empty">Sem dados completos disponíveis.</td></tr>`;
            }
            return list.slice(0,5).map(m => `
              <tr>
                <td>${last5DateLabel(m?.date)}</td>
                <td>${escapeHtmlLite(last5MatchName(m))}</td>
                <td>${last5Num(m?.cornersFor,0)}</td>
                <td>${last5Num(m?.cornersAgainst,0)}</td>
                <td><span class="last5Badge ${m?.over95 ? "ok" : "bad"}">${m?.over95 ? "Over" : "Under"}</span></td>
              </tr>
            `).join("");
          }
  
          function renderLast5PremiumDetail(j){
            const home = gameHome(j), away = gameAway(j);
            const data = last5SideData(j);
            const conf = Math.round(Number(typeof getProb === "function" ? getProb(j) : j?.over95_prob_adj) || 0);
            const homeCount = data.home.length || 5;
            const awayCount = data.away.length || 5;
            const over95Txt = `${data.homeOver95}/${homeCount} + ${data.awayOver95}/${awayCount}`;
            const over105Txt = `${data.homeOver105}/${homeCount} + ${data.awayOver105}/${awayCount}`;
  
            return `
              <div class="last5PremiumBox">
                <div class="last5Head">
                  <div>
                    <h2>📊 ÚLTIMOS 5 JOGOS — BASE UTILIZADA PELA IA</h2>
                    <p>Análise dos últimos jogos oficiais de cada equipe com foco em escanteios.</p>
                  </div>
                  <div class="last5Confidence"><span>Confiança IA</span><strong>${conf || "—"}%</strong></div>
                </div>
  
                <div class="last5Grid">
                  <section class="last5TeamCard">
                    <h3>${teamNameHTML(home)} <small>(MANDANTE)</small></h3>
                    <table class="last5Table">
                      <thead><tr><th>Data</th><th>Jogo</th><th>Gerados</th><th>Sofridos</th><th>+9.5</th></tr></thead>
                      <tbody>${renderLast5Rows(data.home)}</tbody>
                    </table>
                    <div class="last5Average">Média de cantos gerados <b>${last5Num(data.homeAvg,1)}</b></div>
                  </section>
  
                  <aside class="last5CompareCard">
                    <h3>Comparativo IA</h3>
                    <div class="last5CompareLine"><span>Média ${escapeHtmlLite(home)}</span><b>${last5Num(data.homeAvg,1)}</b></div>
                    <div class="last5CompareLine"><span>Média ${escapeHtmlLite(away)}</span><b>${last5Num(data.awayAvg,1)}</b></div>
                    <div class="last5CompareBig"><span>Média combinada</span><strong>${last5Num(data.combined,1)}</strong></div>
                    <div class="last5CompareLine"><span>Over 9.5</span><b>${over95Txt}</b></div>
                    <div class="last5CompareLine"><span>Over 10.5</span><b>${over105Txt}</b></div>
                    <div class="last5Strength">${conf >= 75 ? "MUITO FORTE" : conf >= 65 ? "FORTE" : "ATENÇÃO"}</div>
                  </aside>
  
                  <section class="last5TeamCard">
                    <h3>${teamNameHTML(away)} <small>(VISITANTE)</small></h3>
                    <table class="last5Table">
                      <thead><tr><th>Data</th><th>Jogo</th><th>Gerados</th><th>Sofridos</th><th>+9.5</th></tr></thead>
                      <tbody>${renderLast5Rows(data.away)}</tbody>
                    </table>
                    <div class="last5Average">Média de cantos gerados <b>${last5Num(data.awayAvg,1)}</b></div>
                  </section>
                </div>
  
                <div class="last5IaSummary">
                  <b>Resumo da análise IA</b>
                  <p>A leitura considera a produção recente de escanteios dos dois times, cantos cedidos, estabilidade do mercado e força do filtro. Esses dados ajudam a confirmar se a projeção está sustentada por forma recente.</p>
                </div>
              </div>`;
          }
  
          function ensureLast5PremiumStyles(){
            if (document.getElementById("last5PremiumStyles")) return;
            const style = document.createElement("style");
            style.id = "last5PremiumStyles";
            style.textContent = `
              .last5PremiumBox{padding:4px 0 0;color:#eaf3ff;}
              .last5Head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;}
              .last5Head h2{margin:0;font-size:20px;font-weight:950;letter-spacing:.2px;}
              .last5Head p{margin:6px 0 0;color:#9fb1c7;font-size:13px;}
              .last5Confidence{min-width:150px;border:1px solid rgba(34,197,94,.35);background:rgba(6,78,59,.22);border-radius:16px;padding:12px;text-align:center;}
              .last5Confidence span{display:block;color:#9fb1c7;font-size:12px;font-weight:800;text-transform:uppercase;}
              .last5Confidence strong{display:block;color:#22e66d;font-size:28px;font-weight:950;line-height:1.1;}
              .last5Grid{display:grid;grid-template-columns:1fr 270px 1fr;gap:14px;align-items:stretch;}
              .last5TeamCard,.last5CompareCard,.last5IaSummary{border:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,rgba(15,23,42,.86),rgba(2,6,23,.88));border-radius:16px;padding:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);}
              .last5TeamCard h3,.last5CompareCard h3{margin:0 0 12px;font-size:16px;font-weight:950;color:#22e66d;}
              .last5TeamCard small{font-size:12px;color:#dbeafe;font-weight:800;}
              .last5Table{width:100%;border-collapse:collapse;font-size:12px;}
              .last5Table th{color:#b8c7dc;font-size:11px;text-transform:uppercase;text-align:left;padding:8px 6px;border-bottom:1px solid rgba(148,163,184,.18);}
              .last5Table td{padding:9px 6px;border-bottom:1px solid rgba(148,163,184,.10);vertical-align:middle;}
              .last5Table td:nth-child(3),.last5Table td:nth-child(4){font-weight:950;color:#22e66d;text-align:center;font-size:15px;}
              .last5Badge{display:inline-flex;align-items:center;justify-content:center;min-width:54px;border-radius:8px;padding:4px 6px;font-size:11px;font-weight:950;}
              .last5Badge.ok{background:rgba(22,163,74,.18);border:1px solid rgba(34,197,94,.35);color:#22e66d;}
              .last5Badge.bad{background:rgba(148,163,184,.10);border:1px solid rgba(148,163,184,.20);color:#cbd5e1;}
              .last5Average{margin-top:14px;text-align:center;color:#cbd5e1;text-transform:uppercase;font-size:12px;font-weight:800;}
              .last5Average b{display:block;margin-top:4px;color:#22e66d;font-size:28px;font-weight:950;}
              .last5CompareCard{border-color:rgba(34,197,94,.35);background:radial-gradient(circle at top,rgba(34,197,94,.13),rgba(2,6,23,.88));text-align:center;}
              .last5CompareLine{display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(148,163,184,.14);padding:12px 0;color:#dbeafe;font-size:13px;gap:8px;}
              .last5CompareLine b{color:#22e66d;font-size:22px;font-weight:950;white-space:nowrap;}
              .last5CompareBig{border-top:1px solid rgba(148,163,184,.20);border-bottom:1px solid rgba(148,163,184,.20);padding:14px 0;margin:2px 0;color:#dbeafe;}
              .last5CompareBig span{display:block;font-size:12px;text-transform:uppercase;color:#cbd5e1;font-weight:800;}
              .last5CompareBig strong{display:block;color:#22e66d;font-size:34px;font-weight:950;}
              .last5Strength{margin-top:10px;color:#22e66d;font-size:24px;font-weight:950;letter-spacing:.5px;}
              .last5IaSummary{margin-top:14px;border-color:rgba(34,197,94,.30);}
              .last5IaSummary b{display:block;margin-bottom:8px;font-size:16px;}
              .last5IaSummary p{margin:0;color:#dbeafe;line-height:1.45;font-size:14px;}
              .last5Empty{text-align:center;color:#94a3b8;padding:18px!important;}
              @media(max-width:1100px){.last5Grid{grid-template-columns:1fr;}.last5CompareCard{order:3}.last5Head{flex-direction:column;align-items:stretch}.last5Confidence{min-width:0}}
            `;
            document.head.appendChild(style);
          }
  
          function analysisText(key){
            if (key === "cards25") return "Jogo com tendência para 3 ou mais cartões";
            if (key === "cards35") return "Jogo com tendência para 4 ou mais cartões";
            if (key === "noCard28") return "Ambos os times com baixa tendência de cartão até 28 minutos";
            if (key?.startsWith("corners")) return "Jogo com tendência de escanteios no mercado escolhido";
            if (key?.startsWith("over")) return "Jogo com tendência de gols no mercado escolhido";
            if (key === "btts") return "Jogo com tendência para ambas as equipes marcarem";
            if (key === "last5") return "Base estatística dos últimos 5 jogos oficiais de cada equipe";
            return "Resumo geral dos melhores mercados do jogo";
          }
  
          function openPremiumDetail(j, marketKey="overview"){
            ensureLoginUI();
            ensureLast5PremiumStyles();
            if (!j) return;
            currentView = "filters";
            const key = marketKey === "all" ? "overview" : marketKey;
            const all = baseMarkets(j);
            const selected = marketObj(j,key);
            const locked = !isLogged();
            const home = gameHome(j), away = gameAway(j), league = gameLeague(j), time = gameTime(j);
            const cardsAvg = $clamp(((all.cards25.prob - 42) / 10) + 2.7, 2.4, 5.8);
            const homeCards = $clamp(cardsAvg * .46, 0.8, 3.4);
            const awayCards = $clamp(cardsAvg * .54, 0.8, 3.6);
  
            top1El.innerHTML = `<div class="premiumDetailWrap">
              <section class="premiumDetailHeader">
                <div class="premiumBackLine"><button class="premiumBackBtn" id="premiumBackToGames">← Voltar para jogos</button><button class="premiumFavoriteBtn">☆ Adicionar aos favoritos</button></div>
                <div class="premiumMatchTitle"><div><div class="premiumTeamName">${home}</div><div class="premiumTeamLeague">${league}</div></div><div><div class="premiumKickoff">${gameDateLabel()} • ${time}</div><div class="premiumVs">X</div></div><div><div class="premiumTeamName">${away}</div><div class="premiumTeamLeague">${league}</div></div></div>
                <div class="premiumTabs">${PREMIUM_MARKETS.map(m=>`<button class="premiumTabBtn ${m.key===key?"is-active":""}" data-detail-market="${m.key}">${m.icon} ${m.label}${m.novo?` <span class="tagNovo">NOVO</span>`:""}</button>`).join("")}</div>
              </section>
              <div class="premiumDetailGrid">
                <main class="premiumDetailPanel">
                  <div class="${locked ? "premiumBlurred" : ""}">
                    ${key === "last5" ? renderLast5PremiumDetail(j) : `
                    <div class="premiumAnalysisTitle">Análise: ${marketIcon(key)} ${marketLabel(key)}</div>
                    <div class="premiumAnalysisSub">${analysisText(key)}</div>
                    <div class="premiumMetricGrid">
                      <div class="premiumMetric"><span>Probabilidade (IA)</span><strong>${Math.round(selected.prob)}%</strong></div>
                      <div class="premiumMetric"><span>${key.includes("card")||key==="noCard28"?"Média de cartões":"Projeção"}</span><b>${key.includes("card")||key==="noCard28"?$fmt(cardsAvg,1):$fmt(typeof getProj==="function"?getProj(j):j?.proj_cantos,1)}</b></div>
                      <div class="premiumMetric"><span>Over do mercado</span><b>${selected.pass ? "8/10" : "5/10"}</b></div>
                      <div class="premiumMetric"><span>Força do filtro</span><strong>${selected.prob>=68?"FORTE":selected.prob>=56?"MÉDIA":"BAIXA"}</strong></div>
                      <div class="premiumMetric"><span>Mercado selecionado</span><b>${marketIcon(key)} ${marketLabel(key)}</b></div>
                    </div>
                    <div class="premiumStatsGrid">
                      <div class="premiumStatCard"><h4>Estatísticas importantes</h4>${[["Faltas (média)",14.1,70],["Cartões amarelos",cardsAvg,58],["Cartões vermelhos",0.2,30],["Disputas de bola",50.3,74],[`Jogos com ${marketLabel(key)}`,`${Math.round(selected.prob)}%`,selected.prob]].map(x=>`<div class="premiumBarLine"><span>${x[0]}</span><div class="premiumMiniBar"><i style="width:${x[2]}%"></i></div><b>${x[1]}</b></div>`).join("")}</div>
                      <div class="premiumStatCard"><h4>Cartões por time (média)</h4><div style="display:flex;align-items:center;justify-content:space-between;gap:16px"><div>${home}<br><b style="font-size:32px;color:#facc15">${$fmt(homeCards,1)}</b></div><div style="font-size:44px">🟨🟥</div><div>${away}<br><b style="font-size:32px;color:#facc15">${$fmt(awayCards,1)}</b></div></div><h4 style="margin-top:18px">Momentos dos cartões</h4><div class="premiumMomentGrid">${[["0' - 15'",18],["16' - 28'",22],["29' - 45'",28],["46' - 60'",20],["61' - 90'",12]].map(x=>`<div class="premiumMoment">${x[0]}<strong>${x[1]}%</strong></div>`).join("")}</div></div>
                      <div class="premiumStatCard"><h4>Resumo rápido</h4><p>✅ Jogo com boa leitura estatística.</p><p>✅ Mercado escolhido destacado no topo.</p><p>✅ Tendência baseada em médias recentes e força do filtro.</p><p>✅ Use os outros mercados ao lado para comparar.</p></div>
                    </div>`}
                  </div>
                  ${locked ? `<div class="premiumPremiumLock"><strong>🔒 Conteúdo premium bloqueado</strong><br>Faça login para ver análises avançadas, estatísticas detalhadas e histórico completo.<br><br><button class="premiumEnterBtn" data-open-login="1">Fazer login</button></div>` : ""}
                </main>
                <aside class="premiumOtherMarkets"><h3>Outros mercados</h3>${PREMIUM_MARKETS.filter(m=>m.key!=="overview").map(m=>`<div class="premiumOtherItem ${m.key===key?"is-active":""}" data-detail-market="${m.key}"><b>${m.icon} ${m.label}</b><span>${Math.round((all[m.key]||{}).prob||0)}%</span></div>`).join("")}</aside>
              </div>
            </div>`;
  
            top1El.querySelector("#premiumBackToGames")?.addEventListener("click",()=>renderMarketFilters());
            top1El.querySelectorAll("[data-detail-market]").forEach(btn=>btn.addEventListener("click",()=>openPremiumDetail(j, btn.dataset.detailMarket)));
            top1El.querySelectorAll("[data-open-login]").forEach(btn=>btn.addEventListener("click",openLogin));
            if (countTop) countTop.textContent = "1";
          }
  
          // Ao clicar em card principal do pré-jogo, abre o detalhe premium também.
          if (typeof renderTopCard === "function"){
            const oldRenderTopCard = renderTopCard;
            renderTopCard = function(j, rank=1){
              const node = oldRenderTopCard(j, rank);
              try{
                node.style.cursor = "pointer";
                node.addEventListener("click", ev => {
                  if (ev.target.closest("button,a")) return;
                  openPremiumDetail(j, "corners95");
                });
              }catch(e){}
              return node;
            };
          }
  
          document.addEventListener("DOMContentLoaded", ensureLoginUI);
          window.addEventListener("load", ensureLoginUI);
        })();
  
        /* =========================================================
           MATCH CENTER — BOTÃO NOVO + PAINEL EXPANSÍVEL
           Mantém o botão "Ver análise" do jeito que já existe.
           ========================================================= */
        (function(){
          function mcIsMissing(value){
            const s = String(value ?? "").trim().toLowerCase();
            return !s || s === "undefined" || s === "null" || s === "nan" || s === "indefinido";
          }
  
          function mcSafe(value, fallback = "—"){
            if (mcIsMissing(value)) return fallback;
            return String(value).trim();
          }
  
          function mcNum(value, fallback = null){
            if (mcIsMissing(value)) return fallback;
            const n = Number(String(value).replace("%", "").replace(",", "."));
            return Number.isFinite(n) ? n : fallback;
          }
  
          function mcPct(part, total){
            const p = mcNum(part, 0);
            const t = Math.max(mcNum(total, 0), 1);
            return Math.max(4, Math.min(100, Math.round((p / t) * 100)));
          }
  
          function mcVal(value){
            if (mcIsMissing(value)) return "—";
            const n = mcNum(value, null);
            return n === null ? "—" : String(value).replace("%", "") + (String(value).includes("%") ? "%" : "");
          }
  
          function mcStatusLabel(data){
            const raw = String(data?.status || data?.status_raw || "").toLowerCase();
            if (data?.finished || raw.includes("encerrado") || raw.includes("ft") || raw.includes("final") || raw.includes("finished")) return "ENCERRADO";
            if (data?.live || raw.includes("ao vivo")) return "AO VIVO";
            if (data?.not_started || raw.includes("pré") || raw.includes("pre")) return "PRÉ-JOGO";
            return "MATCH CENTER";
          }
  
          function mcLiveMinuteLabel(data){
            if (data?.finished) return "";
            if (!data?.live) return "";
            const min = mcNum(data?.minute, null);
            const period = mcSafe(data?.period, "");
            if (min !== null) return `${period ? period + " · " : ""}${min}'`;
            return period || "AO VIVO";
          }
  
          function mcRealPct(part, total){
            const p = mcNum(part, null);
            const t = mcNum(total, null);
            if (p === null || t === null || t <= 0) return null;
            return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
          }
  
          function mcRadarPct(label, value){
            if (value === null || value === undefined) return `<strong class="muted">—</strong><small>Aguardando dados reais</small>`;
            return `<strong class="${label || ""}">${value}%</strong><small>Baseado no live</small>`;
          }
  
          function mcBuildEvents(data){
            const events = Array.isArray(data?.events) ? data.events : [];
            if (!events.length){
              const txt = data?.finished ? "Sem eventos retornados pela API para este jogo." : "Aguardando eventos reais da API.";
              return `<div class="mcEmptyReal">${txt}</div>`;
            }
            return events.map(e => `<div class="mcEventItem"><span>${mcSafe(e?.minute,"—")}</span><b>${mcSafe(e?.label,"Evento")}</b><em>${mcSafe(e?.team,"—")}</em></div>`).join("");
          }
  
          function mcMarketText(ok){
            if (ok === true) return "bateu";
            if (ok === false) return "não bateu";
            return "aguardando";
          }
  
          function mcBuildStatsRows(data){
            const rows = [
              ["Chutes", data?.shots?.home, data?.shots?.away],
              ["Chutes a gol", data?.shots?.on_target_home, data?.shots?.on_target_away],
              ["Posse de bola", mcSafe(data?.possession?.home ?? data?.posse?.home, "—"), mcSafe(data?.possession?.away ?? data?.posse?.away, "—")],
              ["Ataques perigosos", data?.pressure?.home, data?.pressure?.away],
              ["Escanteios", data?.corners?.home, data?.corners?.away],
              ["Gols", data?.goals?.home, data?.goals?.away]
            ];
  
            return rows.map(([name, h, a]) => {
              const hn = mcNum(h, 0);
              const an = mcNum(a, 0);
              const total = hn + an;
              return `<div class="mcStatRow">
                <span class="mcStatNum">${mcVal(h)}</span>
                <span class="mcStatName">${name}</span>
                <span class="mcStatNum">${mcVal(a)}</span>
                <div class="mcBars">
                  <div class="mcMiniBar"><i style="width:${mcPct(hn,total)}%"></i></div>
                  <div class="mcMiniBar away"><i style="width:${mcPct(an,total)}%"></i></div>
                </div>
              </div>`;
            }).join("");
          }
  
  
          function mcMatchStorageKey(data, fallback = {}){
            const id = mcSafe(data?.match_id || fallback?.matchId || fallback?.match_id, "");
            if (id && id !== "—") return `cornersRadar_pressure_real_v2_${id}`;
            return `cornersRadar_pressure_real_v2_${mcSafe(data?.home || fallback?.home,"casa")}_${mcSafe(data?.away || fallback?.away,"fora")}`;
          }
  
          function mcReadSavedTimeline(key){
            try{
              const raw = localStorage.getItem(key);
              const arr = raw ? JSON.parse(raw) : [];
              return Array.isArray(arr) ? arr : [];
            }catch(e){
              return [];
            }
          }
  
          function mcSaveTimeline(key, timeline){
            if (!key || !Array.isArray(timeline) || !timeline.length) return;
            try{
              const old = mcReadSavedTimeline(key);
              const byMinute = new Map();
              [...old, ...timeline].forEach(item => {
                const minuteNum = parseInt(String(item?.minute ?? "").replace(/[^0-9]/g,""), 10);
                if (!Number.isFinite(minuteNum)) return;
                byMinute.set(minuteNum, {
                  minute: `${minuteNum}'`,
                  home: mcNum(item?.home, null),
                  away: mcNum(item?.away, null)
                });
              });
              const merged = [...byMinute.entries()]
                .sort((a,b) => a[0] - b[0])
                .map(([,v]) => v)
                .slice(-40);
              localStorage.setItem(key, JSON.stringify(merged));
            }catch(e){}
          }
  
          function mcBuildFallbackTimeline(data){
            // Dados sintéticos desativados: sem timeline real, não desenha gráfico.
            return [];
          }
  
          function mcNormalizeTimeline(data, fallback){
            const timeline = Array.isArray(data?.pressure_timeline)
              ? data.pressure_timeline.filter(item => item && (item.home !== undefined || item.away !== undefined))
              : [];
            return timeline;
          }
  
          function mcEventMarkers(data){
            const events = Array.isArray(data?.events) ? data.events : [];
            return events
              .map(e => {
                const minute = parseInt(String(e?.minute ?? "").replace(/[^0-9]/g,""), 10);
                if (!Number.isFinite(minute)) return null;
                const type = String(e?.type || e?.label || "").toLowerCase();
                let icon = "•";
                if (type.includes("goal") || type.includes("gol")) icon = "⚽";
                else if (type.includes("red") || type.includes("vermelho")) icon = "■";
                else if (type.includes("yellow") || type.includes("amarelo")) icon = "▪";
                else if (type.includes("corner") || type.includes("escanteio")) icon = "⚑";
                return { minute: Math.max(1, Math.min(90, minute)), icon, label: mcSafe(e?.label, "Evento") };
              })
              .filter(Boolean)
              .slice(0, 18);
          }
  
          function mcBuildPressureChart(data, fallback = {}){
            const home = mcSafe(data?.home || fallback.home, "Mandante");
            const away = mcSafe(data?.away || fallback.away, "Visitante");
            const timeline = mcNormalizeTimeline(data, fallback);
            const finished = !!data?.finished;
            const title = finished ? "GRÁFICO DE PRESSÃO • PÓS-JOGO" : "MOMENTO DA PARTIDA • AO VIVO";
  
            if (!timeline.length){
              return `<div class="mcPressureChartBox empty"><h4>${title}</h4><div class="mcEmptyReal">Aguardando dados de pressão da API.</div></div>`;
            }
  
            const cleanRaw = timeline.map((p, idx) => ({
              minute: parseInt(String(p?.minute ?? idx).replace(/[^0-9]/g,""),10) || (idx + 1) * 5,
              home: Math.max(0, mcNum(p?.home, 0) || 0),
              away: Math.max(0, mcNum(p?.away, 0) || 0)
            }));
  
            // Se a API mandar pressão acumulada, converte para pressão POR BLOCO.
            // Isso elimina o desenho sempre crescente e deixa o gráfico com altos e baixos reais.
            const isMostlyGrowing = (arr, key) => {
              if (!arr || arr.length < 6) return false;
              let grows = 0;
              for (let i = 1; i < arr.length; i++){
                if (arr[i][key] >= arr[i - 1][key]) grows++;
              }
              return grows >= arr.length - 2;
            };
  
            const looksAccumulated = isMostlyGrowing(cleanRaw, "home") || isMostlyGrowing(cleanRaw, "away");
            const clean = looksAccumulated
              ? cleanRaw.map((p, i) => {
                  const prev = cleanRaw[i - 1] || { home: 0, away: 0 };
                  return {
                    minute: p.minute,
                    home: i === 0 ? p.home : Math.max(0, p.home - prev.home),
                    away: i === 0 ? p.away : Math.max(0, p.away - prev.away)
                  };
                })
              : cleanRaw;
  
            const maxVal = Math.max(1, ...clean.map(p => Math.max(p.home, p.away)));
            const W = 720, H = 210, padX = 24, mid = 104, maxBar = 78;
            const gap = 2;
            const barW = Math.max(14, Math.min(30, ((W - padX * 2) / clean.length) - gap));
            const step = (W - padX * 2) / Math.max(1, clean.length - 1);
  
            const bars = clean.map((p, i) => {
              const x = padX + (i * step) - (barW / 2);
              const hh = Math.max(7, (p.home / maxVal) * maxBar);
              const ah = Math.max(7, (p.away / maxVal) * maxBar);
              return `
                <rect class="mcPressureBar home" x="${x.toFixed(1)}" y="${(mid - hh).toFixed(1)}" width="${barW.toFixed(1)}" height="${hh.toFixed(1)}" rx="3"></rect>
                <rect class="mcPressureBar away" x="${x.toFixed(1)}" y="${mid}" width="${barW.toFixed(1)}" height="${ah.toFixed(1)}" rx="3"></rect>
              `;
            }).join("");
  
            const markers = mcEventMarkers(data).map(ev => {
              const x = padX + ((ev.minute - 1) / 89) * (W - padX * 2);
              const y = ev.icon === "⚽" ? 22 : 188;
              return `<text class="mcPressureEvent" x="${x.toFixed(1)}" y="${y}" text-anchor="middle"><title>${ev.minute}' - ${ev.label}</title>${ev.icon}</text>`;
            }).join("");
  
            const labels = [0,15,30,45,60,75,90].map(m => {
              const x = padX + (m / 90) * (W - padX * 2);
              return `<text class="mcPressureTime" x="${x.toFixed(1)}" y="203" text-anchor="middle">${m}'</text>`;
            }).join("");
  
            return `<div class="mcPressureChartBox ${finished ? "is-finished" : "is-live"}">
              <div class="mcPressureChartHead">
                <h4>${title}</h4>
                <span>${finished ? "salvo após o apito final" : "salvando para o pós-jogo"}</span>
              </div>
              <div class="mcPressureTeamsLine"><b>${home}</b><strong>${mcVal(data?.goals?.home)} x ${mcVal(data?.goals?.away)}</strong><b>${away}</b></div>
              <svg class="mcPressureSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de pressão da partida">
                <line class="mcPressureMid" x1="${padX}" y1="${mid}" x2="${W-padX}" y2="${mid}"></line>
                <line class="mcPressureGrid" x1="${padX}" y1="45" x2="${W-padX}" y2="45"></line>
                <line class="mcPressureGrid" x1="${padX}" y1="163" x2="${W-padX}" y2="163"></line>
                ${bars}
                ${markers}
                ${labels}
              </svg>
              <div class="mcPressureLegend"><span><i class="home"></i>${home}</span><span><i class="away"></i>${away}</span></div>
            </div>`;
          }
  
          function mcBuildPanel(data, fallback){
            const home = mcSafe(data?.home || fallback.home, "Mandante");
            const away = mcSafe(data?.away || fallback.away, "Visitante");
            const status = mcStatusLabel(data);
            const minuteLabel = mcLiveMinuteLabel(data);
            const gh = mcVal(data?.goals?.home);
            const ga = mcVal(data?.goals?.away);
  
            const ph = mcNum(data?.pressure?.home, null);
            const pa = mcNum(data?.pressure?.away, null);
            const pressureTotal = (ph !== null && pa !== null) ? ph + pa : null;
            const homePressurePct = mcRealPct(ph, pressureTotal);
            const awayPressurePct = mcRealPct(pa, pressureTotal);
  
            const ch = mcNum(data?.corners?.home, null);
            const ca = mcNum(data?.corners?.away, null);
            const shOnTotal = mcNum(data?.shots?.on_target_total, null);
            const cardsTotal = mcNum(data?.cards?.yellow_home,0) + mcNum(data?.cards?.yellow_away,0) + mcNum(data?.cards?.red_home,0) + mcNum(data?.cards?.red_away,0);
  
            const nextCorner = (data?.live && pressureTotal !== null && ch !== null && ca !== null) ? Math.max(35, Math.min(85, Math.round(45 + ((ch + ca) * 2.2) + (pressureTotal / 12)))) : null;
            const nextGoal = (data?.live && shOnTotal !== null) ? Math.max(20, Math.min(78, Math.round(34 + (shOnTotal * 4)))) : null;
            const nextCard = (data?.live && pressureTotal !== null) ? Math.max(18, Math.min(72, Math.round(26 + (pressureTotal / 9) + (cardsTotal * 5)))) : null;
  
            const totalEntries = mcNum(data?.markets?.entries_total, null);
            const hitEntries = mcNum(data?.markets?.entries_hit, null);
            const pendingEntries = mcNum(data?.markets?.entries_pending, null);
            const errorEntries = (totalEntries !== null && hitEntries !== null && pendingEntries !== null) ? Math.max(0,totalEntries-hitEntries-pendingEntries) : null;
            const entryPct = (totalEntries && hitEntries !== null) ? Math.round((hitEntries / totalEntries) * 100) : null;
  
            const yellowHome = mcVal(data?.cards?.yellow_home);
            const yellowAway = mcVal(data?.cards?.yellow_away);
            const redHome = mcVal(data?.cards?.red_home);
            const redAway = mcVal(data?.cards?.red_away);
  
            const pressureHTML = (homePressurePct === null || awayPressurePct === null)
              ? `<div class="mcEmptyReal">Aguardando pressão ofensiva real da API.</div>`
              : `<div class="mcPressurePro">
                  <span class="mcShieldTiny">⬟</span>
                  <strong>${homePressurePct}%</strong>
                  <div class="mcMiniBar"><i style="width:${homePressurePct}%"></i></div>
                  <div class="mcMiniBar away"><i style="width:${awayPressurePct}%"></i></div>
                  <strong class="away">${awayPressurePct}%</strong>
                  <span class="mcShieldTiny away">🏆</span>
                </div>`;
  
            const entryHTML = (entryPct === null)
              ? `<div class="mcEmptyReal">Sem entradas calculadas para este jogo.</div>`
              : `<div class="mcEntryCircle big" style="--p:${entryPct};"><b>${entryPct}%</b><span>Aproveitamento</span></div>
                 <div class="mcEventsList compact">
                  <div class="mcEventItem"><span>●</span><b>Acertos</b><em>${hitEntries}</em></div>
                  <div class="mcEventItem"><span>●</span><b>Meio</b><em>${pendingEntries}</em></div>
                  <div class="mcEventItem"><span>●</span><b>Erros</b><em>${errorEntries}</em></div>
                 </div>
                 <p>Total: ${totalEntries} entradas</p>`;
  
            return `<div class="matchCenterDrop matchCenterPro" data-match-center-open="1">
              <div class="mcProTopActions">
                <button class="mcBackBtn" type="button" data-mc-close="1">← Voltar para jogos</button>
                <button class="mcFavBtn" type="button">☆ Adicionar aos favoritos</button>
              </div>
  
              <div class="matchCenterHead mcProHead">
                <div class="matchCenterTeam mcProTeam mcHomeTeam">
                  <div class="mcShield">⬟</div>
                  <strong>${home}</strong>
                </div>
  
                <div class="matchCenterScore mcProScore">
                  <div class="matchCenterStatus">● ${status}</div>
                  ${minuteLabel ? `<div class="mcLiveMinute">${minuteLabel}</div>` : ``}
                  <div class="matchCenterGoals">${gh} <small>x</small> ${ga}</div>
                </div>
  
                <div class="matchCenterTeam mcProTeam mcAwayTeam">
                  <div class="mcShield mcShieldAway">🏆</div>
                  <strong>${away}</strong>
                </div>
              </div>
  
              <div class="matchCenterTabs mcProTabs">
                <span class="is-active">▥ Estatísticas</span>
                <span>⌁ Momento</span>
                <span>♟ Escalações</span>
                <span>◷ Minuto a minuto</span>
                <span>▣ Eventos</span>
                <span>◴ Histórico / H2H</span>
              </div>
  
              <div class="mcProGrid">
                <section class="matchCenterCard mcStatsProCard">
                  <div class="mcCardHeader"><span class="mcShieldTiny">⬟</span><h4>Estatísticas dos times</h4><span class="mcShieldTiny away">🏆</span></div>
                  ${mcBuildStatsRows(data)}
                </section>
  
                <section class="matchCenterCard mcMomentProCard">
                  ${mcBuildPressureChart(data, fallback)}
                  <div class="mcProMiniCards">
        <div class="mcCornersProCard mcCornersDonutCard inline">
          <h4>Escanteios por time</h4>
          <div class="mcCornersDonutWrap" style="--homePct:${((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0)) > 0 ? Math.round(((Number(data?.corners?.home ?? 0) || 0) / ((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0))) * 100) : 50};--awayPct:${((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0)) > 0 ? 100 - Math.round(((Number(data?.corners?.home ?? 0) || 0) / ((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0))) * 100) : 50};">
            <div class="mcCornerSide mcCornerHome">
              <span class="mcShieldTiny">⬟</span>
              <b class="green">${data?.corners?.home === null || data?.corners?.home === undefined ? "—" : Number(data.corners.home)}</b>
              <small>${((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0)) > 0 ? Math.round(((Number(data?.corners?.home ?? 0) || 0) / ((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0))) * 100) : 50}%</small>
              <em>${safe(data?.home || data?.casa || data?.home_name || data?.team_home || data?.teams?.home?.name || "Casa")}</em>
            </div>
            <div class="mcDonutChart">
              <div class="mcDonutCenter">
                <span>Total</span>
                <strong>${(Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0)}</strong>
                <small>escanteios</small>
              </div>
            </div>
            <div class="mcCornerSide mcCornerAway">
              <span class="mcShieldTiny away">🏆</span>
              <b class="blue">${data?.corners?.away === null || data?.corners?.away === undefined ? "—" : Number(data.corners.away)}</b>
              <small>${((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0)) > 0 ? 100 - Math.round(((Number(data?.corners?.home ?? 0) || 0) / ((Number(data?.corners?.home ?? 0) || 0) + (Number(data?.corners?.away ?? 0) || 0))) * 100) : 50}%</small>
              <em>${safe(data?.away || data?.fora || data?.away_name || data?.team_away || data?.teams?.away?.name || "Fora")}</em>
            </div>
          </div>
        </div>
                  </div>
                </section>
  
                <section class="matchCenterCard mcRightProCard">
                  <h4>Pressão ofensiva</h4>
                  <small>Ataques perigosos em tempo real, quando a API retorna.</small>
                  ${pressureHTML}
  
                  <div class="mcRadarBoxPro">
                    <h4>Radar do jogo <small>Baseado somente nos dados reais disponíveis</small></h4>
                    <div class="mcRadarGrid">
                      <div class="mcRadarItem"><span>Próximo escanteio</span>${mcRadarPct("", nextCorner)}</div>
                      <div class="mcRadarItem"><span>Próximo gol</span>${mcRadarPct("gold", nextGoal)}</div>
                      <div class="mcRadarItem"><span>Cartão nos próximos 10'</span>${mcRadarPct("blue", nextCard)}</div>
                    </div>
                    <div class="mcTrendLine">⌁ <b>Tendência</b><span>${data?.live ? "Cálculo baseado no momento real da partida." : "Disponível quando o jogo estiver ao vivo."}</span></div>
                  </div>
                </section>
  
                <section class="matchCenterCard mcEventsProCard">
                  <h4>${data?.finished ? "Eventos finais" : "Eventos em tempo real"}</h4>
                  <div class="mcEventsList">${mcBuildEvents(data)}</div>
                </section>
              </div>
            </div>`;
          }
  
          function ensureMatchCenterOverlay(){
            let overlay = document.getElementById("matchCenterOverlay");
            if (overlay) return overlay;
  
            overlay = document.createElement("div");
            overlay.id = "matchCenterOverlay";
            overlay.className = "matchCenterOverlay";
            overlay.setAttribute("aria-hidden", "true");
            overlay.innerHTML = `
              <div class="matchCenterOverlayBox" role="dialog" aria-modal="true" aria-label="Match Center">
                <button class="matchCenterOverlayClose" type="button" aria-label="Fechar Match Center">✕</button>
                <div class="matchCenterOverlayBody">
                  <div class="matchCenterLoading">Carregando Match Center...</div>
                </div>
              </div>
            `;
            document.body.appendChild(overlay);
  
            overlay.addEventListener("click", (ev) => {
              if (ev.target === overlay || ev.target.closest(".matchCenterOverlayClose")){
                closeMatchCenterOverlay();
              }
            });
  
            return overlay;
          }
  
          function closeMatchCenterOverlay(){
            const overlay = document.getElementById("matchCenterOverlay");
            if (!overlay) return;
            overlay.classList.remove("active");
            overlay.setAttribute("aria-hidden", "true");
            document.body.classList.remove("matchCenterModalOpen");
            document.querySelectorAll(".matchCenterBtn,.matchCenterMiniBtn").forEach(b => b.classList.remove("is-open"));
          }
  
          async function openMatchCenter(btn){
            document.querySelectorAll(".matchCenterBtn,.matchCenterMiniBtn").forEach(b => b.classList.remove("is-open"));
            btn.classList.add("is-open");
  
            const fallback = {
              matchId: btn.dataset.matchId || "",
              home: btn.dataset.home || "Mandante",
              away: btn.dataset.away || "Visitante",
              league: btn.dataset.league || "Liga",
              time: btn.dataset.time || ""
            };
  
            const overlay = ensureMatchCenterOverlay();
            const body = overlay.querySelector(".matchCenterOverlayBody");
  
            body.innerHTML = `<div class="matchCenterLoading">Carregando Match Center...</div>`;
            overlay.classList.add("active");
            overlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("matchCenterModalOpen");
  
            let data = null;
            if (fallback.matchId){
              try{
                const res = await fetch(`/match_center?match_id=${encodeURIComponent(fallback.matchId)}`);
                if (res.ok) data = await res.json();
              }catch(err){
                console.warn("Match Center falhou:", err);
              }
            }
  
            if (!data){
              data = {
                home: fallback.home,
                away: fallback.away,
                league: fallback.league,
                status: "Pré-jogo / aguardando dados live",
                goals:{home:"—", away:"—", total:null},
                corners:{home:"—", away:"—", total:null},
                shots:{home:"—", away:"—", on_target_home:"—", on_target_away:"—", total:null},
                pressure:{home:"—", away:"—", total:null},
                markets:{corners95:null, corners105:null, btts:null}
              };
            }
  
            body.innerHTML = mcBuildPanel(data, fallback)
              .replace(/undefined/gi, "—")
              .replace(/null/gi, "—");
          }
  
