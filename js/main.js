/* =========================================================
   SERVIX - main.js
   =========================================================
   IMPORTANTE:
   - tickets.js permanece como UN SOLO ARCHIVO.
   - No se divide tickets.js.
   - Este archivo conecta los módulos ES con el HTML
     que utiliza onclick="...".
   ========================================================= */


/* =========================================================
   CORE
   ========================================================= */

import {
    initStore,
    DATA
} from './core/store.js';

import {
    initAuth,
    doLogin,
    doLogout,
    aplicarPermisosEnUI
} from './core/auth.js';


/* =========================================================
   UI
   ========================================================= */

import {
    openModal,
    closeModal,
    closeDropdowns,
    goView,
    initUI
} from './modules/ui.js';


/* =========================================================
   MÓDULOS
   ========================================================= */

import * as Tickets from './modules/tickets.js';
import * as Clientes from './modules/clientes.js';
import * as Productos from './modules/productos.js';
import * as POS from './modules/pos.js';
import * as Caja from './modules/caja.js';
import * as Facturacion from './modules/facturacion.js';
import * as CRM from './modules/crm.js';
import * as Dashboard from './modules/dashboard.js';
import * as Config from './modules/config.js';


/* =========================================================
   EXPONER FUNCIONES DEL PROYECTO AL HTML
   =========================================================
   Tu index.html utiliza muchos:
   
      onclick="..."
      onsubmit="..."
      onchange="..."
   
   Las funciones exportadas por un ES Module no quedan
   automáticamente disponibles como window.funcion.
   ========================================================= */

function exposeModule(module) {

    Object.entries(module).forEach(
        ([name, value]) => {

            if (
                typeof value === 'function' &&
                name !== 'default'
            ) {
                window[name] = value;
            }

        }
    );

}


/* UI */
window.openModal = openModal;
window.closeModal = closeModal;
window.closeDropdowns = closeDropdowns;
window.goView = goView;


/* Módulos */
exposeModule(Tickets);
exposeModule(Clientes);
exposeModule(Productos);
exposeModule(POS);
exposeModule(Caja);
exposeModule(Facturacion);
exposeModule(CRM);
exposeModule(Dashboard);
exposeModule(Config);


/* =========================================================
   AUTENTICACIÓN
   =========================================================
   El HTML llama:

       doLogin()

   Pero auth.js necesita:

       doLogin(auth)

   Por eso hacemos el puente aquí.
   ========================================================= */

window.doLogin = function () {

    if (!window.auth) {

        console.error(
            'SERVIX: Firebase Auth todavía no está disponible.'
        );

        return;

    }

    return doLogin(
        window.auth
    );

};


window.doLogout = function () {

    if (!window.auth) {

        console.error(
            'SERVIX: Firebase Auth todavía no está disponible.'
        );

        return;

    }

    return doLogout(
        window.auth,
        closeDropdowns
    );

};


/* =========================================================
   DATA GLOBAL
   ========================================================= */

window.DATA = DATA;


/* =========================================================
   FUNCIONES QUE EL HTML UTILIZA
   ========================================================= */


/*
   Nuevo Ticket
*/
window.showNuevoTicketView = function () {

    try {

        if (
            typeof Tickets.limpiarFormularioTicket ===
            'function'
        ) {

            Tickets.limpiarFormularioTicket();

        }

        goView(
            'nuevo-ticket'
        );

    } catch (error) {

        console.error(
            'Error al abrir Nuevo Ticket:',
            error
        );

    }

};


/*
   Tabs de créditos
*/
window.switchCreditoTab = function (
    tabId,
    element
) {

    try {

        const tabButtons =
            document.querySelectorAll(
                '.tab[data-sub]'
            );

        tabButtons.forEach(
            tab => {

                if (
                    tab.dataset.sub &&
                    tab.dataset.sub.startsWith(
                        'cr-tab-'
                    )
                ) {
                    tab.classList.remove(
                        'active'
                    );
                }

            }
        );


        if (element) {

            element.classList.add(
                'active'
            );

        }


        const target =
            document.getElementById(
                tabId
            );

        if (!target) {

            console.warn(
                `SERVIX: No existe el elemento #${tabId}`
            );

            return;

        }


        const parent =
            target.parentElement;

        if (!parent) {
            return;
        }


        parent
            .querySelectorAll(
                '.subview'
            )
            .forEach(
                view => {

                    view.style.display =
                        view.id === tabId
                            ? ''
                            : 'none';

                }
            );


    } catch (error) {

        console.error(
            'Error en switchCreditoTab:',
            error
        );

    }

};


