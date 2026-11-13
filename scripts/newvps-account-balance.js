/* Sync existing dashboard balance displays with the authenticated server balance.
   Never create a new panel or use the archived $0.00 placeholder as account data. */
(function(){
 'use strict';
 const endpoint='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/account-api';
 let lastValue=null;
 let observer=null;
 let applying=false;
 const selectors=[
  '.dash-stat-balance .dash-stat-val',
  '.dash-nav-cnt-bal',
  '.dash-mobar-bal span',
  '.dash-drawer-bal',
  '.tu-bal-row:not(.tu-bal-add) strong'
 ];
 function paint(value){
  if(!value||applying)return;
  applying=true;
  try{
   // Remove the temporary banner added by the earlier integration.
   document.querySelectorAll('[data-newvps-account-balance]').forEach(el=>el.remove());
   for(const selector of selectors){
    document.querySelectorAll(selector).forEach(el=>{
     const formatted='$'+value+(el.matches('.dash-drawer-bal')?' credit':'');
     if(el.textContent!==formatted)el.textContent=formatted;
    });
   }
   // The original zero-balance styling is only appropriate when balance is zero.
   document.querySelectorAll('.dash-stat-balance').forEach(el=>{
    el.classList.toggle('dash-stat-balance-zero',Number(value)===0);
   });
  }finally{applying=false}
 }
 async function refresh(){
  const token=sessionStorage.getItem('newvps_session');
  if(!token||!/^[0-9a-f]{64}$/.test(token)){
   lastValue=null;
   document.querySelectorAll('[data-newvps-account-balance]').forEach(el=>el.remove());
   return;
  }
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'me'}),cache:'no-store'});
   if(!r.ok)return;
   const j=await r.json();
   const value=j.account&&j.account.balance_usd;
   if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))return;
   lastValue=value;
   paint(value);
  }catch(e){console.warn('Balance fetch deferred',e)}
 }
 function start(){
  refresh();
  // Archived dashboard navigation can replace its markup after initial render.
  observer=new MutationObserver(function(){
   if(applying||!lastValue)return;
   const mismatched=selectors.some(selector=>Array.from(document.querySelectorAll(selector)).some(el=>el.textContent!==('$'+lastValue+(el.matches('.dash-drawer-bal')?' credit':''))));
   if(mismatched||document.querySelector('[data-newvps-account-balance]'))paint(lastValue);
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refresh()});
  window.addEventListener('pageshow',refresh);
  setInterval(refresh,60000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();