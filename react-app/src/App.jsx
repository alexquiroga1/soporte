import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  Toaster,
} from "sileo";

import {
  useAuth,
} from "./context/AuthContext.jsx";

/* =========================================
   AUTENTICACIÓN
========================================= */

import Login from "./pages/Login/Login.jsx";

/* =========================================
   DASHBOARD
========================================= */

import Dashboard from "./pages/Dashboard/Dashboard.jsx";

/* =========================================
   TICKETS
========================================= */

import Tickets from "./pages/Tickets/Tickets.jsx";

import TicketDetail from "./pages/Tickets/TicketDetail.jsx";

/* =========================================
   POS
========================================= */

import POS from "./pages/POS/POS.jsx";

/* =========================================
   CLIENTES
========================================= */

import Clientes from "./pages/Clientes/Clientes.jsx";

/* =========================================
   CAJA
========================================= */

import Caja from "./pages/Caja/Caja.jsx";

/* =========================================
   CRÉDITOS
========================================= */

import Creditos from "./pages/Creditos/Creditos.jsx";

/* =========================================
   FACTURACIÓN
========================================= */

import Facturacion from "./pages/Facturacion/Facturacion.jsx";

import Presupuestos from "./pages/Facturacion/Presupuestos.jsx";

import Facturas from "./pages/Facturacion/Facturas.jsx";

import NotasCredito from "./pages/Facturacion/NotasCredito.jsx";

import Rectificaciones from "./pages/Facturacion/Rectificaciones.jsx";

import Anulaciones from "./pages/Facturacion/Anulaciones.jsx";

import HistorialFacturacion from "./pages/Facturacion/HistorialFacturacion.jsx";

/* =========================================
   PRODUCTOS
========================================= */

import Productos from "./pages/Productos/Productos.jsx";

/* =========================================
   CRM
========================================= */

import CRM from "./pages/CRM/CRM.jsx";

/* =========================================
   REPORTES
========================================= */

import Reportes from "./pages/Reportes/Reportes.jsx";

/* =========================================
   CONFIGURACIÓN
========================================= */

import Configuracion from "./pages/Configuracion/Configuracion.jsx";

/* =========================================
   PANTALLA DE CARGA
========================================= */

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

        <strong>
          Cargando sistema...
        </strong>

        <span
          style={{
            fontSize: "0.82rem",
            color: "var(--muted)",
          }}
        >
          Verificando sesión
        </span>
      </div>
    </main>
  );
}

/* =========================================
   RUTA PROTEGIDA
========================================= */

function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

/* =========================================
   SOLO NO LOGUEADOS
========================================= */

function PublicOnlyRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (user) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

/* =========================================
   APP
========================================= */

export default function App() {
  const {
    user,
    loading,
  } = useAuth();

  return (
    <>
      {/* =================================
          NOTIFICACIONES
      ================================= */}

      <Toaster
        position="top-right"
      />

      {/* =================================
          ROUTER
      ================================= */}

      <Routes>

        {/* =================================
            LOGIN
        ================================= */}

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />

        {/* =================================
            DASHBOARD
        ================================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* =================================
            TICKETS
        ================================= */}

        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <Tickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets/:id"
          element={
            <ProtectedRoute>
              <TicketDetail />
            </ProtectedRoute>
          }
        />

        {/* =================================
            POS
        ================================= */}

        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <POS />
            </ProtectedRoute>
          }
        />

        {/* =================================
            CLIENTES
        ================================= */}

        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <Clientes />
            </ProtectedRoute>
          }
        />

        {/* =================================
            CAJA
        ================================= */}

        <Route
          path="/caja"
          element={
            <ProtectedRoute>
              <Caja />
            </ProtectedRoute>
          }
        />

        {/* =================================
            CRÉDITOS
        ================================= */}

        <Route
          path="/creditos"
          element={
            <ProtectedRoute>
              <Creditos />
            </ProtectedRoute>
          }
        />

        {/* =================================
            FACTURACIÓN
        ================================= */}

        <Route
          path="/facturacion"
          element={
            <ProtectedRoute>
              <Facturacion />
            </ProtectedRoute>
          }
        />

        {/* =================================
            PRESUPUESTOS
        ================================= */}

        <Route
          path="/facturacion/presupuestos"
          element={
            <ProtectedRoute>
              <Presupuestos />
            </ProtectedRoute>
          }
        />

        {/* =================================
            FACTURAS
        ================================= */}

        <Route
          path="/facturacion/facturas"
          element={
            <ProtectedRoute>
              <Facturas />
            </ProtectedRoute>
          }
        />

        {/* =================================
            NOTAS DE CRÉDITO
        ================================= */}

        <Route
          path="/facturacion/notas-credito"
          element={
            <ProtectedRoute>
              <NotasCredito />
            </ProtectedRoute>
          }
        />

        {/* =================================
            RECTIFICACIONES
        ================================= */}

        <Route
          path="/facturacion/rectificaciones"
          element={
            <ProtectedRoute>
              <Rectificaciones />
            </ProtectedRoute>
          }
        />

        {/* =================================
            ANULACIONES
        ================================= */}

        <Route
          path="/facturacion/anulaciones"
          element={
            <ProtectedRoute>
              <Anulaciones />
            </ProtectedRoute>
          }
        />

        {/* =================================
            HISTORIAL / AUDITORÍA
        ================================= */}

        <Route
          path="/facturacion/historial"
          element={
            <ProtectedRoute>
              <HistorialFacturacion />
            </ProtectedRoute>
          }
        />

        {/* =================================
            PRODUCTOS
        ================================= */}

        <Route
          path="/productos"
          element={
            <ProtectedRoute>
              <Productos />
            </ProtectedRoute>
          }
        />

        {/* =================================
            CRM
        ================================= */}

        <Route
          path="/crm"
          element={
            <ProtectedRoute>
              <CRM />
            </ProtectedRoute>
          }
        />

        {/* =================================
            REPORTES
        ================================= */}

        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <Reportes />
            </ProtectedRoute>
          }
        />

        {/* =================================
            CONFIGURACIÓN
        ================================= */}

        <Route
          path="/configuracion"
          element={
            <ProtectedRoute>
              <Configuracion />
            </ProtectedRoute>
          }
        />

        {/* =================================
            RAÍZ
        ================================= */}

        <Route
          path="/"
          element={
            loading ? (
              <LoadingScreen />
            ) : user ? (
              <Navigate
                to="/dashboard"
                replace
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        {/* =================================
            RUTA DESCONOCIDA
        ================================= */}

        <Route
          path="*"
          element={
            loading ? (
              <LoadingScreen />
            ) : user ? (
              <Navigate
                to="/dashboard"
                replace
              />
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

      </Routes>
    </>
  );
}