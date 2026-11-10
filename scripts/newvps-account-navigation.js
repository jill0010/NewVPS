/* Navigation for archived NewVPS pages. Does not modify captured source. */
(function(){
  'use strict';
  const base='/NewVPS/';
  function login(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(document.getElementById('newvps-account-overlay'))return;
    const overlay=document.createElement('div');overlay.id='newvps-account-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    const frame=document.createElement('iframe');frame.src=base+'register/?embed=1&view=login';frame.title='NewVPS account login';
    frame.style.cssText='width:min(100%,520px);height:min(100%,740px);border:0;background:transparent';
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close login');
    close.style.cssText='position:absolute;right:16px;top:12px;border:0;background:white;border-radius:6px;padding:6px 12px;font-size:22px;cursor:pointer';
    close.onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
    overlay.append(frame,close);document.body.appendChild(overlay);
  }
  async function logout(event){
    event.preventDefault();event.stopImmediatePropagation();
    const session=sessionStorage.getItem('newvps_session');
    // Revoke the active token with the same account API used by registration.
    try{
      if(session){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),5000);
        try{await fetch('https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/account-api',{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},
          body:JSON.stringify({action:'logout'}),signal:controller.signal
        })}finally{clearTimeout(timeout)}
      }
    }catch(e){console.warn('Remote session revocation unavailable',e)}
    finally{
      sessionStorage.removeItem('newvps_session');
      location.replace(base+'register/');
    }
  }
  document.addEventListener('click',function(e){
    const target=e.target.closest('a,button');if(!target)return;
    if(target.id==='dh-logout'||target.classList.contains('dash-nav-logout')||
       (target.tagName==='BUTTON'&&target.textContent.trim().toLowerCase()==='sign out'&&location.pathname.includes('/account/'))){
      logout(e);return;
    }
    const label=(target.textContent||'').trim().toLowerCase();
    const href=(target.getAttribute('href')||'').trim().toLowerCase();
    if(['login','log in','sign in','登录'].includes(label) ||
       (href==='#'&&/login|sign.?in/i.test(target.getAttribute('aria-label')||''))){
      login(e);
    }
  },true);
})();
