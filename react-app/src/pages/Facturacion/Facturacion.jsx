import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  FilePenLine,
  History,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Undo2,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../security/permissions.js";

import "./FacturacionSuite.css";

export default function Facturacion() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canSales = hasPermission(PERMISSIONS.SALES);
  const canTickets = hasPermission(PERMISSIONS.TICKETS);

  const modules = useMemo(
    () => [
      {
        id: "presupuestos",
        title: "Presupuestos",
        description: "Propuestas manuales o vinculadas a tickets, con versionado y seguimiento comercial.",
        icon: ClipboardList,
        route: "/facturacion/presupuestos",
        visible: canTickets || canSales,
      },
      {
        id: "facturas",
        title: "Facturas",
        description: "Comprobantes emitidos, estados de cobro, impresión y trazabilidad completa.",
        icon: ReceiptText,
        route: "/facturacion/facturas",
        visible: canSales,
      },
      {
        id: "notas-credito",
        title: "Notas de crédito",
        description: "Devoluciones y anulaciones documentadas, vinculadas a la factura de origen.",
        icon: RotateCcw,
        route: "/facturacion/notas-credito",
        visible: canSales,
      },
      {
        id: "rectificaciones",
        title: "Rectificaciones",
        description: "Correcciones formales auditables sin borrar ni reemplazar el comprobante original.",
        icon: FilePenLine,
        route: "/facturacion/rectificaciones",
        visible: canSales,
      },
      {
        id: "anulaciones",
        title: "Anulaciones",
        description: "Control de facturas anuladas o canceladas y sus documentos compensatorios.",
        icon: Undo2,
        route: "/facturacion/anulaciones",
        visible: canSales,
      },
      {
        id: "historial",
        title: "Historial y auditoría",
        description: "Registro central de acciones sobre presupuestos, facturas y notas de crédito.",
        icon: History,
        route: "/facturacion/historial",
        visible: canSales,
      },
    ],
    [canSales, canTickets]
  );

  const visibleModules = modules.filter((module) => module.visible);

  return (
    <main className="fb-page">
      <div className="fb-shell">
        <header className="fb-topbar">
          <div className="fb-brand">
            <button
              type="button"
              className="fb-icon-button"
              onClick={() => navigate("/dashboard")}
              title="Volver al Dashboard"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="fb-brand-icon">
              <ReceiptText size={21} />
            </div>

            <div className="fb-brand-copy">
              <strong>Facturación</strong>
              <span>SERVIX · Gestión documental y comercial</span>
            </div>
          </div>

          <div className="fb-top-actions">
            <div className="fb-status">
              <span className="fb-status-dot" />
              Módulo operativo
            </div>
          </div>
        </header>

        <section className="fb-page-head">
          <div>
            <div className="fb-kicker">
              <ShieldCheck size={15} />
              Centro de facturación
            </div>
            <h1>Documentos y trazabilidad</h1>
            <p>
              Presupuestos, comprobantes, correcciones y auditoría sin eliminación destructiva.
            </p>
          </div>
        </section>

        <motion.section
          className="fb-flow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="fb-flow-steps">
            <div className="fb-flow-step">
              <span>01</span>
              <strong>Presupuesto</strong>
              <small>Propuesta y aceptación</small>
            </div>
            <div className="fb-flow-step">
              <span>02</span>
              <strong>Caja</strong>
              <small>Cobro o financiación</small>
            </div>
            <div className="fb-flow-step">
              <span>03</span>
              <strong>Factura</strong>
              <small>Comprobante vinculado</small>
            </div>
            <div className="fb-flow-step">
              <span>04</span>
              <strong>Corrección</strong>
              <small>Rectificación / Nota de Crédito</small>
            </div>
          </div>
        </motion.section>

        <section className="fb-modules">
          {visibleModules.map((module, index) => {
            const Icon = module.icon;

            return (
              <motion.article
                key={module.id}
                className="fb-module-card"
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.035 }}
                onClick={() => navigate(module.route)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(module.route);
                  }
                }}
              >
                <div className="fb-module-icon">
                  <Icon size={20} />
                </div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <div className="fb-module-foot">
                  <span>Operativo</span>
                  <ArrowRight size={16} />
                </div>
              </motion.article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
