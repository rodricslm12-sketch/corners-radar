import {
  firebaseAuth,
  entrarComGoogle,
  criarContaComEmail,
  entrarComEmail,
  redefinirSenha,
  sairDaConta,
  observarAutenticacao,
  fetchAutenticado
} from "./firebase-client.js";

const estadoAuth = {
  ocupado: false,
  usuario: null,
  perfil: null,
  modo: "login"
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

  areaHomeMobile: document.getElementById("cpHomeAuthArea"),
  nomeHomeMobile: document.getElementById("cpHomeAuthName"),
  planoHomeMobile: document.getElementById("cpHomeAuthPlan"),
  botaoHomeMobile: document.getElementById("cpHomeAuthButton"),
  fotoHomeMobile: document.getElementById("cpHomeAuthPhoto"),

  modal: document.getElementById("cpAuthModal"),
  modalBackdrop: document.getElementById("cpAuthModalBackdrop"),
  modalClose: document.getElementById("cpAuthModalClose"),
  modalTitle: document.getElementById("cpAuthModalTitle"),
  modalSubtitle: document.getElementById("cpAuthModalSubtitle"),
  tabLogin: document.getElementById("cpAuthTabLogin"),
  tabRegister: document.getElementById("cpAuthTabRegister"),
  nameWrap: document.getElementById("cpAuthNameWrap"),
  nameInput: document.getElementById("cpAuthName"),
  emailInput: document.getElementById("cpAuthEmail"),
  passwordInput: document.getElementById("cpAuthPassword"),
  confirmWrap: document.getElementById("cpAuthConfirmWrap"),
  confirmInput: document.getElementById("cpAuthPasswordConfirm"),
  submit: document.getElementById("cpAuthSubmit"),
  google: document.getElementById("cpAuthGoogle"),
  forgot: document.getElementById("cpAuthForgot"),
  switchText: document.getElementById("cpAuthSwitchText"),
  switchButton: document.getElementById("cpAuthSwitchButton"),
  formMessage: document.getElementById("cpAuthFormMessage"),

  mensagem: document.getElementById("authMessage")
};

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

function mostrarMensagemFormulario(texto = "", tipo = "info") {
  const caixa = elementos.formMessage;
  if (!caixa) return;

  caixa.textContent = texto;
  caixa.dataset.type = tipo;
  caixa.hidden = !texto;
}

