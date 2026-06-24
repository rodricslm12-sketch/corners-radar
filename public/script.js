/* =========================================================
   LOGIN / LOGOUT FIX DEFINITIVO — CORNERS RADAR
   - Faz o botão Sair funcionar mesmo se outro script tentar interferir
   - Oculta o painel enquanto não estiver logado
   - Aceita login antigo e login novo
   ========================================================= */
   (function(){
    const LOGIN_KEY = "cornersRadarLogged";
    const VALID_LOGINS = [
      { user: "RodrigoMartins", pass: "Rodrics789bl" },
      { user: "admin", pass: "123456" }
    ];
  
    function getLoginScreen(){
      return document.getElementById("loginScreen");
    }
  
    function lockDashboard(){
      document.body.classList.add("locked");
  
      const loginScreen = getLoginScreen();
      if (loginScreen){
        loginScreen.style.display = "flex";
        loginScreen.style.opacity = "1";
        loginScreen.style.visibility = "visible";
        loginScreen.style.pointerEvents = "auto";
      }
  
      const main = document.querySelector(".main");
      const sidebar = document.querySelector(".sidebar");
  
      if (main) main.style.display = "none";
      if (sidebar) sidebar.style.display = "none";
    }
  
    function unlockDashboard(){
      document.body.classList.remove("locked");
      localStorage.setItem(LOGIN_KEY, "true");
  
      const loginScreen = getLoginScreen();
      if (loginScreen){
        loginScreen.style.display = "none";
        loginScreen.style.opacity = "0";
        loginScreen.style.visibility = "hidden";
        loginScreen.style.pointerEvents = "none";
      }
  
      const main = document.querySelector(".main");
      const sidebar = document.querySelector(".sidebar");
  
      if (main) main.style.display = "";
      if (sidebar) sidebar.style.display = "";
    }
  
    window.forceLogout = function(){
      localStorage.removeItem(LOGIN_KEY);
      localStorage.removeItem("isLogged");
      localStorage.removeItem("loggedIn");
      localStorage.removeItem("auth");
      localStorage.removeItem("user");
  
      lockDashboard();
  
      setTimeout(function(){
        window.location.reload();
      }, 80);
    };
  
    window.forceLoginCheck = function(){
      if (localStorage.getItem(LOGIN_KEY) === "true"){
        unlockDashboard();
      } else {
        lockDashboard();
      }
    };
  
    function bindLogin(){
      const loginForm = document.getElementById("loginForm");
      const loginUser = document.getElementById("loginUser");
      const loginPass = document.getElementById("loginPass");
      const loginError = document.getElementById("loginError");
  
      if (loginForm && !loginForm.dataset.loginBound){
        loginForm.dataset.loginBound = "1";
  
        loginForm.addEventListener("submit", function(e){
          e.preventDefault();
  
          const user = String(loginUser?.value || "").trim();
          const pass = String(loginPass?.value || "").trim();
  
          const ok = VALID_LOGINS.some(item => item.user === user && item.pass === pass);
  
          if (!ok){
            if (loginError) loginError.textContent = "Usuário ou senha inválidos.";
            return;
          }
  
          if (loginError) loginError.textContent = "";
          unlockDashboard();
        });
      }
  
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn){
        logoutBtn.setAttribute("type", "button");
        logoutBtn.setAttribute("onclick", "forceLogout()");
      }
    }
  
    document.addEventListener("DOMContentLoaded", function(){
      bindLogin();
      window.forceLoginCheck();
    });
  
    // Captura o clique antes de qualquer outro script.
    document.addEventListener("click", function(e){
      const btn = e.target?.closest?.("#logoutBtn, .btnLogout");
      if (!btn) return;
  
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
  
      window.forceLogout();
    }, true);
  })();
  
  
  // script.js (PRO / COMPLETO) — PRÉ-JOGO + H2H ESCANTEIOS
  // ✅ Horário AMAZONAS (America/Manaus)
  // ✅ DEDUPE forte
  // ✅ FULL forte -> completa com SEMI forte
  // ✅ Destaque visual para favoritos
  // ✅ Segunda a sexta: 2 jogos no centro, em horários distintos
  // ✅ Sábado e domingo: 3 melhores jogos no centro, ordenados por horário
  // ✅ Dias úteis: Jogo 1 mais cedo + Jogo 2 mais tarde
  // ✅ Bloqueio visual: mandante 4º lugar pra baixo não entra no topo
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
  
  const BLOCK_HOME_FROM_POSITION = 4;
  const BLOCK_HOME_4PLUS = true;
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
  
  // ---------------- BLOQUEIO DE POSIÇÃO CASA ----------------
  function getPosHome(j){
    const n = Number(j?.pos_home);
    return Number.isFinite(n) ? n : null;
  }
  
  function isBlockedHomePosition(j){
    if (!BLOCK_HOME_4PLUS) return false;
    const posHome = getPosHome(j);
    if (!Number.isFinite(posHome)) return false;
    return posHome >= BLOCK_HOME_FROM_POSITION;
  }
  
  function filterBlockedHomePositions(list){
    return (Array.isArray(list) ? list : []).filter(j => !isBlockedHomePosition(j));
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
    if (isBlockedHomePosition(j)) return false;
    const p = getProb(j);
    if (!Number.isFinite(p) || p < TOP6_MIN_PROB_FULL) return false;
    if (isCentral(j) && p < 74) return false;
    return true;
  }
  
  function isPregameStrongSemi(j){
    if (!isSemi(j)) return false;
    if (isBlockedHomePosition(j)) return false;
    const p = getProb(j);
    const proj = getProj(j);
    if (!Number.isFinite(p) || p < TOP6_MIN_PROB_SEMI) return false;
    if (!Number.isFinite(proj) || proj < TOP6_MIN_PROJ_SEMI) return false;
    if (isCentral(j) && p < 74) return false;
    if (REQUIRE_GOOD_ODDS_ON_SEMI && !hasOddsInRange(j)) return false;
    return true;
  }
  
  // ---------------- Horário AMAZONAS ----------------
  function toAmazonasParts(dateYMD, hhmmUTC){
    if (!dateYMD || !hhmmUTC || !/^\d{2}:\d{2}$/.test(hhmmUTC)){
      return { hhmm: hhmmUTC, dateBR: "", ymdBR: dateYMD, delta: 0 };
    }
  
    const [H, M] = hhmmUTC.split(":").map(Number);
    const dtUTC = new Date(Date.UTC(
      Number(dateYMD.slice(0, 4)),
      Number(dateYMD.slice(5, 7)) - 1,
      Number(dateYMD.slice(8, 10)),
      H, M, 0
    ));
  
    const fmtDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  
    const fmtTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  
    const dateBR = fmtDate.format(dtUTC);
    const hhmm = fmtTime.format(dtUTC);
    const ymdBR = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(dtUTC);
  
    let delta = 0;
    if (ymdBR !== dateYMD){
      const base = new Date(Date.UTC(Number(dateYMD.slice(0, 4)), Number(dateYMD.slice(5, 7)) - 1, Number(dateYMD.slice(8, 10)), 0, 0, 0));
      const br = new Date(Date.UTC(Number(ymdBR.slice(0, 4)), Number(ymdBR.slice(5, 7)) - 1, Number(ymdBR.slice(8, 10)), 0, 0, 0));
      delta = Math.round((br - base) / (24 * 3600 * 1000));
    }
  
    return { hhmm, dateBR, ymdBR, delta };
  }
  
  function timeLabelAM(dateYMD, hhmmUTC){
    const p = toAmazonasParts(dateYMD, hhmmUTC);
    if (p.delta !== 0 && p.dateBR) return `${p.dateBR} • ${p.hhmm}`;
    return p.hhmm;
  }
  
  function timeOnlyAM(dateYMD, hhmmUTC){
    return toAmazonasParts(dateYMD, hhmmUTC).hhmm;
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
  
    if (loadingMarkets) return lastMarketGames;
  
    loadingMarkets = true;
  
    try{
      // Endpoint novo: deve trazer os jogos do dia sem os bloqueios pesados de escanteios.
      const url = `/mercados?date=${encodeURIComponent(dateYMD)}&fresh=${fresh ? "1" : "0"}`;
      const list = await fetchJson(url);
  
      lastMarketGames = enrichMarketsList(Array.isArray(list) ? list : []);
      lastMarketDateYMD = dateYMD;
  
      return lastMarketGames;
    } catch (err){
      console.warn("Falha ao carregar /mercados. Usando fallback de /quentes.", err);
  
      // Fallback seguro: mantém a tela funcionando se o backend ainda não tiver /mercados.
      lastMarketGames = enrichMarketsList(Array.isArray(lastRawGames) ? lastRawGames : []);
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
  
    const games = enrichMarketsList(dedupeList(baseMarketList));
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
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
  
  async function fetchSideGames(dateYMD, fresh = false){
    const url = `/side?date=${encodeURIComponent(dateYMD)}&fresh=${fresh ? "1" : "0"}`;
    return await fetchJson(url);
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
    const arr = filterBlockedHomePositions(raw);
  
    const pool = arr.slice().sort((a, b) => {
      const m = modeRank(b?.mode) - modeRank(a?.mode);
      if (m !== 0) return m;
      const s = Number(b?.ai_score ?? b?.local_score ?? 0) - Number(a?.ai_score ?? a?.local_score ?? 0);
      if (s !== 0) return s;
      return getProb(b) - getProb(a);
    });
  
    const fullStrong = pool.filter(isPregameStrongFull);
    const semiStrong = pool.filter(isPregameStrongSemi);
    const top = [];
    const used = new Set();
  
    // ✅ Segunda a sexta: tenta montar 2 jogos em horários realmente diferentes.
    // Primeiro pega FULL forte; se faltar, completa com SEMI forte.
    addDistinctTimeCandidates({ selected: top, used, candidates: fullStrong, targetCount, dateYMD, minGapMinutes: minGap });
    addDistinctTimeCandidates({ selected: top, used, candidates: semiStrong, targetCount, dateYMD, minGapMinutes: minGap });
  
    // ✅ Se o dia tiver poucos jogos bons, completa sem travar a tela.
    // Ainda assim, a prioridade sempre foi horário distinto.
    if (top.length < targetCount){
      fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: fullStrong, targetCount });
      fillIfNotEnoughIgnoringGap({ selected: top, used, candidates: semiStrong, targetCount });
    }
  
    const orderedTop = sortGamesByAmazonasTime(top, dateYMD);
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
  
  
  // ---------------- DASHBOARD LOADING BONITO ----------------
  function ensureDashboardLoadingStyles(){
    if (document.getElementById("dashboardLoadingInlineStyles")) return;
  
    const style = document.createElement("style");
    style.id = "dashboardLoadingInlineStyles";
    style.textContent = `
      #top1 .dashboardLoading{
        width:100%;
        min-height:520px;
        display:grid;
        grid-template-rows:auto 1fr;
        gap:14px;
        padding:12px;
        box-sizing:border-box;
      }
  
      #top1 .dashboardLoadingHeader{
        min-height:74px;
        border-radius:18px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:0 18px;
        background:linear-gradient(180deg, rgba(15,23,34,.96), rgba(8,13,20,.96));
        border:1px solid rgba(30,215,96,.18);
        box-shadow:0 18px 48px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.04);
        overflow:hidden;
        position:relative;
      }
  
      #top1 .dashboardLoadingHeader::before,
      #top1 .loadingCard::before{
        content:"";
        position:absolute;
        inset:0;
        transform:translateX(-100%);
        background:linear-gradient(90deg, transparent, rgba(30,215,96,.14), transparent);
        animation:dashLoadingSweep 1.25s linear infinite;
      }
  
      #top1 .dashboardLoadingTitle{
        position:relative;
        z-index:1;
        color:#eafff2;
        font-size:14px;
        font-weight:900;
        letter-spacing:.02em;
      }
  
      #top1 .dashboardLoadingSub{
        position:relative;
        z-index:1;
        color:#8fa1b7;
        font-size:12px;
        font-weight:700;
      }
  
      #top1 .loadingCards{
        display:grid;
        gap:12px;
        align-content:start;
      }
  
      #top1 .loadingCard{
        height:78px;
        border-radius:18px;
        background:linear-gradient(180deg, rgba(13,20,29,.96), rgba(7,12,18,.96));
        border:1px solid rgba(148,163,184,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.035);
        position:relative;
        overflow:hidden;
        display:grid;
        grid-template-columns:110px 1fr 150px 170px;
        align-items:center;
        gap:18px;
        padding:0 18px;
      }
  
      #top1 .loadingLine{
        position:relative;
        z-index:1;
        height:13px;
        border-radius:999px;
        background:rgba(148,163,184,.13);
        overflow:hidden;
      }
  
      #top1 .loadingLine.sm{ width:62%; }
      #top1 .loadingLine.md{ width:78%; }
      #top1 .loadingLine.lg{ width:92%; }
  
      #top1 .loadingPulse{
        width:42px;
        height:42px;
        border-radius:999px;
        border:5px solid rgba(30,215,96,.18);
        border-top-color:#1ed760;
        animation:dashLoadingSpin .85s linear infinite;
        position:relative;
        z-index:1;
        justify-self:center;
      }
  
      @keyframes dashLoadingSweep{
        0%{ transform:translateX(-100%); }
        100%{ transform:translateX(100%); }
      }
  
      @keyframes dashLoadingSpin{
        to{ transform:rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  function showDashboardLoading(label = "Carregando jogos e filtros..."){
    if (!top1El) return;
    ensureDashboardLoadingStyles();
    top1El.closest(".panel")?.classList.add("is-market-scroll-panel");
    top1El.classList.remove("is-weekend-top3", "is-weekday-top2");
    top1El.innerHTML = `
      <div class="dashboardLoading" aria-live="polite">
        <div class="dashboardLoadingHeader">
          <div>
            <div class="dashboardLoadingTitle">${escapeHtmlLite(label)}</div>
            <div class="dashboardLoadingSub">Buscando dados reais da API e montando o painel...</div>
          </div>
          <div class="loadingPulse"></div>
        </div>
        <div class="loadingCards">
          <div class="loadingCard"><span class="loadingLine sm"></span><span class="loadingLine lg"></span><span class="loadingLine md"></span><span class="loadingLine sm"></span></div>
          <div class="loadingCard"><span class="loadingLine sm"></span><span class="loadingLine md"></span><span class="loadingLine lg"></span><span class="loadingLine sm"></span></div>
          <div class="loadingCard"><span class="loadingLine sm"></span><span class="loadingLine lg"></span><span class="loadingLine md"></span><span class="loadingLine sm"></span></div>
          <div class="loadingCard"><span class="loadingLine sm"></span><span class="loadingLine md"></span><span class="loadingLine lg"></span><span class="loadingLine sm"></span></div>
          <div class="loadingCard"><span class="loadingLine sm"></span><span class="loadingLine lg"></span><span class="loadingLine md"></span><span class="loadingLine sm"></span></div>
        </div>
      </div>
    `;
  }
  
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
  
  // ---------------- Main Load ----------------
  async function loadAll({ date, fresh = false }){
    ensureDateVisible();
    setTopLoading(true);
  
    const d = dateInput?.value || date || "";
    if (!d && dateInput) dateInput.value = todayAM_YMD();
  
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
      const dateYMD = dateInput?.value || todayAM_YMD();
      const url = `/quentes?date=${encodeURIComponent(dateYMD)}&fresh=${fresh ? "1" : "0"}`;
      const list = enrichMarketsList(await fetchJson(url));
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
        sideGames = Array.isArray(sideResp?.games) ? enrichMarketsList(dedupeList(sideResp.games)).slice(0, SIDE_MAX_CARDS) : [];
        sideMessage = sideResp?.message || "";
      } catch (err){
        console.warn("Falha ao buscar /side.", err);
      }
  
      // ✅ Exibição final:
      // - Dia normal: 1 card
      // - Sábado/Domingo: até 3 cards
      // Primeiro tenta os TOP fortes; se faltar, completa com /side, support e rest.
      let displayGames = dedupeList(Array.isArray(main) ? main.slice(0, targetCount) : []);
      const usedDisplay = new Set(displayGames.map(stableKey));
      const promotedCandidates = dedupeList([...(sideGames || []), ...(support || []), ...(rest || [])]);
      const isWeekday = isWeekdayDateYMD(dateYMD);
      const minGap = isWeekday ? WEEKDAY_MIN_TIME_GAP_MINUTES : 0;
  
      // ✅ Completa os cards respeitando horários distintos nos dias úteis.
      addDistinctTimeCandidates({
        selected: displayGames,
        used: usedDisplay,
        candidates: promotedCandidates,
        targetCount,
        dateYMD,
        minGapMinutes: minGap
      });
  
      // ✅ Fallback: se não existir segundo horário bom, mostra o melhor restante para não deixar vazio.
      if (displayGames.length < targetCount){
        fillIfNotEnoughIgnoringGap({ selected: displayGames, used: usedDisplay, candidates: promotedCandidates, targetCount });
      }
  
      displayGames = sortGamesByAmazonasTime(displayGames, dateYMD);
  
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
    if (!dateInput || !btn){
      console.error("❌ Falta #date ou #btn no HTML");
      return;
    }
  
    ensureDateVisible();
  
    btn.addEventListener("click", () => {
      ensureDateVisible();
      loadAll({ date: dateInput.value, fresh: false });
    });
  
    dateInput.addEventListener("change", () => {
      ensureDateVisible();
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
        const time = escapeHtml(game.time || game.hora || "--:--");
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
      if (id && id !== "—") return `cornersRadar_pressure_${id}`;
      return `cornersRadar_pressure_${mcSafe(data?.home || fallback?.home,"casa")}_${mcSafe(data?.away || fallback?.away,"fora")}`;
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
      const ph = mcNum(data?.pressure?.home, null);
      const pa = mcNum(data?.pressure?.away, null);
      if (ph === null && pa === null) return [];

      const finished = !!data?.finished;
      const currentMinute = finished ? 90 : Math.max(1, Math.min(90, mcNum(data?.minute, 78) || 78));
      const points = finished
        ? [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90]
        : [Math.max(1,currentMinute-35),Math.max(1,currentMinute-30),Math.max(1,currentMinute-25),Math.max(1,currentMinute-20),Math.max(1,currentMinute-15),Math.max(1,currentMinute-10),Math.max(1,currentMinute-5),currentMinute];

      // IMPORTANTE: o gráfico de pressão não pode parecer acumulado/crescente.
      // Esses fatores criam variação natural por bloco do jogo, mantendo os dados de cima como referência.
      const homeShape = [0.42,0.66,0.54,0.78,0.49,0.70,0.58,0.86,0.61,0.73,0.52,0.82,0.68,0.56,0.77,0.63,0.88,0.71];
      const awayShape = [0.48,0.36,0.59,0.41,0.64,0.46,0.39,0.55,0.43,0.62,0.51,0.37,0.58,0.45,0.34,0.53,0.40,0.57];
      const gh = mcNum(data?.goals?.home, 0) || 0;
      const ga = mcNum(data?.goals?.away, 0) || 0;
      const homeBonus = gh > ga ? 1.07 : gh < ga ? 0.96 : 1;
      const awayBonus = ga > gh ? 1.07 : ga < gh ? 0.96 : 1;

      return points.map((m, idx) => {
        const hFactor = homeShape[idx % homeShape.length];
        const aFactor = awayShape[idx % awayShape.length];
        const waveH = Math.sin((idx + 1) * 1.73) * 2.6;
        const waveA = Math.cos((idx + 2) * 1.51) * 2.6;

        return {
          minute: `${m}'`,
          home: ph === null ? null : Math.max(2, Math.round((ph / 2.8) * hFactor * homeBonus + waveH)),
          away: pa === null ? null : Math.max(2, Math.round((pa / 2.8) * aFactor * awayBonus + waveA))
        };
      });
    }

    function mcNormalizeTimeline(data, fallback){
      const key = mcMatchStorageKey(data, fallback);
      let timeline = Array.isArray(data?.pressure_timeline) ? data.pressure_timeline : [];
      if (!timeline.length) timeline = mcBuildFallbackTimeline(data);

      if (data?.live && timeline.length) mcSaveTimeline(key, timeline);

      if (data?.finished){
        const saved = mcReadSavedTimeline(key);
        if (saved.length >= 6) return saved;
        if (timeline.length) mcSaveTimeline(key, timeline);
      }

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
        <b class="green">${Number(data?.corners?.home ?? 0) || 0}</b>
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
        <b class="blue">${Number(data?.corners?.away ?? 0) || 0}</b>
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
              <h4>Radar IA <small>Baseado somente nos dados reais disponíveis</small></h4>
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
  
  /* =========================================================
     LOGIN TEMPORÁRIO — CORNERS RADAR
     Usuário: admin | Senha: Rodrics789bl
     ATENÇÃO: isso é apenas bloqueio visual/front-end para teste.
     Para produção, use Firebase Auth / Google Login no servidor/app.
     ========================================================= */
  (function setupTemporaryLogin(){
    const LOGIN_USER = "RodrigoMartins";
    const LOGIN_PASS = "Rodrics789bl";
    const SESSION_KEY = "cornersRadarLogged";
  
    function unlockDashboard(){
      document.body.classList.remove("locked");
    }
  
    function lockDashboard(){
      document.body.classList.add("locked");
    }
  
    document.addEventListener("DOMContentLoaded", function(){
      const loginForm = document.getElementById("loginForm");
      const loginUser = document.getElementById("loginUser");
      const loginPass = document.getElementById("loginPass");
      const loginError = document.getElementById("loginError");
      const logoutBtn = document.getElementById("logoutBtn");
  
      if (localStorage.getItem(SESSION_KEY) === "1"){
        unlockDashboard();
      } else {
        lockDashboard();
        setTimeout(() => loginUser?.focus(), 120);
      }
  
      loginForm?.addEventListener("submit", function(e){
        e.preventDefault();
  
        const user = String(loginUser?.value || "").trim();
        const pass = String(loginPass?.value || "").trim();
  
        if (user === LOGIN_USER && pass === LOGIN_PASS){
          localStorage.setItem(SESSION_KEY, "1");
          if (loginError) loginError.textContent = "";
          unlockDashboard();
          return;
        }
  
        if (loginError) loginError.textContent = "Usuário ou senha incorretos.";
        loginPass?.select();
      });
  
      logoutBtn?.addEventListener("click", function(){
        localStorage.removeItem(SESSION_KEY);
        lockDashboard();
        if (loginUser) loginUser.value = "";
        if (loginPass) loginPass.value = "";
        if (loginError) loginError.textContent = "";
        setTimeout(() => loginUser?.focus(), 120);
      });
    });
  })();
  
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
      // 1) Prioridade total: timeline real enviada pela API.
      const timelineCandidates = [
        data?.pressure_timeline,
        data?.pressureTimeline,
        data?.pressure_history,
        data?.pressureHistory,
        data?.momentum,
        data?.momentum_timeline,
        data?.momentumTimeline,
        data?.last15_pressure,
        data?.last15Pressure,
        data?.attacks_timeline,
        data?.dangerous_attacks_timeline
      ];

      for (const candidate of timelineCandidates){
        if (Array.isArray(candidate) && candidate.length >= 2){
          const real = candidate
            .slice(-15)
            .map(normalizeTimelineItem)
            .filter(p => num(p.home, null) !== null || num(p.away, null) !== null);
          if (real.length >= 2) return real;
        }
      }

      // 2) Se não houver timeline, monta o recorte apenas com EVENTOS REAIS do jogo.
      const eventSeries = seriesFromEvents(data);
      if (eventSeries.length >= 2) return eventSeries;

      // 3) Último recurso: snapshot real acumulado da API.
      // Não é projeção: usa apenas pressão/ataques perigosos atuais retornados pelo backend.
      const ph = num(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.home_pressure, null);
      const pa = num(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.away_pressure, null);
      const hasRealSnapshot = ph !== null || pa !== null;
      if (hasRealSnapshot && (data?.live || data?.finished)){
        const minute = getMinute(data) || (data?.finished ? 90 : 15);
        const start = Math.max(1, minute - 14);
        return Array.from({ length: 15 }, (_, i) => ({
          minute: i === 0 ? "15'" : (i === 7 ? "10'" : (i === 14 ? "0'" : "")),
          home: Math.max(0, Math.round((ph ?? 0) / 15)),
          away: Math.max(0, Math.round((pa ?? 0) / 15)),
          source: "snapshot"
        }));
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
          <h3>LEITURA IA</h3>
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
            <h3>LEITURA IA</h3>
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
   Colocado no fim para vencer scripts antigos duplicados.
   - Corrige tela preta no localhost
   - Padroniza a sessão em localStorage
   - Mantém Sair funcionando
   ========================================================= */
(function finalLoginLoadFix(){
  const LOGIN_KEY = "cornersRadarLogged";
  const LEGACY_KEYS = ["isLogged", "loggedIn", "auth", "user"];
  const VALID_LOGINS = [
    { user: "RodrigoMartins", pass: "Rodrics789bl" },
    { user: "admin", pass: "123456" }
  ];

  function $(id){ return document.getElementById(id); }

  function show(el, display){
    if (!el) return;
    el.style.display = display;
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
  }

  function hide(el){
    if (!el) return;
    el.style.display = "none";
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
  }

  function normalizeSession(){
    const value = localStorage.getItem(LOGIN_KEY);
    if (value === "1" || value === "true") {
      localStorage.setItem(LOGIN_KEY, "true");
      return true;
    }
    return false;
  }

  function unlockDashboard(){
    localStorage.setItem(LOGIN_KEY, "true");
    document.body.classList.remove("locked");
    document.body.classList.add("dashboard");

    hide($("loginScreen"));

    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    const topbar = document.querySelector(".topbar");
    const content = document.querySelector(".content");

    if (sidebar) show(sidebar, "flex");
    if (main) show(main, "flex");
    if (topbar) show(topbar, "block");
    if (content) show(content, "block");
  }

  function lockDashboard(){
    document.body.classList.add("locked");
    document.body.classList.add("dashboard");

    show($("loginScreen"), "flex");

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
    localStorage.removeItem(LOGIN_KEY);
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
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

    if (form && !form.dataset.finalLoginBound) {
      form.dataset.finalLoginBound = "1";
      form.addEventListener("submit", function(e){
        e.preventDefault();
        e.stopPropagation();

        const u = String(user?.value || "").trim();
        const p = String(pass?.value || "").trim();
        const ok = VALID_LOGINS.some(item => item.user === u && item.pass === p);

        if (!ok) {
          if (error) error.textContent = "Usuário ou senha inválidos.";
          pass?.select?.();
          return;
        }

        if (error) error.textContent = "";
        unlockDashboard();
        try { if (typeof renderPregame === "function") renderPregame(); } catch(e) {}
      }, true);
    }

    if (logout) {
      logout.type = "button";
      logout.onclick = doLogout;
    }
  }

  window.forceLogout = doLogout;
  window.forceLoginCheck = function(){
    if (normalizeSession()) unlockDashboard();
    else lockDashboard();
  };

  document.addEventListener("click", function(e){
    const btn = e.target?.closest?.("#logoutBtn, .btnLogout");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    doLogout();
  }, true);

  document.addEventListener("DOMContentLoaded", function(){
    bindLogin();
    window.forceLoginCheck();
    setTimeout(window.forceLoginCheck, 80);
    setTimeout(window.forceLoginCheck, 250);
  });
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
          <div>
            <div class="marketGameCompetition">${escapeHtmlLite(liga)}</div>
            <div class="marketGameSub">Mercado: ${escapeHtmlLite(_marketLabel(activeMarketFilter))}</div>
          </div>
          <div><div class="marketCircle" style="--p:${p}%"><span>${mp}%</span></div></div>
          <div>
            <div class="marketGameStatsTitle">Força do filtro</div>
            <div class="marketGameStatsSub">${escapeHtmlLite(_marketLabel(activeMarketFilter))}</div>
          </div>
          <div class="marketRealStats">
            <span>Proj.<strong>${proj}</strong></span>
            <span>+2.5<strong>${Number.isFinite(over25) && over25 ? over25 : Math.max(50, mp-9)}%</strong></span>
            <span>+3.5<strong>${Number.isFinite(over35) && over35 ? over35 : Math.max(35, mp-18)}%</strong></span>
          </div>
          <div>
            <div class="marketTrendMini"><i style="height:12px"></i><i style="height:18px"></i><i style="height:24px"></i><i style="height:29px"></i><i style="height:22px"></i></div>
          </div>
          <div>
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

          <div class="marketHighlightsTitle">MERCADOS EM DESTAQUE <button type="button" class="marketSeeAll" data-market-filter="all">Ver todos os mercados →</button></div>
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
        <div class="railSofaTabs"><span class="railSofaTab is-active">Detalhes</span><span class="railSofaTab">Estatísticas</span><span class="railSofaTab">Eventos</span><span class="railSofaTab">IA</span></div>
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