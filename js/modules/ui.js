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

export function wireKanbanDrag(board, onDrop){
  board.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart', e=>{ card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.getAttribute('data-id')); });
    card.addEventListener('dragend', ()=> card.classList.remove('dragging'));
  });
  board.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', ()=> col.classList.remove('drag-over'));
    col.addEventListener('drop', e=>{
      e.preventDefault(); col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      onDrop(id, col.getAttribute('data-stage'));
    });
  });
}

export function initUI() {
  // FIX: Se bloquea el cierre del modal al hacer clic afuera (fondo oscuro).
  // El usuario DEBE usar los botones de "Cancelar" o la "X".
  document.querySelectorAll('.modal-overlay').forEach(ov=>{
    ov.addEventListener('click', e=>{ 
        // if(e.target===ov) ov.classList.remove('active'); // Línea comentada para evitar cierre accidental
    });
  });

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

  document.querySelectorAll('.nav-item').forEach(it=>{ 
      it.addEventListener('click', ()=>goView(it.getAttribute('data-view'))); 
  });

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

  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if(menuBtn && sidebar && backdrop) {
    menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('show'); });
    backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); });
  }
}