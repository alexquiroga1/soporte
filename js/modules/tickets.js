// js/modules/tickets.js

import { DATA, TICKET_STAGES } from '../core/store.js';
import {
    fDate,
    fmt,
    toast,
    getFullName
} from '../core/utils.js';

import {
    openModal,
    wireKanbanDrag
} from './ui.js';

import {
    currentUserProfile
} from '../core/auth.js';

import {
    ticketState
} from './ticket-state.js';


/* =========================================================
   IMPORTAR DETALLE
========================================================= */

import {
    stageInfo,
    openTicketModal,
    changeTicketStage,
    changeTicketStageAt,
    checkBillingButtonVisibility,
    sendWhatsAppNotice,
    saveDiagnostico,
    saveGarantiaDias
} from './ticket-detail.js';


/* =========================================================
   IMPORTAR PRESUPUESTO
========================================================= */

import {
    fijarPresupuesto,
    desbloquearPresupuesto,
    populateRepuestosSelect,
    renderTicketPiezas,
    updatePiezaPrice,
    addPiezaToTicket,
    removePiezaFromTicket,
    enviarAFacturacion
} from './ticket-budget.js';


/* =========================================================
   IMPORTAR BITÁCORA
========================================================= */

import {
    logTicketEvent,
    renderTicketNotas,
    addTicketNota
} from './ticket-notes.js';


/* =========================================================
   ESTADO LOCAL
========================================================= */

let isCreatingTicket = false;
let publicTicketId = null;


/* =========================================================
   RE-EXPORTS
========================================================= */

