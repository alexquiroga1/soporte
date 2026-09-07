// js/modules/tickets.js

import { DATA, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal, wireKanbanDrag, goView } from './ui.js';
import { currentUserProfile } from '../core/auth.js';

let currentTicketId = null;
let isCreatingTicket = false;
let publicTicketId = null;


export const stageInfo = key =>
  TICKET_STAGES.find(s => s.key === key) ||
  {
    label: key,
    color: '#8891A3',
    badge: 'pend'
  };


/* =========================================================
   HISTORIAL DEL TICKET
========================================================= */

export async function logTicketEvent(ticketId, accion, detalle = '') {

  const user = currentUserProfile
    ? currentUserProfile.nombre
    : 'Sistema';

  const fechaStr =
    fDate(new Date().toISOString().split('T')[0]) +
    ' ' +
    new Date().toLocaleTimeString(
      'es-MX',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  const logEntry = {
    fecha: fechaStr,
    autor: user,
    accion,
    detalle
  };

  try {

    await window.db
      .collection('tickets')
      .doc(ticketId)
      .update({
        historial:
          window.firebase.firestore.FieldValue.arrayUnion(logEntry)
      });


    const t = DATA.tickets.find(
      x => x.id === ticketId
    );


    if (t) {

      if (!t.historial) {
        t.historial = [];
      }

      t.historial.push(logEntry);


      if (currentTicketId === ticketId) {
        renderTicketNotas(t);
      }
    }

  } catch (e) {

    console.error(
      'Error registrando historial',
      e
    );
  }
}


/* =========================================================
   RENDER BITÁCORA / NOTAS
========================================================= */

export function renderTicketNotas(t) {

  const container =
    document.getElementById('mt-notas');


  if (!container) return;


  const hist =
    t.historial || [];


  container.innerHTML =
    hist
      .slice()
      .reverse()
      .map(h => `

        <div
          class="ticket-log-item"
          style="
            background:var(--surface-2, var(--bg));
            padding:12px;
            border-radius:10px;
            border-left:3px solid var(--copper);
            margin-bottom:8px;
          "
        >

          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:10px;
              margin-bottom:5px;
              font-size:11px;
            "
          >

            <b
              style="
                color:var(--ink);
              "
            >
              ${h.accion || 'Actualización'}
            </b>


            <span
              style="
                color:var(--muted);
                white-space:nowrap;
              "
            >
              ${h.fecha || ''}
            </span>

          </div>


          ${
            h.detalle
              ? `
                <div
                  style="
                    font-size:12px;
                    color:var(--ink);
                    line-height:1.5;
                  "
                >
                  ${h.detalle}
                </div>
              `
              : ''
          }


          <div
            style="
              font-size:10px;
              color:var(--muted);
              margin-top:7px;
              font-family:'IBM Plex Mono', monospace;
            "
          >
            Usuario:
            ${h.autor || 'Sistema'}
          </div>

        </div>

      `)
      .join('') ||

    `
      <div
        style="
          color:var(--muted);
          font-size:12px;
          text-align:center;
          padding:18px;
        "
      >
        Sin historial todavía.
      </div>
    `;
}


/* =========================================================
   AGREGAR NOTA MANUAL
========================================================= */

export async function addTicketManual() {

  const input =
    document.getElementById(
      'mt-nota-input'
    );


  if (!input) return;


  const texto =
    input.value.trim();


  if (!texto) return;


  await logTicketEvent(
    currentTicketId,
    'Nota manual',
    texto
  );


  input.value = '';


  toast('Nota guardada');
}


/* =========================================================
   BUSCADOR DE CLIENTES
========================================================= */

export function onClientSearchInput() {

  const input =
    document.getElementById(
      'nt-cliente-input'
    );


  const box =
    document.getElementById(
      'nt-client-suggestions'
    );


  if (!input || !box) return;


  const q =
    input.value
      .toLowerCase()
      .trim();


  if (!q) {

    box.style.display = 'none';

    return;
  }


  const match =
    DATA.clientes.filter(c => {

      const full =
        getFullName(c);

      return (
        full
          .toLowerCase()
          .includes(q) ||

        (c.tel || '')
          .includes(q)
      );
    });


  if (match.length > 0) {

    box.style.display = 'block';


    box.innerHTML =
      match
        .map(c => `

          <div
            style="
              padding:8px 12px;
              cursor:pointer;
              border-bottom:1px solid var(--line);
              font-size:13px;
            "

            onclick="
              selectClientForTicket(
                '${c.id}',
                '${getFullName(c)}'
              )
            "
          >

            <b>
              ${getFullName(c)}
            </b>


            <span
              style="
                color:var(--muted);
                font-size:11px;
              "
            >
              (${c.tel || 'Sin teléfono'})
            </span>

          </div>

        `)
        .join('');

  } else {

    box.style.display = 'block';


    box.innerHTML = `

      <div
        style="
          padding:10px 12px;
          font-size:12.5px;
          color:var(--muted);
        "
      >

        No encontrado.


        <span
          style="
            color:var(--copper);
            font-weight:600;
            cursor:pointer;
          "

          onclick="
            openModal('modal-nuevo-cliente');

            document.getElementById(
              'nt-client-suggestions'
            ).style.display = 'none';
          "
        >

          ¿Crear nuevo cliente?

        </span>

      </div>

    `;
  }
}


/* =========================================================
   SELECCIONAR CLIENTE
========================================================= */

export function selectClientForTicket(
  id,
  nombre
) {

  const idInput =
    document.getElementById(
      'nt-cliente-id'
    );


  const nameInput =
    document.getElementById(
      'nt-cliente-input'
    );


  const suggestions =
    document.getElementById(
      'nt-client-suggestions'
    );


  if (idInput) {
    idInput.value = id;
  }


  if (nameInput) {
    nameInput.value = nombre;
  }


  if (suggestions) {
    suggestions.style.display = 'none';
  }


  const today =
    new Date()
      .toISOString()
      .split('T')[0];


  const garantias =
    DATA.tickets.filter(
      t =>
        t.clienteId === id &&
        t.garantiaVencimiento &&
        t.garantiaVencimiento >= today
    );


  const alertBox =
    document.getElementById(
      'nt-alerta-garantia'
    );


  const list =
    document.getElementById(
      'nt-lista-garantias'
    );


  if (!alertBox || !list) return;


  if (garantias.length > 0) {

    list.innerHTML =
      garantias
        .map(g => `

          <li>

            <b>
              #${g.id}
            </b>

            -

            ${g.equipo}


            (
              Vence:
              ${fDate(g.garantiaVencimiento)}
            )

          </li>

        `)
        .join('');


    alertBox.style.display =
      'block';

  } else {

    alertBox.style.display =
      'none';
  }
}


/* =========================================================
   TÉCNICOS
========================================================= */

export function populateTecnicos() {

  const selFilter =
    document.getElementById(
      'tk-filter-tecnico'
    );


  const selNew =
    document.getElementById(
      'nt-tecnico'
    );


  const tecnicos =
    DATA.usuarios.filter(
      u => u.activo
    );


  const options =
    tecnicos
      .map(
        t => `
          <option value="${t.nombre}">
            ${t.nombre}
          </option>
        `
      )
      .join('');


  if (selFilter) {

    selFilter.innerHTML =
      `
        <option value="">
          Todos los técnicos
        </option>

        <option value="Sin asignar">
          Sin asignar
        </option>
      ` +
      options;
  }


  if (selNew) {

    selNew.innerHTML =
      `
        <option value="Sin asignar">
          Sin asignar
        </option>
      ` +
      options;
  }
}


/* =========================================================
   TABLA PRINCIPAL DE TICKETS
========================================================= */

export function renderTicketsTable() {

  populateTecnicos();


  const searchInput =
    document.getElementById(
      'tk-search'
    );


  const estadoFilter =
    document.getElementById(
      'tk-filter-estado'
    );


  const prioFilter =
    document.getElementById(
      'tk-filter-prio'
    );


  const tecnicoFilter =
    document.getElementById(
      'tk-filter-tecnico'
    );


  const tableBody =
    document.getElementById(
      'tickets-table-body'
    );


  /*
    IMPORTANTE:

    Si la vista todavía no fue cargada,
    no debemos romper toda la aplicación.
  */

  if (!tableBody) {

    console.warn(
      'renderTicketsTable: No se encontró #tickets-table-body'
    );

    return;
  }


  const q =
    (
      searchInput?.value ||
      ''
    )
      .toLowerCase();


  const fEstado =
    estadoFilter?.value ||
    '';


  const fPrio =
    prioFilter?.value ||
    '';


  const fTecnico =
    tecnicoFilter?.value ||
    '';


  const rows =
    DATA.tickets.filter(t => {

      const cliente =
        (t.cliente || '')
          .toLowerCase();


      const equipo =
        (t.equipo || '')
          .toLowerCase();


      const ticketId =
        (t.id || '')
          .toLowerCase();


      const matchQ =
        !q ||

        cliente.includes(q) ||

        equipo.includes(q) ||

        ticketId.includes(q);


      const matchE =
        !fEstado ||
        t.stage === fEstado;


      const matchP =
        !fPrio ||
        t.prioridad === fPrio;


      const matchT =
        !fTecnico ||
        t.tecnico === fTecnico;


      return (
        matchQ &&
        matchE &&
        matchP &&
        matchT
      );
    });


  tableBody.innerHTML =

    rows
      .map(t => {

        const st =
          stageInfo(
            t.stage
          );


        const prioridad =
          t.prioridad ||
          'P2';


        const tecnico =
          t.tecnico ||
          'Sin asignar';


        const ingreso =
          t.ingreso ||
          '—';


        const presupText =
          t.presupuestoFijado

            ? `

              <span
                style="
                  color:var(--teal);
                  font-family:'IBM Plex Mono',monospace;
                  font-weight:700;
                "
              >
                ${fmt(
                  t.presupuestoEstimado ||
                  0
                )}
              </span>

            `

            : `

              <span
                style="
                  color:var(--amber);
                  font-size:10.5px;
                  font-weight:700;
                "
              >
                PENDIENTE
              </span>

            `;


        return `

          <tr
            class="tbl-row"

            onclick="
              openTicketModal(
                '${t.id}'
              )
            "
          >

            <td>

              <div
                class="
                  prio
                  ${prioridad.toLowerCase()}
                "
              >
                ${prioridad}
              </div>

            </td>


            <td class="mono">

              #${t.id}

            </td>


            <td>

              ${t.cliente || 'Sin cliente'}

            </td>


            <td>

              ${t.equipo || 'Sin equipo'}

            </td>


            <td class="mono">

              ${ingreso}

            </td>


            <td>

              ${presupText}

            </td>


            <td>

              <span
                class="
                  badge
                  ${st.badge}
                "
              >
                ${st.label}
              </span>

            </td>


            <td>

              ${tecnico}

            </td>


            <td
              onclick="
                event.stopPropagation()
              "
            >

              <button
                class="
                  btn
                  btn-ghost
                  btn-sm
                "

                onclick="
                  openTicketModal(
                    '${t.id}'
                  )
                "

                title="Consultar detalle"

                style="
                  padding:4px 8px;
                  margin-right:4px;
                "
              >
                👁️
              </button>

            </td>

          </tr>

        `;

      })
      .join('')

    ||

    `

      <tr>

        <td
          colspan="9"

          style="
            text-align:center;
            color:var(--muted);
            padding:26px;
          "
        >

          No hay tickets con estos filtros.

        </td>

      </tr>

    `;


  /* =====================================================
     CONTADORES DE TICKETS
  ===================================================== */

  const abiertos =
    DATA.tickets.filter(
      t =>
        t.stage !== 'entregado' &&
        t.stage !== 'cancelado' &&
        t.stage !== 'noreparable'
    ).length;


  const ticketsMeta =
    document.getElementById(
      'tickets-meta'
    );


  const badgeTickets =
    document.getElementById(
      'badge-tickets'
    );


  /*
    CORRECCIÓN DEL ERROR:

    Antes el código hacía directamente:

    document.getElementById('tickets-meta').textContent

    Si el elemento no existía,
    JavaScript devolvía null y la aplicación
    producía el error:

    Cannot set properties of null
  */

  if (ticketsMeta) {

    ticketsMeta.textContent =
      DATA.tickets.length +
      ' TOTALES · ' +
      abiertos +
      ' ABIERTOS';
  }


  if (badgeTickets) {

    badgeTickets.textContent =
      abiertos;
  }
}
export function printTicket(id){

  const t =
    DATA.tickets.find(
      x => x.id === id
    );


  if (!t) return;


  const negNombre =
    DATA.negocio
      ? DATA.negocio.nombre
      : 'EMPRESA';


  const check =
    val => val
      ? '☑'
      : '☐';


  const win =
    window.open(
      '',
      '',
      'width=800,height=900'
    );


  win.document.write(`

    <html>

    <head>

      <title>
        Comprobante #${t.id}
      </title>


      <style>

        body {

          font-family:
            'Inter',
            Helvetica,
            sans-serif;

          padding:40px;

          color:#171A21;

          background:#fff;

          font-size:13px;

          line-height:1.5;
        }


        .header {

          text-align:center;

          margin-bottom:20px;

          padding-bottom:20px;

          border-bottom:
            2px solid #171A21;
        }


        .header h1 {

          margin:0;

          font-size:24px;

          text-transform:uppercase;

          letter-spacing:1px;
        }


        .header h2 {

          margin:5px 0 0 0;

          font-size:16px;

          color:#565E70;
        }


        .row {

          display:flex;

          justify-content:space-between;

          margin-bottom:10px;
        }


        .box {

          border:
            1px solid #E4E6EC;

          padding:15px;

          border-radius:8px;

          margin-bottom:20px;
        }


        .box-title {

          font-weight:bold;

          text-transform:uppercase;

          font-size:11px;

          color:#8891A3;

          margin-bottom:10px;

          border-bottom:
            1px solid #E4E6EC;

          padding-bottom:5px;
        }


        .grid-2 {

          display:grid;

          grid-template-columns:
            1fr 1fr;

          gap:10px;
        }


        .check-list {

          display:grid;

          grid-template-columns:
            1fr 1fr;

          gap:6px;
        }


        .check-item {

          display:flex;

          align-items:center;

          gap:6px;
        }


        .signatures {

          margin-top:50px;

          display:flex;

          justify-content:space-between;
        }


        .sig-box {

          width:45%;

          text-align:center;

          border-top:
            1px solid #171A21;

          padding-top:10px;
        }


        .legal {

          font-size:10px;

          color:#8891A3;

          text-align:justify;

          margin-top:30px;
        }

      </style>

    </head>


    <body>


      <div class="header">

        <h1>
          ${negNombre}
        </h1>

        <h2>
          COMPROBANTE DE SERVICIO
        </h2>

      </div>


      <div class="row">

        <div>

          <b>
            Ticket Nº:
          </b>

          ${t.id}

        </div>


        <div>

          <b>
            Fecha/Hora:
          </b>

          ${
            t.historial &&
            t.historial.length
              ? t.historial[0].fecha
              : t.ingreso
          }

        </div>

      </div>


      <div class="row">

        <div>

          <b>
            Servicio:
          </b>

          ${t.tipoServicio}

        </div>


        <div>

          <b>
            Prioridad:
          </b>

          ${t.prioridad}

        </div>

      </div>


      <div class="box">

        <div class="box-title">

          1. Datos del Cliente

        </div>


        <p>

          <b>
            Nombre:
          </b>

          ${t.cliente}

        </p>

      </div>


      <div class="box">

        <div class="box-title">

          2. Ficha Técnica

        </div>


        <div class="grid-2">

          <div>

            <b>
              Equipo:
            </b>

            ${t.equipo}
            ${t.marca || ''}
            ${t.modelo || ''}

          </div>


          <div>

            <b>
              Nº Serie:
            </b>

            ${t.serie || 'N/A'}

          </div>


          <div>

            <b>
              S.O./Specs:
            </b>

            ${t.specs || 'N/A'}

          </div>


          <div>

            <b>
              PIN/Pass:
            </b>

            ${t.pin || 'N/A'}

          </div>

        </div>

      </div>


      ${
        t.tipoServicio === 'Taller'

          ? `

            <div class="box">

              <div class="box-title">

                3. Estado Físico y Accesorios

              </div>


              <div class="grid-2">


                <div>

                  <div
                    style="
                      font-weight:bold;
                      margin-bottom:6px;
                    "
                  >

                    Estado Físico OK:

                  </div>


                  <div class="check-list">

                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.pantalla
                      )}

                      Pantalla

                    </div>


                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.carcasa
                      )}

                      Carcasa

                    </div>


                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.teclado
                      )}

                      Teclado

                    </div>


                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.cargador
                      )}

                      Cargador

                    </div>


                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.bateria
                      )}

                      Batería

                    </div>


                    <div class="check-item">

                      ${check(
                        t.estadoFisico?.puertos
                      )}

                      Puertos

                    </div>

                  </div>

                </div>


                <div>

                  <div
                    style="
                      font-weight:bold;
                      margin-bottom:6px;
                    "
                  >

                    Accesorios Recibidos:

                  </div>


                  <div class="check-list">


                    <div class="check-item">

                      ${check(
                        t.accesoriosObj?.cargador
                      )}

                      Cargador

                    </div>


                    <div class="check-item">

                      ${check(
                        t.accesoriosObj?.funda
                      )}

                      Funda

                    </div>


                    <div class="check-item">

                      ${check(
                        t.accesoriosObj?.cable
                      )}

                      Cable

                    </div>

                  </div>

                </div>

              </div>


              <div
                style="
                  margin-top:15px;
                  border-top:
                    1px dashed #E4E6EC;
                  padding-top:10px;
                "
              >

                <b>
                  Observaciones:
                </b>

                <br>

                ${
                  t.condicion ||
                  'Sin observaciones.'
                }

              </div>

            </div>

          `

          : ''
      }


      ${
        t.tipoServicio === 'Domicilio'

          ? `

            <div class="box">

              <div class="box-title">

                3. Datos de Visita a Domicilio

              </div>


              <div class="grid-2">


                <div>

                  <b>
                    Dirección:
                  </b>

                  ${
                    t.datosDomicilio?.direccion ||
                    'N/A'
                  }

                </div>


                <div>

                  <b>
                    Fecha Prog.:
                  </b>

                  ${
                    t.datosDomicilio?.fecha ||
                    ''
                  }

                  ${
                    t.datosDomicilio?.hora ||
                    ''
                  }

                </div>


                <div>

                  <b>
                    Contacto:
                  </b>

                  ${
                    t.datosDomicilio?.contacto ||
                    'N/A'
                  }

                </div>

              </div>

            </div>

          `

          : ''
      }


      ${
        t.tipoServicio === 'Remoto'

          ? `

            <div class="box">

              <div class="box-title">

                3. Conexión Remota

              </div>


              <div class="grid-2">


                <div>

                  <b>
                    Plataforma:
                  </b>

                  ${
                    t.datosRemoto?.plataforma ||
                    'N/A'
                  }

                </div>


                <div>

                  <b>
                    ID:
                  </b>

                  ${
                    t.datosRemoto?.idConexion ||
                    'N/A'
                  }

                </div>

              </div>

            </div>

          `

          : ''
      }


      <div class="box">

        <div class="box-title">

          4. Motivo / Falla Declarada

        </div>


        <p>

          ${t.falla || 'Sin detalle.'}

        </p>

      </div>


      <div class="legal">

        <b>
          TÉRMINOS Y CONDICIONES:
        </b>


        El cliente declara que los datos del equipo
        son correctos.

        ${negNombre}

        no se responsabiliza por fallas ocultas
        no declaradas al momento del ingreso,
        ni por la pérdida de datos.

        Todo equipo abandonado por más de 90 días
        será considerado en abandono.

      </div>


      <div class="signatures">


        <div class="sig-box">

          Firma y Aclaración Cliente

        </div>


        <div class="sig-box">

          Firma Responsable

        </div>


      </div>


      <script>

        window.onload =
          function() {

            window.print();

          };

      </script>


    </body>

    </html>

  `);


  win.document.close();
}


