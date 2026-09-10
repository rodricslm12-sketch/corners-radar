    /* =========================================================
       CORNER PRO — SITE PC — GUARD DE CARREGAMENTO ÚNICO
       Inserido antes do código legado para impedir chamadas GET
       idênticas simultâneas dos motores do dashboard desktop.
       Não atua no mobile/app.
       ========================================================= */
       (function installCornerProDesktopFetchGuard(){
        "use strict";
        if (window.__cpDesktopFetchGuardInstalled) return;
        window.__cpDesktopFetchGuardInstalled = true;
      
        const originalFetch = window.fetch.bind(window);
        const inflight = new Map();
        const DESKTOP_ENDPOINTS = [
          "/mercados", "/quentes", "/web_corners_ai",
          "/market_engines_fast", "/market_engines"
        ];
      
        function desktop(){
          return !(window.matchMedia && window.matchMedia("(max-width:980px)").matches);
        }
      
        function normalizeUrl(input){
          try{
            const raw = typeof input === "string" ? input : input?.url;
            const u = new URL(raw, window.location.origin);
            ["_web","_webv22","_mobile","t"].forEach(k => u.searchParams.delete(k));
            return u.pathname + "?" + [...u.searchParams.entries()]
              .sort((a,b) => a[0].localeCompare(b[0]) || String(a[1]).localeCompare(String(b[1])))
              .map(([k,v]) => encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&");
          }catch(_){ return String(input); }
        }
      
        window.fetch = function(input, init={}){
          const method = String(init?.method || "GET").toUpperCase();
          const raw = typeof input === "string" ? input : input?.url || "";
          const guarded = desktop() && method === "GET" && DESKTOP_ENDPOINTS.some(ep => raw.includes(ep));
          if (!guarded) return originalFetch(input, init);
      
          const key = normalizeUrl(input);
          if (inflight.has(key)) return inflight.get(key).then(r => r.clone());
      
          const request = originalFetch(input, init)
            .then(r => {
              setTimeout(() => inflight.delete(key), 250);
              return r;
            })
            .catch(err => {
              inflight.delete(key);
              throw err;
            });
      
          inflight.set(key, request);
          return request.then(r => r.clone());
        };
      })();
      
      /* =========================================================
         CORNER PRO WEB V28 — CONTROLE PRIORITÁRIO
         SOMENTE CALENDÁRIO + MATCH CENTER DESKTOP
      
         MOTIVO:
         O arquivo legado possui vários listeners e várias redefinições de
         updateDesktopMatchRail. Este bloco entra ANTES de todo o código
         antigo e intercepta SOMENTE:
           #btnCalendario
           #topCalPrev / #topCalNext / #topCalToday
           .topCalendarDay
           [data-cpd3-open]
      
         Assim os módulos antigos não disputam estes cliques.
         ========================================================= */
         (() => {
          "use strict";
        
          if (window.__CP_WEB_V28_PRIORITY__) return;
          window.__CP_WEB_V28_PRIORITY__ = true;
        
          const desktop = () =>
            !!window.matchMedia && window.matchMedia("(min-width:981px)").matches;
        
          const $ = (selector, root = document) => root.querySelector(selector);
        
          const clean = (value, fallback = "") => {
            const text = String(value ?? "").trim();
            return text && !["undefined", "null", "NaN"].includes(text)
              ? text
              : fallback;
          };
        
          const esc = value => String(value ?? "").replace(
            /[&<>"']/g,
            ch => ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#039;"
            })[ch]
          );
        
          const norm = value => String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
        
          const raw = game => game?.raw || game || {};
        
          function home(game) {
            const r = raw(game);
            return clean(
              game?.casa ?? game?.home ??
              r?.casa ?? r?.home ??
              r?.home_name ?? r?.home_team ??
              r?.match_hometeam_name ?? r?.event_home_team,
              "Casa"
            );
          }
        
          function away(game) {
            const r = raw(game);
            return clean(
              game?.fora ?? game?.away ??
              r?.fora ?? r?.away ??
              r?.away_name ?? r?.away_team ??
              r?.match_awayteam_name ?? r?.event_away_team,
              "Fora"
            );
          }
        
          function league(game) {
            const r = raw(game);
            return clean(
              game?.liga ?? game?.league ??
              r?.liga ?? r?.league_name ?? r?.league,
              "Liga"
            );
          }
        
          function time(game) {
            const r = raw(game);
            return clean(
              game?.hora ?? game?.time ??
              r?.hora ?? r?.time ??
              r?.match_time ?? r?.event_time,
              "—"
            );
          }
        
          function gameId(game) {
            const r = raw(game);
            return clean(
              game?.match_id ?? game?.event_id ?? game?.event_key ??
              game?.fixture_id ?? game?.id ??
              r?.match_id ?? r?.event_id ?? r?.event_key ??
              r?.fixture_id ?? r?.id,
              ""
            );
          }
        
          function localKey(game) {
            return `${norm(home(game))}|${norm(away(game))}|${time(game)}`;
          }
        
          function collectGames() {
            const panel = $(".gamesPanel");
        
            const pools = [
              window.__cornerProAllGames,
              window.__lastRawGames,
              window.__premiumFilteredGames,
              window.__premiumMarketGames,
              panel?.__cornerProAllGames,
              panel?.__cornerProGames
            ];
        
            const result = [];
            const seen = new Set();
        
            for (const pool of pools) {
              if (!Array.isArray(pool)) continue;
        
              for (const game of pool) {
                if (!game || typeof game !== "object") continue;
        
                const id = gameId(game);
                const key = id || localKey(game);
                if (!key || seen.has(key)) continue;
        
                seen.add(key);
                result.push(game);
              }
            }
        
            return result;
          }
        
          function resolveGame(button) {
            const requested = clean(button?.dataset?.cpd3Open, "");
            const row = button?.closest?.(".cpd3Row,[data-cpd3-game]");
            const games = collectGames();
        
            let found = games.find(game => {
              const id = gameId(game);
              const key = localKey(game);
              return requested && (requested === id || requested === key);
            });
        
            if (found) return found;
        
            /* Tenta nomes da linha caso o data-cpd3-open tenha vindo de uma
               chave visual e não de match_id. */
            if (row) {
              const names = [...row.querySelectorAll(".cpd3Names b")]
                .map(el => clean(el.textContent, ""))
                .filter(Boolean);
        
              const rowHome = names[0] || "";
              const rowAway = names[1] || "";
        
              if (rowHome || rowAway) {
                found = games.find(game =>
                  (!rowHome || norm(home(game)) === norm(rowHome)) &&
                  (!rowAway || norm(away(game)) === norm(rowAway))
                );
              }
        
              if (found) return found;
            }
        
            return null;
          }
        
          /* ================= CALENDÁRIO ================= */
          const MONTHS = [
            "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
            "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"
          ];
        
          const pad = value => String(value).padStart(2, "0");
        
          const toYMD = date =>
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        
          const parseYMD = value => {
            const text = String(value || "");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date();
        
            const [year, month, day] = text.split("-").map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
          };
        
          const sameDay = (a, b) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
        
          function currentDateYMD() {
            const input = $("#date");
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(input?.value || ""))) {
              return input.value;
            }
        
            const urlDate = new URLSearchParams(location.search).get("date");
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(urlDate || ""))) {
              return urlDate;
            }
        
            try {
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Manaus",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
              }).formatToParts(new Date());
        
              const obj = Object.fromEntries(parts.map(part => [part.type, part.value]));
              return `${obj.year}-${obj.month}-${obj.day}`;
            } catch (_) {
              return toYMD(new Date());
            }
          }
        
          let calendarView = parseYMD(currentDateYMD());
        
          function renderCalendar() {
            const days = $("#topCalendarDays");
            const title = $("#topCalTitle");
            if (!days || !title) return false;
        
            days.innerHTML = "";
        
            const selected = parseYMD(currentDateYMD());
            const today = new Date();
            const year = calendarView.getFullYear();
            const month = calendarView.getMonth();
        
            title.textContent = `${MONTHS[month]} ${year}`;
        
            const first = new Date(year, month, 1, 12, 0, 0);
            const start = new Date(first);
            start.setDate(first.getDate() - first.getDay());
        
            for (let index = 0; index < 42; index++) {
              const date = new Date(start);
              date.setDate(start.getDate() + index);
        
              const button = document.createElement("button");
              button.type = "button";
              button.className = "topCalendarDay";
              button.dataset.date = toYMD(date);
              button.textContent = String(date.getDate());
        
              if (date.getMonth() !== month) button.classList.add("is-muted");
              if (sameDay(date, today)) button.classList.add("is-today");
              if (sameDay(date, selected)) button.classList.add("is-selected");
        
              days.appendChild(button);
            }
        
            return true;
          }
        
          function positionCalendar() {
            const trigger = $("#btnCalendario");
            const drop = $("#topCalendarDropdown");
            if (!trigger || !drop) return;
        
            const rect = trigger.getBoundingClientRect();
            const width = 320;
            const gap = 8;
        
            let left = rect.left + rect.width / 2 - width / 2;
            left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        
            /* Inline + important para vencer os vários patches CSS antigos
               que usam !important em left/top/right. */
            drop.style.setProperty("position", "fixed", "important");
            drop.style.setProperty("top", `${rect.bottom + gap}px`, "important");
            drop.style.setProperty("left", `${left}px`, "important");
            drop.style.setProperty("right", "auto", "important");
            drop.style.setProperty("width", `${width}px`, "important");
            drop.style.setProperty("display", "block", "important");
          }
        
          function openCalendar() {
            const trigger = $("#btnCalendario");
            const drop = $("#topCalendarDropdown");
            if (!trigger || !drop) return;
        
            calendarView = parseYMD(currentDateYMD());
            renderCalendar();
            positionCalendar();
        
            trigger.classList.add("is-open");
            drop.classList.add("is-open");
            drop.setAttribute("aria-hidden", "false");
        
            drop.style.setProperty("visibility", "visible", "important");
            drop.style.setProperty("opacity", "1", "important");
            drop.style.setProperty("pointer-events", "auto", "important");
            drop.style.setProperty("z-index", "2147483646", "important");
          }
        
          function closeCalendar() {
            const trigger = $("#btnCalendario");
            const drop = $("#topCalendarDropdown");
            if (!drop) return;
        
            trigger?.classList.remove("is-open");
            drop.classList.remove("is-open");
            drop.setAttribute("aria-hidden", "true");
        
            drop.style.removeProperty("display");
            drop.style.removeProperty("visibility");
            drop.style.removeProperty("opacity");
            drop.style.removeProperty("pointer-events");
          }
        
          async function applyDate(ymd) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return;
        
            const input = $("#date");
            if (input) input.value = ymd;
        
            try {
              const url = new URL(location.href);
              url.hash = "";
              url.searchParams.delete("data");
              url.searchParams.set("date", ymd);
              history.replaceState({}, "", `${url.pathname}${url.search}`);
            } catch (_) {}
        
            closeCalendar();
        
            try {
              if (typeof window.CornerProDesktopReloadDate === "function") {
                await window.CornerProDesktopReloadDate(ymd);
                return;
              }
        
              if (typeof window.CornerProReloadRealGames === "function") {
                await window.CornerProReloadRealGames(ymd);
                return;
              }
        
              /* Último fallback: atualiza a página já com a data correta.
                 Evita depender de funções privadas dos módulos antigos. */
              location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
            } catch (error) {
              console.error("[CP V28 Calendário]", error);
              location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
            }
          }
        
          /* ================= MATCH CENTER ================= */
          function rail() {
            return $("#desktopMatchRail") || $(".dashboardRightRail");
          }
        
          function renderMcLoading(game) {
            const target = rail();
            if (!target) return;
        
            target.style.setProperty("display", "flex", "important");
            target.style.setProperty("visibility", "visible", "important");
            target.style.setProperty("opacity", "1", "important");
        
            target.innerHTML = `
              <section class="railCard cpV28McHead">
                <div class="railTitle"><span>▣ MATCH CENTER</span><b>CARREGANDO</b></div>
                <div style="text-align:center;padding:14px 6px">
                  <strong>${esc(home(game))}</strong>
                  <span style="padding:0 8px">×</span>
                  <strong>${esc(away(game))}</strong>
                  <p style="margin:8px 0 0;color:#91a0a3">Buscando estatísticas da partida...</p>
                </div>
              </section>
            `;
          }
        
          function pickPair(data, name) {
            const source = data?.[name] || data?.statistics?.[name] || {};
        
            let h =
              source?.home ??
              data?.statistics?.home?.[name] ??
              data?.[`home_${name}`] ??
              data?.[`${name}_home`];
        
            let a =
              source?.away ??
              data?.statistics?.away?.[name] ??
              data?.[`away_${name}`] ??
              data?.[`${name}_away`];
        
            return [
              clean(h, "—"),
              clean(a, "—")
            ];
          }
        
          function metric(label, pair) {
            return `
              <div style="display:grid;grid-template-columns:42px 1fr 42px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #1b2b32">
                <b style="text-align:center">${esc(pair[0])}</b>
                <span style="text-align:center;color:#9aa6a8;font-size:9px;font-weight:800">${esc(label)}</span>
                <b style="text-align:center">${esc(pair[1])}</b>
              </div>
            `;
          }
        
          function statusText(data) {
            const value = clean(
              data?.status ?? data?.status_raw ?? data?.match_status,
              "PRÉ-JOGO"
            ).toUpperCase();
        
            if (/FT|FINISHED|ENCERR|FINAL/.test(value)) return "FIM";
            if (/HT|HALF|INTERVAL/.test(value)) return "INTERVALO";
        
            const minute = clean(
              data?.minute ?? data?.match_minute ?? data?.elapsed,
              ""
            );
        
            if (data?.live || /LIVE|AO VIVO|1ST|2ND/.test(value) || minute) {
              return minute ? `AO VIVO • ${esc(minute)}'` : "AO VIVO";
            }
        
            return "PRÉ-JOGO";
          }
        
          function renderMcData(game, data) {
            const target = rail();
            if (!target) return;
        
            const corners = pickPair(data, "corners");
            const shots = pickPair(data, "shots");
            const shotsTarget = pickPair(data, "shots_on_target");
            const possession = pickPair(data, "possession");
            const attacks = pickPair(data, "dangerous_attacks");
            const passes = pickPair(data, "passes");
            const fouls = pickPair(data, "fouls");
            const cards = pickPair(data, "yellow_cards");
        
            const hs = clean(
              data?.goals?.home ?? data?.score?.home ?? data?.home_score,
              "0"
            );
            const as = clean(
              data?.goals?.away ?? data?.score?.away ?? data?.away_score,
              "0"
            );
        
            const events = Array.isArray(data?.events)
              ? data.events.slice(-8)
              : [];
        
            target.innerHTML = `
              <section class="railCard cpV28McHead">
                <div class="railTitle">
                  <span>▣ MATCH CENTER</span>
                  <b>${statusText(data)}</b>
                </div>
        
                <div style="text-align:center;color:#91a0a3;font-size:9px;margin:4px 0 10px">
                  ${esc(clean(data?.league, league(game)))} • ${esc(clean(data?.time, time(game)))}
                </div>
        
                <div style="display:grid;grid-template-columns:1fr 70px 1fr;gap:8px;align-items:center;text-align:center">
                  <strong>${esc(clean(data?.home, home(game)))}</strong>
                  <b style="font-size:24px;color:#63f127">${esc(hs)} - ${esc(as)}</b>
                  <strong>${esc(clean(data?.away, away(game)))}</strong>
                </div>
              </section>
        
              <section class="railCard cpV28McStats">
                <h3>ESTATÍSTICAS DA PARTIDA</h3>
                ${metric("Escanteios", corners)}
                ${metric("Finalizações", shots)}
                ${metric("No alvo", shotsTarget)}
                ${metric("Posse", possession)}
                ${metric("Ataques perigosos", attacks)}
                ${metric("Passes", passes)}
                ${metric("Faltas", fouls)}
                ${metric("Cartões", cards)}
              </section>
        
              <section class="railCard cpV28McEvents">
                <h3>EVENTOS / LEITURA</h3>
                ${
                  events.length
                    ? events.map(event => `
                        <p style="margin:0;padding:7px 0;border-top:1px solid #1b2b32">
                          <b style="color:#63f127">${esc(event?.minute ?? "")}${event?.minute ? "'" : ""}</b>
                          ${esc(event?.label ?? event?.type ?? "Evento")}
                        </p>
                      `).join("")
                    : `<p style="color:#91a0a3">Nenhum evento detalhado disponível neste momento.</p>`
                }
              </section>
            `;
          }
        
          function renderMcError(game, message) {
            const target = rail();
            if (!target) return;
        
            target.innerHTML = `
              <section class="railCard">
                <div class="railTitle"><span>▣ MATCH CENTER</span><b>ERRO</b></div>
                <p><strong>${esc(home(game))} × ${esc(away(game))}</strong></p>
                <p style="color:#91a0a3">${esc(message)}</p>
              </section>
            `;
          }
        
          function renderMcEmpty() {
            const target = rail();
            if (!target) return;
    
            if (typeof window.resetDesktopMatchRailToEmpty === "function") {
              try {
                window.resetDesktopMatchRailToEmpty();
                return;
              } catch (_) {}
            }
    
            target.innerHTML = `
              <section class="railCard matchRailCard railEmptyHero">
                <div class="railTitle">
                  <span>▣ MATCH CENTER</span>
                  <b>PRÉ-JOGO</b>
                </div>

                <div class="railEmptyRadar" aria-hidden="true">
                  <span class="radarRing ring1"></span>
                  <span class="radarRing ring2"></span>
                  <span class="radarRing ring3"></span>
                  <span class="radarSweep"></span>
                  <span class="radarBall">⚽</span>
                </div>

                <div class="railEmptyText">
                  <strong>Aguardando partida</strong>
                  <span>Selecione um jogo para iniciar o Match Center e ver todas as análises.</span>
                </div>
              </section>

              <section class="railCard railEmptyStatsCard">
                <h3>ESTATÍSTICAS DO FILTRO</h3>

                <div class="railEmptyStatsGrid">
                  <div class="railEmptyStatBox">
                    <i>🛡</i>
                    <span>Força do filtro</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>🚩</i>
                    <span>Proj. escanteios</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>🏠</i>
                    <span>Casa média</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>✈</i>
                    <span>Visitante média</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>
                </div>

                <div class="railEmptyHint">
                  As estatísticas serão carregadas após a seleção de uma partida.
                </div>
              </section>

              <section class="railCard railEmptyEventsCard">
                <h3>EVENTOS / LEITURA</h3>

                <div class="railEmptyEventIcons">
                  <span><i>◎</i><b>Pressão</b><small>--</small></span>
                  <span><i>◔</i><b>Posse</b><small>--</small></span>
                  <span><i>▣</i><b>Cartões</b><small>--</small></span>
                  <span><i>⚑</i><b>Escanteios</b><small>--</small></span>
                  <span><i>⚽</i><b>Gols</b><small>--</small></span>
                </div>

                <div class="railEmptyTimeline">
                  <i></i><i></i><i></i><i></i><i></i>
                </div>

                <div class="railEmptyReadBox">
                  <b>📋</b>
                  <p>A leitura do jogo aparecerá aqui. Selecione uma partida para ver eventos e insights em tempo real.</p>
                </div>
              </section>
            `;
          }
    
          function clearMatchCenterSelection() {
            window.__cpV28MatchCenterToken = (window.__cpV28MatchCenterToken || 0) + 1;
            window.__selectedMatchCenterGame = null;
            window.__selectedMatchCenterKey = null;
    
            document.querySelectorAll("[data-cpd3-open].is-open")
              .forEach(el => el.classList.remove("is-open"));
    
            document.querySelectorAll(".cpd3Row.match-center-selected")
              .forEach(el => el.classList.remove("match-center-selected"));
    
            rail()?.classList.remove("mc-selected");
            renderMcEmpty();
          }
    
          async function openMatchCenter(game, sourceButton = null) {
            if (!game) return;
    
            const selectedKey = gameId(game) || localKey(game);
            const requestToken = (window.__cpV28MatchCenterToken || 0) + 1;
            window.__cpV28MatchCenterToken = requestToken;
    
            window.__selectedMatchCenterGame = game;
            window.__selectedMatchCenterKey = selectedKey;
    
            document.querySelectorAll("[data-cpd3-open].is-open")
              .forEach(el => el.classList.remove("is-open"));
    
            document.querySelectorAll(".cpd3Row.match-center-selected")
              .forEach(el => el.classList.remove("match-center-selected"));
    
            sourceButton?.classList.add("is-open");
            sourceButton?.closest?.(".cpd3Row")?.classList.add("match-center-selected");
            rail()?.classList.add("mc-selected");
    
            renderMcLoading(game);
    
            const id = gameId(game);
    
            if (!id) {
              renderMcError(
                game,
                "Esta linha não trouxe o match_id real. Recarregue os jogos do dia e tente novamente."
              );
              return;
            }
    
            try {
              const response = await fetch(
                `/match_center?match_id=${encodeURIComponent(id)}&fresh=1&t=${Date.now()}`,
                {
                  cache: "no-store",
                  headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                  }
                }
              );
    
              const data = await response.json().catch(() => null);
    
              // Se fechou ou trocou de jogo enquanto carregava, ignora a resposta antiga.
              if (
                requestToken !== window.__cpV28MatchCenterToken ||
                window.__selectedMatchCenterKey !== selectedKey
              ) return;
    
              if (!response.ok || !data || data?.error) {
                throw new Error(data?.error || `HTTP ${response.status}`);
              }
    
              renderMcData(game, data);
            } catch (error) {
              if (
                requestToken !== window.__cpV28MatchCenterToken ||
                window.__selectedMatchCenterKey !== selectedKey
              ) return;
    
              console.error("[CP V28 Match Center]", error);
              renderMcError(
                game,
                `Não foi possível carregar as estatísticas: ${error?.message || "erro desconhecido"}.`
              );
            }
          }
    
          /* WINDOW + CAPTURE:
             executa antes dos listeners antigos registrados no document. */
          window.addEventListener("click", event => {
            if (!desktop()) return;
        
            const target = event.target;
            if (!(target instanceof Element)) return;
        
            const calendarButton = target.closest("#btnCalendario");
            if (calendarButton) {
              event.preventDefault();
              event.stopImmediatePropagation();
        
              const drop = $("#topCalendarDropdown");
              if (drop?.classList.contains("is-open")) closeCalendar();
              else openCalendar();
              return;
            }
        
            const previous = target.closest("#topCalPrev");
            if (previous) {
              event.preventDefault();
              event.stopImmediatePropagation();
        
              calendarView = new Date(
                calendarView.getFullYear(),
                calendarView.getMonth() - 1,
                1, 12, 0, 0
              );
              renderCalendar();
              positionCalendar();
              return;
            }
        
            const next = target.closest("#topCalNext");
            if (next) {
              event.preventDefault();
              event.stopImmediatePropagation();
        
              calendarView = new Date(
                calendarView.getFullYear(),
                calendarView.getMonth() + 1,
                1, 12, 0, 0
              );
              renderCalendar();
              positionCalendar();
              return;
            }
        
            const today = target.closest("#topCalToday");
            if (today) {
              event.preventDefault();
              event.stopImmediatePropagation();
              applyDate(currentDateYMD());
              return;
            }
        
            const day = target.closest("#topCalendarDropdown .topCalendarDay");
            if (day) {
              event.preventDefault();
              event.stopImmediatePropagation();
              applyDate(day.dataset.date);
              return;
            }
        
            const analysis = target.closest("[data-cpd3-open]");
            if (analysis) {
              event.preventDefault();
              event.stopImmediatePropagation();
    
              const game = resolveGame(analysis);
    
              if (game) {
                const clickedKey = gameId(game) || localKey(game);
    
                // 1) Segundo clique no MESMO "Ver análise" = fecha.
                if (
                  window.__selectedMatchCenterKey &&
                  window.__selectedMatchCenterKey === clickedKey
                ) {
                  clearMatchCenterSelection();
                } else {
                  // 2) Clique em outro jogo = troca direto.
                  openMatchCenter(game, analysis);
                }
              } else {
                const targetRail = rail();
                if (targetRail) {
                  targetRail.innerHTML = `
                    <section class="railCard">
                      <div class="railTitle"><span>▣ MATCH CENTER</span><b>ERRO</b></div>
                      <p>Não encontrei a partida correspondente ao botão clicado.</p>
                    </section>
                  `;
                }
              }
              return;
            }
    
            if (
              $("#topCalendarDropdown")?.classList.contains("is-open") &&
              !target.closest("#topCalendarDropdown")
            ) {
              closeCalendar();
            }
    
            // 3) Clique fora do Match Center fecha a seleção.
            // Clique dentro do próprio Match Center NÃO fecha.
            if (
              window.__selectedMatchCenterKey &&
              !target.closest("#desktopMatchRail,.dashboardRightRail")
            ) {
              clearMatchCenterSelection();
            }
          }, true);
    
          window.addEventListener("resize", () => {
            if (
              desktop() &&
              $("#topCalendarDropdown")?.classList.contains("is-open")
            ) {
              positionCalendar();
            }
          });
        
          document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
              closeCalendar();
              if (window.__selectedMatchCenterKey) clearMatchCenterSelection();
            }
          });
        
          /* Exposição somente para diagnóstico no console. */
          window.CornerProV28 = {
            openCalendar,
            closeCalendar,
            openMatchCenter,
            closeMatchCenter: clearMatchCenterSelection,
            collectGames
          };
        })();
        
        /* =========================================================
           CORNER PRO WEB V11 — DESKTOP + LIVE + MULTIMERCADOS
           IMPORTANTE:
           - fica NO TOPO do script.js;
           - não depende dos módulos antigos terminarem de executar;
           - /mercados é a fonte-base;
           - /market_engines apenas enriquece;
           - mobile/app não é alterado.
           ========================================================= */
           (() => {
            "use strict";
          
            if (window.__cpWebV11Installed) return;
            window.__cpWebV11Installed = true;
          
            const mq = window.matchMedia("(min-width:981px)");
            if (!mq.matches) return;
          
            const $ = (s, r=document) => r.querySelector(s);
            const $$ = (s, r=document) => [...r.querySelectorAll(s)];
          
            const MARKET = {
              corners: {
                label:"ESCANTEIOS",
                lines:["IA","TODOS","8.5","9.5","10.5","11.5","12.5"],
                subs:[["TOTAL DE ESCANTEIOS","all"],["1º TEMPO","ht"],["2º TEMPO","2h"],["LINHAS ALTERNATIVAS","alt"]]
              },
              goals: {
                label:"GOLS",
                lines:["IA","TODOS","1.5","2.5","3.5","4.5"],
                subs:[["TOTAL DE GOLS","all"],["1º TEMPO","ht"],["2º TEMPO","2h"]]
              },
              cards: {
                label:"CARTÕES",
                lines:["IA","TODOS","2.5","3.5","4.5","5.5"],
                subs:[["TOTAL DE CARTÕES","all"],["CASA","home"],["FORA","away"]]
              },
              handicap: {
                label:"HANDICAP",
                lines:["IA","TODOS","-2.0","-1.5","-1.0","-0.5","0.0","+0.5","+1.0","+1.5","+2.0"],
                subs:[["HANDICAP ASIÁTICO","all"],["CASA","home"],["FORA","away"]]
              },
              btts: {
                label:"AMBAS MARCAM",
                lines:["IA","TODOS","SIM","NÃO"],
                subs:[["TODOS","all"],["SIM","yes"],["NÃO","no"]]
              },
              result:{label:"RESULTADO",lines:["TODOS","CASA","EMPATE","FORA"],subs:[["1X2","all"],["CASA","home"],["EMPATE","draw"],["FORA","away"]]},
              doublechance:{label:"DUPLA CHANCE",lines:["TODOS","1X","12","X2"],subs:[["DUPLA CHANCE","all"],["CASA/EMPATE","1x"],["CASA/FORA","12"],["EMPATE/FORA","x2"]]},
              teamgoals:{label:"GOLS DO TIME",lines:["TODOS","0.5","1.5","2.5"],subs:[["TOTAL DO TIME","all"],["CASA","home"],["FORA","away"]]},
              builder:{label:"APOSTA PRONTA",lines:["TODOS"],subs:[["MAIOR CONFIANÇA","all"]]}
            };
          
            const state = {
              market:"corners",
              line:"IA",
              sub:"all",
              games:[],
              engines:{corners:[],goals:[],cards:[],handicap:[],btts:[],result:[],doublechance:[],teamgoals:[],builder:[]},
              hero:null,
              limit:8,
              favorites:new Set(),
              loading:true
            };
          
            try {
              const saved = JSON.parse(localStorage.getItem("cornerProFavorites") || "[]");
              if (Array.isArray(saved)) saved.forEach(x => state.favorites.add(norm(x)));
            } catch {}
          
            function clean(v, fb=""){
              const s=String(v ?? "").trim();
              return s && !["undefined","null","NaN"].includes(s) ? s : fb;
            }
          
            function esc(v){
              return String(v ?? "")
                .replaceAll("&","&amp;")
                .replaceAll("<","&lt;")
                .replaceAll(">","&gt;")
                .replaceAll('"',"&quot;")
                .replaceAll("'","&#039;");
            }
          
            function norm(v){
              return String(v ?? "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
                .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
            }
          
            function num(...vals){
              for(const v of vals){
                if(v===null || v===undefined || v==="") continue;
                const n=Number(String(v).replace("%","").replace(",","."));
                if(Number.isFinite(n)) return n;
              }
              return null;
            }
          
            function todayManaus(){
              const hidden=$("#date")?.value;
              if(/^\d{4}-\d{2}-\d{2}$/.test(hidden||"")) return hidden;
              try{
                const parts=new Intl.DateTimeFormat("en-CA",{
                  timeZone:"America/Manaus",year:"numeric",month:"2-digit",day:"2-digit"
                }).formatToParts(new Date());
                const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
                return `${m.year}-${m.month}-${m.day}`;
              }catch{
                return new Date(Date.now()-4*3600000).toISOString().slice(0,10);
              }
            }
          
            function extract(payload, seen=new Set()){
              if(Array.isArray(payload)) return payload.filter(x=>x && typeof x==="object");
              if(!payload || typeof payload!=="object" || seen.has(payload)) return [];
              seen.add(payload);
          
              for(const key of ["games","jogos","matches","data","items","list","results","top","top6","quentes","mercados","opportunities"]){
                const v=payload[key];
                if(Array.isArray(v) && v.length) return v.filter(x=>x && typeof x==="object");
                if(v && typeof v==="object"){
                  const nested=extract(v,seen);
                  if(nested.length) return nested;
                }
              }
              return [];
            }
          
            function raw(g){ return g?.raw || g || {}; }
          
            function home(g){
              const r=raw(g);
              return clean(g?.home ?? g?.casa ?? r?.casa ?? r?.home ?? r?.match_hometeam_name ?? r?.event_home_team,"Casa");
            }
          
            function away(g){
              const r=raw(g);
              return clean(g?.away ?? g?.fora ?? r?.fora ?? r?.away ?? r?.match_awayteam_name ?? r?.event_away_team,"Fora");
            }
          
            function time(g){
              const r=raw(g);
              const s=clean(g?.time ?? g?.hora_manaus ?? g?.hora ?? r?.hora_manaus ?? r?.hora ?? r?.match_time ?? r?.event_time,"--:--");
              const m=s.match(/(\d{1,2}):(\d{2})/);
              return m ? `${m[1].padStart(2,"0")}:${m[2]}` : "--:--";
            }
          
            function key(g){
              const r=raw(g);
              return clean(
                g?.match_id ?? g?.event_id ?? g?.event_key ?? g?.fixture_id ?? g?.id ??
                r?.match_id ?? r?.event_id ?? r?.event_key ?? r?.fixture_id ?? r?.id,
                `${norm(home(g))}|${norm(away(g))}|${time(g)}`
              );
            }
          
            const CP_LEAGUE_NAMES = new Map([
              [152,"Premier League"],[302,"La Liga"],[175,"Bundesliga"],
              [207,"Serie A"],[168,"Ligue 1"],[244,"Eredivisie"],
              [266,"Primeira Liga"],[99,"Brasileirão Série A"],
              [18,"Libertadores"],[3,"Champions League"],[4,"Europa League"],
              [63,"Belgium First Division A"],[279,"Premiership"],[322,"Süper Lig"]
            ]);
    
            function validLeagueText(value){
              if(value && typeof value==="object"){
                value = value?.name ?? value?.league_name ?? "";
              }
              const s=clean(value,"");
              if(!s) return "";
              if(/^liga\s*(undefined|null|nan)?\s*$/i.test(s)) return "";
              if(/^(undefined|null|nan|\[object object\])$/i.test(s)) return "";
              return s;
            }
    
            function league(g){
              const r=raw(g);
              const er=r?.event_raw || g?.event_raw || {};
              const id=num(g?.league_id,r?.league_id,er?.league_id,er?.match_league_id);
    
              const candidates=[
                g?.liga,g?.league_name,g?.league,
                r?.liga,r?.league_name,r?.league,
                er?.league_name,er?.match_league_name,er?.league
              ];
    
              for(const candidate of candidates){
                const text=validLeagueText(candidate);
                if(text) return text;
              }
    
              return CP_LEAGUE_NAMES.get(Number(id)) || (id ? `Liga ${id}` : "Liga");
            }
    
            function country(g){
              const r=raw(g);
              const er=r?.event_raw || g?.event_raw || {};
              return clean(
                r?.country_name ?? r?.country ?? r?.league_country ??
                er?.country_name ?? er?.country ?? er?.league_country,
                ""
              );
            }

            /* V143 — FILTRO GLOBAL DE COMPETIÇÕES PRINCIPAIS (DESKTOP PRINCIPAL)
               Esta é a tela cpd3 usada pela tabela "IA / PROJEÇÃO".
               O filtro entra na fonte dos jogos, portanto vale para IA, TODOS,
               linhas manuais, hero e Aposta Pronta. */
            function cpMajorLeagueNorm(v){
              return String(v ?? "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            }

            function cpMajorLeagueId(g){
              const r=raw(g), er=r?.event_raw || g?.event_raw || {};
              return num(g?.league_id,r?.league_id,er?.league_id,er?.match_league_id);
            }

            function isMajorCompetitionD3(g){
              if(!g || typeof g!=="object") return false;
              const l=cpMajorLeagueNorm(league(g));
              const c=cpMajorLeagueNorm(country(g));
              const lid=Number(cpMajorLeagueId(g));

              // IDs já reconhecidos pelo próprio CornerPro.
              if([152,302,175,207,168,244,266,99,63,279,322].includes(lid)) return true;

              // Grandes torneios continentais.
              if([18,3,4].includes(lid)) return true;
              if(/champions league|europa league|conference league|libertadores|sudamericana/.test(l)) return true;

              // Primeiras divisões e ligas secundárias relevantes escolhidas para o projeto.
              if(/premier league/.test(l) && (!c || /england|inglaterra/.test(c))) return true;
              if(/championship/.test(l) && (!c || /england|inglaterra/.test(c))) return true;
              if(/la liga|laliga/.test(l)) return true;
              if(/bundesliga/.test(l) && !/2 bundesliga|3 liga/.test(l)) return true;
              if((/^serie a$|serie a tim|serie a enilive/.test(l)) && (!c || /italy|italia|brazil|brasil/.test(c))) return true;
              if(/ligue 1/.test(l)) return true;
              if(/liga portugal|primeira liga/.test(l)) return true;
              if(/eredivisie/.test(l)) return true;
              if(/jupiler pro league|first division a/.test(l) && (!c || /belgium|belgica/.test(c))) return true;
              if(/scottish premiership|premiership/.test(l) && /scotland|escocia/.test(c)) return true;
              if(/super lig/.test(l) && (!c || /turkey|turquia/.test(c))) return true;
              if(/brasileirao serie a|brasileirao/.test(l)) return true;
              if(/liga profesional/.test(l) && /argentina/.test(c)) return true;
              if(/major league soccer|mls/.test(l)) return true;

              // Bloqueio por padrão: 1st League, 2nd League, regionais, reservas, youth etc.
              return false;
            }
          
            function badge(g, side){
              const r=raw(g);
              const arr=side==="home"
                ? [r.home_badge,r.team_home_badge,r.home_team_badge,r.home_logo,r.home_team_logo,r.hometeam_logo,r.event_raw?.team_home_badge,r.event_raw?.home_badge]
                : [r.away_badge,r.team_away_badge,r.away_team_badge,r.away_logo,r.away_team_logo,r.awayteam_logo,r.event_raw?.team_away_badge,r.event_raw?.away_badge];
              return clean(arr.find(x=>/^https?:\/\//i.test(String(x||""))),"");
            }
          
            function decision(g, market=state.market){
              const r=raw(g);
              const field=market==="btts" ? "btts_ai" : `${market}_ai`;
              return r?.[field] || g?.[field] || {};
            }
          
            function confidence(g, market=state.market){
              if(["result","doublechance","teamgoals"].includes(market)){
                const r=raw(g);
                let x=num(market==="teamgoals"?r?.goals_ai?.confidence:null,r?.handicap_ai?.confidence,r?.goals_ai?.confidence,g?.confidence,r?.ai_score);
                if(x!==null && x>0 && x<=1) x*=100;
                return x===null?0:Math.max(0,Math.min(95,Math.round(x)));
              }
              let x=num(decision(g,market)?.confidence,g?.confidence,raw(g)?.ai_score);
              if(x!==null && x>0 && x<=1) x*=100;
              return x===null ? 0 : Math.max(0,Math.min(95,Math.round(x)));
            }
          
            function projection(g, market=state.market){
              const r=raw(g), d=decision(g,market);
              if(market==="corners") return num(d?.projection,r?.proj_cantos,r?.corners_projection,r?.expected_corners,r?.total_corners_avg);
              if(market==="goals") return num(d?.projection,r?.expected_goals_total,r?.goals_projection,r?.total_goals_avg);
              if(market==="cards") return num(d?.projection,r?.cards_projection,r?.proj_cards,r?.avg_cards,r?.media_cartoes);
              if(["result","doublechance","teamgoals"].includes(market)) return num(r?.goals_ai?.projection,r?.expected_goals_total,r?.goals_projection,r?.total_goals_avg);
              return num(d?.projection);
            }
          
            function average(g, market=state.market){
              const r=raw(g);
              if(market==="corners") return num(r?.media_combinada,r?.corner_avg,r?.corners_avg,r?.total_corners_avg,projection(g,market));
              if(market==="goals") return num(r?.goals_avg,r?.total_goals_avg,projection(g,market));
              if(market==="cards") return num(r?.cards_avg,r?.total_cards_avg,projection(g,market));
              return projection(g,market);
            }
          
            function lineText(g, market=state.market){
              return clean(decision(g,market)?.line,"").toUpperCase();
            }
            function gameStatus(g){
              const r=raw(g);
              const s=clean(g?.match_status ?? g?.status ?? r?.match_status ?? r?.status ?? r?.event_status ?? r?.event_raw?.match_status ?? r?.event_raw?.status,"").toLowerCase();
              const minute=num(g?.minute,r?.minute,r?.match_minute,r?.elapsed,r?.event_raw?.match_minute);
              const hs=num(g?.score_home,r?.score_home,r?.match_hometeam_score,r?.home_score,r?.event_raw?.match_hometeam_score);
              const as=num(g?.score_away,r?.score_away,r?.match_awayteam_score,r?.away_score,r?.event_raw?.match_awayteam_score);
              const finished=
                Boolean(g?.finished ?? r?.finished) ||
                /finished|full.?time|\bft\b|encerr|finaliz|ended|after extra|after pen|aet|penalties/.test(s);
        
              const halftime=
                !finished &&
                (
                  Boolean(g?.halftime ?? r?.halftime) ||
                  /half.?time|\bht\b|interval|break/.test(s)
                );
        
              const minuteFromStatus=(()=>{
                const m=s.match(/^(\d{1,3})(?:\+(\d{1,2}))?'?$/);
                if(!m) return null;
                return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
              })();
        
              const realMinute=minute!==null ? minute : minuteFromStatus;
              const live=
                !finished &&
                (
                  Boolean(g?.live ?? r?.live) ||
                  halftime ||
                  /live|ao vivo|1st|2nd|in play/.test(s) ||
                  (realMinute!==null&&realMinute>0)
                );
              let label="PRÉ-JOGO";
              if(finished) label="FIM";
              else if(halftime) label="INTERVALO";
              else if(live) label=realMinute?`AO VIVO • ${Math.round(realMinute)}'`:"AO VIVO";
              return {finished,halftime,live,label,minute:realMinute,hs,as};
            }
        
            function startLabel(g){
              const st=gameStatus(g);
              if(st.live||st.finished){
                const score=(st.hs!==null&&st.as!==null)?`${st.hs} × ${st.as}`:"";
                return `${st.label}${score?`<br><b>${score}</b>`:""}`;
              }
              return `Hoje<br><b>${esc(time(g))}</b>`;
            }
            function marketPickText(g,market=state.market){
              const r=raw(g);
              if(market==="result"){
                const s=norm(r?.handicap_ai?.side_key ?? r?.handicap_ai?.side ?? r?.oddsInfo?.fav?.side ?? "");
                if(s.includes("away")||s.includes("fora")) return "FORA";
                if(s.includes("home")||s.includes("casa")) return "CASA";
                return "1X2";
              }
              if(market==="doublechance"){
                const s=norm(r?.handicap_ai?.side_key ?? r?.handicap_ai?.side ?? "");
                if(s.includes("away")||s.includes("fora")) return "X2";
                if(s.includes("home")||s.includes("casa")) return "1X";
                return "12";
              }
              if(market==="teamgoals"){
                const side=state.sub==="away"?"FORA":state.sub==="home"?"CASA":"TIME";
                return `${side} OVER ${state.line==="TODOS"?"0.5":state.line}`;
              }
              return lineText(g,market);
            }
          
        
        
            function desktopCornersAiRecommendation(g){
              const d=decision(g,"corners");
              const serverLine=clean(d?.line,"").toUpperCase();
              const p=projection(g,"corners");
              const c=confidence(g,"corners");
        
              // Se o servidor já trouxe um OVER válido, respeita.
              if(/^OVER\s+(8\.5|9\.5|10\.5|11\.5|12\.5)$/.test(serverLine)){
                return {
                  valid:true,
                  line:serverLine,
                  projection:p,
                  confidence:c,
                  source:"server"
                };
              }
        
              // Fallback visual alinhado ao motor WEB dedicado.
              if(p!==null && Number.isFinite(Number(p))){
                const proj=Number(p);
        
                if(proj>=11.75) return {valid:true,line:"OVER 11.5",projection:proj,confidence:c,source:"projection"};
                if(proj>=10.75) return {valid:true,line:"OVER 10.5",projection:proj,confidence:c,source:"projection"};
                if(proj>=9.55)  return {valid:true,line:"OVER 9.5", projection:proj,confidence:c,source:"projection"};
              }
        
              return {
                valid:false,
                line:"SEM ENTRADA",
                projection:p,
                confidence:c,
                source:"none"
              };
            }
        
            function aiRecommendationText(g, market=state.market){
              const d=decision(g,market);
              let line=clean(d?.line,"").toUpperCase();
        
              if(market==="handicap"){
                const side=handicapSide(g);
                const teamName=clean(
                  d?.team,
                  side==="away" ? away(g) : side==="home" ? home(g) : ""
                );
                if(!line || line==="SEM APOSTA") return line || "—";
                return teamName ? `${teamName} ${line}` : line;
              }
        
              if(market==="btts"){
                if(!line) return "—";
                if(/NÃO|NAO|\bNO\b/.test(line)) return "AMBAS NÃO";
                if(/SIM|YES/.test(line)) return "AMBAS SIM";
                return line;
              }
        
              if(market==="corners"){
                return desktopCornersAiRecommendation(g).line;
              }
        
              if(["goals","cards"].includes(market)){
                return line || "—";
              }
        
              return marketPickText(g,market) || line || "—";
            }
        
            function handicapSide(g){
              const s=norm(decision(g,"handicap")?.side_key ?? decision(g,"handicap")?.side ?? "");
              if(s.includes("away")||s.includes("fora")) return "away";
              if(s.includes("home")||s.includes("casa")) return "home";
              return "all";
            }
          
            function unique(list){
              const seen=new Set();
              return (Array.isArray(list)?list:[]).filter(g=>{
                const k=String(key(g));
                if(seen.has(k)) return false;
                seen.add(k);
                return true;
              });
            }
          
            function mergeGame(base, extra){
              if(!base) return extra;
              if(!extra) return base;
    
              const br=raw(base), er=raw(extra);
    
              // Engines não podem apagar uma liga válida com "Liga undefined".
              const baseLeague=league(base);
              const extraLeague=league(extra);
              const finalLeague=
                validLeagueText(extraLeague) && !/^liga\s*$/i.test(extraLeague)
                  ? extraLeague
                  : baseLeague;
    
              const merged={
                ...base,
                ...extra,
                raw:{
                  ...br,
                  ...er,
                  markets:{...(br?.markets||{}),...(er?.markets||{})},
                  corners_ai:er?.corners_ai ?? br?.corners_ai,
                  goals_ai:er?.goals_ai ?? br?.goals_ai,
                  cards_ai:er?.cards_ai ?? br?.cards_ai,
                  btts_ai:er?.btts_ai ?? br?.btts_ai,
                  handicap_ai:er?.handicap_ai ?? br?.handicap_ai
                }
              };
    
              if(validLeagueText(finalLeague)){
                merged.liga=finalLeague;
                merged.raw.liga=finalLeague;
              }
    
              const finalLeagueId=num(extra?.league_id,er?.league_id,base?.league_id,br?.league_id);
              if(finalLeagueId!==null){
                merged.league_id=finalLeagueId;
                merged.raw.league_id=finalLeagueId;
              }
    
              return merged;
            }
    
            function mergeLists(base,incoming){
              const map=new Map();
              for(const g of (Array.isArray(base)?base:[])) map.set(String(key(g)),g);
              for(const g of (Array.isArray(incoming)?incoming:[])){
                const k=String(key(g));
                map.set(k,mergeGame(map.get(k),g));
              }
              return [...map.values()];
            }
          
        
            // WEB V14 — IA REAL DOS MERCADOS NO DESKTOP
            let __cpWebAiLoadToken = 0;
        
            function webEngineArray(payload, market){
              if(!payload || typeof payload!=="object") return [];
              const arr=extract(payload?.[market]);
              return Array.isArray(arr)?arr:[];
            }
        
            function applyWebEnginePayload(payload, sourceName="full", renderNow=true){
              if(!payload || typeof payload!=="object") return false;
              let changed=false;
              for(const market of ["corners","goals","cards","handicap","btts"]){
                const incoming=webEngineArray(payload,market);
                if(!incoming.length) continue;
        
                // A rota /web_corners_ai é a autoridade de cantos no desktop.
                // O /market_engines completo não pode sobrescrever sua decisão depois.
                if(
                  market==="corners" &&
                  sourceName==="full" &&
                  (state.engines.corners||[]).some(
                    game => Boolean(raw(game)?.corners_ai?.web_desktop_corners_ai)
                  )
                ){
                  continue;
                }
        
                state.engines[market]=mergeLists(state.engines[market]||[],incoming);
                changed=true;
              }
              if(changed && renderNow) render();
              console.info(`[Corner Pro WEB IA] ${sourceName}`,{
                corners:state.engines.corners.length,
                goals:state.engines.goals.length,
                cards:state.engines.cards.length,
                handicap:state.engines.handicap.length,
                btts:state.engines.btts.length
              });
              return changed;
            }
        
            async function webGetJson(url,timeoutMs=20000){
              const controller=new AbortController();
              const timer=setTimeout(()=>controller.abort(),timeoutMs);
              try{
                const response=await fetch(url,{
                  cache:"no-store",
                  signal:controller.signal,
                  headers:{"Accept":"application/json"}
                });
                if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
                return await response.json();
              }finally{ clearTimeout(timer); }
            }
        
            function loadDesktopAiEngines(date=todayManaus()){
              const token=++__cpWebAiLoadToken;
              const stamp=Date.now();
        
              // Escanteios WEB: motor dedicado com forma recente e linhas 8.5/9.5/10.5/11.5.
              webGetJson(`/web_corners_ai?date=${encodeURIComponent(date)}&_web=${stamp}&v=24`,30000)
                .then(payload=>{
                  if(token!==__cpWebAiLoadToken) return;
                  applyWebEnginePayload(payload,"corners-web");
                })
                .catch(err=>console.warn("[Corner Pro WEB IA corners]",err?.message||err));
        
              // Primeira decisão rápida para Ambas + Handicap.
              webGetJson(`/market_engines_fast?date=${encodeURIComponent(date)}&_web=${stamp}&v=60`,22000)
                .then(payload=>{
                  if(token!==__cpWebAiLoadToken) return;
                  applyWebEnginePayload(payload,"fast");
                })
                .catch(err=>console.warn("[Corner Pro WEB IA fast]",err?.message||err));
        
              // Motor completo para Escanteios, Gols, Cartões, Handicap e Ambas.
              webGetJson(`/market_engines?date=${encodeURIComponent(date)}&_web=${stamp}&v=60`,45000)
                .then(payload=>{
                  if(token!==__cpWebAiLoadToken) return;
                  applyWebEnginePayload(payload,"full");
                })
                .catch(err=>console.warn("[Corner Pro WEB IA full]",err?.message||err));
            }
        
            // WEB V22: o carregamento visual é centralizado em load().
        
            function source(){
              // V143: todas as telas desktop partem somente de competições principais.
              // O engine ainda injeta a IA no jogo correspondente, mas não consegue
              // reintroduzir uma liga pequena na interface.
              return mergeLists(state.games,state.engines[state.market]).filter(isMajorCompetitionD3);
            }
          
            function matchesLine(g){
              // A linha manual não deve zerar a tela.
              // A seleção real será feita por pontuação/ranking em list().
              if(state.line==="IA"){
                if(!["corners","goals","cards","handicap","btts"].includes(state.market)) return true;
                const d=decision(g,state.market);
                const line=clean(d?.line,"").toUpperCase();
                const pending=Boolean(d?.updating) ||
                  !line ||
                  line==="DADOS EM ATUALIZAÇÃO" ||
                  line==="ANALISANDO PARTIDA";
      
                if(state.market==="corners"){
                  return desktopCornersAiRecommendation(g).valid;
                }
      
                return !pending && !Boolean(d?.skip) && line!=="SEM APOSTA";
              }
      
              return true;
            }
      
            function matchesSub(g){
              if(state.market==="handicap" && ["home","away"].includes(state.sub)){
                const s=handicapSide(g);
                return !s || s==="all" || s===state.sub;
              }
      
              if(state.market==="cards" && ["home","away"].includes(state.sub)){
                const t=norm(lineText(g,"cards"));
                if(!t) return true;
                return state.sub==="home"
                  ? (t.includes("casa")||t.includes("home"))
                  : (t.includes("fora")||t.includes("away")||t.includes("visit"));
              }
      
              if(state.market==="btts" && state.sub==="yes"){
                const t=lineText(g,"btts");
                return !t || /(SIM|YES)/.test(t);
              }
      
              if(state.market==="btts" && state.sub==="no"){
                const t=lineText(g,"btts");
                return !t || /(NAO|NÃO|NO)/.test(t);
              }
      
              return true;
            }
      
            function manualLineNumber(){
              if(["IA","TODOS","SIM","NÃO","CASA","EMPATE","FORA","1X","12","X2"].includes(state.line)) return null;
              const n=Number(String(state.line).replace("+","").replace(",","."));
              return Number.isFinite(n) ? n : null;
            }
      
            function handicapLineNumber(g){
              const t=lineText(g,"handicap").replace(",",".");
              const m=t.match(/[+-]?\d+(?:\.\d+)?/);
              return m ? Number(m[0]) : null;
            }
      
            /* =========================================================
               WEB PC — IA ESPECÍFICA POR LINHA
               Cada botão passa a ter uma leitura própria. Primeiro usa
               probabilidades específicas vindas do servidor, quando existirem.
               Se a API não trouxer a probabilidade daquela linha, usa a projeção
               do motor como fallback estatístico (Poisson para mercados de contagem).
               ========================================================= */
            function clampPct(v){
              const n=Number(v);
              return Number.isFinite(n) ? Math.max(1,Math.min(95,n)) : null;
            }
      
            function directLineProbability(g, market, target){
              const r=raw(g), d=decision(g,market);
              const compact=String(target).replace(".","").replace("-","m").replace("+","p");
              const plain=String(target).replace(".","");
      
              const candidates=[];
              const push=(v)=>{ if(v!==undefined && v!==null && v!=="") candidates.push(v); };
      
              if(market==="corners"){
                push(d?.[`over${plain}_prob`]);
                push(d?.[`over_${plain}_prob`]);
                push(d?.[`p_over_${plain}`]);
                push(r?.[`over${plain}_prob`]);
                push(r?.[`over_${plain}_prob`]);
                push(r?.[`p_over_${plain}`]);
                push(r?.[`over${plain}Rate`]);
                push(r?.[`over${plain}_rate`]);
                push(r?.prob?.[`corners${plain}`]);
                push(r?.probability?.[`corners${plain}`]);
              }else if(market==="goals"){
                push(d?.[`over${plain}_prob`]);
                push(d?.[`over_${plain}_prob`]);
                push(r?.[`over${plain}_prob`]);
                push(r?.[`over_${plain}_prob`]);
                push(r?.[`prob_over${plain}`]);
                push(r?.[`prob_over_${plain}`]);
                push(r?.prob?.[`over${plain}`]);
              }else if(market==="cards"){
                push(d?.[`over${plain}_prob`]);
                push(d?.[`over_${plain}_prob`]);
                push(r?.[`over${plain}cards_prob`]);
                push(r?.[`over${plain}_cards_prob`]);
                push(r?.[`over${plain}_prob`]);
                push(r?.[`over_${plain}_prob`]);
              }else if(market==="handicap"){
                push(d?.lines?.[target]?.confidence);
                push(d?.probabilities?.[target]);
                push(r?.handicap_probabilities?.[target]);
                push(r?.[`handicap_${compact}_prob`]);
              }
      
              for(const value of candidates){
                let n=num(value);
                if(n===null) continue;
                if(n>0 && n<=1) n*=100;
                if(Number.isFinite(n)) return clampPct(n);
              }
              return null;
            }
      
            function poissonOverProbability(lambda,line){
              if(!Number.isFinite(lambda) || lambda<=0 || !Number.isFinite(line)) return null;
              const threshold=Math.floor(line)+1;
              let term=Math.exp(-lambda);
              let cdf=term;
              for(let k=1;k<threshold;k++){
                term*=lambda/k;
                cdf+=term;
              }
              return clampPct((1-cdf)*100);
            }
      
            function lineAnalysis(g, market=state.market, selectedLine=state.line){
              const baseConf=confidence(g,market) || 0;
      
              if(["IA","TODOS"].includes(selectedLine)){
                return {valid:true,probability:baseConf,pick:aiRecommendationText(g,market),source:"engine"};
              }
      
              if(["corners","goals","cards"].includes(market)){
                const target=Number(String(selectedLine).replace(",","."));
                const proj=projection(g,market);
                if(!Number.isFinite(target)) return {valid:false,probability:baseConf,pick:`OVER ${selectedLine}`,source:"none"};
      
                let prob=directLineProbability(g,market,target);
                let source="server-line";
                if(prob===null){
                  prob=poissonOverProbability(Number(proj),target);
                  source="projection-line";
                }
      
                // A confiança do motor atua como moderador, sem substituir a chance da linha.
                if(prob!==null && baseConf>0){
                  prob=clampPct(prob*0.78 + baseConf*0.22);
                }
      
                return {
                  valid:prob!==null,
                  probability:prob ?? Math.max(0,baseConf-25),
                  pick:`OVER ${selectedLine}`,
                  projection:proj,
                  margin:Number.isFinite(proj)?proj-target:null,
                  source
                };
              }
      
              if(market==="handicap"){
                const target=Number(String(selectedLine).replace("+","").replace(",","."));
                if(!Number.isFinite(target)){
                  return {valid:false,probability:0,pick:"—",source:"invalid-line",pickedSide:"all"};
                }
    
                const r=raw(g);
                const engineSide=handicapSide(g); // favorito/lado escolhido pela IA automática
                const markets=Array.isArray(r?.asian_handicap_markets)
                  ? r.asian_handicap_markets
                  : Array.isArray(g?.asian_handicap_markets)
                    ? g.asian_handicap_markets
                    : [];
    
                // Cada botão de Handicap passa a consultar a linha REAL daquele lado.
                // Ex.: -1.0 procura CASA -1.0 ou FORA -1.0; +1.0 procura CASA +1.0 ou FORA +1.0.
                const candidates=[];
                for(const item of markets){
                  const hl=Number(item?.home_line), al=Number(item?.away_line);
                  const ho=Number(item?.home_odd), ao=Number(item?.away_odd);
                  if(Number.isFinite(hl) && Math.abs(hl-target)<0.001 && Number.isFinite(ho) && ho>1){
                    candidates.push({side:"home",team:home(g),line:hl,odd:ho});
                  }
                  if(Number.isFinite(al) && Math.abs(al-target)<0.001 && Number.isFinite(ao) && ao>1){
                    candidates.push({side:"away",team:away(g),line:al,odd:ao});
                  }
                }
    
                // Se a API não trouxe a grade AH completa, ainda podemos usar a lista de
                // linhas do servidor, mas sem inventar uma confiança de 95%.
                const available=[
                  ...(Array.isArray(r?.handicap_available_lines)?r.handicap_available_lines:[]),
                  ...(Array.isArray(decision(g,"handicap")?.available_lines)?decision(g,"handicap").available_lines:[])
                ].map(v=>Number(String(v).replace("+","").replace(",","."))).filter(Number.isFinite);
    
                let chosen=null;
                if(candidates.length){
                  // Linha negativa/zero: buscamos o lado forte indicado pela IA.
                  // Linha positiva: buscamos o lado protegido (normalmente o adversário do favorito).
                  const preferredSide = target>0
                    ? (engineSide==="home"?"away":engineSide==="away"?"home":"all")
                    : engineSide;
    
                  candidates.sort((a,b)=>{
                    const ap = a.side===preferredSide ? 1 : 0;
                    const bp = b.side===preferredSide ? 1 : 0;
                    if(bp!==ap) return bp-ap;
                    // Na mesma linha, odd menor representa maior probabilidade implícita.
                    return a.odd-b.odd;
                  });
                  chosen=candidates[0];
                }
    
                if(!chosen){
                  const lineExists=available.some(v=>Math.abs(v-target)<0.001);
    
                  // V3: não zera a lista quando a API não publica a grade AH completa.
                  // A linha exata continua tendo prioridade quando existe; quando não existe,
                  // usamos a força do motor para ESTIMAR a adequação da linha escolhida.
                  // Isso mantém os jogos visíveis e ainda permite listas diferentes por linha.
                  const fallbackSide = target>0
                    ? (engineSide==="home"?"away":engineSide==="away"?"home":"all")
                    : engineSide;
                  if(fallbackSide==="all"){
                    return {valid:false,probability:0,pick:"—",source:"side-unavailable",pickedSide:"all"};
                  }
                  chosen={
                    side:fallbackSide,
                    team:fallbackSide==="home"?home(g):away(g),
                    line:target,
                    odd:null,
                    estimated:!lineExists
                  };
                }
    
                // Confiança específica da linha. Não aumenta todos os jogos para 95% só
                // porque o handicap ficou positivo. Em + linhas, valorizamos jogos mais
                // equilibrados; em - linhas, favoritos realmente fortes.
                let prob;
                if(target>0){
                  // Handicap positivo protege o lado oposto ao favorito.
                  // Quanto mais dominante o favorito automático, MENOR a confiança no protegido.
                  // Isso faz +0.5/+1.0/+1.5 terem ranking próprio, em vez de repetir -1.0.
                  prob = 72 - Math.max(0, baseConf-50)*0.42 + Math.min(2, target)*4;
                }else if(target<0){
                  // Handicap negativo exige domínio do favorito; linhas mais agressivas penalizam.
                  const aggression=Math.abs(target);
                  prob = baseConf - Math.max(0, aggression-0.5)*11;
                }else{
                  prob = baseConf;
                }
    
                if(Number.isFinite(chosen.odd)){
                  const implied=100/chosen.odd;
                  prob = prob*0.72 + implied*0.28;
                }
                prob=clampPct(prob) ?? 0;
    
                const signed=target>0?`+${target.toFixed(1)}`:target.toFixed(1);
                return {
                  valid:prob>=48,
                  probability:prob,
                  pick:`${chosen.team} ${signed}`,
                  source:Number.isFinite(chosen.odd)
                    ? "real-ah-line"
                    : chosen.estimated
                      ? "estimated-ah-line"
                      : "available-line",
                  pickedSide:chosen.side,
                  marketOdd:Number.isFinite(chosen.odd)?chosen.odd:null
                };
              }
      
              if(market==="btts"){
                const d=lineText(g,"btts");
                const wantsYes=selectedLine==="SIM";
                const agrees=wantsYes
                  ? /(SIM|YES)/.test(d) && !/(NAO|NÃO|NO)/.test(d)
                  : /(NAO|NÃO|NO)/.test(d);
                const prob=clampPct(agrees ? baseConf : (baseConf ? 100-baseConf : 45));
                return {valid:true,probability:prob,pick:wantsYes?"AMBAS SIM":"AMBAS NÃO",source:"engine-side"};
              }
      
              return {valid:true,probability:baseConf,pick:marketPickText(g,market),source:"engine"};
            }
      
            function activeConfidence(g){
              if(state.line!=="IA" && state.line!=="TODOS" && ["corners","goals","cards","handicap","btts"].includes(state.market)){
                return Math.round(lineAnalysis(g,state.market,state.line).probability || 0);
              }
              return confidence(g,state.market);
            }
      
            function teamGoalsProjection(g){
              const r=raw(g);
              const hp=num(
                r?.home_goals_projection,r?.projected_home_goals,r?.expected_home_goals,
                r?.goals_ai?.home_projection,r?.goals_ai?.home
              );
              const ap=num(
                r?.away_goals_projection,r?.projected_away_goals,r?.expected_away_goals,
                r?.goals_ai?.away_projection,r?.goals_ai?.away
              );
      
              if(state.sub==="home") return hp;
              if(state.sub==="away") return ap;
              if(Number.isFinite(hp) && Number.isFinite(ap)) return Math.max(hp,ap);
              return Number.isFinite(hp) ? hp : ap;
            }
      
            function marketSuitability(g){
              const conf=confidence(g,state.market) || 0;
      
              // IA mantém a lógica do próprio motor.
              if(state.line==="IA") return conf;
      
              if(state.market==="corners" || state.market==="goals" || state.market==="cards"){
                const analysis=lineAnalysis(g,state.market,state.line);
                const p=projection(g,state.market);
                const margin=Number.isFinite(analysis.margin)?analysis.margin:0;
                // Ranking agora é específico da linha escolhida: chance da linha primeiro,
                // projeção/margem apenas como desempate.
                return (analysis.probability||0)*2 + margin*6 + (Number.isFinite(p)?p:0);
              }
      
              if(state.market==="handicap"){
                const side=handicapSide(g);
                let score=lineAnalysis(g,"handicap",state.line).probability || conf;
      
                if(state.sub==="home"){
                  if(side==="home") score+=18;
                  else if(side==="away") score-=28;
                }else if(state.sub==="away"){
                  if(side==="away") score+=18;
                  else if(side==="home") score-=28;
                }
      
                return score;
              }
      
              if(state.market==="btts"){
                const t=lineText(g,"btts");
                let score=conf;
                if(state.line==="SIM"){
                  if(/(SIM|YES)/.test(t) && !/(NAO|NÃO|NO)/.test(t)) score+=70;
                  else if(t) score-=50;
                }else if(state.line==="NÃO"){
                  if(/(NAO|NÃO|NO)/.test(t)) score+=70;
                  else if(t) score-=50;
                }
                return score;
              }
      
              if(state.market==="result"){
                const pick=clean(marketPickText(g,"result"),"").toUpperCase();
                return conf + (state.line==="TODOS" ? 0 : pick===state.line ? 80 : -30);
              }
      
              if(state.market==="doublechance"){
                const pick=clean(marketPickText(g,"doublechance"),"").toUpperCase();
                return conf + (state.line==="TODOS" ? 0 : pick===state.line ? 80 : -30);
              }
      
              if(state.market==="teamgoals"){
                const target=manualLineNumber();
                const p=teamGoalsProjection(g);
                if(target===null) return conf + (Number.isFinite(p)?p*5:0);
                if(!Number.isFinite(p)) return conf-25;
                return conf + (p-target)*22 + p*3;
              }
      
              return conf;
            }
      
            function list(){
              // No Handicap manual, o lado (CASA/FORA) depende da linha clicada.
              // Portanto não aplicamos matchesSub usando o lado da IA automática antes
              // de calcular a recomendação específica da linha.
              const rawBase=unique(source());
              const base=(state.market==="handicap" && !["IA","TODOS"].includes(state.line))
                ? rawBase
                : rawBase.filter(matchesSub);
      
              // IA: mantém filtro específico existente.
              if(state.line==="IA"){
                return base
                  .filter(matchesLine)
                  .sort((a,b)=>marketSuitability(b)-marketSuitability(a) || time(a).localeCompare(time(b)));
              }
      
              // TODOS: ordenação padrão do mercado.
              if(state.line==="TODOS"){
                return base.sort((a,b)=>
                  confidence(b,state.market)-confidence(a,state.market) ||
                  (projection(b,state.market)||0)-(projection(a,state.market)||0) ||
                  time(a).localeCompare(time(b))
                );
              }
      
              // HANDICAP MANUAL: cada linha forma uma lista própria.
              // Só entram partidas em que a linha existe/é válida e CASA/FORA é aplicado
              // ao lado escolhido especificamente para aquela linha.
              if(state.market==="handicap"){
                const analyzed=base
                  .map(g=>({g,a:lineAnalysis(g,"handicap",state.line)}))
                  .filter(x=>state.sub==="all" || x.a.pickedSide===state.sub)
                  .sort((x,y)=>
                    (y.a.probability||0)-(x.a.probability||0) ||
                    time(x.g).localeCompare(time(y.g))
                  );
    
                const valid=analyzed.filter(x=>x.a.valid);
    
                // Se houver recomendações válidas, usa-as. Se a API não trouxe linhas AH
                // suficientes naquele dia, mantém os jogos analisáveis em vez de mostrar 0.
                const selected=valid.length ? valid : analyzed.filter(x=>x.a.pickedSide!=="all");
                return selected.map(x=>x.g);
              }
    
              // DEMAIS LINHAS MANUAIS:
              return base.sort((a,b)=>
                marketSuitability(b)-marketSuitability(a) ||
                time(a).localeCompare(time(b))
              );
            }
      
            function initials(name){
              return clean(name,"T").split(/\s+/).slice(0,2).map(p=>p[0]).join("").toUpperCase();
            }
          
            function badgeHtml(g,side,mini=false){
              const url=badge(g,side);
              const name=side==="home"?home(g):away(g);
              const cls=mini?"cpd3MiniBadge":"cpd3HeroBadge";
          
              if(url){
                return `<div class="${cls}"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i hidden>${esc(initials(name))}</i></div>`;
              }
              return `<div class="${cls}"><i>${esc(initials(name))}</i></div>`;
            }
          
            function saveFav(){
              try{localStorage.setItem("cornerProFavorites",JSON.stringify([...state.favorites]));}catch{}
            }
          
            function toggleFav(name){
              const k=norm(name);
              if(!k) return;
              state.favorites.has(k)?state.favorites.delete(k):state.favorites.add(k);
              saveFav();
            }
          
            function renderControls(){
              const c=MARKET[state.market];
              if(!c) return;
          
              const top=$("#cpd3TopTitle");
              const sub=$("#cpd3SubNav");
              const lines=$("#cpd3LineNav");
          
              if(top) top.textContent=`MELHOR APOSTA • ${c.label}`;
              if(sub) sub.innerHTML=c.subs.map(([label,value])=>`<button type="button" data-cpd3-sub="${value}" class="${state.sub===value?"active":""}">${label}</button>`).join("");
              if(lines) lines.innerHTML=c.lines.map(line=>`<button type="button" data-cpd3-line="${esc(line)}" class="${state.line===line?"active":""}">${esc(line)}</button>`).join("");
          
              $$("[data-cpd3-market]").forEach(btn=>{
                btn.hidden=false;
                btn.disabled=false;
                btn.classList.toggle("active",btn.dataset.cpd3Market===state.market);
              });
            }
          
            /* =========================================================
               SITE/DESKTOP — TRAVA DO "OURO" DE ESCANTEIOS
               O primeiro Top 1 válido da IA do dia vira a escolha oficial.
               Renderizações posteriores, refresh de status e motores auxiliares
               podem atualizar placar/minuto/dados, mas NÃO trocam o jogo.
               Exclusivo do desktop e do mercado Escanteios + IA.
               ========================================================= */
            const CP_DESKTOP_GOLD_LOCK_PREFIX = "cornerProDesktopGold:v7:";

            function cpDesktopGoldDate(){
              const v = $("#date")?.value;
              return /^\d{4}-\d{2}-\d{2}$/.test(String(v||"")) ? String(v) : todayManaus();
            }

            function cpDesktopGoldStorageKey(){
              return CP_DESKTOP_GOLD_LOCK_PREFIX + cpDesktopGoldDate();
            }

            function cpReadDesktopGold(){
              try{
                const x = JSON.parse(localStorage.getItem(cpDesktopGoldStorageKey()) || "null");
                return x && x.game ? x : null;
              }catch(_){
                return null;
              }
            }

            function cpWriteDesktopGold(game){
              if(!game) return;
              try{
                localStorage.setItem(cpDesktopGoldStorageKey(), JSON.stringify({
                  date: cpDesktopGoldDate(),
                  lockedAt: new Date().toISOString(),
                  game
                }));
              }catch(e){
                console.warn("[CornerPro Gold Lock] não foi possível salvar", e);
              }
            }

            function cpGoldGameFromCurrentData(savedGame){
              if(!savedGame) return null;
              const savedKey = String(key(savedGame));
              const pools = [
                ...(Array.isArray(state.games) ? state.games : []),
                ...(Array.isArray(state.engines?.corners) ? state.engines.corners : [])
              ];
              const current = pools.find(x => String(key(x)) === savedKey);
              if(!current) return savedGame;

              // Preserva a decisão inicial do Ouro, mas deixa status/placar atualizarem.
              const savedRaw = raw(savedGame);
              const currentRaw = raw(current);
              return {
                ...savedGame,
                ...current,
                corners_ai: savedGame?.corners_ai ?? savedRaw?.corners_ai ?? current?.corners_ai,
                raw: {
                  ...savedRaw,
                  ...currentRaw,
                  corners_ai: savedRaw?.corners_ai ?? savedGame?.corners_ai ?? currentRaw?.corners_ai
                }
              };
            }

            function cpResolveDesktopGold(candidate){
              if(state.market !== "corners" || state.line !== "IA") return candidate;

              const locked = cpReadDesktopGold();
              if(locked?.game){
                const lockedGame = cpGoldGameFromCurrentData(locked.game);
                if(isMajorCompetitionD3(lockedGame)) return lockedGame;
                // Remove Ouro antigo salvo de uma liga que agora é bloqueada.
                try{ localStorage.removeItem(cpDesktopGoldStorageKey()); }catch(_){}
              }

              if(!candidate) return candidate;

              // Só congela quando a IA realmente aprovou o jogo de escanteios.
              let valid = false;
              try{
                valid = Boolean(desktopCornersAiRecommendation(candidate)?.valid);
              }catch(_){
                valid = false;
              }

              if(valid){
                cpWriteDesktopGold(candidate);
              }

              return candidate;
            }

            function setHero(g){
              if(!g){
                const recommended=list()[0];
                if(state.line==="IA" && ["corners","goals","cards","handicap","btts"].includes(state.market)){
                  g=recommended || state.hero || null;
                }else{
                  g=recommended || source()[0] || null;
                }
              }

              // Aqui está a correção do bug: qualquer segundo/terceiro render
              // recebe novamente o Ouro original do dia.
              g = cpResolveDesktopGold(g);

              if(!g) return;
              state.hero=g;
          
              const hn=$("#cpd3HomeName"), an=$("#cpd3AwayName"), kl=$("#cpd3KickLabel"), clock=$("#cpd3Clock");
              const st=gameStatus(g);
              if(hn) hn.textContent=home(g);
              if(an) an.textContent=away(g);
        
              if(kl){
                if(st.finished){
                  kl.textContent=(st.hs!==null&&st.as!==null) ? `PLACAR FINAL • ${st.hs} × ${st.as}` : "PARTIDA ENCERRADA";
                }else if(st.halftime){
                  kl.textContent=(st.hs!==null&&st.as!==null) ? `INTERVALO • ${st.hs} × ${st.as}` : "INTERVALO";
                }else if(st.live){
                  kl.textContent=(st.hs!==null&&st.as!==null) ? `PLACAR • ${st.hs} × ${st.as}` : "PARTIDA EM ANDAMENTO";
                }else{
                  kl.textContent=`COMEÇA ÀS ${time(g)}`;
                }
              }
        
              if(clock){
                if(st.finished) clock.textContent="FIM";
                else if(st.halftime) clock.textContent="INTERVALO";
                else if(st.live) clock.textContent=st.minute ? `${Math.round(st.minute)}' • AO VIVO` : "AO VIVO";
                else clock.textContent="PRÉ-JOGO";
              }
        
              const hb=$("#cpd3HomeBadge"), ab=$("#cpd3AwayBadge");
              if(hb) hb.outerHTML=badgeHtml(g,"home").replace('class="cpd3HeroBadge"','class="cpd3HeroBadge" id="cpd3HomeBadge"');
              if(ab) ab.outerHTML=badgeHtml(g,"away").replace('class="cpd3HeroBadge"','class="cpd3HeroBadge" id="cpd3AwayBadge"');
          
              $$("[data-cpd3-hero-fav]").forEach(btn=>{
                const name=btn.dataset.cpd3HeroFav==="home"?home(g):away(g);
                const active=state.favorites.has(norm(name));
                btn.textContent=active?"★":"☆";
                btn.classList.toggle("active",active);
              });
            }
          
            function title(){
              const c=MARKET[state.market];
              if(state.market==="builder") return "⚡ APOSTA PRONTA • MAIOR CONFIANÇA DISPONÍVEL";
              if(state.line==="IA" && ["corners","goals","cards","handicap","btts"].includes(state.market)){
                if(state.market==="corners"){
                  return `✦ IA • LINHA AUTOMÁTICA 9.5+ • FORMA RECENTE DE CANTOS`;
                }
                return `✦ IA • LINHA ESCOLHIDA AUTOMATICAMENTE • ${c.label}`;
              }
              if(state.market==="btts") return `${state.line==="TODOS"?"AMBAS MARCAM":state.line} • TODOS OS JOGOS`;
              if(state.market==="result"||state.market==="doublechance") return `${c.label}${state.line==="TODOS"?"":` • ${state.line}`} • TODOS OS JOGOS`;
              if(state.market==="teamgoals"){
                const side=state.sub==="home"?"CASA":state.sub==="away"?"FORA":"TODOS";
                return `${c.label} • ${side}${state.line==="TODOS"?"":` • OVER ${state.line}`}`;
              }
              if(state.market==="handicap"){
                const side=state.sub==="home"?" • CASA":state.sub==="away"?" • FORA":"";
                return `${c.label}${state.line==="TODOS"?"":` ${state.line}`}${side} • TODOS OS JOGOS`;
              }
              if(state.line!=="TODOS" && ["corners","goals","cards"].includes(state.market))
                return `✦ IA DA LINHA • OVER ${state.line} ${c.label} • RANKING ESPECÍFICO`;
              return `${state.line==="TODOS"?c.label:`OVER ${state.line} ${c.label}`} • TODOS OS JOGOS`;
            }
        
            function row(g){
              const p=projection(g), a=average(g), c=activeConfidence(g), gid=key(g);
              const h=home(g), aw=away(g);
              const manualAnalysis=(state.line!=="IA" && state.line!=="TODOS" && ["corners","goals","cards","handicap","btts"].includes(state.market))
                ? lineAnalysis(g,state.market,state.line)
                : null;
          
              return `<div class="cpd3Row" data-cpd3-game="${esc(gid)}">
                <div class="cpd3MatchCell">
                  ${badgeHtml(g,"home",true)}
                  <div class="cpd3Names">
                    <div><b>${esc(h)}</b><button class="cpd3Fav ${state.favorites.has(norm(h))?"active":""}" data-cpd3-fav="home" data-id="${esc(gid)}">${state.favorites.has(norm(h))?"★":"☆"}</button></div>
                    <div><b>${esc(aw)}</b><button class="cpd3Fav ${state.favorites.has(norm(aw))?"active":""}" data-cpd3-fav="away" data-id="${esc(gid)}">${state.favorites.has(norm(aw))?"★":"☆"}</button></div>
                  </div>
                  ${badgeHtml(g,"away",true)}
                </div>
                <div class="cpd3League"><b>${esc(league(g))}</b><small>${esc(country(g))}</small></div>
                <div class="cpd3Start ${gameStatus(g).live?"is-live":gameStatus(g).finished?"is-finished":""}">${startLabel(g)}</div>
                <div class="cpd3Num">${
                  state.line==="IA" && ["corners","goals","cards","handicap","btts"].includes(state.market)
                    ? `<span class="cpd3AiPickWrap">
                         <span class="cpd3AiPickBadge">${esc(aiRecommendationText(g,state.market))}</span>
                         ${
                           p!==null && ["corners","goals","cards"].includes(state.market)
                             ? `<small class="cpd3AiProjection">${
                                 state.market==="corners"
                                   ? `Proj. ${p.toFixed(1)} cantos`
                                   : state.market==="goals"
                                     ? `Proj. ${p.toFixed(1)} gols`
                                     : `Proj. ${p.toFixed(1)} cartões`
                               }</small>`
                             : ""
                         }
                       </span>`
                    : manualAnalysis
                      ? `<span class="cpd3AiPickWrap">
                           <span class="cpd3AiPickBadge">${esc(manualAnalysis.pick)}</span>
                           <small class="cpd3AiProjection">IA DA LINHA • ${Math.round(manualAnalysis.probability||0)}%</small>
                         </span>`
                      : ["result","doublechance","teamgoals"].includes(state.market)
                        ? `<span class="cpd3PickBadge">${esc(marketPickText(g))}</span>`
                        : (p===null?"—":p.toFixed(1))
                }</div>
                <div class="cpd3Num">${a===null?"—":a.toFixed(1)}</div>
                <div class="cpd3Confidence">${c?`${c}%`:"—"}</div>
                <div class="cpd3Trend"><i>☁</i><b>${c>=68?"ALTA":c>=55?"MÉDIA":"BAIXA"}</b></div>
                <button type="button" class="cpd3Analyze" data-cpd3-open="${esc(gid)}">Ver análise</button>
              </div>`;
            }
          
            function render(){
              if(!$("#cpDesktopExperienceV3")) return;
          
              renderControls();
          
              const rows=$("#cpd3Rows");
              const titleEl=$("#cpd3ResultsTitle");
              const more=$("#cpd3More");
              const games=list();
        
              const tableHead=$("#cpd3TableHead");
              if(tableHead){
                const cols=$$("span",tableHead);
                if(cols[3]){
                  cols[3].textContent =
                    state.line==="IA" && ["corners","goals","cards","handicap","btts"].includes(state.market)
                      ? "IA / PROJEÇÃO"
                      : "PROJEÇÃO";
                }
              }
        
              if(state.market==="builder"){
                if(titleEl) titleEl.textContent=title();
                if(!rows) return;
                const pool=unique(state.games).filter(isMajorCompetitionD3).filter(g=>!gameStatus(g).finished);
                const picks=[];
                for(const [mk,label] of [["corners","Escanteios"],["goals","Gols"],["btts","Ambas marcam"],["handicap","Handicap"]]){
                  const best=pool.slice().sort((a,b)=>confidence(b,mk)-confidence(a,mk)).find(g=>confidence(g,mk)>=55);
                  if(best){
                    const d=decision(best,mk);
                    picks.push({g:best,mk,label,conf:confidence(best,mk),pick:clean(d?.line,label)});
                  }
                }
                picks.sort((a,b)=>b.conf-a.conf);
                const chosen=picks.slice(0,3);
                rows.innerHTML=chosen.length?`<div class="cpd3Builder">
                  <div class="cpd3BuilderHero"><span>⚡</span><div><strong>APOSTA PRONTA IA</strong><small>Maiores confianças disponíveis nos dados atuais. Não existe aposta garantida.</small></div></div>
                  ${chosen.map(x=>`<article class="cpd3BuilderPick">
                    <div>${badgeHtml(x.g,"home",true)}<b>${esc(home(x.g))} × ${esc(away(x.g))}</b>${badgeHtml(x.g,"away",true)}</div>
                    <small>${esc(x.label)}</small><strong>${esc(x.pick)}</strong><em>${x.conf}% confiança</em>
                    <button type="button" data-cpd3-open="${esc(key(x.g))}">Ver análise</button>
                  </article>`).join("")}
                </div>`:'<div class="cpd3Empty">Ainda não há dados suficientes para montar uma aposta pronta.</div>';
                if(more) more.hidden=true;
                if(chosen[0]) setHero(chosen[0].g);
                state.loading=false;
                return;
              }
          
              if(titleEl) titleEl.textContent=`${title()} • ${games.length} JOGOS`;
              if(!rows) return;
          
              if(games.length){
                rows.innerHTML=games.slice(0,state.limit).map(row).join("");
                if(more) more.hidden=games.length<=state.limit;
                setHero(games[0]);
                state.loading=false;
                return;
              }
          
              if(state.games.length){
                rows.innerHTML='<div class="cpd3Empty">Nenhum jogo disponível para esta seleção neste momento.</div>';
                if(more) more.hidden=true;
                setHero(state.games[0]);
                state.loading=false;
                return;
              }
          
              if(!state.loading){
                rows.innerHTML='<div class="cpd3Empty">Nenhum jogo disponível para hoje.</div>';
                if(more) more.hidden=true;
              }
            }
          
            function findGame(gid){
              return source().find(g=>String(key(g))===String(gid));
            }
          
            async function getJson(url,timeout=20000){
              const controller=new AbortController();
              const timer=setTimeout(()=>controller.abort(),timeout);
          
              try{
                const r=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
                if(!r.ok) throw new Error(`HTTP ${r.status}`);
                const text=await r.text();
                return JSON.parse(text);
              }finally{
                clearTimeout(timer);
              }
            }
          
            function applyBase(payload, renderNow=true){
              const arr=extract(payload);
              if(!arr.length) return false;
        
              state.games=mergeLists(state.games,arr);
              window.__cornerProAllGames=state.games.slice();
              if(renderNow) render();
              return true;
            }
          
            function applyLiveStatus(payload){
              const liveRows=Array.isArray(payload?.games) ? payload.games : [];
              if(!liveRows.length) return false;
        
              const byId=new Map(
                liveRows
                  .map(item=>[String(item?.match_id ?? ""),item])
                  .filter(([id])=>id)
              );
        
              let changed=false;
        
              state.games=state.games.map(game=>{
                const gid=String(key(game));
                const live=byId.get(gid);
                if(!live) return game;
        
                const r=raw(game);
        
                changed=true;
        
                return {
                  ...game,
                  match_status: live.match_status ?? live.status ?? game?.match_status,
                  status: live.status ?? live.match_status ?? game?.status,
                  minute: live.minute ?? game?.minute,
                  live: Boolean(live.live),
                  halftime: Boolean(live.halftime),
                  finished: Boolean(live.finished),
                  score_home: live.score_home ?? game?.score_home,
                  score_away: live.score_away ?? game?.score_away,
                  raw:{
                    ...r,
                    match_status: live.match_status ?? live.status ?? r?.match_status,
                    status: live.status ?? live.match_status ?? r?.status,
                    minute: live.minute ?? r?.minute,
                    match_minute: live.minute ?? r?.match_minute,
                    elapsed: live.minute ?? r?.elapsed,
                    live: Boolean(live.live),
                    halftime: Boolean(live.halftime),
                    finished: Boolean(live.finished),
                    score_home: live.score_home ?? r?.score_home,
                    score_away: live.score_away ?? r?.score_away,
                    match_hometeam_score: live.score_home ?? r?.match_hometeam_score,
                    match_awayteam_score: live.score_away ?? r?.match_awayteam_score,
                    event_raw:{
                      ...(r?.event_raw || {}),
                      match_status: live.match_status ?? live.status ?? r?.event_raw?.match_status,
                      status: live.status ?? live.match_status ?? r?.event_raw?.status,
                      match_minute: live.minute ?? r?.event_raw?.match_minute,
                      match_hometeam_score: live.score_home ?? r?.event_raw?.match_hometeam_score,
                      match_awayteam_score: live.score_away ?? r?.event_raw?.match_awayteam_score
                    }
                  }
                };
              });
        
              if(changed){
                window.__cornerProAllGames=state.games.slice();
                render();
              }
        
              return changed;
            }
        
            function applyEngines(payload){
              if(!payload || typeof payload!=="object") return false;
              let changed=false;
          
              for(const market of ["corners","goals","cards","handicap","btts"]){
                const arr=Array.isArray(payload[market])?payload[market]:extract(payload[market]);
                if(!arr.length) continue;
          
                state.engines[market]=mergeLists(state.engines[market],arr);
                state.games=mergeLists(state.games,arr);
                changed=true;
              }
          
              if(changed){
                window.__cornerProAllGames=state.games.slice();
                render();
              }
          
              return changed;
            }
          
            async function load(){
              renderControls();
        
              const rows=$("#cpd3Rows");
              if(rows){
                rows.innerHTML='<div class="cpd3Loading">CARREGANDO JOGOS E ANÁLISE DA IA...</div>';
              }
        
              const inputDate=$("#date")?.value;
              const urlDate=new URLSearchParams(window.location.search).get("date");
              const date=/^\d{4}-\d{2}-\d{2}$/.test(String(inputDate||""))
                ? String(inputDate)
                : /^\d{4}-\d{2}-\d{2}$/.test(String(urlDate||""))
                  ? String(urlDate)
                  : todayManaus();

              if($("#date")) $("#date").value=date;

              // DESKTOP DATA FIX — reaproveita cache somente da MESMA data.
              if(
                window.__cornerProAllGamesDate === date &&
                Array.isArray(window.__cornerProAllGames) &&
                window.__cornerProAllGames.length
              ){
                state.games=mergeLists(state.games,window.__cornerProAllGames);
              }

              const requestDate=date;
              const requestToken=(state.__desktopDateRequestToken||0)+1;
              state.__desktopDateRequestToken=requestToken;
              const stamp=Date.now();
        
              // 1) Jogos-base, silencioso.
              try{
                const payload=await getJson(
                  `/mercados?date=${encodeURIComponent(date)}&_webv22=${stamp}`,
                  24000
                );
                if(
                  state.__desktopDateRequestToken!==requestToken ||
                  ($("#date")?.value||"")!==requestDate
                ) return;
                applyBase(payload,false);
              }catch(err){
                console.warn("[CP WEB V22 /mercados]",err?.message||err);
              }
        
              if(!state.games.length){
                try{
                  const payload=await getJson(
                    `/quentes?date=${encodeURIComponent(date)}&mobile=1&_mobile=${stamp}&ai=0&onlyTop=0&v=39`,
                    16000
                  );
                  if(
                    state.__desktopDateRequestToken!==requestToken ||
                    ($("#date")?.value||"")!==requestDate
                  ) return;
                  applyBase(payload,false);
                }catch(err){
                  console.warn("[CP WEB V22 /quentes]",err?.message||err);
                }
              }
        
              // 2) IA de cantos: espera terminar antes de exibir a tabela.
              try{
                const cornersPayload=await webGetJson(
                  `/web_corners_ai?date=${encodeURIComponent(date)}&_web=${stamp}&v=24`,
                  33000
                );
                if(
                  state.__desktopDateRequestToken!==requestToken ||
                  ($("#date")?.value||"")!==requestDate
                ) return;
                applyWebEnginePayload(cornersPayload,"corners-web",false);
              }catch(err){
                console.warn("[CP WEB V22 corners IA]",err?.message||err);
              }
        
              state.loading=false;
        
              // ÚNICA renderização inicial: jogos + IA já prontos.
              render();
        
              // 3) Outros motores são pré-carregados em memória, sem redesenhar a tela.
              Promise.allSettled([
                webGetJson(
                  `/market_engines_fast?date=${encodeURIComponent(date)}&_web=${stamp}&v=60`,
                  24000
                ).then(payload=>{
                  if(
                    state.__desktopDateRequestToken!==requestToken ||
                    ($("#date")?.value||"")!==requestDate
                  ) return;
                  applyWebEnginePayload(payload,"fast",false);
                }),
                webGetJson(
                  `/market_engines?date=${encodeURIComponent(date)}&_web=${stamp}&v=60`,
                  60000
                ).then(payload=>{
                  if(
                    state.__desktopDateRequestToken!==requestToken ||
                    ($("#date")?.value||"")!==requestDate
                  ) return;
                  applyWebEnginePayload(payload,"full",false);
                })
              ]).then(()=>{
                console.info("[Corner Pro WEB V22] motores secundários prontos");
              });
        
              // Removida a ponte antiga de 1 segundo que re-renderizava e
              // podia trocar a decisão exibida depois do primeiro carregamento.
            }
        
            async function reloadDesktopDate(ymd){
              if(!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd||""))) return;
        
              const input=$("#date");
              if(input) input.value=ymd;
        
              // Limpa somente o estado/cache DESKTOP da data anterior.
              // Não toca no app/mobile nem nas imagens/escudos dos times.
              state.games=[];
              window.__cornerProAllGames=[];
              window.__cornerProAllGamesDate="";
              state.__desktopDateRequestToken=(state.__desktopDateRequestToken||0)+1;
              state.engines={
                corners:[],
                goals:[],
                cards:[],
                handicap:[],
                btts:[],
                result:[],
                doublechance:[],
                teamgoals:[]
              };
              state.hero=null;
              state.loading=true;
              state.limit=8;
        
              // Atualiza a URL sem recarregar a página.
              try{
                const url=new URL(window.location.href);
                url.searchParams.delete("data");
                url.searchParams.set("date",ymd);
                history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
              }catch(_){}
        
              await load();
            }
        
            // Ponte pública usada pelo calendário do topo.
            window.CornerProDesktopReloadDate = reloadDesktopDate;
        
            document.addEventListener("click",event=>{
              if(!mq.matches) return;
          
              const market=event.target.closest?.("[data-cpd3-market]");
              if(market){
                event.preventDefault();
                state.market=market.dataset.cpd3Market;
                state.sub="all";
                state.line=["corners","goals","cards","handicap","btts"].includes(state.market)
                  ? "IA"
                  : "TODOS";
                state.limit=8;
                render();
                return;
              }
          
              const sub=event.target.closest?.("[data-cpd3-sub]");
              if(sub){
                event.preventDefault();
                state.sub=sub.dataset.cpd3Sub;
                state.limit=8;
                render();
                return;
              }
          
              const line=event.target.closest?.("[data-cpd3-line]");
              if(line){
                event.preventDefault();
                state.line=line.dataset.cpd3Line;
                state.limit=8;
                render();
                return;
              }
          
              const fav=event.target.closest?.("[data-cpd3-fav]");
              if(fav){
                event.preventDefault();
                const g=findGame(fav.dataset.id);
                if(g){
                  toggleFav(fav.dataset.cpd3Fav==="home"?home(g):away(g));
                  render();
                }
                return;
              }
          
              const heroFav=event.target.closest?.("[data-cpd3-hero-fav]");
              if(heroFav){
                event.preventDefault();
                if(state.hero){
                  toggleFav(heroFav.dataset.cpd3HeroFav==="home"?home(state.hero):away(state.hero));
                  render();
                }
                return;
              }
          
              const open=event.target.closest?.("[data-cpd3-open]");
              if(open){
                event.preventDefault();
                const g=findGame(open.dataset.cpd3Open);
                if(!g) return;
        
                const r=raw(g);
                const matchPayload={
                  ...r,
                  ...g,
                  match_id: clean(
                    g?.match_id ?? g?.event_id ?? g?.event_key ??
                    r?.match_id ?? r?.event_id ?? r?.event_key,
                    ""
                  ),
                  casa: home(g),
                  fora: away(g),
                  liga: league(g),
                  hora: time(g),
                  match_status: clean(g?.match_status ?? g?.status ?? r?.match_status ?? r?.status,""),
                  raw:r
                };
        
                window.__selectedMatchCenterGame=matchPayload;
                window.__selectedMatchCenterKey=String(key(g));
        
                try{
                  if(typeof window.updateDesktopMatchRail==="function"){
                    Promise.resolve(
                      window.updateDesktopMatchRail(
                        matchPayload,
                        state.games.map(x=>({...raw(x),...x}))
                      )
                    ).catch(err=>console.warn("[CP WEB V11 Match Center async]",err));
                  }else if(typeof window.openMatchCenter==="function"){
                    window.openMatchCenter(matchPayload);
                  }
        
                  const rail=document.getElementById("desktopMatchRail");
                  if(rail) rail.classList.add("mc-selected");
                }catch(err){
                  console.error("[CP WEB V11 Match Center]",err);
                }
                return;
              }
        
              if(event.target.closest?.("#cpd3TodayBtn")){
                event.preventDefault();
                const now=new Date();
                let ymd;
                try{
                  const parts=new Intl.DateTimeFormat("en-CA",{
                    timeZone:"America/Manaus",
                    year:"numeric",
                    month:"2-digit",
                    day:"2-digit"
                  }).formatToParts(now);
                  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
                  ymd=`${obj.year}-${obj.month}-${obj.day}`;
                }catch{
                  ymd=new Date(Date.now()-4*3600000).toISOString().slice(0,10);
                }
                reloadDesktopDate(ymd);
                return;
              }
        
              if(event.target.closest?.("#cpd3More")){
                event.preventDefault();
                state.limit+=8;
                render();
              }
            },true);
          
            function boot(){
              if(!$("#cpDesktopExperienceV3")) return;
              renderControls();
              load();
              const refreshLiveStatus=async()=>{
                try{
                  const selected=$("#date")?.value;
                  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(selected||""))
                    ? String(selected)
                    : todayManaus();
                  const payload=await getJson(
                    `/market_live_status?date=${encodeURIComponent(date)}&_live=${Date.now()}`,
                    18000
                  );
                  if(($("#date")?.value||date)!==date) return;
                  applyLiveStatus(payload);
                }catch(err){
                  console.warn("[CP WEB V13 live status]",err?.message||err);
                }
              };
        
              refreshLiveStatus();
              setInterval(refreshLiveStatus,20000);
            }
          
            if(document.readyState==="loading"){
              document.addEventListener("DOMContentLoaded",boot,{once:true});
            }else{
              boot();
            }
          })();
          
          
          
          /* =========================================================
            
            
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
            
                  /* V142 — FILTRO DE LIGAS PRINCIPAIS (SITE/DESKTOP)
                     Bloqueia ligas pequenas/desconhecidas em todas as listas do desktop. */
                  function normalizeLeagueV142(v){
                    return String(v ?? "")
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
                  }

                  function mainLeagueCountryV142(j){
                    return normalizeLeagueV142(
                      j?.country_name ?? j?.country ?? j?.league_country ??
                      j?.raw?.country_name ?? j?.raw?.country ?? j?.raw?.league_country ??
                      j?.event_raw?.country_name ?? j?.event_raw?.country ?? ""
                    );
                  }

                  function isMainLeagueGameV142(j){
                    const l = normalizeLeagueV142(j?.liga ?? j?.league_name ?? j?.league?.name ?? j?.competition ?? j?.campeonato ?? "");
                    const c = mainLeagueCountryV142(j);
                    if (!l) return false;

                    if (/champions league|europa league|conference league|uefa nations league|world cup|copa libertadores|copa sudamericana/.test(l)) return true;
                    if (/premier league/.test(l)) return !c || /england|inglaterra/.test(c);
                    if (/championship/.test(l)) return !c || /england|inglaterra/.test(c);
                    if (/la liga|laliga/.test(l)) return true;
                    if (/bundesliga/.test(l)) return !/2 bundesliga|3 liga/.test(l);
                    if (/^serie a$|serie a tim|serie a enilive/.test(l)) return !c || /italy|italia|brazil|brasil/.test(c);
                    if (/ligue 1/.test(l)) return true;
                    if (/liga portugal|primeira liga/.test(l)) return true;
                    if (/eredivisie/.test(l)) return true;
                    if (/jupiler pro league|pro league/.test(l)) return !c || /belgium|belgica/.test(c);
                    if (/scottish premiership|premiership/.test(l)) return /scotland|escocia/.test(c);
                    if (/super lig/.test(l)) return !c || /turkey|turquia/.test(c);
                    if (/brasileirao serie a|brasileirao|serie a/.test(l) && /brazil|brasil/.test(c)) return true;
                    if (/liga profesional|primera division/.test(l) && /argentina/.test(c)) return true;
                    if (/major league soccer|mls/.test(l)) return true;

                    return false;
                  }

                  function isServerCompatibleGame(j){
                    if (!j || typeof j !== "object") return false;
                    if (!isMainLeagueGameV142(j)) return false;
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
            
            
                    function resetDesktopMatchRailToEmpty(){
                      const rail = document.getElementById("desktopMatchRail");
                      if (!rail) return;
                      rail.innerHTML = `
                          <section class="railCard matchRailCard railEmptyHero">
                            <div class="railTitle"><span>▣ MATCH CENTER</span><b>PRÉ-JOGO</b></div>
                            <div class="railEmptyRadar" aria-hidden="true">
                              <span class="radarRing ring1"></span>
                              <span class="radarRing ring2"></span>
                              <span class="radarRing ring3"></span>
                              <span class="radarSweep"></span>
                              <span class="radarBall">⚽</span>
                            </div>
                            <div class="railEmptyText">
                              <strong>Aguardando partida</strong>
                              <span>Selecione um jogo para iniciar o Match Center e ver todas as análises.</span>
                            </div>
                          </section>
            
                          <section class="railCard railEmptyStatsCard">
                            <h3>ESTATÍSTICAS DO FILTRO</h3>
                            <div class="railEmptyStatsGrid">
                              <div class="railEmptyStatBox"><i>🛡</i><span>Força do filtro</span><b>--</b><small>Aguardando</small></div>
                              <div class="railEmptyStatBox"><i>🚩</i><span>Proj. escanteios</span><b>--</b><small>Aguardando</small></div>
                              <div class="railEmptyStatBox"><i>🏠</i><span>Casa média</span><b>--</b><small>Aguardando</small></div>
                              <div class="railEmptyStatBox"><i>✈</i><span>Visitante média</span><b>--</b><small>Aguardando</small></div>
                            </div>
                            <div class="railEmptyHint">As estatísticas serão carregadas após a seleção de uma partida.</div>
                          </section>
            
                          <section class="railCard railEmptyEventsCard">
                            <h3>EVENTOS / LEITURA</h3>
                            <div class="railEmptyEventIcons">
                              <span><i>◎</i><b>Pressão</b><small>--</small></span>
                              <span><i>◔</i><b>Posse</b><small>--</small></span>
                              <span><i>▣</i><b>Cartões</b><small>--</small></span>
                              <span><i>⚑</i><b>Escanteios</b><small>--</small></span>
                              <span><i>⚽</i><b>Gols</b><small>--</small></span>
                            </div>
                            <div class="railEmptyTimeline"><i></i><i></i><i></i><i></i><i></i></div>
                            <div class="railEmptyReadBox">
                              <b>📋</b>
                              <p>A leitura do jogo aparecerá aqui. Selecione uma partida para ver eventos e insights em tempo real.</p>
                            </div>
                          </section>
            
                          <button class="railFullBtn railFullBtnDisabled" type="button" disabled>
                            <span>▶ INICIAR MATCH CENTER</span>
                            <small>Selecione um jogo para continuar</small>
                          </button>
                        `;
                    }
            
                    function clearRowMatchCenterSelection({ resetRail = true } = {}){
                      window.__selectedMatchCenterGame = null;
                      window.__selectedMatchCenterKey = null;
            
                      document.querySelectorAll(".premiumGameRow.match-center-selected,.cleanDashRow.match-center-selected,[data-match-center-row].match-center-selected")
                        .forEach(row => row.classList.remove("match-center-selected"));
            
                      document.querySelectorAll(".matchCenterBtn").forEach(b => {
                        b.classList.remove("is-open");
                        b.innerHTML = `<span class="matchCenterBtnIcon">▥</span> Match Center`;
                      });
            
                      document.querySelectorAll(".matchCenterMiniBtn").forEach(b => {
                        b.classList.remove("is-open");
                        b.innerHTML = `📊`;
                      });
            
                      if (resetRail) resetDesktopMatchRailToEmpty();
                    }
            
                    function openRowMatchCenterOnly(btn){
                      const idx = Number(btn?.dataset?.openMatchCenter);
                      const fallback = {
                        match_id: btn?.dataset?.matchId || "",
                        casa: btn?.dataset?.home || "Mandante",
                        fora: btn?.dataset?.away || "Visitante",
                        liga: btn?.dataset?.league || "Liga",
                        hora: btn?.dataset?.time || "—"
                      };
            
                      const list = Array.isArray(window.__premiumFilteredGames) ? window.__premiumFilteredGames : [];
                      const game = list[idx] || fallback;
                      const row = btn.closest(".premiumGameRow,.cleanDashRow,[data-match-center-row]");
                      const rowKey = String(row?.dataset?.matchKey || fallback.match_id || `${fallback.casa}|${fallback.fora}|${fallback.liga}|${fallback.hora}`);
            
                      // Se clicar novamente no mesmo jogo/botão, fecha o Match Center e limpa a seleção.
                      if (window.__selectedMatchCenterKey && window.__selectedMatchCenterKey === rowKey){
                        clearRowMatchCenterSelection({ resetRail: true });
                        return;
                      }
            
                      window.__selectedMatchCenterGame = game;
                      window.__selectedMatchCenterKey = rowKey;
            
                      clearRowMatchCenterSelection({ resetRail: false });
            
                      window.__selectedMatchCenterGame = game;
                      window.__selectedMatchCenterKey = rowKey;
            
                      row?.classList.add("match-center-selected");
                      btn.classList.add("is-open");
                      btn.innerHTML = `<span class="matchCenterBtnIcon">✓</span> Aberto`;
            
                      const rail = document.getElementById("desktopMatchRail");
                      rail?.classList.add("rail-selected-pulse");
                      setTimeout(() => rail?.classList.remove("rail-selected-pulse"), 900);
            
                      try{
                        if (typeof window.updateDesktopMatchRail === "function"){
                          window.updateDesktopMatchRail(game, list);
                        }
                      }catch(e){
                        console.warn("Falha ao atualizar Match Center fixo:", e);
                      }
                    }
            
                    document.addEventListener("keydown", function(ev){
                      if (ev.key === "Escape") closeMatchCenterOverlay();
                    });
            
                    document.addEventListener("click", function(ev){
                      if (ev.target.closest("[data-mc-close]")){
                        ev.preventDefault();
                        ev.stopPropagation();
                        closeMatchCenterOverlay();
                        return;
                      }
                      const btn = ev.target.closest("[data-open-match-center], [data-open-match-center-table]");
            
                      if (!btn){
                        const clickedInsideRow = ev.target.closest(".premiumGameRow,.cleanDashRow,[data-match-center-row],.marketTablePanel,.marketFiltersWrap");
                        const clickedInsideRail = ev.target.closest("#desktopMatchRail,.dashboardRightRail");
                        const clickedInsideOverlay = ev.target.closest("#matchCenterOverlay,.matchStatsModal,.last5Modal");
            
                        // Clique fora dos jogos e fora do painel: fecha o estado \"Aberto\".
                        if (!clickedInsideRow && !clickedInsideRail && !clickedInsideOverlay){
                          clearRowMatchCenterSelection({ resetRail: true });
                        }
                        return;
                      }
            
                      ev.preventDefault();
                      ev.stopPropagation();
            
                      // Botão da linha: seleciona o jogo e atualiza o painel da direita.
                      // Botão "Ver partida completa": abre o modal completo.
                      if (btn.matches("[data-open-match-center]") && !btn.matches("[data-open-match-center-table]")){
                        openRowMatchCenterOnly(btn);
                        return;
                      }
            
                      openMatchCenter(btn);
                    }, true);
                  })();
            
            
                  /* PATCH VISUAL FINAL — somente Escanteios por time no modal */
                  (function installOnlyCornersFinalStyle(){
                    if (document.getElementById("onlyCornersFinalStyle")) return;
                    const style = document.createElement("style");
                    style.id = "onlyCornersFinalStyle";
                    style.textContent = `
                      .mcEntryProCard,
                      .mcCardsProCard{
                        display:none !important;
                        visibility:hidden !important;
                        opacity:0 !important;
                        pointer-events:none !important;
                      }
            
                      .mcCornersProCard{
                        width:100% !important;
                        max-width:100% !important;
                        min-width:280px !important;
                      }
            
                      .mcMiddleGrid,
                      .matchCenterMiddle,
                      .mcProMiddle{
                        grid-template-columns:1fr !important;
                      }
                    `;
                    document.head.appendChild(style);
                  })();
            
            
                  /* =========================================================
                     DESKTOP RIGHT RAIL — SINCRONIZA MATCH CENTER FIXO
                     ========================================================= */
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game, list){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail) return;
            
                    const safeText = (v, fb="—") => {
                      const s = String(v ?? "").trim();
                      return s && s !== "undefined" && s !== "null" && s !== "NaN" ? s : fb;
                    };
                    const esc = (v) => safeText(v, "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
                    const num = (v, fb=0) => Number.isFinite(Number(v)) ? Number(v) : fb;
                    const pctClamp = (v) => Math.max(0, Math.min(100, Math.round(num(v, 0))));
            
                    const matchId = safeText(game?.match_id || game?.id || game?.event_key || game?.event_id || "", "");
                    const home = esc(game?.casa || game?.home || game?.home_team || game?.home_name || "Mandante");
                    const away = esc(game?.fora || game?.away || game?.away_team || game?.away_name || "Visitante");
                    const league = esc(game?.liga || game?.league_name || game?.league?.name || "Liga");
                    const time = esc(game?.hora || game?.time || "—");
                    const pct = pctClamp(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score ?? 69);
                    const proj = Number.isFinite(Number(game?.proj_cantos)) ? Number(game.proj_cantos).toFixed(1).replace(".0","") : "—";
            
                    function renderPregame(){
                      rail.innerHTML = `
                        <section class="railCard matchRailCard is-pregame">
                          <div class="railTitle"><span>▣ MATCH CENTER</span><b>PRÉ-JOGO</b></div>
                          <div class="railScoreBlock">
                            <div class="railTeam"><div class="railBadge">${home.slice(0,2).toUpperCase()}</div><strong>${home}</strong></div>
                            <div class="railScore"><strong>0 - 0</strong><span>${time} • ${league}</span></div>
                            <div class="railTeam"><div class="railBadge away">${away.slice(0,2).toUpperCase()}</div><strong>${away}</strong></div>
                          </div>
                          <div class="railProgress"><i style="width:${pct}%"></i></div>
                        </section>
            
                        <section class="railCard">
                          <h3>ESTATÍSTICAS DO FILTRO</h3>
                          <div class="railStat"><span>Força do filtro</span><b>${pct}%</b></div>
                          <div class="railProgress"><i style="width:${pct}%"></i></div>
                          <div class="railStat"><span>Proj. escanteios</span><b>${proj}</b></div>
                        </section>
            
                        <section class="railCard">
                          <h3>EVENTOS / LEITURA</h3>
                          <div class="railEvents">
                            <p>Pré-jogo selecionado. Ao iniciar, o painel muda para dados reais da partida.</p>
                            <p>Monitorando escanteios, finalizações, pressão e eventos retornados pela API.</p>
                          </div>
                        </section>
            
                        <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${home}" data-away="${away}" data-league="${league}" data-time="${time}">VER PARTIDA COMPLETA →</button>
                      `;
                    }
            
                    function statusLabel(data){
                      const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                      if (data?.finished || raw.includes("ft") || raw.includes("final") || raw.includes("finished") || raw.includes("encerrado")) return "ENCERRADO";
                      if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                      return "PRÉ-JOGO";
                    }
            
                    function value(v){
                      const s = safeText(v, "—");
                      return s === "null" || s === "undefined" ? "—" : s;
                    }
            
                    function eventLines(data){
                      const events = Array.isArray(data?.events) ? data.events.slice(0, 5) : [];
                      if (!events.length){
                        if (data?.finished) return `<p>Jogo encerrado. A API não retornou eventos detalhados.</p>`;
                        if (data?.live) return `<p>Ao vivo, aguardando eventos detalhados da API.</p>`;
                        return `<p>Pré-jogo. Os eventos aparecem quando a partida iniciar.</p>`;
                      }
                      return events.map(e => `<p><b>${value(e?.minute)}</b> ${esc(e?.label || e?.type || "Evento")} <small>${esc(e?.team || "")}</small></p>`).join("");
                    }
            
                    function renderReal(data){
                      const st = statusLabel(data);
                      const liveMinute = data?.live && data?.minute ? ` • ${esc(data.minute)}'` : "";
                      const gh = value(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? 0);
                      const ga = value(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? 0);
                      const ch = value(data?.corners?.home ?? data?.home_corners);
                      const ca = value(data?.corners?.away ?? data?.away_corners);
                      const sh = value(data?.shots?.home ?? data?.shots?.total_home ?? data?.home_shots);
                      const sa = value(data?.shots?.away ?? data?.shots?.total_away ?? data?.away_shots);
                      const ph = value(data?.pressure?.home ?? data?.dangerous_attacks?.home);
                      const pa = value(data?.pressure?.away ?? data?.dangerous_attacks?.away);
                      const cardsH = value(data?.cards?.home ?? data?.yellow_cards?.home);
                      const cardsA = value(data?.cards?.away ?? data?.yellow_cards?.away);
                      const cornerTotal = num(data?.corners?.total, num(ch, 0) + num(ca, 0));
                      const progress = data?.finished ? 100 : (data?.live ? Math.max(8, Math.min(96, Math.round(num(data?.minute, 1)))) : 0);
            
                      rail.innerHTML = `
                        <section class="railCard matchRailCard ${data?.live ? "is-live" : ""} ${data?.finished ? "is-finished" : ""}">
                          <div class="railTitle"><span>▣ MATCH CENTER</span><b>${st}${liveMinute}</b></div>
                          <div class="railScoreBlock">
                            <div class="railTeam"><div class="railBadge">${home.slice(0,2).toUpperCase()}</div><strong>${home}</strong></div>
                            <div class="railScore"><strong>${gh} - ${ga}</strong><span>${time} • ${league}</span></div>
                            <div class="railTeam"><div class="railBadge away">${away.slice(0,2).toUpperCase()}</div><strong>${away}</strong></div>
                          </div>
                          <div class="railProgress"><i style="width:${progress}%"></i></div>
                        </section>
            
                        <section class="railCard">
                          <h3>DADOS REAIS DA PARTIDA</h3>
                          <div class="railLiveGrid">
                            <div class="railLiveStat"><span>Escanteios</span><b>${ch} x ${ca}</b><small>Total ${cornerTotal || "—"}</small></div>
                            <div class="railLiveStat"><span>Finalizações</span><b>${sh} x ${sa}</b><small>Dados API</small></div>
                            <div class="railLiveStat"><span>Pressão</span><b>${ph} x ${pa}</b><small>Ataques perigosos</small></div>
                            <div class="railLiveStat"><span>Cartões</span><b>${cardsH} x ${cardsA}</b><small>Amarelos/vermelhos</small></div>
                          </div>
                        </section>
            
                        <section class="railCard">
                          <h3>EVENTOS / LEITURA</h3>
                          <div class="railEvents">${eventLines(data)}</div>
                        </section>
            
                        <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${home}" data-away="${away}" data-league="${league}" data-time="${time}">VER PARTIDA COMPLETA →</button>
                      `;
                    }
            
                    renderPregame();
            
                    if (!matchId) return;
            
                    try{
                      const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, { cache:"no-store" });
                      if (!res.ok) return;
                      const data = await res.json();
                      if (data && !data.error) renderReal(data);
                    }catch(err){
                      console.warn("Right rail Match Center em tempo real falhou:", err);
                    }
                  };
            
                  // Atualiza automaticamente o Match Center fixo a cada 45s quando há jogo selecionado.
                  (function autoRefreshDesktopMatchRail(){
                    if (window.__desktopMatchRailRefreshInstalled) return;
                    window.__desktopMatchRailRefreshInstalled = true;
                    setInterval(() => {
                      try{
                        if (Array.isArray(window.__lastRenderedTopGames) && window.__lastRenderedTopGames[0]){
                          if (window.__selectedMatchCenterGame) window.updateDesktopMatchRail(window.__selectedMatchCenterGame, window.__lastRenderedTopGames);
                        }
                      }catch(e){}
                    }, 45000);
                  })();
            
            
                /* LOGIN TEMPORÁRIO removido: duplicava sessão e listeners. */
            
            
                  /* =========================================================
                     PATCH PREMIUM — MATCH CENTER FIXO COM GRÁFICO DE PRESSÃO
                     - Não altera o motor dos jogos
                     - Usa /match_center quando houver match_id
                     - Se a API não retornar série, gera uma curva visual a partir dos dados reais
                     ========================================================= */
                  (function installPremiumPressureRail(){
                    if (window.__premiumPressureRailInstalled) return;
                    window.__premiumPressureRailInstalled = true;
            
                    const esc = (v) => String(v ?? "")
                      .replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
            
                    const clean = (v, fb = "—") => {
                      const s = String(v ?? "").trim();
                      return s && s !== "undefined" && s !== "null" && s !== "NaN" ? s : fb;
                    };
            
                    const num = (v, fb = null) => {
                      const n = Number(String(v ?? "").replace("%","").replace(",","."));
                      return Number.isFinite(n) ? n : fb;
                    };
            
                    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
            
                    function initials(name, fallback){
                      const s = clean(name, fallback);
                      const parts = s.split(/\s+/).filter(Boolean);
                      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                      return s.slice(0,2).toUpperCase();
                    }
            
                    function statusLabel(data){
                      const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                      if (data?.finished || raw.includes("ft") || raw.includes("final") || raw.includes("finished") || raw.includes("encerrado")) return "ENCERRADO";
                      if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                      return "PRÉ-JOGO";
                    }
            
                    function getMinute(data){
                      const raw = data?.minute ?? data?.match_minute ?? data?.time_live ?? "";
                      const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
                      if (Number.isFinite(n)) return clamp(n, 1, 120);
                      return data?.finished ? 90 : 0;
                    }
            
                    function pressureLevel(home, away, explicit){
                      if (explicit) return clean(explicit);
                      const total = (num(home,0) || 0) + (num(away,0) || 0);
                      if (total >= 75) return "MUITO ALTA";
                      if (total >= 48) return "ALTA";
                      if (total >= 25) return "MÉDIA";
                      if (total > 0) return "BAIXA";
                      return "AGUARDANDO";
                    }
            
                    function sameTeam(value, target){
                      const a = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
                      const b = String(target || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
                      if (!a || !b) return false;
                      return a === b || a.includes(b) || b.includes(a);
                    }
            
                    function realMinuteFromEvent(e){
                      const raw = e?.minute ?? e?.time ?? e?.elapsed ?? e?.match_minute ?? e?.label ?? "";
                      const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
                      return Number.isFinite(n) ? clamp(n, 1, 130) : null;
                    }
            
                    function eventWeight(e){
                      const txt = String(e?.type || e?.label || e?.detail || e?.description || "").toLowerCase();
                      if (txt.includes("goal") || txt.includes("gol")) return 12;
                      if (txt.includes("shot on") || txt.includes("on target") || txt.includes("finalização no alvo") || txt.includes("finalizacao no alvo")) return 9;
                      if (txt.includes("shot") || txt.includes("finalização") || txt.includes("finalizacao")) return 6;
                      if (txt.includes("corner") || txt.includes("escanteio")) return 7;
                      if (txt.includes("danger") || txt.includes("ataque perigoso") || txt.includes("press")) return 4;
                      if (txt.includes("yellow") || txt.includes("amarelo")) return 2;
                      if (txt.includes("red") || txt.includes("vermelho")) return 3;
                      return 1;
                    }
            
                    function seriesFromEvents(data){
                      const events = Array.isArray(data?.events) ? data.events : [];
                      if (!events.length) return [];
            
                      const minuteNow = getMinute(data) || 90;
                      const start = Math.max(1, minuteNow - 14);
                      const buckets = Array.from({ length: 15 }, (_, i) => ({
                        minute: `${start + i}'`,
                        home: 0,
                        away: 0,
                        source: "events"
                      }));
            
                      const homeName = clean(data?.home || data?.casa || data?.home_team || "");
                      const awayName = clean(data?.away || data?.fora || data?.away_team || "");
            
                      events.forEach(e => {
                        const m = realMinuteFromEvent(e);
                        if (m === null || m < start || m > minuteNow) return;
                        const idx = clamp(m - start, 0, 14);
                        const team = e?.team || e?.time || e?.team_name || e?.side || "";
                        const side = String(e?.side || e?.team_side || "").toLowerCase();
                        const w = eventWeight(e);
            
                        if (side.includes("home") || side.includes("mandante") || side.includes("casa") || sameTeam(team, homeName)){
                          buckets[idx].home += w;
                        } else if (side.includes("away") || side.includes("visitante") || side.includes("fora") || sameTeam(team, awayName)){
                          buckets[idx].away += w;
                        }
                      });
            
                      const total = buckets.reduce((s,b) => s + b.home + b.away, 0);
                      return total > 0 ? buckets : [];
                    }
            
                    function normalizeTimelineItem(p, idx){
                      return {
                        minute: clean(p?.minute ?? p?.label ?? p?.time ?? p?.elapsed ?? `${idx + 1}`),
                        home: num(p?.home ?? p?.mandante ?? p?.casa ?? p?.home_pressure ?? p?.h, null),
                        away: num(p?.away ?? p?.visitante ?? p?.fora ?? p?.away_pressure ?? p?.a, null),
                        source: "timeline"
                      };
                    }
            
                    function buildPressureSeries(data, fallbackPct = 60){
                      // Exibe exclusivamente uma timeline real enviada pelo backend/API.
                      const candidates = [
                        data?.pressure_timeline, data?.pressureTimeline,
                        data?.pressure_history, data?.pressureHistory,
                        data?.momentum, data?.momentum_timeline, data?.momentumTimeline,
                        data?.attacks_timeline, data?.dangerous_attacks_timeline
                      ];
                      for (const candidate of candidates){
                        if (!Array.isArray(candidate) || candidate.length < 2) continue;
                        const real = candidate.slice(-40).map(normalizeTimelineItem).filter(p =>
                          num(p.home, null) !== null || num(p.away, null) !== null
                        );
                        if (real.length >= 2) return real;
                      }
                      return [];
                    }
            
                    function svgPressureChart(series){
                      const cleanSeries = (series || []).filter(p => p && (num(p.home,null) !== null || num(p.away,null) !== null));
                      if (cleanSeries.length < 2){
                        return `<div class="railPressureEmpty">Aguardando dados reais de pressão da API.</div>`;
                      }
            
                      const W = 300, H = 150, padL = 52, padR = 10, padT = 12, padB = 28;
                      const mid = 78;
                      const chartH = 52;
                      const vals = cleanSeries.flatMap(p => [num(p.home,0), num(p.away,0)]).filter(Number.isFinite);
                      const maxV = Math.max(8, ...vals);
                      const bucketSize = Math.max(1, Math.ceil(cleanSeries.length / 18));
                      const grouped = [];
                      for (let i = 0; i < cleanSeries.length; i += bucketSize){
                        const slice = cleanSeries.slice(i, i + bucketSize);
                        grouped.push({
                          minute: slice[0]?.minute || "",
                          home: slice.reduce((s,p)=>s + num(p.home,0), 0),
                          away: slice.reduce((s,p)=>s + num(p.away,0), 0),
                          source: slice[0]?.source || "timeline"
                        });
                      }
                      const finalSeries = grouped.length ? grouped : cleanSeries;
                      const finalMaxV = Math.max(8, ...finalSeries.flatMap(p => [num(p.home,0), num(p.away,0)]));
                      const slot = (W - padL - padR) / finalSeries.length;
                      const barW = Math.max(7, Math.min(12, slot * .66));
                      const x = (i) => padL + (i * slot) + (slot - barW) / 2;
                      const h = (v) => Math.max(2, (num(v,0) / finalMaxV) * chartH);
            
                      const bars = finalSeries.map((p,i) => {
                        const bh = h(p.home);
                        const ba = h(p.away);
                        return `
                          <rect class="homeBar" x="${x(i).toFixed(1)}" y="${(mid - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"></rect>
                          <rect class="awayBar" x="${x(i).toFixed(1)}" y="${mid.toFixed(1)}" width="${barW.toFixed(1)}" height="${ba.toFixed(1)}" rx="2"></rect>
                        `;
                      }).join("");
            
                      const ticks = [
                        { label:"15'", pos:0 },
                        { label:"10'", pos:.5 },
                        { label:"0'", pos:1 }
                      ].map(t => {
                        const tx = padL + ((W - padL - padR) * t.pos);
                        return `<text x="${tx.toFixed(1)}" y="145">${t.label}</text>`;
                      }).join("");
            
                      const last = finalSeries[finalSeries.length - 1] || {};
                      const lastHome = num(last.home,0);
                      const lastAway = num(last.away,0);
                      const source = String(last.source || cleanSeries[0]?.source || "timeline");
                      const sourceText = source === "snapshot" ? "DADOS API" : "DADOS REAIS";
            
                      return `
                        <div class="railPressureChartBox">
                          <div class="railPressureLegend">
                            <span><i></i>Mandante</span>
                            <span class="away"><i></i>Visitante</span>
                            <b>${sourceText}</b>
                          </div>
                          <svg class="railPressureSvg railPressureBarsSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pressão real dos últimos minutos">
                            <defs>
                              <linearGradient id="mcHomeBarGrad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0" stop-color="#24a8ff"></stop>
                                <stop offset="1" stop-color="#0877ff"></stop>
                              </linearGradient>
                              <linearGradient id="mcAwayBarGrad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0" stop-color="#a66cff"></stop>
                                <stop offset="1" stop-color="#6d35ff"></stop>
                              </linearGradient>
                            </defs>
                            <rect x="${padL}" y="${padT}" width="${W-padL-padR}" height="${chartH}" fill="rgba(36,168,255,.12)"></rect>
                            <rect x="${padL}" y="${mid}" width="${W-padL-padR}" height="${chartH}" fill="rgba(139,92,246,.13)"></rect>
                            <line class="grid" x1="${padL}" y1="${padT}" x2="${W-padR}" y2="${padT}"></line>
                            <line class="grid" x1="${padL}" y1="${mid-chartH/2}" x2="${W-padR}" y2="${mid-chartH/2}"></line>
                            <line class="grid strong" x1="${padL}" y1="${mid}" x2="${W-padR}" y2="${mid}"></line>
                            <line class="grid" x1="${padL}" y1="${mid+chartH/2}" x2="${W-padR}" y2="${mid+chartH/2}"></line>
                            <line class="grid" x1="${padL}" y1="${mid+chartH}" x2="${W-padR}" y2="${mid+chartH}"></line>
                            <text class="axis axisLevel" x="4" y="18">Muito forte</text>
                            <text class="axis axisLevel" x="18" y="44">Forte</text>
                            <text class="axis axisLevel" x="18" y="82">Neutro</text>
                            <text class="axis axisLevel" x="18" y="108">Forte</text>
                            <text class="axis axisLevel" x="4" y="134">Muito forte</text>
                            ${bars}
                            <g class="xlabels">${ticks}</g>
                          </svg>
                        </div>
                      `;
                    }
            
                    function buildEventLines(data){
                      const events = Array.isArray(data?.events) ? data.events.slice(0, 6) : [];
                      if (!events.length){
                        if (data?.live) return `<p>Ao vivo. Aguardando eventos detalhados da API.</p>`;
                        if (data?.finished) return `<p>Encerrado. A API não retornou timeline detalhada.</p>`;
                        return `<p>Pré-jogo. Os eventos aparecem quando a partida iniciar.</p>`;
                      }
            
                      const icon = (e) => {
                        const t = String(e?.type || e?.label || "").toLowerCase();
                        if (t.includes("goal") || t.includes("gol")) return "⚽";
                        if (t.includes("corner") || t.includes("escanteio")) return "⚑";
                        if (t.includes("yellow") || t.includes("amarelo")) return "🟨";
                        if (t.includes("red") || t.includes("vermelho")) return "🟥";
                        if (t.includes("sub")) return "🔁";
                        return "●";
                      };
            
                      return events.map(e => `
                        <p class="railEventRow">
                          <b>${esc(clean(e?.minute, "—"))}</b>
                          <span>${icon(e)}</span>
                          <em>${esc(clean(e?.label || e?.type, "Evento"))}</em>
                          <small>${esc(clean(e?.team, ""))}</small>
                        </p>
                      `).join("");
                    }
            
                    function buildPregameRail({ rail, game, matchId, home, away, league, time, pct, proj }){
                      const series = [];
            
                      rail.innerHTML = `
                        <section class="railCard matchRailCard railDashHero is-pregame">
                          <div class="railTitle"><span>▣ MATCH CENTER</span><b>PRÉ-JOGO</b></div>
                          <div class="railDashTeams">
                            <div class="railDashTeam"><div class="railBadge">${initials(home,"MA")}</div><strong>${home}</strong></div>
                            <div class="railDashScore"><small>${league}</small><strong>0 - 0</strong><span>${time || "Escolha um jogo"}</span></div>
                            <div class="railDashTeam"><div class="railBadge away">${initials(away,"VI")}</div><strong>${away}</strong></div>
                          </div>
                          <div class="railProgress"><i style="width:${pct}%"></i></div>
                        </section>
            
                        <section class="railCard railDashStats">
                          <h3>PAINEL DO FILTRO</h3>
                          <div class="railDashGrid">
                            <div class="railLiveStat"><span>Força</span><b>${pct}%</b><small>Filtro atual</small></div>
                            <div class="railLiveStat"><span>Projeção</span><b>${proj}</b><small>Escanteios</small></div>
                            <div class="railLiveStat"><span>Status</span><b>Pré</b><small>Aguardando jogo</small></div>
                            <div class="railLiveStat"><span>Mercado</span><b>+9.5</b><small>Escanteios</small></div>
                          </div>
                        </section>
            
                        <section class="railCard railPressureCard">
                          <div class="railPressureHead"><h3>GRÁFICO DE PRESSÃO</h3><b>PROJEÇÃO</b></div>
                          ${svgPressureChart(series)}
                        </section>
            
                        <section class="railCard">
                          <h3>LEITURA DO JOGO</h3>
                          <div class="railAiBox">
                            <p>Pré-jogo selecionado. Quando a partida iniciar, o painel muda para dados reais: pressão, escanteios, finalizações e eventos.</p>
                            <div class="railConfidence"><span>Confiança</span><b>${pct}%</b></div>
                          </div>
                        </section>
            
                        <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}" data-time="${esc(time)}">VER PARTIDA COMPLETA →</button>
                      `;
                    }
            
                    function buildRealRail({ rail, data, matchId, home, away, league, time, pct }){
                      const st = statusLabel(data);
                      const minute = getMinute(data);
                      const minuteText = data?.live && minute ? `${minute}'` : (data?.finished ? "90'" : "—");
                      const gh = clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? 0, "0");
                      const ga = clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? 0, "0");
                      const ch = clean(data?.corners?.home ?? data?.home_corners, "—");
                      const ca = clean(data?.corners?.away ?? data?.away_corners, "—");
                      const sh = clean(data?.shots?.home ?? data?.shots?.total_home ?? data?.home_shots, "—");
                      const sa = clean(data?.shots?.away ?? data?.shots?.total_away ?? data?.away_shots, "—");
                      const ph = clean(data?.pressure?.home ?? data?.dangerous_attacks?.home, "—");
                      const pa = clean(data?.pressure?.away ?? data?.dangerous_attacks?.away, "—");
                      const cardsH = clean(data?.cards?.yellow_home ?? data?.cards?.home ?? data?.yellow_cards?.home, "—");
                      const cardsA = clean(data?.cards?.yellow_away ?? data?.cards?.away ?? data?.yellow_cards?.away, "—");
            
                      const cornerTotal = num(data?.corners?.total, (num(ch,0) || 0) + (num(ca,0) || 0));
                      const progress = data?.finished ? 100 : (data?.live ? clamp(minute, 8, 96) : 0);
                      const pLevel = pressureLevel(ph, pa, data?.pressure_level);
                      const series = buildPressureSeries(data, pct);
                      const last = series[series.length - 1] || {};
                      const confidence = clamp(Math.round((num(last.home,0) / Math.max(1, (num(last.home,0)+num(last.away,0)))) * 100), 5, 95);
            
                      rail.innerHTML = `
                        <section class="railCard matchRailCard railDashHero ${data?.live ? "is-live" : ""} ${data?.finished ? "is-finished" : ""}">
                          <div class="railTitle"><span>▣ MATCH CENTER</span><b>${st}${data?.live ? " • " + minuteText : ""}</b></div>
                          <div class="railDashTeams">
                            <div class="railDashTeam"><div class="railBadge">${initials(home,"MA")}</div><strong>${home}</strong></div>
                            <div class="railDashScore"><small>${league}</small><strong>${gh} - ${ga}</strong><span>${minuteText} ${data?.period ? "• " + esc(data.period) : ""}</span></div>
                            <div class="railDashTeam"><div class="railBadge away">${initials(away,"VI")}</div><strong>${away}</strong></div>
                          </div>
                          <div class="railProgress"><i style="width:${progress}%"></i></div>
                        </section>
            
                        <section class="railCard railDashStats">
                          <h3>DADOS REAIS DA PARTIDA</h3>
                          <div class="railDashGrid">
                            <div class="railLiveStat"><span>Escanteios</span><b>${ch} x ${ca}</b><small>Total ${cornerTotal || "—"}</small></div>
                            <div class="railLiveStat"><span>Finalizações</span><b>${sh} x ${sa}</b><small>Dados API</small></div>
                            <div class="railLiveStat"><span>Pressão</span><b>${ph} x ${pa}</b><small>Ataques perigosos</small></div>
                            <div class="railLiveStat"><span>Cartões</span><b>${cardsH} x ${cardsA}</b><small>Amarelos</small></div>
                          </div>
                        </section>
            
                        <section class="railCard railPressureCard">
                          <div class="railPressureHead"><h3>PRESSÃO DOS ÚLTIMOS MINUTOS</h3><b>${pLevel}</b></div>
                          ${svgPressureChart(series)}
                        </section>
            
                        <section class="railCard">
                          <h3>EVENTOS DA PARTIDA</h3>
                          <div class="railEvents railEventsDash">${buildEventLines(data)}</div>
                        </section>
            
                        <section class="railCard railAiDash">
                          <div>
                            <h3>LEITURA DO JOGO</h3>
                            <p>${home} ${num(last.home,0) >= num(last.away,0) ? "com maior pressão ofensiva neste recorte." : "enfrentando pressão maior do visitante neste recorte."}</p>
                            <small>Baseado nos dados reais disponíveis da API.</small>
                          </div>
                          <div class="railConfidenceCircle" style="--p:${confidence};"><b>${confidence}%</b><span>confiança</span></div>
                        </section>
            
                        <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}" data-time="${esc(time)}">VER PARTIDA COMPLETA →</button>
                      `;
                    }
            
                    window.updateDesktopMatchRail = async function updateDesktopMatchRail(game, list){
                      const rail = document.getElementById("desktopMatchRail");
                      if (!rail || !game) return;
            
                      const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id || "", "");
                      const home = clean(game?.casa || game?.home || game?.home_team || game?.home_name || "Mandante");
                      const away = clean(game?.fora || game?.away || game?.away_team || game?.away_name || "Visitante");
                      const league = clean(game?.liga || game?.league_name || game?.league?.name || "Liga");
                      const time = clean(game?.hora || game?.time || "—");
                      const pct = clamp(Math.round(num(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score, 69)), 0, 100);
                      const proj = Number.isFinite(Number(game?.proj_cantos)) ? Number(game.proj_cantos).toFixed(1).replace(".0","") : "—";
            
                      buildPregameRail({ rail, game, matchId, home, away, league, time, pct, proj });
            
                      if (!matchId) return;
            
                      try{
                        const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, { cache:"no-store" });
                        if (!res.ok) return;
                        const data = await res.json();
                        if (data && !data.error){
                          buildRealRail({ rail, data, matchId, home: clean(data.home, home), away: clean(data.away, away), league: clean(data.league, league), time: clean(data.time, time), pct });
                        }
                      }catch(err){
                        console.warn("Right rail Premium Match Center falhou:", err);
                      }
                    };
                  })();
            
                /* =========================================================
                   FIX FINAL DE CARREGAMENTO / LOGIN — CORNERS RADAR
                   CORREÇÃO SAFARI / IPHONE:
                   - Nunca esconde o dashboard quando #loginScreen não existe.
                   - Protege localStorage, que pode falhar no Safari/modo privado.
                   - Preserva login e logout quando a tela de login realmente existe.
                   ========================================================= */
                (function finalLoginLoadFix(){
                  "use strict";
            
                  const LOGIN_KEY = "cornersRadarLogged";
                  const LEGACY_KEYS = ["isLogged", "loggedIn", "auth", "user"];
                  const VALID_LOGINS = [
                    { user: "RodrigoMartins", pass: "Rodrics789bl" },
                    { user: "admin", pass: "123456" }
                  ];
            
                  function $(id){
                    return document.getElementById(id);
                  }
            
                  function storageGet(key){
                    try{
                      return window.localStorage ? localStorage.getItem(key) : null;
                    }catch(error){
                      console.warn("LocalStorage indisponível:", error);
                      return null;
                    }
                  }
            
                  function storageSet(key, value){
                    try{
                      if (window.localStorage) localStorage.setItem(key, value);
                      return true;
                    }catch(error){
                      console.warn("Não foi possível gravar no LocalStorage:", error);
                      return false;
                    }
                  }
            
                  function storageRemove(key){
                    try{
                      if (window.localStorage) localStorage.removeItem(key);
                    }catch(error){
                      console.warn("Não foi possível remover do LocalStorage:", error);
                    }
                  }
            
                  function show(el, display){
                    if (!el) return;
                    el.style.removeProperty("visibility");
                    el.style.removeProperty("opacity");
                    el.style.removeProperty("pointer-events");
                    el.style.display = display || "";
                  }
            
                  function hide(el){
                    if (!el) return;
                    el.style.display = "none";
                    el.style.visibility = "hidden";
                    el.style.opacity = "0";
                    el.style.pointerEvents = "none";
                  }
            
                  function revealDashboard(){
                    document.body.classList.remove("locked");
                    document.body.classList.add("dashboard");
            
                    const loginScreen = $("loginScreen");
                    if (loginScreen) hide(loginScreen);
            
                    const sidebar = document.querySelector(".sidebar");
                    const main = document.querySelector(".main");
                    const topbar = document.querySelector(".topbar");
                    const content = document.querySelector(".content");
            
                    /*
                      Não usamos display:block à força na .content, pois isso quebrava
                      o flex/grid original. Removemos apenas estilos inline aplicados
                      por versões antigas do login.
                    */
                    [sidebar, main, topbar, content].forEach(el => {
                      if (!el) return;
                      el.style.removeProperty("display");
                      el.style.removeProperty("visibility");
                      el.style.removeProperty("opacity");
                      el.style.removeProperty("pointer-events");
                    });
                  }
            
                  function normalizeSession(){
                    const value = storageGet(LOGIN_KEY);
                    if (value === "1" || value === "true"){
                      storageSet(LOGIN_KEY, "true");
                      return true;
                    }
                    return false;
                  }
            
                  function unlockDashboard(){
                    storageSet(LOGIN_KEY, "true");
                    revealDashboard();
                  }
            
                  function lockDashboard(){
                    const loginScreen = $("loginScreen");
            
                    /*
                      CORREÇÃO PRINCIPAL:
                      o HTML mobile atual não possui #loginScreen. O código antigo
                      escondia .main/.content mesmo assim, deixando apenas cabeçalho
                      e navegação mobile visíveis. Sem tela de login, o dashboard
                      deve permanecer aberto.
                    */
                    if (!loginScreen){
                      revealDashboard();
                      return;
                    }
            
                    document.body.classList.add("locked", "dashboard");
                    show(loginScreen, "flex");
            
                    const sidebar = document.querySelector(".sidebar");
                    const main = document.querySelector(".main");
                    const topbar = document.querySelector(".topbar");
                    const content = document.querySelector(".content");
            
                    if (sidebar) hide(sidebar);
                    if (main) hide(main);
                    if (topbar) hide(topbar);
                    if (content) hide(content);
                  }
            
                  function doLogout(){
                    storageRemove(LOGIN_KEY);
                    LEGACY_KEYS.forEach(storageRemove);
            
                    const user = $("loginUser");
                    const pass = $("loginPass");
                    const error = $("loginError");
            
                    if (user) user.value = "";
                    if (pass) pass.value = "";
                    if (error) error.textContent = "";
            
                    lockDashboard();
                    setTimeout(() => user?.focus?.(), 100);
                  }
            
                  function bindLogin(){
                    const form = $("loginForm");
                    const user = $("loginUser");
                    const pass = $("loginPass");
                    const error = $("loginError");
                    const logout = $("logoutBtn");
            
                    if (form && !form.dataset.finalLoginBound){
                      form.dataset.finalLoginBound = "1";
            
                      form.addEventListener("submit", function(event){
                        event.preventDefault();
                        event.stopPropagation();
            
                        const enteredUser = String(user?.value || "").trim();
                        const enteredPass = String(pass?.value || "").trim();
            
                        const valid = VALID_LOGINS.some(item =>
                          item.user === enteredUser && item.pass === enteredPass
                        );
            
                        if (!valid){
                          if (error) error.textContent = "Usuário ou senha inválidos.";
                          pass?.select?.();
                          return;
                        }
            
                        if (error) error.textContent = "";
                        unlockDashboard();
            
                        try{
                          if (typeof renderPregame === "function") renderPregame();
                        }catch(renderError){
                          console.warn("Falha ao atualizar o pré-jogo após login:", renderError);
                        }
                      }, true);
                    }
            
                    if (logout){
                      logout.type = "button";
                      logout.onclick = doLogout;
                    }
                  }
            
                  window.forceLogout = doLogout;
            
                  window.forceLoginCheck = function(){
                    const loginScreenExists = Boolean($("loginScreen"));
            
                    /*
                      Sem tela de login no documento, não existe interface para o
                      usuário autenticar. Portanto, nunca escondemos o conteúdo.
                    */
                    if (!loginScreenExists){
                      revealDashboard();
                      return;
                    }
            
                    if (normalizeSession()) unlockDashboard();
                    else lockDashboard();
                  };
            
                  document.addEventListener("click", function(event){
                    const logoutButton = event.target?.closest?.("#logoutBtn, .btnLogout");
                    if (!logoutButton) return;
            
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    doLogout();
                  }, true);
            
                  function initializeLogin(){
                    bindLogin();
                    window.forceLoginCheck();
            
                    /*
                      Mantém uma verificação curta para páginas que montam o DOM
                      dinamicamente, mas sem esconder o dashboard no iPhone.
                    */
                    setTimeout(window.forceLoginCheck, 80);
                    setTimeout(window.forceLoginCheck, 250);
                  }
            
                  if (document.readyState === "loading"){
                    document.addEventListener("DOMContentLoaded", initializeLogin, { once:true });
                  }else{
                    initializeLogin();
                  }
                })();
            
                /* =========================================================
                   MERCADOS PREMIUM — RENDERIZAÇÃO NOVA DA ABA FILTROS
                   ========================================================= */
                (function(){
                  function _marketFilterByKey(key){
                    return (MARKET_FILTERS || []).find(f => f.key === key) || null;
                  }
            
                  function _marketLabel(key){
                    if (!key || key === "all") return "Todos";
                    return _marketFilterByKey(key)?.label || String(key).toUpperCase();
                  }
            
                  function _avg(list, getter){
                    const vals = (list || []).map(getter).map(Number).filter(Number.isFinite);
                    if (!vals.length) return 0;
                    return vals.reduce((a,b)=>a+b,0) / vals.length;
                  }
            
                  function _groupButton(key, label){
                    const exists = key === "all" || !!_marketFilterByKey(key);
                    const active = activeMarketFilter === key;
                    return `<button type="button" class="marketChipPremium ${active ? "is-active" : ""} ${exists ? "" : "is-disabled"}" ${exists ? `data-market-filter="${key}"` : "disabled"}>${label}</button>`;
                  }
            
            
                  function _marketCard(key, label, pct, sub, tone){
                    const exists = key === "all" || !!_marketFilterByKey(key);
                    const active = activeMarketFilter === key;
                    const val = Math.max(0, Math.min(99, Math.round(Number(pct || 0))));
                    return `<button type="button" class="marketHighlightCard tone-${tone || "blue"} ${active ? "is-active" : ""} ${exists ? "" : "is-disabled"}" ${exists ? `data-market-filter="${key}"` : "disabled"}>
                      <span class="marketHighlightLabel">${label}</span>
                      <strong>${val}%</strong>
                      <small>${sub || "confiança"}</small>
                      <i class="marketSpark"><b style="width:${val}%"></b></i>
                    </button>`;
                  }
            
                  function _strengthBars(p){
                    const n = Math.max(1, Math.min(10, Math.round(Number(p || 0) / 10)));
                    return Array.from({length:10}, (_,i)=>`<i class="${i < n ? "on" : ""}" style="height:${8 + i * 2}px"></i>`).join("");
                  }
            
                  function _trendBars(filtered){
                    const source = (filtered || []).slice(0, 10);
                    const vals = source.length ? source.map(j => Math.max(10, Math.min(95, Math.round(marketPercent(j, activeMarketFilter))))) : [52,58,63,66,71,68,73,76,70,74];
                    return vals.map(v => `<i style="height:${Math.max(12, Math.min(54, Math.round(v * .58)))}px"></i>`).join("");
                  }
            
                  function _dateShort(dateYMD){
                    if (!dateYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) return "—";
                    const [,m,d] = dateYMD.split("-");
                    return `${d}/${m}`;
                  }
            
                  function _dist(filtered){
                    const total = Math.max(1, filtered.length || 0);
                    const acima = filtered.filter(j => marketPercent(j, activeMarketFilter) >= 70).length;
                    const meio = filtered.filter(j => marketPercent(j, activeMarketFilter) >= 55 && marketPercent(j, activeMarketFilter) < 70).length;
                    const baixo = Math.max(0, (filtered.length || 0) - acima - meio);
                    return {acima, meio, baixo, total};
                  }
            
                  function _renderPremiumRows(filtered, dateYMD){
                    return filtered.slice(0, 40).map((j, idx) => {
                      const casa = safe(j?.casa, "Time A");
                      const fora = safe(j?.fora, "Time B");
                      const liga = safe(j?.liga, "—");
                      const hora = timeOnlyAM(dateYMD, safe(j?.hora, "—"));
                      const mp = Math.round(marketPercent(j, activeMarketFilter));
                      const proj = fmt(getProj(j), 1);
                      const p = Math.max(1, Math.min(100, mp));
                      const over25 = Math.round(Number(j?.markets?.prob?.over25 ?? 0));
                      const over35 = Math.round(Number(j?.markets?.prob?.over35 ?? 0));
                      return `
                        <article class="marketGameRow" data-match-center-row="1" data-match-id="${safe(j?.match_id || j?.id || j?.event_key, "")}" data-home="${escapeAttrLite(casa)}" data-away="${escapeAttrLite(fora)}" data-league="${escapeAttrLite(liga)}" data-time="${escapeAttrLite(hora)}">
                          <div class="marketGameTime"><strong>${hora}</strong><span>${_dateShort(dateYMD)}</span></div>
                          <div class="marketGameTeams">
                            ${teamNameHTML(casa, "marketTeamName")}<br>${teamNameHTML(fora, "marketTeamName")}
                            <div class="marketGameLeague">${escapeHtmlLite(liga)}</div>
                          </div>
                          <div class="marketGameMeta">
                            <div class="marketGameCompetition">${escapeHtmlLite(liga)}</div>
                            <div class="marketGameSub">Mercado: ${escapeHtmlLite(_marketLabel(activeMarketFilter))}</div>
                          </div>
                          <div class="marketGameCircleCell"><div class="marketCircle" style="--p:${p}%"><span>${mp}%</span></div></div>
                          <div class="marketGameFilterInfo">
                            <div class="marketGameStatsTitle">Força do filtro</div>
                            <div class="marketGameStatsSub">${escapeHtmlLite(_marketLabel(activeMarketFilter))}</div>
                          </div>
                          <div class="marketRealStats">
                            <span>Proj.<strong>${proj}</strong></span>
                            <span>+2.5<strong>${Number.isFinite(over25) && over25 ? over25 : Math.max(50, mp-9)}%</strong></span>
                            <span>+3.5<strong>${Number.isFinite(over35) && over35 ? over35 : Math.max(35, mp-18)}%</strong></span>
                          </div>
                          <div class="marketGameTrendCell">
                            <div class="marketTrendMini"><i style="height:12px"></i><i style="height:18px"></i><i style="height:24px"></i><i style="height:29px"></i><i style="height:22px"></i></div>
                          </div>
                          <div class="marketGameFinalCell">
                            <div class="marketGamePercent">${mp}%</div>
                            <div class="marketGameActions">
                              <button type="button" class="matchCenterMiniBtn" data-open-match-center="${idx}" data-match-id="${safe(j?.match_id || j?.id || j?.event_key, "")}" data-home="${escapeAttrLite(casa)}" data-away="${escapeAttrLite(fora)}" data-league="${escapeAttrLite(liga)}" data-time="${escapeAttrLite(hora)}">Match Center</button>
                            </div>
                          </div>
                        </article>`;
                    }).join("");
                  }
            
                  renderMarketFilters = function(){
                    if (!top1El) return;
                    top1El.closest(".panel")?.classList.add("is-market-scroll-panel");
            
                    const dateYMD = lastMarketDateYMD || lastDateYMD || dateInput?.value || todayAM_YMD();
                    const baseMarketList = Array.isArray(lastMarketGames) && lastMarketGames.length ? lastMarketGames : lastRawGames;
                    const games = enrichMarketsList(dedupeList(baseMarketList || []));
            
                    let filtered = games.filter(j => marketPass(j, activeMarketFilter));
                    filtered = filtered.sort((a,b) => {
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
            
                    const avgPercent = Math.round(_avg(filtered, j => marketPercent(j, activeMarketFilter)) || 0);
                    const avgProj = fmt(_avg(filtered, getProj), 1);
                    const recentAvg = fmt((_avg(filtered.slice(0,5), getProj) || _avg(filtered, getProj) || 0), 1);
                    const best = filtered[0];
                    const bestName = best ? `${safe(best.casa,"—")} x ${safe(best.fora,"—")}` : "—";
                    const bestPct = best ? `${Math.round(marketPercent(best, activeMarketFilter))}%` : "—";
                    const dist = _dist(filtered);
                    const acimaPct = Math.round((dist.acima / dist.total) * 100);
                    const meioPct = Math.round((dist.meio / dist.total) * 100);
                    const baixoPct = Math.max(0, 100 - acimaPct - meioPct);
            
                    window.__premiumFilteredGames = filtered;
                    const rows = _renderPremiumRows(filtered, dateYMD);
            
                    top1El.innerHTML = `
                      <div class="marketPremiumWrap">
                        <section class="marketHeroPanel">
                          <div class="marketHeroTitle">🔥 MERCADO ATIVO <small>análise inteligente do filtro selecionado</small></div>
            
                          <div class="marketHeroGrid">
                            <div class="marketActiveCard">
                              <span class="marketActiveBadge">ATIVO</span>
                              <div class="marketActiveName">${escapeHtmlLite(_marketLabel(activeMarketFilter))}</div>
                              <div class="marketActiveSub">${filtered.length} jogos encontrados</div>
                              <div class="marketActiveStrength"><strong>${avgPercent}%</strong><span>assertividade</span><div class="marketMiniBar"><i style="width:${Math.max(0,Math.min(100,avgPercent))}%"></i></div></div>
                            </div>
                            <div class="marketMetricCard"><div class="marketMetricLabel">Média projetada</div><div class="marketMetricValue">${avgProj}</div><div class="marketMetricSub">Escanteios por jogo</div></div>
                            <div class="marketMetricCard"><div class="marketMetricLabel">Média recente</div><div class="marketMetricValue">${recentAvg}</div><div class="marketMetricSub">Base dos melhores jogos</div></div>
                            <div class="marketMetricCard"><div class="marketMetricLabel">Força do mercado</div><div class="marketStrengthBars">${_strengthBars(avgPercent)}</div><div class="marketMetricSub"><b>${avgPercent}%</b> muito forte</div></div>
                            <div class="marketMetricCard"><div class="marketMetricLabel">Melhor jogo</div><div class="marketMetricValue green" style="font-size:15px;line-height:1.15">${escapeHtmlLite(bestName)}</div><div class="marketMetricSub">${bestPct} força do filtro</div></div>
                          </div>
            
                          <div class="marketHighlightsTitle">
                            <span>MERCADOS EM DESTAQUE</span>
                            <div class="allMarketsWrap">
                              <button type="button" class="marketSeeAll marketSeeAllBtn">Ver todos os mercados <span>⌄</span></button>
                              <div class="allMarketsDropdown" role="menu" aria-label="Todos os mercados disponíveis">
                                <div class="allMarketsCol">
                                  <h4>🚩 Escanteios</h4>
                                  <button type="button" data-market-filter="corners95">+9.5 Escanteios</button>
                                  <button type="button" data-market-filter="corners105">+10.5 Escanteios</button>
                                  <button type="button" data-market-filter="corners115">+11.5 Escanteios</button>
                                  <em>Por equipe</em>
                                  <button type="button" data-market-filter="homeCorners35">Casa +3.5 Escanteios</button>
                                  <button type="button" data-market-filter="homeCorners45">Casa +4.5 Escanteios</button>
                                  <button type="button" data-market-filter="awayCorners35">Visitante +3.5 Escanteios</button>
                                  <button type="button" data-market-filter="awayCorners45">Visitante +4.5 Escanteios</button>
                                  <em>1º tempo</em>
                                  <button type="button" data-market-filter="cornersHT35">+3.5 Escanteios HT</button>
                                  <button type="button" data-market-filter="cornersHT45">+4.5 Escanteios HT</button>
                                  <button type="button" data-market-filter="cornersHT55">+5.5 Escanteios HT</button>
                                </div>
                                <div class="allMarketsCol">
                                  <h4>⚽ Gols</h4>
                                  <button type="button" data-market-filter="btts">Ambas Marcam — Sim</button>
                                  <button type="button" data-market-filter="bttsNo">Ambas Marcam — Não</button>
                                  <button type="button" data-market-filter="over15">+1.5 Gols</button>
                                  <button type="button" data-market-filter="over25">+2.5 Gols</button>
                                  <button type="button" data-market-filter="over35">+3.5 Gols</button>
                                </div>
                                <div class="allMarketsCol">
                                  <h4>🟨 Cartões</h4>
                                  <button type="button" data-market-filter="cards25">+2.5 Cartões</button>
                                  <button type="button" data-market-filter="cards35">+3.5 Cartões</button>
                                  <button type="button" data-market-filter="cards45">+4.5 Cartões</button>
                                  <em>Por equipe</em>
                                  <button type="button" data-market-filter="homeCards15">Casa +1.5 Cartões</button>
                                  <button type="button" data-market-filter="homeCards25">Casa +2.5 Cartões</button>
                                  <button type="button" data-market-filter="awayCards15">Visitante +1.5 Cartões</button>
                                  <button type="button" data-market-filter="awayCards25">Visitante +2.5 Cartões</button>
                                </div>
                                <div class="allMarketsCol">
                                  <h4>🏆 Resultado</h4>
                                  <button type="button" data-market-filter="resultHome">Vitória da Casa</button>
                                  <button type="button" data-market-filter="resultDraw">Empate</button>
                                  <button type="button" data-market-filter="resultAway">Vitória do Visitante</button>
                                  <em>Dupla chance</em>
                                  <button type="button" data-market-filter="double1x">Casa ou Empate (1X)</button>
                                  <button type="button" data-market-filter="double12">Casa ou Visitante (12)</button>
                                  <button type="button" data-market-filter="doublex2">Empate ou Visitante (X2)</button>
                                </div>
                                <div class="allMarketsCol">
                                  <h4>⭐ Combinações</h4>
                                  <button type="button" data-market-filter="comboBttsCorners95">Ambas Marcam + +9.5 Escanteios</button>
                                  <button type="button" data-market-filter="comboOver25Corners95">+2.5 Gols + +9.5 Escanteios</button>
                                  <button type="button" data-market-filter="comboOver25Corners105">+2.5 Gols + +10.5 Escanteios</button>
                                  <button type="button" data-market-filter="comboHomeCorners85">Vitória Casa + +8.5 Escanteios</button>
                                  <button type="button" data-market-filter="comboAwayCorners85">Vitória Visitante + +8.5 Escanteios</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="marketHighlightsGrid">
                            ${_marketCard("corners95", "+9.5 Escanteios", Math.max(0, avgPercent-3), "confiança", "blue")}
                            ${_marketCard("corners105", "+10.5 Escanteios", Math.max(0, avgPercent-16), "confiança", "blue")}
                            ${_marketCard("btts", "Ambas Marcam", Math.max(0, avgPercent-7), "sim", "blue")}
                            ${_marketCard("cards25", "+2.5 Cartões", Math.max(0, avgPercent-10), "confiança", "blue")}
                            ${_marketCard("cards35", "+3.5 Cartões", Math.max(0, avgPercent-22), "confiança", "blue")}
                            ${_marketCard("over25", "+2.5 Gols", Math.max(0, avgPercent+2), "confiança", "blue")}
                            ${_marketCard("over15", "+1.5 Gols", Math.max(0, avgPercent+15), "confiança", "blue")}
                          </div>
                        </section>
            
                        <section class="marketListPanel">
                          <div class="marketListTop">
                            <div class="marketListTitle">⚽ Próximos Jogos (${filtered.length})</div>
                            <label class="marketListSort">Ordenar por:
                              <select id="marketSortSelect">
                                <option value="market" ${filterSortMode === "market" ? "selected" : ""}>Maior força do filtro</option>
                                <option value="time" ${filterSortMode === "time" ? "selected" : ""}>Horário</option>
                                <option value="corners" ${filterSortMode === "corners" ? "selected" : ""}>Projeção de cantos</option>
                              </select>
                            </label>
                          </div>
                          ${filtered.length ? `<div class="marketGameList">${rows}</div>` : `<div class="marketEmpty">Nenhum jogo encontrado para esse filtro nesta data.</div>`}
                        </section>
                      </div>`;
            
                    top1El.querySelectorAll("[data-market-filter]:not(.is-disabled)").forEach(btn => {
                      btn.addEventListener("click", () => {
                        activeMarketFilter = btn.getAttribute("data-market-filter") || "all";
                        renderMarketFilters();
                      });
                    });
            
                    const sort = top1El.querySelector("#marketSortSelect");
                    if (sort){
                      sort.addEventListener("change", () => {
                        filterSortMode = sort.value || "market";
                        renderMarketFilters();
                      });
                    }
            
                    top1El.querySelectorAll(".btnStats").forEach(btn => {
                      btn.addEventListener("click", (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
                        openMatchStats({ matchId: btn.dataset.matchId, home: btn.dataset.home, away: btn.dataset.away });
                      });
                    });
            
                    if (countTop) countTop.textContent = String(filtered.length);
                    updateIaBoxFromTop([]);
                  };
            
                  window.renderMarketFilters = renderMarketFilters;
                })();
                /* =========================================================
                   PACOTE FINAL — Correções de interação sem quebrar o motor
                   ========================================================= */
                (function(){
                  function addMarketFilter(key, label, short){
                    try{
                      if (!Array.isArray(MARKET_FILTERS)) return;
                      if (!MARKET_FILTERS.some(item => item && item.key === key)){
                        MARKET_FILTERS.push({ key, label, short: short || label });
                      }
                    }catch(e){}
                  }
            
                  // Volta as análises/filtros de cartões para a área de mercados.
                  addMarketFilter("cards25", "+2.5 CARTÕES", "+2.5 Cartões");
                  addMarketFilter("cards35", "+3.5 CARTÕES", "+3.5 Cartões");
                  addMarketFilter("cardsTeam", "CARTÕES POR TIME", "Cartões por time");
                  addMarketFilter("noCard28", "SEM CARTÃO ATÉ 28'", "Sem cartão 28'");
            
                  function fixMatchCenterLabels(root){
                    const base = root || document;
            
                    base.querySelectorAll(".matchCenterMiniBtn,.matchCenterBtn,[data-open-match-center]").forEach(btn => {
                      if (!btn) return;
                      const txt = String(btn.textContent || "").trim();
                      if (!txt || /Aberto/i.test(txt) || txt === "✓" || txt === "▥"){
                        btn.textContent = "Match Center";
                      } else if (/Match\s*Center/i.test(txt)){
                        btn.textContent = "Match Center";
                      }
                    });
            
                    base.querySelectorAll(".marketGameRow.match-center-selected,.premiumGameRow.match-center-selected").forEach(row => {
                      const mc = row.querySelector(".matchCenterMiniBtn,.matchCenterBtn,[data-open-match-center]");
                      if (mc){
                        mc.textContent = "Match Center";
                        mc.classList.add("is-open");
                      }
                    });
                  }
            
                  function makeCardButtonsLive(root){
                    const base = root || document;
                    base.querySelectorAll(".marketChipPremium.is-disabled").forEach(btn => {
                      const label = String(btn.textContent || "").toLowerCase();
                      if (label.includes("+2.5") && label.includes("cart")){
                        btn.disabled = false;
                        btn.classList.remove("is-disabled");
                        btn.setAttribute("data-market-filter", "cards25");
                      }
                      if (label.includes("+3.5") && label.includes("cart")){
                        btn.disabled = false;
                        btn.classList.remove("is-disabled");
                        btn.setAttribute("data-market-filter", "cards35");
                      }
                      if (label.includes("cartões por time") || label.includes("cartoes por time")){
                        btn.disabled = false;
                        btn.classList.remove("is-disabled");
                        btn.setAttribute("data-market-filter", "cardsTeam");
                      }
                      if (label.includes("sem cartão") || label.includes("sem cartao")){
                        btn.disabled = false;
                        btn.classList.remove("is-disabled");
                        btn.setAttribute("data-market-filter", "noCard28");
                      }
                    });
                  }
            
                  function compactRightRailLabels(root){
                    const base = root || document;
                    base.querySelectorAll("#desktopMatchRail .railTeam strong").forEach(el => {
                      el.title = el.textContent || "";
                    });
                  }
            
                  function postRenderFixes(){
                    fixMatchCenterLabels(document);
                    makeCardButtonsLive(document);
                    compactRightRailLabels(document);
                  }
            
                  try{
                    const originalRenderMarketFilters = renderMarketFilters;
                    renderMarketFilters = function(){
                      const result = originalRenderMarketFilters.apply(this, arguments);
                      setTimeout(postRenderFixes, 0);
                      setTimeout(postRenderFixes, 80);
                      return result;
                    };
                    window.renderMarketFilters = renderMarketFilters;
                  }catch(e){}
            
                  document.addEventListener("click", function(ev){
                    const marketBtn = ev.target.closest(".marketChipPremium[data-market-filter]");
                    if (marketBtn){
                      // deixa o render original cuidar do filtro; só corrige visual depois.
                      setTimeout(postRenderFixes, 80);
                      setTimeout(postRenderFixes, 180);
                    }
            
                    const mcBtn = ev.target.closest("[data-open-match-center],.matchCenterMiniBtn,.matchCenterBtn");
                    if (mcBtn){
                      setTimeout(postRenderFixes, 50);
                      setTimeout(postRenderFixes, 160);
                      setTimeout(postRenderFixes, 420);
                    }
                  }, true);
            
                  document.addEventListener("DOMContentLoaded", function(){
                    setTimeout(function(){
                      try{
                        if (typeof renderMarketFilters === "function" && currentView === "filters") renderMarketFilters();
                      }catch(e){}
                      postRenderFixes();
                    }, 220);
                  });
            
                  const observer = new MutationObserver(function(){
                    clearTimeout(window.__crPostRenderFixTimer);
                    window.__crPostRenderFixTimer = setTimeout(postRenderFixes, 60);
                  });
            
                  document.addEventListener("DOMContentLoaded", function(){
                    const target = document.getElementById("top1") || document.body;
                    if (target){
                      observer.observe(target, { childList:true, subtree:true, characterData:true });
                    }
                  });
                })();
                /* =========================================================
                   MATCH CENTER SOFASCORE STYLE — COMPARATIVO NO PAINEL DIREITO
                   - Não mexe no motor dos filtros
                   - Reaproveita /match_center quando existir
                   - Mantém botão Match Center e botão VER PARTIDA COMPLETA
                   ========================================================= */
                (function matchCenterSofaScoreRailPatch(){
                  function clean(v, fb="—"){
                    return (v === undefined || v === null || v === "") ? fb : String(v);
                  }
                  function num(v, fb=0){
                    const n = Number(v);
                    return Number.isFinite(n) ? n : fb;
                  }
                  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
                  function esc(v){
                    return String(v ?? "")
                      .replaceAll("&","&amp;")
                      .replaceAll("<","&lt;")
                      .replaceAll(">","&gt;")
                      .replaceAll('"',"&quot;")
                      .replaceAll("'","&#039;");
                  }
                  function initials(name, fb){
                    const s = clean(name, fb).trim();
                    const parts = s.split(/\s+/).filter(Boolean);
                    if (!parts.length) return fb;
                    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
                    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
                  }
                  function val(obj, paths, fb="—"){
                    for (const p of paths){
                      try{
                        const got = p.split(".").reduce((acc,k)=> acc == null ? undefined : acc[k], obj);
                        if (got !== undefined && got !== null && got !== "") return got;
                      }catch(e){}
                    }
                    return fb;
                  }
                  function marketName(game){
                    const raw = clean(game?.marketLabel || game?.mercado || game?.market || game?.filter_label || "", "");
                    if (raw) return raw;
                    const active = String(window.activeMarketFilter || "").toLowerCase();
                    if (active.includes("btts")) return "Ambas marcam";
                    if (active.includes("cards25")) return "+2.5 Cartões";
                    if (active.includes("cards35")) return "+3.5 Cartões";
                    if (active.includes("cardsteam")) return "Cartões por time";
                    if (active.includes("nocard")) return "Sem cartão 28'";
                    if (active.includes("105")) return "Escanteios +10.5";
                    if (active.includes("115")) return "Escanteios +11.5";
                    return "Escanteios +9.5";
                  }
                  function statusLabel(data){
                    if (data?.finished || String(data?.status || "").toLowerCase().includes("finished")) return "ENCERRADO";
                    if (data?.live || String(data?.status || "").toLowerCase().includes("live")) return "AO VIVO";
                    return "PRÉ-JOGO";
                  }
                  function minuteText(data){
                    const m = val(data, ["minute","elapsed","time.elapsed","match_minute"], "");
                    if (m !== "") return `${m}'`;
                    if (data?.finished) return "90'";
                    if (data?.live) return "AO VIVO";
                    return "—";
                  }
                  function compareRow(label, home, away, opts={}){
                    const hRaw = home;
                    const aRaw = away;
                    const h = num(home, 0);
                    const a = num(away, 0);
                    const total = Math.max(1, h + a);
                    const hp = opts.percent ? clamp(h,0,100) : clamp((h / total) * 100, 0, 100);
                    const ap = opts.percent ? clamp(a,0,100) : clamp((a / total) * 100, 0, 100);
                    const leftText = opts.percent ? `${Math.round(h)}%` : clean(hRaw, "—");
                    const rightText = opts.percent ? `${Math.round(a)}%` : clean(aRaw, "—");
                    return `
                      <div class="railCompareRow">
                        <div class="railCompareVal">${esc(leftText)}</div>
                        <div class="railCompareMiddle">
                          <span class="railCompareLabel">${esc(label)}</span>
                          <div class="railCompareBar">
                            <i class="railCompareHome" style="width:${hp/2}%"></i>
                            <i class="railCompareAway" style="width:${ap/2}%"></i>
                          </div>
                        </div>
                        <div class="railCompareVal">${esc(rightText)}</div>
                      </div>`;
                  }
                  function buildCompare(data, game){
                    const ch = val(data, ["corners.home","home_corners","stats.corners.home"], val(game,["corners_home"], "—"));
                    const ca = val(data, ["corners.away","away_corners","stats.corners.away"], val(game,["corners_away"], "—"));
                    const sh = val(data, ["shots.home","shots.total_home","home_shots","stats.shots.home"], "—");
                    const sa = val(data, ["shots.away","shots.total_away","away_shots","stats.shots.away"], "—");
                    const sth = val(data, ["shots_on_target.home","shots.target_home","home_shots_on_target","stats.shots_on_target.home"], "—");
                    const sta = val(data, ["shots_on_target.away","shots.target_away","away_shots_on_target","stats.shots_on_target.away"], "—");
                    const possH = val(data, ["possession.home","stats.possession.home"], "—");
                    const possA = val(data, ["possession.away","stats.possession.away"], "—");
                    const ph = val(data, ["pressure.home","dangerous_attacks.home","stats.dangerous_attacks.home"], "—");
                    const pa = val(data, ["pressure.away","dangerous_attacks.away","stats.dangerous_attacks.away"], "—");
                    const yh = val(data, ["cards.yellow_home","cards.home","yellow_cards.home","stats.yellow_cards.home"], "—");
                    const ya = val(data, ["cards.yellow_away","cards.away","yellow_cards.away","stats.yellow_cards.away"], "—");
                    const rh = val(data, ["cards.red_home","red_cards.home","stats.red_cards.home"], "0");
                    const ra = val(data, ["cards.red_away","red_cards.away","stats.red_cards.away"], "0");
            
                    const rows = [];
                    rows.push(compareRow("Escanteios", ch, ca));
                    rows.push(compareRow("Finalizações", sh, sa));
                    rows.push(compareRow("Finalizações no alvo", sth, sta));
                    if (possH !== "—" || possA !== "—") rows.push(compareRow("Posse de bola", parseFloat(String(possH).replace("%","")) || 0, parseFloat(String(possA).replace("%","")) || 0, {percent:true}));
                    rows.push(compareRow("Ataques perigosos", ph, pa));
                    rows.push(compareRow("Cartões amarelos", yh, ya));
                    rows.push(compareRow("Cartões vermelhos", rh, ra));
                    return rows.join("");
                  }
                  function buildMomentumSeries(data, pct){
                    const d = data || {};
            
                    function str(v){ return String(v ?? "").toLowerCase(); }
                    const rawStatus = str(d.status || d.status_raw || d.match_status || d.status_name || d.state || d.timer?.status);
                    const isFinished = !!(
                      d.finished ||
                      d.is_finished ||
                      d.match_finished ||
                      rawStatus.includes("finished") ||
                      rawStatus.includes("encerrado") ||
                      rawStatus.includes("final") ||
                      rawStatus === "ft" ||
                      rawStatus.includes("full time") ||
                      rawStatus.includes("after fulltime")
                    );
                    const isLive = !!(
                      d.live ||
                      d.is_live ||
                      d.inplay ||
                      rawStatus.includes("live") ||
                      rawStatus.includes("ao vivo") ||
                      rawStatus.includes("1h") ||
                      rawStatus.includes("2h") ||
                      rawStatus.includes("ht")
                    );
            
                    const minuteNowRaw = num(d.minute ?? d.match_minute ?? d.elapsed ?? d.time?.elapsed ?? d.timer?.minute, null);
                    const minuteLimit = isFinished ? 90 : (isLive ? clamp(minuteNowRaw || 1, 1, 90) : 0);
            
                    const buckets = Array.from({ length:90 }, (_, i) => ({
                      minute:i + 1,
                      home:0,
                      away:0,
                      events:[],
                      future: minuteLimit > 0 ? (i + 1 > minuteLimit) : false,
                      source:"empty"
                    }));
            
                    function parseMinute(value, fallback=null){
                      const n = parseInt(String(value ?? "").replace(/[^0-9]/g,""), 10);
                      if (!Number.isFinite(n)) return fallback;
                      return clamp(n, 1, 90);
                    }
            
                    function normalizeTeamName(value){
                      return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
                    }
            
                    function sameTeamLocal(value, target){
                      const a = normalizeTeamName(value);
                      const b = normalizeTeamName(target);
                      if (!a || !b) return false;
                      return a === b || a.includes(b) || b.includes(a);
                    }
            
                    function getEvents(){
                      const candidates = [d.events, d.eventos, d.timeline_events, d.timelineEvents, d.incidents, d.match_events, d.timeline];
                      for (const item of candidates){
                        if (Array.isArray(item) && item.length) return item;
                      }
                      return [];
                    }
            
                    function eventIconFromText(text){
                      const t = String(text || "").toLowerCase();
                      if (t.includes("goal") || t.includes("gol")) return "⚽";
                      if (t.includes("red") || t.includes("vermel")) return "🟥";
                      if (t.includes("yellow") || t.includes("amarelo") || t.includes("cart")) return "🟨";
                      if (t.includes("corner") || t.includes("escante")) return "⚑";
                      return "•";
                    }
            
                    function eventWeight(text){
                      const t = String(text || "").toLowerCase();
                      if (t.includes("goal") || t.includes("gol")) return 15;
                      if (t.includes("corner") || t.includes("escante")) return 9;
                      if (t.includes("shot on") || t.includes("on target") || t.includes("finalização no alvo") || t.includes("finalizacao no alvo")) return 8;
                      if (t.includes("shot") || t.includes("finalização") || t.includes("finalizacao")) return 6;
                      if (t.includes("danger") || t.includes("ataque perigoso") || t.includes("press")) return 5;
                      if (t.includes("red") || t.includes("vermel")) return 4;
                      if (t.includes("yellow") || t.includes("amarelo") || t.includes("cart")) return 3;
                      return 2;
                    }
            
                    const homeName = clean(d.home || d.casa || d.home_team || d.home_name || d.teams?.home?.name || "");
                    const awayName = clean(d.away || d.fora || d.away_team || d.away_name || d.teams?.away?.name || "");
            
                    function resolveSide(ev){
                      const side = String(ev?.side || ev?.team_side || ev?.teamType || ev?.team_type || "").toLowerCase();
                      const team = ev?.team || ev?.time || ev?.team_name || ev?.teamName || ev?.player_team || ev?.club || "";
                      if (side.includes("home") || side.includes("mandante") || side.includes("casa")) return "home";
                      if (side.includes("away") || side.includes("visitante") || side.includes("fora")) return "away";
                      if (sameTeamLocal(team, homeName)) return "home";
                      if (sameTeamLocal(team, awayName)) return "away";
                      return "home";
                    }
            
                    function addPressure(minute, side, amount, source){
                      const m = clamp(parseMinute(minute, 1), 1, 90);
                      const i = m - 1;
                      const v = Math.max(0, num(amount, 0));
                      if (side === "away") buckets[i].away += v;
                      else buckets[i].home += v;
                      buckets[i].source = source || buckets[i].source;
                    }
            
                    function addEvent(ev){
                      const minute = parseMinute(ev?.minute ?? ev?.time ?? ev?.elapsed ?? ev?.match_minute ?? ev?.minuto, null);
                      if (minute === null) return;
                      const side = resolveSide(ev);
                      const text = clean(ev?.type || ev?.event || ev?.name || ev?.label || ev?.detail || ev?.description || "Evento", "Evento");
                      const icon = eventIconFromText(text);
                      const weight = eventWeight(text);
                      buckets[minute - 1].events.push({ icon, side, text, minute });
                      addPressure(minute, side, weight, "events");
                      if (weight >= 5){
                        addPressure(Math.max(1, minute - 1), side, Math.round(weight * .45), "events");
                        addPressure(Math.min(90, minute + 1), side, Math.round(weight * .35), "events");
                      }
                    }
            
                    function pickTimeline(){
                      const candidates = [
                        d.pressure_series,
                        d.pressure_timeline,
                        d.pressureTimeline,
                        d.pressure_history,
                        d.pressureHistory,
                        d.momentum,
                        d.momentum_timeline,
                        d.momentumTimeline,
                        d.attack_momentum,
                        d.attacks_timeline,
                        d.dangerous_attacks_timeline,
                        d.timeline
                      ];
                      for (const item of candidates){
                        if (Array.isArray(item) && item.length) return item;
                      }
                      return [];
                    }
            
                    const timeline = pickTimeline();
                    if (timeline.length){
                      timeline.forEach((p, idx) => {
                        const minute = parseMinute(p?.minute ?? p?.time ?? p?.elapsed ?? p?.label, Math.round(((idx + 1) / timeline.length) * Math.max(1, minuteLimit || 90)));
                        const signed = num(p?.value ?? p?.momentum ?? p?.pressure, null);
                        const home = num(p?.home ?? p?.h ?? p?.mandante ?? p?.casa ?? p?.home_pressure ?? p?.home_dangerous_attacks ?? p?.dangerous_attacks_home ?? p?.attacks_home ?? p?.value_home, null);
                        const away = num(p?.away ?? p?.a ?? p?.visitante ?? p?.fora ?? p?.away_pressure ?? p?.away_dangerous_attacks ?? p?.dangerous_attacks_away ?? p?.attacks_away ?? p?.value_away, null);
            
                        if (home !== null || away !== null){
                          if (home !== null) addPressure(minute, "home", home, "timeline");
                          if (away !== null) addPressure(minute, "away", away, "timeline");
                        } else if (signed !== null){
                          if (signed >= 0) addPressure(minute, "home", signed, "timeline");
                          else addPressure(minute, "away", Math.abs(signed), "timeline");
                        }
                      });
                    }
            
                    getEvents().forEach(addEvent);
            
                    let total = buckets.reduce((s,b)=>s + b.home + b.away, 0);
            
                    // FALLBACK COM DADOS REAIS ACUMULADOS:
                    // Se a API não envia timeline por minuto, o gráfico não fica vazio.
                    // Ele distribui a pressão da partida inteira usando números reais: ataques perigosos,
                    // finalizações, escanteios, posse e placar/eventos. Em jogo ENCERRADO sempre ocupa 0'–90'.
                    if (total < 12 && (isLive || isFinished)){
                      const hDanger = num(d?.pressure?.home ?? d?.dangerous_attacks?.home ?? d?.stats?.dangerous_attacks?.home ?? d?.home_pressure ?? d?.dangerous_attacks_home ?? d?.attacks?.dangerous_home ?? d?.dangerous_attacks_home_total, 0);
                      const aDanger = num(d?.pressure?.away ?? d?.dangerous_attacks?.away ?? d?.stats?.dangerous_attacks?.away ?? d?.away_pressure ?? d?.dangerous_attacks_away ?? d?.attacks?.dangerous_away ?? d?.dangerous_attacks_away_total, 0);
            
                      const hShots = num(d?.shots?.home ?? d?.shots?.total_home ?? d?.home_shots ?? d?.stats?.shots?.home ?? d?.shots_home, 0);
                      const aShots = num(d?.shots?.away ?? d?.shots?.total_away ?? d?.away_shots ?? d?.stats?.shots?.away ?? d?.shots_away, 0);
            
                      const hShotsTarget = num(d?.shots_on_target?.home ?? d?.shots?.target_home ?? d?.home_shots_on_target ?? d?.stats?.shots_on_target?.home, 0);
                      const aShotsTarget = num(d?.shots_on_target?.away ?? d?.shots?.target_away ?? d?.away_shots_on_target ?? d?.stats?.shots_on_target?.away, 0);
            
                      const hCorners = num(d?.corners?.home ?? d?.home_corners ?? d?.stats?.corners?.home ?? d?.corners_home, 0);
                      const aCorners = num(d?.corners?.away ?? d?.away_corners ?? d?.stats?.corners?.away ?? d?.corners_away, 0);
            
                      const hPoss = num(d?.possession?.home ?? d?.stats?.possession?.home, null);
                      const aPoss = num(d?.possession?.away ?? d?.stats?.possession?.away, null);
                      const possHBonus = hPoss !== null && aPoss !== null ? Math.max(0, hPoss - aPoss) * .35 : 0;
                      const possABonus = hPoss !== null && aPoss !== null ? Math.max(0, aPoss - hPoss) * .35 : 0;
            
                      const gh = num(d?.goals?.home ?? d?.score?.home ?? d?.home_score, 0);
                      const ga = num(d?.goals?.away ?? d?.score?.away ?? d?.away_score, 0);
            
                      let hBaseTotal = (hDanger * 1.00) + (hShots * 1.9) + (hShotsTarget * 2.7) + (hCorners * 4.2) + possHBonus + (gh * 7);
                      let aBaseTotal = (aDanger * 1.00) + (aShots * 1.9) + (aShotsTarget * 2.7) + (aCorners * 4.2) + possABonus + (ga * 7);
            
                      // Último fallback ainda baseado no que existe no card: força do filtro/score.
                      // Só entra se a API não trouxe absolutamente nenhum acumulado.
                      if (hBaseTotal <= 0 && aBaseTotal <= 0){
                        const base = clamp(num(pct, 60), 35, 85) / 10;
                        hBaseTotal = base * 8;
                        aBaseTotal = base * 5;
                      }
            
                      const played = Math.max(1, minuteLimit || 90);
                      const segments = [
                        { a: 1,  b: 14, hw: 1.15, aw: .72 },
                        { a: 15, b: 29, hw: .70, aw: 1.06 },
                        { a: 30, b: 44, hw: 1.03, aw: .82 },
                        { a: 46, b: 59, hw: .58, aw: 1.16 },
                        { a: 60, b: 74, hw: 1.08, aw: .76 },
                        { a: 75, b: 90, hw: .86, aw: 1.02 }
                      ];
            
                      for (let m = 1; m <= played; m++){
                        if (m === 45) continue;
                        const seg = segments.find(x => m >= x.a && m <= x.b) || {hw:1, aw:1};
                        const hWave = Math.max(0, 0.28 + Math.sin(m * .31) * .46 + Math.sin(m * .083 + 1.2) * .34 + Math.sin(m * .71) * .12);
                        const aWave = Math.max(0, 0.28 + Math.sin(m * .27 + 2.0) * .46 + Math.sin(m * .091 + .45) * .34 + Math.sin(m * .67 + 1.4) * .12);
                        const h = Math.round((hBaseTotal / played) * 7.4 * hWave * seg.hw);
                        const a = Math.round((aBaseTotal / played) * 7.4 * aWave * seg.aw);
                        if (h > 0) addPressure(m, "home", h, "snapshot");
                        if (a > 0) addPressure(m, "away", a, "snapshot");
                      }
                    }
            
                    total = buckets.reduce((s,b)=>s + b.home + b.away, 0);
                    if (total <= 0) return [];
            
                    buckets._minuteLimit = minuteLimit || 90;
                    buckets._fullMatch = true;
                    return buckets;
                  }
            
                  function momentumSvg(series, homeLabel, awayLabel, homeName="Mandante", awayName="Visitante", gh="0", ga="0"){
                    const rawSeries = (series || [])
                      .filter(x => x && (num(x.home,null) !== null || num(x.away,null) !== null))
                      .map((x, idx) => ({
                        ...x,
                        home: Math.max(0, num(x.home,0)),
                        away: Math.max(0, num(x.away,0)),
                        minute: clamp(num(x.minute, idx + 1), 1, 90),
                        events: Array.isArray(x.events) ? x.events : []
                      }))
                      .sort((a,b) => a.minute - b.minute);
            
                    if (rawSeries.length < 2){
                      return `
                        <div class="pressureGraphBox pressureGraphEmpty pressureGraphSiteColors">
                          <div class="pressureGraphTopLine"></div>
                          <h3>GRÁFICO DE PRESSÃO</h3>
                          <div class="pressureGraphScoreMini">
                            <span>${esc(homeName)}</span><strong>${esc(gh)} - ${esc(ga)}</strong><span>${esc(awayName)}</span>
                          </div>
                          <div class="railMomentumEmptyText">Aguardando dados reais da API.</div>
                          <div class="pressureTimeHelp">0' 15' 30' 45' • INT • 45' 60' 75' 90+'</div>
                        </div>
                      `;
                    }
            
                    function looksAccumulated(list, key){
                      if (!Array.isArray(list) || list.length < 10) return false;
                      let grows = 0;
                      let equals = 0;
                      let drops = 0;
                      for (let i = 1; i < list.length; i++){
                        if (list[i][key] > list[i - 1][key]) grows++;
                        else if (list[i][key] === list[i - 1][key]) equals++;
                        else drops++;
                      }
                      return (grows + equals) >= Math.ceil((list.length - 1) * .86) && drops <= 2;
                    }
            
                    // Quando o backend/API manda pressão acumulada, transforma em pressão por bloco.
                    // Isso remove o desenho crescente artificial.
                    const accumulated = looksAccumulated(rawSeries, "home") || looksAccumulated(rawSeries, "away");
                    const baseSeries = accumulated
                      ? rawSeries.map((p, i) => {
                          const prev = rawSeries[i - 1] || { home:0, away:0 };
                          return {
                            ...p,
                            home: i === 0 ? Math.max(0, p.home) : Math.max(0, p.home - prev.home),
                            away: i === 0 ? Math.max(0, p.away) : Math.max(0, p.away - prev.away)
                          };
                        })
                      : rawSeries;
            
                    // Agrupa em blocos de 3 minutos para as barras ficarem encorpadas e legíveis.
                    const bucketSize = 3;
                    const grouped = [];
                    for (let start = 1; start <= 90; start += bucketSize){
                      const end = Math.min(90, start + bucketSize - 1);
                      const items = baseSeries.filter(p => p.minute >= start && p.minute <= end);
                      const home = items.reduce((s,p) => s + Math.max(0, num(p.home,0)), 0);
                      const away = items.reduce((s,p) => s + Math.max(0, num(p.away,0)), 0);
                      const events = items.flatMap(p => Array.isArray(p.events) ? p.events : []);
                      grouped.push({
                        minute: Math.round((start + end) / 2),
                        home,
                        away,
                        events,
                        future: items.length ? items.every(p => p.future) : false
                      });
                    }
            
                    let cleanSeries = grouped.filter(p => (p.home + p.away) > 0 || p.events.length);
                    if (cleanSeries.length < 2) cleanSeries = grouped;
            
                    // Se ainda ficar muito linear, aplica leve variação determinística só na distribuição visual,
                    // sem mudar os totais do comparativo da partida.
                    cleanSeries = cleanSeries.map((p, i) => {
                      const hWave = .72 + (Math.sin((i + 1) * 1.37) + 1) * .24 + (Math.sin((i + 2) * .61) * .10);
                      const aWave = .72 + (Math.sin((i + 3) * 1.21) + 1) * .24 + (Math.sin((i + 1) * .73) * .10);
                      return {
                        ...p,
                        home: Math.max(0, p.home * hWave),
                        away: Math.max(0, p.away * aWave)
                      };
                    });
            
                    const w = 344, h = 222;
                    const leftPad = 20, rightPad = 20;
                    const topBarH = 6;
                    const titleY = 29;
                    const namesY = 55;
                    const mid = 116;
                    const plotTop = 70;
                    const plotBottom = 167;
                    const plotW = w - leftPad - rightPad;
                    const amp = 43;
                    const max = Math.max(8, ...cleanSeries.map(x => Math.max(x.home, x.away)));
                    const slot = plotW / cleanSeries.length;
                    const barW = Math.max(6.8, Math.min(9.4, slot * .70));
            
                    const tickMarks = [0,15,30,45,60,75,90].map(t => {
                      const x = leftPad + plotW * (t / 90);
                      const label = t === 90 ? "90+" : String(t);
                      const anchor = t === 0 ? "start" : (t === 90 ? "end" : "middle");
                      return `
                        <line x1="${x.toFixed(1)}" y1="${plotTop}" x2="${x.toFixed(1)}" y2="${plotBottom}" stroke="rgba(255,255,255,.10)" stroke-width="1" stroke-dasharray="3 7"/>
                        <text x="${x.toFixed(1)}" y="184" text-anchor="${anchor}" font-size="9" fill="#d9e6f2" font-weight="900">${label}'</text>
                      `;
                    }).join("");
            
                    const intervalX = leftPad + plotW * .5;
                    const intervalMarker = `
                      <line x1="${intervalX.toFixed(1)}" y1="${plotTop-8}" x2="${intervalX.toFixed(1)}" y2="${plotBottom+4}" stroke="rgba(112,99,255,.55)" stroke-width="1.2" stroke-dasharray="5 6"/>
                      <rect x="${(intervalX-16).toFixed(1)}" y="190" width="32" height="17" rx="5" fill="rgba(2,8,12,.92)" stroke="rgba(112,99,255,.35)"/>
                      <text x="${intervalX.toFixed(1)}" y="202" text-anchor="middle" font-size="9" fill="#ffffff" font-weight="950">INT</text>
                    `;
            
                    const bars = cleanSeries.map((x,i)=>{
                      const bx = leftPad + (i * slot) + (slot - barW) / 2;
                      const hVal = Math.max(2.4, (x.home / max) * amp);
                      const aVal = Math.max(2.4, (x.away / max) * amp);
                      const opacity = x.future ? .22 : 1;
                      return `
                        ${x.home > 0 ? `<rect x="${bx.toFixed(1)}" y="${(mid-hVal-4).toFixed(1)}" width="${barW.toFixed(1)}" height="${hVal.toFixed(1)}" rx="2.6" fill="url(#pressureHomeBlueGrad)" opacity="${opacity}"/>` : ""}
                        ${x.away > 0 ? `<rect x="${bx.toFixed(1)}" y="${(mid+4).toFixed(1)}" width="${barW.toFixed(1)}" height="${aVal.toFixed(1)}" rx="2.6" fill="url(#pressureAwayPurpleGrad)" opacity="${opacity}"/>` : ""}
                      `;
                    }).join("");
            
                    const markers = rawSeries.flatMap(x => (x.events || [])
                      .filter(ev => {
                        const txt = String(ev.text || "").toLowerCase();
                        const icon = String(ev.icon || "");
                        return icon.includes("⚽") || icon.includes("🟨") || icon.includes("🟥") || txt.includes("gol") || txt.includes("goal") || txt.includes("cart") || txt.includes("yellow") || txt.includes("red");
                      })
                      .slice(0,3)
                      .map(ev => {
                        const minute = clamp(num(ev.minute ?? x.minute, 1), 1, 90);
                        const ex = leftPad + plotW * (minute / 90);
                        const icon = String(ev.icon || "•");
                        const y = plotTop - 10;
                        return `
                          <line x1="${ex.toFixed(1)}" y1="${plotTop-2}" x2="${ex.toFixed(1)}" y2="${plotBottom}" stroke="rgba(255,255,255,.32)" stroke-width="1" stroke-dasharray="4 4"/>
                          <circle cx="${ex.toFixed(1)}" cy="${y}" r="7" fill="rgba(6,12,18,.92)" stroke="rgba(255,255,255,.70)" stroke-width="1"/>
                          <text x="${ex.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle" font-size="9">${esc(icon)}</text>
                        `;
                      })).join("");
            
                    return `
                      <div class="pressureGraphBox pressureGraphSiteColors">
                        <svg class="pressureGraphSvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Gráfico de pressão da partida com intervalo">
                          <defs>
                            <linearGradient id="pressureBgGradSite" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stop-color="#071018"/>
                              <stop offset="1" stop-color="#031018"/>
                            </linearGradient>
                            <linearGradient id="pressureTopBluePurpleGrad" x1="0" x2="1" y1="0" y2="0">
                              <stop offset="0" stop-color="#139bff"/>
                              <stop offset="1" stop-color="#7c3cff"/>
                            </linearGradient>
                            <linearGradient id="pressureHomeBlueGrad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stop-color="#24a8ff"/>
                              <stop offset="1" stop-color="#0877ff"/>
                            </linearGradient>
                            <linearGradient id="pressureAwayPurpleGrad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stop-color="#a66cff"/>
                              <stop offset="1" stop-color="#6d35ff"/>
                            </linearGradient>
                          </defs>
                          <rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="url(#pressureBgGradSite)"/>
                          <rect x="0" y="0" width="${w}" height="${topBarH}" fill="url(#pressureTopBluePurpleGrad)" opacity=".96"/>
                          <text x="${w/2}" y="${titleY}" text-anchor="middle" font-size="16" fill="#f4fbff" font-weight="950" letter-spacing="1.1">GRÁFICO DE PRESSÃO</text>
                          <text x="108" y="${namesY}" text-anchor="end" font-size="11" fill="#e9f5ff" font-weight="950">${esc(homeName)}</text>
                          <text x="${w/2}" y="${namesY+2}" text-anchor="middle" font-size="21" fill="#f4fbff" font-weight="950">${esc(gh)} - ${esc(ga)}</text>
                          <text x="236" y="${namesY}" text-anchor="start" font-size="11" fill="#e9f5ff" font-weight="950">${esc(awayName)}</text>
            
                          ${tickMarks}
                          <line x1="${leftPad}" y1="${mid}" x2="${w-rightPad}" y2="${mid}" stroke="#45b6ff" stroke-width="2.2"/>
                          ${bars}
                          ${intervalMarker}
                          ${markers}
                        </svg>
                        <div class="pressureGraphLegend">
                          <span><i class="home"></i>${esc(homeLabel)}</span>
                          <span><i class="away"></i>${esc(awayLabel)}</span>
                        </div>
                      </div>`;
                  }
            
                    function eventIcon(text){
                    const t = String(text || "").toLowerCase();
                    if (t.includes("cart") && t.includes("vermel")) return "🟥";
                    if (t.includes("cart")) return "🟨";
                    if (t.includes("escante") || t.includes("corner")) return "🚩";
                    if (t.includes("gol")) return "⚽";
                    if (t.includes("substit")) return "🔁";
                    if (t.includes("finaliza") || t.includes("shot")) return "🎯";
                    return "•";
                  }
                  function buildEvents(data){
                    const events = data?.events || data?.eventos || data?.timeline_events || [];
                    if (!Array.isArray(events) || !events.length){
                      return `<div class="railEventsEmptyPro">Escolha um jogo para abrir a leitura do Match Center.<br>Os eventos aparecem aqui em tempo real.</div>`;
                    }
                    return `<div class="railEventsCompact">${events.slice(-18).reverse().map(ev=>{
                      const min = clean(ev.minute ?? ev.time ?? ev.elapsed ?? "", "—");
                      const type = clean(ev.type ?? ev.event ?? ev.name ?? "Evento", "Evento");
                      const team = clean(ev.team ?? ev.team_name ?? "", "");
                      const player = clean(ev.player ?? ev.player_name ?? "", "");
                      const text = [type, team, player].filter(Boolean).join(" — ");
                      return `<div class="railEventLineCompact"><span class="railEventMinute">${esc(min)}'</span><span class="railEventIcon">${eventIcon(text)}</span><span class="railEventText">${esc(text)}</span></div>`;
                    }).join("")}</div>`;
                  }
            
            
                  /* =========================================================
                     MEMÓRIA DO GRÁFICO DE PRESSÃO
                     - Enquanto o jogo está ao vivo, salva os pontos no navegador
                     - Quando termina, reaproveita o histórico salvo para manter o pós-jogo
                     ========================================================= */
                  const PRESSURE_STORE_PREFIX = "cr_pressure_graph_v2:";
            
                  function pressureMatchKey(matchId, home, away, league, time){
                    const raw = matchId || `${home}|${away}|${league}|${time}`;
                    return PRESSURE_STORE_PREFIX + String(raw || "sem-id")
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9|:_-]+/g, "-")
                      .slice(0, 180);
                  }
            
                  function plainPressureSeries(series){
                    return (Array.isArray(series) ? series : []).map(x => ({
                      minute: clamp(num(x?.minute, 1), 1, 90),
                      home: Math.max(0, num(x?.home, 0)),
                      away: Math.max(0, num(x?.away, 0)),
                      future: !!x?.future,
                      source: clean(x?.source || "saved", "saved"),
                      events: Array.isArray(x?.events) ? x.events.slice(0, 8).map(ev => ({
                        icon: clean(ev?.icon || "•", "•"),
                        side: clean(ev?.side || "home", "home"),
                        text: clean(ev?.text || "Evento", "Evento"),
                        minute: clamp(num(ev?.minute ?? x?.minute, 1), 1, 90)
                      })) : []
                    })).filter(x => x.home > 0 || x.away > 0 || x.events.length);
                  }
            
                  function mergePressureSeries(saved, current, finished=false){
                    const map = new Map();
            
                    function put(item, priority){
                      const m = clamp(num(item?.minute, 1), 1, 90);
                      const old = map.get(m) || { minute:m, home:0, away:0, events:[], future:false, source:"saved", priority:0 };
                      const home = Math.max(old.home || 0, Math.max(0, num(item?.home, 0)));
                      const away = Math.max(old.away || 0, Math.max(0, num(item?.away, 0)));
                      const events = [...(old.events || [])];
                      (Array.isArray(item?.events) ? item.events : []).forEach(ev => {
                        const key = `${ev?.minute || m}|${ev?.icon || ""}|${ev?.text || ""}`;
                        if (!events.some(e => `${e?.minute || m}|${e?.icon || ""}|${e?.text || ""}` === key)) events.push(ev);
                      });
                      map.set(m, {
                        minute:m,
                        home,
                        away,
                        events:events.slice(0, 10),
                        future: finished ? false : !!item?.future,
                        source: priority >= old.priority ? clean(item?.source || old.source || "saved", "saved") : old.source,
                        priority: Math.max(priority, old.priority || 0)
                      });
                    }
            
                    plainPressureSeries(saved).forEach(x => put(x, 1));
                    plainPressureSeries(current).forEach(x => put(x, 2));
            
                    const out = Array.from(map.values())
                      .sort((a,b) => a.minute - b.minute)
                      .map(({priority, ...x}) => x);
            
                    out._minuteLimit = finished ? 90 : (current?._minuteLimit || saved?._minuteLimit || 90);
                    out._fullMatch = true;
                    return out;
                  }
            
                  function loadPressureSeries(key){
                    try{
                      const raw = localStorage.getItem(key);
                      if (!raw) return [];
                      const parsed = JSON.parse(raw);
                      return Array.isArray(parsed?.series) ? parsed.series : [];
                    }catch(_){ return []; }
                  }
            
                  function savePressureSeries(key, series, meta={}){
                    try{
                      const cleanSeries = plainPressureSeries(series).slice(0, 90);
                      if (!cleanSeries.length) return;
                      localStorage.setItem(key, JSON.stringify({
                        updatedAt: Date.now(),
                        meta,
                        series: cleanSeries
                      }));
                    }catch(_){ /* localStorage pode estar cheio ou bloqueado */ }
                  }
            
                  function pressureSeriesWithMemory({ data, pct, matchId, home, away, league, time }){
                    const key = pressureMatchKey(matchId, home, away, league, time);
                    const current = buildMomentumSeries(data || {}, pct);
                    const saved = loadPressureSeries(key);
                    const finished = !!data?.finished;
                    const live = !!data?.live;
                    const merged = mergePressureSeries(saved, current, finished);
            
                    // Salva em todo refresh do Match Center durante o jogo.
                    // Quando encerrar, o último gráfico completo permanece salvo para o pós-jogo.
                    if ((live || finished) && merged.length){
                      savePressureSeries(key, merged, { matchId, home, away, league, time, finished, live });
                    }
            
                    if (finished && merged.length) return merged;
                    if (current.length) return merged.length ? merged : current;
                    return saved.length ? mergePressureSeries(saved, [], finished) : [];
                  }
            
                  function renderRail({rail, game, data}){
                    const home = clean(data?.home || game?.casa || game?.home || game?.home_team || game?.home_name, "Mandante");
                    const away = clean(data?.away || game?.fora || game?.away || game?.away_team || game?.away_name, "Visitante");
                    const league = clean(data?.league || game?.liga || game?.league_name || game?.league?.name, "Liga");
                    const time = clean(data?.time || game?.hora || game?.time, "—");
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id || data?.match_id, "");
                    const pct = clamp(Math.round(num(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score, 69)), 0, 100);
                    const gh = clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? 0, "0");
                    const ga = clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? 0, "0");
                    const st = statusLabel(data || {});
                    const min = minuteText(data || {});
                    const progress = data?.finished ? 100 : (data?.live ? clamp(num(min.replace("'",""),45), 8, 96) : 0);
                    const series = pressureSeriesWithMemory({ data:data || {}, pct, matchId, home, away, league, time });
                    const hShort = initials(home,"MA");
                    const aShort = initials(away,"VI");
            
                    rail.innerHTML = `
                      <section class="railCard matchRailCard railSofaHero ${data?.live ? "is-live" : ""} ${data?.finished ? "is-finished" : ""}">
                        <div class="railTitle"><span>▣ MATCH CENTER</span><b>${esc(st)}</b></div>
                        <div class="railSofaTeams">
                          <div class="railSofaTeam"><div class="railBadge">${esc(hShort)}</div><strong title="${esc(home)}">${esc(home)}</strong></div>
                          <div class="railSofaScore"><small>${esc(league)}</small><strong>${esc(gh)} - ${esc(ga)}</strong><span>${esc(data?.live ? min : (time || "Escolha um jogo"))}</span></div>
                          <div class="railSofaTeam"><div class="railBadge away">${esc(aShort)}</div><strong title="${esc(away)}">${esc(away)}</strong></div>
                        </div>
                        <div class="railProgress"><i style="width:${progress}%"></i></div>
                      </section>
            
                      <section class="railCard railCompareCard">
                        <div class="railSofaTabs"><span class="railSofaTab is-active">Detalhes</span><span class="railSofaTab">Estatísticas</span><span class="railSofaTab">Eventos</span><span class="railSofaTab">Índice</span></div>
                        <h3>COMPARATIVO DA PARTIDA</h3>
                        <div class="railCompareList">${buildCompare(data || {}, game || {})}</div>
                      </section>
            
                      <section class="railCard railMomentumCard railPressureGraphCard">
                        <div class="railPressureHead"><h3>GRÁFICO DE PRESSÃO</h3><b>${data?.live ? "AO VIVO" : (data?.finished ? "PÓS-JOGO" : "PRÉ-JOGO")}</b></div>
                        ${momentumSvg(series, hShort, aShort, home, away, gh, ga)}
                      </section>
            
                      <section class="railCard railEventsCard">
                        <h3>EVENTOS DA PARTIDA</h3>
                        ${buildEvents(data || {})}
                      </section>
            
                      <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}" data-time="${esc(time)}">VER PARTIDA COMPLETA →</button>
                    `;
                  }
            
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game, list){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail || !game) return;
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id, "");
                    renderRail({rail, game, data:null});
                    if (!matchId) return;
                    try{
                      const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, {cache:"no-store"});
                      if (!res.ok) return;
                      const data = await res.json();
                      if (data && !data.error) renderRail({rail, game, data});
                    }catch(err){
                      console.warn("Match Center comparativo falhou:", err);
                    }
                  };
                })();
            
            
                /* =========================================================
                   PATCH VISUAL — GRÁFICO DE PRESSÃO estilo pós-jogo
                   ========================================================= */
                (function injectPressureGraphStyle(){
                  if (document.getElementById("pressureGraphStylePatch")) return;
                  const style = document.createElement("style");
                  style.id = "pressureGraphStylePatch";
                  style.textContent = `
                    .railPressureGraphCard{
                      padding:12px !important;
                      overflow:hidden;
                    }
                    .railPressureGraphCard .railPressureHead{
                      margin-bottom:8px;
                    }
                    .pressureGraphBox{
                      position:relative;
                      width:100%;
                      border-radius:12px;
                      overflow:hidden;
                      background:#031923;
                      border:1px solid rgba(255,255,255,.08);
                      box-shadow:inset 0 0 0 1px rgba(255,255,255,.025), 0 14px 36px rgba(0,0,0,.28);
                    }
                    .pressureGraphSvg{
                      display:block;
                      width:100%;
                      height:178px;
                      filter:drop-shadow(0 8px 16px rgba(0,0,0,.28));
                    }
                    .pressureGraphLegend{
                      display:flex;
                      justify-content:center;
                      gap:18px;
                      padding:6px 8px 8px;
                      font-size:10px;
                      font-weight:900;
                      color:#cfe3f7;
                      text-transform:uppercase;
                      letter-spacing:.04em;
                      background:rgba(0,0,0,.18);
                    }
                    .pressureGraphLegend span{
                      display:inline-flex;
                      align-items:center;
                      gap:6px;
                    }
                    .pressureGraphLegend i{
                      width:9px;
                      height:9px;
                      border-radius:2px;
                      display:inline-block;
                    }
                    .pressureGraphLegend i.home{ background:#2f96ff; }
                    .pressureGraphLegend i.away{ background:#ff1f5b; }
                    .pressureGraphEmpty{
                      min-height:178px;
                      display:flex;
                      flex-direction:column;
                      align-items:center;
                      justify-content:center;
                      gap:8px;
                      color:#cbd5e1;
                    }
                    .pressureGraphTopLine{
                      position:absolute;
                      top:0;
                      left:0;
                      right:0;
                      height:14px;
                      background:#ff0045;
                    }
                    .pressureGraphEmpty h3{
                      margin:8px 0 0;
                      font-size:18px;
                      letter-spacing:.08em;
                      color:#fff;
                    }
                    .pressureGraphScoreMini{
                      display:flex;
                      align-items:center;
                      gap:10px;
                      font-size:11px;
                      font-weight:950;
                      color:#fff;
                      text-transform:uppercase;
                    }
                    .pressureGraphScoreMini strong{
                      font-size:20px;
                    }
                  `;
                  document.head.appendChild(style);
                })();
            
                /* =========================================================
                   TOPBAR CLEANUP — evita duplicação visual do Premium/Sair
                   O menu premium oficial agora fica no HTML (.accountMenu).
                   ========================================================= */
                (function(){
                  function cleanupTopbarDuplicates(){
                    const authBar = document.getElementById("premiumAuthBar");
                    if (authBar) authBar.remove();
            
                    document.querySelectorAll(".premiumAuthBar, .premiumLoginBtn, .premiumUserPill, .premiumLogoutBtn").forEach(el => {
                      const insideAccount = el.closest(".accountMenu");
                      if (!insideAccount) el.remove();
                    });
                  }
            
                  document.addEventListener("DOMContentLoaded", cleanupTopbarDuplicates);
                  setTimeout(cleanupTopbarDuplicates, 250);
                  setTimeout(cleanupTopbarDuplicates, 1000);
                })();
            
                /* =========================================================
                   PATCH FINAL — PRESSURE GRAPH NAS CORES DO SITE + INTERVALO
                   ========================================================= */
                (function injectPressureGraphFinalSiteColors(){
                  if (document.getElementById("pressureGraphFinalSiteColors")) return;
                  const style = document.createElement("style");
                  style.id = "pressureGraphFinalSiteColors";
                  style.textContent = `
                    .railMomentumCard.railPressureGraphCard{
                      padding:12px !important;
                      border-color:rgba(30,215,96,.16) !important;
                      background:linear-gradient(180deg, rgba(7,16,24,.96), rgba(4,10,16,.98)) !important;
                    }
                    .pressureGraphSiteColors{
                      background:#071018 !important;
                      border:1px solid rgba(30,215,96,.16) !important;
                      box-shadow:inset 0 0 0 1px rgba(255,255,255,.025), 0 12px 30px rgba(0,0,0,.28), 0 0 22px rgba(30,215,96,.035) !important;
                    }
                    .pressureGraphSvg{
                      height:190px !important;
                      width:100% !important;
                      display:block !important;
                      filter:drop-shadow(0 8px 16px rgba(0,0,0,.28));
                    }
                    .pressureGraphLegend{
                      background:rgba(0,0,0,.18) !important;
                      color:#e8f3ff !important;
                      gap:18px !important;
                    }
                    .pressureGraphLegend i.home{ background:#1ed760 !important; box-shadow:0 0 10px rgba(30,215,96,.30); }
                    .pressureGraphLegend i.away{ background:#4aa3df !important; box-shadow:0 0 10px rgba(74,163,223,.25); }
                    .pressureTimeHelp{
                      font-size:10px;
                      font-weight:900;
                      color:#9fb2c7;
                      letter-spacing:.03em;
                    }
                  `;
                  document.head.appendChild(style);
                })();
                /* =========================================================
                   LOADER PREMIUM — CORNERS RADAR
                   Substitui o carregamento simples por um painel animado.
                   ========================================================= */
                var __crPremiumLoaderTimer = null;
                var __crPremiumLoaderPct = 14;
                var __crPremiumLoaderStep = 0;
            
                function crPremiumLoaderEscape(value){
                  if (typeof escapeHtmlLite === "function") return escapeHtmlLite(value);
                  return String(value ?? "")
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")
                    .replaceAll('"', "&quot;")
                    .replaceAll("'", "&#039;");
                }
            
                function crLoaderMessageByStep(step){
                  const messages = [
                    "Conectando à API e validando a data selecionada...",
                    "Buscando partidas disponíveis para o dia...",
                    "Cruzando estatísticas, mercados e força do filtro...",
                    "Calculando projeções e melhores oportunidades...",
                    "Preparando Match Center e leitura final..."
                  ];
                  return messages[Math.max(0, Math.min(messages.length - 1, step))];
                }
            
                function crLoaderStepClass(index, activeStep){
                  if (index < activeStep) return "done";
                  if (index === activeStep) return "active";
                  return "";
                }
            
                function crBuildPremiumLoader(label){
                  const title = crPremiumLoaderEscape(label || "Corners Radar está analisando os jogos");
                  const steps = [
                    { icon:"↔", text:"Conectando API" },
                    { icon:"⌕", text:"Buscando partidas" },
                    { icon:"▥", text:"Analisando estatísticas" },
                    { icon:"▦", text:"Calculando mercados" },
                    { icon:"⚑", text:"Finalizando" }
                  ];
            
                  return `
                    <div class="crPremiumLoader" aria-live="polite" data-cr-premium-loader="1">
                      <div class="crLoaderInner">
                        <div class="crRadarOrb" aria-hidden="true">
                          <span class="crRadarSweep"></span>
                          <span class="crRadarLogo">CR</span>
                        </div>
            
                        <div>
                          <h2 class="crLoaderTitle"><b>Corners Radar</b> está analisando os jogos</h2>
                          <p class="crLoaderSub" data-cr-loader-message>${title}</p>
                        </div>
            
                        <div class="crLoaderSteps" data-cr-loader-steps>
                          ${steps.map((s, i) => `
                            <div class="crLoaderStep ${crLoaderStepClass(i, __crPremiumLoaderStep)}" data-cr-step="${i}">
                              <i>${s.icon}</i>
                              <span>${s.text}</span>
                            </div>
                          `).join("")}
                        </div>
            
                        <div class="crProgressWrap">
                          <div class="crProgressTrack"><span class="crProgressBar" data-cr-loader-bar style="width:${__crPremiumLoaderPct}%"></span></div>
                          <strong class="crProgressPct" data-cr-loader-pct>${__crPremiumLoaderPct}%</strong>
                        </div>
            
                        <div class="crLoaderHint">Isso pode levar alguns segundos...</div>
                      </div>
            
                      <div class="crSkeletonRows" aria-hidden="true">
                        ${Array.from({length:5}).map((_, idx) => `
                          <div class="crSkeletonRow">
                            <span class="crSkeletonDot"></span>
                            <span class="crSkeletonLine long"></span>
                            <span class="crSkeletonLine mid"></span>
                            <span class="crSkeletonLine short"></span>
                            <span class="crSkeletonLine mid"></span>
                          </div>
                        `).join("")}
                      </div>
                    </div>
                  `;
                }
            
                function crStartPremiumLoaderLoop(){
                  if (__crPremiumLoaderTimer) clearInterval(__crPremiumLoaderTimer);
            
                  __crPremiumLoaderPct = Math.max(14, Math.min(__crPremiumLoaderPct || 14, 86));
                  __crPremiumLoaderStep = Math.max(0, Math.min(__crPremiumLoaderStep || 0, 4));
            
                  __crPremiumLoaderTimer = setInterval(function(){
                    const loader = document.querySelector("[data-cr-premium-loader]");
                    if (!loader){
                      clearInterval(__crPremiumLoaderTimer);
                      __crPremiumLoaderTimer = null;
                      return;
                    }
            
                    const nextPct = Math.min(94, __crPremiumLoaderPct + Math.floor(4 + Math.random() * 9));
                    __crPremiumLoaderPct = nextPct;
            
                    if (nextPct >= 25) __crPremiumLoaderStep = Math.max(__crPremiumLoaderStep, 1);
                    if (nextPct >= 48) __crPremiumLoaderStep = Math.max(__crPremiumLoaderStep, 2);
                    if (nextPct >= 68) __crPremiumLoaderStep = Math.max(__crPremiumLoaderStep, 3);
                    if (nextPct >= 86) __crPremiumLoaderStep = Math.max(__crPremiumLoaderStep, 4);
            
                    const bar = loader.querySelector("[data-cr-loader-bar]");
                    const pct = loader.querySelector("[data-cr-loader-pct]");
                    const msg = loader.querySelector("[data-cr-loader-message]");
            
                    if (bar) bar.style.width = nextPct + "%";
                    if (pct) pct.textContent = nextPct + "%";
                    if (msg) msg.textContent = crLoaderMessageByStep(__crPremiumLoaderStep);
            
                    loader.querySelectorAll("[data-cr-step]").forEach(function(el){
                      const i = Number(el.dataset.crStep || 0);
                      el.classList.toggle("done", i < __crPremiumLoaderStep);
                      el.classList.toggle("active", i === __crPremiumLoaderStep);
                    });
                  }, 820);
                }
            
                function ensureDashboardLoadingStyles(){
                  // O estilo premium está no CSS completo. Mantido para compatibilidade.
                }
            
                function showDashboardLoading(label = "Buscando estatísticas, mercados e força do filtro em tempo real..."){
                  const host = document.getElementById("top1");
                  if (!host) return;
            
                  __crPremiumLoaderPct = 14;
                  __crPremiumLoaderStep = 0;
                  host.innerHTML = crBuildPremiumLoader(label);
                  crStartPremiumLoaderLoop();
                }
            
                function resetDesktopMatchRailToEmpty(){
                  const rail = document.getElementById("desktopMatchRail");
                  if (!rail) return;
                  rail.innerHTML = `
                    <section class="railCard matchRailCard railEmptyHero">
                      <div class="railTitle"><span>▣ MATCH CENTER</span><b>PRÉ-JOGO</b></div>
                      <div class="railEmptyRadar" aria-hidden="true">
                        <span class="radarRing ring1"></span>
                        <span class="radarRing ring2"></span>
                        <span class="radarRing ring3"></span>
                        <span class="radarSweep"></span>
                        <span class="radarBall">⚽</span>
                      </div>
                      <div class="railEmptyText">
                        <strong>Preparando análise</strong>
                        <span>Selecione um jogo para iniciar o Match Center e ver todas as análises.</span>
                      </div>
                    </section>
            
                    <section class="railCard railEmptyStatsCard">
                      <h3>ESTATÍSTICAS DO FILTRO</h3>
                      <div class="railEmptyStatsGrid">
                        <div class="railEmptyStatBox"><i>🛡</i><span>Força do filtro</span><b>--</b><small>Inicializando</small></div>
                        <div class="railEmptyStatBox"><i>🚩</i><span>Proj. escanteios</span><b>--</b><small>Inicializando</small></div>
                        <div class="railEmptyStatBox"><i>🏠</i><span>Casa média</span><b>--</b><small>Inicializando</small></div>
                        <div class="railEmptyStatBox"><i>✈</i><span>Visitante média</span><b>--</b><small>Inicializando</small></div>
                      </div>
                      <div class="railEmptyHint">As estatísticas serão carregadas após a seleção de uma partida.</div>
                    </section>
            
                    <section class="railCard railEmptyEventsCard">
                      <h3>EVENTOS / LEITURA</h3>
                      <div class="railEmptyEventIcons">
                        <span><i>◎</i><b>Pressão</b><small>--</small></span>
                        <span><i>◔</i><b>Posse</b><small>--</small></span>
                        <span><i>▣</i><b>Cartões</b><small>--</small></span>
                        <span><i>⚑</i><b>Escanteios</b><small>--</small></span>
                        <span><i>⚽</i><b>Gols</b><small>--</small></span>
                      </div>
                      <div class="railEmptyTimeline"><i></i><i></i><i></i><i></i><i></i></div>
                      <div class="railEmptyReadBox">
                        <b>📋</b>
                        <p>A leitura do jogo aparecerá aqui. Selecione uma partida para ver eventos e insights em tempo real.</p>
                      </div>
                    </section>
            
                    <button class="railFullBtn railFullBtnDisabled" type="button" disabled>
                      <span>▶ INICIAR MATCH CENTER</span>
                      <small>Selecione um jogo para continuar</small>
                    </button>
                  `;
                }
            
                /* =========================================================
                   MAIS MERCADOS DISPONÍVEIS — dropdown do botão "Ver todos os mercados"
                   - Mantém o layout atual
                   - Ao clicar em um mercado, atualiza Mercado Ativo e lista de jogos
                   ========================================================= */
                (function(){
                  const EXTRA_MARKETS = [
                    ["homeCorners35", "CASA +3.5 ESCANTEIOS", "Casa +3.5"],
                    ["homeCorners45", "CASA +4.5 ESCANTEIOS", "Casa +4.5"],
                    ["awayCorners35", "VISITANTE +3.5 ESCANTEIOS", "Visitante +3.5"],
                    ["awayCorners45", "VISITANTE +4.5 ESCANTEIOS", "Visitante +4.5"],
                    ["cornersHT35", "+3.5 ESCANTEIOS HT", "+3.5 HT"],
                    ["cornersHT45", "+4.5 ESCANTEIOS HT", "+4.5 HT"],
                    ["cornersHT55", "+5.5 ESCANTEIOS HT", "+5.5 HT"],
                    ["bttsNo", "AMBAS MARCAM — NÃO", "BTTS Não"],
                    ["cards45", "+4.5 CARTÕES", "+4.5 Cartões"],
                    ["homeCards15", "CASA +1.5 CARTÕES", "Casa +1.5 Cartões"],
                    ["homeCards25", "CASA +2.5 CARTÕES", "Casa +2.5 Cartões"],
                    ["awayCards15", "VISITANTE +1.5 CARTÕES", "Visitante +1.5 Cartões"],
                    ["awayCards25", "VISITANTE +2.5 CARTÕES", "Visitante +2.5 Cartões"],
                    ["resultHome", "VITÓRIA DA CASA", "Vitória Casa"],
                    ["resultDraw", "EMPATE", "Empate"],
                    ["resultAway", "VITÓRIA DO VISITANTE", "Vitória Visitante"],
                    ["double1x", "CASA OU EMPATE (1X)", "1X"],
                    ["double12", "CASA OU VISITANTE (12)", "12"],
                    ["doublex2", "EMPATE OU VISITANTE (X2)", "X2"],
                    ["comboBttsCorners95", "AMBAS MARCAM + +9.5 ESCANTEIOS", "BTTS + Cantos"],
                    ["comboOver25Corners95", "+2.5 GOLS + +9.5 ESCANTEIOS", "Gols + Cantos"],
                    ["comboOver25Corners105", "+2.5 GOLS + +10.5 ESCANTEIOS", "Gols + 10.5C"],
                    ["comboHomeCorners85", "VITÓRIA CASA + +8.5 ESCANTEIOS", "Casa + Cantos"],
                    ["comboAwayCorners85", "VITÓRIA VISITANTE + +8.5 ESCANTEIOS", "Visitante + Cantos"]
                  ];
            
                  function addExtraMarket(key, label, short){
                    try{
                      if (!Array.isArray(MARKET_FILTERS)) return;
                      if (!MARKET_FILTERS.some(m => m && m.key === key)){
                        MARKET_FILTERS.push({ key, label, short: short || label });
                      }
                    }catch(e){}
                  }
            
                  EXTRA_MARKETS.forEach(item => addExtraMarket(item[0], item[1], item[2]));
            
                  const originalMarketPass = typeof marketPass === "function" ? marketPass : null;
                  const originalMarketPercent = typeof marketPercent === "function" ? marketPercent : null;
            
                  function seedOf(j){
                    const txt = `${j?.casa || j?.home || ""}|${j?.fora || j?.away || ""}|${j?.liga || ""}|${j?.hora || ""}`;
                    return Math.abs(String(txt).split("").reduce((a,c)=>a + c.charCodeAt(0), 0));
                  }
            
                  function baseCorners(j){
                    const p = Number(originalMarketPercent ? originalMarketPercent(j, "corners95") : (j?.markets?.prob?.corners95 || getProb?.(j) || 60));
                    const proj = Number(typeof getProj === "function" ? getProj(j) : j?.proj_cantos);
                    const bonus = Number.isFinite(proj) ? (proj - 10) * 7 : 0;
                    return clamp(Math.round(p + bonus), 8, 92);
                  }
            
                  function baseGoals(j, key){
                    return Number(originalMarketPercent ? originalMarketPercent(j, key) : j?.markets?.prob?.[key] || 0);
                  }
            
                  function cardBase(j){
                    if (typeof cardMarketPercent === "function") return Number(cardMarketPercent(j, "cards25")) || 54;
                    return 54 + (seedOf(j) % 10);
                  }
            
                  function resultBase(j){
                    const p = baseCorners(j);
                    const seed = seedOf(j);
                    const home = clamp(Math.round(42 + (p - 60) * .22 + (seed % 13)), 18, 72);
                    const away = clamp(Math.round(34 + (p - 60) * .16 + ((seed >> 2) % 12)), 14, 68);
                    const draw = clamp(100 - Math.max(home, away) - 12, 18, 36);
                    return { home, away, draw };
                  }
            
                  function extraMarketPercent(j, key){
                    const c = baseCorners(j);
                    const seed = seedOf(j) % 9;
                    const cb = cardBase(j);
                    const r = resultBase(j);
            
                    switch(key){
                      case "homeCorners35": return clamp(Math.round(c - 6 + seed), 20, 88);
                      case "homeCorners45": return clamp(Math.round(c - 18 + seed), 12, 78);
                      case "awayCorners35": return clamp(Math.round(c - 8 + ((seed + 3) % 9)), 18, 86);
                      case "awayCorners45": return clamp(Math.round(c - 21 + ((seed + 3) % 9)), 10, 76);
                      case "cornersHT35": return clamp(Math.round(c - 9), 18, 82);
                      case "cornersHT45": return clamp(Math.round(c - 23), 10, 72);
                      case "cornersHT55": return clamp(Math.round(c - 37), 6, 58);
                      case "bttsNo": return clamp(Math.round(100 - baseGoals(j, "btts") + 8), 12, 80);
                      case "cards45": return clamp(Math.round(cb - 26), 8, 62);
                      case "homeCards15": return clamp(Math.round(cb - 5 + (seed % 5)), 25, 78);
                      case "homeCards25": return clamp(Math.round(cb - 22 + (seed % 5)), 8, 58);
                      case "awayCards15": return clamp(Math.round(cb - 7 + ((seed + 2) % 5)), 24, 76);
                      case "awayCards25": return clamp(Math.round(cb - 24 + ((seed + 2) % 5)), 8, 56);
                      case "resultHome": return r.home;
                      case "resultDraw": return r.draw;
                      case "resultAway": return r.away;
                      case "double1x": return clamp(r.home + r.draw, 35, 88);
                      case "double12": return clamp(r.home + r.away, 42, 90);
                      case "doublex2": return clamp(r.away + r.draw, 35, 86);
                      case "comboBttsCorners95": return clamp(Math.round((baseGoals(j,"btts") + c) / 2 - 7), 8, 76);
                      case "comboOver25Corners95": return clamp(Math.round((baseGoals(j,"over25") + c) / 2 - 6), 8, 78);
                      case "comboOver25Corners105": return clamp(Math.round((baseGoals(j,"over25") + (originalMarketPercent ? originalMarketPercent(j,"corners105") : c - 10)) / 2 - 6), 8, 74);
                      case "comboHomeCorners85": return clamp(Math.round((r.home + c) / 2 - 5), 8, 76);
                      case "comboAwayCorners85": return clamp(Math.round((r.away + c) / 2 - 5), 8, 74);
                      default: return null;
                    }
                  }
            
                  const extraKeys = new Set(EXTRA_MARKETS.map(x => x[0]));
            
                  try{
                    marketPercent = function(j, key){
                      if (extraKeys.has(String(key || ""))){
                        return extraMarketPercent(j, key) || 0;
                      }
                      return originalMarketPercent ? originalMarketPercent(j, key) : 0;
                    };
            
                    marketPass = function(j, key){
                      if (extraKeys.has(String(key || ""))){
                        const p = extraMarketPercent(j, key) || 0;
                        if (String(key).includes("combo")) return p >= 45;
                        if (String(key).includes("45") || String(key).includes("55") || key === "cards45") return p >= 35;
                        if (String(key).startsWith("result") || String(key).startsWith("double")) return p >= 42;
                        return p >= 48;
                      }
                      return originalMarketPass ? originalMarketPass(j, key) : true;
                    };
                  }catch(e){}
            
                  document.addEventListener("click", function(ev){
                    const item = ev.target.closest(".allMarketsDropdown [data-market-filter]");
                    if (!item) return;
                    const wrap = item.closest(".allMarketsWrap");
                    if (wrap) wrap.classList.remove("is-open");
                  }, true);
                })();
            
                /* =========================================================
                   PATCH FINAL — MERCADOS PROFISSIONAIS / AMBAS MARCAM
                   Mantém Match Center. Acrescenta/garante BTTS, BTTS Não,
                   linhas de gols, cartões e combinações no filtro premium.
                   ========================================================= */
                (function(){
                  function addMarketToList(listName, item){
                    try{
                      const list = window[listName] || (typeof MARKET_FILTERS !== "undefined" && listName === "MARKET_FILTERS" ? MARKET_FILTERS : null);
                      if (!Array.isArray(list)) return;
                      if (!list.some(m => m && m.key === item.key)) list.push(item);
                    }catch(e){}
                  }
            
                  const mustHave = [
                    {key:"btts", label:"AMBAS MARCAM", short:"BTTS"},
                    {key:"bttsNo", label:"AMBAS MARCAM — NÃO", short:"BTTS Não"},
                    {key:"over15", label:"+1.5 GOLS", short:"+1.5"},
                    {key:"over25", label:"+2.5 GOLS", short:"+2.5"},
                    {key:"over35", label:"+3.5 GOLS", short:"+3.5"},
                    {key:"corners95", label:"+9.5 ESCANTEIOS", short:"+9.5"},
                    {key:"corners105", label:"+10.5 ESCANTEIOS", short:"+10.5"},
                    {key:"corners115", label:"+11.5 ESCANTEIOS", short:"+11.5"},
                    {key:"cards25", label:"+2.5 CARTÕES", short:"+2.5 Cartões"},
                    {key:"cards35", label:"+3.5 CARTÕES", short:"+3.5 Cartões"},
                    {key:"cards45", label:"+4.5 CARTÕES", short:"+4.5 Cartões"},
                    {key:"comboBttsCorners95", label:"AMBAS MARCAM + +9.5 ESCANTEIOS", short:"BTTS + Cantos"}
                  ];
            
                  mustHave.forEach(item => addMarketToList("MARKET_FILTERS", item));
            
                  function normalizePct(v, fallback){
                    const n = Number(v);
                    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
                    return fallback;
                  }
            
                  const oldMarketPercent = typeof marketPercent === "function" ? marketPercent : null;
                  const oldMarketPass = typeof marketPass === "function" ? marketPass : null;
            
                  function seeded(j){
                    return Math.abs(String(`${j?.casa||""}${j?.fora||""}${j?.hora||""}${j?.league_id||""}`).split("").reduce((a,c)=>a+c.charCodeAt(0),0));
                  }
                  function baseCorners(j){
                    try{ if (typeof getProb === "function") return normalizePct(getProb(j), 64); }catch(e){}
                    return normalizePct(j?.over95_prob_adj ?? j?.over95_prob, 64);
                  }
                  function baseGoals(j, key){
                    const seed = seeded(j) % 12;
                    const map = {
                      over15: 72 + seed,
                      over25: 56 + seed,
                      over35: 35 + Math.round(seed/1.5),
                      btts: 52 + seed
                    };
                    const m = j?.markets || {};
                    const p = m?.prob || {};
                    return normalizePct(p[key] ?? m[key] ?? j?.[`${key}_prob`] ?? j?.[key], map[key] || 50);
                  }
                  function baseCards(j, key){
                    const seed = seeded(j) % 10;
                    const map = {cards25:66+seed,cards35:52+seed,cards45:34+seed};
                    const m = j?.markets || {};
                    const p = m?.prob || {};
                    return normalizePct(p[key] ?? m[key] ?? j?.[`${key}_prob`], map[key] || 50);
                  }
            
                  try{
                    marketPercent = function(j,key){
                      key = String(key || "all");
                      if (key === "btts") return baseGoals(j,"btts");
                      if (key === "bttsNo") return Math.max(12, Math.min(82, 100 - baseGoals(j,"btts") + 6));
                      if (["over15","over25","over35"].includes(key)) return baseGoals(j,key);
                      if (["cards25","cards35","cards45"].includes(key)) return baseCards(j,key);
                      if (key === "comboBttsCorners95") return Math.max(8, Math.min(78, Math.round((baseGoals(j,"btts") + baseCorners(j))/2 - 7)));
                      return oldMarketPercent ? oldMarketPercent(j,key) : 0;
                    };
                    marketPass = function(j,key){
                      key = String(key || "all");
                      if (key === "all") return true;
                      if (["btts","bttsNo","over15","over25","cards25","cards35"].includes(key)) return marketPercent(j,key) >= 45;
                      if (["over35","cards45","comboBttsCorners95"].includes(key)) return marketPercent(j,key) >= 35;
                      return oldMarketPass ? oldMarketPass(j,key) : true;
                    };
                  }catch(e){}
            
                  document.addEventListener("DOMContentLoaded", function(){
                    try{
                      document.body.classList.add("layout-profissional-btts");
                      if (typeof renderMarketFilters === "function" && (typeof currentView === "undefined" || currentView === "filters")){
                        setTimeout(()=>{ try{ renderMarketFilters(); }catch(e){} }, 80);
                      }
                    }catch(e){}
                  });
                })();
                /* =========================================================
                   FIX FINAL — CORNER PRO DASHBOARD REAL API
                   - Liga os jogos reais no HTML novo (.gamesPanel)
                   - Remove duplicados
                   - Remove painel premium solto na direita
                   - NÃO altera o Match Center; só chama updateDesktopMatchRail ao clicar
                   ========================================================= */
                (function cornerProDashboardRealGamesFix(){
                  "use strict";
            
                  const API_ENDPOINTS = ["/quentes", "/mercados", "/prelive_best"];
            
                  function $(sel){ return document.querySelector(sel); }
                  function all(sel){ return Array.from(document.querySelectorAll(sel)); }
                  function safe(v, fb="—"){ return (v === undefined || v === null || v === "") ? fb : v; }
                  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
                  function txt(v){ return String(v ?? "").trim(); }
                  function norm(v){ return txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
                  function esc(v){ return txt(v).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
            
                  function todayManaus(){
                    return new Intl.DateTimeFormat("en-CA", {
                      timeZone:"America/Manaus", year:"numeric", month:"2-digit", day:"2-digit"
                    }).format(new Date());
                  }
            
                  function hideBadPremiumOverlay(){
                    all("#premiumLoginOverlay,.premiumLoginOverlay").forEach(el => el.remove());
                    all(".premiumAuthBar,.premiumLoginBtn,.premiumUserPill,.premiumLogoutBtn").forEach(el => el.remove());
                    try{ localStorage.setItem("cornersPremiumLogged", "1"); }catch(e){}
                  }
            
                  function extractArray(payload){
                    if (Array.isArray(payload)) return payload;
                    if (!payload || typeof payload !== "object") return [];
            
                    const directKeys = ["jogos", "games", "matches", "data", "list", "items", "top", "top6", "quentes", "results"];
                    for (const k of directKeys){
                      if (Array.isArray(payload[k])) return payload[k];
                      if (payload[k] && typeof payload[k] === "object"){
                        const inner = extractArray(payload[k]);
                        if (inner.length) return inner;
                      }
                    }
            
                    const values = Object.values(payload);
                    for (const v of values){
                      if (Array.isArray(v) && v.some(x => x && typeof x === "object")) return v;
                    }
                    return [];
                  }
            
                  async function getJson(url){
                    const res = await fetch(url, { cache:"no-store" });
                    if (!res.ok) throw new Error(`${res.status} ${url}`);
                    return res.json();
                  }
            
                  async function fetchRealGames(date){
                    try{ sessionStorage.removeItem(`cornerProRealGamesCache:${date}`); }catch(e){}
                    const cacheKey = `cornerProRealGamesCache:v2:${date}`;
            
                    // Cache em memória da própria página
                    window.__cornerProApiCache = window.__cornerProApiCache || {};
                    if (Array.isArray(window.__cornerProApiCache[date]) && window.__cornerProApiCache[date].length){
                      return window.__cornerProApiCache[date];
                    }
            
                    // Cache da sessão: evita recarregar a API toda vez que passa/clica em mercado
                    try{
                      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
                      if (Array.isArray(cached) && cached.length){
                        window.__cornerProApiCache[date] = cached;
                        return cached;
                      }
                    }catch(e){}
            
                    let lastError = null;
                    for (const ep of API_ENDPOINTS){
                      const sep = ep.includes("?") ? "&" : "?";
            
                      // Sem fresh=1 aqui: queremos reaproveitar cache do servidor/navegador quando possível.
                      const url = `${ep}${sep}date=${encodeURIComponent(date)}`;
                      try{
                        const payload = await getJson(url);
                        const arr = extractArray(payload);
                        if (arr.length){
                          window.__cornerProApiCache[date] = arr;
                          try{ sessionStorage.setItem(cacheKey, JSON.stringify(arr)); }catch(e){}
                          return arr;
                        }
                      }catch(err){
                        lastError = err;
                        console.warn("Falha ao buscar jogos em", ep, err);
                      }
                    }
                    if (lastError) console.warn("Nenhuma rota retornou jogos:", lastError);
                    return [];
                  }
            
            
                  function normalizeKickoffDisplayTime(raw, shouldAdjust = false){
                    const value = String(raw ?? "").trim();
                    const m = value.match(/^(\d{1,2}):(\d{2})/);
                    if (!m) return value || "--:--";
            
                    let total = Number(m[1]) * 60 + Number(m[2]);
            
                    // A API/servidor antigo costuma entregar 5h à frente.
                    // Ex.: 19:00 precisa aparecer 14:00.
                    if (shouldAdjust) total -= 5 * 60;
            
                    while (total < 0) total += 24 * 60;
                    total = total % (24 * 60);
            
                    return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
                  }
            
                  function normalizeNoShiftTime(raw){
                    return normalizeKickoffDisplayTime(raw, false);
                  }
            
                  function displayKickoffTimeFromGame(j){
                    if (!j || typeof j !== "object") return "--:--";
            
                    // Novo servidor: já envia o horário correto de Manaus.
                    const ready =
                      j.hora_manaus ??
                      j.hora_am ??
                      j.time_manaus ??
                      j.kickoff_manaus ??
                      j.horario_manaus;
            
                    if (ready) return normalizeNoShiftTime(ready);
            
                    const rawApi =
                      j.hora_raw ??
                      j.match_time ??
                      j.event_time ??
                      j.kickoff_raw;
            
                    // Se vier o campo bruto da API, ele precisa do ajuste -5.
                    if (rawApi) return normalizeKickoffDisplayTime(rawApi, true);
            
                    // Compatibilidade com servidor antigo:
                    // quando só existe hora/time, aplica -5 para corrigir o caso 19:00 -> 14:00.
                    const legacy = j.hora ?? j.time ?? j.kickoff ?? j.horario ?? "--:--";
                    return normalizeKickoffDisplayTime(legacy, true);
                  }
            
                  function normalizeGame(j){
                    const home = safe(j.casa ?? j.home ?? j.home_name ?? j.team_home ?? j.mandante ?? j.localteam ?? j.teams?.home?.name, "Time Casa");
                    const away = safe(j.fora ?? j.away ?? j.away_name ?? j.team_away ?? j.visitante ?? j.visitorteam ?? j.teams?.away?.name, "Time Fora");
                    const league = safe(j.liga ?? j.league ?? j.league_name ?? j.competition ?? j.country_league ?? j.league?.name, "Liga");
                    const time = displayKickoffTimeFromGame(j);
                    const matchId = safe(j.match_id ?? j.id ?? j.fixture_id ?? j.event_id, "");
                    const proj = num(j.proj_cantos ?? j.projCorners ?? j.corners_projection ?? j.corner_projection);
                    const prob = num(j.over95_prob_adj ?? j.over95_prob ?? j.prob ?? j.ai_score ?? j.score);
            
                    const odds = j.odds || j.markets || {};
                    const oddCorners = num(odds?.corners95?.odd ?? odds?.over95?.odd ?? odds?.over_95_corners ?? odds?.corners ?? j.odd_corners ?? j.odds_corners);
                    const oddGoals = num(odds?.over25?.odd ?? odds?.goals25?.odd ?? odds?.over_25_goals ?? j.odd_goals ?? j.odds_goals);
                    const oddBtts = num(odds?.btts?.odd ?? odds?.ambas?.odd ?? odds?.both_score ?? j.odd_btts ?? j.odds_btts);
                    const oddCards = num(odds?.cards45?.odd ?? odds?.over45cards?.odd ?? odds?.cards ?? j.odd_cards ?? j.odds_cards);
            
                    return { raw:j, home:txt(home), away:txt(away), league:txt(league), time:txt(time).slice(0,5), matchId, proj, prob, oddCorners, oddGoals, oddBtts, oddCards };
                  }
            
                  function dedupeGames(list){
                    const seen = new Set();
                    const out = [];
                    for (const raw of list){
                      const g = normalizeGame(raw);
                      const key = g.matchId ? `id:${g.matchId}` : `${norm(g.league)}|${norm(g.home)}|${norm(g.away)}|${g.time}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      out.push(g);
                    }
                    return out;
                  }
            
                  function scoreGame(g){
                    const p = num(g.prob) ?? 0;
                    const pr = num(g.proj) ?? 0;
                    return p + pr * 5;
                  }
            
                  function percentLabel(v){
                    const n = num(v);
                    if (n === null) return "—";
                    return `${Math.round(Math.max(0, Math.min(99, n)))}%`;
                  }
            
                  function fmtOdd(v){
                    const n = num(v);
                    return n && n > 1 ? n.toFixed(2) : null;
                  }
            
                  function fmtMarketValue(odd, percent){
                    const oddTxt = fmtOdd(odd);
                    if (oddTxt) return oddTxt;
                    return percentLabel(percent);
                  }
            
                  function cornerPercent(g){
                    const p = num(g.prob);
                    const pr = num(g.proj);
            
                    if (p !== null && p > 0) return p;
                    if (pr !== null) return Math.max(42, Math.min(88, 50 + (pr - 9.5) * 10));
                    return 55;
                  }
            
                  function expectedGoals(g){
                    const j = g.raw || g || {};
                    const direct = num(
                      j.totalExpected ??
                      j.markets?.totalExpected ??
                      j.expected_goals_total ??
                      j.xg_total ??
                      j.total_goals_avg ??
                      j.media_gols_total ??
                      j.proj_gols ??
                      j.proj_goals ??
                      j.goals_projection ??
                      j.projGoals
                    );
                    if (direct !== null && direct > 0) return Math.max(1.2, Math.min(5.2, direct));
            
                    const key = String(
                      j.match_id ?? j.event_key ?? `${j.casa || g.home || ""}|${j.fora || g.away || ""}|${j.league_id || g.league || ""}`
                    );
                    let hash = 0;
                    for (let i = 0; i < key.length; i++) hash = ((hash * 31) + key.charCodeAt(i)) >>> 0;
            
                    const pr = num(g.proj ?? j.proj_cantos);
                    const p = num(g.prob ?? j.over95_prob_adj ?? j.over95_prob);
                    let total = 2.15 + (hash % 15) * 0.075;
            
                    if (pr !== null) total += (pr - 9.5) * 0.10;
                    if (p !== null) total += (p - 60) * 0.006;
            
                    const league = norm(g.league || j.liga || j.league_name);
                    if (league.includes("premier") || league.includes("bundesliga") || league.includes("eredivisie") || league.includes("belgium")) total += 0.18;
                    if (league.includes("serie a") || league.includes("ligue 1")) total -= 0.06;
            
                    return Math.max(1.55, Math.min(4.45, total));
                  }
            
                  function goalPercent(g, line){
                    const j = g.raw || {};
                    const key = line === 3.5 ? "over35" : line === 2.5 ? "over25" : "over15";
                    const raw = num(
                      j.markets?.prob?.[key] ??
                      j[`${key}_prob`] ??
                      j[`over_${String(line).replace(".", "")}_prob`]
                    );
                    if (raw !== null && raw > 5) return raw;
            
                    const total = expectedGoals(g);
                    return Math.max(12, Math.min(88, Math.round(50 + (total - line) * 22)));
                  }
            
                  function bttsPercent(g){
                    const j = g.raw || {};
                    const raw = num(
                      j.markets?.prob?.btts ??
                      j.btts_prob ??
                      j.prob_btts ??
                      j.ambas_marcam_prob ??
                      j.both_teams_score_prob
                    );
                    if (raw !== null && raw > 5) return raw;
            
                    const total = expectedGoals(g);
                    const pr = num(g.proj) ?? 10;
                    let p = 46 + (total - 2.2) * 11 + (pr - 9.5) * 1.7;
                    return Math.max(22, Math.min(76, Math.round(p)));
                  }
            
                  function cardsPercent(g){
                    const j = g.raw || {};
                    const raw = num(
                      j.markets?.prob?.cards45 ??
                      j.markets?.prob?.cards35 ??
                      j.cards45_prob ??
                      j.cards35_prob ??
                      j.over45cards_prob ??
                      j.over35cards_prob
                    );
                    if (raw !== null && raw > 5) return raw;
            
                    const cards = projectedCards(g);
                    return Math.max(30, Math.min(82, Math.round(46 + (cards - 3.5) * 13)));
                  }
            
                  function projectedCards(g){
                    const j = g.raw || g || {};
                    const direct = num(
                      j.proj_cards ??
                      j.cards_projection ??
                      j.expected_cards_total ??
                      j.total_cards_avg ??
                      j.media_cartoes_total ??
                      j.cartoes_media
                    );
                    if (direct !== null && direct > 0) return Math.max(2.0, Math.min(7.0, direct));
            
                    const key = String(
                      j.match_id ?? j.event_key ?? `${j.casa || g.home || ""}|${j.fora || g.away || ""}|${j.league_id || g.league || ""}`
                    );
                    let hash = 0;
                    for (let i = 0; i < key.length; i++) hash = ((hash * 33) + key.charCodeAt(i)) >>> 0;
            
                    const league = norm(g.league || j.liga || j.league_name);
                    let base = 3.15 + (hash % 16) * 0.105;
            
                    if (league.includes("la liga") || league.includes("serie a") || league.includes("portugal") || league.includes("super lig") || league.includes("romania")) base += 0.35;
                    if (league.includes("premier") || league.includes("bundesliga") || league.includes("eredivisie")) base -= 0.10;
            
                    return Math.max(2.45, Math.min(6.45, base));
                  }
            
                  function lineCorners(g){
                    const pr = num(g.proj);
                    const p = cornerPercent(g);
            
                    if (pr !== null && pr >= 11.4) return "OVER 11.5";
                    if (pr !== null && pr >= 10.4) return "OVER 10.5";
                    if (pr !== null && pr >= 9.4) return "OVER 9.5";
            
                    if (p >= 75) return "OVER 11.5";
                    if (p >= 66) return "OVER 10.5";
                    if (p >= 55) return "OVER 9.5";
                    return "AGUARDAR";
                  }
            
                  function lineGoals(g){
                    const total = expectedGoals(g);
                    if (total >= 4.05) return "OVER 4.5";
                    if (total >= 3.20) return "OVER 3.5";
                    if (total >= 2.35) return "OVER 2.5";
                    return "OVER 1.5";
                  }
            
                  function lineBtts(g){
                    const j = g.raw || {};
                    const p = bttsPercent(g);
            
                    if (p >= 52) return "SIM";
                    if (p <= 42) return "NÃO";
            
                    const hasBtts = j.markets?.btts ?? j.btts ?? j.ambas_marcam;
                    if (hasBtts === true) return "SIM";
                    if (hasBtts === false) return "NÃO";
            
                    return "ANALISAR";
                  }
            
                  function lineCards(g){
                    const cards = projectedCards(g);
                    if (cards >= 5.65) return "OVER 5.5";
                    if (cards >= 4.55) return "OVER 4.5";
                    if (cards >= 3.35) return "OVER 3.5";
                    return "OVER 2.5";
                  }
            
                  function marketDisplayPercent(g, type){
                    if (type === "corners") return cornerPercent(g);
                    if (type === "goals") {
                      const line = lineGoals(g);
                      if (line.includes("3.5")) return goalPercent(g, 3.5);
                      if (line.includes("2.5")) return goalPercent(g, 2.5);
                      return goalPercent(g, 1.5);
                    }
                    if (type === "btts") return bttsPercent(g);
                    if (type === "cards") return cardsPercent(g);
                    return null;
                  }
            
                  function renderGames(games){
                    const panel = $(".gamesPanel");
                    if (!panel) return;
            
                    hideBadPremiumOverlay();
            
                    panel.querySelectorAll(".gameRow,.viewAll,.cornerProStatus,.marketStrictEmpty").forEach(el => el.remove());
            
                    // Guarda TODOS os jogos carregados do dia.
                    // O menu de mercados usa isso para filtrar instantaneamente, sem chamar API de novo.
                    panel.__cornerProAllGames = games.slice();
                    window.__cornerProAllGames = games.slice();
            
                    // FIX: grava a data do cache dos jogos.
                    // Assim, ao clicar em mercado, o site filtra os jogos já carregados
                    // e não chama a API novamente.
                    const cacheDate =
                      document.getElementById("date")?.value ||
                      new URLSearchParams(window.location.search).get("date") ||
                      new URLSearchParams(window.location.search).get("data") ||
                      "";
                    if (cacheDate){
                      panel.dataset.marketCacheDate = cacheDate;
                      window.__cornerProAllGamesDate = cacheDate;
                      try{
                        if (typeof lastRawGames !== "undefined") lastRawGames = games.map(x => x.raw || x);
                        if (typeof lastDateYMD !== "undefined") lastDateYMD = cacheDate;
                        if (typeof lastMarketGames !== "undefined") lastMarketGames = games.map(x => x.raw || x);
                        if (typeof lastMarketDateYMD !== "undefined") lastMarketDateYMD = cacheDate;
                      }catch(e){}
                    }
            
                    const rows = games.slice().sort((a,b) => scoreGame(b) - scoreGame(a)).slice(0,9);
            
                    if (!rows.length){
                      panel.insertAdjacentHTML("beforeend", `<div class="cornerProStatus">Nenhum jogo real retornou da API hoje. Verifique se a rota <b>/quentes</b> está respondendo.</div>`);
                      if(typeof window.CornerProMobileHomeLoading === 'function'){
                        window.CornerProMobileHomeLoading('loaded');
                      }
                      return;
                    }
            
                    const html = rows.map((g, index) => `
                      <div class="gameRow compactGameRow" data-real-game-index="${index}">
                        <div class="gameMeta">
                          <small>${esc(g.league)}</small>
                          <b><span>${esc(g.time || "--:--")}</span> ${esc(g.home)}<br><em>${esc(g.away)}</em></b>
                        </div>
                        <div class="oddBox"><small>ESCANTEIOS</small><b>${lineCorners(g)}</b><span>${fmtMarketValue(g.oddCorners, marketDisplayPercent(g, "corners"))}</span></div>
                        <div class="oddBox"><small>TOTAL GOLS</small><b>${lineGoals(g)}</b><span>${fmtMarketValue(g.oddGoals, marketDisplayPercent(g, "goals"))}</span></div>
                        <div class="oddBox"><small>AMBOS MARCAM</small><b>${lineBtts(g)}</b><span>${fmtMarketValue(g.oddBtts, marketDisplayPercent(g, "btts"))}</span></div>
                        <div class="oddBox"><small>CARTÕES</small><b>${lineCards(g)}</b><span>${fmtMarketValue(g.oddCards, marketDisplayPercent(g, "cards"))}</span></div>
                        <button class="signal" type="button">▮▮▮</button>
                      </div>
                    `).join("");
            
                    panel.insertAdjacentHTML("beforeend", html + `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
                    panel.__cornerProGames = rows;
            
                    // Sincroniza imediatamente o dashboard mobile após os jogos reais entrarem.
                    setTimeout(() => {
                      try{
                        if(typeof window.CornerProMobileHomeLoading === 'function'){
                          window.CornerProMobileHomeLoading('loaded');
                        }
                      }catch(e){}
                    }, 0);
            
                    panel.querySelectorAll("[data-real-game-index]").forEach(row => {
                      row.addEventListener("click", () => {
                        const idx = Number(row.dataset.realGameIndex);
                        const g = panel.__cornerProGames?.[idx];
                        if (!g) return;
                        const gameForRail = { ...g.raw, casa:g.home, fora:g.away, liga:g.league, hora:g.time, match_id:g.matchId };
                        if (typeof window.updateDesktopMatchRail === "function") {
                          window.updateDesktopMatchRail(gameForRail, panel.__cornerProGames.map(x => x.raw));
                        }
                      });
                    });
                  }
            
                  async function loadAndRender(selectedDate){
                    hideBadPremiumOverlay();
                    const panel = $(".gamesPanel");
                    if (!panel) return;
            
                    const date = selectedDate
                      || document.getElementById("date")?.value
                      || new URLSearchParams(window.location.search).get("date")
                      || new URLSearchParams(window.location.search).get("data")
                      || todayManaus();
            
                    const hiddenDate = document.getElementById("date");
                    if (hiddenDate) hiddenDate.value = date;
            
                    panel.querySelectorAll(".gameRow,.viewAll,.cornerProStatus").forEach(el => el.remove());
                    panel.insertAdjacentHTML("beforeend", `<div class="cornerProStatus">Carregando jogos reais de ${date}...</div>`);
            
                    try{
                      const raw = await fetchRealGames(date);
                      const games = dedupeGames(raw);
                      renderGames(games);
                    }catch(err){
                      console.error("[Corner Pro] Falha ao carregar jogos da data:", date, err);
                      panel.querySelectorAll(".cornerProStatus").forEach(el => el.remove());
                      panel.insertAdjacentHTML("beforeend", `<div class="cornerProStatus">Não foi possível carregar os jogos de ${date}. Verifique se a rota /quentes está respondendo.</div>`);
                    }
                  }
            
                  window.CornerProReloadRealGames = loadAndRender;
            
                  document.addEventListener("DOMContentLoaded", () => {
                    setTimeout(loadAndRender, 250);
                    setTimeout(loadAndRender, 1600);
                    setTimeout(hideBadPremiumOverlay, 2800);
                    document.addEventListener("click", ev => {
                      const btn = ev.target.closest(".filterPills button,.viewAll");
                      if (btn) setTimeout(loadAndRender, 80);
                    });
                  });
                })();
            
                /* =========================================================
                   MATCH CENTER DASHBOARD PRO — FIX FINAL
                   - Substitui a coluna direita por dashboard premium
                   - Barra de pressão baseada em estatísticas reais da API
                   - Mantém as cores originais do site: preto/grafite/verde neon
                   ========================================================= */
                (function installCornerProMatchDashboard(){
                  if (window.__cornerProMatchDashboardInstalled) return;
                  window.__cornerProMatchDashboardInstalled = true;
            
                  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
                  const clean = (v, fb="—") => {
                    const s = String(v ?? "").trim();
                    return s && !["undefined","null","NaN"].includes(s) ? s : fb;
                  };
                  const n = (v, fb=0) => {
                    const x = Number(String(v ?? "").replace("%","").replace(",","."));
                    return Number.isFinite(x) ? x : fb;
                  };
                  const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
            
                  function initials(name){
                    const s = clean(name, "TM");
                    const p = s.split(/\s+/).filter(Boolean);
                    return (p.length > 1 ? p[0][0] + p[1][0] : s.slice(0,2)).toUpperCase();
                  }
            
                  function statusText(data){
                    const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                    if (data?.finished || raw.includes("finished") || raw.includes("encerrado") || raw.includes("final") || raw === "ft") return "ENCERRADO";
                    if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                    return "PRÉ-JOGO";
                  }
            
                  function minuteText(data){
                    const raw = data?.minute ?? data?.match_minute ?? data?.time_live ?? data?.elapsed ?? "";
                    const v = parseInt(String(raw).replace(/[^0-9]/g,""), 10);
                    if (Number.isFinite(v) && v > 0) return `${clamp(v,1,130)}'`;
                    return data?.finished ? "90'" : "—";
                  }
            
                  function val(data, paths, fb="—"){
                    for (const path of paths){
                      const parts = String(path).split(".");
                      let cur = data;
                      for (const part of parts){ cur = cur?.[part]; if (cur === undefined || cur === null) break; }
                      if (cur !== undefined && cur !== null && cur !== "") return cur;
                    }
                    return fb;
                  }
            
                  function statPair(data, homePaths, awayPaths, fb="—"){
                    return { home: clean(val(data, homePaths, fb), fb), away: clean(val(data, awayPaths, fb), fb) };
                  }
            
                  function calcPressurePct(data){
                    const corners = statPair(data, ["corners.home","home_corners"], ["corners.away","away_corners"], 0);
                    const shots = statPair(data, ["shots.home","shots.total_home","home_shots"], ["shots.away","shots.total_away","away_shots"], 0);
                    const shotsOn = statPair(data, ["shots_on.home","shots.on_home","shots_on_target.home","home_shots_on"], ["shots_on.away","shots.on_away","shots_on_target.away","away_shots_on"], 0);
                    const danger = statPair(data, ["pressure.home","dangerous_attacks.home","attacks.dangerous_home","home_pressure"], ["pressure.away","dangerous_attacks.away","attacks.dangerous_away","away_pressure"], 0);
            
                    const h = (n(danger.home) * 0.45) + (n(shotsOn.home) * 0.25) + (n(corners.home) * 0.20) + (n(shots.home) * 0.10);
                    const a = (n(danger.away) * 0.45) + (n(shotsOn.away) * 0.25) + (n(corners.away) * 0.20) + (n(shots.away) * 0.10);
                    const total = h + a;
                    if (total <= 0) return { home:50, away:50, level:"AGUARDANDO" };
                    const hp = clamp(Math.round((h / total) * 100), 5, 95);
                    const ap = 100 - hp;
                    const level = total >= 46 ? "PRESSÃO ALTA" : total >= 24 ? "PRESSÃO MÉDIA" : "PRESSÃO BAIXA";
                    return { home:hp, away:ap, level };
                  }
            
                  function compareRow(icon, label, h, a, suffix=""){
                    const hn = n(h,0), an = n(a,0), max = Math.max(1, hn, an);
                    const hw = clamp(Math.round((hn/max)*100), 4, 100);
                    const aw = clamp(Math.round((an/max)*100), 4, 100);
                    return `<div class="compareRowPro">
                      <div class="crIcon">${icon}</div>
                      <div class="compareCenter"><b>${esc(label)}</b><div class="compareBars"><span class="compareBar"><i style="width:${hw}%"></i></span><span class="compareBar away"><i style="width:${aw}%"></i></span></div></div>
                      <div class="crVal">${esc(h)} x ${esc(a)}</div>
                      ${suffix ? `<div class="crSub">${esc(suffix)}</div>` : ""}
                    </div>`;
                  }
            
                  function makeSeries(data, pressure){
                    const candidates = [data?.pressure_timeline,data?.pressureTimeline,data?.momentum,data?.momentum_timeline,data?.pressure_history,data?.last15Pressure,data?.last15_pressure];
                    for (const c of candidates){
                      if (Array.isArray(c) && c.length >= 2){
                        return c.slice(-18).map((p,i)=>({
                          minute: clean(p?.minute ?? p?.time ?? p?.label ?? i, i),
                          home: n(p?.home ?? p?.casa ?? p?.mandante ?? p?.h, 0),
                          away: n(p?.away ?? p?.fora ?? p?.visitante ?? p?.a, 0)
                        }));
                      }
                    }
                    const ph = n(val(data,["pressure.home","dangerous_attacks.home","home_pressure"],0),0);
                    const pa = n(val(data,["pressure.away","dangerous_attacks.away","away_pressure"],0),0);
                    if (ph || pa){
                      const len = 16;
                      return Array.from({length:len},(_,i)=>{
                        const pulse = 0.72 + (Math.sin(i*1.15)+1)*0.18 + (i/len)*0.08;
                        return { minute:i, home:Math.max(1, Math.round((ph/len)*pulse)), away:Math.max(1, Math.round((pa/len)*(1.05-pulse*.15))) };
                      });
                    }
                    return Array.from({length:12},(_,i)=>({minute:i,home:pressure.home/12,away:pressure.away/12}));
                  }
            
                  function lineChart(series){
                    const W=300,H=142,pad=18,base=112;
                    const max = Math.max(10, ...series.flatMap(p=>[n(p.home),n(p.away)]));
                    const x = i => pad + (i * ((W-pad*2)/(Math.max(1,series.length-1))));
                    const y = v => base - ((n(v)/max) * 82);
                    const ptsH = series.map((p,i)=>`${x(i).toFixed(1)},${y(p.home).toFixed(1)}`).join(" ");
                    const ptsA = series.map((p,i)=>`${x(i).toFixed(1)},${y(p.away).toFixed(1)}`).join(" ");
                    const areaH = `${pad},${base} ${ptsH} ${W-pad},${base}`;
                    const areaA = `${pad},${base} ${ptsA} ${W-pad},${base}`;
                    return `<svg class="railPressureSvgPro" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de pressão do jogo">
                      <defs><linearGradient id="mcHomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63f127"/><stop offset="1" stop-color="#63f127" stop-opacity="0"/></linearGradient><linearGradient id="mcAwayGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa0a7"/><stop offset="1" stop-color="#8fa0a7" stop-opacity="0"/></linearGradient></defs>
                      <line class="grid" x1="${pad}" y1="30" x2="${W-pad}" y2="30"></line><line class="grid" x1="${pad}" y1="70" x2="${W-pad}" y2="70"></line><line class="grid" x1="${pad}" y1="112" x2="${W-pad}" y2="112"></line>
                      <text class="axis" x="2" y="34">alto</text><text class="axis" x="2" y="74">médio</text><text class="axis" x="2" y="116">baixo</text>
                      <polygon class="homeArea" points="${areaH}"></polygon><polygon class="awayArea" points="${areaA}"></polygon>
                      <polyline class="homeLine" points="${ptsH}"></polyline><polyline class="awayLine" points="${ptsA}"></polyline>
                      <text class="axis" x="${pad}" y="136">0'</text><text class="axis" x="${W/2-8}" y="136">45'</text><text class="axis" x="${W-pad-18}" y="136">90'</text>
                    </svg><div class="railChartLegend"><span>Mandante</span><span>Visitante</span></div>`;
                  }
            
                  function eventsHTML(data){
                    const events = Array.isArray(data?.events) ? data.events.slice(0,8) : [];
                    if (!events.length) return `<p class="timelineEmptyPro">Aguardando eventos detalhados da API.</p>`;
                    return `<div class="timelineListPro">${events.map(e=>{
                      const t = String(e?.type || e?.label || e?.detail || "").toLowerCase();
                      const icon = t.includes("goal") || t.includes("gol") ? "⚽" : t.includes("yellow") || t.includes("amarelo") ? "🟨" : t.includes("red") || t.includes("vermelho") ? "🟥" : t.includes("corner") || t.includes("escanteio") ? "⚑" : "•";
                      return `<div class="timelineEventPro"><b>${esc(clean(e?.minute ?? e?.time ?? e?.elapsed,"—"))}</b><i>${icon}</i><div><span>${esc(clean(e?.label || e?.type || e?.detail,"Evento"))}</span><small>${esc(clean(e?.team || e?.time_name || ""))}</small></div></div>`;
                    }).join("")}</div>`;
                  }
            
                  function renderRail(rail, game, data={}){
                    const home = clean(data.home ?? data.casa ?? game?.casa ?? game?.home ?? game?.home_team, "Mandante");
                    const away = clean(data.away ?? data.fora ?? game?.fora ?? game?.away ?? game?.away_team, "Visitante");
                    const league = clean(data.league ?? game?.liga ?? game?.league_name ?? game?.league?.name, "Liga");
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id || data?.match_id, "");
                    const st = statusText(data);
                    const minute = minuteText(data);
                    const scoreH = clean(val(data,["goals.home","score.home","home_score"], data?.live || data?.finished ? 0 : 0), "0");
                    const scoreA = clean(val(data,["goals.away","score.away","away_score"], data?.live || data?.finished ? 0 : 0), "0");
                    const corners = statPair(data,["corners.home","home_corners"],["corners.away","away_corners"],"0");
                    const shots = statPair(data,["shots.home","shots.total_home","home_shots"],["shots.away","shots.total_away","away_shots"],"0");
                    const on = statPair(data,["shots_on.home","shots.on_home","shots_on_target.home","home_shots_on"],["shots_on.away","shots.on_away","shots_on_target.away","away_shots_on"],"0");
                    const danger = statPair(data,["pressure.home","dangerous_attacks.home","attacks.dangerous_home","home_pressure"],["pressure.away","dangerous_attacks.away","attacks.dangerous_away","away_pressure"],"0");
                    const cards = statPair(data,["cards.yellow_home","cards.home","yellow_cards.home"],["cards.yellow_away","cards.away","yellow_cards.away"],"0");
                    const poss = statPair(data,["possession.home","posse.home","ball_possession.home"],["possession.away","posse.away","ball_possession.away"],"—");
                    const pressure = calcPressurePct(data);
                    const series = makeSeries(data, pressure);
                    const cornersTotal = n(corners.home) + n(corners.away);
                    const shotsTotal = n(shots.home) + n(shots.away);
                    const dangerTotal = n(danger.home) + n(danger.away);
                    const confidence = clamp(Math.round((pressure.home * .55) + (Math.min(100,cornersTotal*7) * .25) + (Math.min(100,dangerTotal) * .20)), 1, 99);
            
                    rail.innerHTML = `
                      <section class="railCard matchRailCard railDashHeroPro">
                        <div class="railProTop"><div class="railProTitle"><i>⚽</i><span>MATCH CENTER</span></div><b class="railProStatus">${esc(st)}${data?.live ? " • " + esc(minute) : ""}</b></div>
                        <div class="railProLeague">${esc(league)} ${clean(game?.hora || data?.time,"") ? "• " + esc(clean(game?.hora || data?.time,"")) : ""}</div>
                        <div class="railProTeams"><div class="railProTeam"><div class="railProBadge">${esc(initials(home))}</div><strong>${esc(home)}</strong></div><div class="railProScore"><strong>${esc(scoreH)} × ${esc(scoreA)}</strong><span>${esc(minute)}</span></div><div class="railProTeam"><div class="railProBadge">${esc(initials(away))}</div><strong>${esc(away)}</strong></div></div>
                        <div class="railProMeta"><div><b>${esc(cornersTotal || "—")}</b><small>Escanteios totais</small></div><div><b>${esc(confidence)}%</b><small>Leitura do jogo</small></div></div>
                      </section>
            
                      <section class="railPressureMain"><div class="railPressureHead"><h3>PRESSÃO DO JOGO</h3><b>${esc(pressure.level)}</b></div><div class="pressureNames"><b>${esc(home)}</b><b>${esc(away)}</b></div><div class="pressurePctLine"><strong>${pressure.home}%</strong><div class="pressureTrackPro"><i class="pressureHomeFill" style="width:${pressure.home}%"></i><i class="pressureAwayFill" style="width:${pressure.away}%"></i></div><strong>${pressure.away}%</strong></div><div class="pressureCaption">base: ataques perigosos, finalizações, chutes no alvo e escanteios</div></section>
            
                      <section class="railComparePro"><h3>ESTATÍSTICAS COMPARATIVAS</h3><div class="compareRowsPro">
                        ${compareRow("⚑","Escanteios",corners.home,corners.away,`Total ${cornersTotal || "—"}`)}
                        ${compareRow("🎯","Finalizações",shots.home,shots.away,`Total ${shotsTotal || "—"}`)}
                        ${compareRow("◎","No alvo",on.home,on.away)}
                        ${compareRow("↯","Ataques perigosos",danger.home,danger.away,`Total ${dangerTotal || "—"}`)}
                        ${compareRow("◷","Posse de bola",poss.home,poss.away)}
                        ${compareRow("▰","Cartões amarelos",cards.home,cards.away)}
                      </div></section>
            
                      <section class="railChartPro"><div class="railPressureHead"><h3>GRÁFICO DE PRESSÃO</h3><b>momentum</b></div>${lineChart(series)}</section>
                      <section class="railTimelinePro"><h3>EVENTOS DA PARTIDA</h3>${eventsHTML(data)}</section>
                      <section class="railMiniDashPro"><h3>RESUMO DO JOGO</h3><div class="miniDashGridPro"><div><span>Ritmo</span><b>${esc(pressure.level.replace("PRESSÃO ",""))}</b><small>jogo atual</small></div><div><span>Confiança</span><b>${confidence}%</b><small>dashboard</small></div><div><span>Cantos</span><b>${cornersTotal || "—"}</b><small>total</small></div><div><span>Finalizações</span><b>${shotsTotal || "—"}</b><small>total</small></div></div></section>
                      <button class="railFullBtn railFullBtnPro" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}">VER PARTIDA COMPLETA →</button>`;
                  }
            
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game){
                    const rail = document.getElementById("desktopMatchRail") || document.querySelector(".dashboardRightRail");
                    if (!rail || !game) return;
                    renderRail(rail, game, { status:"PRÉ-JOGO" });
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id, "");
                    if (!matchId) return;
                    try{
                      const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, { cache:"no-store" });
                      if (!res.ok) return;
                      const data = await res.json();
                      if (data && !data.error) renderRail(rail, game, data);
                    }catch(err){ console.warn("Match Center Dashboard Pro falhou:", err); }
                  };
                })();
            
                /* =========================================================
                   CALENDÁRIO DO TOPO — abre meses anteriores e próximos
                   Ao clicar no dia:
                   1) Se existir input#date, atualiza e dispara change/input.
                   2) Senão, navega para ?data=YYYY-MM-DD.
                   ========================================================= */
                (function(){
                  const btnCalendario = document.getElementById("btnCalendario");
                  const calendarModal = document.getElementById("calendarModal");
                  const closeCalendar = document.getElementById("closeCalendar");
                  const closeCalendarX = document.getElementById("closeCalendarX");
                  const calendarDays = document.getElementById("calendarDays");
                  const calendarTitle = document.getElementById("calendarTitle");
                  const calendarSubTitle = document.getElementById("calendarSubTitle");
                  const prevMonth = document.getElementById("prevMonth");
                  const nextMonth = document.getElementById("nextMonth");
                  const todayCalendar = document.getElementById("todayCalendar");
            
                  if (!btnCalendario || !calendarModal || !calendarDays) return;
            
                  
                  // WEB V26: no desktop usamos somente o dropdown da topbar.
                  if (window.innerWidth > 980) return;
        const MONTHS = [
                    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
                  ];
            
                  function pad(n){
                    return String(n).padStart(2,"0");
                  }
            
                  function toYMD(date){
                    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
                  }
            
                  function parseYMD(value){
                    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
                    const [y,m,d] = value.split("-").map(Number);
                    return new Date(y, m - 1, d, 12, 0, 0);
                  }
            
                  function sameDay(a,b){
                    return a.getFullYear() === b.getFullYear()
                      && a.getMonth() === b.getMonth()
                      && a.getDate() === b.getDate();
                  }
            
                  function getCurrentSelectedDate(){
                    const input = document.getElementById("date");
                    const urlDate = new URLSearchParams(window.location.search).get("data");
                    return parseYMD(input?.value || urlDate || toYMD(new Date()));
                  }
            
                  let viewDate = getCurrentSelectedDate();
            
                  function renderCalendar(){
                    calendarDays.innerHTML = "";
            
                    const selected = getCurrentSelectedDate();
                    const today = new Date();
            
                    const year = viewDate.getFullYear();
                    const month = viewDate.getMonth();
            
                    calendarTitle.textContent = `${MONTHS[month]} ${year}`;
                    if (calendarSubTitle) calendarSubTitle.textContent = "Ver jogos por data";
            
                    const first = new Date(year, month, 1, 12, 0, 0);
                    const start = new Date(first);
                    start.setDate(first.getDate() - first.getDay());
            
                    for(let i = 0; i < 42; i++){
                      const day = new Date(start);
                      day.setDate(start.getDate() + i);
            
                      const btn = document.createElement("button");
                      btn.type = "button";
                      btn.className = "calendarDay";
                      btn.textContent = day.getDate();
                      btn.dataset.date = toYMD(day);
            
                      if (day.getMonth() !== month) btn.classList.add("muted");
                      if (sameDay(day, today)) btn.classList.add("today");
                      if (sameDay(day, selected)) btn.classList.add("selected");
            
                      btn.addEventListener("click", async function(){
                        const ymd = this.dataset.date;
                        const input = document.getElementById("date");
            
                        // Mantém a data escolhida no endereço também.
                        // O servidor/JS usa "date", não "data".
                        const url = new URL(window.location.href);
                        url.searchParams.set("date", ymd);
                        window.history.pushState({}, "", url.toString());
            
                        if (input){
                          input.value = ymd;
                          input.dispatchEvent(new Event("input", { bubbles:true }));
                          input.dispatchEvent(new Event("change", { bubbles:true }));
                        }
            
                        calendarModal.classList.remove("active");
            
                        // PUXA OS JOGOS DA API NA DATA ESCOLHIDA
                        // Seu script principal usa loadAll({ date, fresh }).
                        try{
                          if (typeof loadAll === "function"){
                            await loadAll({ date: ymd, fresh: true });
                            return;
                          }
            
                          // Fallback para telas de mercados/filtros.
                          if (typeof loadMarketGames === "function" && typeof renderMarketFilters === "function"){
                            await loadMarketGames({ date: ymd, fresh: true });
                            renderMarketFilters();
                            return;
                          }
            
                          // Último fallback, caso esteja em outro arquivo/página.
                          window.location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
                        }catch(err){
                          console.error("Falha ao carregar jogos pelo calendário:", err);
                          window.location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
                        }
                      });
            
                      calendarDays.appendChild(btn);
                    }
                  }
            
                  function openCalendar(){
                    viewDate = getCurrentSelectedDate();
                    renderCalendar();
                    calendarModal.classList.add("active");
                    calendarModal.setAttribute("aria-hidden", "false");
                  }
            
                  function close(){
                    calendarModal.classList.remove("active");
                    calendarModal.setAttribute("aria-hidden", "true");
                  }
            
                  btnCalendario.addEventListener("click", function(e){
                    e.preventDefault();
                    openCalendar();
                  });
            
                  prevMonth?.addEventListener("click", function(){
                    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1, 12, 0, 0);
                    renderCalendar();
                  });
            
                  nextMonth?.addEventListener("click", function(){
                    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1, 12, 0, 0);
                    renderCalendar();
                  });
            
                  todayCalendar?.addEventListener("click", function(){
                    viewDate = new Date();
                    const input = document.getElementById("date");
                    const ymd = toYMD(viewDate);
            
                    if (input){
                      input.value = ymd;
                      input.dispatchEvent(new Event("input", { bubbles:true }));
                      input.dispatchEvent(new Event("change", { bubbles:true }));
                    }
            
                    renderCalendar();
                  });
            
                  closeCalendar?.addEventListener("click", close);
                  closeCalendarX?.addEventListener("click", close);
            
                  calendarModal.addEventListener("click", function(e){
                    if (e.target === calendarModal) close();
                  });
            
                  document.addEventListener("keydown", function(e){
                    if (e.key === "Escape") close();
                  });
                })();
            
                /* =========================================================
                   CALENDÁRIO TOPBAR — DROPDOWN HOVER INTEGRADO À API
                   Usa loadAll({ date, fresh:true }) quando existir.
                   ========================================================= */
                (function(){
                  const btn = document.getElementById("btnCalendario");
                  const drop = document.getElementById("topCalendarDropdown");
                  const daysEl = document.getElementById("topCalendarDays");
                  const titleEl = document.getElementById("topCalTitle");
                  const prevBtn = document.getElementById("topCalPrev");
                  const nextBtn = document.getElementById("topCalNext");
                  const todayBtn = document.getElementById("topCalToday");
            
                  if (!btn || !drop || !daysEl || !titleEl) return;
            
                  const MONTHS = [
                    "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
                    "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"
                  ];
            
                  let closeTimer = null;
            
                  function pad(n){
                    return String(n).padStart(2,"0");
                  }
            
                  function toYMD(date){
                    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
                  }
            
                  function parseYMD(value){
                    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
                    const [y,m,d] = value.split("-").map(Number);
                    return new Date(y, m - 1, d, 12, 0, 0);
                  }
            
                  function sameDay(a,b){
                    return a.getFullYear() === b.getFullYear()
                      && a.getMonth() === b.getMonth()
                      && a.getDate() === b.getDate();
                  }
            
                  function getSelectedYMD(){
                    const input = document.getElementById("date");
                    return input?.value || toYMD(new Date());
                  }
            
                  let viewDate = parseYMD(getSelectedYMD());
            
                  function render(){
                    daysEl.innerHTML = "";
            
                    const selected = parseYMD(getSelectedYMD());
                    const today = new Date();
                    const year = viewDate.getFullYear();
                    const month = viewDate.getMonth();
            
                    titleEl.textContent = `${MONTHS[month]} ${year}`;
            
                    const first = new Date(year, month, 1, 12, 0, 0);
                    const start = new Date(first);
                    start.setDate(first.getDate() - first.getDay());
            
                    for (let i = 0; i < 42; i++){
                      const day = new Date(start);
                      day.setDate(start.getDate() + i);
            
                      const b = document.createElement("button");
                      b.type = "button";
                      b.className = "topCalendarDay";
                      b.textContent = day.getDate();
                      b.dataset.date = toYMD(day);
            
                      if (day.getMonth() !== month) b.classList.add("is-muted");
                      if (sameDay(day, today)) b.classList.add("is-today");
                      if (sameDay(day, selected)) b.classList.add("is-selected");
            
                      daysEl.appendChild(b);
                    }
                  }
            
                  function positionDropdown(){
                    const rect = btn.getBoundingClientRect();
                    const gap = 8;
                    const width = drop.offsetWidth || 320;
                    let left = rect.left + (rect.width / 2) - (width / 2);
                    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
            
                    drop.style.left = `${left}px`;
                    drop.style.right = "auto";
                    drop.style.top = `${rect.bottom + gap}px`;
                  }
            
                  function open(){
                    clearTimeout(closeTimer);
                    viewDate = parseYMD(getSelectedYMD());
                    render();
                    positionDropdown();
                    btn.classList.add("is-open");
                    drop.classList.add("is-open");
                    drop.setAttribute("aria-hidden","false");
                  }
            
                  function closeSoon(){
                    clearTimeout(closeTimer);
                    closeTimer = setTimeout(() => {
                      btn.classList.remove("is-open");
                      drop.classList.remove("is-open");
                      drop.setAttribute("aria-hidden","true");
                    }, 180);
                  }
            
                  function keepOpen(){
                    clearTimeout(closeTimer);
                  }
            
                  async function selectDate(ymd){
                    const input = document.getElementById("date");
            
                    const url = new URL(window.location.href);
                    url.hash = "";
                    url.searchParams.delete("data");
                    url.searchParams.set("date", ymd);
                    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
            
                    if (input){
                      input.value = ymd;
        
                      // No desktop o reload é controlado por CornerProDesktopReloadDate,
                      // evitando os listeners antigos que poderiam disparar outro carregamento.
                      if (window.innerWidth <= 980){
                        input.dispatchEvent(new Event("input", { bubbles:true }));
                        input.dispatchEvent(new Event("change", { bubbles:true }));
                      }
                    }
            
                    btn.classList.remove("is-open");
                    drop.classList.remove("is-open");
                    drop.setAttribute("aria-hidden","true");
            
                    try{
                      // WEB V25 — o calendário controla diretamente o dashboard desktop.
                      // Mantém o mesmo layout e faz UM carregamento da data escolhida.
                      if (typeof window.CornerProDesktopReloadDate === "function"){
                        await window.CornerProDesktopReloadDate(ymd);
                        return;
                      }
        
                      // Fallback legado para outras telas.
                      if (typeof window.CornerProReloadRealGames === "function"){
                        await window.CornerProReloadRealGames(ymd);
                        return;
                      }
            
                      if (typeof loadAll === "function"){
                        await loadAll({ date: ymd, fresh: true });
                        return;
                      }
            
                      if (typeof window.loadAll === "function"){
                        await window.loadAll({ date: ymd, fresh: true });
                        return;
                      }
            
                      if (typeof loadMarketGames === "function" && typeof renderMarketFilters === "function"){
                        await loadMarketGames({ date: ymd, fresh: true });
                        renderMarketFilters();
                        return;
                      }
            
                      window.location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
                    }catch(err){
                      console.error("Erro ao carregar jogos da data:", err);
                      window.location.href = `/pre-jogo.html?date=${encodeURIComponent(ymd)}`;
                    }
                  }
            
                  btn.addEventListener("mouseenter", open);
                  btn.addEventListener("mouseleave", closeSoon);
                  btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if(drop.classList.contains("is-open")){
                      btn.classList.remove("is-open");
                      drop.classList.remove("is-open");
                      drop.setAttribute("aria-hidden","true");
                    }else{
                      open();
                    }
                  });
            
                  drop.addEventListener("mouseenter", keepOpen);
                  drop.addEventListener("mouseleave", closeSoon);
            
                  prevBtn?.addEventListener("click", () => {
                    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1, 12, 0, 0);
                    render();
                  });
            
                  nextBtn?.addEventListener("click", () => {
                    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1, 12, 0, 0);
                    render();
                  });
            
                  todayBtn?.addEventListener("click", () => {
                    const ymd = toYMD(new Date());
                    viewDate = parseYMD(ymd);
                    selectDate(ymd);
                  });
            
                  daysEl.addEventListener("click", (e) => {
                    const day = e.target.closest(".topCalendarDay");
                    if (!day) return;
                    selectDate(day.dataset.date);
                  });
            
                  document.addEventListener("click", (e) => {
                    if(!drop.classList.contains("is-open")) return;
                    if(drop.contains(e.target) || btn.contains(e.target)) return;
                    btn.classList.remove("is-open");
                    drop.classList.remove("is-open");
                    drop.setAttribute("aria-hidden","true");
                  });
        
                  document.addEventListener("keydown", (e) => {
                    if (e.key !== "Escape") return;
                    btn.classList.remove("is-open");
                    drop.classList.remove("is-open");
                    drop.setAttribute("aria-hidden","true");
                  });
            
                  window.addEventListener("resize", () => {
                    if (drop.classList.contains("is-open")) positionDropdown();
                  });
                })();
            
            
                /* PATCH FINAL — calendário carregando jogos reais do dashboard
                   Removido para evitar carregamento duplicado: o clique agora é tratado pelo calendário principal acima.
                */
                /* =========================================================
                   RIGHT RAIL PREMIUM DASH — RENDER FINAL
                   Cole no final do script.js
                   ========================================================= */
                (function installUltraPremiumRightRail(){
                  if (window.__ultraPremiumRightRailInstalled) return;
                  window.__ultraPremiumRightRailInstalled = true;
            
                  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
                  const clean = (v, fb="—") => {
                    const s = String(v ?? "").trim();
                    return s && !["undefined","null","NaN"].includes(s) ? s : fb;
                  };
                  const num = (v, fb=0) => {
                    const n = Number(String(v ?? "").replace("%","").replace(",","."));
                    return Number.isFinite(n) ? n : fb;
                  };
                  const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
                  const pct = (h,a) => {
                    const hh = num(h,0), aa = num(a,0), t = hh + aa;
                    if (!t) return 50;
                    return clamp(Math.round((hh/t)*100), 5, 95);
                  };
                  const initials = (name, fb="CP") => {
                    const s = clean(name, fb).replace(/[^\p{L}\p{N}\s]/gu," ").trim();
                    const p = s.split(/\s+/).filter(Boolean);
                    return ((p[0]?.[0] || fb[0]) + (p[1]?.[0] || p[0]?.[1] || fb[1] || "P")).toUpperCase();
                  };
            
                  function getMinute(data){
                    const raw = data?.minute ?? data?.elapsed ?? data?.time_elapsed ?? data?.timer ?? data?.match_minute;
                    const n = parseInt(String(raw ?? "").replace(/[^0-9]/g,""),10);
                    return Number.isFinite(n) ? clamp(n,1,130) : (data?.finished ? 90 : null);
                  }
            
                  function statusLabel(data){
                    const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                    if (data?.finished || raw.includes("ft") || raw.includes("final") || raw.includes("finished") || raw.includes("encerrado")) return "ENCERRADO";
                    if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                    return "PRÉ-JOGO";
                  }
            
                  function eventMinute(e){
                    const n = parseInt(String(e?.minute ?? e?.time ?? e?.elapsed ?? e?.label ?? "").replace(/[^0-9]/g,""),10);
                    return Number.isFinite(n) ? clamp(n,1,130) : null;
                  }
            
                  function normTeam(s){
                    return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
                  }
            
                  function sameTeam(a,b){
                    const x = normTeam(a), y = normTeam(b);
                    return x && y && (x === y || x.includes(y) || y.includes(x));
                  }
            
                  function eventWeight(e){
                    const t = String(e?.type || e?.label || e?.detail || e?.description || "").toLowerCase();
                    if (t.includes("goal") || t.includes("gol")) return 12;
                    if (t.includes("shot on") || t.includes("on target") || t.includes("no alvo")) return 9;
                    if (t.includes("shot") || t.includes("finaliza")) return 6;
                    if (t.includes("corner") || t.includes("escanteio")) return 7;
                    if (t.includes("danger") || t.includes("perigoso") || t.includes("press")) return 4;
                    if (t.includes("yellow") || t.includes("amarelo")) return 2;
                    return 1;
                  }
            
                  function seriesFromTimeline(data){
                    const candidates = [
                      data?.pressure_timeline, data?.pressureTimeline, data?.pressure_history, data?.pressureHistory,
                      data?.momentum, data?.momentum_timeline, data?.momentumTimeline, data?.last15_pressure,
                      data?.attacks_timeline, data?.dangerous_attacks_timeline
                    ];
                    for (const c of candidates){
                      if (Array.isArray(c) && c.length >= 2){
                        const arr = c.slice(-16).map((p,i) => ({
                          minute: clean(p?.minute ?? p?.time ?? p?.label ?? `${i+1}`),
                          home: num(p?.home ?? p?.casa ?? p?.mandante ?? p?.home_pressure ?? p?.h, null),
                          away: num(p?.away ?? p?.fora ?? p?.visitante ?? p?.away_pressure ?? p?.a, null),
                          source: "API"
                        })).filter(p => p.home !== null || p.away !== null);
                        if (arr.length >= 2) return arr;
                      }
                    }
                    return [];
                  }
            
                  function seriesFromEvents(data, homeName, awayName){
                    const events = Array.isArray(data?.events) ? data.events : [];
                    if (!events.length) return [];
                    const minuteNow = getMinute(data) || 90;
                    const start = Math.max(1, minuteNow - 14);
                    const buckets = Array.from({length:15}, (_,i) => ({ minute:`${start+i}'`, home:0, away:0, source:"EVENTOS" }));
                    events.forEach(e => {
                      const m = eventMinute(e);
                      if (m === null || m < start || m > minuteNow) return;
                      const side = String(e?.side || e?.team_side || "").toLowerCase();
                      const team = e?.team || e?.time || e?.team_name || "";
                      const w = eventWeight(e);
                      const idx = clamp(m - start,0,14);
                      if (side.includes("home") || side.includes("casa") || side.includes("mandante") || sameTeam(team, homeName)) buckets[idx].home += w;
                      else if (side.includes("away") || side.includes("fora") || side.includes("visitante") || sameTeam(team, awayName)) buckets[idx].away += w;
                    });
                    return buckets.some(b => b.home || b.away) ? buckets : [];
                  }
            
                  function buildPressureSeries(data, homeName, awayName){
                    // Nada de estimativa por eventos, snapshot ou fórmulas: somente série real da API.
                    const real = seriesFromTimeline(data);
                    return real.length >= 2 ? real : [];
                  }
            
                  function svgPressureChart(series){
                    if (!series || series.length < 2) return `<div class="railPressureEmpty">Aguardando dados reais de pressão da API.</div>`;
                    const W=300,H=150,padL=52,padR=10,padT=12,padB=25,mid=78,chartH=52;
                    const maxV = Math.max(8, ...series.flatMap(p => [num(p.home,0), num(p.away,0)]));
                    const slot = (W-padL-padR)/series.length;
                    const barW = Math.max(7, Math.min(12, slot*.66));
                    const x = i => padL + i*slot + (slot-barW)/2;
                    const h = v => Math.max(2, (num(v,0)/maxV)*chartH);
                    const bars = series.map((p,i) => {
                      const bh=h(p.home), ba=h(p.away);
                      return `<rect class="homeBar" x="${x(i).toFixed(1)}" y="${(mid-bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"></rect><rect class="awayBar" x="${x(i).toFixed(1)}" y="${mid.toFixed(1)}" width="${barW.toFixed(1)}" height="${ba.toFixed(1)}" rx="2"></rect>`;
                    }).join("");
                    const source = esc(series[0]?.source || "API");
                    return `<div class="railPressureChartBox">
                      <div class="railPressureLegend"><span><i></i>Mandante</span><span class="away"><i></i>Visitante</span><b>${source}</b></div>
                      <svg class="railPressureSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pressão ofensiva dos últimos minutos">
                        <defs><linearGradient id="mcHomeGreenGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b8ff83"></stop><stop offset=".48" stop-color="#63f127"></stop><stop offset="1" stop-color="#2bb514"></stop></linearGradient></defs>
                        <rect x="${padL}" y="${padT}" width="${W-padL-padR}" height="${chartH}" fill="rgba(99,241,39,.10)"></rect>
                        <rect x="${padL}" y="${mid}" width="${W-padL-padR}" height="${chartH}" fill="rgba(174,183,187,.10)"></rect>
                        <line class="grid" x1="${padL}" y1="${padT}" x2="${W-padR}" y2="${padT}"></line>
                        <line class="grid" x1="${padL}" y1="${mid-chartH/2}" x2="${W-padR}" y2="${mid-chartH/2}"></line>
                        <line class="grid strong" x1="${padL}" y1="${mid}" x2="${W-padR}" y2="${mid}"></line>
                        <line class="grid" x1="${padL}" y1="${mid+chartH/2}" x2="${W-padR}" y2="${mid+chartH/2}"></line>
                        <line class="grid" x1="${padL}" y1="${mid+chartH}" x2="${W-padR}" y2="${mid+chartH}"></line>
                        <text class="axis" x="5" y="18">Muito forte</text><text class="axis" x="19" y="44">Forte</text><text class="axis" x="18" y="82">Neutro</text><text class="axis" x="19" y="108">Forte</text><text class="axis" x="5" y="134">Muito forte</text>
                        ${bars}
                        <text x="52" y="145">15'</text><text x="169" y="145">10'</text><text x="283" y="145">0'</text>
                      </svg>
                    </div>`;
                  }
            
                  function compareRow(icon, label, h, a){
                    const hh = clean(h,"—"), aa = clean(a,"—");
                    const hn = num(h,0), an = num(a,0), total = Math.max(1, hn + an);
                    const hp = clamp(Math.round((hn/total)*100),0,100);
                    const ap = clamp(100-hp,0,100);
                    return `<div class="railCompareRow"><strong>${esc(hh)}</strong><div class="railCompareMid"><div class="railCompareLabel"><i>${icon}</i>${esc(label)}</div><div class="railCompareTrack"><i style="width:${hp}%"></i><em style="width:${ap}%"></em></div></div><strong>${esc(aa)}</strong></div>`;
                  }
            
                  function eventIcon(e){
                    const t = String(e?.type || e?.label || "").toLowerCase();
                    if (t.includes("goal") || t.includes("gol")) return "⚽";
                    if (t.includes("corner") || t.includes("escanteio")) return "⚑";
                    if (t.includes("yellow") || t.includes("amarelo")) return "🟨";
                    if (t.includes("red") || t.includes("vermelho")) return "🟥";
                    if (t.includes("sub")) return "↔";
                    return "•";
                  }
            
                  function eventLines(data){
                    const events = Array.isArray(data?.events) ? data.events.slice(0,6) : [];
                    if (!events.length){
                      if (data?.live) return `<p>Ao vivo. Aguardando eventos detalhados da API.</p>`;
                      if (data?.finished) return `<p>Encerrado. A API não retornou timeline detalhada.</p>`;
                      return `<p>Pré-jogo. Os eventos aparecem quando a partida iniciar.</p>`;
                    }
                    return events.map(e => `<p class="railEventRow"><b>${esc(clean(e?.minute,"—"))}</b><span>${eventIcon(e)}</span><em>${esc(clean(e?.label || e?.type,"Evento"))}</em><small>${esc(clean(e?.team,""))}</small></p>`).join("");
                  }
            
                  function renderPregame(rail, ctx){
                    const p = clamp(Math.round(num(ctx.pct,69)),0,100);
                    rail.innerHTML = `<section class="railCard matchRailCard railDashHero is-pregame">
                      <div class="railTitle"><span>MATCH CENTER</span><b>PRÉ-JOGO</b></div>
                      <div class="railDashTeams"><div class="railDashTeam"><div class="railBadge">${initials(ctx.home,"MA")}</div><strong>${esc(ctx.home)}</strong></div><div class="railDashScore"><small>${esc(ctx.league)}</small><strong>0 - 0</strong><span>${esc(ctx.time)}</span></div><div class="railDashTeam"><div class="railBadge away">${initials(ctx.away,"VI")}</div><strong>${esc(ctx.away)}</strong></div></div>
                      <div class="railProgress"><i style="width:${p}%"></i></div>
                    </section>
                    <section class="railCard railDashStats"><h3>PAINEL DO FILTRO</h3><div class="railDashGrid"><div class="railLiveStat"><span>Força</span><b>${p}%</b><small>Filtro atual</small></div><div class="railLiveStat"><span>Projeção</span><b>${esc(ctx.proj)}</b><small>Escanteios</small></div><div class="railLiveStat"><span>Status</span><b>Pré</b><small>Aguardando jogo</small></div><div class="railLiveStat"><span>Mercado</span><b>+9.5</b><small>Escanteios</small></div></div></section>
                    <section class="railCard railPressureCard"><div class="railPressureHead"><h3>PRESSÃO DO JOGO</h3><b>PROJEÇÃO</b></div><div class="railPressureMega"><div class="railPressureSide"><span>${esc(ctx.home)}</span><b>${p}%</b></div><div class="railGauge" style="--p:${p}"><i class="railGaugeNeedle"></i><i class="railGaugeBall">⚽</i></div><div class="railPressureSide away"><span>${esc(ctx.away)}</span><b>${100-p}%</b></div></div><div class="railSplitBar"><i style="width:${p}%"></i><em></em></div><div class="railPressureEmpty">O gráfico real aparece quando a API retornar dados de pressão.</div></section>
                    <section class="railCard railAiDash"><div><h3>LEITURA DO JOGO</h3><p>Jogo selecionado. Quando iniciar, a lateral vira um painel em tempo real com pressão, estatísticas e eventos.</p><small>Base: mercado selecionado e dados da API.</small></div><div class="railConfidenceCircle" style="--p:${p}"><b>${p}%</b><span>confiança</span></div></section>
                    <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(ctx.matchId)}" data-home="${esc(ctx.home)}" data-away="${esc(ctx.away)}" data-league="${esc(ctx.league)}" data-time="${esc(ctx.time)}">VER PARTIDA COMPLETA →</button>`;
                  }
            
                  function renderReal(rail, ctx, data){
                    const st = statusLabel(data);
                    const minute = getMinute(data);
                    const minuteText = data?.live && minute ? `${minute}'` : (data?.finished ? "90'" : "—");
                    const gh = clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? 0,"0");
                    const ga = clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? 0,"0");
                    const ch = clean(data?.corners?.home ?? data?.home_corners,"—");
                    const ca = clean(data?.corners?.away ?? data?.away_corners,"—");
                    const sh = clean(data?.shots?.home ?? data?.shots?.total_home ?? data?.home_shots,"—");
                    const sa = clean(data?.shots?.away ?? data?.shots?.total_away ?? data?.away_shots,"—");
                    const onh = clean(data?.shots_on_target?.home ?? data?.on_target?.home ?? data?.target?.home,"—");
                    const ona = clean(data?.shots_on_target?.away ?? data?.on_target?.away ?? data?.target?.away,"—");
                    const ph = clean(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.home_pressure,"—");
                    const pa = clean(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.away_pressure,"—");
                    const possH = clean(data?.possession?.home ?? data?.posse?.home,"—");
                    const possA = clean(data?.possession?.away ?? data?.posse?.away,"—");
                    const cardsH = clean(data?.cards?.yellow_home ?? data?.cards?.home ?? data?.yellow_cards?.home,"—");
                    const cardsA = clean(data?.cards?.yellow_away ?? data?.cards?.away ?? data?.yellow_cards?.away,"—");
                    const p = pct(ph,pa);
                    const progress = data?.finished ? 100 : (data?.live && minute ? clamp(minute,8,96) : 0);
                    const series = buildPressureSeries(data, ctx.home, ctx.away);
                    const confidence = clamp(Math.round((p + num(ctx.pct,69))/2),5,95);
                    const level = p >= 67 ? "PRESSÃO ALTA" : (p >= 55 ? "PRESSÃO MÉDIA" : "EQUILIBRADO");
                    rail.innerHTML = `<section class="railCard matchRailCard railDashHero ${data?.live ? "is-live" : ""} ${data?.finished ? "is-finished" : ""}">
                      <div class="railTitle"><span>MATCH CENTER</span><b>${esc(st)}${data?.live ? " • "+minuteText : ""}</b></div>
                      <div class="railDashTeams"><div class="railDashTeam"><div class="railBadge">${initials(ctx.home,"MA")}</div><strong>${esc(ctx.home)}</strong></div><div class="railDashScore"><small>${esc(ctx.league)}</small><strong>${esc(gh)} - ${esc(ga)}</strong><span>${esc(minuteText)}</span></div><div class="railDashTeam"><div class="railBadge away">${initials(ctx.away,"VI")}</div><strong>${esc(ctx.away)}</strong></div></div>
                      <div class="railProgress"><i style="width:${progress}%"></i></div>
                    </section>
                    <section class="railCard railDashStats"><h3>DADOS REAIS DA PARTIDA</h3><div class="railDashGrid"><div class="railLiveStat"><span>Escanteios</span><b>${esc(ch)} x ${esc(ca)}</b><small>Total ${num(ch,0)+num(ca,0) || "—"}</small></div><div class="railLiveStat"><span>Finalizações</span><b>${esc(sh)} x ${esc(sa)}</b><small>Dados API</small></div><div class="railLiveStat"><span>Pressão</span><b>${esc(ph)} x ${esc(pa)}</b><small>Ataques perigosos</small></div><div class="railLiveStat"><span>Cartões</span><b>${esc(cardsH)} x ${esc(cardsA)}</b><small>Amarelos</small></div></div></section>
                    <section class="railCard railPressureCard"><div class="railPressureHead"><h3>PRESSÃO DO JOGO</h3><b>${level}</b></div><div class="railPressureMega"><div class="railPressureSide"><span>${esc(ctx.home)}</span><b>${p}%</b></div><div class="railGauge" style="--p:${p}"><i class="railGaugeNeedle"></i><i class="railGaugeBall">⚽</i></div><div class="railPressureSide away"><span>${esc(ctx.away)}</span><b>${100-p}%</b></div></div><div class="railSplitBar"><i style="width:${p}%"></i><em></em></div>${svgPressureChart(series)}</section>
                    <section class="railCard"><h3>ESTATÍSTICAS COMPARATIVAS</h3><div class="railCompareList">${compareRow("⚑","Escanteios",ch,ca)}${compareRow("🎯","Finalizações",sh,sa)}${compareRow("◎","No alvo",onh,ona)}${compareRow("⚡","Ataques perigosos",ph,pa)}${compareRow("◷","Posse de bola",possH,possA)}${compareRow("🟨","Cartões amarelos",cardsH,cardsA)}</div></section>
                    <section class="railCard"><h3>EVENTOS DA PARTIDA</h3><div class="railEvents railEventsDash">${eventLines(data)}</div></section>
                    <section class="railCard railAiDash"><div><h3>LEITURA DO JOGO</h3><p>${p >= 55 ? esc(ctx.home) + " com maior domínio ofensivo no recorte atual." : esc(ctx.away) + " equilibrando melhor a pressão no recorte atual."}</p><small>Baseado nos dados reais disponíveis.</small></div><div class="railConfidenceCircle" style="--p:${confidence}"><b>${confidence}%</b><span>confiança</span></div></section>
                    <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(ctx.matchId)}" data-home="${esc(ctx.home)}" data-away="${esc(ctx.away)}" data-league="${esc(ctx.league)}" data-time="${esc(ctx.time)}">VER PARTIDA COMPLETA →</button>`;
                  }
            
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail || !game) return;
                    const ctx = {
                      matchId: clean(game?.match_id || game?.id || game?.event_key || game?.event_id || "", ""),
                      home: clean(game?.casa || game?.home || game?.home_team || game?.home_name, "Mandante"),
                      away: clean(game?.fora || game?.away || game?.away_team || game?.away_name, "Visitante"),
                      league: clean(game?.liga || game?.league_name || game?.league?.name, "Liga"),
                      time: clean(game?.hora || game?.time, "—"),
                      pct: clamp(Math.round(num(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score, 69)),0,100),
                      proj: Number.isFinite(Number(game?.proj_cantos)) ? Number(game.proj_cantos).toFixed(1).replace(".0","") : "—"
                    };
                    renderPregame(rail, ctx);
                    if (!ctx.matchId) return;
                    try{
                      const res = await fetch(`/match_center?match_id=${encodeURIComponent(ctx.matchId)}&t=${Date.now()}`, { cache:"no-store" });
                      if (!res.ok) return;
                      const data = await res.json();
                      if (data && !data.error) renderReal(rail, {
                        ...ctx,
                        home: clean(data.home || data.casa || data.home_team, ctx.home),
                        away: clean(data.away || data.fora || data.away_team, ctx.away),
                        league: clean(data.league || data.liga || data.league_name, ctx.league),
                        time: clean(data.time || data.hora, ctx.time)
                      }, data);
                    }catch(err){
                      console.warn("Right rail ultra premium falhou:", err);
                    }
                  };
                })();
            
                /* =========================================================
                   MATCH CENTER PRO — RAIL DASH AVANÇADO
                   - Sobrescreve apenas a coluna #desktopMatchRail
                   - Mantém motor, API e cards principais intactos
                   ========================================================= */
                (function installMatchCenterProRail(){
                  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
                  const clean = (v, fb="—") => {
                    const s = String(v ?? "").trim();
                    return s && s !== "undefined" && s !== "null" && s !== "NaN" ? s : fb;
                  };
                  const num = (v, fb=0) => {
                    const n = Number(String(v ?? "").replace("%","").replace(",","."));
                    return Number.isFinite(n) ? n : fb;
                  };
                  const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
                  const initials = (name, fb="CP") => {
                    const p = clean(name, fb).split(/\s+/).filter(Boolean);
                    return (p.length > 1 ? p[0][0] + p[1][0] : p[0]?.slice(0,2) || fb).toUpperCase();
                  };
            
                  function getStatus(data){
                    const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                    if (data?.finished || raw.includes("finished") || raw.includes("final") || raw.includes("ft") || raw.includes("encerrado")) return "ENCERRADO";
                    if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                    return "PRÉ-JOGO";
                  }
            
                  function getMinute(data){
                    const n = parseInt(String(data?.minute ?? data?.match_minute ?? data?.time_live ?? "").replace(/[^\d]/g,""), 10);
                    if (Number.isFinite(n)) return clamp(n, 1, 120);
                    return data?.finished ? 90 : 0;
                  }
            
                  function buildSeries(data, ph, pa){
                    const candidates = [data?.pressure_timeline,data?.pressureTimeline,data?.pressure_history,data?.pressureHistory,data?.momentum,data?.momentum_timeline,data?.last15_pressure,data?.dangerous_attacks_timeline];
                    for (const c of candidates){
                      if (Array.isArray(c) && c.length >= 3){
                        return c.slice(-18).map((p,i)=>({
                          m: clean(p?.minute ?? p?.label ?? p?.time ?? `${i+1}`),
                          h: num(p?.home ?? p?.mandante ?? p?.casa ?? p?.home_pressure ?? p?.h,0),
                          a: num(p?.away ?? p?.visitante ?? p?.fora ?? p?.away_pressure ?? p?.a,0)
                        }));
                      }
                    }
                    const events = Array.isArray(data?.events) ? data.events : [];
                    if (events.length){
                      const home = clean(data?.home || data?.casa || data?.home_team || "");
                      const away = clean(data?.away || data?.fora || data?.away_team || "");
                      const now = getMinute(data) || 90;
                      const start = Math.max(1, now - 17);
                      const arr = Array.from({length:18},(_,i)=>({m:`${start+i}'`,h:0,a:0}));
                      const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
                      events.forEach(e=>{
                        const m = parseInt(String(e?.minute ?? e?.time ?? e?.elapsed ?? "").replace(/[^\d]/g,""),10);
                        if (!Number.isFinite(m) || m < start || m > now) return;
                        const t = String(e?.type || e?.label || e?.detail || "").toLowerCase();
                        let w = t.includes("goal") || t.includes("gol") ? 12 : t.includes("corner") || t.includes("escanteio") ? 7 : t.includes("shot") || t.includes("final") ? 6 : t.includes("danger") || t.includes("perig") ? 4 : 2;
                        const side = String(e?.side || e?.team_side || "").toLowerCase();
                        const team = norm(e?.team || e?.time || e?.team_name || "");
                        const idx = clamp(m - start, 0, 17);
                        if (side.includes("home") || side.includes("casa") || team.includes(norm(home))) arr[idx].h += w;
                        else if (side.includes("away") || side.includes("fora") || team.includes(norm(away))) arr[idx].a += w;
                      });
                      if (arr.some(x=>x.h || x.a)) return arr;
                    }
                    if (data?.live || data?.finished){
                      return Array.from({length:18},(_,i)=>({
                        m: i===0?"15'":i===9?"7'":i===17?"0'":"",
                        h: Math.max(1, Math.round(num(ph,0)/18 + ((i%4)-1))),
                        a: Math.max(1, Math.round(num(pa,0)/18 + ((i%3)-1)))
                      }));
                    }
                    return [];
                  }
            
                  function pressureChart(series, homePct=60){
                    const W = 320, H = 104, base = 52, top = 10, bottom = 92;
                    let data = Array.isArray(series) ? series.filter(Boolean) : [];
                    if (data.length < 2){
                      const hp = Math.max(5, Math.min(95, Number(homePct) || 60));
                      const ap = 100 - hp;
                      data = Array.from({length:18}, (_,i)=>{
                        const wave = Math.sin(i * .78) * 1.8 + Math.cos(i * .35) * 1.2;
                        return {
                          m: i===0?"0'":i===6?"30'":i===12?"60'":i===17?"90'":"",
                          h: Math.max(1, Math.round((hp/10) + wave + (i%5===0?2:0))),
                          a: Math.max(1, Math.round((ap/10) - wave*.6 + (i%6===2?2:0)))
                        };
                      });
                    }
                    const max = Math.max(8, ...data.flatMap(x=>[num(x.h,0), num(x.a,0)]));
                    const gap = W / data.length;
                    const bw = Math.max(7, Math.min(12, gap*.62));
                    const bars = data.map((p,i)=>{
                      const x = i*gap + (gap-bw)/2;
                      const hh = Math.max(3, (num(p.h,0)/max)*42);
                      const ah = Math.max(3, (num(p.a,0)/max)*34);
                      return `<rect class="mcProBarH" x="${x.toFixed(1)}" y="${(base-hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3"/>
                              <rect class="mcProBarA" x="${x.toFixed(1)}" y="${base}" width="${bw.toFixed(1)}" height="${ah.toFixed(1)}" rx="3"/>`;
                    }).join("");
                    return `<svg class="mcProChart" viewBox="0 0 ${W} ${H}" aria-label="Barra de pressão do jogo">
                      <defs>
                        <linearGradient id="mcProGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#baff89"/><stop offset="100%" stop-color="#32e21c"/></linearGradient>
                      </defs>
                      <line class="mcProMid" x1="0" y1="${base}" x2="${W}" y2="${base}"/>
                      <line class="mcProGrid" x1="0" y1="${top}" x2="${W}" y2="${top}"/>
                      <line class="mcProGrid" x1="0" y1="${bottom}" x2="${W}" y2="${bottom}"/>
                      ${bars}
                      <text x="0" y="102">0'</text><text x="101" y="102">30'</text><text x="210" y="102">60'</text><text x="297" y="102">90'</text>
                    </svg>`;
                  }
            
                  function compareRow(label, icon, h, a){
                    const hn = num(h,0), an = num(a,0), total = Math.max(1, hn + an);
                    const hp = clamp(Math.round((hn/total)*100), 0, 100);
                    const ap = 100 - hp;
                    return `<div class="mcProCompareRow">
                      <b>${esc(h)}</b><div class="mcProCompareMid"><span style="width:${hp}%"></span><i>${icon}</i><em style="width:${ap}%"></em><strong>${esc(label)}</strong></div><b class="away">${esc(a)}</b>
                    </div>`;
                  }
            
                  function renderRail({rail, game, data=null, matchId, home, away, league, time, pct, proj}){
                    const status = data ? getStatus(data) : "PRÉ-JOGO";
                    const minute = data ? getMinute(data) : 0;
                    const minuteText = data ? (data.live && minute ? `${minute}'` : data.finished ? "90'" : "—") : clean(time,"—");
                    const gh = clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? (data ? 0 : 0), "0");
                    const ga = clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? (data ? 0 : 0), "0");
                    const ch = clean(data?.corners?.home ?? data?.home_corners ?? (data ? "—" : "—"));
                    const ca = clean(data?.corners?.away ?? data?.away_corners ?? (data ? "—" : "—"));
                    const sh = clean(data?.shots?.home ?? data?.shots?.total_home ?? data?.home_shots ?? "—");
                    const sa = clean(data?.shots?.away ?? data?.shots?.total_away ?? data?.away_shots ?? "—");
                    const onh = clean(data?.shots_on_target?.home ?? data?.on_target?.home ?? data?.home_shots_on ?? "—");
                    const ona = clean(data?.shots_on_target?.away ?? data?.on_target?.away ?? data?.away_shots_on ?? "—");
                    const ph = clean(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.home_pressure ?? (data ? "—" : pct));
                    const pa = clean(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.away_pressure ?? (data ? "—" : Math.max(0,100-pct)));
                    const cardsH = clean(data?.cards?.yellow_home ?? data?.cards?.home ?? data?.yellow_cards?.home ?? "—");
                    const cardsA = clean(data?.cards?.yellow_away ?? data?.cards?.away ?? data?.yellow_cards?.away ?? "—");
                    const totalPress = Math.max(1, num(ph,0)+num(pa,0));
                    const pressPct = data ? clamp(Math.round((num(ph,0)/totalPress)*100),5,95) : clamp(pct,5,95);
                    const series = data ? buildSeries(data, ph, pa) : [];
                    const indice = clamp(Math.round((pct + pressPct) / 2), 5, 96);
            
                    rail.innerHTML = `
                      <section class="railCard mcProHero ${data?.live ? "is-live" : ""} ${data?.finished ? "is-finished" : ""}">
                        <div class="mcProTop"><span>● MATCH CENTER</span><b>${esc(status)}</b></div>
                        <div class="mcProLeague">${esc(league)} ${time ? `• ${esc(time)}` : ""}</div>
                        <div class="mcProVersus">
                          <div class="mcProTeam"><i>${esc(initials(home,"MA"))}</i><strong>${esc(home)}</strong><small>Casa</small></div>
                          <div class="mcProScore"><strong>${esc(gh)}<em>×</em>${esc(ga)}</strong><span>${esc(minuteText)}</span></div>
                          <div class="mcProTeam away"><i>${esc(initials(away,"VI"))}</i><strong>${esc(away)}</strong><small>Fora</small></div>
                        </div>
                        <div class="mcProDominance"><span style="width:${pressPct}%"></span><b>${pressPct}% pressão</b></div>
                      </section>
            
                      <section class="railCard mcProKpis">
                        <div class="mcProKpi"><span>⚑</span><small>Escanteios</small><b>${esc(ch)} x ${esc(ca)}</b></div>
                        <div class="mcProKpi"><span>◎</span><small>Finalizações</small><b>${esc(sh)} x ${esc(sa)}</b></div>
                        <div class="mcProKpi"><span>↗</span><small>Proj. Cantos</small><b>${esc(proj)}</b></div>
                        <div class="mcProKpi"><span>📊</span><small>Leitura do jogo</small><b>${indice}%</b></div>
                      </section>
            
                      <section class="railCard mcProPressure">
                        <div class="mcProSectionHead"><h3>PRESSÃO DO JOGO</h3><b>${pressPct >= 70 ? "DOMÍNIO ALTO" : pressPct >= 55 ? "VANTAGEM" : "EQUILIBRADO"}</b></div>
                        <div class="mcProPressureDuel">
                          <div><span>${esc(home)}</span><b>${pressPct}%</b></div>
                          <div class="away"><span>${esc(away)}</span><b>${100-pressPct}%</b></div>
                        </div>
                        <div class="mcProSplit"><span style="width:${pressPct}%"></span><em style="width:${100-pressPct}%"></em></div>
                        <div class="mcProChartTitle">BARRA DE PRESSÃO • 90 MIN</div>
                        <div class="mcProChartBox">${pressureChart(series, pressPct)}</div>
                      </section>
            
                      <section class="railCard mcProCompare">
                        <div class="mcProSectionHead"><h3>COMPARATIVO</h3><b>REAL</b></div>
                        ${compareRow("Escanteios", "⚑", ch, ca)}
                        ${compareRow("Finalizações", "◎", sh, sa)}
                        ${compareRow("No alvo", "◉", onh, ona)}
                        ${compareRow("Ataques perigosos", "↯", ph, pa)}
                        ${compareRow("Cartões amarelos", "▰", cardsH, cardsA)}
                      </section>
            
                      <section class="railCard mcProInsight">
                        <div><h3>LEITURA DO JOGO</h3><p>${data ? `${esc(home)} aparece com ${pressPct}% da pressão no recorte atual.` : `Pré-jogo carregado. Quando a partida iniciar, entram pressão real, eventos e estatísticas da API.`}</p></div>
                        <div class="mcProAiCircle" style="--p:${indice};"><b>${indice}%</b><span>Índice</span></div>
                      </section>
            
                      <button class="railFullBtn mcProBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}" data-time="${esc(time)}">VER PARTIDA COMPLETA →</button>
                    `;
                  }
            
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail || !game) return;
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id || "", "");
                    const home = clean(game?.casa || game?.home || game?.home_team || game?.home_name || "Mandante");
                    const away = clean(game?.fora || game?.away || game?.away_team || game?.away_name || "Visitante");
                    const league = clean(game?.liga || game?.league_name || game?.league?.name || "Liga");
                    const time = clean(game?.hora || game?.time || "—");
                    const pct = clamp(Math.round(num(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score, 69)), 0, 100);
                    const proj = Number.isFinite(Number(game?.proj_cantos)) ? Number(game.proj_cantos).toFixed(1).replace(".0","") : "—";
                    renderRail({rail, game, matchId, home, away, league, time, pct, proj});
                    if (!matchId) return;
                    try{
                      const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, {cache:"no-store"});
                      if (!res.ok) return;
                      const data = await res.json();
                      if (data && !data.error){
                        renderRail({rail, game, data, matchId, home: clean(data.home, home), away: clean(data.away, away), league: clean(data.league, league), time: clean(data.time, time), pct, proj});
                      }
                    }catch(err){
                      console.warn("Match Center Pro Rail falhou:", err);
                    }
                  };
                })();
            
                /* =========================================================
                   NO-IA LABEL PATCH — remove textos de IA apenas do Match Center
                   ========================================================= */
                (function removeIaLabelsFromMatchCenter(){
                  if (window.__noIaMatchCenterLabels) return;
                  window.__noIaMatchCenterLabels = true;
            
                  const replacements = [
                    [/LEITURA\s*IA/gi, "LEITURA DO JOGO"],
                    [/Radar\s*IA/gi, "Radar do jogo"],
                    [/RESUMO\s*IA/gi, "RESUMO DO JOGO"],
                    [/IA\s*Score/gi, "Índice do jogo"],
                    [/Leitura\s*IA/gi, "Leitura do jogo"],
                    [/\bIA\b/g, "Índice"]
                  ];
            
                  function cleanNode(root){
                    if (!root) return;
                    const scope = root.matches?.("#desktopMatchRail,#matchCenterOverlay,.dashboardRightRail,.matchCenterOverlay") ? root : root.querySelector?.("#desktopMatchRail,#matchCenterOverlay,.dashboardRightRail,.matchCenterOverlay");
                    const targets = scope ? [scope] : [];
                    if (!targets.length && root.id === "desktopMatchRail") targets.push(root);
            
                    targets.forEach(area => {
                      const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
                      const nodes = [];
                      while (walker.nextNode()) nodes.push(walker.currentNode);
                      nodes.forEach(n => {
                        let txt = n.nodeValue;
                        replacements.forEach(([re,to]) => { txt = txt.replace(re,to); });
                        n.nodeValue = txt;
                      });
                    });
                  }
            
                  const obs = new MutationObserver(muts => muts.forEach(m => {
                    cleanNode(m.target);
                    m.addedNodes && m.addedNodes.forEach(n => n.nodeType === 1 && cleanNode(n));
                  }));
            
                  document.addEventListener("DOMContentLoaded", () => {
                    cleanNode(document.body);
                    obs.observe(document.body, { childList:true, subtree:true, characterData:true });
                  });
                })();
            
            
                /* =========================================================
                   MARKET HOVER PREMIUM — CORNER PRO
                   Injeta menus premium nos cards de mercados sem alterar o HTML.
                   O painel é flutuante e NÃO desloca a lista de jogos.
                   ========================================================= */
                (function setupPremiumMarketHover(){
                  const DATA = {
                    "PRÉ-JOGO": {
                      icon:"⚽",
                      title:"Mercados Pré-Jogo",
                      subtitle:"linhas principais antes da partida",
                      badge:"ANÁLISE COMPLETA",
                      sections:[
                        {title:"Resultado", icon:"◎", items:[
                          ["Casa vence","1.80"], ["Empate","3.40"], ["Visitante vence","2.10"], ["Dupla chance","1.35"]
                        ]},
                        {title:"Principais", icon:"◉", items:[
                          ["Ambas marcam","1.65","hot"], ["Over 1.5 gols","1.35"], ["Over 2.5 gols","1.90"], ["Over 3.5 gols","2.45"]
                        ]},
                        {title:"Combinações", icon:"▣", items:[
                          ["Casa + Over 1.5","2.05"], ["Visitante + Over 1.5","2.25"], ["BTTS + Over 2.5","2.15"], ["Empate anula","1.50"]
                        ]}
                      ],
                      tip:"Visão geral para selecionar rapidamente os melhores mercados antes do jogo.",
                      all:"VER ANÁLISE COMPLETA"
                    },
            
                    "ESCANTEIOS": {
                      icon:"⚑",
                      title:"Mercados de Escanteios",
                      subtitle:"totais, tempos, equipes e linhas especiais",
                      badge:"18 MERCADOS",
                      sections:[
                        {title:"Totais de escanteios", icon:"⚑", items:[
                          ["Over 8.5","1.35"], ["Over 9.5","1.55","hot"], ["Over 10.5","1.80"], ["Over 11.5","2.10"],
                          ["Over 12.5","2.45"], ["Over 13.5","2.90"], ["Under 9.5","2.30"], ["Under 10.5","2.05"]
                        ]},
                        {title:"Escanteios por tempo", icon:"◷", items:[
                          ["Over 4.5 HT","1.85"], ["Over 5.5 HT","2.20"], ["Under 4.5 HT","1.70"], ["Over 9.5 FT","1.45"],
                          ["Over 10.5 FT","1.70"], ["Over 11.5 FT","2.00"]
                        ]},
                        {title:"Por equipe / especiais", icon:"▤", items:[
                          ["Casa Over 4.5","1.60"], ["Casa Over 5.5","2.05"], ["Visitante Over 4.5","1.75"], ["Visitante Over 5.5","2.20"],
                          ["Asiático -0.5","1.90"], ["Escanteios exatos","6.00"]
                        ]}
                      ],
                      tip:"Dica Corner Pro: jogos acima de 9.5 escanteios entram como prioridade no radar.",
                      all:"VER TODOS OS ESCANTEIOS"
                    },
            
                    "GOLS": {
                      icon:"✹",
                      title:"Mercados de Gols",
                      subtitle:"totais, ambas marcam e gols por tempo",
                      badge:"14 MERCADOS",
                      sections:[
                        {title:"Totais de gols", icon:"✹", items:[
                          ["Over 0.5","1.08"], ["Over 1.5","1.35"], ["Over 2.5","1.90","hot"], ["Over 3.5","2.65"],
                          ["Over 4.5","3.80"], ["Under 2.5","1.85"]
                        ]},
                        {title:"Ambas marcam", icon:"◉", items:[
                          ["BTTS - Sim","1.65","hot"], ["BTTS - Não","2.05"], ["Casa marca","1.28"], ["Visitante marca","1.42"],
                          ["Sem gol","8.00"], ["Gol HT","1.55"]
                        ]},
                        {title:"Por tempo", icon:"◷", items:[
                          ["Over 0.5 HT","1.42"], ["Over 1.5 HT","2.30"], ["Over 0.5 2ºT","1.35"], ["Over 1.5 2ºT","2.10"],
                          ["Gol nos 15 min","2.75"], ["Gol depois 75'","1.95"]
                        ]}
                      ],
                      tip:"Use gols junto com pressão ofensiva e BTTS para evitar seleção apenas por odd alta.",
                      all:"VER TODOS OS GOLS"
                    },
            
                    "CARTÕES": {
                      icon:"▯",
                      title:"Mercados de Cartões",
                      subtitle:"linhas totais, equipe e disciplina",
                      badge:"12 MERCADOS",
                      sections:[
                        {title:"Totais de cartões", icon:"▯", items:[
                          ["Over 2.5","1.35"], ["Over 3.5","1.60"], ["Over 4.5","1.90","hot"], ["Over 5.5","2.35"],
                          ["Under 4.5","1.80"], ["Under 5.5","1.55"]
                        ]},
                        {title:"Por equipe", icon:"▣", items:[
                          ["Casa Over 1.5","1.55"], ["Casa Over 2.5","2.10"], ["Visitante Over 1.5","1.62"], ["Visitante Over 2.5","2.20"]
                        ]},
                        {title:"Especiais", icon:"⚠", items:[
                          ["Cartão no 1ºT","1.45"], ["Vermelho - Sim","4.50"], ["Mais cartões Casa","1.95"], ["Mais cartões Visitante","2.05"]
                        ]}
                      ],
                      tip:"Ideal para clássicos, jogos tensos e partidas com árbitro de média alta.",
                      all:"VER TODOS OS CARTÕES"
                    },
            
                    "PLAYER PROPS": {
                      icon:"♞",
                      title:"Player Props",
                      subtitle:"desempenho individual e participação ofensiva",
                      badge:"PRO",
                      sections:[
                        {title:"Finalizações", icon:"◎", items:[
                          ["Jogador 1+ chute","1.35"], ["Jogador 2+ chutes","1.85"], ["Chute no alvo","2.10"], ["Finalização HT","2.40"]
                        ]},
                        {title:"Participação", icon:"◉", items:[
                          ["Assistência","3.10"], ["Gol ou assistência","1.95","hot"], ["Passe chave","1.70"], ["Participa de gol","2.20"]
                        ]},
                        {title:"Disciplina", icon:"▯", items:[
                          ["Jogador cartão","2.80"], ["Falta cometida","1.55"], ["Desarme","1.75"], ["Impedimento","2.30"]
                        ]}
                      ],
                      tip:"Mercado avançado para usuários Pro, cruzando função do atleta com leitura do jogo.",
                      all:"ABRIR PLAYER PROPS"
                    }
                  };
            
                  function escapeHTML(value){
                    return String(value ?? "")
                      .replaceAll("&","&amp;")
                      .replaceAll("<","&lt;")
                      .replaceAll(">","&gt;")
                      .replaceAll('"',"&quot;")
                      .replaceAll("'","&#039;");
                  }
            
                  function buildMenu(data){
                    const sections = data.sections.map(section => `
                      <div class="marketMenuSection">
                        <h4><span>${escapeHTML(section.icon)}</span>${escapeHTML(section.title)}</h4>
                        <div class="marketMenuList">
                          ${section.items.map(item => `
                            <button class="marketMenuItem ${item[2] === "hot" ? "isHot" : ""}" type="button">
                              <span>${escapeHTML(item[0])}</span>
                              <em>${escapeHTML(item[1])}</em>
                            </button>
                          `).join("")}
                        </div>
                      </div>
                    `).join("");
            
                    return `
                      <div class="marketMenuPro" aria-hidden="true">
                        <div class="marketMenuTop">
                          <div class="marketMenuTitle">
                            <i>${escapeHTML(data.icon)}</i>
                            <div>
                              <strong>${escapeHTML(data.title)}</strong>
                              <small>${escapeHTML(data.subtitle)}</small>
                            </div>
                          </div>
                          <span class="marketMenuBadge">${escapeHTML(data.badge)}</span>
                        </div>
            
                        <div class="marketMenuGrid">${sections}</div>
            
                        <div class="marketMenuTip">
                          <p>${escapeHTML(data.tip)}</p>
                          <button class="marketMenuAll" type="button">${escapeHTML(data.all)} →</button>
                        </div>
                      </div>
                    `;
                  }
            
                  function setup(){
                    const tabs = Array.from(document.querySelectorAll(".marketTabs .marketTab"));
                    if (!tabs.length) return;
            
                    tabs.forEach(tab => {
                      if (tab.dataset.marketHoverReady === "1") return;
            
                      const label = String(tab.querySelector("b")?.textContent || tab.textContent || "")
                        .trim()
                        .toUpperCase();
            
                      const data = DATA[label];
                      if (!data) return;
            
                      tab.classList.add("hasMarketMenu");
                      tab.dataset.marketHoverReady = "1";
                      tab.insertAdjacentHTML("beforeend", buildMenu(data));
            
                      tab.addEventListener("click", (event) => {
                        const item = event.target.closest(".marketMenuItem,.marketMenuAll");
                        if (!item) return;
                        event.preventDefault();
                        event.stopPropagation();
                      });
                    });
                  }
            
                  document.addEventListener("DOMContentLoaded", setup);
            
                  const observer = new MutationObserver(setup);
                  observer.observe(document.documentElement, { childList:true, subtree:true });
                })();
            
            
                /* =========================================================
                   MERCADOS HOVER — FILTRO ESTÁVEL SEM TREMER A TELA
                   - Passar o mouse filtra os jogos já carregados.
                   - Clique também filtra.
                   - Não recarrega API.
                   - Evita tremedeira: não renderiza de novo se o mercado já está ativo.
                   - Mantém altura mínima da área de jogos para não dar pulo visual.
                   ========================================================= */
                (function installCornerProHoverMarketFilterStable(){
                  if (window.__cornerProHoverMarketFilterStableInstalled) return;
                  window.__cornerProHoverMarketFilterStableInstalled = true;
            
                  const LABELS = {
                    btts: "Ambas Marcam",
                    over15: "+1.5 Gols",
                    over25: "+2.5 Gols",
                    over30: "+3.0 Gols",
                    over35: "+3.5 Gols",
                    over45: "+4.5 Gols",
                    corners45ht: "+4.5 Cantos HT",
                    corners55ht: "+5.5 Cantos HT",
                    corners85: "+8.5 Escanteios",
                    corners95: "+9.5 Escanteios",
                    corners105: "+10.5 Escanteios",
                    corners115: "+11.5 Escanteios",
                    corners125: "+12.5 Escanteios",
                    corners135: "+13.5 Escanteios",
                    cards15: "+1.5 Cartões",
                    cards25: "+2.5 Cartões",
                    cards35: "+3.5 Cartões",
                    cards45: "+4.5 Cartões",
                    cards55: "+5.5 Cartões",
                    cards65: "+6.5 Cartões"
                  };
            
                  const cache = new Map();
                  let activeKey = "";
                  let lastPaintAt = 0;
                  let timer = null;
                  let isPainting = false;
            
                  function $(sel){ return document.querySelector(sel); }
                  function all(sel){ return Array.from(document.querySelectorAll(sel)); }
                  function clean(v){ return String(v ?? "").replace(/\s+/g," ").trim(); }
                  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
                  function n(v, fb=null){ const x = Number(String(v ?? "").replace("%","").replace(",",".")); return Number.isFinite(x) ? x : fb; }
                  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
                  function norm(v){ return clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9.]+/g," ").trim(); }
            
                  function getDateKey(){
                    return (
                      document.getElementById("date")?.value ||
                      window.lastDateYMD ||
                      window.lastMarketDateYMD ||
                      new Intl.DateTimeFormat("en-CA", { timeZone:"America/Manaus", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date())
                    );
                  }
            
                  function getAllGames(){
                    const panel = $(".gamesPanel");
                    const sources = [
                      panel?.__cornerProAllGames,
                      window.__cornerProAllGames,
                      panel?.__cornerProGames,
                      window.lastMarketGames,
                      window.lastRawGames
                    ];
            
                    for (const list of sources){
                      if (Array.isArray(list) && list.length) return list;
                    }
            
                    return [];
                  }
            
                  function getRaw(g){ return g?.raw || g || {}; }
            
                  function proj(g){
                    const raw = getRaw(g);
                    return n(g?.proj ?? raw.proj_cantos ?? raw.projCorners ?? raw.corners_projection ?? raw.corner_projection ?? raw.expected_corners, 0);
                  }
            
                  function prob(g){
                    const raw = getRaw(g);
                    return n(g?.prob ?? raw.over95_prob_adj ?? raw.over95_prob ?? raw.prob ?? raw.ai_score ?? raw.score, 0);
                  }
            
                  function expectedGoals(g){
                    const raw = getRaw(g);
                    const direct = n(
                      raw.totalExpected ??
                      raw.markets?.totalExpected ??
                      raw.expected_goals_total ??
                      raw.xg_total ??
                      raw.total_goals_avg ??
                      raw.media_gols_total ??
                      raw.proj_gols ??
                      raw.goals_projection ??
                      raw.projGoals
                    );
            
                    if (direct !== null) return direct;
            
                    let total = 2.15;
                    const p = proj(g);
                    const pr = prob(g);
            
                    if (p) total += (p - 9.5) * 0.20;
                    if (pr) total += (pr - 60) * 0.010;
            
                    const league = norm(g?.league || raw.liga || raw.league_name || raw.league?.name);
                    if (league.includes("premier") || league.includes("bundesliga") || league.includes("eredivisie") || league.includes("jupiler") || league.includes("belgium")) total += 0.18;
                    if (league.includes("serie a") || league.includes("ligue 1")) total -= 0.08;
            
                    return clamp(total, 1.4, 4.1);
                  }
            
                  function cornerPercent(g, line){
                    const raw = getRaw(g);
                    const key = String(line).replace(".","");
                    const ready = n(
                      raw.markets?.prob?.[`corners${key}`] ??
                      raw.markets?.filterProb?.[`corners${key}`] ??
                      raw[`corners${key}_prob`] ??
                      raw[`corners${key}_filter_prob`]
                    );
            
                    if (ready !== null && ready > 5) return ready;
            
                    const p = proj(g);
                    if (!p) return 0;
            
                    return clamp(Math.round(50 + (p - line) * 18), 3, 92);
                  }
            
                  function goalPercent(g, line){
                    const raw = getRaw(g);
                    const key = `over${String(line).replace(".","")}`;
                    const ready = n(raw.markets?.prob?.[key] ?? raw[`${key}_prob`] ?? raw[`over_${String(line).replace(".","")}_prob`]);
            
                    if (ready !== null && ready > 5) return ready;
            
                    return clamp(Math.round(50 + (expectedGoals(g) - line) * 22), 5, 90);
                  }
            
                  function bttsPercent(g){
                    const raw = getRaw(g);
                    const ready = n(raw.markets?.prob?.btts ?? raw.btts_prob ?? raw.prob_btts ?? raw.ambas_marcam_prob);
            
                    if (ready !== null && ready > 5) return ready;
            
                    return clamp(Math.round(42 + (expectedGoals(g) - 2.1) * 18), 5, 82);
                  }
            
                  function projectedCards(g){
                    const raw = getRaw(g);
                    const direct = n(raw.proj_cards ?? raw.cards_projection ?? raw.expected_cards_total ?? raw.total_cards_avg ?? raw.media_cartoes_total ?? raw.cartoes_media);
            
                    if (direct !== null) return direct;
            
                    const league = norm(g?.league || raw.liga || raw.league_name || raw.league?.name);
                    let base = 3.6;
            
                    if (league.includes("la liga") || league.includes("serie a") || league.includes("portugal") || league.includes("super lig")) base += 0.45;
                    if (league.includes("premier") || league.includes("bundesliga")) base -= 0.10;
            
                    const p = proj(g);
                    if (p) base += (p - 10) * 0.10;
            
                    return clamp(base, 2.2, 5.8);
                  }
            
                  function cardPercent(g, line){
                    const raw = getRaw(g);
                    const key = `cards${String(line).replace(".","")}`;
                    const ready = n(raw.markets?.prob?.[key] ?? raw[`${key}_prob`]);
            
                    if (ready !== null && ready > 5) return ready;
            
                    return clamp(Math.round(46 + (projectedCards(g) - line) * 13), 5, 86);
                  }
            
                  function marketPercent(g, key){
                    if (key === "btts") return bttsPercent(g);
            
                    let m = String(key).match(/^corners(\d+)(ht)?$/);
                    if (m) return cornerPercent(g, Number(m[1]) / 10);
            
                    m = String(key).match(/^over(\d+)$/);
                    if (m) return goalPercent(g, Number(m[1]) / 10);
            
                    m = String(key).match(/^cards(\d+)$/);
                    if (m) return cardPercent(g, Number(m[1]) / 10);
            
                    return prob(g);
                  }
            
                  function marketPass(g, key){
                    const raw = getRaw(g);
            
                    if (raw.markets && typeof raw.markets[key] === "boolean") return raw.markets[key] === true;
            
                    if (key === "btts") return bttsPercent(g) >= 52;
            
                    let m = String(key).match(/^corners(\d+)(ht)?$/);
                    if (m) return cornerPercent(g, Number(m[1]) / 10) >= 55;
            
                    m = String(key).match(/^over(\d+)$/);
                    if (m) return goalPercent(g, Number(m[1]) / 10) >= 52;
            
                    m = String(key).match(/^cards(\d+)$/);
                    if (m) return cardPercent(g, Number(m[1]) / 10) >= 52;
            
                    return false;
                  }
            
                  function gameInfo(g){
                    const raw = getRaw(g);
                    return {
                      home: clean(g.home ?? raw.casa ?? raw.home ?? raw.home_name ?? raw.team_home ?? raw.mandante ?? raw.teams?.home?.name ?? "Casa"),
                      away: clean(g.away ?? raw.fora ?? raw.away ?? raw.away_name ?? raw.team_away ?? raw.visitante ?? raw.teams?.away?.name ?? "Visitante"),
                      league: clean(g.league ?? raw.liga ?? raw.league_name ?? raw.competition ?? raw.league?.name ?? "Liga"),
                      time: clean(g.time ?? raw.hora ?? raw.time ?? (raw.match_time ? normalizeKickoffDisplayTime(raw.match_time, true) : raw.horario) ?? "--:--").slice(0,5)
                    };
                  }
            
                  function fmtValue(g, key){
                    const pct = Math.round(marketPercent(g, key));
                    return pct ? `${pct}%` : "—";
                  }
            
                  function buildRows(key){
                    const dateKey = getDateKey();
                    const cacheKey = `${dateKey}:${key}`;
            
                    if (cache.has(cacheKey)) return cache.get(cacheKey);
            
                    const games = getAllGames();
                    const label = LABELS[key] || key;
            
                    const filtered = games
                      .filter(g => marketPass(g, key))
                      .sort((a,b) => marketPercent(b, key) - marketPercent(a, key))
                      .slice(0, 16);
            
                    const allGames = getAllGames();
            
                    const html = filtered.map((g, index) => {
                      const d = gameInfo(g);
                      const rawIndex = allGames.indexOf(g);
            
                      return `
                        <div class="gameRow compactGameRow" data-hover-market-row="1" data-real-game-index="${rawIndex >= 0 ? rawIndex : index}">
                          <div class="gameMeta">
                            <small>${esc(d.league)}</small>
                            <b><span>${esc(d.time)}</span> ${esc(d.home)}<br><em>${esc(d.away)}</em></b>
                          </div>
                          <div class="oddBox"><small>MERCADO</small><b>${esc(label)}</b><span>${fmtValue(g, key)}</span></div>
                          <div class="oddBox"><small>ESCANTEIOS</small><b>PROJ. ${proj(g) ? proj(g).toFixed(1) : "—"}</b><span>${Math.round(cornerPercent(g, 9.5) || prob(g) || 0)}%</span></div>
                          <div class="oddBox"><small>TOTAL GOLS</small><b>OVER 2.5</b><span>${Math.round(goalPercent(g, 2.5))}%</span></div>
                          <div class="oddBox"><small>CARTÕES</small><b>OVER 3.5</b><span>${Math.round(cardPercent(g, 3.5))}%</span></div>
                          <button class="signal" type="button">▮▮▮</button>
                        </div>
                      `;
                    }).join("");
            
                    cache.set(cacheKey, html);
                    return html;
                  }
            
                  function setPanelStableHeight(panel){
                    const h = panel.offsetHeight;
                    if (h > 0) panel.style.minHeight = `${h}px`;
                  }
            
                  function paint(key, force = false){
                    if (!key) return;
            
                    const now = performance.now();
            
                    // Evita a tremedeira: pointerover dispara várias vezes dentro do mesmo botão.
                    if (!force && key === activeKey) return;
                    if (!force && now - lastPaintAt < 90) return;
                    if (isPainting) return;
            
                    const panel = $(".gamesPanel");
                    if (!panel) return;
            
                    isPainting = true;
                    lastPaintAt = now;
                    activeKey = key;
            
                    setPanelStableHeight(panel);
            
                    const label = LABELS[key] || key;
                    const title = panel.querySelector(".sectionHead h2");
                    if (title) title.textContent = `Jogos — ${label}`;
            
                    const html = buildRows(key);
            
                    panel.classList.add("is-filtering-market");
            
                    requestAnimationFrame(() => {
                      panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
            
                      if (!html.trim()){
                        panel.insertAdjacentHTML("beforeend", `
                          <div class="marketStrictEmpty">
                            Nenhum jogo forte encontrado para <b>${esc(label)}</b> nesta data.
                          </div>
                          <button class="viewAll" type="button">VER TODOS OS JOGOS</button>
                        `);
                      } else {
                        panel.insertAdjacentHTML("beforeend", html + `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
                      }
            
                      const games = getAllGames();
            
                      panel.querySelectorAll("[data-hover-market-row]").forEach(row => {
                        row.addEventListener("click", () => {
                          const idx = Number(row.dataset.realGameIndex);
                          const g = games[idx];
                          if (!g) return;
            
                          const d = gameInfo(g);
                          const raw = getRaw(g);
                          const gameForRail = { ...raw, casa:d.home, fora:d.away, liga:d.league, hora:d.time, match_id:raw.match_id ?? raw.id };
            
                          if (typeof window.updateDesktopMatchRail === "function") {
                            window.updateDesktopMatchRail(gameForRail, games.map(x => getRaw(x)));
                          }
                        });
                      });
            
                      setTimeout(() => {
                        panel.classList.remove("is-filtering-market");
                        isPainting = false;
                      }, 80);
                    });
                  }
            
                  function detectKey(item){
                    const explicit = item.dataset.marketFilter || item.dataset.premiumMarket || item.dataset.market || item.dataset.filter;
                    if (explicit) return explicit;
            
                    const tab = item.closest(".marketTab");
                    const tabText = norm(tab?.querySelector("b")?.textContent || tab?.textContent);
                    const itemText = norm(item.textContent);
                    const joined = `${tabText} ${itemText}`;
            
                    const isCorners = joined.includes("escanteio") || joined.includes("canto") || joined.includes("asiatico") || joined.includes("ht") || joined.includes("ft");
                    const isGoals = joined.includes("gol") || joined.includes("btts") || joined.includes("ambos") || joined.includes("marca");
                    const isCards = joined.includes("cart");
            
                    const over = joined.match(/over\s*(\d+(?:\.\d+)?)/i);
                    if (over){
                      const line = over[1].replace(".","");
                      if (isCorners) return joined.includes("ht") ? `corners${line}ht` : `corners${line}`;
                      if (isCards) return `cards${line}`;
                      if (isGoals) return `over${line}`;
                    }
            
                    if (joined.includes("btts") || joined.includes("ambos")) return "btts";
            
                    return "";
                  }
            
                  function selectItem(item, key){
                    if (item.classList.contains("is-selected") && activeKey === key) return;
            
                    all(".marketMenuItem.is-selected").forEach(x => x.classList.remove("is-selected"));
                    item.classList.add("is-selected");
                    item.dataset.marketFilter = key;
                  }
            
                  function schedule(item, force = false){
                    const key = detectKey(item);
                    if (!key) return;
            
                    selectItem(item, key);
            
                    clearTimeout(timer);
                    timer = setTimeout(() => paint(key, force), force ? 0 : 120);
                  }
            
                  document.addEventListener("pointerover", function(ev){
                    const item = ev.target.closest(".marketMenuItem,.marketMenuAll,[data-market-filter],[data-premium-market]");
                    if (!item) return;
                    if (!item.closest(".marketMenuPro,.allMarketsDropdown,.premiumMarketChips")) return;
            
                    schedule(item, false);
                  }, true);
            
                  document.addEventListener("click", function(ev){
                    const item = ev.target.closest(".marketMenuItem,.marketMenuAll,[data-market-filter],[data-premium-market]");
                    if (!item) return;
                    if (!item.closest(".marketMenuPro,.allMarketsDropdown,.premiumMarketChips")) return;
            
                    const key = detectKey(item);
                    if (!key) return;
            
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
            
                    selectItem(item, key);
                    paint(key, true);
                  }, true);
            
                  // Se mudar a data, limpa o estado para permitir novo filtro.
                  document.addEventListener("change", function(ev){
                    if (ev.target && ev.target.id === "date"){
                      activeKey = "";
                      cache.clear();
                      const panel = $(".gamesPanel");
                      if (panel) panel.style.minHeight = "";
                    }
                  }, true);
            
                  window.cornerProClearHoverMarketCache = function(){
                    cache.clear();
                    activeKey = "";
                    const panel = $(".gamesPanel");
                    if (panel) panel.style.minHeight = "";
                  };
            
                  window.cornerProFilterMarketHover = function(key){
                    paint(key, true);
                  };
                })();
            
            
                /* =========================================================
                   FECHAR CAIXA DE MERCADOS AO CLICAR FORA
                   - Depois de escolher o mercado, a caixa fecha.
                   - Clicar em qualquer área fora do menu também fecha.
                   ========================================================= */
                (function closeMarketBoxOnOutsideClick(){
                  if (window.__closeMarketBoxOnOutsideClickInstalled) return;
                  window.__closeMarketBoxOnOutsideClickInstalled = true;
            
                  function closeMenus(){
                    document.body.classList.add("marketMenuClosedByClick");
            
                    document.querySelectorAll(".marketTab.hasMarketMenu,.marketTab,.marketMenuPro").forEach(el => {
                      el.classList.remove("is-open", "open", "is-active", "active-hover");
                      if (el.classList.contains("marketMenuPro")){
                        el.setAttribute("aria-hidden", "true");
                      }
                    });
                  }
            
                  function unlockMenus(){
                    document.body.classList.remove("marketMenuClosedByClick");
                  }
            
                  document.addEventListener("click", function(event){
                    const clickedInsideMenu = event.target.closest(".marketMenuPro");
                    const clickedMarketTab = event.target.closest(".marketTab.hasMarketMenu");
            
                    // Se clicou em um mercado interno, filtra e fecha a caixa logo depois.
                    if (event.target.closest(".marketMenuItem,.marketMenuAll,[data-market-filter],[data-premium-market]")){
                      setTimeout(closeMenus, 90);
                      return;
                    }
            
                    // Se clicou fora da caixa e fora dos cards de mercado, fecha.
                    if (!clickedInsideMenu && !clickedMarketTab){
                      closeMenus();
                    }
                  }, true);
            
                  // Ao passar novamente no card principal, libera a caixa para abrir outra vez.
                  document.addEventListener("pointerenter", function(event){
                    if (event.target.closest && event.target.closest(".marketTab.hasMarketMenu")){
                      unlockMenus();
                    }
                  }, true);
            
                  document.addEventListener("pointerover", function(event){
                    if (event.target.closest && event.target.closest(".marketTab.hasMarketMenu")){
                      unlockMenus();
                    }
                  }, true);
            
                  // Ao sair da região dos mercados, fecha também.
                  document.addEventListener("pointerleave", function(event){
                    const tab = event.target.closest && event.target.closest(".marketTab.hasMarketMenu");
                    if (tab) closeMenus();
                  }, true);
                })();
            
                /* =========================================================
                   MERCADOS INLINE DISCRETO — IGUAL AO MODELO ENVIADO
                   - Remove dropdown grande dentro das abas
                   - Cria painel fixo abaixo das abas
                   - Troca conteúdo ao clicar em Pré-jogo, Escanteios, Gols, Cartões e Player Props
                   - Não recarrega API e não mexe no motor dos jogos
                   ========================================================= */
                (function installCornerProInlineMarkets(){
                  if (window.__cornerProInlineMarketsInstalled) return;
                  window.__cornerProInlineMarketsInstalled = true;
            
                  const MARKET_DATA = {
                    "PRÉ-JOGO": {
                      count:"12 MERCADOS",
                      title:"Mercados Pré-Jogo",
                      subtitle:"principais leituras antes da partida",
                      tip:"Use o pré-jogo para comparar valor, probabilidade e cenário da partida.",
                      all:"VER TODOS OS MERCADOS",
                      sections:[
                        {title:"Resultado", icon:"⚽", items:[["Casa vence","1.85"],["Empate","3.30"],["Visitante vence","4.20"],["Dupla chance casa","1.28"],["Dupla chance visitante","1.65"]]},
                        {title:"Gols", icon:"◎", items:[["Over 1.5","1.35"],["Over 2.5","1.75","POPULAR"],["Over 3.5","2.35"],["Ambas marcam","1.85"],["Under 2.5","2.05"]]},
                        {title:"Combinadas", icon:"▣", items:[["Casa + Over 1.5","2.20"],["Visitante + Over 1.5","3.10"],["Ambas + Over 2.5","2.45"],["Empate anula casa","1.42"],["Mais chances Pro","--"]]}
                      ]
                    },
                    "ESCANTEIOS": {
                      count:"18 MERCADOS",
                      title:"Mercados de Escanteios",
                      subtitle:"totais, tempos, equipes e linhas especiais",
                      tip:"Dica Corner Pro: jogos acima de 9.5 escanteios entram como prioridade no radar.",
                      all:"VER TODOS OS ESCANTEIOS",
                      sections:[
                        {title:"Totais de Escanteios", icon:"⚑", items:[["Over 8.5","1.35"],["Over 9.5","1.55","POPULAR"],["Over 10.5","1.80"],["Over 11.5","2.10"],["Over 12.5","2.45"]]},
                        {title:"Escanteios por Tempo", icon:"◷", items:[["Over 4.5 HT","1.85"],["Over 5.5 HT","2.20"],["Under 4.5 HT","1.70"],["Over 9.5 FT","1.45"],["Over 10.5 FT","1.70"]]},
                        {title:"Por Equipe / Especiais", icon:"▤", items:[["Casa Over 4.5","1.60"],["Casa Over 5.5","2.05"],["Visitante Over 4.5","1.75"],["Visitante Over 5.5","2.20"],["Escanteios exatos","6.00"]]}
                      ]
                    },
                    "GOLS": {
                      count:"16 MERCADOS",
                      title:"Mercados de Gols",
                      subtitle:"totais, ambas marcam e linhas HT/FT",
                      tip:"Priorize jogos com leitura ofensiva clara e boa média recente de finalizações.",
                      all:"VER TODOS OS GOLS",
                      sections:[
                        {title:"Totais de Gols", icon:"✹", items:[["Over 0.5","1.10"],["Over 1.5","1.35"],["Over 2.5","1.78","POPULAR"],["Over 3.5","2.45"],["Under 2.5","2.05"]]},
                        {title:"Ambas / Tempo", icon:"◷", items:[["Ambas marcam - Sim","1.85"],["Ambas marcam - Não","1.90"],["Gol no 1º tempo","1.42"],["Over 1.5 HT","2.15"],["Over 2.5 FT","1.78"]]},
                        {title:"Equipe", icon:"▤", items:[["Casa Over 0.5","1.22"],["Casa Over 1.5","1.85"],["Visitante Over 0.5","1.34"],["Visitante Over 1.5","2.20"],["Gol nos dois tempos","2.40"]]}
                      ]
                    },
                    "CARTÕES": {
                      count:"14 MERCADOS",
                      title:"Mercados de Cartões",
                      subtitle:"linhas de cartões, equipe e leitura disciplinar",
                      tip:"Mercado indicado para jogos tensos, rivais diretos e árbitros com média alta.",
                      all:"VER TODOS OS CARTÕES",
                      sections:[
                        {title:"Totais de Cartões", icon:"▯", items:[["Over 2.5","1.35"],["Over 3.5","1.65","POPULAR"],["Over 4.5","2.05"],["Over 5.5","2.60"],["Under 4.5","1.80"]]},
                        {title:"Por Tempo", icon:"◷", items:[["Over 1.5 HT","1.80"],["Over 2.5 HT","2.65"],["Cartão no 1º tempo","1.40"],["Sem cartão 1º tempo","3.10"],["Vermelho - Sim","4.50"]]},
                        {title:"Por Equipe", icon:"▤", items:[["Casa Over 1.5","1.55"],["Casa Over 2.5","2.10"],["Visitante Over 1.5","1.62"],["Visitante Over 2.5","2.20"],["Mais cartões Casa","1.95"]]}
                      ]
                    },
                    "PLAYER PROPS": {
                      count:"PRO",
                      title:"Player Props",
                      subtitle:"desempenho individual e participação ofensiva",
                      tip:"Mercado avançado para leitura individual do atleta no contexto da partida.",
                      all:"ABRIR PLAYER PROPS",
                      sections:[
                        {title:"Finalizações", icon:"◎", items:[["Jogador 1+ chute","1.35"],["Jogador 2+ chutes","1.85"],["Chute no alvo","2.10"],["Finalização HT","2.40"],["Finalização FT","1.55"]]},
                        {title:"Participação", icon:"◉", items:[["Assistência","3.10"],["Gol ou assistência","1.95","POPULAR"],["Passe chave","1.70"],["Participa de gol","2.20"],["Criar grande chance","2.65"]]},
                        {title:"Disciplina", icon:"▯", items:[["Jogador cartão","2.80"],["Falta cometida","1.55"],["Desarme","1.75"],["Impedimento","2.30"],["Cartão HT","4.20"]]}
                      ]
                    }
                  };
            
                  function esc(value){
                    return String(value ?? "")
                      .replaceAll("&","&amp;")
                      .replaceAll("<","&lt;")
                      .replaceAll(">","&gt;")
                      .replaceAll('"',"&quot;")
                      .replaceAll("'","&#039;");
                  }
            
                  function normalizeLabel(text){
                    return String(text || "")
                      .replace(/\s+/g," ")
                      .trim()
                      .toUpperCase();
                  }
            
                  function findDataForTab(tab){
                    const b = tab.querySelector("b");
                    const label = normalizeLabel(b ? b.textContent : tab.textContent);
                    return MARKET_DATA[label] ? { key:label, data:MARKET_DATA[label] } : null;
                  }
            
                  function panelHTML(data){
                    const sections = data.sections.map(section => `
                      <section class="marketInlineSection">
                        <h4><i>${esc(section.icon)}</i>${esc(section.title)}</h4>
                        <div class="marketInlineList">
                          ${section.items.map(item => `
                            <button class="marketInlineItem" type="button" data-market-line="${esc(item[0])}">
                              <span>${esc(item[0])}${item[2] ? `<em class="marketInlineHot">${esc(item[2])}</em>` : ""}</span>
                              <b>${esc(item[1])}</b>
                            </button>
                          `).join("")}
                        </div>
                        <button class="marketInlineMore" type="button">Ver mais⌄</button>
                      </section>
                    `).join("");
            
                    return `
                      <div class="marketInlineHead">
                        <div class="marketInlineTitle">
                          <strong>${esc(data.title)}</strong>
                          <small>${esc(data.subtitle)}</small>
                        </div>
                        <div class="marketInlineCount">${esc(data.count)}</div>
                      </div>
                      <div class="marketInlineGrid">${sections}</div>
                      <div class="marketInlineFooter">
                        <div class="marketInlineTip"><i>i</i><span>${esc(data.tip)}</span></div>
                        <button class="marketInlineAll" type="button">${esc(data.all)} →</button>
                      </div>
                    `;
                  }
            
                  function build(){
                    const tabsBox = document.querySelector(".marketTabs");
                    if (!tabsBox || tabsBox.dataset.inlineReady === "1") return;
            
                    const tabs = Array.from(tabsBox.querySelectorAll(".marketTab"));
                    const validTabs = tabs.map(tab => ({ tab, found:findDataForTab(tab) })).filter(x => x.found);
                    if (!validTabs.length) return;
            
                    // Remove menus antigos que ficavam dentro das abas.
                    tabsBox.querySelectorAll(".marketMenuPro").forEach(el => el.remove());
            
                    const panel = document.createElement("section");
                    panel.className = "marketInlinePanel";
                    panel.setAttribute("aria-live", "polite");
            
                    const gamesPanel = document.querySelector(".gamesPanel");
                    const parent = tabsBox.parentElement;
            
                    if (gamesPanel && parent && gamesPanel.parentElement === parent){
                      const work = document.createElement("div");
                      work.className = "marketWorkArea";
                      parent.insertBefore(work, gamesPanel);
                      work.appendChild(gamesPanel);
                      work.appendChild(panel);
                    } else {
                      tabsBox.insertAdjacentElement("afterend", panel);
                    }
            
                    function activate(tab){
                      const found = findDataForTab(tab);
                      if (!found) return;
                      validTabs.forEach(x => x.tab.classList.remove("is-active-market"));
                      tab.classList.add("is-active-market");
                      panel.innerHTML = panelHTML(found.data);
                    }
            
                    validTabs.forEach(({tab}) => {
                      tab.addEventListener("click", event => {
                        activate(tab);
                      }, true);
                    });
            
                    const initial = validTabs.find(x => x.tab.classList.contains("active")) || validTabs[1] || validTabs[0];
                    activate(initial.tab);
                    tabsBox.dataset.inlineReady = "1";
                  }
            
                  document.addEventListener("DOMContentLoaded", build);
            
                  const observer = new MutationObserver(build);
                  observer.observe(document.documentElement, { childList:true, subtree:true });
                })();
            
            
                /* =========================================================
                   MERCADOS INLINE — DATA CERTA + CACHE POR DATA
                   - Mantém layout/CSS intactos.
                   - Ao escolher uma data, guarda essa data.
                   - Ao clicar em mercado, usa cache daquela data.
                   - Só chama API uma vez por data; depois filtra localmente.
                   - Remove repetição via dedupe por jogo.
                   ========================================================= */
                (function mercadosInlineComCachePorData(){
                  if (window.__mercadosInlineComCachePorDataFinal) return;
                  window.__mercadosInlineComCachePorDataFinal = true;
            
                  const $ = (sel, root = document) => root.querySelector(sel);
                  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
                  const MARKET_CACHE = new Map(); // dateYMD -> games[]
            
                  function isYMD(v){
                    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
                  }
            
                  function todayAM(){
                    return new Intl.DateTimeFormat("en-CA", {
                      timeZone:"America/Manaus",
                      year:"numeric",
                      month:"2-digit",
                      day:"2-digit"
                    }).format(new Date());
                  }
            
                  function clean(v){
                    return String(v ?? "").replace(/\s+/g, " ").trim();
                  }
            
                  function norm(v){
                    return clean(v)
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9.+\- ]+/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                  }
            
                  function esc(v){
                    return String(v ?? "").replace(/[&<>"']/g, ch => ({
                      "&":"&amp;",
                      "<":"&lt;",
                      ">":"&gt;",
                      '"':"&quot;",
                      "'":"&#039;"
                    }[ch]));
                  }
            
                  function num(v, fb = null){
                    if (v === true || v === false) return fb;
                    const n = Number(String(v ?? "").replace("%", "").replace(",", "."));
                    return Number.isFinite(n) ? n : fb;
                  }
            
                  function clamp(n, a, b){
                    return Math.max(a, Math.min(b, n));
                  }
            
                  function raw(g){
                    return g?.raw || g || {};
                  }
            
                  function selectedDate(){
                    const win = window.__cornerProSelectedDate;
                    if (isYMD(win)) return win;
            
                    const input = $("#date")?.value;
                    if (isYMD(input)) return input;
            
                    try{
                      const params = new URLSearchParams(window.location.search);
                      const urlDate = params.get("date") || params.get("data");
                      if (isYMD(urlDate)) return urlDate;
                    }catch(e){}
            
                    const store = localStorage.getItem("cornerProSelectedDate");
                    if (isYMD(store)) return store;
            
                    try{
                      if (typeof lastDateYMD !== "undefined" && isYMD(lastDateYMD)) return lastDateYMD;
                      if (typeof lastMarketDateYMD !== "undefined" && isYMD(lastMarketDateYMD)) return lastMarketDateYMD;
                    }catch(e){}
            
                    return todayAM();
                  }
            
                  function setSelectedDate(ymd, { clearPanelCache = true } = {}){
                    if (!isYMD(ymd)) return;
            
                    window.__cornerProSelectedDate = ymd;
                    localStorage.setItem("cornerProSelectedDate", ymd);
            
                    const input = $("#date");
                    if (input && input.value !== ymd){
                      input.value = ymd;
                      input.dispatchEvent(new Event("input", { bubbles:true }));
                      input.dispatchEvent(new Event("change", { bubbles:true }));
                    }
            
                    try{
                      const url = new URL(window.location.href);
                      url.searchParams.set("date", ymd);
                      url.searchParams.delete("data");
                      window.history.replaceState({}, "", url.toString());
                    }catch(e){}
            
                    if (clearPanelCache){
                      const panel = $(".gamesPanel");
                      if (panel){
                        panel.dataset.marketCacheDate = ymd;
                        panel.__cornerProAllGames = [];
                        panel.style.minHeight = "";
                      }
                      window.__cornerProAllGames = [];
                      window.__cornerProAllGamesDate = ymd;
                    }
                  }
            
                  function info(g){
                    const r = raw(g);
                    return {
                      home: clean(g?.home ?? r.casa ?? r.home ?? r.home_name ?? r.team_home ?? r.mandante ?? r.teams?.home?.name ?? "Casa"),
                      away: clean(g?.away ?? r.fora ?? r.away ?? r.away_name ?? r.team_away ?? r.visitante ?? r.teams?.away?.name ?? "Visitante"),
                      league: clean(g?.league ?? r.liga ?? r.league_name ?? r.competition ?? r.league?.name ?? "Liga"),
                      time: clean(displayKickoffTimeFromGame(r)).slice(0,5),
                      id: clean(r.match_id ?? r.id ?? r.event_key ?? r.event_id ?? "")
                    };
                  }
            
                  function gameKey(g){
                    const d = info(g);
                    return d.id || `${norm(d.league)}|${norm(d.home)}|${norm(d.away)}|${d.time}`;
                  }
            
                  function dedupeGames(list){
                    const seen = new Set();
                    const out = [];
            
                    for (const g of Array.isArray(list) ? list : []){
                      const k = gameKey(g);
                      if (!k || seen.has(k)) continue;
                      seen.add(k);
                      out.push(g);
                    }
            
                    return out;
                  }
            
                  function seed(g){
                    return Math.abs(gameKey(g).split("").reduce((a,c) => a + c.charCodeAt(0), 0));
                  }
            
                  function enhance(list){
                    let arr = dedupeGames(list);
                    try{
                      if (typeof enrichMarketsList === "function") arr = enrichMarketsList(arr);
                    }catch(e){}
                    return dedupeGames(arr);
                  }
            
                  function storeMarketGames(ymd, games){
                    const arr = enhance(games);
                    MARKET_CACHE.set(ymd, arr);
            
                    try{
                      if (typeof lastMarketGames !== "undefined") lastMarketGames = arr.slice();
                      if (typeof lastMarketDateYMD !== "undefined") lastMarketDateYMD = ymd;
                      if (typeof loadingMarkets !== "undefined") loadingMarkets = false;
                    }catch(e){}
            
                    const panel = $(".gamesPanel");
                    if (panel){
                      panel.__cornerProAllGames = arr.slice();
                      panel.dataset.marketCacheDate = ymd;
                    }
            
                    window.__cornerProAllGames = arr.slice();
                    window.__cornerProAllGamesDate = ymd;
            
                    return arr;
                  }
            
                  async function loadGamesOnceForDate(ymd = selectedDate()){
                    setSelectedDate(ymd, { clearPanelCache:false });
            
                    if (MARKET_CACHE.has(ymd) && MARKET_CACHE.get(ymd).length){
                      return MARKET_CACHE.get(ymd);
                    }
            
                    // 1) reaproveita lastMarketGames somente se a data for a mesma.
                    try{
                      if (
                        typeof lastMarketDateYMD !== "undefined" &&
                        lastMarketDateYMD === ymd &&
                        typeof lastMarketGames !== "undefined" &&
                        Array.isArray(lastMarketGames) &&
                        lastMarketGames.length
                      ){
                        return storeMarketGames(ymd, lastMarketGames);
                      }
                    }catch(e){}
            
                    // 2) reaproveita painel somente se for a mesma data.
                    const panel = $(".gamesPanel");
                    if (
                      panel?.dataset?.marketCacheDate === ymd &&
                      Array.isArray(panel.__cornerProAllGames) &&
                      panel.__cornerProAllGames.length
                    ){
                      return storeMarketGames(ymd, panel.__cornerProAllGames);
                    }
            
                    if (
                      window.__cornerProAllGamesDate === ymd &&
                      Array.isArray(window.__cornerProAllGames) &&
                      window.__cornerProAllGames.length
                    ){
                      return storeMarketGames(ymd, window.__cornerProAllGames);
                    }
            
                    // 3) se lastRawGames é da data selecionada, usa sem API.
                    try{
                      if (
                        typeof lastDateYMD !== "undefined" &&
                        lastDateYMD === ymd &&
                        typeof lastRawGames !== "undefined" &&
                        Array.isArray(lastRawGames) &&
                        lastRawGames.length
                      ){
                        return storeMarketGames(ymd, lastRawGames);
                      }
                    }catch(e){}
            
                    // 4) IMPORTANTE: clique em mercado NÃO chama API.
                    // A API deve ser chamada somente no carregamento inicial ou ao trocar a data.
                    // Se ainda não existe cache para a data, devolve vazio para evitar loop de "Carregando jogos...".
                    try{
                      if (typeof loadingMarkets !== "undefined") loadingMarkets = false;
                    }catch(e){}
            
                    return storeMarketGames(ymd, []);
                  }
            
                  function lineFromText(text){
                    const m = String(text || "").match(/(?:over|under|\+)\s*(\d+(?:\.\d+)?)/i);
                    return m ? Number(m[1]) : null;
                  }
            
                  function contextFromButton(btn){
                    const label = clean(btn.dataset.marketLine || btn.textContent || "Mercado");
                    const panel = btn.closest(".marketInlinePanel");
                    const title = clean(panel?.querySelector(".marketInlineTitle strong")?.textContent || "");
                    const section = clean(btn.closest(".marketInlineSection")?.querySelector("h4")?.textContent || "");
                    const text = norm(`${title} ${section} ${label}`);
                    return { label, title, section, text };
                  }
            
                  function projectedCorners(g){
                    const r = raw(g);
                    const direct = num(
                      g?.proj ??
                      r.proj_cantos ??
                      r.projCorners ??
                      r.corners_projection ??
                      r.corner_projection ??
                      r.expected_corners ??
                      r.total_corners_avg,
                      null
                    );
                    if (direct !== null && direct > 0) return direct;
                    return 9.4 + (seed(g) % 25) / 10;
                  }
            
                  function expectedGoals(g){
                    const r = raw(g);
                    const direct = num(
                      r.markets?.totalExpected ??
                      r.totalExpected ??
                      r.expected_goals_total ??
                      r.xg_total ??
                      r.total_goals_avg ??
                      r.media_gols_total ??
                      r.proj_gols ??
                      r.goals_projection ??
                      r.projGoals,
                      null
                    );
            
                    if (direct !== null && direct > 0) return direct;
            
                    const league = norm(info(g).league);
                    const baseProb = num(r.over95_prob_adj ?? r.over95_prob ?? r.ai_score ?? r.score ?? 60, 60);
            
                    let total = 2.12;
                    total += (projectedCorners(g) - 9.5) * 0.20;
                    total += (baseProb - 60) * 0.010;
            
                    if (league.includes("premier") || league.includes("bundesliga") || league.includes("eredivisie") || league.includes("jupiler") || league.includes("super lig")){
                      total += 0.18;
                    }
            
                    if (league.includes("serie a") || league.includes("ligue 1")){
                      total -= 0.08;
                    }
            
                    return clamp(total, 1.35, 4.35);
                  }
            
                  function projectedCards(g){
                    const r = raw(g);
                    const direct = num(
                      r.proj_cards ??
                      r.cards_projection ??
                      r.expected_cards_total ??
                      r.total_cards_avg ??
                      r.media_cartoes_total ??
                      r.cartoes_media,
                      null
                    );
            
                    if (direct !== null && direct > 0) return direct;
            
                    const league = norm(info(g).league);
                    let total = 3.45;
            
                    if (league.includes("la liga") || league.includes("serie a") || league.includes("portugal") || league.includes("super lig")){
                      total += 0.42;
                    }
            
                    if (league.includes("premier") || league.includes("bundesliga")){
                      total -= 0.08;
                    }
            
                    total += (projectedCorners(g) - 10) * 0.09;
                    total += (seed(g) % 7) * 0.04;
            
                    return clamp(total, 2.1, 6.2);
                  }
            
                  function getPath(obj, paths){
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
            
                  function percentValue(v, fallback = null){
                    if (typeof v === "boolean") return fallback;
                    const n = num(v, null);
                    if (n === null) return fallback;
                    if (n > 0 && n <= 1) return clamp(Math.round(n * 100), 0, 100);
                    return clamp(Math.round(n), 0, 100);
                  }
            
                  function percentGoals(g, line){
                    const r = raw(g);
                    const key = `over${String(line).replace(".", "")}`;
                    const ready = percentValue(getPath(r, [
                      `markets.prob.${key}`,
                      `markets.${key}_prob`,
                      `${key}_prob`,
                      `prob_${key}`,
                      `goals.${key}_prob`,
                      `over_${String(line).replace(".", "")}_prob`
                    ]), null);
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(50 + (expectedGoals(g) - line) * 22), 5, 92);
                  }
            
                  function percentBtts(g){
                    const r = raw(g);
                    const ready = percentValue(getPath(r, [
                      "markets.prob.btts",
                      "markets.btts_prob",
                      "btts_prob",
                      "prob_btts",
                      "ambas_marcam_prob",
                      "both_teams_score_prob"
                    ]), null);
            
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(43 + (expectedGoals(g) - 2.12) * 15 + (seed(g) % 8)), 12, 84);
                  }
            
                  function percentCorners(g, line, ht = false){
                    const r = raw(g);
                    const key = `corners${String(line).replace(".", "")}${ht ? "ht" : ""}`;
                    const ready = percentValue(getPath(r, [
                      `markets.prob.${key}`,
                      `markets.filterProb.${key}`,
                      `${key}_prob`,
                      `${key}_filter_prob`
                    ]), null);
            
                    if (ready !== null && ready > 5) return ready;
            
                    const projected = ht ? projectedCorners(g) * 0.46 : projectedCorners(g);
                    return clamp(Math.round(50 + (projected - line) * 16), 5, 93);
                  }
            
                  function percentCards(g, line){
                    const r = raw(g);
                    const key = `cards${String(line).replace(".", "")}`;
                    const ready = percentValue(getPath(r, [
                      `markets.prob.${key}`,
                      `${key}_prob`,
                      `over${String(line).replace(".", "")}cards_prob`
                    ]), null);
            
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(48 + (projectedCards(g) - line) * 14), 5, 90);
                  }
            
                  function marketPercent(g, ctx){
                    const t = ctx.text;
                    const line = lineFromText(ctx.label);
            
                    if (t.includes("ambas") || t.includes("ambos") || t.includes("btts")){
                      return percentBtts(g);
                    }
            
                    if (t.includes("gol") || t.includes("gols")){
                      const l = line || 2.5;
                      if (t.includes("under") || t.includes("nao") || t.includes("não")){
                        return clamp(Math.round(55 + (l - expectedGoals(g)) * 22), 5, 92);
                      }
                      return percentGoals(g, l);
                    }
            
                    if (t.includes("escanteio") || t.includes("canto") || t.includes("cantos")){
                      const l = line || 9.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1o tempo") || t.includes("1º tempo");
                      if (t.includes("under")){
                        const projected = ht ? projectedCorners(g) * 0.46 : projectedCorners(g);
                        return clamp(Math.round(55 + (l - projected) * 16), 5, 92);
                      }
                      return percentCorners(g, l, ht);
                    }
            
                    if (t.includes("cart")){
                      const l = line || (t.includes("vermelho") ? 5.0 : 3.5);
                      if (t.includes("under") || t.includes("sem cartao") || t.includes("sem cartão")){
                        return clamp(Math.round(55 + (l - projectedCards(g)) * 14), 5, 90);
                      }
                      return percentCards(g, l);
                    }
            
                    const r = raw(g);
                    const base = num(r.ai_score ?? r.score ?? r.local_score ?? r.over95_prob_adj ?? r.over95_prob, 58);
                    return clamp(Math.round(base + (seed(g) % 9) - 4), 12, 94);
                  }
            
                  function marketPass(g, ctx){
                    const t = ctx.text;
                    const p = marketPercent(g, ctx);
            
                    if (t.includes("over 4.5") || t.includes("+4.5") || t.includes("over 5.5") || t.includes("+5.5") || t.includes("over 6.5") || t.includes("+6.5")) return p >= 28;
                    if (t.includes("over 3.5") || t.includes("+3.5")) return p >= 30;
                    if (t.includes("over 2.5") || t.includes("+2.5")) return p >= 34;
                    if (t.includes("under")) return p >= 38;
                    if (t.includes("ambas") || t.includes("ambos") || t.includes("btts")) return p >= 38;
            
                    if (t.includes("escanteio") || t.includes("canto")){
                      const l = lineFromText(ctx.label) || 9.5;
                      const projected = projectedCorners(g);
                      return t.includes("under") ? projected <= l + 0.8 : projected >= l - 0.8;
                    }
            
                    if (t.includes("cart")){
                      const l = lineFromText(ctx.label) || 3.5;
                      return t.includes("under") ? projectedCards(g) <= l + 0.7 : projectedCards(g) >= l - 0.7;
                    }
            
                    return true;
                  }
            
                  function makeRow(g, ctx, index){
                    const d = info(g);
                    const p = Math.round(marketPercent(g, ctx));
                    return `
                      <div class="gameRow" data-market-cache-row="1" data-game-index="${index}">
                        <div class="gameMeta">
                          <small>${esc(d.league)}</small>
                          <b><span>${esc(d.time)}</span> ${esc(d.home)}<br><em>${esc(d.away)}</em></b>
                        </div>
                        <div class="oddBox"><small>MERCADO</small><b>${esc(ctx.label)}</b><span>${p}%</span></div>
                        <div class="oddBox"><small>ESCANTEIOS</small><b>PROJ.</b><span>${projectedCorners(g).toFixed(1)}</span></div>
                        <div class="oddBox"><small>TOTAL GOLS</small><b>PROJ.</b><span>${expectedGoals(g).toFixed(1)}</span></div>
                        <div class="oddBox"><small>CARTÕES</small><b>PROJ.</b><span>${projectedCards(g).toFixed(1)}</span></div>
                        <button class="signal" type="button">▮▮▮</button>
                      </div>
                    `;
                  }
            
                  async function renderMarket(ctx){
                    const panel = $(".gamesPanel");
                    if (!panel) return;
            
                    const ymd = selectedDate();
                    const oldH = panel.offsetHeight;
                    if (oldH > 0) panel.style.minHeight = `${oldH}px`;
            
                    const title = $(".sectionHead h2", panel);
                    if (title) title.textContent = `Jogos — ${ctx.label}`;
            
                    panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
            
                    let games = MARKET_CACHE.get(ymd);
            
                    // Clique em mercado deve filtrar LOCALMENTE.
                    // Não mostra loading e não chama API de novo.
                    if (!games || !games.length){
                      try{
                        const panelCache = panel.__cornerProAllGames;
                        const panelDate = panel.dataset?.marketCacheDate;
                        if (panelDate === ymd && Array.isArray(panelCache) && panelCache.length){
                          games = storeMarketGames(ymd, panelCache);
                        }
                      }catch(e){}
                    }
            
                    if (!games || !games.length){
                      try{
                        if (window.__cornerProAllGamesDate === ymd && Array.isArray(window.__cornerProAllGames) && window.__cornerProAllGames.length){
                          games = storeMarketGames(ymd, window.__cornerProAllGames);
                        }
                      }catch(e){}
                    }
            
                    if (!games || !games.length){
                      try{
                        if (typeof lastMarketDateYMD !== "undefined" && lastMarketDateYMD === ymd && Array.isArray(lastMarketGames) && lastMarketGames.length){
                          games = storeMarketGames(ymd, lastMarketGames);
                        }
                      }catch(e){}
                    }
            
                    if (!games || !games.length){
                      try{
                        if (typeof lastDateYMD !== "undefined" && lastDateYMD === ymd && Array.isArray(lastRawGames) && lastRawGames.length){
                          games = storeMarketGames(ymd, lastRawGames);
                        }
                      }catch(e){}
                    }
            
                    if (!games || !games.length){
                      games = await loadGamesOnceForDate(ymd);
                    }
            
                    if (!games.length){
                      panel.insertAdjacentHTML("beforeend", `
                        <div class="marketStrictEmpty">Nenhum jogo carregado para <b>${esc(ymd)}</b>.</div>
                        <button class="viewAll" type="button">VER TODOS OS JOGOS</button>
                      `);
                      return;
                    }
            
                    const filtered = games
                      .map((g, i) => ({ g, i }))
                      .filter(item => marketPass(item.g, ctx))
                      .sort((a,b) => marketPercent(b.g, ctx) - marketPercent(a.g, ctx))
                      .slice(0, 18);
            
                    if (!filtered.length){
                      panel.insertAdjacentHTML("beforeend", `
                        <div class="marketStrictEmpty">Nenhum jogo encontrado para <b>${esc(ctx.label)}</b> em <b>${esc(ymd)}</b>.</div>
                        <button class="viewAll" type="button">VER TODOS OS JOGOS</button>
                      `);
                      return;
                    }
            
                    panel.insertAdjacentHTML(
                      "beforeend",
                      filtered.map(item => makeRow(item.g, ctx, item.i)).join("") +
                      `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`
                    );
                  }
            
                  async function restoreAll(){
                    const ymd = selectedDate();
                    let games = MARKET_CACHE.get(ymd);
                    if (!games || !games.length) games = await loadGamesOnceForDate(ymd);
                    const panel = $(".gamesPanel");
            
                    if (typeof renderGames === "function"){
                      try{
                        renderGames(games);
                        if (panel) panel.style.minHeight = "";
                        return;
                      }catch(e){}
                    }
            
                    if (!panel) return;
            
                    panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
            
                    const ctx = { label:"Todos", text:"todos" };
                    panel.insertAdjacentHTML(
                      "beforeend",
                      games.slice(0, 18).map((g, i) => makeRow(g, ctx, i)).join("") +
                      `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`
                    );
                  }
            
                  // Guarda data escolhida sem limpar o cache já carregado daquela data.
                  document.addEventListener("click", function(ev){
                    const day = ev.target.closest(".topCalendarDay,[data-cal-day]");
                    if (!day) return;
            
                    const ymd = day.dataset.date || day.dataset.calDay;
                    if (!isYMD(ymd)) return;
            
                    setSelectedDate(ymd, { clearPanelCache:true });
                  }, true);
            
                  document.addEventListener("input", function(ev){
                    if (ev.target && ev.target.id === "date" && isYMD(ev.target.value)){
                      setSelectedDate(ev.target.value, { clearPanelCache:true });
                    }
                  }, true);
            
                  document.addEventListener("change", function(ev){
                    if (ev.target && ev.target.id === "date" && isYMD(ev.target.value)){
                      setSelectedDate(ev.target.value, { clearPanelCache:true });
                    }
                  }, true);
            
                  // Clique em mercado: intercepta antes de qualquer handler antigo.
                  document.addEventListener("click", function(ev){
                    const btn = ev.target.closest(".marketInlineItem");
                    if (!btn) return;
            
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
            
                    $$(".marketInlineItem.is-selected").forEach(el => el.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
            
                    renderMarket(contextFromButton(btn));
                  }, true);
            
                  document.addEventListener("click", function(ev){
                    const btn = ev.target.closest(".viewAll");
                    if (!btn) return;
            
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
            
                    restoreAll();
                  }, true);
            
                  document.addEventListener("click", async function(ev){
                    const row = ev.target.closest(".gameRow[data-market-cache-row]");
                    if (!row) return;
            
                    const games = await loadGamesOnceForDate(selectedDate());
                    const g = games[Number(row.dataset.gameIndex)];
                    if (!g) return;
            
                    const r = raw(g);
                    const d = info(g);
                    const railGame = {
                      ...r,
                      casa:d.home,
                      fora:d.away,
                      liga:d.league,
                      hora:d.time,
                      match_id:r.match_id ?? r.id ?? r.event_key ?? r.event_id
                    };
            
                    try{
                      if (typeof updateDesktopMatchRail === "function"){
                        updateDesktopMatchRail(railGame, games.map(raw));
                      } else if (window.updateDesktopMatchRail){
                        window.updateDesktopMatchRail(railGame, games.map(raw));
                      }
                    }catch(e){}
                  }, true);
            
                  // FIX DEFINITIVO: ao atualizar/abrir a página, sempre começa no dia atual.
                  // Não reaproveita mais data da URL, input antigo ou localStorage.
                  const initial = todayAM();
            
                  try{
                    localStorage.removeItem("cornerProSelectedDate");
                    window.__cornerProSelectedDate = initial;
            
                    const url = new URL(window.location.href);
                    url.searchParams.delete("date");
                    url.searchParams.delete("data");
                    window.history.replaceState({}, "", url.toString());
                  }catch(e){}
            
                  if (isYMD(initial)) setSelectedDate(initial, { clearPanelCache:false });
            
                  window.cornerProSetDate = function(ymd){
                    setSelectedDate(ymd, { clearPanelCache:true });
                  };
            
                  window.cornerProClearMarketCache = function(){
                    MARKET_CACHE.clear();
                  };
                })();
                /* =========================================================
                   MATCH CENTER LATERAL FINAL — PLACAR + COMPARATIVO + PRESSÃO
                   - Patch no fim do JS para vencer versões antigas
                   - Altera somente #desktopMatchRail
                   ========================================================= */
                (function installFinalRightRailMatchCenter(){
                  const esc = (v) => String(v ?? "")
                    .replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
            
                  const clean = (v, fb = "—") => {
                    const s = String(v ?? "").trim();
                    return s && s !== "undefined" && s !== "null" && s !== "NaN" ? s : fb;
                  };
            
                  const num = (v, fb = null) => {
                    const n = Number(String(v ?? "").replace("%","").replace(",","."));
                    return Number.isFinite(n) ? n : fb;
                  };
            
                  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
                  const pct = (v) => clamp(Math.round(num(v, 0)), 0, 100);
            
                  function initials(name, fallback){
                    const s = clean(name, fallback);
                    const parts = s.split(/\s+/).filter(Boolean);
                    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                    return s.slice(0,2).toUpperCase();
                  }
            
                  function valueFrom(obj, paths, fb = "—"){
                    for (const path of paths){
                      const parts = path.split(".");
                      let cur = obj;
                      for (const p of parts) cur = cur?.[p];
                      if (cur !== undefined && cur !== null && cur !== "") return clean(cur, fb);
                    }
                    return fb;
                  }
            
                  function numberFrom(obj, paths, fb = null){
                    const v = valueFrom(obj, paths, "");
                    const n = num(v, null);
                    return n === null ? fb : n;
                  }
            
                  function statusLabel(data){
                    const raw = String(data?.status || data?.status_raw || "").toLowerCase();
                    if (data?.finished || raw.includes("ft") || raw.includes("final") || raw.includes("finished") || raw.includes("encerrado")) return "ENCERRADO";
                    if (data?.live || raw.includes("live") || raw.includes("ao vivo")) return "AO VIVO";
                    return "PRÉ-JOGO";
                  }
            
                  function getMinute(data){
                    const raw = data?.minute ?? data?.match_minute ?? data?.time_live ?? data?.elapsed ?? "";
                    const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
                    if (Number.isFinite(n)) return clamp(n, 1, 120);
                    return data?.finished ? 90 : 0;
                  }
            
                  function splitPercent(a, b){
                    const x = num(a, null), y = num(b, null);
                    if (x === null || y === null){
                      return { home:50, away:50 };
                    }
                    const total = Math.max(1, x + y);
                    const home = clamp(Math.round((x / total) * 100), 0, 100);
                    return { home, away:100 - home };
                  }
            
                  function metricRow(label, homeVal, awayVal, maxHint){
                    const hNum = num(homeVal, null);
                    const aNum = num(awayVal, null);
                    const max = Math.max(1, num(maxHint, null) || hNum || 0, aNum || 0);
                    const hw = hNum === null ? 0 : clamp(Math.round((hNum / max) * 100), 3, 100);
                    const aw = aNum === null ? 0 : clamp(Math.round((aNum / max) * 100), 3, 100);
                    return `
                      <div class="mcRailRow">
                        <div class="mcRailRowValue">${esc(homeVal)}</div>
                        <div class="mcRailTrack home"><i style="width:${hw}%"></i></div>
                        <div class="mcRailMetric">${esc(label)}</div>
                        <div class="mcRailTrack away"><i style="width:${aw}%"></i></div>
                        <div class="mcRailRowValue away">${esc(awayVal)}</div>
                      </div>`;
                  }
            
                  function pressureLevel(ph, pa, explicit){
                    if (explicit) return clean(explicit);
                    const total = (num(ph,0) || 0) + (num(pa,0) || 0);
                    if (total >= 75) return "MUITO FORTE";
                    if (total >= 48) return "FORTE";
                    if (total >= 25) return "EQUILIBRADO";
                    if (total > 0) return "BAIXO";
                    return "AGUARDANDO";
                  }
            
                  function eventMinute(e){
                    const raw = e?.minute ?? e?.time ?? e?.elapsed ?? e?.match_minute ?? e?.label ?? "";
                    const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
                    return Number.isFinite(n) ? clamp(n, 1, 120) : null;
                  }
            
                  function eventIcon(e){
                    const t = String(e?.type || e?.label || e?.detail || e?.description || "").toLowerCase();
                    if (t.includes("goal") || t.includes("gol")) return "⚽";
                    if (t.includes("corner") || t.includes("escanteio")) return "⚑";
                    if (t.includes("yellow") || t.includes("amarelo")) return "🟨";
                    if (t.includes("red") || t.includes("vermelho")) return "🟥";
                    if (t.includes("sub")) return "↕";
                    return "•";
                  }
            
                  function normalizeTimelineItem(p, idx){
                    return {
                      minute: num(p?.minute ?? p?.time ?? p?.elapsed ?? p?.label, idx + 1),
                      home: num(p?.home ?? p?.mandante ?? p?.casa ?? p?.home_pressure ?? p?.h, 0),
                      away: num(p?.away ?? p?.visitante ?? p?.fora ?? p?.away_pressure ?? p?.a, 0)
                    };
                  }
            
                  function buildSeries(data, ph, pa){
                    const candidates = [
                      data?.pressure_timeline,
                      data?.pressureTimeline,
                      data?.pressure_history,
                      data?.pressureHistory,
                      data?.momentum,
                      data?.momentum_timeline,
                      data?.attacks_timeline,
                      data?.dangerous_attacks_timeline
                    ];
            
                    for (const c of candidates){
                      if (Array.isArray(c) && c.length >= 4){
                        const real = c.map(normalizeTimelineItem).filter(p => Number.isFinite(p.home) || Number.isFinite(p.away));
                        if (real.length >= 4) return real.slice(-28);
                      }
                    }
            
                    const events = Array.isArray(data?.events) ? data.events : [];
                    if (events.length){
                      const buckets = Array.from({length:18}, (_,i) => ({ minute:i * 5, home:0, away:0 }));
                      events.forEach(e => {
                        const m = eventMinute(e);
                        if (!m) return;
                        const idx = clamp(Math.floor(m / 5), 0, buckets.length - 1);
                        const txt = String(e?.type || e?.label || "").toLowerCase();
                        const weight = txt.includes("gol") || txt.includes("goal") ? 14 : txt.includes("corner") || txt.includes("escanteio") ? 8 : txt.includes("shot") || txt.includes("final") ? 6 : 3;
                        const side = String(e?.side || e?.team_side || "").toLowerCase();
                        if (side.includes("away") || side.includes("fora") || side.includes("visit")) buckets[idx].away += weight;
                        else buckets[idx].home += weight;
                      });
                      if (buckets.some(b => b.home || b.away)) return buckets;
                    }
            
                    const h = num(ph, 0) || 0;
                    const a = num(pa, 0) || 0;
                    const minute = getMinute(data) || 90;
                    const size = 22;
                    return Array.from({length:size}, (_,i) => {
                      const t = i / (size - 1);
                      const waveH = 0.55 + 0.35 * Math.sin(i * 1.15) + 0.16 * Math.cos(i * 2.2);
                      const waveA = 0.55 + 0.35 * Math.cos(i * 1.05) + 0.15 * Math.sin(i * 1.8);
                      return {
                        minute: Math.round(t * Math.max(90, minute)),
                        home: Math.max(1, Math.round((h || 28) / 12 * waveH)),
                        away: Math.max(1, Math.round((a || 34) / 12 * waveA))
                      };
                    });
                  }
            
                  function linePath(points){
                    return points.map((p,i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                  }
            
                  function areaPath(points, mid, topSide){
                    if (!points.length) return "";
                    if (topSide){
                      return `M${points[0].x.toFixed(1)},${mid} ` + linePath(points).replace(/^M[^L]+/, `L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`) + ` L${points[points.length-1].x.toFixed(1)},${mid} Z`;
                    }
                    return `M${points[0].x.toFixed(1)},${mid} ` + linePath(points).replace(/^M[^L]+/, `L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`) + ` L${points[points.length-1].x.toFixed(1)},${mid} Z`;
                  }
            
                  function pressureChart(data, ph, pa, events){
                    const series = buildSeries(data || {}, ph, pa).slice(-30);
                    const W = 330, H = 174, left = 24, right = 8, top = 14, bottom = 24, mid = 86;
                    const maxV = Math.max(8, ...series.flatMap(p => [num(p.home,0), num(p.away,0)]));
                    const span = W - left - right;
                    const xAt = (i) => left + (i / Math.max(1, series.length - 1)) * span;
                    const yHome = (v) => mid - (num(v,0) / maxV) * 62;
                    const yAway = (v) => mid + (num(v,0) / maxV) * 62;
                    const homePts = series.map((p,i) => ({ x:xAt(i), y:yHome(p.home) }));
                    const awayPts = series.map((p,i) => ({ x:xAt(i), y:yAway(p.away) }));
                    const eventMarks = (Array.isArray(events) ? events : []).slice(0,6).map(e => {
                      const m = eventMinute(e);
                      if (!m) return "";
                      const x = left + clamp(m, 0, 90) / 90 * span;
                      return `<line class="eventLine" x1="${x.toFixed(1)}" y1="18" x2="${x.toFixed(1)}" y2="150"></line><text class="eventText" x="${x.toFixed(1)}" y="16" text-anchor="middle">${eventIcon(e)}</text>`;
                    }).join("");
            
                    return `
                      <div class="mcRailSvgWrap">
                        <svg class="mcRailPressureSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de pressão da partida">
                          <defs>
                            <linearGradient id="mcRailHomeArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1688ff" stop-opacity=".55"/><stop offset="1" stop-color="#1688ff" stop-opacity="0"/></linearGradient>
                            <linearGradient id="mcRailAwayArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#63f127" stop-opacity=".46"/><stop offset="1" stop-color="#63f127" stop-opacity="0"/></linearGradient>
                          </defs>
                          <line class="grid" x1="${left}" y1="${top}" x2="${W-right}" y2="${top}"></line>
                          <line class="grid" x1="${left}" y1="52" x2="${W-right}" y2="52"></line>
                          <line class="mid" x1="${left}" y1="${mid}" x2="${W-right}" y2="${mid}"></line>
                          <line class="grid" x1="${left}" y1="120" x2="${W-right}" y2="120"></line>
                          <line class="grid" x1="${left}" y1="150" x2="${W-right}" y2="150"></line>
                          <path class="homeArea" d="${areaPath(homePts, mid, true)}"></path>
                          <path class="awayArea" d="${areaPath(awayPts, mid, false)}"></path>
                          <path class="homeLine" d="${linePath(homePts)}"></path>
                          <path class="awayLine" d="${linePath(awayPts)}"></path>
                          ${eventMarks}
                          <text x="${left}" y="168">0'</text><text x="${left + span/3}" y="168" text-anchor="middle">30'</text><text x="${left + span*2/3}" y="168" text-anchor="middle">60'</text><text x="${W-right}" y="168" text-anchor="end">90'</text>
                        </svg>
                        <div class="mcRailLegend"><span><i></i>Mandante</span><span class="away"><i></i>Visitante</span></div>
                      </div>`;
                  }
            
                  function importantEvents(events){
                    const list = Array.isArray(events) ? events.slice(0,7) : [];
                    if (!list.length){
                      return `<div class="mcRailEvents"><span>⚑</span><div class="line"></div><span>⚽</span><div class="line"></div><span>▣</span><div class="line"></div><span>⚑</span></div>`;
                    }
                    return `<div class="mcRailEvents">${list.map(e => `<span title="${esc(clean(e?.minute,""))} ${esc(clean(e?.label || e?.type,"Evento"))}">${eventIcon(e)}</span><div class="line"></div>`).join("")}</div>`;
                  }
            
                  function emptyRail(){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail) return;
                    rail.innerHTML = `
              <section class="railCard matchRailCard railEmptyHero">
                <div class="railTitle">
                  <span>▣ MATCH CENTER</span>
                  <b>PRÉ-JOGO</b>
                </div>

                <div class="railEmptyRadar" aria-hidden="true">
                  <span class="radarRing ring1"></span>
                  <span class="radarRing ring2"></span>
                  <span class="radarRing ring3"></span>
                  <span class="radarSweep"></span>
                  <span class="radarBall">⚽</span>
                </div>

                <div class="railEmptyText">
                  <strong>Aguardando partida</strong>
                  <span>Selecione um jogo para iniciar o Match Center e ver todas as análises.</span>
                </div>
              </section>

              <section class="railCard railEmptyStatsCard">
                <h3>ESTATÍSTICAS DO FILTRO</h3>

                <div class="railEmptyStatsGrid">
                  <div class="railEmptyStatBox">
                    <i>🛡</i>
                    <span>Força do filtro</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>🚩</i>
                    <span>Proj. escanteios</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>🏠</i>
                    <span>Casa média</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>

                  <div class="railEmptyStatBox">
                    <i>✈</i>
                    <span>Visitante média</span>
                    <b>--</b>
                    <small>Aguardando</small>
                  </div>
                </div>

                <div class="railEmptyHint">
                  As estatísticas serão carregadas após a seleção de uma partida.
                </div>
              </section>

              <section class="railCard railEmptyEventsCard">
                <h3>EVENTOS / LEITURA</h3>

                <div class="railEmptyEventIcons">
                  <span><i>◎</i><b>Pressão</b><small>--</small></span>
                  <span><i>◔</i><b>Posse</b><small>--</small></span>
                  <span><i>▣</i><b>Cartões</b><small>--</small></span>
                  <span><i>⚑</i><b>Escanteios</b><small>--</small></span>
                  <span><i>⚽</i><b>Gols</b><small>--</small></span>
                </div>

                <div class="railEmptyTimeline">
                  <i></i><i></i><i></i><i></i><i></i>
                </div>

                <div class="railEmptyReadBox">
                  <b>📋</b>
                  <p>A leitura do jogo aparecerá aqui. Selecione uma partida para ver eventos e insights em tempo real.</p>
                </div>
              </section>
                    `;
                  }
            
                  window.resetDesktopMatchRailToEmpty = emptyRail;
            
                  window.updateDesktopMatchRail = async function updateDesktopMatchRail(game){
                    const rail = document.getElementById("desktopMatchRail");
                    if (!rail || !game) return;
            
                    const matchId = clean(game?.match_id || game?.id || game?.event_key || game?.event_id || "", "");
                    const home0 = clean(game?.casa || game?.home || game?.home_team || game?.home_name || "Mandante");
                    const away0 = clean(game?.fora || game?.away || game?.away_team || game?.away_name || "Visitante");
                    const league0 = clean(game?.liga || game?.league_name || game?.league?.name || "Liga");
                    const time0 = clean(game?.hora || game?.time || "—");
                    const basePct = pct(game?.markets?.prob?.all ?? game?.over95_prob_adj ?? game?.over95_prob ?? game?.ai_score ?? 69);
                    const proj = Number.isFinite(Number(game?.proj_cantos)) ? Number(game.proj_cantos).toFixed(1).replace(".0","") : "—";
            
                    function render(data = {}){
                      const isReal = !!data && Object.keys(data).length > 0 && !data.error;
                      const home = clean(data?.home || data?.casa || data?.home_team || home0);
                      const away = clean(data?.away || data?.fora || data?.away_team || away0);
                      const league = clean(data?.league || data?.liga || league0);
                      const time = clean(data?.time || data?.hora || time0);
                      const st = isReal ? statusLabel(data) : "PRÉ-JOGO";
                      const minute = isReal ? getMinute(data) : 0;
                      const progress = st === "ENCERRADO" ? 100 : st === "AO VIVO" ? clamp(minute, 6, 96) : basePct;
            
                      const gh = clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score ?? 0, "0");
                      const ga = clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score ?? 0, "0");
                      const ch = clean(data?.corners?.home ?? data?.home_corners ?? (isReal ? null : game?.corners_home), "—");
                      const ca = clean(data?.corners?.away ?? data?.away_corners ?? (isReal ? null : game?.corners_away), "—");
                      const sh = clean(data?.shots?.home ?? data?.shots?.total_home ?? data?.home_shots ?? "—", "—");
                      const sa = clean(data?.shots?.away ?? data?.shots?.total_away ?? data?.away_shots ?? "—", "—");
                      const sotH = clean(data?.shots_on_target?.home ?? data?.on_target?.home ?? data?.shots?.on_home ?? "—", "—");
                      const sotA = clean(data?.shots_on_target?.away ?? data?.on_target?.away ?? data?.shots?.on_away ?? "—", "—");
                      const possH = clean(data?.possession?.home ?? data?.posse?.home ?? "—", "—");
                      const possA = clean(data?.possession?.away ?? data?.posse?.away ?? "—", "—");
                      const passH = clean(data?.passes?.home ?? data?.accurate_passes?.home ?? "—", "—");
                      const passA = clean(data?.passes?.away ?? data?.accurate_passes?.away ?? "—", "—");
                      const foulH = clean(data?.fouls?.home ?? data?.faltas?.home ?? "—", "—");
                      const foulA = clean(data?.fouls?.away ?? data?.faltas?.away ?? "—", "—");
                      const cardH = clean(data?.cards?.yellow_home ?? data?.cards?.home ?? data?.yellow_cards?.home ?? "—", "—");
                      const cardA = clean(data?.cards?.yellow_away ?? data?.cards?.away ?? data?.yellow_cards?.away ?? "—", "—");
                      const ph = clean(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.attacks?.home ?? (isReal ? null : basePct), isReal ? "—" : basePct);
                      const pa = clean(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.attacks?.away ?? (isReal ? null : Math.max(0, 100 - basePct)), isReal ? "—" : Math.max(0, 100 - basePct));
                      const split = splitPercent(ph, pa);
                      const events = Array.isArray(data?.events) ? data.events : [];
                      const confidence = split.home;
                      const reading = isReal
                        ? `${split.home >= split.away ? home : away} aparece com maior pressão ofensiva no recorte atual.`
                        : `Pré-jogo selecionado. Projeção de ${proj} escanteios e força do filtro em ${basePct}%.`;
            
                      rail.innerHTML = `
                        <section class="railCard mcRailScoreCard ${st === "AO VIVO" ? "is-live" : ""}">
                          <div class="railTitle"><span>▣ MATCH CENTER</span><b>${esc(st)}${st === "AO VIVO" && minute ? " • " + minute + "'" : ""}</b></div>
                          <div class="mcRailMeta">${esc(league)} • ${esc(time)}</div>
                          <div class="mcRailScoreGrid">
                            <div class="mcRailTeam"><div class="mcRailBadge">${esc(initials(home,"CA"))}</div><strong>${esc(home)}</strong></div>
                            <div class="mcRailScore"><strong>${esc(gh)} - ${esc(ga)}</strong><span>${esc(st)}</span></div>
                            <div class="mcRailTeam"><div class="mcRailBadge away">${esc(initials(away,"FO"))}</div><strong>${esc(away)}</strong></div>
                          </div>
                          <div class="mcRailTimeline"><i style="width:${progress}%"></i></div>
                        </section>
            
                        <section class="railCard mcRailCompare">
                          <div class="mcRailCompareHead"><h3>Comparativo</h3><span>REAL</span></div>
                          ${metricRow("Escanteios", ch, ca)}
                          ${metricRow("Finalizações", sh, sa)}
                          ${metricRow("No alvo", sotH, sotA)}
                          ${metricRow("Posse de bola", possH, possA, 100)}
                          ${metricRow("Passes certos", passH, passA)}
                          ${metricRow("Faltas", foulH, foulA)}
                          ${metricRow("Cartões", cardH, cardA)}
                        </section>
            
                        <section class="railCard mcRailPressureCard">
                          <div class="mcRailPressureHead"><h3>Gráfico de pressão</h3><b>${esc(pressureLevel(ph, pa, data?.pressure_level))}</b></div>
                          <div class="mcRailPressureSplit">
                            <div><span>${esc(home)}</span><strong>${split.home}%</strong></div>
                            <div class="mcRailPressureBar"><i style="width:${split.home}%"></i><i style="width:${split.away}%"></i></div>
                            <div class="away"><span>${esc(away)}</span><strong>${split.away}%</strong></div>
                          </div>
                          ${pressureChart(data || {}, ph, pa, events)}
                        </section>
            
                        <div class="mcRailBottomGrid">
                          <section class="railCard mcRailMini">
                            <h3>Leitura do jogo</h3>
                            <p>${esc(reading)}</p>
                          </section>
                          <section class="railCard mcRailMini">
                            <h3>Momentos</h3>
                            ${importantEvents(events)}
                          </section>
                        </div>
            
                        <button class="railFullBtn" type="button" data-open-match-center-table="1" data-match-id="${esc(matchId)}" data-home="${esc(home)}" data-away="${esc(away)}" data-league="${esc(league)}" data-time="${esc(time)}">VER PARTIDA COMPLETA →</button>
                      `;
                    }
            
                    render({});
            
                    if (!matchId) return;
                    try{
                      async function fetchMatchCenterFinal(){
                        const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&t=${Date.now()}`, {
                          cache:"no-store",
                          headers:{ "Cache-Control":"no-cache" }
                        });
                        if (!res.ok) return null;
                        const payload = await res.json();
                        return payload && !payload.error ? payload : null;
                      }
            
                      let data = await fetchMatchCenterFinal();
                      if (!data) return;
            
                      const hasFinalStats = [
                        data?.corners?.home, data?.corners?.away,
                        data?.shots?.home, data?.shots?.away,
                        data?.possession?.home, data?.possession?.away,
                        data?.passes?.home, data?.passes?.away
                      ].some(v => v !== null && v !== undefined && v !== "");
            
                      // Algumas ligas publicam o consolidado poucos segundos depois do apito final.
                      if (data.finished && !hasFinalStats){
                        await new Promise(resolve => setTimeout(resolve, 1400));
                        data = (await fetchMatchCenterFinal()) || data;
                      }
            
                      render(data);
                    }catch(err){
                      console.warn("Match Center lateral final falhou:", err);
                    }
                  };
            
                  document.addEventListener("DOMContentLoaded", () => {
                    const rail = document.getElementById("desktopMatchRail");
                    if (rail && !window.__selectedMatchCenterGame) emptyRail();
                  });
                })();
            
                /* =========================================================
                   FIX DEFINITIVO — MATCH CENTER AO ATUALIZAR A PÁGINA
                   Mantém o estado vazio completo: Match Center + Estatísticas + Eventos.
                   ========================================================= */
                (function fixEmptyMatchCenterOnRefresh(){
                  if (window.__fixEmptyMatchCenterOnRefreshInstalled) return;
                  window.__fixEmptyMatchCenterOnRefreshInstalled = true;
            
                  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({
                    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
                  }[ch]));
            
                  function renderEmptyMatchCenter(){
                    const rail = document.getElementById("desktopMatchRail") || document.querySelector(".dashboardRightRail");
                    if (!rail) return;
            
                    // Se já existe partida selecionada/renderizada, não mexe.
                    if (rail.querySelector(".mcRailScoreCard, .mcProScoreCard, [data-open-match-center-table]:not(.railFullBtnDisabled)")) return;
            
                    rail.innerHTML = `
                      <section class="railCard mcRailEmptyBox">
                        <div class="railTitle">
                          <span>▣ MATCH CENTER</span>
                          <b>PRÉ-JOGO</b>
                        </div>
                        <div class="mcRailEmptyRadar"><b>⚽</b></div>
                        <h3>AGUARDANDO PARTIDA</h3>
                        <p>Selecione um jogo para abrir o placar, comparativo e gráfico de pressão no painel lateral.</p>
                      </section>
            
                      <section class="railCard">
                        <h3>ESTATÍSTICAS DO FILTRO</h3>
                        <div class="railEmptyStatsGrid">
                          <div class="railEmptyStatBox"><i>🛡️</i><span>Força do filtro</span><b>--</b><small>Aguardando</small></div>
                          <div class="railEmptyStatBox"><i>🚩</i><span>Proj. escanteios</span><b>--</b><small>Aguardando</small></div>
                          <div class="railEmptyStatBox"><i>🏠</i><span>Casa média</span><b>--</b><small>Aguardando</small></div>
                          <div class="railEmptyStatBox"><i>✈</i><span>Visitante média</span><b>--</b><small>Aguardando</small></div>
                        </div>
                        <p class="railEmptyHint">As estatísticas serão carregadas após a seleção de uma partida.</p>
                      </section>
            
                      <section class="railCard">
                        <h3>EVENTOS / LEITURA</h3>
                        <div class="railEmptyEventIcons">
                          <span><i>◎</i><b>Pressão</b></span>
                          <span><i>⌁</i><b>Posse</b></span>
                          <span><i>▣</i><b>Cartões</b></span>
                          <span><i>⚑</i><b>Escanteios</b></span>
                          <span><i>⚽</i><b>Gols</b></span>
                        </div>
                        <div class="railEmptyTimeline"><i></i><i></i><i></i><i></i><i></i></div>
                        <div class="railEmptyReadBox">
                          <span>📋</span>
                          <p>A leitura do jogo aparecerá aqui. Selecione uma partida para ver eventos e insights em tempo real.</p>
                        </div>
                      </section>
            
                      <button class="railFullBtn railFullBtnDisabled" type="button" disabled>
                        ▶ INICIAR MATCH CENTER
                        <small>SELECIONE UM JOGO PARA CONTINUAR</small>
                      </button>`;
                  }
            
                  window.resetDesktopMatchRailToEmpty = renderEmptyMatchCenter;
                  window.renderEmptyMatchCenter = renderEmptyMatchCenter;
            
                  function scheduleFix(){
                    setTimeout(renderEmptyMatchCenter, 40);
                    setTimeout(renderEmptyMatchCenter, 180);
                    setTimeout(renderEmptyMatchCenter, 600);
                  }
            
                  document.addEventListener("DOMContentLoaded", scheduleFix);
                  window.addEventListener("load", scheduleFix);
            
                  const obs = new MutationObserver(() => {
                    const rail = document.getElementById("desktopMatchRail") || document.querySelector(".dashboardRightRail");
                    if (!rail) return;
                    const hasEmptySingle = rail.querySelector(".mcRailEmptyBox") && !rail.textContent.includes("ESTATÍSTICAS DO FILTRO");
                    if (hasEmptySingle) setTimeout(renderEmptyMatchCenter, 20);
                  });
            
                  document.addEventListener("DOMContentLoaded", () => {
                    const rail = document.getElementById("desktopMatchRail") || document.querySelector(".dashboardRightRail");
                    if (rail) obs.observe(rail, { childList:true, subtree:true });
                  });
                })();
            
                /* =========================================================
                   DATA INICIAL DO DASHBOARD
                   - Preserva ?date=YYYY-MM-DD ao atualizar a página
                   - Usa a data de hoje somente quando nenhuma data foi escolhida
                   - Evita sobrescrever a seleção do calendário
                   ========================================================= */
                (function initializeDashboardDate(){
                  if (window.__cornerProDashboardDateInitialized) return;
                  window.__cornerProDashboardDateInitialized = true;
            
                  function todayManausYMD(){
                    try{
                      return new Intl.DateTimeFormat("en-CA", {
                        timeZone:"America/Manaus",
                        year:"numeric",
                        month:"2-digit",
                        day:"2-digit"
                      }).format(new Date());
                    }catch(e){
                      return new Date().toISOString().slice(0,10);
                    }
                  }
            
                  function initialize(){
                    const params = new URLSearchParams(window.location.search);
                    const selected = params.get("date") || params.get("data") || todayManausYMD();
                    const input = document.getElementById("date");
                    if (input) input.value = selected;
                    window.__cornerProSelectedDate = selected;
            
                    const url = new URL(window.location.href);
                    url.hash = "";
                    url.searchParams.delete("data");
                    url.searchParams.set("date", selected);
                    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
                  }
            
                  if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", initialize, { once:true });
                  } else {
                    initialize();
                  }
                })();
                /* =========================================================
                   FIX FINAL — FILTRO CONSISTENTE PARA TODOS OS MERCADOS
                   - Clique em qualquer mercado destacado não chama API
                   - Não apaga os jogos carregados
                   - Filtra localmente conforme o mercado clicado
                   - Escanteios, gols, cartões, resultado e combinadas
                   ========================================================= */
                (function(){
                  if (window.__cornerProStrictAllMarketsV2) return;
                  window.__cornerProStrictAllMarketsV2 = true;
            
                  const $ = (sel, root=document) => root.querySelector(sel);
                  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
            
                  function clean(v, fallback=""){
                    const s = String(v ?? "").replace(/\s+/g," ").trim();
                    return s || fallback;
                  }
            
                  function norm(v){
                    return clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
                  }
            
                  function esc(v){
                    return String(v ?? "")
                      .replaceAll("&","&amp;")
                      .replaceAll("<","&lt;")
                      .replaceAll(">","&gt;")
                      .replaceAll('"',"&quot;")
                      .replaceAll("'","&#039;");
                  }
            
                  function num(v, fallback=null){
                    if (v === undefined || v === null || v === "") return fallback;
                    if (typeof v === "string") v = v.replace(",", ".").replace("%", "");
                    const n = Number(v);
                    return Number.isFinite(n) ? n : fallback;
                  }
            
                  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
                  function raw(g){ return g?.raw || g?.data || g || {}; }
            
                  function getPath(obj, paths){
                    const r = raw(obj);
                    for (const path of paths){
                      const parts = String(path).split(".");
                      let cur = r;
                      for (const part of parts){
                        if (cur == null) break;
                        cur = cur[part];
                      }
                      if (cur !== undefined && cur !== null && cur !== "") return cur;
                    }
                    return null;
                  }
            
                  function pctValue(v, fallback=null){
                    if (typeof v === "boolean") return fallback;
                    const n = num(v, null);
                    if (n === null) return fallback;
                    if (n > 0 && n <= 1) return clamp(Math.round(n * 100), 0, 100);
                    return clamp(Math.round(n), 0, 100);
                  }
            
                  function seed(g){
                    const d = info(g);
                    let s = `${d.league}|${d.home}|${d.away}|${d.time}`;
                    let h = 0;
                    for (let i=0;i<s.length;i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
                    return Math.abs(h);
                  }
            
                  function info(g){
                    const r = raw(g);
                    return {
                      league: clean(r.liga || r.league || r.league_name || r.country || r.competition || r.campeonato, "Liga"),
                      time: clean(r.hora || r.time || r.match_time || r.event_time || "--:--"),
                      home: clean(r.casa || r.home || r.home_name || r.homeTeam || r.team_home || r.local || "Casa"),
                      away: clean(r.fora || r.away || r.away_name || r.awayTeam || r.team_away || r.visitante || "Visitante")
                    };
                  }
            
                  function projectedCorners(g){
                    const r = raw(g);
                    const direct = num(
                      r.proj_cantos ?? r.projCorners ?? r.corners_projection ?? r.corner_projection ??
                      r.expected_corners ?? r.total_corners_avg ?? r.media_cantos ?? r.cantos_proj,
                      null
                    );
                    if (direct !== null && direct > 0) return direct;
            
                    const home = num(r.home_corners_avg ?? r.casa_cantos_media ?? r.home?.corners_avg ?? r.stats?.home_corners_avg, null);
                    const away = num(r.away_corners_avg ?? r.fora_cantos_media ?? r.away?.corners_avg ?? r.stats?.away_corners_avg, null);
                    if (home !== null && away !== null) return clamp(home + away, 5.5, 15.8);
            
                    return 9.2 + (seed(g) % 31) / 10;
                  }
            
                  function expectedGoals(g){
                    const r = raw(g);
                    const direct = num(
                      r.expected_goals_total ?? r.totalExpected ?? r.markets?.totalExpected ?? r.goals_projection ??
                      r.proj_gols ?? r.xg_total ?? r.total_goals_avg,
                      null
                    );
                    if (direct !== null && direct > 0) return direct;
            
                    const hg = num(r.home_goals_avg ?? r.casa_gols_media ?? r.home?.goals_avg, null);
                    const ag = num(r.away_goals_avg ?? r.fora_gols_media ?? r.away?.goals_avg, null);
                    if (hg !== null && ag !== null) return clamp(hg + ag, 0.8, 5.2);
            
                    const p25 = pctValue(getPath(g,["markets.prob.over25","over25_prob","prob_over25"]), null);
                    if (p25 !== null) return clamp(2.5 + (p25 - 50) / 32, 1.2, 4.4);
            
                    return 2.25 + (seed(g) % 18) / 10;
                  }
            
                  function projectedCards(g){
                    const r = raw(g);
                    const direct = num(
                      r.proj_cards ?? r.cards_projection ?? r.expected_cards ?? r.total_cards_avg ??
                      r.cartoes_proj ?? r.cards?.total,
                      null
                    );
                    if (direct !== null && direct > 0) return direct;
            
                    const league = norm(info(g).league);
                    let total = 3.4;
                    if (league.includes("serie a") || league.includes("la liga") || league.includes("portugal") || league.includes("turk")) total += .45;
                    if (league.includes("premier") || league.includes("bundesliga")) total -= .12;
                    total += (seed(g) % 9) * .08;
                    return clamp(total, 1.8, 6.6);
                  }
            
                  function lineFromText(text){
                    const m = String(text || "").match(/(?:over|under|\+)\s*(\d+(?:\.\d+)?)/i);
                    return m ? Number(m[1]) : null;
                  }
            
                  function ctxFromButton(btn){
                    const label = clean(btn.dataset.marketLine || btn.dataset.market || btn.textContent || "Mercado");
                    const panel = btn.closest(".marketInlinePanel,.gamesPanel,.dashboardMainColumn");
                    const title = clean(panel?.querySelector(".marketInlineTitle strong,.sectionHead h2,h2,h3")?.textContent || "");
                    const section = clean(btn.closest(".marketInlineSection,article,.marketCard")?.querySelector("h4,h3,b,strong")?.textContent || "");
                    const text = norm(`${title} ${section} ${label}`);
                    return { label, title, section, text };
                  }
            
                  function percentCorners(g, line, ht=false){
                    const key = `corners${String(line).replace(".","")}${ht ? "ht" : ""}`;
                    const ready = pctValue(getPath(g,[`markets.prob.${key}`,`markets.filterProb.${key}`,`${key}_prob`,`${key}_filter_prob`]), null);
                    if (ready !== null && ready > 5) return ready;
                    const proj = projectedCorners(g) * (ht ? .46 : 1);
                    return clamp(Math.round(50 + (proj - line) * 16), 3, 96);
                  }
            
                  function percentGoals(g, line){
                    const key = `over${String(line).replace(".","")}`;
                    const ready = pctValue(getPath(g,[`markets.prob.${key}`,`markets.${key}_prob`,`${key}_prob`,`prob_${key}`]), null);
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(50 + (expectedGoals(g) - line) * 24), 3, 94);
                  }
            
                  function percentBtts(g){
                    const ready = pctValue(getPath(g,["markets.prob.btts","markets.btts_prob","btts_prob","prob_btts","ambas_marcam_prob"]), null);
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(42 + (expectedGoals(g) - 2.1) * 17 + (seed(g) % 7)), 8, 86);
                  }
            
                  function percentCards(g, line){
                    const key = `cards${String(line).replace(".","")}`;
                    const ready = pctValue(getPath(g,[`markets.prob.${key}`,`${key}_prob`,`over${String(line).replace(".","")}cards_prob`]), null);
                    if (ready !== null && ready > 5) return ready;
                    return clamp(Math.round(50 + (projectedCards(g) - line) * 15), 3, 92);
                  }
            
                  function resultOdd(g, kind){
                    const paths = {
                      home:["odds.home","odds.casa","odds.home_win","odd_home","casa_odd","homeOdd"],
                      draw:["odds.draw","odds.empate","odd_draw","empate_odd","drawOdd"],
                      away:["odds.away","odds.fora","odds.away_win","odd_away","fora_odd","awayOdd"]
                    }[kind] || [];
                    return num(getPath(g, paths), null);
                  }
            
                  function passResult(g, t){
                    if (t.includes("dupla") && t.includes("casa")) return true;
                    if (t.includes("dupla") && (t.includes("visit") || t.includes("fora"))) return true;
            
                    if (t.includes("empate")){
                      const odd = resultOdd(g,"draw");
                      return odd === null ? true : odd <= 3.65;
                    }
                    if (t.includes("visitante vence") || t.includes("fora vence")){
                      const odd = resultOdd(g,"away");
                      return odd === null ? true : odd <= 2.35;
                    }
                    if (t.includes("casa vence") || t.includes("mandante vence")){
                      const odd = resultOdd(g,"home");
                      return odd === null ? true : odd <= 2.25;
                    }
                    return true;
                  }
            
                  function marketPercent(g, ctx){
                    const t = ctx.text;
                    const line = lineFromText(ctx.label);
            
                    if (t.includes("ambas") || t.includes("btts")) return percentBtts(g);
            
                    if (t.includes("cart")){
                      const l = line || (t.includes("vermelh") ? 5 : 3.5);
                      if (t.includes("under") || t.includes("sem cart")) return clamp(Math.round(56 + (l - projectedCards(g)) * 15), 3, 92);
                      return percentCards(g, l);
                    }
            
                    if (t.includes("escanteio") || t.includes("canto") || t.includes("cantos")){
                      const l = line || 9.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      if (t.includes("under")){
                        const proj = projectedCorners(g) * (ht ? .46 : 1);
                        return clamp(Math.round(56 + (l - proj) * 16), 3, 94);
                      }
                      return percentCorners(g, l, ht);
                    }
            
                    if (t.includes("gol") || t.includes("gols")){
                      const l = line || 2.5;
                      if (t.includes("under") || t.includes("menos")) return clamp(Math.round(56 + (l - expectedGoals(g)) * 24), 3, 94);
                      return percentGoals(g, l);
                    }
            
                    const base = num(getPath(g,["ai_score","score","local_score","over95_prob_adj","over95_prob"]), 58);
                    return clamp(Math.round(base), 8, 94);
                  }
            
                  function marketPass(g, ctx){
                    const t = ctx.text;
                    const p = marketPercent(g, ctx);
            
                    // COMBINADAS: precisa passar em todas as partes relevantes.
                    if (t.includes("+") && (t.includes("casa") || t.includes("visitante") || t.includes("empate"))){
                      if (!passResult(g, t)) return false;
                      if (t.includes("over") || t.includes("+") || t.includes("gol")) return p >= 48;
                      return true;
                    }
            
                    if (t.includes("ambas") || t.includes("btts")) return p >= 50;
            
                    if (t.includes("resultado") || t.includes("vence") || t.includes("empate") || t.includes("dupla")){
                      return passResult(g, t);
                    }
            
                    if (t.includes("escanteio") || t.includes("canto") || t.includes("cantos")){
                      const line = lineFromText(ctx.label) || 9.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      const proj = projectedCorners(g) * (ht ? .46 : 1);
                      if (t.includes("under")) return proj <= line && p >= 46;
                      return proj >= line && p >= (line >= 11.5 ? 44 : line >= 10.5 ? 48 : 50);
                    }
            
                    if (t.includes("gol") || t.includes("gols")){
                      const line = lineFromText(ctx.label) || 2.5;
                      const proj = expectedGoals(g);
                      if (t.includes("under") || t.includes("menos")) return proj <= line && p >= 46;
                      return proj >= line - 0.05 && p >= (line >= 3.5 ? 38 : line >= 2.5 ? 45 : 50);
                    }
            
                    if (t.includes("cart")){
                      const line = lineFromText(ctx.label) || 3.5;
                      const proj = projectedCards(g);
                      if (t.includes("under") || t.includes("sem cart")) return proj <= line && p >= 44;
                      return proj >= line && p >= (line >= 5.5 ? 34 : line >= 4.5 ? 40 : 45);
                    }
            
                    // Player props/mercados sem estatística direta: mantém os jogos com maior força geral.
                    return p >= 52;
                  }
            
                  function getCurrentGames(){
                    const ymd = selectedDate();
                    const panel = $(".gamesPanel");
                    const candidates = [
                      panel?.__cornerProAllGames,
                      window.__cornerProAllGamesDate === ymd ? window.__cornerProAllGames : null,
                      panel?.__cornerProGames,
                      window.__cornerProApiCache?.[ymd]
                    ];
            
                    for (const arr of candidates){
                      if (Array.isArray(arr) && arr.length) return arr.map(x => x?.raw || x);
                    }
                    return [];
                  }
            
                  function selectedDate(){
                    const input = document.getElementById("date");
                    if (input?.value && /^\d{4}-\d{2}-\d{2}$/.test(input.value)) return input.value;
                    if (window.__cornerProSelectedDate && /^\d{4}-\d{2}-\d{2}$/.test(window.__cornerProSelectedDate)) return window.__cornerProSelectedDate;
                    return new Date().toISOString().slice(0,10);
                  }
            
                  function makeRow(g, ctx, index){
                    const d = info(g);
                    const p = Math.round(marketPercent(g, ctx));
                    return `
                      <div class="gameRow" data-strict-market-row="1" data-game-index="${index}">
                        <div class="gameMeta">
                          <small>${esc(d.league)}</small>
                          <b><span>${esc(d.time)}</span> ${esc(d.home)}<br><em>${esc(d.away)}</em></b>
                        </div>
                        <div class="oddBox"><small>MERCADO</small><b>${esc(ctx.label)}</b><span>${p}%</span></div>
                        <div class="oddBox"><small>CANTOS</small><b>PROJ.</b><span>${projectedCorners(g).toFixed(1)}</span></div>
                        <div class="oddBox"><small>GOLS</small><b>PROJ.</b><span>${expectedGoals(g).toFixed(1)}</span></div>
                        <div class="oddBox"><small>CARTÕES</small><b>PROJ.</b><span>${projectedCards(g).toFixed(1)}</span></div>
                        <button class="signal" type="button">▮▮▮</button>
                      </div>
                    `;
                  }
            
                  function renderStrictMarket(ctx){
                    const panel = $(".gamesPanel");
                    if (!panel) return;
            
                    const ymd = selectedDate();
                    const games = getCurrentGames();
                    const title = $(".sectionHead h2", panel);
                    if (title) title.textContent = `Jogos — ${ctx.label}`;
            
                    panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
            
                    if (!games.length){
                      panel.insertAdjacentHTML("beforeend", `<div class="marketStrictEmpty">Nenhum jogo carregado para <b>${esc(ymd)}</b>.</div>`);
                      return;
                    }
            
                    const filtered = games
                      .map((g,i)=>({g,i}))
                      .filter(item => marketPass(item.g, ctx))
                      .sort((a,b)=> marketPercent(b.g, ctx) - marketPercent(a.g, ctx))
                      .slice(0,18);
            
                    if (!filtered.length){
                      panel.insertAdjacentHTML("beforeend", `<div class="marketStrictEmpty">Nenhum jogo consistente para <b>${esc(ctx.label)}</b> em <b>${esc(ymd)}</b>.</div>`);
                      return;
                    }
            
                    panel.insertAdjacentHTML("beforeend", filtered.map(item => makeRow(item.g, ctx, item.i)).join(""));
                  }
            
                  // Intercepta antes dos handlers antigos no document.
                  window.addEventListener("click", function(ev){
                    const btn = ev.target.closest?.(".marketInlineItem");
                    if (!btn) return;
            
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
            
                    $$(".marketInlineItem.is-selected").forEach(el => el.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
            
                    renderStrictMarket(ctxFromButton(btn));
                  }, true);
                })();
            
                /* =========================================================
                   FIX DEFINITIVO — FILTRO REAL PARA TODOS OS MERCADOS INLINE
                   - Pré-jogo, Resultado, Gols, Escanteios, Cartões, Combinadas e Player Props
                   - Não chama API ao clicar em mercado
                   - Usa somente os jogos já carregados/cacheados
                   - Esconde jogos que não são consistentes com o mercado clicado
                   ========================================================= */
                (function cornerProStrictInlineMarketEngine(){
                  if (window.__cornerProStrictInlineMarketEngineV4) return;
                  window.__cornerProStrictInlineMarketEngineV4 = true;
            
                  const $ = (sel, root = document) => root.querySelector(sel);
                  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
            
                  function esc(v){
                    return String(v ?? "").replace(/[&<>"']/g, ch => ({
                      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
                    }[ch]));
                  }
            
                  function clean(v){ return String(v ?? "").replace(/\s+/g," ").trim(); }
                  function norm(v){
                    return clean(v).toLowerCase().normalize("NFD")
                      .replace(/[\u0300-\u036f]/g,"")
                      .replace(/[^a-z0-9.+\-º°/ ]+/g," ")
                      .replace(/\s+/g," ").trim();
                  }
                  function num(v, fb = null){
                    if (v === true || v === false) return fb;
                    const n = Number(String(v ?? "").replace("%","").replace(",","."));
                    return Number.isFinite(n) ? n : fb;
                  }
                  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
                  function getPath(obj, paths){
                    for (const p of paths){
                      let cur = obj;
                      for (const part of String(p).split(".")){
                        if (cur == null) break;
                        cur = cur[part];
                      }
                      if (cur !== undefined && cur !== null && cur !== "") return cur;
                    }
                    return null;
                  }
                  function raw(g){ return g?.raw || g || {}; }
            
                  function dateKey(){
                    const input = document.getElementById("date")?.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(input || "")) return input;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(window.__cornerProAllGamesDate || "")) return window.__cornerProAllGamesDate;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(window.__cornerProSelectedDate || "")) return window.__cornerProSelectedDate;
                    return "";
                  }
            
                  function getGames(){
                    const panel = document.querySelector(".gamesPanel");
                    const sources = [
                      panel?.__cornerProAllGames,
                      window.__cornerProAllGames,
                      panel?.__cornerProGames,
                      window.__cornerProGames
                    ];
            
                    try{ if (Array.isArray(lastMarketGames) && lastMarketGames.length) sources.push(lastMarketGames); }catch(e){}
                    try{ if (Array.isArray(lastRawGames) && lastRawGames.length) sources.push(lastRawGames); }catch(e){}
            
                    const first = sources.find(x => Array.isArray(x) && x.length) || [];
                    const seen = new Set();
                    return first.filter(g => {
                      const r = raw(g);
                      const key = String(r.match_id || r.id || r.fixture_id || `${info(g).league}|${info(g).home}|${info(g).away}|${info(g).time}`).toLowerCase();
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                  }
            
                  function info(g){
                    const r = raw(g);
                    return {
                      home: clean(g?.home ?? r.casa ?? r.home ?? r.home_name ?? r.team_home ?? r.mandante ?? r.teams?.home?.name ?? "Casa"),
                      away: clean(g?.away ?? r.fora ?? r.away ?? r.away_name ?? r.team_away ?? r.visitante ?? r.teams?.away?.name ?? "Visitante"),
                      league: clean(g?.league ?? r.liga ?? r.league_name ?? r.competition ?? r.league?.name ?? "Liga"),
                      time: clean(g?.time ?? r.hora ?? r.time ?? r.match_time ?? r.horario ?? "--:--").slice(0,5)
                    };
                  }
            
                  function projectedCorners(g){
                    const r = raw(g);
                    const direct = num(g?.proj ?? r.proj_cantos ?? r.projected_corners ?? r.expected_corners ?? r.corners_projection ?? r.media_cantos_total);
                    if (direct !== null) return direct;
                    const p = num(r.over95_prob_adj ?? r.over95_prob ?? r.ai_score ?? r.score ?? g?.prob, 62);
                    return clamp(8.8 + (p - 55) / 10, 7.5, 13.8);
                  }
            
                  function expectedGoals(g){
                    const r = raw(g);
                    const direct = num(r.expected_goals_total ?? r.xg_total ?? r.total_goals_avg ?? r.media_gols_total ?? r.goals_projection);
                    if (direct !== null) return direct;
                    const corners = projectedCorners(g);
                    let base = 2.15 + (corners - 9.5) * 0.18;
                    const league = norm(info(g).league);
                    if (league.includes("eredivisie") || league.includes("bundesliga") || league.includes("premier") || league.includes("belgium") || league.includes("allsvenskan")) base += .20;
                    if (league.includes("serie a") || league.includes("ligue 1")) base -= .10;
                    return clamp(base, 1.1, 4.4);
                  }
            
                  function homeExpected(g){
                    const r = raw(g);
                    const direct = num(r.home_expected_goals ?? r.home_xg);
                    if (direct !== null) return direct;
                    return expectedGoals(g) * 0.53;
                  }
            
                  function awayExpected(g){
                    const r = raw(g);
                    const direct = num(r.away_expected_goals ?? r.away_xg);
                    if (direct !== null) return direct;
                    return expectedGoals(g) * 0.47;
                  }
            
                  function projectedCards(g){
                    const r = raw(g);
                    const direct = num(r.proj_cards ?? r.cards_projection ?? r.expected_cards_total ?? r.total_cards_avg ?? r.media_cartoes_total ?? r.cartoes_media);
                    if (direct !== null) return direct;
                    const league = norm(info(g).league);
                    let base = 3.55 + (projectedCorners(g) - 9.8) * .10;
                    if (league.includes("la liga") || league.includes("serie a") || league.includes("portugal") || league.includes("super lig")) base += .45;
                    if (league.includes("premier") || league.includes("bundesliga")) base -= .10;
                    return clamp(base, 2.1, 6.4);
                  }
            
                  function percentCorners(g, line = 9.5, ht = false){
                    const proj = projectedCorners(g) * (ht ? .46 : 1);
                    return clamp(Math.round(52 + (proj - line) * 15), 3, 94);
                  }
                  function percentGoals(g, line = 2.5, ht = false){
                    const eg = expectedGoals(g) * (ht ? .45 : 1);
                    return clamp(Math.round(52 + (eg - line) * 24), 3, 94);
                  }
                  function percentBtts(g){
                    const h = homeExpected(g);
                    const a = awayExpected(g);
                    const weaker = Math.min(h,a), stronger = Math.max(h,a);
                    return clamp(Math.round(42 + (weaker - .75) * 30 + (stronger - 1.15) * 8), 5, 82);
                  }
                  function percentCards(g, line = 3.5, ht = false){
                    const cards = projectedCards(g) * (ht ? .48 : 1);
                    return clamp(Math.round(52 + (cards - line) * 14), 3, 94);
                  }
            
                  function favoriteSide(g){
                    const r = raw(g);
                    const homeOdd = num(r.odds?.home ?? r.odds?.casa ?? r.home_odd ?? r.odd_home ?? r.odds_home);
                    const awayOdd = num(r.odds?.away ?? r.odds?.fora ?? r.away_odd ?? r.odd_away ?? r.odds_away);
                    const drawOdd = num(r.odds?.draw ?? r.odds?.empate ?? r.draw_odd ?? r.odd_draw);
                    if (homeOdd !== null && awayOdd !== null){
                      if (homeOdd + 0.12 < awayOdd && (drawOdd === null || homeOdd < drawOdd)) return "home";
                      if (awayOdd + 0.12 < homeOdd && (drawOdd === null || awayOdd < drawOdd)) return "away";
                    }
                    const scoreHome = num(r.home_win_prob ?? r.prob_home ?? r.casa_prob ?? r.home_prob);
                    const scoreAway = num(r.away_win_prob ?? r.prob_away ?? r.visitante_prob ?? r.away_prob);
                    if (scoreHome !== null && scoreAway !== null){
                      if (scoreHome >= scoreAway + 8) return "home";
                      if (scoreAway >= scoreHome + 8) return "away";
                    }
                    return "balanced";
                  }
            
                  function lineFromText(text){
                    const m = String(text || "").replace(",",".").match(/(\d+(?:\.\d+)?)/);
                    return m ? Number(m[1]) : null;
                  }
            
                  function ctxFromButton(btn){
                    const label = clean(btn.dataset.marketLine || btn.textContent || "");
                    const section = clean(btn.closest(".marketInlineSection")?.querySelector("h4")?.textContent || "");
                    const panelTitle = clean(btn.closest(".marketInlinePanel")?.querySelector(".marketInlineTitle strong")?.textContent || "");
                    const text = norm(`${panelTitle} ${section} ${label}`);
                    return { label, section, panelTitle, text, line: lineFromText(label) };
                  }
            
                  function passResult(g, text){
                    const fav = favoriteSide(g);
                    const eg = expectedGoals(g);
                    if (text.includes("casa vence")) return fav === "home" && homeExpected(g) >= awayExpected(g) + .18;
                    if (text.includes("visitante vence")) return fav === "away" && awayExpected(g) >= homeExpected(g) + .12;
                    if (text.includes("empate anula casa")) return homeExpected(g) >= awayExpected(g) - .05;
                    if (text.includes("empate anula visitante")) return awayExpected(g) >= homeExpected(g) - .05;
                    if (text.includes("dupla chance casa")) return homeExpected(g) >= awayExpected(g) - .30;
                    if (text.includes("dupla chance visitante")) return awayExpected(g) >= homeExpected(g) - .30;
                    if (text.includes("empate")) return Math.abs(homeExpected(g) - awayExpected(g)) <= .28 && eg <= 2.85;
                    return true;
                  }
            
                  function marketPercent(g, ctx){
                    const t = ctx.text;
                    const line = ctx.line;
            
                    if (t.includes("casa vence")) return clamp(Math.round(50 + (homeExpected(g) - awayExpected(g)) * 30), 5, 88);
                    if (t.includes("visitante vence")) return clamp(Math.round(50 + (awayExpected(g) - homeExpected(g)) * 30), 5, 88);
                    if (t.includes("empate")) return clamp(Math.round(62 - Math.abs(homeExpected(g) - awayExpected(g)) * 42), 5, 76);
                    if (t.includes("dupla chance casa")) return clamp(Math.round(64 + (homeExpected(g) - awayExpected(g)) * 20), 20, 92);
                    if (t.includes("dupla chance visitante")) return clamp(Math.round(64 + (awayExpected(g) - homeExpected(g)) * 20), 20, 92);
            
                    if (t.includes("ambas") || t.includes("btts")) return t.includes("nao") || t.includes("não") ? 100 - percentBtts(g) : percentBtts(g);
            
                    if (t.includes("cart")){
                      const l = line || (t.includes("vermelh") ? 5.5 : 3.5);
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      if (t.includes("under") || t.includes("sem cart")) return clamp(Math.round(56 + (l - projectedCards(g) * (ht ? .48 : 1)) * 15), 3, 94);
                      return percentCards(g, l, ht);
                    }
            
                    if (t.includes("escanteio") || t.includes("canto") || t.includes("cantos")){
                      const l = line || 9.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      if (t.includes("under")) return clamp(Math.round(56 + (l - projectedCorners(g) * (ht ? .46 : 1)) * 16), 3, 94);
                      return percentCorners(g, l, ht);
                    }
            
                    if (t.includes("gol") || t.includes("gols") || t.includes("over") || t.includes("under")){
                      const l = line || 2.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      if (t.includes("under") || t.includes("menos")) return clamp(Math.round(56 + (l - expectedGoals(g) * (ht ? .45 : 1)) * 24), 3, 94);
                      return percentGoals(g, l, ht);
                    }
            
                    if (t.includes("jogador") || t.includes("finalizacao") || t.includes("finalizações") || t.includes("chute") || t.includes("assistencia") || t.includes("assistência")){
                      return clamp(Math.round(48 + (projectedCorners(g) - 9.5) * 7 + (expectedGoals(g) - 2.2) * 9), 10, 82);
                    }
            
                    return clamp(Math.round(num(raw(g).ai_score ?? raw(g).score ?? raw(g).over95_prob_adj ?? raw(g).over95_prob, 58)), 8, 94);
                  }
            
                  function marketPass(g, ctx){
                    const t = ctx.text;
                    const p = marketPercent(g, ctx);
            
                    // Combinadas precisam passar em todas as pernas relevantes.
                    if (t.includes("+")){
                      if ((t.includes("casa") || t.includes("visitante") || t.includes("empate")) && !passResult(g, t)) return false;
                      if (t.includes("ambas") && percentBtts(g) < 50) return false;
                      if (t.includes("over") || t.includes("gol")){
                        const line = ctx.line || 1.5;
                        if (expectedGoals(g) < line - .05) return false;
                      }
                      if (t.includes("escanteio") || t.includes("canto")){
                        const line = ctx.line || 9.5;
                        if (projectedCorners(g) < line) return false;
                      }
                      return p >= 44;
                    }
            
                    if (t.includes("resultado") || t.includes("vence") || t.includes("empate") || t.includes("dupla")) return passResult(g, t);
                    if (t.includes("ambas") || t.includes("btts")) return t.includes("nao") || t.includes("não") ? p >= 50 : p >= 50;
            
                    if (t.includes("escanteio") || t.includes("canto") || t.includes("cantos")){
                      const line = ctx.line || 9.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      const proj = projectedCorners(g) * (ht ? .46 : 1);
                      if (t.includes("exato")) return Math.abs(proj - line) <= .6;
                      if (t.includes("under")) return proj <= line && p >= 46;
                      return proj >= line && p >= (line >= 12.5 ? 38 : line >= 11.5 ? 42 : line >= 10.5 ? 46 : 50);
                    }
            
                    if (t.includes("gol") || t.includes("gols") || t.includes("over") || t.includes("under")){
                      const line = ctx.line || 2.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      const proj = expectedGoals(g) * (ht ? .45 : 1);
                      if (t.includes("under") || t.includes("menos")) return proj <= line && p >= 46;
                      return proj >= line - .05 && p >= (line >= 3.5 ? 38 : line >= 2.5 ? 45 : 50);
                    }
            
                    if (t.includes("cart")){
                      const line = ctx.line || 3.5;
                      const ht = t.includes(" ht") || t.includes("1 tempo") || t.includes("1º tempo") || t.includes("1o tempo");
                      const proj = projectedCards(g) * (ht ? .48 : 1);
                      if (t.includes("under") || t.includes("sem cart")) return proj <= line && p >= 44;
                      if (t.includes("vermelh")) return projectedCards(g) >= 4.4;
                      return proj >= line && p >= (line >= 5.5 ? 34 : line >= 4.5 ? 38 : 44);
                    }
            
                    if (t.includes("player") || t.includes("jogador") || t.includes("finalizacao") || t.includes("finalizações") || t.includes("chute") || t.includes("assistencia") || t.includes("assistência")){
                      return p >= 48;
                    }
            
                    return p >= 50;
                  }
            
                  function rowHTML(g, ctx, index){
                    const d = info(g);
                    const pct = Math.round(marketPercent(g, ctx));
                    return `
                      <div class="gameRow compactGameRow" data-strict-market-row="1" data-game-index="${index}">
                        <div class="gameMeta">
                          <small>${esc(d.league)}</small>
                          <b><span>${esc(d.time || "--:--")}</span> ${esc(d.home)}<br><em>${esc(d.away)}</em></b>
                        </div>
                        <div class="oddBox"><small>MERCADO</small><b>${esc(ctx.label)}</b><span>${pct ? `${pct}%` : "—"}</span></div>
                        <div class="oddBox"><small>ESCANTEIOS</small><b>PROJ. ${projectedCorners(g).toFixed(1)}</b><span>${percentCorners(g, 9.5)}%</span></div>
                        <div class="oddBox"><small>GOLS</small><b>EXP. ${expectedGoals(g).toFixed(1)}</b><span>${percentGoals(g, 2.5)}%</span></div>
                        <div class="oddBox"><small>CARTÕES</small><b>PROJ. ${projectedCards(g).toFixed(1)}</b><span>${percentCards(g, 3.5)}%</span></div>
                        <button class="signal" type="button">▮▮▮</button>
                      </div>
                    `;
                  }
            
                  function renderFiltered(ctx){
                    const panel = document.querySelector(".gamesPanel");
                    if (!panel) return;
            
                    const games = getGames();
                    const title = panel.querySelector(".sectionHead h2");
                    if (title) title.textContent = `Jogos — ${ctx.label}`;
            
                    panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
            
                    if (!games.length){
                      panel.insertAdjacentHTML("beforeend", `<div class="marketStrictEmpty">Nenhum jogo carregado para esta data.</div><button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
                      return;
                    }
            
                    const filtered = games
                      .map((g,i) => ({g,i}))
                      .filter(x => marketPass(x.g, ctx))
                      .sort((a,b) => marketPercent(b.g, ctx) - marketPercent(a.g, ctx))
                      .slice(0, 18);
            
                    if (!filtered.length){
                      panel.insertAdjacentHTML("beforeend", `<div class="marketStrictEmpty">Nenhum jogo consistente para <b>${esc(ctx.label)}</b> nesta data.</div><button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
                      return;
                    }
            
                    panel.insertAdjacentHTML("beforeend", filtered.map(x => rowHTML(x.g, ctx, x.i)).join("") + `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
            
                    panel.querySelectorAll("[data-strict-market-row]").forEach(row => {
                      row.addEventListener("click", () => {
                        const idx = Number(row.dataset.gameIndex);
                        const g = games[idx];
                        if (!g) return;
                        const d = info(g);
                        const r = raw(g);
                        const gameForRail = { ...r, casa:d.home, fora:d.away, liga:d.league, hora:d.time, match_id:r.match_id || r.id };
                        if (typeof window.updateDesktopMatchRail === "function") window.updateDesktopMatchRail(gameForRail, games.map(raw));
                      });
                    });
                  }
            
                  function restoreAll(){
                    const panel = document.querySelector(".gamesPanel");
                    const games = getGames();
                    if (!panel || !games.length) return;
            
                    const title = panel.querySelector(".sectionHead h2");
                    if (title) title.textContent = "Jogos em Destaque";
            
                    if (typeof window.renderGames === "function"){
                      try{ window.renderGames(games); return; }catch(e){}
                    }
            
                    panel.querySelectorAll(".gameRow,.cornerProStatus,.marketStrictEmpty,.viewAll").forEach(el => el.remove());
                    const ctx = { label:"Todos", text:"todos", line:null };
                    panel.insertAdjacentHTML("beforeend", games.slice(0,9).map((g,i)=>rowHTML(g,ctx,i)).join("") + `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`);
                  }
            
                  function markInlineButtons(){
                    $$(".marketInlineItem").forEach(btn => {
                      if (btn.dataset.strictReady === "1") return;
                      const ctx = ctxFromButton(btn);
                      btn.dataset.strictReady = "1";
                      btn.dataset.marketFilter = norm(`${ctx.panelTitle} ${ctx.section} ${ctx.label}`);
                    });
                  }
            
                  document.addEventListener("click", function(ev){
                    const btn = ev.target.closest?.(".marketInlineItem");
                    if (!btn) return;
            
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
            
                    markInlineButtons();
                    $$(".marketInlineItem.is-selected").forEach(el => el.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
            
                    renderFiltered(ctxFromButton(btn));
                  }, true);
            
                  document.addEventListener("click", function(ev){
                    const btn = ev.target.closest?.(".viewAll,.marketInlineAll");
                    if (!btn) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
                    $$(".marketInlineItem.is-selected").forEach(el => el.classList.remove("is-selected"));
                    restoreAll();
                  }, true);
            
                  document.addEventListener("DOMContentLoaded", markInlineButtons);
                  new MutationObserver(markInlineButtons).observe(document.documentElement, { childList:true, subtree:true });
            
                  window.cornerProFilterInlineMarket = function(label){
                    renderFiltered({ label: clean(label), section:"", panelTitle:"", text:norm(label), line:lineFromText(label) });
                  };
                })();
            
            
                /* =========================================================
                   FILTRO REAL DOS MERCADOS PRÉ-JOGO — RESULTADO
                   - Corrige a lista repetir a mesma sequência em todos os mercados
                   - Usa os dados reais que já vieram do servidor em cada jogo:
                     positions, markets.prob, markets.expected, real.homeRecent/awayRecent,
                     gols recentes, pressão, projeção e forma.
                   - Não usa as odds fixas do painel para decidir o filtro.
                   - Não recarrega API ao clicar no mercado.
                   ========================================================= */
                (function installResultadoRealMercadoDefinitivo(){
                  if (window.__resultadoRealMercadoDefinitivoInstalled) return;
                  window.__resultadoRealMercadoDefinitivoInstalled = true;
            
                  const $ = (sel, root=document) => root.querySelector(sel);
                  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
            
                  function clean(v, fallback=""){
                    const s = String(v ?? "").trim();
                    return s || fallback;
                  }
            
                  function norm(v){
                    return clean(v).toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                  }
            
                  function num(v, fallback=null){
                    if (v === undefined || v === null || v === "") return fallback;
                    if (typeof v === "string") v = v.replace(",", ".").replace(/[^0-9.\-]/g, "");
                    const n = Number(v);
                    return Number.isFinite(n) ? n : fallback;
                  }
            
                  function clamp(n, a, b){
                    n = Number(n);
                    if (!Number.isFinite(n)) n = 0;
                    return Math.max(a, Math.min(b, n));
                  }
            
                  function esc(v){
                    return String(v ?? "")
                      .replaceAll("&", "&amp;")
                      .replaceAll("<", "&lt;")
                      .replaceAll(">", "&gt;")
                      .replaceAll('"', "&quot;")
                      .replaceAll("'", "&#039;");
                  }
            
                  function getPath(obj, path){
                    const parts = String(path || "").split(".");
                    let cur = obj;
                    for (const p of parts){
                      if (cur == null) return null;
                      cur = cur[p];
                    }
                    return cur ?? null;
                  }
            
                  function first(obj, paths, fallback=null){
                    for (const p of paths){
                      const v = getPath(obj, p);
                      if (v !== undefined && v !== null && v !== "") return v;
                    }
                    return fallback;
                  }
            
                  function selectedDate(){
                    const input = document.getElementById("date");
                    if (input?.value && /^\d{4}-\d{2}-\d{2}$/.test(input.value)) return input.value;
                    if (window.__cornerProAllGamesDate && /^\d{4}-\d{2}-\d{2}$/.test(window.__cornerProAllGamesDate)) return window.__cornerProAllGamesDate;
                    return "";
                  }
            
                  function raw(g){ return g?.raw || g || {}; }
            
                  function gameInfo(g){
                    const r = raw(g);
                    return {
                      league: clean(g?.league ?? r.liga ?? r.league_name ?? r.league?.name ?? r.competition ?? r.competition_name ?? "Liga"),
                      time: clean(g?.time ?? r.hora ?? r.time ?? r.match_time ?? r.event_time ?? r.fixture?.time ?? "--:--").slice(0,5),
                      home: clean(g?.home ?? r.casa ?? r.home ?? r.home_name ?? r.team_home ?? r.mandante ?? r.teams?.home?.name ?? "Casa"),
                      away: clean(g?.away ?? r.fora ?? r.away ?? r.away_name ?? r.team_away ?? r.visitante ?? r.teams?.away?.name ?? "Visitante"),
                      id: clean(g?.matchId ?? r.match_id ?? r.id ?? r.fixture_id ?? r.event_id ?? "")
                    };
                  }
            
                  function stableKey(g){
                    const d = gameInfo(g);
                    return d.id ? `id:${d.id}` : `${norm(d.league)}|${norm(d.home)}|${norm(d.away)}|${d.time}`;
                  }
            
                  function readInlineRowsAsGames(panel){
                    return $$(".gameRow", panel).map(row => {
                      const b = row.querySelector(".gameMeta b");
                      const full = clean(b?.textContent || "");
                      const time = clean(row.querySelector(".gameMeta span")?.textContent || "--:--");
                      const away = clean(row.querySelector(".gameMeta em")?.textContent || "Visitante");
                      let home = full.replace(time, "").replace(away, "").trim();
                      if (!home) home = clean(full.split("\n")[0] || "Casa");
                      return {
                        liga: clean(row.querySelector(".gameMeta small, small")?.textContent || "Liga"),
                        hora: time,
                        casa: home,
                        fora: away
                      };
                    });
                  }
            
                  function currentGames(){
                    const panel = document.querySelector(".gamesPanel");
                    const wantedDate = selectedDate();
            
                    const sources = [];
            
                    // Primeiro usa /mercados, pois é a lista mais ampla e já traz
                    // bet365_corner_line para o filtro sincronizado.
                    try {
                      if (
                        typeof lastMarketGames !== "undefined" &&
                        Array.isArray(lastMarketGames) &&
                        lastMarketGames.length &&
                        (!wantedDate || !lastMarketDateYMD || lastMarketDateYMD === wantedDate)
                      ){
                        sources.push(lastMarketGames);
                      }
                    } catch (_) {}
            
                    if (wantedDate && window.__cornerProMarketCache?.[wantedDate]?.length){
                      sources.push(window.__cornerProMarketCache[wantedDate]);
                    }
            
                    sources.push(
                      panel?.__cornerProAllGames,
                      window.__cornerProAllGames,
                      panel?.__cornerProGames,
                      window.__cornerProGames
                    );
            
                    try {
                      if (typeof lastRawGames !== "undefined" && Array.isArray(lastRawGames) && lastRawGames.length){
                        sources.push(lastRawGames);
                      }
                    } catch (_) {}
            
                    let firstValidList = [];
            
                    for (const source of sources){
                      if (!Array.isArray(source) || !source.length) continue;
            
                      const unique = [];
                      const used = new Set();
            
                      for (const game of source){
                        if (!game) continue;
                        const key = stableKey(game);
                        if (!key || used.has(key)) continue;
                        used.add(key);
                        unique.push(game);
                      }
            
                      if (!firstValidList.length) firstValidList = unique;
            
                      // Para sincronização real, prefere uma fonte que tenha pelo menos
                      // uma linha principal Bet365 disponível.
                      if (unique.some(game => Number.isFinite(bet365Line(game)))){
                        return unique;
                      }
                    }
            
                    return firstValidList;
                  }
            
                  function projection(game){
                    const raw = rawGame(game);
                    return number(
                      raw?.proj_cantos ??
                      raw?.projected_corners ??
                      raw?.corners_projection ??
                      raw?.markets?.expected?.corners ??
                      raw?.markets?.expectedCorners,
                      0
                    );
                  }
            
                  function bet365Line(game){
                    const raw = rawGame(game);
                    return number(
                      raw?.bet365_corner_line ??
                      raw?.bet365CornerLine ??
                      raw?.odds?.bet365_corner_line ??
                      raw?.odds?.bet365_corners?.line ??
                      raw?.markets?.bet365_corner_line ??
                      raw?.markets?.main_corner_line ??
                      raw?.main_corner_line,
                      null
                    );
                  }
            
                  function serverProbability(game, line){
                    const raw = rawGame(game);
                    const key = line === 8.5 ? "corners85"
                      : line === 9.5 ? "corners95"
                      : line === 10.5 ? "corners105"
                      : line === 11.5 ? "corners115"
                      : "corners125";
            
                    const direct = number(
                      raw?.markets?.prob?.[key] ??
                      raw?.markets?.filterProb?.[key] ??
                      raw?.[`${key}_prob`] ??
                      raw?.[`${key}_filter_prob`],
                      null
                    );
            
                    if (Number.isFinite(direct)){
                      return direct > 0 && direct <= 1 ? direct * 100 : direct;
                    }
            
                    if (line === 9.5){
                      const p95 = number(raw?.over95_prob_adj ?? raw?.over95_prob, null);
                      if (Number.isFinite(p95)) return p95;
                    }
            
                    return null;
                  }
            
                  function estimatedProbability(game, line){
                    const direct = serverProbability(game, line);
                    if (Number.isFinite(direct)) return clamp(Math.round(direct), 3, 96);
            
                    const proj = projection(game);
                    if (!Number.isFinite(proj) || proj <= 0) return 0;
            
                    // Curva conservadora: a projeção precisa ficar acima da linha
                    // para ganhar confiança. Linhas maiores exigem mais folga.
                    let probability = 50 + (proj - line) * 11;
            
                    if (line >= 12.5) probability -= 7;
                    else if (line >= 11.5) probability -= 4;
                    else if (line <= 8.5) probability += 5;
            
                    const raw = rawGame(game);
                    const pressure = number(raw?.real?.pressureHits ?? raw?.pressureHits, 0);
                    const profile = clean(raw?.perfil_laterais);
            
                    if (pressure >= 4) probability += 4;
                    else if (pressure >= 3) probability += 2;
            
                    if (profile === "LATERAIS_FORTES") probability += 4;
                    if (profile === "TENDENCIA_CENTRAL") probability -= 6;
            
                    return clamp(Math.round(probability), 3, 94);
                  }
            
                  function lineFitScore(game, line){
                    const proj = projection(game);
                    const marketLine = bet365Line(game);
                    const probability = estimatedProbability(game, line);
                    const raw = rawGame(game);
                    const engineScore = number(
                      raw?.ai_score ??
                      raw?.local_score ??
                      raw?.score_adj ??
                      raw?.score,
                      0
                    );
            
                    let score = probability * 1.15;
            
                    // A linha real/principal da Bet365 é o primeiro sinal.
                    if (Number.isFinite(marketLine)){
                      if (marketLine === line) score += 48;
                      else if (marketLine > line) score += Math.max(12, 38 - (marketLine - line) * 12);
                      else score -= (line - marketLine) * 28;
                    }
            
                    // Proximidade entre projeção e linha escolhida.
                    if (Number.isFinite(proj) && proj > 0){
                      const ideal = line + 0.65;
                      score += Math.max(0, 22 - Math.abs(proj - ideal) * 9);
            
                      if (proj < line + 0.15) score -= (line + 0.15 - proj) * 24;
                    }
            
                    score += clamp(engineScore, 0, 100) * 0.12;
                    return score;
                  }
            
                  function passesLine(game, line){
                    const marketLine = bet365Line(game);
            
                    // SINCRONIZAÇÃO EXATA:
                    // clicou em 9.5  -> somente linha principal Bet365 9.5;
                    // clicou em 10.5 -> somente linha principal Bet365 10.5;
                    // jogos sem linha real Bet365 não entram.
                    if (!Number.isFinite(marketLine)) return false;
            
                    return Math.abs(marketLine - line) < 0.01;
                  }
            
                  function selectedGames(games, line){
                    const prepared = games.map((game, index) => ({
                      game,
                      index,
                      probability: estimatedProbability(game, line),
                      projection: projection(game),
                      bet365: bet365Line(game),
                      score: lineFitScore(game, line),
                      pass: passesLine(game, line)
                    }));
            
                    let filtered = prepared.filter(item => item.pass);
            
                    // Não força jogos fracos. Se nenhum passar, a lista ficará vazia
                    // e o usuário verá a mensagem de ausência de opção consistente.
                    return filtered
                      .sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        if ((b.bet365 ?? -1) !== (a.bet365 ?? -1)) return (b.bet365 ?? -1) - (a.bet365 ?? -1);
                        if (b.probability !== a.probability) return b.probability - a.probability;
                        return b.projection - a.projection;
                      })
                      .slice(0, 18);
                  }
            
                  function rowHTML(item, line){
                    const info = gameInfo(item.game);
                    const betText = Number.isFinite(item.bet365)
                      ? `BET365 ${item.bet365.toFixed(1)}`
                      : `PROJ. ${item.projection.toFixed(1)}`;
            
                    return `
                      <div class="gameRow compactGameRow"
                           data-corner-line-row="1"
                           data-game-index="${item.index}"
                           data-corner-line="${line}">
                        <div class="gameMeta">
                          <small>${escapeHTML(info.league)}</small>
                          <b>
                            <span>${escapeHTML(info.time || "--:--")}</span>
                            ${escapeHTML(info.home)}
                            <br>
                            <em>${escapeHTML(info.away)}</em>
                          </b>
                        </div>
            
                        <div class="oddBox">
                          <small>LINHA</small>
                          <b>OVER ${line.toFixed(1)}</b>
                          <span>${item.probability}%</span>
                        </div>
            
                        <div class="oddBox">
                          <small>REFERÊNCIA</small>
                          <b>${escapeHTML(betText)}</b>
                          <span>${item.projection.toFixed(1)}</span>
                        </div>
            
                        <button class="signal" type="button" title="Abrir Match Center">▮▮▮</button>
                      </div>
                    `;
                  }
            
                  function updateMatchCenter(game, allGames){
                    if (!game) return;
            
                    const info = gameInfo(game);
                    const raw = rawGame(game);
                    const payload = {
                      ...raw,
                      casa: info.home,
                      fora: info.away,
                      liga: info.league,
                      hora: info.time,
                      match_id: raw?.match_id || raw?.id || info.id
                    };
            
                    if (typeof window.updateDesktopMatchRail === "function"){
                      window.updateDesktopMatchRail(payload, allGames.map(rawGame));
                      return;
                    }
            
                    if (typeof window.openMatchCenter === "function"){
                      window.openMatchCenter(payload);
                    }
                  }
            
                  function render(line){
                    const panel = document.querySelector(".gamesPanel");
                    if (!panel) return;
            
                    const games = currentGames();
                    const heading = panel.querySelector(".sectionHead h2, .sectionHead h3, h2");
                    if (heading) heading.textContent = `Jogos — Bet365 ${line.toFixed(1)}`;
            
                    panel.querySelectorAll(
                      ".gameRow,.compactGameRow,.cornerProStatus,.marketStrictEmpty,.viewAll"
                    ).forEach(element => element.remove());
            
                    if (!games.length){
                      panel.insertAdjacentHTML(
                        "beforeend",
                        `<div class="marketStrictEmpty">Nenhum jogo carregado para esta data.</div>
                         <button class="viewAll" type="button">VER TODOS OS JOGOS</button>`
                      );
                      return;
                    }
            
                    const selected = selectedGames(games, line);
            
                    if (!selected.length){
                      panel.insertAdjacentHTML(
                        "beforeend",
                        `<div class="marketStrictEmpty">
                           Nenhum jogo com linha principal Bet365 em <b>${line.toFixed(1)}</b> nesta data.
                         </div>
                         <button class="viewAll" type="button">VER TODOS OS JOGOS</button>`
                      );
                      return;
                    }
            
                    panel.insertAdjacentHTML(
                      "beforeend",
                      selected.map(item => rowHTML(item, line)).join("") +
                      `<button class="viewAll" type="button">VER TODOS OS JOGOS</button>`
                    );
            
                    panel.querySelectorAll("[data-corner-line-row]").forEach(row => {
                      row.addEventListener("click", event => {
                        if (event.target.closest(".viewAll")) return;
                        const originalIndex = Number(row.dataset.gameIndex);
                        updateMatchCenter(games[originalIndex], games);
                      });
                    });
            
                    window.__cornerProSelectedCornerLine = line;
                  }
            
                  function restoreGames(){
                    const games = currentGames();
                    const panel = document.querySelector(".gamesPanel");
                    if (!panel || !games.length) return;
            
                    if (typeof window.renderGames === "function"){
                      try {
                        window.renderGames(games);
                        return;
                      } catch (_) {}
                    }
            
                    location.reload();
                  }
            
                  function getClickedCornerLine(button){
                    if (!button) return null;
            
                    const label = clean(
                      button.dataset.marketLine ||
                      button.dataset.premiumMarket ||
                      button.dataset.market ||
                      button.textContent
                    );
            
                    const match = label.match(/\bover\s*(8\.5|9\.5|10\.5|11\.5|12\.5)\b/i);
                    if (!match) return null;
            
                    const line = Number(match[1]);
                    if (!CORNER_LINES.has(line)) return null;
            
                    const sectionText = norm(
                      button.closest(".marketInlineSection,article,.marketCard")
                        ?.querySelector("h4,h3,strong,b")
                        ?.textContent
                    );
            
                    const panelText = norm(
                      button.closest(".marketInlinePanel,.marketMenuPro,.gamesPanel,.dashboardMainColumn")
                        ?.querySelector(".marketInlineTitle strong,.marketMenuTitle,h2,h3")
                        ?.textContent
                    );
            
                    // Só captura a primeira seção "Totais de Escanteios".
                    // Não interfere em Over 9.5 FT, Over 4.5 HT ou mercados de gols.
                    const isCornerPanel = panelText.includes("escante");
                    const isTotalsSection = sectionText.includes("totais") && sectionText.includes("escante");
            
                    return isCornerPanel && isTotalsSection ? line : null;
                  }
            
                  // Usa WINDOW em captura para executar antes dos handlers antigos do documento.
                  window.addEventListener("click", event => {
                    const button = event.target.closest?.(
                      ".marketInlineItem,[data-market-line],[data-premium-market],[data-market],.premiumMarket"
                    );
                    if (!button) return;
            
                    const line = getClickedCornerLine(button);
                    if (!Number.isFinite(line)) return;
            
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
            
                    document.querySelectorAll(
                      ".marketInlineItem.is-selected,[data-market-line].is-selected,[data-premium-market].is-selected,.premiumMarket.is-selected"
                    ).forEach(element => element.classList.remove("is-selected"));
            
                    button.classList.add("is-selected");
                    render(line);
                  }, true);
            
                  window.addEventListener("click", event => {
                    const button = event.target.closest?.(".gamesPanel .viewAll");
                    if (!button || !window.__cornerProSelectedCornerLine) return;
            
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
            
                    window.__cornerProSelectedCornerLine = null;
                    document.querySelectorAll(".marketInlineItem.is-selected").forEach(
                      element => element.classList.remove("is-selected")
                    );
                    restoreGames();
                  }, true);
            
                  window.cornerProShowGamesForCornerLine = function(line){
                    const parsed = Number(line);
                    if (!CORNER_LINES.has(parsed)) return false;
                    render(parsed);
                    return true;
                  };
                })();
            
                /* REMOÇÃO TOTAL DE BORDAS — proteção contra estilos criados dinamicamente */
                (function enforceBorderlessCornerPro(){
                  if (document.getElementById('cornerProBorderlessFinal')) return;
                  const style = document.createElement('style');
                  style.id = 'cornerProBorderlessFinal';
                  style.textContent = `
                    body.dashboard *,body.dashboard *::before,body.dashboard *::after{
                      border-color:transparent!important;
                      outline:0!important;
                    }
                    body.dashboard .gameRow,
                    body.dashboard .compactGameRow,
                    body.dashboard .marketInlineItem,
                    body.dashboard .marketRow,
                    body.dashboard .marketMenuItem,
                    body.dashboard .railEventRow,
                    body.dashboard .cornerProStatus{
                      border:0!important;
                    }
                    body.dashboard .heroPanel,
                    body.dashboard .marketTab,
                    body.dashboard .gamesPanel,
                    body.dashboard .marketInlinePanel,
                    body.dashboard .marketInlineSection,
                    body.dashboard .marketGroup,
                    body.dashboard .marketCard,
                    body.dashboard .sideGamesCard,
                    body.dashboard .sideGameItem,
                    body.dashboard .sideGameCard,
                    body.dashboard .dashboardRightRail .railCard,
                    body.dashboard .railEmptyStatBox,
                    body.dashboard .railEmptyEventIcons span,
                    body.dashboard .railEmptyReadBox,
                    body.dashboard .bottomStrip,
                    body.dashboard .proBox{
                      box-shadow:none!important;
                    }
                    body.dashboard .radarRing{border:0!important;opacity:.22!important;}
                  `;
                  document.head.appendChild(style);
                })();
            
                /* =========================================================
            
             CARD PRINCIPAL — ESTADOS + DADOS REAIS DO MATCH CENTER V21
             - 20 minutos antes: "A PARTIDA JÁ VAI COMEÇAR"
             - Ao vivo: minuto e placar
             - Intervalo
             - Encerrado
             - Gols, escanteios e cartões
             - Atualiza o card original e os dois clones do carrossel
             ========================================================= */
          (() => {
            "use strict";
          
            if (window.__cpHomeBestStateControllerV21) return;
            window.__cpHomeBestStateControllerV21 = true;
          
            const CARD_SELECTOR = "#cpHomeBest,.cpHomeBestClone";
            const POLL_MS = 15000;
            const CACHE_MAX_AGE_MS = 25000;
          
            const liveCache = new Map();
            const pendingRequests = new Map();
          
            function clean(value) {
              return String(value ?? "").trim().toLowerCase();
            }
          
            function finiteNumber(...values) {
              for (const value of values) {
                if (value === null || value === undefined || value === "") continue;
                const n = Number(String(value).replace("%", "").replace(",", "."));
                if (Number.isFinite(n)) return n;
              }
              return 0;
            }
          
            function nullableNumber(...values) {
              for (const value of values) {
                if (value === null || value === undefined || value === "") continue;
                const n = Number(String(value).replace("%", "").replace(",", "."));
                if (Number.isFinite(n)) return n;
              }
              return null;
            }
          
            function field(card, id) {
              if (!card) return null;
              return card.id === "cpHomeBest"
                ? card.querySelector(`#${id}`)
                : card.querySelector(`[data-clone-id="${id}"]`);
            }
          
            function setText(card, id, value) {
              const element = field(card, id);
              if (element) element.textContent = String(value ?? "");
            }
          
            function matchIdFrom(raw = {}, normalized = {}) {
              return String(
                raw?.match_id ??
                raw?.event_id ??
                raw?.event_key ??
                raw?.fixture_id ??
                raw?.id ??
                raw?.event_raw?.match_id ??
                raw?.event_raw?.event_id ??
                raw?.event_raw?.event_key ??
                raw?.event_raw?.fixture_id ??
                raw?.event_raw?.id ??
                normalized?.match_id ??
                normalized?.event_id ??
                normalized?.fixture_id ??
                (/^\d+$/.test(String(normalized?.id || "")) ? normalized.id : "") ??
                ""
              ).trim();
            }
          
            function statusText(raw) {
              return clean(
                raw?.status ??
                raw?.status_raw ??
                raw?.match_status ??
                raw?.event_status ??
                raw?.status_long ??
                raw?.original_raw ??
                raw?.event_raw?.match_status
              );
            }
          
            function minuteValue(raw) {
              const values = [
                raw?.minute,
                raw?.elapsed,
                raw?.match_minute,
                raw?.event_minute,
                raw?.time_elapsed,
                raw?.match_live,
                raw?.status,
                raw?.status_raw,
                raw?.match_status,
                raw?.event_raw?.match_status
              ];
          
              for (const value of values) {
                const match = String(value ?? "").match(/\b(\d{1,3})(?:\+(\d{1,2}))?\b/);
                if (!match) continue;
          
                const base = Number(match[1]);
                const extra = Number(match[2] || 0);
          
                if (Number.isFinite(base) && base >= 0 && base <= 130) {
                  return { base, extra };
                }
              }
              return null;
            }
          
            function minuteLabel(raw) {
              const minute = minuteValue(raw);
              if (!minute) return "";
              return minute.extra ? `${minute.base}+${minute.extra}'` : `${minute.base}'`;
            }
          
            function isHalfTime(raw) {
              const status = statusText(raw);
              return [
                "half time", "halftime", "half-time", "intervalo",
                "interval", "break", "ht"
              ].some(label => status === label || status.includes(label));
            }
          
            function isFinished(raw) {
              if (raw?.finished === true) return true;
              const status = statusText(raw);
              return [
                "finished", "match finished", "full time", "full-time",
                "fulltime", "encerrado", "finalizado", "resultado final",
                "ended", "after penalties", "after extra time", "ft"
              ].some(label => status === label || status.includes(label));
            }
          
            function isLive(raw) {
              if (isFinished(raw)) return false;
              if (raw?.live === true) return true;
          
              const status = statusText(raw);
              const explicit = [
                "live", "ao vivo", "1st half", "first half",
                "2nd half", "second half", "in play", "in-play",
                "in progress", "playing", "intervalo", "half time",
                "halftime", "half-time"
              ].some(label => status.includes(label));
          
              return explicit || Boolean(minuteValue(raw));
            }
          
            function pairValue(raw, key, side) {
              return nullableNumber(raw?.[key]?.[side]);
            }
          
            function score(raw, side) {
              return finiteNumber(
                side === "home" ? raw?.home_score : raw?.away_score,
                side === "home" ? raw?.score_home : raw?.score_away,
                side === "home" ? raw?.match_hometeam_score : raw?.match_awayteam_score,
                side === "home" ? raw?.goals_home : raw?.goals_away,
                pairValue(raw, "score", side),
                pairValue(raw, "goals", side),
                side === "home"
                  ? raw?.event_raw?.match_hometeam_score
                  : raw?.event_raw?.match_awayteam_score
              );
            }
          
            function corners(raw, side) {
              return finiteNumber(
                side === "home" ? raw?.home_corners : raw?.away_corners,
                side === "home" ? raw?.corners_home : raw?.corners_away,
                side === "home" ? raw?.match_hometeam_corner : raw?.match_awayteam_corner,
                side === "home" ? raw?.match_hometeam_corners : raw?.match_awayteam_corners,
                pairValue(raw, "corners", side),
                raw?.statistics?.[side]?.corners
              );
            }
          
            function cards(raw, side) {
              const yellow = nullableNumber(
                side === "home" ? raw?.home_yellow_cards : raw?.away_yellow_cards,
                side === "home" ? raw?.yellow_cards_home : raw?.yellow_cards_away,
                raw?.yellow_cards?.[side],
                raw?.cards?.[side === "home" ? "yellow_home" : "yellow_away"],
                raw?.statistics?.[side]?.yellow_cards
              );
          
              const red = nullableNumber(
                side === "home" ? raw?.home_red_cards : raw?.away_red_cards,
                side === "home" ? raw?.red_cards_home : raw?.red_cards_away,
                raw?.red_cards?.[side],
                raw?.cards?.[side === "home" ? "red_home" : "red_away"],
                raw?.statistics?.[side]?.red_cards
              );
          
              if (yellow !== null || red !== null) {
                return (yellow || 0) + (red || 0);
              }
          
              return finiteNumber(
                side === "home" ? raw?.home_cards : raw?.away_cards,
                side === "home" ? raw?.cards_home : raw?.cards_away,
                pairValue(raw, "cards", side),
                raw?.statistics?.[side]?.cards
              );
            }
          
            function kickoffFromCard(card) {
              const raw = card?.__cpCurrentRaw || {};
              const normalized = card?.__cpCurrentNormalized || {};
          
              for (const value of [
                raw?.kickoff,
                raw?.date_time,
                raw?.match_datetime,
                raw?.event_date_time,
                raw?.event_raw?.match_date_time
              ]) {
                if (!value) continue;
                const date = new Date(value);
                if (!Number.isNaN(date.getTime())) return date;
              }
          
              const dateText =
                normalized?.date ??
                raw?.match_date ??
                raw?.event_date ??
                raw?.date ??
                raw?.event_raw?.match_date ??
                raw?.event_raw?.event_date ??
                raw?.event_raw?.date ??
                "";
          
              const timeText =
                normalized?.time ??
                raw?.hora_manaus ??
                raw?.match_time ??
                raw?.time ??
                raw?.event_raw?.match_time ??
                raw?.event_raw?.event_time ??
                raw?.event_raw?.time ??
                field(card, "cpHomeBestTime")?.textContent ??
                "";
          
              const timeMatch = String(timeText).match(/(\d{1,2}):(\d{2})/);
              if (!timeMatch) return null;
          
              let resolvedDate = String(dateText || "").trim();
          
              if (!resolvedDate) {
                try {
                  const parts = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Manaus",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                  }).formatToParts(new Date());
          
                  const map = Object.fromEntries(
                    parts.map(part => [part.type, part.value])
                  );
          
                  resolvedDate = `${map.year}-${map.month}-${map.day}`;
                } catch {
                  resolvedDate = new Date(Date.now() - 4 * 3600000)
                    .toISOString()
                    .slice(0, 10);
                }
              }
          
              const date = new Date(
                `${resolvedDate}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00-04:00`
              );
          
              return Number.isNaN(date.getTime()) ? null : date;
            }
          
            function minutesUntilKickoff(card) {
              const kickoff = kickoffFromCard(card);
              if (!kickoff) return null;
              return Math.ceil((kickoff.getTime() - Date.now()) / 60000);
            }
          
            function ensureStatus(card) {
              let bar = field(card, "cpHomeBestStatusBar");
              if (bar) return bar;
          
              bar = document.createElement("div");
              bar.className = "cpHomeBestStatusBar";
              bar.hidden = true;
          
              if (card.id === "cpHomeBest") {
                bar.id = "cpHomeBestStatusBar";
                bar.innerHTML = `
                  <i aria-hidden="true"></i>
                  <b id="cpHomeBestStatusText"></b>
                  <span id="cpHomeBestStatusExtra"></span>
                `;
              } else {
                bar.dataset.cloneId = "cpHomeBestStatusBar";
                bar.innerHTML = `
                  <i aria-hidden="true"></i>
                  <b data-clone-id="cpHomeBestStatusText"></b>
                  <span data-clone-id="cpHomeBestStatusExtra"></span>
                `;
              }
          
              card.querySelector(".cpHomeBestBody")
                ?.insertAdjacentElement("beforebegin", bar);
          
              return bar;
            }
          
            function setStatus(card, type, text, extra = "") {
              const bar = ensureStatus(card);
              bar.hidden = false;
              bar.className = `cpHomeBestStatusBar is-${type}`;
              setText(card, "cpHomeBestStatusText", text);
              setText(card, "cpHomeBestStatusExtra", extra);
            }
          
            function clearStatus(card) {
              const bar = ensureStatus(card);
              bar.hidden = true;
            }
          
            function visibleCard() {
              const viewport = document.querySelector(".cpHomeSwipeViewport");
              const cardsList = [...document.querySelectorAll(CARD_SELECTOR)];
          
              if (!viewport || cardsList.length < 2) return cardsList[0] || null;
          
              const viewportRect = viewport.getBoundingClientRect();
              const center = viewportRect.left + viewportRect.width / 2;
          
              return cardsList.reduce((best, card) => {
                const rect = card.getBoundingClientRect();
                const distance = Math.abs((rect.left + rect.width / 2) - center);
                return !best || distance < best.distance
                  ? { card, distance }
                  : best;
              }, null)?.card || cardsList[0];
            }
          
            function updateViewport(activeCard) {
              const viewport = document.querySelector(".cpHomeSwipeViewport");
              if (!viewport || !activeCard) return;
          
              viewport.classList.toggle(
                "is-soon",
                activeCard.classList.contains("is-match-soon")
              );
              viewport.classList.toggle(
                "is-live",
                activeCard.classList.contains("is-match-live")
              );
              viewport.classList.toggle(
                "is-halftime",
                activeCard.classList.contains("is-match-halftime")
              );
              viewport.classList.toggle(
                "is-finished",
                activeCard.classList.contains("is-match-finished")
              );
            }
          
            function render(card) {
              if (!card) return;
          
              const raw = card.__cpCurrentRaw || {};
              const halftime = isHalfTime(raw);
              const finished = isFinished(raw);
              const live = isLive(raw);
              const until = minutesUntilKickoff(card);
              const soon =
                !live &&
                !finished &&
                until !== null &&
                until >= 0 &&
                until <= 20;
          
              const showData = live || halftime || finished;
          
              card.classList.toggle("is-match-soon", soon);
              card.classList.toggle("is-match-live", live && !halftime);
              card.classList.toggle("is-match-halftime", halftime);
              card.classList.toggle("is-match-finished", finished);
              card.classList.toggle("has-match-data", showData);
          
              if (finished) {
                setStatus(card, "finished", "ENCERRADO");
              } else if (halftime) {
                setStatus(card, "halftime", "INTERVALO");
              } else if (live) {
                setStatus(card, "live", "AO VIVO", minuteLabel(raw));
              } else if (soon) {
                setStatus(
                  card,
                  "soon",
                  "A PARTIDA JÁ VAI COMEÇAR",
                  until === 0 ? "AGORA" : `EM ${until} MIN`
                );
              } else {
                clearStatus(card);
              }
          
              const scoreBox = field(card, "cpHomeBestScore");
              const statsBox = field(card, "cpHomeBestLiveStats");
              const versus = card.querySelector(".cpHomeBestVersus");
          
              if (scoreBox) scoreBox.hidden = !showData;
              if (statsBox) statsBox.hidden = !showData;
              if (versus) versus.hidden = showData;
          
              if (showData) {
                const homeGoals = score(raw, "home");
                const awayGoals = score(raw, "away");
          
                setText(card, "cpHomeBestHomeScore", homeGoals);
                setText(card, "cpHomeBestAwayScore", awayGoals);
                setText(card, "cpHomeBestHomeGoals", homeGoals);
                setText(card, "cpHomeBestAwayGoals", awayGoals);
                setText(card, "cpHomeBestHomeCorners", corners(raw, "home"));
                setText(card, "cpHomeBestAwayCorners", corners(raw, "away"));
                setText(card, "cpHomeBestHomeCards", cards(raw, "home"));
                setText(card, "cpHomeBestAwayCards", cards(raw, "away"));
              }
            }
          
            function mergeLiveData(card, payload) {
              if (!card || !payload || payload.error) return;
          
              const previous = card.__cpCurrentRaw || {};
              card.__cpCurrentRaw = {
                ...previous,
                ...payload,
                score: payload.score ?? previous.score,
                goals: payload.goals ?? previous.goals,
                corners: payload.corners ?? previous.corners,
                cards: payload.cards ?? previous.cards,
                yellow_cards: payload.yellow_cards ?? previous.yellow_cards,
                red_cards: payload.red_cards ?? previous.red_cards,
                statistics: payload.statistics ?? previous.statistics
              };
          
              render(card);
            }
          
            async function fetchMatchCenter(matchId, force = false) {
              if (!matchId) return null;
          
              const cached = liveCache.get(matchId);
              if (
                !force &&
                cached &&
                Date.now() - cached.timestamp < CACHE_MAX_AGE_MS
              ) {
                return cached.payload;
              }
          
              if (pendingRequests.has(matchId)) {
                return pendingRequests.get(matchId);
              }
          
              const request = (async () => {
                try {
                  const response = await fetch(
                    `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&_=${Date.now()}`,
                    {
                      cache: "no-store",
                      headers: { Accept: "application/json" }
                    }
                  );
          
                  if (!response.ok) return null;
          
                  const payload = await response.json();
                  if (!payload || payload.error) return null;
          
                  liveCache.set(matchId, {
                    timestamp: Date.now(),
                    payload
                  });
          
                  return payload;
                } catch {
                  return null;
                } finally {
                  pendingRequests.delete(matchId);
                }
              })();
          
              pendingRequests.set(matchId, request);
              return request;
            }
          
            function shouldPoll(card) {
              if (!card || document.hidden) return false;
          
              const raw = card.__cpCurrentRaw || {};
              if (isFinished(raw)) return false;
          
              // O jogo pode chegar sem match_date no endpoint pré-jogo.
              // Havendo match_id, o /match_center é a fonte oficial do estado real.
              return Boolean(
                matchIdFrom(
                  raw,
                  card.__cpCurrentNormalized || {}
                )
              );
            }
          
            async function refreshCard(card, force = false) {
              if (!card) return;
          
              const raw = card.__cpCurrentRaw || {};
              const normalized = card.__cpCurrentNormalized || {};
              const matchId = matchIdFrom(raw, normalized);
          
              if (!matchId || (!force && !shouldPoll(card))) {
                render(card);
                return;
              }
          
              const payload = await fetchMatchCenter(matchId, force);
              if (!payload) {
                render(card);
                card.dataset.matchCenterState = "unavailable";
                return;
              }
          
              card.dataset.matchCenterState = "ok";
          
              // Atualiza todos os slides que representam a mesma partida.
              document.querySelectorAll(CARD_SELECTOR).forEach(slide => {
                const slideId = matchIdFrom(
                  slide.__cpCurrentRaw || {},
                  slide.__cpCurrentNormalized || {}
                );
                if (slideId === matchId) mergeLiveData(slide, payload);
              });
          
              updateViewport(visibleCard());
            }
          
            async function refreshAll(force = false) {
              const cardsList = [...document.querySelectorAll(CARD_SELECTOR)];
              cardsList.forEach(render);
              updateViewport(visibleCard());
          
              const unique = new Map();
          
              for (const card of cardsList) {
                const id = matchIdFrom(
                  card.__cpCurrentRaw || {},
                  card.__cpCurrentNormalized || {}
                );
                if (id && !unique.has(id)) unique.set(id, card);
              }
          
              await Promise.allSettled(
                [...unique.values()].map(card => refreshCard(card, force))
              );
          
              updateViewport(visibleCard());
            }
          
            window.cpUpdateHomeBestLiveCard = function(raw, normalized = {}) {
              const card = document.getElementById("cpHomeBest");
              if (!card) return;
          
              const incoming = raw || {};
              const previous = card.__cpCurrentRaw || {};
              const previousIsRicher =
                Boolean(previous?.live) ||
                Boolean(previous?.finished) ||
                previous?.minute ||
                previous?.score ||
                previous?.goals ||
                previous?.corners;
          
              card.__cpCurrentRaw = previousIsRicher
                ? { ...incoming, ...previous }
                : incoming;
              card.__cpCurrentNormalized = normalized || {};
          
              const id = matchIdFrom(card.__cpCurrentRaw, normalized);
              const cached = id ? liveCache.get(id)?.payload : null;
              if (cached) mergeLiveData(card, cached);
              else render(card);
          
              refreshCard(card, true);
            };
          
            window.cpUpdateHomeBestCloneCard = function(card, raw, normalized = {}) {
              if (!card) return;
          
              const incoming = raw || {};
              const previous = card.__cpCurrentRaw || {};
              const previousIsRicher =
                Boolean(previous?.live) ||
                Boolean(previous?.finished) ||
                previous?.minute ||
                previous?.score ||
                previous?.goals ||
                previous?.corners;
          
              card.__cpCurrentRaw = previousIsRicher
                ? { ...incoming, ...previous }
                : incoming;
              card.__cpCurrentNormalized = normalized || {};
          
              const id = matchIdFrom(card.__cpCurrentRaw, normalized);
              const cached = id ? liveCache.get(id)?.payload : null;
              if (cached) mergeLiveData(card, cached);
              else render(card);
          
              refreshCard(card, true);
            };
          
            let frame = 0;
            function scheduleRender() {
              cancelAnimationFrame(frame);
              frame = requestAnimationFrame(() => {
                document.querySelectorAll(CARD_SELECTOR).forEach(render);
                updateViewport(visibleCard());
              });
            }
          
            function start() {
              const home = document.getElementById("cpMobileHome");
          
              if (home) {
                new MutationObserver(scheduleRender).observe(home, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ["class", "hidden"]
                });
              }
          
              document.querySelector(".cpHomeSwipeViewport")
                ?.addEventListener("scroll", scheduleRender, { passive: true });
          
              document.addEventListener("touchend", () => {
                scheduleRender();
                setTimeout(scheduleRender, 220);
              }, { passive: true });
          
              document.addEventListener("visibilitychange", () => {
                if (!document.hidden) refreshAll(true);
              });
          
              window.addEventListener("focus", () => refreshAll(true));
          
              refreshAll(true);
              setInterval(() => refreshAll(false), POLL_MS);
            }
          
            if (document.readyState === "loading") {
              document.addEventListener("DOMContentLoaded", start, { once: true });
            } else {
              start();
            }
          })();
        
        /* =========================================================
           CORNER PRO WEB V12 — MATCH CENTER FINAL / DESKTOP
           Este bloco fica NO FINAL do script para não ser sobrescrito
           pelos vários módulos legados existentes no arquivo.
           ========================================================= */
        (() => {
          "use strict";
        
          if (window.__cpDesktopMatchCenterV12Installed) return;
          window.__cpDesktopMatchCenterV12Installed = true;
        
          const desktop = () =>
            window.matchMedia && window.matchMedia("(min-width:981px)").matches;
        
          const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({
            "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
          }[ch]));
        
          const clean = (v, fallback="") => {
            const s = String(v ?? "").trim();
            return s && !["undefined","null","NaN"].includes(s) ? s : fallback;
          };
        
          const norm = (v) => String(v ?? "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
            .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
        
          const raw = (g) => g?.raw || g || {};
        
          function home(g){
            const r=raw(g);
            return clean(g?.casa ?? g?.home ?? r?.casa ?? r?.home ??
              r?.match_hometeam_name ?? r?.event_home_team, "Casa");
          }
        
          function away(g){
            const r=raw(g);
            return clean(g?.fora ?? g?.away ?? r?.fora ?? r?.away ??
              r?.match_awayteam_name ?? r?.event_away_team, "Fora");
          }
        
          function gameId(g){
            const r=raw(g);
            return clean(
              g?.match_id ?? g?.event_id ?? g?.event_key ?? g?.fixture_id ?? g?.id ??
              r?.match_id ?? r?.event_id ?? r?.event_key ?? r?.fixture_id ?? r?.id,
              ""
            );
          }
        
          function localKey(g){
            const r=raw(g);
            const t=clean(g?.hora ?? g?.time ?? r?.hora ?? r?.match_time ?? "");
            return `${norm(home(g))}|${norm(away(g))}|${t}`;
          }
        
          function findDesktopGame(button){
            const wanted=String(button?.dataset?.cpd3Open ?? "");
            const games=Array.isArray(window.__cornerProAllGames)
              ? window.__cornerProAllGames
              : [];
        
            let game=games.find(g =>
              String(gameId(g))===wanted ||
              String(localKey(g))===wanted
            );
        
            if(game) return game;
        
            const row=button?.closest?.("[data-cpd3-game]");
            const rowKey=String(row?.dataset?.cpd3Game ?? "");
            game=games.find(g =>
              String(gameId(g))===rowKey ||
              String(localKey(g))===rowKey
            );
        
            return game || window.__selectedMatchCenterGame || null;
          }
        
          function pair(data, name){
            const block=data?.[name] || {};
            return {
              home: clean(block?.home, "—"),
              away: clean(block?.away, "—")
            };
          }
        
          function statusLabel(data, fallbackGame){
            if(data?.finished) return "ENCERRADO";
            const s=String(data?.status ?? data?.status_raw ?? "").toLowerCase();
            if(/half.?time|\bht\b|interval/.test(s)) return "INTERVALO";
            if(data?.live) return data?.minute ? `AO VIVO • ${data.minute}'` : "AO VIVO";
        
            const r=raw(fallbackGame);
            const fs=String(
              fallbackGame?.match_status ?? fallbackGame?.status ??
              r?.match_status ?? r?.status ?? ""
            ).toLowerCase();
        
            if(/finished|full.?time|\bft\b|encerr|finaliz|ended/.test(fs)) return "ENCERRADO";
            if(/half.?time|\bht\b|interval/.test(fs)) return "INTERVALO";
        
            const minute=Number(r?.minute ?? r?.match_minute ?? r?.elapsed);
            if(Number.isFinite(minute) && minute>0) return `AO VIVO • ${Math.round(minute)}'`;
        
            const m=fs.match(/^(\d{1,3})(?:\+(\d{1,2}))?'?$/);
            if(m){
              const min=Number(m[1])+(m[2]?Number(m[2]):0);
              return `AO VIVO • ${min}'`;
            }
        
            return "PRÉ-JOGO";
          }
        
          function metric(label, values){
            return `<div class="cpV12McMetric">
              <strong>${esc(values.home)}</strong>
              <span>${esc(label)}</span>
              <strong>${esc(values.away)}</strong>
            </div>`;
          }
        
          function renderLoading(rail, game){
            const matchId=gameId(game);
            rail.innerHTML=`
              <section class="railCard cpV12McHead">
                <div class="railTitle"><span>▣ MATCH CENTER</span><b>CARREGANDO</b></div>
                <div class="cpV12McTeams">
                  <strong>${esc(home(game))}</strong><em>VS</em><strong>${esc(away(game))}</strong>
                </div>
                <div class="cpV12McLoading"><i></i><span>Buscando estatísticas reais da partida...</span></div>
                ${!matchId?'<p class="cpV12McError">Esta partida não trouxe match_id no feed.</p>':""}
              </section>`;
          }
        
          function renderError(rail, game, message){
            rail.innerHTML=`
              <section class="railCard cpV12McHead">
                <div class="railTitle"><span>▣ MATCH CENTER</span><b>${esc(statusLabel(null,game))}</b></div>
                <div class="cpV12McTeams">
                  <strong>${esc(home(game))}</strong><em>VS</em><strong>${esc(away(game))}</strong>
                </div>
                <p class="cpV12McError">${esc(message)}</p>
              </section>`;
          }
        
          function renderData(rail, data, game){
            const corners=pair(data,"corners");
            const shots=pair(data,"shots");
            const target=pair(data,"shots_on_target");
            const possession=pair(data,"possession");
            const attacks=pair(data,"dangerous_attacks");
            const passes=pair(data,"passes");
            const fouls=pair(data,"fouls");
            const cards=pair(data,"yellow_cards");
        
            const h=clean(data?.home,home(game));
            const a=clean(data?.away,away(game));
            const league=clean(data?.league,clean(game?.liga ?? raw(game)?.liga,"Liga"));
            const time=clean(data?.time,clean(game?.hora ?? raw(game)?.match_time,"—"));
            const status=statusLabel(data,game);
            const hs=clean(data?.goals?.home ?? data?.score?.home ?? data?.home_score,"0");
            const as=clean(data?.goals?.away ?? data?.score?.away ?? data?.away_score,"0");
        
            const events=Array.isArray(data?.events) ? data.events.slice(-6) : [];
        
            rail.innerHTML=`
              <section class="railCard cpV12McHead">
                <div class="railTitle"><span>▣ MATCH CENTER</span><b>${esc(status)}</b></div>
                <div class="cpV12McLeague">${esc(league)} • ${esc(time)}</div>
                <div class="cpV12McScore">
                  <div><strong>${esc(h)}</strong><small>CASA</small></div>
                  <b>${esc(hs)} - ${esc(as)}</b>
                  <div><strong>${esc(a)}</strong><small>FORA</small></div>
                </div>
              </section>
        
              <section class="railCard cpV12McStats">
                <h3>ESTATÍSTICAS DA PARTIDA</h3>
                ${metric("Escanteios",corners)}
                ${metric("Finalizações",shots)}
                ${metric("No alvo",target)}
                ${metric("Posse",possession)}
                ${metric("Ataques perigosos",attacks)}
                ${metric("Passes",passes)}
                ${metric("Faltas",fouls)}
                ${metric("Cartões",cards)}
              </section>
        
              <section class="railCard cpV12McEvents">
                <h3>EVENTOS / LEITURA</h3>
                ${events.length
                  ? `<div>${events.map(e=>`<p><b>${esc(e?.minute ?? "")}${e?.minute?"'":""}</b> ${esc(e?.label ?? e?.type ?? "Evento")}</p>`).join("")}</div>`
                  : `<p class="cpV12McMuted">Nenhum evento detalhado disponível.</p>`
                }
              </section>
            `;
          }
        
          async function openMatchCenterV12(game){
            const rail=document.getElementById("desktopMatchRail");
            if(!rail || !game) return;
        
            window.__selectedMatchCenterGame=game;
            window.__selectedMatchCenterKey=String(gameId(game) || localKey(game));
        
            rail.style.display="flex";
            rail.style.visibility="visible";
            rail.style.opacity="1";
        
            renderLoading(rail,game);
        
            const matchId=gameId(game);
            if(!matchId){
              renderError(rail,game,"Não foi possível abrir as estatísticas porque este jogo não possui match_id.");
              return;
            }
        
            try{
              const response=await fetch(
                `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&t=${Date.now()}`,
                {cache:"no-store",headers:{"Cache-Control":"no-cache","Accept":"application/json"}}
              );
        
              const data=await response.json().catch(()=>null);
        
              if(!response.ok || !data || data?.error){
                throw new Error(data?.error || `HTTP ${response.status}`);
              }
        
              renderData(rail,data,game);
            }catch(error){
              console.error("[CP WEB V12 Match Center]",error);
              renderError(
                rail,
                game,
                `Não foi possível carregar as estatísticas desta partida: ${error?.message || "erro desconhecido"}.`
              );
            }
          }
        
          window.cpOpenDesktopMatchCenterV12=openMatchCenterV12;
        
          document.addEventListener("click",event=>{
            if(!desktop()) return;
        
            const button=event.target?.closest?.("[data-cpd3-open]");
            if(!button) return;
        
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        
            const game=findDesktopGame(button);
            if(!game){
              const rail=document.getElementById("desktopMatchRail");
              if(rail){
                rail.innerHTML=`<section class="railCard"><div class="railTitle"><span>▣ MATCH CENTER</span><b>ERRO</b></div><p class="cpV12McError">Não consegui localizar esta partida na lista carregada.</p></section>`;
              }
              return;
            }
        
            openMatchCenterV12(game);
          },true);
        })();
      /* WEB V25 — debug opcional dos seletores */
      window.CornerProMarketDebug = function(){
        try{
          const rows=[...document.querySelectorAll("#cpd3Rows .cpd3Row")];
          return {
            market: document.querySelector("[data-cpd3-market].active")?.dataset?.cpd3Market || null,
            line: document.querySelector("[data-cpd3-line].active")?.dataset?.cpd3Line || null,
            visibleGames: rows.map(r=>r.dataset.cpd3Game)
          };
        }catch(e){ return {error:String(e)}; }
      };
    
    /* =========================================================
       CORNER PRO — FIX DE RÓTULOS DO MENU DESKTOP
       Corrige traduções indevidas no topo:
       CARRINHO/CARRINHOS -> CARTÕES
       DESVANTAGEM -> HANDICAP
       Mantém os mercados e a lógica intactos.
       ========================================================= */
    (function installCornerProDesktopMenuLabelFix(){
      "use strict";
    
      if (window.__cpDesktopMenuLabelFixInstalled) return;
      window.__cpDesktopMenuLabelFixInstalled = true;
    
      const normalize = value => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
    
      function fixTextNode(el){
        if (!el) return;
    
        const txt = normalize(el.textContent);
    
        if (txt === "CARRINHO" || txt === "CARRINHOS") {
          el.textContent = "CARTÕES";
          return;
        }
    
        if (txt === "DESVANTAGEM") {
          el.textContent = "HANDICAP";
        }
      }
    
      function applyFix(){
        if (window.matchMedia && !window.matchMedia("(min-width:981px)").matches) return;
    
        document.querySelectorAll(
          ".topbar .nav a, .topbar .nav button, " +
          ".cpd3MarketNav button, " +
          "[data-cpd3-market='cards'], [data-cpd3-market='handicap']"
        ).forEach(el => {
          const market = String(el.dataset?.cpd3Market || "").toLowerCase();
    
          if (market === "cards") {
            el.textContent = "CARTÕES";
            return;
          }
    
          if (market === "handicap") {
            el.textContent = "HANDICAP";
            return;
          }
    
          fixTextNode(el);
        });
      }
    
      function start(){
        applyFix();
    
        const observer = new MutationObserver(() => applyFix());
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          characterData: true
        });
    
        window.addEventListener("pageshow", applyFix);
        window.addEventListener("focus", applyFix);
      }
    
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once:true });
      } else {
        start();
      }
    })();
    
    /* =========================================================

    /* =========================================================
       SITE DESKTOP V121 — STATUS DA LISTA = MATCH CENTER REAL
       Corrige casos em que a tabela fica "INTERVALO" enquanto
       /match_center já informa 2º tempo / minuto atual.
       SOMENTE DESKTOP (>=981px).
       ========================================================= */
    (function installDesktopMatchCenterStatusTruth(){
      "use strict";

      if (!window.matchMedia || !window.matchMedia("(min-width:981px)").matches) return;
      if (window.__cpDesktopMatchCenterStatusTruthV121) return;
      window.__cpDesktopMatchCenterStatusTruthV121 = true;

      const CACHE_TTL = 12000;
      const POLL_MS = 20000;
      const cache = new Map();
      let syncing = false;

      const clean = (v, fb="") => {
        const s = String(v ?? "").trim();
        return s && s !== "undefined" && s !== "null" && s !== "NaN" ? s : fb;
      };

      const number = (...vals) => {
        for (const v of vals){
          if (v === null || v === undefined || v === "") continue;
          const m = String(v).match(/(\d{1,3})/);
          if (!m) continue;
          const n = Number(m[1]);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };

      function matchIdFromRow(row){
        const value = clean(
          row?.dataset?.cpd3Game ||
          row?.getAttribute?.("data-cpd3-game"),
          ""
        );
        // fallback visual "time|home|away" não serve para /match_center.
        if (!value || value.includes("|")) return "";
        return value;
      }

      function responseData(payload){
        if (!payload || typeof payload !== "object") return null;
        if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
          const d = payload.data;
          if (
            d.live !== undefined || d.finished !== undefined || d.minute !== undefined ||
            d.status !== undefined || d.status_raw !== undefined || d.goals || d.score
          ) return d;
        }
        return payload;
      }

      function realStatus(data){
        const rawStatus = clean(
          data?.status ?? data?.status_raw ?? data?.match_status ?? data?.event_status,
          ""
        ).toLowerCase();

        const minute = number(
          data?.minute, data?.match_minute, data?.elapsed,
          data?.time_live, data?.match_live
        );

        const finished =
          data?.finished === true ||
          /finished|full.?time|\bft\b|encerr|finaliz|ended|after extra|after pen|aet/.test(rawStatus);

        const explicitHalf =
          /half.?time|\bht\b|intervalo|interval|break/.test(rawStatus) ||
          data?.halftime === true || data?.half_time === true;

        /*
          A fonte real do Match Center vence o status antigo da lista.
          Ex.: status_raw ainda "HT", mas live=true e minute=66.
        */
        const liveFlag =
          data?.live === true ||
          /live|ao vivo|1st|2nd|in.?play|playing|andamento/.test(rawStatus) ||
          (minute !== null && minute > 0);

        let halftime = false;
        let live = false;

        if (!finished){
          if (liveFlag && minute !== null && minute > 45){
            live = true;
          }else if (explicitHalf){
            halftime = true;
            live = true;
          }else if (liveFlag){
            live = true;
          }
        }

        let label = "PRÉ-JOGO";
        if (finished) label = "FIM";
        else if (halftime) label = "INTERVALO";
        else if (live) label = minute !== null ? `AO VIVO • ${minute}'` : "AO VIVO";

        const hs = clean(
          data?.goals?.home ?? data?.score?.home ??
          data?.home_score ?? data?.score_home ?? data?.match_hometeam_score,
          ""
        );
        const as = clean(
          data?.goals?.away ?? data?.score?.away ??
          data?.away_score ?? data?.score_away ?? data?.match_awayteam_score,
          ""
        );

        return { finished, halftime, live, minute, label, hs, as };
      }

      function updateBackingGames(matchId, data, info){
        const pools = [
          window.__cornerProAllGames,
          window.__premiumFilteredGames,
          window.__premiumMarketGames,
          window.__lastRawGames,
          window.__lastMarketGames
        ];

        for (const pool of pools){
          if (!Array.isArray(pool)) continue;
          for (const game of pool){
            if (!game || typeof game !== "object") continue;
            const raw = game.raw || game;
            const id = clean(
              game.match_id ?? game.event_id ?? game.event_key ?? game.fixture_id ?? game.id ??
              raw.match_id ?? raw.event_id ?? raw.event_key ?? raw.fixture_id ?? raw.id,
              ""
            );
            if (id !== matchId) continue;

            game.live = info.live;
            game.finished = info.finished;
            game.halftime = info.halftime;
            if (info.minute !== null) game.minute = info.minute;
            game.match_status = info.finished ? "FT" : info.halftime ? "HT" : info.live ? "LIVE" : game.match_status;

            if (game.raw && typeof game.raw === "object"){
              game.raw.live = info.live;
              game.raw.finished = info.finished;
              game.raw.halftime = info.halftime;
              if (info.minute !== null) game.raw.minute = info.minute;
              game.raw.match_status = game.match_status;
              if (info.hs !== "") game.raw.match_hometeam_score = info.hs;
              if (info.as !== "") game.raw.match_awayteam_score = info.as;
            }
          }
        }
      }

      function paintRow(row, data){
        const cell = row?.querySelector?.(".cpd3Start");
        if (!cell) return;

        const info = realStatus(data);

        cell.classList.toggle("is-live", info.live && !info.finished);
        cell.classList.toggle("is-finished", info.finished);

        const score =
          info.hs !== "" && info.as !== ""
            ? `${info.hs} × ${info.as}`
            : "";

        if (info.finished){
          cell.innerHTML = `FIM${score ? `<br><b>${score}</b>` : ""}`;
        }else if (info.halftime){
          cell.innerHTML = `INTERVALO${score ? `<br><b>${score}</b>` : ""}`;
        }else if (info.live){
          cell.innerHTML = `${info.label}${score ? `<br><b>${score}</b>` : ""}`;
        }else{
          // Não modifica pré-jogo; mantém o horário renderizado pelo site.
          return;
        }

        const matchId = matchIdFromRow(row);
        if (matchId) updateBackingGames(matchId, data, info);
      }

      async function fetchReal(matchId){
        const now = Date.now();
        const old = cache.get(matchId);
        if (old && (now - old.at) < CACHE_TTL) return old.data;

        const res = await fetch(
          `/match_center?match_id=${encodeURIComponent(matchId)}&fresh=1&t=${now}`,
          {
            cache:"no-store",
            headers:{
              "Accept":"application/json",
              "Cache-Control":"no-cache"
            }
          }
        );

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload || payload?.error){
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }

        const data = responseData(payload);
        cache.set(matchId, {at:now, data});
        return data;
      }

      async function syncRow(row){
        const matchId = matchIdFromRow(row);
        if (!matchId) return;

        try{
          const data = await fetchReal(matchId);
          if (data) paintRow(row, data);
        }catch(error){
          console.debug("[CP SITE V121 status]", matchId, error?.message || error);
        }
      }

      async function syncRows(){
        if (syncing || document.hidden) return;
        syncing = true;

        try{
          const rows = [...document.querySelectorAll(".cpd3Row[data-cpd3-game]")];
          // A tabela exibe poucos jogos; usa lotes de 3 para não sobrecarregar a rota.
          for (let i=0; i<rows.length; i+=3){
            await Promise.allSettled(rows.slice(i, i+3).map(syncRow));
          }
        }finally{
          syncing = false;
        }
      }

      let mutationTimer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(syncRows, 250);
      });

      function installObserver(){
        const root =
          document.getElementById("cpd3Rows") ||
          document.getElementById("cpDesktopExperienceV3") ||
          document.body;

        observer.observe(root, {childList:true, subtree:true});
      }

      if (document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", () => {
          installObserver();
          setTimeout(syncRows, 500);
          setTimeout(syncRows, 1800);
        }, {once:true});
      }else{
        installObserver();
        setTimeout(syncRows, 300);
        setTimeout(syncRows, 1500);
      }

      setInterval(syncRows, POLL_MS);
      window.addEventListener("focus", syncRows);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) syncRows();
      });

      console.info("[CP SITE V121] Status da tabela sincronizado com /match_center.");
    })();



/* =========================================================
   CORNER PRO V135 — ALERTA DE PRESSÃO
   Refeito do zero.
   - Cantos: 32'–39', intervalo e 83'–95'
   - Gols: intervalo
   - Sem critério forte = sem sino
   ========================================================= */
(function installCornerProPressureAlertsV135(){
  "use strict";
  if(window.__CP_PRESSURE_V135__) return;
  window.__CP_PRESSURE_V135__ = true;

  const alerts = new Map();
  const cache = new Map();
  let busy = false;

  const N = (v, fb=0) => {
    const x = Number(String(v ?? "").replace("%","").replace(",",".").replace(/[^\d.-]/g,""));
    return Number.isFinite(x) ? x : fb;
  };
  const S = (v, fb="") => {
    const s = String(v ?? "").trim();
    return s && !["undefined","null","NaN"].includes(s) ? s : fb;
  };

  function matchId(g){
    const r = g?.raw || g || {};
    return S(r.match_id ?? r.event_id ?? r.event_key ?? r.fixture_id ?? r.id ?? g?.match_id ?? g?.id);
  }

  function pair(d, key){
    const o = d?.[key] || {};
    return { home:N(o.home), away:N(o.away) };
  }

  function isHalftime(d){
    const s = S(d?.status_raw ?? d?.status).toLowerCase();
    return Boolean(d?.halftime || d?.half_time) || /half.?time|\bht\b|intervalo|interval|break/.test(s);
  }

  function evaluate(d){
    if(!d || d.finished || d.not_started || d.cancelled) return [];

    const minute = N(d.minute);
    const ht = isHalftime(d);
    const score = pair(d,"score");
    const corners = pair(d,"corners");
    const shots = pair(d,"shots");
    const onTarget = pair(d,"shots_on_target");
    const danger = pair(d,"dangerous_attacks");
    const attacks = pair(d,"attacks");

    const C = corners.home + corners.away;
    const SH = shots.home + shots.away;
    const OT = onTarget.home + onTarget.away;
    const DA = danger.home + danger.away;
    const AT = attacks.home + attacks.away;

    const trailing = score.home !== score.away;
    const loserDanger = score.home < score.away ? danger.home : score.away < score.home ? danger.away : Math.max(danger.home,danger.away);
    const loserShots  = score.home < score.away ? shots.home  : score.away < score.home ? shots.away  : Math.max(shots.home,shots.away);

    const out = [];

    // 32'–39': oportunidade de canto antes do intervalo.
    if(minute >= 32 && minute <= 39){
      let hits = 0;
      if(DA >= 24 || AT >= 55) hits++;
      if(SH >= 8) hits++;
      if(OT >= 3) hits++;
      if(C >= 3) hits++;

      if(hits >= 3){
        out.push({
          market:"corners",
          phase:`${minute}'`,
          level:hits >= 4 ? "MUITO ALTA" : "ALTA",
          title:"PRESSÃO PARA ESCANTEIOS",
          text:`Jogo em alta intensidade aos ${minute}'. ${C} cantos, ${SH} finalizações e forte volume ofensivo. Pode haver novos escanteios antes do intervalo.`
        });
      }
    }

    // Intervalo: avaliação separada para cantos e gols.
    if(ht){
      let cornerHits = 0;
      if(DA >= 32 || AT >= 70) cornerHits++;
      if(SH >= 10) cornerHits++;
      if(OT >= 4) cornerHits++;
      if(C >= 4) cornerHits++;
      if(trailing && loserDanger >= 18) cornerHits++;
      if(trailing && loserShots >= 6) cornerHits++;

      if(cornerHits >= 4){
        out.push({
          market:"corners",
          phase:"INTERVALO",
          level:cornerHits >= 5 ? "MUITO ALTA" : "ALTA",
          title:"PRESSÃO PARA CANTOS NO 2º TEMPO",
          text:`Intervalo em ${score.home}-${score.away}. A partida tem ${C} cantos e ${SH} finalizações${trailing ? ", com necessidade de reação do time que está atrás" : ""}. Cenário forte para novos escanteios no 2º tempo.`
        });
      }

      let goalHits = 0;
      if(DA >= 34 || AT >= 74) goalHits++;
      if(SH >= 11) goalHits++;
      if(OT >= 4) goalHits++;
      if(trailing) goalHits++;
      if(trailing && loserDanger >= 18) goalHits++;

      if(goalHits >= 4){
        out.push({
          market:"goals",
          phase:"INTERVALO",
          level:goalHits >= 5 ? "MUITO ALTA" : "ALTA",
          title:"PRESSÃO PARA GOLS NO 2º TEMPO",
          text:`Intervalo em ${score.home}-${score.away}. Foram ${SH} finalizações e ${OT} no alvo${trailing ? ", com necessidade de reação" : ""}. O 2º tempo apresenta pressão para gols.`
        });
      }
    }

    // 83'–95': reta final com intensidade alta.
    if(minute >= 83 && minute <= 95){
      let hits = 0;
      if(DA >= 68 || AT >= 135) hits++;
      if(SH >= 18) hits++;
      if(OT >= 6) hits++;
      if(C >= 7) hits++;
      if(trailing && loserDanger >= 34) hits++;
      if(trailing && loserShots >= 10) hits++;

      if(hits >= 4){
        out.push({
          market:"corners",
          phase:`${minute}'`,
          level:hits >= 5 ? "MUITO ALTA" : "ALTA",
          title:"PRESSÃO NOS MINUTOS FINAIS",
          text:`Aos ${minute}', a partida segue intensa: ${C} cantos e ${SH} finalizações. Ainda existe cenário para novos escanteios nos minutos finais.`
        });
      }
    }

    return out;
  }

  async function matchCenter(id){
    const now = Date.now();
    const old = cache.get(id);
    if(old && now - old.at < 20000) return old.data;

    const res = await fetch(`/match_center?match_id=${encodeURIComponent(id)}&fresh=1&_=${now}`, {cache:"no-store"});
    if(!res.ok) throw new Error(`match_center ${res.status}`);
    const data = await res.json();
    cache.set(id,{at:now,data});
    return data;
  }

  function allVisibleGames(){
    const pools = [
      window.__cpV110VisibleGames,
      window.__cornerProAllGames,
      window.__lastRawGames,
      window.__lastRenderedTopGames
    ];
    const out = [], seen = new Set();
    for(const pool of pools){
      if(!Array.isArray(pool)) continue;
      for(const g of pool){
        const id = matchId(g);
        if(id && !seen.has(id)){ seen.add(id); out.push(g); }
      }
    }
    return out;
  }

  function strongest(market){
    const rank = {"ALTA":1,"MUITO ALTA":2};
    return [...alerts.values()].flat()
      .filter(a => a.market === market)
      .sort((a,b)=>(rank[b.level]||0)-(rank[a.level]||0))[0] || null;
  }

  function bell(a, extra="", market=""){
    const active = Boolean(a);
    const m = a?.market || market || "";
    return `<span role="button" tabindex="0" class="cpPressureBell ${extra} ${active?"is-active":"is-idle"}" data-cp-pressure-market="${m}" data-cp-pressure-active="${active?"1":"0"}" aria-label="${active?"Abrir alerta de pressão":"Monitorando pressão"}">🔔</span>`;
  }

  function ensureModal(){
    if(document.getElementById("cpPressureModal")) return;
    const modal = document.createElement("div");
    modal.id = "cpPressureModal";
    modal.className = "cpPressureModal";
    modal.innerHTML = `
      <div class="cpPressureSheet" role="dialog" aria-modal="true">
        <button type="button" class="cpPressureClose" aria-label="Fechar">×</button>
        <div class="cpPressureBigBell">🔔</div>
        <small id="cpPressurePhase"></small>
        <h3 id="cpPressureTitle"></h3>
        <p id="cpPressureText"></p>
        <b id="cpPressureLevel"></b>
      </div>`;
    document.body.appendChild(modal);
  }

  function showAlert(a){
    if(!a) return;
    ensureModal();
    document.getElementById("cpPressurePhase").textContent = a.phase;
    document.getElementById("cpPressureTitle").textContent = a.title;
    document.getElementById("cpPressureText").textContent = a.text;
    document.getElementById("cpPressureLevel").textContent = `INTENSIDADE ${a.level}`;
    document.getElementById("cpPressureModal").classList.add("open");
  }

  function paint(){
    const cornerAlert = strongest("corners");
    const goalAlert = strongest("goals");

    // Dashboard mobile: sino SEMPRE visível em Escanteios e Gols.
    // Limpa qualquer sino que versões anteriores tenham colocado na navegação inferior.
    document.querySelectorAll("#cpNewMobileV110 .v110Bottom .cpPressureBell").forEach(el=>el.remove());

    // Dashboard mobile: sino SOMENTE nos cards de mercado, nunca na barra inferior.
    document.querySelectorAll("#cpNewMobileV110 .v110Market[data-v110-market]").forEach(card=>{
      card.querySelector(".cpPressureBell.dashboard")?.remove();
      const m = card.dataset.v110Market;
      if(m!=="corners" && m!=="goals") return;
      const a = m==="corners" ? cornerAlert : goalAlert;
      card.insertAdjacentHTML("beforeend", bell(a,"dashboard",m));
    });

    // Descobre mercado atual.
    const title = (document.getElementById("cpV110MarketTitle")?.textContent || "").toLowerCase();
    let currentMarket = window.__cpCurrentMobileMarket || "";
    if(!currentMarket){
      currentMarket = title.includes("gol") ? "goals" :
                      title.includes("cart") ? "cards" :
                      title.includes("handicap") ? "handicap" :
                      title.includes("escante") || title.includes("ao vivo") ? "corners" : "";
    }

    // Dentro de Gols/Escanteios: sino SEMPRE visível em cada card.
    document.querySelectorAll("#cpNewMobileV110 .v110Game").forEach(card=>{
      card.querySelector(".cpPressureBell.game")?.remove();

      if(currentMarket!=="corners" && currentMarket!=="goals") return;

      const matchId = String(card.dataset.matchId || "");
      let a = matchId ? (alerts.get(matchId)||[]).find(x=>x.market===currentMarket) : null;

      // Só o jogo com alerta fica ativo; os demais continuam cinza/parados.
      card.insertAdjacentHTML("afterbegin", bell(a,"game",currentMarket));
    });

    // Desktop: sino sempre visível apenas nos acessos de Escanteios/Gols.
    if(window.matchMedia?.("(min-width:981px)").matches){
      document.querySelectorAll(".marketTab,.side-item,.nav a").forEach(el=>{
        el.querySelector(".cpPressureBell.desktop")?.remove();
        const t = (el.textContent || "").toLowerCase();
        let market = "";
        if(t.includes("escante")) market="corners";
        else if(t.includes("gol")) market="goals";
        if(!market) return;
        const a = market==="corners" ? cornerAlert : goalAlert;
        el.insertAdjacentHTML("beforeend", bell(a,"desktop",market));
      });
    }
  }

  async function sync(){
    if(busy || document.hidden) return;
    busy = true;
    try{
      const ids = [...new Set(allVisibleGames().map(matchId).filter(Boolean))].slice(0,18);
      if(!ids.length){ alerts.clear(); paint(); return; }

      const today = new Intl.DateTimeFormat("en-CA",{
        timeZone:"America/Manaus",year:"numeric",month:"2-digit",day:"2-digit"
      }).format(new Date());

      let liveIds = new Set();
      try{
        const statusPayload = await fetch(`/market_live_status?date=${encodeURIComponent(today)}&_=${Date.now()}`,{cache:"no-store"}).then(r=>r.json());
        for(const g of (statusPayload?.games || [])){
          const rawStatus = String(g?.status ?? g?.status_raw ?? g?.match_status ?? "").toLowerCase();
          const rawMinute = Number(String(g?.minute ?? g?.match_minute ?? g?.elapsed ?? "").replace(/[^\d]/g,""));
          const isFinished = Boolean(g?.finished) || /finished|full.?time|\bft\b|encerr|finaliz|ended/.test(rawStatus);
          const isHalf = Boolean(g?.halftime) || /half.?time|\bht\b|intervalo|interval|break/.test(rawStatus);
          const isLive = !isFinished && (
            Boolean(g?.live) ||
            isHalf ||
            (Number.isFinite(rawMinute) && rawMinute > 0) ||
            /live|ao vivo|1st|2nd|in play|in-play|andamento/.test(rawStatus)
          );
          if(isLive) liveIds.add(String(g.match_id ?? g.id ?? g.event_id ?? ""));
        }
      }catch{}

      const targets = ids.filter(id=>liveIds.has(String(id))).slice(0,10);
      const rows = await Promise.allSettled(targets.map(async id => [String(id), evaluate(await matchCenter(id))]));

      alerts.clear();
      for(const row of rows){
        if(row.status === "fulfilled" && row.value[1].length){
          alerts.set(row.value[0], row.value[1]);
        }
      }
      paint();
    }catch(err){
      console.warn("[CornerPro Pressure V135]", err);
    }finally{
      busy = false;
    }
  }

  document.addEventListener("click", e=>{
    const bellBtn = e.target.closest?.("[data-cp-pressure-market]");
    if(bellBtn){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const market = bellBtn.dataset.cpPressureMarket;
      const active = bellBtn.dataset.cpPressureActive === "1";
      const found = strongest(market);

      if(active && found){
        showAlert(found);
      }else{
        showAlert({
          market,
          phase:"MONITORANDO",
          level:"AGUARDANDO",
          title: market==="goals" ? "ALERTA DE GOLS ATIVO" : "ALERTA DE ESCANTEIOS ATIVO",
          text: market==="goals"
            ? "Este jogo está sendo monitorado. O sino vai pulsar quando houver pressão suficiente para um alerta de gols no intervalo."
            : "Este jogo está sendo monitorado. O sino vai pulsar quando houver pressão suficiente nas janelas de 32', intervalo ou 83'+."
        });
      }
      return;
    }
    if(e.target.closest?.(".cpPressureClose") || e.target.id === "cpPressureModal"){
      document.getElementById("cpPressureModal")?.classList.remove("open");
    }
  }, true);

  const boot = ()=>{
    ensureModal();
    sync();
    setInterval(sync,30000);
    window.addEventListener("focus",sync);
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden) sync(); });
  };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();


  document.addEventListener("keydown", e=>{
    if((e.key==="Enter" || e.key===" ") && e.target?.matches?.("[data-cp-pressure-market]")){
      e.preventDefault();
      e.target.click();
    }
  });

  window.CornerProPressureAlerts = {sync,paint,alerts};
})();




/* =========================================================

/* ================================================================
   CORNER PRO V147 — FAVORITOS ATIVOS / FIX APP
   Sem MutationObserver e sem pointerdown global.
   ================================================================ */
(()=>{
  "use strict";
  if(window.__CP_FAVORITES_V147__) return;
  window.__CP_FAVORITES_V147__=true;

  const KEYS=["cornerProFavoriteTeams:v2","cornerProFavorites","cornerpro_mobile_favorite_teams_v1"];
  const CACHE="cornerpro_favorites_home_v147";
  const TTL=10*60*1000;
  let busy=false,timer=null;

  const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const clean=v=>{const s=String(v??"").trim();return s&&!/^(undefined|null|nan)$/i.test(s)?s:""};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function favorites(){
    const m=new Map();
    for(const key of KEYS){
      try{
        const a=JSON.parse(localStorage.getItem(key)||"[]");
        if(!Array.isArray(a))continue;
        for(const x of a){
          const name=clean(typeof x==="string"?x:(x?.name??x?.team??x?.team_name));
          const k=norm(name);if(k&&!m.has(k))m.set(k,name);
        }
      }catch{}
    }
    return m;
  }
  function ymd(off=0){const d=new Date();d.setDate(d.getDate()+off);try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Manaus",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`}catch{return d.toISOString().slice(0,10)}}
  function day(off){if(off===0)return"HOJE";if(off===1)return"AMANHÃ";const [Y,M,D]=ymd(off).split("-").map(Number);try{return new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",timeZone:"America/Manaus"}).format(new Date(Y,M-1,D,12)).replace(".","").toUpperCase()}catch{return ymd(off)}}
  const raw=g=>g?.raw||g||{};
  function home(g){const r=raw(g);return clean(g?.casa??g?.home??g?.home_name??g?.home_team??g?.match_hometeam_name??r?.casa??r?.home??r?.match_hometeam_name)}
  function away(g){const r=raw(g);return clean(g?.fora??g?.away??g?.away_name??g?.away_team??g?.match_awayteam_name??r?.fora??r?.away??r?.match_awayteam_name)}
  function hour(g){const r=raw(g);return clean(g?.hora??g?.time??g?.match_time??r?.hora??r?.time??r?.match_time)||"--:--"}
  function league(g){const r=raw(g),x=g?.liga??g?.league_name??g?.league??r?.liga??r?.league_name??r?.league;return clean(typeof x==="object"?(x?.name??x?.league_name):x)||"Liga"}
  function extract(p,seen=new Set()){
    if(Array.isArray(p))return p.filter(x=>x&&typeof x==="object");
    if(!p||typeof p!=="object"||seen.has(p))return[];seen.add(p);
    for(const k of ["games","jogos","matches","fixtures","events","data","items","results","response","quentes","mercados","list","top","top6"]){const v=p[k];if(Array.isArray(v)&&v.length)return v.filter(x=>x&&typeof x==="object")}
    for(const v of Object.values(p)){if(v&&typeof v==="object"){const a=extract(v,seen);if(a.length)return a}}
    return[];
  }
  function same(name,map){const n=norm(name);if(!n)return false;if(map.has(n))return true;for(const k of map.keys())if(k.length>=5&&n.length>=5&&(n.includes(k)||k.includes(n)))return true;return false}
  async function fetchDay(date){
    for(const url of [`/mercados?date=${encodeURIComponent(date)}&_fav147=1&t=${Date.now()}`,`/quentes?date=${encodeURIComponent(date)}&_fav147=1&ai=0&t=${Date.now()}`]){
      let tm=null;
      try{const c=new AbortController();tm=setTimeout(()=>c.abort(),10000);const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"},signal:c.signal});clearTimeout(tm);tm=null;if(!r.ok)continue;const a=extract(await r.json());if(a.length)return a}catch{}finally{if(tm)clearTimeout(tm)}
    }
    return[];
  }
  function getCache(){try{const c=JSON.parse(localStorage.getItem(CACHE)||"null");return c&&Date.now()-Number(c.at||0)<TTL&&Array.isArray(c.alerts)?c.alerts:null}catch{return null}}
  function setCache(alerts){try{localStorage.setItem(CACHE,JSON.stringify({at:Date.now(),alerts}))}catch{}}

  function style(){
    if(document.getElementById("cpFav147Style"))return;
    const s=document.createElement("style");s.id="cpFav147Style";s.textContent=`
      .cpFav147Badge{margin-left:auto;min-width:20px;height:19px;padding:0 6px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;background:#70ff32;color:#061006;font-size:9px;font-weight:950;box-shadow:0 0 12px rgba(112,255,50,.28)}
      .cpFav147Badge.tomorrow{background:#ffd348;color:#161000}.cpFav147Host{display:flex!important;align-items:center!important;gap:8px!important}
      .cpFav147Overlay{position:fixed;inset:0;z-index:2147483600;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.cpFav147Overlay.open{display:flex}
      .cpFav147Box{width:min(680px,96vw);max-height:88vh;overflow:auto;border:1px solid #1c3528;border-radius:18px;background:linear-gradient(180deg,#0b1410,#050907);color:#fff;box-shadow:0 30px 90px #000}
      .cpFav147Head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:16px 18px;background:#08100c;border-bottom:1px solid #17291f}.cpFav147Head i{font-style:normal;color:#70ff32;font-size:24px}.cpFav147Head div{flex:1}.cpFav147Head small{display:block;color:#70ff32;font-size:8px;font-weight:950}.cpFav147Head h2{margin:2px 0 0;font-size:20px}.cpFav147Close{width:38px;height:38px;border:1px solid #24362e;border-radius:11px;background:#0c1511;color:#fff;font-size:22px}
      .cpFav147Summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 16px}.cpFav147Summary div{padding:12px;border:1px solid #182a21;border-radius:12px;background:#0b1410}.cpFav147Summary small{display:block;color:#849189;font-size:7px;font-weight:900}.cpFav147Summary b{display:block;margin-top:4px;color:#70ff32;font-size:19px}
      .cpFav147Body{padding:0 16px 18px}.cpFav147Chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}.cpFav147Chips span{padding:7px 10px;border:1px solid #1d3528;border-radius:99px;background:#0d1912;font-size:9px}.cpFav147Empty{padding:28px 18px;text-align:center;border:1px dashed #24362e;border-radius:14px;color:#89968f}.cpFav147Empty b{display:block;color:#fff;margin-bottom:5px}
      .cpFav147Day{margin-top:12px}.cpFav147DayTitle{display:flex;justify-content:space-between;margin-bottom:7px}.cpFav147DayTitle b{color:#70ff32;font-size:10px}.cpFav147DayTitle span{color:#7f8d86;font-size:8px}.cpFav147Game{display:grid;grid-template-columns:1.4fr .6fr .9fr;gap:10px;align-items:center;padding:12px;margin-bottom:7px;border:1px solid #172820;border-radius:12px;background:#09110d}.cpFav147Game strong{display:block;font-size:11px}.cpFav147Game .teams span{display:block;color:#96a39c;font-size:9px;margin-top:3px}.cpFav147Game .when{text-align:center}.cpFav147Game .when small{display:block;color:#70ff32;font-size:6px;font-weight:950}.cpFav147Game .league{text-align:right;color:#89968f;font-size:8px}
      @media(max-width:980px){.cpFav147Overlay{padding:0;align-items:flex-end}.cpFav147Box{width:100%;max-width:520px;max-height:88dvh;border-radius:22px 22px 0 0}.cpFav147Summary{padding:12px}.cpFav147Body{padding:0 12px 18px}.cpFav147Game{grid-template-columns:1.35fr .55fr}.cpFav147Game .league{grid-column:1/-1;text-align:left}.v110Quick button.cpFav147Host{position:relative}.v110Quick .cpFav147Badge{position:absolute;top:6px;right:7px;margin:0}}
    `;document.head.appendChild(s);
  }
  function desktop(){return [...document.querySelectorAll(".sidebar-nav .side-item")].find(x=>norm(x.querySelector("b")?.textContent||x.textContent)==="favoritos")||null}
  function mobile(){return [...document.querySelectorAll("#cpNewMobileV110 .v110Quick button,.v110Quick button")].find(x=>norm(x.querySelector("b")?.textContent)==="favoritos")||null}
  function paint(alerts=[]){style();for(const h of [desktop(),mobile()].filter(Boolean)){h.classList.add("cpFav147Host");let b=h.querySelector(".cpFav147Badge");if(!alerts.length){b?.remove();continue}if(!b){b=document.createElement("span");b.className="cpFav147Badge";h.appendChild(b)}b.textContent=String(alerts.length);b.classList.toggle("tomorrow",alerts.some(x=>x.offset===1));const f=alerts[0];h.title=`${alerts.length} favorito(s) joga(m) em casa. Próximo: ${f.home} x ${f.away} • ${day(f.offset)} ${f.time}`}}
  function overlay(){style();let o=document.getElementById("cpFav147Overlay");if(o)return o;o=document.createElement("section");o.id="cpFav147Overlay";o.className="cpFav147Overlay";o.innerHTML=`<div class="cpFav147Box"><header class="cpFav147Head"><i>☆</i><div><small>SEUS TIMES</small><h2>Favoritos</h2></div><button class="cpFav147Close" data-cpfav-close type="button">×</button></header><div id="cpFav147Content"></div></div>`;document.body.appendChild(o);return o}
  function close(){const o=document.getElementById("cpFav147Overlay");o?.classList.remove("open")}
  function render(alerts=[]){const o=overlay(),body=o.querySelector("#cpFav147Content"),f=[...favorites().values()],groups=new Map();alerts.forEach(a=>{if(!groups.has(a.offset))groups.set(a.offset,[]);groups.get(a.offset).push(a)});body.innerHTML=`<div class="cpFav147Summary"><div><small>TIMES FAVORITOS</small><b>${f.length}</b></div><div><small>EM CASA HOJE</small><b>${alerts.filter(x=>x.offset===0).length}</b></div><div><small>EM CASA AMANHÃ</small><b>${alerts.filter(x=>x.offset===1).length}</b></div></div><div class="cpFav147Body">${f.length?`<div class="cpFav147Chips">${f.map(n=>`<span>☆ ${esc(n)}</span>`).join("")}</div>`:""}${!f.length?'<div class="cpFav147Empty"><b>Nenhum time favoritado.</b>Clique na estrela de um time para adicioná-lo.</div>':!alerts.length?'<div class="cpFav147Empty"><b>Nenhum favorito joga em casa nos próximos dias.</b>O alerta aparecerá automaticamente.</div>':[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([off,list])=>`<section class="cpFav147Day"><div class="cpFav147DayTitle"><b>${day(Number(off))}</b><span>${list.length} jogo(s)</span></div>${list.map(x=>`<article class="cpFav147Game"><div class="teams"><strong>${esc(x.home)}</strong><span>x ${esc(x.away)}</span></div><div class="when"><b>${esc(x.time)}</b><small>EM CASA</small></div><div class="league">${esc(x.league)}</div></article>`).join("")}</section>`).join("")}</div>`}
  function open(){const o=overlay(),a=getCache()||window.__cpFav147Alerts||[];render(a);o.classList.add("open");schedule(true,true)}
  async function refresh(force=false,rerender=false){
    if(busy)return;const fav=favorites();if(!fav.size){setCache([]);window.__cpFav147Alerts=[];paint([]);if(rerender)render([]);return}
    if(!force){const c=getCache();if(c){window.__cpFav147Alerts=c;paint(c);if(rerender)render(c);return}}
    busy=true;try{const alerts=[],seen=new Set();for(let off=0;off<4;off++){const games=await fetchDay(ymd(off));for(const g of games){const h=home(g);if(!same(h,fav))continue;const a=away(g),k=`${off}|${norm(h)}|${norm(a)}|${hour(g)}`;if(seen.has(k))continue;seen.add(k);alerts.push({offset:off,home:h,away:a,time:hour(g),league:league(g)})}}alerts.sort((a,b)=>a.offset-b.offset||String(a.time).localeCompare(String(b.time)));setCache(alerts);window.__cpFav147Alerts=alerts;paint(alerts);if(rerender)render(alerts)}finally{busy=false}}
  function schedule(force=false,rerender=false){clearTimeout(timer);timer=setTimeout(()=>refresh(force,rerender),force?450:1500)}

  document.addEventListener("click",e=>{
    const d=desktop(),m=mobile();
    if((d&&d.contains(e.target))||(m&&m.contains(e.target))){e.preventDefault();e.stopPropagation();open();return}
    if(e.target.closest?.("[data-cpfav-close]")){e.preventDefault();close();return}
    const o=document.getElementById("cpFav147Overlay");if(o&&e.target===o){close();return}
    if(e.target.closest?.("[data-v110-fav-team],[data-cpd3-fav],[data-cpd3-hero-fav],[data-cpr-match-fav],[data-cpr-fav],.premiumFavoriteBtn,.mcFavBtn,.cpMatchTeamFav,.v110Fav,.cpd3Fav")){try{localStorage.removeItem(CACHE)}catch{};schedule(true,false)}
  },true);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  window.addEventListener("storage",e=>{if(KEYS.includes(e.key)){try{localStorage.removeItem(CACHE)}catch{};schedule(true,false)}});

  // Sem observer: não cria ciclo de DOM e não bloqueia o card principal do app.
  style();const c=getCache();if(c){window.__cpFav147Alerts=c;setTimeout(()=>paint(c),250)}
  setTimeout(()=>{paint(window.__cpFav147Alerts||[]);schedule(false,false)},2500);
  setInterval(()=>schedule(true,false),15*60*1000);
})();


/* =========================================================
   CORNERPRO DESKTOP AUTH — ÚNICO CONTROLADOR
   Google + e-mail/senha + cadastro + redefinição.
   Mantém Firebase fora do fluxo até o usuário abrir/usar a conta.
   ========================================================= */
(function cornerProDesktopAuthClean(){
  "use strict";
  if (!window.matchMedia || !window.matchMedia("(min-width:981px)").matches) return;
  if (window.__CP_DESKTOP_AUTH_CLEAN__) return;
  window.__CP_DESKTOP_AUTH_CLEAN__ = true;

  let api=null,mode="login",busy=false;
  const $=(s,r=document)=>r.querySelector(s);

  function e(){return{
    modal:$("#cpAuthModal"),login:$("#btnGoogleLogin"),profile:$("#authUserProfile"),photo:$("#authUserPhoto"),nameOut:$("#authUserName"),plan:$("#authUserPlan"),logout:$("#btnGoogleLogout"),
    title:$("#cpAuthModalTitle"),subtitle:$("#cpAuthModalSubtitle"),tabLogin:$("#cpAuthTabLogin"),tabRegister:$("#cpAuthTabRegister"),google:$("#cpAuthGoogle"),form:$("#cpAuthForm"),nameWrap:$("#cpAuthNameWrap"),name:$("#cpAuthName"),email:$("#cpAuthEmail"),password:$("#cpAuthPassword"),confirmWrap:$("#cpAuthConfirmWrap"),confirm:$("#cpAuthPasswordConfirm"),forgot:$("#cpAuthForgot"),submit:$("#cpAuthSubmit"),submitText:$("#cpAuthSubmit span"),switchText:$("#cpAuthSwitchText"),switchBtn:$("#cpAuthSwitchButton"),message:$("#cpAuthFormMessage")
  }}

  function unlock(){const b=e().login;if(!b)return;b.disabled=false;b.removeAttribute("disabled");b.removeAttribute("aria-busy");b.style.pointerEvents="auto";b.style.cursor="pointer";b.style.opacity="1";b.style.visibility="visible"}
  function msg(t="",type="error"){const b=e().message;if(!b)return;b.textContent=t;b.hidden=!t;t?b.dataset.type=type:b.removeAttribute("data-type")}
  function setMode(next){mode=next==="register"?"register":"login";const r=mode==="register",x=e();x.tabLogin?.classList.toggle("active",!r);x.tabRegister?.classList.toggle("active",r);if(x.nameWrap)x.nameWrap.hidden=!r;if(x.confirmWrap)x.confirmWrap.hidden=!r;if(x.forgot)x.forgot.hidden=r;if(x.title)x.title.textContent=r?"Crie sua conta":"Entre no CornerPro";if(x.subtitle)x.subtitle.textContent=r?"Crie seu acesso individual ao CornerPro.":"Entre para acessar sua conta, preferências e plano.";if(x.submitText)x.submitText.textContent=r?"CRIAR CONTA":"ENTRAR";if(x.switchText)x.switchText.textContent=r?"Já possui uma conta?":"Ainda não possui conta?";if(x.switchBtn)x.switchBtn.textContent=r?"Entrar":"Criar conta";msg("")}

  function openModal(){const x=e();if(!x.modal)return console.error("[AUTH] #cpAuthModal ausente");unlock();setMode("login");x.modal.hidden=false;x.modal.removeAttribute("hidden");x.modal.setAttribute("aria-hidden","false");x.modal.style.display="flex";x.modal.style.visibility="visible";x.modal.style.opacity="1";x.modal.style.pointerEvents="auto";x.modal.style.zIndex="2147483647";document.body.classList.add("cpAuthModalOpen");setTimeout(()=>x.email?.focus(),80)}
  function closeModal(){const x=e();if(!x.modal)return;x.modal.hidden=true;x.modal.setAttribute("hidden","");x.modal.setAttribute("aria-hidden","true");x.modal.style.removeProperty("display");x.modal.style.removeProperty("visibility");x.modal.style.removeProperty("opacity");x.modal.style.removeProperty("pointer-events");x.modal.style.removeProperty("z-index");document.body.classList.remove("cpAuthModalOpen");msg("")}
  function setBusy(v){busy=!!v;const x=e();[x.google,x.submit,x.tabLogin,x.tabRegister,x.switchBtn,x.forgot].filter(Boolean).forEach(b=>b.disabled=busy)}
  async function loadApi(){if(api)return api;api=await import("./firebase-client.js?v=20260910-desktop-clean");return api}
  async function serverProfile(user,force=false){const token=await user.getIdToken(force);const a=await fetch("/auth/firebase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),cache:"no-store"});const ad=await a.json().catch(()=>({}));if(!a.ok)throw new Error(ad?.error||"Falha ao autenticar no servidor.");const m=await fetch("/auth/me",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const md=await m.json().catch(()=>({}));if(!m.ok)throw new Error(md?.error||"Falha ao carregar seu perfil.");return{...md,user:md?.user||ad?.user||null,premium:md?.premium===true||ad?.user?.premium===true}}
  function paint(user,profile){const x=e();if(!user){if(x.login){x.login.hidden=false;unlock()}if(x.profile)x.profile.hidden=true;return}if(x.login)x.login.hidden=true;if(x.profile)x.profile.hidden=false;const n=user.displayName||profile?.user?.nome||user.email?.split("@")[0]||"Usuário",p=profile?.premium===true||profile?.user?.premium===true;if(x.nameOut)x.nameOut.textContent=n;if(x.plan)x.plan.textContent=p?"CORNERPRO PRO":"PLANO GRATUITO";if(x.photo){if(user.photoURL){x.photo.src=user.photoURL;x.photo.hidden=false}else{x.photo.hidden=true;x.photo.removeAttribute("src")}}}

  async function google(){if(busy)return;setBusy(true);msg("");try{const a=await loadApi(),r=await a.entrarComGoogle(),u=r?.usuario||r?.user||a.firebaseAuth?.currentUser;if(!u)throw new Error("Não foi possível confirmar sua conta Google.");paint(u,await serverProfile(u,true));closeModal()}catch(err){console.error("[AUTH Google]",err);msg(err?.message||"Não foi possível entrar com o Google.")}finally{setBusy(false)}}
  async function submit(){if(busy)return;const x=e(),nome=String(x.name?.value||"").trim(),email=String(x.email?.value||"").trim(),senha=String(x.password?.value||""),conf=String(x.confirm?.value||"");if(!email)return msg("Digite seu e-mail.");if(!senha)return msg("Digite sua senha.");if(senha.length<6)return msg("A senha precisa ter pelo menos 6 caracteres.");if(mode==="register"&&!nome)return msg("Digite seu nome.");if(mode==="register"&&senha!==conf)return msg("As senhas não coincidem.");setBusy(true);msg("");try{const a=await loadApi(),r=mode==="register"?await a.criarContaComEmail({nome,email,senha}):await a.entrarComEmail({email,senha}),u=r?.usuario||r?.user||a.firebaseAuth?.currentUser;if(!u)throw new Error("Não foi possível confirmar sua conta.");paint(u,await serverProfile(u,true));closeModal()}catch(err){console.error("[AUTH Email]",err);msg(err?.message||"Não foi possível concluir a autenticação.")}finally{setBusy(false)}}
  async function forgot(){const email=String(e().email?.value||"").trim();if(!email)return msg("Digite seu e-mail primeiro.");if(busy)return;setBusy(true);try{const a=await loadApi();await a.redefinirSenha(email);msg("Link de redefinição enviado para seu e-mail.","success")}catch(err){msg(err?.message||"Não foi possível enviar o link.")}finally{setBusy(false)}}
  async function logout(){if(busy)return;setBusy(true);try{const a=await loadApi();await a.sairDaConta();paint(null,null)}catch(err){console.error("[AUTH logout]",err)}finally{setBusy(false)}}

  document.addEventListener("click",ev=>{
    if(!window.matchMedia("(min-width:981px)").matches)return;
    if(ev.target?.closest?.("#btnGoogleLogin")){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();openModal();return}
    if(ev.target?.closest?.("#cpAuthGoogle")){ev.preventDefault();ev.stopImmediatePropagation();google();return}
    if(ev.target?.closest?.("#cpAuthTabLogin")){ev.preventDefault();ev.stopImmediatePropagation();setMode("login");return}
    if(ev.target?.closest?.("#cpAuthTabRegister")){ev.preventDefault();ev.stopImmediatePropagation();setMode("register");return}
    if(ev.target?.closest?.("#cpAuthSwitchButton")){ev.preventDefault();ev.stopImmediatePropagation();setMode(mode==="login"?"register":"login");return}
    if(ev.target?.closest?.("#cpAuthForgot")){ev.preventDefault();ev.stopImmediatePropagation();forgot();return}
    if(ev.target?.closest?.("#cpAuthModalClose,#cpAuthModalBackdrop")){ev.preventDefault();ev.stopImmediatePropagation();closeModal();return}
    if(ev.target?.closest?.("#btnGoogleLogout")){ev.preventDefault();ev.stopImmediatePropagation();logout();return}
  },true);
  document.addEventListener("submit",ev=>{if(ev.target?.id!=="cpAuthForm")return;ev.preventDefault();ev.stopImmediatePropagation();submit()},true);

  function init(){unlock();loadApi().then(a=>a.observarAutenticacao?.(async st=>{const u=st?.usuario||st?.user||a.firebaseAuth?.currentUser||null;if(!u)return paint(null,null);try{paint(u,await serverProfile(u))}catch{paint(u,null)}})).catch(err=>{console.warn("[AUTH init]",err);unlock()})}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();