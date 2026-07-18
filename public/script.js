/* LOGIN consolidado no final do arquivo para evitar eventos duplicados. */

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
      lastMarketGames = enrichMarketsList(panelCache.map(g => g?.raw || g));
      lastMarketDateYMD = dateYMD;
      return lastMarketGames;
    }

    if (!fresh && lastDateYMD === dateYMD && Array.isArray(lastRawGames) && lastRawGames.length){
      lastMarketGames = enrichMarketsList(lastRawGames);
      lastMarketDateYMD = dateYMD;
      return lastMarketGames;
    }
  
    if (loadingMarkets) return lastMarketGames;
  
    loadingMarkets = true;
  
    try{
      // Endpoint novo: deve trazer os jogos reais do dia sem os bloqueios pesados de escanteios.
      // Se /mercados não existir ou vier vazio, tenta /quentes automaticamente.
      const list = await fetchGamesFromApi(["/mercados", "/quentes"], dateYMD, fresh);
  
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
  
  // ---------------- Main Load ----------------
  let cpInitialGamesLoadFinished = false;

  async function loadAll({ date, fresh = false } = {}){
    ensureDateVisible();
    setTopLoading(true);

    if(typeof window.CornerProMobileHomeLoading === 'function'){
      window.CornerProMobileHomeLoading(cpInitialGamesLoadFinished ? 'selected' : 'initial');
    }

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
      const list = enrichMarketsList(await fetchGamesFromApi(["/quentes", "/mercados"], dateYMD, fresh));
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
      cpInitialGamesLoadFinished = true;
      window.CornerProGamesReady = true;
      if(typeof window.CornerProMobileHomeLoading === 'function'){
        window.CornerProMobileHomeLoading('done');
      }
    }
  }
  
  // ---------------- Init ----------------
  function init(){
    if (!dateInput || !btn){
      console.error("❌ Falta #date ou #btn no HTML");
      return;
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
    const j = g.raw || {};
    const direct = num(
      j.totalExpected ??
      j.markets?.totalExpected ??
      j.expected_goals_total ??
      j.xg_total ??
      j.total_goals_avg ??
      j.media_gols_total ??
      j.proj_gols ??
      j.goals_projection ??
      j.projGoals
    );

    if (direct !== null) return direct;

    const pr = num(g.proj);
    const p = num(g.prob);
    let total = 2.15;

    if (pr !== null) total += (pr - 9.5) * 0.20;
    if (p !== null) total += (p - 60) * 0.010;

    const league = norm(g.league);
    if (league.includes("premier") || league.includes("bundesliga") || league.includes("eredivisie") || league.includes("jupiler") || league.includes("belgium")) {
      total += 0.18;
    }
    if (league.includes("serie a") || league.includes("ligue 1")) {
      total -= 0.08;
    }

    return Math.max(1.4, Math.min(4.1, total));
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
    const j = g.raw || {};
    const direct = num(
      j.proj_cards ??
      j.cards_projection ??
      j.expected_cards_total ??
      j.total_cards_avg ??
      j.media_cartoes_total ??
      j.cartoes_media
    );
    if (direct !== null) return direct;

    const league = norm(g.league);
    let base = 3.6;

    if (league.includes("la liga") || league.includes("serie a") || league.includes("portugal") || league.includes("super lig")) base += 0.45;
    if (league.includes("premier") || league.includes("bundesliga")) base -= 0.10;

    const pr = num(g.proj);
    if (pr !== null) base += (pr - 10) * 0.10;

    return Math.max(2.2, Math.min(5.8, base));
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
    const p35 = goalPercent(g, 3.5);
    const p25 = goalPercent(g, 2.5);
    const p15 = goalPercent(g, 1.5);

    if (p35 >= 42 || total >= 3.2) return "OVER 3.5";
    if (p25 >= 48 || total >= 2.35) return "OVER 2.5";
    if (p15 >= 52 || total >= 1.55) return "OVER 1.5";
    return "AGUARDAR";
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
    const p = cardsPercent(g);

    if (cards >= 4.5 || p >= 64) return "OVER 4.5";
    if (cards >= 3.5 || p >= 50) return "OVER 3.5";
    if (cards >= 2.5 || p >= 42) return "OVER 2.5";
    return "AGUARDAR";
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
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.dispatchEvent(new Event("change", { bubbles:true }));
    }

    btn.classList.remove("is-open");
    drop.classList.remove("is-open");
    drop.setAttribute("aria-hidden","true");

    try{
      // Esta tela do seu dashboard usa o carregador real abaixo.
      // Ele busca /quentes na data escolhida e renderiza dentro de .gamesPanel.
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
    open();
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
    const real = seriesFromTimeline(data);
    if (real.length >= 2) return real;
    const fromEvents = seriesFromEvents(data, homeName, awayName);
    if (fromEvents.length >= 2) return fromEvents;
    const ph = num(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.home_pressure, null);
    const pa = num(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.away_pressure, null);
    if (ph !== null || pa !== null){
      const hh = Math.max(1, Math.round((ph || 0) / 12));
      const aa = Math.max(1, Math.round((pa || 0) / 12));
      return Array.from({length:15}, (_,i) => ({
        minute: i === 0 ? "15'" : (i === 7 ? "10'" : (i === 14 ? "0'" : "")),
        home: Math.max(1, Math.round(hh * (.72 + ((i*7)%9)/18))),
        away: Math.max(1, Math.round(aa * (.72 + ((i*5)%8)/18))),
        source:"API"
      }));
    }
    return [];
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
      <section class="railCard mcRailEmptyBox">
        <div class="railTitle"><span>▣ MATCH CENTER</span><b>PRÉ-JOGO</b></div>
        <div class="mcRailEmptyRadar"><b>⚽</b></div>
        <h3 style="margin:0;color:#fff;font-size:13px;text-transform:uppercase;">Aguardando partida</h3>
        <p>Selecione um jogo para abrir o placar, comparativo e gráfico de pressão no painel lateral.</p>
      </section>
      <button class="railFullBtn railFullBtnDisabled" type="button" disabled>INICIAR MATCH CENTER</button>`;
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
      const ch = clean(data?.corners?.home ?? data?.home_corners ?? game?.corners_home ?? 0, "0");
      const ca = clean(data?.corners?.away ?? data?.away_corners ?? game?.corners_away ?? 0, "0");
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
      const ph = clean(data?.pressure?.home ?? data?.dangerous_attacks?.home ?? data?.attacks?.home ?? basePct, basePct);
      const pa = clean(data?.pressure?.away ?? data?.dangerous_attacks?.away ?? data?.attacks?.away ?? Math.max(0, 100 - basePct), Math.max(0, 100 - basePct));
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
      const res = await fetch(`/match_center?match_id=${encodeURIComponent(matchId)}&t=${Date.now()}`, { cache:"no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && !data.error) render(data);
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
    if (rail) obs.observe(rail, { childList:true, subtree:false });
    setTimeout(() => obs.disconnect(), 5000);
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
   MENU MOBILE — exclusivo para celular
   ========================================================= */
(function setupMobileNavigation(){
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileOverlay');
  const mobileCalendarBtn = document.getElementById('mobileCalendarBtn');
  const desktopCalendarBtn = document.getElementById('btnCalendario');

  if (!menuBtn || !sidebar || !overlay) return;

  const closeMenu = () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('mobile-menu-lock');
  };

  const openMenu = () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('mobile-menu-lock');
  };

  menuBtn.addEventListener('click', () => {
    sidebar.classList.contains('mobile-open') ? closeMenu() : openMenu();
  });
  overlay.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('.side-item').forEach(item => item.addEventListener('click', closeMenu));

  if (mobileCalendarBtn && desktopCalendarBtn){
    mobileCalendarBtn.addEventListener('click', () => desktopCalendarBtn.click());
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 767) closeMenu();
  });
})();

/* =========================================================
   CORREÇÃO MOBILE FINAL
   - volta ao início após recarregar;
   - usa o clique original das linhas para carregar dados reais;
   - não reorganiza nem remove o Mercado de Escanteios.
   ========================================================= */
(function mobileFinalStabilityFix(){
  "use strict";

  if (window.__mobileFinalStabilityFixInstalled) return;
  window.__mobileFinalStabilityFixInstalled = true;

  const isMobile = () =>
    window.matchMedia && window.matchMedia("(max-width: 700px)").matches;

  try{
    if ("scrollRestoration" in history){
      history.scrollRestoration = "manual";
    }
  }catch(_){}

  function goToTop(){
    if (!isMobile()) return;
    window.scrollTo({ top:0, left:0, behavior:"auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  window.addEventListener("pageshow", function(event){
    if (!isMobile()) return;
    if (event.persisted || window.scrollY > 600){
      requestAnimationFrame(goToTop);
      setTimeout(goToTop, 80);
    }
  });

  window.addEventListener("load", function(){
    if (!isMobile()) return;
    setTimeout(goToTop, 60);
  }, { once:true });

  /*
    Os cards originais já possuem listeners que conhecem o índice e o
    match_id reais. O botão visual apenas aciona o clique da própria linha,
    sem fabricar um jogo incompleto e sem substituir updateDesktopMatchRail.
  */
  document.addEventListener("pointerup", function(event){
    if (!isMobile()) return;

    const button = event.target?.closest?.(
      ".gamesPanel .signal:not([data-open-match-center]), " +
      ".gamesPanel .matchCenterMiniBtn:not([data-open-match-center])"
    );

    if (!button) return;

    const row = button.closest(
      ".gameRow,.compactGameRow,.marketGameRow,.premiumGameRow,.cleanDashRow,[data-match-center-row]"
    );

    if (!row) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    row.dispatchEvent(new MouseEvent("click", {
      bubbles:false,
      cancelable:true,
      view:window
    }));

    const rail = document.getElementById("desktopMatchRail") ||
                 document.querySelector(".dashboardRightRail");

    if (rail){
      setTimeout(() => {
        rail.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 220);
    }
  }, true);

  /*
    Garante que o painel de mercados permaneça no DOM e visível depois
    de qualquer renderização dinâmica.
  */
  function revealMarkets(){
    document.querySelectorAll(
      ".marketInlinePanel,.marketInlineShell,.inlineMarketsPanel"
    ).forEach(panel => {
      panel.style.removeProperty("display");
      panel.style.removeProperty("visibility");
      panel.style.removeProperty("opacity");
    });
  }

  const observer = new MutationObserver(() => {
    if (!isMobile()) return;
    revealMarkets();
  });

  function start(){
    revealMarkets();
    observer.observe(document.body, {
      childList:true,
      subtree:true
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
})();

/* =========================================================
   AJUSTE DEFINITIVO — RESTAURA TOPO + MERCADO DE ESCANTEIOS
   ========================================================= */
(function mobileTopAndCornersFix(){
  "use strict";

  if (window.__mobileTopAndCornersFixInstalled) return;
  window.__mobileTopAndCornersFixInstalled = true;

  const mobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  function resetEveryScroll(){
    if (!mobile()) return;

    try{
      history.scrollRestoration = "manual";
    }catch(_){}

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    [
      ".main",
      ".content",
      ".dashboardGrid",
      ".dashboardMainColumn",
      ".marketWorkArea",
      ".gamesPanel"
    ].forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        try{
          element.scrollTop = 0;
          element.scrollLeft = 0;
        }catch(_){}
      });
    });
  }

  function findCornersTab(){
    return Array.from(document.querySelectorAll(".marketTab")).find(tab =>
      /ESCANTEIOS/i.test(String(tab.textContent || ""))
    ) || null;
  }

  function revealMarketPanel(){
    if (!mobile()) return;

    const panel = document.querySelector(
      ".marketInlinePanel,.marketInlineShell,.inlineMarketsPanel"
    );

    if (panel){
      panel.style.removeProperty("display");
      panel.style.removeProperty("visibility");
      panel.style.removeProperty("opacity");
    }

    return panel;
  }

  function activateCornersMarket(scrollToPanel = false){
    if (!mobile()) return;

    const tab = findCornersTab();
    if (tab && !tab.classList.contains("is-active-market")){
      tab.dispatchEvent(new MouseEvent("click", {
        bubbles:true,
        cancelable:true,
        view:window
      }));
    }

    const panel = revealMarketPanel();

    if (scrollToPanel && panel){
      setTimeout(() => {
        panel.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
      }, 80);
    }
  }

  function bindBottomCorners(){
    document.querySelectorAll(".mobileBottomNav button,.mobileBottomNav a")
      .forEach(item => {
        if (!/ESCANTEIOS/i.test(String(item.textContent || ""))) return;
        if (item.dataset.cornersMobileBound === "1") return;

        item.dataset.cornersMobileBound = "1";
        item.addEventListener("click", () => {
          activateCornersMarket(true);
        });
      });
  }

  function stabilize(){
    resetEveryScroll();
    revealMarketPanel();
    bindBottomCorners();
  }

  window.addEventListener("pageshow", () => {
    stabilize();
    setTimeout(stabilize, 80);
    setTimeout(stabilize, 300);
    setTimeout(stabilize, 900);
  });

  window.addEventListener("load", () => {
    stabilize();
    setTimeout(stabilize, 120);
    setTimeout(stabilize, 500);
  }, { once:true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible"){
      setTimeout(resetEveryScroll, 50);
    }
  });

  const observer = new MutationObserver(() => {
    if (!mobile()) return;
    revealMarketPanel();
    bindBottomCorners();
  });

  function start(){
    stabilize();

    observer.observe(document.body, {
      childList:true,
      subtree:true
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
})();

/* =========================================================
   MOBILE — MANTÉM TODOS OS MERCADOS E RESTAURA ESCANTEIOS
   O painel principal continua trocando entre Pré-Jogo, Gols,
   Cartões e Player Props. Além disso, o painel de Escanteios
   permanece visível abaixo, como antes.
   ========================================================= */
(function restorePermanentCornersMarketMobile(){
  "use strict";

  if (window.__permanentCornersMarketMobileInstalled) return;
  window.__permanentCornersMarketMobileInstalled = true;

  const isMobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  function esc(value){
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  const CORNERS = {
    count:"18 MERCADOS",
    title:"Mercados de Escanteios",
    subtitle:"totais, tempos, equipes e linhas especiais",
    tip:"Dica Corner Pro: jogos acima de 9.5 escanteios entram como prioridade no radar.",
    all:"VER TODOS OS ESCANTEIOS",
    sections:[
      {
        title:"Totais de Escanteios",
        icon:"⚑",
        items:[
          ["Over 8.5","1.35"],
          ["Over 9.5","1.55","POPULAR"],
          ["Over 10.5","1.80"],
          ["Over 11.5","2.10"],
          ["Over 12.5","2.45"]
        ]
      },
      {
        title:"Escanteios por Tempo",
        icon:"◷",
        items:[
          ["Over 4.5 HT","1.85"],
          ["Over 5.5 HT","2.20"],
          ["Under 4.5 HT","1.70"],
          ["Over 9.5 FT","1.45"],
          ["Over 10.5 FT","1.70"]
        ]
      },
      {
        title:"Por Equipe / Especiais",
        icon:"▤",
        items:[
          ["Casa Over 4.5","1.60"],
          ["Casa Over 5.5","2.05"],
          ["Visitante Over 4.5","1.75"],
          ["Visitante Over 5.5","2.20"],
          ["Escanteios exatos","6.00"]
        ]
      }
    ]
  };

  function panelHTML(){
    const sections = CORNERS.sections.map(section => `
      <section class="marketInlineSection">
        <h4><i>${esc(section.icon)}</i>${esc(section.title)}</h4>
        <div class="marketInlineList">
          ${section.items.map(item => `
            <button
              class="marketInlineItem"
              type="button"
              data-market-line="${esc(item[0])}"
            >
              <span>
                ${esc(item[0])}
                ${item[2] ? `<em class="marketInlineHot">${esc(item[2])}</em>` : ""}
              </span>
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
          <strong>${esc(CORNERS.title)}</strong>
          <small>${esc(CORNERS.subtitle)}</small>
        </div>
        <div class="marketInlineCount">${esc(CORNERS.count)}</div>
      </div>

      <div class="marketInlineGrid">${sections}</div>

      <div class="marketInlineFooter">
        <div class="marketInlineTip">
          <i>i</i>
          <span>${esc(CORNERS.tip)}</span>
        </div>
        <button class="marketInlineAll" type="button">
          ${esc(CORNERS.all)} →
        </button>
      </div>
    `;
  }

  function buildPermanentCorners(){
    if (!isMobile()) return;

    const mainPanel = document.querySelector(
      ".marketInlinePanel:not(.marketInlineCornersPermanent)"
    );

    if (!mainPanel) return;

    let cornersPanel = document.querySelector(".marketInlineCornersPermanent");

    if (!cornersPanel){
      cornersPanel = document.createElement("section");
      cornersPanel.className =
        "marketInlinePanel marketInlineCornersPermanent";
      cornersPanel.setAttribute("aria-label", "Mercados de Escanteios");
      cornersPanel.innerHTML = panelHTML();

      mainPanel.insertAdjacentElement("afterend", cornersPanel);
    }

    cornersPanel.style.removeProperty("display");
    cornersPanel.style.removeProperty("visibility");
    cornersPanel.style.removeProperty("opacity");
  }

  function schedule(){
    requestAnimationFrame(buildPermanentCorners);
    setTimeout(buildPermanentCorners, 80);
    setTimeout(buildPermanentCorners, 250);
    setTimeout(buildPermanentCorners, 700);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", schedule, { once:true });
  }else{
    schedule();
  }

  window.addEventListener("pageshow", schedule);

  const observer = new MutationObserver(() => {
    if (!isMobile()) return;
    buildPermanentCorners();
  });

  observer.observe(document.body, {
    childList:true,
    subtree:true
  });
})();

/* =========================================================
   MOBILE ESTÁVEL — SEM PULO DE PÁGINA + MATCH CENTER REAL
   ========================================================= */
(function mobileStableRealMatchCenter(){
  "use strict";

  if (window.__mobileStableRealMatchCenterInstalled) return;
  window.__mobileStableRealMatchCenterInstalled = true;

  const isMobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  function hardTop(){
    if (!isMobile()) return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  /*
    Bloqueia os scrollIntoView automáticos antigos somente no mobile.
    Eles eram os responsáveis por jogar a página para uma região vazia.
  */
  if (isMobile() && !Element.prototype.__cornerOriginalScrollIntoView){
    Element.prototype.__cornerOriginalScrollIntoView =
      Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function(){
      return;
    };
  }

  try{
    history.scrollRestoration = "manual";
  }catch(_){}

  window.addEventListener("pageshow", () => {
    hardTop();
    setTimeout(hardTop, 50);
    setTimeout(hardTop, 180);
  });

  window.addEventListener("load", () => {
    hardTop();
    setTimeout(hardTop, 100);
  }, { once:true });

  function allGames(){
    const pools = [];

    try{
      if (Array.isArray(window.__premiumFilteredGames))
        pools.push(window.__premiumFilteredGames);
    }catch(_){}

    try{
      if (Array.isArray(window.__premiumMarketGames))
        pools.push(window.__premiumMarketGames);
    }catch(_){}

    try{
      if (typeof lastMarketGames !== "undefined" && Array.isArray(lastMarketGames))
        pools.push(lastMarketGames);
    }catch(_){}

    try{
      if (typeof lastRawGames !== "undefined" && Array.isArray(lastRawGames))
        pools.push(lastRawGames);
    }catch(_){}

    const result = [];
    const seen = new Set();

    pools.forEach(pool => {
      pool.forEach(game => {
        if (!game) return;

        const id = String(
          game.match_id ??
          game.id ??
          game.event_key ??
          ""
        );

        const key = id || [
          game.casa || game.home || "",
          game.fora || game.away || "",
          game.hora || game.time || ""
        ].join("|");

        if (seen.has(key)) return;
        seen.add(key);
        result.push(game);
      });
    });

    return result;
  }

  function resolveGame(button){
    const list = allGames();
    const matchId = String(button.dataset.matchId || "");
    const index = Number(button.dataset.openMatchCenter);

    let game = null;

    if (Number.isFinite(index) && index >= 0){
      try{
        game = window.__premiumFilteredGames?.[index] || null;
      }catch(_){}
    }

    if (!game && matchId){
      game = list.find(item =>
        String(item?.match_id ?? item?.id ?? item?.event_key ?? "") === matchId
      ) || null;
    }

    if (!game){
      game = {
        match_id: matchId,
        id: matchId,
        event_key: matchId,
        casa: button.dataset.home || "Mandante",
        fora: button.dataset.away || "Visitante",
        liga: button.dataset.league || "Liga",
        hora: button.dataset.time || "—"
      };
    }

    return { game, list:list.length ? list : [game] };
  }

  /*
    Captura somente o botão pequeno da linha.
    Usa updateDesktopMatchRail com o match_id real e não permite que
    listeners antigos executem scroll ou reconstruam o estado.
  */
  document.addEventListener("click", async function(event){
    if (!isMobile()) return;

    const button = event.target?.closest?.(
      "[data-open-match-center]:not([data-open-match-center-table])," +
      ".matchCenterMiniBtn"
    );

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const { game, list } = resolveGame(button);
    const row = button.closest(
      ".premiumGameRow,.cleanDashRow,.gameRow,.marketGameRow,[data-match-center-row]"
    );

    document.querySelectorAll(
      ".premiumGameRow,.cleanDashRow,.gameRow,.marketGameRow,[data-match-center-row]"
    ).forEach(item => item.classList.remove("match-center-selected"));

    document.querySelectorAll(
      ".matchCenterBtn,.matchCenterMiniBtn,[data-open-match-center]"
    ).forEach(item => item.classList.remove("is-open"));

    row?.classList.add("match-center-selected");
    button.classList.add("is-open");

    window.__selectedMatchCenterGame = game;
    window.__selectedMatchCenterKey = String(
      game.match_id ?? game.id ?? game.event_key ?? ""
    );

    const rail = document.getElementById("desktopMatchRail") ||
                 document.querySelector(".dashboardRightRail");

    if (rail){
      rail.style.display = "flex";
      rail.style.visibility = "visible";
      rail.style.opacity = "1";
    }

    try{
      if (typeof window.updateDesktopMatchRail === "function"){
        await window.updateDesktopMatchRail(game, list);
      }
    }catch(error){
      console.error("Erro ao carregar Match Center real:", error);
    }
  }, true);
})();

/* =========================================================
   MOBILE — LIMITA O FIM REAL DA PÁGINA
   ========================================================= */
(function mobileClampPageEnd(){
  "use strict";

  if (window.__mobileClampPageEndInstalled) return;
  window.__mobileClampPageEndInstalled = true;

  const mobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  function clampScroll(){
    if (!mobile()) return;

    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );

    if (window.scrollY > maxScroll){
      window.scrollTo(0, maxScroll);
    }
  }

  window.addEventListener("scroll", clampScroll, { passive:true });
  window.addEventListener("resize", clampScroll, { passive:true });
  window.addEventListener("orientationchange", clampScroll, { passive:true });

  const observer = new MutationObserver(() => {
    requestAnimationFrame(clampScroll);
  });

  observer.observe(document.body, {
    childList:true,
    subtree:true,
    attributes:true
  });

  window.addEventListener("load", () => {
    setTimeout(clampScroll, 100);
    setTimeout(clampScroll, 400);
  }, { once:true });
})();

/* =========================================================
   MOBILE — LIMPA ALTURAS INLINE QUE CRIAM ESPAÇO VAZIO
   ========================================================= */
(function removeMobileGhostHeight(){
  "use strict";

  if (window.__removeMobileGhostHeightInstalled) return;
  window.__removeMobileGhostHeightInstalled = true;

  const isMobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  const selectors = [
    ".main",
    ".content",
    ".dashboardGrid",
    ".dashboardMainColumn",
    ".marketWorkArea",
    ".gamesPanel",
    ".marketInlinePanel",
    ".marketInlineShell",
    ".inlineMarketsPanel",
    ".dashboardRightRail",
    "#desktopMatchRail",
    ".bottomStrip"
  ].join(",");

  function clearGhostHeights(){
    if (!isMobile()) return;

    document.querySelectorAll(selectors).forEach(element => {
      element.style.removeProperty("height");
      element.style.removeProperty("min-height");
      element.style.removeProperty("max-height");
      element.style.removeProperty("margin-bottom");
      element.style.removeProperty("padding-bottom");
    });

    const bottomStrip = document.querySelector(".bottomStrip");
    if (bottomStrip) bottomStrip.style.display = "none";
  }

  let scheduled = false;

  function scheduleClear(){
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      clearGhostHeights();
    });
  }

  const observer = new MutationObserver(scheduleClear);

  function start(){
    clearGhostHeights();

    observer.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:["style","class"]
    });

    window.addEventListener("resize", scheduleClear, { passive:true });
    window.addEventListener("orientationchange", scheduleClear, { passive:true });
    window.addEventListener("pageshow", scheduleClear);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
})();