/* =========================================================
   TABLERO KANBAN
========================================================= */

export function renderTicketsKanban(){

  const board =
    document.getElementById(
      'tickets-kanban'
    );


  if (!board) return;


  board.innerHTML =

    TICKET_STAGES
      .map(s => {

        const items =
          DATA.tickets.filter(
            t => t.stage === s.key
          );


        const cards =

          items
            .map(t => `

              <div
                class="kanban-card"

                draggable="true"

                data-id="${t.id}"

                onclick="
                  openTicketModal(
                    '${t.id}'
                  )
                "
              >

                <div class="kc-top">


                  <span class="kc-id">

                    #${t.id}

                  </span>


                  <div
                    class="
                      prio
                      ${(
                        t.prioridad ||
                        'P2'
                      ).toLowerCase()}
                    "
                  >

                    ${
                      t.prioridad ||
                      'P2'
                    }

                  </div>

                </div>


                <b>

                  ${t.cliente || 'Sin cliente'}

                </b>


                <div class="kc-sub">

                  ${t.equipo || 'Sin equipo'}

                </div>


                <div class="kc-foot">


                  <span>

                    ${
                      t.tecnico ||
                      'Sin asignar'
                    }

                  </span>


                  <span>

                    ${t.ingreso || '—'}

                  </span>

                </div>

              </div>

            `)
            .join('');


        return `

          <div
            class="kanban-col"

            data-stage="${s.key}"
          >

            <div class="kanban-col-head">


              <span
                class="dot"

                style="
                  background:${s.color}
                "
              ></span>


              ${s.label}


              <b>

                ${items.length}

              </b>

            </div>


            ${cards}

          </div>

        `;

      })
      .join('');


  wireKanbanDrag(
    board,

    (
      id,
      newStage
    ) =>
      changeTicketStageAt(
        id,
        newStage
      )
  );
}


