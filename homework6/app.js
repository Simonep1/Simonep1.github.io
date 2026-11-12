/* Homework 06 — numerical experiments. Plain JavaScript, no dependencies. */
'use strict';

const PI = Math.PI;
const ROOT2PI = Math.sqrt(2 * PI);
const fmt = (x, d = 9) => !Number.isFinite(x) ? (x === Infinity ? '∞' : '—') : (x === 0 ? '0' : (Math.abs(x) >= 1e-4 && Math.abs(x) < 1e6 ? x.toFixed(d).replace(/0+$/, '').replace(/\.$/, '') : x.toExponential(5)));
const errfmt = x => x <= 3e-16 ? (x === 0 ? '0' : x.toExponential(2)) : x.toExponential(3);
const el = id => document.getElementById(id);
const gcd = (a, b) => { while (b) { const r = a % b; a = b; b = r; } return a; };

// Exact (not floating-point rationality testing) evaluation at rational grid tags.
function thomaeGridValue(i, n, tag = 'mid') {
  const numerator = tag === 'left' ? i : tag === 'right' ? i + 1 : 2 * i + 1;
  const denominator = tag === 'mid' ? 2 * n : n;
  return gcd(numerator, denominator) / denominator;
}

function sincMeasure(t) {
  if (t <= 0) return PI;
  if (t >= 1) return 0;
  let lo = 0, hi = PI;
  // sin(x)/x decreases strictly on (0, pi), so the superlevel set is [0, root).
  for (let i = 0; i < 43; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sin(mid) / mid > t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const FUNCTIONS = {
  sin: {name:'sin(x)', a:0, b:PI, H:1, exact:2, classification:'Continuous and Riemann-integrable',
    f:x=>Math.sin(x), m:t=>t>=1?0:t<=0?PI:PI-2*Math.asin(t),
    note:'Smooth curve. Both approaches converge to 2. Midpoint Riemann integration is particularly effective here.'},
  square: {name:'x²', a:0, b:1, H:1, exact:1/3, classification:'Continuous and Riemann-integrable',
    f:x=>x*x, m:t=>t>=1?0:t<=0?1:1-Math.sqrt(t),
    note:'For x² the superlevel set {x : x² > t} has length 1 − √t. This is an example where the range method can use an exact measure.'},
  step13: {name:'1 if x<½; 3 otherwise', a:0, b:1, H:3, exact:2, classification:'One jump, Riemann-integrable',
    f:x=>x<.5?1:3, m:t=>t<1?1:t<3?.5:0,
    note:'A single jump does not prevent Riemann integration. When N is even, the midpoint grid aligns with the jump and happens to give the exact result.'},
  abs: {name:'|x − ½|', a:0, b:1, H:.5, exact:.25, classification:'Continuous with a corner',
    f:x=>Math.abs(x-.5), m:t=>t>=.5?0:t<=0?1:1-2*t,
    note:'The corner at ½ is harmless for integrability. The superlevel measure is m(t) = 1 − 2t for 0 ≤ t < ½.'},
  inverse: {name:'1/√x', a:0, b:1, H:Infinity, exact:2, classification:'Improper Riemann / Lebesgue integrable',
    f:x=>x<=0?Infinity:1/Math.sqrt(x), m:t=>t<=1?1:1/(t*t),
    note:'The left Riemann endpoint is infinite. The range approximation uses H = √K and adds the known tail correction 1/H. Both improper Riemann and Lebesgue integrals equal 2.'},
  step10: {name:'1 if x<½; 0 otherwise', a:0, b:1, H:1, exact:.5, classification:'One jump, Riemann-integrable',
    f:x=>x<.5?1:0, m:t=>t>=1?0:.5,
    note:'This indicator has a single discontinuity, so the integral is ½ in both senses.'},
  sinc: {name:'sin(x)/x', a:0, b:PI, H:1, exact:1.8519370519824662, classification:'Continuous after defining f(0)=1',
    f:x=>Math.abs(x)<1e-12?1:Math.sin(x)/x, m:sincMeasure,
    note:'The removable discontinuity is filled by f(0) = 1. The exact value is the sine integral Si(π). Each range level requires a bisection to find its preimage length.'},
  dirichlet: {name:'Dirichlet', a:0, b:1, H:1, exact:0, classification:'Lebesgue-integrable, not Riemann-integrable', pathology:true,
    m:t=>0,
    note:'Every rational midpoint gives 1, every irrational tag gives 0. Upper and lower Darboux sums stay 1 and 0. The Lebesgue integral is 0 because the rationals have measure zero.'},
  thomae: {name:'Thomae', a:0, b:1, H:1, exact:0, classification:'Riemann- and Lebesgue-integrable', pathology:true,
    m:t=>0,
    note:'Midpoints are exact rational fractions, so their Thomae values are positive. Nevertheless the integral is 0: nonzero values occur on a countable set, and the discontinuity set has measure zero.'}
};

function riemann(F, n, tag='mid') {
  if (F === FUNCTIONS.dirichlet) return 1; // rational grid tags
  const dx = (F.b - F.a) / n;
  let sum = 0;
  for (let i=0; i<n; i++) {
    if (F === FUNCTIONS.thomae) sum += thomaeGridValue(i, n, tag);
    else {
      const offset = tag === 'left' ? 0 : tag === 'right' ? 1 : .5;
      sum += F.f(F.a + (i + offset) * dx);
    }
  }
  return sum * dx;
}

function lebesgue(F, k) {
  const H = Number.isFinite(F.H) ? F.H : Math.sqrt(k);
  const delta = H / k;
  let low = 0, up = 0;
  // Integral of a decreasing superlevel function, approximated from above/below.
  for (let j=0; j<k; j++) {
    up += delta * F.m(j * delta);
    low += delta * F.m((j + 1) * delta);
  }
  const tail = Number.isFinite(F.H) ? 0 : 1/H;
  return {low:low+tail, up:up+tail, mid:(low+up)/2+tail, H, tail, calls:2*k};
}

function randomSource(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s>>>0)+.5) / 4294967296; };
}

