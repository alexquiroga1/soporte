// js/main.js


/* =========================================================
   CORE
========================================================= */

import {
    initStore
} from './core/store.js';

import {
    initAuth,
    doLogin,
    doLogout
} from './core/auth.js';


/* =========================================================
   UI
========================================================= */

import {
    initUI,
    openModal,
    closeModal,
    goView,
    closeDropdowns
} from './modules/ui.js';


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
    openTicketModal,

    fijarPresupuesto,
    desbloquearPresupuesto,

    updatePiezaPrice,
    sendWhatsAppNotice,

    saveDiagnostico,

    addPiezaToTicket,
    removePiezaFromTicket,

    enviarAFacturacion,

    addTicketNota,

    changeTicketStage,

    createTicket,

    saveGarantiaDias,

    compartirLinkPresupuesto,
    responderPresupuesto,
    initPublicPresupuesto,

    limpiarFormularioTicket,
    toggleTipoServicio

} from './modules/tickets.js';


/* =========================================================
   CLIENTES
========================================================= */

import {

    renderClientesTable,

    switchClientTab,

    openClientModal,

    saveClientLimit,

    createCliente,

    populateClienteSelectPOS,

    nuevoCreditoDesdePerfil,

    refinanciarDeudaPerfil,

    openTicketWithDevice

} from './modules/clientes.js';


/* =========================================================
   PRODUCTOS
========================================================= */

import {

    renderProductosTabs,

    setProductoFiltro,

    renderProductosTable,

    createProducto,

    editProducto,

    saveEditProducto,

    eliminarProducto,

    renderPromocionesTable,

    togglePromocion,

    createPromocion

} from './modules/productos.js';


/* =========================================================
   POS
========================================================= */

import {

    renderPayMethods,

    setPayMethod,

    populatePOSPromos,

    renderPOSProducts,

    addToCart,

    changeQty,

    removeFromCart,

    renderCart,

    checkout,

    renderVentasHistorial

} from './modules/pos.js';


/* =========================================================
   CRM
========================================================= */

import {

    renderCRMKanban,

    createOportunidad

} from './modules/crm.js';


/* =========================================================
   CONFIGURACIÓN
========================================================= */

import {

    renderConfig,

    saveConfigNegocio,

    createUsuario,

    toggleUsuario,

    createRol

} from './modules/config.js';


/* =========================================================
   DASHBOARD
========================================================= */

import {

    renderDashboard,

    renderReportes,

    renderNotificaciones

} from './modules/dashboard.js';


/* =========================================================
   CAJA
========================================================= */

import {

    renderCajaPendientes,

    abrirModalCobro,

    setCobroMetodo,

    calcularCambio,

    procesarCobroFinal,

    renderCajaView,

    addMovimiento,

    abrirModalCierre,

    cerrarCorte,

    renderCreditosTable,

    openCreditModal,

    registerPayment,

    openNuevoCreditoModal,

    populateClienteSelectCredito,

    createCreditoManual,

    generarPlanesDePago,

    seleccionarPlanDePago,

    renderCuotasCreditoActual

} from './modules/caja.js';


/* =========================================================
   FACTURACIÓN
========================================================= */

import {

    renderFacturasTable,

    openFacturaDetalle,

    emitirComprobanteInterno,

    showNuevaFactura,

    hideNuevaFactura,

    emitirFacturaManual,

    anularFacturaActual

} from './modules/facturacion.js';


/* =========================================================
   EXPOSICIÓN GLOBAL PARA HTML
========================================================= */


/* ---------------------------------------------------------
   UI
--------------------------------------------------------- */

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.goView =
    goView;

window.closeDropdowns =
    closeDropdowns;


/* ---------------------------------------------------------
   AUTENTICACIÓN
--------------------------------------------------------- */

window.doLogin =
    () => {

        if (!window.auth) {

            console.error(
                'Firebase Auth todavía no fue inicializado.'
            );

            return;
        }

        return doLogin(
            window.auth
        );
    };


window.doLogout =
    () => {

        if (!window.auth) {

            console.error(
                'Firebase Auth todavía no fue inicializado.'
            );

            return;
        }

        return doLogout(
            window.auth,
            closeDropdowns
        );
    };


