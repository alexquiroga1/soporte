import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getISOTime(date = new Date()) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getDisplayName(client) {
  return (
    cleanText(client?.razonSocial) ||
    cleanText(`${client?.nombre || ""} ${client?.apellido || ""}`) ||
    cleanText(client?.name) ||
    cleanText(client?.cliente) ||
    "Cliente"
  );
}

function normalizeActor({ author = "Sistema", actorUid = null } = {}) {
  return {
    actorNombre: cleanText(author) || "Sistema",
    actorUid: cleanText(actorUid) || null,
  };
}

function auditRef(prefix = "audit") {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return doc(db, "auditoria_clientes", `${prefix}_${random}`);
}

export function subscribeToClientAudit(clientId, onData, onError) {
  const id = cleanText(clientId);

  if (!id) {
    onData([]);
    return () => {};
  }

  const auditQuery = query(
    collection(db, "auditoria_clientes"),
    where("clienteId", "==", id)
  );

  return onSnapshot(
    auditQuery,
    (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({
          ...item.data(),
        id: item.id,
        }))
        .sort((a, b) =>
          String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""))
        );

      onData(rows);
    },
    onError
  );
}

export async function createAuditCreditNote({
  clientId,
  amount,
  reason,
  author = "Sistema",
  actorUid = null,
}) {
  const id = cleanText(clientId);
  const numericAmount = Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const cleanReason = cleanText(reason);

  if (!id) {
    throw new Error("CLIENT_ID_REQUIRED");
  }

  if (numericAmount <= 0) {
    throw new Error("AUDIT_AMOUNT_INVALID");
  }

  if (!cleanReason) {
    throw new Error("AUDIT_REASON_REQUIRED");
  }

  const clientRef = doc(db, "clientes", id);
  const counterRef = doc(db, "negocio", "contadores");
  const actor = normalizeActor({ author, actorUid });

  return runTransaction(db, async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);

    if (!clientSnapshot.exists()) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const client = clientSnapshot.data();
    const counterSnapshot = await transaction.get(counterRef);

    let nextNumber = 1;

    if (counterSnapshot.exists()) {
      const current = Number(counterSnapshot.data()?.nc);
      if (Number.isFinite(current)) {
        nextNumber = current + 1;
      }
    }

    let noteId = "";
    let noteRef = null;
    let noteSnapshot = null;

    do {
      noteId = `NC-${String(nextNumber).padStart(4, "0")}`;
      noteRef = doc(db, "facturas", noteId);
      noteSnapshot = await transaction.get(noteRef);

      if (noteSnapshot.exists()) {
        nextNumber += 1;
      }
    } while (noteSnapshot.exists());

    const now = new Date();
    const nowISO = now.toISOString();
    const currentBalance = toNumber(client.saldoAFavor);
    const nextBalance = currentBalance + numericAmount;
    const clientName = getDisplayName(client);

    const note = {
      id: noteId,
      fecha: getISODate(now),
      hora: getISOTime(now),
      cliente: clientName,
      doc: cleanText(client.cuit || client.dni || client.doc) || "C.F.",
      clienteId: id,
      tipo: "Nota de Crédito",
      refModulo: "Auditoría interna",
      refId: id,
      refPago: "—",
      estado: "Emitida",
      estadoPago: "Aplicada",
      total: numericAmount,
      montoAcreditado: numericAmount,
      motivo: cleanReason,
      facturaOrigenId: null,
      comprobanteInterno: true,
      origenAuditoria: true,
      usuario: actor.actorNombre,
      items: [
        {
          desc: "Acreditación manual por auditoría interna",
          cant: 1,
          precio: numericAmount,
          subtotal: numericAmount,
        },
      ],
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      historial: [
        {
          fecha: now.toLocaleString("es-AR"),
          accion: "Emisión Nota de Crédito interna",
          detalle: `${cleanReason}. Saldo a favor acreditado por ${actor.actorNombre}.`,
        },
      ],
    };

    transaction.set(noteRef, note);

    transaction.set(
      counterRef,
      { nc: nextNumber },
      { merge: true }
    );

    transaction.update(clientRef, {
      saldoAFavor: nextBalance,
      actualizadoEn: nowISO,
      actualizadoPor: actor.actorNombre,
    });

    const movementRef = doc(db, "cuenta_corriente", `audit_nc_${noteId}`);

    transaction.set(movementRef, {
      id: `audit_nc_${noteId}`,
      clienteId: id,
      cliente: clientName,
      tipo: "Crédito",
      concepto: `Nota de Crédito ${noteId} · Auditoría interna`,
      importe: numericAmount,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      origen: "Auditoría interna",
      refId: noteId,
      motivo: cleanReason,
      fecha: getISODate(now),
      hora: getISOTime(now),
      creadoEn: nowISO,
      usuario: actor.actorNombre,
      actorUid: actor.actorUid,
    });

    transaction.set(auditRef("credito"), {
      accion: "SALDO_ACREDITADO_NC",
      clienteId: id,
      cliente: clientName,
      entidad: "cliente",
      entidadId: id,
      notaCreditoId: noteId,
      monto: numericAmount,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      motivo: cleanReason,
      ...actor,
      creadoEn: nowISO,
    });

    return {
      noteId,
      amount: numericAmount,
      previousBalance: currentBalance,
      balance: nextBalance,
    };
  });
}


