import { DATA, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';

import { ticketState } from './ticket-state.js';

import {
    logTicketEvent,
    renderTicketNotas
} from './ticket-notes.js';

import {
    populateRepuestosSelect,
    renderTicketPiezas
} from './ticket-budget.js';


export const stageInfo = key =>
    TICKET_STAGES.find(stage => stage.key === key) || {
        label: key,
        color: '#8891A3',
        badge: 'pend'
    };


/* =========================================================
   CAMBIAR ETAPA DESDE SELECT
========================================================= */

export function changeTicketStage() {

    const select =
        document.getElementById('mt-estado-select');

    if (!select) return;

    changeTicketStageAt(
        ticketState.currentId,
        select.value
    );
}


/* =========================================================
   CAMBIAR ETAPA
========================================================= */

export async function changeTicketStageAt(
    id,
    newStage
) {

    const ticket =
        DATA.tickets.find(
            ticket => ticket.id === id
        );

    if (!ticket || ticket.stage === newStage) {
        return;
    }

    const oldStage =
        stageInfo(ticket.stage).label;

    const newStageLabel =
        stageInfo(newStage).label;

    let updates = {
        stage: newStage
    };

    let logMessage =
        `${oldStage} → ${newStageLabel}`;


    /* -----------------------------------------------------
       ENTREGA + GARANTÍA
    ----------------------------------------------------- */

    if (newStage === 'entregado') {

        const diasGarantia =
            ticket.garantiaDias !== undefined
                ? ticket.garantiaDias
                : 30;

        const vence = new Date();

        vence.setDate(
            vence.getDate() +
            parseInt(diasGarantia)
        );

        const venceStr =
            vence.toISOString()
                .split('T')[0];

        updates.garantiaDias =
            diasGarantia;

        updates.garantiaVencimiento =
            venceStr;

        logMessage +=
            ` | Garantía activada por ${diasGarantia} días (hasta ${fDate(venceStr)}).`;
    }


    /* -----------------------------------------------------
       EQUIPO LISTO
    ----------------------------------------------------- */

    if (newStage === 'listo') {

        updates.fechaListo =
            new Date().toISOString();
    }


    try {

        await window.db
            .collection('tickets')
            .doc(id)
            .update(updates);

        await logTicketEvent(
            id,
            'Estado cambiado',
            logMessage
        );

        toast(
            `Ticket movido a "${newStageLabel}"`
        );

    } catch (error) {

        console.error(error);

        toast(
            'No se pudo actualizar el estado.'
        );
    }
}


/* =========================================================
   ABRIR DETALLE
========================================================= */

export function openTicketModal(id) {

    const ticket =
        DATA.tickets.find(
            ticket => ticket.id === id
        );

    if (!ticket) return;

    ticketState.currentId = id;


    /* -----------------------------------------------------
       HELPERS DOM
    ----------------------------------------------------- */

    const setText = (elementId, text) => {

        const element =
            document.getElementById(elementId);

        if (element) {
            element.textContent =
                text ?? '';
        }
    };


    const setHTML = (elementId, html) => {

        const element =
            document.getElementById(elementId);

        if (element) {
            element.innerHTML = html;
        }
    };


    const setValue = (elementId, value) => {

        const element =
            document.getElementById(elementId);

        if (element) {
            element.value =
                value ?? '';
        }
    };


    /* =====================================================
       INFORMACIÓN PRINCIPAL
    ===================================================== */

    setText(
        'mt-id',
        `#${ticket.id}`
    );

    setText(
        'mt-ingreso',
        `Ingresó el ${ticket.ingreso}`
    );

    setText(
        'mt-cliente',
        ticket.cliente
    );

    setText(
        'mt-equipo',
        ticket.equipo || 'Equipo'
    );

    setText(
        'mt-marca-modelo',
        `${ticket.marca || ''} ${ticket.modelo || ''}`.trim()
    );

    setText(
        'mt-serie',
        ticket.serie || 'N/A'
    );

    setText(
        'mt-specs',
        ticket.specs || 'N/A'
    );

    setText(
        'mt-pin',
        ticket.pin || 'N/A'
    );


    /* =====================================================
       ESTADO FÍSICO
    ===================================================== */

    renderEstadoFisico(ticket);


    /* =====================================================
       ACCESORIOS
    ===================================================== */

    renderAccesorios(ticket);


    /* =====================================================
       INFORMACIÓN OPERATIVA
    ===================================================== */

    setText(
        'mt-condicion',
        ticket.condicion ||
        'Sin observaciones adicionales'
    );

    setHTML(
        'mt-prioridad',
        `
            <span class="badge ${String(ticket.prioridad || 'P2').toLowerCase()}">
                ${ticket.prioridad || 'P2'}
            </span>
        `
    );

    setHTML(
        'mt-tecnico',
        `
            <span style="
                background:var(--ink);
                color:#fff;
                width:22px;
                height:22px;
                display:inline-flex;
                align-items:center;
                justify-content:center;
                border-radius:50%;
                font-size:9px;
                font-weight:bold;
                margin-right:6px;
            ">
                ${initials(ticket.tecnico)}
            </span>

            ${ticket.tecnico || 'Sin asignar'}
        `
    );

    setText(
        'mt-falla',
        ticket.falla || 'Sin descripción'
    );

    setValue(
        'mt-estado-select',
        ticket.stage
    );

    setValue(
        'mt-diagnostico-input',
        ticket.diagnostico || ''
    );


    /* =====================================================
       GARANTÍA
    ===================================================== */

    renderGarantia(ticket);


    /* =====================================================
       FOTOS
    ===================================================== */

    renderFotos(ticket);


    /* =====================================================
       STEPPER
    ===================================================== */

    renderStepper(ticket);


    /* =====================================================
       PRESUPUESTO
    ===================================================== */

    renderPresupuesto(ticket);


    /* =====================================================
       REPUESTOS
    ===================================================== */

    populateRepuestosSelect();

    renderTicketPiezas(ticket);


    /* =====================================================
       FACTURACIÓN
    ===================================================== */

    checkBillingButtonVisibility(ticket);


    /* =====================================================
       BITÁCORA
    ===================================================== */

    renderTicketNotas(ticket);


    /* =====================================================
       ABRIR VISTA
    ===================================================== */

    if (window.goView) {

        window.goView(
            'ticket-detalle'
        );
    }
}


/* =========================================================
   ESTADO FÍSICO
========================================================= */

function renderEstadoFisico(ticket) {

    const container =
        document.getElementById(
            'mt-estado-fisico'
        );

    if (!container) return;

    if (!ticket.estadoFisico) {

        container.innerHTML =
            `
                <span style="
                    font-size:11px;
                    color:var(--muted);
                ">
                    N/A
                </span>
            `;

        return;
    }

    const labels = {

        pantalla: 'Pantalla',
        carcasa: 'Carcasa',
        teclado: 'Teclado',
        cargador: 'Cargador',
        bateria: 'Batería',
        puertos: 'Puertos'

    };


    const activos =
        Object.entries(labels)
            .filter(
                ([key]) =>
                    ticket.estadoFisico[key]
            );


    if (!activos.length) {

        container.innerHTML =
            `
                <span style="
                    font-size:11px;
                    color:var(--muted);
                ">
                    Sin detalles OK
                </span>
            `;

        return;
    }


    container.innerHTML =
        activos
            .map(
                ([, label]) =>
                    `
                        <span class="badge"
                            style="
                                background:#f0f0f0;
                                color:#333;
                            ">
                            ${label}
                        </span>
                    `
            )
            .join('');
}


/* =========================================================
   ACCESORIOS
========================================================= */

function renderAccesorios(ticket) {

    const container =
        document.getElementById(
            'mt-accesorios-obj'
        );

    if (!container) return;

    if (!ticket.accesoriosObj) {

        container.innerHTML =
            `
                <span style="
                    font-size:11px;
                    color:var(--muted);
                ">
                    N/A
                </span>
            `;

        return;
    }


    const accesorios = [

        {
            key: 'cargador',
            label: '🔌 Cargador'
        },

        {
            key: 'funda',
            label: '💼 Funda'
        },

        {
            key: 'cable',
            label: '🪢 Cable'
        }

    ];


    const activos =
        accesorios.filter(
            accesorio =>
                ticket.accesoriosObj[
                    accesorio.key
                ]
        );


    container.innerHTML =
        activos.length

            ? activos.map(
                accesorio =>
                    `
                        <span class="badge"
                            style="
                                background:#e3f2fd;
                                color:#0d47a1;
                            ">
                            ${accesorio.label}
                        </span>
                    `
            ).join('')

            : `
                <span style="
                    font-size:11px;
                    color:var(--muted);
                ">
                    Ninguno
                </span>
            `;
}


/* =========================================================
   GARANTÍA
========================================================= */

function renderGarantia(ticket) {

    const input =
        document.getElementById(
            'mt-garantia-dias'
        );

    const vencimiento =
        document.getElementById(
            'mt-garantia-vence'
        );


    if (input) {

        input.value =
            ticket.garantiaDias !== undefined
                ? ticket.garantiaDias
                : 30;
    }


    if (!vencimiento) return;


    if (ticket.garantiaVencimiento) {

        const today =
            new Date()
                .toISOString()
                .split('T')[0];

        const activa =
            ticket.garantiaVencimiento >=
            today;

        vencimiento.textContent =
            `Vence: ${fDate(ticket.garantiaVencimiento)} - ${
                activa
                    ? '🟢 VIGENTE'
                    : '🔴 VENCIDA'
            }`;

        vencimiento.style.color =
            activa
                ? 'var(--teal)'
                : 'var(--red)';

    } else {

        vencimiento.textContent =
            'Garantía inactiva (Ticket no entregado)';

        vencimiento.style.color =
            'var(--muted)';
    }
}


/* =========================================================
   FOTOS
========================================================= */

function renderFotos(ticket) {

    const container =
        document.getElementById(
            'mt-fotos-container'
        );

    const gallery =
        document.getElementById(
            'mt-fotos-gallery'
        );


    if (
        !container ||
        !gallery
    ) {
        return;
    }


    if (
        Array.isArray(ticket.fotos) &&
        ticket.fotos.length
    ) {

        container.style.display =
            'block';

        gallery.innerHTML =
            ticket.fotos.map(
                url =>
                    `
                        <a
                            href="${url}"
                            target="_blank"
                            title="Ver foto completa"
                        >
                            <img
                                src="${url}"
                                style="
                                    width:70px;
                                    height:70px;
                                    object-fit:cover;
                                    border-radius:8px;
                                    border:1px solid var(--line);
                                "
                            >
                        </a>
                    `
            )
            .join('');

    } else {

        container.style.display =
            'none';
    }
}


/* =========================================================
   STEPPER
========================================================= */

function renderStepper(ticket) {

    const stages = [

        'pendiente',
        'diagnostico',
        'presupuesto',
        'reparacion',
        'repuesto',
        'listo',
        'entregado'

    ];


    const currentIndex =
        stages.indexOf(
            ticket.stage
        );


    document
        .querySelectorAll(
            '#mt-stepper .step-sm'
        )
        .forEach(element => {

            const stepKey =
                element.getAttribute(
                    'data-step'
                );

            const stepIndex =
                stages.indexOf(
                    stepKey
                );


            element.className =
                'step-sm';


            if (
                ticket.stage ===
                'entregado'
            ) {

                element.classList.add(
                    'completed'
                );

                return;
            }


            if (
                ticket.stage ===
                    'cancelado' ||
                ticket.stage ===
                    'noreparable'
            ) {

                if (stepIndex === 0) {

                    element.classList.add(
                        'completed'
                    );
                }

                return;
            }


            if (
                ticket.stage ===
                'garantia'
            ) {

                if (
                    stepKey ===
                    'reparacion'
                ) {

                    element.classList.add(
                        'active'
                    );
                }

                return;
            }


            if (
                stepKey ===
                ticket.stage
            ) {

                element.classList.add(
                    'active'
                );

            } else if (
                stepIndex <
                currentIndex &&
                currentIndex !== -1
            ) {

                element.classList.add(
                    'completed'
                );
            }
        });
}


/* =========================================================
   PRESUPUESTO
========================================================= */

function renderPresupuesto(ticket) {

    if (
        ticket.presupuestoFijado ===
        undefined
    ) {

        ticket.presupuestoFijado =
            false;
    }


    const input =
        document.getElementById(
            'input-presupuesto'
        );

    const texto =
        document.getElementById(
            'txt-presupuesto-fijado'
        );

    const edit =
        document.getElementById(
            'view-edit-budget'
        );

    const locked =
        document.getElementById(
            'view-locked-budget'
        );


    if (input) {

        input.value =
            ticket.presupuestoEstimado ||
            '';
    }


    if (ticket.presupuestoFijado) {

        if (texto) {

            texto.textContent =
                fmt(
                    ticket.presupuestoEstimado
                );
        }

        if (edit) {

            edit.style.display =
                'none';
        }

        if (locked) {

            locked.style.display =
                'block';
        }

    } else {

        if (locked) {

            locked.style.display =
                'none';
        }

        if (edit) {

            edit.style.display =
                'flex';
        }
    }
}


/* =========================================================
   VISIBILIDAD FACTURACIÓN
========================================================= */

export function checkBillingButtonVisibility(ticket) {

    const button =
        document.getElementById(
            'btn-facturar-ticket'
        );

    if (!button) return;

    button.style.display =
        ticket.stage === 'listo'
            ? 'inline-flex'
            : 'none';
}


/* =========================================================
   WHATSAPP
========================================================= */

export function sendWhatsAppNotice() {

    const ticket =
        DATA.tickets.find(
            ticket =>
                ticket.id ===
                ticketState.currentId
        );

    if (!ticket) return;


    const cliente =
        DATA.clientes.find(
            cliente =>
                cliente.id ===
                    ticket.clienteId ||
                getFullName(cliente) ===
                    ticket.cliente
        );


    if (
        !cliente ||
        !cliente.tel ||
        cliente.tel === '—'
    ) {

        alert(
            '⚠️ El cliente no tiene un número de teléfono registrado.'
        );

        return;
    }


    let phone =
        cliente.tel.replace(
            /\D/g,
            ''
        );


    if (
        !phone.startsWith('54') &&
        phone.length === 10
    ) {

        phone =
            `549${phone}`;
    }


    const empresa =
        DATA.negocio?.nombre ||
        'nuestro servicio técnico';


    const estado =
        stageInfo(
            ticket.stage
        ).label;


    const message =
        `Hola ${ticket.cliente}, te escribimos de *${empresa}*.\n\n` +
        `Te informamos que tu equipo *${ticket.equipo}* ` +
        `(Ticket #${ticket.id}) se encuentra actualmente ` +
        `en estado: *${estado}*.\n\n` +
        `Cualquier consulta estamos a tu disposición.`;


    window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        '_blank'
    );


    logTicketEvent(
        ticketState.currentId,
        'Notificación enviada',
        'El cliente fue notificado vía WhatsApp'
    );
}


