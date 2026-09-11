import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";

import {
  db,
} from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function formatDateTimeAR(date) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function normalizeItem(item) {
  const description =
    cleanText(
      item?.descripcion ||
      item?.desc ||
      item?.nombre ||
      item?.concepto
    ) ||
    "Servicio";

  const quantity =
    Math.max(
      1,
      Number(
        item?.cantidad ??
        item?.cant ??
        1
      ) || 1
    );

  const price =
    Math.max(
      0,
      Number(
        item?.precio ??
        item?.costo ??
        0
      ) || 0
    );

  return {
    description,
    quantity,
    price,
    sku: cleanText(item?.sku),
    type: cleanText(item?.tipo),
  };
}

/* =========================================
   BUSCAR PENDIENTE EXISTENTE
========================================= */

async function findExistingPending(
  ticketId
) {
  const pendingQuery =
    query(
      collection(
        db,
        "caja_pendientes"
      ),

      where(
        "ref",
        "==",
        ticketId
      )
    );

  const snapshot =
    await getDocs(
      pendingQuery
    );

  return snapshot.docs.find(
    (documentSnapshot) => {
      const data =
        documentSnapshot.data();

      return (
        data?.origen ===
        "Ticket"
      );
    }
  );
}

/* =========================================
   ENVIAR TICKET A CAJA
========================================= */

