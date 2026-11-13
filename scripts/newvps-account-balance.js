/* Display only authenticated, server-derived credited balance. */
(function(){
 'use strict';
 const endpoint='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/account-api';
 async function refresh(){
  const token=sessionStorage.getItem('newvps_session');
  if(!token||!/^[0-9a-f]{64}$/.test(token))return;
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'me'}),cache:'no-store'});
   if(!r.ok)return;
   const j=await r.json();
   const value=j.account&&j.account.balance_usd;
   if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))return;
   const el=document.querySelector('[data-newvps-account-balance]');
   if(el){el.textContent='$'+value;return;}
   const container=document.querySelector('main')||document.querySelector('#main')||document.body;
   const note=document.createElement('div');
   note.setAttribute('data-newvps-account-balance','');
   note.setAttribute('role','status');
   note.style.cssText='padding:10px 16px;margin:12px auto;max-width:1080px;border:1px solid #334155;border-radius:6px;font:14px Arial,sans-serif';
   note.textContent='Account balance: $'+value+' USD';
   container.prepend(note);
  }catch(e){console.warn('Balance fetch deferred',e)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
 setInterval(refresh,60000);
})();