export async function reverseAuditCreditNote({
  clientId,
  creditAudit,
  amount,
  reason,
  author = "Sistema",
  actorUid = null,
}) {
  const id = cleanText(clientId);
  const noteId = cleanText(creditAudit?.notaCreditoId || creditAudit?.noteId);
  const numericAmount = Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const cleanReason = cleanText(reason);

  if (!id) {
    throw new Error("CLIENT_ID_REQUIRED");
  }

  if (!noteId) {
    throw new Error("AUDIT_CREDIT_NOTE_REQUIRED");
  }

  if (numericAmount <= 0) {
    throw new Error("AUDIT_AMOUNT_INVALID");
  }

  if (!cleanReason) {
    throw new Error("AUDIT_REASON_REQUIRED");
  }

  const clientRef = doc(db, "clientes", id);
  const noteRef = doc(db, "facturas", noteId);
  const counterRef = doc(db, "negocio", "contadores");
  const actor = normalizeActor({ author, actorUid });

  return runTransaction(db, async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    const noteSnapshot = await transaction.get(noteRef);
    const counterSnapshot = await transaction.get(counterRef);

    if (!clientSnapshot.exists()) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    if (!noteSnapshot.exists()) {
      throw new Error("AUDIT_CREDIT_NOTE_NOT_FOUND");
    }

    const client = clientSnapshot.data();
    const note = noteSnapshot.data();

    if (
      cleanText(note.clienteId) !== id ||
      note.origenAuditoria !== true ||
      cleanText(note.tipo).toLowerCase() !== "nota de crédito"
    ) {
      throw new Error("AUDIT_CREDIT_NOTE_INVALID");
    }

    const originalAmount = toNumber(note.montoAcreditado || note.total);
    const alreadyReversed = toNumber(note.montoRevertido);
    const remainingOriginal = Math.max(0, originalAmount - alreadyReversed);
    const currentBalance = Math.max(0, toNumber(client.saldoAFavor));
    const maxReversible = Math.round(
      (Math.min(remainingOriginal, currentBalance) + Number.EPSILON) * 100
    ) / 100;

    if (maxReversible <= 0) {
      const error = new Error("AUDIT_CREDIT_NOT_REVERSIBLE");
      error.available = 0;
      throw error;
    }

    if (numericAmount > maxReversible + 0.0001) {
      const error = new Error("AUDIT_REVERSAL_EXCEEDS_AVAILABLE");
      error.available = maxReversible;
      throw error;
    }

    let nextNumber = 1;

    if (counterSnapshot.exists()) {
      const current = Number(counterSnapshot.data()?.nda);
      if (Number.isFinite(current)) {
        nextNumber = current + 1;
      }
    }

    let debitNoteId = "";
    let debitNoteRef = null;
    let debitNoteSnapshot = null;

    do {
      debitNoteId = `NDA-${String(nextNumber).padStart(4, "0")}`;
      debitNoteRef = doc(db, "facturas", debitNoteId);
      debitNoteSnapshot = await transaction.get(debitNoteRef);

      if (debitNoteSnapshot.exists()) {
        nextNumber += 1;
      }
    } while (debitNoteSnapshot.exists());

    const now = new Date();
    const nowISO = now.toISOString();
    const nextBalance = Math.max(0, currentBalance - numericAmount);
    const totalReversed = alreadyReversed + numericAmount;
    const remainingAfter = Math.max(0, originalAmount - totalReversed);
    const clientName = getDisplayName(client);

    const debitNote = {
      id: debitNoteId,
      fecha: getISODate(now),
      hora: getISOTime(now),
      cliente: clientName,
      doc: cleanText(client.cuit || client.dni || client.doc) || "C.F.",
      clienteId: id,
      tipo: "Nota de Débito interna",
      refModulo: "Auditoría interna",
      refId: id,
      refPago: "—",
      estado: "Emitida",
      estadoPago: "Aplicada",
      total: numericAmount,
      montoDebitado: numericAmount,
      motivo: cleanReason,
      notaCreditoOrigenId: noteId,
      comprobanteInterno: true,
      origenAuditoria: true,
      usuario: actor.actorNombre,
      items: [
        {
          desc: `Reversión de acreditación ${noteId}`,
          cant: 1,
          precio: numericAmount,
          subtotal: numericAmount,
        },
      ],
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      historial: [
        {
          fecha: now.toLocaleString("es-AR"),
          accion: "Reversión de acreditación interna",
          detalle: `${cleanReason}. Se descuenta saldo a favor vinculado a ${noteId}.`,
        },
      ],
    };

    transaction.set(debitNoteRef, debitNote);

    transaction.set(
      counterRef,
      { nda: nextNumber },
      { merge: true }
    );

    transaction.update(noteRef, {
      montoRevertido: totalReversed,
      saldoReversible: remainingAfter,
      estadoReversion: remainingAfter <= 0.0001 ? "Revertida" : "Parcialmente revertida",
      revertida: remainingAfter <= 0.0001,
      actualizadoEn: nowISO,
      historial: [
        ...(Array.isArray(note.historial) ? note.historial : []),
        {
          fecha: now.toLocaleString("es-AR"),
          accion: "Reversión de acreditación",
          detalle: `${debitNoteId} · ${cleanReason} · Importe revertido ${numericAmount}.`,
        },
      ],
    });

    transaction.update(clientRef, {
      saldoAFavor: nextBalance,
      actualizadoEn: nowISO,
      actualizadoPor: actor.actorNombre,
    });

    const movementRef = doc(db, "cuenta_corriente", `audit_nda_${debitNoteId}`);

    transaction.set(movementRef, {
      id: `audit_nda_${debitNoteId}`,
      clienteId: id,
      cliente: clientName,
      tipo: "Débito",
      concepto: `Reversión ${debitNoteId} de ${noteId} · Auditoría interna`,
      importe: numericAmount,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      origen: "Auditoría interna",
      refId: debitNoteId,
      refOrigenId: noteId,
      motivo: cleanReason,
      fecha: getISODate(now),
      hora: getISOTime(now),
      creadoEn: nowISO,
      usuario: actor.actorNombre,
      actorUid: actor.actorUid,
    });

    transaction.set(auditRef("reversion"), {
      accion: "SALDO_ACREDITACION_REVERTIDA",
      clienteId: id,
      cliente: clientName,
      entidad: "cliente",
      entidadId: id,
      notaCreditoId: noteId,
      notaDebitoId: debitNoteId,
      monto: numericAmount,
      montoOriginal: originalAmount,
      montoRevertidoTotal: totalReversed,
      saldoReversible: remainingAfter,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      motivo: cleanReason,
      ...actor,
      creadoEn: nowISO,
    });

    return {
      noteId,
      debitNoteId,
      amount: numericAmount,
      previousBalance: currentBalance,
      balance: nextBalance,
      remainingOriginal: remainingAfter,
    };
  });
}


