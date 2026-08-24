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
  modo: "login",
  obrigatorio: false
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


function limparCamposAutenticacao({ manterEmailValido = false } = {}) {
  const emailAtual = String(elementos.emailInput?.value || "").trim();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAtual);

  if (elementos.nameInput) elementos.nameInput.value = "";
  if (elementos.confirmInput) elementos.confirmInput.value = "";

  if (elementos.emailInput && !(manterEmailValido && emailValido)) {
    elementos.emailInput.value = "";
  }

  if (elementos.passwordInput) {
    elementos.passwordInput.value = "";
  }

  mostrarMensagemFormulario("");
}

function corrigirAutofillInvalido() {
  const email = String(elementos.emailInput?.value || "").trim();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    elementos.emailInput.value = "";
    if (elementos.passwordInput) elementos.passwordInput.value = "";
    mostrarMensagemFormulario("");
  }
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


function instalarVisualVisitanteBloqueado() {
  if (document.getElementById("cpGuestMarketLockStyle")) return;

  const style = document.createElement("style");
  style.id = "cpGuestMarketLockStyle";
  style.textContent = `
    body.cp-auth-guest #cpd3LineNav [data-cpd3-line]{
      position:relative;
      padding-right:28px !important;
    }

    body.cp-auth-guest #cpd3LineNav [data-cpd3-line]:not([data-cpd3-line="IA"]):not([data-cpd3-line="TODOS"])::after{
      content:"🔒";
      position:absolute;
      right:8px;
      top:50%;
      transform:translateY(-50%);
      font-size:10px;
      line-height:1;
      opacity:.9;
      pointer-events:none;
    }

    body.cp-auth-guest #cpd3Rows{
      position:relative;
      min-height:220px;
      overflow:hidden;
    }

    body.cp-auth-guest #cpd3Rows > *{
      filter:blur(5px);
      opacity:.32;
      user-select:none;
      pointer-events:none !important;
    }

    body.cp-auth-guest #cpd3Rows::after{
      content:"🔒  Faça login para ver os jogos, projeções e análises deste mercado";
      position:absolute;
      z-index:20;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:min(520px,calc(100% - 40px));
      min-height:94px;
      padding:22px 26px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      border:1px solid rgba(104,255,43,.36);
      border-radius:16px;
      background:rgba(5,16,14,.94);
      color:#eaf7ec;
      box-shadow:0 18px 48px rgba(0,0,0,.35),0 0 28px rgba(84,255,35,.08);
      font-weight:900;
      font-size:13px;
      letter-spacing:.1px;
      pointer-events:none;
    }

    body.cp-auth-guest [data-cpd3-open]{
      position:relative;
    }
  `;
  document.head.appendChild(style);
}

function atualizarVisualVisitante() {
  const visitante = !(estadoAuth.usuario || firebaseAuth.currentUser);
  document.body.classList.toggle("cp-auth-guest", visitante);
  instalarVisualVisitanteBloqueado();
}

function renderizarDeslogado() {
  sincronizarEstadoGlobal(null, null);
  document.body.classList.add("cp-auth-guest");
  instalarVisualVisitanteBloqueado();
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
  estadoAuth.obrigatorio = false;
  document.body.classList.remove("cp-auth-guest");
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

  // Autofill profissional: cada campo informa exatamente sua finalidade.
  if (elementos.nameInput) {
    elementos.nameInput.setAttribute("name", "name");
    elementos.nameInput.setAttribute("autocomplete", "name");
  }

  if (elementos.emailInput) {
    elementos.emailInput.setAttribute("name", "email");
    elementos.emailInput.setAttribute("autocomplete", "email");
    elementos.emailInput.setAttribute("inputmode", "email");
    elementos.emailInput.setAttribute("type", "email");
    elementos.emailInput.setAttribute("autocapitalize", "none");
    elementos.emailInput.setAttribute("spellcheck", "false");
  }

  if (elementos.confirmInput) {
    elementos.confirmInput.setAttribute("name", "password-confirm");
    elementos.confirmInput.setAttribute("autocomplete", "new-password");
  }

  // Ao voltar para ENTRAR, remove resíduos de campos exclusivos do cadastro.
  if (!cadastro) {
    if (elementos.nameInput) elementos.nameInput.value = "";
    if (elementos.confirmInput) elementos.confirmInput.value = "";
  }

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

  if (elementos.passwordInput) {
    elementos.passwordInput.setAttribute(
      "autocomplete",
      cadastro ? "new-password" : "current-password"
    );
  }

  if (elementos.switchText) {
    elementos.switchText.textContent = cadastro ? "Já possui uma conta?" : "Ainda não possui conta?";
  }

  if (elementos.switchButton) {
    elementos.switchButton.textContent = cadastro ? "Entrar" : "Criar conta";
  }

  mostrarMensagemFormulario("");
}