export async function sendTicketToCash(
  ticketId,
  author = "Sistema"
) {
  const cleanTicketId =
    cleanText(
      ticketId
    );

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  if (!cleanTicketId) {
    throw new Error(
      "TICKET_ID_REQUIRED"
    );
  }

  /* =======================================
     EVITAR DUPLICADOS ANTIGUOS
  ======================================= */

  const existingPending =
    await findExistingPending(
      cleanTicketId
    );

  if (
    existingPending
  ) {
    throw new Error(
      "CASH_PENDING_EXISTS"
    );
  }

  /* =======================================
     REFERENCIAS
  ======================================= */

  const ticketRef =
    doc(
      db,
      "tickets",
      cleanTicketId
    );

  /*
   * Documento determinístico.
   * Así React nunca genera dos pendientes
   * para el mismo ticket.
   */

  const pendingId =
    `ticket_${cleanTicketId.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )}`;

  const pendingRef =
    doc(
      db,
      "caja_pendientes",
      pendingId
    );

  /* =======================================
     TRANSACCIÓN
  ======================================= */

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         TICKET
      ================================= */

      const ticketSnapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !ticketSnapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const ticket =
        ticketSnapshot.data();

      /* =================================
         PENDIENTE REACT
      ================================= */

      const pendingSnapshot =
        await transaction.get(
          pendingRef
        );

      if (
        pendingSnapshot.exists()
      ) {
        throw new Error(
          "CASH_PENDING_EXISTS"
        );
      }

      /* =================================
         VALIDAR ESTADO
      ================================= */

      if (
        ticket.stage !==
        "listo"
      ) {
        throw new Error(
          "TICKET_NOT_READY"
        );
      }

      const budgetAccepted =
        ticket.presupuestoAprobado ===
          true ||
        ticket.presupuestoEstado ===
          "Aceptado";

      if (
        !budgetAccepted
      ) {
        throw new Error(
          "BUDGET_NOT_ACCEPTED"
        );
      }

      if (
        ticket.estadoCaja ===
        "Pendiente"
      ) {
        throw new Error(
          "CASH_PENDING_EXISTS"
        );
      }

      if (
        ticket.estadoCaja ===
          "Cobrado" ||
        ticket.estadoPago ===
          "Pagado"
      ) {
        throw new Error(
          "TICKET_ALREADY_PAID"
        );
      }

      if (
        ticket.estadoFacturacion &&
        ticket.estadoFacturacion !==
          "No facturado"
      ) {
        throw new Error(
          "TICKET_ALREADY_BILLED"
        );
      }

      /* =================================
         PRESUPUESTO
      ================================= */

      let budget =
        null;

      let budgetRef =
        null;

      if (
        ticket.presupuestoId
      ) {
        budgetRef =
          doc(
            db,
            "presupuestos",
            ticket.presupuestoId
          );

        const budgetSnapshot =
          await transaction.get(
            budgetRef
          );

        if (
          budgetSnapshot.exists()
        ) {
          budget =
            budgetSnapshot.data();
        }
      }

      /* =================================
         VALIDAR PRESUPUESTO
      ================================= */

      if (
        budget &&
        budget.estado !==
          "Aceptado"
      ) {
        throw new Error(
          "BUDGET_NOT_ACCEPTED"
        );
      }

      if (
        budget?.estadoCaja ===
          "Pendiente"
      ) {
        throw new Error(
          "CASH_PENDING_EXISTS"
        );
      }

      if (
        budget?.estadoCaja ===
          "Cobrado"
      ) {
        throw new Error(
          "TICKET_ALREADY_PAID"
        );
      }

      /* =================================
         TOTAL
      ================================= */

      const total =
        Number(
          budget?.total ??
          ticket.presupuestoEstimado ??
          ticket.presupuestoTotal ??
          0
        ) ||
        0;

      if (
        total <= 0
      ) {
        throw new Error(
          "BUDGET_INVALID_TOTAL"
        );
      }

      /* =================================
         ITEMS DEL PRESUPUESTO
      ================================= */

      const budgetItems =
        Array.isArray(
          budget?.items
        )
          ? budget.items.map(
              normalizeItem
            )
          : [];

      const ticketItems =
        Array.isArray(
          ticket.piezas
        )
          ? ticket.piezas.map(
              normalizeItem
            )
          : [];

      const sourceItems =
        budgetItems.length >
        0
          ? budgetItems
          : ticketItems;

      const articulosCart =
        sourceItems.map(
          (item) => ({
            sku:
              item.sku ||
              null,

            nombre:
              item.description,

            cantidad:
              item.quantity,

            precio:
              item.price,
          })
        );

      let concepto =
        sourceItems
          .map(
            (item) =>
              `${item.quantity}x ${item.description}`
          )
          .join(", ");

      if (
        !concepto
      ) {
        concepto =
          `Presupuesto ${ticket.presupuestoId || cleanTicketId}`;
      }

      /* =================================
         FECHA
      ================================= */

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const historyDate =
        formatDateTimeAR(
          now
        );

      /* =================================
         PENDIENTE DE CAJA
      ================================= */

      const pendingData = {
        id:
          pendingId,

        origen:
          "Ticket",

        ref:
          cleanTicketId,

        ticketId:
          cleanTicketId,

        presupuestoId:
          ticket.presupuestoId ||
          null,

        clienteId:
          ticket.clienteId ||
          null,

        cliente:
          ticket.cliente ||
          "Mostrador",

        concepto,

        total,

        articulosCart,

        estado:
          "Pendiente",

        creadoEn:
          nowISO,

        actualizadoEn:
          nowISO,

        usuario:
          cleanAuthor,
      };

      transaction.set(
        pendingRef,
        pendingData
      );

      /* =================================
         HISTORIAL TICKET
      ================================= */

      const ticketHistory =
        Array.isArray(
          ticket.historial
        )
          ? ticket.historial
          : [];

      transaction.update(
        ticketRef,

        {
          estadoCaja:
            "Pendiente",

          cajaPendienteId:
            pendingId,

          enviadoCajaEn:
            nowISO,

          actualizadoEn:
            nowISO,

          historial: [
            ...ticketHistory,

            {
              accion:
                "Enviado a Caja",

              detalle:
                `Pendiente de cobro por $${total.toLocaleString(
                  "es-AR"
                )}. Presupuesto: ${
                  ticket.presupuestoId ||
                  "—"
                }`,

              fecha:
                historyDate,

              autor:
                cleanAuthor,
            },
          ],
        }
      );

      /* =================================
         PRESUPUESTO
      ================================= */

      if (
        budget &&
        budgetRef
      ) {
        const budgetHistory =
          Array.isArray(
            budget.historial
          )
            ? budget.historial
            : [];

        transaction.update(
          budgetRef,

          {
            estadoCaja:
              "Pendiente",

            cajaPendienteId:
              pendingId,

            actualizadoEn:
              nowISO,

            historial: [
              ...budgetHistory,

              {
                fecha:
                  historyDate,

                accion:
                  "Enviado a Caja",

                detalle:
                  `Ticket ${cleanTicketId} enviado a cobro por $${total.toLocaleString(
                    "es-AR"
                  )}. Usuario: ${cleanAuthor}`,
              },
            ],
          }
        );
      }

      return {
        pendingId,

        ticketId:
          cleanTicketId,

        budgetId:
          ticket.presupuestoId ||
          null,

        total,

        cliente:
          ticket.cliente ||
          "Mostrador",
      };
    }
  );
}
/* =========================================
   ENVIAR PRESUPUESTO MANUAL A CAJA
========================================= */

