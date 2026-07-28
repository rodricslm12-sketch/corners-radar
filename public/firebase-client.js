import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
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

async function entrarComGoogle() {
  try {
    const resultado = await signInWithPopup(firebaseAuth, googleProvider);

    const usuario = resultado.user;
    const token = await usuario.getIdToken(true);

    return {
      usuario,
      token
    };
  } catch (erro) {
    console.error("Erro ao entrar com Google:", erro);

    if (erro?.code === "auth/popup-closed-by-user") {
      throw new Error("A janela de login foi fechada.");
    }

    if (erro?.code === "auth/popup-blocked") {
      throw new Error("O navegador bloqueou a janela de login.");
    }

    if (erro?.code === "auth/unauthorized-domain") {
      throw new Error("Domínio não autorizado no Firebase.");
    }

    if (erro?.code === "auth/network-request-failed") {
      throw new Error("Falha de conexão com o Firebase.");
    }

    throw erro;
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
  sairDaConta,
  obterTokenFirebase,
  fetchAutenticado,
  observarAutenticacao
};