function sampledLevels(F, k, probes, seed=123456789) {
  if (F.pathology) return NaN; // cannot infer rationality using floats
  const H = Number.isFinite(F.H) ? F.H : Math.sqrt(k), delta = H / k;
  const rand = randomSource(seed);
  let sum=0;
  for(let i=0;i<probes;i++) {
    const x=F.a + (F.b-F.a)*(i+rand())/probes;
    const v=Math.min(H,Math.max(0,F.f(x)));
    const index=v<=0?0:Math.min(k,Math.ceil(v/delta));
    sum+=index===0?0:(index-.5)*delta;
  }
  const tail=Number.isFinite(F.H)?0:1/H;
  return (F.b-F.a)*sum/probes+tail;
}

// High-precision reference values (80-digit mpmath/erfc, rounded to JS doubles).
// Values can be checked to the displayed NIST table precision.
const CDF_REFERENCE = new Map([
  [-10,7.619853024160526e-24], [-8,6.220960574271784e-16],
  [-6,9.865876450376981e-10], [-5,2.866515718791939e-7],
  [-4,0.00003167124183311992], [-3,0.0013498980316300945],
  [-2,0.022750131948179207], [-1.96,0.024997895148220436],
  [-1,0.15865525393145705], [-.5,0.3085375387259869],
  [0,.5], [.5,0.6914624612740131], [1,0.8413447460685429],
  [1.96,0.9750021048517796], [2,0.9772498680518208],
  [3,0.9986501019683699], [4,0.9999683287581669],
  [5,0.9999997133484281], [6,0.9999999990134123],
  [8,0.9999999999999993], [10,1]
]);
const pdf = x => Math.exp(-.5*x*x) / ROOT2PI;

