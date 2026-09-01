// js/core/auth.js
import { initials, toast } from './utils.js';

export let currentUserProfile = null;

// Observador de sesión (Actualizado para la Fase 1 de Seguridad)
export function initAuth(authInstance, dbInstance, onAppReady) {
  authInstance.onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    if (user) {
      try {
        // Buscamos el perfil real en Firebase antes de cargar la base de datos
        const userQuery = await dbInstance.collection('usuarios').where('email', '==', user.email).get();
        
        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          currentUserProfile = { id: userDoc.id, ...userDoc.data() };
        } else {
          toast("Tu usuario no tiene permisos configurados en la base de datos.");
          authInstance.signOut();
          return;
        }

        const uName = currentUserProfile.nombre;
        const uRole = currentUserProfile.rol;
        
        document.getElementById('sidebar-avatar').textContent = initials(uName);
        document.getElementById('sidebar-user-name').textContent = uName;
        document.getElementById('sidebar-user-role').textContent = uRole;
        
        const btnUser = document.getElementById('btn-user');
        if(btnUser) btnUser.textContent = initials(uName);
        
        toast(`Bienvenido, ${uName.split(' ')[0]}`);
        
        // RECIÉN AHORA disparamos la carga de la base de datos
        if(typeof onAppReady === 'function') onAppReady();

        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        
      } catch (error) {
        console.error("Error al validar perfil de seguridad:", error);
        toast('Hubo un problema de conexión con el servidor.');
      }
    } else {
      // Usuario deslogueado
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
      currentUserProfile = null;
    }
  });
}

// Función que aplica la seguridad visual basada en roles reales
export function aplicarPermisosEnUI(rolesList) {
    if(!currentUserProfile) return;
    
    const roleObj = rolesList.find(r => r.nombre === currentUserProfile.rol);
    const perms = roleObj ? roleObj.permisos : [];
    const isAdmin = perms.includes('Acceso total al sistema');

    const setAcceso = (view, condition) => {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) btn.style.display = (isAdmin || condition) ? 'flex' : 'none';
    };

    setAcceso('dashboard', true);
    setAcceso('clientes', true);
    setAcceso('crm', true);
    setAcceso('tickets', perms.includes('Ver y actualizar tickets asignados'));
    setAcceso('ventas', perms.includes('Registrar ventas y cobros'));
    setAcceso('caja', perms.includes('Abrir y cerrar corte de caja') || perms.includes('Registrar ventas y cobros'));
    setAcceso('creditos', perms.includes('Aprobar créditos y descuentos'));
    setAcceso('productos', perms.includes('Editar catálogo de productos') || perms.includes('Registrar ventas y cobros'));
    setAcceso('erp', perms.includes('Ver reportes financieros'));
    setAcceso('reportes', perms.includes('Ver reportes financieros'));
    setAcceso('config', perms.includes('Gestionar usuarios y roles'));
}

export function doLogin(authInstance) {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  if(!email || !pass) { toast('Completa tus datos'); return; }
  
  const btn = document.querySelector('.login-btn');
  const btnText = btn.textContent;
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  authInstance.signInWithEmailAndPassword(email, pass)
    .then(() => {
        btn.textContent = btnText;
        btn.disabled = false;
        document.getElementById('login-pass').value = '';
    })
    .catch((error) => {
        btn.textContent = btnText;
        btn.disabled = false;
        toast('Error: Verifica tu correo y contraseña');
        console.error(error);
    });
}

export function doLogout(authInstance, closeDropdownsCallback) {
  authInstance.signOut().then(() => {
    if(closeDropdownsCallback) closeDropdownsCallback();
    window.location.reload(); 
  }).catch((error) => {
    toast('No se pudo cerrar la sesión');
  });
}