import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";

import {
  db,
} from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function pad(value) {
  return String(value).padStart(
    2,
    "0"
  );
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
  if (
    !budget
  ) {
    throw new Error(
      "BUDGET_NOT_FOUND"
    );
  }

  if (
    budget.estado !==
    "Pendiente"
  ) {
    throw new Error(
      "BUDGET_NOT_PENDING"
    );
  }

  if (
    isBudgetExpired(
      budget
    )
  ) {
    throw new Error(
      "BUDGET_EXPIRED"
    );
  }

  if (
    budget.estadoCaja ===
    "Pendiente"
  ) {
    throw new Error(
      "BUDGET_ALREADY_IN_CASH"
    );
  }

  if (
    budget.estado ===
      "Facturado" ||
    budget.facturaId
  ) {
    throw new Error(
      "BUDGET_ALREADY_BILLED"
    );
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
            id:
              document.id,

            ...document.data(),
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
          id:
            snapshot.id,

          ...snapshot.data(),
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
  if (
    !budgetId
  ) {
    throw new Error(
      "BUDGET_REQUIRED"
    );
  }

  const cleanBudgetId =
    String(
      budgetId
    );

  const budgetRef =
    doc(
      db,
      "presupuestos",
      cleanBudgetId
    );

  let result = null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         LEER PRESUPUESTO
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

      const budget =
        budgetSnapshot.data();

      assertBudgetPending(
        budget
      );

      /* =================================
         SI TIENE TICKET, LEERLO
      ================================= */

      const ticketId =
        budget.ticketId
          ? String(
              budget.ticketId
            )
          : null;

      let ticketRef =
        null;

      let ticketData =
        null;

      if (
        ticketId
      ) {
        ticketRef =
          doc(
            db,
            "tickets",
            ticketId
          );

        const ticketSnapshot =
          await transaction.get(
            ticketRef
          );

        if (
          ticketSnapshot.exists()
        ) {
          ticketData =
            ticketSnapshot.data();
        }
      }

      const nowISO =
        new Date()
          .toISOString();

      /* =================================
         HISTORIAL PRESUPUESTO
      ================================= */

      const budgetHistoryEntry =
        createHistoryEntry({
          author,

          action:
            "Presupuesto aceptado",

          detail:
            ticketId
              ? `Presupuesto aceptado. Vinculado al Ticket ${ticketId}.`
              : "Presupuesto aceptado.",
        });

      const budgetHistory =
        Array.isArray(
          budget.historial
        )
          ? budget.historial
          : [];

      /* =================================
         ACTUALIZAR PRESUPUESTO
      ================================= */

      transaction.update(
        budgetRef,
        {
          estado:
            "Aceptado",

          actualizadoEn:
            nowISO,

          historial: [
            ...budgetHistory,
            budgetHistoryEntry,
          ],
        }
      );

      /* =================================
         ACTUALIZAR TICKET
      ================================= */

      if (
        ticketRef &&
        ticketData
      ) {
        const ticketHistoryEntry =
          createHistoryEntry({
            author,

            action:
              "Presupuesto APROBADO",

            detail:
              `Presupuesto ${cleanBudgetId} aceptado. El ticket pasa a reparación.`,
          });

        const ticketHistory =
          Array.isArray(
            ticketData.historial
          )
            ? ticketData.historial
            : [];

        transaction.update(
          ticketRef,
          {
            presupuestoAprobado:
              true,

            presupuestoEstado:
              "Aceptado",

            presupuestoId:
              cleanBudgetId,

            stage:
              "reparacion",

            historial: [
              ...ticketHistory,
              ticketHistoryEntry,
            ],
          }
        );
      }

      result = {
        budgetId:
          cleanBudgetId,

        ticketId,

        state:
          "Aceptado",

        ticketUpdated:
          Boolean(
            ticketData
          ),
      };
    }
  );

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
  if (
    !budgetId
  ) {
    throw new Error(
      "BUDGET_REQUIRED"
    );
  }

  const cleanBudgetId =
    String(
      budgetId
    );

  const cleanReason =
    String(
      reason ||
        ""
    ).trim();

  const budgetRef =
    doc(
      db,
      "presupuestos",
      cleanBudgetId
    );

  let result = null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         PRESUPUESTO
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

      const budget =
        budgetSnapshot.data();

      assertBudgetPending(
        budget
      );

      /* =================================
         TICKET
      ================================= */

      const ticketId =
        budget.ticketId
          ? String(
              budget.ticketId
            )
          : null;

      let ticketRef =
        null;

      let ticketData =
        null;

      if (
        ticketId
      ) {
        ticketRef =
          doc(
            db,
            "tickets",
            ticketId
          );

        const ticketSnapshot =
          await transaction.get(
            ticketRef
          );

        if (
          ticketSnapshot.exists()
        ) {
          ticketData =
            ticketSnapshot.data();
        }
      }

      const nowISO =
        new Date()
          .toISOString();

      const detail =
        cleanReason
          ? `Motivo: ${cleanReason}`
          : "El presupuesto fue rechazado.";

      /* =================================
         HISTORIAL PRESUPUESTO
      ================================= */

      const budgetHistoryEntry =
        createHistoryEntry({
          author,

          action:
            "Presupuesto rechazado",

          detail,
        });

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
            "Rechazado",

          actualizadoEn:
            nowISO,

          historial: [
            ...budgetHistory,
            budgetHistoryEntry,
          ],
        }
      );

      /* =================================
         HISTORIAL TICKET
      ================================= */

      if (
        ticketRef &&
        ticketData
      ) {
        const ticketHistoryEntry =
          createHistoryEntry({
            author,

            action:
              "Presupuesto RECHAZADO",

            detail:
              cleanReason
                ? `Presupuesto ${cleanBudgetId} rechazado. Motivo: ${cleanReason}`
                : `Presupuesto ${cleanBudgetId} rechazado.`,
          });

        const ticketHistory =
          Array.isArray(
            ticketData.historial
          )
            ? ticketData.historial
            : [];

        transaction.update(
          ticketRef,
          {
            presupuestoAprobado:
              false,

            presupuestoEstado:
              "Rechazado",

            presupuestoId:
              cleanBudgetId,

            stage:
              "noreparable",

            historial: [
              ...ticketHistory,
              ticketHistoryEntry,
            ],
          }
        );
      }

      result = {
        budgetId:
          cleanBudgetId,

        ticketId,

        state:
          "Rechazado",

        ticketUpdated:
          Boolean(
            ticketData
          ),
      };
    }
  );

  return result;
}

export default {
  subscribeToBudgets,
  subscribeToBudget,
  acceptBudget,
  rejectBudget,
};