function abrirModal(modo = "login", opcoes = {}) {
  if (!elementos.modal) {
    realizarLoginGoogle();
    return;
  }

  const obrigatorio = opcoes?.obrigatorio === true;

  if (obrigatorio) {
    estadoAuth.obrigatorio = true;
  }

  configurarModo(modo);
  corrigirAutofillInvalido();

  // O modo é definido antes de exibir o modal para evitar flash de campos do cadastro.
  elementos.modal.hidden = false;
  elementos.modal.setAttribute("aria-hidden", "false");
  elementos.modal.classList.toggle("is-required", estadoAuth.obrigatorio);
  document.body.classList.add("cpAuthModalOpen");

  // Quando o visitante ainda não está autenticado, o login é a porta de entrada
  // tanto no site quanto no app/mobile. O Google continua intacto.
  if (elementos.modalClose) {
    elementos.modalClose.hidden = estadoAuth.obrigatorio;
    elementos.modalClose.setAttribute(
      "aria-hidden",
      estadoAuth.obrigatorio ? "true" : "false"
    );
  }

  if (elementos.modalBackdrop) {
    elementos.modalBackdrop.disabled = estadoAuth.obrigatorio;
    elementos.modalBackdrop.setAttribute(
      "aria-label",
      estadoAuth.obrigatorio ? "Autenticação obrigatória" : "Fechar autenticação"
    );
  }

  window.setTimeout(() => {
    corrigirAutofillInvalido();

    const alvo = estadoAuth.modo === "register"
      ? elementos.nameInput
      : elementos.emailInput;
    alvo?.focus();
  }, 80);

  // Alguns gerenciadores de senha preenchem o campo alguns ms depois.
  window.setTimeout(corrigirAutofillInvalido, 250);
  window.setTimeout(corrigirAutofillInvalido, 700);
}

