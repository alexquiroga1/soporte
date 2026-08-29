// js/modules/crm.js
import { DATA, saveToLocal, CRM_STAGES } from '../core/store.js';
import { fmt, toast } from '../core/utils.js';
import { closeModal, wireKanbanDrag } from './ui.js';

export function crmStageInfo(key) { return CRM_STAGES.find(s=>s.key===key); }

export function renderCRMKanban(){
  const board = document.getElementById('crm-kanban');
  if(!board) return;
  board.innerHTML = CRM_STAGES.map(s=>{
    const items = DATA.crm.filter(o=>o.stage===s.key);
    const cards = items.map(o=>`
      <div class="kanban-card" draggable="true" data-id="${o.contacto}|${o.empresa}">
        <b>${o.contacto}</b><div class="kc-sub">${o.empresa}</div>
        <div class="kc-sub" style="margin-top:4px;">${o.interes}</div>
        <div class="kc-foot"><span class="kc-val">${fmt(o.valor)}</span><span>${o.fecha}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}">
      <div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>
      ${cards}
    </div>`;
  }).join('');
  
  wireKanbanDrag(board, (idKey, newStage)=>{
    const [contacto, empresa] = idKey.split('|');
    const o = DATA.crm.find(x=>x.contacto===contacto && x.empresa===empresa);
    if(o && o.stage!==newStage){
      o.stage = newStage;
      saveToLocal();
      renderCRMKanban();
      toast('Oportunidad movida a "'+crmStageInfo(newStage).label+'"');
    }
  });
  const total = DATA.crm.filter(o=>o.stage!=='perdido').reduce((s,o)=>s+o.valor,0);
  const totalEl = document.getElementById('crm-total');
  if(totalEl) totalEl.textContent = fmt(total) + ' en pipeline activo';
}

// ¡ESTA ES LA FUNCIÓN QUE FALTABA O NO SE EXPORTÓ BIEN!
export function createOportunidad(){
  const contacto = document.getElementById('no-contacto').value.trim();
  const empresa = document.getElementById('no-empresa').value.trim() || '—';
  const interes = document.getElementById('no-interes').value.trim();
  const valor = parseFloat(document.getElementById('no-valor').value) || 0;
  const fecha = document.getElementById('no-fecha').value.trim() || 'Sin fecha';
  
  if(!contacto || !interes){ toast('Completa contacto e interés'); return; }
  
  DATA.crm.unshift({contacto, empresa, interes, valor, fecha, stage:'prospecto'});
  saveToLocal();
  
  ['no-contacto','no-empresa','no-interes','no-valor','no-fecha'].forEach(id=>document.getElementById(id).value='');
  closeModal('modal-nueva-oportunidad');
  renderCRMKanban();
  toast('Oportunidad creada');
}