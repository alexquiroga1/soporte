/* =========================================================
   js/modules/tickets.js

   ARCHIVO CENTRAL DEL MÓDULO TICKETS

   Reexporta las funciones de los submódulos para que
   main.js solamente tenga que importar desde tickets.js.
========================================================= */


/* =========================================================
   LISTADO Y CREACIÓN DE TICKETS
========================================================= */

export {

    renderTicketsTable,
    renderTicketsKanban,
    eliminarTicketConCodigo,

    onClientSearchInput,
    selectClientForTicket,

    printTicket,

    createTicket,

    limpiarFormularioTicket,

    toggleTipoServicio

} from './tickets-list.js';


/* =========================================================
   DETALLE DEL TICKET
========================================================= */

export {

    openTicketModal,

    changeTicketStage,

    changeTicketStageAt,

    sendWhatsAppNotice,

    saveDiagnostico,

    saveGarantiaDias,

    checkBillingButtonVisibility,

    stageInfo

} from './ticket-detail.js';


/* =========================================================
   PRESUPUESTO Y REPUESTOS
========================================================= */

export {

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
   BITÁCORA Y NOTAS
========================================================= */

export {

    logTicketEvent,

    renderTicketNotas,

    addTicketNota

} from './ticket-notes.js';


/* =========================================================
   PRESUPUESTO PÚBLICO
========================================================= */

export {

    compartirLinkPresupuesto,

    responderPresupuesto,

    initPublicPresupuesto

} from './ticket-public-budget.js';