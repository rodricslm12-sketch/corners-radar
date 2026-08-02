import {
  firebaseAuth,
  entrarComGoogle,
  sairDaConta,
  observarAutenticacao,
  fetchAutenticado
} from "./firebase-client.js";

const estadoAuth = {
  ocupado: false,
  usuario: null,
  perfil: null
};

const elementos = {
  loginDesktop: document.getElementById("btnGoogleLogin"),
  logoutDesktop: document.getElementById("btnGoogleLogout"),
  perfilDesktop: document.getElementById("authUserProfile"),
  fotoDesktop: document.getElementById("authUserPhoto"),
  nomeDesktop: document.getElementById("authUserName"),
  planoDesktop: document.getElementById("authUserPlan"),

  nomeMobile: document.getElementById("mobileAuthName"),
  botaoMobile: document.getElementById("mobileAuthButton"),

  nomeHomeMobile: document.getElementById("cpHomeAuthName"),
  botaoHomeMobile: document.getElementById("cpHomeAuthButton"),

  mensagem: document.getElementById("authMessage")
};

function escaparTexto(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mostrarMensagem(texto = "", tipo = "info") {
  const caixa = elementos.mensagem;
  if (!caixa) return;

  if (!texto) {
    caixa.hidden = true;
    caixa.textContent = "";
    caixa.removeAttribute("data-type");
    return;
  }

  caixa.textContent = texto;
  caixa.dataset.type = tipo;
  caixa.hidden = false;

  window.clearTimeout(mostrarMensagem.timer);
  mostrarMensagem.timer = window.setTimeout(() => {
    caixa.hidden = true;
  }, 5000);
}

function definirOcupado(ocupado) {
  estadoAuth.ocupado = ocupado;

  [
    elementos.loginDesktop,
    elementos.logoutDesktop,
    elementos.botaoMobile,
    elementos.botaoHomeMobile
  ].forEach(botao => {
    if (botao) botao.disabled = ocupado;
  });

  if (ocupado && elementos.loginDesktop) {
    elementos.loginDesktop.querySelector("b")?.replaceChildren("ENTRANDO...");
  }
}

function nomeCurto(usuario, perfil) {
  const nomeCompleto =
    perfil?.nome ||
    perfil?.displayName ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";

  return String(nomeCompleto).trim().split(/\s+/)[0] || "Usuário";
}

function perfilNormalizado(usuario, dados = {}) {
  const perfilServidor = dados?.user || dados?.usuario || dados?.perfil || dados || {};

  return {
    uid: usuario?.uid || perfilServidor?.uid || "",
    nome:
      perfilServidor?.nome ||
      perfilServidor?.displayName ||
      usuario?.displayName ||
      "Usuário",
    email: perfilServidor?.email || usuario?.email || "",
    foto:
      perfilServidor?.foto ||
      perfilServidor?.photoURL ||
      usuario?.photoURL ||
      "",
    premium:
      dados?.premium === true ||
      perfilServidor?.premium === true ||
      perfilServidor?.isPremium === true
  };
}

function sincronizarEstadoGlobal(usuario, perfil) {
  const premium = perfil?.premium === true;

  estadoAuth.usuario = usuario || null;
  estadoAuth.perfil = perfil || null;

  window.firebaseCurrentUser = usuario || null;
  window.firebaseCurrentProfile = perfil || null;
  window.firebaseIsPremium = premium;
  window.firebaseAuthenticatedFetch = fetchAutenticado;
  window.firebaseLoginWithGoogle = realizarLogin;
  window.firebaseLogout = realizarLogout;

  try {
    if (premium) {
      localStorage.setItem("cornersPremiumLogged", "1");
    } else {
      localStorage.removeItem("cornersPremiumLogged");
    }
  } catch (_) {}

  document.dispatchEvent(
    new CustomEvent("firebase-auth-updated", {
      detail: {
        user: usuario || null,
        profile: perfil || null,
        premium
      }
    })
  );
}

function removerInterfaceAntigaDuplicada() {
  const barraAntiga = document.getElementById("firebaseAuthBar");
  if (barraAntiga) barraAntiga.remove();
}

function renderizarDeslogado() {
  sincronizarEstadoGlobal(null, null);
  removerInterfaceAntigaDuplicada();

  if (elementos.loginDesktop) {
    elementos.loginDesktop.hidden = false;
    elementos.loginDesktop.disabled = false;
    const texto = elementos.loginDesktop.querySelector("b");
    if (texto) texto.textContent = "ENTRAR COM GOOGLE";
  }

  if (elementos.perfilDesktop) elementos.perfilDesktop.hidden = true;

  if (elementos.nomeMobile) elementos.nomeMobile.textContent = "Entrar com Google";
  if (elementos.botaoMobile) {
    elementos.botaoMobile.textContent = "⌄";
    elementos.botaoMobile.setAttribute("aria-label", "Entrar com Google");
    elementos.botaoMobile.disabled = false;
  }

  if (elementos.areaHomeMobile) elementos.areaHomeMobile.classList.remove("is-authenticated", "is-premium");
  if (elementos.fotoHomeMobile) {
    elementos.fotoHomeMobile.removeAttribute("src");
    elementos.fotoHomeMobile.hidden = true;
  }
  if (elementos.nomeHomeMobile) elementos.nomeHomeMobile.textContent = "Entrar";
  if (elementos.planoHomeMobile) elementos.planoHomeMobile.textContent = "COM GOOGLE";
  if (elementos.botaoHomeMobile) {
    elementos.botaoHomeMobile.innerHTML = '<span class="cpHomeAuthFallback" aria-hidden="true">●</span><i></i>';
    elementos.botaoHomeMobile.setAttribute("aria-label", "Entrar com Google");
    elementos.botaoHomeMobile.disabled = false;
  }
}

function renderizarLogado(usuario, perfil) {
  sincronizarEstadoGlobal(usuario, perfil);
  removerInterfaceAntigaDuplicada();

  const primeiroNome = nomeCurto(usuario, perfil);
  const nomeCompleto = perfil?.nome || usuario?.displayName || usuario?.email || "Usuário";
  const foto = perfil?.foto || usuario?.photoURL || "";
  const premium = perfil?.premium === true;

  if (elementos.loginDesktop) elementos.loginDesktop.hidden = true;
  if (elementos.perfilDesktop) elementos.perfilDesktop.hidden = false;

  if (elementos.nomeDesktop) elementos.nomeDesktop.textContent = nomeCompleto;

  if (elementos.planoDesktop) {
    elementos.planoDesktop.textContent = premium ? "PREMIUM ATIVO" : "PLANO GRATUITO";
    elementos.planoDesktop.classList.toggle("is-premium", premium);
  }

  if (elementos.fotoDesktop) {
    if (foto) {
      elementos.fotoDesktop.src = foto;
      elementos.fotoDesktop.hidden = false;
    } else {
      elementos.fotoDesktop.removeAttribute("src");
      elementos.fotoDesktop.hidden = true;
    }
  }

  if (elementos.nomeMobile) elementos.nomeMobile.textContent = `Olá, ${primeiroNome}`;
  if (elementos.botaoMobile) {
    elementos.botaoMobile.textContent = "⎋";
    elementos.botaoMobile.setAttribute("aria-label", "Sair da conta");
    elementos.botaoMobile.disabled = false;
  }

  if (elementos.areaHomeMobile) {
    elementos.areaHomeMobile.classList.add("is-authenticated");
    elementos.areaHomeMobile.classList.toggle("is-premium", premium);
  }

  if (elementos.fotoHomeMobile) {
    if (foto) {
      elementos.fotoHomeMobile.src = foto;
      elementos.fotoHomeMobile.alt = `Foto de ${nomeCompleto}`;
      elementos.fotoHomeMobile.hidden = false;
    } else {
      elementos.fotoHomeMobile.removeAttribute("src");
      elementos.fotoHomeMobile.hidden = true;
    }
  }

  if (elementos.nomeHomeMobile) elementos.nomeHomeMobile.textContent = primeiroNome;
  if (elementos.planoHomeMobile) {
    elementos.planoHomeMobile.textContent = premium ? "PLANO PRO" : "PLANO GRATUITO";
  }

  if (elementos.botaoHomeMobile) {
    elementos.botaoHomeMobile.innerHTML = '<span class="cpHomeAuthFallback" aria-hidden="true">●</span><i></i>';
    elementos.botaoHomeMobile.setAttribute("aria-label", "Sair da conta");
    elementos.botaoHomeMobile.disabled = false;
  }
}

async function lerJsonSeguro(resposta) {
  try {
    return await resposta.json();
  } catch (_) {
    return {};
  }
}

async function sincronizarComServidor(usuario, forcarToken = false) {
  if (!usuario) return null;

  const perfilFallback = perfilNormalizado(usuario, {
    user: {
      uid: usuario.uid,
      nome: usuario.displayName || usuario.email || "Usuário",
      email: usuario.email || "",
      foto: usuario.photoURL || "",
      premium: false
    },
    premium: false
  });

  let token;
  try {
    token = await usuario.getIdToken(forcarToken);
  } catch (erro) {
    console.warn("Não foi possível atualizar o token Firebase:", erro);
    return perfilFallback;
  }

  let dadosLogin = {};
  let dadosPerfil = {};

  try {
    const respostaLogin = await fetch("/auth/firebase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token }),
      cache: "no-store"
    });

    dadosLogin = await lerJsonSeguro(respostaLogin);

    if (!respostaLogin.ok) {
      console.warn(
        "Servidor não sincronizou o login; usando os dados do Google:",
        dadosLogin?.error || dadosLogin?.message || respostaLogin.status
      );
    }
  } catch (erro) {
    console.warn("Falha temporária em /auth/firebase:", erro);
  }

  try {
    const respostaPerfil = await fetch("/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    dadosPerfil = await lerJsonSeguro(respostaPerfil);

    if (!respostaPerfil.ok) {
      console.warn(
        "Perfil do servidor indisponível; usando os dados do Google:",
        dadosPerfil?.error || dadosPerfil?.message || respostaPerfil.status
      );
    }
  } catch (erro) {
    console.warn("Falha temporária em /auth/me:", erro);
  }

  return perfilNormalizado(usuario, {
    ...dadosLogin,
    ...dadosPerfil,
    user:
      dadosPerfil?.user ||
      dadosLogin?.user ||
      dadosPerfil?.usuario ||
      dadosLogin?.usuario ||
      perfilFallback,
    premium:
      dadosPerfil?.premium === true ||
      dadosLogin?.premium === true ||
      dadosPerfil?.user?.premium === true ||
      dadosLogin?.user?.premium === true
  });
}

async function realizarLogin() {
  if (estadoAuth.ocupado) return;

  definirOcupado(true);
  mostrarMensagem("");

  try {
    const resultado = await entrarComGoogle();
    const usuario = resultado?.usuario || firebaseAuth.currentUser;

    if (!usuario) {
      throw new Error("O Google não retornou um usuário autenticado.");
    }

    const perfil = await sincronizarComServidor(usuario, true);
    renderizarLogado(usuario, perfil);
    mostrarMensagem("Login realizado com sucesso.", "success");
  } catch (erro) {
    console.error("Falha no login Firebase:", erro);
    renderizarDeslogado();
    mostrarMensagem(erro?.message || "Não foi possível entrar com o Google.", "error");
  } finally {
    definirOcupado(false);
  }
}

async function realizarLogout() {
  if (estadoAuth.ocupado) return;

  definirOcupado(true);
  mostrarMensagem("");

  try {
    await sairDaConta();
    renderizarDeslogado();
    mostrarMensagem("Você saiu da conta.", "success");
  } catch (erro) {
    console.error("Falha no logout Firebase:", erro);
    mostrarMensagem(erro?.message || "Não foi possível sair da conta.", "error");
  } finally {
    definirOcupado(false);
  }
}

function acaoMobile() {
  if (estadoAuth.usuario) {
    realizarLogout();
  } else {
    realizarLogin();
  }
}

function instalarEventos() {
  elementos.loginDesktop?.addEventListener("click", realizarLogin);
  elementos.logoutDesktop?.addEventListener("click", realizarLogout);
  elementos.botaoMobile?.addEventListener("click", acaoMobile);
  elementos.botaoHomeMobile?.addEventListener("click", acaoMobile);

  elementos.fotoDesktop?.addEventListener("error", () => {
    elementos.fotoDesktop.hidden = true;
  });

  elementos.fotoHomeMobile?.addEventListener("error", () => {
    elementos.fotoHomeMobile.hidden = true;
    elementos.areaHomeMobile?.classList.add("has-photo-error");
  });
}

function observarBarraAntiga() {
  const observador = new MutationObserver(() => {
    removerInterfaceAntigaDuplicada();
  });

  observador.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function iniciarAutenticacao() {
  instalarEventos();
  observarBarraAntiga();
  renderizarDeslogado();

  observarAutenticacao(async estado => {
    const usuario = estado?.usuario || firebaseAuth.currentUser || null;

    if (!usuario) {
      renderizarDeslogado();
      return;
    }

    try {
      definirOcupado(true);
      const perfil = await sincronizarComServidor(usuario, false);
      renderizarLogado(usuario, perfil);
    } catch (erro) {
      console.error("Falha ao restaurar perfil no servidor:", erro);
      const perfilGoogle = perfilNormalizado(usuario, {});
      renderizarLogado(usuario, perfilGoogle);
      mostrarMensagem(
        "Conta Google restaurada. O plano será sincronizado quando o servidor responder.",
        "info"
      );
    } finally {
      definirOcupado(false);
    }
  });
}

iniciarAutenticacao();