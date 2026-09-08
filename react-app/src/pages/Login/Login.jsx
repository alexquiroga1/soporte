import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { sileo } from "sileo";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

import "./Login.css";

/* =========================================
   ANIMACIONES
========================================= */

const containerVariants = {
  hidden: {
    opacity: 0,
    scale: 0.985,
    y: 18,
  },

  visible: {
    opacity: 1,
    scale: 1,
    y: 0,

    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const formVariants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,

    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/* =========================================
   LOGIN
========================================= */

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, authError } = useAuth();

  /* =======================================
     ERROR DE PERFIL
  ======================================= */

  useEffect(() => {
    if (!authError) {
      return;
    }

    sileo.error({
      title: "Acceso denegado",
      description: authError,
    });
  }, [authError]);

  /* =======================================
     INICIAR SESIÓN
  ======================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      sileo.warning({
        title: "Datos incompletos",
        description: "Ingresá tu correo electrónico y contraseña.",
      });

      return;
    }

    try {
      setIsSubmitting(true);

      await login(cleanEmail, password);
    } catch (error) {
      console.error("Error iniciando sesión:", error);

      let message = "No se pudo iniciar sesión. Intentá nuevamente.";

      switch (error?.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          message = "Correo electrónico o contraseña incorrectos.";
          break;

        case "auth/invalid-email":
          message = "El correo electrónico ingresado no es válido.";
          break;

        case "auth/too-many-requests":
          message =
            "Hubo demasiados intentos. Esperá unos minutos e intentá nuevamente.";
          break;

        case "auth/network-request-failed":
          message =
            "No se pudo conectar con Firebase. Revisá tu conexión a Internet.";
          break;

        case "auth/user-disabled":
          message = "Esta cuenta fue deshabilitada.";
          break;

        default:
          message = "No se pudo iniciar sesión. Intentá nuevamente.";
      }

      sileo.error({
        title: "No pudimos iniciar sesión",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =======================================
     RECUPERAR CONTRASEÑA
  ======================================= */

  const handleForgotPassword = () => {
    sileo.info({
      title: "Recuperar contraseña",
      description: "Esta función la conectaremos después.",
    });
  };

  return (
    <main className="login-page">
      <motion.section
        className="login-shell"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* =================================
            PANEL IZQUIERDO
        ================================= */}

        <aside className="login-brand">
          <div className="login-brand-content">
            <motion.div
              className="brand-icon"
              initial={{
                opacity: 0,
                scale: 0.7,
                rotate: -12,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: 0,
              }}
              transition={{
                delay: 0.18,
                duration: 0.5,
                type: "spring",
                stiffness: 180,
                damping: 14,
              }}
              whileHover={{
                scale: 1.06,
                rotate: -4,
              }}
            >
              <Wrench size={28} strokeWidth={2.2} />
            </motion.div>

            <motion.div
              className="brand-copy"
              variants={formVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.span
                className="brand-eyebrow"
                variants={itemVariants}
              >
                Sistema técnico
              </motion.span>

              <motion.h1 variants={itemVariants}>
                Gestión simple.
                <br />
                Trabajo ordenado.
              </motion.h1>

              <motion.p variants={itemVariants}>
                Administrá tickets, clientes, presupuestos, caja y facturación
                desde un único lugar.
              </motion.p>
            </motion.div>

            <motion.div
              className="brand-security"
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.55,
                duration: 0.35,
              }}
            >
              <ShieldCheck size={19} />

              <div>
                <strong>Acceso seguro</strong>

                <span>Protegido mediante Firebase Authentication.</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="brand-decoration brand-decoration-one"
            animate={{
              scale: [1, 1.07, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="brand-decoration brand-decoration-two"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </aside>

        {/* =================================
            PANEL LOGIN
        ================================= */}

        <section className="login-panel">
          <motion.div
            className="login-form-wrapper"
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="login-heading"
              variants={itemVariants}
            >
              <span className="login-kicker">Bienvenido</span>

              <h2>Iniciar sesión</h2>

              <p>Ingresá tus credenciales para acceder al sistema.</p>
            </motion.div>

            <form className="login-form" onSubmit={handleSubmit}>
              {/* EMAIL */}

              <motion.div
                className="form-group"
                variants={itemVariants}
              >
                <label htmlFor="email">Correo electrónico</label>

                <motion.div
                  className="input-shell"
                  whileFocusWithin={{
                    y: -1,
                  }}
                >
                  <Mail
                    className="input-icon"
                    size={19}
                    aria-hidden="true"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                    }}
                    disabled={isSubmitting}
                    required
                  />
                </motion.div>
              </motion.div>

              {/* CONTRASEÑA */}

              <motion.div
                className="form-group"
                variants={itemVariants}
              >
                <div className="password-label-row">
                  <label htmlFor="password">Contraseña</label>

                  <button
                    type="button"
                    className="forgot-password"
                    onClick={handleForgotPassword}
                    disabled={isSubmitting}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <motion.div
                  className="input-shell"
                  whileFocusWithin={{
                    y: -1,
                  }}
                >
                  <LockKeyhole
                    className="input-icon"
                    size={19}
                    aria-hidden="true"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresá tu contraseña"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                    }}
                    disabled={isSubmitting}
                    required
                  />

                  <motion.button
                    type="button"
                    className="password-toggle"
                    disabled={isSubmitting}
                    whileTap={{
                      scale: 0.88,
                    }}
                    onClick={() => {
                      setShowPassword((current) => !current);
                    }}
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </motion.button>
                </motion.div>
              </motion.div>

              {/* BOTÓN */}

              <motion.div variants={itemVariants}>
                <motion.button
                  type="submit"
                  className="login-button"
                  disabled={isSubmitting}
                  whileHover={
                    isSubmitting
                      ? {}
                      : {
                          y: -2,
                          scale: 1.005,
                        }
                  }
                  whileTap={
                    isSubmitting
                      ? {}
                      : {
                          y: 0,
                          scale: 0.985,
                        }
                  }
                >
                  {isSubmitting ? (
                    <span className="login-loading">
                      <LoaderCircle
                        className="login-spinner"
                        size={19}
                      />

                      Verificando...
                    </span>
                  ) : (
                    "Iniciar sesión"
                  )}
                </motion.button>
              </motion.div>
            </form>

            <motion.div
              className="login-footer"
              variants={itemVariants}
            >
              <motion.span
                className="status-dot"
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [1, 0.7, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              Sistema operativo
            </motion.div>
          </motion.div>
        </section>
      </motion.section>
    </main>
  );
}