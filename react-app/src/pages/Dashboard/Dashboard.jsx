import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  AlertTriangle,
  Bell,
  Boxes,
  CalendarClock,
  ChartLine,
  ChartPie,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  LogOut,
  Settings,
  ShoppingCart,
  User,
  Users,
  Wifi,
  Wrench,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  MODULE_ACCESS,
  PERMISSIONS,
} from "../../security/permissions.js";

import {
  notify,
} from "../../services/notifications.js";

import {
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToDashboardNotifications,
} from "../../services/dashboard-notifications.service.js";

import "./Dashboard.css";

/* =========================================
   MÓDULOS
========================================= */

const modules = [
  {
    id: "tickets",
    path: "/tickets",
    title: "Tickets de Soporte",
    description:
      "Ingreso, diagnóstico y reparación de equipos.",
    icon: ClipboardList,
    color: "copper",
    badge: "Soporte",
  },

  {
    id: "pos",
    path: "/pos",
    title: "Punto de Venta",
    description:
      "Venta rápida de accesorios, productos y servicios.",
    icon: ShoppingCart,
    color: "red",
    badge: "POS",
  },

  {
    id: "caja",
    path: "/caja",
    title: "Gestión de Caja",
    description:
      "Cobros pendientes, ingresos y egresos diarios.",
    icon: CircleDollarSign,
    color: "purple",
    badge: "Caja",
  },

  {
    id: "clientes",
    path: "/clientes",
    title: "Clientes",
    description:
      "Perfiles, historial, cuenta corriente y relación comercial.",
    icon: Users,
    color: "blue",
    badge: "Clientes",
  },

  {
    id: "creditos",
    path: "/creditos",
    title: "Créditos y Cobranzas",
    description:
      "Cartera, cuotas, cobranzas, mora y refinanciaciones.",
    icon: CreditCard,
    color: "amber",
    badge: "Finanzas",
  },

  {
    id: "productos",
    path: "/productos",
    title: "Catálogo y Stock",
    description:
      "Inventario, repuestos, productos y promociones.",
    icon: Boxes,
    color: "amber",
    badge: "Stock",
  },

  {
    id: "facturacion",
    path: "/facturacion",
    title: "Facturación",
    description:
      "Facturas, presupuestos, notas de crédito y ajustes.",
    icon: FileText,
    color: "teal",
    badge: "Fiscal",
  },

  {
    id: "crm",
    path: "/crm",
    title: "CRM y Oportunidades",
    description:
      "Seguimiento comercial y oportunidades de negocio.",
    icon: ChartLine,
    color: "violet",
    badge: "Ventas",
  },

  {
    id: "reportes",
    path: "/reportes",
    title: "Reportes",
    description:
      "Cobranzas, créditos, morosidad y resultados.",
    icon: ChartPie,
    color: "blue",
    badge: "Análisis",
  },

  {
    id: "configuracion",
    path: "/configuracion",
    title: "Configuración",
    description:
      "Negocio, usuarios, preferencias y parámetros.",
    icon: Settings,
    color: "graphite",
    badge: "Sistema",
  },
];

/* =========================================
   ANIMACIONES
========================================= */

