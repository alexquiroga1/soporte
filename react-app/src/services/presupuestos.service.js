import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";

import {
  db,
} from "./firebase.js";

import {
  reserveTicketStockInTransaction,
} from "./productos.service.js";

/* =========================================
   HELPERS
========================================= */

function pad(value) {
  return String(value).padStart(
    2,
    "0"
  );
}


function formatDateYMD(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatHistoryDate(
  date = new Date()
) {
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  const day =
    pad(
      date.getDate()
    );

  const month =
    months[
      date.getMonth()
    ];

  const year =
    date.getFullYear();

  const hours =
    pad(
      date.getHours()
    );

  const minutes =
    pad(
      date.getMinutes()
    );

  return (
    `${day} ${month} ${year} ${hours}:${minutes}`
  );
}

function cleanAuthor(
  author
) {
  const value =
    String(
      author ||
        ""
    ).trim();

  return (
    value ||
    "Sistema"
  );
}

function createHistoryEntry({
  author,
  action,
  detail = "",
}) {
  return {
    fecha:
      formatHistoryDate(),

    autor:
      cleanAuthor(
        author
      ),

    accion:
      action,

    detalle:
      String(
        detail ||
          ""
      ).trim(),
  };
}

function isBudgetExpired(
  budget
) {
  if (
    !budget?.fechaVencimiento
  ) {
    return false;
  }

  const expiration =
    new Date(
      `${budget.fechaVencimiento}T23:59:59`
    );

  if (
    Number.isNaN(
      expiration.getTime()
    )
  ) {
    return false;
  }

  return (
    expiration.getTime() <
    Date.now()
  );
}

function assertBudgetPending(
  budget
) {
  if (!budget) {
    throw new Error("BUDGET_NOT_FOUND");
  }

  if (
    budget.estado === "Facturado" ||
    budget.facturaId ||
    ["Cobrado", "Financiado"].includes(budget.estadoCaja)
  ) {
    throw new Error("BUDGET_ALREADY_BILLED");
  }

  if (budget.estadoCaja === "Pendiente") {
    throw new Error("BUDGET_ALREADY_IN_CASH");
  }

  if (budget.estado !== "Pendiente") {
    throw new Error("BUDGET_NOT_PENDING");
  }

  if (isBudgetExpired(budget)) {
    throw new Error("BUDGET_EXPIRED");
  }
}

/* =========================================
   ESCUCHAR PRESUPUESTOS
========================================= */

export function subscribeToBudgets(
  onData,
  onError
) {
  const budgetsRef =
    collection(
      db,
      "presupuestos"
    );

  return onSnapshot(
    budgetsRef,

    (
      snapshot
    ) => {
      const budgets =
        snapshot.docs.map(
          (
            document
          ) => ({
            ...document.data(),
              id: document.id,
          })
        );

      budgets.sort(
        (
          a,
          b
        ) => {
          const dateA =
            new Date(
              a.actualizadoEn ||
                a.creadoEn ||
                0
            ).getTime();

          const dateB =
            new Date(
              b.actualizadoEn ||
                b.creadoEn ||
                0
            ).getTime();

          if (
            dateA !==
            dateB
          ) {
            return (
              dateB -
              dateA
            );
          }

          return String(
            b.id
          ).localeCompare(
            String(
              a.id
            )
          );
        }
      );

      if (
        onData
      ) {
        onData(
          budgets
        );
      }
    },

    (
      error
    ) => {
      console.error(
        "Error escuchando presupuestos:",
        error
      );

      if (
        onError
      ) {
        onError(
          error
        );
      }
    }
  );
}

/* =========================================
   ESCUCHAR UN PRESUPUESTO
========================================= */

export function subscribeToBudget(
  budgetId,
  onData,
  onError
) {
  if (
    !budgetId
  ) {
    return () => {};
  }

  const budgetRef =
    doc(
      db,
      "presupuestos",
      String(
        budgetId
      )
    );

  return onSnapshot(
    budgetRef,

    (
      snapshot
    ) => {
      if (
        !snapshot.exists()
      ) {
        if (
          onData
        ) {
          onData(
            null
          );
        }

        return;
      }

      if (
        onData
      ) {
        onData({
          ...snapshot.data(),
        id: snapshot.id,
        });
      }
    },

    (
      error
    ) => {
      console.error(
        `Error escuchando presupuesto ${budgetId}:`,
        error
      );

      if (
        onError
      ) {
        onError(
          error
        );
      }
    }
  );
}

/* =========================================
   ACEPTAR PRESUPUESTO
========================================= */

export async function acceptBudget(
  budgetId,
  author
) {
  if (!budgetId) {
    throw new Error("BUDGET_REQUIRED");
  }

  const cleanBudgetId = String(budgetId);
  const cleanAuthorValue = cleanAuthor(author);
  const budgetRef = doc(db, "presupuestos", cleanBudgetId);
  let result = null;

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = budgetSnapshot.data();
    assertBudgetPending(budget);

    const ticketId = budget.ticketId ? String(budget.ticketId) : null;
    const ticketRef = ticketId ? doc(db, "tickets", ticketId) : null;
    const ticketSnapshot = ticketRef ? await transaction.get(ticketRef) : null;
    const ticketData = ticketSnapshot?.exists() ? ticketSnapshot.data() : null;

    const publicToken = cleanText(budget.publicToken);
    const publicRef = publicToken
      ? doc(db, "presupuestos_publicos", publicToken)
      : null;
    const publicSnapshot = publicRef ? await transaction.get(publicRef) : null;
    const publicData = publicSnapshot?.exists() ? publicSnapshot.data() : null;
    const publicResponse = cleanText(publicData?.respuesta);

    if (publicResponse && publicResponse !== "Aceptado") {
      throw new Error("PUBLIC_RESPONSE_CONFLICT");
    }

    const nowISO = new Date().toISOString();

    if (ticketRef && ticketData) {
      await reserveTicketStockInTransaction(transaction, {
        ticketId,
        pieces: ticketData.piezas || [],
        author: publicResponse ? "Cliente (Vía Web)" : cleanAuthorValue,
        reference: cleanBudgetId,
      });
    }

    const budgetHistory = Array.isArray(budget.historial) ? budget.historial : [];

    transaction.update(budgetRef, {
      estado: "Aceptado",
      presupuestoAprobado: true,
      ...(publicResponse
        ? {
            respuestaPublica: "Aceptado",
            respuestaPublicaEn: publicData?.respondidoEn || nowISO,
          }
        : {}),
      actualizadoEn: nowISO,
      historial: [
        ...budgetHistory,
        createHistoryEntry({
          author: publicResponse ? "Cliente (Vía Web)" : cleanAuthorValue,
          action: "Presupuesto aceptado",
          detail: ticketId
            ? `Presupuesto aceptado. Vinculado al Ticket ${ticketId}.`
            : "Presupuesto aceptado.",
        }),
      ],
    });

    if (ticketRef && ticketData) {
      const ticketHistory = Array.isArray(ticketData.historial)
        ? ticketData.historial
        : [];

      transaction.update(ticketRef, {
        presupuestoAprobado: true,
        presupuestoEstado: "Aceptado",
        presupuestoId: cleanBudgetId,
        stage: "reparacion",
        actualizadoEn: nowISO,
        historial: [
          ...ticketHistory,
          createHistoryEntry({
            author: publicResponse ? "Cliente (Vía Web)" : cleanAuthorValue,
            action: "Presupuesto APROBADO",
            detail: `Presupuesto ${cleanBudgetId} aceptado. El ticket pasa a reparación.`,
          }),
        ],
      });
    }

    if (publicRef && publicData) {
      transaction.update(publicRef, {
        activo: false,
        estado: "Aceptado",
        actualizadoEn: nowISO,
        cerradoEn: nowISO,
        cerradoPor: cleanAuthorValue,
        ...(publicResponse
          ? {
              aplicadoEn: nowISO,
              aplicadoPor: cleanAuthorValue,
            }
          : {}),
      });
    }

    result = {
      budgetId: cleanBudgetId,
      ticketId,
      state: "Aceptado",
      ticketUpdated: Boolean(ticketData),
      publicResponseApplied: Boolean(publicResponse),
    };
  });

  return result;
}

