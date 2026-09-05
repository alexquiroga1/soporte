// js/modules/facturacion.js

import { DATA } from '../core/store.js';
import { fmt, fDate, toast, getFullName } from '../core/utils.js';
import { currentUserProfile } from '../core/auth.js';
import { goView } from './ui.js';


let currentFacturaId = null;


/* =========================================================
   TABLA DE FACTURAS
   ========================================================= */

export function renderFacturasTable() {

    if (!DATA.facturas) {
        DATA.facturas = [];
    }


    const tbody =
        document.getElementById(
            'facturacion-table-body'
        );


    if (!tbody) return;


    const q =
        (
            document
                .getElementById('fac-search')
                ?.value ||
            ''
        )
        .toLowerCase();


    const fTipo =
        document
            .getElementById('fac-filter-tipo')
            ?.value;


    const fEst =
        document
            .getElementById('fac-filter-estado')
            ?.value;


    let match =
        DATA.facturas.filter(f => {

            const cliente =
                String(
                    f.cliente || ''
                ).toLowerCase();


            const doc =
                String(
                    f.doc || ''
                );


            const refId =
                String(
                    f.refId || ''
                ).toLowerCase();


            const id =
                String(
                    f.id || ''
                ).toLowerCase();


            const passQ =
                !q ||
                cliente.includes(q) ||
                doc.includes(q) ||
                refId.includes(q) ||
                id.includes(q);


            const passTipo =
                !fTipo ||
                f.tipo === fTipo;


            const passEst =
                !fEst ||
                f.estado === fEst;


            return (
                passQ &&
                passTipo &&
                passEst
            );

        });


    match.sort(
        (a, b) =>
            String(b.id || '')
                .localeCompare(
                    String(a.id || '')
                )
    );


    tbody.innerHTML =
        match
            .map(f => {


                let estBadge;


                if (
                    f.tipo ===
                    'Nota de Crédito'
                ) {

                    estBadge =
                        `
                        <span
                            class="badge"
                            style="
                                background:#e3f2fd;
                                color:#0d47a1;
                            ">

                            🟣 NC APLICADA

                        </span>
                        `;

                } else if (
                    f.estado ===
                    'Emitida'
                ) {

                    estBadge =
                        `
                        <span
                            class="badge"
                            style="
                                background:var(--teal-dim);
                                color:var(--teal);
                            ">

                            🟢 EMITIDA

                        </span>
                        `;

                } else if (
                    f.estado ===
                    'Cancelada'
                ) {

                    estBadge =
                        `
                        <span
                            class="badge"
                            style="
                                background:var(--muted);
                                color:#fff;
                            ">

                            ⚪ CANCELADA

                        </span>
                        `;

                } else {

                    estBadge =
                        `
                        <span
                            class="badge"
                            style="
                                background:var(--red-dim);
                                color:var(--red);
                            ">

                            🔴 ANULADA

                        </span>
                        `;

                }


                const colorRef =
                    f.refModulo ===
                    'Ticket'

                        ? 'var(--copper)'
                        : 'var(--ink)';


                const colorTot =
                    f.tipo ===
                    'Nota de Crédito'

                        ? 'var(--red)'
                        : 'var(--ink)';


                const signo =
                    f.tipo ===
                    'Nota de Crédito'

                        ? '-'
                        : '';


                return `

                    <tr>

                        <td
                            class="mono"
                            style="
                                color:var(--muted);
                            ">

                            ${fDate(f.fecha)}

                        </td>


                        <td
                            class="mono"
                            style="
                                font-weight:700;
                            ">

                            ${f.id}

                        </td>


                        <td>

                            <b>
                                ${f.cliente || 'Consumidor Final'}
                            </b>

                            <br>

                            <span
                                style="
                                    font-size:10px;
                                    color:var(--muted);
                                ">

                                DOC:
                                ${f.doc || 'C.F.'}

                            </span>

                        </td>


                        <td>

                            ${f.tipo || 'Factura'}

                        </td>


                        <td
                            class="mono"
                            style="
                                color:${colorRef};
                                font-weight:600;
                            ">

                            ${f.refId || '-'}

                        </td>


                        <td>

                            ${estBadge}

                        </td>


                        <td
                            class="mono"
                            style="
                                font-weight:700;
                                color:${colorTot};
                                font-size:13.5px;
                            ">

                            ${signo}
                            ${fmt(f.total || 0)}

                        </td>


                        <td>

                            <button
                                class="
                                    btn
                                    btn-ghost
                                    btn-sm
                                "
                                style="
                                    padding:6px 10px;
                                    font-size:11px;
                                "
                                onclick="
                                    openFacturaDetalle(
                                        '${f.id}'
                                    )
                                ">

                                👁️ Ver

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
                colspan="8"
                style="
                    text-align:center;
                    padding:30px;
                    color:var(--muted);
                ">

                No hay comprobantes
                con estos filtros.

            </td>

        </tr>
        `;

}


/* =========================================================
   DETALLE FACTURA
   ========================================================= */

export function openFacturaDetalle(id) {

    const f =
        DATA.facturas.find(
            x => x.id === id
        );


    if (!f) return;


    currentFacturaId =
        id;


    const idEl =
        document.getElementById('fd-id');


    if (idEl) {

        idEl.textContent =
            f.id;

    }


    const fechaEl =
        document.getElementById('fd-fecha');


    if (fechaEl) {

        fechaEl.textContent =
            `Fecha de emisión: ${
                fDate(f.fecha)
            } · ${
                f.hora || ''
            } hs`;

    }


    const badgeEl =
        document.getElementById(
            'fd-badge-estado'
        );


    let actionsHtml =
        '';


    if (
        f.estado === 'Emitida' &&
        f.tipo === 'Factura'
    ) {


        if (badgeEl) {

            badgeEl.innerHTML =
                `
                <span
                    class="badge"
                    style="
                        background:var(--teal-dim);
                        color:var(--teal);
                    ">

                    🟢 EMITIDA

                </span>
                `;

        }


        if (
            f.estadoPago ===
            'Pendiente'
        ) {

            actionsHtml =
                `
                <button
                    class="btn btn-ghost"
                    style="
                        color:var(--muted);
                        border-color:var(--line);
                    "
                    onclick="
                        cancelarFacturaActual()
                    ">

                    ⚪ Cancelar (Sin Pago)

                </button>
                `;

        } else {

            actionsHtml =
                `
                <button
                    class="btn btn-ghost"
                    style="
                        color:var(--red);
                        border-color:var(--red);
                    "
                    onclick="
                        anularFacturaActual()
                    ">

                    🔴 Anular y Devolver a Saldo

                </button>
                `;

        }


        actionsHtml +=
            `
            <button
                class="btn btn-ghost"
                style="
                    color:var(--amber);
                    border-color:var(--amber);
                    margin-left:8px;
                "
                onclick="
                    rectificarFacturaActual()
                ">

                📝 Rectificar

            </button>
            `;


    } else if (
        f.tipo ===
        'Nota de Crédito'
    ) {


        if (badgeEl) {

            badgeEl.innerHTML =
                `
                <span
                    class="badge"
                    style="
                        background:#e3f2fd;
                        color:#0d47a1;
                    ">

                    🟣 NC APLICADA

                </span>
                `;

        }


    } else if (
        f.estado ===
        'Cancelada'
    ) {


        if (badgeEl) {

            badgeEl.innerHTML =
                `
                <span
                    class="badge"
                    style="
                        background:var(--muted);
                        color:#fff;
                    ">

                    ⚪ CANCELADA

                </span>
                `;

        }


    } else {


        if (badgeEl) {

            badgeEl.innerHTML =
                `
                <span
                    class="badge"
                    style="
                        background:var(--red-dim);
                        color:var(--red);
                    ">

                    🔴 ANULADA

                </span>
                `;

        }

    }


    let actionContainer =
        document.getElementById(
            'fd-actions-container'
        );


    if (!actionContainer) {


        const anchor =
            document.getElementById(
                'btn-fd-anular'
            );


        if (anchor) {

            actionContainer =
                anchor.parentElement;


            actionContainer.id =
                'fd-actions-container';

        }

    }


    if (actionContainer) {

        actionContainer.innerHTML =
            actionsHtml +

            `
            <button
                class="btn btn-primary"
                style="margin-left:8px;"
                onclick="window.print()">

                🖨️ Imprimir / PDF

            </button>


            <button
                class="btn btn-ghost"
                onclick="
                    goView('facturacion')
                ">

                ← Volver

            </button>
            `;

    }


    const origenEl =
        document.getElementById(
            'fd-origen'
        );


    if (origenEl) {

        origenEl.textContent =
            f.refModulo ||
            'Manual';

    }


    const refEl =
        document.getElementById(
            'fd-ref'
        );


    if (refEl) {

        refEl.textContent =
            f.refId ||
            'N/A';

    }


    const cajaEl =
        document.getElementById(
            'fd-caja'
        );


    if (cajaEl) {

        cajaEl.textContent =
            f.refPago ||
            'Sin pago asociado';

    }


    const clienteEl =
        document.getElementById(
            'fd-cliente'
        );


    if (clienteEl) {

        clienteEl.textContent =
            f.cliente ||
            'Consumidor Final';

    }


    const docEl =
        document.getElementById(
            'fd-doc'
        );


    if (docEl) {

        docEl.textContent =
            f.doc ||
            'N/A';

    }


    const usuarioEl =
        document.getElementById(
            'fd-usuario'
        );


    if (usuarioEl) {

        usuarioEl.textContent =
            f.usuario ||
            'Sistema';

    }


    const pSt =
        document.getElementById(
            'fd-pago-status'
        );


    if (pSt) {

        pSt.textContent =
            f.estadoPago ||
            'Pendiente';


        pSt.style.color =
            f.estadoPago ===
            'Pagado Total'

                ? 'var(--teal)'
                : 'var(--amber)';

    }


    const itemsHtml =
        (f.items || [])
            .map(i => `

                <tr>

                    <td
                        style="
                            padding:10px 14px;
                            border-bottom:
                                1px solid var(--line);
                        ">

                        ${i.desc || i.descripcion || ''}

                    </td>


                    <td
                        class="mono"
                        style="
                            padding:10px 14px;
                            border-bottom:
                                1px solid var(--line);
                        ">

                        ${i.cant || i.cantidad || 0}

                    </td>


                    <td
                        class="mono"
                        style="
                            padding:10px 14px;
                            border-bottom:
                                1px solid var(--line);
                        ">

                        ${fmt(i.precio || 0)}

                    </td>


                    <td
                        class="mono"
                        style="
                            padding:10px 14px;
                            border-bottom:
                                1px solid var(--line);
                            text-align:right;
                            font-weight:bold;
                        ">

                        ${fmt(
                            Number(
                                i.cant ||
                                i.cantidad ||
                                0
                            ) *
                            Number(
                                i.precio ||
                                0
                            )
                        )}

                    </td>

                </tr>

            `)
            .join('');


    const itemsEl =
        document.getElementById(
            'fd-items'
        );


    if (itemsEl) {

        itemsEl.innerHTML =
            itemsHtml ||

            `
            <tr>

                <td
                    colspan="4"
                    style="
                        text-align:center;
                        color:var(--muted);
                        padding:20px;
                    ">

                    Sin conceptos

                </td>

            </tr>
            `;

    }


    const totalEl =
        document.getElementById(
            'fd-total'
        );


    if (totalEl) {

        totalEl.textContent =
            f.tipo ===
            'Nota de Crédito'

                ? `-${fmt(f.total || 0)}`
                : fmt(f.total || 0);

    }


    const hist =
        f.historial || [];


    const historialEl =
        document.getElementById(
            'fd-historial'
        );


    if (historialEl) {

        historialEl.innerHTML =
            hist
                .slice()
                .reverse()
                .map(h => `

                    <div
                        style="
                            background:var(--bg);
                            padding:10px;
                            border-radius:8px;
                            border-left:
                                3px solid var(--copper);
                        ">

                        <div
                            style="
                                display:flex;
                                justify-content:
                                    space-between;
                                margin-bottom:2px;
                                font-size:11px;
                            ">

                            <b
                                style="
                                    color:var(--ink);
                                ">

                                ${h.accion}

                            </b>

                            <span
                                style="
                                    color:var(--muted);
                                ">

                                ${h.fecha}

                            </span>

                        </div>


                        <div
                            style="
                                font-size:11.5px;
                                color:var(--muted);
                            ">

                            ${h.detalle}

                        </div>

                    </div>

                `)
                .join('');

    }


    goView(
        'facturacion-detalle'
    );

}


/* =========================================================
   ANULAR FACTURA Y GENERAR NOTA DE CRÉDITO
   ========================================================= */

export async function anularFacturaActual() {

    if (!currentFacturaId) return;


    const original =
        DATA.facturas.find(
            x =>
                x.id ===
                currentFacturaId
        );


    if (
        !original ||
        original.estado !==
        'Emitida'
    ) return;


    const confirmar =
        confirm(

            `¿Estás seguro de ANULAR el comprobante ${
                original.id
            }?

Se generará una Nota de Crédito por ${
    fmt(original.total)
} y ese dinero quedará a favor en la cuenta del cliente.`

        );


    if (!confirmar) return;


    try {


        const user =
            currentUserProfile
                ? currentUserProfile.nombre
                : 'Sistema';


        const now =
            new Date();


        const fDateStr =
            now
                .toISOString()
                .split('T')[0];


        const hTimeStr =
            now.toLocaleTimeString(
                'es-AR',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );


        const logDate =
            `${fDate(
                fDateStr
            )} ${hTimeStr}`;


        const batch =
            window.db.batch();


        /* Actualizar factura original */

        const facRef =
            window.db
                .collection(
                    'facturas'
                )
                .doc(
                    original.id
                );


        batch.update(
            facRef,
            {

                estado:
                    'Anulada',


                historial:
                    window.firebase
                        .firestore
                        .FieldValue
                        .arrayUnion(
                            {
                                fecha:
                                    logDate,

                                accion:
                                    'Comprobante Anulado',

                                detalle:
                                    `NC y devolución a saldo del cliente. Usuario: ${user}`
                            }
                        )

            }
        );


        /* Contador de NC */

        let nuevoNum =
            1;


        const contadoresRef =
            window.db
                .collection(
                    'negocio'
                )
                .doc(
                    'contadores'
                );


        const countDoc =
            await contadoresRef.get();


        if (
            countDoc.exists &&
            countDoc.data().nc
        ) {

            nuevoNum =
                Number(
                    countDoc.data().nc
                ) + 1;

        }


        batch.set(
            contadoresRef,
            {
                nc:
                    nuevoNum
            },
            {
                merge:
                    true
            }
        );


        const ncId =
            'NC-' +
            nuevoNum
                .toString()
                .padStart(
                    4,
                    '0'
                );


        const ncData =
            {

                id:
                    ncId,

                fecha:
                    fDateStr,

                hora:
                    hTimeStr,

                cliente:
                    original.cliente,

                doc:
                    original.doc,

                clienteId:
                    original.clienteId,

                tipo:
                    'Nota de Crédito',

                refModulo:
                    'Factura',

                refId:
                    original.id,

                refPago:
                    original.refPago,

                estado:
                    'Emitida',

                total:
                    original.total,

                items:
                    original.items || [],

                usuario:
                    user,

                estadoPago:
                    'Aplicada',

                historial:
                    [
                        {
                            fecha:
                                logDate,

                            accion:
                                'Emisión NC',

                            detalle:
                                `Anula comprobante ${original.id}. Acreditado a saldo. Usuario: ${user}`
                        }
                    ]

            };


        const ncRef =
            window.db
                .collection(
                    'facturas'
                )
                .doc(
                    ncId
                );


        batch.set(
            ncRef,
            ncData
        );


        /*
         * Acreditar saldo al cliente.
         * En el próximo paso podemos
         * registrar además cada movimiento
         * en DATA.cuenta_corriente.
         */

        if (
            original.clienteId
        ) {


            const cliRef =
                window.db
                    .collection(
                        'clientes'
                    )
                    .doc(
                        original.clienteId
                    );


            batch.update(
                cliRef,
                {

                    saldoAFavor:
                        window.firebase
                            .firestore
                            .FieldValue
                            .increment(
                                Number(
                                    original.total || 0
                                )
                            )

                }
            );

        }


        await batch.commit();


        toast(
            `✅ Factura anulada. Se generó ${ncId} y se acreditó el saldo al cliente.`
        );


        goView(
            'facturacion'
        );


        renderFacturasTable();


    } catch (error) {


        console.error(
            'Error al anular factura:',
            error
        );


        toast(
            '❌ No se pudo anular la factura'
        );

    }

}
/* =========================================================
   CANCELAR FACTURA
   Facturas pendientes: no mueve dinero
   ========================================================= */

window.cancelarFacturaActual = async function() {

    if (!currentFacturaId) return;


    const original =
        DATA.facturas.find(
            x =>
                x.id ===
                currentFacturaId
        );


    if (
        !original ||
        original.estado !== 'Emitida' ||
        original.estadoPago === 'Pagado Total'
    ) {

        return;

    }


    if (
        !confirm(
            `¿Cancelar comprobante ${original.id}?

Al estar pendiente de pago, no se moverá dinero en caja.`
        )
    ) {

        return;

    }


    try {

        const user =
            currentUserProfile
                ? currentUserProfile.nombre
                : 'Sistema';


        const logDate =
            fDate(
                new Date()
                    .toISOString()
                    .split('T')[0]
            ) +
            ' ' +
            new Date()
                .toLocaleTimeString(
                    'es-AR',
                    {
                        hour: '2-digit',
                        minute: '2-digit'
                    }
                );


        await window.db
            .collection('facturas')
            .doc(original.id)
            .update({

                estado:
                    'Cancelada',

                historial:
                    window.firebase
                        .firestore
                        .FieldValue
                        .arrayUnion({

                            fecha:
                                logDate,

                            accion:
                                'Cancelado',

                            detalle:
                                `Operación cancelada sin movimientos. Usuario: ${user}`

                        })

            });


        original.estado =
            'Cancelada';


        toast(
            '✅ Factura cancelada'
        );


        openFacturaDetalle(
            original.id
        );


    } catch (e) {

        console.error(e);

        toast(
            '❌ Error al cancelar'
        );

    }

};



/* =========================================================
   RECTIFICAR FACTURA
   ========================================================= */

window.rectificarFacturaActual =
async function() {


    if (!currentFacturaId)
        return;


    const original =
        DATA.facturas.find(
            x =>
                x.id ===
                currentFacturaId
        );


    if (!original)
        return;


    const obs =
        prompt(
            `Ingresá la observación para rectificar el comprobante ${original.id}.\n\nEjemplo: Corrección de DNI o dirección.`
        );


    if (
        !obs ||
        obs.trim() === ''
    ) {

        return;

    }


    try {


        const user =
            currentUserProfile
                ? currentUserProfile.nombre
                : 'Sistema';


        const logDate =
            fDate(
                new Date()
                    .toISOString()
                    .split('T')[0]
            ) +
            ' ' +
            new Date()
                .toLocaleTimeString(
                    'es-AR',
                    {
                        hour: '2-digit',
                        minute: '2-digit'
                    }
                );


        const historialItem =
            {

                fecha:
                    logDate,

                accion:
                    'Rectificación',

                detalle:
                    `Nota: ${obs.trim()} - Usuario: ${user}`

            };


        await window.db
            .collection('facturas')
            .doc(original.id)
            .update({

                historial:
                    window.firebase
                        .firestore
                        .FieldValue
                        .arrayUnion(
                            historialItem
                        )

            });


        if (!original.historial) {

            original.historial =
                [];

        }


        original.historial.push(
            historialItem
        );


        toast(
            '✅ Rectificación agregada'
        );


        openFacturaDetalle(
            original.id
        );


    } catch (e) {

        console.error(e);

        toast(
            '❌ Error al rectificar'
        );

    }

};



/* =========================================================
   EMITIR COMPROBANTE INTERNO
   Se utiliza desde otros módulos, por ejemplo Caja
   ========================================================= */

export async function emitirComprobanteInterno(
    origen,
    refId,
    refPago,
    clienteId,
    clienteNombre,
    items,
    total,
    estadoPago
) {

    try {


        const user =
            currentUserProfile
                ? currentUserProfile.nombre
                : 'Sistema';


        const now =
            new Date();


        const fDateStr =
            now
                .toISOString()
                .split('T')[0];


        const hTimeStr =
            now.toLocaleTimeString(
                'es-AR',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );


        const logDate =
            fDate(
                fDateStr
            ) +
            ' ' +
            hTimeStr;


        let nuevoNum =
            1;


        const contadoresRef =
            window.db
                .collection('negocio')
                .doc('contadores');


        await window.db
            .runTransaction(
                async transaction => {

                    const doc =
                        await transaction.get(
                            contadoresRef
                        );


                    if (
                        doc.exists &&
                        doc.data().facturas
                    ) {

                        nuevoNum =
                            Number(
                                doc.data().facturas
                            ) + 1;

                    }


                    transaction.set(
                        contadoresRef,
                        {
                            facturas:
                                nuevoNum
                        },
                        {
                            merge:
                                true
                        }
                    );

                }
            );


        const facId =
            'FAC-' +
            nuevoNum
                .toString()
                .padStart(
                    6,
                    '0'
                );


        let docCliente =
            'C.F.';


        if (clienteId) {

            const cli =
                DATA.clientes.find(
                    c =>
                        c.id ===
                        clienteId
                );


            if (
                cli &&
                cli.dni
            ) {

                docCliente =
                    cli.dni;

            }

        }


        const facData =
            {

                id:
                    facId,

                fecha:
                    fDateStr,

                hora:
                    hTimeStr,

                cliente:
                    clienteNombre ||
                    'Consumidor Final',

                doc:
                    docCliente,

                clienteId:
                    clienteId ||
                    null,

                tipo:
                    'Factura',

                refModulo:
                    origen,

                refId:
                    refId ||
                    '—',

                refPago:
                    refPago ||
                    '—',

                estado:
                    'Emitida',

                total:
                    Number(total || 0),

                items:
                    items || [],

                usuario:
                    user,

                estadoPago:
                    estadoPago,

                historial:
                    [

                        {
                            fecha:
                                logDate,

                            accion:
                                'Emisión de Comprobante',

                            detalle:
                                `Emitido exitosamente. Origen: ${origen}. Usuario: ${user}`

                        }

                    ]

            };


        await window.db
            .collection('facturas')
            .doc(facId)
            .set(
                facData
            );


        if (!DATA.facturas) {

            DATA.facturas =
                [];

        }


        const existe =
            DATA.facturas.find(
                f =>
                    f.id ===
                    facId
            );


        if (!existe) {

            DATA.facturas.push(
                facData
            );

        }


        return facId;


    } catch (e) {


        console.error(
            'Error al emitir comprobante:',
            e
        );


        return null;

    }

}



/* =========================================================
   MOSTRAR NUEVO COMPROBANTE
   ========================================================= */

export function showNuevaFactura() {

    const sel =
        document.getElementById(
            'nf-cliente'
        );


    if (sel) {

        sel.innerHTML =
            `
            <option value="">
                Consumidor Final (Sin registrar)
            </option>
            ` +

            (DATA.clientes || [])
                .map(
                    c => `

                        <option
                            value="${c.id}">

                            ${getFullName(c)}
                            (DNI: ${c.dni || 'N/A'})

                        </option>

                    `
                )
                .join('');

    }


    const concepto =
        document.getElementById(
            'nf-concepto'
        );


    const total =
        document.getElementById(
            'nf-total'
        );


    if (concepto) {

        concepto.value =
            '';

    }


    if (total) {

        total.value =
            '';

    }


    document
        .getElementById(
            'fac-lista'
        )
        .style.display =
            'none';


    document
        .getElementById(
            'fac-nueva'
        )
        .style.display =
            'block';

}



/* =========================================================
   OCULTAR NUEVO COMPROBANTE
   ========================================================= */

export function hideNuevaFactura() {

    document
        .getElementById(
            'fac-nueva'
        )
        .style.display =
            'none';


    document
        .getElementById(
            'fac-lista'
        )
        .style.display =
            'block';

}



/* =========================================================
   EMITIR FACTURA MANUAL
   ========================================================= */

export async function emitirFacturaManual() {


    const clienteId =
        document
            .getElementById(
                'nf-cliente'
            )
            .value;


    let clienteNombre =
        'Consumidor Final';


    let docCliente =
        'C.F.';


    if (clienteId) {

        const c =
            DATA.clientes.find(
                x =>
                    x.id ===
                    clienteId
            );


        if (c) {

            clienteNombre =
                getFullName(c);


            docCliente =
                c.dni ||
                'C.F.';

        }

    }


    const tipo =
        document
            .getElementById(
                'nf-tipo'
            )
            .value;


    const estadoPago =
        document
            .getElementById(
                'nf-pago'
            )
            .value;


    const concepto =
        document
            .getElementById(
                'nf-concepto'
            )
            .value
            .trim();


    const total =
        parseFloat(
            document
                .getElementById(
                    'nf-total'
                )
                .value
        );


    if (
        !concepto ||
        isNaN(total) ||
        total <= 0
    ) {

        toast(
            'Completá el concepto y un total válido mayor a 0'
        );

        return;

    }


    const items =
        [

            {
                desc:
                    concepto,

                cant:
                    1,

                precio:
                    total
            }

        ];


    try {


        const user =
            currentUserProfile
                ? currentUserProfile.nombre
                : 'Sistema';


        const now =
            new Date();


        const fDateStr =
            now
                .toISOString()
                .split('T')[0];


        const hTimeStr =
            now.toLocaleTimeString(
                'es-AR',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );


        const logDate =
            fDate(
                fDateStr
            ) +
            ' ' +
            hTimeStr;


        let nuevoNum =
            1;


        const contadoresRef =
            window.db
                .collection('negocio')
                .doc('contadores');


        await window.db
            .runTransaction(
                async transaction => {

                    const doc =
                        await transaction.get(
                            contadoresRef
                        );


                    if (
                        doc.exists &&
                        doc.data().facturas
                    ) {

                        nuevoNum =
                            Number(
                                doc.data().facturas
                            ) + 1;

                    }


                    transaction.set(
                        contadoresRef,
                        {
                            facturas:
                                nuevoNum
                        },
                        {
                            merge:
                                true
                        }
                    );

                }
            );


        const prefix =
            tipo ===
            'Nota de Crédito'

                ? 'NC-'
                : 'FAC-';


        const facId =
            prefix +
            nuevoNum
                .toString()
                .padStart(
                    6,
                    '0'
                );


        const facData =
            {

                id:
                    facId,

                fecha:
                    fDateStr,

                hora:
                    hTimeStr,

                cliente:
                    clienteNombre,

                doc:
                    docCliente,

                clienteId:
                    clienteId ||
                    null,

                tipo:
                    tipo,

                refModulo:
                    'Manual',

                refId:
                    '—',

                refPago:
                    '—',

                estado:
                    'Emitida',

                total:
                    total,

                items:
                    items,

                usuario:
                    user,

                estadoPago:
                    estadoPago,

                historial:
                    [

                        {
                            fecha:
                                logDate,

                            accion:
                                'Emisión Manual',

                            detalle:
                                `Emitido por ${user} desde panel de Facturación.`

                        }

                    ]

            };


        await window.db
            .collection('facturas')
            .doc(facId)
            .set(
                facData
            );


        if (!DATA.facturas) {

            DATA.facturas =
                [];

        }


        const existe =
            DATA.facturas.find(
                f =>
                    f.id ===
                    facId
            );


        if (!existe) {

            DATA.facturas.push(
                facData
            );

        }


        toast(
            `✅ ${tipo} emitido con éxito`
        );


        hideNuevaFactura();


        renderFacturasTable();


    } catch (e) {


        console.error(e);


        toast(
            '❌ Error al emitir el comprobante'
        );

    }

}



/* =========================================================
   NAVEGACIÓN INTERNA DEL MÓDULO FACTURACIÓN
   ========================================================= */

window.showFacturacionTab =
function(tab) {


    const tabs =
        [
            'resumen',
            'presupuestos',
            'comprobantes',
            'cuenta',
            'bitacora'
        ];


    tabs.forEach(
        nombre => {


            const panel =
                document.getElementById(
                    `fac-tab-${nombre}`
                );


            const boton =
                document.getElementById(
                    `fac-tab-btn-${nombre}`
                );


            if (panel) {

                panel.style.display =
                    nombre === tab
                        ? 'block'
                        : 'none';

            }


            if (boton) {

                boton.classList.remove(
                    'btn-primary'
                );


                boton.classList.add(
                    'btn-ghost'
                );

            }

        }
    );


    const botonActivo =
        document.getElementById(
            `fac-tab-btn-${tab}`
        );


    if (botonActivo) {

        botonActivo.classList.remove(
            'btn-ghost'
        );


        botonActivo.classList.add(
            'btn-primary'
        );

    }


    if (
        tab ===
        'comprobantes'
    ) {

        renderFacturasTable();

    }


    if (
        tab ===
        'resumen'
    ) {

        renderResumenFacturacion();

    }


    if (
        tab ===
        'cuenta'
    ) {

        cargarClientesCuentaCorriente();

    }


    /* =====================================================
       PASO 5: PRESUPUESTOS
       ===================================================== */

    if (
        tab ===
        'presupuestos'
    ) {

        renderPresupuestosTable();

    }

};



/* =========================================================
   RESUMEN DEL MÓDULO
   ========================================================= */

export function renderResumenFacturacion() {


    const facturas =
        DATA.facturas || [];


    const facturado =
        facturas
            .filter(
                f =>
                    f.tipo ===
                    'Factura' &&

                    f.estado ===
                    'Emitida'
            )
            .reduce(
                (total, f) =>
                    total +
                    Number(
                        f.total || 0
                    ),
                0
            );


    const notasCredito =
        facturas
            .filter(
                f =>
                    f.tipo ===
                    'Nota de Crédito'
            )
            .reduce(
                (total, f) =>
                    total +
                    Number(
                        f.total || 0
                    ),
                0
            );


    const saldoFavor =
        (DATA.clientes || [])
            .reduce(
                (total, cliente) =>
                    total +
                    Number(
                        cliente.saldoAFavor || 0
                    ),
                0
            );


    const setText =
        (id, value) => {

            const el =
                document.getElementById(
                    id
                );


            if (el) {

                el.textContent =
                    value;

            }

        };


    setText(
        'fac-stat-facturado',
        fmt(facturado)
    );


    setText(
        'fac-stat-nc',
        fmt(notasCredito)
    );


    setText(
        'fac-stat-saldo',
        fmt(saldoFavor)
    );


    setText(
        'fac-stat-total',
        facturas.length
    );


    const tbody =
        document.getElementById(
            'facturacion-reciente-body'
        );


    if (!tbody)
        return;


    const recientes =
        [...facturas]
            .sort(
                (a, b) =>
                    `${
                        b.fecha || ''
                    }${
                        b.hora || ''
                    }`
                    .localeCompare(
                        `${
                            a.fecha || ''
                        }${
                            a.hora || ''
                        }`
                    )
            )
            .slice(
                0,
                6
            );


    tbody.innerHTML =
        recientes
            .map(
                f => `

                    <tr>

                        <td>
                            ${fDate(f.fecha)}
                        </td>

                        <td class="mono">
                            <b>
                                ${f.id || '—'}
                            </b>
                        </td>

                        <td>
                            ${
                                f.cliente ||
                                'Consumidor Final'
                            }
                        </td>

                        <td>
                            ${
                                f.refModulo ||
                                'Manual'
                            }
                        </td>

                        <td>
                            ${
                                f.estado ||
                                '—'
                            }
                        </td>

                        <td
                            class="mono"
                            style="font-weight:bold;">

                            ${
                                f.tipo ===
                                'Nota de Crédito'
                                    ? '-'
                                    : ''
                            }

                            ${
                                fmt(
                                    f.total || 0
                                )
                            }

                        </td>

                    </tr>

                `
            )
            .join('')

        ||

        `
        <tr>

            <td
                colspan="6"
                style="
                    text-align:center;
                    padding:30px;
                    color:var(--muted);
                ">

                Todavía no hay comprobantes.

            </td>

        </tr>
        `;

}



/* =========================================================
   CUENTA CORRIENTE
   ========================================================= */

export function cargarClientesCuentaCorriente() {


    const select =
        document.getElementById(
            'cc-cliente-select'
        );


    if (!select)
        return;


    const actual =
        select.value;


    select.innerHTML =
        `
        <option value="">
            Seleccionar cliente
        </option>
        `

        +

        (DATA.clientes || [])
            .map(
                c => `

                    <option
                        value="${c.id}">

                        ${getFullName(c)}

                    </option>

                `
            )
            .join('');


    select.value =
        actual;

}



window.renderCuentaCorriente =
function() {


    const select =
        document.getElementById(
            'cc-cliente-select'
        );


    const contenido =
        document.getElementById(
            'cuenta-corriente-contenido'
        );


    if (
        !select ||
        !contenido
    ) {

        return;

    }


    if (!select.value) {

        contenido.innerHTML =
            `
            <div
                style="
                    padding:40px;
                    text-align:center;
                    color:var(--muted);
                ">

                Seleccioná un cliente.

            </div>
            `;

        return;

    }


    const cliente =
        (DATA.clientes || [])
            .find(
                c =>
                    c.id ===
                    select.value
            );


    if (!cliente)
        return;


    const saldo =
        Number(
            cliente.saldoAFavor || 0
        );


    contenido.innerHTML =
        `

        <div class="grid-3">

            <div class="stat-card">

                <div class="stat-label">
                    Cliente
                </div>

                <div
                    style="
                        font-size:18px;
                        font-weight:700;
                    ">

                    ${getFullName(cliente)}

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Saldo disponible
                </div>

                <div
                    class="stat-value"
                    style="
                        color:var(--teal);
                    ">

                    ${fmt(saldo)}

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Estado
                </div>

                <div
                    style="
                        font-weight:700;
                        color:var(--teal);
                    ">

                    ACTIVA

                </div>

            </div>

        </div>


        <div
            class="panel"
            style="margin-top:18px;">

            <div class="panel-head">

                <h3>
                    Movimientos
                </h3>

            </div>


            <div
                class="panel-body"
                style="
                    color:var(--muted);
                    text-align:center;
                    padding:30px;
                ">

                El historial de movimientos
                se conectará en la siguiente mejora.

            </div>

        </div>

        `;

};
/* =========================================================
   PRESUPUESTOS
   ========================================================= */

let presupuestoItems = [];


/* =========================================================
   ABRIR NUEVO PRESUPUESTO
   ========================================================= */

window.abrirNuevoPresupuesto =
function() {


    presupuestoItems =
        [];


    const modal =
        document.getElementById(
            'modal-presupuesto'
        );


    if (!modal) {

        console.error(
            'No existe el modal modal-presupuesto'
        );

        toast(
            '❌ Falta agregar el modal de Presupuestos en el HTML'
        );

        return;

    }


    cargarClientesPresupuesto();


    cargarTicketsPresupuesto();


    const fecha =
        document.getElementById(
            'pres-fecha'
        );


    if (fecha) {

        fecha.value =
            new Date()
                .toISOString()
                .split('T')[0];

    }


    const observaciones =
        document.getElementById(
            'pres-observaciones'
        );


    if (observaciones) {

        observaciones.value =
            '';

    }


    const validez =
        document.getElementById(
            'pres-validez'
        );


    if (validez) {

        validez.value =
            '7';

    }


    renderPresupuestoItems();


    modal.style.display =
        'flex';

};



/* =========================================================
   CERRAR MODAL PRESUPUESTO
   ========================================================= */

window.cerrarModalPresupuesto =
function() {


    const modal =
        document.getElementById(
            'modal-presupuesto'
        );


    if (modal) {

        modal.style.display =
            'none';

    }


    presupuestoItems =
        [];

};



/* =========================================================
   CARGAR CLIENTES
   ========================================================= */

function cargarClientesPresupuesto() {


    const select =
        document.getElementById(
            'pres-cliente'
        );


    if (!select)
        return;


    select.innerHTML =
        `
        <option value="">
            Consumidor Final / Sin cliente
        </option>
        `;


    (DATA.clientes || [])
        .forEach(
            cliente => {


                const option =
                    document.createElement(
                        'option'
                    );


                option.value =
                    cliente.id;


                option.textContent =
                    `${getFullName(cliente)} ${
                        cliente.dni
                            ? '· DNI: ' + cliente.dni
                            : ''
                    }`;


                select.appendChild(
                    option
                );

            }
        );

}



/* =========================================================
   CARGAR TICKETS DISPONIBLES
   ========================================================= */

function cargarTicketsPresupuesto() {


    const select =
        document.getElementById(
            'pres-ticket'
        );


    if (!select)
        return;


    select.innerHTML =
        `
        <option value="">
            Presupuesto manual
        </option>
        `;


    (DATA.tickets || [])
        .forEach(
            ticket => {


                /*
                 * Mostramos tickets abiertos
                 * y también los que puedan ser
                 * presupuestados.
                 */

                const option =
                    document.createElement(
                        'option'
                    );


                option.value =
                    ticket.id;


                option.textContent =
                    `${ticket.id} · ${
                        ticket.cliente ||
                        ticket.clienteNombre ||
                        'Sin cliente'
                    }`;


                select.appendChild(
                    option
                );

            }
        );

}



/* =========================================================
   CARGAR DATOS DESDE UN TICKET
   ========================================================= */

window.cargarPresupuestoDesdeTicket =
function() {


    const ticketId =
        document
            .getElementById(
                'pres-ticket'
            )
            ?.value;


    if (!ticketId) {

        return;

    }


    const ticket =
        (DATA.tickets || [])
            .find(
                t =>
                    t.id ===
                    ticketId
            );


    if (!ticket) {

        toast(
            '❌ No se encontró el ticket'
        );

        return;

    }


    /*
     * Intentamos detectar el cliente
     */

    const clienteSelect =
        document.getElementById(
            'pres-cliente'
        );


    if (
        clienteSelect &&
        ticket.clienteId
    ) {

        clienteSelect.value =
            ticket.clienteId;

    }


    /*
     * Limpiamos los conceptos actuales
     * antes de cargar los del ticket
     */

    presupuestoItems =
        [];


    /*
     * Intentamos obtener los items desde
     * distintas estructuras posibles.
     */

    const ticketItems =
        ticket.items ||
        ticket.detalles ||
        ticket.productos ||
        ticket.servicios ||
        [];


    if (
        Array.isArray(
            ticketItems
        )
    ) {

        ticketItems.forEach(
            item => {


                presupuestoItems.push(
                    {

                        descripcion:
                            item.descripcion ||
                            item.desc ||
                            item.nombre ||
                            item.servicio ||
                            'Concepto',

                        cantidad:
                            Number(
                                item.cantidad ||
                                item.cant ||
                                1
                            ),

                        precio:
                            Number(
                                item.precio ||
                                item.precioUnitario ||
                                item.valor ||
                                item.total ||
                                0
                            )

                    }
                );

            }
        );

    }


    /*
     * Si el ticket no tiene items
     * pero tiene total, agregamos
     * una línea genérica.
     */

    if (
        presupuestoItems.length === 0 &&
        Number(
            ticket.total || 0
        ) > 0
    ) {

        presupuestoItems.push(
            {

                descripcion:
                    `Trabajo correspondiente al Ticket ${ticket.id}`,

                cantidad:
                    1,

                precio:
                    Number(
                        ticket.total
                    )

            }
        );

    }


    renderPresupuestoItems();


    toast(
        `📋 Datos cargados desde ${ticket.id}`
    );

};



/* =========================================================
   AGREGAR ITEM AL PRESUPUESTO
   ========================================================= */

window.agregarItemPresupuesto =
function() {


    presupuestoItems.push(
        {

            descripcion:
                '',

            cantidad:
                1,

            precio:
                0

        }
    );


    renderPresupuestoItems();

};



/* =========================================================
   ELIMINAR ITEM
   ========================================================= */

window.eliminarItemPresupuesto =
function(index) {


    presupuestoItems.splice(
        index,
        1
    );


    renderPresupuestoItems();

};



/* =========================================================
   RENDER ITEMS DEL PRESUPUESTO
   ========================================================= */

function renderPresupuestoItems() {


    const container =
        document.getElementById(
            'pres-items'
        );


    if (!container)
        return;


    if (
        presupuestoItems.length === 0
    ) {

        container.innerHTML =
            `
            <div
                style="
                    padding:30px;
                    text-align:center;
                    color:var(--muted);
                    border:1px dashed var(--line);
                    border-radius:10px;
                ">

                Todavía no agregaste conceptos.

                <br>

                <button
                    type="button"
                    class="btn btn-ghost"
                    style="margin-top:12px;"
                    onclick="
                        agregarItemPresupuesto()
                    ">

                    + Agregar primer concepto

                </button>

            </div>
            `;


        actualizarTotalPresupuesto();

        return;

    }


    container.innerHTML =
        presupuestoItems
            .map(
                (item, index) => {


                    const subtotal =
                        Number(
                            item.cantidad || 0
                        ) *
                        Number(
                            item.precio || 0
                        );


                    return `

                        <div
                            class="presupuesto-item-row"
                            style="
                                display:grid;
                                grid-template-columns:
                                    minmax(200px, 1fr)
                                    100px
                                    140px
                                    140px
                                    44px;
                                gap:10px;
                                align-items:center;
                                margin-bottom:10px;
                            ">


                            <input
                                type="text"
                                value="${
                                    item.descripcion ||
                                    ''
                                }"
                                placeholder="Descripción del concepto"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'descripcion',
                                        this.value
                                    )
                                "
                            >


                            <input
                                type="number"
                                min="1"
                                step="1"
                                value="${
                                    item.cantidad || 1
                                }"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'cantidad',
                                        this.value
                                    )
                                "
                            >


                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value="${
                                    item.precio || 0
                                }"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'precio',
                                        this.value
                                    )
                                "
                            >


                            <div
                                class="mono"
                                style="
                                    font-weight:700;
                                    text-align:right;
                                ">

                                ${fmt(
                                    subtotal
                                )}

                            </div>


                            <button
                                type="button"
                                class="btn btn-ghost"
                                style="
                                    color:var(--red);
                                    padding:8px;
                                "
                                onclick="
                                    eliminarItemPresupuesto(
                                        ${index}
                                    )
                                "
                                title="Eliminar">

                                🗑️

                            </button>


                        </div>

                    `;

                }
            )
            .join('');


    actualizarTotalPresupuesto();

}



/* =========================================================
   ACTUALIZAR ITEM
   ========================================================= */

window.actualizarItemPresupuesto =
function(
    index,
    campo,
    valor
) {


    if (
        !presupuestoItems[index]
    ) {

        return;

    }


    if (
        campo ===
        'cantidad'
    ) {

        presupuestoItems[index]
            .cantidad =
                Number(valor) || 0;

    } else if (
        campo ===
        'precio'
    ) {

        presupuestoItems[index]
            .precio =
                Number(valor) || 0;

    } else {

        presupuestoItems[index]
            [campo] =
                valor;

    }


    /*
     * Solo actualizamos el total
     * para no perder el foco mientras
     * el usuario escribe.
     */

    actualizarTotalPresupuesto();

};



/* =========================================================
   CALCULAR TOTAL
   ========================================================= */

function actualizarTotalPresupuesto() {


    const subtotal =
        presupuestoItems
            .reduce(
                (
                    acumulado,
                    item
                ) => {

                    return (
                        acumulado +
                        (
                            Number(
                                item.cantidad || 0
                            ) *
                            Number(
                                item.precio || 0
                            )
                        )
                    );

                },
                0
            );


    const totalEl =
        document.getElementById(
            'pres-total'
        );


    const subtotalEl =
        document.getElementById(
            'pres-subtotal'
        );


    if (subtotalEl) {

        subtotalEl.textContent =
            fmt(
                subtotal
            );

    }


    if (totalEl) {

        totalEl.textContent =
            fmt(
                subtotal
            );

    }


    return subtotal;

}



/* =========================================================
   OBTENER NUEVO NÚMERO DE PRESUPUESTO
   ========================================================= */

async function obtenerNumeroPresupuesto() {


    const contadoresRef =
        window.db
            .collection(
                'negocio'
            )
            .doc(
                'contadores'
            );


    let nuevoNumero =
        1;


    await window.db
        .runTransaction(
            async transaction => {


                const contadorDoc =
                    await transaction.get(
                        contadoresRef
                    );


                if (
                    contadorDoc.exists &&
                    contadorDoc.data().presupuestos
                ) {

                    nuevoNumero =
                        Number(
                            contadorDoc
                                .data()
                                .presupuestos
                        ) + 1;

                }


                transaction.set(
                    contadoresRef,
                    {

                        presupuestos:
                            nuevoNumero

                    },
                    {

                        merge:
                            true

                    }
                );

            }
        );


    return (
        'PRE-' +
        nuevoNumero
            .toString()
            .padStart(
                6,
                '0'
            )
    );

}
/* =========================================================
   GUARDAR PRESUPUESTO
   ========================================================= */

window.guardarPresupuesto =
async function() {


    const clienteId =
        document
            .getElementById(
                'pres-cliente'
            )
            ?.value ||
        '';


    const ticketId =
        document
            .getElementById(
                'pres-ticket'
            )
            ?.value ||
        '';


    const fecha =
        document
            .getElementById(
                'pres-fecha'
            )
            ?.value;


    const validez =
        Number(
            document
                .getElementById(
                    'pres-validez'
                )
                ?.value || 7
        );


    const observaciones =
        document
            .getElementById(
                'pres-observaciones'
            )
            ?.value
            ?.trim() ||
        '';


    if (!fecha) {

        toast(
            '❌ Seleccioná una fecha'
        );

        return;

    }


    if (
        presupuestoItems.length === 0
    ) {

        toast(
            '❌ Agregá al menos un concepto'
        );

        return;

    }


    /*
     * Validar que todos los items tengan
     * descripción y valores correctos.
     */

    const itemInvalido =
        presupuestoItems.find(
            item => {

                return (
                    !item.descripcion ||
                    item.descripcion
                        .trim() === '' ||
                    Number(
                        item.cantidad
                    ) <= 0 ||
                    Number(
                        item.precio
                    ) < 0
                );

            }
        );


    if (itemInvalido) {

        toast(
            '❌ Revisá los conceptos del presupuesto'
        );

        return;

    }


    try {


        /*
         * Buscar datos del cliente
         */

        let cliente =
            null;


        let clienteNombre =
            'Consumidor Final';


        let clienteDocumento =
            'C.F.';


        if (clienteId) {

            cliente =
                (DATA.clientes || [])
                    .find(
                        c =>
                            c.id ===
                            clienteId
                    );


            if (cliente) {

                clienteNombre =
                    getFullName(
                        cliente
                    );


                clienteDocumento =
                    cliente.dni ||
                    cliente.documento ||
                    'C.F.';

            }

        }


        /*
         * Buscar Ticket asociado
         */

        let ticket =
            null;


        if (ticketId) {

            ticket =
                (DATA.tickets || [])
                    .find(
                        t =>
                            t.id ===
                            ticketId
                    );

        }


        /*
         * Generar número
         */

        const presupuestoId =
            await obtenerNumeroPresupuesto();


        /*
         * Calcular vencimiento
         */

        const fechaObj =
            new Date(
                fecha +
                'T12:00:00'
            );


        fechaObj.setDate(
            fechaObj.getDate() +
            validez
        );


        const fechaVencimiento =
            fechaObj
                .toISOString()
                .split('T')[0];


        /*
         * Calcular total
         */

        const total =
            actualizarTotalPresupuesto();


        /*
         * Usuario actual
         */

        const usuario =
            currentUserProfile
                ? (
                    currentUserProfile.nombre ||
                    currentUserProfile.email ||
                    'Sistema'
                )
                : 'Sistema';


        const ahora =
            new Date();


        const hora =
            ahora
                .toLocaleTimeString(
                    'es-AR',
                    {
                        hour:
                            '2-digit',

                        minute:
                            '2-digit'
                    }
                );


        const fechaHora =
            `${fDate(fecha)} ${hora}`;


        /*
         * Estructura final
         */

        const presupuestoData =
            {

                id:
                    presupuestoId,


                numero:
                    presupuestoId,


                fecha:
                    fecha,


                hora:
                    hora,


                fechaVencimiento:
                    fechaVencimiento,


                validezDias:
                    validez,


                clienteId:
                    clienteId ||
                    null,


                cliente:
                    clienteNombre,


                doc:
                    clienteDocumento,


                ticketId:
                    ticketId ||
                    null,


                origen:
                    ticketId
                        ? 'Ticket'
                        : 'Manual',


                estado:
                    'Pendiente',


                items:
                    presupuestoItems.map(
                        item => {

                            return {

                                descripcion:
                                    item.descripcion,

                                cantidad:
                                    Number(
                                        item.cantidad
                                    ),

                                precio:
                                    Number(
                                        item.precio
                                    ),

                                subtotal:
                                    Number(
                                        item.cantidad
                                    ) *
                                    Number(
                                        item.precio
                                    )

                            };

                        }
                    ),


                subtotal:
                    total,


                descuento:
                    0,


                total:
                    total,


                observaciones:
                    observaciones,


                usuario:
                    usuario,


                creadoEn:
                    new Date()
                        .toISOString(),


                actualizadoEn:
                    new Date()
                        .toISOString(),


                historial:
                    [

                        {

                            fecha:
                                fechaHora,

                            accion:
                                'Presupuesto creado',

                            detalle:
                                ticketId

                                    ? `Generado desde Ticket ${ticketId}. Usuario: ${usuario}`

                                    : `Presupuesto creado manualmente. Usuario: ${usuario}`

                        }

                    ]

            };


        /*
         * Guardar en Firebase
         */

        await window.db
            .collection(
                'presupuestos'
            )
            .doc(
                presupuestoId
            )
            .set(
                presupuestoData
            );


        /*
         * Actualizar DATA local
         */

        if (!DATA.presupuestos) {

            DATA.presupuestos =
                [];

        }


        const existente =
            DATA.presupuestos.findIndex(
                p =>
                    p.id ===
                    presupuestoId
            );


        if (
            existente === -1
        ) {

            DATA.presupuestos.push(
                presupuestoData
            );

        } else {

            DATA.presupuestos[
                existente
            ] =
                presupuestoData;

        }


        toast(
            `✅ Presupuesto ${presupuestoId} guardado correctamente`
        );


        cerrarModalPresupuesto();


        renderPresupuestosTable();


    } catch (error) {


        console.error(
            'Error guardando presupuesto:',
            error
        );


        toast(
            '❌ No se pudo guardar el presupuesto'
        );

    }

};



/* =========================================================
   TABLA DE PRESUPUESTOS
   ========================================================= */

export function renderPresupuestosTable() {


    const tbody =
        document.getElementById(
            'presupuestos-table-body'
        );


    if (!tbody) {

        console.warn(
            'No existe presupuestos-table-body'
        );

        return;

    }


    if (!DATA.presupuestos) {

        DATA.presupuestos =
            [];

    }


    const search =
        document
            .getElementById(
                'pres-search'
            )
            ?.value
            ?.toLowerCase() ||
        '';


    const estadoFiltro =
        document
            .getElementById(
                'pres-filter-estado'
            )
            ?.value ||
        '';


    let presupuestos =
        [...DATA.presupuestos];


    /*
     * Filtros
     */

    presupuestos =
        presupuestos.filter(
            presupuesto => {


                const texto =
                    `
                    ${presupuesto.id || ''}
                    ${presupuesto.cliente || ''}
                    ${presupuesto.ticketId || ''}
                    `
                        .toLowerCase();


                const coincideTexto =
                    !search ||
                    texto.includes(
                        search
                    );


                const coincideEstado =
                    !estadoFiltro ||
                    presupuesto.estado ===
                    estadoFiltro;


                return (
                    coincideTexto &&
                    coincideEstado
                );

            }
        );


    /*
     * Orden descendente
     */

    presupuestos.sort(
        (a, b) => {

            return String(
                b.fecha || ''
            )
                .localeCompare(
                    String(
                        a.fecha || ''
                    )
                );

        }
    );


    /*
     * Sin resultados
     */

    if (
        presupuestos.length === 0
    ) {

        tbody.innerHTML =
            `
            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                        color:var(--muted);
                    ">

                    📋 Todavía no hay presupuestos.

                </td>

            </tr>
            `;

        return;

    }


    tbody.innerHTML =
        presupuestos
            .map(
                presupuesto => {


                    let estadoBadge =
                        '';


                    switch (
                        presupuesto.estado
                    ) {


                        case 'Pendiente':

                            estadoBadge =
                                `
                                <span
                                    class="badge"
                                    style="
                                        background:
                                            var(--amber-dim);
                                        color:
                                            var(--amber);
                                    ">

                                    🟡 PENDIENTE

                                </span>
                                `;

                            break;


                        case 'Aceptado':

                            estadoBadge =
                                `
                                <span
                                    class="badge"
                                    style="
                                        background:
                                            var(--teal-dim);
                                        color:
                                            var(--teal);
                                    ">

                                    🟢 ACEPTADO

                                </span>
                                `;

                            break;


                        case 'Rechazado':

                            estadoBadge =
                                `
                                <span
                                    class="badge"
                                    style="
                                        background:
                                            var(--red-dim);
                                        color:
                                            var(--red);
                                    ">

                                    🔴 RECHAZADO

                                </span>
                                `;

                            break;


                        case 'Facturado':

                            estadoBadge =
                                `
                                <span
                                    class="badge"
                                    style="
                                        background:#e3f2fd;
                                        color:#0d47a1;
                                    ">

                                    🧾 FACTURADO

                                </span>
                                `;

                            break;


                        case 'Vencido':

                            estadoBadge =
                                `
                                <span
                                    class="badge"
                                    style="
                                        background:var(--muted);
                                        color:#fff;
                                    ">

                                    ⚪ VENCIDO

                                </span>
                                `;

                            break;


                        default:

                            estadoBadge =
                                `
                                <span class="badge">

                                    ${
                                        presupuesto.estado ||
                                        'PENDIENTE'
                                    }

                                </span>
                                `;

                    }


                    /*
                     * Detectar vencimiento
                     */

                    let fechaVencimiento =
                        presupuesto
                            .fechaVencimiento;


                    let vencido =
                        false;


                    if (
                        fechaVencimiento &&
                        presupuesto.estado ===
                        'Pendiente'
                    ) {

                        const hoy =
                            new Date();

                        hoy.setHours(
                            0,
                            0,
                            0,
                            0
                        );


                        const vencimiento =
                            new Date(
                                fechaVencimiento +
                                'T00:00:00'
                            );


                        vencido =
                            vencimiento <
                            hoy;

                    }


                    if (vencido) {

                        estadoBadge =
                            `
                            <span
                                class="badge"
                                style="
                                    background:var(--muted);
                                    color:#fff;
                                ">

                                ⚪ VENCIDO

                            </span>
                            `;

                    }


                    return `

                        <tr>

                            <td
                                class="mono"
                                style="
                                    font-weight:700;
                                ">

                                ${presupuesto.id}

                            </td>


                            <td
                                class="mono">

                                ${fDate(
                                    presupuesto.fecha
                                )}

                            </td>


                            <td>

                                <b>

                                    ${
                                        presupuesto.cliente ||
                                        'Consumidor Final'
                                    }

                                </b>


                                <br>


                                <span
                                    style="
                                        font-size:10px;
                                        color:var(--muted);
                                    ">

                                    ${
                                        presupuesto.doc ||
                                        ''
                                    }

                                </span>

                            </td>


                            <td>

                                ${
                                    presupuesto.origen ||
                                    'Manual'
                                }

                            </td>


                            <td
                                class="mono"
                                style="
                                    color:
                                        var(--copper);
                                ">

                                ${
                                    presupuesto.ticketId ||
                                    '—'
                                }

                            </td>


                            <td>

                                ${estadoBadge}

                            </td>


                            <td
                                class="mono"
                                style="
                                    font-weight:700;
                                ">

                                ${fmt(
                                    presupuesto.total ||
                                    0
                                )}

                            </td>


                            <td>

                                <button
                                    class="
                                        btn
                                        btn-ghost
                                        btn-sm
                                    "
                                    onclick="
                                        abrirDetallePresupuesto(
                                            '${presupuesto.id}'
                                        )
                                    ">

                                    👁️ Ver

                                </button>

                            </td>

                        </tr>

                    `;

                }
            )
            .join('');

}



/* =========================================================
   ABRIR DETALLE DEL PRESUPUESTO
   ========================================================= */

window.abrirDetallePresupuesto =
function(
    presupuestoId
) {


    const presupuesto =
        (DATA.presupuestos || [])
            .find(
                p =>
                    p.id ===
                    presupuestoId
            );


    if (!presupuesto) {

        toast(
            '❌ No se encontró el presupuesto'
        );

        return;

    }


    /*
     * Guardamos el ID actual
     * para las acciones posteriores.
     */

    window.currentPresupuestoId =
        presupuestoId;


    const modal =
        document.getElementById(
            'modal-detalle-presupuesto'
        );


    if (!modal) {

        /*
         * Si todavía no existe el modal
         * mostramos una versión básica.
         */

        console.warn(
            'No existe modal-detalle-presupuesto'
        );


        mostrarDetallePresupuestoBasico(
            presupuesto
        );

        return;

    }


    const titulo =
        document.getElementById(
            'pd-id'
        );


    if (titulo) {

        titulo.textContent =
            presupuesto.id;

    }


    const cliente =
        document.getElementById(
            'pd-cliente'
        );


    if (cliente) {

        cliente.textContent =
            presupuesto.cliente ||
            'Consumidor Final';

    }


    const fecha =
        document.getElementById(
            'pd-fecha'
        );


    if (fecha) {

        fecha.textContent =
            fDate(
                presupuesto.fecha
            );

    }


    const vencimiento =
        document.getElementById(
            'pd-vencimiento'
        );


    if (vencimiento) {

        vencimiento.textContent =
            presupuesto.fechaVencimiento

                ? fDate(
                    presupuesto
                        .fechaVencimiento
                )

                : 'Sin vencimiento';

    }


    const origen =
        document.getElementById(
            'pd-origen'
        );


    if (origen) {

        origen.textContent =
            presupuesto.origen ||
            'Manual';

    }


    const ticket =
        document.getElementById(
            'pd-ticket'
        );


    if (ticket) {

        ticket.textContent =
            presupuesto.ticketId ||
            '—';

    }


    const estado =
        document.getElementById(
            'pd-estado'
        );


    if (estado) {

        estado.textContent =
            presupuesto.estado ||
            'Pendiente';

    }


    const observaciones =
        document.getElementById(
            'pd-observaciones'
        );


    if (observaciones) {

        observaciones.textContent =
            presupuesto.observaciones ||
            'Sin observaciones';

    }


    const items =
        document.getElementById(
            'pd-items'
        );


    if (items) {

        items.innerHTML =
            (presupuesto.items || [])
                .map(
                    item => `

                        <tr>

                            <td>

                                ${
                                    item.descripcion ||
                                    ''
                                }

                            </td>


                            <td
                                class="mono">

                                ${
                                    item.cantidad ||
                                    0
                                }

                            </td>


                            <td
                                class="mono">

                                ${
                                    fmt(
                                        item.precio ||
                                        0
                                    )
                                }

                            </td>


                            <td
                                class="mono"
                                style="
                                    text-align:right;
                                    font-weight:700;
                                ">

                                ${
                                    fmt(
                                        item.subtotal ||
                                        (
                                            Number(
                                                item.cantidad ||
                                                0
                                            ) *
                                            Number(
                                                item.precio ||
                                                0
                                            )
                                        )
                                    )
                                }

                            </td>

                        </tr>

                    `
                )
                .join('');

    }


    const total =
        document.getElementById(
            'pd-total'
        );


    if (total) {

        total.textContent =
            fmt(
                presupuesto.total ||
                0
            );

    }


    const acciones =
        document.getElementById(
            'pd-acciones'
        );


    if (acciones) {

        acciones.innerHTML =
            generarAccionesPresupuesto(
                presupuesto
            );

    }


    modal.style.display =
        'flex';

};



/* =========================================================
   MOSTRAR DETALLE BÁSICO
   ========================================================= */

function mostrarDetallePresupuestoBasico(
    presupuesto
) {


    const texto =
        `
PRESUPUESTO: ${presupuesto.id}

CLIENTE:
${presupuesto.cliente}

FECHA:
${fDate(presupuesto.fecha)}

ESTADO:
${presupuesto.estado}

TOTAL:
${fmt(presupuesto.total)}

OBSERVACIONES:
${presupuesto.observaciones || 'Sin observaciones'}
        `;


    alert(
        texto
    );

}



/* =========================================================
   GENERAR ACCIONES SEGÚN ESTADO
   ========================================================= */

function generarAccionesPresupuesto(
    presupuesto
) {


    let html =
        '';


    /*
     * Pendiente
     */

    if (
        presupuesto.estado ===
        'Pendiente'
    ) {


        html +=
            `

            <button
                class="btn btn-primary"
                onclick="
                    aceptarPresupuestoActual()
                ">

                ✓ Aceptar

            </button>


            <button
                class="btn btn-ghost"
                onclick="
                    rechazarPresupuestoActual()
                ">

                ✕ Rechazar

            </button>


            `;

    }


    /*
     * Aceptado
     */

    if (
        presupuesto.estado ===
        'Aceptado'
    ) {


        html +=
            `

            <button
                class="btn btn-primary"
                onclick="
                    facturarPresupuestoActual()
                ">

                🧾 Facturar

            </button>

            `;

    }


    /*
     * Imprimir siempre disponible
     */

    html +=
        `

        <button
            class="btn btn-ghost"
            onclick="
                imprimirPresupuestoActual()
            ">

            🖨️ Imprimir

        </button>

        `;


    return html;

}
/* =========================================================
   PARTE 5
   ACCIONES DEL PRESUPUESTO
   ACEPTAR / RECHAZAR / ENVIAR A CAJA
   ========================================================= */



/* =========================================================
   CERRAR DETALLE DEL PRESUPUESTO
   ========================================================= */

window.cerrarDetallePresupuesto =
function() {


    const modal =
        document.getElementById(
            'modal-detalle-presupuesto'
        );


    if (modal) {

        modal.style.display =
            'none';

    }


    window.currentPresupuestoId =
        null;

};



/* =========================================================
   OBTENER PRESUPUESTO ACTUAL
   ========================================================= */

function obtenerPresupuestoActual() {


    if (
        !window.currentPresupuestoId
    ) {

        return null;

    }


    return (
        DATA.presupuestos || []
    )
        .find(
            p =>
                p.id ===
                window.currentPresupuestoId
        );

}



/* =========================================================
   AGREGAR HISTORIAL AL PRESUPUESTO
   ========================================================= */

function crearHistorialPresupuesto(
    accion,
    detalle
) {


    const usuario =
        currentUserProfile
            ? (
                currentUserProfile.nombre ||
                currentUserProfile.email ||
                'Sistema'
            )
            : 'Sistema';


    const ahora =
        new Date();


    const fecha =
        ahora
            .toISOString()
            .split('T')[0];


    const hora =
        ahora
            .toLocaleTimeString(
                'es-AR',
                {

                    hour:
                        '2-digit',

                    minute:
                        '2-digit'

                }
            );


    return {

        fecha:
            `${fDate(fecha)} ${hora}`,

        accion:
            accion,

        detalle:
            `${detalle} Usuario: ${usuario}`

    };

}



/* =========================================================
   ACEPTAR PRESUPUESTO
   ========================================================= */

window.aceptarPresupuestoActual =
async function() {


    const presupuesto =
        obtenerPresupuestoActual();


    if (!presupuesto) {

        toast(
            '❌ No se encontró el presupuesto'
        );

        return;

    }


    if (
        presupuesto.estado !==
        'Pendiente'
    ) {

        toast(
            '⚠️ Este presupuesto ya no está pendiente'
        );

        return;

    }


    const confirmar =
        confirm(
            `¿Aceptar el presupuesto ${presupuesto.id}?\n\n` +
            `Cliente: ${presupuesto.cliente}\n` +
            `Total: ${fmt(presupuesto.total)}`
        );


    if (!confirmar) {

        return;

    }


    try {


        const historialItem =
            crearHistorialPresupuesto(

                'Presupuesto aceptado',

                'El cliente aceptó el presupuesto.'

            );


        /*
         * Actualizamos Firebase
         */

        await window.db
            .collection(
                'presupuestos'
            )
            .doc(
                presupuesto.id
            )
            .update(
                {

                    estado:
                        'Aceptado',

                    actualizadoEn:
                        new Date()
                            .toISOString(),

                    historial:
                        window.firebase
                            .firestore
                            .FieldValue
                            .arrayUnion(
                                historialItem
                            )

                }
            );


        /*
         * Actualizamos memoria local
         */

        presupuesto.estado =
            'Aceptado';


        if (
            !presupuesto.historial
        ) {

            presupuesto.historial =
                [];

        }


        presupuesto.historial.push(
            historialItem
        );


        toast(
            '✅ Presupuesto aceptado correctamente'
        );


        /*
         * Actualizar detalle
         */

        abrirDetallePresupuesto(
            presupuesto.id
        );


        /*
         * Actualizar tabla
         */

        renderPresupuestosTable();


    } catch (error) {


        console.error(
            'Error aceptando presupuesto:',
            error
        );


        toast(
            '❌ Error al aceptar el presupuesto'
        );

    }

};



/* =========================================================
   RECHAZAR PRESUPUESTO
   ========================================================= */

window.rechazarPresupuestoActual =
async function() {


    const presupuesto =
        obtenerPresupuestoActual();


    if (!presupuesto) {

        toast(
            '❌ No se encontró el presupuesto'
        );

        return;

    }


    if (
        presupuesto.estado !==
        'Pendiente'
    ) {

        toast(
            '⚠️ Este presupuesto ya no puede rechazarse'
        );

        return;

    }


    const motivo =
        prompt(
            'Motivo del rechazo (opcional):'
        );


    const confirmar =
        confirm(
            `¿Seguro que querés rechazar el presupuesto ${presupuesto.id}?`
        );


    if (!confirmar) {

        return;

    }


    try {


        const historialItem =
            crearHistorialPresupuesto(

                'Presupuesto rechazado',

                motivo
                    ? `Motivo: ${motivo}`
                    : 'El presupuesto fue rechazado.'

            );


        await window.db
            .collection(
                'presupuestos'
            )
            .doc(
                presupuesto.id
            )
            .update(
                {

                    estado:
                        'Rechazado',

                    actualizadoEn:
                        new Date()
                            .toISOString(),

                    historial:
                        window.firebase
                            .firestore
                            .FieldValue
                            .arrayUnion(
                                historialItem
                            )

                }
            );


        presupuesto.estado =
            'Rechazado';


        if (
            !presupuesto.historial
        ) {

            presupuesto.historial =
                [];

        }


        presupuesto.historial.push(
            historialItem
        );


        toast(
            '🔴 Presupuesto rechazado'
        );


        abrirDetallePresupuesto(
            presupuesto.id
        );


        renderPresupuestosTable();


    } catch (error) {


        console.error(
            'Error rechazando presupuesto:',
            error
        );


        toast(
            '❌ Error al rechazar el presupuesto'
        );

    }

};



/* =========================================================
   ENVIAR PRESUPUESTO A CAJA
   ========================================================= */

window.facturarPresupuestoActual =
async function() {


    const presupuesto =
        obtenerPresupuestoActual();


    if (!presupuesto) {

        toast(
            '❌ No se encontró el presupuesto'
        );

        return;

    }


    if (
        presupuesto.estado !==
        'Aceptado'
    ) {

        toast(
            '⚠️ Primero debés aceptar el presupuesto'
        );

        return;

    }


    /*
     * Evitar duplicados
     */

    if (
        presupuesto.estadoCaja ===
        'Pendiente'
    ) {

        toast(
            '⚠️ Este presupuesto ya está esperando cobro en Caja'
        );

        return;

    }


    /*
     * Si el presupuesto nació desde un ticket
     *
     * NO vamos a crear otro ticket.
     *
     * Debe continuar usando el Ticket original.
     */

    if (
        presupuesto.ticketId
    ) {


        const ticket =
            (DATA.tickets || [])
                .find(
                    t =>
                        t.id ===
                        presupuesto.ticketId
                );


        if (!ticket) {

            toast(
                '❌ No se encontró el Ticket original'
            );

            return;

        }


        /*
         * Aquí solamente marcamos el presupuesto
         * como listo para ser cobrado desde el Ticket.
         *
         * La lógica real de Caja debe seguir
         * dependiendo del flujo del Ticket.
         */

        try {


            const historialItem =
                crearHistorialPresupuesto(

                    'Enviado a Caja',

                    `Presupuesto asociado al Ticket ${ticket.id}.`

                );


            await window.db
                .collection(
                    'presupuestos'
                )
                .doc(
                    presupuesto.id
                )
                .update(
                    {

                        estadoCaja:
                            'Pendiente',

                        actualizadoEn:
                            new Date()
                                .toISOString(),

                        historial:
                            window.firebase
                                .firestore
                                .FieldValue
                                .arrayUnion(
                                    historialItem
                                )

                    }
                );


            presupuesto.estadoCaja =
                'Pendiente';


            if (
                !presupuesto.historial
            ) {

                presupuesto.historial =
                    [];

            }


            presupuesto.historial.push(
                historialItem
            );


            toast(
                `📦 El presupuesto está vinculado al Ticket ${ticket.id}. Cuando el Ticket pase a "Listo para Entrega" continuará hacia Caja.`
            );


            cerrarDetallePresupuesto();


            renderPresupuestosTable();


        } catch (error) {


            console.error(
                error
            );


            toast(
                '❌ Error al actualizar el presupuesto'
            );

        }


        return;

    }


    /*
     * =====================================================
     * PRESUPUESTO MANUAL
     *
     * Acá sí creamos una operación pendiente de cobro.
     * =====================================================
     */

    try {


        /*
         * Generar ID para la operación de Caja
         */

        const cajaId =
            `CAJA-PRES-${Date.now()}`;


        const historialItem =
            crearHistorialPresupuesto(

                'Enviado a Caja',

                `Operación manual enviada a Caja con ID ${cajaId}.`

            );


        /*
         * Datos que Caja podrá utilizar
         */

       const operacionCaja =
    {

        id:
            cajaId,


        /*
         * Caja utiliza origen y ref.
         */

        origen:
            'Presupuesto',


        ref:
            presupuesto.id,


        presupuestoId:
            presupuesto.id,


        ticketId:
            null,


        clienteId:
            presupuesto.clienteId ||
            null,


        cliente:
            presupuesto.cliente ||
            'Consumidor Final',


        doc:
            presupuesto.doc ||
            'C.F.',


        /*
         * Concepto visible en Caja
         */

        concepto:
            `Presupuesto ${presupuesto.id}`,


        /*
         * Items reales.
         * Esto permitirá en el futuro
         * mejorar la factura para que
         * muestre cada concepto.
         */

        items:
            presupuesto.items ||
            [],


        total:
            Number(
                presupuesto.total || 0
            ),


        estado:
            'Pendiente de cobro',


        fecha:
            new Date()
                .toISOString()
                .split('T')[0],


        creadoEn:
            new Date()
                .toISOString(),


        /*
         * Para diferenciarlo
         * de un Ticket.
         */

        tipoOperacion:
            'Presupuesto',


        origenModulo:
            'Facturación'

    };
        /*
         * =================================================
         * GUARDAR EN FIREBASE
         *
         * Por ahora usamos la colección cajaPendiente.
         *
         * Esto evita mezclar las ventas ya cobradas
         * con operaciones pendientes.
         * =================================================
         */

        await window.db
            .collection(
                'cajaPendientes'
            )
            .doc(
                cajaId
            )
            .set(
                operacionCaja
            );


        /*
         * Actualizar Presupuesto
         */

        await window.db
            .collection(
                'presupuestos'
            )
            .doc(
                presupuesto.id
            )
            .update(
                {

                    estadoCaja:
                        'Pendiente',

                    cajaId:
                        cajaId,

                    actualizadoEn:
                        new Date()
                            .toISOString(),

                    historial:
                        window.firebase
                            .firestore
                            .FieldValue
                            .arrayUnion(
                                historialItem
                            )

                }
            );


        /*
         * Actualización local
         */

        presupuesto.estadoCaja =
            'Pendiente';


        presupuesto.cajaId =
            cajaId;


        if (
            !presupuesto.historial
        ) {

            presupuesto.historial =
                [];

        }


        presupuesto.historial.push(
            historialItem
        );


        toast(
            '💰 Presupuesto enviado a Caja correctamente'
        );


        cerrarDetallePresupuesto();


        renderPresupuestosTable();


    } catch (error) {


        console.error(
            'Error enviando presupuesto a Caja:',
            error
        );


        toast(
            '❌ No se pudo enviar el presupuesto a Caja'
        );

    }

};



/* =========================================================
   FINALIZAR PRESUPUESTO DESDE CAJA
   =========================================================
   
   ESTA FUNCIÓN SE LLAMARÁ DESDE EL MÓDULO CAJA
   DESPUÉS DE QUE EL COBRO SEA EXITOSO.
   
   Ejemplo:
   
   await finalizarCobroPresupuesto(
       presupuestoId,
       facturaId,
       metodoPago
   );
   
   ========================================================= */

window.finalizarCobroPresupuesto =
async function(
    presupuestoId,
    facturaId,
    metodoPago
) {


    const presupuesto =
        (DATA.presupuestos || [])
            .find(
                p =>
                    p.id ===
                    presupuestoId
            );


    if (!presupuesto) {

        console.error(
            'Presupuesto no encontrado:',
            presupuestoId
        );

        return false;

    }


    try {


        const historialItem =
            crearHistorialPresupuesto(

                'Presupuesto facturado',

                `Cobrado mediante ${metodoPago || 'Pago'} y convertido en comprobante ${facturaId}.`

            );


        /*
         * Actualizamos presupuesto
         */

        await window.db
            .collection(
                'presupuestos'
            )
            .doc(
                presupuestoId
            )
            .update(
                {

                    estado:
                        'Facturado',

                    estadoCaja:
                        'Cobrado',

                    facturaId:
                        facturaId ||
                        null,

                    actualizadoEn:
                        new Date()
                            .toISOString(),

                    historial:
                        window.firebase
                            .firestore
                            .FieldValue
                            .arrayUnion(
                                historialItem
                            )

                }
            );


        /*
         * Actualización local
         */

        presupuesto.estado =
            'Facturado';


        presupuesto.estadoCaja =
            'Cobrado';


        presupuesto.facturaId =
            facturaId ||
            null;


        if (
            !presupuesto.historial
        ) {

            presupuesto.historial =
                [];

        }


        presupuesto.historial.push(
            historialItem
        );


        /*
         * Si existe una operación manual
         * pendiente de Caja, la eliminamos.
         */

        if (
            presupuesto.cajaId
        ) {


            await window.db
                .collection(
                    'cajaPendientes'
                )
                .doc(
                    presupuesto.cajaId
                )
                .delete();


        }


        renderPresupuestosTable();


        return true;


    } catch (error) {


        console.error(
            'Error finalizando presupuesto:',
            error
        );


        return false;

    }

};



/* =========================================================
   OBTENER OPERACIONES PENDIENTES DE CAJA
   =========================================================
   
   Esta función puede ser utilizada por tu módulo Caja.
   
   ========================================================= */

export async function obtenerPresupuestosPendientesCaja() {


    try {


        const snapshot =
            await window.db
                .collection(
                    'cajaPendiente'
                )
                .where(
                    'estado',
                    '==',
                    'Pendiente de cobro'
                )
                .get();


        const operaciones =
            [];


        snapshot.forEach(
            doc => {


                operaciones.push(
                    doc.data()
                );

            }
        );


        return operaciones;


    } catch (error) {


        console.error(
            'Error cargando Caja pendiente:',
            error
        );


        return [];

    }

}



/* =========================================================
   COBRAR USANDO SALDO A FAVOR
   =========================================================
   
   Esta función será usada cuando Caja seleccione:
   
   "Cuenta Corriente / Saldo a Favor"
   
   ========================================================= */

export async function pagarPresupuestoConSaldoFavor(
    presupuestoId
) {


    const presupuesto =
        (DATA.presupuestos || [])
            .find(
                p =>
                    p.id ===
                    presupuestoId
            );


    if (!presupuesto) {

        toast(
            '❌ Presupuesto no encontrado'
        );

        return false;

    }


    if (
        !presupuesto.clienteId
    ) {

        toast(
            '❌ Debe seleccionar un cliente para utilizar saldo a favor'
        );

        return false;

    }


    const cliente =
        (DATA.clientes || [])
            .find(
                c =>
                    c.id ===
                    presupuesto.clienteId
            );


    if (!cliente) {

        toast(
            '❌ Cliente no encontrado'
        );

        return false;

    }


    const saldoDisponible =
        Number(
            cliente.saldoAFavor || 0
        );


    const total =
        Number(
            presupuesto.total || 0
        );


    if (
        saldoDisponible <
        total
    ) {

        toast(
            `❌ Saldo insuficiente. Disponible: ${fmt(saldoDisponible)}`
        );

        return false;

    }


    const nuevoSaldo =
        saldoDisponible -
        total;


    const confirmar =
        confirm(
            `¿Usar ${fmt(total)} del saldo a favor de ${getFullName(cliente)}?\n\n` +
            `Saldo actual: ${fmt(saldoDisponible)}\n` +
            `Saldo restante: ${fmt(nuevoSaldo)}`
        );


    if (!confirmar) {

        return false;

    }


    try {


        /*
         * Primero descontamos el saldo
         */

        await window.db
            .collection(
                'clientes'
            )
            .doc(
                cliente.id
            )
            .update(
                {

                    saldoAFavor:
                        nuevoSaldo

                }
            );


        /*
         * Actualizar localmente
         */

        cliente.saldoAFavor =
            nuevoSaldo;


        /*
         * Emitir factura
         *
         * Usamos la función que ya agregamos
         * anteriormente:
         *
         * emitirComprobanteInterno(...)
         */

        const facturaId =
            await emitirComprobanteInterno(

                'Presupuesto',

                presupuesto.id,

                presupuesto.cajaId ||
                'Cuenta Corriente',

                presupuesto.clienteId,

                presupuesto.cliente,

                presupuesto.items,

                presupuesto.total,

                'Pagado Total'

            );


        if (!facturaId) {

            /*
             * IMPORTANTE:
             *
             * Por ahora informamos el problema.
             *
             * En una mejora posterior conviene
             * hacer esta operación completamente
             * transaccional.
             */

            toast(
                '⚠️ Se descontó el saldo pero hubo un problema al emitir la factura'
            );


            return false;

        }


        /*
         * Finalizar presupuesto
         */

        await finalizarCobroPresupuesto(

            presupuesto.id,

            facturaId,

            'Saldo a Favor'

        );


        toast(
            `✅ Cobro realizado usando saldo a favor. Factura: ${facturaId}`
        );


        return true;


    } catch (error) {


        console.error(
            'Error cobrando con saldo:',
            error
        );


        toast(
            '❌ Error al utilizar el saldo a favor'
        );


        return false;

    }

};



/* =========================================================
   IMPRESIÓN DEL PRESUPUESTO
   ========================================================= */

window.imprimirPresupuestoActual =
function() {


    const presupuesto =
        obtenerPresupuestoActual();


    if (!presupuesto) {

        return;

    }


    /*
     * Por ahora usamos una ventana
     * independiente para imprimir.
     */

    const ventana =
        window.open(
            '',
            '_blank'
        );


    if (!ventana) {

        toast(
            '⚠️ El navegador bloqueó la ventana de impresión'
        );

        return;

    }


    const filas =
        (presupuesto.items || [])
            .map(
                item => {


                    const subtotal =
                        Number(
                            item.subtotal
                        ) ||
                        (
                            Number(
                                item.cantidad || 0
                            ) *
                            Number(
                                item.precio || 0
                            )
                        );


                    return `

                        <tr>

                            <td>
                                ${item.descripcion}
                            </td>

                            <td
                                style="
                                    text-align:center;
                                ">

                                ${item.cantidad}

                            </td>

                            <td
                                style="
                                    text-align:right;
                                ">

                                ${fmt(
                                    item.precio
                                )}

                            </td>

                            <td
                                style="
                                    text-align:right;
                                ">

                                ${fmt(
                                    subtotal
                                )}

                            </td>

                        </tr>

                    `;

                }
            )
            .join('');


    ventana.document.write(
        `

        <!DOCTYPE html>

        <html>

            <head>

                <meta charset="UTF-8">

                <title>
                    ${presupuesto.id}
                </title>


                <style>

                    body {

                        font-family:
                            Arial,
                            sans-serif;

                        padding:
                            40px;

                        color:
                            #222;

                    }


                    h1 {

                        margin-bottom:
                            5px;

                    }


                    .header {

                        display:
                            flex;

                        justify-content:
                            space-between;

                        border-bottom:
                            2px solid #333;

                        padding-bottom:
                            20px;

                        margin-bottom:
                            30px;

                    }


                    table {

                        width:
                            100%;

                        border-collapse:
                            collapse;

                        margin-top:
                            25px;

                    }


                    th,
                    td {

                        padding:
                            12px;

                        border-bottom:
                            1px solid #ddd;

                    }


                    th {

                        background:
                            #f4f4f4;

                        text-align:
                            left;

                    }


                    .total {

                        text-align:
                            right;

                        font-size:
                            22px;

                        font-weight:
                            bold;

                        margin-top:
                            25px;

                    }


                    .obs {

                        margin-top:
                            40px;

                        padding:
                            20px;

                        background:
                            #f8f8f8;

                    }

                </style>

            </head>


            <body>


                <div
                    class="header">

                    <div>

                        <h1>
                            PRESUPUESTO
                        </h1>

                        <strong>
                            ${presupuesto.id}
                        </strong>

                    </div>


                    <div>

                        <b>
                            Fecha:
                        </b>

                        ${fDate(
                            presupuesto.fecha
                        )}

                        <br>


                        <b>
                            Válido hasta:
                        </b>

                        ${
                            presupuesto
                                .fechaVencimiento

                                ? fDate(
                                    presupuesto
                                        .fechaVencimiento
                                )

                                : '—'
                        }

                    </div>

                </div>


                <h3>
                    Cliente
                </h3>


                <p>

                    <b>

                        ${
                            presupuesto.cliente ||
                            'Consumidor Final'
                        }

                    </b>

                    <br>

                    ${
                        presupuesto.doc ||
                        ''
                    }

                </p>


                <table>

                    <thead>

                        <tr>

                            <th>
                                Descripción
                            </th>

                            <th>
                                Cant.
                            </th>

                            <th>
                                Precio
                            </th>

                            <th>
                                Subtotal
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${filas}

                    </tbody>

                </table>


                <div
                    class="total">

                    TOTAL:

                    ${fmt(
                        presupuesto.total
                    )}

                </div>


                <div
                    class="obs">

                    <b>
                        Observaciones:
                    </b>

                    <br><br>

                    ${
                        presupuesto.observaciones ||
                        'Sin observaciones'
                    }

                </div>


                <script>

                    window.onload =
                    function() {

                        window.print();

                    };

                </script>


            </body>

        </html>

        `
    );


    ventana.document.close();

};