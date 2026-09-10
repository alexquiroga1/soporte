import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* =========================================
   VARIABLES DE ENTORNO
========================================= */

function cleanEnv(value) {
  let text = String(value ?? "").trim();

  // Tolera .env heredados con comillas y/o coma final.
  if (text.endsWith(",")) {
    text = text.slice(0, -1).trim();
  }

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

export const firebaseConfig = Object.freeze({
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID),
});

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "messagingSenderId",
  "appId",
];

const missingKeys = requiredKeys.filter(
  (key) => !firebaseConfig[key]
);

if (missingKeys.length) {
  throw new Error(
    `FIREBASE_CONFIG_MISSING: ${missingKeys.join(", ")}`
  );
}

/* =========================================
   INICIALIZACIÓN
========================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
};

export default app;