function fecharModal(opcoes = {}) {
  if (!elementos.modal) return;

  const forcar = opcoes?.forcar === true;

  // Não permite fechar a porta de entrada enquanto não houver usuário logado.
  if (estadoAuth.obrigatorio && !estadoAuth.usuario && !forcar) {
    return;
  }

  estadoAuth.obrigatorio = false;

  elementos.modal.hidden = true;
  elementos.modal.setAttribute("aria-hidden", "true");
  elementos.modal.classList.remove("is-required");
  document.body.classList.remove("cpAuthModalOpen");

  if (elementos.modalClose) {
    elementos.modalClose.hidden = false;
    elementos.modalClose.setAttribute("aria-hidden", "false");
  }

  if (elementos.modalBackdrop) {
    elementos.modalBackdrop.disabled = false;
    elementos.modalBackdrop.setAttribute("aria-label", "Fechar autenticação");
  }

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


function fecharLoginAposLogout() {
  estadoAuth.obrigatorio = false;

  const fechar = () => {
    try {
      fecharModal({ forcar: true });
    } catch (_) {}

    document.body.classList.remove("cpAuthModalOpen");

    if (elementos.modal) {
      elementos.modal.hidden = true;
      elementos.modal.setAttribute("aria-hidden", "true");
      elementos.modal.classList.remove("is-required");
    }
  };

  // Fecha agora e novamente depois para vencer qualquer listener legado
  // que tente reabrir o login durante o onAuthStateChanged/signOut.
  fechar();
  window.setTimeout(fechar, 0);
  window.setTimeout(fechar, 120);
  window.setTimeout(fechar, 400);
  window.setTimeout(fechar, 900);
}

async function realizarLogout() {
  if (estadoAuth.ocupado) return;

  definirOcupado(true);
  mostrarMensagem("");

  try {
    limparCamposAutenticacao();
    await sairDaConta();
    renderizarDeslogado();
    limparCamposAutenticacao();
    fecharLoginAposLogout();
    mostrarMensagem("Você saiu da conta.", "success");
  } catch (erro) {
    console.error("Falha no logout Firebase:", erro);
    mostrarMensagem(erro?.message || "Não foi possível sair da conta.", "error");
  } finally {
    definirOcupado(false);
  }
}


/* =========================================================
   ACESSO VISITANTE / GATE DE AUTENTICAÇÃO
   - Visitante vê o site e todos os nomes dos mercados.
   - Abas principais (Escanteios, Gols, Cartões, Handicap etc.)
     continuam livres.
   - Ao clicar numa LINHA ou em "Ver análise", pede login.
   ========================================================= */
function mercadoProtegidoClicado(alvo) {
  if (!alvo?.closest) return null;

  // Linhas reais do desktop (8.5, 9.5, 10.5, gols, cartões, handicap etc.)
  const linha = alvo.closest("[data-cpd3-line]");
  if (linha) {
    const valor = String(linha.dataset?.cpd3Line || linha.textContent || "").trim().toUpperCase();
    // IA/TODOS apenas mostram a existência do mercado; as linhas específicas ficam protegidas.
    if (valor !== "IA" && valor !== "TODOS") return linha;
  }

  return alvo.closest([
    "[data-cpd3-open]",
    ".cpd3Analyze",
    ".marketInlineItem",
    "[data-market-line]",
    "[data-premium-market]",
    ".marketChipPremium[data-market-filter]",
    ".marketHighlightCard[data-market-filter]"
  ].join(","));
}

function bloquearMercadoParaVisitante(evento) {
  if (estadoAuth.usuario || firebaseAuth.currentUser) return;

  const protegido = mercadoProtegidoClicado(evento.target);
  if (!protegido) return;

  evento.preventDefault();
  evento.stopPropagation();
  evento.stopImmediatePropagation();

  mostrarMensagemFormulario("");
  abrirModal("login", { obrigatorio: false });
}

function acaoMobile() {
  if (estadoAuth.usuario) {
    realizarLogout();
  } else {
    abrirModal("login");
  }
}

function instalarEventos() {
  // Captura primeiro para bloquear somente o conteúdo protegido,
  // sem esconder o site do visitante.
  window.addEventListener("click", bloquearMercadoParaVisitante, true);

  elementos.loginDesktop?.addEventListener("click", () => abrirModal("login"));

  // Logout exclusivo: impede listeners antigos de reabrirem o modal após sair.
  elementos.logoutDesktop?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    realizarLogout();
  }, true);

  elementos.botaoMobile?.addEventListener("click", event => {
    if (estadoAuth.usuario || firebaseAuth.currentUser) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      realizarLogout();
      return;
    }
    acaoMobile();
  }, true);

  elementos.botaoHomeMobile?.addEventListener("click", event => {
    if (estadoAuth.usuario || firebaseAuth.currentUser) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      realizarLogout();
      return;
    }
    acaoMobile();
  }, true);

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
    if (
      event.key === "Escape" &&
      elementos.modal &&
      !elementos.modal.hidden &&
      !estadoAuth.obrigatorio
    ) {
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
  instalarVisualVisitanteBloqueado();
  instalarEventos();
  observarBarraAntiga();
  renderizarDeslogado();

  if (!window.__cpGuestMarketObserver) {
    window.__cpGuestMarketObserver = new MutationObserver(() => atualizarVisualVisitante());
    window.__cpGuestMarketObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  observarAutenticacao(async estado => {
    const usuario = estado?.usuario || firebaseAuth.currentUser || null;

    if (!usuario) {
      // Visitante pode conhecer o site e visualizar os mercados.
      // O login só será solicitado quando tentar abrir uma linha/análise.
      renderizarDeslogado();
      limparCamposAutenticacao({ manterEmailValido: true });
      fecharLoginAposLogout();
      return;
    }

    try {
      definirOcupado(true);
      const perfil = await sincronizarComServidor(usuario, false);
      renderizarLogado(usuario, perfil);
      fecharModal({ forcar: true });
    } catch (erro) {
      console.error("Falha ao restaurar perfil no servidor:", erro);
      const perfilFirebase = perfilNormalizado(usuario, {});
      renderizarLogado(usuario, perfilFirebase);
      fecharModal({ forcar: true });
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