/* =========================================
   RECHAZAR PRESUPUESTO
========================================= */

export async function rejectBudget(
  budgetId,
  reason = "",
  author
) {
  if (!budgetId) {
    throw new Error("BUDGET_REQUIRED");
  }

  const cleanBudgetId = String(budgetId);
  const cleanReason = String(reason || "").trim();
  const cleanAuthorValue = cleanAuthor(author);
  const budgetRef = doc(db, "presupuestos", cleanBudgetId);
  let result = null;

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = budgetSnapshot.data();
    assertBudgetPending(budget);

    const ticketId = budget.ticketId ? String(budget.ticketId) : null;
    const ticketRef = ticketId ? doc(db, "tickets", ticketId) : null;
    const ticketSnapshot = ticketRef ? await transaction.get(ticketRef) : null;
    const ticketData = ticketSnapshot?.exists() ? ticketSnapshot.data() : null;

    const publicToken = cleanText(budget.publicToken);
    const publicRef = publicToken
      ? doc(db, "presupuestos_publicos", publicToken)
      : null;
    const publicSnapshot = publicRef ? await transaction.get(publicRef) : null;
    const publicData = publicSnapshot?.exists() ? publicSnapshot.data() : null;
    const publicResponse = cleanText(publicData?.respuesta);

    if (publicResponse && publicResponse !== "Rechazado") {
      throw new Error("PUBLIC_RESPONSE_CONFLICT");
    }

    const nowISO = new Date().toISOString();
    const detail = cleanReason
      ? `Motivo: ${cleanReason}`
      : "El presupuesto fue rechazado.";
    const budgetHistory = Array.isArray(budget.historial) ? budget.historial : [];

    transaction.update(budgetRef, {
      estado: "Rechazado",
      presupuestoAprobado: false,
      ...(publicResponse
        ? {
            respuestaPublica: "Rechazado",
            respuestaPublicaEn: publicData?.respondidoEn || nowISO,
          }
        : {}),
      actualizadoEn: nowISO,
      historial: [
        ...budgetHistory,
        createHistoryEntry({
          author: publicResponse ? "Cliente (Vía Web)" : cleanAuthorValue,
          action: "Presupuesto rechazado",
          detail,
        }),
      ],
    });

    if (ticketRef && ticketData) {
      const ticketHistory = Array.isArray(ticketData.historial)
        ? ticketData.historial
        : [];

      transaction.update(ticketRef, {
        presupuestoAprobado: false,
        presupuestoEstado: "Rechazado",
        presupuestoId: cleanBudgetId,
        stage: "presupuesto_rechazado",
        actualizadoEn: nowISO,
        historial: [
          ...ticketHistory,
          createHistoryEntry({
            author: publicResponse ? "Cliente (Vía Web)" : cleanAuthorValue,
            action: "Presupuesto RECHAZADO",
            detail: cleanReason
              ? `Presupuesto ${cleanBudgetId} rechazado. Motivo: ${cleanReason}`
              : `Presupuesto ${cleanBudgetId} rechazado.`,
          }),
        ],
      });
    }

    if (publicRef && publicData) {
      transaction.update(publicRef, {
        activo: false,
        estado: "Rechazado",
        actualizadoEn: nowISO,
        cerradoEn: nowISO,
        cerradoPor: cleanAuthorValue,
        ...(publicResponse
          ? {
              aplicadoEn: nowISO,
              aplicadoPor: cleanAuthorValue,
            }
          : {}),
      });
    }

    result = {
      budgetId: cleanBudgetId,
      ticketId,
      state: "Rechazado",
      ticketUpdated: Boolean(ticketData),
      publicResponseApplied: Boolean(publicResponse),
    };
  });

  return result;
}