/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */

window.renderNotificaciones =
    renderNotificaciones;


/* =========================================================
   NUEVO TICKET
========================================================= */

window.showNuevoTicketView =
    () => {

        limpiarFormularioTicket();

        goView(
            'nuevo-ticket'
        );
    };


window.createTicket =
    createTicket;


window.limpiarFormularioTicket =
    limpiarFormularioTicket;


window.toggleTipoServicio =
    toggleTipoServicio;


/* =========================================================
   TICKETS
========================================================= */

window.renderTicketsTable =
    renderTicketsTable;


window.renderTicketsKanban =
    renderTicketsKanban;


window.onClientSearchInput =
    onClientSearchInput;


window.selectClientForTicket =
    selectClientForTicket;


window.eliminarTicketConCodigo =
    eliminarTicketConCodigo;


window.printTicket =
    printTicket;


window.openTicketModal =
    openTicketModal;


window.changeTicketStage =
    changeTicketStage;


/* =========================================================
   DETALLE DEL TICKET
========================================================= */

window.sendWhatsAppNotice =
    sendWhatsAppNotice;


window.saveDiagnostico =
    saveDiagnostico;


window.saveGarantiaDias =
    saveGarantiaDias;


/* =========================================================
   PRESUPUESTO
========================================================= */

window.fijarPresupuesto =
    fijarPresupuesto;


window.desbloquearPresupuesto =
    desbloquearPresupuesto;


window.updatePiezaPrice =
    updatePiezaPrice;


window.addPiezaToTicket =
    addPiezaToTicket;


window.removePiezaFromTicket =
    removePiezaFromTicket;


window.enviarAFacturacion =
    enviarAFacturacion;


window.compartirLinkPresupuesto =
    compartirLinkPresupuesto;


window.responderPresupuesto =
    responderPresupuesto;


/* =========================================================
   BITÁCORA
========================================================= */

window.addTicketNota =
    addTicketNota;


/* =========================================================
   CLIENTES
========================================================= */

window.renderClientesTable =
    renderClientesTable;


window.switchClientTab =
    switchClientTab;


window.openClientModal =
    openClientModal;


window.saveClientLimit =
    saveClientLimit;


window.createCliente =
    createCliente;


window.populateClienteSelectPOS =
    populateClienteSelectPOS;


window.nuevoCreditoDesdePerfil =
    nuevoCreditoDesdePerfil;


window.refinanciarDeudaPerfil =
    refinanciarDeudaPerfil;


window.openTicketWithDevice =
    openTicketWithDevice;


/* =========================================================
   PRODUCTOS
========================================================= */

window.setProductoFiltro =
    setProductoFiltro;


window.createProducto =
    createProducto;


window.editProducto =
    editProducto;


window.saveEditProducto =
    saveEditProducto;


window.eliminarProducto =
    eliminarProducto;


window.togglePromocion =
    togglePromocion;


window.createPromocion =
    createPromocion;


window.renderProductosTable =
    renderProductosTable;


/* =========================================================
   POS
========================================================= */

window.renderPOSProducts =
    renderPOSProducts;


window.populatePOSPromos =
    populatePOSPromos;


window.renderCart =
    renderCart;


window.setPayMethod =
    setPayMethod;


window.addToCart =
    addToCart;


window.changeQty =
    changeQty;


window.removeFromCart =
    removeFromCart;


window.checkout =
    checkout;


window.renderVentasHistorial =
    renderVentasHistorial;


/* =========================================================
   CAJA
========================================================= */

window.renderCajaPendientes =
    renderCajaPendientes;


window.abrirModalCobro =
    abrirModalCobro;


window.setCobroMetodo =
    setCobroMetodo;


window.calcularCambio =
    calcularCambio;


window.procesarCobroFinal =
    procesarCobroFinal;


window.addMovimiento =
    addMovimiento;


window.abrirModalCierre =
    abrirModalCierre;


window.cerrarCorte =
    cerrarCorte;


window.renderCajaView =
    renderCajaView;


window.renderCreditosTable =
    renderCreditosTable;


window.openCreditModal =
    openCreditModal;


