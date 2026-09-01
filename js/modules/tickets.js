// js/modules/tickets.js
import { DATA, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal, wireKanbanDrag } from './ui.js';
import { currentUserProfile } from '../core/auth.js';

let currentTicketId = null;

export const stageInfo = key => TICKET_STAGES.find(s=>s.key===key);

export function onClientSearchInput(){
  const q = document.getElementById('nt-cliente-input').value.toLowerCase().trim();
  const box = document.getElementById('nt-client-suggestions');
  if(!q){ box.style.display='none'; return; }

  const match = DATA.clientes.filter(c => {
    const full = getFullName(c);
    return full.toLowerCase().includes(q) || c.tel.includes(q);
  });
  
  if(match.length > 0){
    box.style.display = 'block';
    box.innerHTML = match.map(c => `
      <div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--line); font-size:13px;" onclick="selectClientForTicket('${c.id}', '${getFullName(c)}')">
        <b>${getFullName(c)}</b> <span style="color:var(--muted); font-size:11px;">(${c.tel})</span>
      </div>
    `).join('');
  } else {
    box.style.display = 'block';
    box.innerHTML = `
      <div style="padding:10px 12px; font-size:12.5px; color:var(--muted);">
        No encontrado. <span style="color:var(--copper); font-weight:600; cursor:pointer;" onclick="openModal('modal-nuevo-cliente'); document.getElementById('nt-client-suggestions').style.display='none';">¿Crear nuevo cliente?</span>
      </div>
    `;
  }
}

export function selectClientForTicket(id, nombre){
  document.getElementById('nt-cliente-id').value = id;
  document.getElementById('nt-cliente-input').value = nombre;
  document.getElementById('nt-client-suggestions').style.display = 'none';
}

export function populateTecnicos() {
    const selFilter = document.getElementById('tk-filter-tecnico');
    const selNew = document.getElementById('nt-tecnico');
    const tecnicos = DATA.usuarios.filter(u => u.activo);
    const options = tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
    
    if(selFilter) selFilter.innerHTML = '<option value="">Todos los técnicos</option><option value="Sin asignar">Sin asignar</option>' + options;
    if(selNew) selNew.innerHTML = '<option value="Sin asignar">Sin asignar</option>' + options;
}