function cdfTrapezoid(z, n=512) {
  if (z===0) return .5;
  const h=z/n;
  let s=(pdf(0)+pdf(z))/2;
  for(let i=1;i<n;i++) s+=pdf(i*h);
  return .5+h*s;
}
function cdfSimpson(z, n=512) {
  if (n%2) throw new Error('Simpson requires an even number of intervals.');
  if (z===0) return .5;
  const h=z/n;
  let s=pdf(0)+pdf(z);
  for(let i=1;i<n;i++) s+=(i%2?4:2)*pdf(i*h);
  return .5+h*s/3;
}
function cdfErfSeries(z) {
  const u=z/Math.SQRT2;
  let term=u, sum=u;
  for(let k=1;k<350;k++) {
    term *= -u*u / k;
    const add=term/(2*k+1);
    sum+=add;
    if (Math.abs(add)<1e-17*Math.max(1,Math.abs(sum))) break;
  }
  return .5 + sum / Math.sqrt(PI);
}
function cdfPositiveSeries(z) {
  let term=z, sum=z;
  for(let k=1;k<400;k++) {
    term *= z*z/(2*k+1);
    sum += term;
    if(Math.abs(term)<1e-17*Math.max(1,Math.abs(sum))) break;
  }
  return .5+pdf(z)*sum;
}
function cdfTailCF(a, depth=160) {
  // Mills ratio continued fraction; return a positive SMALL tail directly.
  let den=a;
  for(let k=depth;k>=1;k--) den=a+k/den;
  return pdf(a)/den;
}
function cdfHybrid(z) {
  if(z===0) return .5;
  const a=Math.abs(z);
  if(a<2) return cdfPositiveSeries(z);
  const tail=cdfTailCF(a,160);
  return z<0 ? tail : 1-tail;
}
function cdfErfApprox(z) {
  const u=Math.abs(z)/Math.SQRT2;
  const t=1/(1+.3275911*u);
  const p=(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t);
  const tail=.5*p*Math.exp(-u*u);
  return z<0 ? tail : 1-tail;
}
function referenceCDF(z) {
  if (CDF_REFERENCE.has(z)) return CDF_REFERENCE.get(z);
  // For arbitrary input (not tabulated above): numerical reference, distinct resolution.
  // High-resolution quadrature near 0, deep continued fraction in tails.
  if(Math.abs(z)<2.5) return cdfSimpson(z,16384);
  const tail=cdfTailCF(Math.abs(z),600);
  return z<0 ? tail : 1-tail;
}
const cdfMethods = [
  {name:'Trapezoid', run:(z,n)=>cdfTrapezoid(z,n)},
  {name:'Simpson', run:(z,n)=>cdfSimpson(z,n)},
  {name:'erf power series', run:z=>cdfErfSeries(z)},
  {name:'Hybrid: series / continued fraction', run:z=>cdfHybrid(z)},
  {name:'A&S erf approximation', run:z=>cdfErfApprox(z)}
];

function setText(id, value) { el(id).textContent=value; }
function td(value, css='') { return `<td${css?` class="${css}"`:''}>${value}</td>`; }
function numberError(value, reference) { return Number.isFinite(value) ? Math.abs(value-reference) : Infinity; }
function errorClass(e) { return e <= 1e-8 ? 'ok' : e >= 1e-3 ? 'error' : ''; }

