// js/modules/caja.js
import { DATA, saveToLocal } from '../core/store.js';
import { fmt, fDate, addDays, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';

let selectedCobroMetodo = 'Efectivo';
let currentCobroIdx = null;
let currentCreditIdx = null;

// ==========================================
// SECCIÓN: CAJA Y PASARELA DE COBRO
// ==========================================
export function renderCajaPendientes(){
  const container = document.getElementById('caja-pendientes-body');
  if(!container) return;
  container.innerHTML = DATA.cajaPendientes.length ? DATA.cajaPendientes.map((p, idx)=>`
    <tr>
      <td><span class="badge ${p.origen==='Ticket'?'prog':'done'}">${p.origen}</span></td>
      <td class="mono">#${p.ref}</td>
      <td><b>${p.cliente}</b></td>
      <td>${p.concepto}</td>
      <td class="mono">${fmt(p.total)}</td>
      <td><button class="btn btn-primary btn-sm" onclick="abrirModalCobro(${idx})">Cobrar</button></td>
    </tr>
  `).join('') : '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:16px;">No hay facturaciones pendientes de cobro.</td></tr>';
}

export function abrirModalCobro(idx){
  currentCobroIdx = idx;
  const item = DATA.cajaPendientes[idx];
  
  let clienteTel = '—';
  if(item.clienteId){
    const cli = DATA.clientes.find(c => c.id === item.clienteId);
    if(cli) clienteTel = cli.tel;
  } else {
    const cli = DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    if(cli) clienteTel = cli.tel;
  }

  document.getElementById('mcc-referencia').textContent = (item.origen === 'Ticket' ? 'Ticket #' : 'Venta ') + item.ref;
  document.getElementById('mcc-cliente').textContent = item.cliente;
  document.getElementById('mcc-tel').textContent = clienteTel;
  document.getElementById('mcc-concepto').textContent = item.concepto;
  document.getElementById('mcc-total').textContent = fmt(item.total);

  selectedCobroMetodo = 'Efectivo';
  document.querySelectorAll('#mcc-metodos-pago .pay-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.textContent === 'Efectivo');
  });

  renderCobroDynamicFields();
  openModal('modal-cobro-caja');
}

