// js/modules/ui.js

/* =========================================================
   SERVIX - UI
   Compatible con:
   - index.html actual
   - Detalle Ticket 2026
   - tickets.js sin dividir
   - navegación por vistas
   - tabs/subviews
   - modales
   - dropdowns
   - sidebar responsive
   ========================================================= */


/* =========================================================
   MODALES
   ========================================================= */

export function openModal(id) {

  const modal =
    document.getElementById(id);

  if (!modal) {

    console.warn(
      `openModal: no existe #${id}`
    );

    return;

  }

  modal.classList.add(
    'active'
  );

}


export function closeModal(id) {

  const modal =
    document.getElementById(id);

  if (!modal) {

    console.warn(
      `closeModal: no existe #${id}`
    );

    return;

  }

  modal.classList.remove(
    'active'
  );

}


/* =========================================================
   DROPDOWNS
   ========================================================= */

export function closeDropdowns() {

  const notif =
    document.getElementById(
      'dd-notif'
    );

  const user =
    document.getElementById(
      'dd-user'
    );

  if (notif) {

    notif.classList.remove(
      'open'
    );

  }

  if (user) {

    user.classList.remove(
      'open'
    );

  }

}


/* =========================================================
   LIMPIAR ESTADO VISUAL DEL DETALLE
   ========================================================= */

function exitTicketDetailMode() {

  document.body.classList.remove(
    'ticket-detail-active'
  );

}


/* =========================================================
   ACTIVAR ESTADO VISUAL DEL DETALLE
   ========================================================= */

function enterTicketDetailMode() {

  document.body.classList.add(
    'ticket-detail-active'
  );

}


/* =========================================================
   NAVEGACIÓN PRINCIPAL
   ========================================================= */

export function goView(name) {

  if (!name) {

    console.warn(
      'goView: nombre de vista vacío'
    );

    return;

  }


  /* =======================================================
     TICKET DETAIL MODE
     ======================================================= */

  if (
    name ===
    'ticket-detalle'
  ) {

    enterTicketDetailMode();

  } else {

    exitTicketDetailMode();

  }


  /* =======================================================
     NAVEGACIÓN SIDEBAR
     ======================================================= */

  document
    .querySelectorAll(
      '.nav-item'
    )
    .forEach(
      item => {

        const viewName =
          item.getAttribute(
            'data-view'
          );

        item.classList.toggle(
          'active',
          viewName === name
        );

      }
    );


  /* =======================================================
     CAMBIAR VISTAS
     ======================================================= */

  document
    .querySelectorAll(
      '.view'
    )
    .forEach(
      view => {

        const active =
          view.id ===
          `view-${name}`;

        view.classList.toggle(
          'active',
          active
        );

      }
    );


  /* =======================================================
     DROPDOWNS
     ======================================================= */

  closeDropdowns();


  /* =======================================================
     SIDEBAR RESPONSIVE
     ======================================================= */

  const sidebar =
    document.querySelector(
      '.sidebar'
    );

  const backdrop =
    document.getElementById(
      'sidebar-backdrop'
    );

  if (
    window.innerWidth <= 768 &&
    sidebar &&
    backdrop
  ) {

    sidebar.classList.remove(
      'open'
    );

    backdrop.classList.remove(
      'show'
    );

  }


  /* =======================================================
     SCROLL SUPERIOR
     ======================================================= */

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

}


/* =========================================================
   KANBAN DRAG & DROP
   ========================================================= */

