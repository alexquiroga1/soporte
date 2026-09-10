import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "./firebase.js";

/* =========================================
   ESTADOS DE TICKET
========================================= */

const TICKET_STAGE_LABELS = {
  pendiente:
    "Recibido",

  diagnostico:
    "En diagnóstico",

  presupuesto:
    "Esperando aprobación",

  reparacion:
    "En reparación",

  repuesto:
    "Esperando repuesto",

  listo:
    "Listo para entrega",

  entregado:
    "Entregado",

  noreparable:
    "No reparable",

  cancelado:
    "Cancelado / Retirado",

  garantia:
    "Garantía",
};

/* =========================================
   HELPERS
========================================= */

function getStageLabel(
  stage
) {
  return (
    TICKET_STAGE_LABELS[
      stage
    ] ||
    stage ||
    "Sin estado"
  );
}

function pad(
  value
) {
  return String(
    value
  ).padStart(
    2,
    "0"
  );
}

function formatDateYMD(
  date
) {
  return [
    date.getFullYear(),

    pad(
      date.getMonth() +
        1
    ),

    pad(
      date.getDate()
    ),
  ].join("-");
}

function formatTimeAR(
  date = new Date()
) {
  return date.toLocaleTimeString(
    "es-AR",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",
    }
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

function formatDisplayYMD(
  value
) {
  if (!value) {
    return "";
  }

  const parts =
    String(
      value
    ).split("-");

  if (
    parts.length !==
    3
  ) {
    return value;
  }

  const [
    year,
    month,
    day,
  ] = parts;

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

  const monthIndex =
    Number(
      month
    ) - 1;

  return (
    `${day} ${
      months[
        monthIndex
      ] || month
    } ${year}`
  );
}

function addDays(
  date,
  days
) {
  const result =
    new Date(
      date
    );

  result.setDate(
    result.getDate() +
      days
  );

  return result;
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

function createBudgetHistoryEntry({
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

function normalizeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function calculatePiecesTotal(
  pieces
) {
  if (
    !Array.isArray(
      pieces
    )
  ) {
    return 0;
  }

  return roundMoney(
    pieces.reduce(
      (
        total,
        piece
      ) => {
        const quantity =
          Math.max(
            0,
            normalizeNumber(
              piece?.cant,
              0
            )
          );

        const price =
          Math.max(
            0,
            normalizeNumber(
              piece?.costo,
              0
            )
          );

        return (
          total +
          quantity *
            price
        );
      },
      0
    )
  );
}

/* =========================================
   CONVERTIR PIEZAS DEL TICKET
   A ITEMS DE PRESUPUESTO
========================================= */

function buildBudgetItems(
  pieces,
  labor
) {
  const items = [];

  if (
    Array.isArray(
      pieces
    )
  ) {
    pieces.forEach(
      (
        piece
      ) => {
        const description =
          String(
            piece?.nombre ||
              "Ítem"
          ).trim();

        const quantity =
          Math.max(
            1,
            normalizeNumber(
              piece?.cant,
              1
            )
          );

        const price =
          Math.max(
            0,
            normalizeNumber(
              piece?.costo,
              0
            )
          );

        items.push({
          descripcion:
            description,

          cantidad:
            quantity,

          precio:
            price,

          subtotal:
            roundMoney(
              quantity *
                price
            ),

          sku:
            String(
              piece?.sku ||
                ""
            ).trim(),

          tipo:
            "Repuesto / Servicio",
        });
      }
    );
  }

  if (
    labor >
    0
  ) {
    items.push({
      descripcion:
        "Mano de obra",

      cantidad:
        1,

      precio:
        labor,

      subtotal:
        labor,

      sku:
        "",

      tipo:
        "Mano de obra",
    });
  }

  return items;
}

/* =========================================
   PRESUPUESTO YA EXISTENTE PARA TICKET

   Esto también nos sirve para migración:
   si ya había un presupuesto asociado al
   ticket pero el ticket todavía no tenía
   presupuestoId, lo reutilizamos.
========================================= */

async function findBudgetIdByTicket(
  ticketId
) {
  if (
    !ticketId
  ) {
    return null;
  }

  const presupuestoQuery =
    query(
      collection(
        db,
        "presupuestos"
      ),

      where(
        "ticketId",
        "==",
        String(
          ticketId
        )
      ),

      limit(1)
    );

  const snapshot =
    await getDocs(
      presupuestoQuery
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  return (
    snapshot.docs[0].id
  );
}

/* =========================================
   VALIDAR QUE EL PRESUPUESTO
   NO HAYA PASADO YA A CAJA/FACTURACIÓN
========================================= */

function assertBudgetCanBeModified(
  budget
) {
  if (!budget) {
    return;
  }

  const billed =
    budget.estado ===
      "Facturado" ||
    budget.estadoCaja ===
      "Cobrado" ||
    Boolean(
      budget.facturaId
    );

  if (billed) {
    throw new Error(
      "BUDGET_ALREADY_BILLED"
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
}

/* =========================================
   ESCUCHAR TODOS LOS TICKETS
========================================= */

export function subscribeToTickets(
  onData,
  onError
) {
  const ticketsRef =
    collection(
      db,
      "tickets"
    );

  const unsubscribe =
    onSnapshot(
      ticketsRef,

      (
        snapshot
      ) => {
        const tickets =
          snapshot.docs.map(
            (
              document
            ) => ({
              id:
                document.id,

              ...document.data(),
            })
          );

        tickets.sort(
          (
            a,
            b
          ) => {
            const numberA =
              Number(
                a.id
              );

            const numberB =
              Number(
                b.id
              );

            if (
              Number.isFinite(
                numberA
              ) &&
              Number.isFinite(
                numberB
              )
            ) {
              return (
                numberB -
                numberA
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
            tickets
          );
        }
      },

      (
        error
      ) => {
        console.error(
          "Error escuchando tickets:",
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

  return unsubscribe;
}

/* =========================================
   ESCUCHAR UN TICKET
========================================= */

export function subscribeToTicket(
  ticketId,
  onData,
  onError
) {
  if (
    !ticketId
  ) {
    return () => {};
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  const unsubscribe =
    onSnapshot(
      ticketRef,

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

        const ticket = {
          id:
            snapshot.id,

          ...snapshot.data(),
        };

        if (
          onData
        ) {
          onData(
            ticket
          );
        }
      },

      (
        error
      ) => {
        console.error(
          `Error escuchando ticket ${ticketId}:`,
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

  return unsubscribe;
}

/* =========================================
   CAMBIAR ESTADO
========================================= */

export async function updateTicketStage(
  ticket,
  newStage,
  author
) {
  if (
    !ticket?.id
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (
    !newStage
  ) {
    throw new Error(
      "STAGE_REQUIRED"
    );
  }

  const currentStage =
    ticket.stage ||
    "pendiente";

  if (
    currentStage ===
    newStage
  ) {
    return {
      changed:
        false,

      stage:
        newStage,
    };
  }

  const oldStageLabel =
    getStageLabel(
      currentStage
    );

  const newStageLabel =
    getStageLabel(
      newStage
    );

  const updates = {
    stage:
      newStage,
  };

  let logDetail =
    `${oldStageLabel} → ${newStageLabel}`;

  /* LISTO */

  if (
    newStage ===
    "listo"
  ) {
    updates.fechaListo =
      new Date()
        .toISOString();
  }

  /* ENTREGADO */

  if (
    newStage ===
    "entregado"
  ) {
    const warrantyDays =
      Math.max(
        0,
        normalizeNumber(
          ticket.garantiaDias,
          30
        )
      );

    const expiration =
      new Date();

    expiration.setDate(
      expiration.getDate() +
        warrantyDays
    );

    const expirationYMD =
      formatDateYMD(
        expiration
      );

    updates.garantiaDias =
      warrantyDays;

    updates.garantiaVencimiento =
      expirationYMD;

    logDetail +=
      ` | Garantía activada por ${warrantyDays} días` +
      ` (hasta ${formatDisplayYMD(expirationYMD)}).`;
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Estado cambiado",

      detail:
        logDetail,
    });

  updates.historial =
    arrayUnion(
      historyEntry
    );

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticket.id
      )
    );

  await updateDoc(
    ticketRef,
    updates
  );

  return {
    changed:
      true,

    stage:
      newStage,

    stageLabel:
      newStageLabel,

    historyEntry,
  };
}

/* =========================================
   DIAGNÓSTICO
========================================= */

export async function updateTicketDiagnosis(
  ticketId,
  diagnosis,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanDiagnosis =
    String(
      diagnosis ||
        ""
    ).trim();

  if (
    !cleanDiagnosis
  ) {
    throw new Error(
      "DIAGNOSIS_REQUIRED"
    );
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Diagnóstico actualizado",

      detail:
        cleanDiagnosis,
    });

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  await updateDoc(
    ticketRef,
    {
      diagnostico:
        cleanDiagnosis,

      historial:
        arrayUnion(
          historyEntry
        ),
    }
  );

  return {
    diagnosis:
      cleanDiagnosis,

    historyEntry,
  };
}

/* =========================================
   NOTA MANUAL
========================================= */

export async function addTicketNote(
  ticketId,
  note,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanNote =
    String(
      note ||
        ""
    ).trim();

  if (
    !cleanNote
  ) {
    throw new Error(
      "NOTE_REQUIRED"
    );
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Nota manual",

      detail:
        cleanNote,
    });

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  await updateDoc(
    ticketRef,
    {
      historial:
        arrayUnion(
          historyEntry
        ),
    }
  );

  return {
    note:
      cleanNote,

    historyEntry,
  };
}

/* =========================================
   AGREGAR REPUESTO / SERVICIO
========================================= */

export async function addTicketPiece(
  ticketId,
  piece,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const name =
    String(
      piece?.nombre ||
        ""
    ).trim();

  if (
    !name
  ) {
    throw new Error(
      "PIECE_NAME_REQUIRED"
    );
  }

  const quantity =
    Math.max(
      1,
      normalizeNumber(
        piece?.cant,
        1
      )
    );

  const price =
    Math.max(
      0,
      normalizeNumber(
        piece?.costo,
        0
      )
    );

  const sku =
    String(
      piece?.sku ||
        ""
    ).trim();

  const newPiece = {
    nombre:
      name,

    sku,

    cant:
      quantity,

    costo:
      price,
  };

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const currentPieces =
        Array.isArray(
          data.piezas
        )
          ? data.piezas
          : [];

      const updatedPieces = [
        ...currentPieces,
        newPiece,
      ];

      const subtotal =
        roundMoney(
          quantity *
            price
        );

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio agregado",

          detail:
            `${name} · Cantidad: ${quantity} · Importe: ${subtotal}`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,
        {
          piezas:
            updatedPieces,

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );

  return newPiece;
}

/* =========================================
   EDITAR REPUESTO
========================================= */

export async function updateTicketPiece(
  ticketId,
  pieceIndex,
  changes,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (
    !Number.isInteger(
      pieceIndex
    ) ||
    pieceIndex < 0
  ) {
    throw new Error(
      "INVALID_PIECE_INDEX"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const pieces =
        Array.isArray(
          data.piezas
        )
          ? [
              ...data.piezas,
            ]
          : [];

      if (
        !pieces[
          pieceIndex
        ]
      ) {
        throw new Error(
          "PIECE_NOT_FOUND"
        );
      }

      const previous =
        pieces[
          pieceIndex
        ];

      const updated = {
        ...previous,

        nombre:
          changes.nombre !==
          undefined
            ? String(
                changes.nombre
              ).trim()
            : previous.nombre,

        sku:
          changes.sku !==
          undefined
            ? String(
                changes.sku
              ).trim()
            : previous.sku,

        cant:
          changes.cant !==
          undefined
            ? Math.max(
                1,
                normalizeNumber(
                  changes.cant,
                  1
                )
              )
            : Math.max(
                1,
                normalizeNumber(
                  previous.cant,
                  1
                )
              ),

        costo:
          changes.costo !==
          undefined
            ? Math.max(
                0,
                normalizeNumber(
                  changes.costo,
                  0
                )
              )
            : Math.max(
                0,
                normalizeNumber(
                  previous.costo,
                  0
                )
              ),
      };

      if (
        !updated.nombre
      ) {
        throw new Error(
          "PIECE_NAME_REQUIRED"
        );
      }

      pieces[
        pieceIndex
      ] = updated;

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio actualizado",

          detail:
            `${updated.nombre} · Cantidad: ${updated.cant} · Precio: ${updated.costo}`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,
        {
          piezas:
            pieces,

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );
}

/* =========================================
   ELIMINAR REPUESTO
========================================= */

export async function removeTicketPiece(
  ticketId,
  pieceIndex,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (
    !Number.isInteger(
      pieceIndex
    ) ||
    pieceIndex < 0
  ) {
    throw new Error(
      "INVALID_PIECE_INDEX"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(
        ticketId
      )
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const pieces =
        Array.isArray(
          data.piezas
        )
          ? [
              ...data.piezas,
            ]
          : [];

      const removed =
        pieces[
          pieceIndex
        ];

      if (
        !removed
      ) {
        throw new Error(
          "PIECE_NOT_FOUND"
        );
      }

      pieces.splice(
        pieceIndex,
        1
      );

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio eliminado",

          detail:
            `${removed.nombre || "Ítem"} eliminado del ticket.`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,
        {
          piezas:
            pieces,

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );
}

/* =========================================
   FIJAR PRESUPUESTO

   TICKET + PRESUPUESTO + CONTADOR
   EN UNA MISMA TRANSACCIÓN
========================================= */

export async function fixTicketBudget(
  ticketId,
  {
    labor = 0,
    discountPercent = 0,
  },
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanTicketId =
    String(
      ticketId
    );

  const cleanAuthorValue =
    cleanAuthor(
      author
    );

  const cleanLabor =
    Math.max(
      0,
      normalizeNumber(
        labor,
        0
      )
    );

  const cleanDiscount =
    clamp(
      normalizeNumber(
        discountPercent,
        0
      ),
      0,
      100
    );

  /*
   * Si un presupuesto proveniente del
   * sistema anterior ya está asociado
   * al ticket, lo reutilizamos.
   */

  const linkedBudgetId =
    await findBudgetIdByTicket(
      cleanTicketId
    );

  const ticketRef =
    doc(
      db,
      "tickets",
      cleanTicketId
    );

  const counterRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  let result =
    null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =================================
         LEER TICKET
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

      const ticketData =
        ticketSnapshot.data();

      if (
        ticketData.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      /* =================================
         DETERMINAR PRESUPUESTO EXISTENTE
      ================================= */

      let presupuestoId =
        ticketData.presupuestoId ||
        linkedBudgetId ||
        null;

      let budgetRef =
        null;

      let existingBudget =
        null;

      if (
        presupuestoId
      ) {
        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );

        const budgetSnapshot =
          await transaction.get(
            budgetRef
          );

        if (
          budgetSnapshot.exists()
        ) {
          existingBudget =
            budgetSnapshot.data();

          assertBudgetCanBeModified(
            existingBudget
          );
        }
      }

      /* =================================
         SI NO EXISTE, OBTENER CONTADOR
      ================================= */

      let nextCounter =
        null;

      if (
        !presupuestoId
      ) {
        const counterSnapshot =
          await transaction.get(
            counterRef
          );

        const currentCounter =
          counterSnapshot.exists()
            ? normalizeNumber(
                counterSnapshot
                  .data()
                  .presupuestos,
                0
              )
            : 0;

        nextCounter =
          currentCounter +
          1;

        presupuestoId =
          `PRE-${String(nextCounter).padStart(6, "0")}`;

        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );
      }

      /* =================================
         CÁLCULOS
      ================================= */

      const pieces =
        Array.isArray(
          ticketData.piezas
        )
          ? ticketData.piezas
          : [];

      const piecesTotal =
        calculatePiecesTotal(
          pieces
        );

      const subtotal =
        roundMoney(
          piecesTotal +
            cleanLabor
        );

      if (
        subtotal <=
        0
      ) {
        throw new Error(
          "BUDGET_EMPTY"
        );
      }

      const discountAmount =
        roundMoney(
          subtotal *
            (
              cleanDiscount /
              100
            )
        );

      const total =
        roundMoney(
          Math.max(
            0,
            subtotal -
              discountAmount
          )
        );

      const items =
        buildBudgetItems(
          pieces,
          cleanLabor
        );

      /* =================================
         FECHAS
      ================================= */

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const today =
        formatDateYMD(
          now
        );

      const validityDays =
        Math.max(
          1,
          normalizeNumber(
            existingBudget?.validezDias,
            7
          )
        );

      const budgetDate =
        existingBudget?.fecha ||
        today;

      const expiryDate =
        existingBudget?.fechaVencimiento ||
        formatDateYMD(
          addDays(
            now,
            validityDays
          )
        );

      /* =================================
         HISTORIAL PRESUPUESTO
      ================================= */

      const isNewBudget =
        !existingBudget;

      const budgetHistoryEntry =
        createBudgetHistoryEntry({
          author:
            cleanAuthorValue,

          action:
            isNewBudget
              ? "Presupuesto creado"
              : "Presupuesto actualizado",

          detail:
            isNewBudget
              ? `Generado desde Ticket ${cleanTicketId}. Total: ${total}.`
              : `Actualizado desde Ticket ${cleanTicketId}. Total: ${total}.`,
        });

      const previousBudgetHistory =
        Array.isArray(
          existingBudget?.historial
        )
          ? existingBudget.historial
          : [];

      /* =================================
         DOCUMENTO PRESUPUESTO
      ================================= */

      const presupuestoData = {
        id:
          presupuestoId,

        numero:
          presupuestoId,

        fecha:
          budgetDate,

        hora:
          existingBudget?.hora ||
          formatTimeAR(
            now
          ),

        fechaVencimiento:
          expiryDate,

        validezDias:
          validityDays,

        clienteId:
          ticketData.clienteId ||
          existingBudget?.clienteId ||
          null,

        cliente:
          ticketData.cliente ||
          existingBudget?.cliente ||
          "Consumidor Final",

        doc:
          ticketData.dni ||
          ticketData.documento ||
          existingBudget?.doc ||
          "C.F.",

        ticketId:
          cleanTicketId,

        origen:
          "Ticket",

        /*
         * Al fijarlo nuevamente,
         * vuelve a quedar pendiente
         * de aprobación.
         */

        estado:
          "Pendiente",

        presupuestoFijado:
          true,

        items,

        /*
         * Para mantener compatibilidad
         * con el módulo anterior.
         */

        subtotal,

        /*
         * `descuento` representa el
         * importe monetario descontado.
         */

        descuento:
          discountAmount,

        descuentoPorcentaje:
          cleanDiscount,

        descuentoImporte:
          discountAmount,

        manoObra:
          cleanLabor,

        total,

        observaciones:
          existingBudget?.observaciones ||
          "",

        usuario:
          cleanAuthorValue,

        creadoEn:
          existingBudget?.creadoEn ||
          nowISO,

        actualizadoEn:
          nowISO,

        historial: [
          ...previousBudgetHistory,
          budgetHistoryEntry,
        ],
      };

      /* =================================
         HISTORIAL TICKET
      ================================= */

      const detailParts = [
        `Presupuesto ${presupuestoId}`,
        `Repuestos/servicios: ${piecesTotal}`,
        `Mano de obra: ${cleanLabor}`,
        `Subtotal: ${subtotal}`,
      ];

      if (
        cleanDiscount >
        0
      ) {
        detailParts.push(
          `Descuento: ${cleanDiscount}% (-${discountAmount})`
        );
      }

      detailParts.push(
        `Total: ${total}`
      );

      const ticketHistoryEntry =
        createHistoryEntry({
          author:
            cleanAuthorValue,

          action:
            isNewBudget
              ? "Presupuesto generado"
              : "Presupuesto actualizado",

          detail:
            detailParts.join(
              " · "
            ),
        });

      const previousTicketHistory =
        Array.isArray(
          ticketData.historial
        )
          ? ticketData.historial
          : [];

      /* =================================
         CONTADOR
      ================================= */

      if (
        nextCounter !==
        null
      ) {
        transaction.set(
          counterRef,

          {
            presupuestos:
              nextCounter,
          },

          {
            merge:
              true,
          }
        );
      }

      /* =================================
         GUARDAR PRESUPUESTO
      ================================= */

      transaction.set(
        budgetRef,

        presupuestoData,

        {
          merge:
            true,
        }
      );

      /* =================================
         ACTUALIZAR TICKET
      ================================= */

      transaction.update(
        ticketRef,

        {
          presupuestoId,

          presupuestoEstado:
            "Pendiente",

          manoObra:
            cleanLabor,

          descuentoPorcentaje:
            cleanDiscount,

          presupuestoSubtotal:
            subtotal,

          descuentoImporte:
            discountAmount,

          presupuestoEstimado:
            total,

          presupuestoFijado:
            true,

          presupuestoAprobado:
            deleteField(),

          historial: [
            ...previousTicketHistory,
            ticketHistoryEntry,
          ],
        }
      );

      result = {
        budgetId:
          presupuestoId,

        created:
          isNewBudget,

        piecesTotal,

        labor:
          cleanLabor,

        subtotal,

        discountPercent:
          cleanDiscount,

        discountAmount,

        total,

        fixed:
          true,
      };
    }
  );

  return result;
}

/* =========================================
   DESBLOQUEAR PRESUPUESTO

   También marca el documento del módulo
   como "En edición".
========================================= */

export async function unlockTicketBudget(
  ticketId,
  author
) {
  if (
    !ticketId
  ) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanTicketId =
    String(
      ticketId
    );

  const linkedBudgetId =
    await findBudgetIdByTicket(
      cleanTicketId
    );

  const ticketRef =
    doc(
      db,
      "tickets",
      cleanTicketId
    );

  let result = {
    changed:
      false,

    budgetId:
      null,
  };

  await runTransaction(
    db,

    async (
      transaction
    ) => {
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

      const ticketData =
        ticketSnapshot.data();

      const presupuestoId =
        ticketData.presupuestoId ||
        linkedBudgetId ||
        null;

      let budgetRef =
        null;

      let budgetData =
        null;

      if (
        presupuestoId
      ) {
        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );

        const budgetSnapshot =
          await transaction.get(
            budgetRef
          );

        if (
          budgetSnapshot.exists()
        ) {
          budgetData =
            budgetSnapshot.data();

          assertBudgetCanBeModified(
            budgetData
          );
        }
      }

      if (
        ticketData.presupuestoFijado !==
          true &&
        !budgetData
      ) {
        return;
      }

      const nowISO =
        new Date()
          .toISOString();

      /* =================================
         HISTORIAL TICKET
      ================================= */

      const ticketHistoryEntry =
        createHistoryEntry({
          author,

          action:
            "Presupuesto desbloqueado",

          detail:
            presupuestoId
              ? `Se habilitó la edición del presupuesto ${presupuestoId}.`
              : "Se habilitó nuevamente la edición del presupuesto.",
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
          presupuestoFijado:
            false,

          presupuestoEstado:
            "En edición",

          presupuestoAprobado:
            deleteField(),

          historial: [
            ...ticketHistory,
            ticketHistoryEntry,
          ],
        }
      );

      /* =================================
         PRESUPUESTO DEL MÓDULO
      ================================= */

      if (
        budgetRef &&
        budgetData
      ) {
        const budgetHistoryEntry =
          createBudgetHistoryEntry({
            author,

            action:
              "Presupuesto desbloqueado",

            detail:
              `Se habilitó la edición desde Ticket ${cleanTicketId}.`,
          });

        const budgetHistory =
          Array.isArray(
            budgetData.historial
          )
            ? budgetData.historial
            : [];

        transaction.update(
          budgetRef,

          {
            estado:
              "En edición",

            presupuestoFijado:
              false,

            actualizadoEn:
              nowISO,

            historial: [
              ...budgetHistory,
              budgetHistoryEntry,
            ],
          }
        );
      }

      result = {
        changed:
          true,

        budgetId:
          presupuestoId,
      };
    }
  );

  return result;
}