/* =========================================================
   CAMBIAR ESTADO DEL TICKET
========================================================= */

export async function changeTicketStageAt(
  id,
  newStage
) {

  const t =
    DATA.tickets.find(
      x => x.id === id
    );


  if (!t) return;


  if (t.stage === newStage) return;


  const oldStageStr =
    stageInfo(
      t.stage
    ).label;


  const newStageStr =
    stageInfo(
      newStage
    ).label;


  let updates = {
    stage: newStage
  };


  let logMsg =
    `${oldStageStr} → ${newStageStr}`;


  /*
    AL ENTREGAR:

    Se activa automáticamente la garantía
    utilizando los días configurados.
  */

  if (newStage === 'entregado') {

    const diasGarantia =
      t.garantiaDias !== undefined
        ? t.garantiaDias
        : 30;


    const fVence =
      new Date();


    fVence.setDate(
      fVence.getDate() +
      parseInt(diasGarantia)
    );


    const venceStr =
      fVence
        .toISOString()
        .split('T')[0];


    updates.garantiaDias =
      diasGarantia;


    updates.garantiaVencimiento =
      venceStr;


    logMsg +=
      ` | Garantía activada por ${diasGarantia} días (hasta ${fDate(venceStr)}).`;
  }


  /*
    AL MARCAR LISTO:

    Guardamos la fecha para luego
    poder utilizarla en facturación
    y estadísticas.
  */

  if (newStage === 'listo') {

    updates.fechaListo =
      new Date()
        .toISOString();
  }


  try {

    await window.db
      .collection('tickets')
      .doc(id)
      .update(updates);


    await logTicketEvent(
      id,
      'Estado cambiado',
      logMsg
    );


    toast(
      `Ticket movido a "${newStageStr}"`
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo actualizar el estado.'
    );
  }
}


/* =========================================================
   CAMBIO DE ESTADO DESDE EL SELECT DEL DETALLE
========================================================= */

export function changeTicketStage(){

  const select =
    document.getElementById(
      'mt-estado-select'
    );


  if (!select) return;


  changeTicketStageAt(
    currentTicketId,
    select.value
  );
}


/* =========================================================
   DETALLE MODERNO DEL TICKET
========================================================= */

