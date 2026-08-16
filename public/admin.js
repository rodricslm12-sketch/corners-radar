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
  timerActivity: null
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
  try { return await response.json(); }
  catch { return {}; }
}

async function adminFetch(url, options = {}) {
  const response = await fetchAutenticado(url, { cache: "no-store", ...options });
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

function formatTimeAgo(value) {
  if (!value) return "agora";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h atrás`;
  return formatDate(value);
}

function providerLabel(value = "") {
  const p = String(value).toLowerCase();
  if (p.includes("google")) return "Google";
  if (p.includes("password")) return "E-mail/senha";
  return "Firebase";
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
  if (!topbar || $(".adminClock")) return;
  const timeEl = document.createElement("div");
  timeEl.className = "adminClock";
  topbar.appendChild(timeEl);
  const update = () => {
    timeEl.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };
  update();
  setInterval(update, 1000);
}

function switchView(view) {
  const usersView = $("#adminUsersView");
  const dashboardStats = $(".statsGrid");
  const dashboardGrid = $(".realAdminGrid");
  const isUsers = view === "users";

  if (usersView) usersView.hidden = !isUsers;
  if (dashboardStats) dashboardStats.hidden = isUsers;
  if (dashboardGrid) dashboardGrid.hidden = isUsers;

  $$("[data-admin-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.adminView === view);
  });

  const title = $(".titleBlock h2");
  const subtitle = $(".titleBlock p");
  if (title) title.textContent = isUsers ? "Usuários" : "Painel Administrativo";
  if (subtitle) subtitle.textContent = isUsers
    ? "Contas reais cadastradas no Corner Pro"
    : "Usuários e atividade real do Corner Pro";

  if (isUsers) loadUsers();
}

function installNavigation() {
  $$("[data-admin-view]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.adminView));
  });
  $("#openUsersManager")?.addEventListener("click", () => switchView("users"));
}

async function loadAdminStats() {
  try {
    const data = await adminFetch("/admin/stats");
    if ($("#dashTotalUsers")) $("#dashTotalUsers").textContent = data.totalUsers ?? 0;
    if ($("#dashOnlineUsers")) $("#dashOnlineUsers").textContent = data.onlineUsers ?? 0;
    if ($("#dashNewToday")) $("#dashNewToday").textContent = data.newToday ?? 0;
    if ($("#dashActiveToday")) $("#dashActiveToday").textContent = data.activeToday ?? 0;
    if ($("#dashPremiumUsers")) $("#dashPremiumUsers").textContent = data.premiumUsers ?? 0;
  } catch (error) {
    console.error("Erro admin stats:", error);
  }
}

async function loadOnlineUsers() {
  const list = $("#onlineUsersList");
  if (!list) return;

  try {
    const data = await adminFetch("/admin/online-users");
    const users = Array.isArray(data?.users) ? data.users : [];

    if (!users.length) {
      list.innerHTML = '<div class="simpleEmpty">Nenhum usuário online agora.</div>';
      return;
    }

    list.innerHTML = users.map(user => `
      <div class="onlineUser realOnlineUser">
        <div class="onlineUserLeft">
          ${user.foto
            ? `<img class="realUserAvatar" src="${escapeHtml(user.foto)}" alt="">`
            : `<span class="realUserAvatar fallback">${escapeHtml((user.nome || "U").charAt(0).toUpperCase())}</span>`}
          <div>
            <strong><i class="onlinePulse"></i>${escapeHtml(user.nome || "Usuário")}</strong>
            <p>${escapeHtml(user.email || "—")}</p>
          </div>
        </div>
        <div class="realUserMeta">
          <span class="planBadge ${user.premium ? "is-pro" : "is-free"}">${user.premium ? "PRO" : "FREE"}</span>
          <small>${escapeHtml(formatTimeAgo(user.lastSeen))}</small>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("Erro online users:", error);
    list.innerHTML = '<div class="simpleEmpty">Não foi possível carregar a presença.</div>';
  }
}

async function loadRecentActivity() {
  const list = $("#realActivityList");
  if (!list) return;

  try {
    const data = await adminFetch("/admin/recent-activity");
    const events = Array.isArray(data?.events) ? data.events : [];

    if (!events.length) {
      list.innerHTML = '<div class="simpleEmpty">Nenhuma atividade registrada ainda.</div>';
      return;
    }

    list.innerHTML = events.slice(0, 8).map(event => {
      const signup = event.type === "signup";
      return `
        <div class="realActivityRow">
          <i>${signup ? "✨" : "↪"}</i>
          <div>
            <strong>${signup ? "Novo cadastro" : "Login realizado"}</strong>
            <small>${escapeHtml(event.nome || event.email || "Usuário")} • ${escapeHtml(providerLabel(event.provider))}</small>
          </div>
          <time>${escapeHtml(formatTimeAgo(event.at))}</time>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro activity:", error);
    list.innerHTML = '<div class="simpleEmpty">Não foi possível carregar as atividades.</div>';
  }
}

function renderRecentUsers(users) {
  const list = $("#recentUsersList");
  if (!list) return;

  const sorted = [...users]
    .sort((a, b) => new Date(b.criadoEm || b.ultimoLogin || 0) - new Date(a.criadoEm || a.ultimoLogin || 0))
    .slice(0, 6);

  if (!sorted.length) {
    list.innerHTML = '<div class="simpleEmpty">Nenhum usuário cadastrado.</div>';
    return;
  }

  list.innerHTML = sorted.map(user => `
    <div class="recentUserRow">
      <div class="adminUserIdentity">
        ${user.foto
          ? `<img src="${escapeHtml(user.foto)}" alt="">`
          : `<span>${escapeHtml((user.nome || "U").charAt(0).toUpperCase())}</span>`}
        <div>
          <strong>${escapeHtml(user.nome || "Usuário")}</strong>
          <small>${escapeHtml(user.email || "—")}</small>
        </div>
      </div>
      <div class="recentUserInfo">
        <span class="planBadge ${user.premium ? "is-pro" : "is-free"}">${user.premium ? "PRO" : "FREE"}</span>
        <small>Último acesso: ${escapeHtml(formatDate(user.ultimoLogin))}</small>
      </div>
    </div>
  `).join("");
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
            <small>${escapeHtml(providerLabel(user.provedor))}</small>
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
    renderRecentUsers(state.users);
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
    renderRecentUsers(state.users);
    updateUsersSummary(state.users);
    loadAdminStats();
    showUsersMessage(premium ? "Plano PRO ativado." : "Plano alterado para FREE.", "success");
  } catch (error) {
    showUsersMessage(error.message, "error");
    button.disabled = false;
    button.textContent = original;
  }
}

function installUsersEvents() {
  $("#adminUsersRefresh")?.addEventListener("click", loadUsers);
  $("#refreshOnlineUsers")?.addEventListener("click", () => {
    loadOnlineUsers();
    loadAdminStats();
  });

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
  installNavigation();
  installUsersEvents();
  installLogout();

  loadAdminStats();
  loadOnlineUsers();
  loadRecentActivity();
  loadUsers();

  state.timerStats = setInterval(loadAdminStats, 15000);
  state.timerOnline = setInterval(loadOnlineUsers, 15000);
  state.timerActivity = setInterval(loadRecentActivity, 30000);
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