/* =========================================
   NORMALIZACIÓN COMERCIAL
========================================= */

function normalizeBudgetItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("BUDGET_ITEMS_REQUIRED");
  }

  return items.map((item) => {
    const description = cleanText(item?.descripcion ?? item?.nombre);
    const quantity = toNumber(item?.cantidad, 0);
    const price = toNumber(item?.precio, -1);

    if (!description || quantity <= 0 || price < 0) {
      throw new Error("BUDGET_ITEM_INVALID");
    }

    return {
      descripcion: description,
      cantidad: quantity,
      precio: roundMoney(price),
      subtotal: roundMoney(quantity * price),
      sku: cleanText(item?.sku),
      productoId: cleanText(item?.productoId),
      tipo: cleanText(item?.tipo) || "Concepto manual",
      origenItem: cleanText(item?.origenItem) || (cleanText(item?.sku) ? "Catálogo" : "Manual"),
    };
  });
}

function calculateBudgetTotals(items, discountPercent = 0) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + toNumber(item?.subtotal, 0), 0)
  );

  const cleanDiscount = Math.min(
    100,
    Math.max(0, toNumber(discountPercent, 0))
  );

  const discountAmount = roundMoney(subtotal * (cleanDiscount / 100));
  const total = roundMoney(Math.max(0, subtotal - discountAmount));

  if (total <= 0) {
    throw new Error("BUDGET_TOTAL_INVALID");
  }

  return {
    subtotal,
    discountPercent: cleanDiscount,
    discountAmount,
    total,
  };
}