// Canvas helpers. All axes are drawn on-device rather than supplied as image assets.
function setupCanvas(id) {
  const canvas=el(id);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(280,Math.round(canvas.getBoundingClientRect().width));
  const h=Number(canvas.getAttribute('height'));
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.height=`${h}px`;
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
const PALETTE={mint:'#7ce9c9', violet:'#bca7ff', orange:'#f0ba86',grid:'#2a3b4c',muted:'#94a9ba',paper:'#dce9f2'};
function chartFrame(ctx,w,h,left=56,bottom=33,right=16,top=12) {
  const plot={x:left,y:top,w:w-left-right,h:h-top-bottom};
  ctx.font='11px system-ui, sans-serif';ctx.textAlign='right';ctx.fillStyle=PALETTE.muted;
  for(let j=0;j<=4;j++) { const y=plot.y+j*plot.h/4;
    ctx.strokeStyle=PALETTE.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(plot.x,y);ctx.lineTo(plot.x+plot.w,y);ctx.stroke(); }
  return plot;
}
function linearAxes(ctx,p,x0,x1,y0,y1,xLabel='x',yLabel='') {
  ctx.font='11px system-ui, sans-serif';ctx.fillStyle=PALETTE.muted;
  for(let j=0;j<=4;j++) {let y=p.y+p.h*(1-j/4);ctx.textAlign='right';ctx.fillText(fmt(y0+(y1-y0)*j/4,2),p.x-8,y+4);}
  for(let j=0;j<=4;j++) {let x=p.x+p.w*j/4;ctx.textAlign='center';ctx.fillText(fmt(x0+(x1-x0)*j/4,2),x,p.y+p.h+20);}
  ctx.textAlign='right';ctx.fillText(xLabel,p.x+p.w,p.y+p.h+32);
  if(yLabel){ctx.textAlign='left';ctx.fillText(yLabel,p.x,p.y-1);}
}
function plotLine(ctx,p,fn,x0,x1,y0,y1,color,width=2) {
  ctx.beginPath();let started=false;
  for(let i=0;i<=450;i++){
    const x=x0+(x1-x0)*i/450,y=fn(x);
    if(!Number.isFinite(y)){started=false;continue;}
    const px=p.x+p.w*(x-x0)/(x1-x0),py=p.y+p.h*(1-(Math.max(y0,Math.min(y1,y))-y0)/(y1-y0));
    if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);
  }
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function placeholder(ctx,w,h,message) {
  ctx.fillStyle=PALETTE.muted;ctx.font='13px system-ui';ctx.textAlign='center';
  const words=message.split(' ');let lines=[],line='';
  words.forEach(word=>{if((line+' '+word).length>38){lines.push(line);line=word;}else line+=(line?' ':'')+word;});lines.push(line);
  lines.forEach((s,i)=>ctx.fillText(s,w/2,h/2+(i-lines.length/2)*21));
}
function drawFunction(F) {
  const {ctx,w,h}=setupCanvas('function-chart');
  if(F.pathology){placeholder(ctx,w,h,'No faithful pointwise graph exists on a finite floating-point grid. See the mathematical discussion below.');return;}
  const p=chartFrame(ctx,w,h);
  const ymax=F===FUNCTIONS.inverse?5: F.H*1.12;
  linearAxes(ctx,p,F.a,F.b,0,ymax,'x','f(x)');
  const boxes=28, dx=(F.b-F.a)/boxes;
  for(let i=0;i<boxes;i++){
    const mid=F.a+(i+.5)*dx;
    const y=Math.min(F.f(mid),ymax),px=p.x+i*p.w/boxes,py=p.y+p.h*(1-y/ymax);
    ctx.fillStyle='rgba(124,233,201,.19)';ctx.fillRect(px,py,p.w/boxes-1,p.y+p.h-py);
    ctx.strokeStyle='rgba(124,233,201,.5)';ctx.strokeRect(px,py,p.w/boxes-1,p.y+p.h-py);
  }
  plotLine(ctx,p,F.f,F.a,F.b,0,ymax,PALETTE.mint,2);
}
function drawMeasure(F,k) {
  const {ctx,w,h}=setupCanvas('measure-chart');
  const H=Number.isFinite(F.H)?F.H:Math.sqrt(k), ymax=F.b-F.a;
  const p=chartFrame(ctx,w,h);
  linearAxes(ctx,p,0,H,0,ymax,'threshold t','m(t)');
  const n=120;
  for(let i=0;i<n;i++){
    const a=i*H/n,b=(i+1)*H/n,m=F.m((a+b)/2),height=p.h*m/ymax;
    ctx.fillStyle='rgba(188,167,255,.19)';ctx.fillRect(p.x+i*p.w/n,p.y+p.h-height,p.w/n+.2,height);
  }
  plotLine(ctx,p,F.m,0,H,0,ymax,PALETTE.violet,2);
}
function drawLogChart(id,lines,minimum=1e-16,maximum=1) {
  const {ctx,w,h}=setupCanvas(id);
  const p={x:66,y:15,w:w-87,h:h-48};
  const all=lines.flatMap(l=>l.values).filter(v=>Number.isFinite(v)&&v>0);
  const smallest=Math.max(minimum, Math.min(...all,1e-9)/3);
  const largest=Math.max(maximum, Math.max(...all,1e-9)*1.3);
  const low=Math.floor(Math.log10(smallest)),high=Math.ceil(Math.log10(largest));
  const xCount=lines[0]?.values.length||1;
  for(let d=low;d<=high;d++) {
    const y=p.y+p.h*(high-d)/(high-low);
    ctx.strokeStyle=PALETTE.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y);ctx.stroke();
    if((high-low)<=12 || (d-low)%2===0){ctx.font='11px system-ui';ctx.fillStyle=PALETTE.muted;ctx.textAlign='right';ctx.fillText(`1e${d}`,p.x-9,y+3);}
  }
  lines.forEach(({values,color})=>{
    ctx.beginPath();let drawing=false;
    values.forEach((v,i)=>{
      if(!Number.isFinite(v)||v<=0){drawing=false;return;}
      const x=p.x+p.w*(i/Math.max(1,xCount-1));
      const y=p.y+p.h*(high-Math.log10(Math.max(v,1e-18)))/(high-low);
      if(!drawing){ctx.moveTo(x,y);drawing=true;}else ctx.lineTo(x,y);
      ctx.fillStyle=color;ctx.fillRect(x-2,y-2,4,4);
    });
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
  });
  ctx.font='11px system-ui';ctx.fillStyle=PALETTE.muted;ctx.textAlign='center';
  (lines[0]?.xs||[]).forEach((x,i)=>ctx.fillText(String(x),p.x+p.w*i/Math.max(1,xCount-1),p.y+p.h+20));
}
function drawNormal(z){
  const {ctx,w,h}=setupCanvas('normal-chart');
  const p=chartFrame(ctx,w,h);
  const a=-4.5,b=4.5,ymax=.46;
  linearAxes(ctx,p,a,b,0,ymax,'z','density');
  const upper=Math.max(a,Math.min(b,z)),n=300;
  if(upper>a){
    ctx.beginPath();ctx.moveTo(p.x,p.y+p.h);
    for(let i=0;i<=n;i++){
      const x=a+(upper-a)*i/n,y=pdf(x);
      ctx.lineTo(p.x+(x-a)/(b-a)*p.w,p.y+p.h*(1-y/ymax));
    }
    ctx.lineTo(p.x+(upper-a)/(b-a)*p.w,p.y+p.h);ctx.closePath();
    ctx.fillStyle='rgba(124,233,201,.23)';ctx.fill();
  }
  plotLine(ctx,p,pdf,a,b,0,ymax,PALETTE.violet,2.5);
  if(z>=a&&z<=b){const x=p.x+(z-a)/(b-a)*p.w;
    ctx.setLineDash([5,4]);ctx.strokeStyle=PALETTE.mint;ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=PALETTE.mint;ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(`z = ${fmt(z,2)}`,Math.min(w-90,x+7),p.y+14);
  }
}