export function openTicketModal(id){

  const t =
    DATA.tickets.find(
      x => x.id === id
    );


  if (!t) return;


  currentTicketId = id;


  const view =
    document.getElementById(
      'view-ticket-detalle'
    );


  if (!view) {

    console.warn(
      'No existe #view-ticket-detalle'
    );

    return;
  }


  const stage =
    stageInfo(
      t.stage
    );


  /*
    ETAPAS DEL NUEVO STEPPER
  */

  const linearStages = [

    [
      'pendiente',
      'Recibido'
    ],

    [
      'diagnostico',
      'Diagnóstico'
    ],

    [
      'presupuesto',
      'Aprobación'
    ],

    [
      'reparacion',
      'Reparación'
    ],

    [
      'listo',
      'Listo / Entrega'
    ]

  ];


  const currentIndex =
    linearStages.findIndex(
      ([key]) =>
        key === t.stage
    );


  const client =
    DATA.clientes.find(
      c =>
        c.id === t.clienteId
    );


  const clientPhone =
    client?.tel ||
    'Sin teléfono registrado';


  const estadoFisico =
    t.estadoFisico ||
    {};


  const accesorios =
    t.accesoriosObj ||
    {};


  const estadoItems = [

    [
      'pantalla',
      'Pantalla'
    ],

    [
      'carcasa',
      'Carcasa'
    ],

    [
      'teclado',
      'Teclado'
    ],

    [
      'cargador',
      'Cargador'
    ],

    [
      'bateria',
      'Batería'
    ],

    [
      'puertos',
      'Puertos'
    ]

  ].filter(
    ([key]) =>
      estadoFisico[key]
  );


  const accesoriosItems = [

    [
      'cargador',
      '🔌 Cargador'
    ],

    [
      'funda',
      '💼 Funda'
    ],

    [
      'cable',
      '🪢 Cable'
    ]

  ].filter(
    ([key]) =>
      accesorios[key]
  );


  const stepperHTML =
    linearStages
      .map(
        (
          [key, label],
          index
        ) => {

          let cls =
            'step';


          if (
            t.stage ===
            'entregado'
          ) {

            cls +=
              ' done';

          }

          else if (
            currentIndex >
            index
          ) {

            cls +=
              ' done';

          }

          else if (
            currentIndex ===
            index
          ) {

            cls +=
              ' active';
          }

          else if (
            t.stage ===
            'garantia' &&

            key ===
            'reparacion'
          ) {

            cls +=
              ' active';
          }


          const number =
            cls.includes(
              'done'
            )

              ? '✓'

              : (
                  index + 1
                );


          return `

            <div
              class="${cls}"

              data-step="${key}"
            >

              <div class="num">

                ${number}

              </div>


              <span>

                ${label}

              </span>

            </div>

          `;
        }
      )
      .join('');


  const stageOptions =
    TICKET_STAGES
      .map(
        s => `

          <option
            value="${s.key}"

            ${
              s.key ===
              t.stage

                ? 'selected'

                : ''
            }
          >

            ${s.label}

          </option>

        `
      )
      .join('');


  const presupuestoBloqueado =
    !!t.presupuestoFijado;


  view.innerHTML = `

    <div class="ticket-detail-modern">


      <!-- =====================================
           HERO
      ====================================== -->

      <section class="hero">


        <div class="hero-main">


          <div class="detail-id">


            <div>


              <div class="eyebrow">

                ORDEN DE SERVICIO

              </div>


              <div
                style="
                  display:flex;
                  align-items:center;
                  gap:10px;
                  flex-wrap:wrap;
                "
              >

                <h1 id="mt-id">

                  #${t.id}

                </h1>


                <div id="mt-prioridad">

                  <span
                    class="
                      badge
                      ${(
                        t.prioridad ||
                        'P2'
                      ).toLowerCase()}
                    "
                  >

                    ${
                      t.prioridad ||
                      'P2'
                    }

                  </span>

                </div>


                <span
                  class="
                    badge
                    ${stage.badge}
                  "
                >

                  ${stage.label}

                </span>

              </div>


              <p id="mt-ingreso">

                Ingresó el
                ${t.ingreso || '—'}

              </p>

            </div>


            <div class="hero-actions">


              <button
                class="
                  btn
                  btn-ghost
                "

                onclick="
                  goView('tickets')
                "
              >

                ← Volver

              </button>


              <button
                class="
                  btn
                  btn-primary
                "

                onclick="
                  printTicket(
                    '${t.id}'
                  )
                "
              >

                🖨️ Comprobante

              </button>


              <button
                class="
                  btn
                  btn-danger
                "

                onclick="
                  eliminarTicketConCodigo()
                "
              >

                Eliminar

              </button>

            </div>

          </div>


          <div class="hero-ticket-summary">


            <div class="summary-icon">

              🛠

            </div>


            <div>


              <div
                class="summary-title"

                id="mt-equipo"
              >

                ${
                  t.equipo ||
                  'Equipo'
                }

              </div>


              <div
                class="summary-sub"

                id="mt-marca-modelo"
              >

                ${
                  [
                    t.marca,
                    t.modelo
                  ]
                    .filter(Boolean)
                    .join(' ')
                  ||
                  'Sin marca/modelo'
                }

              </div>

            </div>

          </div>


          <div class="next-action">


            <div class="next-action-icon">

              ⚡

            </div>


            <div>


              <strong>

                Siguiente acción

              </strong>


              <div id="mt-next-action">

                ${
                  t.stage ===
                  'presupuesto'

                    ? 'Esperando respuesta del cliente para proceder.'

                    : `Gestionar el estado: ${stage.label}`
                }

              </div>

            </div>

          </div>


        </div>


        <aside class="hero-side">


          <div class="side-label">

            RESPONSABLE

          </div>


          <div class="tech-card">


            <div class="avatar-big">

              ${
                initials(
                  t.tecnico ||
                  'SA'
                )
              }

            </div>


            <div>


              <strong id="mt-tecnico">

                ${
                  t.tecnico ||
                  'Sin asignar'
                }

              </strong>


              <small>

                Técnico asignado

              </small>

            </div>

          </div>


          <div class="side-divider"></div>


          <label class="side-label">

            ESTADO DEL TICKET

          </label>


          <select
            id="mt-estado-select"

            class="sel"

            onchange="
              changeTicketStage()
            "
          >

            ${stageOptions}

          </select>


          <div class="side-divider"></div>


          <div class="os">


            <div>


              <strong>

                ${
                  t.tipoServicio ||
                  'Taller'
                }

              </strong>


              <span>

                ${
                  t.stage ===
                  'entregado'

                    ? 'Servicio finalizado'

                    : 'Servicio en proceso'
                }

              </span>

            </div>


            <span class="os-dot"></span>

          </div>


        </aside>


      </section>


      <!-- =====================================
           STEPPER
      ====================================== -->

      <div
        class="stepper"

        id="mt-stepper"
      >

        ${stepperHTML}

      </div>


      <!-- =====================================
           TABS
      ====================================== -->

      <div class="tabs-nav">


        <button
          class="
            tab-btn
            active
          "

          data-ticket-tab="tab-info"
        >

          📋 Información General

        </button>


        <button
          class="tab-btn"

          data-ticket-tab="tab-presupuesto"
        >

          💰 Presupuesto y Cobro

        </button>


        <button
          class="tab-btn"

          data-ticket-tab="tab-bitacora"
        >

          📝 Bitácora

        </button>


      </div>


      <main class="grid">


        <div class="stack">


          <!-- =================================
               TAB INFORMACIÓN
          ================================== -->

          <div
            id="tab-info"

            class="
              tab-panel
              active
            "
          >
                    <!-- =================================
               TAB INFORMACIÓN
          ================================== -->

          <div
            id="tab-info"

            class="
              tab-panel
              active
            "
          >


            <!-- CLIENTE -->

            <section class="card-section">


              <div class="section-head">


                <div>


                  <div class="eyebrow">

                    CLIENTE

                  </div>


                  <h2>

                    ${t.cliente || 'Sin cliente'}

                  </h2>

                </div>


                <button
                  class="
                    btn
                    btn-ghost
                    btn-sm
                  "

                  onclick="
                    window.open(
                      'https://wa.me/${(
                        clientPhone ||
                        ''
                      ).replace(/[^0-9]/g,'')}',
                      '_blank'
                    )
                  "
                >

                  💬 WhatsApp

                </button>

              </div>


              <div class="info-grid">


                <div class="info-item">

                  <span>

                    TELÉFONO

                  </span>


                  <strong id="mt-cliente-tel">

                    ${clientPhone}

                  </strong>

                </div>


                <div class="info-item">

                  <span>

                    TIPO DE SERVICIO

                  </span>


                  <strong id="mt-tipo-servicio">

                    ${
                      t.tipoServicio ||
                      'Taller'
                    }

                  </strong>

                </div>


                <div class="info-item">

                  <span>

                    CLIENTE DESDE

                  </span>


                  <strong>

                    ${
                      client?.fechaAlta ||
                      '—'
                    }

                  </strong>

                </div>

              </div>


            </section>


            <!-- FICHA TÉCNICA -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    EQUIPO

                  </div>


                  <h2>

                    Ficha técnica

                  </h2>

                </div>

              </div>


              <div class="tech-grid">


                <div class="tech-item">

                  <span>

                    MARCA

                  </span>


                  <strong id="mt-marca">

                    ${t.marca || '—'}

                  </strong>

                </div>


                <div class="tech-item">

                  <span>

                    MODELO

                  </span>


                  <strong id="mt-modelo">

                    ${t.modelo || '—'}

                  </strong>

                </div>


                <div class="tech-item">

                  <span>

                    NÚMERO DE SERIE

                  </span>


                  <strong id="mt-serie">

                    ${t.serie || '—'}

                  </strong>

                </div>


                <div class="tech-item">

                  <span>

                    PIN / CONTRASEÑA

                  </span>


                  <strong id="mt-pin">

                    ${t.pin || '—'}

                  </strong>

                </div>


                <div
                  class="tech-item"
                  style="grid-column:1 / -1;"
                >

                  <span>

                    SISTEMA / ESPECIFICACIONES

                  </span>


                  <strong id="mt-specs">

                    ${t.specs || 'Sin especificaciones registradas'}

                  </strong>

                </div>

              </div>


            </section>


            <!-- CONDICIÓN DE INGRESO -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    RECEPCIÓN

                  </div>


                  <h2>

                    Condición al ingreso

                  </h2>

                </div>

              </div>


              <div class="condition-layout">


                <div>


                  <h4>

                    Estado físico declarado

                  </h4>


                  <div class="check-list-modern">


                    ${
                      estadoItems.length

                        ? estadoItems
                            .map(
                              ([key, label]) => `

                                <div class="check-chip">

                                  <span>

                                    ✓

                                  </span>

                                  ${label}

                                </div>

                              `
                            )
                            .join('')

                        : `

                            <div
                              class="empty-text"
                            >

                              Sin checklist registrado.

                            </div>

                          `
                    }

                  </div>

                </div>


                <div>


                  <h4>

                    Accesorios recibidos

                  </h4>


                  <div class="check-list-modern">


                    ${
                      accesoriosItems.length

                        ? accesoriosItems
                            .map(
                              ([key, label]) => `

                                <div class="check-chip">

                                  <span>

                                    ✓

                                  </span>

                                  ${label}

                                </div>

                              `
                            )
                            .join('')

                        : `

                            <div
                              class="empty-text"
                            >

                              No se registraron accesorios.

                            </div>

                          `
                    }

                  </div>

                </div>

              </div>


              <div class="condition-note">


                <span>

                  OBSERVACIONES DE INGRESO

                </span>


                <p id="mt-condicion">

                  ${
                    t.condicion ||
                    'Sin observaciones registradas.'
                  }

                </p>

              </div>


            </section>


            <!-- FOTOS -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    EVIDENCIA

                  </div>


                  <h2>

                    Fotos del ingreso

                  </h2>

                </div>

              </div>


              <div
                class="ticket-photos"
                id="mt-fotos"
              >

                ${
                  Array.isArray(t.fotos) &&
                  t.fotos.length

                    ? t.fotos
                        .map(
                          (
                            foto,
                            index
                          ) => `

                            <div class="ticket-photo">

                              <img
                                src="${foto}"
                                alt="Foto ${
                                  index + 1
                                }"
                                loading="lazy"
                              />

                            </div>

                          `
                        )
                        .join('')

                    : `

                        <div class="empty-photos">

                          📷 No se cargaron fotos
                          del ingreso.

                        </div>

                      `
                }

              </div>


            </section>


            <!-- FALLA -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    MOTIVO DE INGRESO

                  </div>


                  <h2>

                    Falla declarada

                  </h2>

                </div>

              </div>


              <div
                class="fault-box"
                id="mt-falla"
              >

                ${
                  t.falla ||
                  'Sin detalle registrado.'
                }

              </div>


            </section>


            <!-- DIAGNÓSTICO -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    SERVICIO TÉCNICO

                  </div>


                  <h2>

                    Diagnóstico

                  </h2>

                </div>


                <button
                  class="
                    btn
                    btn-primary
                    btn-sm
                  "

                  onclick="
                    saveDiagnostico()
                  "
                >

                  Guardar diagnóstico

                </button>

              </div>


              <textarea
                id="mt-diagnostico"
                class="diagnostic-textarea"
                placeholder="Escribí el diagnóstico técnico..."
              >${
                t.diagnostico ||
                ''
              }</textarea>


            </section>


            <!-- GARANTÍA -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    POST SERVICIO

                  </div>


                  <h2>

                    Garantía

                  </h2>

                </div>

              </div>


              <div class="warranty-box">


                <div>


                  <strong>

                    Período de garantía

                  </strong>


                  <span>

                    Configurá la cantidad de días.

                  </span>

                </div>


                <div
                  class="warranty-controls"
                >

                  <input
                    id="mt-garantia-dias"
                    class="inp"
                    type="number"
                    min="0"
                    value="${
                      t.garantiaDias ??
                      30
                    }"
                  />


                  <button
                    class="
                      btn
                      btn-primary
                      btn-sm
                    "

                    onclick="
                      saveGarantiaDias()
                    "
                  >

                    Guardar

                  </button>

                </div>

              </div>


              ${
                t.garantiaVencimiento

                  ? `

                      <div
                        class="warranty-date"
                      >

                        Garantía vigente hasta:

                        <strong>

                          ${fDate(
                            t.garantiaVencimiento
                          )}

                        </strong>

                      </div>

                    `

                  : ''
              }


            </section>


          </div>


          <!-- =================================
               TAB PRESUPUESTO
          ================================== -->

          <div
            id="tab-presupuesto"

            class="tab-panel"
          >


            <!-- PRESUPUESTO -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    VALOR DEL SERVICIO

                  </div>


                  <h2>

                    Presupuesto

                  </h2>

                </div>


                <span
                  class="
                    badge
                    ${
                      presupuestoBloqueado

                        ? 'ok'

                        : 'pend'
                    }
                  "
                >

                  ${
                    presupuestoBloqueado

                      ? 'FIJADO'

                      : 'PENDIENTE'
                  }

                </span>

              </div>


              <div class="budget-main">


                <div class="budget-input-wrap">


                  <span class="currency-symbol">

                    $

                  </span>


                  <input
                    type="number"
                    id="mt-presupuesto"
                    class="budget-input"
                    min="0"
                    value="${
                      Number(
                        t.presupuestoEstimado ||
                        0
                      )
                    }"
                    ${
                      presupuestoBloqueado

                        ? 'disabled'

                        : ''
                    }
                  />

                </div>


                <div
                  class="budget-actions"
                >

                  ${
                    !presupuestoBloqueado

                      ? `

                          <button
                            class="
                              btn
                              btn-primary
                            "

                            onclick="
                              fijarPresupuesto()
                            "
                          >

                            Fijar presupuesto

                          </button>

                        `

                      : `

                          <button
                            class="
                              btn
                              btn-ghost
                            "

                            onclick="
                              editarPresupuesto()
                            "
                          >

                            Editar presupuesto

                          </button>

                        `
                  }

                </div>

              </div>


              <div class="budget-help">

                Una vez fijado, el presupuesto queda
                registrado en el historial del ticket.

              </div>


            </section>


            <!-- REPUESTOS -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    COSTOS

                  </div>


                  <h2>

                    Repuestos y artículos

                  </h2>

                </div>

              </div>


              <div
                class="parts-add"
              >

                <select
                  id="mt-repuesto-select"
                  class="sel"
                >

                  <option value="">

                    Cargando catálogo...

                  </option>

                </select>


                <button
                  class="
                    btn
                    btn-primary
                  "

                  onclick="
                    addPiezaToTicket()
                  "
                >

                  + Agregar

                </button>

              </div>


              <div
                class="parts-table-wrap"
              >

                <table class="parts-table">


                  <thead>

                    <tr>

                      <th>

                        REPUESTO

                      </th>


                      <th>

                        CANT.

                      </th>


                      <th>

                        COSTO

                      </th>


                      <th></th>

                    </tr>

                  </thead>


                  <tbody id="mt-piezas"></tbody>


                </table>

              </div>


              <div
                class="parts-total"
              >

                <span>

                  Costo total de repuestos

                </span>


                <strong
                  id="mt-total-costo"
                >

                  $0

                </strong>

              </div>


            </section>


            <!-- COBRO -->

            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    FACTURACIÓN

                  </div>


                  <h2>

                    Enviar a caja

                  </h2>

                </div>

              </div>


              <div
                class="billing-box"
              >

                <div>


                  <strong>

                    Generar cobro pendiente

                  </strong>


                  <span>

                    El ticket será enviado a Caja
                    para registrar el pago.

                  </span>

                </div>


                <button
                  class="
                    btn
                    btn-primary
                  "

                  onclick="
                    enviarAFacturacion()
                  "
                >

                  Enviar a Caja

                </button>

              </div>


              <div
                class="billing-status"
              >

                Estado de pago:

                <strong>

                  ${
                    t.estadoPago ||
                    'Pendiente'
                  }

                </strong>


                <span class="billing-separator">

                  ·

                </span>


                Facturación:

                <strong>

                  ${
                    t.estadoFacturacion ||
                    'No facturado'
                  }

                </strong>

              </div>


            </section>


          </div>


          <!-- =================================
               TAB BITÁCORA
          ================================== -->

          <div
            id="tab-bitacora"

            class="tab-panel"
          >


            <section class="card-section">


              <div class="section-head">


                <div>

                  <div class="eyebrow">

                    HISTORIAL

                  </div>


                  <h2>

                    Bitácora del ticket

                  </h2>

                </div>

              </div>


              <div
                class="ticket-note-editor"
              >

                <textarea
                  id="mt-nota-input"
                  class="inp"
                  rows="3"
                  placeholder="Agregar una nota o actualización..."
                ></textarea>


                <button
                  class="
                    btn
                    btn-primary
                  "

                  onclick="
                    addTicketNota()
                  "
                >

                  + Registrar nota

                </button>

              </div>


              <div
                id="mt-notas"
                class="ticket-log"
              ></div>


            </section>


          </div>


        </div>


      </main>


    </div>

  `;


  /*
    INICIALIZAR TABS
  */

  const tabButtons =
    view.querySelectorAll(
      '[data-ticket-tab]'
    );


  tabButtons.forEach(
    button => {

      button.addEventListener(
        'click',

        () => {

          const target =
            button.dataset.ticketTab;


          view
            .querySelectorAll(
              '.tab-btn'
            )
            .forEach(
              b =>
                b.classList.remove(
                  'active'
                )
            );


          view
            .querySelectorAll(
              '.tab-panel'
            )
            .forEach(
              panel =>
                panel.classList.remove(
                  'active'
                )
            );


          button.classList.add(
            'active'
          );


          const targetPanel =
            document.getElementById(
              target
            );


          if (
            targetPanel
          ) {

            targetPanel.classList.add(
              'active'
            );
          }
        }
      );
    }
  );


  /*
    RENDERIZAR COMPONENTES DINÁMICOS
  */

  renderTicketNotas(
    t
  );


  populateRepuestosSelect();


  renderTicketPiezas(
    t
  );


  /*
    CAMBIAR DE VISTA
  */

  goView(
    'ticket-detalle'
  );
}
/* =========================================================
   GUARDAR DIAGNÓSTICO
========================================================= */