export async function reverseLegacyClientBalance({
  clientId,
  amount,
  reason,
  author = "Sistema",
  actorUid = null,
}) {
  const id = cleanText(clientId);
  const numericAmount = Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const cleanReason = cleanText(reason);

  if (!id) {
    throw new Error("CLIENT_ID_REQUIRED");
  }

  if (numericAmount <= 0) {
    throw new Error("AUDIT_AMOUNT_INVALID");
  }

  if (!cleanReason) {
    throw new Error("AUDIT_REASON_REQUIRED");
  }

  const clientRef = doc(db, "clientes", id);
  const counterRef = doc(db, "negocio", "contadores");
  const actor = normalizeActor({ author, actorUid });

  return runTransaction(db, async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    const counterSnapshot = await transaction.get(counterRef);

    if (!clientSnapshot.exists()) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const client = clientSnapshot.data();
    const currentBalance = Math.max(0, toNumber(client.saldoAFavor));

    if (currentBalance <= 0.0001) {
      const error = new Error("AUDIT_BALANCE_NOT_AVAILABLE");
      error.available = 0;
      throw error;
    }

    if (numericAmount > currentBalance + 0.0001) {
      const error = new Error("AUDIT_REVERSAL_EXCEEDS_AVAILABLE");
      error.available = currentBalance;
      throw error;
    }

    let nextNumber = 1;

    if (counterSnapshot.exists()) {
      const current = Number(counterSnapshot.data()?.nda);
      if (Number.isFinite(current)) {
        nextNumber = current + 1;
      }
    }

    let debitNoteId = "";
    let debitNoteRef = null;
    let debitNoteSnapshot = null;

    do {
      debitNoteId = `NDA-${String(nextNumber).padStart(4, "0")}`;
      debitNoteRef = doc(db, "facturas", debitNoteId);
      debitNoteSnapshot = await transaction.get(debitNoteRef);

      if (debitNoteSnapshot.exists()) {
        nextNumber += 1;
      }
    } while (debitNoteSnapshot.exists());

    const now = new Date();
    const nowISO = now.toISOString();
    const nextBalance = Math.max(0, currentBalance - numericAmount);
    const clientName = getDisplayName(client);

    transaction.set(debitNoteRef, {
      id: debitNoteId,
      fecha: getISODate(now),
      hora: getISOTime(now),
      cliente: clientName,
      doc: cleanText(client.cuit || client.dni || client.doc) || "C.F.",
      clienteId: id,
      tipo: "Nota de Débito interna",
      refModulo: "Auditoría interna",
      refId: id,
      refPago: "—",
      estado: "Emitida",
      estadoPago: "Aplicada",
      total: numericAmount,
      montoDebitado: numericAmount,
      motivo: cleanReason,
      notaCreditoOrigenId: null,
      comprobanteInterno: true,
      origenAuditoria: true,
      origenSaldoLegacy: true,
      usuario: actor.actorNombre,
      items: [
        {
          desc: "Reversión manual de saldo a favor anterior",
          cant: 1,
          precio: numericAmount,
          subtotal: numericAmount,
        },
      ],
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      historial: [
        {
          fecha: now.toLocaleString("es-AR"),
          accion: "Reversión manual de saldo anterior",
          detalle: `${cleanReason}. Saldo previo sin NC de Auditoría asociada.`,
        },
      ],
    });

    transaction.set(
      counterRef,
      { nda: nextNumber },
      { merge: true }
    );

    transaction.update(clientRef, {
      saldoAFavor: nextBalance,
      actualizadoEn: nowISO,
      actualizadoPor: actor.actorNombre,
    });

    const movementRef = doc(db, "cuenta_corriente", `audit_nda_${debitNoteId}`);

    transaction.set(movementRef, {
      id: `audit_nda_${debitNoteId}`,
      clienteId: id,
      cliente: clientName,
      tipo: "Débito",
      concepto: `Reversión manual ${debitNoteId} · saldo anterior`,
      importe: numericAmount,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      origen: "Auditoría interna",
      refId: debitNoteId,
      refOrigenId: null,
      motivo: cleanReason,
      fecha: getISODate(now),
      hora: getISOTime(now),
      creadoEn: nowISO,
      usuario: actor.actorNombre,
      actorUid: actor.actorUid,
    });

    transaction.set(auditRef("reversion_legacy"), {
      accion: "SALDO_EXISTENTE_REVERTIDO",
      clienteId: id,
      cliente: clientName,
      entidad: "cliente",
      entidadId: id,
      notaCreditoId: null,
      notaDebitoId: debitNoteId,
      monto: numericAmount,
      saldoAnterior: currentBalance,
      saldoPosterior: nextBalance,
      motivo: cleanReason,
      origenSaldoLegacy: true,
      ...actor,
      creadoEn: nowISO,
    });

    return {
      debitNoteId,
      amount: numericAmount,
      previousBalance: currentBalance,
      balance: nextBalance,
      legacy: true,
    };
  });
}