export {
    ticketState,

    stageInfo,

    openTicketModal,
    changeTicketStage,
    changeTicketStageAt,
    checkBillingButtonVisibility,
    sendWhatsAppNotice,
    saveDiagnostico,
    saveGarantiaDias,

    fijarPresupuesto,
    desbloquearPresupuesto,
    populateRepuestosSelect,
    renderTicketPiezas,
    updatePiezaPrice,
    addPiezaToTicket,
    removePiezaFromTicket,
    enviarAFacturacion,

    logTicketEvent,
    renderTicketNotas,
    addTicketNota
};


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

        box.style.display =
            'none';

        return;
    }


    const match =
        DATA.clientes.filter(cliente => {

            const full =
                getFullName(cliente);

            const telefono =
                cliente.tel || '';

            return (
                full
                    .toLowerCase()
                    .includes(q) ||

                telefono
                    .toLowerCase()
                    .includes(q)
            );
        });


    if (match.length > 0) {

        box.style.display =
            'block';

        box.innerHTML =
            match.map(cliente => `

                <div
                    style="
                        padding:8px 12px;
                        cursor:pointer;
                        border-bottom:
                            1px solid var(--line);
                        font-size:13px;
                    "
                    onclick="
                        selectClientForTicket(
                            '${cliente.id}',
                            '${getFullName(cliente)}'
                        )
                    "
                >

                    <b>
                        ${getFullName(cliente)}
                    </b>

                    <span
                        style="
                            color:var(--muted);
                            font-size:11px;
                        "
                    >
                        (${cliente.tel || 'Sin teléfono'})
                    </span>

                </div>

            `).join('');

    } else {

        box.style.display =
            'block';

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
                        document
                            .getElementById(
                                'nt-client-suggestions'
                            )
                            .style.display = 'none';
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
        suggestions.style.display =
            'none';
    }


    const today =
        new Date()
            .toISOString()
            .split('T')[0];


    const garantias =
        DATA.tickets.filter(ticket =>
            ticket.clienteId === id &&
            ticket.garantiaVencimiento &&
            ticket.garantiaVencimiento >= today
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
            garantias.map(ticket => `

                <li>
                    <b>#${ticket.id}</b>
                    -
                    ${ticket.equipo}
                    (Vence:
                    ${fDate(
                        ticket.garantiaVencimiento
                    )})
                </li>

            `).join('');

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

    const filter =
        document.getElementById(
            'tk-filter-tecnico'
        );

    const select =
        document.getElementById(
            'nt-tecnico'
        );


    const tecnicos =
        (DATA.usuarios || [])
            .filter(
                usuario =>
                    usuario.activo
            );


    const options =
        tecnicos.map(tecnico => `

            <option
                value="${tecnico.nombre}"
            >
                ${tecnico.nombre}
            </option>

        `).join('');


    if (filter) {

        filter.innerHTML =
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


    if (select) {

        select.innerHTML =
            `
                <option value="Sin asignar">
                    Sin asignar
                </option>
            ` +
            options;
    }
}


/* =========================================================
   TABLA DE TICKETS
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


    if (!tableBody) return;


    const q =
        (searchInput?.value || '')
            .toLowerCase();

    const fEstado =
        estadoFilter?.value || '';

    const fPrio =
        prioFilter?.value || '';

    const fTecnico =
        tecnicoFilter?.value || '';


    const rows =
        DATA.tickets.filter(ticket => {

            const cliente =
                (ticket.cliente || '')
                    .toLowerCase();

            const equipo =
                (ticket.equipo || '')
                    .toLowerCase();

            const ticketId =
                (ticket.id || '')
                    .toLowerCase();


            const matchQ =
                !q ||
                cliente.includes(q) ||
                equipo.includes(q) ||
                ticketId.includes(q);


            const matchEstado =
                !fEstado ||
                ticket.stage === fEstado;

            const matchPrio =
                !fPrio ||
                ticket.prioridad === fPrio;

            const matchTecnico =
                !fTecnico ||
                ticket.tecnico === fTecnico;


            return (
                matchQ &&
                matchEstado &&
                matchPrio &&
                matchTecnico
            );
        });


    tableBody.innerHTML =
        rows.map(ticket => {

            const estado =
                stageInfo(
                    ticket.stage
                );

            const prioridad =
                ticket.prioridad ||
                'P2';

            const tecnico =
                ticket.tecnico ||
                'Sin asignar';


            const presupuesto =
                ticket.presupuestoFijado

                    ? `
                        <span
                            style="
                                color:var(--teal);
                                font-family:
                                    'IBM Plex Mono',
                                    monospace;
                                font-weight:700;
                            "
                        >
                            ${fmt(
                                ticket.presupuestoEstimado || 0
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
                            '${ticket.id}'
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
                        #${ticket.id}
                    </td>


                    <td>
                        ${ticket.cliente || 'Sin cliente'}
                    </td>


                    <td>
                        ${ticket.equipo || 'Sin equipo'}
                    </td>


                    <td class="mono">
                        ${ticket.ingreso || '—'}
                    </td>


                    <td>
                        ${presupuesto}
                    </td>


                    <td>

                        <span
                            class="
                                badge
                                ${estado.badge}
                            "
                        >
                            ${estado.label}
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
                                    '${ticket.id}'
                                )
                            "
                            title="Consultar detalle"
                        >
                            👁️
                        </button>

                    </td>

                </tr>
            `;

        }).join('')

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


    const abiertos =
        DATA.tickets.filter(ticket =>
            ticket.stage !== 'entregado' &&
            ticket.stage !== 'cancelado' &&
            ticket.stage !== 'noreparable'
        ).length;


    const meta =
        document.getElementById(
            'tickets-meta'
        );

    if (meta) {

        meta.textContent =
            `${DATA.tickets.length} TOTALES · ${abiertos} ABIERTOS`;
    }


    const badge =
        document.getElementById(
            'badge-tickets'
        );

    if (badge) {

        badge.textContent =
            abiertos;
    }
}


/* =========================================================
   IMPRIMIR TICKET
========================================================= */

export function printTicket(id) {

    const ticket =
        DATA.tickets.find(
            ticket =>
                ticket.id === id
        );

    if (!ticket) return;


    const negocio =
        DATA.negocio?.nombre ||
        'EMPRESA';


    const check = value =>
        value
            ? '☑'
            : '☐';


    const win =
        window.open(
            '',
            '',
            'width=800,height=900'
        );


    if (!win) {
        toast(
            'El navegador bloqueó la ventana de impresión.'
        );
        return;
    }


    win.document.write(`

        <html>

        <head>

            <title>
                Comprobante #${ticket.id}
            </title>

            <style>

                body {
                    font-family:
                        Inter,
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
                }

                .box {
                    border:
                        1px solid #E4E6EC;
                    padding:15px;
                    border-radius:8px;
                    margin-bottom:20px;
                }

                .row {
                    display:flex;
                    justify-content:space-between;
                    margin-bottom:10px;
                }

                .grid-2 {
                    display:grid;
                    grid-template-columns:
                        1fr 1fr;
                    gap:10px;
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

            </style>

        </head>


        <body>

            <div class="header">

                <h1>
                    ${negocio}
                </h1>

                <h2>
                    COMPROBANTE DE SERVICIO
                </h2>

            </div>


            <div class="row">

                <div>
                    <b>Ticket Nº:</b>
                    ${ticket.id}
                </div>

                <div>
                    <b>Fecha:</b>
                    ${ticket.ingreso}
                </div>

            </div>


            <div class="box">

                <b>Cliente:</b>
                ${ticket.cliente}

            </div>


            <div class="box">

                <div class="grid-2">

                    <div>
                        <b>Equipo:</b>
                        ${ticket.equipo}
                    </div>

                    <div>
                        <b>Marca:</b>
                        ${ticket.marca || 'N/A'}
                    </div>

                    <div>
                        <b>Modelo:</b>
                        ${ticket.modelo || 'N/A'}
                    </div>

                    <div>
                        <b>Serie:</b>
                        ${ticket.serie || 'N/A'}
                    </div>

                </div>

            </div>


            <div class="box">

                <b>Falla declarada:</b>

                <p>
                    ${ticket.falla || 'Sin descripción'}
                </p>

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
   KANBAN
========================================================= */

export function renderTicketsKanban() {

    const board =
        document.getElementById(
            'tickets-kanban'
        );

    if (!board) return;


    board.innerHTML =
        TICKET_STAGES.map(stage => {

            const tickets =
                DATA.tickets.filter(
                    ticket =>
                        ticket.stage === stage.key
                );


            const cards =
                tickets.map(ticket => `

                    <div
                        class="kanban-card"
                        draggable="true"
                        data-id="${ticket.id}"
                        onclick="
                            openTicketModal(
                                '${ticket.id}'
                            )
                        "
                    >

                        <div class="kc-top">

                            <span class="kc-id">
                                #${ticket.id}
                            </span>

                            <div
                                class="
                                    prio
                                    ${(ticket.prioridad || 'P2').toLowerCase()}
                                "
                            >
                                ${ticket.prioridad || 'P2'}
                            </div>

                        </div>


                        <b>
                            ${ticket.cliente}
                        </b>


                        <div class="kc-sub">
                            ${ticket.equipo}
                        </div>


                        <div class="kc-foot">

                            <span>
                                ${ticket.tecnico}
                            </span>

                            <span>
                                ${ticket.ingreso}
                            </span>

                        </div>

                    </div>

                `).join('');


            return `

                <div
                    class="kanban-col"
                    data-stage="${stage.key}"
                >

                    <div class="kanban-col-head">

                        <span
                            class="dot"
                            style="
                                background:${stage.color}
                            "
                        >
                        </span>

                        ${stage.label}

                        <b>
                            ${tickets.length}
                        </b>

                    </div>

                    ${cards}

                </div>

            `;

        }).join('');


    wireKanbanDrag(
        board,
        (id, newStage) =>
            changeTicketStageAt(
                id,
                newStage
            )
    );
}


/* =========================================================
   LIMPIAR FORMULARIO
========================================================= */

export function limpiarFormularioTicket() {

    const inputs = [

        'nt-marca',
        'nt-modelo',
        'nt-serie',
        'nt-pin',
        'nt-specs',
        'nt-condicion',
        'nt-falla',
        'nt-cliente-input',
        'nt-cliente-id',

        'nt-dom-dir',
        'nt-dom-fecha',
        'nt-dom-hora',
        'nt-dom-contacto',

        'nt-rem-id',
        'nt-rem-pass'

    ];


    inputs.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.value =
                '';
        }
    });


    const checks = [

        'nt-chk-pantalla',
        'nt-chk-carcasa',
        'nt-chk-teclado',
        'nt-chk-cargador',
        'nt-chk-bateria',
        'nt-chk-puertos',

        'nt-acc-cargador',
        'nt-acc-funda',
        'nt-acc-cable'

    ];


    checks.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.checked =
                false;
        }
    });


    const fotos =
        document.getElementById(
            'nt-fotos'
        );

    if (fotos) {

        fotos.value =
            '';
    }


    const alerta =
        document.getElementById(
            'nt-alerta-garantia'
        );

    if (alerta) {

        alerta.style.display =
            'none';
    }


    const tipoServicio =
        document.getElementById(
            'nt-tipo-servicio'
        );

    if (tipoServicio) {

        tipoServicio.value =
            'Taller';

        toggleTipoServicio();
    }


    const prioridad =
        document.getElementById(
            'nt-prioridad'
        );

    if (prioridad) {

        prioridad.value =
            'P2';

        const radio =
            document.querySelector(
                'input[name="nt-prio-radio"][value="P2"]'
            );

        if (radio) {

            radio.checked =
                true;
        }
    }
}


/* =========================================================
   TIPO DE SERVICIO
========================================================= */

export function toggleTipoServicio() {

    const tipo =
        document
            .getElementById(
                'nt-tipo-servicio'
            )
            ?.value ||
        'Taller';


    const taller =
        document.getElementById(
            'bloque-taller'
        );

    const domicilio =
        document.getElementById(
            'bloque-domicilio'
        );

    const remoto =
        document.getElementById(
            'bloque-remoto'
        );


    if (taller) {
        taller.style.display =
            'none';
    }

    if (domicilio) {
        domicilio.style.display =
            'none';
    }

    if (remoto) {
        remoto.style.display =
            'none';
    }


    if (tipo === 'Taller') {

        if (taller) {

            taller.style.display =
                'block';
        }

    } else if (
        tipo === 'Domicilio'
    ) {

        if (domicilio) {

            domicilio.style.display =
                'block';
        }

    } else if (
        tipo === 'Remoto'
    ) {

        if (remoto) {

            remoto.style.display =
                'block';
        }
    }
}


/* =========================================================
   SUBIR FOTOS
========================================================= */

async function uploadTicketFotos(
    files,
    ticketId
) {

    if (
        !window.firebase?.storage
    ) {
        return [];
    }


    const urls = [];

    const storageRef =
        window
            .firebase
            .storage()
            .ref();


    const limit =
        Math.min(
            files.length,
            3
        );


    for (
        let i = 0;
        i < limit;
        i++
    ) {

        const file =
            files[i];

        const fileRef =
            storageRef.child(
                `tickets/${ticketId}/${Date.now()}_${file.name}`
            );


        await fileRef.put(
            file
        );


        const url =
            await fileRef.getDownloadURL();


        urls.push(
            url
        );
    }


    return urls;
}


/* =========================================================
   CREAR TICKET
========================================================= */

export async function createTicket() {

    if (isCreatingTicket) {
        return;
    }


    const clienteId =
        document
            .getElementById(
                'nt-cliente-id'
            )
            ?.value;


    const clienteInput =
        document
            .getElementById(
                'nt-cliente-input'
            )
            ?.value
            .trim() ||
        '';


    const cliente =
        clienteId
            ? DATA.clientes.find(
                cliente =>
                    cliente.id === clienteId
            )
            : null;


    const clienteNombre =
        cliente
            ? getFullName(cliente)
            : (
                clienteInput ||
                'Mostrador'
            );


    const getValue = id =>
        document
            .getElementById(id)
            ?.value
            .trim() ||
        '';


    const tipoServicio =
        document
            .getElementById(
                'nt-tipo-servicio'
            )
            ?.value ||
        'Taller';


    const equipo =
        document
            .getElementById(
                'nt-tipo-equipo'
            )
            ?.value ||
        'Otro';


    const falla =
        getValue(
            'nt-falla'
        );


    if (!falla) {

        toast(
            'Completa al menos la falla o motivo de consulta'
        );

        return;
    }


    const estadoFisico = {

        pantalla:
            document
                .getElementById(
                    'nt-chk-pantalla'
                )
                ?.checked ||
            false,

        carcasa:
            document
                .getElementById(
                    'nt-chk-carcasa'
                )
                ?.checked ||
            false,

        teclado:
            document
                .getElementById(
                    'nt-chk-teclado'
                )
                ?.checked ||
            false,

        cargador:
            document
                .getElementById(
                    'nt-chk-cargador'
                )
                ?.checked ||
            false,

        bateria:
            document
                .getElementById(
                    'nt-chk-bateria'
                )
                ?.checked ||
            false,

        puertos:
            document
                .getElementById(
                    'nt-chk-puertos'
                )
                ?.checked ||
            false
    };


    const accesoriosObj = {

        cargador:
            document
                .getElementById(
                    'nt-acc-cargador'
                )
                ?.checked ||
            false,

        funda:
            document
                .getElementById(
                    'nt-acc-funda'
                )
                ?.checked ||
            false,

        cable:
            document
                .getElementById(
                    'nt-acc-cable'
                )
                ?.checked ||
            false
    };


    const datosDomicilio = {

        direccion:
            document
                .getElementById(
                    'nt-dom-dir'
                )
                ?.value ||
            '',

        fecha:
            document
                .getElementById(
                    'nt-dom-fecha'
                )
                ?.value ||
            '',

        hora:
            document
                .getElementById(
                    'nt-dom-hora'
                )
                ?.value ||
            '',

        contacto:
            document
                .getElementById(
                    'nt-dom-contacto'
                )
                ?.value ||
            ''
    };


    const datosRemoto = {

        plataforma:
            document
                .getElementById(
                    'nt-rem-plat'
                )
                ?.value ||
            '',

        idConexion:
            document
                .getElementById(
                    'nt-rem-id'
                )
                ?.value ||
            '',

        clave:
            document
                .getElementById(
                    'nt-rem-pass'
                )
                ?.value ||
            ''
    };


    const user =
        currentUserProfile
            ? currentUserProfile.nombre
            : 'Mostrador';


    const fechaIngreso =
        fDate(
            new Date()
                .toISOString()
                .split('T')[0]
        );


    const btn =
        document.getElementById(
            'btn-crear-ticket'
        );


    const originalText =
        btn
            ? btn.innerHTML
            : 'Registrar Ingreso';


    try {

        isCreatingTicket =
            true;


        if (btn) {

            btn.disabled =
                true;

            btn.innerHTML =
                '⏳ Creando ticket...';
        }


        let nuevoNumero;


        const contadoresRef =
            window.db
                .collection('negocio')
                .doc('contadores');


        await window.db.runTransaction(
            async transaction => {

                const contador =
                    await transaction.get(
                        contadoresRef
                    );


                if (
                    !contador.exists
                ) {

                    nuevoNumero =
                        1000;


                    transaction.set(
                        contadoresRef,
                        {
                            tickets: 1001,
                            ventas: 1000
                        }
                    );

                } else {

                    nuevoNumero =
                        contador.data().tickets ||
                        1000;


                    transaction.update(
                        contadoresRef,
                        {
                            tickets:
                                nuevoNumero + 1
                        }
                    );
                }
            }
        );


        const id =
            `TK-${nuevoNumero}`;


        const fotosInput =
            document.getElementById(
                'nt-fotos'
            );


        let urlsFotos =
            [];


        if (
            fotosInput &&
            fotosInput.files.length > 0
        ) {

            if (btn) {

                btn.innerHTML =
                    '📷 Subiendo fotos...';
            }


            urlsFotos =
                await uploadTicketFotos(
                    fotosInput.files,
                    id
                );
        }


        const ticket = {

            id,

            clienteId:
                cliente
                    ? cliente.id
                    : null,

            cliente:
                clienteNombre,

            tipoServicio,

            estadoPago:
                'Pendiente',

            estadoFacturacion:
                'No facturado',

            equipo,

            marca:
                getValue(
                    'nt-marca'
                ),

            modelo:
                getValue(
                    'nt-modelo'
                ),

            serie:
                getValue(
                    'nt-serie'
                ),

            pin:
                getValue(
                    'nt-pin'
                ),

            specs:
                getValue(
                    'nt-specs'
                ),

            estadoFisico,

            accesoriosObj,

            condicion:
                getValue(
                    'nt-condicion'
                ),

            falla,

            fotos:
                urlsFotos,

            datosDomicilio,

            datosRemoto,

            presupuestoFijado:
                false,

            presupuestoEstimado:
                0,

            prioridad:
                document
                    .getElementById(
                        'nt-prioridad'
                    )
                    ?.value ||
                'P2',

            stage:
                'pendiente',

            tecnico:
                document
                    .getElementById(
                        'nt-tecnico'
                    )
                    ?.value ||
                'Sin asignar',

            ingreso:
                fechaIngreso,

            diagnostico:
                'Pendiente de revisión inicial.',

            piezas:
                [],

            historial: [
                {
                    accion:
                        'Ticket creado',

                    detalle:
                        `Check-in inicial. Servicio: ${tipoServicio}`,

                    fecha:
                        fechaIngreso +
                        ' ' +
                        new Date()
                            .toLocaleTimeString(
                                'es-MX',
                                {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }
                            ),

                    autor:
                        user
                }
            ],

            notas:
                []
        };


        await window.db
            .collection('tickets')
            .doc(id)
            .set(ticket);


        limpiarFormularioTicket();


        toast(
            `✓ Ticket #${id} creado exitosamente`
        );


        if (window.goView) {

            window.goView(
                'tickets'
            );
        }

    } catch (error) {

        console.error(
            'Error al crear ticket:',
            error
        );


        toast(
            '❌ Error al crear el ticket. Reintente.'
        );

    } finally {

        isCreatingTicket =
            false;


        if (btn) {

            btn.disabled =
                false;

            btn.innerHTML =
                originalText;
        }
    }
}


