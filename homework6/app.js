'use strict';
// All calculations are local; no libraries are needed.
const $ = id => document.getElementById(id);
const pi = Math.PI;
const normalDensity = x => Math.exp(-x*x/2) / Math.sqrt(2*pi);
const display = x => !Number.isFinite(x) ? '—' : Math.abs(x)<1e-5 && x!==0 ? x.toExponential(5) : x.toFixed(9);
const errorText = x => x === 0 ? '0' : x.toExponential(3);
function gcd(a,b) { while (b) [a,b] = [b,a%b]; return a; }
function sincMeasure(y) {
  if (y<=0) return pi;
  if (y>=1) return 0;
  let a=0,b=pi;
  for(let i=0;i<44;i++) {
    const m=(a+b)/2;
    if(Math.sin(m)/m>y) a=m; else b=m;
  }
  return (a+b)/2;
}
const functions = {
  sin: {name:'sin(x)', a:0,b:pi,H:1,exact:2, f:x=>Math.sin(x),m:t=>t<=0?pi:t>=1?0:pi-2*Math.asin(t), note:'Both sums approach the exact integral 2.'},
  square: {name:'x²',a:0,b:1,H:1,exact:1/3,f:x=>x*x,m:t=>t<=0?1:t>=1?0:1-Math.sqrt(t),note:'The measure m(t) = 1 − √t can be calculated directly.'},
  step13:{name:'Step (1, 3)',a:0,b:1,H:3,exact:2,f:x=>x<.5?1:3,m:t=>t<1?1:t<3?.5:0,note:'A single jump does not prevent Riemann integration. For even N, the midpoint rule is exact.'},
  abs:{name:'|x − 0.5|',a:0,b:1,H:.5,exact:.25,f:x=>Math.abs(x-.5),m:t=>t<=0?1:t>=.5?0:1-2*t,note:'The corner in the graph does not prevent either integral.'},
  inverse:{name:'1/√x',a:0,b:1,H:Infinity,exact:2,f:x=>1/Math.sqrt(x),m:t=>t<=1?1:1/(t*t),note:'This is an improper integral. The range method includes an analytical tail correction.'},
  step10:{name:'Step (1, 0)',a:0,b:1,H:1,exact:.5,f:x=>x<.5?1:0,m:t=>t<1?.5:0,note:'Both integrals equal 0.5.'},
  sinc:{name:'sin(x)/x',a:0,b:pi,H:1,exact:1.8519370519824662,f:x=>x===0?1:Math.sin(x)/x,m:sincMeasure,note:'At zero I define sin(x)/x = 1, its continuous limit. The measure is found by bisection.'},
  dirichlet:{name:'Dirichlet',a:0,b:1,H:1,exact:0,pathology:true,m:t=>0,note:'The Lebesgue integral is 0. Rational grid points give a sum of 1, but the Riemann integral does not exist.'},
  thomae:{name:'Thomae',a:0,b:1,H:1,exact:0,pathology:true,m:t=>0,note:'The nonzero values lie on rational numbers, a set of measure zero. The Riemann sums tend to 0.'}
};
function riemann(F,n) {
  const h=(F.b-F.a)/n;
  let sum=0;
  for(let i=0;i<n;i++) {
    if(F===functions.dirichlet) sum+=1; // midpoints of a rational uniform grid
    else if(F===functions.thomae) sum+=gcd(2*i+1,2*n)/(2*n);
    else sum+=F.f(F.a+(i+.5)*h);
  }
  return h*sum;
}
function lebesgue(F,k) {
  const H=Number.isFinite(F.H)?F.H:Math.sqrt(k);
  const d=H/k;
  let lower=0,upper=0;
  for(let j=0;j<k;j++) {
    upper+=d*F.m(j*d);
    lower+=d*F.m((j+1)*d);
  }
  // For f(x)=1/sqrt(x), m(t)=1/t² when t>1.
  const tail=Number.isFinite(F.H)?0:1/H;
  return (lower+upper)/2+tail;
}
function drawCurve(canvas,F) {
  const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height,p=32;
  c.clearRect(0,0,W,H);
  c.strokeStyle='#455569';c.lineWidth=1;
  c.beginPath();c.moveTo(p,12);c.lineTo(p,H-p);c.lineTo(W-12,H-p);c.stroke();
  if(F.pathology){c.fillStyle='#a1aec1';c.font='18px system-ui';c.fillText('Dense rational and irrational points are not plotted.',p+20,H/2);return;}
  const max=Number.isFinite(F.H)?F.H:5;
  c.strokeStyle='#7ce9c9';c.lineWidth=3;c.beginPath();
  for(let i=0;i<=500;i++){
    const x=F.a+(F.b-F.a)*(i/500),v=Math.min(max,F.f(Math.max(x,1e-10)));
    const px=p+(W-p-12)*i/500,py=(H-p)-(H-p-20)*v/max;
    if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
  }
  c.stroke();c.fillStyle='#a1aec1';c.font='14px system-ui';c.fillText('a',p,H-8);c.fillText('b',W-20,H-8);
}
function runIntegration(){
  const F=functions[$('function').value],n=Number($('resolution').value),r=riemann(F,n),l=lebesgue(F,n);
  $('exact').textContent=display(F.exact);
  $('riemann').textContent=display(r);
  $('lebesgue').textContent=display(l);
  $('integration-note').textContent=F.note;
  $('integration-table').innerHTML=[16,32,64,128,256,512,1024].map(k=>{
    const a=riemann(F,k),b=lebesgue(F,k);
    return `<tr><td>${k}</td><td>${display(a)}</td><td>${errorText(Math.abs(a-F.exact))}</td><td>${display(b)}</td><td>${errorText(Math.abs(b-F.exact))}</td></tr>`;
  }).join('');
  drawCurve($('function-chart'),F);
}
function trap(z,n){
  const h=z/n;let s=(normalDensity(0)+normalDensity(z))/2;
  for(let i=1;i<n;i++)s+=normalDensity(i*h);
  return .5+h*s;
}
function simpson(z,n){
  const h=z/n;let s=normalDensity(0)+normalDensity(z);
  for(let i=1;i<n;i++)s+=(i%2?4:2)*normalDensity(i*h);
  return .5+h*s/3;
}
function erfSeriesCDF(z){
  const u=z/Math.SQRT2;
  let term=u,sum=u;
  for(let k=1;k<180;k++){
    term*= -u*u/k;
    const add=term/(2*k+1);
    sum+=add;
    if(Math.abs(add)<1e-16*Math.max(1,Math.abs(sum)))break;
  }
  return .5+sum/Math.sqrt(pi);
}
// Stable benchmark (series around zero and continued fraction in the tails).
// Fixed published values below remain the independent reference for the table.
function referenceCDF(z){
  if(z===0)return .5;
  const a=Math.abs(z);
  if(a<2){
    let term=a,sum=a;
    for(let k=1;k<300;k++){
      term*=a*a/(2*k+1);sum+=term;
      if(term<1e-17*sum)break;
    }
    const v=.5+normalDensity(a)*sum;
    return z>0?v:1-v;
  }
  let denominator=a;
  for(let k=160;k>=1;k--)denominator=a+k/denominator;
  const tail=normalDensity(a)/denominator;
  return z<0?tail:1-tail;
}
const published = [
  [-4,0.00003167124183311992],[-3,0.0013498980316300957],[-2,0.022750131948179195],[-1,0.15865525393145705],
  [0,0.5],[.5,0.6914624612740131],[1,0.8413447460685429],[1.96,0.9750021048517796],
  [2,0.9772498680518208],[3,0.9986501019683699],[4,0.9999683287581669]
];
function refFor(z){const match=published.find(([x])=>Math.abs(x-z)<1e-12);return match?match[1]:referenceCDF(z);}
function normalGraph(z){
  const cv=$('normal-chart'),c=cv.getContext('2d'),W=cv.width,H=cv.height,p=35;
  const X=t=>p+(t+4.5)/9*(W-p-12),Y=t=>H-p-t/.44*(H-p-12);
  c.clearRect(0,0,W,H);c.strokeStyle='#455569';c.lineWidth=1;
  c.beginPath();c.moveTo(p,H-p);c.lineTo(W-12,H-p);c.stroke();
  c.fillStyle='rgba(124,233,201,.20)';c.beginPath();c.moveTo(X(-4.5),Y(0));
  for(let i=0;i<=450;i++){const t=-4.5+i*.02;if(t>z)break;c.lineTo(X(t),Y(normalDensity(t)));}
  c.lineTo(X(Math.min(4.5,Math.max(-4.5,z))),Y(0));c.closePath();c.fill();
  c.strokeStyle='#7ce9c9';c.lineWidth=3;c.beginPath();
  for(let i=0;i<=450;i++){const t=-4.5+i*.02;i?c.lineTo(X(t),Y(normalDensity(t))):c.moveTo(X(t),Y(normalDensity(t)));}c.stroke();
  c.fillStyle='#a1aec1';c.font='14px system-ui';for(let i=-4;i<=4;i+=2)c.fillText(String(i),X(i)-5,H-10);
}
function runCDF(){
  const z=Number($('z').value),n=Number($('cdf-n').value);
  if(!Number.isFinite(z)||z < -5||z>5){$('cdf-live').innerHTML='<tr><td colspan="3">Please enter z between −5 and 5.</td></tr>';return;}
  const ref=refFor(z),methods=[['Trapezoidal',trap(z,n)],['Simpson',simpson(z,n)],['erf power series',erfSeriesCDF(z)]];
  $('cdf-ref').textContent=display(ref);$('cdf-simpson').textContent=display(methods[1][1]);$('cdf-series').textContent=display(methods[2][1]);
  $('cdf-live').innerHTML=methods.map(([name,v])=>`<tr><td>${name}</td><td>${display(v)}</td><td>${errorText(Math.abs(v-ref))}</td></tr>`).join('');
  normalGraph(z);
}
function populateTables(){
  $('cdf-table').innerHTML=published.map(([z,ref])=>`<tr><td>${z}</td><td>${display(ref)}</td><td>${errorText(Math.abs(trap(z,100)-ref))}</td><td>${errorText(Math.abs(simpson(z,100)-ref))}</td><td>${errorText(Math.abs(erfSeriesCDF(z)-ref))}</td></tr>`).join('');
  $('cdf-convergence').innerHTML=[20,50,100,200,500,1000].map(n=>{
    const ref=published.find(([z])=>z===1.96)[1];
    return `<tr><td>${n}</td><td>${errorText(Math.abs(trap(1.96,n)-ref))}</td><td>${errorText(Math.abs(simpson(1.96,n)-ref))}</td><td>${n+1}</td></tr>`;
  }).join('');
}
$('run-integration').addEventListener('click',runIntegration);
$('run-cdf').addEventListener('click',runCDF);
runIntegration();runCDF();populateTables();
