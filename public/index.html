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
  userFilter: "all",
  userSearch: "",
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
      list.innerHTML = `
        <div class="activityEmptyState">
          <div class="activityEmptyIcon">◌</div>
          <strong>Nenhuma atividade recente</strong>
          <span>Logins e cadastros aparecerão aqui.</span>
        </div>
      `;
      return;
    }

    list.innerHTML = events.slice(0, 6).map(event => {
      const signup = event.type === "signup";
      const title = signup ? "Novo cadastro" : "Login realizado";
      const icon = signup ? "✦" : "↪";
      const who = event.nome || event.email || "Usuário";
      const provider = providerLabel(event.provider);

      return `
        <div class="activityCleanRow ${signup ? "signup" : "login"}">
          <div class="activityCleanIcon">${icon}</div>

          <div class="activityCleanText">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(who)}</span>
          </div>

          <div class="activityProvider">${escapeHtml(provider)}</div>

          <time>${escapeHtml(formatTimeAgo(event.at))}</time>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro activity:", error);
    list.innerHTML = `
      <div class="activityEmptyState error">
        <div class="activityEmptyIcon">!</div>
        <strong>Não foi possível carregar</strong>
        <span>Tente atualizar em alguns segundos.</span>
      </div>
    `;
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

function isUserOnline(user) {
  if (!user?.lastSeen) return false;
  const ms = new Date(user.lastSeen).getTime();
  return Number.isFinite(ms) && (Date.now() - ms <= 2 * 60 * 1000);
}

function userStatusLabel(user) {
  return isUserOnline(user) ? "Online" : "Offline";
}

function applyUsersFilter() {
  const query = String(state.userSearch || "").trim().toLowerCase();
  const filter = state.userFilter || "all";

  const filtered = state.users.filter(user => {
    const matchesSearch =
      !query ||
      String(user.nome || "").toLowerCase().includes(query) ||
      String(user.email || "").toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filter === "online") return isUserOnline(user);
    if (filter === "offline") return !isUserOnline(user);
    if (filter === "pro") return user.premium === true;
    if (filter === "free") return user.premium !== true;
    return true;
  });

  renderUsers(filtered);
}

function renderUsers(users) {
  const list = $("#adminUsersTableBody");
  if (!list) return;

  if (!users.length) {
    list.innerHTML = '<div class="simpleEmpty usersEmpty">Nenhum usuário encontrado.</div>';
    return;
  }

  list.innerHTML = users.map(user => {
    const online = isUserOnline(user);
    const provider = providerLabel(user.provedor);
    const created = user.criadoEm ? formatDate(user.criadoEm) : "—";
    const lastAccess = user.ultimoLogin ? formatDate(user.ultimoLogin) : "Nunca";

    return `
      <article class="userManageCard ${online ? "is-online" : "is-offline"}" data-user-uid="${escapeHtml(user.uid)}">
        <div class="userManageIdentity">
          ${user.foto
            ? `<img src="${escapeHtml(user.foto)}" alt="">`
            : `<span class="userManageAvatarFallback">${escapeHtml((user.nome || "U").charAt(0).toUpperCase())}</span>`}
          <div>
            <strong>${escapeHtml(user.nome || "Usuário")}</strong>
            <small>${escapeHtml(user.email || "—")}</small>
            <em>${escapeHtml(provider)}</em>
          </div>
        </div>

        <div class="userManageField">
          <small>Cadastro</small>
          <strong>${escapeHtml(created)}</strong>
        </div>

        <div class="userManageField">
          <small>Último acesso</small>
          <strong>${escapeHtml(lastAccess)}</strong>
        </div>

        <div class="userManageField">
          <small>Status</small>
          <span class="userStatusBadge ${online ? "online" : "offline"}">
            <i></i>${online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        <div class="userManageField">
          <small>Plano</small>
          <span class="planBadge ${user.premium ? "is-pro" : "is-free"}">${user.premium ? "PRO" : "FREE"}</span>
        </div>

        <div class="userManageAction">
          <button class="planActionBtn ${user.premium ? "remove" : "activate"}" type="button"
            data-user-plan="${user.premium ? "false" : "true"}"
            data-user-uid="${escapeHtml(user.uid)}">
            ${user.premium ? "TORNAR FREE" : "ATIVAR PRO"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function updateUsersSummary(users) {
  const pro = users.filter(user => user.premium).length;
  const free = users.length - pro;
  const online = users.filter(isUserOnline).length;

  if ($("#adminTotalUsers")) $("#adminTotalUsers").textContent = users.length;
  if ($("#adminOnlineUsers")) $("#adminOnlineUsers").textContent = online;
  if ($("#adminProUsers")) $("#adminProUsers").textContent = pro;
  if ($("#adminFreeUsers")) $("#adminFreeUsers").textContent = free;
}

async function loadUsers() {
  try {
    showUsersMessage("Carregando usuários...", "info");
    const data = await adminFetch("/admin/users?limit=500");
    state.users = Array.isArray(data.users) ? data.users : [];
    applyUsersFilter();
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
    applyUsersFilter();
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
  $("#adminUsersRefresh")?.addEventListener("click", async () => {
    await loadUsers();
    await loadAdminStats();
  });

  $("#refreshOnlineUsers")?.addEventListener("click", () => {
    loadOnlineUsers();
    loadAdminStats();
  });

  let searchTimer;
  $("#adminUserSearch")?.addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.userSearch = event.target.value || "";
      applyUsersFilter();
    }, 140);
  });

  $("#adminUsersFilters")?.addEventListener("click", event => {
    const button = event.target.closest("[data-user-filter]");
    if (!button) return;

    state.userFilter = button.dataset.userFilter || "all";

    $$("#adminUsersFilters [data-user-filter]").forEach(btn => {
      btn.classList.toggle("active", btn === button);
    });

    applyUsersFilter();
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


function showAdminLoginGate(message = "") {
  let gate = document.getElementById("adminLoginGate");

  if (!gate) {
    gate = document.createElement("div");
    gate.id = "adminLoginGate";
    gate.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(2,7,15,.92);
      backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px);
    `;

    gate.innerHTML = `
      <div style="
        width:min(420px,100%);
        border:1px solid rgba(0,245,141,.28);
        border-radius:18px;
        background:#0b1523;
        padding:28px;
        box-shadow:0 28px 80px rgba(0,0,0,.55);
        color:#fff;
        text-align:center;
      ">
        <div style="
          width:54px;
          height:54px;
          margin:0 auto 14px;
          display:grid;
          place-items:center;
          border-radius:15px;
          background:rgba(0,245,141,.1);
          color:#00f58d;
          font-size:24px;
        ">🔐</div>

        <h2 style="margin:0 0 8px;font-size:22px;">Acesso administrativo</h2>
        <p style="margin:0 0 18px;color:#8fa1b8;font-size:12px;line-height:1.5;">
          Entre com a conta Google autorizada para abrir o painel.
        </p>

        <div id="adminLoginGateMessage" style="
          display:${message ? "block" : "none"};
          margin:0 0 14px;
          padding:10px 12px;
          border-radius:10px;
          background:rgba(255,80,80,.08);
          border:1px solid rgba(255,80,80,.2);
          color:#ff9f9f;
          font-size:11px;
        ">${escapeHtml(message)}</div>

        <button id="adminLoginGateButton" type="button" style="
          width:100%;
          height:46px;
          border:0;
          border-radius:11px;
          background:#00f58d;
          color:#06110b;
          font-weight:950;
          cursor:pointer;
        ">ENTRAR COM GOOGLE</button>

        <button id="adminLoginGateBack" type="button" style="
          margin-top:10px;
          width:100%;
          height:40px;
          border:1px solid #203047;
          border-radius:10px;
          background:#0a1320;
          color:#8fa1b8;
          font-weight:800;
          cursor:pointer;
        ">VOLTAR AO SITE</button>
      </div>
    `;

    document.body.appendChild(gate);

    gate.querySelector("#adminLoginGateButton")?.addEventListener("click", async () => {
      const btn = gate.querySelector("#adminLoginGateButton");
      const msg = gate.querySelector("#adminLoginGateMessage");

      if (btn) {
        btn.disabled = true;
        btn.textContent = "ABRINDO GOOGLE...";
      }

      if (msg) {
        msg.style.display = "none";
        msg.textContent = "";
      }

      try {
        await entrarComGoogle();
        // onAuthStateChanged continuará o fluxo automaticamente.
      } catch (error) {
        if (msg) {
          msg.textContent = error?.message || "Não foi possível abrir o login.";
          msg.style.display = "block";
        }

        if (btn) {
          btn.disabled = false;
          btn.textContent = "ENTRAR COM GOOGLE";
        }
      }
    });

    gate.querySelector("#adminLoginGateBack")?.addEventListener("click", () => {
      location.href = "/";
    });
  } else {
    const msg = gate.querySelector("#adminLoginGateMessage");
    if (msg && message) {
      msg.textContent = message;
      msg.style.display = "block";
    }
  }

  gate.style.display = "flex";
}

function hideAdminLoginGate() {
  const gate = document.getElementById("adminLoginGate");
  if (gate) gate.style.display = "none";
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
      // IMPORTANTE:
      // não abre popup automaticamente, porque navegadores bloqueiam popups
      // que não foram iniciados por um clique do usuário.
      showAdminLoginGate();
      return;
    }

    hideAdminLoginGate();
    state.user = user;

    try {
      await validateAdmin(user);

      if (!document.body.dataset.adminReady) {
        document.body.dataset.adminReady = "1";
        startDashboard();
      }
    } catch (error) {
      console.error("Acesso admin negado:", error);

      // Se existe login, mas não é uma conta administrativa,
      // mostra o motivo no próprio painel em vez de redirecionar após um alert.
      try {
        await sairDaConta();
      } catch (_) {}

      document.body.dataset.adminReady = "";
      showAdminLoginGate(
        error?.message || "Esta conta não possui acesso administrativo."
      );
    }
  });
}

startAuth();