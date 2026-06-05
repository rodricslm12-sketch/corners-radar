// =========================================================
// ADMIN JS — Corners Radar PREMIUM
// =========================================================

const timeEl = document.createElement("div");
timeEl.className = "adminClock";

document.querySelector(".topbar").appendChild(timeEl);

// =========================================================
// CLOCK
// =========================================================

function updateClock(){

  const now = new Date();

  timeEl.textContent = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

}

updateClock();

setInterval(updateClock, 1000);

// =========================================================
// BUTTON EFFECT
// =========================================================

document.querySelectorAll(".actionBtn").forEach(btn => {

  btn.addEventListener("click", () => {

    btn.classList.add("clicked");

    setTimeout(() => {
      btn.classList.remove("clicked");
    }, 300);

  });

});

// =========================================================
// FETCH ADMIN STATS
// =========================================================

async function loadAdminStats(){

  try{

    const res = await fetch("/admin/stats");

    const data = await res.json();

    console.log("ADMIN STATS:", data);

    // USERS
    const usersCard = document.querySelector(".green strong");

    if(usersCard){
      usersCard.textContent = data.onlineUsers;
    }

    // MATCHES
    const gamesCard = document.querySelector(".blue strong");

    if(gamesCard){
      gamesCard.textContent = data.matchesToday;
    }

    // IA
    const iaCard = document.querySelector(".orange strong");

    if(iaCard){
      iaCard.textContent = data.aiAccuracy + "%";
    }

    // API STATUS
    const apiCard = document.querySelector(".red strong");

    if(apiCard){
      apiCard.textContent = data.apiStatus;
    }

  }catch(err){

    console.error("Erro admin stats:", err);

  }

}

// =========================================================
// AUTO UPDATE
// =========================================================

loadAdminStats();

setInterval(loadAdminStats, 15000);

// =========================================================
// ONLINE USERS LIST
// =========================================================

async function loadOnlineUsers(){

    try{

      const res = await fetch("/admin/users");

      const users = await res.json();

      const list = document.getElementById("onlineUsersList");

      if(!list) return;

      if(!Array.isArray(users) || users.length === 0){

        list.innerHTML = `
          <div class="onlineUser">
            Nenhum usuário online agora
          </div>
        `;

        return;

      }

      list.innerHTML = users.map(user => `

        <div class="onlineUser">

          <div class="onlineUserLeft">
            <span class="onlinePulse"></span>
            <strong>${user.device}</strong>
          </div>

          <small>${user.browser}</small>

        </div>

      `).join("");

    }catch(err){

      console.error("Erro online users:", err);

    }

  }

  loadOnlineUsers();

  setInterval(loadOnlineUsers, 10000);

  // =========================================================
// LIVE GAMES
// =========================================================

async function loadLiveGames(){

    try{

      const res = await fetch("/admin/live-games");

      const data = await res.json();

      const list = document.getElementById("liveGamesList");

      if(!list) return;

      if(!data.games || data.games.length === 0){

        list.innerHTML = `
          <div class="liveGameEmpty">
            Nenhum jogo encontrado hoje
          </div>
        `;

        return;

      }

      list.innerHTML = data.games.map(game => `

        <div class="liveGameRow">

          <div class="liveGameInfo">

            <strong>
              ${game.home} x ${game.away}
            </strong>

            <small>
              ${game.league} • ${game.time}
            </small>

          </div>

          <div class="liveGameRight">

            <div class="liveGameBadges">

              <span class="liveProb">
                ${game.probability || "-"}%
              </span>

              <span class="liveCorners">
                ${game.projectedCorners || "-"}
              </span>

            </div>

            <small>
              IA • cantos
            </small>

          </div>

        </div>

      `).join("");

    }catch(err){

      console.error("Erro live games:", err);

    }

  }

  loadLiveGames();

  setInterval(loadLiveGames, 20000);