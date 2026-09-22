import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { motion } from "motion/react";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy,
  Cpu,
  Laptop,
  MessageCircle,
  MessageSquareText,
  Package,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

import {
  addTicketNote,
  addTicketPiece,
  saveTicketBudgetSummary,
  saveTicketDiagnosis,
  removeTicketPiece,
  subscribeToTicket,
  updateTicketPiece,
  updateTicketStage,
} from "../../services/tickets.service.js";

import {
  cancelCashPending,
  sendTicketToCash,
} from "../../services/caja-pendientes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import technicianCharacter from "./assets/technician-character.png";

import "./TicketDetail.css";

/* =========================================
   ESTADOS
========================================= */

const STAGES = {
  pendiente_ingreso: {
    label: "Pendiente de ingreso",
    className: "detail-stage-awaiting",
  },

  pendiente: {
    label: "Recepción",
    className: "detail-stage-pending",
  },

  diagnostico: {
    label: "En diagnóstico",
    className: "detail-stage-diagnostic",
  },

  presupuesto: {
    label: "Presupuesto",
    className: "detail-stage-budget",
  },

  presupuesto_rechazado: {
    label: "Presupuesto rechazado",
    className: "detail-stage-danger",
  },

  reparacion: {
    label: "En reparación",
    className: "detail-stage-repair",
  },

  repuesto: {
    label: "Esperando repuesto",
    className: "detail-stage-part",
  },

  listo: {
    label: "Listo para entrega",
    className: "detail-stage-ready",
  },

  entregado: {
    label: "Entregado",
    className: "detail-stage-delivered",
  },

  noreparable: {
    label: "No reparable",
    className: "detail-stage-danger",
  },

  cancelado: {
    label: "Cancelado / Retirado",
    className: "detail-stage-muted",
  },

  garantia: {
    label: "Garantía",
    className: "detail-stage-warranty",
  },
};

const WORKFLOW_STAGES = [
  { key: "pendiente_ingreso", label: "Pendiente ingreso" },
  { key: "pendiente", label: "Recepción" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "presupuesto", label: "Presupuesto" },
  { key: "reparacion", label: "Reparación" },
  { key: "listo", label: "Listo" },
  { key: "entregado", label: "Entregado" },
];

/* =========================================
   HELPERS
========================================= */

function getStage(stage) {
  return (
    STAGES[stage] || {
      label:
        stage ||
        "Sin estado",

      className:
        "detail-stage-muted",
    }
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    }
  ).format(
    Number(
      value ||
        0
    )
  );
}

function getActiveObjectLabels(
  object,
  labels
) {
  if (
    !object ||
    typeof object !==
      "object"
  ) {
    return [];
  }

  return Object.entries(
    labels
  )
    .filter(
      ([key]) =>
        Boolean(
          object[key]
        )
    )
    .map(
      ([, label]) =>
        label
    );
}

/* =========================================
   COMPONENTE
========================================= */

