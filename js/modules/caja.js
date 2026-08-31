// js/modules/caja.js
import { DATA, saveToLocal } from '../core/store.js';
import { fmt, fDate, addDays, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';

let selectedCobroMetodo = 'Efectivo';
let currentCobroIdx = null;
let currentCreditIdx = null;

const TASA_PUNITORIO_DIARIO = 0.01; // 1% diario de recargo por mora

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
    const cond2 = !overdue30;
    const esEligible = cond1 && cond2;

    if(!esEligible) btnConfirm.disabled = true;

    container.innerHTML = `
      <div style="font-size:13px; line-height:1.4;">
        <p><b>Evaluación de Cupo:</b></p>
        <ul style="list-style:none; padding:0; margin:8px 0;">
          <li style="color:${cond1?'var(--teal)':'var(--red)'}">${cond1?'✅':'❌'} Cupo disp: <b>${fmt(available)}</b> (Límite: ${fmt(limite)})</li>
          <li style="color:${cond2?'var(--teal)':'var(--red)'}">${cond2?'✅':'❌'} Sin morosidad mayor a 30 días</li>
        </ul>
        <p style="margin-top:6px;">Estado: <span class="badge ${esEligible ? 'done' : 'urg'}">${esEligible ? 'Aprobado' : 'Rechazado por Falta de Cupo'}</span></p>
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
      fechaOrigen: new Date().toISOString().split('T')[0],
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
      concepto: `Cobro ${item.origen} #${item.ref} (${item.cliente})`, tipo: 'ingreso', monto: item.total, subcategoria: 'Capital'
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
  DATA.caja.movs.push({hora:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto, tipo, monto, subcategoria: 'Gastos'});
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
// SECCIÓN: MÓDULO FINANCIERO AVANZADO
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
                const diffDays = Math.ceil(Math.abs(today - vDate) / (1000 * 60 * 60 * 24));
                if(diffDays > moraMaxima) moraMaxima = diffDays;
            }
        }
    });
    return moraMaxima;
}

export function calcularPunitorios(cuota, perdonar = false) {
    if(perdonar) return 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const vDate = new Date(cuota.vence);
    vDate.setHours(0,0,0,0);
    
    if(cuota.pagado >= cuota.importe || vDate >= today) return 0;
    const diffDays = Math.ceil(Math.abs(today - vDate) / (1000 * 60 * 60 * 24));
    return (cuota.importe * 0.01 * diffDays); // 1% diario
}

export function creditEstado(c){
  if(c.saldo<=0) return {label: c.concepto.includes('Refinanciad') ? 'Refinanciado' : 'Saldado', cls:'done', isOverdue:false};
  const mora = c.cuotas ? calcularDiasMora(c.cuotas) : 0;
  if(mora > 0){
      if(mora > 90) return {label:'Pre-Legal', cls:'urg', isOverdue: true};
      if(mora > 30) return {label:'Mora > 30 días', cls:'urg', isOverdue: true};
      return {label:'Mora Temprana', cls:'wait', isOverdue: true};
  }
  return {label:'Al corriente', cls:'prog', isOverdue: false};
}