/* =========================================================
   ELIMINAR TICKET
========================================================= */

export async function eliminarTicketConCodigo() {

    const id =
        ticketState.currentId;

    if (!id) return;


    const codigo =
        prompt(
            '🔒 ACCIÓN PROTEGIDA\n\n' +
            'Para eliminar este ticket de forma permanente, ' +
            'ingresa el código secreto:'
        );


    if (codigo === null) {
        return;
    }


    if (
        codigo !== '780923'
    ) {

        alert(
            '❌ Código incorrecto. Operación cancelada.'
        );

        return;
    }


    const confirmacion =
        confirm(
            '⚠️ ¿Estás 100% seguro?\n\n' +
            'Esta acción borrará el ticket para siempre ' +
            'y no se puede deshacer.'
        );


    if (!confirmacion) {
        return;
    }


    try {

        await window.db
            .collection('tickets')
            .doc(id)
            .delete();


        ticketState.currentId =
            null;


        toast(
            '✅ Ticket eliminado correctamente'
        );


        if (window.goView) {

            window.goView(
                'tickets'
            );
        }

    } catch (error) {

        console.error(error);

        toast(
            '❌ Error al eliminar el ticket'
        );
    }
}


/* =========================================================
   COMPARTIR PRESUPUESTO
========================================================= */

