// js/modules/ui.js

export function openModal(id){ document.getElementById(id).classList.add('active'); }
export function closeModal(id){ document.getElementById(id).classList.remove('active'); }

export function closeDropdowns(){ 
  document.getElementById('dd-notif').classList.remove('open'); 
  document.getElementById('dd-user').classList.remove('open'); 
}

export function goView(name){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active', i.getAttribute('data-view')===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
  closeDropdowns();
  
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if(window.innerWidth <= 768 && sidebar && backdrop) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
  }
}

export function initUI() {
  // Cerrar modales al hacer clic afuera
  document.querySelectorAll('.modal-overlay').forEach(ov=>{
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('active'); });
  });

  // Eventos de Dropdowns
  document.getElementById('btn-notif').addEventListener('click', e=>{ 
      e.stopPropagation(); 
      const dd = document.getElementById('dd-notif'); 
      const wasOpen = dd.classList.contains('open'); 
      closeDropdowns(); 
      if(!wasOpen) dd.classList.add('open'); 
  });
  
  document.getElementById('btn-user').addEventListener('click', e=>{ 
      e.stopPropagation(); 
      const dd = document.getElementById('dd-user'); 
      const wasOpen = dd.classList.contains('open'); 
      closeDropdowns(); 
      if(!wasOpen) dd.classList.add('open'); 
  });
  document.addEventListener('click', closeDropdowns);

  // Navegación lateral
  document.querySelectorAll('.nav-item').forEach(it=>{ 
      it.addEventListener('click', ()=>goView(it.getAttribute('data-view'))); 
  });

  // Sub-pestañas genéricas
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      if(tab.getAttribute('onclick')) return;
      const group = tab.parentElement;
      group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-sub');
      const target = document.getElementById(targetId);
      if(!target) return;
      const siblingsContainer = target.parentElement;
      siblingsContainer.querySelectorAll('.subview').forEach(sv=>{ sv.style.display = sv.id===targetId ? '' : 'none'; });
    });
  });

  // Menú hamburguesa móvil
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if(menuBtn && sidebar && backdrop) {
    menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('show'); });
    backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); });
  }
}