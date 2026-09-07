/* =========================================================
   TICKETS
========================================================= */

import {

    renderTicketsTable,
    renderTicketsKanban,
    eliminarTicketConCodigo,

    onClientSearchInput,
    selectClientForTicket,

    printTicket,

    createTicket,

    compartirLinkPresupuesto,
    responderPresupuesto,
    initPublicPresupuesto,

    limpiarFormularioTicket,
    toggleTipoServicio

} from './modules/tickets.js';


/* =========================================================
   DETALLE DEL TICKET
========================================================= */

import {

    changeTicketStage,

    openTicketModal,

    sendWhatsAppNotice,

    saveDiagnostico,

    saveGarantiaDias,

    checkBillingButtonVisibility

} from './modules/ticket-detail.js';


/* =========================================================
   PRESUPUESTO Y REPUESTOS
========================================================= */

import {

    fijarPresupuesto,

    desbloquearPresupuesto,

    updatePiezaPrice,

    addPiezaToTicket,

    removePiezaFromTicket,

    enviarAFacturacion

} from './modules/ticket-budget.js';


/* =========================================================
   BITÁCORA Y NOTAS
========================================================= */

import {

    addTicketNota,

    logTicketEvent,

    renderTicketNotas

} from './modules/ticket-notes.js';