export function renderTicketsTable(){
  populateTecnicos();
  const q = (document.getElementById('tk-search').value || '').toLowerCase();
  const fEstado = document.getElementById('tk-filter-estado').value;
  const fPrio = document.getElementById('tk-filter-prio').value;
  const fTecnico = document.getElementById('tk-filter-tecnico').value;

  const rows = DATA.tickets.filter(t=>{
    const matchQ = !q || t.cliente.toLowerCase().includes(q) || t.equipo.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    const matchE = !fEstado || t.stage===fEstado;
    const matchP = !fPrio || t.prioridad===fPrio;
    const matchT = !fTecnico || t.tecnico===fTecnico;
    return matchQ && matchE && matchP && matchT;
  });

  document.getElementById('tickets-table-body').innerHTML = rows.map(t=>{
    const st = stageInfo(t.stage);
    const presupText = t.presupuestoFijado 
        ? `<span style="color:var(--teal); font-family:'IBM Plex Mono',monospace; font-weight:700;">${fmt(t.presupuestoEstimado)}</span>` 
        : `<span style="color:var(--amber); font-size:10.5px; font-weight:700;">PENDIENTE</span>`;
        
    return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')">
      <td><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></td>
      <td class="mono">#${t.id}</td>
      <td>${t.cliente}</td>
      <td>${t.equipo}</td>
      <td class="mono">${t.ingreso}</td>
      <td>${presupText}</td>
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td>${t.tecnico}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openTicketModal('${t.id}')" title="Consultar detalle" style="padding:4px 8px; margin-right:4px;">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="printTicket('${t.id}')" title="Imprimir / Exportar PDF" style="padding:4px 8px;">🖨️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:26px;">No hay tickets con estos filtros.</td></tr>';

  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado').length;
  document.getElementById('tickets-meta').textContent = DATA.tickets.length + ' TOTALES · ' + abiertos + ' ABIERTOS';
  document.getElementById('badge-tickets').textContent = abiertos;
}

export function printTicket(id){
  const t = DATA.tickets.find(x => x.id === id);
  if(!t) return;
  const total = (t.piezas || []).reduce((acc, p) => acc + (p.costo * p.cant), 0);
  const negNombre = DATA.negocio ? DATA.negocio.nombre : 'EMPRESA';
  
  const win = window.open('', '', 'width=800,height=700');
  win.document.write(`
    <html>
    <head>
      <title>Orden de Servicio #${t.id}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 30px; color: #171A21; background: #fff; }
        h2 { margin-bottom: 2px; color: #12151C; }
        .mono { font-family: monospace; color: #8891A3; font-size: 13px; }
        .box { border: 1px solid #E4E6EC; padding: 16px; border-radius: 8px; margin: 16px 0; background: #FAFBFC; }
        .box p { margin: 6px 0; font-size: 13.5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #E4E6EC; padding: 10px; text-align: left; font-size: 13px; }
        th { background: #F3F4F7; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
        .total-section { text-align: right; margin-top: 15px; font-size: 16px; font-weight: bold; color: #FF6A3D; font-family: monospace; }
        .footer-note { margin-top: 40px; font-size: 11px; color: #8891A3; text-align: center; border-top: 1px dashed #E4E6EC; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h2>${negNombre} · Orden de Servicio #${t.id}</h2>
      <div class="mono">Fecha de ingreso: ${t.ingreso} · Prioridad: ${t.prioridad} · Presupuesto: ${t.presupuestoFijado ? 'APROBADO' : 'PENDIENTE'}</div>
      <div class="box">
        <p><b>Cliente:</b> ${t.cliente}</p><p><b>Equipo:</b> ${t.equipo}</p><p><b>Accesorios recibidos:</b> ${t.accesorios || 'Ninguno'}</p>
        <p><b>Condición física:</b> ${t.condicion || 'Sin registrar'}</p><p><b>Falla reportada:</b> ${t.falla}</p><p><b>Diagnóstico técnico:</b> ${t.diagnostico || 'Pendiente'}</p>
        <p><b>Presupuesto Estimado Cotizado:</b> ${fmt(t.presupuestoEstimado || 0)}</p>
      </div>
      <h3>Repuestos / Servicios aplicados</h3>
      <table>
        <thead><tr><th>Artículo</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${(t.piezas || []).length ? (t.piezas || []).map(p => `<tr><td>${p.nombre}</td><td>${p.cant}</td><td>$${(p.costo * p.cant).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:#8891A3;">Sin repuestos registrados</td></tr>'}
        </tbody>
      </table>
      <div class="total-section">Costo Final a Pagar: $${total.toFixed(2)}</div>
      <div class="footer-note">Presentar este comprobante al momento de retirar su equipo. Firma de conformidad: ___________________________</div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}

export function renderTicketsKanban(){
  const board = document.getElementById('tickets-kanban');
  if(!board) return;
  board.innerHTML = TICKET_STAGES.map(s=>{
    const items = DATA.tickets.filter(t=>t.stage===s.key);
    const cards = items.map(t=>`
      <div class="kanban-card" draggable="true" data-id="${t.id}" onclick="openTicketModal('${t.id}')">
        <div class="kc-top"><span class="kc-id">#${t.id}</span><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></div>
        <b>${t.cliente}</b><div class="kc-sub">${t.equipo}</div>
        <div class="kc-foot"><span>${t.tecnico}</span><span>${t.ingreso}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}">
        <div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>
        ${cards}
      </div>`;
  }).join('');
  
  wireKanbanDrag(board, (id, newStage)=>{
    changeTicketStageAt(id, newStage);
  });
}

// NUEVO: Movimiento de estado Kanban (Atómico)
export async function changeTicketStageAt(id, newStage) {
    const t = DATA.tickets.find(x=>x.id===id);
    if(t && t.stage !== newStage){
        const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
        const logEntry = {
            estado: stageInfo(newStage).label, 
            fecha: fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), 
            autor: user
        };

        try {
            await window.db.collection('tickets').doc(id).update({
                stage: newStage,
                historial: window.firebase.firestore.FieldValue.arrayUnion(logEntry)
            });
            toast('Ticket #'+id+' movido a "'+stageInfo(newStage).label+'"');
        } catch(error) {
            console.error("Error al mover ticket", error);
            toast("No se pudo actualizar el estado.");
        }
    }
}

export function openTicketModal(id){
  const t = DATA.tickets.find(x=>x.id===id);
  if(!t) return;
  currentTicketId = id;
  document.getElementById('mt-id').textContent = '#'+t.id;
  document.getElementById('mt-ingreso').textContent = 'Ingresó el ' + t.ingreso;
  document.getElementById('mt-cliente').textContent = t.cliente;
  document.getElementById('mt-equipo').textContent = t.equipo;
  document.getElementById('mt-accesorios').textContent = t.accesorios || 'Ninguno';
  document.getElementById('mt-condicion').textContent = t.condicion || 'Sin registrar';
  document.getElementById('mt-prioridad').innerHTML = `<span class="badge ${t.prioridad.toLowerCase()}">${t.prioridad}</span>`;
  document.getElementById('mt-tecnico').innerHTML = `<span style="background:var(--ink); color:#fff; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:9px; font-weight:bold; margin-right:6px;">${initials(t.tecnico)}</span> ${t.tecnico}`;
  document.getElementById('mt-falla').textContent = t.falla;
  document.getElementById('mt-estado-select').value = t.stage;
  document.getElementById('mt-diagnostico-input').value = t.diagnostico || '';
  
  const stagesKeys = ['pendiente', 'diagnostico', 'reparacion', 'repuesto', 'listo'];
  let reachedCurrent = false;
  document.querySelectorAll('#mt-stepper .step-sm').forEach(el => {
    const stepKey = el.getAttribute('data-step');
    el.className = 'step-sm'; 
    if(t.stage === 'entregado') { el.classList.add('completed'); return; }
    if(stepKey === t.stage) { el.classList.add('active'); reachedCurrent = true; }
    else if (!reachedCurrent) { el.classList.add('completed'); }
  });

  if(!t.presupuestoFijado) t.presupuestoFijado = false;
  document.getElementById('input-presupuesto').value = t.presupuestoEstimado || '';
  if(t.presupuestoFijado) {
    document.getElementById('txt-presupuesto-fijado').textContent = fmt(t.presupuestoEstimado);
    document.getElementById('view-edit-budget').style.display = 'none';
    document.getElementById('view-locked-budget').style.display = 'block';
  } else {
    document.getElementById('view-locked-budget').style.display = 'none';
    document.getElementById('view-edit-budget').style.display = 'flex';
  }
  
  populateRepuestosSelect();
  renderTicketPiezas(t);
  checkBillingButtonVisibility(t);
  renderTicketNotas(t);
  
  if(window.goView) window.goView('ticket-detalle');
}

// NUEVO: Fijar y desbloquear presupuesto atómicamente
export async function fijarPresupuesto() {
  const val = parseFloat(document.getElementById('input-presupuesto').value);
  if(!val || val <= 0) { toast('Ingresa un monto válido'); return; }
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({
          presupuestoEstimado: val,
          presupuestoFijado: true
      });
      document.getElementById('txt-presupuesto-fijado').textContent = fmt(val);
      document.getElementById('view-edit-budget').style.display = 'none';
      document.getElementById('view-locked-budget').style.display = 'block';
      toast('Presupuesto fijado exitosamente');
  } catch(e) {
      toast('Error al fijar presupuesto');
  }
}

export async function desbloquearPresupuesto() {
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ presupuestoFijado: false });
      document.getElementById('view-locked-budget').style.display = 'none';
      document.getElementById('view-edit-budget').style.display = 'flex';
  } catch(e) { toast('Error al desbloquear'); }
}

