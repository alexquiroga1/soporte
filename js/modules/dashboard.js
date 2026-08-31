// js/modules/dashboard.js
import { DATA, TICKET_STAGES } from '../core/store.js';
import { fmt, fmtK, initials, fDate } from '../core/utils.js';
import { svgBarChart, renderDonut } from '../core/charts.js';
import { stageInfo } from './tickets.js';
import { calcularDiasMora } from './caja.js'; // Importamos para calcular morosos

export function renderDashboard(){
  // Código del dashboard original sin cambios...
  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado').length;
  const ventasHoy = DATA.ventas.reduce((s,v)=>s+v.total,0);
  const creditoTotal = DATA.creditos.reduce((s,c)=>s+c.saldo,0);
  const slaRiesgo = DATA.tickets.filter(t=>t.prioridad==='P1' && t.stage!=='entregado').length;
  
  const titleEl = document.getElementById('dash-title-negocio');
  if(titleEl) titleEl.textContent = DATA.negocio?.nombre || 'Panel general';

  const dashKpis = document.getElementById('dash-kpis');
  if(dashKpis) {
      dashKpis.innerHTML = `
        <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Tickets abiertos</div><div class="value">${abiertos}</div><div class="delta up">↑ activos hoy</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6"/></svg></div><div class="label">Ventas del día</div><div class="value">${fmt(ventasHoy)}</div><div class="delta up">↑ 12.4%</div></div>
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div><div class="label">Créditos activos</div><div class="value">${fmt(creditoTotal)}</div><div class="delta down">↓ 2.1%</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">SLA en riesgo</div><div class="value">${slaRiesgo}</div><div class="delta down">Requiere atención</div></div>`;
  }
}

export function renderReportes(){
  const kpis = document.getElementById('reportes-kpis');
  if(!kpis) return;

  const totalCapitalCobrado = DATA.caja.movs.filter(m=>m.tipo==='ingreso' && m.subcategoria==='Capital').reduce((s,m)=>s+m.monto,0);
  const totalPunitoriosCobrado = DATA.caja.movs.filter(m=>m.tipo==='ingreso' && m.subcategoria==='Intereses/Punitorios').reduce((s,m)=>s+m.monto,0);
  
  kpis.innerHTML = `
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div><div class="label">Capital Cobrado</div><div class="value">${fmtK(totalCapitalCobrado)}</div><div class="delta up">Recupero de deudas</div></div>
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Punitorios Cobrados</div><div class="value">${fmt(totalPunitoriosCobrado)}</div><div class="delta up">Intereses por mora</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cuentas por cobrar</div><div class="value">${fmt(DATA.creditos.reduce((s,c)=>s+c.saldo,0))}</div><div class="delta flat">${DATA.creditos.length} carpetas activas</div></div>`;

  // 1. Listado de Créditos Otorgados
  document.getElementById('reportes-lista-creditos').innerHTML = DATA.creditos.map(c => `
      <tr><td class="mono">${fDate(c.fechaOrigen || '')}</td><td>${c.id || '-'}</td><td><b>${c.cliente}</b></td><td>${c.concepto}</td><td class="mono" style="color:var(--teal); font-weight:bold;">${fmt(c.original)}</td></tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Sin créditos registrados.</td></tr>';

  // 2. Listado de Cobranzas
  document.getElementById('reportes-lista-cobranzas').innerHTML = DATA.caja.movs.filter(m=>m.tipo==='ingreso' && m.concepto.includes('Cobro')).map(m => `
      <tr><td class="mono">${m.hora}</td><td>${m.concepto}</td><td class="mono">${fmt(m.subcategoria === 'Capital' ? m.monto : 0)}</td><td class="mono" style="color:var(--red);">${fmt(m.subcategoria === 'Intereses/Punitorios' ? m.monto : 0)}</td><td class="mono" style="font-weight:bold;">${fmt(m.monto)}</td></tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Sin cobranzas registradas.</td></tr>';

  // 3. Listado de Morosos
  let morosos = DATA.creditos.map(c => {
      let mora = c.cuotas ? calcularDiasMora(c.cuotas) : 0;
      let cl = DATA.clientes.find(x => getFullName(x) === c.cliente);
      return { cliente: c.cliente, tel: cl ? cl.tel : '—', saldo: c.saldo, mora: mora, id: c.id };
  }).filter(m => m.mora > 0).sort((a,b) => b.mora - a.mora); // Ordenados de mayor a menor mora

  document.getElementById('reportes-lista-morosos').innerHTML = morosos.map(m => `
      <tr><td><b>${m.cliente}</b><br><span style="font-size:11px; color:var(--muted);">Carpeta: ${m.id}</span></td><td class="mono">${m.tel}</td><td class="mono" style="color:var(--red); font-weight:bold;">${m.mora} Días</td><td class="mono" style="font-weight:bold;">${fmt(m.saldo)}</td></tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--muted);">No hay clientes en estado de mora.</td></tr>';
}