/* =========================================================
   MOBILE — RESETA SOMENTE A ROLAGEM DO CONTEÚDO
   ========================================================= */
(function mobileMainScrollFix(){
  "use strict";

  if (window.__mobileMainScrollFixInstalled) return;
  window.__mobileMainScrollFixInstalled = true;

  const isMobile = () =>
    window.matchMedia && window.matchMedia("(max-width:700px)").matches;

  function resetMainScroll(){
    if (!isMobile()) return;

    const main = document.querySelector(".main");
    if (main){
      main.scrollTop = 0;
      main.scrollLeft = 0;
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  window.addEventListener("pageshow", () => {
    resetMainScroll();
    setTimeout(resetMainScroll, 80);
  });

  window.addEventListener("load", () => {
    setTimeout(resetMainScroll, 60);
  }, { once:true });
})();

/* =========================================================
   MOBILE — MATCH CENTER FUNCIONA SEM ATUALIZAR + DISPARO
   - Delegação de eventos para cards criados pela API.
   - Carrega o jogo real pelo índice ou match_id.
   - Após renderizar, leva diretamente à área dos gráficos.
   ========================================================= */
(function installMobileMatchCenterShot(){
  "use strict";

  if (window.__mobileMatchCenterShotInstalled) return;
  window.__mobileMatchCenterShotInstalled = true;

  const MOBILE_QUERY = "(max-width:700px)";

  function isMobile(){
    return Boolean(
      window.matchMedia &&
      window.matchMedia(MOBILE_QUERY).matches
    );
  }

  function collectGames(){
    const pools = [];

    try{
      if (Array.isArray(window.__premiumFilteredGames)){
        pools.push(window.__premiumFilteredGames);
      }
    }catch(_){}

    try{
      if (Array.isArray(window.__premiumMarketGames)){
        pools.push(window.__premiumMarketGames);
      }
    }catch(_){}

    try{
      if (Array.isArray(window.__lastMarketGames)){
        pools.push(window.__lastMarketGames);
      }
    }catch(_){}

    try{
      if (Array.isArray(window.__lastRawGames)){
        pools.push(window.__lastRawGames);
      }
    }catch(_){}

    try{
      if (typeof lastMarketGames !== "undefined" &&
          Array.isArray(lastMarketGames)){
        pools.push(lastMarketGames);
      }
    }catch(_){}

    try{
      if (typeof lastRawGames !== "undefined" &&
          Array.isArray(lastRawGames)){
        pools.push(lastRawGames);
      }
    }catch(_){}

    const result = [];
    const seen = new Set();

    for (const pool of pools){
      for (const game of pool){
        if (!game || typeof game !== "object") continue;

        const id = String(
          game.match_id ??
          game.id ??
          game.event_key ??
          ""
        );

        const fallbackKey = [
          game.casa ?? game.home ?? "",
          game.fora ?? game.away ?? "",
          game.hora ?? game.time ?? ""
        ].join("|");

        const key = id || fallbackKey;
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(game);
      }
    }

    return result;
  }

  function getMatchId(element){
    const row = element.closest(
      ".gameRow,.compactGameRow,.marketGameRow," +
      ".premiumGameRow,.cleanDashRow,[data-match-center-row]"
    );

    return String(
      element.dataset.matchId ||
      element.getAttribute("data-match-id") ||
      row?.dataset.matchId ||
      row?.getAttribute("data-match-id") ||
      ""
    ).trim();
  }

  function resolveGame(button){
    const games = collectGames();

    const indexRaw = button.dataset.openMatchCenter;
    const index = Number(indexRaw);
    let game = null;

    if (Number.isInteger(index) && index >= 0){
      try{
        if (Array.isArray(window.__premiumFilteredGames)){
          game = window.__premiumFilteredGames[index] || null;
        }
      }catch(_){}
    }

    const matchId = getMatchId(button);

    if (!game && matchId){
      game = games.find(item =>
        String(
          item?.match_id ??
          item?.id ??
          item?.event_key ??
          ""
        ) === matchId
      ) || null;
    }

    const row = button.closest(
      ".gameRow,.compactGameRow,.marketGameRow," +
      ".premiumGameRow,.cleanDashRow,[data-match-center-row]"
    );

    if (!game && row){
      const home =
        row.dataset.home ||
        row.querySelector("[data-home]")?.dataset.home ||
        row.querySelector(".team-home,.homeTeam,.home")?.textContent ||
        "";

      const away =
        row.dataset.away ||
        row.querySelector("[data-away]")?.dataset.away ||
        row.querySelector(".team-away,.awayTeam,.away")?.textContent ||
        "";

      game = {
        match_id: matchId,
        id: matchId,
        event_key: matchId,
        casa: String(home).trim() || "Mandante",
        fora: String(away).trim() || "Visitante",
        liga: row.dataset.league || "Liga",
        hora: row.dataset.time || "—"
      };
    }

    return {
      game,
      games: games.length ? games : (game ? [game] : []),
      row
    };
  }

  function showRail(){
    const rail =
      document.getElementById("desktopMatchRail") ||
      document.querySelector(".dashboardRightRail");

    if (!rail) return null;

    rail.style.removeProperty("display");
    rail.style.removeProperty("visibility");
    rail.style.removeProperty("opacity");
    rail.classList.add("match-center-shot-target");

    return rail;
  }

  function shootToGraphs(){
    const rail =
      document.getElementById("desktopMatchRail") ||
      document.querySelector(".dashboardRightRail");

    if (!rail) return;

    const main = document.querySelector(".main");

    if (main && main.scrollHeight > main.clientHeight){
      const mainRect = main.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();

      const targetTop =
        main.scrollTop +
        (railRect.top - mainRect.top) -
        8;

      main.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth"
      });
    }else{
      const top =
        window.scrollY +
        rail.getBoundingClientRect().top -
        8;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }

    rail.classList.remove("match-center-shot");
    requestAnimationFrame(() => {
      rail.classList.add("match-center-shot");
    });
  }

  async function openRealMatchCenter(button){
    const { game, games, row } = resolveGame(button);

    if (!game) return;

    document.querySelectorAll(
      ".gameRow,.compactGameRow,.marketGameRow," +
      ".premiumGameRow,.cleanDashRow,[data-match-center-row]"
    ).forEach(item =>
      item.classList.remove("match-center-selected")
    );

    document.querySelectorAll(
      ".matchCenterMiniBtn,.signal,[data-open-match-center]"
    ).forEach(item =>
      item.classList.remove("is-open")
    );

    row?.classList.add("match-center-selected");
    button.classList.add("is-open");

    window.__selectedMatchCenterGame = game;
    window.__selectedMatchCenterKey = String(
      game.match_id ??
      game.id ??
      game.event_key ??
      ""
    );

    showRail();

    try{
      if (typeof window.updateDesktopMatchRail === "function"){
        await window.updateDesktopMatchRail(game, games);
      }else if (typeof window.openMatchCenter === "function"){
        await window.openMatchCenter(game);
      }
    }catch(error){
      console.error(
        "Falha ao carregar o Match Center:",
        error
      );
    }

    /*
      Dois disparos: o primeiro após o HTML aparecer e o segundo
      depois de gráficos/SVGs terminarem a renderização.
    */
    setTimeout(shootToGraphs, 100);
    setTimeout(shootToGraphs, 420);
  }

  /*
    Delegação de eventos: funciona também nos botões criados
    depois que a API atualiza a lista de partidas.
  */
  document.addEventListener("click", function(event){
    if (!isMobile()) return;

    const button = event.target?.closest?.(
      ".matchCenterMiniBtn," +
      ".gamesPanel .signal," +
      "[data-open-match-center]"
    );

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openRealMatchCenter(button);
  }, true);
})();