// NUEVO: Envío Real de WhatsApp API (Punto 10)
export function sendWhatsAppNotice(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  const cli = DATA.clientes.find(c => c.id === t.clienteId || getFullName(c) === t.cliente);
  
  if(!cli || !cli.tel || cli.tel === '—') { 
      alert('⚠️ El cliente no tiene un número de teléfono registrado.'); 
      return; 
  }
  
  // Limpiamos el número de espacios, guiones y agregamos +549 si es de Argentina y no lo tiene
  let phone = cli.tel.replace(/\D/g, '');
  if (!phone.startsWith('54') && phone.length === 10) { 
      phone = '549' + phone; 
  }
  
  const empresa = DATA.negocio?.nombre || 'nuestro servicio técnico';
  const estadoStr = stageInfo(t.stage).label;
  
  const msg = `Hola ${t.cliente}, te escribimos de *${empresa}*.\n\nTe informamos que tu equipo *${t.equipo}* (Ticket #${t.id}) se encuentra actualmente en estado: *${estadoStr}*.\n\nCualquier consulta estamos a tu disposición.`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  
  window.open(url, '_blank');
  toast(`Abriendo WhatsApp...`);
}

export function checkBillingButtonVisibility(t){
  const btn = document.getElementById('btn-facturar-ticket');
  if(t.stage === 'listo'){
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

// NUEVO: Guardar Diagnóstico atómicamente
export async function saveDiagnostico(){
  const diagnostico = document.getElementById('mt-diagnostico-input').value.trim();
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ diagnostico });
      toast('Diagnóstico guardado con éxito');
  } catch(e) { toast('Error al guardar diagnóstico'); }
}

