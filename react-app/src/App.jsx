import {
  Toaster,
} from "sileo";

import Login from "./pages/Login/Login.jsx";

import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import {
  useAuth,
} from "./context/AuthContext.jsx";

function LoadingScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",

        display: "grid",
        placeItems: "center",

        background:
          "var(--bg)",
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
          style={{
            width: "38px",
            height: "38px",

            border:
              "3px solid rgba(255, 106, 61, 0.15)",

            borderTopColor:
              "var(--copper)",

            borderRadius: "50%",

            animation:
              "app-loading-spin 0.8s linear infinite",
          }}
        />

        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,

            color:
              "var(--muted)",
          }}
        >
          Cargando sistema...
        </span>

        <style>
          {`
            @keyframes app-loading-spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    </main>
  );
}

function App() {
  const {
    user,
    profile,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <>
        <Toaster
          position="top-right"
        />

        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
      />

      {user && profile ? (
        <Dashboard />
      ) : (
        <Login />
      )}
    </>
  );
}

export default App;