export async function saveDiagnostico(){

  if (!currentTicketId) return;


  const input =
    document.getElementById(
      'mt-diagnostico'
    );


  if (!input) return;


  const diagnostico =
    input.value.trim();


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({
        diagnostico
      });


    await logTicketEvent(
      currentTicketId,
      'Diagnóstico actualizado',
      diagnostico ||
      'Se eliminó el diagnóstico.'
    );


    toast(
      'Diagnóstico guardado correctamente.'
    );

  } catch (error) {

    console.error(
      'Error guardando diagnóstico:',
      error
    );


    toast(
      'No se pudo guardar el diagnóstico.'
    );
  }
}


/* =========================================================
   GUARDAR DÍAS DE GARANTÍA
========================================================= */

export async function saveGarantiaDias(){

  if (!currentTicketId) return;


  const input =
    document.getElementById(
      'mt-garantia-dias'
    );


  if (!input) return;


  let dias =
    parseInt(
      input.value
    );


  if (
    isNaN(dias) ||
    dias < 0
  ) {

    toast(
      'Ingresá una cantidad válida de días.'
    );

    return;
  }


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({
        garantiaDias: dias
      });


    await logTicketEvent(
      currentTicketId,
      'Garantía configurada',
      `Garantía configurada en ${dias} días.`
    );


    toast(
      'Garantía actualizada.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo guardar la garantía.'
    );
  }
}