export function setCobroMetodo(el, metodo){
  document.querySelectorAll('#mcc-metodos-pago .pay-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedCobroMetodo = metodo;
  renderCobroDynamicFields();
}

export function calcularCambio(total){
  const recibido = parseFloat(document.getElementById('mcc-dinero-recibido').value) || 0;
  const cambio = recibido - total;
  document.getElementById('mcc-cambio-txt').textContent = cambio >= 0 ? fmt(cambio) : 'Insuficiente';
}

export function renderCobroDynamicFields(){
  const container = document.getElementById('mcc-dynamic-fields');
  const item = DATA.cajaPendientes[currentCobroIdx];
  if(!item) return;

  const btnConfirm = document.getElementById('btn-confirmar-cobro');
  btnConfirm.disabled = false;

  if(selectedCobroMetodo === 'Efectivo'){
    container.innerHTML = `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div>
          <label>Dinero recibido ($)</label>
          <input type="number" id="mcc-dinero-recibido" class="inp" placeholder="0.00" oninput="calcularCambio(${item.total})" style="width:100%;">
        </div>
        <div style="font-size:14px; font-weight:600; margin-top:4px;">
          Cambio / Vuelto: <span id="mcc-cambio-txt" style="font-family:'IBM Plex Mono',monospace; color:var(--teal);">$0.00</span>
        </div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Tarjeta'){
    container.innerHTML = `
      <div class="form-grid">
        <div><label>Nº de Tarjeta (Últimos 4)</label><input type="text" id="mcc-tarjeta-num" class="inp" placeholder="Ej. 4242" maxlength="4"></div>
        <div><label>Nº de Autorización</label><input type="text" id="mcc-tarjeta-auth" class="inp" placeholder="Ej. AUTH-9921"></div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Transferencia'){
    container.innerHTML = `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div><label>Comprobante / Ref</label><input type="text" id="mcc-trans-ref" class="inp" placeholder="Ej. REF-88392011"></div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Préstamo personal'){
    let clienteObj = item.clienteId ? DATA.clientes.find(c => c.id === item.clienteId) : DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    const cNombre = clienteObj ? getFullName(clienteObj) : item.cliente;
    const activeLoans = DATA.creditos.filter(cr => cr.cliente === cNombre && cr.saldo > 0);
    
    const numLoans = activeLoans.length;
    const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
    const limite = clienteObj ? (clienteObj.limiteCredito || 0) : 0;
    const available = limite - currentDebt;

    const today = new Date();
    const overdue30 = activeLoans.some(cr => {
      if(!cr.vence || cr.vence === 'A convenir') return false;
      const vDate = new Date(cr.vence);
      return (vDate < today) && ((today - vDate) / (1000 * 60 * 60 * 24) > 30);
    });

    const cond1 = available >= item.total;
    const cond2 = numLoans < 2;
    const cond3 = !overdue30;
    const esEligible = cond1 && cond2 && cond3;

    if(!esEligible) btnConfirm.disabled = true;

    container.innerHTML = `
      <div style="font-size:13px; line-height:1.4;">
        <p><b>Evaluación de Elegibilidad:</b></p>
        <ul style="list-style:none; padding:0; margin:8px 0;">
          <li style="color:${cond1?'var(--teal)':'var(--red)'}">${cond1?'✅':'❌'} Crédito disp: <b>${fmt(available)}</b> (Límite: ${fmt(limite)})</li>
          <li style="color:${cond2?'var(--teal)':'var(--red)'}">${cond2?'✅':'❌'} Préstamos activos: <b>${numLoans}</b> / 2 máximo</li>
          <li style="color:${cond3?'var(--teal)':'var(--red)'}">${cond3?'✅':'❌'} Historial de pagos (Sin atrasos > 30 días)</li>
        </ul>
        <p style="margin-top:6px;">Estado: <span class="badge ${esEligible ? 'done' : 'urg'}">${esEligible ? 'Elegible' : 'Rechazado'}</span></p>
      </div>
    `;
  }
}

export function procesarCobroFinal(){
  if(currentCobroIdx === null || currentCobroIdx === undefined) return;
  const item = DATA.cajaPendientes[currentCobroIdx];

  if(selectedCobroMetodo === 'Préstamo personal'){
    let clienteObj = item.clienteId ? DATA.clientes.find(c => c.id === item.clienteId) : DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    DATA.creditos.unshift({
      cliente: clienteObj ? getFullName(clienteObj) : item.cliente,
      concepto: 'Préstamo por ' + (item.origen === 'Ticket' ? 'Ticket #'+item.ref : 'Venta '+item.ref),
      original: item.total, saldo: item.total, vence: addDays(30), abonos: []
    });
  }

  if(item.articulosCart){
    item.articulosCart.forEach(c=>{
      const p = DATA.productos.find(x=>x.sku===c.sku);
      if(p && p.categoria!=='Servicios') p.stock = Math.max(0, p.stock - c.cantidad);
    });
  }

  if(selectedCobroMetodo !== 'Préstamo personal') {
    DATA.caja.movs.push({
      hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
      concepto: `Cobro ${item.origen} #${item.ref} (${item.cliente})`, tipo: 'ingreso', monto: item.total
    });
  }

  DATA.ventas.unshift({
    folio: item.origen === 'Ticket' ? 'FAC-' + item.ref : item.ref,
    cliente: item.cliente, articulos: item.concepto,
    pago: selectedCobroMetodo, total: item.total,
    hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
  });

  DATA.cajaPendientes.splice(currentCobroIdx, 1);
  currentCobroIdx = null;

  saveToLocal();
  closeModal('modal-cobro-caja');
  
  // Actualizamos toda la app
  renderCajaView();
  renderCreditosTable();
  if(window.renderVentasHistorial) window.renderVentasHistorial();
  if(window.renderProductosTable) window.renderProductosTable();
  if(window.renderAll) window.renderAll(); // Dashboard
  toast('Cobro procesado con éxito vía ' + selectedCobroMetodo);
}

