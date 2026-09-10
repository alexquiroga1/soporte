import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "./firebase.js";

import {
  DEFAULT_CREDIT_SETTINGS,
  getCreditFinancials,
} from "./creditos.service.js";

/* =========================================
   STORAGE
========================================= */

const READ_STORAGE_KEY =
  "servix_dashboard_notifications_read_v1";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    const date =
      value.toDate();

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  /*
   * Formato Firestore / ISO:
   * 2026-09-09
   * 2026-09-09T15:30:00.000Z
   */
  if (
    /^\d{4}-\d{2}-\d{2}/.test(
      text
    )
  ) {
    const date =
      new Date(
        text.length === 10
          ? `${text}T12:00:00`
          : text
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  /*
   * Formato argentino:
   * 09/09/2026
   * 09/09/2026 15:30
   */
  const arMatch =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );

  if (arMatch) {
    const [
      ,
      day,
      month,
      year,
    ] =
      arMatch;

    const date =
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        12,
        0,
        0
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const fallback =
    new Date(text);

  return Number.isNaN(
    fallback.getTime()
  )
    ? null
    : fallback;
}

function startOfDay(
  value = new Date()
) {
  const date =
    new Date(value);

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}

function daysBetween(
  from,
  to
) {
  const first =
    startOfDay(from);

  const second =
    startOfDay(to);

  return Math.round(
    (
      second -
      first
    ) /
      86400000
  );
}

function formatMoney(
  value
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style:
        "currency",

      currency:
        "ARS",

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}

function normalizeSettings(
  data = {}
) {
  return {
    ...DEFAULT_CREDIT_SETTINGS,

    creditoPunitorioDiario:
      Math.max(
        0,
        toNumber(
          data.creditoPunitorioDiario ??
            DEFAULT_CREDIT_SETTINGS.creditoPunitorioDiario
        )
      ),

    creditoDiasGracia:
      Math.max(
        0,
        Math.trunc(
          toNumber(
            data.creditoDiasGracia ??
              DEFAULT_CREDIT_SETTINGS.creditoDiasGracia
          )
        )
      ),

    creditoBloqueoMoraDias:
      Math.max(
        0,
        Math.trunc(
          toNumber(
            data.creditoBloqueoMoraDias ??
              DEFAULT_CREDIT_SETTINGS.creditoBloqueoMoraDias
          )
        )
      ),
  };
}

function getTicketDevice(
  ticket
) {
  return (
    cleanText(
      ticket?.equipo
    ) ||
    cleanText(
      ticket?.dispositivo
    ) ||
    cleanText(
      ticket?.tipoEquipo
    ) ||
    cleanText(
      ticket?.modelo
    ) ||
    "Equipo"
  );
}

function isPaidCashPending(
  item
) {
  const status =
    cleanText(
      item?.estado
    ).toLowerCase();

  return [
    "cobrado",
    "pagado",
    "procesado",
    "finalizado",
    "cancelado",
  ].includes(
    status
  );
}

/* =========================================
   CONSTRUCTOR DE NOTIFICACIONES
========================================= */

function buildNotifications(
  state
) {
  const now =
    new Date();

  const today =
    startOfDay(
      now
    );

  const notifications =
    [];

  /* =======================================
     CRÉDITOS
     - mora
     - próximos vencimientos
     - promesas de pago
  ======================================= */

  (
    state.credits ||
    []
  ).forEach(
    (
      credit
    ) => {
      const financials =
        getCreditFinancials(
          credit,
          state.settings
        );

      /*
       * Crédito con mora.
       */
      if (
        financials.capitalBalance >
          0 &&
        financials.maxDaysLate >
          0
      ) {
        const critical =
          financials.maxDaysLate >
          30;

        notifications.push({
          id:
            `credit-overdue-${credit.id}`,

          type:
            "credit",

          severity:
            critical
              ? "critical"
              : "warning",

          title:
            critical
              ? "Crédito con mora importante"
              : "Cuota de crédito vencida",

          description:
            `${
              credit.cliente ||
              "Cliente"
            } · ${
              financials.maxDaysLate
            } días de mora · saldo ${
              formatMoney(
                financials.capitalBalance
              )
            }`,

          path:
            "/creditos",

          createdAt:
            credit.actualizadoEn ||
            credit.creadoEn ||
            credit.fechaOrigen ||
            now.toISOString(),
        });
      }

      /*
       * Próximo vencimiento:
       * hoy o dentro de 3 días.
       */
      if (
        financials.capitalBalance >
          0 &&
        financials.maxDaysLate ===
          0 &&
        financials
          .nextInstallment
          ?.vence
      ) {
        const dueDate =
          parseDate(
            financials
              .nextInstallment
              .vence
          );

        if (
          dueDate
        ) {
          const days =
            daysBetween(
              today,
              dueDate
            );

          if (
            days >= 0 &&
            days <= 3
          ) {
            notifications.push({
              id:
                `credit-due-${credit.id}-${financials.nextInstallment.numero}`,

              type:
                "credit",

              severity:
                days === 0
                  ? "warning"
                  : "info",

              title:
                days === 0
                  ? "Cuota vence hoy"
                  : "Cuota próxima a vencer",

              description:
                `${
                  credit.cliente ||
                  "Cliente"
                } · cuota ${
                  financials
                    .nextInstallment
                    .numero
                } · ${
                  formatMoney(
                    financials
                      .nextInstallment
                      .totalDue
                  )
                }`,

              path:
                "/creditos",

              createdAt:
                dueDate.toISOString(),
            });
          }
        }
      }

      /*
       * Promesas de pago.
       */
      (
        Array.isArray(
          credit.promesasPago
        )
          ? credit.promesasPago
          : []
      ).forEach(
        (
          promise
        ) => {
          const promiseStatus =
            cleanText(
              promise.estado
            ).toLowerCase();

          if (
            [
              "cumplida",
              "pagada",
              "cancelada",
              "cerrada",
            ].includes(
              promiseStatus
            )
          ) {
            return;
          }

          const promiseDate =
            parseDate(
              promise.fechaPromesa
            );

          if (
            !promiseDate
          ) {
            return;
          }

          const days =
            daysBetween(
              today,
              promiseDate
            );

          if (
            days <= 0
          ) {
            notifications.push({
              id:
                `promise-${credit.id}-${promise.id || promise.fechaPromesa}`,

              type:
                "promise",

              severity:
                days < 0
                  ? "critical"
                  : "warning",

              title:
                days < 0
                  ? "Promesa de pago vencida"
                  : "Promesa de pago para hoy",

              description:
                `${
                  credit.cliente ||
                  "Cliente"
                } · ${
                  formatMoney(
                    promise.monto
                  )
                }`,

              path:
                "/creditos",

              createdAt:
                promiseDate.toISOString(),
            });
          }
        }
      );
    }
  );

  /* =======================================
     TICKETS
     - listos para entrega
  ======================================= */

  (
    state.tickets ||
    []
  ).forEach(
    (
      ticket
    ) => {
      const stage =
        cleanText(
          ticket.stage
        ).toLowerCase();

      if (
        stage !==
        "listo"
      ) {
        return;
      }

      notifications.push({
        id:
          `ticket-ready-${ticket.id}`,

        type:
          "ticket",

        severity:
          "success",

        title:
          "Equipo listo para entregar",

        description:
          `${
            ticket.cliente ||
            "Cliente"
          } · ${
            getTicketDevice(
              ticket
            )
          }`,

        path:
          `/tickets/${ticket.id}`,

        createdAt:
          ticket.actualizadoEn ||
          ticket.creadoEn ||
          ticket.ingreso ||
          now.toISOString(),
      });
    }
  );

  /* =======================================
     CAJA
     - cobros pendientes
  ======================================= */

  const activePendings =
    (
      state.cashPendings ||
      []
    ).filter(
      (
        item
      ) =>
        !isPaidCashPending(
          item
        )
    );

  if (
    activePendings.length >
    0
  ) {
    const pendingTotal =
      activePendings.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Math.max(
            0,
            toNumber(
              item.total
            )
          ),

        0
      );

    notifications.push({
      id:
        `cash-pending-${activePendings
          .map(
            (
              item
            ) =>
              item.id
          )
          .sort()
          .join("-")}`,

      type:
        "cash",

      severity:
        activePendings.length >= 5
          ? "warning"
          : "info",

      title:
        `${activePendings.length} cobro(s) pendiente(s) en Caja`,

      description:
        `Total pendiente ${formatMoney(
          pendingTotal
        )}`,

      path:
        "/caja",

      createdAt:
        activePendings
          .map(
            (
              item
            ) =>
              item.creadoEn ||
              item.fecha ||
              ""
          )
          .sort()
          .reverse()[0] ||
        now.toISOString(),
    });
  }

  /* =======================================
     PRESUPUESTOS
     - próximos a vencer
  ======================================= */

  (
    state.budgets ||
    []
  ).forEach(
    (
      budget
    ) => {
      const status =
        cleanText(
          budget.estado
        ).toLowerCase();

      if (
        ![
          "pendiente",
          "en edición",
          "en edicion",
        ].includes(
          status
        )
      ) {
        return;
      }

      const dueDate =
        parseDate(
          budget.fechaVencimiento
        );

      if (
        !dueDate
      ) {
        return;
      }

      const days =
        daysBetween(
          today,
          dueDate
        );

      if (
        days < 0 ||
        days > 2
      ) {
        return;
      }

      notifications.push({
        id:
          `budget-expiring-${budget.id}`,

        type:
          "budget",

        severity:
          days === 0
            ? "warning"
            : "info",

        title:
          days === 0
            ? "Presupuesto vence hoy"
            : "Presupuesto próximo a vencer",

        description:
          `${
            budget.numero ||
            budget.id
          } · ${
            budget.cliente ||
            "Cliente"
          }`,

        path:
          "/facturacion/presupuestos",

        createdAt:
          dueDate.toISOString(),
      });
    }
  );

  /* =======================================
     ORDEN DE PRIORIDAD
  ======================================= */

  const severityOrder = {
    critical:
      0,

    warning:
      1,

    info:
      2,

    success:
      3,
  };

  notifications.sort(
    (
      a,
      b
    ) => {
      const severityDifference =
        (
          severityOrder[
            a.severity
          ] ??
          9
        ) -
        (
          severityOrder[
            b.severity
          ] ??
          9
        );

      if (
        severityDifference !==
        0
      ) {
        return severityDifference;
      }

      const dateA =
        parseDate(
          a.createdAt
        )?.getTime() ||
        0;

      const dateB =
        parseDate(
          b.createdAt
        )?.getTime() ||
        0;

      return (
        dateB -
        dateA
      );
    }
  );

  return notifications.slice(
    0,
    30
  );
}