/* =========================================================
   GUARDAR DIAGNÓSTICO
========================================================= */

export async function saveDiagnostico() {

    const input =
        document.getElementById(
            'mt-diagnostico-input'
        );

    if (!input) return;

    const diagnostico =
        input.value.trim();


    try {

        await window.db
            .collection('tickets')
            .doc(ticketState.currentId)
            .update({
                diagnostico
            });

        await logTicketEvent(
            ticketState.currentId,
            'Diagnóstico actualizado',
            diagnostico
        );

        toast(
            'Diagnóstico guardado con éxito'
        );

    } catch (error) {

        console.error(error);

        toast(
            'Error al guardar diagnóstico'
        );
    }
}


/* =========================================================
   GUARDAR GARANTÍA
========================================================= */

export async function saveGarantiaDias() {

    const input =
        document.getElementById(
            'mt-garantia-dias'
        );

    if (
        !input ||
        !ticketState.currentId
    ) {
        return;
    }


    const dias =
        parseInt(
            input.value
        ) || 0;


    const ticket =
        DATA.tickets.find(
            ticket =>
                ticket.id ===
                ticketState.currentId
        );


    const updates = {
        garantiaDias: dias
    };


    if (
        ticket &&
        ticket.stage ===
        'entregado'
    ) {

        const vence =
            new Date();

        vence.setDate(
            vence.getDate() +
            dias
        );

        updates.garantiaVencimiento =
            vence
                .toISOString()
                .split('T')[0];
    }


    try {

        await window.db
            .collection('tickets')
            .doc(
                ticketState.currentId
            )
            .update(updates);


        await logTicketEvent(
            ticketState.currentId,
            'Garantía editada',
            `Período ajustado a ${dias} días.`
        );


        toast(
            'Días de garantía guardados'
        );

    } catch (error) {

        console.error(error);

        toast(
            'Error guardando garantía'
        );
    }
}