export function wireKanbanDrag(
  board,
  onDrop
) {

  if (!board) {

    console.warn(
      'wireKanbanDrag: board no existe'
    );

    return;

  }


  /* =======================================================
     TARJETAS
     ======================================================= */

  board
    .querySelectorAll(
      '.kanban-card'
    )
    .forEach(
      card => {

        card.addEventListener(
          'dragstart',
          event => {

            card.classList.add(
              'dragging'
            );

            const id =
              card.getAttribute(
                'data-id'
              );

            if (
              event.dataTransfer &&
              id
            ) {

              event.dataTransfer.setData(
                'text/plain',
                id
              );

              event.dataTransfer.effectAllowed =
                'move';

            }

          }
        );


        card.addEventListener(
          'dragend',
          () => {

            card.classList.remove(
              'dragging'
            );

          }
        );

      }
    );


  /* =======================================================
     COLUMNAS
     ======================================================= */

  board
    .querySelectorAll(
      '.kanban-col'
    )
    .forEach(
      column => {

        column.addEventListener(
          'dragover',
          event => {

            event.preventDefault();

            column.classList.add(
              'drag-over'
            );

            if (
              event.dataTransfer
            ) {

              event.dataTransfer.dropEffect =
                'move';

            }

          }
        );


        column.addEventListener(
          'dragleave',
          event => {

            /*
               Evitar falsos dragleave
               al pasar entre elementos
               hijos de la misma columna.
            */

            if (
              !column.contains(
                event.relatedTarget
              )
            ) {

              column.classList.remove(
                'drag-over'
              );

            }

          }
        );


        column.addEventListener(
          'drop',
          event => {

            event.preventDefault();

            column.classList.remove(
              'drag-over'
            );

            let id =
              '';

            if (
              event.dataTransfer
            ) {

              id =
                event.dataTransfer.getData(
                  'text/plain'
                );

            }

            const stage =
              column.getAttribute(
                'data-stage'
              );


            if (
              !id ||
              !stage
            ) {

              return;

            }


            if (
              typeof onDrop ===
              'function'
            ) {

              onDrop(
                id,
                stage
              );

            }

          }
        );

      }
    );

}


/* =========================================================
   TABS / SUBVIEWS
   ========================================================= */

function activateTab(
  tab,
  targetId
) {

  if (!tab) {
    return;
  }

  const group =
    tab.parentElement;

  if (!group) {
    return;
  }


  /* =======================================================
     TABS DEL MISMO GRUPO
     ======================================================= */

  group
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      item => {

        item.classList.remove(
          'active'
        );

      }
    );


  tab.classList.add(
    'active'
  );


  /* =======================================================
     TARGET
     ======================================================= */

  if (!targetId) {
    return;
  }

  const target =
    document.getElementById(
      targetId
    );

  if (!target) {

    console.warn(
      `activateTab: no existe #${targetId}`
    );

    return;

  }


  /* =======================================================
     SUBVIEWS HERMANAS
     ======================================================= */

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
      subview => {

        const isTarget =
          subview.id ===
          targetId;

        subview.classList.toggle(
          'active',
          isTarget
        );

        /*
           Algunos módulos del proyecto
           todavía utilizan display:none
           directamente.
        */

        subview.style.display =
          isTarget
          ? ''
          : 'none';

      }
    );

}


/* =========================================================
   INICIALIZACIÓN UI
   ========================================================= */

