import {
  firebaseAuth,
  entrarComGoogle,
  sairDaConta,
  observarAutenticacao,
  fetchAutenticado
} from "./firebase-client.js";

const state = {
  user: null,
  users: [],
  timerStats: null,
  timerOnline: null,
  timerGames: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function adminFetch(url, options = {}) {
  const response = await fetchAutenticado(url, {
    cache: "no-store",
    ...options
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Falha na operação administrativa.");
  }
  return data;
}

function showUsersMessage(text = "", type = "info") {
  const el = $("#adminUsersMessage");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text;
  el.dataset.type = type;
}

function formatDate(value) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function updateAdminProfile(user) {
  const name = user?.displayName || user?.email || "Admin";
  const avatar = $(".adminProfile .avatar");
  const strong = $(".adminProfile strong");
  if (strong) strong.textContent = name;
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || "A";
}

function installClock() {
  const topbar = $(".topbar");
  if (!topbar) return;
  const timeEl = document.createElement("div");
  timeEl.className = "adminClock";
  topbar.appendChild(timeEl);

  const update = () => {
    timeEl.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };
  update();
  setInterval(update, 1000);
}

function installButtonEffects() {
  $$(".actionBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.add("clicked");
      setTimeout(() => btn.classList.remove("clicked"), 300);
    });
  });
}

function switchView(view) {
  const usersView = $("#adminUsersView");
  const dashboardStats = $(".statsGrid");
  const dashboardGrid = $(".dashboardGrid");
  const isUsers = view === "users";

  if (usersView) usersView.hidden = !isUsers;
  if (dashboardStats) dashboardStats.hidden = isUsers;
  if (dashboardGrid) dashboardGrid.hidden = isUsers;

  $$("[data-admin-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.adminView === view);
  });

  const title = $(".titleBlock h2");
  const subtitle = $(".titleBlock p");
  if (title) title.textContent = isUsers ? "Gerenciamento de Usuários" : "Painel Administrativo";
  if (subtitle) subtitle.textContent = isUsers
    ? "Controle de contas FREE e PRO pelo Firestore"
    : "Monitoramento em tempo real do Corners Radar";

  if (isUsers) loadUsers();
}

function installNavigation() {
  $$("[data-admin-view]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.adminView));
  });
}

async function loadAdminStats() {
  try {
    const data = await adminFetch("/admin/stats");
    const usersCard = $(".green strong");
    const gamesCard = $(".purple strong");
    const iaCard = $(".orange strong");
    const apiCard = $(".blue strong");

    if (usersCard) usersCard.textContent = data.onlineUsers ?? data.totalUsers ?? 0;
    if (gamesCard) gamesCard.textContent = data.matchesToday ?? 0;
    if (iaCard) iaCard.textContent = `${data.aiAccuracy ?? 0}%`;
    if (apiCard) apiCard.textContent = data.apiStatus || "ATIVA";
  } catch (error) {
    console.error("Erro admin stats:", error);
  }
}

async function loadOnlineUsers() {
  try {
    const users = await adminFetch("/admin/online-users");
    const list = $("#onlineUsersList");
    if (!list) return;

    if (!Array.isArray(users) || !users.length) {
      list.innerHTML = '<div class="onlineUser">Nenhum usuário online agora</div>';
      return;
    }

    list.innerHTML = users.map(user => `
      <div class="onlineUser">
        <div class="onlineUserLeft">
          <span class="onlinePulse"></span>
          <div>
            <strong>${escapeHtml(user.device || user.name || "Usuário")}</strong>
            <p>${escapeHtml(user.location || "")}</p>
          </div>
        </div>
        <small>${escapeHtml(user.browser || "Online")}</small>
      </div>
    `).join("");
  } catch (error) {
    console.error("Erro online users:", error);
  }
}

