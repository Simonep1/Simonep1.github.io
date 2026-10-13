/* Educational cryptographic primitives. No external dependencies and NO real wallet secrets. */
'use strict';
const TEXT=new TextEncoder(),MASK=(1n<<64n)-1n;
export const DEMO_MNEMONIC='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const DEMO_EXPECTED_ADDRESS='0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
export const hex=bytes=>Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
export const fromHex=str=>Uint8Array.from((str.replace(/^0x/,'').match(/.{1,2}/g)||[]),b=>parseInt(b,16));
const concat=(...arrs)=>{let size=arrs.reduce((v,a)=>v+a.length,0),out=new Uint8Array(size),at=0;for(let a of arrs){out.set(a,at);at+=a.length;}return out;};
const big=bytes=>BigInt('0x'+(hex(bytes)||'00'));
const bytes32=n=>fromHex(n.toString(16).padStart(64,'0'));
const u32=n=>Uint8Array.of((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);
export async function mnemonicToSeed(mnemonic=DEMO_MNEMONIC,passphrase=''){
 const secret=TEXT.encode(mnemonic.normalize('NFKD'));
 const key=await crypto.subtle.importKey('raw',secret,'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:TEXT.encode(('mnemonic'+passphrase).normalize('NFKD')),iterations:2048},key,512);
 return new Uint8Array(result);
}
async function hmac512(key,data){const handle=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-512'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',handle,data));}
export const FIELD=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
export const ORDER=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const GX=0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const GY=0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;
const m=(x,p=FIELD)=>(x%p+p)%p;
function inv(a,p=FIELD){let t=0n,nt=1n,r=p,nr=m(a,p);while(nr!==0n){let q=r/nr;[t,nt]=[nt,t-q*nt];[r,nr]=[nr,r-q*nr];}if(r!==1n)throw Error('No inverse');return m(t,p);}
function plus(P,Q){if(P===null)return Q;if(Q===null)return P;let [x1,y1]=P,[x2,y2]=Q;if(x1===x2&&m(y1+y2)===0n)return null;let slope;if(x1===x2&&y1===y2)slope=m(3n*x1*x1*inv(2n*y1));else slope=m((y2-y1)*inv(x2-x1));let x3=m(slope*slope-x1-x2);return [x3,m(slope*(x1-x3)-y1)];}
export function publicPoint(k){if(k<=0n||k>=ORDER)throw Error('Invalid secp256k1 scalar');let result=null,base=[GX,GY];while(k>0n){if(k&1n)result=plus(result,base);base=plus(base,base);k>>=1n;}return result;}
export const publicKeyBytes=point=>concat(bytes32(point[0]),bytes32(point[1]));
function compressed(point){return concat(Uint8Array.of(point[1]&1n?3:2),bytes32(point[0]));}
export async function bip32Master(seed){const i=await hmac512(TEXT.encode('Bitcoin seed'),seed),k=big(i.slice(0,32));if(!k||k>=ORDER)throw Error('Invalid master key');return {key:k,chain:i.slice(32)};}
export async function bip32Child(node,index){const hard=index>=0x80000000,data=hard?concat(Uint8Array.of(0),bytes32(node.key),u32(index)):concat(compressed(publicPoint(node.key)),u32(index));const i=await hmac512(node.chain,data),il=big(i.slice(0,32));if(il>=ORDER)throw Error('Invalid child key');const child=(il+node.key)%ORDER;if(child===0n)throw Error('Invalid child key');return {key:child,chain:i.slice(32)};}
export async function deriveEthNode(seed,addressIndex=0){if(!Number.isSafeInteger(addressIndex)||addressIndex<0||addressIndex>100000)throw Error('Invalid address index');let node=await bip32Master(seed);for(const idx of [44+0x80000000,60+0x80000000,0x80000000,0,addressIndex])node=await bip32Child(node,idx);return node;}
const RC=[0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n];
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const rol=(v,n)=>n===0?v:((v<<BigInt(n))|(v>>BigInt(64-n)))&MASK;
function permutation(a){for(const rc of RC){let c=Array(5).fill(0n),d=Array(5).fill(0n),b=Array(25).fill(0n);for(let x=0;x<5;x++)for(let y=0;y<5;y++)c[x]^=a[x+5*y];for(let x=0;x<5;x++)d[x]=c[(x+4)%5]^rol(c[(x+1)%5],1);for(let x=0;x<5;x++)for(let y=0;y<5;y++){let i=x+5*y;b[y+5*((2*x+3*y)%5)]=rol(a[i]^d[x],ROT[i]);}for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]);a[0]^=rc;}}
// Keccak-256 and NIST SHA3-256 share the 1600-bit permutation, but use different suffix bytes.
export function sponge256(input,suffix=0x01){const rate=136;let a=Array(25).fill(0n),length=Math.ceil((input.length+1)/rate)*rate;if(length<input.length+2)length+=rate;let bytes=new Uint8Array(length);bytes.set(input);bytes[input.length]=suffix;bytes[length-1]|=0x80;for(let block=0;block<length;block+=rate){for(let j=0;j<rate;j++)a[Math.floor(j/8)]^=BigInt(bytes[block+j])<<BigInt(8*(j%8));permutation(a);}let out=new Uint8Array(32);for(let j=0;j<32;j++)out[j]=Number((a[Math.floor(j/8)]>>BigInt(8*(j%8)))&255n);return out;}
export const keccak256=bytes=>sponge256(bytes,0x01);
export const sha3_256=bytes=>sponge256(bytes,0x06);
export function checksumAddress(lowerAddress){let addr=lowerAddress.replace(/^0x/,'').toLowerCase();if(!/^[0-9a-f]{40}$/.test(addr))throw Error('Invalid address');let hash=hex(keccak256(TEXT.encode(addr)));let mixed='';for(let i=0;i<40;i++)mixed+=parseInt(hash[i],16)>=8?addr[i].toUpperCase():addr[i];return '0x'+mixed;}
export function ethAddressFromPublic(pub){const hashBytes=keccak256(pub),raw='0x'+hex(hashBytes.slice(12));return {hash:hex(hashBytes),lower:raw,checksum:checksumAddress(raw)};}
export function fullWalletResult(node){const point=publicPoint(node.key),pub=publicKeyBytes(point);return {privateKey:hex(bytes32(node.key)),pub:hex(pub),point, ...ethAddressFromPublic(pub)};}
export const textBytes=str=>TEXT.encode(str);