export function compartirLinkPresupuesto() {

    const id =
        ticketState.currentId;

    if (!id) return;


    const url =
        `${window.location.origin}` +
        `${window.location.pathname}` +
        `?p=${id}`;


    navigator.clipboard
        .writeText(url)

        .then(() => {

            toast(
                'Link de aprobación copiado al portapapeles'
            );
        })

        .catch(() => {

            alert(
                `Link de aprobación:\n\n${url}`
            );
        });
}


/* =========================================================
   PRESUPUESTO PÚBLICO
========================================================= */

export async function initPublicPresupuesto(
    ticketId
) {

    publicTicketId =
        ticketId;


    const login =
        document.getElementById(
            'login-screen'
        );

    const app =
        document.getElementById(
            'app-container'
        );

    const screen =
        document.getElementById(
            'public-presupuesto-screen'
        );


    if (login) {

        login.style.display =
            'none';
    }

    if (app) {

        app.style.display =
            'none';
    }

    if (screen) {

        screen.style.display =
            'flex';
    }


    try {

        const snapshot =
            await window.db
                .collection('tickets')
                .doc(ticketId)
                .get();


        if (
            !snapshot.exists
        ) {

            const loading =
                document.getElementById(
                    'pub-loading'
                );

            if (loading) {

                loading.textContent =
                    'El ticket no existe.';
            }

            return;
        }


        const ticket =
            snapshot.data();


        const loading =
            document.getElementById(
                'pub-loading'
            );


        if (loading) {

            loading.style.display =
                'none';
        }


        if (
            ticket.presupuestoAprobado === true ||
            ticket.presupuestoAprobado === false
        ) {

            document
                .getElementById(
                    'pub-success'
                )
                .style.display =
                'block';


            document
                .getElementById(
                    'pub-icon'
                )
                .textContent =
                ticket.presupuestoAprobado
                    ? '✅'
                    : '❌';


            document
                .getElementById(
                    'pub-msg-title'
                )
                .textContent =
                ticket.presupuestoAprobado
                    ? 'Presupuesto ya aprobado'
                    : 'Presupuesto rechazado';


            document
                .getElementById(
                    'pub-msg-desc'
                )
                .textContent =
                'Este presupuesto ya ha sido respondido previamente.';

            return;
        }


        document
            .getElementById(
                'pub-content'
            )
            .style.display =
            'block';


        document
            .getElementById(
                'pub-tk'
            )
            .textContent =
            `#${ticket.id}`;


        document
            .getElementById(
                'pub-equipo'
            )
            .textContent =
            ticket.equipo;


        document
            .getElementById(
                'pub-falla'
            )
            .textContent =
            ticket.falla;


        document
            .getElementById(
                'pub-diag'
            )
            .textContent =
            ticket.diagnostico ||
            'Pendiente de diagnóstico técnico detallado';


        document
            .getElementById(
                'pub-total'
            )
            .textContent =
            fmt(
                ticket.presupuestoEstimado || 0
            );

    } catch (error) {

        console.error(error);


        const loading =
            document.getElementById(
                'pub-loading'
            );

        if (loading) {

            loading.textContent =
                'Error al cargar la información.';
        }
    }
}


