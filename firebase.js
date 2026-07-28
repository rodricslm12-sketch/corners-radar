import fs from "fs";
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

function iniciarFirebase() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Render: credencial guardada em variável de ambiente
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
      );

      return initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error(
        "Erro ao carregar FIREBASE_SERVICE_ACCOUNT:",
        error.message
      );

      throw error;
    }
  }

  // Computador local: usa o arquivo JSON
  const caminhoLocal = "./firebase-service-account.json";

  if (fs.existsSync(caminhoLocal)) {
    try {
      const serviceAccount = JSON.parse(
        fs.readFileSync(caminhoLocal, "utf8")
      );

      return initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error(
        "Erro ao carregar firebase-service-account.json:",
        error.message
      );

      throw error;
    }
  }

  // Alternativa usando GOOGLE_APPLICATION_CREDENTIALS
  return initializeApp({
    credential: applicationDefault()
  });
}

const firebaseApp = iniciarFirebase();

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export { FieldValue };