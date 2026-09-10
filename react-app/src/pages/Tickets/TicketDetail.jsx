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
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy,
  Cpu,
  HardDrive,
  LockKeyhole,
  MessageSquareText,
  Package,
  Pencil,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Tag,
  Trash2,
  UnlockKeyhole,
  UserRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

import {
  addTicketNote,
  addTicketPiece,
  fixTicketBudget,
  removeTicketPiece,
  subscribeToTicket,
  unlockTicketBudget,
  updateTicketDiagnosis,
  updateTicketPiece,
  updateTicketStage,
} from "../../services/tickets.service.js";

import {
  sendTicketToCash,
} from "../../services/caja-pendientes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import "./TicketDetail.css";

/* =========================================
   ESTADOS
========================================= */

const STAGES = {
  pendiente: {
    label: "Recibido",
    className: "detail-stage-pending",
  },

  diagnostico: {
    label: "En diagnóstico",
    className: "detail-stage-diagnostic",
  },

  presupuesto: {
    label: "Esperando aprobación",
    className: "detail-stage-budget",
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
      maximumFractionDigits: 0,
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

  /* =======================================
     DIAGNÓSTICO
  ======================================= */

  const [
    diagnosis,
    setDiagnosis,
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

  const [
    unlockingBudget,
    setUnlockingBudget,
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
     SINCRONIZAR DIAGNÓSTICO
  ======================================= */

  useEffect(() => {
    if (!ticket) {
      return;
    }

    setDiagnosis(
      ticket.diagnostico ||
        ""
    );
  }, [
    ticket?.diagnostico,
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

  const budgetLocked =
    ticket?.presupuestoFijado ===
    true;

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

  const photos =
    useMemo(() => {
      return Array.isArray(
        ticket?.fotos
      )
        ? ticket.fotos
        : [];
    }, [
      ticket?.fotos,
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

  const persistedBudgetTotal =
    Number(
      ticket?.presupuestoEstimado ||
        0
    );

  const displayedBudgetTotal =
    budgetLocked
      ? persistedBudgetTotal
      : budgetTotal;

  /* =======================================
     CAJA / FACTURACIÓN
  ======================================= */

  const budgetAccepted =
    ticket?.presupuestoAprobado ===
      true ||
    ticket?.presupuestoEstado ===
      "Aceptado";

  const cashPending =
    ticket?.estadoCaja ===
    "Pendiente";

  const cashPaid =
    ticket?.estadoCaja ===
      "Cobrado" ||
    ticket?.estadoPago ===
      "Pagado";

  const alreadyBilled =
    Boolean(
      ticket?.estadoFacturacion &&
      ticket.estadoFacturacion !==
        "No facturado"
    );

  const canSendToCash =
    ticket?.stage ===
      "listo" &&
    budgetAccepted &&
    !cashPending &&
    !cashPaid &&
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

        notify.error(
          "No se pudo cambiar el estado",
          "Firestore rechazó la actualización."
        );
      } finally {
        setSavingStage(
          false
        );
      }
    };

  /* =======================================
     DIAGNÓSTICO
  ======================================= */

  const handleSaveDiagnosis =
    async () => {
      const cleanDiagnosis =
        diagnosis.trim();

      if (!cleanDiagnosis) {
        notify.warning(
          "Diagnóstico vacío",
          "Escribí el diagnóstico antes de guardar."
        );

        return;
      }

      if (
        cleanDiagnosis ===
        String(
          ticket?.diagnostico ||
            ""
        ).trim()
      ) {
        notify.info(
          "Sin cambios",
          "El diagnóstico no fue modificado."
        );

        return;
      }

      try {
        setSavingDiagnosis(
          true
        );

        await updateTicketDiagnosis(
          ticket.id,
          cleanDiagnosis,
          author
        );

        notify.success(
          "Diagnóstico guardado",
          `El diagnóstico del ticket #${ticket.id} fue actualizado.`
        );
      } catch (
        diagnosisError
      ) {
        console.error(
          diagnosisError
        );

        notify.error(
          "No se pudo guardar",
          "Ocurrió un error al actualizar el diagnóstico."
        );
      } finally {
        setSavingDiagnosis(
          false
        );
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
      if (
        budgetLocked
      ) {
        notify.warning(
          "Presupuesto bloqueado",
          "Desbloqueá el presupuesto antes de modificar sus ítems."
        );

        setActiveTab(
          "budget"
        );

        return;
      }

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
      if (
        budgetLocked
      ) {
        notify.warning(
          "Presupuesto bloqueado",
          "Desbloquealo antes de editar repuestos o servicios."
        );

        setActiveTab(
          "budget"
        );

        return;
      }

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
        budgetLocked
      ) {
        notify.warning(
          "Presupuesto bloqueado",
          "Desbloquealo antes de modificar los ítems."
        );

        return;
      }

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
      if (
        budgetLocked
      ) {
        notify.warning(
          "Presupuesto bloqueado",
          "Desbloquealo antes de eliminar ítems."
        );

        setActiveTab(
          "budget"
        );

        return;
      }

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
     FIJAR PRESUPUESTO
  ======================================= */

  const handleFixBudget =
    async () => {
      if (
        budgetLocked
      ) {
        notify.info(
          "Presupuesto fijado",
          "Desbloquealo antes de modificarlo."
        );

        return;
      }

      if (
        budgetSubtotal <=
        0
      ) {
        notify.warning(
          "Presupuesto vacío",
          "Agregá al menos un repuesto, servicio o importe de mano de obra."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `¿Fijar el presupuesto del ticket #${ticket.id} en ${formatMoney(budgetTotal)}?`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setSavingBudget(
          true
        );

        const result =
          await fixTicketBudget(
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
          "Presupuesto fijado",
          `Total final: ${formatMoney(result.total)}`
        );
      } catch (
        budgetError
      ) {
        console.error(
          budgetError
        );

        if (
          budgetError?.message ===
          "BUDGET_EMPTY"
        ) {
          notify.warning(
            "Presupuesto vacío",
            "No hay importes suficientes para fijar el presupuesto."
          );

          return;
        }

        if (
          budgetError?.message ===
          "BUDGET_LOCKED"
        ) {
          notify.warning(
            "Presupuesto bloqueado",
            "Este presupuesto ya se encuentra fijado."
          );

          return;
        }

        notify.error(
          "No se pudo fijar",
          "Ocurrió un error al guardar el presupuesto."
        );
      } finally {
        setSavingBudget(
          false
        );
      }
    };

  /* =======================================
     DESBLOQUEAR PRESUPUESTO
  ======================================= */

  const handleUnlockBudget =
    async () => {
      if (
        !budgetLocked
      ) {
        notify.info(
          "Presupuesto editable",
          "El presupuesto ya está desbloqueado."
        );

        return;
      }

      const confirmed =
        window.confirm(
          "¿Desbloquear el presupuesto? Si fue aprobado anteriormente, esa aprobación dejará de ser válida."
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setUnlockingBudget(
          true
        );

        const result =
          await unlockTicketBudget(
            ticket.id,
            author
          );

        if (
          !result.changed
        ) {
          notify.info(
            "Sin cambios",
            "El presupuesto ya estaba desbloqueado."
          );

          return;
        }

        notify.success(
          "Presupuesto desbloqueado",
          "Ya podés modificar importes, descuento y repuestos."
        );
      } catch (
        unlockError
      ) {
        console.error(
          unlockError
        );

        notify.error(
          "No se pudo desbloquear",
          "Ocurrió un error al modificar el presupuesto."
        );
      } finally {
        setUnlockingBudget(
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

      const confirmed =
        window.confirm(
          `¿Enviar ${ticket.id} a Caja?\n\n` +
            `Total a cobrar: ${formatMoney(
              displayedBudgetTotal
            )}`
        );

      if (!confirmed) {
        return;
      }

      try {
        setSendingToCash(
          true
        );

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

        navigate(
          "/caja"
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

          TICKET_NOT_READY:
            "El ticket debe estar en Listo para entrega antes de pasar a Caja.",

          BUDGET_NOT_ACCEPTED:
            "El presupuesto debe estar aceptado antes de cobrar.",

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
        className="ticket-detail-header"

        initial={{
          opacity: 0,
          y: -8,
        }}

        animate={{
          opacity: 1,
          y: 0,
        }}
      >

        <div className="ticket-detail-header-left">

          <button
            type="button"

            className="ticket-detail-back"

            onClick={handleBack}
          >
            <ArrowLeft
              size={18}
            />
          </button>

          <div className="ticket-detail-header-symbol">

            <ClipboardList
              size={20}
            />

          </div>

          <div className="ticket-detail-title">

            <span>
              Orden de servicio
            </span>

            <div>

              <h1>
                Ticket #{ticket.id}
              </h1>

              <button
                type="button"

                onClick={
                  handleCopyTicket
                }

                title="Copiar número"
              >
                <Copy
                  size={13}
                />
              </button>

            </div>

          </div>

        </div>

        <div className="ticket-detail-header-right">

          <span
            className={
              `ticket-detail-stage ${stage.className}`
            }
          >
            {stage.label}
          </span>

          <button
            type="button"

            className="ticket-header-print"

            onClick={
              handlePrint
            }
          >
            <Printer
              size={16}
            />

            <span>
              Imprimir
            </span>
          </button>

        </div>

      </motion.header>

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
                Equipo recibido
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

                <div>

                  <span>
                    Técnico
                  </span>

                  <strong>
                    {ticket.tecnico ||
                      "Sin asignar"}
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

          </section>

          {/* DIAGNÓSTICO */}

          <section className="ticket-content-card">

            <div className="ticket-content-heading">

              <div className="ticket-content-icon diagnosis">

                <HardDrive
                  size={18}
                />

              </div>

              <div>

                <span>
                  Trabajo técnico
                </span>

                <h3>
                  Diagnóstico
                </h3>

              </div>

            </div>

            <textarea
              className="ticket-diagnosis-textarea"

              value={
                diagnosis
              }

              disabled={
                savingDiagnosis
              }

              placeholder="Describí el diagnóstico técnico..."

              onChange={(event) =>
                setDiagnosis(
                  event.target.value
                )
              }
            />

            <div className="ticket-content-action-row">

              <small>
                {diagnosis.length} caracteres
              </small>

              <button
                type="button"

                className="ticket-primary-action"

                disabled={
                  savingDiagnosis
                }

                onClick={
                  handleSaveDiagnosis
                }
              >
                <Save
                  size={16}
                />

                {savingDiagnosis
                  ? "Guardando..."
                  : "Guardar diagnóstico"}
              </button>

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
                  "photos"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setActiveTab(
                    "photos"
                  )
                }
              >
                <Camera
                  size={16}
                />

                Fotos

                {photos.length >
                  0 && (
                  <span>
                    {photos.length}
                  </span>
                )}

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

                    {budgetLocked && (
                      <span className="ticket-budget-lock-badge">
                        <LockKeyhole
                          size={12}
                        />

                        Bloqueado
                      </span>
                    )}

                    <strong className="ticket-tab-total">
                      {formatMoney(
                        piecesTotal
                      )}
                    </strong>

                  </div>

                </div>

                {budgetLocked && (
                  <div className="ticket-budget-locked-notice">

                    <LockKeyhole
                      size={16}
                    />

                    <span>
                      El presupuesto está fijado. Desbloquealo para modificar repuestos o servicios.
                    </span>

                    <button
                      type="button"

                      onClick={() =>
                        setActiveTab(
                          "budget"
                        )
                      }
                    >
                      Ir al presupuesto
                    </button>

                  </div>
                )}

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
                        addingPiece ||
                        budgetLocked
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
                        addingPiece ||
                        budgetLocked
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
                        addingPiece ||
                        budgetLocked
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
                        addingPiece ||
                        budgetLocked
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
                      addingPiece ||
                      budgetLocked
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
                                            budgetLocked ||
                                            editingPieceIndex !==
                                              null
                                          }

                                          onClick={() =>
                                            startPieceEdit(
                                              piece,
                                              index
                                            )
                                          }

                                          title={
                                            budgetLocked
                                              ? "Presupuesto bloqueado"
                                              : "Editar"
                                          }
                                        >
                                          <Pencil
                                            size={14}
                                          />
                                        </button>

                                        <button
                                          type="button"

                                          className="delete"

                                          disabled={
                                            budgetLocked ||
                                            deletingPieceIndex ===
                                              index
                                          }

                                          onClick={() =>
                                            handleRemovePiece(
                                              piece,
                                              index
                                            )
                                          }

                                          title={
                                            budgetLocked
                                              ? "Presupuesto bloqueado"
                                              : "Eliminar"
                                          }
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

                  {budgetLocked && (
                    <span className="ticket-budget-lock-badge">
                      <LockKeyhole
                        size={12}
                      />

                      Fijado
                    </span>
                  )}

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
                          budgetLocked ||
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
                          budgetLocked ||
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
                        displayedBudgetTotal
                      )}
                    </strong>

                  </div>

                  {/* ESTADO */}

                  <div className="ticket-budget-status-row">

                    <div>

                      {budgetLocked ? (
                        <>
                          <LockKeyhole
                            size={14}
                          />

                          <span>
                            Presupuesto fijado
                          </span>
                        </>
                      ) : (
                        <>
                          <UnlockKeyhole
                            size={14}
                          />

                          <span>
                            Presupuesto editable
                          </span>
                        </>
                      )}

                    </div>

                    {budgetLocked ? (
                      <button
                        type="button"

                        className="ticket-budget-unlock-button"

                        disabled={
                          unlockingBudget
                        }

                        onClick={
                          handleUnlockBudget
                        }
                      >
                        <UnlockKeyhole
                          size={14}
                        />

                        {unlockingBudget
                          ? "Desbloqueando..."
                          : "Desbloquear"}
                      </button>
                    ) : (
                      <button
                        type="button"

                        className="ticket-budget-fix-button"

                        disabled={
                          savingBudget
                        }

                        onClick={
                          handleFixBudget
                        }
                      >
                        <LockKeyhole
                          size={14}
                        />

                        {savingBudget
                          ? "Fijando..."
                          : "Fijar presupuesto"}
                      </button>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* =================================
                FOTOS
            ================================= */}

            {activeTab ===
              "photos" && (
              <div className="ticket-tab-content">

                <div className="ticket-tab-heading">

                  <div>

                    <span>
                      Evidencia
                    </span>

                    <h3>
                      Fotografías
                    </h3>

                    <p>
                      Registro visual asociado al equipo.
                    </p>

                  </div>

                </div>

                {photos.length ===
                0 ? (
                  <div className="ticket-tab-empty">

                    <Camera
                      size={25}
                    />

                    <strong>
                      Sin fotografías
                    </strong>

                    <span>
                      Este ticket todavía no tiene imágenes registradas.
                    </span>

                  </div>
                ) : (
                  <div className="ticket-photo-grid">

                    {photos.map(
                      (
                        url,
                        index
                      ) => (
                        <a
                          key={
                            `${url}-${index}`
                          }

                          href={
                            url
                          }

                          target="_blank"

                          rel="noreferrer"
                        >
                          <img
                            src={
                              url
                            }

                            alt={
                              `Ticket ${ticket.id} - ${index + 1}`
                            }
                          />

                          <span>
                            Foto {index + 1}
                          </span>

                        </a>
                      )
                    )}

                  </div>
                )}

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

                <div>

                  <UserRound
                    size={15}
                  />

                  <span>
                    Técnico
                  </span>

                  <strong>
                    {ticket.tecnico ||
                      "Sin asignar"}
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
                      displayedBudgetTotal
                    )}
                  </strong>

                </div>

                {budgetLocked ? (
                  <LockKeyhole
                    size={16}
                  />
                ) : (
                  <CircleDollarSign
                    size={17}
                  />
                )}

              </div>

              <div className="ticket-budget-small-meta">

                <div>

                  {safeDiscount >
                    0 && (
                    <span>
                      {safeDiscount}% desc.
                    </span>
                  )}

                  {budgetLocked && (
                    <span className="ticket-budget-fixed-label">
                      Fijado
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
                    !canSendToCash
                  }

                  onClick={
                    handleSendToCash
                  }
                >
                  <WalletCards
                    size={16}
                  />

                  {sendingToCash
                    ? "Enviando a Caja..."
                    : cashPending
                      ? "Pendiente en Caja"
                      : cashPaid ||
                          alreadyBilled
                        ? "Cobrado / facturado"
                        : "Enviar a Caja"}
                </button>

                {!canSendToCash &&
                  !cashPending &&
                  !cashPaid &&
                  !alreadyBilled && (
                  <small className="ticket-cash-hint">
                    {!budgetAccepted
                      ? "Primero debe aceptarse el presupuesto."
                      : ticket?.stage !==
                          "listo"
                        ? "Disponible cuando el ticket esté Listo para entrega."
                        : ""}
                  </small>
                )}

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