function definirOcupado(ocupado) {
  estadoAuth.ocupado = ocupado;

  [
    elementos.loginDesktop,
    elementos.logoutDesktop,
    elementos.botaoMobile,
    elementos.botaoHomeMobile,
    elementos.submit,
    elementos.google,
    elementos.forgot
  ].forEach(botao => {
    if (botao) botao.disabled = ocupado;
  });

  if (elementos.submit) {
    elementos.submit.classList.toggle("is-loading", ocupado);
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
  window.firebaseLoginWithGoogle = realizarLoginGoogle;
  window.firebaseLogout = realizarLogout;
  window.firebaseOpenAuth = abrirModal;

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
    if (texto) texto.textContent = "ENTRAR / CRIAR CONTA";
  }

  if (elementos.perfilDesktop) elementos.perfilDesktop.hidden = true;

  if (elementos.nomeMobile) elementos.nomeMobile.textContent = "Entrar / Criar conta";
  if (elementos.botaoMobile) {
    elementos.botaoMobile.textContent = "⌄";
    elementos.botaoMobile.setAttribute("aria-label", "Entrar ou criar conta");
    elementos.botaoMobile.disabled = false;
  }

  if (elementos.areaHomeMobile) {
    elementos.areaHomeMobile.classList.remove("is-authenticated", "is-premium", "has-photo-error");
  }

  if (elementos.fotoHomeMobile) {
    elementos.fotoHomeMobile.removeAttribute("src");
    elementos.fotoHomeMobile.hidden = true;
  }

  if (elementos.nomeHomeMobile) elementos.nomeHomeMobile.textContent = "Entrar";
  if (elementos.planoHomeMobile) elementos.planoHomeMobile.textContent = "CRIAR CONTA";

  if (elementos.botaoHomeMobile) {
    elementos.botaoHomeMobile.innerHTML = '<span class="cpHomeAuthFallback" aria-hidden="true">●</span><i></i>';
    elementos.botaoHomeMobile.setAttribute("aria-label", "Entrar ou criar conta");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store"
    });

    dadosLogin = await lerJsonSeguro(respostaLogin);

    if (!respostaLogin.ok) {
      console.warn(
        "Servidor não sincronizou o login; usando os dados do Firebase:",
        dadosLogin?.error || dadosLogin?.message || respostaLogin.status
      );
    }
  } catch (erro) {
    console.warn("Falha temporária em /auth/firebase:", erro);
  }

  try {
    const respostaPerfil = await fetch("/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    dadosPerfil = await lerJsonSeguro(respostaPerfil);

    if (!respostaPerfil.ok) {
      console.warn(
        "Perfil do servidor indisponível; usando os dados do Firebase:",
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

function configurarModo(modo = "login") {
  estadoAuth.modo = modo === "register" ? "register" : "login";
  const cadastro = estadoAuth.modo === "register";

  elementos.tabLogin?.classList.toggle("active", !cadastro);
  elementos.tabRegister?.classList.toggle("active", cadastro);

  if (elementos.nameWrap) elementos.nameWrap.hidden = !cadastro;
  if (elementos.confirmWrap) elementos.confirmWrap.hidden = !cadastro;
  if (elementos.forgot) elementos.forgot.hidden = cadastro;

  if (elementos.modalTitle) {
    elementos.modalTitle.textContent = cadastro ? "Crie sua conta" : "Bem-vindo de volta";
  }

  if (elementos.modalSubtitle) {
    elementos.modalSubtitle.textContent = cadastro
      ? "Cadastre-se para salvar favoritos e personalizar sua experiência."
      : "Entre para acessar sua conta e manter suas preferências.";
  }

  if (elementos.submit) {
    elementos.submit.querySelector("span").textContent = cadastro ? "CRIAR CONTA" : "ENTRAR";
  }

  if (elementos.switchText) {
    elementos.switchText.textContent = cadastro ? "Já possui uma conta?" : "Ainda não possui conta?";
  }

  if (elementos.switchButton) {
    elementos.switchButton.textContent = cadastro ? "Entrar" : "Criar conta";
  }

  mostrarMensagemFormulario("");
}

function abrirModal(modo = "login") {
  if (!elementos.modal) {
    realizarLoginGoogle();
    return;
  }

  configurarModo(modo);
  elementos.modal.hidden = false;
  elementos.modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("cpAuthModalOpen");

  window.setTimeout(() => {
    const alvo = estadoAuth.modo === "register"
      ? elementos.nameInput
      : elementos.emailInput;
    alvo?.focus();
  }, 80);
}

function fecharModal() {
  if (!elementos.modal) return;
  elementos.modal.hidden = true;
  elementos.modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cpAuthModalOpen");
  mostrarMensagemFormulario("");
}

function validarFormulario() {
  const email = String(elementos.emailInput?.value || "").trim();
  const senha = String(elementos.passwordInput?.value || "");

  if (!email) throw new Error("Digite seu e-mail.");
  if (!email.includes("@")) throw new Error("Digite um e-mail válido.");
  if (!senha) throw new Error("Digite sua senha.");

  if (estadoAuth.modo === "register") {
    const nome = String(elementos.nameInput?.value || "").trim();
    const confirmar = String(elementos.confirmInput?.value || "");

    if (nome.length < 2) throw new Error("Digite seu nome.");
    if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmar) throw new Error("As senhas não conferem.");

    return { nome, email, senha };
  }

  return { email, senha };
}

async function realizarLoginGoogle() {
  if (estadoAuth.ocupado) return;

  definirOcupado(true);
  mostrarMensagem("");
  mostrarMensagemFormulario("");

  try {
    const resultado = await entrarComGoogle();
    const usuario = resultado?.usuario || firebaseAuth.currentUser;

    if (!usuario) {
      throw new Error("O Google não retornou um usuário autenticado.");
    }

    const perfil = await sincronizarComServidor(usuario, true);
    renderizarLogado(usuario, perfil);
    fecharModal();
    mostrarMensagem("Login realizado com sucesso.", "success");
  } catch (erro) {
    console.error("Falha no login Firebase:", erro);
    mostrarMensagemFormulario(erro?.message || "Não foi possível entrar com o Google.", "error");
  } finally {
    definirOcupado(false);
  }
}

async function enviarFormulario(evento) {
  evento?.preventDefault?.();
  if (estadoAuth.ocupado) return;

  definirOcupado(true);
  mostrarMensagemFormulario("");

  try {
    const dados = validarFormulario();

    const resultado = estadoAuth.modo === "register"
      ? await criarContaComEmail(dados)
      : await entrarComEmail(dados);

    const usuario = resultado?.usuario || firebaseAuth.currentUser;
    if (!usuario) throw new Error("Não foi possível carregar a conta.");

    const perfil = await sincronizarComServidor(usuario, true);
    renderizarLogado(usuario, perfil);
    fecharModal();

    mostrarMensagem(
      estadoAuth.modo === "register"
        ? "Conta criada com sucesso."
        : "Login realizado com sucesso.",
      "success"
    );
  } catch (erro) {
    console.error("Falha no formulário de autenticação:", erro);
    mostrarMensagemFormulario(
      erro?.message || "Não foi possível concluir a autenticação.",
      "error"
    );
  } finally {
    definirOcupado(false);
  }
}

async function recuperarSenha() {
  if (estadoAuth.ocupado) return;

  const email = String(elementos.emailInput?.value || "").trim();

  definirOcupado(true);
  mostrarMensagemFormulario("");

  try {
    await redefinirSenha(email);
    mostrarMensagemFormulario(
      "Enviamos um link de recuperação para o seu e-mail.",
      "success"
    );
  } catch (erro) {
    mostrarMensagemFormulario(erro?.message || "Não foi possível enviar o link.", "error");
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
    abrirModal("login");
  }
}

function instalarEventos() {
  elementos.loginDesktop?.addEventListener("click", () => abrirModal("login"));
  elementos.logoutDesktop?.addEventListener("click", realizarLogout);
  elementos.botaoMobile?.addEventListener("click", acaoMobile);
  elementos.botaoHomeMobile?.addEventListener("click", acaoMobile);

  elementos.modalClose?.addEventListener("click", fecharModal);
  elementos.modalBackdrop?.addEventListener("click", fecharModal);
  elementos.tabLogin?.addEventListener("click", () => configurarModo("login"));
  elementos.tabRegister?.addEventListener("click", () => configurarModo("register"));
  elementos.switchButton?.addEventListener("click", () =>
    configurarModo(estadoAuth.modo === "register" ? "login" : "register")
  );
  elementos.submit?.closest("form")?.addEventListener("submit", enviarFormulario);
  elementos.google?.addEventListener("click", realizarLoginGoogle);
  elementos.forgot?.addEventListener("click", recuperarSenha);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && elementos.modal && !elementos.modal.hidden) {
      fecharModal();
    }
  });

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
      const perfilFirebase = perfilNormalizado(usuario, {});
      renderizarLogado(usuario, perfilFirebase);
      mostrarMensagem(
        "Conta restaurada. O plano será sincronizado quando o servidor responder.",
        "info"
      );
    } finally {
      definirOcupado(false);
    }
  });
}

iniciarAutenticacao();