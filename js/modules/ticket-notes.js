import { DATA } from '../core/store.js';
import { fDate, toast } from '../core/utils.js';
import { currentUserProfile } from '../core/auth.js';
import { ticketState } from './ticket-state.js';


/* =========================================================
   REGISTRAR EVENTO EN BITÁCORA
========================================================= */

export async function logTicketEvent(
    ticketId,
    accion,
    detalle = ''
) {

    if (!ticketId) {
        return;
    }


    const user =
        currentUserProfile
            ? currentUserProfile.nombre
            : 'Sistema';


    const now =
        new Date();


    const fechaStr =
        fDate(
            now
                .toISOString()
                .split('T')[0]
        ) +
        ' ' +
        now.toLocaleTimeString(
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
                    window.firebase
                        .firestore
                        .FieldValue
                        .arrayUnion(logEntry)
            });


        /* -------------------------------------------------
           ACTUALIZAR MEMORIA LOCAL
        ------------------------------------------------- */

        const ticket =
            DATA.tickets.find(
                item =>
                    item.id === ticketId
            );


        if (ticket) {

            if (
                !Array.isArray(
                    ticket.historial
                )
            ) {

                ticket.historial =
                    [];
            }


            ticket.historial.push(
                logEntry
            );


            /* ---------------------------------------------
               REFRESCAR BITÁCORA SI ES EL TICKET ABIERTO
            --------------------------------------------- */

            if (
                ticketState.currentId ===
                ticketId
            ) {

                renderTicketNotas(
                    ticket
                );
            }
        }


        return logEntry;

    } catch (error) {

        console.error(
            'Error registrando historial:',
            error
        );


        return null;
    }
}


/* =========================================================
   RENDERIZAR BITÁCORA
========================================================= */

export function renderTicketNotas(ticket) {

    const container =
        document.getElementById(
            'mt-notas'
        );


    if (!container) {
        return;
    }


    const historial =
        Array.isArray(
            ticket?.historial
        )

            ? ticket.historial

            : [];


    if (!historial.length) {

        container.innerHTML = `

            <div
                style="
                    color:var(--muted);
                    font-size:11px;
                    text-align:center;
                    padding:14px;
                "
            >
                Sin historial.
            </div>

        `;

        return;
    }


    container.innerHTML =
        historial
            .slice()
            .reverse()
            .map(
                evento => `

                    <div
                        style="
                            background:var(--bg);
                            padding:10px;
                            border-radius:8px;
                            border-left:
                                3px solid var(--copper);
                            margin-bottom:8px;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:
                                    space-between;
                                gap:10px;
                                margin-bottom:4px;
                                font-size:11px;
                            "
                        >

                            <b
                                style="
                                    color:var(--ink);
                                "
                            >
                                ${escapeHtml(
                                    evento.accion ||
                                    'Evento'
                                )}
                            </b>


                            <span
                                style="
                                    color:var(--muted);
                                    white-space:nowrap;
                                "
                            >
                                ${escapeHtml(
                                    evento.fecha ||
                                    ''
                                )}
                            </span>

                        </div>


                        ${
                            evento.detalle

                                ? `

                                    <div
                                        style="
                                            font-size:12px;
                                            color:var(--ink);
                                            line-height:1.45;
                                        "
                                    >
                                        ${escapeHtml(
                                            evento.detalle
                                        )}
                                    </div>

                                `

                                : ''
                        }


                        <div
                            style="
                                font-size:10px;
                                color:var(--muted);
                                margin-top:6px;
                                font-family:
                                    'IBM Plex Mono',
                                    monospace;
                            "
                        >
                            Usuario:
                            ${escapeHtml(
                                evento.autor ||
                                'Sistema'
                            )}
                        </div>

                    </div>

                `
            )
            .join('');
}


/* =========================================================
   AGREGAR NOTA MANUAL
========================================================= */

export async function addTicketNota() {

    const input =
        document.getElementById(
            'mt-nota-input'
        );


    if (!input) {

        console.warn(
            'No se encontró mt-nota-input'
        );

        return;
    }


    const texto =
        input.value.trim();


    if (!texto) {

        toast(
            'Escribe una nota antes de guardar.'
        );

        return;
    }


    if (
        !ticketState.currentId
    ) {

        toast(
            'No hay ningún ticket seleccionado.'
        );

        return;
    }


    const ticketId =
        ticketState.currentId;


    const resultado =
        await logTicketEvent(
            ticketId,
            'Nota manual',
            texto
        );


    if (!resultado) {

        toast(
            'No se pudo guardar la nota.'
        );

        return;
    }


    input.value =
        '';


    toast(
        'Nota agregada a la bitácora.'
    );
}


/* =========================================================
   HELPER: ESCAPAR HTML
========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement(
            'div'
        );


    div.textContent =
        value ?? '';


    return div.innerHTML;
}