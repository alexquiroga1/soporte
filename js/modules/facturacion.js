/* =========================================================
   PRESUPUESTOS
   ========================================================= */

let presupuestoItems = [];



/* =========================================================
   ABRIR NUEVO PRESUPUESTO MANUAL
   ========================================================= */

window.abrirNuevoPresupuestoManual = function() {

    presupuestoItems = [
        {
            descripcion: '',
            cantidad: 1,
            precio: 0
        }
    ];


    const modal =
        document.getElementById(
            'modal-presupuesto'
        );


    if (!modal) {

        console.error(
            'No se encontró modal-presupuesto'
        );

        return;

    }


    modal.style.display =
        'block';


    document.getElementById(
        'presupuesto-modal-titulo'
    ).textContent =
        'Nuevo presupuesto manual';


    cargarClientesPresupuesto();

    cargarTicketsPresupuesto();


    document.getElementById(
        'pres-origen'
    ).value =
        'manual';


    document.getElementById(
        'pres-ticket'
    ).value =
        '';


    document.getElementById(
        'pres-descuento'
    ).value =
        0;


    /* Vigencia: 7 días */

    const vigencia =
        new Date();


    vigencia.setDate(
        vigencia.getDate() + 7
    );


    document.getElementById(
        'pres-vigencia'
    ).value =
        vigencia
            .toISOString()
            .split('T')[0];


    renderItemsPresupuesto();

    actualizarOrigenPresupuesto();

};




/* =========================================================
   CERRAR MODAL
   ========================================================= */

window.cerrarModalPresupuesto = function() {

    const modal =
        document.getElementById(
            'modal-presupuesto'
        );


    if (modal) {

        modal.style.display =
            'none';

    }


    presupuestoItems = [];

};




/* =========================================================
   CARGAR CLIENTES
   ========================================================= */

function cargarClientesPresupuesto() {

    const select =
        document.getElementById(
            'pres-cliente'
        );


    if (!select) return;


    select.innerHTML = `

        <option value="">
            Seleccionar cliente
        </option>

    `;


    (DATA.clientes || [])
        .forEach(cliente => {


            const nombre =
                typeof getFullName ===
                'function'

                    ? getFullName(cliente)

                    : (
                        cliente.nombre ||
                        cliente.razonSocial ||
                        'Cliente'
                    );


            select.innerHTML += `

                <option value="${cliente.id}">

                    ${nombre}

                </option>

            `;

        });

}




/* =========================================================
   CARGAR TICKETS
   ========================================================= */

function cargarTicketsPresupuesto() {

    const select =
        document.getElementById(
            'pres-ticket'
        );


    if (!select) return;


    select.innerHTML = `

        <option value="">
            Sin Ticket
        </option>

    `;


    (DATA.tickets || [])
        .filter(ticket =>
            ticket.estado !==
            'entregado'
        )
        .forEach(ticket => {


            const numero =
                ticket.numero ||
                ticket.id;


            const cliente =
                ticket.cliente ||
                'Sin cliente';


            select.innerHTML += `

                <option
                    value="${ticket.id}">

                    ${numero} - ${cliente}

                </option>

            `;

        });

}




/* =========================================================
   ACTIVAR / DESACTIVAR TICKET
   ========================================================= */

window.actualizarOrigenPresupuesto = function() {

    const origen =
        document.getElementById(
            'pres-origen'
        )?.value;


    const ticket =
        document.getElementById(
            'pres-ticket'
        );


    if (!ticket) return;


    ticket.disabled =
        origen !== 'ticket';


    if (origen === 'manual') {

        ticket.value = '';

    }

};




/* =========================================================
   AGREGAR ITEM
   ========================================================= */

window.agregarItemPresupuesto = function() {

    presupuestoItems.push(
        {
            descripcion: '',
            cantidad: 1,
            precio: 0
        }
    );


    renderItemsPresupuesto();

};




/* =========================================================
   ELIMINAR ITEM
   ========================================================= */

window.eliminarItemPresupuesto = function(index) {

    presupuestoItems.splice(
        index,
        1
    );


    renderItemsPresupuesto();

};




/* =========================================================
   RENDER ITEMS
   ========================================================= */