function getClientBudgetIdentity(client) {
  if (!client?.id) {
    throw new Error("BUDGET_CLIENT_REQUIRED");
  }

  if (client.archivado === true) {
    throw new Error("BUDGET_CLIENT_ARCHIVED");
  }

  const clientName =
    cleanText(client.razonSocial) ||
    cleanText(`${client.nombre || ""} ${client.apellido || ""}`) ||
    cleanText(client.name) ||
    "Cliente";

  const documentNumber =
    cleanText(client.cuit) ||
    cleanText(client.dni) ||
    cleanText(client.documento) ||
    "C.F.";

  return {
    id: client.id,
    name: clientName,
    document: documentNumber,
  };
}

function normalizeValidityDays(value) {
  return Math.max(1, Math.trunc(toNumber(value, 15)));
}

/* =========================================
   CREAR PRESUPUESTO MANUAL
========================================= */

export async function createManualBudget({
  client,
  items = [],
  discountPercent = 0,
  validityDays = 15,
  observations = "",
  leadTime = "",
  warranty = "",
  internalNote = "",
  author = "Sistema",
} = {}) {
  const clientIdentity = getClientBudgetIdentity(client);
  const normalizedItems = normalizeBudgetItems(items);
  const totals = calculateBudgetTotals(normalizedItems, discountPercent);
  const cleanValidityDays = normalizeValidityDays(validityDays);

  const now = new Date();
  const nowISO = now.toISOString();
  const date = formatDateYMD(now);
  const expirationDate = formatDateYMD(addDays(now, cleanValidityDays));
  const cleanAuthorValue = cleanAuthor(author);

  const counterRef = doc(db, "negocio", "contadores");
  let result = null;

  await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const currentCounter = counterSnapshot.exists()
      ? toNumber(counterSnapshot.data()?.presupuestos, 0)
      : 0;
    const nextCounter = currentCounter + 1;
    const budgetId = `PRE-${String(nextCounter).padStart(6, "0")}`;
    const budgetRef = doc(db, "presupuestos", budgetId);

    const budget = {
      id: budgetId,
      numero: budgetId,
      fecha: date,
      hora: now.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fechaVencimiento: expirationDate,
      validezDias: cleanValidityDays,
      vigencia: expirationDate,
      clienteId: clientIdentity.id,
      cliente: clientIdentity.name,
      doc: clientIdentity.document,
      origen: "Manual",
      ticketId: null,
      ticketNumero: null,
      estado: "Pendiente",
      estadoCaja: "No enviado",
      presupuestoFijado: true,
      presupuestoAprobado: false,
      publicado: false,
      revision: 1,
      revisiones: [],
      items: normalizedItems,
      subtotal: totals.subtotal,
      descuento: totals.discountAmount,
      descuentoImporte: totals.discountAmount,
      descuentoPorcentaje: totals.discountPercent,
      total: totals.total,
      observaciones: cleanText(observations),
      plazoEstimado: cleanText(leadTime),
      garantia: cleanText(warranty),
      notaInterna: cleanText(internalNote),
      proximoSeguimiento: null,
      usuario: cleanAuthorValue,
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthorValue,
      historial: [
        createHistoryEntry({
          author: cleanAuthorValue,
          action: "Presupuesto manual creado",
          detail: `Presupuesto ${budgetId} v1 creado manualmente. Total: ${totals.total}.`,
        }),
      ],
    };

    transaction.set(
      counterRef,
      { presupuestos: nextCounter },
      { merge: true }
    );

    transaction.set(budgetRef, budget);
    result = budget;
  });

  return result;
}

