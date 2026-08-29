// js/core/charts.js
export function svgBarChart(data, opts){
  opts = opts || {};
  const w = opts.width || 480, h = opts.height || 170, pad = 26, gap = opts.gap || 16;
  const max = Math.max(...data.map(d=>d.v)) * 1.2 || 1;
  const bw = (w - pad*1.4) / data.length - gap;
  let bars = '', labels = '';
  data.forEach((d,i)=>{
    const bh = max ? (d.v/max) * (h-38) : 0;
    const x = pad + i*(bw+gap);
    const y = h - 28 - bh;
    const color = opts.color || 'var(--copper)';
    bars += '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="5" fill="'+color+'" opacity="'+(i===data.length-1?1:0.55)+'"></rect>';
    bars += '<text x="'+(x+bw/2)+'" y="'+(y-7)+'" text-anchor="middle" class="chart-val">'+(opts.fmt?opts.fmt(d.v):d.v)+'</text>';
    labels += '<text x="'+(x+bw/2)+'" y="'+(h-8)+'" text-anchor="middle" class="chart-lbl">'+d.l+'</text>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" class="bar-svg"><line x1="'+(pad-6)+'" y1="'+(h-28)+'" x2="'+(w-4)+'" y2="'+(h-28)+'" stroke="var(--line)" stroke-width="1"></line>'+bars+labels+'</svg>';
}

export function renderDonut(containerEl, segments){
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  let acc = 0;
  const stops = segments.map(s=>{
    const start = acc/total*360; acc += s.value; const end = acc/total*360;
    return s.color+' '+start.toFixed(1)+'deg '+end.toFixed(1)+'deg';
  }).join(', ');
  containerEl.querySelector('.donut-ring').style.background = 'conic-gradient('+stops+')';
  containerEl.querySelector('.donut-center b').textContent = total;
  containerEl.querySelector('.donut-legend').innerHTML = segments.map(s=>
    '<div class="dl-item"><span class="dl-dot" style="background:'+s.color+'"></span>'+s.label+'<b>'+s.value+'</b></div>'
  ).join('');
}

export function renderHBars(container, data, opts){
  const max = Math.max(...data.map(d=>d.v)) || 1;
  container.innerHTML = data.map(d=>
    '<div class="hbar-row"><div class="hbar-lbl">'+d.l+'</div><div class="hbar-track"><div class="hbar-fill" style="width:'+(d.v/max*100).toFixed(0)+'%"></div></div><div class="hbar-val">'+d.v+'</div></div>'
  ).join('');
}