function renderItemsPresupuesto() {

    const tbody =
        document.getElementById(
            'presupuesto-items-body'
        );


    if (!tbody) return;


    if (
        presupuestoItems.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    style="
                        text-align:center;
                        padding:25px;
                        color:var(--muted);">

                    No hay conceptos.
                    Agregá uno para comenzar.

                </td>

            </tr>

        `;


        calcularTotalesPresupuesto();

        return;

    }


    tbody.innerHTML =
        presupuestoItems
            .map(
                (item, index) => `

                    <tr>

                        <td>

                            <input
                                class="inp"
                                value="${item.descripcion || ''}"
                                placeholder="Descripción del servicio o producto"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'descripcion',
                                        this.value
                                    )
                                ">

                        </td>


                        <td>

                            <input
                                class="inp"
                                type="number"
                                min="1"
                                value="${item.cantidad}"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'cantidad',
                                        this.value
                                    )
                                ">

                        </td>


                        <td>

                            <input
                                class="inp"
                                type="number"
                                min="0"
                                step="0.01"
                                value="${item.precio}"
                                oninput="
                                    actualizarItemPresupuesto(
                                        ${index},
                                        'precio',
                                        this.value
                                    )
                                ">

                        </td>


                        <td>

                            <strong>

                                ${
                                    fmt(
                                        Number(
                                            item.cantidad
                                        ) *
                                        Number(
                                            item.precio
                                        )
                                    )
                                }

                            </strong>

                        </td>


                        <td>

                            <button
                                class="btn btn-ghost"
                                onclick="
                                    eliminarItemPresupuesto(
                                        ${index}
                                    )
                                ">

                                🗑

                            </button>

                        </td>

                    </tr>

                `
            )
            .join('');


    calcularTotalesPresupuesto();

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
    ) return;


    if (
        campo === 'cantidad' ||
        campo === 'precio'
    ) {

        presupuestoItems[index][campo] =
            Number(valor) || 0;

    } else {

        presupuestoItems[index][campo] =
            valor;

    }


    renderItemsPresupuesto();

};




/* =========================================================
   CALCULAR TOTALES
   ========================================================= */

window.calcularTotalesPresupuesto =
function() {

    const subtotal =
        presupuestoItems.reduce(
            (total, item) => {

                return (
                    total +
                    (
                        Number(
                            item.cantidad
                        ) *
                        Number(
                            item.precio
                        )
                    )
                );

            },
            0
        );


    const descuento =
        Number(
            document.getElementById(
                'pres-descuento'
            )?.value || 0
        );


    const total =
        Math.max(
            0,
            subtotal -
            descuento
        );


    const subtotalEl =
        document.getElementById(
            'pres-subtotal'
        );


    const totalEl =
        document.getElementById(
            'pres-total'
        );


    if (subtotalEl) {

        subtotalEl.textContent =
            fmt(subtotal);

    }


    if (totalEl) {

        totalEl.textContent =
            fmt(total);

    }


    return {
        subtotal,
        descuento,
        total
    };

};




/* =========================================================
   GUARDAR PRESUPUESTO EN FIREBASE
   ========================================================= */

window.guardarPresupuesto =
async function(estado) {


    const clienteId =
        document.getElementById(
            'pres-cliente'
        )?.value;


    const origen =
        document.getElementById(
            'pres-origen'
        )?.value ||
        'manual';


    const ticketId =
        origen === 'ticket'

            ? document.getElementById(
                'pres-ticket'
              )?.value

            : null;


    const vigencia =
        document.getElementById(
            'pres-vigencia'
        )?.value;


    /* Validaciones */

    if (!clienteId) {

        toast(
            '⚠️ Seleccioná un cliente'
        );

        return;

    }


    if (
        origen === 'ticket' &&
        !ticketId
    ) {

        toast(
            '⚠️ Seleccioná un Ticket'
        );

        return;

    }


    if (
        presupuestoItems.length === 0
    ) {

        toast(
            '⚠️ Agregá al menos un concepto'
        );

        return;

    }


    if (
        presupuestoItems.some(
            item =>
                !item.descripcion ||
                Number(
                    item.cantidad
                ) <= 0
        )
    ) {

        toast(
            '⚠️ Completá correctamente todos los conceptos'
        );

        return;

    }


    const cliente =
        DATA.clientes.find(
            c =>
                c.id === clienteId
        );


    const ticket =
        ticketId

            ? DATA.tickets.find(
                t =>
                    t.id === ticketId
              )

            : null;


    const totales =
        calcularTotalesPresupuesto();


    const ref =
        window.db
            .collection(
                'presupuestos'
            )
            .doc();


    const numero =
        `PRES-${ref.id.slice(
            0,
            8
        ).toUpperCase()}`;


    const usuario =
        window.currentUserProfile?.nombre ||
        'Sistema';


    const presupuesto = {

        id:
            ref.id,


        numero,


        /* CLIENTE */

        clienteId,

        cliente:
            cliente
                ? (
                    typeof getFullName ===
                    'function'

                        ? getFullName(
                            cliente
                          )

                        : (
                            cliente.nombre ||
                            'Cliente'
                          )
                  )

                : 'Cliente',


        /* ORIGEN */

        origen,

        ticketId:
            ticketId || null,


        ticketNumero:

            ticket

                ? (
                    ticket.numero ||
                    ticket.id
                  )

                : null,


        /* CONCEPTOS */

        items:
            presupuestoItems,


        subtotal:
            totales.subtotal,


        descuento:
            totales.descuento,


        total:
            totales.total,


        /* ESTADO */

        estado,


        vigencia:
            vigencia || null,


        /* FECHAS */

        fecha:
            new Date()
                .toISOString()
                .split('T')[0],


        fechaCreacion:
            window.firebase
                .firestore
                .FieldValue
                .serverTimestamp(),


        /* AUDITORÍA */

        usuario

    };


    try {


        await ref.set(
            presupuesto
        );


        /* Si viene de Ticket,
           guardamos la referencia */

        if (
            ticketId
        ) {

            await window.db
                .collection(
                    'tickets'
                )
                .doc(
                    ticketId
                )
                .update(
                    {

                        presupuestoId:
                            ref.id,


                        presupuestoNumero:
                            numero,


                        presupuestoEstado:
                            estado,


                        presupuestoTotal:
                            totales.total

                    }
                );

        }


        toast(
            '✅ Presupuesto guardado correctamente'
        );


        cerrarModalPresupuesto();


        renderPresupuestosTable();


    } catch (error) {


        console.error(
            'Error al guardar presupuesto:',
            error
        );


        toast(
            '❌ Error al guardar el presupuesto'
        );

    }

};




/* =========================================================
   RENDER TABLA PRESUPUESTOS
   ========================================================= */

export function renderPresupuestosTable() {

    const tbody =
        document.getElementById(
            'presupuestos-table-body'
        );


    if (!tbody) return;


    const presupuestos =
        DATA.presupuestos || [];


    if (
        presupuestos.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                        color:var(--muted);">

                    Todavía no hay presupuestos cargados.

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        [...presupuestos]

            .sort(
                (a, b) =>
                    String(
                        b.fecha || ''
                    )
                    .localeCompare(
                        String(
                            a.fecha || ''
                        )
                    )
            )

            .map(
                presupuesto => `

                    <tr>

                        <td>

                            ${
                                typeof fDate ===
                                'function'

                                    ? fDate(
                                        presupuesto.fecha
                                      )

                                    : presupuesto.fecha
                            }

                        </td>


                        <td>

                            <strong>

                                ${
                                    presupuesto.numero
                                }

                            </strong>

                        </td>


                        <td>

                            ${
                                presupuesto.cliente
                            }

                        </td>


                        <td>

                            ${
                                presupuesto.origen ===
                                'ticket'

                                    ? '🎫 Desde Ticket'

                                    : '✍️ Manual'
                            }

                        </td>


                        <td>

                            ${
                                presupuesto.ticketNumero ||
                                '-'
                            }

                        </td>


                        <td>

                            ${
                                presupuesto.estado
                            }

                        </td>


                        <td>

                            <strong>

                                ${
                                    fmt(
                                        presupuesto.total
                                    )
                                }

                            </strong>

                        </td>


                        <td>

                            <button
                                class="btn btn-ghost btn-sm"
                                onclick="
                                    verPresupuesto(
                                        '${presupuesto.id}'
                                    )
                                ">

                                Ver

                            </button>

                        </td>

                    </tr>

                `
            )
            .join('');

}




/* =========================================================
   VER PRESUPUESTO

   Por ahora abre el resumen.
   En el próximo paso agregaremos:
   editar / aprobar / rechazar
   ========================================================= */

window.verPresupuesto =
function(id) {


    const presupuesto =
        (DATA.presupuestos || [])
            .find(
                p =>
                    p.id === id
            );


    if (!presupuesto) {

        toast(
            '❌ Presupuesto no encontrado'
        );

        return;

    }


    const conceptos =
        (presupuesto.items || [])
            .map(
                item =>

                    `• ${item.descripcion} × ` +
                    `${item.cantidad} = ` +
                    `${fmt(
                        Number(
                            item.cantidad
                        ) *
                        Number(
                            item.precio
                        )
                    )}`

            )
            .join('\n');


    alert(

        `PRESUPUESTO ${presupuesto.numero}\n\n` +

        `Cliente: ${presupuesto.cliente}\n` +

        `Estado: ${presupuesto.estado}\n\n` +

        `CONCEPTOS:\n` +

        `${conceptos}\n\n` +

        `TOTAL: ${fmt(
            presupuesto.total
        )}`

    );

};