const gridNs=[16,32,64,128,256,512,1024];
function runIntegral() {
  const F=FUNCTIONS[el('function-select').value],n=Number(el('n-select').value),k=Number(el('k-select').value),M=Number(el('m-select').value);
  const r=riemann(F,n), rLeft=riemann(F,n,'left'), rRight=riemann(F,n,'right'), L=lebesgue(F,k),S=sampledLevels(F,k,M);
  const re=numberError(r,F.exact),le=numberError(L.mid,F.exact),se=numberError(S,F.exact);
  setText('int-exact',fmt(F.exact,10));setText('int-riemann',fmt(r,10));setText('int-lebesgue',fmt(L.mid,10));setText('int-sampled',Number.isNaN(S)?'N/A':fmt(S,10));
  setText('int-r-error',`|error| = ${errfmt(re)}`);setText('int-l-error',`|error| = ${errfmt(le)}`);
  setText('int-s-error',Number.isNaN(S)?'Not meaningful for this function':`|error| = ${errfmt(se)}`);
  setText('function-note',`${F.classification}. ${F.note}`);
  const timeMethod=(fn, repeats)=>{for(let i=0;i<3;i++)fn();const start=performance.now();for(let i=0;i<repeats;i++)fn();return 1000*(performance.now()-start)/repeats;};
  const rTime=timeMethod(()=>riemann(F,n),30);
  const lTime=timeMethod(()=>lebesgue(F,k),30);
  const sTime=F.pathology?NaN:timeMethod(()=>sampledLevels(F,k,M),15);
  el('int-method-strip').innerHTML=[`R left / mid / right: ${fmt(rLeft,6)} / ${fmt(r,6)} / ${fmt(rRight,6)}`,`Riemann: ${n} f evaluations · ${fmt(rTime,2)} μs/call`,`Range: ${k} levels, ${2*k} m calls · ${fmt(lTime,2)} μs/call`,`L bounds: [${fmt(L.low,7)}, ${fmt(L.up,7)}]`,`Sampled range: ${F.pathology?'not applicable':M+' f evaluations · '+fmt(sTime,2)+' μs/call'}`].map(s=>`<span>${s}</span>`).join('');
  drawFunction(F);drawMeasure(F,k);runConvergence(F);
}
function runConvergence(F) {
  const rErr=[],lErr=[],sErr=[],rows=[];
  for(const n of gridNs){
    const r=riemann(F,n),L=lebesgue(F,n),s=sampledLevels(F,n,8*n);
    const re=numberError(r,F.exact),le=numberError(L.mid,F.exact),se=numberError(s,F.exact);
    rErr.push(re);lErr.push(le);sErr.push(se);
    rows.push(`<tr>${td(n)}${td(fmt(r,7))}${td(errfmt(re),errorClass(re))}${td(fmt(L.mid,7))}${td(errfmt(le),errorClass(le))}${td(Number.isNaN(s)?'—':errfmt(se),errorClass(se))}</tr>`);
  }
  el('convergence-body').innerHTML=rows.join('');
  drawLogChart('convergence-chart',[
    {values:rErr,xs:gridNs,color:PALETTE.mint},
    {values:lErr,xs:gridNs,color:PALETTE.violet},
    {values:sErr,xs:gridNs,color:PALETTE.orange}
  ]);
  setText('convergence-note',F.pathology ? 'For this case the range integral is exactly zero, while rational midpoint sampling is not a reliable test of integrability. The sampled range-binning method is intentionally omitted.' : F===FUNCTIONS.inverse ? 'The unbounded example uses an explicit tail correction at every K. Its slower convergence illustrates how a singularity changes the numerical problem.' : 'The sampled range method includes both quantisation error (finite K) and estimation error in the preimage measures (finite M). Exact measure-based range sums avoid the latter.');
}
function makeAllFunctionsTable(){
  el('all-functions-body').innerHTML=Object.values(FUNCTIONS).map(F=>{
    const r=riemann(F,256),l=lebesgue(F,256).mid,re=numberError(r,F.exact),le=numberError(l,F.exact);
    return `<tr>${td(F.name)}${td(fmt(F.exact,8))}${td(fmt(r,8))}${td(fmt(l,8))}${td(errfmt(re),errorClass(re))}${td(errfmt(le),errorClass(le))}</tr>`;
  }).join('');
}