window.registerPayment =
    registerPayment;


window.openNuevoCreditoModal =
    openNuevoCreditoModal;


window.populateClienteSelectCredito =
    populateClienteSelectCredito;


window.createCreditoManual =
    createCreditoManual;


window.generarPlanesDePago =
    generarPlanesDePago;


window.seleccionarPlanDePago =
    seleccionarPlanDePago;


window.renderCuotasCreditoActual =
    renderCuotasCreditoActual;


/* =========================================================
   FACTURACIÓN
========================================================= */

window.renderFacturasTable =
    renderFacturasTable;


window.openFacturaDetalle =
    openFacturaDetalle;


window.emitirComprobanteInterno =
    emitirComprobanteInterno;


window.showNuevaFactura =
    showNuevaFactura;


window.hideNuevaFactura =
    hideNuevaFactura;


window.emitirFacturaManual =
    emitirFacturaManual;


window.anularFacturaActual =
    anularFacturaActual;


/* =========================================================
   CRM
========================================================= */

window.createOportunidad =
    createOportunidad;


/* =========================================================
   CONFIGURACIÓN
========================================================= */

window.saveConfigNegocio =
    saveConfigNegocio;


window.createUsuario =
    createUsuario;


window.toggleUsuario =
    toggleUsuario;


window.createRol =
    createRol;


/* =========================================================
   SUB-TABS DE CRÉDITO
========================================================= */

window.switchCreditoTab =
    function (
        tabId,
        el
    ) {

        if (!el) {
            return;
        }


        const group =
            el.parentElement;


        if (group) {

            group
                .querySelectorAll(
                    '.tab'
                )
                .forEach(
                    tab => {

                        tab.classList.remove(
                            'active'
                        );

                    }
                );
        }


        el.classList.add(
            'active'
        );


        const modal =
            document.getElementById(
                'modal-credito'
            );


        if (!modal) {
            return;
        }


        const container =
            modal.querySelector(
                '.modal-body'
            );


        if (!container) {
            return;
        }


        container
            .querySelectorAll(
                '.credito-subview'
            )
            .forEach(
                subview => {

                    subview.style.display =
                        subview.id === tabId
                            ? 'block'
                            : 'none';

                }
            );
    };


/* =========================================================
   RENDER GENERAL
========================================================= */

window.renderAll =
    function () {

        renderDashboard();

        renderTicketsTable();

        renderTicketsKanban();

        renderClientesTable();

        populateClienteSelectPOS();

        renderProductosTabs();

        renderProductosTable();

        renderPromocionesTable();

        renderPayMethods();

        populatePOSPromos();

        renderPOSProducts();

        renderCart();

        renderVentasHistorial();

        renderCajaView();

        renderCreditosTable();

        renderCRMKanban();

        renderReportes();

        renderNotificaciones();

        renderFacturasTable();

        renderConfig();
    };


/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        /* ---------------------------------------------
           INICIALIZAR UI
        --------------------------------------------- */

        initUI();


        /* ---------------------------------------------
           VERIFICAR FIREBASE
        --------------------------------------------- */

        if (
            !window.firebase
        ) {

            console.error(
                'No se detectó Firebase.'
            );

            return;
        }


        /* ---------------------------------------------
           INICIALIZAR FIREBASE
        --------------------------------------------- */

        window.db =
            window.firebase.firestore();


        window.auth =
            window.firebase.auth();


        /* ---------------------------------------------
           DETECTAR PRESUPUESTO PÚBLICO
        --------------------------------------------- */

        const urlParams =
            new URLSearchParams(
                window.location.search
            );


        const presupuestoId =
            urlParams.get(
                'p'
            );


        /* ---------------------------------------------
           VISTA PÚBLICA DE PRESUPUESTO
        --------------------------------------------- */

        if (
            presupuestoId
        ) {

            initPublicPresupuesto(
                presupuestoId
            );

            return;
        }


        /* ---------------------------------------------
           INICIALIZAR AUTENTICACIÓN
        --------------------------------------------- */

        initAuth(
            window.auth,
            window.db,
            () => {

                initStore(
                    window.db,
                    window.renderAll
                );

            }
        );

    }
);