/* =========================================
   CREAR NUEVA REVISIÓN
========================================= */

export async function createBudgetRevision(
  budgetId,
  {
    client,
    items = [],
    discountPercent = 0,
    validityDays = 15,
    observations = "",
    leadTime = "",
    warranty = "",
    internalNote = "",
    reason = "Actualización comercial",
  } = {},
  author = "Sistema"
) {
  const cleanBudgetId = cleanText(budgetId);
  if (!cleanBudgetId) {
    throw new Error("BUDGET_REQUIRED");
  }

  const clientIdentity = getClientBudgetIdentity(client);
  const normalizedItems = normalizeBudgetItems(items);
  const totals = calculateBudgetTotals(normalizedItems, discountPercent);
  const cleanValidityDays = normalizeValidityDays(validityDays);
  const cleanReason = cleanText(reason) || "Actualización comercial";
  const cleanAuthorValue = cleanAuthor(author);

  const budgetRef = doc(db, "presupuestos", cleanBudgetId);
  let result = null;

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);
    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const current = budgetSnapshot.data();

    if (
      current.estado === "Facturado" ||
      current.facturaId ||
      ["Pendiente", "Cobrado", "Financiado"].includes(current.estadoCaja)
    ) {
      throw new Error("BUDGET_REVISION_FINANCIAL_LOCK");
    }

    if (current.estado === "Aceptado") {
      throw new Error("BUDGET_REVISION_ACCEPTED_LOCK");
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const date = formatDateYMD(now);
    const expirationDate = formatDateYMD(addDays(now, cleanValidityDays));
    const currentRevision = Math.max(1, Math.trunc(toNumber(current.revision, 1)));
    const nextRevision = currentRevision + 1;

    const revisionSnapshot = {
      revision: currentRevision,
      estado: cleanText(current.estado) || "Pendiente",
      fecha: current.fecha || null,
      fechaVencimiento: current.fechaVencimiento || null,
      clienteId: current.clienteId || null,
      cliente: current.cliente || "Cliente",
      doc: current.doc || "C.F.",
      items: Array.isArray(current.items) ? current.items : [],
      subtotal: toNumber(current.subtotal, 0),
      descuentoImporte: toNumber(current.descuentoImporte ?? current.descuento, 0),
      descuentoPorcentaje: toNumber(current.descuentoPorcentaje, 0),
      total: toNumber(current.total, 0),
      observaciones: cleanText(current.observaciones),
      plazoEstimado: cleanText(current.plazoEstimado),
      garantia: cleanText(current.garantia),
      notaInterna: cleanText(current.notaInterna),
      reemplazadaEn: nowISO,
      reemplazadaPor: cleanAuthorValue,
      motivoRevision: cleanReason,
    };

    const publicToken = cleanText(current.publicToken);
    const publicRef = publicToken
      ? doc(db, "presupuestos_publicos", publicToken)
      : null;
    const publicSnapshot = publicRef
      ? await transaction.get(publicRef)
      : null;

    const ticketId = cleanText(current.ticketId);
    const ticketRef = ticketId ? doc(db, "tickets", ticketId) : null;
    const ticketSnapshot = ticketRef
      ? await transaction.get(ticketRef)
      : null;
    const ticketData = ticketSnapshot?.exists() ? ticketSnapshot.data() : null;

    const previousHistory = Array.isArray(current.historial)
      ? current.historial
      : [];
    const previousRevisions = Array.isArray(current.revisiones)
      ? current.revisiones
      : [];

    transaction.update(budgetRef, {
      revision: nextRevision,
      fecha: date,
      hora: now.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fechaVencimiento: expirationDate,
      validezDias: cleanValidityDays,
      vigencia: expirationDate,
      clienteId: clientIdentity.id,
      cliente: clientIdentity.name,
      doc: clientIdentity.document,
      estado: "Pendiente",
      estadoCaja: "No enviado",
      presupuestoAprobado: false,
      publicado: false,
      publicToken: deleteField(),
      publicadoEn: deleteField(),
      respuestaPublica: deleteField(),
      respuestaPublicaEn: deleteField(),
      cajaPendienteId: deleteField(),
      items: normalizedItems,
      subtotal: totals.subtotal,
      descuento: totals.discountAmount,
      descuentoImporte: totals.discountAmount,
      descuentoPorcentaje: totals.discountPercent,
      total: totals.total,
      observaciones: cleanText(observations),
      plazoEstimado: cleanText(leadTime),
      garantia: cleanText(warranty),
      notaInterna: cleanText(internalNote),
      revisiones: [...previousRevisions, revisionSnapshot].slice(-20),
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthorValue,
      historial: [
        ...previousHistory,
        createHistoryEntry({
          author: cleanAuthorValue,
          action: `Presupuesto revisado · v${nextRevision}`,
          detail: cleanReason,
        }),
      ],
    });

    if (publicRef && publicSnapshot?.exists()) {
      transaction.update(publicRef, {
        activo: false,
        estado: "Reemplazado",
        cerradoEn: nowISO,
        cerradoPor: cleanAuthorValue,
        actualizadoEn: nowISO,
      });
    }

    if (ticketRef && ticketData) {
      const ticketHistory = Array.isArray(ticketData.historial)
        ? ticketData.historial
        : [];

      transaction.update(ticketRef, {
        presupuestoId: cleanBudgetId,
        presupuestoEstado: "Pendiente",
        presupuestoAprobado: deleteField(),
        presupuestoSubtotal: totals.subtotal,
        descuentoPorcentaje: totals.discountPercent,
        descuentoImporte: totals.discountAmount,
        presupuestoEstimado: totals.total,
        stage: "presupuesto",
        actualizadoEn: nowISO,
        historial: [
          ...ticketHistory,
          createHistoryEntry({
            author: cleanAuthorValue,
            action: `Presupuesto actualizado a v${nextRevision}`,
            detail: `Presupuesto ${cleanBudgetId}. ${cleanReason}`,
          }),
        ],
      });
    }

    result = {
      id: cleanBudgetId,
      budgetId: cleanBudgetId,
      revision: nextRevision,
      ticketId: ticketId || null,
      total: totals.total,
    };
  });

  return result;
}

