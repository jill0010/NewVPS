/* Purchase conversion only after authenticated, server-verified balance credit.
   The server atomically claims each credited order once. Never fire for quote creation. */
(function(){
 'use strict';
 const adsId='AW-18572565164';
 const target=adsId+'/A-2qCKj6ybcdEKy1i5hF';
 const endpoint='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/newvps-ads-purchase';
 let busy=false;
 function loadTag(){
  return new Promise(function(resolve,reject){
   if(window.__newvpsAdsReady){resolve();return;}
   const script=document.createElement('script');
   script.async=true;
   script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(adsId);
   script.onload=function(){
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
    window.gtag('js',new Date());
    window.gtag('config',adsId);
    window.__newvpsAdsReady=true;
    resolve();
   };
   script.onerror=function(){reject(new Error('Google Ads tag unavailable'))};
   document.head.appendChild(script);
  });
 }
 async function check(){
  if(busy||document.visibilityState==='hidden')return;
  const session=sessionStorage.getItem('newvps_session');
  if(!session||!/^[0-9a-f]{64}$/.test(session))return;
  busy=true;
  try{
   await loadTag();
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},body:'{}',cache:'no-store'});
   if(!r.ok)throw new Error('Verified purchase API '+r.status);
   const data=await r.json();
   const p=data.purchase;
   if(!p)return;
   if(typeof p.transaction_id!=='string'||!p.transaction_id||!Number.isFinite(p.value)||p.value<=0||p.currency!=='USD')return;
   window.gtag('event','conversion',{send_to:target,transaction_id:p.transaction_id,value:p.value,currency:'USD'});
  }catch(err){console.warn('Verified purchase conversion deferred:',err)}
  finally{busy=false}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check);else check();
 document.addEventListener('visibilitychange',check);
 setInterval(check,60000);
})();