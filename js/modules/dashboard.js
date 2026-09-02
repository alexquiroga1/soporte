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
// ==============================================================
// MOTOR DE NOTIFICACIONES INTELIGENTES
// ==============================================================
export function renderNotificaciones() {
    // Usamos window.DATA como respaldo por si la importación no está arriba
    const bd = typeof DATA !== 'undefined' ? DATA : (window.DATA || { tickets: [], productos: [], creditos: [], caja: {} });
    const notifs = [];
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // 1. Retiros Pendientes (Tickets listos hace +3 días)
    const listos = (bd.tickets || []).filter(t => t.stage === 'listo' && t.fechaListo);
    listos.forEach(t => {
        const diff = Math.ceil(Math.abs(hoy - new Date(t.fechaListo)) / (1000*60*60*24));
        if (diff >= 3) {
            notifs.push({ icon: '📦', title: 'Retiro Pendiente', text: `Ticket #${t.id} de ${t.cliente} lleva ${diff} días listo.`, action: `openTicketModal('${t.id}')`, btn: 'Ver Ticket', time: `${diff}d` });
        }
    });

    // 2. Alertas de Stock Crítico
    const stockBajo = (bd.productos || []).filter(p => p.stock !== '' && p.stock !== null && parseInt(p.stock) <= 5);
    stockBajo.forEach(p => {
        notifs.push({ icon: '⚠️', title: 'Stock Crítico', text: `Quedan solo ${p.stock} unid. de ${p.nombre}.`, action: `goView('productos')`, btn: 'Ver Catálogo', time: 'Sis' });
    });

    // 3. Créditos en Mora (Cuotas Vencidas)
    const creditos = (bd.creditos || []).filter(c => c.saldo > 0);
    creditos.forEach(c => {
         if (c.cuotas) {
             const overdue = c.cuotas.some(q => q.estado === 'Pendiente' && q.vence < hoyStr);
             if (overdue) {
                 notifs.push({ icon: '🔴', title: 'Crédito Vencido', text: `Cliente ${c.cliente} tiene pagos atrasados.`, action: `openClientModal('${c.clienteId}')`, btn: 'Ver Cliente', time: 'Mora' });
             }
         }
    });

    // 4. Caja Abierta tarde (Después de las 19:00hs)
    const hora = hoy.getHours();
    if (hora >= 19 && bd.caja && bd.caja.estado === 'abierta') {
        notifs.push({ icon: '💰', title: 'Cierre de Caja', text: `Es tarde y el corte de caja sigue abierto.`, action: `goView('caja')`, btn: 'Ir a Caja', time: 'Sis' });
    }

    // Dibujar en el HTML
    const ddBody = document.getElementById('notif-list-body');
    const dot = document.getElementById('notif-dot-alert');
    
    if (!ddBody) return;

    if (notifs.length === 0) {
        if (dot) dot.style.display = 'none';
        ddBody.innerHTML = `<div style="padding:30px 20px; text-align:center;"><div style="font-size:24px; margin-bottom:10px;">☕</div><p style="color:var(--muted); font-size:13px; font-weight:500;">Todo al día. No hay notificaciones pendientes.</p></div>`;
        return;
    }

    if (dot) dot.style.display = 'block'; 
    
    ddBody.innerHTML = notifs.map(n => `
        <div style="padding:16px; border-bottom:1px solid var(--line); display:flex; gap:14px; align-items:flex-start; transition:0.2s;">
            <div style="font-size:20px; margin-top:2px;">${n.icon}</div>
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <h4 style="font-size:13px; font-weight:700; color:var(--ink); margin:0;">${n.title}</h4>
                    <span style="font-size:10px; color:var(--copper); font-weight:700;">${n.time}</span>
                </div>
                <p style="font-size:12px; color:var(--muted); line-height:1.4; margin-bottom:10px; margin-top:0;">${n.text}</p>
                <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:6px 12px; background:var(--bg);" onclick="${n.action}">${n.btn}</button>
            </div>
        </div>
    `).join('');
}

export function limpiarNotificaciones() {
    const dot = document.getElementById('notif-dot-alert');
    if (dot) dot.style.display = 'none';
}