export function initUI() {


  /* =======================================================
     MODALES
     =======================================================

     Los modales NO se cierran al hacer clic sobre
     el overlay oscuro.

     Se cierran únicamente mediante sus botones.
     */

  document
    .querySelectorAll(
      '.modal-overlay'
    )
    .forEach(
      overlay => {

        overlay.addEventListener(
          'click',
          event => {

            /*
               Intencionalmente vacío.

               No cerrar modal al hacer clic
               en el fondo.
            */

          }
        );

      }
    );


  /* =======================================================
     NOTIFICACIONES
     ======================================================= */

  const btnNotif =
    document.getElementById(
      'btn-notif'
    );

  if (btnNotif) {

    btnNotif.addEventListener(
      'click',
      event => {

        event.stopPropagation();

        const dropdown =
          document.getElementById(
            'dd-notif'
          );

        if (!dropdown) {
          return;
        }

        const wasOpen =
          dropdown.classList.contains(
            'open'
          );


        closeDropdowns();


        if (!wasOpen) {

          dropdown.classList.add(
            'open'
          );


          if (
            typeof window.renderNotificaciones ===
            'function'
          ) {

            try {

              window.renderNotificaciones();

            } catch (error) {

              console.error(
                'Error renderizando notificaciones:',
                error
              );

            }

          }

        }

      }
    );

  }


  /* =======================================================
     USUARIO
     ======================================================= */

  const btnUser =
    document.getElementById(
      'btn-user'
    );

  if (btnUser) {

    btnUser.addEventListener(
      'click',
      event => {

        event.stopPropagation();

        const dropdown =
          document.getElementById(
            'dd-user'
          );

        if (!dropdown) {
          return;
        }

        const wasOpen =
          dropdown.classList.contains(
            'open'
          );


        closeDropdowns();


        if (!wasOpen) {

          dropdown.classList.add(
            'open'
          );

        }

      }
    );

  }


  /* =======================================================
     CLICK GLOBAL
     ======================================================= */

  document.addEventListener(
    'click',
    event => {

      /*
         Si el clic ocurre dentro de un dropdown,
         no se cierra en ese mismo instante.
      */

      const target =
        event.target;

      const insideDropdown =
        target instanceof Element &&
        target.closest(
          '.dropdown'
        );

      if (
        !insideDropdown
      ) {

        closeDropdowns();

      }

    }
  );


  /* =======================================================
     NAVEGACIÓN SIDEBAR
     ======================================================= */

  document
    .querySelectorAll(
      '.nav-item'
    )
    .forEach(
      item => {

        /*
           Evitar registrar doble listener.
        */

        if (
          item.dataset.uiBound ===
          'true'
        ) {

          return;

        }

        item.dataset.uiBound =
          'true';


        item.addEventListener(
          'click',
          event => {

            /*
               Si ya existe onclick inline,
               dejamos que el onclick haga su
               propia acción.

               Esto evita conflictos con módulos
               antiguos del proyecto.
            */

            const inlineAction =
              item.getAttribute(
                'onclick'
              );

            if (
              inlineAction
            ) {

              return;

            }

            event.preventDefault();

            const view =
              item.getAttribute(
                'data-view'
              );

            if (view) {

              goView(
                view
              );

            }

          }
        );

      }
    );


  /* =======================================================
     TABS
     ======================================================= */

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      tab => {

        if (
          tab.dataset.uiBound ===
          'true'
        ) {

          return;

        }

        tab.dataset.uiBound =
          'true';


        tab.addEventListener(
          'click',
          event => {

            /*
               Si el tab tiene onclick inline,
               no interferimos.

               Esto mantiene compatibles:
                 - Facturación
                 - Créditos
                 - Clientes
                 - otros módulos
            */

            const inlineAction =
              tab.getAttribute(
                'onclick'
              );

            if (
              inlineAction
            ) {

              return;

            }

            event.preventDefault();

            const targetId =
              tab.getAttribute(
                'data-sub'
              );

            if (!targetId) {
              return;
            }

            activateTab(
              tab,
              targetId
            );

          }
        );

      }
    );


  /* =======================================================
     BOTÓN MOBILE
     ======================================================= */

  const menuBtn =
    document.getElementById(
      'mobile-menu-btn'
    );

  const sidebar =
    document.querySelector(
      '.sidebar'
    );

  const backdrop =
    document.getElementById(
      'sidebar-backdrop'
    );


  if (
    menuBtn &&
    sidebar &&
    backdrop
  ) {


    if (
      menuBtn.dataset.uiBound !==
      'true'
    ) {

      menuBtn.dataset.uiBound =
        'true';


      menuBtn.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          sidebar.classList.add(
            'open'
          );

          backdrop.classList.add(
            'show'
          );

        }
      );

    }


    if (
      backdrop.dataset.uiBound !==
      'true'
    ) {

      backdrop.dataset.uiBound =
        'true';


      backdrop.addEventListener(
        'click',
        () => {

          sidebar.classList.remove(
            'open'
          );

          backdrop.classList.remove(
            'show'
          );

        }
      );

    }

  }


  /* =======================================================
     ESC
     ======================================================= */

  if (
    document.body.dataset.uiEscBound !==
    'true'
  ) {

    document.body.dataset.uiEscBound =
      'true';


    document.addEventListener(
      'keydown',
      event => {

        if (
          event.key !==
          'Escape'
        ) {

          return;

        }


        /*
           Cerrar dropdowns.
        */

        closeDropdowns();


        /*
           Cerrar modales activos.
        */

        document
          .querySelectorAll(
            '.modal-overlay.active'
          )
          .forEach(
            modal => {

              modal.classList.remove(
                'active'
              );

            }
          );

      }
    );

  }


  /* =======================================================
     ESTADO INICIAL
     ======================================================= */

  /*
     Si por alguna razón la página arranca
     mostrando Detalle Ticket, sincronizamos
     el body con la vista activa.
  */

  const detailView =
    document.getElementById(
      'view-ticket-detalle'
    );

  if (
    detailView &&
    detailView.classList.contains(
      'active'
    )
  ) {

    enterTicketDetailMode();

  } else {

    exitTicketDetailMode();

  }

}