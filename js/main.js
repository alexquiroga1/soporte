/* =========================================================
   SERVIX — main.js
   Mantiene tickets.js completo.
   Corrige compatibilidad entre ES Modules y onclick=""
========================================================= */

import { initStore, DATA } from './core/store.js';

import {
  initAuth,
  aplicarPermisosEnUI,
  doLogin,
  doLogout
} from './core/auth.js';

import {
  openModal,
  closeModal,
  closeDropdowns,
  goView,
  initUI
} from './modules/ui.js';

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
   COMPATIBILIDAD CON HTML
   El HTML utiliza onclick="funcion()".
   Los módulos ES no agregan automáticamente sus exports
   a window, por eso se publican aquí.
========================================================= */

const publicApi = {

  /* UI */
  openModal,
  closeModal,
  closeDropdowns,
  goView,
  initUI,

  /* AUTENTICACIÓN */
  doLogin: () => {
    try {
      if (!window.auth) {
        console.error(
          'Firebase Auth todavía no está disponible.'
        );
        return;
      }

      return doLogin(window.auth);

    } catch (error) {
      console.error(
        'Error ejecutando doLogin:',
        error
      );
    }
  },

  doLogout: () => {
    try {
      if (!window.auth) {
        console.error(
          'Firebase Auth todavía no está disponible.'
        );
        return;
      }

      return doLogout(
        window.auth,
        closeDropdowns
      );

    } catch (error) {
      console.error(
        'Error ejecutando doLogout:',
        error
      );
    }
  },

  /* TICKETS */
  ...Tickets,

  /* CLIENTES */
  ...Clientes,

  /* PRODUCTOS */
  ...Productos,

  /* POS */
  ...POS,

  /* CAJA / CRÉDITOS */
  ...Caja,

  /* FACTURACIÓN / PRESUPUESTOS */
  ...Facturacion,

  /* CRM */
  ...CRM,

  /* DASHBOARD / REPORTES */
  ...Dashboard,

  /* CONFIGURACIÓN */
  ...Config
};


/* =========================================================
   EXPONER FUNCIONES GLOBALMENTE
========================================================= */

Object.entries(publicApi).forEach(
  ([name, fn]) => {

    if (typeof fn === 'function') {
      window[name] = fn;
    }

  }
);


/* DATA disponible globalmente */
window.DATA = DATA;


/* =========================================================
   NUEVO TICKET
========================================================= */

window.showNuevoTicketView =
  function showNuevoTicketView() {

    try {

      if (
        typeof Tickets.limpiarFormularioTicket ===
        'function'
      ) {
        Tickets.limpiarFormularioTicket();
      }

      goView('nuevo-ticket');

    } catch (error) {

      console.error(
        'Error abriendo nuevo ticket:',
        error
      );

    }

  };


/* =========================================================
   PRESUPUESTOS
========================================================= */

if (
  typeof Facturacion.showNuevoPresupuesto ===
  'function'
) {
  window.showNuevoPresupuesto =
    Facturacion.showNuevoPresupuesto;
}

if (
  typeof Facturacion.hideNuevoPresupuesto ===
  'function'
) {
  window.hideNuevoPresupuesto =
    Facturacion.hideNuevoPresupuesto;
}


/* =========================================================
   TABS DE CRÉDITOS
========================================================= */

window.switchCreditoTab =
  function switchCreditoTab(
    tabId,
    element
  ) {

    try {

      /* Quitar active de tabs */
      const container =
        element?.parentElement;

      if (container) {

        container
          .querySelectorAll('.tab')
          .forEach(tab => {

            tab.classList.remove(
              'active'
            );

          });

      }


      /* Activar tab actual */
      if (element) {
        element.classList.add(
          'active'
        );
      }


      /* Buscar contenedor */
      const target =
        document.getElementById(
          tabId
        );

      if (!target) {
        return;
      }


      const scope =
        target.parentElement;

      if (!scope) {
        return;
      }


      /* Mostrar únicamente la subvista elegida */
      scope
        .querySelectorAll('.subview')
        .forEach(view => {

          view.style.display =
            view.id === tabId
              ? ''
              : 'none';

        });

    } catch (error) {

      console.error(
        'Error cambiando pestaña de créditos:',
        error
      );

    }

  };


