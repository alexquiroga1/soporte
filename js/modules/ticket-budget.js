import { DATA } from '../core/store.js';
import { fmt, toast } from '../core/utils.js';

import { ticketState } from './ticket-state.js';

import {
    logTicketEvent
} from './ticket-notes.js';


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) =>
    document.getElementById(id);


function getCurrentTicket() {

    return DATA.tickets.find(
        ticket =>
            ticket.id ===
            ticketState.currentId
    );
}


function getTicketTotal(ticket) {

    return (ticket.piezas || [])
        .reduce(
            (total, pieza) => {

                return total +
                    (
                        Number(
                            pieza.costo || 0
                        ) *
                        Number(
                            pieza.cant || 0
                        )
                    );

            },
            0
        );
}


function escapeHtml(value) {

    const div =
        document.createElement(
            'div'
        );

    div.textContent =
        value ?? '';

    return div.innerHTML;
}


/* =========================================================
   PRESUPUESTO
========================================================= */

export async function fijarPresupuesto() {

    const input =
        $('input-presupuesto');

    const ticket =
        getCurrentTicket();


    if (!ticket) {

        toast(
            'No hay un ticket seleccionado.'
        );

        return;
    }


    const val =
        parseFloat(
            input?.value
        );


    if (
        Number.isNaN(val) ||
        val <= 0
    ) {

        toast(
            'Ingresa un monto válido.'
        );

        return;
    }


    const updates = {

        presupuestoEstimado:
            val,

        presupuestoFijado:
            true
    };


    try {

        await window.db
            .collection('tickets')
            .doc(ticket.id)
            .update(updates);


        /* Sincronizar memoria */

        Object.assign(
            ticket,
            updates
        );


        const texto =
            $('txt-presupuesto-fijado');

        const edit =
            $('view-edit-budget');

        const locked =
            $('view-locked-budget');


        if (texto) {

            texto.textContent =
                fmt(val);
        }


        if (edit) {

            edit.style.display =
                'none';
        }


        if (locked) {

            locked.style.display =
                'block';
        }


        await logTicketEvent(
            ticket.id,
            'Presupuesto fijado',
            `Cotizado: ${fmt(val)}`
        );


        toast(
            'Presupuesto fijado exitosamente.'
        );

    } catch (error) {

        console.error(
            'Error al fijar presupuesto:',
            error
        );

        toast(
            'Error al fijar presupuesto.'
        );
    }
}


export async function desbloquearPresupuesto() {

    const ticket =
        getCurrentTicket();


    if (!ticket) {

        toast(
            'No hay un ticket seleccionado.'
        );

        return;
    }


    try {

        await window.db
            .collection('tickets')
            .doc(ticket.id)
            .update({

                presupuestoFijado:
                    false
            });


        ticket.presupuestoFijado =
            false;


        const edit =
            $('view-edit-budget');

        const locked =
            $('view-locked-budget');


        if (locked) {

            locked.style.display =
                'none';
        }


        if (edit) {

            edit.style.display =
                'flex';
        }


        await logTicketEvent(
            ticket.id,
            'Presupuesto desbloqueado',
            'Se habilitó nuevamente la modificación del monto.'
        );


        toast(
            'Presupuesto desbloqueado.'
        );

    } catch (error) {

        console.error(
            'Error desbloqueando presupuesto:',
            error
        );

        toast(
            'Error al desbloquear el presupuesto.'
        );
    }
}


/* =========================================================
   CATÁLOGO DE REPUESTOS
========================================================= */

export function populateRepuestosSelect() {

    const select =
        $('mt-repuesto-select');


    if (!select) {
        return;
    }


    const productos =
        Array.isArray(
            DATA.productos
        )

            ? DATA.productos

            : [];


    if (!productos.length) {

        select.innerHTML = `
            <option value="">
                Catálogo vacío
            </option>
        `;

        return;
    }


    select.innerHTML = `

        <option value="">
            Selecciona repuesto...
        </option>

        ${productos.map(
            producto => `

                <option
                    value="${escapeHtml(
                        producto.sku || ''
                    )}"
                >
                    ${escapeHtml(
                        producto.nombre || 'Sin nombre'
                    )}

                    (${fmt(
                        producto.precio || 0
                    )})
                </option>

            `
        ).join('')}

    `;
}


/* =========================================================
   RENDERIZAR REPUESTOS
========================================================= */

