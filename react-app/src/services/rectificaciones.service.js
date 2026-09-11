import {
  doc,
  runTransaction,
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

/* =========================================
   AGREGAR RECTIFICACIÓN
========================================= */

export async function addInvoiceRectification(
  invoiceId,
  observation,
  author = "Sistema"
) {
  const cleanInvoiceId =
    cleanText(
      invoiceId
    );

  const cleanObservation =
    cleanText(
      observation
    );

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  if (!cleanInvoiceId) {
    throw new Error(
      "INVOICE_ID_REQUIRED"
    );
  }

  if (!cleanObservation) {
    throw new Error(
      "RECTIFICATION_REQUIRED"
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
      const snapshot =
        await transaction.get(
          invoiceRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "INVOICE_NOT_FOUND"
        );
      }

      const invoice =
        snapshot.data();

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
       * Rectificación interna:
       *
       * - no cambia total
       * - no cambia estado de pago
       * - no genera NC
       * - agrega trazabilidad
       */

      const history =
        Array.isArray(
          invoice.historial
        )
          ? invoice.historial
          : [];

      const now =
        new Date();

      const entry = {
        fecha:
          formatDateTimeAR(
            now
          ),

        accion:
          "Rectificación",

        detalle:
          `Nota: ${cleanObservation} - Usuario: ${cleanAuthor}`,

        autor:
          cleanAuthor,
      };

      transaction.update(
        invoiceRef,

        {
          historial: [
            ...history,
            entry,
          ],

          ultimaRectificacion:
            cleanObservation,

          rectificadoEn:
            now.toISOString(),

          actualizadoEn:
            now.toISOString(),
        }
      );

      return {
        invoiceId:
          cleanInvoiceId,

        entry,
      };
    }
  );
}