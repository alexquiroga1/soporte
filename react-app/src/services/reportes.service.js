import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseReportDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const text =
    cleanText(value);

  if (!text) return null;

  /*
   * ISO / YYYY-MM-DD
   */
  if (
    /^\d{4}-\d{2}-\d{2}/.test(text)
  ) {
    const date =
      new Date(
        text.length === 10
          ? `${text}T12:00:00`
          : text
      );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  /*
   * Formato argentino:
   * DD/MM/YYYY
   * DD/MM/YYYY HH:mm
   */
  const arMatch =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );

  if (arMatch) {
    const [
      ,
      day,
      month,
      year,
      hour = "12",
      minute = "00",
      second = "00",
    ] = arMatch;

    const date =
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const fallback =
    new Date(text);

  return Number.isNaN(fallback.getTime())
    ? null
    : fallback;
}

export function getReportPeriodRange(
  period = "month",
  now = new Date()
) {
  const end =
    new Date(now);

  end.setHours(
    23,
    59,
    59,
    999
  );

  if (
    period === "all"
  ) {
    return {
      start: null,
      end,
      label: "Todo el historial",
    };
  }

  const start =
    new Date(now);

  start.setHours(
    0,
    0,
    0,
    0
  );

  if (
    period === "30d"
  ) {
    start.setDate(
      start.getDate() - 29
    );

    return {
      start,
      end,
      label: "Últimos 30 días",
    };
  }

  if (
    period === "90d"
  ) {
    start.setDate(
      start.getDate() - 89
    );

    return {
      start,
      end,
      label: "Últimos 90 días",
    };
  }

  if (
    period === "year"
  ) {
    start.setMonth(
      0,
      1
    );

    return {
      start,
      end,
      label: "Año actual",
    };
  }

  /*
   * Mes actual
   */
  start.setDate(
    1
  );

  return {
    start,
    end,
    label: "Mes actual",
  };
}

function isDateInsidePeriod(
  date,
  period
) {
  if (
    !date
  ) {
    return false;
  }

  const range =
    getReportPeriodRange(
      period
    );

  if (
    !range.start
  ) {
    return (
      date <=
      range.end
    );
  }

  return (
    date >=
      range.start &&
    date <=
      range.end
  );
}

function getClientDisplayName(
  client
) {
  if (
    !client
  ) {
    return "";
  }

  return (
    cleanText(
      client.razonSocial
    ) ||
    cleanText(
      `${client.nombre || ""} ${client.apellido || ""}`
    ) ||
    cleanText(
      client.cliente
    )
  );
}

function getCreditClientKey(
  credit
) {
  return (
    cleanText(
      credit.clienteId
    ) ||
    cleanText(
      credit.cliente
    ).toLowerCase()
  );
}

/* =========================================
   SUSCRIPCIÓN CONSOLIDADA
========================================= */