export function renderTicketPiezas(ticket) {

    const container =
        $('mt-piezas');


    if (!container) {
        return;
    }


    const piezas =
        Array.isArray(
            ticket?.piezas
        )

            ? ticket.piezas

            : [];


    if (!piezas.length) {

        container.innerHTML = `

            <tr>

                <td
                    colspan="4"
                    style="
                        color:var(--muted);
                        text-align:center;
                        padding:12px;
                    "
                >
                    Sin repuestos agregados.
                </td>

            </tr>

        `;


        const totalElement =
            $('mt-total-costo');


        if (totalElement) {

            totalElement.textContent =
                fmt(0);
        }

        return;
    }


    container.innerHTML =
        piezas.map(
            (pieza, index) => {

                const cantidad =
                    Number(
                        pieza.cant || 0
                    );

                const costo =
                    Number(
                        pieza.costo || 0
                    );

                return `

                    <tr>

                        <td
                            style="
                                padding:7px 6px;
                            "
                        >
                            ${escapeHtml(
                                pieza.nombre
                            )}
                        </td>


                        <td
                            style="
                                padding:7px 6px;
                            "
                        >
                            <b>
                                ${cantidad}
                            </b>
                        </td>


                        <td
                            style="
                                padding:7px 6px;
                            "
                        >

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                class="inp"
                                style="
                                    width:85px;
                                    padding:5px;
                                    font-family:
                                        var(--font-mono);
                                    font-size:11px;
                                "
                                value="${costo}"
                                onchange="
                                    updatePiezaPrice(
                                        ${index},
                                        this.value
                                    )
                                "
                            >

                        </td>


                        <td
                            style="
                                text-align:right;
                                padding:7px 6px;
                            "
                        >

                            <button
                                class="
                                    btn
                                    btn-ghost
                                    btn-sm
                                "
                                type="button"
                                onclick="
                                    removePiezaFromTicket(
                                        ${index}
                                    )
                                "
                                style="
                                    color:var(--red);
                                    padding:3px 7px;
                                    border:none;
                                    background:
                                        transparent;
                                "
                            >
                                ✕
                            </button>

                        </td>

                    </tr>

                `;

            }
        ).join('');


    const total =
        getTicketTotal(
            ticket
        );


    const totalElement =
        $('mt-total-costo');


    if (totalElement) {

        totalElement.textContent =
            fmt(total);
    }
}


/* =========================================================
   GUARDAR PIEZAS
========================================================= */

async function saveTicketPiezas(
    ticket,
    piezas
) {

    await window.db
        .collection('tickets')
        .doc(ticket.id)
        .update({

            piezas
        });


    ticket.piezas =
        piezas;


    renderTicketPiezas(
        ticket
    );
}


/* =========================================================
   MODIFICAR PRECIO
========================================================= */

export async function updatePiezaPrice(
    index,
    newPrice
) {

    const ticket =
        getCurrentTicket();


    if (!ticket) {
        return;
    }


    const value =
        parseFloat(
            newPrice
        );


    if (
        Number.isNaN(value) ||
        value < 0
    ) {

        toast(
            'El precio ingresado no es válido.'
        );

        renderTicketPiezas(
            ticket
        );

        return;
    }


    const piezas =
        [...(
            ticket.piezas ||
            []
        )];


    if (!piezas[index]) {
        return;
    }


    const piezaAnterior =
        piezas[index];


    piezas[index] = {

        ...piezaAnterior,

        costo:
            value
    };


    try {

        await saveTicketPiezas(
            ticket,
            piezas
        );


        await logTicketEvent(
            ticket.id,
            'Costo de repuesto actualizado',
            `${piezaAnterior.nombre}: ${fmt(value)}`
        );


        toast(
            'Costo actualizado.'
        );

    } catch (error) {

        console.error(
            'Error actualizando costo:',
            error
        );

        toast(
            'No se pudo actualizar el costo.'
        );
    }
}


/* =========================================================
   AGREGAR REPUESTO
========================================================= */

