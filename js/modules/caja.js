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
    let overdue30 = false;
    activeLoans.forEach(cr => {
        if(cr.cuotas){
            cr.cuotas.forEach(cu=>{
                if(cu.pagado < cu.importe){
                    const vD = new Date(cu.vence);
                    if(vD < today && ((today - vD)/(1000*60*60*24)) > 30) overdue30 = true;
                }
            });
        }
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
    const fechaVence = addDays(30);
    const cuotasArray = [{ numero: 1, importe: item.total, pagado: 0, vence: fechaVence }];
    
    DATA.creditos.unshift({
      id: 'CR-' + Date.now().toString().slice(-6),
      cliente: clienteObj ? getFullName(clienteObj) : item.cliente,
      concepto: 'Préstamo por ' + (item.origen === 'Ticket' ? 'Ticket #'+item.ref : 'Venta '+item.ref),
      original: item.total, saldo: item.total, abonos: [], cuotas: cuotasArray
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
  
  renderCajaView();
  if(window.renderCreditosTable) window.renderCreditosTable();
  if(window.renderVentasHistorial) window.renderVentasHistorial();
  if(window.renderProductosTable) window.renderProductosTable();
  if(window.renderAll) window.renderAll(); 
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

export function abrirModalCierre(){
  const ingresos = DATA.caja.movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const egresos = DATA.caja.movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const total = DATA.caja.fondo + ingresos - egresos;
  
  document.getElementById('cierre-resumen').innerHTML = `
    <div class="caja-box">
      <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja.fondo)}</span></div>
      <div class="caja-line"><span class="l">Ingresos totales</span><span class="v" style="color:var(--teal);">${fmt(ingresos)}</span></div>
      <div class="caja-line"><span class="l">Egresos totales</span><span class="v" style="color:var(--red);">-${fmt(egresos)}</span></div>
      <div class="caja-total" style="margin-top:16px;"><span class="l">Efectivo a retirar</span><span class="v">${fmt(total)}</span></div>
    </div>
    <div style="margin-top:16px;">
      <label style="font-size:12px; color:var(--muted); margin-bottom:6px; display:block;">Fondo a dejar para el próximo turno ($)</label>
      <input type="number" id="cierre-nuevo-fondo" class="inp" style="width:100%;" placeholder="Ej. 500" value="0">
    </div>
  `;
  openModal('modal-cierre');
}

export function cerrarCorte(){
  const nuevoFondo = parseFloat(document.getElementById('cierre-nuevo-fondo').value) || 0;
  DATA.caja.movs = [];
  DATA.caja.fondo = nuevoFondo;
  saveToLocal();
  closeModal('modal-cierre');
  renderCajaView();
  if(window.renderAll) window.renderAll();
  toast('Corte cerrado. Nuevo fondo: ' + fmt(nuevoFondo));
}

// ==========================================
// SECCIÓN: MÓDULO FINANCIERO (CRÉDITOS Y CUOTAS)
// ==========================================

export function calcularDiasMora(cuotas) {
    if(!cuotas || cuotas.length === 0) return 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let moraMaxima = 0;
    cuotas.forEach(cu => {
        if(cu.pagado < cu.importe) {
            const vDate = new Date(cu.vence);
            vDate.setHours(0,0,0,0);
            if(vDate < today) {
                const diffTime = Math.abs(today - vDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if(diffDays > moraMaxima) moraMaxima = diffDays;
            }
        }
    });
    return moraMaxima;
}

export function creditEstado(c){
  if(c.saldo<=0) return {label:'Saldado', cls:'done', isOverdue:false};
  
  if(!c.cuotas){
      const today = new Date();
      const vDate = new Date(c.vence || '2099-01-01');
      if(vDate < today) return {label:'Vencido', cls:'urg', isOverdue: true};
      return {label:'En curso', cls:'prog', isOverdue: false};
  }

  const mora = calcularDiasMora(c.cuotas);
  if(mora > 0){
      if(mora > 90) return {label:'Pre-Legal', cls:'urg', isOverdue: true};
      if(mora > 30) return {label:'Mora > 30 días', cls:'urg', isOverdue: true};
      return {label:'Mora Temprana', cls:'wait', isOverdue: true};
  }
  return {label:'Al corriente', cls:'prog', isOverdue: false};
}

export function renderCreditosTable(){
  const totalSaldo = DATA.creditos.reduce((s,c)=>s+c.saldo,0);
  const vencidos = DATA.creditos.filter(c=>creditEstado(c).isOverdue).length;
  const alCorriente = DATA.creditos.filter(c=>c.saldo > 0 && !creditEstado(c).isOverdue).length;
  
  const kpis = document.getElementById('creditos-kpis');
  if(kpis){
      kpis.innerHTML = `
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cartera Activa (Saldo)</div><div class="value">${fmt(totalSaldo)}</div><div class="delta flat">${DATA.creditos.length} carpetas</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Carpetas en Mora</div><div class="value">${vencidos}</div><div class="delta down">Requiere gestión de cobro</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Al corriente</div><div class="value">${alCorriente}</div><div class="delta up">Pagos al día</div></div>`;
  }
  const meta = document.getElementById('creditos-meta');
  if(meta) meta.textContent = 'CARTERA ACTIVA: ' + fmt(totalSaldo);

  document.getElementById('creditos-table-body').innerHTML = DATA.creditos.map((c,i)=>{
    const e = creditEstado(c);
    const mora = c.cuotas ? calcularDiasMora(c.cuotas) : 0;
    const proxVence = c.cuotas ? (c.cuotas.find(x=>x.pagado < x.importe)?.vence || '—') : c.vence;
    
    return `<tr class="tbl-row" onclick="openCreditModal(${i})">
      <td><b>${c.cliente}</b><br><span style="font-size:11px; color:var(--muted);">${mora > 0 ? mora + ' días de mora' : 'En regla'}</span></td>
      <td>Carpeta: ${c.id || 'N/A'}<br><span class="mono" style="font-size:10px;">${c.concepto}</span></td>
      <td class="mono">${fmt(c.original)}</td>
      <td class="mono" style="${e.isOverdue ? 'color:var(--red); font-weight:bold;' : ''}">${fmt(c.saldo)}</td>
      <td class="mono">${fDate(proxVence)}</td>
      <td><span class="badge ${e.cls}">${e.label}</span></td>
    </tr>`;
  }).join('');
}

export function openCreditModal(idx){
  currentCreditIdx = idx;
  const c = DATA.creditos[idx];
  
  if(!c.cuotas) { c.cuotas = [{ numero: 1, importe: c.original, pagado: c.original - c.saldo, vence: c.vence }]; }

  document.getElementById('mcr-cliente').textContent = c.cliente;
  document.getElementById('mcr-concepto').textContent = 'Carpeta: ' + (c.id || 'N/A');
  document.getElementById('mcr-original').textContent = fmt(c.original);
  document.getElementById('mcr-saldo').textContent = fmt(c.saldo);
  
  const diasMora = calcularDiasMora(c.cuotas);
  document.getElementById('mcr-mora-dias').textContent = diasMora;
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('mcr-cuotas-body').innerHTML = c.cuotas.map(cu => {
      let status = cu.pagado >= cu.importe ? 'S' : (cu.vence < today ? 'V' : 'N');
      let badge = status === 'S' ? '<span class="badge done">Saldada</span>' : (status === 'V' ? '<span class="badge urg">Vencida</span>' : '<span class="badge wait">A Vencer</span>');
      
      return `<tr>
        <td class="mono">${fDate(cu.vence)}</td>
        <td style="font-family:'IBM Plex Mono'; font-weight:bold; color:${status==='S'?'var(--teal)':(status==='V'?'var(--red)':'var(--muted)')}">${status}</td>
        <td>Cuota ${cu.numero}</td>
        <td class="mono">${fmt(cu.importe)}</td>
        <td class="mono" style="color:var(--teal)">${fmt(cu.pagado)}</td>
        <td class="mono">${fmt(cu.importe - cu.pagado)}</td>
      </tr>`;
  }).join('');

  document.getElementById('mcr-abonos').innerHTML = c.abonos.length ? c.abonos.map(a=>`<tr><td class="mono">${a.fecha}</td><td class="mono">${fmt(a.monto)}</td><td>${a.metodo}</td></tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted);text-align:center;">Sin abonos registrados.</td></tr>';
  
  document.getElementById('mcr-monto-input').value = '';
  openModal('modal-credito');
}

export function registerPayment(){
  const c = DATA.creditos[currentCreditIdx];
  const montoInput = parseFloat(document.getElementById('mcr-monto-input').value);
  if(!montoInput || montoInput <= 0){ toast('Ingresa un monto válido'); return; }
  
  let restanteAPagar = Math.min(montoInput, c.saldo);
  const montoRealAbonado = restanteAPagar;

  for(let i=0; i<c.cuotas.length; i++){
      let cu = c.cuotas[i];
      let deudaCuota = cu.importe - cu.pagado;
      
      if(deudaCuota > 0 && restanteAPagar > 0){
          if(restanteAPagar >= deudaCuota){
              cu.pagado = cu.importe;
              restanteAPagar -= deudaCuota;
          } else {
              cu.pagado += restanteAPagar;
              restanteAPagar = 0;
          }
      }
  }

  c.saldo = Math.max(0, c.saldo - montoRealAbonado);
  c.abonos.push({
      fecha: new Date().toLocaleDateString('es-MX') + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), 
      monto: montoRealAbonado, 
      metodo: document.getElementById('mcr-metodo-input').value
  });
  
  DATA.caja.movs.push({
      hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), 
      concepto: 'Cobro de Cuota - Carpeta ' + (c.id||''), 
      tipo: 'ingreso', 
      monto: montoRealAbonado
  });
  
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable(); 
  renderCajaView(); 
  if(window.renderAll) window.renderAll();
  toast('Pago imputado automáticamente a las cuotas correspondientes');
}

export function openNuevoCreditoModal(){
  if(window.populateClienteSelectCredito) window.populateClienteSelectCredito();
  document.getElementById('ncr-vence').value = addDays(30);
  simularCredito();
  openModal('modal-nuevo-credito');
}

export function populateClienteSelectCredito(){
  const sel = document.getElementById('ncr-cliente');
  if(sel) {
      sel.innerHTML = '<option value="">Selecciona un cliente...</option>' + 
        DATA.clientes.map(c => `<option value="${c.id}">${getFullName(c)} (Límite disp: ${fmt(c.limiteCredito||0)})</option>`).join('');
  }
}

export function simularCredito(){
    const capital = parseFloat(document.getElementById('ncr-monto').value) || 0;
    const anticipo = parseFloat(document.getElementById('ncr-anticipo').value) || 0;
    const gastos = parseFloat(document.getElementById('ncr-gastos').value) || 0;
    const honorarios = parseFloat(document.getElementById('ncr-honorarios').value) || 0;
    const cantCuotas = parseInt(document.getElementById('ncr-cuotas').value) || 1;
    
    // Total Financiado = (Capital + Gastos + Honorarios) - Anticipo
    let base = (capital + gastos + honorarios) - anticipo;
    if(base < 0) base = 0;
    
    const valorCuota = base / cantCuotas;
    
    document.getElementById('sim-total').textContent = fmt(base);
    document.getElementById('sim-cuota').textContent = cantCuotas > 1 ? fmt(valorCuota) + ' c/u' : fmt(valorCuota);
}

export function createCreditoManual(){
  const clienteId = document.getElementById('ncr-cliente').value;
  const concepto = document.getElementById('ncr-concepto').value.trim();
  const capital = parseFloat(document.getElementById('ncr-monto').value) || 0;
  const anticipo = parseFloat(document.getElementById('ncr-anticipo').value) || 0;
  const gastos = parseFloat(document.getElementById('ncr-gastos').value) || 0;
  const honorarios = parseFloat(document.getElementById('ncr-honorarios').value) || 0;
  const cantCuotas = parseInt(document.getElementById('ncr-cuotas').value) || 1;
  const frecuencia = parseInt(document.getElementById('ncr-frecuencia').value) || 30;
  let primerVence = document.getElementById('ncr-vence').value;

  if(!clienteId || capital <= 0) { toast('Completa el Cliente y la Deuda Histórica (Capital)'); return; }
  if(!primerVence) primerVence = addDays(30);

  const clienteObj = DATA.clientes.find(c => c.id === clienteId);
  const cNombre = getFullName(clienteObj);
  
  let base = (capital + gastos + honorarios) - anticipo;
  if(base < 0) base = 0;
  const valorCuota = base / cantCuotas;

  let arrCuotas = [];
  let fechaActual = new Date(primerVence + 'T12:00:00');
  
  for(let i=1; i <= cantCuotas; i++){
      arrCuotas.push({
          numero: i, importe: valorCuota, pagado: 0, vence: fechaActual.toISOString().split('T')[0]
      });
      fechaActual.setDate(fechaActual.getDate() + frecuencia);
  }

  // Si hay anticipo, lo ingresamos a caja
  if(anticipo > 0){
      DATA.caja.movs.push({
          hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
          concepto: `Anticipo Refinanciación - ${cNombre}`, tipo: 'ingreso', monto: anticipo
      });
  }

  DATA.creditos.unshift({ 
      id: 'CR-' + Date.now().toString().slice(-6),
      cliente: cNombre, 
      concepto: concepto || 'Refinanciación / Plan de Pagos', 
      original: base, 
      saldo: base, 
      abonos: [],
      cuotas: arrCuotas
  });
  
  saveToLocal();

  document.getElementById('ncr-concepto').value = ''; 
  document.getElementById('ncr-monto').value = ''; 
  document.getElementById('ncr-anticipo').value = '0';
  document.getElementById('ncr-gastos').value = '0';
  document.getElementById('ncr-honorarios').value = '0';
  document.getElementById('ncr-cuotas').value = '1';
  
  closeModal('modal-nuevo-credito');
  renderCreditosTable();
  if(window.renderCajaView) window.renderCajaView();
  toast('Carpeta generada con éxito (' + cantCuotas + ' cuotas)');
}

export function printCupones(){
  if(currentCreditIdx === null) return;
  const credito = DATA.creditos[currentCreditIdx];
  if(!credito.cuotas || credito.cuotas.length === 0){ toast('No hay cuotas para imprimir'); return; }
  
  const clienteObj = DATA.clientes.find(c => getFullName(c) === credito.cliente);
  let direccion = clienteObj ? clienteObj.direccion : 'DOMICILIO NO REGISTRADO';
  if(clienteObj && clienteObj.localidad) direccion += `, ${clienteObj.localidad}`;
  const telefono = clienteObj ? clienteObj.tel : '';
  const dni = (clienteObj && clienteObj.dni) ? `D.N.I: ${clienteObj.dni}` : '';
  const folderNum = credito.id || 'N/A';
  
  let cuponesHTML = credito.cuotas.map(cu => {
      // Formato basado exactamente en la Foto 4 (Ticket de Venta / Cuota)
      return `
      <div class="cupon">
          <div class="header">
              <span>Nº Carpeta: <b>${folderNum}</b></span>
              <span>Fecha Origen: ${fDate(new Date().toISOString().split('T')[0])}</span>
              <span style="font-size:18px;"><b>CUPÓN DE PAGO</b></span>
          </div>
          
          <div class="row" style="margin-top:15px;">
              <div class="col" style="width:60%;">
                  <p><b>${credito.cliente.toUpperCase()}</b></p>
                  <p>${dni}</p>
                  <p>${direccion.toUpperCase()}</p>
                  <p>Tel: ${telefono}</p>
                  
                  <div class="info-box">
                      <p><b>Concepto:</b> ${credito.concepto}</p>
                      <p>Plan de pago: ${credito.cuotas.length} cuotas de ${fmt(credito.cuotas[0].importe)}</p>
                  </div>
              </div>
              
              <div class="col right" style="width:38%;">
                  <div style="border:1px solid #000; padding:10px; margin-bottom:10px;">
                      <p>Vencimiento de esta cuota:</p>
                      <p><b style="font-size:18px;">${fDate(cu.vence)}</b></p>
                  </div>
                  <div style="border:1px solid #000; padding:10px;">
                      <p>Cuota Nº: <b>${cu.numero}</b></p>
                      <p>Deuda Total Restante: ${fmt(credito.saldo)}</p>
                  </div>
              </div>
          </div>
          
          <div class="footer-amount">
             IMPORTE A PAGAR: <span>${fmt(cu.importe)}</span>
          </div>
          
          <div class="signature">
              __________________________________<br>Firma / Sello de Caja
          </div>
      </div>
      `;
  }).join('');

  const win = window.open('', '', 'width=850,height=800');
  win.document.write(`
    <html>
    <head>
      <title>Impresión de Cupones</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; background: #fff; padding: 20px; color: #000; }
        .cupon { border: 2px dashed #000; padding: 20px; margin-bottom: 30px; page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .row { display: flex; justify-content: space-between; }
        .col p { margin: 4px 0; font-size: 14px; }
        .info-box { border-top: 1px dashed #000; margin-top: 15px; padding-top: 15px; font-size:12px; }
        .right { text-align: right; }
        .footer-amount { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
        .footer-amount span { border: 2px solid #000; padding: 5px 15px; display: inline-block; margin-left: 10px; font-size: 22px; }
        .signature { margin-top: 40px; font-size: 12px; color: #555; text-align: right; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      ${cuponesHTML}
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}