export async function sendBudgetToCash(
  budgetId,
  author = "Sistema"
) {
  const cleanBudgetId = cleanText(budgetId);
  const cleanAuthor = cleanText(author) || "Sistema";

  if (!cleanBudgetId) {
    throw new Error("BUDGET_REQUIRED");
  }

  const legacyPendingQuery = query(
    collection(db, "caja_pendientes"),
    where("presupuestoId", "==", cleanBudgetId)
  );

  const legacyPendingSnapshot = await getDocs(legacyPendingQuery);

  if (!legacyPendingSnapshot.empty) {
    throw new Error("CASH_PENDING_EXISTS");
  }

  const budgetRef = doc(db, "presupuestos", cleanBudgetId);
  const pendingId = `presupuesto_${cleanBudgetId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const pendingRef = doc(db, "caja_pendientes", pendingId);

  return runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);
    const pendingSnapshot = await transaction.get(pendingRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    if (pendingSnapshot.exists()) {
      throw new Error("CASH_PENDING_EXISTS");
    }

    const budget = budgetSnapshot.data();

    if (budget.ticketId) {
      throw new Error("BUDGET_TICKET_USE_TICKET_FLOW");
    }

    if (budget.estado !== "Aceptado") {
      throw new Error("BUDGET_NOT_ACCEPTED");
    }

    if (budget.estadoCaja === "Pendiente") {
      throw new Error("CASH_PENDING_EXISTS");
    }

    if (
      budget.estado === "Facturado" ||
      budget.facturaId ||
      ["Cobrado", "Financiado"].includes(budget.estadoCaja)
    ) {
      throw new Error("BUDGET_ALREADY_BILLED");
    }

    const total = Number(budget.total ?? budget.presupuestoTotal ?? 0) || 0;

    if (total <= 0) {
      throw new Error("BUDGET_INVALID_TOTAL");
    }

    const sourceItems = Array.isArray(budget.items)
      ? budget.items.map(normalizeItem)
      : [];

    const articulosCart = sourceItems.map((item) => ({
      sku: item.sku || null,
      nombre: item.description,
      cantidad: item.quantity,
      precio: item.price,
    }));

    const concepto =
      sourceItems
        .map((item) => `${item.quantity}x ${item.description}`)
        .join(", ") || `Presupuesto ${cleanBudgetId}`;

    const now = new Date();
    const nowISO = now.toISOString();
    const historyDate = formatDateTimeAR(now);

    transaction.set(pendingRef, {
      id: pendingId,
      origen: "Presupuesto",
      ref: cleanBudgetId,
      ticketId: null,
      presupuestoId: cleanBudgetId,
      clienteId: budget.clienteId || null,
      cliente: budget.cliente || "Mostrador",
      concepto,
      total,
      articulosCart,
      estado: "Pendiente",
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      usuario: cleanAuthor,
    });

    const history = Array.isArray(budget.historial) ? budget.historial : [];

    transaction.update(budgetRef, {
      estadoCaja: "Pendiente",
      cajaPendienteId: pendingId,
      actualizadoEn: nowISO,
      historial: [
        ...history,
        {
          fecha: historyDate,
          accion: "Enviado a Caja",
          detalle: `Presupuesto manual enviado a cobro por $${total.toLocaleString("es-AR")}. Usuario: ${cleanAuthor}`,
          autor: cleanAuthor,
        },
      ],
    });

    return {
      pendingId,
      budgetId: cleanBudgetId,
      ticketId: null,
      total,
      cliente: budget.cliente || "Mostrador",
    };
  });
}

/* =========================================
   CANCELAR PENDIENTE DE CAJA
========================================= */

export async function cancelCashPending(
  pendingId,
  author = "Sistema"
) {
  const cleanPendingId = cleanText(pendingId);
  const cleanAuthor = cleanText(author) || "Sistema";

  if (!cleanPendingId) {
    throw new Error("CASH_PENDING_ID_REQUIRED");
  }

  const pendingRef = doc(db, "caja_pendientes", cleanPendingId);

  return runTransaction(db, async (transaction) => {
    const pendingSnapshot = await transaction.get(pendingRef);

    if (!pendingSnapshot.exists()) {
      throw new Error("CASH_PENDING_NOT_FOUND");
    }

    const pending = pendingSnapshot.data();
    const ticketId = cleanText(pending.ticketId || (pending.origen === "Ticket" ? pending.ref : ""));
    const budgetId = cleanText(pending.presupuestoId);

    const ticketRef = ticketId ? doc(db, "tickets", ticketId) : null;
    const budgetRef = budgetId ? doc(db, "presupuestos", budgetId) : null;

    const ticketSnapshot = ticketRef ? await transaction.get(ticketRef) : null;
    const budgetSnapshot = budgetRef ? await transaction.get(budgetRef) : null;

    const now = new Date();
    const nowISO = now.toISOString();
    const historyDate = formatDateTimeAR(now);

    transaction.delete(pendingRef);

    if (ticketRef && ticketSnapshot?.exists()) {
      const ticket = ticketSnapshot.data();
      const history = Array.isArray(ticket.historial) ? ticket.historial : [];

      transaction.update(ticketRef, {
        estadoCaja: "No enviado",
        cajaPendienteId: null,
        enviadoCajaEn: null,
        actualizadoEn: nowISO,
        historial: [
          ...history,
          {
            fecha: historyDate,
            accion: "Envío a Caja cancelado",
            detalle: `Se retiró el pendiente ${cleanPendingId} antes del cobro.`,
            autor: cleanAuthor,
          },
        ],
      });
    }

    if (budgetRef && budgetSnapshot?.exists()) {
      const budget = budgetSnapshot.data();
      const history = Array.isArray(budget.historial) ? budget.historial : [];

      transaction.update(budgetRef, {
        estadoCaja: "No enviado",
        cajaPendienteId: null,
        actualizadoEn: nowISO,
        historial: [
          ...history,
          {
            fecha: historyDate,
            accion: "Envío a Caja cancelado",
            detalle: `Se retiró el pendiente ${cleanPendingId} antes del cobro.`,
            autor: cleanAuthor,
          },
        ],
      });
    }

    return {
      pendingId: cleanPendingId,
      ticketId: ticketId || null,
      budgetId: budgetId || null,
      total: Number(pending.total || 0),
    };
  });
}