export async function addPiezaToTicket() {

    const select =
        $('mt-repuesto-select');

    const ticket =
        getCurrentTicket();


    if (
        !select ||
        !ticket
    ) {
        return;
    }


    const sku =
        select.value;


    if (!sku) {

        toast(
            'Selecciona un repuesto válido.'
        );

        return;
    }


    const producto =
        (DATA.productos || [])
            .find(
                item =>
                    String(
                        item.sku
                    ) ===
                    String(sku)
            );


    if (!producto) {

        toast(
            'No se encontró el producto seleccionado.'
        );

        return;
    }


    const piezas =
        [...(
            ticket.piezas ||
            []
        )];


    const existente =
        piezas.find(
            pieza =>
                String(
                    pieza.sku || ''
                ) ===
                String(
                    producto.sku || ''
                )
        );


    if (existente) {

        existente.cant =
            Number(
                existente.cant || 0
            ) + 1;

    } else {

        piezas.push({

            sku:
                producto.sku || '',

            nombre:
                producto.nombre || 'Sin nombre',

            cant:
                1,

            costo:
                Number(
                    producto.precio || 0
                )
        });
    }


    try {

        await saveTicketPiezas(
            ticket,
            piezas
        );


        select.value =
            '';


        await logTicketEvent(
            ticket.id,
            'Repuesto agregado',
            `${producto.nombre} — ${fmt(
                producto.precio || 0
            )}`
        );


        toast(
            'Repuesto agregado al ticket.'
        );

    } catch (error) {

        console.error(
            'Error agregando repuesto:',
            error
        );

        toast(
            'No se pudo agregar el repuesto.'
        );
    }
}


/* =========================================================
   ELIMINAR REPUESTO
========================================================= */

export async function removePiezaFromTicket(
    index
) {

    const ticket =
        getCurrentTicket();


    if (!ticket) {
        return;
    }


    const piezas =
        [...(
            ticket.piezas ||
            []
        )];


    const pieza =
        piezas[index];


    if (!pieza) {
        return;
    }


    piezas.splice(
        index,
        1
    );


    try {

        await saveTicketPiezas(
            ticket,
            piezas
        );


        await logTicketEvent(
            ticket.id,
            'Repuesto eliminado',
            `Se quitó: ${pieza.nombre}`
        );


        toast(
            'Repuesto eliminado.'
        );

    } catch (error) {

        console.error(
            'Error eliminando repuesto:',
            error
        );

        toast(
            'No se pudo eliminar el repuesto.'
        );
    }
}


/* =========================================================
   ENVIAR A CAJA
========================================================= */

export async function enviarAFacturacion() {

    const ticket =
        getCurrentTicket();


    if (!ticket) {

        toast(
            'No hay un ticket seleccionado.'
        );

        return;
    }


    const piezas =
        Array.isArray(
            ticket.piezas
        )

            ? ticket.piezas

            : [];


    const total =
        getTicketTotal(
            ticket
        );


    if (
        !piezas.length ||
        total <= 0
    ) {

        alert(
            'Debes agregar al menos un repuesto con un importe válido antes de enviar a Caja.'
        );

        return;
    }


    try {

        /*
         * Verificamos directamente en Firebase.
         * Esto evita duplicados incluso si DATA todavía
         * no recibió la actualización del listener.
         */

        const pendientes =
            await window.db
                .collection(
                    'caja_pendientes'
                )
                .where(
                    'ref',
                    '==',
                    ticket.id
                )
                .get();


        if (
            !pendientes.empty
        ) {

            toast(
                'Este ticket ya fue enviado a Caja.'
            );

            return;
        }


        const cobroPendiente = {

            origen:
                'Ticket',

            ref:
                ticket.id,

            clienteId:
                ticket.clienteId ||
                null,

            cliente:
                ticket.cliente ||
                'Consumidor final',

            concepto:
                piezas
                    .map(
                        pieza =>
                            `${Number(
                                pieza.cant || 0
                            )}x ${pieza.nombre}`
                    )
                    .join(', '),

            total,

            articulosCart:
                piezas.map(
                    pieza => ({

                        sku:
                            pieza.sku ||
                            null,

                        nombre:
                            pieza.nombre,

                        cantidad:
                            Number(
                                pieza.cant || 0
                            ),

                        precio:
                            Number(
                                pieza.costo || 0
                            )
                    })
                ),

            fecha:
                new Date()
                    .toISOString(),

            estado:
                'Pendiente'
        };


        await window.db
            .collection(
                'caja_pendientes'
            )
            .add(
                cobroPendiente
            );


        await logTicketEvent(
            ticket.id,
            'Enviado a Caja',
            `Monto pendiente de cobro: ${fmt(total)}`
        );


        toast(
            'Ticket enviado correctamente a Caja.'
        );


        if (
            typeof window.goView ===
            'function'
        ) {

            window.goView(
                'caja'
            );
        }

    } catch (error) {

        console.error(
            'Error enviando a Caja:',
            error
        );

        toast(
            'Error al enviar el ticket a Caja.'
        );
    }
}