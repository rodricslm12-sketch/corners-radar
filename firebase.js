import fs from "fs";
import path from "path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";

import { getAuth } from "firebase-admin/auth";

const EXPECTED_PROJECT_ID =
  String(process.env.FIREBASE_PROJECT_ID || "corners-radar").trim();

function validarServiceAccount(serviceAccount) {
  if (!serviceAccount || typeof serviceAccount !== "object") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT inválida.");
  }

  const required = ["project_id", "client_email", "private_key"];
  for (const key of required) {
    if (!String(serviceAccount[key] || "").trim()) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT sem o campo obrigatório: ${key}`);
    }
  }

  if (
    EXPECTED_PROJECT_ID &&
    String(serviceAccount.project_id).trim() !== EXPECTED_PROJECT_ID
  ) {
    throw new Error(
      `Projeto Firebase inesperado. Esperado=${EXPECTED_PROJECT_ID}, recebido=${serviceAccount.project_id}`
    );
  }

  return serviceAccount;
}

function iniciarFirebase() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // PRODUÇÃO / RENDER:
  // a credencial fica exclusivamente na variável de ambiente.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const serviceAccount = validarServiceAccount(parsed);

      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } catch (error) {
      console.error(
        "Erro ao carregar FIREBASE_SERVICE_ACCOUNT:",
        error?.message || error
      );
      throw error;
    }
  }

  // Em produção falhamos de forma explícita se o segredo não foi configurado.
  // Isso é mais seguro que iniciar o servidor em estado ambíguo.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT não configurada no ambiente de produção."
    );
  }

  // DESENVOLVIMENTO LOCAL:
  // aceita o JSON local, que deve estar no .gitignore.
  const caminhoLocal = path.resolve("./firebase-service-account.json");

  if (fs.existsSync(caminhoLocal)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(caminhoLocal, "utf8"));
      const serviceAccount = validarServiceAccount(parsed);

      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } catch (error) {
      console.error(
        "Erro ao carregar firebase-service-account.json:",
        error?.message || error
      );
      throw error;
    }
  }

  // Fallback para ambientes Google/local configurados explicitamente.
  return initializeApp({
    credential: applicationDefault(),
    projectId: EXPECTED_PROJECT_ID || undefined
  });
}

const firebaseApp = iniciarFirebase();

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export { FieldValue };