export function renderCreditosTable(){
  const activos = DATA.creditos.filter(c => c.saldo > 0);
  const totalSaldo = activos.reduce((s,c)=>s+c.saldo,0);
  const vencidos = activos.filter(c=>creditEstado(c).isOverdue).length;
  const alCorriente = activos.filter(c=>!creditEstado(c).isOverdue).length;
  
  const kpis = document.getElementById('creditos-kpis');
  if(kpis){
      kpis.innerHTML = `
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cartera Activa (Saldo)</div><div class="value">${fmt(totalSaldo)}</div><div class="delta flat">${activos.length} carpetas</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Carpetas en Mora</div><div class="value">${vencidos}</div><div class="delta down">Requiere gestión</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Al corriente</div><div class="value">${alCorriente}</div><div class="delta up">Pagos al día</div></div>`;
  }

  document.getElementById('creditos-table-body').innerHTML = activos.map((c,i)=>{
    const e = creditEstado(c);
    const mora = c.cuotas ? calcularDiasMora(c.cuotas) : 0;
    const proxVence = c.cuotas ? (c.cuotas.find(x=>x.pagado < x.importe)?.vence || '—') : c.vence;
    
    // Buscamos el índice real en el array global para abrir el modal correcto
    const realIdx = DATA.creditos.findIndex(x => x.id === c.id);

    return `<tr class="tbl-row" onclick="openCreditModal(${realIdx})">
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
  
  const chkPunitorios = document.getElementById('mcr-quitar-punitorios');
  if(chkPunitorios) chkPunitorios.checked = false;

  renderCuotasCreditoActual();

  document.getElementById('mcr-abonos').innerHTML = c.abonos.length ? c.abonos.map(a=>`<tr><td class="mono">${a.fecha}</td><td class="mono">${fmt(a.monto)}</td><td>${a.metodo}</td></tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted);text-align:center;">Sin abonos registrados.</td></tr>';
  document.getElementById('mcr-monto-input').value = '';
  
  window.imprimirReciboDoble = () => printReciboDoble(c);
  window.imprimirPagareCredito = () => printPagare(c);
  openModal('modal-credito');
}

export function renderCuotasCreditoActual() {
  const c = DATA.creditos[currentCreditIdx];
  if(!c) return;
  const today = new Date().toISOString().split('T')[0];
  const perdonar = document.getElementById('mcr-quitar-punitorios').checked;

  let deudaTotalConMora = 0;
  
  document.getElementById('mcr-cuotas-body').innerHTML = c.cuotas.map(cu => {
      let status = cu.pagado >= cu.importe ? 'S' : (cu.vence < today ? 'V' : 'N');
      let badge = status === 'S' ? '<span class="badge done">Saldada</span>' : (status === 'V' ? '<span class="badge urg">Vencida</span>' : '<span class="badge wait">A Vencer</span>');
      let punitorios = calcularPunitorios(cu, perdonar);
      
      const totalAPagar = (cu.importe + punitorios) - cu.pagado;
      if(totalAPagar > 0) deudaTotalConMora += totalAPagar;

      return `<tr>
        <td class="mono">${fDate(cu.vence)}</td>
        <td>${badge}</td>
        <td>Cuota ${cu.numero}</td>
        <td class="mono">${fmt(cu.importe)}</td>
        <td class="mono" style="color:var(--red)">${punitorios > 0 ? fmt(punitorios) : '—'}</td>
        <td class="mono" style="color:var(--teal)">${fmt(cu.pagado)}</td>
        <td class="mono" style="font-weight:bold;">${fmt(totalAPagar)}</td>
      </tr>`;
  }).join('');

  document.getElementById('mcr-saldo').textContent = fmt(deudaTotalConMora);
}

export function registerPayment(){
  const c = DATA.creditos[currentCreditIdx];
  const montoInput = parseFloat(document.getElementById('mcr-monto-input').value);
  if(!montoInput || montoInput <= 0){ toast('Ingresa un monto válido'); return; }
  
  const perdonar = document.getElementById('mcr-quitar-punitorios').checked;
  let restanteAPagar = montoInput;
  let montoCapitalAbonado = 0;
  let montoPunitoriosAbonado = 0;

  for(let i=0; i<c.cuotas.length; i++){
      let cu = c.cuotas[i];
      let punitorios = calcularPunitorios(cu, perdonar);
      let deudaCuotaTotal = (cu.importe + punitorios) - cu.pagado;
      
      if(deudaCuotaTotal > 0 && restanteAPagar > 0){
          if(restanteAPagar >= deudaCuotaTotal){
              cu.pagado += deudaCuotaTotal; 
              montoCapitalAbonado += (deudaCuotaTotal - punitorios);
              montoPunitoriosAbonado += punitorios;
              restanteAPagar -= deudaCuotaTotal;
          } else {
              cu.pagado += restanteAPagar; 
              montoCapitalAbonado += restanteAPagar; 
              restanteAPagar = 0;
          }
      }
  }

  c.saldo = Math.max(0, c.saldo - montoCapitalAbonado);
  const metodo = document.getElementById('mcr-metodo-input').value;
  const fechaStr = new Date().toLocaleDateString('es-MX') + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  
  c.abonos.push({ fecha: fechaStr, monto: montoInput, metodo: metodo + (perdonar?' (Sin Punitorios)':'') });
  DATA.caja.movs.push({ hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto: 'Cobro Capital - Carpeta ' + c.id, tipo: 'ingreso', monto: montoCapitalAbonado, subcategoria: 'Capital' });
  
  if(montoPunitoriosAbonado > 0){
      DATA.caja.movs.push({ hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto: 'Cobro Punitorios - Carpeta ' + c.id, tipo: 'ingreso', monto: montoPunitoriosAbonado, subcategoria: 'Intereses/Punitorios' });
  }
  
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable(); renderCajaView(); 
  if(window.renderAll) window.renderAll();
  toast('Pago imputado. Capital: ' + fmt(montoCapitalAbonado) + ' | Punitorios: ' + fmt(montoPunitoriosAbonado));
}

// ---------------- FLUJO DE NUEVO CRÉDITO Y REFINANCIACIÓN ----------------

export function openNuevoCreditoModal(){
  if(window.populateClienteSelectCredito) window.populateClienteSelectCredito();
  document.getElementById('ncr-vence').value = addDays(30);
  document.getElementById('contenedor-planes').style.display = 'none';
  document.getElementById('btn-otorgar').disabled = true;
  document.getElementById('ncr-concepto').value = '';
  openModal('modal-nuevo-credito');
}

export function generarPlanesDePago() {
    const capital = parseFloat(document.getElementById('ncr-monto').value) || 0;
    const anticipo = parseFloat(document.getElementById('ncr-anticipo').value) || 0;
    const interesGlobal = parseFloat(document.getElementById('ncr-interes').value) || 0;
    
    let base = capital - anticipo;
    if(base <= 0) { toast('El monto a refinanciar debe ser mayor al anticipo'); return; }
    
    const totalFinanciado = base * (1 + (interesGlobal / 100));
    const tbody = document.getElementById('ncr-tabla-planes');
    
    let html = '';
    for(let i=1; i<=6; i++) {
        const valorCuota = totalFinanciado / i;
        html += `<tr>
            <td>Plan ${i} SR</td>
            <td>${i} cuotas</td>
            <td class="mono">${fmt(valorCuota)}</td>
            <td><button class="btn btn-primary btn-sm" onclick="seleccionarPlanDePago(${i}, ${valorCuota}, ${totalFinanciado})">Elegir</button></td>
        </tr>`;
    }
    
    tbody.innerHTML = html;
    document.getElementById('contenedor-planes').style.display = 'block';
}

export function seleccionarPlanDePago(cuotas, importe, total) {
    document.getElementById('ncr-plan-elegido').value = `${cuotas} cuotas de ${fmt(importe)} (Total: ${fmt(total)})`;
    document.getElementById('ncr-cuotas-hidden').value = cuotas;
    document.getElementById('ncr-importe-hidden').value = importe;
    document.getElementById('btn-otorgar').disabled = false;
}

export function createCreditoManual(){
  const clienteId = document.getElementById('ncr-cliente').value;
  const concepto = document.getElementById('ncr-concepto').value.trim();
  const anticipo = parseFloat(document.getElementById('ncr-anticipo').value) || 0;
  
  const cantCuotas = parseInt(document.getElementById('ncr-cuotas-hidden').value);
  const importeCuota = parseFloat(document.getElementById('ncr-importe-hidden').value);
  let primerVence = document.getElementById('ncr-vence').value;

  if(!clienteId || !cantCuotas) return;
  const clienteObj = DATA.clientes.find(c => c.id === clienteId);
  const cNombre = getFullName(clienteObj);
  const baseTotal = cantCuotas * importeCuota;

  // Validación estricta de Cupo
  const activeLoans = DATA.creditos.filter(cr => cr.cliente === cNombre && cr.saldo > 0);
  const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
  const cupoDisponible = (clienteObj.limiteCredito || 0) - currentDebt;
  
  if(baseTotal > cupoDisponible){ 
      toast(`OPERACIÓN RECHAZADA: Cupo insuficiente. Cupo disp: ${fmt(cupoDisponible)}`); 
      return; 
  }

  if(!primerVence) primerVence = addDays(30);

  let arrCuotas = [];
  let fechaActual = new Date(primerVence + 'T12:00:00');
  
  for(let i=1; i <= cantCuotas; i++){
      arrCuotas.push({ numero: i, importe: importeCuota, pagado: 0, vence: fechaActual.toISOString().split('T')[0] });
      fechaActual.setDate(fechaActual.getDate() + 30); // Frecuencia fija a 30 días para simplificar planes SR
  }

  if(anticipo > 0){
      DATA.caja.movs.push({ hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto: `Anticipo Crédito - ${cNombre}`, tipo: 'ingreso', monto: anticipo, subcategoria: 'Capital' });
  }

  const nuevoCredito = { 
      id: 'CR-' + Date.now().toString().slice(-6),
      cliente: cNombre, concepto: concepto || 'Otorgamiento de Crédito', 
      fechaOrigen: new Date().toISOString().split('T')[0],
      original: baseTotal, saldo: baseTotal, abonos: [], cuotas: arrCuotas
  };
  
  DATA.creditos.unshift(nuevoCredito);
  saveToLocal();

  closeModal('modal-nuevo-credito');
  renderCreditosTable();
  if(window.renderCajaView) window.renderCajaView();
  toast('Carpeta generada con éxito');
  printPagare(nuevoCredito);
}

// ------ FUNCIONES PARA EL PERFIL DEL CLIENTE (REFINANCIACIÓN Y NUEVO) ------

export function nuevoCreditoDesdePerfil() {
    const elNombre = document.getElementById('mc-nombre').textContent;
    closeModal('modal-cliente');
    openNuevoCreditoModal();
    // Forzamos la selección del cliente en el select
    setTimeout(() => {
        const sel = document.getElementById('ncr-cliente');
        for(let i=0; i<sel.options.length; i++) {
            if(sel.options[i].text.includes(elNombre)) { sel.selectedIndex = i; break; }
        }
    }, 100);
}

export function refinanciarDeudaPerfil() {
    const elNombre = document.getElementById('mc-nombre').textContent;
    const activos = DATA.creditos.filter(cr => cr.cliente === elNombre && cr.saldo > 0);
    
    if(activos.length === 0) { toast('El cliente no tiene deuda activa para refinanciar'); return; }
    
    // Calculamos deuda total (Capital + Punitorios)
    let deudaConsolidada = 0;
    activos.forEach(c => {
        c.cuotas.forEach(cu => {
            if(cu.pagado < cu.importe) {
                deudaConsolidada += (cu.importe + calcularPunitorios(cu, false)) - cu.pagado;
            }
        });
        // Cancelamos la carpeta vieja
        c.saldo = 0;
        c.concepto += ' (Refinanciado)';
    });
    saveToLocal();

    closeModal('modal-cliente');
    openNuevoCreditoModal();
    
    setTimeout(() => {
        const sel = document.getElementById('ncr-cliente');
        for(let i=0; i<sel.options.length; i++) {
            if(sel.options[i].text.includes(elNombre)) { sel.selectedIndex = i; break; }
        }
        document.getElementById('ncr-concepto').value = 'Refinanciación de Deuda Anterior';
        document.getElementById('ncr-monto').value = deudaConsolidada.toFixed(2);
        toast('Se consolidó la deuda. Generá el nuevo plan de pagos.');
    }, 100);
}

export function populateClienteSelectCredito(){
  const sel = document.getElementById('ncr-cliente');
  if(sel) {
      sel.innerHTML = '<option value="">Selecciona un cliente...</option>' + 
        DATA.clientes.map(c => {
            const activeLoans = DATA.creditos.filter(cr => cr.cliente === getFullName(c) && cr.saldo > 0);
            const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
            const available = (c.limiteCredito || 0) - currentDebt;
            return `<option value="${c.id}">${getFullName(c)} (Cupo disp: ${fmt(available)})</option>`;
        }).join('');
  }
}

export function printPagare(credito){
  const c = DATA.clientes.find(x => getFullName(x) === credito.cliente);
  const neg = DATA.negocio.nombre || 'EMPRESA PRESTADORA';
  const direccion = c ? `${c.direccion} ${c.localidad||''} ${c.provincia||''}` : '';
  const dni = c ? c.dni : '';
  
  const win = window.open('', '', 'width=800,height=700');
  win.document.write(`
    <html><head><title>Solicitud y Pagaré - ${credito.cliente}</title>
    <style>body{font-family: Arial, sans-serif; padding:40px; font-size:13px; line-height:1.5;} h2{text-align:center;} .box{border:1px solid #000; padding:15px; margin-bottom:20px;} .legales{font-size:10px; text-align:justify;}</style></head>
    <body>
      <h2>SOLICITUD DE CRÉDITO Y PAGARÉ</h2>
      <div class="box">
        <p><b>Carpeta Nº:</b> ${credito.id} | <b>Fecha:</b> ${fDate(credito.fechaOrigen)}</p>
        <p><b>Cliente:</b> ${credito.cliente.toUpperCase()} | <b>DNI:</b> ${dni}</p>
        <p><b>Dirección:</b> ${direccion.toUpperCase()}</p>
        <p><b>Plan de Pagos:</b> ${credito.cuotas.length} cuotas de ${fmt(credito.cuotas[0].importe)}</p>
        <p><b>Monto Total Financiado:</b> ${fmt(credito.original)}</p>
      </div>
      <p class="legales">LOS DATOS CONSIGNADOS EN LA PRESENTE REVISTEN EL CARÁCTER DE DECLARACIÓN JURADA. CONDICIONES GENERALES DE ADHESIÓN AL SISTEMA DE CRÉDITOS ${neg.toUpperCase()}: 1. El solicitante deberá abonar sus créditos en la cantidad de cuotas indicadas en este comprobante. 2. Una vez vencido el plazo, el crédito será considerado de plazo vencido, haciéndose exigible en su totalidad más los intereses compensatorios y punitorios vigentes (1% diario). 3. Autorizo a ${neg.toUpperCase()} a que incluya mi apellido, nombre y mi número de documento de identidad en las bases de datos de clientes MOROSOS, una vez transcurridos 30 días corridos desde la fecha de vencimiento.</p>
      <br>
      <div class="box" style="background:#f9f9f9;">
        <p><b>PAGARÉ A LA VISTA</b></p>
        <p>Por: <b>${fmt(credito.original)}</b></p>
        <p>Pagaremos a la vista a ${neg.toUpperCase()} o a su orden sin protesto (Art 50 D. Ley 5965/63) la cantidad de PESOS detallada arriba, por igual valor recibido a nuestra entera satisfacción.</p>
        <br><br><br>
        <p style="text-align:right;">___________________________________<br>Firma, Aclaración y DNI del Deudor</p>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body></html>
  `);
  win.document.close();
}

export function printReciboDoble(credito){
  const win = window.open('', '', 'width=850,height=500');
  const neg = DATA.negocio.nombre || 'EMPRESA';
  
  win.document.write(`
    <html><head><title>Recibo de Cobro - Doble</title>
    <style>
      body{font-family: 'Courier New', monospace; font-size:12px; margin:0; padding:20px; display:flex;}
      .ticket{width:48%; border:1px dashed #000; padding:15px; margin-right:2%;}
      .center{text-align:center;} .divider{border-bottom:1px dashed #000; margin:10px 0;}
    </style></head><body>
      <!-- TICKET CLIENTE -->
      <div class="ticket">
        <div class="center"><b>${neg.toUpperCase()}</b><br>Cupón de Pago<br>Carpeta Nº: ${credito.id}</div><div class="divider"></div>
        <p>Cliente: <b>${credito.cliente}</b></p>
        <p>Fecha de Pago: ${fDate(new Date().toISOString().split('T')[0])}</p>
        <p>Saldo Pendiente de la Carpeta: ${fmt(credito.saldo)}</p>
        <div class="divider"></div>
        <p>Próximos Vencimientos:</p>
        ${credito.cuotas.filter(c=>c.pagado<c.importe).slice(0,3).map(c=>`<p>Cuota ${c.numero} - ${fDate(c.vence)} - ${fmt((c.importe+calcularPunitorios(c))-c.pagado)}</p>`).join('')}
        <div class="divider"></div>
        <p class="center" style="font-size:10px;">ATENCION: Su pago en término evitará la adición de intereses punitorios y gastos a las cuotas.<br><br><b>CUPON PARA EL CLIENTE</b></p>
      </div>
      <!-- TICKET COMERCIO -->
      <div class="ticket">
        <div class="center"><b>${neg.toUpperCase()}</b><br>Cupón de Pago<br>Carpeta Nº: ${credito.id}</div><div class="divider"></div>
        <p>Cliente: <b>${credito.cliente}</b></p>
        <p>Fecha de Pago: ${fDate(new Date().toISOString().split('T')[0])}</p>
        <p>Saldo Pendiente de la Carpeta: ${fmt(credito.saldo)}</p>
        <div class="divider"></div>
        <p>Próximos Vencimientos:</p>
        ${credito.cuotas.filter(c=>c.pagado<c.importe).slice(0,3).map(c=>`<p>Cuota ${c.numero} - ${fDate(c.vence)} - ${fmt((c.importe+calcularPunitorios(c))-c.pagado)}</p>`).join('')}
        <div class="divider"></div>
        <p class="center" style="font-size:10px;">ATENCION: Su pago en término evitará la adición de intereses punitorios y gastos a las cuotas.<br><br><b>CUPON PARA EL COMERCIO</b></p>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body></html>
  `);
  win.document.close();
}