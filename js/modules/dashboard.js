// js/modules/dashboard.js
import { DATA, TICKET_STAGES } from '../core/store.js';
import { fmt, fmtK, initials } from '../core/utils.js';
import { svgBarChart, renderDonut, renderHBars } from '../core/charts.js';
import { stageInfo } from './tickets.js';

// Datos estáticos de simulación (puedes conectarlos a data real luego)
const ventasSemana = [{l:'Lun',v:0},{l:'Mar',v:0},{l:'Mié',v:0},{l:'Jue',v:0},{l:'Vie',v:0},{l:'Sáb',v:0},{l:'Dom',v:0}];
const ventasMensuales = [{l:'Mes 1',v:0},{l:'Mes 2',v:0},{l:'Mes 3',v:0}];

export function renderDashboard(){
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

  const dashWeekTotal = document.getElementById('dash-week-total');
  if(dashWeekTotal) dashWeekTotal.textContent = fmt(ventasSemana.reduce((s,d)=>s+d.v,0)) + ' esta semana';
  
  const dashBarChart = document.getElementById('dash-bar-chart');
  if(dashBarChart) dashBarChart.innerHTML = svgBarChart(ventasSemana.map(d=>({l:d.l,v:d.v})), {fmt:fmtK, height:150});

  const dashDonut = document.getElementById('dash-donut');
  if(dashDonut) {
      const porEstado = TICKET_STAGES.map(s=>({label:s.label, value:DATA.tickets.filter(t=>t.stage===s.key).length, color:s.color})).filter(s=>s.value>0);
      renderDonut(dashDonut, porEstado);
  }

  const dashTicketsBody = document.getElementById('dash-tickets-body');
  if(dashTicketsBody) {
      dashTicketsBody.innerHTML = DATA.tickets.slice(0,5).map(t=>{
        const st = stageInfo(t.stage);
        return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')"><td><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></td><td class="mono">#${t.id}</td><td><div class="cust"><div class="ci">${initials(t.cliente)}</div><div><b>${t.cliente}</b><span>${t.ingreso}</span></div></div></td><td>${t.equipo}</td><td><span class="badge ${st.badge}">${st.label}</span></td><td>${t.tecnico}</td></tr>`;
      }).join('');
  }

  const dashCaja = document.getElementById('dash-caja');
  if(dashCaja) {
      const ingresos = DATA.caja.movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
      const egresos = DATA.caja.movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
      const totalCaja = DATA.caja.fondo + ingresos - egresos;
      dashCaja.innerHTML = `
        <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja.fondo)}</span></div>
        <div class="caja-line"><span class="l">Ingresos</span><span class="v">${fmt(ingresos)}</span></div>
        <div class="caja-line"><span class="l">Egresos</span><span class="v">-${fmt(egresos)}</span></div>
        <div class="caja-total"><span class="l">Total en caja</span><span class="v">${fmt(totalCaja)}</span></div>`;
  }
}

export function renderReportes(){
  const kpis = document.getElementById('reportes-kpis');
  if(!kpis) return;

  const ingresosMes = ventasMensuales[ventasMensuales.length-1].v;
  kpis.innerHTML = `
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div><div class="label">Ingresos del mes</div><div class="value">${fmtK(ingresosMes)}</div><div class="delta up">↑ 17% vs Jul</div></div>
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Ticket promedio</div><div class="value">4.2 días</div><div class="delta up">Tiempo de resolución</div></div>
    <div class="kpi c-violet"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Satisfacción</div><div class="value">94%</div><div class="delta up">↑ 2 pts</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cuentas por cobrar</div><div class="value">${fmt(DATA.creditos.reduce((s,c)=>s+c.saldo,0))}</div><div class="delta flat">${DATA.creditos.length} créditos</div></div>`;

  document.getElementById('reportes-bar-ventas').innerHTML = svgBarChart(ventasMensuales.map(d=>({l:d.l,v:d.v})), {fmt:fmtK, color:'var(--copper)'});

  const porTecnico = {};
  DATA.tickets.forEach(t=>{ porTecnico[t.tecnico] = (porTecnico[t.tecnico]||0) + 1; });
  const tecData = Object.keys(porTecnico).map(k=>({l:k.split(' ')[0], v:porTecnico[k]}));
  document.getElementById('reportes-bar-tecnico').innerHTML = svgBarChart(tecData, {color:'var(--teal)'});

  const porEstado = TICKET_STAGES.map(s=>({label:s.label, value:DATA.tickets.filter(t=>t.stage===s.key).length, color:s.color})).filter(s=>s.value>0);
  renderDonut(document.getElementById('reportes-donut'), porEstado);

  const top = DATA.productos.slice().sort((a,b)=>b.vendidos-a.vendidos).slice(0,5).map(p=>({l:p.nombre, v:p.vendidos}));
  renderHBars(document.getElementById('reportes-top-productos'), top);
}