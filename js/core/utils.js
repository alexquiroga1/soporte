// js/core/utils.js

export const fmt = n => '$' + Number(n).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});
export const fmtK = n => n>=1000 ? '$'+(n/1000).toFixed(1)+'k' : '$'+n;
export const initials = name => name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();

export function fDate(ymd) {
  if(!ymd || !ymd.includes('-')) return ymd;
  const [y, m, d] = ymd.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

export function toast(msg, type){
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>'+msg+'</span>';
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2800);
}

// Función auxiliar para obtener nombre completo
export const getFullName = (c) => c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;

// Agrega esto al final de js/core/utils.js
const _hoy = new Date();
export const addDays = (d) => {
  const nd = new Date(_hoy);
  nd.setDate(nd.getDate() + d);
  return nd.toISOString().split('T')[0];
};