export default function TicketDetail() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const { id } =
    useParams();

  const {
    profile,
    user,
  } = useAuth();

  /* =======================================
     TICKET
  ======================================= */

  const [
    ticket,
    setTicket,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  /* =======================================
     UI
  ======================================= */

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "pieces"
  );

  /* =======================================
     ESTADO
  ======================================= */

  const [
    selectedStage,
    setSelectedStage,
  ] = useState("");

  const [
    savingStage,
    setSavingStage,
  ] = useState(false);

  const [
    sendingToCash,
    setSendingToCash,
  ] = useState(false);

  const [
    cancellingCashPending,
    setCancellingCashPending,
  ] = useState(false);

  /* =======================================
     DIAGNÓSTICO ÚNICO
  ======================================= */

  const [
    diagnosisDraft,
    setDiagnosisDraft,
  ] = useState("");

  const [
    savingDiagnosis,
    setSavingDiagnosis,
  ] = useState(false);

  /* =======================================
     BITÁCORA
  ======================================= */

  const [
    note,
    setNote,
  ] = useState("");

  const [
    savingNote,
    setSavingNote,
  ] = useState(false);

  /* =======================================
     REPUESTOS
  ======================================= */

  const [
    pieceForm,
    setPieceForm,
  ] = useState({
    nombre: "",
    sku: "",
    cant: 1,
    costo: "",
  });

  const [
    addingPiece,
    setAddingPiece,
  ] = useState(false);

  const [
    editingPieceIndex,
    setEditingPieceIndex,
  ] = useState(null);

  const [
    editingPiece,
    setEditingPiece,
  ] = useState(null);

  const [
    savingPiece,
    setSavingPiece,
  ] = useState(false);

  const [
    deletingPieceIndex,
    setDeletingPieceIndex,
  ] = useState(null);

  /* =======================================
     PRESUPUESTO
  ======================================= */

  const [
    budgetLabor,
    setBudgetLabor,
  ] = useState(0);

  const [
    budgetDiscount,
    setBudgetDiscount,
  ] = useState(0);

  const [
    savingBudget,
    setSavingBudget,
  ] = useState(false);


  /* =======================================
     AUTOR
  ======================================= */

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const returnTo =
    location.state?.returnTo ||
    null;

  const handleBack = () => {
    navigate(
      returnTo ||
      "/tickets"
    );
  };

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(() => {
    setLoading(true);

    const unsubscribe =
      subscribeToTicket(
        id,

        (data) => {
          setTicket(
            data
          );

          setError(
            null
          );

          setLoading(
            false
          );
        },

        (
          firebaseError
        ) => {
          console.error(
            firebaseError
          );

          setError(
            firebaseError
          );

          setLoading(
            false
          );

          notify.error(
            "No pudimos cargar el ticket",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [id]);

  /* =======================================
     SINCRONIZAR ESTADO
  ======================================= */

  useEffect(() => {
    if (!ticket) {
      return;
    }

    setSelectedStage(
      ticket.stage ||
        "pendiente"
    );
  }, [
    ticket?.stage,
  ]);

  /* =======================================
     SINCRONIZAR PRESUPUESTO
  ======================================= */

  useEffect(() => {
    if (!ticket) {
      return;
    }

    setBudgetLabor(
      Number(
        ticket.manoObra ||
          0
      )
    );

    setBudgetDiscount(
      Number(
        ticket.descuentoPorcentaje ||
          0
      )
    );
  }, [
    ticket?.manoObra,
    ticket?.descuentoPorcentaje,
  ]);

  /* =======================================
     DATOS DERIVADOS
  ======================================= */

  const stage =
    getStage(
      ticket?.stage
    );

  const workflowStageKey =
    ({
      presupuesto_rechazado: "presupuesto",
      repuesto: "reparacion",
      garantia: "entregado",
    })[ticket?.stage] ||
    ticket?.stage ||
    "pendiente";

  const workflowStageIndex =
    WORKFLOW_STAGES.findIndex(
      (item) => item.key === workflowStageKey
    );


  const pieces =
    useMemo(() => {
      return Array.isArray(
        ticket?.piezas
      )
        ? ticket.piezas
        : [];
    }, [
      ticket?.piezas,
    ]);

  const history =
    useMemo(() => {
      const source =
        Array.isArray(
          ticket?.historial
        )
          ? ticket.historial
          : [];

      return [
        ...source,
      ].reverse();
    }, [
      ticket?.historial,
    ]);

  const physicalState =
    useMemo(() => {
      return getActiveObjectLabels(
        ticket?.estadoFisico,
        {
          pantalla:
            "Pantalla",

          carcasa:
            "Carcasa",

          teclado:
            "Teclado",

          cargador:
            "Cargador",

          bateria:
            "Batería",

          puertos:
            "Puertos",
        }
      );
    }, [
      ticket?.estadoFisico,
    ]);

  const accessories =
    useMemo(() => {
      return getActiveObjectLabels(
        ticket?.accesoriosObj,
        {
          cargador:
            "Cargador",

          funda:
            "Funda",

          cable:
            "Cable",
        }
      );
    }, [
      ticket?.accesoriosObj,
    ]);

  /* =======================================
     TOTAL REPUESTOS
  ======================================= */

  const piecesTotal =
    useMemo(() => {
      return pieces.reduce(
        (
          total,
          piece
        ) => {
          const quantity =
            Number(
              piece.cant ||
                0
            );

          const price =
            Number(
              piece.costo ||
                0
            );

          return (
            total +
            quantity *
              price
          );
        },
        0
      );
    }, [
      pieces,
    ]);

  /* =======================================
     CÁLCULOS PRESUPUESTO
  ======================================= */

  const safeLabor =
    Math.max(
      0,
      Number(
        budgetLabor ||
          0
      )
    );

  const safeDiscount =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          budgetDiscount ||
            0
        )
      )
    );

  const budgetSubtotal =
    piecesTotal +
    safeLabor;

  const budgetDiscountAmount =
    budgetSubtotal *
    (
      safeDiscount /
      100
    );

  const budgetTotal =
    Math.max(
      0,
      budgetSubtotal -
        budgetDiscountAmount
    );

  const displayBudgetTotal =
    budgetTotal > 0
      ? budgetTotal
      : Math.max(0, Number(ticket?.presupuestoEstimado || 0));


  /* =======================================
     CAJA / FACTURACIÓN
  ======================================= */

  const cashPending =
    ticket?.estadoCaja ===
    "Pendiente";

  const cashPaid =
    ticket?.estadoCaja ===
      "Cobrado" ||
    ticket?.estadoPago ===
      "Pagado";

  const cashFinanced =
    ticket?.estadoCaja ===
      "Financiado" ||
    [
      "Financiado",
      "Pago Parcial",
    ].includes(
      ticket?.estadoPago
    );

  const cashResolved =
    cashPaid ||
    cashFinanced;

  const alreadyBilled =
    Boolean(
      ticket?.estadoFacturacion &&
      ticket.estadoFacturacion !==
        "No facturado"
    );

  const canSendToCash =
    !cashPending &&
    !cashResolved &&
    !alreadyBilled;

  /* =======================================
     CAMBIO DE ESTADO
  ======================================= */

  const handleStageChange =
    async () => {
      if (!ticket) {
        return;
      }

      const currentStage =
        ticket.stage ||
        "pendiente";

      if (
        selectedStage ===
        currentStage
      ) {
        notify.info(
          "Sin cambios",
          "El ticket ya se encuentra en ese estado."
        );

        return;
      }

      const selectedData =
        getStage(
          selectedStage
        );

      if (
        selectedStage ===
          "entregado" ||
        selectedStage ===
          "cancelado" ||
        selectedStage ===
          "noreparable"
      ) {
        const confirmed =
          window.confirm(
            `¿Confirmás cambiar el ticket #${ticket.id} a "${selectedData.label}"?`
          );

        if (!confirmed) {
          setSelectedStage(
            currentStage
          );

          return;
        }
      }

      try {
        setSavingStage(
          true
        );

        const result =
          await updateTicketStage(
            ticket,
            selectedStage,
            author
          );

        if (
          !result.changed
        ) {
          notify.info(
            "Sin cambios",
            "El estado ya estaba actualizado."
          );

          return;
        }

        notify.success(
          "Estado actualizado",
          `Ticket #${ticket.id}: ${result.stageLabel}.`
        );
      } catch (
        stageError
      ) {
        console.error(
          stageError
        );

        setSelectedStage(
          currentStage
        );

        const stageMessages = {
          TICKET_CASH_PENDING_LOCKED:
            "Primero cancelá el pendiente de Caja o completá el cobro.",
          TICKET_PAYMENT_REQUIRED:
            "El ticket debe estar cobrado o financiado y facturado antes de marcarlo como Entregado.",
          TICKET_FINANCIAL_REVERSAL_REQUIRED:
            "El ticket ya tiene una operación financiera. Primero anulá o rectificá la factura correspondiente.",
        };

        notify.error(
          "No se pudo cambiar el estado",
          stageMessages[stageError?.message] ||
            "Firestore rechazó la actualización."
        );
      } finally {
        setSavingStage(
          false
        );
      }
    };

  /* =======================================
     GUARDAR DIAGNÓSTICO ÚNICO
  ======================================= */

  const handleSaveDiagnosis =
    async () => {
      const cleanDiagnosis = diagnosisDraft.trim();

      if (!cleanDiagnosis) {
        notify.warning(
          "Diagnóstico vacío",
          "Escribí el diagnóstico antes de guardarlo."
        );
        return;
      }

      if (ticket?.diagnosticoInicial) {
        notify.info(
          "Diagnóstico ya registrado",
          "El diagnóstico principal se guarda una sola vez. Los avances siguientes van a la bitácora."
        );
        return;
      }

      try {
        setSavingDiagnosis(true);
        await saveTicketDiagnosis(ticket.id, cleanDiagnosis, author);
        setDiagnosisDraft("");
        notify.success(
          "Diagnóstico registrado",
          "Quedó guardado como diagnóstico principal y también en la bitácora."
        );
      } catch (diagnosisError) {
        console.error(diagnosisError);
        notify.error(
          "No se pudo guardar el diagnóstico",
          diagnosisError?.message === "DIAGNOSIS_ALREADY_REGISTERED"
            ? "Este ticket ya tiene un diagnóstico principal."
            : "Revisá la conexión e intentá nuevamente."
        );
      } finally {
        setSavingDiagnosis(false);
      }
    };

  /* =======================================
     NOTA
  ======================================= */

  const handleAddNote =
    async () => {
      const cleanNote =
        note.trim();

      if (!cleanNote) {
        notify.warning(
          "Nota vacía",
          "Escribí una nota antes de agregarla a la bitácora."
        );

        return;
      }

      try {
        setSavingNote(
          true
        );

        await addTicketNote(
          ticket.id,
          cleanNote,
          author
        );

        setNote("");

        notify.success(
          "Nota agregada",
          "La nota fue registrada en la bitácora."
        );
      } catch (
        noteError
      ) {
        console.error(
          noteError
        );

        notify.error(
          "No se pudo agregar la nota",
          "Ocurrió un error al guardar la bitácora."
        );
      } finally {
        setSavingNote(
          false
        );
      }
    };

  /* =======================================
     AGREGAR REPUESTO
  ======================================= */

  const handleAddPiece =
    async () => {

      const name =
        pieceForm.nombre.trim();

      if (!name) {
        notify.warning(
          "Falta la descripción",
          "Indicá qué repuesto o servicio estás agregando."
        );

        return;
      }

      const quantity =
        Number(
          pieceForm.cant
        );

      const price =
        Number(
          pieceForm.costo
        );

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {
        notify.warning(
          "Cantidad inválida",
          "La cantidad debe ser mayor a cero."
        );

        return;
      }

      if (
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        notify.warning(
          "Precio inválido",
          "Ingresá un importe válido."
        );

        return;
      }

      try {
        setAddingPiece(
          true
        );

        await addTicketPiece(
          ticket.id,
          {
            nombre:
              name,

            sku:
              pieceForm.sku,

            cant:
              quantity,

            costo:
              price,
          },
          author
        );

        setPieceForm({
          nombre: "",
          sku: "",
          cant: 1,
          costo: "",
        });

        notify.success(
          "Ítem agregado",
          `${name} fue agregado al ticket.`
        );
      } catch (
        pieceError
      ) {
        console.error(
          pieceError
        );

        notify.error(
          "No se pudo agregar",
          "Ocurrió un error al guardar el repuesto o servicio."
        );
      } finally {
        setAddingPiece(
          false
        );
      }
    };

  /* =======================================
     EDITAR REPUESTO
  ======================================= */

  const startPieceEdit =
    (
      piece,
      index
    ) => {

      setEditingPieceIndex(
        index
      );

      setEditingPiece({
        nombre:
          piece.nombre ||
          "",

        sku:
          piece.sku ||
          "",

        cant:
          piece.cant ||
          1,

        costo:
          piece.costo ??
          0,
      });
    };

  const cancelPieceEdit =
    () => {
      setEditingPieceIndex(
        null
      );

      setEditingPiece(
        null
      );
    };

  const handleSavePiece =
    async () => {

      if (
        editingPieceIndex ===
          null ||
        !editingPiece
      ) {
        return;
      }

      const name =
        String(
          editingPiece.nombre ||
            ""
        ).trim();

      const quantity =
        Number(
          editingPiece.cant
        );

      const price =
        Number(
          editingPiece.costo
        );

      if (!name) {
        notify.warning(
          "Falta la descripción",
          "El ítem necesita un nombre."
        );

        return;
      }

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {
        notify.warning(
          "Cantidad inválida",
          "La cantidad debe ser mayor a cero."
        );

        return;
      }

      if (
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        notify.warning(
          "Precio inválido",
          "Ingresá un precio válido."
        );

        return;
      }

      try {
        setSavingPiece(
          true
        );

        await updateTicketPiece(
          ticket.id,
          editingPieceIndex,
          {
            ...editingPiece,

            nombre:
              name,

            cant:
              quantity,

            costo:
              price,
          },
          author
        );

        cancelPieceEdit();

        notify.success(
          "Ítem actualizado",
          "Los cambios fueron guardados correctamente."
        );
      } catch (
        pieceError
      ) {
        console.error(
          pieceError
        );

        notify.error(
          "No se pudo actualizar",
          "Ocurrió un error al guardar los cambios."
        );
      } finally {
        setSavingPiece(
          false
        );
      }
    };

  /* =======================================
     ELIMINAR REPUESTO
  ======================================= */

  const handleRemovePiece =
    async (
      piece,
      index
    ) => {

      const confirmed =
        window.confirm(
          `¿Eliminar "${piece.nombre || "este ítem"}" del ticket?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingPieceIndex(
          index
        );

        await removeTicketPiece(
          ticket.id,
          index,
          author
        );

        if (
          editingPieceIndex ===
          index
        ) {
          cancelPieceEdit();
        }

        notify.success(
          "Ítem eliminado",
          "Se quitó del ticket correctamente."
        );
      } catch (
        pieceError
      ) {
        console.error(
          pieceError
        );

        notify.error(
          "No se pudo eliminar",
          "Firestore rechazó la operación."
        );
      } finally {
        setDeletingPieceIndex(
          null
        );
      }
    };

  /* =======================================
     MANO DE OBRA
  ======================================= */

  const handleLaborChange =
    (
      event
    ) => {
      const value =
        Number(
          event.target.value
        );

      if (
        !Number.isFinite(
          value
        )
      ) {
        setBudgetLabor(
          0
        );

        return;
      }

      setBudgetLabor(
        Math.max(
          0,
          value
        )
      );
    };

  /* =======================================
     DESCUENTO
  ======================================= */

  const handleDiscountChange =
    (
      event
    ) => {
      const value =
        Number(
          event.target.value
        );

      if (
        !Number.isFinite(
          value
        )
      ) {
        setBudgetDiscount(
          0
        );

        return;
      }

      setBudgetDiscount(
        Math.min(
          100,
          Math.max(
            0,
            value
          )
        )
      );
    };

  /* =======================================
     GUARDAR PRESUPUESTO
  ======================================= */

  const handleSaveBudget =
    async () => {
      if (
        budgetTotal <=
        0
      ) {
        notify.warning(
          "Presupuesto vacío",
          "Agregá un repuesto, servicio o importe de mano de obra."
        );

        return null;
      }

      try {
        setSavingBudget(
          true
        );

        const result =
          await saveTicketBudgetSummary(
            ticket.id,
            {
              labor:
                safeLabor,

              discountPercent:
                safeDiscount,
            },
            author
          );

        notify.success(
          "Presupuesto guardado",
          `Total actualizado: ${formatMoney(result.total)}`
        );

        return result;
      } catch (budgetError) {
        console.error(
          budgetError
        );

        notify.error(
          "No se pudo guardar",
          "Ocurrió un error al actualizar el presupuesto."
        );

        return null;
      } finally {
        setSavingBudget(
          false
        );
      }
    };

  /* =======================================
     IMPRIMIR
  ======================================= */

  const handlePrint =
    () => {
      window.print();
    };

  /* =======================================
     COPIAR
  ======================================= */

  const handleCopyTicket =
    async () => {
      try {
        await navigator.clipboard.writeText(
          `#${ticket.id}`
        );

        notify.success(
          "Número copiado",
          `Ticket #${ticket.id} copiado al portapapeles.`
        );
      } catch (
        clipboardError
      ) {
        console.error(
          clipboardError
        );

        notify.error(
          "No se pudo copiar",
          "El navegador no permitió acceder al portapapeles."
        );
      }
    };

  /* =======================================
     ENVIAR A CAJA
  ======================================= */

  const handleSendToCash =
    async () => {
      if (!ticket) {
        return;
      }

      if (budgetTotal <= 0) {
        notify.warning(
          "Sin importe para cobrar",
          "Cargá al menos un repuesto, servicio o mano de obra antes de enviar a Caja."
        );

        setActiveTab(
          "budget"
        );

        return;
      }

      const confirmed =
        window.confirm(
          `¿Enviar ${ticket.id} a Caja?\n\n` +
            `Total a cobrar: ${formatMoney(
              budgetTotal
            )}`
        );

      if (!confirmed) {
        return;
      }

      try {
        setSendingToCash(
          true
        );

        const savedBudget =
          await saveTicketBudgetSummary(
            ticket.id,
            {
              labor:
                safeLabor,
              discountPercent:
                safeDiscount,
            },
            author
          );

        if (savedBudget.total <= 0) {
          throw new Error(
            "BUDGET_INVALID_TOTAL"
          );
        }

        const result =
          await sendTicketToCash(
            ticket.id,
            author
          );

        notify.success(
          "Enviado a Caja",
          `${result.ticketId} quedó pendiente de cobro por ${formatMoney(
            result.total
          )}.`
        );

      } catch (
        cashError
      ) {
        console.error(
          cashError
        );

        const messages = {
          TICKET_ID_REQUIRED:
            "No pudimos determinar el ticket.",

          TICKET_NOT_FOUND:
            "No encontramos el ticket en Firestore.",

          BUDGET_INVALID_TOTAL:
            "El presupuesto no tiene un total válido.",

          CASH_PENDING_EXISTS:
            "Este ticket ya se encuentra pendiente de cobro en Caja.",

          TICKET_ALREADY_PAID:
            "Este ticket ya fue cobrado.",

          TICKET_ALREADY_BILLED:
            "Este ticket ya tiene una factura asociada.",
        };

        notify.error(
          "No se pudo enviar a Caja",
          messages[
            cashError?.message
          ] ||
            cashError?.message ||
            "Ocurrió un error inesperado."
        );
      } finally {
        setSendingToCash(
          false
        );
      }
    };

  const handleCancelCashPending =
    async () => {
      const pendingId =
        ticket?.cajaPendienteId;

      if (!pendingId) {
        notify.info(
          "Sin pendiente",
          "El ticket ya no tiene un cobro pendiente en Caja."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `¿Cancelar el envío del ticket #${ticket.id} a Caja?\n\n` +
            "No se elimina el presupuesto; solamente se retira el pendiente de cobro."
        );

      if (!confirmed) {
        return;
      }

      try {
        setCancellingCashPending(true);

        await cancelCashPending(
          pendingId,
          author
        );

        notify.success(
          "Envío cancelado",
          `El ticket #${ticket.id} volvió a quedar disponible para revisión antes del cobro.`
        );
      } catch (cashError) {
        console.error(cashError);

        notify.error(
          "No se pudo cancelar",
          cashError?.message === "CASH_PENDING_NOT_FOUND"
            ? "El pendiente ya no existe; probablemente fue procesado desde Caja."
            : cashError?.message || "Ocurrió un error inesperado."
        );
      } finally {
        setCancellingCashPending(false);
      }
    };

  /* =======================================
     LOADING
  ======================================= */

  if (loading) {
    return (
      <main className="ticket-detail-state-page">

        <div className="ticket-detail-loader" />

        <strong>
          Cargando ticket #{id}
        </strong>

        <span>
          Sincronizando con Firebase...
        </span>

      </main>
    );
  }

  /* =======================================
     ERROR
  ======================================= */

  if (error) {
    return (
      <main className="ticket-detail-state-page">

        <strong className="ticket-detail-error-title">
          No pudimos cargar el ticket.
        </strong>

        <span>
          Revisá la conexión o los permisos de Firestore.
        </span>

        <button
          type="button"

          onClick={handleBack}
        >
          {returnTo
            ? "Volver al cliente"
            : "Volver a Tickets"}
        </button>

      </main>
    );
  }

  /* =======================================
     NO EXISTE
  ======================================= */

  if (!ticket) {
    return (
      <main className="ticket-detail-state-page">

        <strong>
          Ticket #{id} no encontrado
        </strong>

        <button
          type="button"

          onClick={handleBack}
        >
          {returnTo
            ? "Volver al cliente"
            : "Volver a Tickets"}
        </button>

      </main>
    );
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="ticket-detail-page">

      {/* =================================
          HEADER
      ================================= */}

      <motion.header
        className="ticket-detail-header ticket-detail-header-2026"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button type="button" className="ticket-detail-back ticket-detail-back-pill" onClick={handleBack}>
          <ArrowLeft size={17} />
          <span>{returnTo ? "Volver al cliente" : "Volver a Tickets"}</span>
        </button>

        <div className="ticket-detail-header-main">
          <div className="ticket-detail-header-symbol ticket-detail-header-symbol-large">
            <ClipboardList size={30} />
          </div>

          <div className="ticket-detail-title ticket-detail-title-large">
            <h1>{ticket.id}</h1>
            <p>
              {[ticket.equipo, ticket.marca, ticket.modelo].filter(Boolean).join(" · ") || "Orden de servicio técnico"}
            </p>
          </div>

          <div className="ticket-detail-hero-chips">
            <motion.span
              className={`ticket-detail-stage ${stage.className}`}
              animate={{ y: [0, -2, 0], scale: [1, 1.025, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.span
                className="ticket-detail-stage-icon-motion"
                animate={ticket.stage === "reparacion" ? { rotate: [0, -10, 10, 0] } : { opacity: [0.75, 1, 0.75] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <Wrench size={15} />
              </motion.span>
              {stage.label}
            </motion.span>
            <span className="ticket-detail-priority-chip">
              <Tag size={15} /> {ticket.prioridad === "P1" ? "Alta" : ticket.prioridad === "P3" ? "Baja" : "Media"}
            </span>
            <span className="ticket-detail-client-chip">
              <UserRound size={15} /> {ticket.cliente || "Sin cliente"}
            </span>
          </div>
        </div>

        <div className="ticket-detail-header-art ticket-detail-header-art-dom" aria-label="Cabecera editable">
          <motion.span className="ticket-detail-float-icon detail-gear" animate={{ rotate: [0, 12, 0], y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <Settings size={23} />
          </motion.span>
          <motion.span className="ticket-detail-float-icon detail-laptop" animate={{ y: [0, 6, 0] }} transition={{ duration: 3.3, repeat: Infinity }}>
            <Laptop size={23} />
          </motion.span>
          <motion.span className="ticket-detail-float-icon detail-chat" animate={{ y: [0, -5, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3.1, repeat: Infinity }}>
            <MessageCircle size={23} />
          </motion.span>
          <img className="ticket-detail-technician" src={technicianCharacter} alt="Técnico de soporte" />
          <div className="ticket-detail-header-quote"><Sparkles size={14} /><span>“Diagnóstico claro,</span><strong>reparación segura”</strong></div>
        </div>

        <div className="ticket-detail-header-tools">
          <button type="button" onClick={handleCopyTicket} title="Copiar número"><Copy size={15} /></button>
          <button type="button" className="ticket-header-print" onClick={handlePrint}><Printer size={15} /><span>Imprimir</span></button>
        </div>
      </motion.header>

      <section className="ticket-detail-kpis">
        <article>
          <div className="ticket-detail-kpi-icon violet"><UserRound size={22} /></div>
          <div><span>Cliente</span><strong>{ticket.cliente || "Sin cliente"}</strong><small>{ticket.clienteId || "Cliente particular"}</small></div>
        </article>
        <article>
          <div className="ticket-detail-kpi-icon blue"><Cpu size={22} /></div>
          <div><span>Equipo</span><strong>{ticket.equipo || "Sin especificar"}</strong><small>{[ticket.marca, ticket.modelo].filter(Boolean).join(" ") || "Sin modelo"}</small></div>
        </article>
        <article>
          <div className="ticket-detail-kpi-icon green"><CircleDollarSign size={22} /></div>
          <div><span>Presupuesto</span><strong>{formatMoney(displayBudgetTotal)}</strong><small>{displayBudgetTotal > 0 ? "Estimado / actualizado" : "Pendiente"}</small></div>
        </article>
        <article>
          <div className="ticket-detail-kpi-icon purple"><CalendarDays size={22} /></div>
          <div><span>Fecha de ingreso</span><strong>{ticket.ingreso || "—"}</strong><small>{ticket.tipoServicio || "Servicio técnico"}</small></div>
        </article>
      </section>

      {/* =================================
          SHELL
      ================================= */}

      <section className="ticket-detail-shell">

        {/* =================================
            PRINCIPAL
        ================================= */}

        <div className="ticket-detail-primary">

          {/* HERO */}

          <motion.section
            className="ticket-detail-hero"

            initial={{
              opacity: 0,
              y: 10,
            }}

            animate={{
              opacity: 1,
              y: 0,
            }}
          >

            <div className="ticket-detail-hero-copy">

              <span className="ticket-detail-kicker">
                Equipo recibido · seguimiento técnico
              </span>

              <h2>
                {ticket.equipo ||
                  "Equipo sin especificar"}
              </h2>

              <p>
                {[
                  ticket.marca,
                  ticket.modelo,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  "Marca y modelo no informados"}
              </p>

            </div>

            <div className="ticket-detail-hero-id">

              <span>
                ID SERVICIO
              </span>

              <strong>
                #{ticket.id}
              </strong>

            </div>

          </motion.section>

          <section className="ticket-workflow" aria-label="Flujo del ticket">
            {WORKFLOW_STAGES.map((item, index) => {
              const isCurrent = index === workflowStageIndex;
              const isDone =
                workflowStageIndex >= 0 &&
                index < workflowStageIndex;

              return (
                <div
                  key={item.key}
                  className={`ticket-workflow-step ${
                    isDone ? "done" : ""
                  } ${isCurrent ? "current" : ""}`}
                >
                  <motion.span
                    className="ticket-workflow-marker"
                    animate={isCurrent ? { scale: [1, 1.16, 1], y: [0, -2, 0] } : {}}
                    transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      index + 1
                    )}
                  </motion.span>

                  <strong>{item.label}</strong>
                </div>
              );
            })}
          </section>

          {/* CLIENTE / EQUIPO */}

          <section className="ticket-summary-grid">

            <article className="ticket-summary-card">

              <div className="ticket-summary-card-heading">

                <div className="ticket-summary-icon">

                  <UserRound
                    size={18}
                  />

                </div>

                <div>

                  <span>
                    Cliente
                  </span>

                  <h3>
                    {ticket.cliente ||
                      "Sin cliente"}
                  </h3>

                </div>

              </div>

              <div className="ticket-summary-data">

                <div>

                  <span>
                    ID cliente
                  </span>

                  <strong>
                    {ticket.clienteId ||
                      "—"}
                  </strong>

                </div>


              </div>

            </article>

            <article className="ticket-summary-card">

              <div className="ticket-summary-card-heading">

                <div className="ticket-summary-icon equipment">

                  <Cpu
                    size={18}
                  />

                </div>

                <div>

                  <span>
                    Equipo
                  </span>

                  <h3>
                    {ticket.equipo ||
                      "Sin especificar"}
                  </h3>

                </div>

              </div>

              <div className="ticket-summary-data">

                <div>

                  <span>
                    Marca / modelo
                  </span>

                  <strong>
                    {[
                      ticket.marca,
                      ticket.modelo,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                      "—"}
                  </strong>

                </div>

                <div>

                  <span>
                    Serie
                  </span>

                  <strong>
                    {ticket.serie ||
                      "—"}
                  </strong>

                </div>

              </div>

            </article>

          </section>

          {/* FALLA */}

          <section className="ticket-content-card ticket-fault-card">

            <div className="ticket-content-heading">

              <div className="ticket-content-icon fault">

                <Wrench
                  size={18}
                />

              </div>

              <div>

                <span>
                  Motivo del ingreso
                </span>

                <h3>
                  Falla informada
                </h3>

              </div>

            </div>

            <p className="ticket-fault-text">
              {ticket.falla ||
                "No se registró una falla informada por el cliente."}
            </p>

            <div className="ticket-diagnostic-grid ticket-diagnostic-grid-locked">
              <article className={ticket.diagnosticoInicial ? "diagnosis-saved" : "diagnosis-pending"}>
                <Search size={18} />
                <div>
                  <span>Diagnóstico técnico principal</span>
                  {ticket.diagnosticoInicial ? (
                    <>
                      <strong>{ticket.diagnosticoInicial}</strong>
                      <small>Registrado una sola vez. Los avances siguientes van a la bitácora.</small>
                    </>
                  ) : (
                    <div className="ticket-diagnosis-entry">
                      <textarea
                        value={diagnosisDraft}
                        onChange={(event) => setDiagnosisDraft(event.target.value)}
                        placeholder="Escribí el diagnóstico definitivo del equipo..."
                        disabled={savingDiagnosis}
                      />
                      <button type="button" onClick={handleSaveDiagnosis} disabled={savingDiagnosis || !diagnosisDraft.trim()}>
                        <Save size={14} /> {savingDiagnosis ? "Guardando..." : "Guardar diagnóstico"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
              <article>
                <ClipboardList size={18} />
                <div>
                  <span>Observaciones visibles de ingreso</span>
                  <strong>{ticket.observacionesVisibles || ticket.condicion || "Sin observaciones adicionales"}</strong>
                </div>
              </article>
            </div>

          </section>

          {/* RECEPCIÓN */}

          <section className="ticket-content-card">

            <div className="ticket-content-heading">

              <div className="ticket-content-icon reception">

                <ShieldCheck
                  size={18}
                />

              </div>

              <div>

                <span>
                  Recepción
                </span>

                <h3>
                  Estado físico y accesorios
                </h3>

              </div>

            </div>

            <div className="ticket-reception-grid">

              <div>

                <span className="ticket-small-label">
                  Estado físico
                </span>

                <div className="ticket-chip-list">

                  {physicalState.length ? (
                    physicalState.map(
                      (
                        item
                      ) => (
                        <span
                          key={
                            item
                          }

                          className="ticket-chip"
                        >
                          {item}
                        </span>
                      )
                    )
                  ) : (
                    <span className="ticket-empty-inline">
                      Sin datos registrados
                    </span>
                  )}

                </div>

              </div>

              <div>

                <span className="ticket-small-label">
                  Accesorios
                </span>

                <div className="ticket-chip-list">

                  {accessories.length ? (
                    accessories.map(
                      (
                        item
                      ) => (
                        <span
                          key={
                            item
                          }

                          className="ticket-chip ticket-chip-blue"
                        >
                          {item}
                        </span>
                      )
                    )
                  ) : (
                    <span className="ticket-empty-inline">
                      Ninguno
                    </span>
                  )}

                </div>

              </div>

            </div>

            {ticket.condicion && (
              <div className="ticket-reception-observation">

                <span>
                  Observaciones
                </span>

                <p>
                  {ticket.condicion}
                </p>

              </div>
            )}

          </section>

          {/* =================================
              TABS
          ================================= */}

          <section className="ticket-tabs-card">

            <div className="ticket-tabs">

              <button
                type="button"

                className={
                  activeTab ===
                  "pieces"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setActiveTab(
                    "pieces"
                  )
                }
              >
                <Package
                  size={16}
                />

                Repuestos

                <span>
                  {pieces.length}
                </span>

              </button>

              <button
                type="button"

                className={
                  activeTab ===
                  "budget"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setActiveTab(
                    "budget"
                  )
                }
              >
                <CircleDollarSign
                  size={16}
                />

                Presupuesto

              </button>


              <button
                type="button"

                className={
                  activeTab ===
                  "history"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setActiveTab(
                    "history"
                  )
                }
              >
                <MessageSquareText
                  size={16}
                />

                Bitácora

                {history.length >
                  0 && (
                  <span>
                    {history.length}
                  </span>
                )}

              </button>

            </div>

            {/* =================================
                REPUESTOS
            ================================= */}

            {activeTab ===
              "pieces" && (
              <div className="ticket-tab-content">

                <div className="ticket-tab-heading">

                  <div>

                    <span>
                      Reparación
                    </span>

                    <h3>
                      Repuestos y servicios
                    </h3>

                    <p>
                      Piezas, insumos y trabajos utilizados.
                    </p>

                  </div>

                  <div className="ticket-tab-heading-right">


                    <strong className="ticket-tab-total">
                      {formatMoney(
                        piecesTotal
                      )}
                    </strong>

                  </div>

                </div>


                <div className="ticket-piece-form">

                  <label className="ticket-piece-field ticket-piece-name">

                    <span>
                      Descripción
                    </span>

                    <input
                      type="text"

                      placeholder="Ej: SSD 480 GB"

                      value={
                        pieceForm.nombre
                      }

                      disabled={
                        addingPiece
                      }

                      onChange={(event) =>
                        setPieceForm(
                          (
                            current
                          ) => ({
                            ...current,

                            nombre:
                              event.target.value,
                          })
                        )
                      }
                    />

                  </label>

                  <label className="ticket-piece-field">

                    <span>
                      SKU
                    </span>

                    <input
                      type="text"

                      placeholder="Opcional"

                      value={
                        pieceForm.sku
                      }

                      disabled={
                        addingPiece
                      }

                      onChange={(event) =>
                        setPieceForm(
                          (
                            current
                          ) => ({
                            ...current,

                            sku:
                              event.target.value,
                          })
                        )
                      }
                    />

                  </label>

                  <label className="ticket-piece-field">

                    <span>
                      Cant.
                    </span>

                    <input
                      type="number"

                      min="1"

                      value={
                        pieceForm.cant
                      }

                      disabled={
                        addingPiece
                      }

                      onChange={(event) =>
                        setPieceForm(
                          (
                            current
                          ) => ({
                            ...current,

                            cant:
                              event.target.value,
                          })
                        )
                      }
                    />

                  </label>

                  <label className="ticket-piece-field">

                    <span>
                      Precio
                    </span>

                    <input
                      type="number"

                      min="0"

                      placeholder="0"

                      value={
                        pieceForm.costo
                      }

                      disabled={
                        addingPiece
                      }

                      onChange={(event) =>
                        setPieceForm(
                          (
                            current
                          ) => ({
                            ...current,

                            costo:
                              event.target.value,
                          })
                        )
                      }
                    />

                  </label>

                  <button
                    type="button"

                    className="ticket-piece-add"

                    disabled={
                      addingPiece
                    }

                    onClick={
                      handleAddPiece
                    }
                  >
                    <Plus
                      size={17}
                    />

                    {addingPiece
                      ? "Agregando..."
                      : "Agregar"}
                  </button>

                </div>

                {pieces.length ===
                0 ? (
                  <div className="ticket-tab-empty">

                    <Package
                      size={24}
                    />

                    <strong>
                      Todavía no hay ítems
                    </strong>

                    <span>
                      Agregá un repuesto o servicio para comenzar.
                    </span>

                  </div>
                ) : (
                  <div className="ticket-pieces-table-wrapper">

                    <table className="ticket-pieces-table">

                      <thead>

                        <tr>

                          <th>
                            Descripción
                          </th>

                          <th>
                            SKU
                          </th>

                          <th>
                            Cant.
                          </th>

                          <th>
                            Precio
                          </th>

                          <th>
                            Subtotal
                          </th>

                          <th />

                        </tr>

                      </thead>

                      <tbody>

                        {pieces.map(
                          (
                            piece,
                            index
                          ) => {
                            const isEditing =
                              editingPieceIndex ===
                              index;

                            const quantity =
                              isEditing
                                ? Number(
                                    editingPiece?.cant ||
                                      0
                                  )
                                : Number(
                                    piece.cant ||
                                      0
                                  );

                            const price =
                              isEditing
                                ? Number(
                                    editingPiece?.costo ||
                                      0
                                  )
                                : Number(
                                    piece.costo ||
                                      0
                                  );

                            return (
                              <tr
                                key={
                                  piece.sku ||
                                  `${piece.nombre}-${index}`
                                }
                              >

                                <td>

                                  {isEditing ? (
                                    <input
                                      value={
                                        editingPiece?.nombre ||
                                        ""
                                      }

                                      onChange={(event) =>
                                        setEditingPiece(
                                          (
                                            current
                                          ) => ({
                                            ...current,

                                            nombre:
                                              event.target.value,
                                          })
                                        )
                                      }
                                    />
                                  ) : (
                                    <strong>
                                      {piece.nombre ||
                                        "Ítem"}
                                    </strong>
                                  )}

                                </td>

                                <td>

                                  {isEditing ? (
                                    <input
                                      value={
                                        editingPiece?.sku ||
                                        ""
                                      }

                                      onChange={(event) =>
                                        setEditingPiece(
                                          (
                                            current
                                          ) => ({
                                            ...current,

                                            sku:
                                              event.target.value,
                                          })
                                        )
                                      }
                                    />
                                  ) : (
                                    piece.sku ||
                                    "—"
                                  )}

                                </td>

                                <td>

                                  {isEditing ? (
                                    <input
                                      type="number"

                                      min="1"

                                      value={
                                        editingPiece?.cant ??
                                        1
                                      }

                                      onChange={(event) =>
                                        setEditingPiece(
                                          (
                                            current
                                          ) => ({
                                            ...current,

                                            cant:
                                              event.target.value,
                                          })
                                        )
                                      }
                                    />
                                  ) : (
                                    quantity
                                  )}

                                </td>

                                <td>

                                  {isEditing ? (
                                    <input
                                      type="number"

                                      min="0"

                                      value={
                                        editingPiece?.costo ??
                                        0
                                      }

                                      onChange={(event) =>
                                        setEditingPiece(
                                          (
                                            current
                                          ) => ({
                                            ...current,

                                            costo:
                                              event.target.value,
                                          })
                                        )
                                      }
                                    />
                                  ) : (
                                    formatMoney(
                                      price
                                    )
                                  )}

                                </td>

                                <td>

                                  <strong>
                                    {formatMoney(
                                      quantity *
                                        price
                                    )}
                                  </strong>

                                </td>

                                <td>

                                  <div className="ticket-piece-actions">

                                    {isEditing ? (
                                      <>

                                        <button
                                          type="button"

                                          className="save"

                                          disabled={
                                            savingPiece
                                          }

                                          onClick={
                                            handleSavePiece
                                          }

                                          title="Guardar"
                                        >
                                          <Save
                                            size={15}
                                          />
                                        </button>

                                        <button
                                          type="button"

                                          disabled={
                                            savingPiece
                                          }

                                          onClick={
                                            cancelPieceEdit
                                          }

                                          title="Cancelar"
                                        >
                                          <X
                                            size={15}
                                          />
                                        </button>

                                      </>
                                    ) : (
                                      <>

                                        <button
                                          type="button"

                                          disabled={
                                            editingPieceIndex !==
                                              null
                                          }

                                          onClick={() =>
                                            startPieceEdit(
                                              piece,
                                              index
                                            )
                                          }

                                          title="Editar"
                                        >
                                          <Pencil
                                            size={14}
                                          />
                                        </button>

                                        <button
                                          type="button"

                                          className="delete"

                                          disabled={
                                            deletingPieceIndex ===
                                              index
                                          }

                                          onClick={() =>
                                            handleRemovePiece(
                                              piece,
                                              index
                                            )
                                          }

                                          title="Eliminar"
                                        >
                                          <Trash2
                                            size={14}
                                          />
                                        </button>

                                      </>
                                    )}

                                  </div>

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

              </div>
            )}

            {/* =================================
                PRESUPUESTO
            ================================= */}

            {activeTab ===
              "budget" && (
              <div className="ticket-tab-content">

                <div className="ticket-tab-heading ticket-budget-heading">

                  <div>

                    <span>
                      Presupuesto
                    </span>

                    <h3>
                      Resumen económico
                    </h3>

                    <p>
                      Apartado económico del servicio.
                    </p>

                  </div>


                </div>

                <div className="ticket-budget-compact">

                  {/* REPUESTOS */}

                  <div className="ticket-budget-line">

                    <span>
                      Repuestos / servicios
                    </span>

                    <strong>
                      {formatMoney(
                        piecesTotal
                      )}
                    </strong>

                  </div>

                  {/* MANO DE OBRA */}

                  <div className="ticket-budget-line ticket-budget-input-line">

                    <label htmlFor="ticket-budget-labor">
                      Mano de obra
                    </label>

                    <div className="ticket-money-input">

                      <span>
                        $
                      </span>

                      <input
                        id="ticket-budget-labor"

                        type="number"

                        min="0"

                        step="1"

                        value={
                          budgetLabor
                        }

                        disabled={
                          savingBudget
                        }

                        onChange={
                          handleLaborChange
                        }
                      />

                    </div>

                  </div>

                  {/* SUBTOTAL */}

                  <div className="ticket-budget-line">

                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {formatMoney(
                        budgetSubtotal
                      )}
                    </strong>

                  </div>

                  {/* DESCUENTO */}

                  <div className="ticket-budget-line ticket-budget-input-line">

                    <label htmlFor="ticket-budget-discount">
                      Descuento
                    </label>

                    <div className="ticket-discount-input">

                      <input
                        id="ticket-budget-discount"

                        type="number"

                        min="0"

                        max="100"

                        step="1"

                        value={
                          budgetDiscount
                        }

                        disabled={
                          savingBudget
                        }

                        onChange={
                          handleDiscountChange
                        }
                      />

                      <span>
                        %
                      </span>

                    </div>

                  </div>

                  {/* DESCUENTO IMPORTE */}

                  {safeDiscount >
                    0 && (
                    <div className="ticket-budget-line ticket-budget-discount-value">

                      <span>
                        Descuento aplicado
                      </span>

                      <strong>
                        -{" "}
                        {formatMoney(
                          budgetDiscountAmount
                        )}
                      </strong>

                    </div>
                  )}

                  <div className="ticket-budget-divider" />

                  {/* TOTAL */}

                  <div className="ticket-budget-line ticket-budget-total">

                    <span>
                      Total
                    </span>

                    <strong>
                      {formatMoney(
                        budgetTotal
                      )}
                    </strong>

                  </div>

                  <div className="ticket-budget-status-row">

                    <span>
                      Los cambios quedan registrados en la bitácora.
                    </span>

                    <button
                      type="button"
                      className="ticket-budget-fix-button"
                      disabled={
                        savingBudget
                      }
                      onClick={
                        handleSaveBudget
                      }
                    >
                      <Save
                        size={14}
                      />

                      {savingBudget
                        ? "Guardando..."
                        : "Guardar presupuesto"}
                    </button>

                  </div>

                </div>

              </div>
            )}

            {/* =================================
                BITÁCORA
            ================================= */}

            {activeTab ===
              "history" && (
              <div className="ticket-tab-content">

                <div className="ticket-tab-heading">

                  <div>

                    <span>
                      Historial
                    </span>

                    <h3>
                      Bitácora del ticket
                    </h3>

                    <p>
                      Eventos automáticos y observaciones internas.
                    </p>

                  </div>

                </div>

                <div className="ticket-note-box">

                  <div className="ticket-note-heading">

                    <MessageSquareText
                      size={17}
                    />

                    <strong>
                      Agregar nota
                    </strong>

                  </div>

                  <textarea
                    value={
                      note
                    }

                    disabled={
                      savingNote
                    }

                    placeholder="Ej: Cliente informado sobre el avance del trabajo..."

                    onChange={(event) =>
                      setNote(
                        event.target.value
                      )
                    }
                  />

                  <div>

                    <small>
                      {note.length} caracteres
                    </small>

                    <button
                      type="button"

                      disabled={
                        savingNote
                      }

                      onClick={
                        handleAddNote
                      }
                    >
                      <Plus
                        size={15}
                      />

                      {savingNote
                        ? "Agregando..."
                        : "Agregar a bitácora"}
                    </button>

                  </div>

                </div>

                {history.length ===
                0 ? (
                  <div className="ticket-tab-empty">

                    <Clock3
                      size={25}
                    />

                    <strong>
                      Sin actividad
                    </strong>

                    <span>
                      Todavía no hay eventos registrados.
                    </span>

                  </div>
                ) : (
                  <div className="ticket-history">

                    {history.map(
                      (
                        event,
                        index
                      ) => (
                        <article
                          key={
                            `${event.fecha || "evento"}-${index}`
                          }

                          className="ticket-history-item"
                        >

                          <div className="ticket-history-line">

                            <div className="ticket-history-dot" />

                          </div>

                          <div className="ticket-history-content">

                            <div className="ticket-history-heading">

                              <strong>
                                {event.accion ||
                                  "Actividad"}
                              </strong>

                              <span>
                                {event.fecha ||
                                  "—"}
                              </span>

                            </div>

                            {event.detalle && (
                              <p>
                                {event.detalle}
                              </p>
                            )}

                            <small>
                              {event.autor ||
                                "Sistema"}
                            </small>

                          </div>

                        </article>
                      )
                    )}

                  </div>
                )}

              </div>
            )}

          </section>

        </div>

        {/* =================================
            SIDEBAR
        ================================= */}

        <aside className="ticket-detail-sidebar">

          <div className="ticket-sidebar-sticky">

            {/* ESTADO */}

            <section className="ticket-sidebar-card ticket-sidebar-status">

              <div className="ticket-sidebar-heading">

                <div>

                  <span>
                    Flujo de trabajo
                  </span>

                  <h3>
                    Estado
                  </h3>

                </div>

                <CheckCircle2
                  size={20}
                />

              </div>

              <select
                value={
                  selectedStage
                }

                disabled={
                  savingStage
                }

                onChange={(event) =>
                  setSelectedStage(
                    event.target.value
                  )
                }
              >

                {Object.entries(
                  STAGES
                ).map(
                  ([
                    key,
                    item,
                  ]) => (
                    <option
                      key={
                        key
                      }

                      value={
                        key
                      }
                    >
                      {item.label}
                    </option>
                  )
                )}

              </select>

              <button
                type="button"

                className="ticket-sidebar-main-button"

                disabled={
                  savingStage
                }

                onClick={
                  handleStageChange
                }
              >
                <Save
                  size={16}
                />

                {savingStage
                  ? "Aplicando..."
                  : "Aplicar estado"}
              </button>

            </section>

            {/* RESUMEN */}

            <section className="ticket-sidebar-card">

              <div className="ticket-sidebar-heading">

                <div>

                  <span>
                    Servicio
                  </span>

                  <h3>
                    Resumen
                  </h3>

                </div>

              </div>

              <div className="ticket-sidebar-info">

                <div>

                  <CalendarDays
                    size={15}
                  />

                  <span>
                    Ingreso
                  </span>

                  <strong>
                    {ticket.ingreso ||
                      "—"}
                  </strong>

                </div>

                <div>

                  <Tag
                    size={15}
                  />

                  <span>
                    Prioridad
                  </span>

                  <strong>
                    {ticket.prioridad ||
                      "P2"}
                  </strong>

                </div>

              </div>

            </section>

            {/* PRESUPUESTO PEQUEÑO */}

            <section className="ticket-sidebar-card ticket-sidebar-budget-small">

              <div className="ticket-budget-small-top">

                <div>

                  <span>
                    Presupuesto
                  </span>

                  <strong>
                    {formatMoney(
                      displayBudgetTotal
                    )}
                  </strong>

                </div>

                <CircleDollarSign
                  size={17}
                />

              </div>

              <div className="ticket-budget-small-meta">

                <div>

                  {safeDiscount >
                    0 && (
                    <span>
                      {safeDiscount}% desc.
                    </span>
                  )}


                </div>

                <button
                  type="button"

                  onClick={() =>
                    setActiveTab(
                      "budget"
                    )
                  }
                >
                  Ver detalle
                </button>

              </div>

            </section>

            {/* GARANTÍA */}

            <section className="ticket-sidebar-card">

              <div className="ticket-sidebar-heading">

                <div>

                  <span>
                    Postservicio
                  </span>

                  <h3>
                    Garantía
                  </h3>

                </div>

                <ShieldCheck
                  size={19}
                />

              </div>

              <div className="ticket-warranty-data">

                <div>

                  <span>
                    Días
                  </span>

                  <strong>
                    {ticket.garantiaDias ??
                      30}
                  </strong>

                </div>

                <div>

                  <span>
                    Vencimiento
                  </span>

                  <strong>
                    {ticket.garantiaVencimiento ||
                      "No activa"}
                  </strong>

                </div>

              </div>

            </section>

            {/* ACCIONES */}

            <section className="ticket-sidebar-card">

              <div className="ticket-sidebar-heading">

                <div>

                  <span>
                    Herramientas
                  </span>

                  <h3>
                    Acciones rápidas
                  </h3>

                </div>

              </div>

              <div className="ticket-quick-actions">

                <button
                  type="button"

                  onClick={
                    handlePrint
                  }
                >
                  <Printer
                    size={16}
                  />

                  Imprimir ticket
                </button>

                <button
                  type="button"

                  onClick={
                    handleCopyTicket
                  }
                >
                  <Copy
                    size={16}
                  />

                  Copiar número
                </button>

                <button
                  type="button"

                  className="ticket-cash-action"

                  disabled={
                    sendingToCash ||
                    cancellingCashPending ||
                    (!canSendToCash && !cashPending)
                  }

                  onClick={
                    cashPending
                      ? handleCancelCashPending
                      : handleSendToCash
                  }
                >
                  <WalletCards
                    size={16}
                  />

                  {sendingToCash
                    ? "Enviando a Caja..."
                    : cancellingCashPending
                      ? "Cancelando envío..."
                      : cashPending
                        ? "Cancelar envío a Caja"
                      : cashFinanced
                        ? "Financiado / facturado"
                        : cashPaid ||
                            alreadyBilled
                          ? "Cobrado / facturado"
                          : "Enviar a Caja"}
                </button>


                <button
                  type="button"

                  onClick={() =>
                    setActiveTab(
                      "history"
                    )
                  }
                >
                  <MessageSquareText
                    size={16}
                  />

                  Ver bitácora
                </button>

              </div>

            </section>

          </div>

        </aside>

      </section>

    </main>
  );
}