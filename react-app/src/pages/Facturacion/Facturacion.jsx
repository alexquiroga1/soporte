import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BookOpenCheck,
  CircleDollarSign,
  ClipboardList,
  FilePenLine,
  FileText,
  History,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Undo2,
  WalletCards,
} from "lucide-react";

import "./Facturacion.css";

/* =========================================
   COMPONENTE
========================================= */

export default function Facturacion() {
  const navigate = useNavigate();

  /* =======================================
     MÓDULOS
  ======================================= */

  const modules = useMemo(
    () => [
      {
        id: "presupuestos",
        title: "Presupuestos",
        description:
          "Generados desde tickets o creados manualmente.",
        icon: ClipboardList,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/presupuestos",
      },

      {
        id: "facturas",
        title: "Facturas",
        description:
          "Comprobantes emitidos desde Caja y seguimiento posterior.",
        icon: ReceiptText,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/facturas",
      },

      {
        id: "notas-credito",
        title: "Notas de crédito",
        description:
          "Correcciones económicas y devoluciones sobre comprobantes.",
        icon: RotateCcw,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/notas-credito",
      },

      {
        id: "rectificaciones",
        title: "Rectificaciones",
        description:
          "Correcciones formales sin modificar importes ni movimientos.",
        icon: FilePenLine,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/rectificaciones",
      },

      {
        id: "anulaciones",
        title: "Anulaciones",
        description:
          "Gestión de comprobantes anulados, devoluciones y trazabilidad.",
        icon: Undo2,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/anulaciones",
      },

      {
        id: "historial",
        title: "Historial y auditoría",
        description:
          "Registro central de acciones y movimientos de facturación.",
        icon: History,
        meta: "Operativo",
        status: "ready",
        route: "/facturacion/historial",
      },
    ],
    []
  );

  /* =======================================
     ABRIR MÓDULO
  ======================================= */

  const handleModuleOpen = (module) => {
    navigate(module.route);
  };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="billing-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="billing-header">
        <div className="billing-header-left">

          <button
            type="button"
            className="billing-back"
            onClick={() => navigate("/dashboard")}
            title="Volver al Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="billing-header-logo">
            <BadgeDollarSign size={21} />
          </div>

          <div className="billing-header-title">
            <span>Administración</span>
            <h1>Facturación</h1>
          </div>

        </div>

        <div className="billing-header-status">
          <span className="billing-header-status-dot" />

          <div>
            <strong>Sistema operativo</strong>
            <small>Gestión interna</small>
          </div>
        </div>
      </header>

      {/* =================================
          CONTENIDO
      ================================= */}

      <div className="billing-content">

        {/* =================================
            INTRO
        ================================= */}

        <motion.section
          className="billing-intro"
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div>
            <span className="billing-kicker">
              Gestión económica
            </span>

            <h2>Centro de facturación</h2>

            <p>
              Presupuestos, comprobantes, correcciones,
              anulaciones y trazabilidad comercial.
            </p>
          </div>

          <div className="billing-intro-badge">
            <ShieldCheck size={18} />

            <div>
              <strong>Trazabilidad</strong>
              <span>Sin eliminación destructiva</span>
            </div>
          </div>
        </motion.section>

        {/* =================================
            FLUJO
        ================================= */}

        <section className="billing-flow">

          <div className="billing-flow-title">
            <span>Flujo operativo</span>

            <strong>
              Desde el trabajo técnico hasta el comprobante
            </strong>
          </div>

          <div className="billing-flow-steps">

            <div className="billing-flow-step">
              <span>01</span>

              <div>
                <strong>Ticket</strong>
                <small>Diagnóstico</small>
              </div>
            </div>

            <ArrowRight size={18} />

            <div className="billing-flow-step">
              <span>02</span>

              <div>
                <strong>Presupuesto</strong>
                <small>Aprobación</small>
              </div>
            </div>

            <ArrowRight size={18} />

            <div className="billing-flow-step">
              <span>03</span>

              <div>
                <strong>Caja</strong>
                <small>Cobro</small>
              </div>
            </div>

            <ArrowRight size={18} />

            <div className="billing-flow-step">
              <span>04</span>

              <div>
                <strong>Factura</strong>
                <small>Comprobante</small>
              </div>
            </div>

          </div>
        </section>

        {/* =================================
            MÓDULOS
        ================================= */}

        <section className="billing-modules-section">

          <div className="billing-section-heading">
            <div>
              <span>Herramientas</span>
              <h3>Operaciones de facturación</h3>
            </div>
          </div>

          <div className="billing-modules-grid">

            {modules.map((module, index) => {
              const Icon = module.icon;

              return (
                <motion.button
                  type="button"
                  key={module.id}
                  className="billing-module-card is-ready"

                  initial={{
                    opacity: 0,
                    y: 10,
                  }}

                  animate={{
                    opacity: 1,
                    y: 0,
                  }}

                  transition={{
                    delay: index * 0.035,
                  }}

                  whileHover={{
                    y: -2,
                  }}

                  whileTap={{
                    scale: 0.99,
                  }}

                  onClick={() =>
                    handleModuleOpen(module)
                  }
                >
                  <div className="billing-module-top">

                    <div className="billing-module-icon">
                      <Icon size={22} />
                    </div>

                    <span className="billing-module-status ready">
                      {module.meta}
                    </span>

                  </div>

                  <div className="billing-module-copy">
                    <h4>{module.title}</h4>
                    <p>{module.description}</p>
                  </div>

                  <div className="billing-module-footer">
                    <span>Abrir módulo</span>
                    <ArrowRight size={17} />
                  </div>

                </motion.button>
              );
            })}

          </div>
        </section>

        {/* =================================
            INFORMACIÓN
        ================================= */}

        <section className="billing-info-grid">

          <article className="billing-info-card">
            <div className="billing-info-icon">
              <CircleDollarSign size={20} />
            </div>

            <div>
              <span>Presupuesto</span>

              <h3>
                Ticket y presupuesto sincronizados
              </h3>

              <p>
                Un presupuesto generado desde un ticket queda
                registrado también en el módulo Presupuestos.
              </p>
            </div>
          </article>

          <article className="billing-info-card">
            <div className="billing-info-icon">
              <WalletCards size={20} />
            </div>

            <div>
              <span>Caja</span>

              <h3>
                El cobro ocurre antes de facturar
              </h3>

              <p>
                Caja registra el medio de pago y cierra la
                operación antes de generar el comprobante.
              </p>
            </div>
          </article>

          <article className="billing-info-card">
            <div className="billing-info-icon">
              <BookOpenCheck size={20} />
            </div>

            <div>
              <span>Auditoría</span>

              <h3>
                Cada cambio mantiene historial
              </h3>

              <p>
                Rectificaciones, anulaciones y notas quedan
                registradas en lugar de eliminar documentos.
              </p>
            </div>
          </article>

        </section>

        {/* =================================
            NOTA DEL SISTEMA
        ================================= */}

        <section className="billing-system-note">

          <FileText size={17} />

          <div>
            <strong>
              Facturación electrónica externa todavía no conectada
            </strong>

            <span>
              Esta etapa administra el flujo interno del sistema.
              La integración fiscal podrá incorporarse después
              sin modificar la arquitectura general.
            </span>
          </div>

        </section>

      </div>
    </main>
  );
}