export async function deleteTicketByAudit({
  ticketId,
  clientId,
  clientName = "",
  reason,
  author = "Sistema",
  actorUid = null,
}) {
  const id = cleanText(ticketId);
  const expectedClientId = cleanText(clientId);
  const cleanReason = cleanText(reason);

  if (!id) {
    throw new Error("TICKET_ID_REQUIRED");
  }

  if (!cleanReason) {
    throw new Error("AUDIT_REASON_REQUIRED");
  }

  const ticketRef = doc(db, "tickets", id);
  const actor = normalizeActor({ author, actorUid });

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ticketRef);

    if (!snapshot.exists()) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const ticket = snapshot.data();
    const ticketClientId = cleanText(ticket.clienteId);

    if (
      expectedClientId &&
      ticketClientId &&
      ticketClientId !== expectedClientId
    ) {
      throw new Error("TICKET_CLIENT_MISMATCH");
    }

    const nowISO = new Date().toISOString();

    transaction.set(auditRef("ticket"), {
      accion: "TICKET_ELIMINADO",
      clienteId: expectedClientId || ticketClientId || null,
      cliente:
        cleanText(clientName) ||
        cleanText(ticket.cliente) ||
        "Cliente",
      entidad: "ticket",
      entidadId: id,
      ticketNumero: cleanText(ticket.numero || ticket.codigo || ticket.nro) || id,
      motivo: cleanReason,
      snapshot: {
        ...ticket,
        id,
      },
      ...actor,
      creadoEn: nowISO,
    });

    transaction.delete(ticketRef);

    return {
      id,
      deleted: true,
    };
  });
}

