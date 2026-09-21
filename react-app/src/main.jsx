import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  ChakraProvider,
  defaultSystem,
} from "@chakra-ui/react";

import {
  BrowserRouter,
} from "react-router-dom";

import App from "./App.jsx";

import {
  AuthProvider,
} from "./context/AuthContext.jsx";

import "./styles/variables.css";
import "./styles/global.css";

const preloadRecoveryKey = "vite-preload-recovery";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  const lastRecovery = Number(sessionStorage.getItem(preloadRecoveryKey) || 0);
  const recoveryWindowMs = 30_000;

  if (Date.now() - lastRecovery > recoveryWindowMs) {
    sessionStorage.setItem(preloadRecoveryKey, String(Date.now()));
    window.location.reload();
  }
});

createRoot(
  document.getElementById("root")
).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  </StrictMode>
);
