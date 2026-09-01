// js/modules/crm.js
import { DATA, CRM_STAGES } from '../core/store.js';
import { fmt, toast } from '../core/utils.js';
import { closeModal, wireKanbanDrag } from './ui.js';

export function crmStageInfo(key) { return CRM_STAGES.find(s=>s.key===key); }

export function renderCRMKanban(){
  const board = document.getElementById('crm-kanban');
  if(!board) return;
  board.innerHTML = CRM_STAGES.map(s=>{
    const items = DATA.crm.filter(o=>o.stage===s.key);
    const cards = items.map(o=>`
      <div class="kanban-card" draggable="true" data-id="${o.id}">
        <b>${o.contacto}</b><div class="kc-sub">${o.empresa}</div>
        <div class="kc-sub" style="margin-top:4px;">${o.interes}</div>
        <div class="kc-foot"><span class="kc-val">${fmt(o.valor)}</span><span>${o.fecha}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}">
      <div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>
      ${cards}
    </div>`;
  }).join('');
  
  wireKanbanDrag(board, async (id, newStage)=>{
    const o = DATA.crm.find(x=>x.id===id);
    if(o && o.stage !== newStage){
      try {
          await window.db.collection('crm').doc(id).update({ stage: newStage });
          toast('Oportunidad movida a "'+crmStageInfo(newStage).label+'"');
      } catch (error) {
          console.error("Error al mover en CRM", error);
          toast("Error actualizando CRM");
      }
    }
  });
  const total = DATA.crm.filter(o=>o.stage!=='perdido').reduce((s,o)=>s+o.valor,0);
  const totalEl = document.getElementById('crm-total');
  if(totalEl) totalEl.textContent = fmt(total) + ' en pipeline activo';
}

// NUEVO: Creación Atómica con ID real en Firestore
export async function createOportunidad(){
  const contacto = document.getElementById('no-contacto').value.trim();
  const empresa = document.getElementById('no-empresa').value.trim() || '—';
  const interes = document.getElementById('no-interes').value.trim();
  const valor = parseFloat(document.getElementById('no-valor').value) || 0;
  const fecha = document.getElementById('no-fecha').value.trim() || 'Sin fecha';
  
  if(!contacto || !interes){ toast('Completa contacto e interés'); return; }
  
  try {
      const docRef = window.db.collection('crm').doc();
      const opp = { id: docRef.id, contacto, empresa, interes, valor, fecha, stage:'prospecto' };
      
      await docRef.set(opp);
      
      ['no-contacto','no-empresa','no-interes','no-valor','no-fecha'].forEach(id=>document.getElementById(id).value='');
      closeModal('modal-nueva-oportunidad');
      toast('Oportunidad CRM creada');
  } catch (error) {
      console.error("Error creando CRM", error);
      toast('No se pudo guardar la oportunidad');
  }
}