export async function deleteClientByAudit({
  client,
  reason,
  summary = {},
  author = "Sistema",
  actorUid = null,
}) {
  const id = cleanText(client?.id);
  const cleanReason = cleanText(reason);

  if (!id) {
    throw new Error("CLIENT_ID_REQUIRED");
  }

  if (!cleanReason) {
    throw new Error("AUDIT_REASON_REQUIRED");
  }

  const clientRef = doc(db, "clientes", id);
  const actor = normalizeActor({ author, actorUid });

  /*
   * Antes de borrar al cliente localizamos TODOS sus tickets.
   *
   * - Los tickets nuevos se vinculan por clienteId.
   * - Algunos tickets legacy pueden no tener clienteId; en ese caso
   *   usamos el nombre exacto solamente si el ticket no tiene otro ID.
   *
   * Los documentos financieros/fiscales NO se borran. Solamente el
   * cliente y sus tickets operativos, dejando snapshot en Auditoría.
   */
  const clientNameFromPayload = getDisplayName(client);
  const byIdSnapshot = await getDocs(
    query(
      collection(db, "tickets"),
      where("clienteId", "==", id)
    )
  );

  let byNameSnapshot = null;

  if (clientNameFromPayload) {
    byNameSnapshot = await getDocs(
      query(
        collection(db, "tickets"),
        where("cliente", "==", clientNameFromPayload)
      )
    );
  }

  const ticketCandidates = new Map();

  const addTicketCandidate = (ticketDoc) => {
    const data = ticketDoc.data();
    const linkedClientId = cleanText(data?.clienteId);
    const linkedClientName = cleanText(data?.cliente).toLowerCase();
    const expectedName = cleanText(clientNameFromPayload).toLowerCase();

    const belongsById = linkedClientId === id;
    const belongsLegacyByName =
      !linkedClientId &&
      Boolean(expectedName) &&
      linkedClientName === expectedName;

    if (belongsById || belongsLegacyByName) {
      ticketCandidates.set(ticketDoc.id, {
        ref: ticketDoc.ref,
        data,
      });
    }
  };

  byIdSnapshot.docs.forEach(addTicketCandidate);
  byNameSnapshot?.docs?.forEach(addTicketCandidate);

  if (ticketCandidates.size > 200) {
    const error = new Error("AUDIT_TOO_MANY_TICKETS");
    error.count = ticketCandidates.size;
    throw error;
  }

  const ticketRefs = Array.from(ticketCandidates.values()).map(
    (ticket) => ticket.ref
  );

  return runTransaction(db, async (transaction) => {
    /* IMPORTANTE: todas las lecturas se hacen antes de cualquier escritura. */
    const snapshot = await transaction.get(clientRef);

    if (!snapshot.exists()) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const ticketSnapshots = [];

    for (const ticketRef of ticketRefs) {
      ticketSnapshots.push(await transaction.get(ticketRef));
    }

    const storedClient = snapshot.data();
    const now = new Date();
    const nowISO = now.toISOString();
    const clientName = getDisplayName(storedClient);
    const balance = toNumber(storedClient.saldoAFavor);
    let deletedTickets = 0;

    if (Math.abs(balance) > 0.0001) {
      const movementRef = doc(
        db,
        "cuenta_corriente",
        `audit_close_${id}_${Date.now()}`
      );

      transaction.set(movementRef, {
        id: movementRef.id,
        clienteId: id,
        cliente: clientName,
        clienteEliminado: true,
        tipo: balance > 0 ? "Débito" : "Crédito",
        concepto: "Cierre de saldo por eliminación administrativa",
        importe: Math.abs(balance),
        saldoAnterior: balance,
        saldoPosterior: 0,
        origen: "Auditoría interna",
        motivo: cleanReason,
        fecha: getISODate(now),
        hora: getISOTime(now),
        creadoEn: nowISO,
        usuario: actor.actorNombre,
        actorUid: actor.actorUid,
      });
    }

    /*
     * Eliminación en cascada de tickets operativos.
     * Cada ticket conserva una copia íntegra en auditoria_clientes.
     */
    ticketSnapshots.forEach((ticketSnapshot) => {
      if (!ticketSnapshot.exists()) {
        return;
      }

      const ticket = ticketSnapshot.data();
      const ticketId = ticketSnapshot.id;

      transaction.set(auditRef("ticket_cascade"), {
        accion: "TICKET_ELIMINADO_POR_CLIENTE",
        clienteId: id,
        cliente: clientName,
        entidad: "ticket",
        entidadId: ticketId,
        ticketNumero:
          cleanText(ticket.numero || ticket.codigo || ticket.nro) || ticketId,
        motivo: cleanReason,
        origenEliminacion: "CLIENTE_ELIMINADO",
        snapshot: {
          ...ticket,
          id: ticketId,
        },
        ...actor,
        creadoEn: nowISO,
      });

      transaction.delete(ticketSnapshot.ref);
      deletedTickets += 1;
    });

    transaction.set(auditRef("cliente"), {
      accion: "CLIENTE_ELIMINADO",
      clienteId: id,
      cliente: clientName,
      entidad: "cliente",
      entidadId: id,
      motivo: cleanReason,
      resumen: {
        tickets: deletedTickets,
        ticketsDetectadosAntes: toNumber(summary.tickets),
        ventas: toNumber(summary.ventas),
        facturas: toNumber(summary.facturas),
        creditos: toNumber(summary.creditos),
        presupuestos: toNumber(summary.presupuestos),
        cuentaCorriente: toNumber(summary.cuentaCorriente),
        deuda: toNumber(summary.deuda),
        saldoFavor: balance,
      },
      snapshot: {
        ...storedClient,
        id,
      },
      ...actor,
      creadoEn: nowISO,
    });

    transaction.delete(clientRef);

    return {
      id,
      deleted: true,
      deletedTickets,
      closedBalance: balance,
    };
  });
}



