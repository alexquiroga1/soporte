import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase.js";


import {
  releaseTicketStockInTransaction,
} from "./productos.service.js";


/* =========================================
   ESTADOS DE TICKET
========================================= */

const TICKET_STAGE_LABELS = {
  pendiente_ingreso: "Pendiente de ingreso",
  pendiente: "Recepción",
  diagnostico: "En diagnóstico",
  presupuesto: "Presupuesto",
  presupuesto_rechazado: "Presupuesto rechazado",
  reparacion: "En reparación",
  repuesto: "Esperando repuesto",
  listo: "Listo para entrega",
  entregado: "Entregado",
  noreparable: "No reparable",
  cancelado: "Cancelado / Retirado",
  garantia: "Garantía",
};

/* =========================================
   HELPERS
========================================= */

function getStageLabel(stage) {
  return (
    TICKET_STAGE_LABELS[stage] ||
    stage ||
    "Sin estado"
  );
}

function pad(value) {
  return String(value).padStart(
    2,
    "0"
  );
}

function formatDateYMD(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function formatTimeAR(
  date = new Date()
) {
  return date.toLocaleTimeString(
    "es-AR",
    {
      hour: "2-digit",
      minute: "2-digit",
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

  const day = pad(
    date.getDate()
  );

  const month =
    months[date.getMonth()];

  const year =
    date.getFullYear();

  const hours = pad(
    date.getHours()
  );

  const minutes = pad(
    date.getMinutes()
  );

  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function formatDisplayYMD(value) {
  if (!value) {
    return "";
  }

  const parts =
    String(value).split("-");

  if (parts.length !== 3) {
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
    Number(month) - 1;

  return `${day} ${
    months[monthIndex] || month
  } ${year}`;
}

function addDays(
  date,
  days
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function cleanAuthor(author) {
  const value =
    String(
      author || ""
    ).trim();

  return value || "Sistema";
}

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
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
    Math.max(min, value)
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) * 100
    ) / 100
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
      cleanAuthor(author),

    accion:
      action,

    detalle:
      String(
        detail || ""
      ).trim(),
  };
}


function calculatePiecesTotal(
  pieces
) {
  if (!Array.isArray(pieces)) {
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
          quantity * price
        );
      },
      0
    )
  );
}

/* =========================================
   RESUMEN ECONÓMICO DEL TICKET
========================================= */

function calculateTicketBudgetSummary(
  pieces,
  labor = 0,
  discountPercent = 0
) {
  const piecesTotal =
    calculatePiecesTotal(pieces);

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

  const subtotal =
    roundMoney(
      piecesTotal +
      cleanLabor
    );

  const discountAmount =
    roundMoney(
      subtotal *
      (cleanDiscount / 100)
    );

  const total =
    roundMoney(
      Math.max(
        0,
        subtotal -
        discountAmount
      )
    );

  return {
    piecesTotal,
    labor: cleanLabor,
    discountPercent: cleanDiscount,
    subtotal,
    discountAmount,
    total,
  };
}

/* =========================================
   PRÓXIMO NÚMERO DE TICKET
========================================= */

async function getNextTicketId() {
  const counterRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  let ticketNumber = 1000;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          counterRef
        );

      if (
        !snapshot.exists()
      ) {
        ticketNumber = 1000;

        transaction.set(
          counterRef,

          {
            tickets: 1001,
          },

          {
            merge: true,
          }
        );

        return;
      }

      const current =
        Number(
          snapshot
            .data()
            ?.tickets
        );

      ticketNumber =
        Number.isFinite(
          current
        ) &&
        current >= 1000
          ? current
          : 1000;

      transaction.update(
        counterRef,

        {
          tickets:
            ticketNumber + 1,
        }
      );
    }
  );

  return `TK-${ticketNumber}`;
}

/* =========================================
   CREAR TICKET
========================================= */