export function renderCajaView(){
  renderCajaPendientes();
  document.getElementById('caja-mov-body').innerHTML = DATA.caja.movs.slice().reverse().map(m=>{
    const badge = m.tipo==='ingreso'?'done':m.tipo==='egreso'?'urg':'prog';
    const sign = m.tipo==='egreso'?'-':m.tipo==='ingreso'?'+':'';
    return `<tr class="tbl-row"><td class="mono">${m.hora}</td><td>${m.concepto}</td><td><span class="badge ${badge}">${m.tipo.charAt(0).toUpperCase()+m.tipo.slice(1)}</span></td><td class="mono">${sign}${fmt(m.monto)}</td></tr>`;
  }).join('');
  const ingresos = DATA.caja.movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const egresos = DATA.caja.movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const total = DATA.caja.fondo + ingresos - egresos;
  document.getElementById('caja-resumen').innerHTML = `
    <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja.fondo)}</span></div>
    <div class="caja-line"><span class="l">Ingresos</span><span class="v">${fmt(ingresos)}</span></div>
    <div class="caja-line"><span class="l">Egresos</span><span class="v">-${fmt(egresos)}</span></div>
    <div class="caja-total"><span class="l">Efectivo esperado</span><span class="v">${fmt(total)}</span></div>`;
}

export function addMovimiento(){
  const concepto = document.getElementById('mov-concepto').value.trim();
  const tipo = document.getElementById('mov-tipo').value;
  const monto = parseFloat(document.getElementById('mov-monto').value);
  if(!concepto || !monto || monto<=0){ toast('Completa el concepto y un monto válido'); return; }
  DATA.caja.movs.push({hora:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto, tipo, monto});
  saveToLocal();
  document.getElementById('mov-concepto').value=''; document.getElementById('mov-monto').value='';
  renderCajaView(); 
  if(window.renderAll) window.renderAll();
  toast('Movimiento registrado');
}

export function cerrarCorte(){
  saveToLocal();
  closeModal('modal-cierre');
  toast('Corte cerrado correctamente');
}

// ==========================================
// SECCIÓN: CRÉDITOS Y CASTIGOS POR MORA
// ==========================================
export function creditEstado(c){
  if(c.saldo<=0) return {label:'Liquidado', cls:'done'};
  const today = new Date();
  const vDate = new Date(c.vence);
  if(vDate < today){
    if((today - vDate) / (1000 * 60 * 60 * 24) > 30) return {label:'Atrasado > 1 mes', cls:'urg', isOverdue: true};
    return {label:'Vencido', cls:'urg', isOverdue: true};
  }
  return {label:'Al corriente', cls:'prog', isOverdue: false};
}

export function renderCreditosTable(){
  const totalSaldo = DATA.creditos.reduce((s,c)=>s+c.saldo,0);
  const vencidos = DATA.creditos.filter(c=>creditEstado(c).isOverdue).length;
  const alCorriente = DATA.creditos.filter(c=>c.saldo > 0 && !creditEstado(c).isOverdue).length;
  const liquidados = DATA.creditos.filter(c=>c.saldo<=0).length;
  
  const kpis = document.getElementById('creditos-kpis');
  if(kpis){
      kpis.innerHTML = `
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Saldo total</div><div class="value">${fmt(totalSaldo)}</div><div class="delta flat">${DATA.creditos.length} créditos</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Vencidos</div><div class="value">${vencidos}</div><div class="delta down">Requiere seguimiento</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Al corriente</div><div class="value">${alCorriente}</div><div class="delta up">En regla</div></div>
        <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></div><div class="label">Liquidados</div><div class="value">${liquidados}</div><div class="delta flat">Histórico</div></div>`;
  }
  const meta = document.getElementById('creditos-meta');
  if(meta) meta.textContent = 'SALDO TOTAL POR COBRAR ' + fmt(totalSaldo);

  document.getElementById('creditos-table-body').innerHTML = DATA.creditos.map((c,i)=>{
    const e = creditEstado(c);
    return `<tr class="tbl-row" onclick="openCreditModal(${i})"><td>${c.cliente}</td><td>${c.concepto}</td><td class="mono">${fmt(c.original)}</td><td class="mono" style="${e.isOverdue ? 'color:var(--red); font-weight:bold;' : ''}">${fmt(c.saldo)}</td><td class="mono">${fDate(c.vence)}</td><td><span class="badge ${e.cls}">${e.label}</span></td></tr>`;
  }).join('');
}

