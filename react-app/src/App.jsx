import {
  Suspense,
  lazy,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { Toaster } from "sileo";

import { useAuth } from "./context/AuthContext.jsx";
import { MODULE_ACCESS } from "./security/permissions.js";

/* =========================================
   CARGA DIFERIDA POR MÓDULO
========================================= */

const Login = lazy(() =>
  import("./pages/Login/Login.jsx")
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard/Dashboard.jsx")
);
const Tickets = lazy(() =>
  import("./pages/Tickets/Tickets.jsx")
);
const NuevoTicket = lazy(() =>
  import("./pages/Tickets/NuevoTicket.jsx")
);
const TicketDetail = lazy(() =>
  import("./pages/Tickets/TicketDetail.jsx")
);
const POS = lazy(() =>
  import("./pages/POS/POS.jsx")
);
const Clientes = lazy(() =>
  import("./pages/Clientes/Clientes.jsx")
);
const Caja = lazy(() =>
  import("./pages/Caja/Caja.jsx")
);
const Creditos = lazy(() =>
  import("./pages/Creditos/Creditos.jsx")
);
const Facturacion = lazy(() =>
  import("./pages/Facturacion/Facturacion.jsx")
);
const Presupuestos = lazy(() =>
  import("./pages/Facturacion/Presupuestos.jsx")
);
const NuevoPresupuesto = lazy(() =>
  import("./pages/Facturacion/NuevoPresupuesto.jsx")
);
const Facturas = lazy(() =>
  import("./pages/Facturacion/Facturas.jsx")
);
const NotasCredito = lazy(() =>
  import("./pages/Facturacion/NotasCredito.jsx")
);
const Rectificaciones = lazy(() =>
  import("./pages/Facturacion/Rectificaciones.jsx")
);
const Anulaciones = lazy(() =>
  import("./pages/Facturacion/Anulaciones.jsx")
);
const HistorialFacturacion = lazy(() =>
  import("./pages/Facturacion/HistorialFacturacion.jsx")
);
const PresupuestoPublico = lazy(() =>
  import("./pages/PresupuestoPublico/PresupuestoPublico.jsx")
);
const Productos = lazy(() =>
  import("./pages/Productos/Productos.jsx")
);
const CRM = lazy(() =>
  import("./pages/CRM/CRM.jsx")
);
const Reportes = lazy(() =>
  import("./pages/Reportes/Reportes.jsx")
);
const Configuracion = lazy(() =>
  import("./pages/Configuracion/Configuracion.jsx")
);

function LoadingScreen() {
  return (
    <main
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
          gap: "12px",
        }}
      >
        <div className="app-loading-spinner" />
        <strong>Cargando sistema...</strong>
        <span
          style={{
            fontSize: "0.82rem",
            color: "var(--muted)",
          }}
        >
          Verificando sesión y permisos
        </span>
      </div>
    </main>
  );
}

function ProtectedRoute({
  children,
  permissions = [],
}) {
  const {
    user,
    profile,
    loading,
    hasAnyPermission,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (
    permissions.length &&
    !hasAnyPermission(permissions)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Secured({ module, children }) {
  return (
    <ProtectedRoute
      permissions={MODULE_ACCESS[module] || []}
    >
      {children}
    </ProtectedRoute>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      <Toaster position="top-right" />

      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            path="/presupuesto/:token"
            element={<PresupuestoPublico />}
          />

          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tickets"
            element={
              <Secured module="tickets">
                <Tickets />
              </Secured>
            }
          />
          <Route
            path="/tickets/nuevo"
            element={
              <Secured module="tickets">
                <NuevoTicket />
              </Secured>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <Secured module="tickets">
                <TicketDetail />
              </Secured>
            }
          />

          <Route
            path="/pos"
            element={
              <Secured module="pos">
                <POS />
              </Secured>
            }
          />

          <Route
            path="/clientes"
            element={
              <Secured module="clientes">
                <Clientes />
              </Secured>
            }
          />

          <Route
            path="/caja"
            element={
              <Secured module="caja">
                <Caja />
              </Secured>
            }
          />

          <Route
            path="/creditos"
            element={
              <Secured module="creditos">
                <Creditos />
              </Secured>
            }
          />

          <Route
            path="/facturacion"
            element={
              <Secured module="facturacion">
                <Facturacion />
              </Secured>
            }
          />
          <Route
            path="/facturacion/presupuestos"
            element={
              <Secured module="facturacion">
                <Presupuestos />
              </Secured>
            }
          />
          <Route
            path="/facturacion/presupuestos/nuevo"
            element={
              <Secured module="facturacion">
                <NuevoPresupuesto />
              </Secured>
            }
          />
          <Route
            path="/facturacion/facturas"
            element={
              <Secured module="facturacion">
                <Facturas />
              </Secured>
            }
          />
          <Route
            path="/facturacion/notas-credito"
            element={
              <Secured module="facturacion">
                <NotasCredito />
              </Secured>
            }
          />
          <Route
            path="/facturacion/rectificaciones"
            element={
              <Secured module="facturacion">
                <Rectificaciones />
              </Secured>
            }
          />
          <Route
            path="/facturacion/anulaciones"
            element={
              <Secured module="facturacion">
                <Anulaciones />
              </Secured>
            }
          />
          <Route
            path="/facturacion/historial"
            element={
              <Secured module="facturacion">
                <HistorialFacturacion />
              </Secured>
            }
          />

          <Route
            path="/productos"
            element={
              <Secured module="productos">
                <Productos />
              </Secured>
            }
          />

          <Route
            path="/crm"
            element={
              <Secured module="crm">
                <CRM />
              </Secured>
            }
          />

          <Route
            path="/reportes"
            element={
              <Secured module="reportes">
                <Reportes />
              </Secured>
            }
          />

          <Route
            path="/configuracion"
            element={
              <Secured module="configuracion">
                <Configuracion />
              </Secured>
            }
          />

          <Route
            path="/"
            element={
              loading ? (
                <LoadingScreen />
              ) : user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="*"
            element={
              loading ? (
                <LoadingScreen />
              ) : user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