function runCDF(){
  let z=Number(el('z-input').value);
  if(!Number.isFinite(z))z=1.96;
  z=Math.max(-10,Math.min(10,z));el('z-input').value=z;
  const n=Number(el('cdf-n').value),reference=referenceCDF(z),simpson=cdfSimpson(z,n),hybrid=cdfHybrid(z);
  const error=(v)=>numberError(v,reference);
  const relative=v=> reference===0 ? NaN : error(v)/reference;
  setText('cdf-reference',fmt(reference,15));setText('cdf-simpson',fmt(simpson,15));setText('cdf-hybrid',fmt(hybrid,15));
  setText('cdf-simpson-error',`|error| ${errfmt(error(simpson))}`);setText('cdf-hybrid-error',`|error| ${errfmt(error(hybrid))}`);
  el('cdf-live-table').innerHTML=cdfMethods.map(method=>{
    const value=method.run(z,n),e=error(value);
    return `<tr>${td(method.name)}${td(fmt(value,15))}${td(errfmt(e),errorClass(e))}${td(errfmt(relative(value)),errorClass(relative(value)))}</tr>`;
  }).join('');
  drawNormal(z);
  const source=CDF_REFERENCE.has(z)?'an embedded high-precision tabulated value':'an independent higher-resolution numerical estimate (not an external table entry)';
  setText('cdf-chart-caption',`Area shaded to the left of z = ${fmt(z,3)}. The reference at this z is ${source}. Plot visible over [−4.5, 4.5].`);
}
function makeCDFReferenceTable() {
  const points=[-10,-8,-6,-5,-3,-2,-1,0,.5,1,1.96,2,3,4,6,8];
  el('cdf-reference-body').innerHTML=points.map(z=>{
    const ref=referenceCDF(z);
    return `<tr>${td(z)}${td(fmt(ref,16))}${td(errfmt(numberError(cdfTrapezoid(z,512),ref)))}${td(errfmt(numberError(cdfSimpson(z,512),ref)))}${td(errfmt(numberError(cdfHybrid(z),ref)))}${td(errfmt(numberError(cdfErfApprox(z),ref)))}</tr>`;
  }).join('');
}
function makeCDFConvergence(){
  const ns=[8,16,32,64,128,256,512,1024,2048];
  const ref=referenceCDF(1.96),T=[],S=[];
  el('cdf-convergence-body').innerHTML=ns.map(n=>{
    const t=numberError(cdfTrapezoid(1.96,n),ref),s=numberError(cdfSimpson(1.96,n),ref);
    T.push(t);S.push(s);
    return `<tr>${td(n)}${td(errfmt(t))}${td(errfmt(s))}${td(n+1)}</tr>`;
  }).join('');
  drawLogChart('cdf-convergence-chart',[{values:T,xs:ns,color:PALETTE.violet},{values:S,xs:ns,color:PALETTE.mint}],1e-16,1e-2);
}
function runBenchmark() {
  const n=512, zValues=[-5,-3,-1.96,-1,0,1,1.96,3,5],rows=[];
  const work=['513 density evaluations','513 density evaluations','Up to 350 series terms','Up to 400 series terms or 160 CF levels','5 polynomial coefficients'];
  cdfMethods.forEach((method,j)=>{
    const loops=j<2?140:3500;
    let sink=0;
    // One warm-up pass to avoid counting initial JIT compilation as method cost.
    for(let i=0;i<60;i++)sink+=method.run(zValues[i%zValues.length],n);
    const start=performance.now();
    for(let i=0;i<loops;i++)sink+=method.run(zValues[i%zValues.length],n);
    const duration=(performance.now()-start)*1000/loops;
    rows.push(`<tr>${td(method.name)}${td(`${duration.toFixed(2)} μs`)}${td(work[j])}</tr>`);
    if(!Number.isFinite(sink))console.warn('Benchmark returned a non-finite aggregate',method.name);
  });
  el('benchmark-body').innerHTML=rows.join('');
}

function init(){
  el('integral-form').addEventListener('submit',e=>{e.preventDefault();runIntegral();});
  el('cdf-form').addEventListener('submit',e=>{e.preventDefault();runCDF();});
  el('function-select').addEventListener('change',runIntegral);
  el('benchmark-button').addEventListener('click',runBenchmark);
  el('to-top').addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
  makeAllFunctionsTable();makeCDFReferenceTable();makeCDFConvergence();runIntegral();runCDF();
  let lastWidth=window.innerWidth;
  window.addEventListener('resize',()=>{if(Math.abs(window.innerWidth-lastWidth)>15){lastWidth=window.innerWidth;runIntegral();runCDF();makeCDFConvergence();}});
}

window.StatisticsHW6={FUNCTIONS,riemann,lebesgue,sampledLevels,cdfTrapezoid,cdfSimpson,cdfErfSeries,cdfHybrid,cdfErfApprox,referenceCDF,CDF_REFERENCE};
document.addEventListener('DOMContentLoaded',init);
