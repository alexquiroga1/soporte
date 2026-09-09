import {
  useEffect,
  useRef,
} from "react";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  sileo,
  Toaster,
} from "sileo";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import {
  useAuth,
} from "./context/AuthContext.jsx";

/* =========================================
   PANTALLA DE CARGA
========================================= */

function LoadingScreen() {
  return (
    <motion.main
      key="loading"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 0.2,
      }}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <div
          className="app-loading-spinner"
        />

        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--muted)",
          }}
        >
          Cargando sistema...
        </span>
      </div>
    </motion.main>
  );
}

/* =========================================
   APP
========================================= */

function App() {
  const {
    user,
    profile,
    loading,
  } = useAuth();

  const welcomedUser =
    useRef(null);

  /* =======================================
     TOAST DE BIENVENIDA
  ======================================= */

  useEffect(() => {
    if (!user || !profile) {
      welcomedUser.current = null;
      return;
    }

    if (
      welcomedUser.current ===
      user.uid
    ) {
      return;
    }

    welcomedUser.current =
      user.uid;

    const userName =
      profile?.nombre ||
      profile?.name ||
      "Usuario";

    sileo.success({
      title: `Bienvenido, ${userName}`,
      description:
        "Sesión iniciada correctamente.",
    });
  }, [
    user,
    profile,
  ]);

  /* =======================================
     CARGANDO
  ======================================= */

  if (loading) {
    return (
      <>
        <Toaster
          position="top-right"
        />

        <AnimatePresence mode="wait">
          <LoadingScreen />
        </AnimatePresence>
      </>
    );
  }

  /* =======================================
     LOGIN / DASHBOARD
  ======================================= */

  return (
    <>
      <Toaster
        position="top-right"
      />

      <AnimatePresence
        mode="wait"
        initial={false}
      >
        {user && profile ? (
          <motion.div
            key="dashboard"
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            transition={{
              duration: 0.3,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
          >
            <Dashboard />
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.99,
            }}
            transition={{
              duration: 0.25,
            }}
          >
            <Login />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;