async function loadLiveGames() {
  try {
    const response = await fetch("/admin/live-games", { cache: "no-store" });
    const data = await readJsonSafe(response);
    const list = $("#liveGamesList");
    if (!list) return;

    const games = Array.isArray(data?.games) ? data.games : [];
    if (!games.length) {
      list.innerHTML = '<div class="liveGameEmpty">Nenhum jogo encontrado hoje</div>';
      return;
    }

    list.innerHTML = games.map(game => `
      <div class="liveGameRow">
        <div class="liveGameInfo">
          <strong>${escapeHtml(game.home)} x ${escapeHtml(game.away)}</strong>
          <small>${escapeHtml(game.league)} • ${escapeHtml(game.time)}</small>
        </div>
        <div class="liveGameRight">
          <div class="liveGameBadges">
            <span class="liveProb">${escapeHtml(game.probability ?? "-")}%</span>
            <span class="liveCorners">${escapeHtml(game.projectedCorners ?? "-")}</span>
          </div>
          <small>IA • cantos</small>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("Erro live games:", error);
  }
}

function renderUsers(users) {
  const tbody = $("#adminUsersTableBody");
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr data-user-uid="${escapeHtml(user.uid)}">
      <td>
        <div class="adminUserIdentity">
          ${user.foto
            ? `<img src="${escapeHtml(user.foto)}" alt="">`
            : `<span>${escapeHtml((user.nome || "U").charAt(0).toUpperCase())}</span>`}
          <div>
            <strong>${escapeHtml(user.nome || "Usuário")}</strong>
            <small>${escapeHtml(user.uid)}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email || "—")}</td>
      <td><span class="planBadge ${user.premium ? "is-pro" : "is-free"}">${user.premium ? "PRO" : "FREE"}</span></td>
      <td>${escapeHtml(formatDate(user.ultimoLogin))}</td>
      <td>
        <button class="planActionBtn ${user.premium ? "remove" : "activate"}" type="button"
          data-user-plan="${user.premium ? "false" : "true"}"
          data-user-uid="${escapeHtml(user.uid)}">
          ${user.premium ? "REMOVER PRO" : "ATIVAR PRO"}
        </button>
      </td>
    </tr>
  `).join("");
}

function updateUsersSummary(users) {
  const pro = users.filter(user => user.premium).length;
  const free = users.length - pro;
  if ($("#adminTotalUsers")) $("#adminTotalUsers").textContent = users.length;
  if ($("#adminProUsers")) $("#adminProUsers").textContent = pro;
  if ($("#adminFreeUsers")) $("#adminFreeUsers").textContent = free;
}

async function loadUsers() {
  try {
    showUsersMessage("Carregando usuários...", "info");
    const data = await adminFetch("/admin/users?limit=500");
    state.users = Array.isArray(data.users) ? data.users : [];
    renderUsers(state.users);
    updateUsersSummary(state.users);
    showUsersMessage("");
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    showUsersMessage(error.message, "error");
  }
}

async function updateUserPlan(uid, premium, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "SALVANDO...";

  try {
    const data = await adminFetch(`/admin/users/${encodeURIComponent(uid)}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premium })
    });

    const index = state.users.findIndex(user => user.uid === uid);
    if (index >= 0) state.users[index] = data.user;
    renderUsers(state.users);
    updateUsersSummary(state.users);
    showUsersMessage(premium ? "Plano PRO ativado." : "Plano alterado para FREE.", "success");
  } catch (error) {
    showUsersMessage(error.message, "error");
    button.disabled = false;
    button.textContent = original;
  }
}

function installUsersEvents() {
  $("#adminUsersRefresh")?.addEventListener("click", loadUsers);

  let searchTimer;
  $("#adminUserSearch")?.addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = event.target.value.trim().toLowerCase();
      const filtered = !query ? state.users : state.users.filter(user =>
        String(user.nome || "").toLowerCase().includes(query) ||
        String(user.email || "").toLowerCase().includes(query) ||
        String(user.uid || "").toLowerCase().includes(query)
      );
      renderUsers(filtered);
    }, 180);
  });

  $("#adminUsersTableBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-user-plan]");
    if (!button) return;
    updateUserPlan(button.dataset.userUid, button.dataset.userPlan === "true", button);
  });
}

function installLogout() {
  $(".logoutBtn")?.addEventListener("click", async () => {
    await sairDaConta();
    location.href = "/";
  });
}

async function validateAdmin(user) {
  const data = await adminFetch("/admin/me");
  updateAdminProfile(user);
  return data;
}

function startDashboard() {
  installClock();
  installButtonEffects();
  installNavigation();
  installUsersEvents();
  installLogout();

  loadAdminStats();
  loadOnlineUsers();
  loadLiveGames();

  state.timerStats = setInterval(loadAdminStats, 15000);
  state.timerOnline = setInterval(loadOnlineUsers, 10000);
  state.timerGames = setInterval(loadLiveGames, 20000);
}

function startAuth() {
  observarAutenticacao(async authState => {
    const user = authState?.usuario || firebaseAuth.currentUser;

    if (!user) {
      try {
        await entrarComGoogle();
      } catch (error) {
        alert(error?.message || "Faça login para abrir o painel.");
        location.href = "/";
      }
      return;
    }

    state.user = user;
    try {
      await validateAdmin(user);
      if (!document.body.dataset.adminReady) {
        document.body.dataset.adminReady = "1";
        startDashboard();
      }
    } catch (error) {
      console.error("Acesso admin negado:", error);
      alert(error?.message || "Você não possui acesso administrativo.");
      location.href = "/";
    }
  });
}

startAuth();