export function subscribeToReports(
  onData,
  onError
) {
  const state = {
    credits: [],
    clients: [],
    invoices: [],
    sales: [],
    tickets: [],
    products: [],
    budgets: [],
    cashCuts: [],
    currentCash: null,
  };

  const emit =
    () => {
      onData({
        credits:
          state.credits,

        clients:
          state.clients,

        invoices:
          state.invoices,

        sales:
          state.sales,

        tickets:
          state.tickets,

        products:
          state.products,

        budgets:
          state.budgets,

        cashCuts:
          state.cashCuts,

        currentCash:
          state.currentCash,
      });
    };

  const mapSnapshot =
    (snapshot) =>
      snapshot.docs.map(
        (
          snapshotDoc
        ) => ({
          id:
            snapshotDoc.id,

          ...snapshotDoc.data(),
        })
      );

  const unsubscribers = [
    onSnapshot(
      collection(
        db,
        "creditos"
      ),

      (snapshot) => {
        state.credits =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "clientes"
      ),

      (snapshot) => {
        state.clients =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "facturas"
      ),

      (snapshot) => {
        state.invoices =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "ventas"
      ),

      (snapshot) => {
        state.sales =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "tickets"
      ),

      (snapshot) => {
        state.tickets =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),


    onSnapshot(
      collection(
        db,
        "productos"
      ),

      (snapshot) => {
        state.products =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "presupuestos"
      ),

      (snapshot) => {
        state.budgets =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      collection(
        db,
        "caja_cortes"
      ),

      (snapshot) => {
        state.cashCuts =
          mapSnapshot(
            snapshot
          );

        emit();
      },

      onError
    ),

    onSnapshot(
      doc(
        db,
        "negocio",
        "caja_activa"
      ),

      (snapshot) => {
        state.currentCash =
          snapshot.exists()
            ? {
                id:
                  snapshot.id,

                ...snapshot.data(),
              }
            : null;

        emit();
      },

      onError
    ),
  ];

  return () => {
    unsubscribers.forEach(
      (
        unsubscribe
      ) =>
        unsubscribe()
    );
  };
}

/* =========================================
   MOVIMIENTOS DE CAJA
========================================= */

function normalizeCashMovement(
  movement,
  {
    fallbackDate = null,
    source = "Caja",
  } = {}
) {
  const explicitDate =
    parseReportDate(
      movement?.creadoEn ||
      movement?.fecha ||
      movement?.timestamp
    );

  const date =
    explicitDate ||
    fallbackDate ||
    null;

  return {
    ...movement,

    reportDate:
      date,

    reportDateKey:
      localDateKey(
        date
      ),

    reportSource:
      source,

    tipo:
      cleanText(
        movement?.tipo
      ).toLowerCase(),

    monto:
      Math.max(
        0,
        toNumber(
          movement?.monto
        )
      ),
  };
}

function collectCashMovements(
  data
) {
  const movements =
    [];

  /*
   * Cortes históricos.
   */
  (
    data?.cashCuts ||
    []
  ).forEach(
    (
      cut
    ) => {
      const fallbackDate =
        parseReportDate(
          cut.cierre ||
          cut.fecha ||
          cut.creadoEn
        );

      (
        Array.isArray(
          cut.movs
        )
          ? cut.movs
          : []
      ).forEach(
        (
          movement
        ) => {
          movements.push(
            normalizeCashMovement(
              movement,
              {
                fallbackDate,
                source:
                  cut.id ||
                  "Corte",
              }
            )
          );
        }
      );
    }
  );

  /*
   * Turno actual.
   * Los movimientos viejos no siempre tienen fecha,
   * por eso, si están en caja_activa, se consideran
   * del turno actual.
   */
  const today =
    new Date();

  (
    Array.isArray(
      data?.currentCash
        ?.movs
    )
      ? data.currentCash
          .movs
      : []
  ).forEach(
    (
      movement
    ) => {
      movements.push(
        normalizeCashMovement(
          movement,
          {
            fallbackDate:
              today,

            source:
              "Turno actual",
          }
        )
      );
    }
  );

  return movements;
}

/* =========================================
   COBRANZAS DE CRÉDITOS
========================================= */

function collectCreditPayments(
  credits
) {
  const rows =
    [];

  (
    credits ||
    []
  ).forEach(
    (
      credit
    ) => {
      (
        Array.isArray(
          credit.abonos
        )
          ? credit.abonos
          : []
      ).forEach(
        (
          payment,
          index
        ) => {
          const date =
            parseReportDate(
              payment.fecha
            );

          const capital =
            Math.max(
              0,
              toNumber(
                payment.capital
              )
            );

          const penalties =
            Math.max(
              0,
              toNumber(
                payment.punitorios
              )
            );

          const total =
            Math.max(
              0,
              toNumber(
                payment.monto
              ) ||
              (
                capital +
                penalties
              )
            );

          rows.push({
            id:
              `${credit.id}-${index}`,

            creditId:
              credit.id,

            clientId:
              credit.clienteId ||
              null,

            cliente:
              credit.cliente ||
              "Cliente",

            concepto:
              credit.concepto ||
              "Crédito",

            fecha:
              payment.fecha ||
              "",

            reportDate:
              date,

            capital,

            punitorios:
              penalties,

            total,

            metodo:
              payment.metodo ||
              "—",

            saldoCapital:
              Math.max(
                0,
                toNumber(
                  payment.saldoCapital
                )
              ),
          });
        }
      );
    }
  );

  rows.sort(
    (
      a,
      b
    ) =>
      (
        b.reportDate
          ?.getTime() ||
        0
      ) -
      (
        a.reportDate
          ?.getTime() ||
        0
      )
  );

  return rows;
}

/* =========================================
   MOROSIDAD
========================================= */

function buildOverdueClients(
  credits,
  clients
) {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const clientById =
    new Map();

  const clientByName =
    new Map();

  (
    clients ||
    []
  ).forEach(
    (
      client
    ) => {
      clientById.set(
        client.id,
        client
      );

      const name =
        getClientDisplayName(
          client
        );

      if (
        name
      ) {
        clientByName.set(
          name.toLowerCase(),
          client
        );
      }
    }
  );

  const groups =
    new Map();

  (
    credits ||
    []
  ).forEach(
    (
      credit
    ) => {
      const saldo =
        Math.max(
          0,
          toNumber(
            credit.saldo
          )
        );

      if (
        saldo <= 0
      ) {
        return;
      }

      let maxDays =
        0;

      let overdueCapital =
        0;

      (
        Array.isArray(
          credit.cuotas
        )
          ? credit.cuotas
          : []
      ).forEach(
        (
          installment
        ) => {
          const dueDate =
            parseReportDate(
              installment.vence
            );

          if (
            !dueDate
          ) {
            return;
          }

          dueDate.setHours(
            0,
            0,
            0,
            0
          );

          const importe =
            Math.max(
              0,
              toNumber(
                installment.importe
              )
            );

          const capitalPaid =
            installment.capitalPagado !==
              undefined
              ? Math.max(
                  0,
                  toNumber(
                    installment.capitalPagado
                  )
                )
              : Math.min(
                  importe,
                  Math.max(
                    0,
                    toNumber(
                      installment.pagado
                    )
                  )
                );

          const pending =
            Math.max(
              0,
              importe -
              capitalPaid
            );

          if (
            pending <= 0 ||
            dueDate >=
              today
          ) {
            return;
          }

          const days =
            Math.floor(
              (
                today -
                dueDate
              ) /
              86400000
            );

          maxDays =
            Math.max(
              maxDays,
              days
            );

          overdueCapital +=
            pending;
        }
      );

      if (
        maxDays <= 0
      ) {
        return;
      }

      const key =
        getCreditClientKey(
          credit
        ) ||
        credit.id;

      const client =
        (
          credit.clienteId
            ? clientById.get(
                credit.clienteId
              )
            : null
        ) ||
        clientByName.get(
          cleanText(
            credit.cliente
          ).toLowerCase()
        ) ||
        null;

      const existing =
        groups.get(
          key
        ) || {
          key,

          cliente:
            credit.cliente ||
            getClientDisplayName(
              client
            ) ||
            "Cliente",

          clienteId:
            credit.clienteId ||
            client?.id ||
            null,

          telefono:
            client?.tel ||
            "—",

          diasMora:
            0,

          saldo:
            0,

          vencido:
            0,

          carpetas:
            0,
        };

      existing.diasMora =
        Math.max(
          existing.diasMora,
          maxDays
        );

      existing.saldo +=
        saldo;

      existing.vencido +=
        overdueCapital;

      existing.carpetas +=
        1;

      groups.set(
        key,
        existing
      );
    }
  );

  return Array.from(
    groups.values()
  ).sort(
    (
      a,
      b
    ) =>
      b.diasMora -
      a.diasMora
  );
}

/* =========================================
   CONSOLIDAR REPORTE
========================================= */

export function buildReportData(
  data,
  period = "month"
) {
  const credits =
    Array.isArray(
      data?.credits
    )
      ? data.credits
      : [];

  const clients =
    Array.isArray(
      data?.clients
    )
      ? data.clients
      : [];

  const invoices =
    Array.isArray(
      data?.invoices
    )
      ? data.invoices
      : [];

  const sales =
    Array.isArray(
      data?.sales
    )
      ? data.sales
      : [];

  const tickets =
    Array.isArray(
      data?.tickets
    )
      ? data.tickets
      : [];

  const products =
    Array.isArray(
      data?.products
    )
      ? data.products
      : [];

  const budgets =
    Array.isArray(
      data?.budgets
    )
      ? data.budgets
      : [];

  const cashMovements =
    collectCashMovements(
      data
    );

  const periodCashMovements =
    cashMovements.filter(
      (
        movement
      ) =>
        isDateInsidePeriod(
          movement.reportDate,
          period
        )
    );

  const cashIncome =
    periodCashMovements
      .filter(
        (
          movement
        ) =>
          movement.tipo ===
          "ingreso"
      )
      .reduce(
        (
          sum,
          movement
        ) =>
          sum +
          movement.monto,
        0
      );

  const cashExpenses =
    periodCashMovements
      .filter(
        (
          movement
        ) =>
          movement.tipo ===
          "egreso"
      )
      .reduce(
        (
          sum,
          movement
        ) =>
          sum +
          movement.monto,
        0
      );

  const creditPayments =
    collectCreditPayments(
      credits
    );

  const periodCreditPayments =
    creditPayments.filter(
      (
        payment
      ) =>
        isDateInsidePeriod(
          payment.reportDate,
          period
        )
    );

  const creditCollections =
    periodCreditPayments.reduce(
      (
        sum,
        payment
      ) =>
        sum +
        payment.total,
      0
    );

  const capitalCollected =
    periodCreditPayments.reduce(
      (
        sum,
        payment
      ) =>
        sum +
        payment.capital,
      0
    );

  const penaltiesCollected =
    periodCreditPayments.reduce(
      (
        sum,
        payment
      ) =>
        sum +
        payment.punitorios,
      0
    );

  const creditRows =
    credits
      .map(
        (
          credit
        ) => ({
          ...credit,

          reportDate:
            parseReportDate(
              credit.fechaOrigen ||
              credit.creadoEn
            ),

          original:
            Math.max(
              0,
              toNumber(
                credit.original
              )
            ),

          saldo:
            Math.max(
              0,
              toNumber(
                credit.saldo
              )
            ),
        })
      )
      .filter(
        (
          credit
        ) =>
          isDateInsidePeriod(
            credit.reportDate,
            period
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            b.reportDate
              ?.getTime() ||
            0
          ) -
          (
            a.reportDate
              ?.getTime() ||
            0
          )
      );

  const creditsGranted =
    creditRows.reduce(
      (
        sum,
        credit
      ) =>
        sum +
        credit.original,
      0
    );

  const activePortfolio =
    credits.reduce(
      (
        sum,
        credit
      ) =>
        sum +
        Math.max(
          0,
          toNumber(
            credit.saldo
          )
        ),
      0
    );

  const overdueClients =
    buildOverdueClients(
      credits,
      clients
    );

  const overduePortfolio =
    overdueClients.reduce(
      (
        sum,
        client
      ) =>
        sum +
        client.saldo,
      0
    );

  const overdueCapital =
    overdueClients.reduce(
      (
        sum,
        client
      ) =>
        sum +
        client.vencido,
      0
    );

  const invoiceRows =
    invoices
      .map(
        (
          invoice
        ) => ({
          ...invoice,

          reportDate:
            parseReportDate(
              invoice.fecha ||
              invoice.creadoEn
            ),
        })
      )
      .filter(
        (
          invoice
        ) => {
          const type =
            cleanText(
              invoice.tipo
            ).toLowerCase();

          const status =
            cleanText(
              invoice.estado
            ).toLowerCase();

          const isInvoice =
            !type ||
            type ===
              "factura";

          const validStatus =
            ![
              "anulada",
              "cancelada",
            ].includes(
              status
            );

          return (
            isInvoice &&
            validStatus &&
            isDateInsidePeriod(
              invoice.reportDate,
              period
            )
          );
        }
      );

  const invoiced =
    invoiceRows.reduce(
      (
        sum,
        invoice
      ) =>
        sum +
        Math.max(
          0,
          toNumber(
            invoice.total
          )
        ),
      0
    );

  const salesRows =
    sales
      .map(
        (
          sale
        ) => ({
          ...sale,

          reportDate:
            parseReportDate(
              sale.fecha ||
              sale.creadoEn
            ),
        })
      )
      .filter(
        (
          sale
        ) =>
          isDateInsidePeriod(
            sale.reportDate,
            period
          )
      );

  const deliveredTickets =
    tickets.filter(
      (
        ticket
      ) => {
        if (
          ticket.stage !==
          "entregado"
        ) {
          return false;
        }

        const date =
          parseReportDate(
            ticket.entregadoEn ||
            ticket.actualizadoEn ||
            ticket.ingreso
          );

        return isDateInsidePeriod(
          date,
          period
        );
      }
    );

  const productRows =
    products
      .filter(
        (product) =>
          product?.activo !== false
      )
      .map(
        (product) => {
          const stock =
            Math.max(
              0,
              toNumber(
                product.stock
              )
            );

          const reserved =
            Math.max(
              0,
              toNumber(
                product.stockReservado ||
                product.reservado
              )
            );

          const cost =
            Math.max(
              0,
              toNumber(
                product.costo ||
                product.cost
              )
            );

          const price =
            Math.max(
              0,
              toNumber(
                product.precio ||
                product.price
              )
            );

          const minimum =
            Math.max(
              0,
              toNumber(
                product.stockMinimo ||
                product.minimo
              )
            );

          return {
            ...product,
            stock,
            reserved,
            available:
              Math.max(
                0,
                stock - reserved
              ),
            cost,
            price,
            minimum,
          };
        }
      );

  const inventoryCost =
    productRows.reduce(
      (sum, product) =>
        sum +
        product.stock *
          product.cost,
      0
    );

  const inventoryRetail =
    productRows.reduce(
      (sum, product) =>
        sum +
        product.stock *
          product.price,
      0
    );

  const lowStockProducts =
    productRows.filter(
      (product) =>
        product.minimum > 0 &&
        product.available <=
          product.minimum
    );

  const budgetRows =
    budgets
      .map(
        (budget) => ({
          ...budget,
          reportDate:
            parseReportDate(
              budget.creadoEn ||
              budget.fecha ||
              budget.actualizadoEn
            ),
          reportTotal:
            Math.max(
              0,
              toNumber(
                budget.total ||
                budget.totalFinal ||
                budget.importe
              )
            ),
          reportStatus:
            cleanText(
              budget.respuesta ||
              budget.estado
            ).toLowerCase(),
        })
      )
      .filter(
        (budget) =>
          isDateInsidePeriod(
            budget.reportDate,
            period
          )
      );

  const acceptedBudgets =
    budgetRows.filter(
      (budget) =>
        budget.reportStatus ===
          "aceptado" ||
        budget.reportStatus ===
          "aceptada"
    );

  const rejectedBudgets =
    budgetRows.filter(
      (budget) =>
        budget.reportStatus ===
          "rechazado" ||
        budget.reportStatus ===
          "rechazada"
    );

  const decidedBudgets =
    acceptedBudgets.length +
    rejectedBudgets.length;

  const budgetConversion =
    decidedBudgets > 0
      ? (
          acceptedBudgets.length /
          decidedBudgets
        ) * 100
      : 0;

  const openBudgetValue =
    budgets.reduce(
      (sum, budget) => {
        const status =
          cleanText(
            budget.respuesta ||
            budget.estado
          ).toLowerCase();

        if (
          [
            "aceptado",
            "aceptada",
            "rechazado",
            "rechazada",
            "vencido",
            "cancelado",
          ].includes(status)
        ) {
          return sum;
        }

        return (
          sum +
          Math.max(
            0,
            toNumber(
              budget.total ||
              budget.totalFinal ||
              budget.importe
            )
          )
        );
      },
      0
    );

  const salesAmount =
    salesRows.reduce(
      (sum, sale) =>
        sum +
        Math.max(
          0,
          toNumber(
            sale.total ||
            sale.importe
          )
        ),
      0
    );

  const averageSale =
    salesRows.length > 0
      ? salesAmount /
        salesRows.length
      : 0;

  const ticketRows =
    tickets
      .map(
        (ticket) => ({
          ...ticket,
          reportDate:
            parseReportDate(
              ticket.ingreso ||
              ticket.creadoEn ||
              ticket.actualizadoEn
            ),
        })
      )
      .filter(
        (ticket) =>
          isDateInsidePeriod(
            ticket.reportDate,
            period
          )
      );

  const deliveryRate =
    ticketRows.length > 0
      ? (
          deliveredTickets.length /
          ticketRows.length
        ) * 100
      : 0;

  const soldProductMap =
    new Map();

  salesRows.forEach(
    (sale) => {
      const items =
        Array.isArray(
          sale.articulosCart
        )
          ? sale.articulosCart
          : Array.isArray(
                sale.items
              )
            ? sale.items
            : [];

      items.forEach(
        (item) => {
          const name =
            cleanText(
              item.nombre ||
              item.desc ||
              item.descripcion ||
              item.producto
            ) ||
            "Concepto";

          const quantity =
            Math.max(
              0,
              toNumber(
                item.cantidad ||
                item.cant ||
                item.qty ||
                1
              )
            );

          const unitPrice =
            Math.max(
              0,
              toNumber(
                item.precio ||
                item.price ||
                item.precioUnitario
              )
            );

          const current =
            soldProductMap.get(
              name
            ) || {
              name,
              quantity: 0,
              amount: 0,
            };

          current.quantity +=
            quantity;

          current.amount +=
            quantity *
            unitPrice;

          soldProductMap.set(
            name,
            current
          );
        }
      );
    }
  );

  const topProducts =
    Array.from(
      soldProductMap.values()
    )
      .sort(
        (a, b) =>
          b.amount -
          a.amount
      )
      .slice(
        0,
        8
      );

  return {
    period:
      getReportPeriodRange(
        period
      ),

    metrics: {
      cashIncome,
      cashExpenses,

      netCash:
        cashIncome -
        cashExpenses,

      invoiced,
      activePortfolio,
      overduePortfolio,
      overdueCapital,
      creditsGranted,
      creditCollections,
      capitalCollected,
      penaltiesCollected,

      salesCount:
        salesRows.length,

      invoicesCount:
        invoiceRows.length,

      deliveredTickets:
        deliveredTickets.length,

      overdueClients:
        overdueClients.length,

      inventoryCost,
      inventoryRetail,
      lowStockProducts:
        lowStockProducts.length,

      budgetsCreated:
        budgetRows.length,
      budgetsAccepted:
        acceptedBudgets.length,
      budgetConversion,
      openBudgetValue,

      salesAmount,
      averageSale,
      ticketsCreated:
        ticketRows.length,
      deliveryRate,
    },

    creditRows,
    creditPayments:
      periodCreditPayments,

    overdueClients,

    cashMovements:
      periodCashMovements,

    invoiceRows,
    salesRows,
    budgetRows,
    productRows,
    lowStockProducts,
    topProducts,
    ticketRows,
  };
}