/* =========================================
   LIMPIEZA DE TICKETS HUÉRFANOS
   Clientes eliminados antes de la cascada
========================================= */

export async function cleanupTicketsFromDeletedClients({
  author = "Sistema",
  actorUid = null,
} = {}) {
  const actor = normalizeActor({ author, actorUid });

  const [auditSnapshot, ticketsSnapshot, clientsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "auditoria_clientes"),
        where("accion", "==", "CLIENTE_ELIMINADO")
      )
    ),
    getDocs(collection(db, "tickets")),
    getDocs(collection(db, "clientes")),
  ]);

  const deletedClientIds = new Set();
  const deletedClientNames = new Set();

  auditSnapshot.docs.forEach((item) => {
    const data = item.data();
    const clientId = cleanText(data?.clienteId || data?.entidadId);
    const clientName = cleanText(
      data?.cliente ||
      data?.snapshot?.razonSocial ||
      `${data?.snapshot?.nombre || ""} ${data?.snapshot?.apellido || ""}`
    ).toLowerCase();

    if (clientId) deletedClientIds.add(clientId);
    if (clientName) deletedClientNames.add(clientName);
  });

  const activeClientNames = new Set(
    clientsSnapshot.docs
      .map((item) => getDisplayName({ ...item.data(), id: item.id }).toLowerCase())
      .filter(Boolean)
  );

  const orphanTickets = ticketsSnapshot.docs.filter((item) => {
    const ticket = item.data();
    const clientId = cleanText(ticket?.clienteId);
    const clientName = cleanText(ticket?.cliente).toLowerCase();

    if (clientId) {
      return deletedClientIds.has(clientId);
    }

    return Boolean(
      clientName &&
      deletedClientNames.has(clientName) &&
      !activeClientNames.has(clientName)
    );
  });

  if (!orphanTickets.length) {
    return {
      deletedTickets: 0,
    };
  }

  const nowISO = new Date().toISOString();
  let deletedTickets = 0;
  const chunkSize = 200;

  for (let index = 0; index < orphanTickets.length; index += chunkSize) {
    const chunk = orphanTickets.slice(index, index + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((ticketSnapshot) => {
      const ticket = ticketSnapshot.data();
      const ticketId = ticketSnapshot.id;

      batch.set(auditRef("ticket_orphan"), {
        accion: "TICKET_HUERFANO_ELIMINADO",
        clienteId: cleanText(ticket?.clienteId) || null,
        cliente: cleanText(ticket?.cliente) || "Cliente eliminado",
        entidad: "ticket",
        entidadId: ticketId,
        ticketNumero:
          cleanText(ticket?.numero || ticket?.codigo || ticket?.nro) || ticketId,
        motivo: "Limpieza administrativa de ticket perteneciente a cliente eliminado previamente.",
        origenEliminacion: "LIMPIEZA_HUERFANOS",
        snapshot: {
          ...ticket,
          id: ticketId,
        },
        ...actor,
        creadoEn: nowISO,
      });

      batch.delete(ticketSnapshot.ref);
      deletedTickets += 1;
    });

    await batch.commit();
  }

  return {
    deletedTickets,
  };
}
