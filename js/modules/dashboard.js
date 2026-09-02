// js/modules/dashboard.js
import { DATA } from '../core/store.js';
import { fmt, fmtK, fDate, getFullName } from '../core/utils.js';
import { calcularDiasMora } from './caja.js';

export function renderDashboard(){
  const abiertos = (DATA.tickets||[]).filter(t=>t.stage!=='entregado' && t.stage!=='cancelado' && t.stage!=='noreparable').length;
  
  const hoyStr = new Date().toLocaleDateString('es-AR');
  const ventasHoy = (DATA.ventas||[]).filter(v => (v.hora||'').includes(hoyStr) || new Date().toISOString().split('T')[0] === v.fecha).reduce((s,v)=>s+v.total,0);
  
  const creditoTotal = (DATA.creditos||[]).reduce((s,c)=>s+c.saldo,0);
  const slaRiesgo = (DATA.tickets||[]).filter(t=>t.prioridad==='P1' && t.stage!=='entregado').length;
  
  const titleEl = document.getElementById('dash-title-negocio');
  if(titleEl) titleEl.textContent = DATA.negocio?.nombre || 'Panel general';

  const dashKpis = document.getElementById('dash-kpis');
  if(dashKpis) {
      dashKpis.innerHTML = `
        <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Tickets abiertos</div><div class="value">${abiertos}</div><div class="delta up">Activos hoy</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6"/></svg></div><div class="label">Ventas del día</div><div class="value">${fmt(ventasHoy)}</div><div class="delta up">Facturado hoy</div></div>
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div><div class="label">Créditos activos</div><div class="value">${fmt(creditoTotal)}</div><div class="delta flat">Por cobrar</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">SLA en riesgo</div><div class="value">${slaRiesgo}</div><div class="delta down">Tickets urgentes</div></div>`;
  }

  const tbody = document.getElementById('dash-tickets-body');
  if (tbody) {
      tbody.innerHTML = (DATA.tickets||[]).slice(0, 5).map(t => {
          const prioCls = t.prioridad.toLowerCase();
          return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')">
            <td><div class="prio ${prioCls}">${t.prioridad}</div></td>
            <td class="mono">#${t.id}</td>
            <td>${t.cliente}</td>
            <td>${t.equipo}</td>
            <td><span class="badge ${t.stage==='entregado'?'done':'prog'}">${t.stage}</span></td>
            <td>${t.tecnico}</td>
          </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:16px;">Sin tickets recientes</td></tr>';
  }

  // PANEL DE EQUIPOS OLVIDADOS (LISTOS SIN RETIRAR)
  const panelRetiros = document.getElementById('panel-retiros');
  const bodyRetiros = document.getElementById('dash-retiros-body');
  
  if (panelRetiros && bodyRetiros) {
      const listos = (DATA.tickets||[]).filter(t => t.stage === 'listo' && t.fechaListo);
      const hoy = new Date();
      let retirosHtml = '';
      let olvidadosCount = 0;

      listos.forEach(t => {
          const fListo = new Date(t.fechaListo);
          const diffTime = Math.abs(hoy - fListo);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if(diffDays >= 3) {
              olvidadosCount++;
              let color = 'var(--amber)'; let icono = '🟠'; let texto = `Listo hace ${diffDays} días`;
              if(diffDays >= 15) { color = 'var(--red)'; icono = '⚠️'; texto = `Hace ${diffDays} días - Contactar urg.`; }
              else if(diffDays >= 7) { color = 'var(--copper)'; icono = '🔴'; texto = `Retiro pendiente hace ${diffDays} días`; }

              retirosHtml += `
              <div style="background:var(--bg); border-left:3px solid ${color}; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                      <div style="font-size:12.5px; font-weight:700; color:var(--ink);">${icono} #${t.id} - ${t.cliente}</div>
                      <div style="font-size:11px; color:var(--muted); margin-top:2px;">${texto}</div>
                  </div>
                  <button class="btn btn-ghost btn-sm" style="padding:4px 8px; font-size:11px;" onclick="openTicketModal('${t.id}')">Ver</button>
              </div>`;
          }
      });

      if (olvidadosCount > 0) {
          panelRetiros.style.display = 'block';
          bodyRetiros.innerHTML = retirosHtml;
      } else {
          panelRetiros.style.display = 'none';
      }
  }

  const cajaBox = document.getElementById('dash-caja');
  if (cajaBox) {
      const movs = DATA.caja?.movs || [];
      const ingresos = movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
      const egresos = movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
      cajaBox.innerHTML = `
        <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja?.fondo || 0)}</span></div>
        <div class="caja-line"><span class="l">Ingresos</span><span class="v">${fmt(ingresos)}</span></div>
        <div class="caja-line"><span class="l">Egresos</span><span class="v">-${fmt(egresos)}</span></div>
        <div class="caja-total"><span class="l">Efectivo total</span><span class="v">${fmt((DATA.caja?.fondo || 0) + ingresos - egresos)}</span></div>
      `;
  }
}

export function renderReportes(){
  const kpis = document.getElementById('reportes-kpis');
  if(!kpis) return;

  const movs = DATA.caja?.movs || [];
  const totalCapitalCobrado = movs.filter(m=>m.tipo==='ingreso' && m.subcategoria==='Capital').reduce((s,m)=>s+m.monto,0);
  const totalPunitoriosCobrado = movs.filter(m=>m.tipo==='ingreso' && m.subcategoria==='Intereses/Punitorios').reduce((s,m)=>s+m.monto,0);
  
  kpis.innerHTML = `
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div><div class="label">Capital Cobrado</div><div class="value">${fmtK(totalCapitalCobrado)}</div><div class="delta up">Recupero de deudas</div></div>
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Punitorios Cobrados</div><div class="value">${fmt(totalPunitoriosCobrado)}</div><div class="delta up">Intereses por mora</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cuentas por cobrar</div><div class="value">${fmt((DATA.creditos||[]).reduce((s,c)=>s+c.saldo,0))}</div><div class="delta flat">${(DATA.creditos||[]).length} carpetas activas</div></div>`;

  document.getElementById('reportes-lista-creditos').innerHTML = (DATA.creditos||[]).map(c => `
      <tr><td class="mono">${fDate(c.fechaOrigen || '')}</td><td>${c.id || '-'}</td><td><b>${c.cliente}</b></td><td>${c.concepto}</td><td class="mono" style="color:var(--teal); font-weight:bold;">${fmt(c.original)}</td></tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Sin créditos registrados.</td></tr>';

  document.getElementById('reportes-lista-cobranzas').innerHTML = movs.filter(m=>m.tipo==='ingreso' && m.concepto.includes('Cobro')).map(m => `
      <tr><td class="mono">${m.hora}</td><td>${m.concepto}</td><td class="mono">${fmt(m.subcategoria === 'Capital' ? m.monto : 0)}</td><td class="mono" style="color:var(--red);">${fmt(m.subcategoria === 'Intereses/Punitorios' ? m.monto : 0)}</td><td class="mono" style="font-weight:bold;">${fmt(m.monto)}</td></tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Sin cobranzas registradas.</td></tr>';

  let morosos = (DATA.creditos||[]).map(c => {
      let mora = c.cuotas ? calcularDiasMora(c.cuotas) : 0;
      let cl = DATA.clientes.find(x => getFullName(x) === c.cliente || x.id === c.clienteId);
      return { cliente: c.cliente, tel: cl ? cl.tel : '—', saldo: c.saldo, mora: mora, id: c.id };
  }).filter(m => m.mora > 0).sort((a,b) => b.mora - a.mora);

  document.getElementById('reportes-lista-morosos').innerHTML = morosos.map(m => `
      <tr><td><b>${m.cliente}</b><br><span style="font-size:11px; color:var(--muted);">Carpeta: ${m.id}</span></td><td class="mono">${m.tel}</td><td class="mono" style="color:var(--red); font-weight:bold;">${m.mora} Días</td><td class="mono" style="font-weight:bold;">${fmt(m.saldo)}</td></tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--muted);">No hay clientes en estado de mora.</td></tr>';
}