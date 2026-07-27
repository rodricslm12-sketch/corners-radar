import fs from "fs";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function iniciarFirebase() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Render: credencial guardada em variável de ambiente
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );

    return initializeApp({
      credential: cert(serviceAccount)
    });
  }

  // Computador local: usa o arquivo JSON
  const caminhoLocal = "./firebase-service-account.json";

  if (fs.existsSync(caminhoLocal)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(caminhoLocal, "utf8")
    );

    return initializeApp({
      credential: cert(serviceAccount)
    });
  }

  // Alternativa usando GOOGLE_APPLICATION_CREDENTIALS
  return initializeApp({
    credential: applicationDefault()
  });
}

iniciarFirebase();

export const db = getFirestore();