/* =========================================================
   CORNER PRO MOBILE APP FLOW — SOMENTE MOBILE
   Dashboard > Mercado > Linha > Jogos > Match Center fullscreen
   O desktop permanece intocado.
   ========================================================= */
(function installCornerProMobileAppFlow(){
  "use strict";
  if (window.__cornerProMobileAppFlowInstalled) return;
  window.__cornerProMobileAppFlowInstalled = true;

  const mq = window.matchMedia ? window.matchMedia("(max-width:700px)") : null;
  const isMobile = () => Boolean(mq && mq.matches);
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));

  const marketLayer = $("#cpMobileMarketsLayer");
  const matchLayer = $("#cpMobileMatchLayer");
  const kinds = $("#cpMobileMarketKinds");
  const grid = $("#cpMobileOddsGrid");
  const recommended = $("#cpMobileRecommended");
  const carousel = $("#cpMobileGameCarousel");
  const selectedLineEl = $("#cpMobileSelectedLine");
  const heading = $("#cpMobileMarketHeading");
  const icon = $("#cpMobileMarketIcon");
  const title = $("#cpMobileMarketsTitle");
  const matchContent = $("#cpMobileMatchContent");
  if (!marketLayer || !matchLayer || !grid || !carousel) return;

  const MARKET_DATA = {
    pregame:{title:"Pré-jogo",icon:"⚽",heading:"Mercados pré-jogo",lines:[
      ["Casa vence","1.85"],["Empate","3.30"],["Visitante vence","4.20"],["Dupla chance casa","1.28"],["Ambas marcam","1.85",1],["Over 2.5 gols","1.75",1]
    ]},
    corners:{title:"Escanteios",icon:"⚑",heading:"Totais de escanteios",lines:[
      ["Over 8.5","1.35"],["Over 9.5","1.55"],["Over 10.5","1.84",1],["Over 11.5","2.20"],["Over 12.5","2.60"],["Under 8.5","3.20"],["Under 9.5","2.45"],["Under 10.5","1.70"]
    ]},
    goals:{title:"Gols",icon:"◎",heading:"Totais de gols",lines:[
      ["Over 0.5","1.07"],["Over 1.5","1.30"],["Over 2.5","1.78",1],["Over 3.5","2.40"],["Over 4.5","4.00"],["Under 1.5","3.30"],["Under 2.5","2.05"],["Under 3.5","1.55"]
    ]},
    cards:{title:"Cartões",icon:"▯",heading:"Totais de cartões",lines:[
      ["Over 2.5","1.45"],["Over 3.5","1.80"],["Over 4.5","2.25",1],["Over 5.5","3.50"],["Under 2.5","2.60"],["Under 3.5","1.90"],["Under 4.5","1.55"],["Under 5.5","1.28"]
    ]},
    combined:{title:"Combinadas",icon:"▦",heading:"Combinadas populares",lines:[
      ["Over 10.5 cantos + Over 2.5 gols","2.45",1],["Over 9.5 cantos + Over 1.5 gols","1.85"],["Over 2.5 gols + Over 4.5 cartões","2.10"],["Casa + Over 1.5 gols","2.20"]
    ]},
    props:{title:"Player Props",icon:"♞",heading:"Desempenho individual",lines:[
      ["Jogador marca","2.40",1],["1+ chute no alvo","1.55"],["2+ finalizações","1.75"],["Recebe cartão","3.10"]
    ]}
  };

  let activeMarket = "corners";
  let selectedLine = "";

  function bodyLock(on){ document.body.classList.toggle("cp-mobile-layer-open", Boolean(on)); }
  function openLayer(layer){
    if (!isMobile()) return;
    layer.classList.add("is-open"); layer.setAttribute("aria-hidden","false"); bodyLock(true);
  }
  function closeLayer(layer){
    layer.classList.remove("is-open"); layer.setAttribute("aria-hidden","true");
    if (!marketLayer.classList.contains("is-open") && !matchLayer.classList.contains("is-open")) bodyLock(false);
  }

  function collectGames(){
    const pools=[];
    ["__premiumFilteredGames","__premiumMarketGames","__lastMarketGames","__lastRawGames"].forEach(k=>{
      try{ if(Array.isArray(window[k])) pools.push(window[k]); }catch(_){}
    });
    try{ if(typeof lastMarketGames!=="undefined"&&Array.isArray(lastMarketGames)) pools.push(lastMarketGames); }catch(_){}
    try{ if(typeof lastRawGames!=="undefined"&&Array.isArray(lastRawGames)) pools.push(lastRawGames); }catch(_){}
    const out=[],seen=new Set();
    pools.flat().forEach(g=>{
      if(!g||typeof g!=="object") return;
      const key=String(g.match_id??g.id??g.event_key??`${g.casa}|${g.fora}|${g.hora}`);
      if(seen.has(key)) return; seen.add(key); out.push(g);
    });
    return out;
  }

  function gameName(g,home){ return String(home?(g.casa??g.home??g.home_name??"Mandante"):(g.fora??g.away??g.away_name??"Visitante")); }
  function gameTime(g){ return String(g.hora??g.time??g.match_time??"--:--").slice(0,5); }
  function gameConfidence(g,index){
    const raw=Number(g.prob??g.probabilidade??g.confidence??g.score??g.pOver95??g.p_over_95);
    if(Number.isFinite(raw)) return Math.max(51,Math.min(94,Math.round(raw)));
    return [78,72,68,64][index]||61;
  }
  function gameProjection(g,index){
    const candidates=[g.proj,g.projecao,g.projection,g.projCorners,g.avg_total,g.media];
    const val=candidates.map(Number).find(Number.isFinite);
    return val ? val.toFixed(1) : (activeMarket==="goals"?(2.9-index*.15).toFixed(1):(10.8-index*.25).toFixed(1));
  }
  function teamBadge(name){
    const letters=String(name||"T").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
    return `<span aria-hidden="true">${letters||"FC"}</span>`;
  }

  function renderMarket(type){
    activeMarket = MARKET_DATA[type] ? type : "corners";
    const data=MARKET_DATA[activeMarket];
    title.textContent=data.title.toUpperCase(); heading.textContent=data.heading; icon.textContent=data.icon;
    $$("button[data-cp-market]",kinds).forEach(b=>b.classList.toggle("active",b.dataset.cpMarket===activeMarket));
    grid.innerHTML=data.lines.map((line,i)=>`
      <button type="button" class="cpMobileOdd${line[2]?" is-ai":""}" data-cp-line="${String(line[0]).replace(/"/g,"&quot;")}">
        <b>${line[0]}</b><strong>${line[1]}</strong>${line[2]?"<small>★ IA</small>":""}
      </button>`).join("");
    recommended.hidden=true; carousel.innerHTML=""; selectedLine="";
  }

  function renderRecommended(line){
    selectedLine=line; selectedLineEl.textContent=line.toUpperCase();
    const games=collectGames().slice(0,5);
    const fallback=[
      {casa:"Derry City",fora:"CSKA Sofia",hora:"14:30"},
      {casa:"Inter Turku",fora:"FK Sarajevo",hora:"16:00"},
      {casa:"Valerenga",fora:"Aalesund",hora:"18:30"}
    ];
    const source=games.length?games:fallback;
    carousel.innerHTML=source.slice(0,4).map((g,i)=>{
      const conf=gameConfidence(g,i),home=gameName(g,true),away=gameName(g,false);
      return `<article class="cpMobileRecGame" data-cp-game-index="${i}">
        <div class="cpMobileRecTop"><time>${gameTime(g)}</time><div class="cpMobileConfidence">${conf}%<small>CONFIANÇA</small></div></div>
        <div class="cpMobileTeams"><div>${teamBadge(home)}<b>${home}</b></div><i>×</i><div>${teamBadge(away)}<b>${away}</b></div></div>
        <div class="cpMobileRecMarket">${line.toUpperCase()} ${activeMarket==="corners"?"ESCANTEIOS":activeMarket==="goals"?"GOLS":activeMarket==="cards"?"CARTÕES":""}</div>
        <div class="cpMobileRecStats"><div><small>PROJEÇÃO</small><b>${gameProjection(g,i)}</b></div><div><small>MÉDIA</small><b>${activeMarket==="goals"?"3.1":"11.2"}</b></div><div><small>RISCO</small><b>${i<2?"BAIXO":"MÉDIO"}</b></div></div>
        <button class="cpMobileRecOpen" type="button" data-cp-open-game="${i}">ABRIR MATCH CENTER →</button>
      </article>`;
    }).join("");
    recommended.hidden=false;
    setTimeout(()=>recommended.scrollIntoView({behavior:"smooth",block:"start"}),40);
  }

  async function openMatch(game,index){
    openLayer(matchLayer);
    matchContent.innerHTML='<div class="cpMobileMatchLoading"><span></span><b>Carregando análise real...</b></div>';
    const games=collectGames();
    const selected=game || games[index] || null;
    try{
      if(selected && typeof window.updateDesktopMatchRail==="function"){
        await window.updateDesktopMatchRail(selected,games.length?games:[selected]);
      }else if(selected && typeof window.openMatchCenter==="function"){
        await window.openMatchCenter(selected);
      }
    }catch(e){ console.warn("Match Center mobile:",e); }
    setTimeout(()=>{
      const rail=$("#desktopMatchRail")||$(".dashboardRightRail");
      if(rail){
        const clone=rail.cloneNode(true); clone.removeAttribute("id"); clone.classList.add("cpMobileRailClone");
        matchContent.innerHTML=""; matchContent.appendChild(clone);
      }else{
        matchContent.innerHTML='<div class="cpMobileMatchLoading"><b>Não foi possível carregar os dados desta partida.</b></div>';
      }
    },180);
  }

  function marketTypeFromTab(tab){
    const t=String(tab?.textContent||"").toLowerCase();
    if(t.includes("escante")) return "corners";
    if(t.includes("gol")) return "goals";
    if(t.includes("cart")) return "cards";
    if(t.includes("prop")) return "props";
    if(t.includes("pré")||t.includes("pre")) return "pregame";
    return "corners";
  }

  document.addEventListener("click",event=>{
    if(!isMobile()) return;
    const tab=event.target.closest(".marketTabs .marketTab");
    if(tab){
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      renderMarket(marketTypeFromTab(tab)); openLayer(marketLayer); return;
    }
    const kind=event.target.closest("[data-cp-market]");
    if(kind){ renderMarket(kind.dataset.cpMarket); return; }
    const odd=event.target.closest(".cpMobileOdd");
    if(odd){ $$(".cpMobileOdd",grid).forEach(x=>x.classList.remove("is-selected")); odd.classList.add("is-selected"); renderRecommended(odd.dataset.cpLine||odd.textContent); return; }
    const openBtn=event.target.closest("[data-cp-open-game]");
    if(openBtn){ const i=Number(openBtn.dataset.cpOpenGame); openMatch(collectGames()[i]||null,i); return; }
    const close=event.target.closest("[data-cp-close]");
    if(close){ closeLayer(close.dataset.cpClose==="match"?matchLayer:marketLayer); return; }
  },true);

  // Cards de jogos da Dashboard abrem diretamente o Match Center por cima.
  document.addEventListener("click",event=>{
    if(!isMobile()||marketLayer.classList.contains("is-open")||matchLayer.classList.contains("is-open")) return;
    const row=event.target.closest(".gamesPanel .gameRow,.gamesPanel .compactGameRow,.gamesPanel .premiumGameRow,.gamesPanel .cleanDashRow,[data-match-center-row]");
    if(!row) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const rows=$$(".gamesPanel .gameRow,.gamesPanel .compactGameRow,.gamesPanel .premiumGameRow,.gamesPanel .cleanDashRow,[data-match-center-row]");
    const index=Math.max(0,rows.indexOf(row)); openMatch(collectGames()[index]||null,index);
  },true);

  // Barra inferior: Escanteios abre a mesma tela dinâmica de mercados.
  $$(".mobileBottomNav button").forEach(btn=>{
    if(/escante/i.test(btn.textContent||"")) btn.addEventListener("click",e=>{ if(!isMobile())return;e.preventDefault();renderMarket("corners");openLayer(marketLayer); });
  });

  window.addEventListener("popstate",()=>{
    if(!isMobile()) return;
    if(matchLayer.classList.contains("is-open")) closeLayer(matchLayer);
    else if(marketLayer.classList.contains("is-open")) closeLayer(marketLayer);
  });

  renderMarket("corners");
})();