export async function createTicket({
  client = null,
  clientName = "",
  serviceType = "Taller",
  jobType = "Reparación",
  initialStage = "pendiente",

  equipment = "Otro",

  brand = "",
  model = "",
  serial = "",
  pin = "",
  specs = "",

  physicalState = {},

  accessories = {},

  condition = "",

  issue = "",
  visibleObservations = "",
  initialDiagnosis = "",
  priority = "P2",
  technician = "Alex",
  estimatedDate = "",
  estimatedBudget = 0,
  advance = 0,
  paymentMethod = "",
  internalNotes = "",
  consents = {},

  homeService = {},

  remoteService = {},

  warrantyDays = 90,

  author = "Sistema",
} = {}) {
  if (
    client?.archivado ===
    true
  ) {
    throw new Error(
      "TICKET_CLIENT_ARCHIVED"
    );
  }

  const allowedServiceTypes =
    [
      "Taller",
      "Domicilio",
      "Remoto",
    ];

  const normalizedServiceType =
    allowedServiceTypes.includes(
      serviceType
    )
      ? serviceType
      : "Taller";

  const normalizedInitialStage =
    ["pendiente_ingreso", "pendiente"].includes(initialStage)
      ? initialStage
      : "pendiente";

  if (
    normalizedServiceType ===
      "Domicilio" &&
    !cleanText(
      homeService?.direccion
    )
  ) {
    throw new Error(
      "TICKET_HOME_ADDRESS_REQUIRED"
    );
  }

  if (
    normalizedServiceType ===
      "Remoto" &&
    !cleanText(
      remoteService?.idConexion
    )
  ) {
    throw new Error(
      "TICKET_REMOTE_ID_REQUIRED"
    );
  }

  const id =
    await getNextTicketId();

  const now =
    new Date();

  const createdAt =
    now.toISOString();

  const ingreso =
    formatDisplayYMD(
      formatDateYMD(now)
    );

  const resolvedClientName =
    cleanText(
      clientName
    ) ||
    cleanText(
      client?.razonSocial
    ) ||
    cleanText(
      `${
        client?.nombre ||
        ""
      } ${
        client?.apellido ||
        ""
      }`
    ) ||
    cleanText(
      client?.name
    ) ||
    "Mostrador";

  const ticket = {
    id,

    clienteId:
      client?.id ||
      null,

    cliente:
      resolvedClientName,

    tipoServicio:
      normalizedServiceType,

    tipoTrabajo:
      cleanText(jobType) || "Reparación",

    estadoPago:
      "Pendiente",

    estadoFacturacion:
      "No facturado",

    estadoCaja:
      "No enviado",

    equipo:
      cleanText(
        equipment
      ) ||
      "Otro",

    marca:
      cleanText(brand),

    modelo:
      cleanText(model),

    serie:
      cleanText(serial),

    pin:
      cleanText(pin),

    specs:
      cleanText(specs),

    estadoFisico: {
      pantalla:
        Boolean(
          physicalState?.pantalla
        ),

      carcasa:
        Boolean(
          physicalState?.carcasa
        ),

      teclado:
        Boolean(
          physicalState?.teclado
        ),

      cargador:
        Boolean(
          physicalState?.cargador
        ),

      bateria:
        Boolean(
          physicalState?.bateria
        ),

      puertos:
        Boolean(
          physicalState?.puertos
        ),
    },

    accesoriosObj: {
      cargador:
        Boolean(
          accessories?.cargador
        ),

      funda:
        Boolean(
          accessories?.funda
        ),

      cable:
        Boolean(
          accessories?.cable
        ),
    },

    condicion:
      cleanText(condition),

    falla:
      cleanText(issue),

    observacionesVisibles:
      cleanText(visibleObservations),

    diagnosticoInicial:
      cleanText(initialDiagnosis),

    fechaEstimada:
      cleanText(estimatedDate),

    adelanto:
      Math.max(0, normalizeNumber(advance, 0)),

    formaPago:
      cleanText(paymentMethod),

    consentimiento: {
      revision: Boolean(consents?.review),
      datosCorrectos: Boolean(consents?.correct),
      terminos: Boolean(consents?.terms),
    },

    datosDomicilio: {
      direccion:
        cleanText(
          homeService?.direccion
        ),

      fecha:
        cleanText(
          homeService?.fecha
        ),

      hora:
        cleanText(
          homeService?.hora
        ),

      contacto:
        cleanText(
          homeService?.contacto
        ),
    },

    datosRemoto: {
      plataforma:
        cleanText(
          remoteService
            ?.plataforma
        ) ||
        "AnyDesk",

      idConexion:
        cleanText(
          remoteService
            ?.idConexion
        ),

      clave:
        cleanText(
          remoteService?.clave
        ),
    },

    presupuestoEstimado:
      Math.max(0, normalizeNumber(estimatedBudget, 0)),

    prioridad:
      ["P1", "P2", "P3"].includes(cleanText(priority).toUpperCase())
        ? cleanText(priority).toUpperCase()
        : "P2",

    stage:
      normalizedInitialStage,

    tecnico:
      cleanText(technician) || "Alex",

    ingreso:
      normalizedInitialStage === "pendiente_ingreso"
        ? ""
        : ingreso,

    fechaIngresoReal:
      normalizedInitialStage === "pendiente_ingreso"
        ? null
        : createdAt,

    creadoEn:
      createdAt,

    actualizadoEn:
      createdAt,

    garantiaDias:
      Math.max(
        0,
        Math.trunc(
          normalizeNumber(
            warrantyDays,
            90
          )
        )
      ),

    piezas: [],

    historial: [
      createHistoryEntry({
        author,

        action:
          "Ticket creado",

        detail:
          normalizedInitialStage === "pendiente_ingreso"
            ? `Orden abierta antes del ingreso físico. Trabajo: ${cleanText(jobType) || "Reparación"}. Modalidad: ${normalizedServiceType}.`
            : `Equipo recibido. Trabajo: ${cleanText(jobType) || "Reparación"}. Modalidad: ${normalizedServiceType}.`,
      }),
      ...(cleanText(internalNotes)
        ? [
            createHistoryEntry({
              author,
              action: "Nota interna inicial",
              detail: cleanText(internalNotes),
            }),
          ]
        : []),
    ],

    notas: cleanText(internalNotes)
      ? [{
          fecha: formatHistoryDate(now),
          autor: cleanAuthor(author),
          texto: cleanText(internalNotes),
        }]
      : [],
  };

  await setDoc(
    doc(
      db,
      "tickets",
      id
    ),

    ticket
  );

  return ticket;
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
            const matchA =
              String(
                a.id || ""
              ).match(
                /(\d+)$/
              );

            const matchB =
              String(
                b.id || ""
              ).match(
                /(\d+)$/
              );

            const numberA =
              Number(
                matchA?.[1]
              );

            const numberB =
              Number(
                matchB?.[1]
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
              String(a.id)
            );
          }
        );

        onData?.(
          tickets
        );
      },

      (
        error
      ) => {
        console.error(
          "Error escuchando tickets:",
          error
        );

        onError?.(
          error
        );
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
  if (!ticketId) {
    return () => {};
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  return onSnapshot(
    ticketRef,

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
        `Error escuchando ticket ${ticketId}:`,
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================
   CAMBIAR ESTADO
========================================= */

export async function updateTicketStage(
  ticket,
  newStage,
  author
) {
  if (!ticket?.id) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (!newStage) {
    throw new Error(
      "STAGE_REQUIRED"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticket.id)
    );

  return runTransaction(
    db,
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (!snapshot.exists()) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      // Usar siempre el estado fresco de Firestore. Esto evita que una UI
      // atrasada mueva el Ticket mientras Caja acaba de crear un pendiente.
      const currentTicket =
        snapshot.data();

      const currentStage =
        currentTicket.stage ||
        "pendiente";

      if (
        currentStage ===
        newStage
      ) {
        return {
          changed: false,
          stage: newStage,
        };
      }

      const cashPending =
        currentTicket.estadoCaja ===
        "Pendiente";

      const cashResolved =
        [
          "Cobrado",
          "Financiado",
        ].includes(
          currentTicket.estadoCaja
        ) ||
        [
          "Pagado",
          "Pagado Total",
          "Financiado",
          "Pago Parcial",
        ].includes(
          currentTicket.estadoPago
        );

      const billed =
        Boolean(
          currentTicket.facturaId
        ) ||
        Boolean(
          currentTicket.estadoFacturacion &&
          currentTicket.estadoFacturacion !==
            "No facturado"
        );

      if (cashPending) {
        throw new Error(
          "TICKET_CASH_PENDING_LOCKED"
        );
      }

      if (
        newStage ===
          "entregado" &&
        !(cashResolved && billed)
      ) {
        throw new Error(
          "TICKET_PAYMENT_REQUIRED"
        );
      }

      if (
        [
          "cancelado",
          "noreparable",
        ].includes(
          newStage
        ) &&
        (cashResolved || billed)
      ) {
        throw new Error(
          "TICKET_FINANCIAL_REVERSAL_REQUIRED"
        );
      }

      const oldStageLabel =
        getStageLabel(
          currentStage
        );

      const newStageLabel =
        getStageLabel(
          newStage
        );

      const now =
        new Date();

      const updates = {
        stage:
          newStage,

        actualizadoEn:
          now.toISOString(),
      };

      let logDetail =
        `${oldStageLabel} → ${newStageLabel}`;

      if (
        currentStage === "pendiente_ingreso" &&
        newStage === "pendiente"
      ) {
        updates.ingreso = formatDisplayYMD(formatDateYMD(now));
        updates.fechaIngresoReal = now.toISOString();
        logDetail += " | Equipo recibido físicamente.";
      }

      if (
        newStage ===
        "listo"
      ) {
        updates.fechaListo =
          now.toISOString();
      }

      if (
        newStage ===
        "entregado"
      ) {
        const warrantyDays =
          Math.max(
            0,
            normalizeNumber(
              currentTicket.garantiaDias,
              90
            )
          );

        const expiration =
          new Date(now);

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

      if (
        [
          "cancelado",
          "noreparable",
          "presupuesto_rechazado",
        ].includes(
          newStage
        ) &&
        currentTicket.presupuestoAprobado ===
          true
      ) {
        const released =
          await releaseTicketStockInTransaction(
            transaction,
            {
              ticketId:
                ticket.id,
              pieces:
                currentTicket.piezas ||
                [],
              author,
              reference:
                currentTicket.presupuestoId ||
                ticket.id,
              reason:
                `Ticket pasó a ${newStageLabel}`,
            }
          );

        if (
          released.released >
          0
        ) {
          logDetail +=
            ` | Reserva liberada: ${released.released} un.`;
        }
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

      transaction.update(
        ticketRef,
        updates
      );

      return {
        changed: true,
        stage: newStage,
        stageLabel:
          newStageLabel,
        historyEntry,
      };
    }
  );
}

/* =========================================
   DIAGNÓSTICO ÚNICO
========================================= */

export async function saveTicketDiagnosis(
  ticketId,
  diagnosis,
  author
) {
  if (!ticketId) {
    throw new Error("TICKET_REQUIRED");
  }

  const cleanDiagnosis = cleanText(diagnosis);

  if (!cleanDiagnosis) {
    throw new Error("DIAGNOSIS_REQUIRED");
  }

  const ticketRef = doc(db, "tickets", String(ticketId));

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ticketRef);

    if (!snapshot.exists()) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const current = snapshot.data();

    if (cleanText(current?.diagnosticoInicial)) {
      throw new Error("DIAGNOSIS_ALREADY_REGISTERED");
    }

    const now = new Date();
    const historyEntry = createHistoryEntry({
      author,
      action: "Diagnóstico registrado",
      detail: cleanDiagnosis,
    });

    transaction.update(ticketRef, {
      diagnosticoInicial: cleanDiagnosis,
      diagnosticoRegistradoEn: now.toISOString(),
      diagnosticoRegistradoPor: cleanAuthor(author),
      historial: arrayUnion(historyEntry),
      actualizadoEn: now.toISOString(),
    });

    return { diagnosis: cleanDiagnosis, historyEntry };
  });
}

/* =========================================
   NOTA MANUAL
========================================= */

export async function addTicketNote(
  ticketId,
  note,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanNote =
    String(
      note || ""
    ).trim();

  if (!cleanNote) {
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

  await updateDoc(
    doc(
      db,
      "tickets",
      String(ticketId)
    ),

    {
      historial:
        arrayUnion(
          historyEntry
        ),

      actualizadoEn:
        new Date()
          .toISOString(),
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
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const name =
    String(
      piece?.nombre || ""
    ).trim();

  if (!name) {
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
      piece?.sku || ""
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
      String(ticketId)
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


      const currentPieces =
        Array.isArray(
          data.piezas
        )
          ? data.piezas
          : [];

      const updatedPieces =
        [
          ...currentPieces,
          newPiece,
        ];

      const subtotal =
        roundMoney(
          quantity *
            price
        );

      const budgetSummary =
        calculateTicketBudgetSummary(
          updatedPieces,
          data.manoObra,
          data.descuentoPorcentaje
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

          presupuestoSubtotal:
            budgetSummary.subtotal,

          descuentoImporte:
            budgetSummary.discountAmount,

          presupuestoEstimado:
            budgetSummary.total,

          actualizadoEn:
            new Date()
              .toISOString(),

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
  if (!ticketId) {
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
      String(ticketId)
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

      if (!updated.nombre) {
        throw new Error(
          "PIECE_NAME_REQUIRED"
        );
      }

      pieces[
        pieceIndex
      ] = updated;

      const budgetSummary =
        calculateTicketBudgetSummary(
          pieces,
          data.manoObra,
          data.descuentoPorcentaje
        );

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
          piezas,

          presupuestoSubtotal:
            budgetSummary.subtotal,

          descuentoImporte:
            budgetSummary.discountAmount,

          presupuestoEstimado:
            budgetSummary.total,

          actualizadoEn:
            new Date()
              .toISOString(),

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
  if (!ticketId) {
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
      String(ticketId)
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

      if (!removed) {
        throw new Error(
          "PIECE_NOT_FOUND"
        );
      }

      pieces.splice(
        pieceIndex,
        1
      );

      const budgetSummary =
        calculateTicketBudgetSummary(
          pieces,
          data.manoObra,
          data.descuentoPorcentaje
        );

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio eliminado",

          detail:
            `${
              removed.nombre ||
              "Ítem"
            } eliminado del ticket.`,
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
          piezas,

          presupuestoSubtotal:
            budgetSummary.subtotal,

          descuentoImporte:
            budgetSummary.discountAmount,

          presupuestoEstimado:
            budgetSummary.total,

          actualizadoEn:
            new Date()
              .toISOString(),

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
   GUARDAR RESUMEN ECONÓMICO
========================================= */

export async function saveTicketBudgetSummary(
  ticketId,
  {
    labor = 0,
    discountPercent = 0,
  } = {},
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  let result = null;

  await runTransaction(
    db,
    async (transaction) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (!snapshot.exists()) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      const summary =
        calculateTicketBudgetSummary(
          data.piezas || [],
          labor,
          discountPercent
        );

      const historyEntry =
        createHistoryEntry({
          author,
          action:
            "Presupuesto actualizado",
          detail:
            `Repuestos/servicios: ${summary.piecesTotal} · Mano de obra: ${summary.labor} · Descuento: ${summary.discountPercent}% · Total: ${summary.total}`,
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
          manoObra:
            summary.labor,

          descuentoPorcentaje:
            summary.discountPercent,

          presupuestoSubtotal:
            summary.subtotal,

          descuentoImporte:
            summary.discountAmount,

          presupuestoEstimado:
            summary.total,

          actualizadoEn:
            new Date()
              .toISOString(),

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );

      result = summary;
    }
  );

  return result;
}