/* =========================================================
   FIJAR PRESUPUESTO
========================================================= */

export async function fijarPresupuesto(){

  if (!currentTicketId) return;


  const input =
    document.getElementById(
      'mt-presupuesto'
    );


  if (!input) return;


  const monto =
    Number(
      input.value
    );


  if (
    isNaN(monto) ||
    monto < 0
  ) {

    toast(
      'Ingresá un importe válido.'
    );

    return;
  }


  const confirmar =
    confirm(
      `¿Fijar el presupuesto en ${fmt(monto)}?\n\nLuego quedará registrado en el ticket.`
    );


  if (!confirmar) return;


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({

        presupuestoEstimado:
          monto,

        presupuestoFijado:
          true

      });


    await logTicketEvent(
      currentTicketId,
      'Presupuesto fijado',
      `Presupuesto fijado en ${fmt(monto)}.`
    );


    toast(
      'Presupuesto fijado correctamente.'
    );


    setTimeout(
      () =>
        openTicketModal(
          currentTicketId
        ),
      300
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo fijar el presupuesto.'
    );
  }
}


/* =========================================================
   EDITAR PRESUPUESTO
========================================================= */

export async function editarPresupuesto(){

  if (!currentTicketId) return;


  const confirmar =
    confirm(
      '¿Querés habilitar nuevamente la edición del presupuesto?'
    );


  if (!confirmar) return;


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({

        presupuestoFijado:
          false

      });


    await logTicketEvent(
      currentTicketId,
      'Presupuesto desbloqueado',
      'El presupuesto fue habilitado nuevamente para edición.'
    );


    toast(
      'Presupuesto habilitado para edición.'
    );


    setTimeout(
      () =>
        openTicketModal(
          currentTicketId
        ),
      300
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo editar el presupuesto.'
    );
  }
}


/* =========================================================
   CARGAR SELECT DE REPUESTOS
========================================================= */

export function populateRepuestosSelect(){

  const select =
    document.getElementById(
      'mt-repuesto-select'
    );


  if (!select) return;


  /*
    Detectamos distintos nombres posibles
    de la colección local.
  */

  const inventario =
    DATA.inventario ||
    DATA.repuestos ||
    DATA.productos ||
    [];


  select.innerHTML =
    '<option value="">Seleccionar repuesto...</option>';


  if (
    !inventario.length
  ) {

    select.innerHTML += `

      <option
        value=""
        disabled
      >

        No hay repuestos disponibles

      </option>

    `;

    return;
  }


  inventario.forEach(
    item => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        item.id;


      option.textContent =
        `${item.nombre || item.name || 'Producto'} — ${fmt(
          Number(
            item.precio ||
            item.costo ||
            item.precioVenta ||
            0
          )
        )}`;


      select.appendChild(
        option
      );
    }
  );
}


/* =========================================================
   AGREGAR REPUESTO AL TICKET
========================================================= */

export async function addPiezaToTicket(){

  if (!currentTicketId) return;


  const select =
    document.getElementById(
      'mt-repuesto-select'
    );


  if (
    !select ||
    !select.value
  ) {

    toast(
      'Seleccioná un repuesto.'
    );

    return;
  }


  const inventario =
    DATA.inventario ||
    DATA.repuestos ||
    DATA.productos ||
    [];


  const producto =
    inventario.find(
      p =>
        p.id ===
        select.value
    );


  if (!producto) {

    toast(
      'No se encontró el repuesto.'
    );

    return;
  }


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        currentTicketId
    );


  if (!ticket) return;


  const piezas =
    Array.isArray(
      ticket.piezas
    )

      ? [
          ...ticket.piezas
        ]

      : [];


  const existente =
    piezas.find(
      p =>
        p.id ===
        producto.id
    );


  if (existente) {

    existente.cantidad =
      Number(
        existente.cantidad ||
        1
      ) + 1;

  } else {

    piezas.push({

      id:
        producto.id,

      nombre:
        producto.nombre ||
        producto.name ||
        'Repuesto',

      cantidad:
        1,

      costo:
        Number(
          producto.costo ||
          producto.precio ||
          0
        )

    });
  }


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({
        piezas
      });


    await logTicketEvent(
      currentTicketId,
      'Repuesto agregado',
      `${
        producto.nombre ||
        producto.name ||
        'Repuesto'
      } agregado al ticket.`
    );


    toast(
      'Repuesto agregado.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo agregar el repuesto.'
    );
  }
}


/* =========================================================
   RENDERIZAR REPUESTOS
========================================================= */

