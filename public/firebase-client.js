import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiC37Tbz3Qz9OI6jdT1X0dnsSlIt8K4ow",
  authDomain: "corners-radar.firebaseapp.com",
  projectId: "corners-radar",
  storageBucket: "corners-radar.firebasestorage.app",
  messagingSenderId: "720388200703",
  appId: "1:720388200703:web:2c1b2a98dd1bd4081ed4ca"
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

function traduzirErroFirebase(erro) {
  const code = String(erro?.code || "");

  const mensagens = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão com o Firebase.",
    "auth/popup-closed-by-user": "A janela de login foi fechada.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login.",
    "auth/unauthorized-domain": "Este domínio ainda não está autorizado no Firebase.",
    "auth/missing-password": "Digite sua senha."
  };

  return new Error(mensagens[code] || erro?.message || "Não foi possível concluir a autenticação.");
}

async function entrarComGoogle() {
  try {
    const resultado = await signInWithPopup(firebaseAuth, googleProvider);
    const usuario = resultado.user;
    const token = await usuario.getIdToken(true);

    return { usuario, token };
  } catch (erro) {
    console.error("Erro ao entrar com Google:", erro);
    throw traduzirErroFirebase(erro);
  }
}

async function criarContaComEmail({ nome, email, senha }) {
  try {
    const credencial = await createUserWithEmailAndPassword(
      firebaseAuth,
      String(email || "").trim(),
      String(senha || "")
    );

    const usuario = credencial.user;
    const nomeLimpo = String(nome || "").trim();

    if (nomeLimpo) {
      await updateProfile(usuario, { displayName: nomeLimpo });
    }

    await usuario.reload();

    return {
      usuario: firebaseAuth.currentUser || usuario,
      token: await usuario.getIdToken(true)
    };
  } catch (erro) {
    console.error("Erro ao criar conta:", erro);
    throw traduzirErroFirebase(erro);
  }
}

async function entrarComEmail({ email, senha }) {
  try {
    const credencial = await signInWithEmailAndPassword(
      firebaseAuth,
      String(email || "").trim(),
      String(senha || "")
    );

    return {
      usuario: credencial.user,
      token: await credencial.user.getIdToken(true)
    };
  } catch (erro) {
    console.error("Erro ao entrar com e-mail:", erro);
    throw traduzirErroFirebase(erro);
  }
}

async function redefinirSenha(email) {
  try {
    const endereco = String(email || "").trim();
    if (!endereco) throw new Error("Digite seu e-mail primeiro.");

    await sendPasswordResetEmail(firebaseAuth, endereco);
    return true;
  } catch (erro) {
    console.error("Erro ao redefinir senha:", erro);
    if (String(erro?.message || "") === "Digite seu e-mail primeiro.") throw erro;
    throw traduzirErroFirebase(erro);
  }
}

async function sairDaConta() {
  await signOut(firebaseAuth);
}

async function obterTokenFirebase(force = false) {
  const usuario = firebaseAuth.currentUser;
  if (!usuario) return null;
  return usuario.getIdToken(force);
}

async function fetchAutenticado(url, options = {}) {
  const token = await obterTokenFirebase();

  if (!token) {
    throw new Error("Usuário não autenticado.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers
  });
}

function observarAutenticacao(callback) {
  return onAuthStateChanged(firebaseAuth, async (usuario) => {
    if (!usuario) {
      callback(null);
      return;
    }

    callback({
      usuario,
      token: await usuario.getIdToken()
    });
  });
}

export {
  firebaseApp,
  firebaseAuth,
  entrarComGoogle,
  criarContaComEmail,
  entrarComEmail,
  redefinirSenha,
  sairDaConta,
  obterTokenFirebase,
  fetchAutenticado,
  observarAutenticacao
};