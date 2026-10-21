'use strict';
// The exact toy curve and generator from Homework 1: y^2 = x^3 + 7 (mod 17).
const P=17, INF=null, G=[1,5], d=6, KEY_MAX=48;
const $=id=>document.getElementById(id);
const mod=n=>((n%P)+P)%P;
function inv(v){v=mod(v);if(!v)throw Error('Zero has no inverse');for(let i=1;i<P;i++)if(mod(i*v)===1)return i;throw Error('Not invertible');}
function add(A,B){if(A===INF)return B;if(B===INF)return A;let [x1,y1]=A,[x2,y2]=B;if(x1===x2&&mod(y1+y2)===0)return INF;let slope;if(x1===x2&&y1===y2)slope=mod(3*x1*x1*inv(2*y1));else slope=mod((y2-y1)*inv(x2-x1));let x3=mod(slope*slope-x1-x2);return [x3,mod(slope*(x1-x3)-y1)];}
function multiply(k,pt){let out=INF,base=pt;while(k>0){if(k%2)out=add(out,base);base=add(base,base);k=Math.floor(k/2);}return out;}
function order(pt){let cur=INF;for(let n=1;n<=40;n++){cur=add(cur,pt);if(cur===INF)return n;}return 0;}
const equal=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a[0]===b[0]&&a[1]===b[1];
const bytes=new TextEncoder(),decode=new TextDecoder();
const hex=arr=>Array.from(arr,v=>v.toString(16).padStart(2,'0')).join('');
const pointstr=pt=>pt===INF?'O (infinity)':`(${pt[0]}, ${pt[1]})`;
// Toy XOR mask: repeats the nonzero shared point's coordinates.
// Deliberately weak, and NOT suitable for real cryptography.
function mask(point,size){if(point===INF)throw Error('Shared point at infinity');return Uint8Array.from({length:size},(_,i)=>point[i%2]);}
const xor=(a,b)=>a.map((v,i)=>v^b[i]);
const Q=multiply(d,G);
let sample=null;
// Choose a fresh ephemeral scalar per encryption; reject values producing a zero shared point.
// The subgroup is tiny (order 9), so this does not make the scheme secure.
function ephemeral(){
  if(!globalThis.crypto?.getRandomValues)throw Error('Secure browser randomness is not available.');
  const n=order(G), random=new Uint8Array(1);
  if(n<2)throw Error('Generator has no usable nonzero multiples.');
  // A single random byte is sampled uniformly; rejection avoids modulo bias.
  const limit=256-(256%(n-1));
  for(let attempt=0;attempt<1000;attempt++){
    globalThis.crypto.getRandomValues(random);
    if(random[0]>=limit)continue;
    const r=1+(random[0]%(n-1));
    if(multiply(r,Q)!==INF)return r;
  }
  throw Error('No usable ephemeral scalar was found.');
}
function encryptECC(message){
  const r=ephemeral(),R=multiply(r,G),secret=multiply(r,Q),original=bytes.encode(message);
  return {r,R,cipher:xor(original,mask(secret,original.length))};
}
function decryptECC(encrypted,privateKey){const shared=multiply(privateKey,encrypted.R);return decode.decode(xor(encrypted.cipher,mask(shared,encrypted.cipher.length)));}
function caesar(s,k){return s.replace(/[a-z]/gi,ch=>{const base=ch>='a'&&ch<='z'?97:65;return String.fromCharCode(base+(((ch.charCodeAt(0)-base+k)%26)+26)%26);});}
function key(){const k=Number($('shift').value);if(!Number.isInteger(k)||k<0||k>25)throw Error('The shift must be an integer between 0 and 25.');return k;}
function message(){return $('message').value;}
function error(id,e){$(id).textContent=e.message;$(id).classList.add('error');}
$('eccRun').onclick=()=>{try{sample=encryptECC(message());$('eccResult').classList.remove('error');$('eccResult').textContent=`Curve: y² = x³ + 7 (mod 17)\nGenerator G: ${pointstr(G)} (order ${order(G)})\nPrivate key d: ${d}\nPublic key Q = dG: ${pointstr(Q)}\nEphemeral scalar r (new per run): ${sample.r}\nEphemeral point R = rG: ${pointstr(sample.R)}\nCiphertext (hex): ${hex(sample.cipher)}\nDecrypted message: ${decryptECC(sample,d)}`;}catch(e){error('eccResult',e);}};
$('caesarRun').onclick=()=>{try{const k=key(),c=caesar(message(),k);$('caesarResult').classList.remove('error');$('caesarResult').textContent=`Key: ${k}\nCiphertext: ${c}\nDecrypted message: ${caesar(c,-k)}`;}catch(e){error('caesarResult',e);}};
// English reference corpus written independently of the held-out length-test passage.
const reference=`A scientific investigation begins with a clear question and a method that another person can repeat. Researchers gather measurements, summarize their observations, compare results, and examine the evidence before drawing conclusions. A statistical model describes variation and uncertainty rather than promising that every outcome will be identical. When a sample is small, individual observations may have an unusually large effect on the result. When many observations are available, stable patterns are easier to identify. Statistical reasoning is valuable in computing, engineering, medicine, education, and social research. It helps us distinguish a meaningful signal from random noise. The choice of data matters because a biased collection can lead to a misleading interpretation. Good experiments document their assumptions and use independent examples when evaluating a method. A computer program makes repetitive calculations faster, but correct conclusions still require careful reasoning. When teaching a complex topic, a concrete example often makes an abstract formula easier to understand. Students can verify a result by changing an input and observing whether the outcome matches the predicted behavior. Security systems use mathematics to protect information while allowing authorized participants to recover messages. A secret key must remain unknown to an attacker. If the set of candidate keys is tiny, trying each one can be practical. Encryption should not reveal recognizable patterns from the original text. An attacker may exploit repeated structures or strong language regularities when a cipher does not disguise them. The aim of cryptanalysis is to understand which assumptions a security claim depends on. Experiments should describe both successful cases and limitations. Reliable work explains how its conclusions were obtained and where they may fail. Historical cryptography provides useful examples of systems that looked mysterious but were later defeated by simple mathematical arguments.`;
const heldout=`The library was quiet in the early morning. Students arrived with notebooks and computers, and the windows opened toward a garden filled with trees. A lecturer explained how a small observation could suggest a general pattern, but also warned that a reliable conclusion requires enough evidence. During the afternoon, the group examined different messages and measured the appearance of common letters. They found that short passages often contain irregular patterns, while longer passages resemble the ordinary distribution of written English. This observation helped them recover the hidden shift in a simple substitution cipher. After the experiment, they discussed why recognizing language patterns does not reveal the secret of a well designed modern encryption system. Each student recorded the result, considered its limitations, and repeated the test using additional text. The purpose of the exercise was not simply to find the answer, but to discover why the method worked and when it might fail. Careful comparisons between simple models and practical systems help learners recognize which assumptions determine their security. Additional measurements made their conclusions more stable, although there was still uncertainty whenever the amount of text was small.`;
function letters(s){return s.toUpperCase().replace(/[^A-Z]/g,'');}
function count(s){const v=Array(26).fill(0);for(const ch of letters(s))v[ch.charCodeAt(0)-65]++;return v;}
const refCount=count(reference),refTotal=refCount.reduce((a,b)=>a+b,0);
// Laplace smoothing avoids zero expectations in the chi-square denominator.
const probabilities=refCount.map(n=>(n+1)/(refTotal+26));
function recover(cipher){const N=letters(cipher).length;if(!N)throw Error('At least one English letter is required.');let best={key:0,score:Infinity,plaintext:''};for(let k=0;k<26;k++){const p=caesar(cipher,-k),observed=count(p);const score=observed.reduce((s,o,i)=>s+(o-N*probabilities[i])**2/(N*probabilities[i]),0);if(score<best.score)best={key:k,score,plaintext:p};}return best;}
$('caesarAttack').onclick=()=>{try{const ciphertext=caesar(message(),key()),result=recover(ciphertext);$('caesarAttackResult').classList.remove('error');$('caesarAttackResult').textContent=`Ciphertext: ${ciphertext}\nRecovered key: ${result.key}\nChi-square: ${result.score.toFixed(2)}\nRecovered plaintext: ${result.plaintext}\nMatches actual key: ${result.key===key()?'YES':'NO'}`;}catch(e){error('caesarAttackResult',e);}};
// A fixed seed makes the 300 random-window experiments reproducible.
// This seeded generator is ONLY for the statistics experiment, never for ECC keys.
function seededRandom(seed){return function(){seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
$('lengthTest').onclick=()=>{
  const text=letters(heldout),sizes=[5,10,20,50,100,250,500,900],trials=300;
  const rand=seededRandom(20261021);
  $('lengthBody').innerHTML=sizes.filter(n=>n<=text.length).map(n=>{
    let correct=0;
    for(let trial=0;trial<trials;trial++){
      const start=Math.floor(rand()*(text.length-n+1));
      const k=1+Math.floor(rand()*25);
      const cipher=caesar(text.slice(start,start+n),k);
      if(recover(cipher).key===k)correct++;
    }
    const rate=(correct/trials*100).toFixed(1);
    return `<tr><td>${n}</td><td>${trials}</td><td>${correct}</td><td class="${correct===trials?'outcome':''}">${rate}%</td></tr>`;
  }).join('');
};
// Small empirical comparison: a Caesar shift exactly preserves letter-frequency
// statistics, while the toy ECC XOR changes bytes without guaranteeing security.
function shannon(counts){
  const n=counts.reduce((a,b)=>a+b,0);
  if(n===0)return null;
  return counts.reduce((h,c)=>c?h-(c/n)*Math.log2(c/n):h,0);
}
function coincidence(counts){
  const n=counts.reduce((a,b)=>a+b,0);
  if(n<2)return null;
  return counts.reduce((sum,c)=>sum+c*(c-1),0)/(n*(n-1));
}
function byteCounts(data){const counts=Array(256).fill(0);for(const v of data)counts[v]++;return counts;}
const showNumber=n=>n===null?'N/A':n.toFixed(4);
$('statRun').onclick=()=>{try{
  const original=message(),shifted=caesar(original,key()),ecc=encryptECC(original);
  const pLetters=count(original),cLetters=count(shifted);
  $('statResult').classList.remove('error');
  $('statResult').textContent=`Index of coincidence (letters A-Z):\n  Plaintext: ${showNumber(coincidence(pLetters))}  |  Caesar: ${showNumber(coincidence(cLetters))}\nShannon entropy (letters, bits/letter):\n  Plaintext: ${showNumber(shannon(pLetters))}  |  Caesar: ${showNumber(shannon(cLetters))}\nShannon entropy (UTF-8 bytes, bits/byte):\n  Plaintext: ${showNumber(shannon(byteCounts(bytes.encode(original))))}  |  Toy ECC: ${showNumber(shannon(byteCounts(ecc.cipher)))}`;
}catch(e){error('statResult',e);}};
$('eccAttack').onclick=()=>{try{if(!sample)throw Error('Please encrypt a message with ECC first.');let found=null,tries=0;const matches=[];for(let guess=1;guess<=KEY_MAX;guess++){tries++;if(equal(multiply(guess,G),Q)){matches.push(guess);if(found===null)found=guess;}}if(found===null)throw Error('No matching scalar found.');$('eccAttackResult').classList.remove('error');$('eccAttackResult').textContent=`Public key Q: ${pointstr(Q)}\nCandidate keys checked: ${tries}\nMatching private keys (1–48): ${matches.join(', ')}\nFirst recovered equivalent key: ${found}\nOriginal example key: ${d}\nRecovered plaintext: ${decryptECC(sample,found)}\nWhy multiple matches? G has order ${order(G)}, so keys congruent modulo ${order(G)} give the same public point.`;}catch(e){error('eccAttackResult',e);}};