/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */

function renderApp() {

    /*
       Dashboard
    */

    if (
        typeof Dashboard.renderDashboard ===
        'function'
    ) {

        try {
            Dashboard.renderDashboard();
        } catch (e) {
            console.error(
                'Dashboard:',
                e
            );
        }

    }


    /*
       Reportes
    */

    if (
        typeof Dashboard.renderReportes ===
        'function'
    ) {

        try {
            Dashboard.renderReportes();
        } catch (e) {
            console.error(
                'Reportes:',
                e
            );
        }

    }


    /*
       Notificaciones
    */

    if (
        typeof Dashboard.renderNotificaciones ===
        'function'
    ) {

        try {
            Dashboard.renderNotificaciones();
        } catch (e) {
            console.error(
                'Notificaciones:',
                e
            );
        }

    }


    /*
       Clientes
    */

    if (
        typeof Clientes.renderClientesTable ===
        'function'
    ) {

        try {
            Clientes.renderClientesTable();
        } catch (e) {
            console.error(
                'Clientes:',
                e
            );
        }

    }


    /*
       Tickets
    */

    if (
        typeof Tickets.renderTicketsTable ===
        'function'
    ) {

        try {
            Tickets.renderTicketsTable();
        } catch (e) {
            console.error(
                'Tickets:',
                e
            );
        }

    }


    /*
       Kanban Tickets
    */

    if (
        typeof Tickets.renderTicketsKanban ===
        'function'
    ) {

        try {
            Tickets.renderTicketsKanban();
        } catch (e) {
            console.error(
                'Tickets Kanban:',
                e
            );
        }

    }


    /*
       Técnicos
    */

    if (
        typeof Tickets.populateTecnicos ===
        'function'
    ) {

        try {
            Tickets.populateTecnicos();
        } catch (e) {
            console.error(
                'Técnicos:',
                e
            );
        }

    }


    /*
       Repuestos
    */

    if (
        typeof Tickets.populateRepuestosSelect ===
        'function'
    ) {

        try {
            Tickets.populateRepuestosSelect();
        } catch (e) {
            console.error(
                'Repuestos:',
                e
            );
        }

    }


    /*
       Productos
    */

    if (
        typeof Productos.renderProductosTabs ===
        'function'
    ) {

        try {
            Productos.renderProductosTabs();
        } catch (e) {
            console.error(
                'Productos Tabs:',
                e
            );
        }

    }


    if (
        typeof Productos.renderProductosTable ===
        'function'
    ) {

        try {
            Productos.renderProductosTable();
        } catch (e) {
            console.error(
                'Productos:',
                e
            );
        }

    }


    if (
        typeof Productos.renderPromocionesTable ===
        'function'
    ) {

        try {
            Productos.renderPromocionesTable();
        } catch (e) {
            console.error(
                'Promociones:',
                e
            );
        }

    }


    /*
       POS
    */

    if (
        typeof POS.renderPOSProducts ===
        'function'
    ) {

        try {
            POS.renderPOSProducts();
        } catch (e) {
            console.error(
                'POS Productos:',
                e
            );
        }

    }


    if (
        typeof POS.renderPayMethods ===
        'function'
    ) {

        try {
            POS.renderPayMethods();
        } catch (e) {
            console.error(
                'POS Medios de Pago:',
                e
            );
        }

    }


    if (
        typeof POS.populatePOSPromos ===
        'function'
    ) {

        try {
            POS.populatePOSPromos();
        } catch (e) {
            console.error(
                'POS Promociones:',
                e
            );
        }

    }


    if (
        typeof POS.renderVentasHistorial ===
        'function'
    ) {

        try {
            POS.renderVentasHistorial();
        } catch (e) {
            console.error(
                'Historial Ventas:',
                e
            );
        }

    }


    /*
       Caja
    */

    if (
        typeof Caja.renderCajaView ===
        'function'
    ) {

        try {
            Caja.renderCajaView();
        } catch (e) {
            console.error(
                'Caja:',
                e
            );
        }

    }


    if (
        typeof Caja.renderCajaPendientes ===
        'function'
    ) {

        try {
            Caja.renderCajaPendientes();
        } catch (e) {
            console.error(
                'Caja Pendientes:',
                e
            );
        }

    }


    if (
        typeof Caja.renderCreditosTable ===
        'function'
    ) {

        try {
            Caja.renderCreditosTable();
        } catch (e) {
            console.error(
                'Créditos:',
                e
            );
        }

    }


    /*
       Facturación
    */

    if (
        typeof Facturacion.renderFacturasTable ===
        'function'
    ) {

        try {
            Facturacion.renderFacturasTable();
        } catch (e) {
            console.error(
                'Facturas:',
                e
            );
        }

    }


    if (
        typeof Facturacion.renderResumenFacturacion ===
        'function'
    ) {

        try {
            Facturacion.renderResumenFacturacion();
        } catch (e) {
            console.error(
                'Resumen Facturación:',
                e
            );
        }

    }


    if (
        typeof Facturacion.renderPresupuestosTable ===
        'function'
    ) {

        try {
            Facturacion.renderPresupuestosTable();
        } catch (e) {
            console.error(
                'Presupuestos:',
                e
            );
        }

    }


    if (
        typeof Facturacion.cargarClientesCuentaCorriente ===
        'function'
    ) {

        try {
            Facturacion.cargarClientesCuentaCorriente();
        } catch (e) {
            console.error(
                'Cuenta Corriente:',
                e
            );
        }

    }


    /*
       CRM
    */

    if (
        typeof CRM.renderCRMKanban ===
        'function'
    ) {

        try {
            CRM.renderCRMKanban();
        } catch (e) {
            console.error(
                'CRM:',
                e
            );
        }

    }


    /*
       Configuración
    */

    if (
        typeof Config.renderConfig ===
        'function'
    ) {

        try {
            Config.renderConfig();
        } catch (e) {
            console.error(
                'Configuración:',
                e
            );
        }

    }


    /*
       Permisos
    */

    try {

        if (
            typeof aplicarPermisosEnUI ===
            'function'
        ) {

            aplicarPermisosEnUI(
                DATA.roles || []
            );

        }

    } catch (error) {

        console.error(
            'Error aplicando permisos:',
            error
        );

    }

}


