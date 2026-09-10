import {
  collection,
  doc,
  getDocs,
  onSnapshot,
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

function getISODate(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function getISOTime(date) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function getSortableDate(
  invoice
) {
  const date =
    cleanText(
      invoice?.fecha
    );

  const time =
    cleanText(
      invoice?.hora
    );

  if (!date) {
    return 0;
  }

  const value =
    new Date(
      `${date}T${time || "00:00"}`
    );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return 0;
  }

  return value.getTime();
}

/* =========================================
   ITEMS
========================================= */

export function normalizeInvoiceItems(
  invoice
) {
  const items =
    Array.isArray(
      invoice?.items
    )
      ? invoice.items
      : [];

  return items.map(
    (
      item,
      index
    ) => {
      const description =
        cleanText(
          item.desc ||
          item.descripcion ||
          item.nombre ||
          item.concepto
        ) ||
        `Concepto ${index + 1}`;

      const quantity =
        Number(
          item.cant ??
          item.cantidad ??
          1
        ) || 1;

      const price =
        Number(
          item.precio ??
          item.price ??
          0
        ) || 0;

      const storedSubtotal =
        Number(
          item.subtotal
        );

      return {
        description,

        quantity,

        price,

        subtotal:
          Number.isFinite(
            storedSubtotal
          )
            ? storedSubtotal
            : quantity *
              price,
      };
    }
  );
}

/* =========================================
   REALTIME
========================================= */

export function subscribeToInvoices(
  onData,
  onError
) {
  const invoicesRef =
    collection(
      db,
      "facturas"
    );

  return onSnapshot(
    invoicesRef,

    (
      snapshot
    ) => {
      const invoices =
        snapshot.docs
          .map(
            (
              documentSnapshot
            ) => ({
              id:
                documentSnapshot.id,

              ...documentSnapshot.data(),
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              getSortableDate(
                b
              ) -
              getSortableDate(
                a
              )
          );

      onData(
        invoices
      );
    },

    onError
  );
}

/* =========================================
   BUSCAR NC YA EXISTENTE
========================================= */

async function findCreditNoteByInvoice(
  invoiceId
) {
  const notesQuery =
    query(
      collection(
        db,
        "facturas"
      ),

      where(
        "tipo",
        "==",
        "Nota de Crédito"
      ),

      where(
        "refId",
        "==",
        invoiceId
      )
    );

  const snapshot =
    await getDocs(
      notesQuery
    );

  return (
    snapshot.docs[0]?.id ||
    null
  );
}

/* =========================================
   ANULAR FACTURA
   + NOTA DE CRÉDITO
   + SALDO A FAVOR
========================================= */

export async function annulInvoice(
  invoiceId,
  reason = "",
  author = "Sistema"
) {
  const cleanInvoiceId =
    cleanText(
      invoiceId
    );

  if (!cleanInvoiceId) {
    throw new Error(
      "INVOICE_ID_REQUIRED"
    );
  }

  const existingCreditNote =
    await findCreditNoteByInvoice(
      cleanInvoiceId
    );

  if (
    existingCreditNote
  ) {
    throw new Error(
      "INVOICE_ALREADY_CREDITED"
    );
  }

  const invoiceRef =
    doc(
      db,
      "facturas",
      cleanInvoiceId
    );

  const counterRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         FACTURA ORIGINAL
      ================================= */

      const invoiceSnapshot =
        await transaction.get(
          invoiceRef
        );

      if (
        !invoiceSnapshot.exists()
      ) {
        throw new Error(
          "INVOICE_NOT_FOUND"
        );
      }

      const invoice =
        invoiceSnapshot.data();

      if (
        invoice.tipo &&
        invoice.tipo !==
          "Factura"
      ) {
        throw new Error(
          "INVOICE_INVALID_TYPE"
        );
      }

      if (
        invoice.estado ===
          "Anulada" ||
        invoice.estado ===
          "Cancelada"
      ) {
        throw new Error(
          "INVOICE_ALREADY_CLOSED"
        );
      }

      if (
        invoice.estado !==
        "Emitida"
      ) {
        throw new Error(
          "INVOICE_NOT_ISSUED"
        );
      }

      /*
       * Una factura pagada se anula
       * mediante Nota de Crédito.
       */

      if (
        invoice.estadoPago !==
        "Pagado Total" &&
        invoice.estadoPago !==
        "Pagado"
      ) {
        throw new Error(
          "INVOICE_NOT_PAID"
        );
      }

      /* =================================
         CONTADOR NC
      ================================= */

      const counterSnapshot =
        await transaction.get(
          counterRef
        );

      let nextNumber =
        1;

      if (
        counterSnapshot.exists()
      ) {
        const current =
          Number(
            counterSnapshot.data()
              ?.nc
          );

        if (
          Number.isFinite(
            current
          )
        ) {
          nextNumber =
            current + 1;
        }
      }

      /*
       * Buscamos un número libre
       * por seguridad si el contador
       * viejo quedó desfasado.
       */

      let noteId =
        "";

      let noteRef =
        null;

      let noteSnapshot =
        null;

      do {
        noteId =
          `NC-${String(
            nextNumber
          ).padStart(
            4,
            "0"
          )}`;

        noteRef =
          doc(
            db,
            "facturas",
            noteId
          );

        noteSnapshot =
          await transaction.get(
            noteRef
          );

        if (
          noteSnapshot.exists()
        ) {
          nextNumber +=
            1;
        }
      } while (
        noteSnapshot.exists()
      );

      /* =================================
         CLIENTE
      ================================= */

      let clientRef =
        null;

      let clientSnapshot =
        null;

      if (
        invoice.clienteId
      ) {
        clientRef =
          doc(
            db,
            "clientes",
            invoice.clienteId
          );

        clientSnapshot =
          await transaction.get(
            clientRef
          );
      }

      /* =================================
         TICKET
      ================================= */

      let ticketRef =
        null;

      let ticketSnapshot =
        null;

      if (
        invoice.refModulo ===
          "Ticket" &&
        invoice.refId &&
        invoice.refId !==
          "—"
      ) {
        ticketRef =
          doc(
            db,
            "tickets",
            invoice.refId
          );

        ticketSnapshot =
          await transaction.get(
            ticketRef
          );
      }

      /* =================================
         FECHAS
      ================================= */

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const historyDate =
        formatDateTimeAR(
          now
        );

      const safeAuthor =
        cleanText(
          author
        ) ||
        "Sistema";

      const cleanReason =
        cleanText(
          reason
        );

      const amount =
        Number(
          invoice.total ||
          0
        );

      /* =================================
         HISTORIAL FACTURA
      ================================= */

      const invoiceHistory =
        Array.isArray(
          invoice.historial
        )
          ? invoice.historial
          : [];

      const invoiceEntry = {
        fecha:
          historyDate,

        accion:
          "Comprobante anulado",

        detalle:
          cleanReason
            ? `Nota de Crédito ${noteId}. Motivo: ${cleanReason}. Usuario: ${safeAuthor}`
            : `Nota de Crédito ${noteId}. Devolución acreditada como saldo a favor. Usuario: ${safeAuthor}`,
      };

      /* =================================
         ACTUALIZAR FACTURA
      ================================= */

      transaction.update(
        invoiceRef,

        {
          estado:
            "Anulada",

          notaCreditoId:
            noteId,

          anuladaEn:
            nowISO,

          actualizadoEn:
            nowISO,

          historial: [
            ...invoiceHistory,
            invoiceEntry,
          ],
        }
      );

      /* =================================
         CREAR NOTA DE CRÉDITO
      ================================= */

      const creditNote = {
        id:
          noteId,

        fecha:
          getISODate(
            now
          ),

        hora:
          getISOTime(
            now
          ),

        cliente:
          invoice.cliente ||
          "Consumidor Final",

        doc:
          invoice.doc ||
          "C.F.",

        clienteId:
          invoice.clienteId ||
          null,

        tipo:
          "Nota de Crédito",

        refModulo:
          "Factura",

        refId:
          cleanInvoiceId,

        refPago:
          invoice.refPago ||
          "—",

        estado:
          "Emitida",

        total:
          amount,

        items:
          Array.isArray(
            invoice.items
          )
            ? invoice.items
            : [],

        usuario:
          safeAuthor,

        estadoPago:
          "Aplicada",

        motivo:
          cleanReason,

        facturaOrigenId:
          cleanInvoiceId,

        creadoEn:
          nowISO,

        actualizadoEn:
          nowISO,

        historial: [
          {
            fecha:
              historyDate,

            accion:
              "Emisión Nota de Crédito",

            detalle:
              cleanReason
                ? `Anula ${cleanInvoiceId}. Motivo: ${cleanReason}. Usuario: ${safeAuthor}`
                : `Anula ${cleanInvoiceId}. Importe acreditado como saldo a favor. Usuario: ${safeAuthor}`,
          },
        ],
      };

      transaction.set(
        noteRef,
        creditNote
      );

      /* =================================
         CONTADOR
      ================================= */

      transaction.set(
        counterRef,

        {
          nc:
            nextNumber,
        },

        {
          merge: true,
        }
      );

      /* =================================
         SALDO A FAVOR
      ================================= */

      let balanceCredited =
        false;

      if (
        clientRef &&
        clientSnapshot?.exists()
      ) {
        const currentBalance =
          Number(
            clientSnapshot.data()
              ?.saldoAFavor ||
            0
          );

        transaction.update(
          clientRef,

          {
            saldoAFavor:
              currentBalance +
              amount,
          }
        );

        balanceCredited =
          true;
      }

      /* =================================
         HISTORIAL TICKET
      ================================= */

      if (
        ticketRef &&
        ticketSnapshot?.exists()
      ) {
        const ticket =
          ticketSnapshot.data();

        const ticketHistory =
          Array.isArray(
            ticket.historial
          )
            ? ticket.historial
            : [];

        transaction.update(
          ticketRef,

          {
            facturaAnulada:
              true,

            notaCreditoId:
              noteId,

            actualizadoEn:
              nowISO,

            historial: [
              ...ticketHistory,

              {
                fecha:
                  historyDate,

                accion:
                  "Factura anulada",

                detalle:
                  `Factura ${cleanInvoiceId} anulada mediante ${noteId}. Usuario: ${safeAuthor}`,

                autor:
                  safeAuthor,
              },
            ],
          }
        );
      }

      return {
        invoiceId:
          cleanInvoiceId,

        creditNoteId:
          noteId,

        amount,

        clientId:
          invoice.clienteId ||
          null,

        balanceCredited,

        ticketId:
          invoice.refModulo ===
            "Ticket"
            ? invoice.refId
            : null,
      };
    }
  );
}

/* =========================================
   CANCELAR FACTURA NO PAGADA
========================================= */

export async function cancelInvoice(
  invoiceId,
  reason = "",
  author = "Sistema"
) {
  const cleanInvoiceId =
    cleanText(
      invoiceId
    );

  if (!cleanInvoiceId) {
    throw new Error(
      "INVOICE_ID_REQUIRED"
    );
  }

  const invoiceRef =
    doc(
      db,
      "facturas",
      cleanInvoiceId
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      const invoiceSnapshot =
        await transaction.get(
          invoiceRef
        );

      if (
        !invoiceSnapshot.exists()
      ) {
        throw new Error(
          "INVOICE_NOT_FOUND"
        );
      }

      const invoice =
        invoiceSnapshot.data();

      if (
        invoice.tipo &&
        invoice.tipo !==
          "Factura"
      ) {
        throw new Error(
          "INVOICE_INVALID_TYPE"
        );
      }

      if (
        invoice.estado !==
        "Emitida"
      ) {
        throw new Error(
          "INVOICE_NOT_ISSUED"
        );
      }

      /*
       * Si ya fue pagada,
       * no se cancela:
       * debe anularse con NC.
       */

      if (
        invoice.estadoPago ===
          "Pagado Total" ||
        invoice.estadoPago ===
          "Pagado"
      ) {
        throw new Error(
          "INVOICE_IS_PAID"
        );
      }

      const now =
        new Date();

      const safeAuthor =
        cleanText(
          author
        ) ||
        "Sistema";

      const cleanReason =
        cleanText(
          reason
        );

      const history =
        Array.isArray(
          invoice.historial
        )
          ? invoice.historial
          : [];

      transaction.update(
        invoiceRef,

        {
          estado:
            "Cancelada",

          canceladaEn:
            now.toISOString(),

          actualizadoEn:
            now.toISOString(),

          historial: [
            ...history,

            {
              fecha:
                formatDateTimeAR(
                  now
                ),

              accion:
                "Comprobante cancelado",

              detalle:
                cleanReason
                  ? `Motivo: ${cleanReason}. Usuario: ${safeAuthor}`
                  : `Cancelado sin movimiento de dinero. Usuario: ${safeAuthor}`,
            },
          ],
        }
      );

      return {
        invoiceId:
          cleanInvoiceId,

        state:
          "Cancelada",
      };
    }
  );
}