/* =========================================
   REGISTRAR GESTIÓN COMERCIAL
========================================= */

export async function registerBudgetFollowUp(
  budgetId,
  {
    type = "Seguimiento",
    note = "",
    nextFollowUp = "",
  } = {},
  author = "Sistema"
) {
  const cleanBudgetId = cleanText(budgetId);
  if (!cleanBudgetId) {
    throw new Error("BUDGET_REQUIRED");
  }

  const cleanType = cleanText(type) || "Seguimiento";
  const cleanNote = cleanText(note);
  const cleanNext = cleanText(nextFollowUp);
  const cleanAuthorValue = cleanAuthor(author);
  const budgetRef = doc(db, "presupuestos", cleanBudgetId);
  let result = null;

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(budgetRef);
    if (!snapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = snapshot.data();
    const history = Array.isArray(budget.historial) ? budget.historial : [];
    const nowISO = new Date().toISOString();

    const detailParts = [];
    if (cleanNote) detailParts.push(cleanNote);
    if (cleanNext) detailParts.push(`Próximo seguimiento: ${cleanNext}`);

    transaction.update(budgetRef, {
      proximoSeguimiento: cleanNext || null,
      ultimaGestionEn: nowISO,
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthorValue,
      historial: [
        ...history,
        createHistoryEntry({
          author: cleanAuthorValue,
          action: `Gestión comercial · ${cleanType}`,
          detail: detailParts.join(" · ") || "Gestión registrada.",
        }),
      ],
    });

    result = {
      budgetId: cleanBudgetId,
      nextFollowUp: cleanNext || null,
      type: cleanType,
    };
  });

  return result;
}

export default {
  subscribeToBudgets,
  subscribeToBudget,
  createManualBudget,
  createBudgetRevision,
  registerBudgetFollowUp,
  acceptBudget,
  rejectBudget,
};
