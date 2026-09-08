import {
  LogOut,
  ShieldCheck,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

export default function Dashboard() {
  const {
    profile,
    user,
    logout,
  } = useAuth();

  const userName =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Usuario";

  const userRole =
    profile?.rol ||
    profile?.role ||
    "Usuario";

  return (
    <main
      style={{
        minHeight: "100vh",

        padding: "40px",

        background:
          "var(--bg)",
      }}
    >
      <section
        style={{
          maxWidth: "900px",

          margin: "0 auto",
          padding: "32px",

          background:
            "var(--surface)",

          border:
            "1px solid var(--line)",

          borderRadius:
            "var(--radius-xl)",

          boxShadow:
            "var(--shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",

              display: "grid",
              placeItems: "center",

              color:
                "var(--teal)",

              background:
                "var(--success-bg)",

              borderRadius:
                "14px",
            }}
          >
            <ShieldCheck
              size={24}
            />
          </div>

          <div>
            <p
              style={{
                marginBottom:
                  "4px",

                fontSize:
                  "0.78rem",

                fontWeight: 800,

                textTransform:
                  "uppercase",

                letterSpacing:
                  "0.08em",

                color:
                  "var(--teal)",
              }}
            >
              Sesión iniciada
            </p>

            <h1
              style={{
                fontSize:
                  "1.8rem",

                color:
                  "var(--ink)",
              }}
            >
              Bienvenido,{" "}
              {userName}
            </h1>
          </div>
        </div>

        <div
          style={{
            marginTop: "28px",

            padding: "20px",

            background:
              "var(--surface-2)",

            borderRadius:
              "var(--radius)",
          }}
        >
          <p
            style={{
              marginBottom:
                "8px",

              color:
                "var(--muted)",
            }}
          >
            Correo
          </p>

          <strong>
            {user?.email}
          </strong>

          <p
            style={{
              marginTop:
                "18px",

              marginBottom:
                "8px",

              color:
                "var(--muted)",
            }}
          >
            Rol
          </p>

          <strong>
            {userRole}
          </strong>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            marginTop: "28px",

            display: "flex",
            alignItems: "center",
            gap: "8px",

            padding:
              "12px 18px",

            fontWeight: 700,

            color:
              "#ffffff",

            background:
              "var(--graphite)",

            border: 0,

            borderRadius:
              "12px",

            cursor:
              "pointer",
          }}
        >
          <LogOut size={18} />

          Cerrar sesión
        </button>
      </section>
    </main>
  );
}