export function openCreditModal(idx){
  currentCreditIdx = idx;
  const c = DATA.creditos[idx];
  document.getElementById('mcr-cliente').textContent = c.cliente;
  document.getElementById('mcr-concepto').textContent = c.concepto;
  document.getElementById('mcr-original').textContent = fmt(c.original);
  document.getElementById('mcr-vence').textContent = fDate(c.vence);
  document.getElementById('mcr-saldo').textContent = fmt(c.saldo);
  document.getElementById('mcr-progress').style.width = Math.min(100, ((c.original-c.saldo)/c.original*100)).toFixed(0) + '%';
  
  const estado = creditEstado(c);
  const btnMora = document.getElementById('btn-aplicar-mora');
  if(estado.isOverdue && c.saldo > 0){ btnMora.style.display = 'inline-flex'; } else { btnMora.style.display = 'none'; }

  document.getElementById('mcr-abonos').innerHTML = c.abonos.length ? c.abonos.map(a=>`<tr><td class="mono">${a.fecha}</td><td class="mono" style="${a.metodo.includes('Recargo') ? 'color:var(--red);' : ''}">${fmt(a.monto)}</td><td>${a.metodo}</td></tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted);">Sin abonos registrados.</td></tr>';
  document.getElementById('mcr-monto-input').value = '';
  openModal('modal-credito');
}

export function aplicarInteresMora(){
  if(currentCreditIdx === null) return;
  const c = DATA.creditos[currentCreditIdx];
  const recargo = c.saldo * 0.05; 
  c.saldo += recargo; c.original += recargo; 
  c.abonos.push({ fecha: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), monto: recargo, metodo: 'Recargo 5% por Mora' });
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable();
  toast('Recargo del 5% aplicado al saldo');
}

export function registerPayment(){
  const c = DATA.creditos[currentCreditIdx];
  const monto = parseFloat(document.getElementById('mcr-monto-input').value);
  if(!monto || monto<=0){ toast('Ingresa un monto válido'); return; }
  const aplicado = Math.min(monto, c.saldo);
  c.saldo = Math.max(0, c.saldo - monto);
  c.abonos.push({fecha: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), monto:aplicado, metodo: document.getElementById('mcr-metodo-input').value});
  DATA.caja.movs.push({hora:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto:'Abono de '+c.cliente, tipo:'ingreso', monto:aplicado});
  
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable(); renderCajaView(); 
  if(window.renderAll) window.renderAll();
  toast('Abono de '+fmt(aplicado)+' registrado');
}

export function openNuevoCreditoModal(){
  if(window.populateClienteSelectCredito) window.populateClienteSelectCredito();
  openModal('modal-nuevo-credito');
}

export function populateClienteSelectCredito(){
  const sel = document.getElementById('ncr-cliente');
  if(sel) {
      sel.innerHTML = '<option value="">Selecciona un cliente...</option>' + 
        DATA.clientes.map(c => `<option value="${c.id}">${getFullName(c)} (Límite: ${fmt(c.limiteCredito||0)})</option>`).join('');
  }
}

export function createCreditoManual(){
  const clienteId = document.getElementById('ncr-cliente').value;
  const concepto = document.getElementById('ncr-concepto').value.trim();
  const monto = parseFloat(document.getElementById('ncr-monto').value);
  let vence = document.getElementById('ncr-vence').value;

  if(!clienteId || !concepto || !monto || monto <= 0) { toast('Completa todos los campos obligatorios'); return; }

  const clienteObj = DATA.clientes.find(c => c.id === clienteId);
  if(!clienteObj) return;

  const cNombre = getFullName(clienteObj);
  const activeLoans = DATA.creditos.filter(cr => cr.cliente === cNombre && cr.saldo > 0);
  const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
  const available = (clienteObj.limiteCredito || 0) - currentDebt;

  if(activeLoans.length >= 2){ toast('El cliente ya tiene el máximo de 2 préstamos activos permitidos'); return; }

  const today = new Date();
  const overdue30 = activeLoans.some(cr => {
    if(!cr.vence || cr.vence === 'A convenir') return false;
    const vDate = new Date(cr.vence);
    return (vDate < today) && ((today - vDate) / (1000 * 60 * 60 * 24) > 30);
  });

  if(overdue30){ toast('Crédito bloqueado: El cliente tiene préstamos atrasados por más de 30 días'); return; }
  if(monto > available){ toast(`Monto rechazado: El cliente solo dispone de ${fmt(available)}`); return; }
  if(!vence) vence = addDays(30);

  DATA.creditos.unshift({ cliente: cNombre, concepto, original: monto, saldo: monto, vence, abonos: [] });
  saveToLocal();

  document.getElementById('ncr-concepto').value = ''; document.getElementById('ncr-monto').value = ''; document.getElementById('ncr-vence').value = '';
  closeModal('modal-nuevo-credito');
  renderCreditosTable();
  if(window.renderClientesTable) window.renderClientesTable();
  toast('Préstamo manual otorgado con éxito');
}