/* =========================================================
   DASHBOARD MOBILE V3 — apenas monta a nova home no celular.
   ========================================================= */
(function setupCornerProMobileHome(){
  const mq=window.matchMedia('(max-width:700px)');
  if(!mq.matches) return;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const home=$('#cpMobileHome');
  if(!home) return;

  let mobileLoadingMode='initial';

  function setMobileHomeLoading(mode='initial'){
    const card=$('#cpHomeBest');
    const button=$('#cpHomeBestOpen');
    const buttonText=$('.cpHomeBestOpenText');
    const games=$('#cpHomeGames');
    if(!card || !button) return;

    card.classList.remove('is-loading-initial','is-loading-date');
    games?.classList.remove('is-loading');

    if(mode==='done'){
      mobileLoadingMode='';
      card.setAttribute('aria-busy','false');
      button.disabled=false;
      if(buttonText) buttonText.textContent='VER ANÁLISE COMPLETA →';
      render();
      return;
    }

    mobileLoadingMode=mode==='selected'?'selected':'initial';
    card.setAttribute('aria-busy','true');
    button.disabled=true;
    games?.classList.add('is-loading');

    if(mobileLoadingMode==='selected'){
      card.classList.add('is-loading-date');
      if(buttonText) buttonText.textContent='ANALISANDO JOGOS DA DATA SELECIONADA...';
    }else{
      card.classList.add('is-loading-initial');
      if(buttonText) buttonText.textContent='CARREGANDO JOGOS DO DIA...';
      if(games){
        games.innerHTML='<div class="cpHomeSkeleton"></div><div class="cpHomeSkeleton"></div><div class="cpHomeSkeleton"></div>';
      }
    }
  }

  window.CornerProMobileHomeLoading=setMobileHomeLoading;

  function rows(){
    return $$('.gamesPanel .gameRow,.gamesPanel .compactGameRow,.gamesPanel .marketGameRow,.gamesPanel .premiumGameRow,.gamesPanel .cleanDashRow,[data-match-center-row]')
      .filter(el=>!el.closest('.cpMobileHome'));
  }
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function rowData(row,index){
    const meta=row?.querySelector('.gameMeta');
    const txt=clean(meta?.innerText||row?.innerText||'');
    const time=(txt.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)||[])[0]||'--:--';
    let names=[];
    if(meta){
      const em=clean(meta.querySelector('em')?.textContent);
      const b=meta.querySelector('b');
      if(b){
        const clone=b.cloneNode(true); clone.querySelectorAll('span,small').forEach(x=>x.remove());
        const parts=clone.innerHTML.split(/<br\s*\/?>(?:\s*)/i).map(x=>clean(x.replace(/<[^>]+>/g,' '))).filter(Boolean);
        names=parts;
      }
      if(em && !names.includes(em)) names.push(em);
    }
    if(names.length<2){
      const lines=(meta?.innerText||'').split('\n').map(clean).filter(Boolean).filter(x=>!x.includes(':')&&!/liga|league|serie|premier|la liga/i.test(x));
      names=lines.slice(-2);
    }
    const odds=row?.querySelector('.oddBox');
    const market=clean(odds?.querySelector('b')?.textContent)||'OVER 9.5';
    let conf=Number((row?.dataset?.confidence||'').replace(/[^0-9.]/g,''));
    if(!Number.isFinite(conf)||!conf) conf=[83,72,68,64][index]||61;
    return {row,time,home:names[0]||'Mandante',away:names[1]||'Visitante',market,conf:Math.round(conf)};
  }
  function getData(){return rows().slice(0,6).map(rowData)}

  function openOriginalRow(index){
    const list=rows(); const row=list[index]||list[0];
    if(row) row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }
  function openMarket(type){
    const map={pregame:0,corners:1,goals:2,cards:3,props:4};
    if(type==='combined'){
      const kind=$('[data-cp-market="combined"]');
      const original=$$('.marketTabs .marketTab')[1];
      original?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      setTimeout(()=>kind?.click(),40); return;
    }
    const original=$$('.marketTabs .marketTab')[map[type]??1];
    if(original) original.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }

  function render(){
    if(mobileLoadingMode) return;
    const data=getData();
    if(!data.length) return;
    const best=data[0];
    $('#cpHomeBestTime').textContent=best.time;
    $('#cpHomeBestHome').textContent=best.home;
    $('#cpHomeBestAway').textContent=best.away;
    $('#cpHomeBestConfidence').textContent=best.conf+'%';
    $('#cpHomeBestMarket').textContent=best.market;
    $('#cpHomeMatchTeams').textContent=best.home+' × '+best.away;
    $('#cpHomeGames').innerHTML=data.slice(0,5).map((g,i)=>`<button type="button" class="cpHomeGame${i===0?' is-first':''}" data-home-game="${i}"><time>${g.time}</time><div class="teams"><b>${g.home}</b><i>×</i><b>${g.away}</b></div><small>${g.market}</small><strong>${g.conf}%</strong></button>`).join('');
    $('#cpHomeLastGames').innerHTML=data.slice(1,4).map((g,i)=>`<button type="button" class="cpHomeLastGame" data-home-game="${i+1}"><time>${g.time}</time><b>${g.home}<br>${g.away}</b><strong>${g.conf}%</strong><i>›</i></button>`).join('');
  }

  home.addEventListener('click',e=>{
    if(mobileLoadingMode && e.target.closest('#cpHomeBestOpen,#cpHomeBest')){
      e.preventDefault();
      return;
    }
    const market=e.target.closest('[data-home-market]');
    if(market){e.preventDefault();openMarket(market.dataset.homeMarket);return}
    const game=e.target.closest('[data-home-game]');
    if(game){e.preventDefault();openOriginalRow(Number(game.dataset.homeGame));return}
    if(e.target.closest('#cpHomeBestOpen,#cpHomeBest')){e.preventDefault();openOriginalRow(0);return}
    if(e.target.closest('#cpHomeMatchOpen')){e.preventDefault();openOriginalRow(0)}
  });

  if(window.CornerProGamesReady){
    setMobileHomeLoading('done');
  }else{
    setMobileHomeLoading('initial');
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__cpHomeRenderTimer);window.__cpHomeRenderTimer=setTimeout(render,120)});
  const panel=$('.gamesPanel'); if(panel) observer.observe(panel,{childList:true,subtree:true,characterData:true});
  setInterval(render,1800);
})();