/* =========================================================
   CRM
   =========================================================
   En index.html estaba:

       openModal('modal-oportunidad')

   Pero el modal existente es:

       modal-nueva-oportunidad

   Lo corregimos acá sin tocar todavía todo el HTML.
   ========================================================= */

const botonNuevaOportunidad =
    document.querySelector(
        '[onclick="openModal(\'modal-oportunidad\')"]'
    );

if (botonNuevaOportunidad) {

    botonNuevaOportunidad.onclick =
        function () {

            openModal(
                'modal-nueva-oportunidad'
            );

        };

}


/* =========================================================
   ARRANQUE
   ========================================================= */

async function boot() {

    try {

        /*
           Primero UI
        */

        initUI();


        /*
           Detectar presupuesto público

           URL:

           ?p=ID_DEL_TICKET
        */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const publicTicketId =
            params.get('p');


        if (publicTicketId) {

            const splash =
                document.getElementById(
                    'splash-screen'
                );

            if (splash) {

                splash.style.display =
                    'none';

            }


            if (
                typeof Tickets.initPublicPresupuesto ===
                'function'
            ) {

                await Tickets
                    .initPublicPresupuesto(
                        publicTicketId
                    );

            }

            return;

        }


        /*
           Firebase Auth
        */

        if (!window.auth) {

            console.error(
                'SERVIX: window.auth no existe.'
            );

            return;

        }


        if (!window.db) {

            console.error(
                'SERVIX: window.db no existe.'
            );

            return;

        }


        initAuth(

            window.auth,

            window.db,

            function () {

                try {

                    initStore(
                        window.db,
                        renderApp
                    );

                } catch (error) {

                    console.error(
                        'Error inicializando Store:',
                        error
                    );

                }

            }

        );


    } catch (error) {

        console.error(
            'SERVIX: Error fatal durante boot():',
            error
        );


        const splash =
            document.getElementById(
                'splash-screen'
            );

        if (splash) {

            splash.style.display =
                'none';

        }


        const loginScreen =
            document.getElementById(
                'login-screen'
            );

        if (loginScreen) {

            loginScreen.style.display =
                'flex';

        }

    }

}


/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        boot,
        {
            once: true
        }
    );

} else {

    boot();

}