export function renderTicketPiezas(ticket){

  const tbody =
    document.getElementById(
      'mt-piezas'
    );


  const totalElement =
    document.getElementById(
      'mt-total-costo'
    );


  if (!tbody) return;


  const piezas =
    Array.isArray(
      ticket.piezas
    )

      ? ticket.piezas

      : [];


  if (!piezas.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="4"
          class="table-empty"
        >

          No se agregaron repuestos.

        </td>

      </tr>

    `;


    if (
      totalElement
    ) {

      totalElement.textContent =
        fmt(0);
    }


    return;
  }


  let total = 0;


  tbody.innerHTML =
    piezas
      .map(
        (
          pieza,
          index
        ) => {

          const cantidad =
            Number(
              pieza.cantidad ||
              1
            );


          const costo =
            Number(
              pieza.costo ||
              0
            );


          total +=
            cantidad *
            costo;


          return `

            <tr>


              <td>

                <strong>

                  ${
                    pieza.nombre ||
                    'Repuesto'
                  }

                </strong>

              </td>


              <td>

                <div class="qty-control">


                  <button
                    onclick="
                      updatePiezaCantidad(
                        ${index},
                        -1
                      )
                    "
                  >

                    −

                  </button>


                  <span>

                    ${cantidad}

                  </span>


                  <button
                    onclick="
                      updatePiezaCantidad(
                        ${index},
                        1
                      )
                    "
                  >

                    +

                  </button>

                </div>

              </td>


              <td>

                ${fmt(
                  costo
                )}

              </td>


              <td>

                <button
                  class="
                    icon-btn
                    danger
                  "

                  title="Eliminar"

                  onclick="
                    removePieza(
                      ${index}
                    )
                  "
                >

                  🗑

                </button>

              </td>


            </tr>

          `;
        }
      )
      .join('');


  if (
    totalElement
  ) {

    totalElement.textContent =
      fmt(total);
  }
}


/* =========================================================
   MODIFICAR CANTIDAD DE REPUESTO
========================================================= */

export async function updatePiezaCantidad(
  index,
  delta
) {

  if (!currentTicketId) return;


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        currentTicketId
    );


  if (!ticket) return;


  const piezas =
    Array.isArray(
      ticket.piezas
    )

      ? [
          ...ticket.piezas
        ]

      : [];


  if (
    !piezas[index]
  ) return;


  piezas[index] = {

    ...piezas[index],

    cantidad:
      Math.max(
        1,

        Number(
          piezas[index].cantidad ||
          1
        ) + delta
      )

  };


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({
        piezas
      });

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo actualizar la cantidad.'
    );
  }
}


/* =========================================================
   ELIMINAR REPUESTO
========================================================= */

export async function removePieza(
  index
) {

  if (!currentTicketId) return;


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        currentTicketId
    );


  if (!ticket) return;


  const piezas =
    Array.isArray(
      ticket.piezas
    )

      ? [
          ...ticket.piezas
        ]

      : [];


  const pieza =
    piezas[index];


  if (!pieza) return;


  const confirmar =
    confirm(
      `¿Eliminar "${pieza.nombre}" del ticket?`
    );


  if (!confirmar) return;


  piezas.splice(
    index,
    1
  );


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({
        piezas
      });


    await logTicketEvent(
      currentTicketId,
      'Repuesto eliminado',
      `${pieza.nombre} fue eliminado del ticket.`
    );


    toast(
      'Repuesto eliminado.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo eliminar el repuesto.'
    );
  }
}


/* =========================================================
   ENVIAR A FACTURACIÓN / CAJA
========================================================= */

export async function enviarAFacturacion(){

  if (!currentTicketId) return;


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        currentTicketId
    );


  if (!ticket) return;


  const presupuesto =
    Number(
      ticket.presupuestoEstimado ||
      0
    );


  if (
    presupuesto <= 0
  ) {

    toast(
      'Primero debés fijar un presupuesto válido.'
    );

    return;
  }


  const confirmar =
    confirm(
      `¿Enviar ${fmt(
        presupuesto
      )} a Caja para registrar el cobro?`
    );


  if (!confirmar) return;


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .update({

        estadoFacturacion:
          'Pendiente',

        enviadoACaja:
          true,

        fechaEnvioCaja:
          new Date()
            .toISOString()

      });


    await logTicketEvent(
      currentTicketId,
      'Enviado a Caja',
      `Se envió un cobro pendiente por ${fmt(presupuesto)}.`
    );


    toast(
      'Ticket enviado correctamente a Caja.'
    );


    /*
      Si existe la función global
      de facturación, actualizamos
      su vista.
    */

    if (
      typeof window.renderFacturacion ===
      'function'
    ) {

      window.renderFacturacion();
    }

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo enviar a Caja.'
    );
  }
}


/* =========================================================
   AGREGAR NOTA A BITÁCORA
========================================================= */

export async function addTicketNota(){

  if (!currentTicketId) return;


  const input =
    document.getElementById(
      'mt-nota-input'
    );


  if (!input) return;


  const nota =
    input.value.trim();


  if (!nota) {

    toast(
      'Escribí una nota antes de guardar.'
    );

    return;
  }


  try {

    await logTicketEvent(
      currentTicketId,
      'Nota',
      nota
    );


    input.value = '';


    toast(
      'Nota agregada a la bitácora.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo guardar la nota.'
    );
  }
}


/* =========================================================
   RENDERIZAR BITÁCORA
========================================================= */

export function renderTicketNotas(ticket){

  const container =
    document.getElementById(
      'mt-notas'
    );


  if (!container) return;


  const historial =
    Array.isArray(
      ticket.historial
    )

      ? [
          ...ticket.historial
        ]

      : [];


  if (
    !historial.length
  ) {

    container.innerHTML = `

      <div class="ticket-log-empty">

        No hay movimientos registrados todavía.

      </div>

    `;

    return;
  }


  /*
    El historial más reciente aparece primero.
  */

  historial.reverse();


  container.innerHTML =
    historial
      .map(
        item => `

          <div class="log-item">


            <div class="log-dot"></div>


            <div class="log-content">


              <div class="log-top">


                <strong>

                  ${
                    item.accion ||
                    'Actualización'
                  }

                </strong>


                <span>

                  ${
                    item.fecha ||
                    '—'
                  }

                </span>

              </div>


              <p>

                ${
                  item.detalle ||
                  ''
                }

              </p>


              ${
                item.autor

                  ? `

                      <small>

                        ${item.autor}

                      </small>

                    `

                  : ''
              }


            </div>


          </div>

        `
      )
      .join('');
}


/* =========================================================
   REGISTRAR EVENTO EN HISTORIAL
========================================================= */

export async function logTicketEvent(
  ticketId,
  accion,
  detalle
) {

  const fecha =
    new Date();


  const fechaStr =
    fecha.toLocaleDateString(
      'es-AR'
    ) +
    ' ' +
    fecha.toLocaleTimeString(
      'es-AR',
      {
        hour:
          '2-digit',

        minute:
          '2-digit'
      }
    );


  const usuario =
    window.currentUser?.nombre ||
    window.currentUser?.email ||
    'Sistema';


  const logEntry = {

    fecha:
      fechaStr,

    autor:
      usuario,

    accion,

    detalle

  };


  await window.db
    .collection('tickets')
    .doc(ticketId)
    .update({

      historial:

        window.firebase
          .firestore
          .FieldValue
          .arrayUnion(
            logEntry
          )

    });
}
/* =========================================================
   ELIMINAR TICKET CON CONFIRMACIÓN
========================================================= */

export async function eliminarTicketConCodigo(){

  if (!currentTicketId) return;


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        currentTicketId
    );


  if (!ticket) return;


  const confirmacion =
    prompt(
      `Para eliminar definitivamente el ticket #${ticket.id}, escribí ELIMINAR`
    );


  if (
    confirmacion !==
    'ELIMINAR'
  ) {

    if (
      confirmacion !== null
    ) {

      toast(
        'El ticket no fue eliminado.'
      );
    }

    return;
  }


  try {

    await window.db
      .collection('tickets')
      .doc(currentTicketId)
      .delete();


    toast(
      'Ticket eliminado correctamente.'
    );


    currentTicketId =
      null;


    goView(
      'tickets'
    );

  } catch (error) {

    console.error(
      'Error eliminando ticket:',
      error
    );


    toast(
      'No se pudo eliminar el ticket.'
    );
  }
}


/* =========================================================
   ACTUALIZAR PRESUPUESTO DESDE FUNCIONES EXTERNAS
========================================================= */

export async function updateTicketPresupuesto(
  ticketId,
  monto
) {

  if (!ticketId) return;


  monto =
    Number(
      monto
    );


  if (
    isNaN(monto) ||
    monto < 0
  ) {

    throw new Error(
      'El importe del presupuesto no es válido.'
    );
  }


  await window.db
    .collection('tickets')
    .doc(ticketId)
    .update({

      presupuestoEstimado:
        monto

    });


  await logTicketEvent(
    ticketId,
    'Presupuesto actualizado',
    `Presupuesto actualizado a ${fmt(monto)}.`
  );
}


/* =========================================================
   ASIGNAR TÉCNICO
========================================================= */

export async function assignTicketTecnico(
  ticketId,
  tecnico
) {

  if (
    !ticketId ||
    !tecnico
  ) return;


  try {

    await window.db
      .collection('tickets')
      .doc(ticketId)
      .update({

        tecnico

      });


    await logTicketEvent(
      ticketId,
      'Técnico asignado',
      `Se asignó a ${tecnico} como responsable del ticket.`
    );


    toast(
      'Técnico asignado correctamente.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudo asignar el técnico.'
    );
  }
}


/* =========================================================
   MARCAR COMO ENTREGADO
========================================================= */