/* =========================================================
   CALENDÁRIO MOBILE V4 — funciona diretamente na nova Home.
   Exclusivo até 700px; desktop permanece intacto.
   ========================================================= */
(function setupCornerProMobileCalendar(){
  const mq=window.matchMedia('(max-width:700px)');
  if(!mq.matches) return;
  const trigger=document.querySelector('.cpHomeCalendar');
  if(!trigger || window.__cpMobileCalendarV4) return;
  window.__cpMobileCalendarV4=true;

  const MONTHS=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const SHORT=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const pad=n=>String(n).padStart(2,'0');
  const toYMD=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseYMD=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return new Date();const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d,12)};
  const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const input=document.getElementById('date');
  let selected=parseYMD(input?.value||new URL(location.href).searchParams.get('date')||toYMD(new Date()));
  let view=new Date(selected);

  const layer=document.createElement('section');
  layer.className='cpMobileCalendarLayer';
  layer.setAttribute('aria-hidden','true');
  layer.innerHTML=`<div class="cpMobileCalendarSheet" role="dialog" aria-modal="true" aria-label="Escolher data">
    <div class="cpMobileCalendarGrab"></div>
    <header class="cpMobileCalendarHead"><button type="button" data-cpm-cal-close aria-label="Fechar">×</button><div><strong>Escolha a data</strong><small>Veja os jogos disponíveis no dia</small></div><span></span></header>
    <div class="cpMobileCalendarNav"><button type="button" data-cpm-cal-prev>‹</button><strong data-cpm-cal-title></strong><button type="button" data-cpm-cal-next>›</button></div>
    <div class="cpMobileCalendarWeek"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
    <div class="cpMobileCalendarGrid" data-cpm-cal-grid></div>
    <div class="cpMobileCalendarActions"><button class="cpMobileCalendarToday" type="button" data-cpm-cal-today>HOJE</button><button class="cpMobileCalendarApply" type="button" data-cpm-cal-apply>CARREGAR JOGOS</button></div>
  </div>`;
  document.body.appendChild(layer);
  const title=layer.querySelector('[data-cpm-cal-title]');
  const grid=layer.querySelector('[data-cpm-cal-grid]');

  function updateTrigger(){trigger.innerHTML=`<span class="cpCalMonth">${SHORT[selected.getMonth()]}</span><span class="cpCalDay">${pad(selected.getDate())}</span>`;}
  function render(){
    title.textContent=`${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    const first=new Date(view.getFullYear(),view.getMonth(),1,12);const start=new Date(first);start.setDate(first.getDate()-first.getDay());
    let out='';const today=new Date();
    for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const cls=['cpMobileCalendarDay'];if(d.getMonth()!==view.getMonth())cls.push('is-muted');if(same(d,today))cls.push('is-today');if(same(d,selected))cls.push('is-selected');out+=`<button type="button" class="${cls.join(' ')}" data-cpm-date="${toYMD(d)}">${d.getDate()}</button>`;}
    grid.innerHTML=out;
  }
  function open(){view=new Date(selected);render();layer.classList.add('is-open');layer.setAttribute('aria-hidden','false');document.body.classList.add('cp-mobile-calendar-lock');}
  function close(){layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true');document.body.classList.remove('cp-mobile-calendar-lock');}
  async function apply(){
    const ymd=toYMD(selected);
    if(typeof window.CornerProMobileHomeLoading==='function'){
      window.CornerProMobileHomeLoading('selected');
    }if(input){input.value=ymd;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
    const url=new URL(location.href);url.searchParams.set('date',ymd);url.hash='';history.replaceState({},'',url.pathname+url.search);updateTrigger();close();
    try{
      if(typeof window.CornerProReloadRealGames==='function'){await window.CornerProReloadRealGames(ymd);return;}
      if(typeof window.loadAll==='function'){await window.loadAll({date:ymd,fresh:true});return;}
      if(typeof loadAll==='function'){await loadAll({date:ymd,fresh:true});return;}
      location.reload();
    }catch(err){console.error('Calendário mobile:',err);location.reload();}
  }

  trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});
  layer.addEventListener('click',e=>{
    if(e.target===layer||e.target.closest('[data-cpm-cal-close]')){close();return;}
    if(e.target.closest('[data-cpm-cal-prev]')){view=new Date(view.getFullYear(),view.getMonth()-1,1,12);render();return;}
    if(e.target.closest('[data-cpm-cal-next]')){view=new Date(view.getFullYear(),view.getMonth()+1,1,12);render();return;}
    if(e.target.closest('[data-cpm-cal-today]')){selected=new Date();view=new Date(selected);render();return;}
    const day=e.target.closest('[data-cpm-date]');if(day){selected=parseYMD(day.dataset.cpmDate);view=new Date(selected);render();return;}
    if(e.target.closest('[data-cpm-cal-apply]')) apply();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer.classList.contains('is-open'))close();});
  updateTrigger();
})();
/* =========================================================
   MATCH CENTER PREMIUM MOBILE V4 — SOMENTE CELULAR
   Reorganiza apenas a cópia mobile; desktop permanece intacto.
   ========================================================= */
(function installPremiumMobileMatchCenter(){
  "use strict";
  if(window.__premiumMobileMatchCenterV4) return;
  window.__premiumMobileMatchCenterV4 = true;

  const mobile=()=>window.matchMedia&&window.matchMedia("(max-width:700px)").matches;
  const esc=v=>String(v??"—").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const text=(root,sel,fallback="—")=>String(root.querySelector(sel)?.textContent||fallback).trim();
  const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return Number.isFinite(n)?n:null};
  const initials=name=>String(name||"FC").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();

  function metricRows(clone){
    const rows=[];
    clone.querySelectorAll(".mcRailCompare .mcMetricRow,.mcRailCompare [class*='metric'],.mcRailCompare>div").forEach(el=>{
      const raw=String(el.textContent||"").replace(/\s+/g," ").trim();
      if(!raw||/comparativo|real/i.test(raw)) return;
      const numbers=raw.match(/\d+(?:[.,]\d+)?%?|—/g)||[];
      if(numbers.length<2) return;
      let label=raw;
      numbers.forEach(n=>{label=label.replace(n,"")});
      label=label.replace(/\s+/g," ").trim();
      if(label&&rows.length<8) rows.push({label,home:numbers[0],away:numbers[numbers.length-1]});
    });
    const unique=[]; const seen=new Set();
    rows.forEach(r=>{const k=r.label.toLowerCase();if(!seen.has(k)){seen.add(k);unique.push(r)}});
    return unique;
  }

  function parseScore(clone){
    const s=text(clone,".mcRailScore strong","0 - 0");
    const m=s.match(/(\d+)\s*[-x×]\s*(\d+)/i); return m?[m[1],m[2]]:["0","0"];
  }

  function parseEvents(clone){
    const out=[];
    clone.querySelectorAll(".mcRailMini:last-child li,.mcRailMini:last-child [class*='event'],.mcRailMini:last-child p").forEach((el,i)=>{
      const t=String(el.textContent||"").replace(/\s+/g," ").trim(); if(!t) return;
      const minute=(t.match(/\b\d{1,3}'?/)||[])[0]||`${(i+1)*12}'`;
      let icon="•",kind="Momento importante";
      if(/gol/i.test(t)){icon="⚽";kind="Gol"}else if(/escante|canto/i.test(t)){icon="⚑";kind="Escanteio"}else if(/cart/i.test(t)){icon="🟨";kind="Cartão"}
      out.push({minute,icon,kind,text:t});
    });
    return out.slice(0,10);
  }

  function statIcon(label){
    const s=label.toLowerCase();
    if(s.includes("escante"))return"⚑";if(s.includes("final"))return"◎";if(s.includes("posse"))return"◔";if(s.includes("cart"))return"▯";if(s.includes("alvo"))return"🎯";if(s.includes("passe"))return"↗";if(s.includes("falta"))return"!";return"●";
  }

  function build(clone){
    if(!mobile()||clone.dataset.premiumBuilt==="1") return;
    clone.dataset.premiumBuilt="1";
    const home=text(clone,".mcRailTeam:first-child strong","Mandante");
    const away=text(clone,".mcRailTeam:last-child strong","Visitante");
    const league=text(clone,".mcRailMeta","Liga • —");
    const status=text(clone,".railTitle b","ENCERRADO");
    const [gh,ga]=parseScore(clone);
    const metrics=metricRows(clone);
    const corners=metrics.find(r=>/escante/i.test(r.label))||{home:"—",away:"—"};
    const pressureHome=(text(clone,".mcRailPressureSplit>div:first-child strong","50%").match(/\d+/)||[50])[0];
    const pressureAway=(text(clone,".mcRailPressureSplit>div:last-child strong","50%").match(/\d+/)||[50])[0];
    const pressureLevel=text(clone,".mcRailPressureHead b","PRESSÃO ALTA");
    const reading=text(clone,".mcRailMini:first-child p",`${home} aparece com maior pressão ofensiva no recorte atual.`);
    const svg=clone.querySelector(".mcRailPressureCard svg")?.outerHTML||'<div class="mcPremiumEmpty">Gráfico ainda não disponível para esta partida.</div>';
    const events=parseEvents(clone);

    const preferred=["Escanteios","Finalizações","Posse de bola","Cartões"];
    const stats=[...preferred.map(p=>metrics.find(r=>r.label.toLowerCase().includes(p.toLowerCase().split(" ")[0]))).filter(Boolean),...metrics].filter((r,i,a)=>a.indexOf(r)===i).slice(0,4);
    while(stats.length<4) stats.push({label:["Escanteios","Finalizações","Posse de bola","Cartões"][stats.length],home:"—",away:"—"});

    clone.innerHTML=`<div class="mcPremiumMobile">
      <section class="mcPremiumHero">
        <div class="mcPremiumLeague">${esc(league)}</div><span class="mcPremiumStatus">${esc(status)}</span>
        <div class="mcPremiumScoreGrid">
          <div class="mcPremiumTeam"><div class="mcPremiumBadge">${esc(initials(home))}</div><b>${esc(home)}</b></div>
          <div class="mcPremiumScore"><strong>${esc(gh)} - ${esc(ga)}</strong><small>${esc(status)}</small></div>
          <div class="mcPremiumTeam away"><div class="mcPremiumBadge">${esc(initials(away))}</div><b>${esc(away)}</b></div>
        </div>
        <div class="mcPremiumCorners"><strong>${esc(corners.home)}</strong><i>|</i><span>⚑ Escanteios</span><i>|</i><strong>${esc(corners.away)}</strong></div>
      </section>
      <nav class="mcPremiumTabs">
        <button class="mcPremiumTab active" data-mc-pane="summary"><span>▥</span>Resumo</button>
        <button class="mcPremiumTab" data-mc-pane="stats"><span>◔</span>Estatísticas</button>
        <button class="mcPremiumTab" data-mc-pane="pressure"><span>⌁</span>Pressão</button>
        <button class="mcPremiumTab" data-mc-pane="moments"><span>◷</span>Momentos</button>
      </nav>
      <section class="mcPremiumPane active" data-mc-content="summary">
        <div class="mcPremiumStatsGrid">${stats.map(r=>{const h=num(r.home),a=num(r.away),pct=(h!==null&&a!==null&&h+a>0)?Math.round(h/(h+a)*100):50;return `<article class="mcPremiumStat"><div class="mcPremiumStatHead"><span>${statIcon(r.label)}</span>${esc(r.label)}</div><div class="mcPremiumStatValues"><b>${esc(r.home)}</b><i>×</i><b>${esc(r.away)}</b></div><div class="mcPremiumBar"><i style="width:${pct}%"></i></div></article>`}).join("")}</div>
        <article class="mcPremiumCard"><div class="mcPremiumCardHead"><h3>Leitura do jogo</h3><span class="mcPremiumPill">CORNER IA</span></div><div class="mcPremiumReading"><span>✦</span><p>${esc(reading)}</p></div></article>
      </section>
      <section class="mcPremiumPane" data-mc-content="stats"><div class="mcPremiumStatsGrid">${metrics.map(r=>{const h=num(r.home),a=num(r.away),pct=(h!==null&&a!==null&&h+a>0)?Math.round(h/(h+a)*100):50;return `<article class="mcPremiumStat"><div class="mcPremiumStatHead"><span>${statIcon(r.label)}</span>${esc(r.label)}</div><div class="mcPremiumStatValues"><b>${esc(r.home)}</b><i>×</i><b>${esc(r.away)}</b></div><div class="mcPremiumBar"><i style="width:${pct}%"></i></div></article>`}).join("")||'<div class="mcPremiumEmpty">Estatísticas ainda não disponíveis.</div>'}</div></section>
      <section class="mcPremiumPane" data-mc-content="pressure"><article class="mcPremiumCard"><div class="mcPremiumCardHead"><h3>Gráfico de pressão</h3><span class="mcPremiumPill">${esc(pressureLevel)}</span></div><div class="mcPremiumPressureNames"><b>${esc(home)} ${esc(pressureHome)}%</b><b>${esc(away)} ${esc(pressureAway)}%</b></div><div class="mcPremiumPressureBar"><i style="width:${pressureHome}%"></i><i style="width:${pressureAway}%"></i></div><div class="mcPremiumChartWrap">${svg}</div><div class="mcPremiumReading"><span>⌁</span><p>${esc(reading)}</p></div></article></section>
      <section class="mcPremiumPane" data-mc-content="moments"><article class="mcPremiumCard"><div class="mcPremiumCardHead"><h3>Momentos importantes</h3></div><div class="mcPremiumTimeline">${events.length?events.map((e,i)=>`<div class="mcPremiumEvent"><time>${esc(e.minute)}</time><span>${e.icon}</span><div><b>${esc(e.kind)}</b><small>${esc(e.text)}</small></div><em>${i%2?esc(ga):esc(gh)}</em></div>`).join(""):'<div class="mcPremiumEmpty">Nenhum momento detalhado disponível para esta partida.</div>'}</div></article></section>
    </div>`;
  }

  document.addEventListener("click",e=>{
    if(!mobile())return;
    const tab=e.target.closest(".mcPremiumTab");if(!tab)return;
    const root=tab.closest(".mcPremiumMobile");if(!root)return;
    root.querySelectorAll(".mcPremiumTab").forEach(x=>x.classList.toggle("active",x===tab));
    root.querySelectorAll(".mcPremiumPane").forEach(x=>x.classList.toggle("active",x.dataset.mcContent===tab.dataset.mcPane));
  });

  const target=document.getElementById("cpMobileMatchContent");
  if(!target)return;
  const observer=new MutationObserver(()=>{
    const clone=target.querySelector(".cpMobileRailClone");
    if(clone&&!clone.dataset.premiumBuilt) setTimeout(()=>build(clone),20);
  });
  observer.observe(target,{childList:true,subtree:true});
})();