import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function formatHistoryDate(
  date = new Date()
) {
  return date.toLocaleString(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function createHistoryEntry({
  author = "Sistema",
  action,
  detail = "",
}) {
  return {
    fecha:
      formatHistoryDate(),

    autor:
      cleanText(
        author
      ) ||
      "Sistema",

    accion:
      cleanText(
        action
      ),

    detalle:
      cleanText(
        detail
      ),
  };
}

/* =========================================
   TOKEN
========================================= */

function isValidToken(
  value
) {
  return /^[a-f0-9]{48}$/i.test(
    cleanText(
      value
    )
  );
}

function createSecureToken() {
  if (
    typeof crypto ===
      "undefined" ||
    !crypto.getRandomValues
  ) {
    throw new Error(
      "PUBLIC_TOKEN_UNAVAILABLE"
    );
  }

  const bytes =
    new Uint8Array(
      24
    );

  crypto.getRandomValues(
    bytes
  );

  return Array.from(
    bytes
  )
    .map(
      (
        byte
      ) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

/* =========================================
   DECISIÓN
========================================= */

function normalizeDecision(
  value
) {
  const decision =
    cleanText(
      value
    ).toLowerCase();

  if (
    decision ===
      "aceptado" ||
    decision ===
      "aceptar" ||
    decision ===
      "aprobado" ||
    decision ===
      "aprobar"
  ) {
    return "Aceptado";
  }

  if (
    decision ===
      "rechazado" ||
    decision ===
      "rechazar"
  ) {
    return "Rechazado";
  }

  throw new Error(
    "PUBLIC_RESPONSE_INVALID"
  );
}

/* =========================================
   VENCIMIENTO

   Se interpreta YYYY-MM-DD al final
   del día en Argentina (-03:00).
========================================= */

function createExpirationTimestamp(
  dateValue
) {
  const cleanDate =
    cleanText(
      dateValue
    );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      cleanDate
    )
  ) {
    return null;
  }

  const expiration =
    new Date(
      `${cleanDate}T23:59:59.999-03:00`
    );

  if (
    Number.isNaN(
      expiration.getTime()
    )
  ) {
    return null;
  }

  return Timestamp.fromDate(
    expiration
  );
}

function isExpired(
  dateValue
) {
  const cleanDate =
    cleanText(
      dateValue
    );

  if (
    !cleanDate
  ) {
    return false;
  }

  const expiration =
    new Date(
      `${cleanDate}T23:59:59.999-03:00`
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

/* =========================================
   ITEMS
========================================= */

function normalizeItems(
  items
) {
  if (
    !Array.isArray(
      items
    )
  ) {
    return [];
  }

  return items.map(
    (
      item
    ) => {
      const quantity =
        Math.max(
          1,
          toNumber(
            item.cantidad ??
              item.cant,
            1
          )
        );

      const price =
        Math.max(
          0,
          toNumber(
            item.precio ??
              item.costo,
            0
          )
        );

      return {
        descripcion:
          cleanText(
            item.descripcion ??
              item.desc ??
              item.nombre
          ) ||
          "Concepto",

        cantidad:
          quantity,

        precio:
          roundMoney(
            price
          ),

        subtotal:
          roundMoney(
            item.subtotal ??
              quantity *
                price
          ),
      };
    }
  );
}

/* =========================================
   EQUIPO
========================================= */

function getEquipmentText(
  ticket
) {
  if (
    !ticket
  ) {
    return "";
  }

  const parts = [
    ticket.equipo,
    ticket.marca,
    ticket.modelo,
  ]
    .map(
      cleanText
    )
    .filter(
      Boolean
    );

  return parts.join(
    " · "
  );
}

/* =========================================
   AUTH
========================================= */

function assertLoggedIn() {
  if (
    !auth.currentUser
  ) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }
}

/* =========================================
   URL PÚBLICA
========================================= */

export function getPublicBudgetUrl(
  token
) {
  const cleanToken =
    cleanText(
      token
    );

  if (
    !cleanToken
  ) {
    return "";
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return (
      `/presupuesto/${cleanToken}`
    );
  }

  return (
    `${window.location.origin}/presupuesto/${cleanToken}`
  );
}

/* =========================================
   PUBLICAR / ACTUALIZAR ENLACE PÚBLICO
========================================= */

export async function publishBudget(
  budgetId,
  author = "Sistema"
) {
  assertLoggedIn();

  const cleanBudgetId =
    cleanText(
      budgetId
    );

  if (
    !cleanBudgetId
  ) {
    throw new Error(
      "BUDGET_REQUIRED"
    );
  }

  const budgetRef =
    doc(
      db,
      "presupuestos",
      cleanBudgetId
    );

  let result =
    null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         PRESUPUESTO INTERNO
      ================================= */

      const budgetSnapshot =
        await transaction.get(
          budgetRef
        );

      if (
        !budgetSnapshot.exists()
      ) {
        throw new Error(
          "BUDGET_NOT_FOUND"
        );
      }

      const budget = {
        id:
          budgetSnapshot.id,

        ...budgetSnapshot.data(),
      };

      if (
        budget.estado !==
        "Pendiente"
      ) {
        throw new Error(
          "BUDGET_NOT_PENDING"
        );
      }

      const expirationDate =
        budget.fechaVencimiento ||
        budget.vigencia ||
        null;

      if (
        isExpired(
          expirationDate
        )
      ) {
        throw new Error(
          "BUDGET_EXPIRED"
        );
      }

      const expirationTimestamp =
        createExpirationTimestamp(
          expirationDate
        );

      if (
        !expirationTimestamp
      ) {
        throw new Error(
          "BUDGET_EXPIRATION_INVALID"
        );
      }

      /* =================================
         TICKET
      ================================= */

      let ticket =
        null;

      if (
        budget.ticketId
      ) {
        const ticketRef =
          doc(
            db,
            "tickets",
            String(
              budget.ticketId
            )
          );

        const ticketSnapshot =
          await transaction.get(
            ticketRef
          );

        if (
          ticketSnapshot.exists()
        ) {
          ticket = {
            id:
              ticketSnapshot.id,

            ...ticketSnapshot.data(),
          };
        }
      }

      /* =================================
         TOKEN
      ================================= */

      const existingToken =
        cleanText(
          budget.publicToken
        );

      const token =
        isValidToken(
          existingToken
        )
          ? existingToken
          : createSecureToken();

      const publicRef =
        doc(
          db,
          "presupuestos_publicos",
          token
        );

      const publicSnapshot =
        await transaction.get(
          publicRef
        );

      const previousPublic =
        publicSnapshot.exists()
          ? publicSnapshot.data()
          : null;

      if (
        previousPublic?.presupuestoId &&
        cleanText(
          previousPublic.presupuestoId
        ) !==
          cleanBudgetId
      ) {
        throw new Error(
          "PUBLIC_TOKEN_CONFLICT"
        );
      }

      const nowISO =
        new Date()
          .toISOString();

      /* =================================
         ITEMS
      ================================= */

      const items =
        normalizeItems(
          budget.items
        );

      const subtotal =
        roundMoney(
          budget.subtotal ??
            items.reduce(
              (
                sum,
                item
              ) =>
                sum +
                item.subtotal,
              0
            )
        );

      const discount =
        roundMoney(
          budget.descuento ??
            budget.descuentoImporte ??
            0
        );

      const total =
        roundMoney(
          budget.total ??
            budget.presupuestoTotal ??
            0
        );

      /* =================================
         DOCUMENTO PÚBLICO
      ================================= */

      const publicData = {
        token,

        presupuestoId:
          cleanBudgetId,

        numero:
          budget.numero ||
          cleanBudgetId,

        origen:
          budget.origen ||
          (
            budget.ticketId
              ? "Ticket"
              : "Manual"
          ),

        ticketId:
          budget.ticketId ||
          null,

        ticketNumero:
          budget.ticketNumero ||
          budget.ticketId ||
          null,

        /* =================================
           DATOS PÚBLICOS

           No copiamos:
           DNI
           CUIT
           teléfono
           dirección
           email
           PIN
           IMEI
        ================================= */

        cliente:
          cleanText(
            budget.cliente
          ) ||
          "Cliente",

        equipo:
          getEquipmentText(
            ticket
          ),

        falla:
          cleanText(
            ticket?.falla
          ),

        diagnostico:
          cleanText(
            ticket?.diagnostico
          ),

        items,

        subtotal,

        descuento:
          discount,

        descuentoPorcentaje:
          toNumber(
            budget.descuentoPorcentaje,
            0
          ),

        total,

        observaciones:
          cleanText(
            budget.observaciones
          ),

        fecha:
          budget.fecha ||
          null,

        /*
         * Texto para mostrar en la UI.
         */
        fechaVencimiento:
          expirationDate,

        /*
         * Timestamp real para Firestore Rules.
         */
        venceEn:
          expirationTimestamp,

        /*
         * Si el cliente ya respondió,
         * republicar NO borra la respuesta.
         */
        estado:
          previousPublic?.respuesta ||
          "Pendiente",

        activo:
          previousPublic?.activo !==
          false,

        respuesta:
          previousPublic?.respuesta ||
          null,

        respondidoEn:
          previousPublic?.respondidoEn ||
          null,

        aplicadoEn:
          previousPublic?.aplicadoEn ||
          null,

        aplicadoPor:
          previousPublic?.aplicadoPor ||
          null,

        publicadoEn:
          previousPublic?.publicadoEn ||
          nowISO,

        actualizadoEn:
          nowISO,
      };

      /* =================================
         GUARDAR DOCUMENTO PÚBLICO
      ================================= */

      transaction.set(
        publicRef,
        publicData
      );

      /* =================================
         ACTUALIZAR PRESUPUESTO INTERNO
      ================================= */

      transaction.update(
        budgetRef,
        {
          publicToken:
            token,

          publicado:
            true,

          publicadoEn:
            budget.publicadoEn ||
            nowISO,

          actualizadoEn:
            nowISO,

          actualizadoPor:
            cleanText(
              author
            ) ||
            "Sistema",
        }
      );

      result = {
        token,

        budgetId:
          cleanBudgetId,

        url:
          getPublicBudgetUrl(
            token
          ),

        reused:
          isValidToken(
            existingToken
          ),
      };
    }
  );

  return result;
}

/* =========================================
   SUSCRIPCIÓN PÚBLICA
========================================= */

export function subscribeToPublicBudget(
  token,
  onData,
  onError
) {
  const cleanToken =
    cleanText(
      token
    );

  if (
    !isValidToken(
      cleanToken
    )
  ) {
    onData?.(
      null
    );

    return () => {};
  }

  const publicRef =
    doc(
      db,
      "presupuestos_publicos",
      cleanToken
    );

  return onSnapshot(
    publicRef,

    (
      snapshot
    ) => {
      if (
        !snapshot.exists()
      ) {
        onData?.(
          null
        );

        return;
      }

      onData?.({
        id:
          snapshot.id,

        ...snapshot.data(),
      });
    },

    (
      error
    ) => {
      console.error(
        "Error cargando presupuesto público:",
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================
   RESPONDER PRESUPUESTO PÚBLICO

   Solo modifica:
   presupuestos_publicos/{token}
========================================= */

export async function respondToPublicBudget(
  token,
  decision
) {
  const cleanToken =
    cleanText(
      token
    );

  if (
    !isValidToken(
      cleanToken
    )
  ) {
    throw new Error(
      "PUBLIC_TOKEN_INVALID"
    );
  }

  const response =
    normalizeDecision(
      decision
    );

  const publicRef =
    doc(
      db,
      "presupuestos_publicos",
      cleanToken
    );

  let result =
    null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          publicRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "PUBLIC_BUDGET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.activo !==
        true
      ) {
        throw new Error(
          "PUBLIC_BUDGET_DISABLED"
        );
      }

      if (
        data.respuesta
      ) {
        throw new Error(
          "PUBLIC_BUDGET_ALREADY_RESPONDED"
        );
      }

      if (
        isExpired(
          data.fechaVencimiento
        )
      ) {
        throw new Error(
          "BUDGET_EXPIRED"
        );
      }

      const nowISO =
        new Date()
          .toISOString();

      transaction.update(
        publicRef,
        {
          respuesta:
            response,

          respondidoEn:
            nowISO,

          estado:
            response,

          actualizadoEn:
            nowISO,
        }
      );

      result = {
        token:
          cleanToken,

        budgetId:
          data.presupuestoId,

        ticketId:
          data.ticketId ||
          null,

        response,
      };
    }
  );

  return result;
}

/* =========================================
   APLICAR RESPUESTA AL SISTEMA INTERNO
========================================= */

export async function applyPublicBudgetResponse(
  token,
  author = "Sistema"
) {
  assertLoggedIn();

  const cleanToken =
    cleanText(
      token
    );

  if (
    !isValidToken(
      cleanToken
    )
  ) {
    throw new Error(
      "PUBLIC_TOKEN_INVALID"
    );
  }

  const publicRef =
    doc(
      db,
      "presupuestos_publicos",
      cleanToken
    );

  let result =
    null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         DOCUMENTO PÚBLICO
      ================================= */

      const publicSnapshot =
        await transaction.get(
          publicRef
        );

      if (
        !publicSnapshot.exists()
      ) {
        throw new Error(
          "PUBLIC_BUDGET_NOT_FOUND"
        );
      }

      const publicData =
        publicSnapshot.data();

      if (
        !publicData.respuesta
      ) {
        throw new Error(
          "PUBLIC_RESPONSE_PENDING"
        );
      }

      if (
        publicData.aplicadoEn
      ) {
        result = {
          applied:
            false,

          alreadyApplied:
            true,

          response:
            publicData.respuesta,

          budgetId:
            publicData.presupuestoId,

          ticketId:
            publicData.ticketId ||
            null,
        };

        return;
      }

      const response =
        normalizeDecision(
          publicData.respuesta
        );

      const budgetId =
        cleanText(
          publicData.presupuestoId
        );

      if (
        !budgetId
      ) {
        throw new Error(
          "BUDGET_NOT_FOUND"
        );
      }

      /* =================================
         PRESUPUESTO INTERNO
      ================================= */

      const budgetRef =
        doc(
          db,
          "presupuestos",
          budgetId
        );

      const budgetSnapshot =
        await transaction.get(
          budgetRef
        );

      if (
        !budgetSnapshot.exists()
      ) {
        throw new Error(
          "BUDGET_NOT_FOUND"
        );
      }

      const budget =
        budgetSnapshot.data();

      if (
        budget.estado !==
          "Pendiente" &&
        budget.estado !==
          response
      ) {
        throw new Error(
          "BUDGET_NOT_PENDING"
        );
      }

      /* =================================
         TICKET
      ================================= */

      const ticketId =
        publicData.ticketId ||
        budget.ticketId ||
        null;

      let ticketRef =
        null;

      let ticket =
        null;

      if (
        ticketId
      ) {
        ticketRef =
          doc(
            db,
            "tickets",
            String(
              ticketId
            )
          );

        const ticketSnapshot =
          await transaction.get(
            ticketRef
          );

        if (
          ticketSnapshot.exists()
        ) {
          ticket =
            ticketSnapshot.data();
        }
      }

      const nowISO =
        new Date()
          .toISOString();

      const cleanAuthor =
        cleanText(
          author
        ) ||
        "Sistema";

      /* =================================
         ACTUALIZAR PRESUPUESTO
      ================================= */

      const budgetHistory =
        Array.isArray(
          budget.historial
        )
          ? budget.historial
          : [];

      transaction.update(
        budgetRef,
        {
          estado:
            response,

          respuestaPublica:
            response,

          respuestaPublicaEn:
            publicData.respondidoEn ||
            nowISO,

          presupuestoAprobado:
            response ===
            "Aceptado",

          actualizadoEn:
            nowISO,

          historial: [
            ...budgetHistory,

            createHistoryEntry({
              author:
                "Cliente (Vía Web)",

              action:
                response ===
                "Aceptado"
                  ? "Presupuesto APROBADO"
                  : "Presupuesto RECHAZADO",

              detail:
                "Respuesta registrada mediante el enlace público.",
            }),
          ],
        }
      );

      /* =================================
         ACTUALIZAR TICKET
      ================================= */

      if (
        ticketRef &&
        ticket
      ) {
        const ticketHistory =
          Array.isArray(
            ticket.historial
          )
            ? ticket.historial
            : [];

        transaction.update(
          ticketRef,
          {
            presupuestoId:
              budgetId,

            presupuestoAprobado:
              response ===
              "Aceptado",

            presupuestoEstado:
              response,

            /*
             * Conservamos por ahora el flujo
             * actual del proyecto.
             */
            stage:
              response ===
              "Aceptado"
                ? "reparacion"
                : "noreparable",

            actualizadoEn:
              nowISO,

            historial: [
              ...ticketHistory,

              createHistoryEntry({
                author:
                  "Cliente (Vía Web)",

                action:
                  response ===
                  "Aceptado"
                    ? "Presupuesto APROBADO"
                    : "Presupuesto RECHAZADO",

                detail:
                  response ===
                  "Aceptado"
                    ? `El cliente aprobó ${budgetId} desde el enlace público.`
                    : `El cliente rechazó ${budgetId} desde el enlace público.`,
              }),
            ],
          }
        );
      }

      /* =================================
         MARCAR COMO APLICADO
      ================================= */

      transaction.update(
        publicRef,
        {
          aplicadoEn:
            nowISO,

          aplicadoPor:
            cleanAuthor,

          actualizadoEn:
            nowISO,
        }
      );

      result = {
        applied:
          true,

        alreadyApplied:
          false,

        response,

        budgetId,

        ticketId:
          ticketId ||
          null,

        ticketUpdated:
          Boolean(
            ticket
          ),
      };
    }
  );

  return result;
}

/* =========================================
   CONSULTA SIMPLE
========================================= */

export async function getPublicBudget(
  token
) {
  const cleanToken =
    cleanText(
      token
    );

  if (
    !isValidToken(
      cleanToken
    )
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "presupuestos_publicos",
        cleanToken
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      snapshot.id,

    ...snapshot.data(),
  };
}

/* =========================================
   EXPORT DEFAULT
========================================= */

export default {
  publishBudget,
  getPublicBudgetUrl,
  subscribeToPublicBudget,
  respondToPublicBudget,
  applyPublicBudgetResponse,
  getPublicBudget,
};