/* =========================================================
   RENDER PRINCIPAL
========================================================= */

function renderApp() {

  const renders = [

    [
      'Dashboard',
      Dashboard.renderDashboard
    ],

    [
      'Reportes',
      Dashboard.renderReportes
    ],

    [
      'Notificaciones',
      Dashboard.renderNotificaciones
    ],

    [
      'Clientes',
      Clientes.renderClientesTable
    ],

    [
      'Tickets',
      Tickets.renderTicketsTable
    ],

    [
      'Tickets Kanban',
      Tickets.renderTicketsKanban
    ],

    [
      'Productos',
      Productos.renderProductosTabs
    ],

    [
      'Productos tabla',
      Productos.renderProductosTable
    ],

    [
      'Promociones',
      Productos.renderPromocionesTable
    ],

    [
      'POS productos',
      POS.renderPOSProducts
    ],

    [
      'POS medios de pago',
      POS.renderPayMethods
    ],

    [
      'POS promociones',
      POS.populatePOSPromos
    ],

    [
      'Ventas historial',
      POS.renderVentasHistorial
    ],

    [
      'Caja',
      Caja.renderCajaView
    ],

    [
      'Caja pendientes',
      Caja.renderCajaPendientes
    ],

    [
      'Créditos',
      Caja.renderCreditosTable
    ],

    [
      'Facturas',
      Facturacion.renderFacturasTable
    ],

    [
      'Resumen facturación',
      Facturacion.renderResumenFacturacion
    ],

    [
      'Presupuestos',
      Facturacion.renderPresupuestosTable
    ],

    [
      'Clientes cuenta corriente',
      Facturacion.cargarClientesCuentaCorriente
    ],

    [
      'CRM',
      CRM.renderCRMKanban
    ],

    [
      'Configuración',
      Config.renderConfig
    ]

  ];


  /* Ejecutar renders sin detener toda la app
     si uno falla */
  for (
    const [label, render] of renders
  ) {

    if (
      typeof render !== 'function'
    ) {
      continue;
    }

    try {

      render();

    } catch (error) {

      console.error(
        `Error renderizando ${label}:`,
        error
      );

    }

  }


  /* Técnicos */
  try {

    if (
      typeof Tickets.populateTecnicos ===
      'function'
    ) {
      Tickets.populateTecnicos();
    }

  } catch (error) {

    console.error(
      'Error poblando técnicos:',
      error
    );

  }


  /* Repuestos */
  try {

    if (
      typeof Tickets.populateRepuestosSelect ===
      'function'
    ) {
      Tickets.populateRepuestosSelect();
    }

  } catch (error) {

    console.error(
      'Error poblando repuestos:',
      error
    );

  }


  /* Permisos */
  try {

    if (
      typeof aplicarPermisosEnUI ===
        'function' &&
      DATA?.roles
    ) {

      aplicarPermisosEnUI(
        DATA.roles
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
   BOOT
========================================================= */

async function boot() {

  try {

    /* Inicializar UI */
    initUI();


    /* =====================================================
       TICKET / PRESUPUESTO PÚBLICO
       ?p=TK-xxxx
    ===================================================== */

    const params =
      new URLSearchParams(
        window.location.search
      );

    const publicTicketId =
      params.get('p');


    if (publicTicketId) {

      document
        .getElementById(
          'splash-screen'
        )
        ?.remove();


      try {

        if (
          typeof Tickets.initPublicPresupuesto ===
          'function'
        ) {

          await Tickets
            .initPublicPresupuesto(
              publicTicketId
            );

        }

      } catch (error) {

        console.error(
          'Error inicializando presupuesto público:',
          error
        );

      }

      return;
    }


    /* =====================================================
       AUTENTICACIÓN
    ===================================================== */

    initAuth(

      window.auth,

      window.db,

      () => {

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
      'Error fatal durante el inicio de Servix:',
      error
    );


    /* Ocultar splash */
    const splash =
      document.getElementById(
        'splash-screen'
      );

    if (splash) {
      splash.style.display =
        'none';
    }


    /* Mostrar login */
    const login =
      document.getElementById(
        'login-screen'
      );

    if (login) {
      login.style.display =
        'flex';
    }

  }

}


/* =========================================================
   ARRANQUE
========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    boot,
    { once: true }
  );

} else {

  boot();

}