export async function entregarTicket(
  ticketId
) {

  if (!ticketId) return;


  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        ticketId
    );


  if (!ticket) return;


  const confirmar =
    confirm(
      `¿Confirmar la entrega del ticket #${ticket.id}?`
    );


  if (!confirmar) return;


  await changeTicketStageAt(
    ticketId,
    'entregado'
  );
}


/* =========================================================
   ABRIR TICKET POR ID
========================================================= */

export function openTicketById(
  ticketId
) {

  const ticket =
    DATA.tickets.find(
      t =>
        t.id ===
        ticketId
    );


  if (!ticket) {

    toast(
      'No se encontró el ticket.'
    );

    return;
  }


  openTicketModal(
    ticketId
  );
}


/* =========================================================
   BÚSQUEDA RÁPIDA DE TICKETS
========================================================= */

export function searchTickets(
  query
) {

  const q =
    String(
      query ||
      ''
    )
    .trim()
    .toLowerCase();


  if (!q) {

    return [
      ...DATA.tickets
    ];
  }


  return DATA.tickets.filter(
    ticket => {

      const searchable = [

        ticket.id,

        ticket.cliente,

        ticket.equipo,

        ticket.marca,

        ticket.modelo,

        ticket.tecnico,

        ticket.stage,

        ticket.tipoServicio

      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();


      return searchable.includes(
        q
      );
    }
  );
}


/* =========================================================
   OBTENER TICKETS DEL CLIENTE
========================================================= */

export function getTicketsByClient(
  clienteId
) {

  if (!clienteId) {

    return [];
  }


  return DATA.tickets.filter(
    ticket =>
      ticket.clienteId ===
      clienteId
  );
}


/* =========================================================
   CALCULAR TOTAL DE REPUESTOS
========================================================= */

export function getTicketPartsTotal(
  ticket
) {

  if (!ticket) return 0;


  const piezas =
    Array.isArray(
      ticket.piezas
    )

      ? ticket.piezas

      : [];


  return piezas.reduce(
    (
      total,
      pieza
    ) => {

      const cantidad =
        Number(
          pieza.cantidad ||
          1
        );


      const costo =
        Number(
          pieza.costo ||
          0
        );


      return (
        total +
        (
          cantidad *
          costo
        )
      );

    },
    0
  );
}


/* =========================================================
   CALCULAR RESUMEN ECONÓMICO DEL TICKET
========================================================= */

export function getTicketFinancialSummary(
  ticket
) {

  if (!ticket) {

    return {

      presupuesto:
        0,

      costoRepuestos:
        0,

      gananciaEstimada:
        0

    };
  }


  const presupuesto =
    Number(
      ticket.presupuestoEstimado ||
      0
    );


  const costoRepuestos =
    getTicketPartsTotal(
      ticket
    );


  return {

    presupuesto,

    costoRepuestos,

    gananciaEstimada:
      presupuesto -
      costoRepuestos

  };
}


/* =========================================================
   VALIDAR SI EL TICKET PUEDE FACTURARSE
========================================================= */

export function ticketCanBeBilled(
  ticket
) {

  if (!ticket) return false;


  const presupuesto =
    Number(
      ticket.presupuestoEstimado ||
      0
    );


  if (
    presupuesto <= 0
  ) {

    return false;
  }


  if (
    ticket.enviadoACaja
  ) {

    return false;
  }


  return true;
}


/* =========================================================
   INFORMACIÓN DEL ESTADO
========================================================= */

export function getTicketStageLabel(
  stage
) {

  const info =
    stageInfo(
      stage
    );


  return (
    info?.label ||
    'Sin estado'
  );
}


/* =========================================================
   ESTADO DE GARANTÍA
========================================================= */

export function getTicketWarrantyStatus(
  ticket
) {

  if (
    !ticket ||
    !ticket.garantiaVencimiento
  ) {

    return {

      active:
        false,

      expired:
        false,

      daysLeft:
        null

    };
  }


  const today =
    new Date();


  const expiration =
    new Date(
      `${ticket.garantiaVencimiento}T23:59:59`
    );


  const diff =
    expiration.getTime() -
    today.getTime();


  const daysLeft =
    Math.ceil(
      diff /
      (
        1000 *
        60 *
        60 *
        24
      )
    );


  return {

    active:
      daysLeft >= 0,

    expired:
      daysLeft < 0,

    daysLeft:
      Math.abs(
        daysLeft
      )

  };
}


/* =========================================================
   CREAR NUEVO TICKET
========================================================= */

export async function createTicket(
  ticketData
) {

  if (
    !ticketData
  ) {

    throw new Error(
      'No se recibieron datos para crear el ticket.'
    );
  }


  const fecha =
    new Date();


  const fechaStr =
    fecha.toLocaleDateString(
      'es-AR'
    ) +
    ' ' +
    fecha.toLocaleTimeString(
      'es-AR',
      {
        hour:
          '2-digit',

        minute:
          '2-digit'
      }
    );


  const nuevoTicket = {

    clienteId:
      ticketData.clienteId ||
      null,

    cliente:
      ticketData.cliente ||
      '',

    equipo:
      ticketData.equipo ||
      '',

    marca:
      ticketData.marca ||
      '',

    modelo:
      ticketData.modelo ||
      '',

    serie:
      ticketData.serie ||
      '',

    specs:
      ticketData.specs ||
      '',

    pin:
      ticketData.pin ||
      '',

    tipoServicio:
      ticketData.tipoServicio ||
      'Taller',

    tecnico:
      ticketData.tecnico ||
      '',

    prioridad:
      ticketData.prioridad ||
      'P2',

    stage:
      ticketData.stage ||
      'pendiente',

    falla:
      ticketData.falla ||
      '',

    condicion:
      ticketData.condicion ||
      '',

    estadoFisico:
      ticketData.estadoFisico ||
      {},

    accesoriosObj:
      ticketData.accesoriosObj ||
      {},

    datosDomicilio:
      ticketData.datosDomicilio ||
      null,

    datosRemoto:
      ticketData.datosRemoto ||
      null,

    fotos:
      Array.isArray(
        ticketData.fotos
      )

        ? ticketData.fotos

        : [],

    piezas:
      [],

    diagnostico:
      '',

    presupuestoEstimado:
      0,

    presupuestoFijado:
      false,

    garantiaDias:
      Number(
        ticketData.garantiaDias ||
        30
      ),

    garantiaVencimiento:
      null,

    estadoPago:
      'Pendiente',

    estadoFacturacion:
      'No facturado',

    enviadoACaja:
      false,

    ingreso:
      fechaStr,

    creadoEn:
      fecha.toISOString(),

    historial: [

      {

        fecha:
          fechaStr,

        autor:
          window.currentUser?.nombre ||
          window.currentUser?.email ||
          'Sistema',

        accion:
          'Ticket creado',

        detalle:
          'Se creó la orden de servicio.'

      }

    ]

  };


  const docRef =
    await window.db
      .collection('tickets')
      .add(
        nuevoTicket
      );


  return {

    id:
      docRef.id,

    ...nuevoTicket

  };
}


/* =========================================================
   ACTUALIZAR DATOS GENERALES DEL TICKET
========================================================= */

export async function updateTicketData(
  ticketId,
  updates
) {

  if (
    !ticketId ||
    !updates
  ) {

    return;
  }


  try {

    await window.db
      .collection('tickets')
      .doc(ticketId)
      .update(
        updates
      );


    await logTicketEvent(
      ticketId,
      'Datos actualizados',
      'Se actualizaron los datos generales del ticket.'
    );


    toast(
      'Ticket actualizado correctamente.'
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      'No se pudieron actualizar los datos.'
    );
  }
}


/* =========================================================
   FUNCIONES DISPONIBLES GLOBALMENTE

   Necesarias porque el HTML generado usa
   onclick="nombreFuncion()".
========================================================= */

window.openTicketModal =
  openTicketModal;


window.printTicket =
  printTicket;


window.changeTicketStage =
  changeTicketStage;


window.saveDiagnostico =
  saveDiagnostico;


window.saveGarantiaDias =
  saveGarantiaDias;


window.fijarPresupuesto =
  fijarPresupuesto;


window.editarPresupuesto =
  editarPresupuesto;


window.addPiezaToTicket =
  addPiezaToTicket;


window.updatePiezaCantidad =
  updatePiezaCantidad;


window.removePieza =
  removePieza;


window.enviarAFacturacion =
  enviarAFacturacion;


window.addTicketNota =
  addTicketNota;


window.eliminarTicketConCodigo =
  eliminarTicketConCodigo;


window.entregarTicket =
  entregarTicket;


window.openTicketById =
  openTicketById;


window.assignTicketTecnico =
  assignTicketTecnico;