/* =========================================
   SUSCRIPCIÓN FIRESTORE REALTIME
========================================= */

export function subscribeToDashboardNotifications(
  onData,
  onError
) {
  const state = {
    credits:
      [],

    tickets:
      [],

    cashPendings:
      [],

    budgets:
      [],

    settings:
      DEFAULT_CREDIT_SETTINGS,
  };

  const emit =
    () => {
      onData(
        buildNotifications(
          state
        )
      );
    };

  const mapSnapshot =
    (
      snapshot
    ) =>
      snapshot.docs.map(
        (
          snapshotDoc
        ) => ({
          id:
            snapshotDoc.id,

          ...snapshotDoc.data(),
        })
      );

  const safeError =
    (
      error
    ) => {
      console.error(
        "Dashboard notifications:",
        error
      );

      if (
        typeof onError ===
        "function"
      ) {
        onError(
          error
        );
      }
    };

  const unsubscribers = [
    onSnapshot(
      collection(
        db,
        "creditos"
      ),

      (
        snapshot
      ) => {
        state.credits =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      safeError
    ),

    onSnapshot(
      collection(
        db,
        "tickets"
      ),

      (
        snapshot
      ) => {
        state.tickets =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      safeError
    ),

    onSnapshot(
      collection(
        db,
        "caja_pendientes"
      ),

      (
        snapshot
      ) => {
        state.cashPendings =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      safeError
    ),

    onSnapshot(
      collection(
        db,
        "presupuestos"
      ),

      (
        snapshot
      ) => {
        state.budgets =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      safeError
    ),

    onSnapshot(
      doc(
        db,
        "negocio",
        "configuracion"
      ),

      (
        snapshot
      ) => {
        state.settings =
          normalizeSettings(
            snapshot.exists()
              ? snapshot.data()
              : {}
          );

        emit();
      },

      safeError
    ),
  ];

  return () => {
    unsubscribers.forEach(
      (
        unsubscribe
      ) => {
        if (
          typeof unsubscribe ===
          "function"
        ) {
          unsubscribe();
        }
      }
    );
  };
}

/* =========================================
   LEÍDAS
   Se guardan solo en el navegador.
   NO escribe en Firestore.
========================================= */

export function getReadNotificationIds() {
  try {
    const raw =
      window.localStorage.getItem(
        READ_STORAGE_KEY
      );

    const parsed =
      raw
        ? JSON.parse(
            raw
          )
        : [];

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch (
    error
  ) {
    console.warn(
      "No se pudieron leer las notificaciones marcadas:",
      error
    );

    return [];
  }
}

function saveReadNotificationIds(
  ids
) {
  try {
    const cleanIds =
      Array.from(
        new Set(
          (
            ids ||
            []
          ).filter(
            Boolean
          )
        )
      ).slice(
        -300
      );

    window.localStorage.setItem(
      READ_STORAGE_KEY,
      JSON.stringify(
        cleanIds
      )
    );

    return cleanIds;
  } catch (
    error
  ) {
    console.warn(
      "No se pudieron guardar las notificaciones leídas:",
      error
    );

    return [];
  }
}

export function markNotificationRead(
  notificationId
) {
  const id =
    cleanText(
      notificationId
    );

  const current =
    getReadNotificationIds();

  if (
    !id
  ) {
    return current;
  }

  return saveReadNotificationIds([
    ...current,
    id,
  ]);
}

export function markAllNotificationsRead(
  notifications
) {
  const ids =
    (
      notifications ||
      []
    )
      .map(
        (
          notification
        ) =>
          notification.id
      )
      .filter(
        Boolean
      );

  return saveReadNotificationIds([
    ...getReadNotificationIds(),
    ...ids,
  ]);
}

export function clearReadNotifications() {
  try {
    window.localStorage.removeItem(
      READ_STORAGE_KEY
    );
  } catch (
    error
  ) {
    console.warn(
      "No se pudo limpiar el estado de notificaciones:",
      error
    );
  }

  return [];
}