export function populateRepuestosSelect(){
  const sel = document.getElementById('mt-repuesto-select');
  if (!sel) return;
  
  if (!DATA.productos || DATA.productos.length === 0) {
      sel.innerHTML = '<option value="">(Catálogo vacío)</option>';
      return;
  }
  sel.innerHTML = '<option value="">Selecciona repuesto...</option>' + 
                  DATA.productos.map(p => `<option value="${p.sku}">${p.nombre} (${fmt(p.precio)})</option>`).join('');
}

export function renderTicketPiezas(t){
  if(!t.piezas) t.piezas = [];
  document.getElementById('mt-piezas').innerHTML = t.piezas.length ? t.piezas.map((p, idx)=>`
    <tr>
      <td style="padding:6px;">${p.nombre}</td>
      <td style="padding:6px;"><b>${p.cant}</b></td>
      <td style="padding:6px;">
        <input type="number" class="inp" style="width:70px; padding:4px; font-family:var(--font-mono); font-size:11px;" 
               value="${p.costo}" onchange="updatePiezaPrice(${idx}, this.value)">
      </td>
      <td style="text-align: right; padding:6px;"><button class="btn btn-ghost btn-sm" onclick="removePiezaFromTicket(${idx})" style="color:var(--red); padding:2px 6px; border:none; background:transparent;">✕</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--muted); text-align:center; padding:10px;">Sin repuestos.</td></tr>';

  const total = t.piezas.reduce((acc, p) => acc + (p.costo * p.cant), 0);
  document.getElementById('mt-total-costo').textContent = fmt(total);
}

// NUEVO: Mutación de Array de Piezas en Firestore
export async function updatePiezaPrice(idx, newPrice) {
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const val = parseFloat(newPrice);
  if(isNaN(val) || val < 0) return;
  
  const nuevasPiezas = [...t.piezas];
  nuevasPiezas[idx].costo = val;
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
      toast('Costo actualizado');
  } catch(e) { toast('Error actualizando costo'); }
}

export async function addPiezaToTicket(){
  const sku = document.getElementById('mt-repuesto-select').value;
  if(!sku) { toast('Selecciona un repuesto válido'); return; }
  
  const prod = DATA.productos.find(p => p.sku === sku);
  if(!prod) return;

  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const nuevasPiezas = [...(t.piezas || [])];
  
  const existing = nuevasPiezas.find(p => (p.sku && p.sku === prod.sku) || (!p.sku && p.nombre === prod.nombre));
  if(existing){
    existing.cant++;
    existing.sku = existing.sku || prod.sku;
  } else {
    nuevasPiezas.push({ sku: prod.sku, nombre: prod.nombre, cant: 1, costo: prod.precio });
  }
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
      document.getElementById('mt-repuesto-select').value = '';
      toast('Artículo añadido al ticket');
  } catch(e) { toast('Error añadiendo pieza'); }
}

export async function removePiezaFromTicket(idx){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const nuevasPiezas = [...t.piezas];
  nuevasPiezas.splice(idx, 1);
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
  } catch(e) { toast('Error eliminando repuesto'); }
}

// NUEVO: Envío a Caja de forma Atómica a la nueva colección
export async function enviarAFacturacion(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  
  const total = (t.piezas || []).reduce((acc, p) => acc + (p.costo * p.cant), 0);
  if(total <= 0){ 
      alert('ATENCIÓN: Debes agregar al menos un repuesto o servicio antes de enviarlo a Caja.'); 
      return; 
  }

  // Verificamos si ya existe en la cola (Ahora leyendo de la colección real DATA.cajaPendientes u object)
  // Nota: store.js debe escuchar 'caja_pendientes' en la Fase 1
  const yaExiste = (DATA.caja_pendientes || []).some(p => p.ref === t.id);
  if(yaExiste){ 
      alert('Este ticket ya fue enviado a facturación previamente.'); 
      return; 
  }

  const cobroPendiente = {
    origen: 'Ticket', 
    ref: t.id, 
    clienteId: t.clienteId || null, 
    cliente: t.cliente,
    concepto: t.piezas.map(p => `${p.cant}x ${p.nombre}`).join(', '),
    total: total,
    articulosCart: t.piezas.map(p => ({
      sku: p.sku || null,
      nombre: p.nombre,
      cantidad: Number(p.cant) || 0,
      precio: Number(p.costo) || 0
    }))
  };

  try {
      await window.db.collection('caja_pendientes').add(cobroPendiente);
      if(window.goView) window.goView('caja'); 
      toast('Enviado a CAJA para su cobro.');
  } catch(error) {
      console.error(error);
      toast('Error al enviar a caja');
  }
}

export function renderTicketNotas(t){
  document.getElementById('mt-notas').innerHTML = t.notas.length ? t.notas.map(n=>`
    <div style="background:var(--bg); padding:10px; border-radius:8px; border-left:3px solid var(--copper);">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;"><b>${n.autor}</b> <span style="color:var(--muted);">${n.fecha}</span></div>
      <div style="font-size:12px; word-break: break-word; white-space: pre-wrap;">${n.texto}</div>
    </div>
  `).join('') : '<div style="color:var(--muted);font-size:11px;text-align:center;padding:10px;">Sin notas.</div>';
}

// NUEVO: ArrayUnion para Notas (Punto 13 / Trazabilidad)
export async function addTicketNota(){
  const input = document.getElementById('mt-nota-input');
  const texto = input.value.trim();
  if(!texto) return;
  const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
  const fechaStr = fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  
  const nuevaNota = { autor: user, fecha: fechaStr, texto };
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({
          notas: window.firebase.firestore.FieldValue.arrayUnion(nuevaNota)
      });
      input.value = '';
      toast('Nota agregada al ticket');
  } catch(e) { toast('Error guardando nota'); }
}

export function changeTicketStage(){
  const newStage = document.getElementById('mt-estado-select').value;
  changeTicketStageAt(currentTicketId, newStage);
}

// NUEVO: Creación de Ticket mediante Transacción Atómica (Garantiza números únicos)
export async function createTicket(){
  const clienteId = document.getElementById('nt-cliente-id').value;
  const clienteInputVal = document.getElementById('nt-cliente-input').value.trim();
  const cliente = clienteId ? DATA.clientes.find(c=>c.id===clienteId) : null;
  const clienteNombre = cliente ? getFullName(cliente) : (clienteInputVal || 'Mostrador');

  const equipo = document.getElementById('nt-equipo').value.trim();
  const accesorios = document.getElementById('nt-accesorios').value.trim();
  const condicion = document.getElementById('nt-condicion').value.trim();
  const falla = document.getElementById('nt-falla').value.trim();
  
  if(!equipo || !falla){ toast('Completa equipo y falla'); return; }
  
  const user = currentUserProfile ? currentUserProfile.nombre : 'Mostrador';
  const fechaIngreso = fDate(new Date().toISOString().split('T')[0]);
  
  try {
      let nuevoNumero;
      const contadoresRef = window.db.collection('negocio').doc('contadores');
      
      // Transacción para obtener y aumentar el número de ticket de forma totalmente segura
      await window.db.runTransaction(async (transaction) => {
          const doc = await transaction.get(contadoresRef);
          if (!doc.exists) {
              nuevoNumero = 1000;
              transaction.set(contadoresRef, { tickets: 1001, ventas: 1000 });
          } else {
              nuevoNumero = doc.data().tickets || 1000;
              transaction.update(contadoresRef, { tickets: nuevoNumero + 1 });
          }
      });

      const id = 'TK-' + nuevoNumero;
      const t = {
        id, clienteId: cliente ? cliente.id : null, cliente: clienteNombre,
        equipo, accesorios, condicion, 
        presupuestoFijado: false, presupuestoEstimado: 0,
        falla, prioridad: document.getElementById('nt-prioridad').value, stage:'pendiente',
        tecnico: document.getElementById('nt-tecnico').value, ingreso: fechaIngreso,
        diagnostico:'Pendiente de revisión inicial.', piezas:[],
        historial:[{estado:'Recibido', fecha:fechaIngreso + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), autor:user}], notas:[]
      };

      await window.db.collection('tickets').doc(id).set(t);

      document.getElementById('nt-equipo').value=''; 
      document.getElementById('nt-accesorios').value='';
      document.getElementById('nt-condicion').value='';
      document.getElementById('nt-falla').value='';
      document.getElementById('nt-cliente-input').value='';
      document.getElementById('nt-cliente-id').value='';
      closeModal('modal-nuevo-ticket');
      
      toast('Ticket #'+id+' creado exitosamente');

  } catch (error) {
      console.error("Error en transacción de ticket:", error);
      toast('Ocurrió un error al crear el ticket.');
  }
}
// Función para eliminar tickets con código de seguridad
export async function eliminarTicketConCodigo() {
    if (!currentTicketId) return;
    
    // 1. Pedimos el código secreto
    const codigo = prompt("🔒 ACCIÓN PROTEGIDA\nPara eliminar este ticket de forma permanente, ingresa el código secreto:");
    
    // Si cancela la ventana
    if (codigo === null) return; 
    
    // 2. Verificamos si el código es correcto
    if (codigo === "780923") {
        // Doble confirmación por seguridad
        const confirmacion = confirm("⚠️ ¿Estás 100% seguro? Esta acción borrará el ticket para siempre y no se puede deshacer.");
        
        if (confirmacion) {
            try {
                // Borramos de Firebase
                await window.db.collection('tickets').doc(currentTicketId).delete();
                toast('✅ Ticket eliminado correctamente');
                
                // Volvemos a la lista de tickets
                if (window.goView) window.goView('tickets');
            } catch (error) {
                console.error("Error borrando ticket:", error);
                toast('❌ Error al eliminar el ticket');
            }
        }
    } else {
        alert("❌ Código incorrecto. Operación cancelada.");
    }
}