/* =========================================================
   RESPONDER PRESUPUESTO
========================================================= */

export async function responderPresupuesto(
    respuesta
) {

    if (!publicTicketId) {
        return;
    }


    const aprobado =
        respuesta === 'aprobado';


    const content =
        document.getElementById(
            'pub-content'
        );

    const loading =
        document.getElementById(
            'pub-loading'
        );


    if (content) {

        content.style.display =
            'none';
    }


    if (loading) {

        loading.style.display =
            'block';

        loading.textContent =
            'Registrando su respuesta...';
    }


    const fecha =
        fDate(
            new Date()
                .toISOString()
                .split('T')[0]
        ) +
        ' ' +
        new Date()
            .toLocaleTimeString(
                'es-MX',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );


    const logEntry = {

        fecha,

        autor:
            'Cliente (Vía Web)',

        accion:
            aprobado
                ? 'Presupuesto APROBADO'
                : 'Presupuesto RECHAZADO',

        detalle:
            'Aceptación digital registrada.'
    };


    try {

        await window.db
            .collection('tickets')
            .doc(publicTicketId)
            .update({

                presupuestoAprobado:
                    aprobado,

                stage:
                    aprobado
                        ? 'reparacion'
                        : 'noreparable',

                historial:
                    window
                        .firebase
                        .firestore
                        .FieldValue
                        .arrayUnion(
                            logEntry
                        )
            });


        if (loading) {

            loading.style.display =
                'none';
        }


        document
            .getElementById(
                'pub-success'
            )
            .style.display =
            'block';


        document
            .getElementById(
                'pub-icon'
            )
            .textContent =
            aprobado
                ? '✅'
                : '❌';


        document
            .getElementById(
                'pub-msg-title'
            )
            .textContent =
            aprobado
                ? '¡Presupuesto Aprobado!'
                : 'Presupuesto Rechazado';


        document
            .getElementById(
                'pub-msg-desc'
            )
            .textContent =
            aprobado
                ? 'Gracias por confirmar. Nuestro equipo comenzará a trabajar en su dispositivo.'
                : 'Hemos registrado su rechazo. Por favor, comuníquese para retirar su equipo.';

    } catch (error) {

        console.error(error);

        if (loading) {

            loading.textContent =
                'Ocurrió un error. Por favor intente más tarde.';
        }
    }
}