const gridVariants = {
  hidden: {},

  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.12,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.985,
  },

  visible: {
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/* =========================================
   ICONO DE NOTIFICACIÓN
========================================= */

function NotificationIcon({
  notification,
}) {
  if (
    notification.type ===
    "credit"
  ) {
    return (
      <CreditCard
        size={16}
      />
    );
  }

  if (
    notification.type ===
    "promise"
  ) {
    return (
      <CalendarClock
        size={16}
      />
    );
  }

  if (
    notification.type ===
    "ticket"
  ) {
    return (
      <ClipboardList
        size={16}
      />
    );
  }

  if (
    notification.type ===
    "cash"
  ) {
    return (
      <CircleDollarSign
        size={16}
      />
    );
  }

  if (
    notification.type ===
    "budget"
  ) {
    return (
      <FileText
        size={16}
      />
    );
  }

  return (
    <AlertTriangle
      size={16}
    />
  );
}

/* =========================================
   DASHBOARD
========================================= */

export default function Dashboard() {
  const navigate =
    useNavigate();

  const {
    profile,
    user,
    logout,
    hasAnyPermission,
  } =
    useAuth();

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] =
    useState(false);

  const [
    userMenuOpen,
    setUserMenuOpen,
  ] =
    useState(false);

  const [
    notifications,
    setNotifications,
  ] =
    useState([]);

  const [
    readNotificationIds,
    setReadNotificationIds,
  ] =
    useState(
      () =>
        getReadNotificationIds()
    );

  const notificationRef =
    useRef(null);

  const userMenuRef =
    useRef(null);

  const userName =
    profile?.nombre ||
    profile?.name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  const userRole =
    profile?.rol ||
    profile?.role ||
    "Usuario";

  const cleanUserName =
    String(userName)
      .replace(/\([^)]*\)/g, "")
      .trim();

  const initials =
    cleanUserName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() ||
    "US";

  const visibleModules =
    modules.filter(
      (module) =>
        hasAnyPermission(
          MODULE_ACCESS[module.id] || []
        )
    );

  const canTickets =
    hasAnyPermission([
      PERMISSIONS.TICKETS,
    ]);

  const canCredits =
    hasAnyPermission([
      PERMISSIONS.CREDITS,
    ]);

  const canCash =
    hasAnyPermission([
      PERMISSIONS.SALES,
      PERMISSIONS.CASH,
    ]);

  const canBudgets =
    hasAnyPermission(
      MODULE_ACCESS.presupuestos || []
    );

  const canSecurity =
    hasAnyPermission([
      PERMISSIONS.SECURITY,
    ]);

  /* =======================================
     NOTIFICACIONES REALTIME
  ======================================= */

  useEffect(() => {
    const unsubscribe =
      subscribeToDashboardNotifications(
        (rows) => {
          setNotifications(rows);
        },

        (error) => {
          console.error(
            "Error cargando notificaciones:",
            error
          );
        },

        {
          credits: canCredits,
          tickets: canTickets,
          cashPendings: canCash,
          budgets: canBudgets,
          settings: true,
        }
      );

    return () => {
      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }
    };
  }, [
    canCredits,
    canTickets,
    canCash,
    canBudgets,
  ]);

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !readNotificationIds.includes(
          notification.id
        )
    );

  const unreadCount =
    unreadNotifications.length;

  const handleNotificationOpen =
    (notification) => {
      const nextRead =
        markNotificationRead(
          notification.id
        );

      setReadNotificationIds(
        nextRead
      );

      setNotificationsOpen(
        false
      );

      if (
        notification.path
      ) {
        navigate(
          notification.path
        );
      }
    };

  const handleMarkAllRead =
    () => {
      const nextRead =
        markAllNotificationsRead(
          notifications
        );

      setReadNotificationIds(
        nextRead
      );

      notify.success(
        "Notificaciones",
        "Todas las alertas visibles fueron marcadas como leídas."
      );
    };

  /* =======================================
     CERRAR MENÚS AL HACER CLICK AFUERA
  ======================================= */

  useEffect(() => {
    const handleOutsideClick =
      (event) => {
        if (
          notificationRef.current &&
          !notificationRef.current.contains(
            event.target
          )
        ) {
          setNotificationsOpen(false);
        }

        if (
          userMenuRef.current &&
          !userMenuRef.current.contains(
            event.target
          )
        ) {
          setUserMenuOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const handleModuleOpen =
    (module) => {
      setNotificationsOpen(false);
      setUserMenuOpen(false);
      navigate(module.path);
    };

  const handleLogout =
    async () => {
      try {
        setUserMenuOpen(false);

        await logout();

        notify.success(
          "Sesión cerrada",
          "Cerraste sesión correctamente."
        );
      } catch (error) {
        console.error(
          "Error cerrando sesión:",
          error
        );

        notify.error(
          "No se pudo cerrar sesión",
          "Intentá nuevamente."
        );
      }
    };

  return (
    <main className="dashboard-page">
      <motion.header
        className="dashboard-header"
        initial={{
          opacity: 0,
          y: -12,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <button
          type="button"
          className="dashboard-brand"
          onClick={() => navigate("/dashboard")}
          style={{
            border: 0,
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <motion.div
            className="dashboard-brand-icon"
            whileHover={{
              rotate: -5,
              scale: 1.05,
            }}
          >
            <Wrench size={23} />
          </motion.div>

          <div>
            <span className="dashboard-eyebrow">
              Operación diaria
            </span>

            <h1>
              SERVIX
            </h1>
          </div>
        </button>

        <div className="dashboard-header-actions">
          <div className="system-status">
            <motion.span
              className="system-status-dot"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            <Wifi size={15} />

            <span>
              Sistema en línea
            </span>
          </div>

          {/* =================================
              NOTIFICACIONES
          ================================= */}

          <div
            className="dashboard-dropdown-wrapper"
            ref={notificationRef}
          >
            <motion.button
              type="button"
              className="dashboard-icon-button"
              whileTap={{
                scale: 0.92,
              }}
              onClick={() => {
                setNotificationsOpen(
                  (current) => !current
                );

                setUserMenuOpen(false);
              }}
              aria-label="Notificaciones"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <motion.span
                  className="dashboard-notification-badge"
                  initial={{
                    scale: 0,
                  }}
                  animate={{
                    scale: 1,
                  }}
                >
                  {unreadCount > 9
                    ? "9+"
                    : unreadCount}
                </motion.span>
              )}
            </motion.button>

            {notificationsOpen && (
              <motion.div
                className="dashboard-dropdown notification-dropdown"
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                transition={{
                  duration: 0.18,
                }}
              >
                <div className="dropdown-header notification-dropdown-header">
                  <div>
                    <strong>
                      Notificaciones
                    </strong>

                    <span>
                      {unreadCount > 0
                        ? `${unreadCount} sin leer`
                        : "Actividad del sistema"}
                    </span>
                  </div>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="notifications-mark-read"
                      onClick={handleMarkAllRead}
                    >
                      Marcar leídas
                    </button>
                  )}
                </div>

                {notifications.length > 0 ? (
                  <div className="notifications-list">
                    {notifications.map(
                      (notification) => {
                        const isUnread =
                          !readNotificationIds.includes(
                            notification.id
                          );

                        return (
                          <button
                            type="button"
                            key={notification.id}
                            className={
                              `notification-item severity-${notification.severity}${
                                isUnread
                                  ? " unread"
                                  : ""
                              }`
                            }
                            onClick={() =>
                              handleNotificationOpen(
                                notification
                              )
                            }
                          >
                            <span className="notification-item-icon">
                              <NotificationIcon
                                notification={
                                  notification
                                }
                              />
                            </span>

                            <span className="notification-item-copy">
                              <strong>
                                {notification.title}
                              </strong>

                              <small>
                                {notification.description}
                              </small>
                            </span>

                            {isUnread && (
                              <span className="notification-unread-dot" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="notifications-empty">
                    <div className="notifications-empty-icon">
                      <Bell size={22} />
                    </div>

                    <strong>
                      Todo al día
                    </strong>

                    <p>
                      No hay vencimientos ni tareas operativas que requieran atención.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* =================================
              USUARIO
          ================================= */}

          <div
            className="dashboard-dropdown-wrapper"
            ref={userMenuRef}
          >
            <button
              type="button"
              className="dashboard-user-button"
              onClick={() => {
                setUserMenuOpen(
                  (current) => !current
                );

                setNotificationsOpen(false);
              }}
            >
              <div className="dashboard-avatar">
                {initials}
              </div>

              <div className="dashboard-user-copy">
                <strong>
                  {userName}
                </strong>

                <span>
                  {userRole}
                </span>
              </div>

              <ChevronDown
                size={16}
                className={
                  userMenuOpen
                    ? "chevron-open"
                    : ""
                }
              />
            </button>

            {userMenuOpen && (
              <motion.div
                className="dashboard-dropdown user-dropdown"
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                transition={{
                  duration: 0.18,
                }}
              >
                <div className="user-dropdown-profile">
                  <div className="user-dropdown-avatar">
                    {initials}
                  </div>

                  <div>
                    <strong>
                      {userName}
                    </strong>

                    <span>
                      {user?.email || ""}
                    </span>
                  </div>
                </div>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  onClick={() => {
                    notify.info(
                      "Mi perfil",
                      "La pantalla de perfil todavía no está habilitada."
                    );

                    setUserMenuOpen(false);
                  }}
                >
                  <User size={17} />
                  Mi perfil
                </button>

                {canSecurity && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/configuracion");
                    }}
                  >
                    <Settings size={17} />
                    Configuración
                  </button>
                )}

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="logout-menu-item"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />
                  Cerrar sesión
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.header>

      <section className="dashboard-content">
        <motion.div
          className="dashboard-welcome"
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.08,
            duration: 0.4,
          }}
        >
          <span className="dashboard-welcome-kicker">
            Panel principal
          </span>

          <h2>
            Hola, {cleanUserName || userName}
          </h2>

          <p>
            Seleccioná un módulo para comenzar a trabajar.
          </p>
        </motion.div>

        <motion.div
          className="dashboard-modules-grid"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {visibleModules.map(
            (module) => {
              const Icon =
                module.icon;

              return (
                <motion.button
                  key={module.id}
                  type="button"
                  className={
                    `dashboard-module-card module-${module.color}`
                  }
                  variants={cardVariants}
                  whileHover={{
                    y: -5,
                  }}
                  whileTap={{
                    scale: 0.985,
                  }}
                  onClick={() =>
                    handleModuleOpen(
                      module
                    )
                  }
                >
                  <div className="module-card-top">
                    <div className="module-icon">
                      <Icon
                        size={26}
                        strokeWidth={2}
                      />
                    </div>

                    <span className="module-badge">
                      {module.badge}
                    </span>
                  </div>

                  <div className="module-card-content">
                    <h3>
                      {module.title}
                    </h3>

                    <p>
                      {module.description}
                    </p>
                  </div>

                  <div className="module-card-footer">
                    <span>
                      Abrir módulo
                    </span>

                    <span className="module-arrow">
                      →
                    </span>
                  </div>
                </motion.button>
              );
            }
          )}
        </motion.div>

        <motion.footer
          className="dashboard-footer"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.75,
          }}
        >
          <div>
            <span className="dashboard-footer-dot" />
            Servicios conectados
          </div>

          <span>
            React + Firebase
          </span>
        </motion.footer>
      </section>
    </main>
  );
}
