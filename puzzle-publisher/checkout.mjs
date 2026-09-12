/* A-021: links remain empty until deployed server + actual sandbox purchase QA.
 * sessionStorage is only a remembered session credential, never proof of payment.
 */
const API='https://arling-asistent.arling.workers.dev';
const status=document.getElementById('payment-status');
const buy=document.getElementById('buy-pack');
const download=document.getElementById('download-pack');
const retry=document.getElementById('payment-retry');
const query=new URL(location.href).searchParams;
const test=query.get('test')==='1';
const key='publisher:session:'+(test?'test':'live');
let sid=query.get('session_id')||'';
if(sid){try{sessionStorage.setItem(key,sid);}catch{}history.replaceState(null,'',location.pathname+(test?'?test=1':''));}
else{try{sid=sessionStorage.getItem(key)||'';}catch{}}
const track=(event,data={})=>{try{window.umami?.track(event,{produkt:'publisher',test,...data});}catch{}};
let checking=false;
async function verify(){
 if(checking||!sid)return;
 download.hidden=true;retry.hidden=true;
 if(!/^cs_(live|test)_[A-Za-z0-9]{8,200}$/.test(sid)||(!test&&sid.startsWith('cs_test_'))){status.textContent='This payment reference cannot be used here.';return;}
 checking=true;status.textContent='Checking your payment and download.';
 try{
  const r=await fetch(API+'/v1/publisher/status?session_id='+encodeURIComponent(sid),{cache:'no-store',referrerPolicy:'no-referrer'});
  const d=await r.json();
  if(!r.ok||d.paid!==true||d.ready!==true||d.pack!=='slitherlink-pattern-01'||d.livemode===test)throw new Error('unconfirmed');
  status.textContent=test?'Sandbox payment verified. No money changed hands.':'Payment verified. Your ZIP is ready.';
  // The server checks payment again for this attachment. Editing local state
  // or this link cannot bypass its exact-price verification.
  download.href=API+'/v1/publisher/download?session_id='+encodeURIComponent(sid);
  download.hidden=false;track('publisher_paid');
 }catch{status.textContent='We cannot confirm this download yet. Please check again. If you paid, keep your Stripe receipt and contact andrej@arling.sk for help.';retry.hidden=false;}
 finally{checking=false;}
}
retry.addEventListener('click',verify);
download.addEventListener('click',()=>track('publisher_download_paid'));
try{
 const response=await fetch('./checkout-config.json',{cache:'no-store'});const config=await response.json();
 const link=test?config.test:config.live;
 if(config.enabled===true&&typeof link==='string'&&/^https:\/\/buy\.stripe\.com\//.test(link)){
  buy.disabled=false;buy.textContent=test?'Open sandbox checkout':'Buy pack · €19 incl. VAT';
  buy.addEventListener('click',()=>{track('publisher_buy_click');location.href=link;});
 }
}catch{/* Closed checkout remains explicit in the HTML. */}
verify();
