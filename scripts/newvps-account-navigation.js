/* Navigation for archived NewVPS pages. Does not modify captured source. */
(function(){
  'use strict';
  const base='/';
  function login(event){
    event.preventDefault();event.stopImmediatePropagation();
    // iOS Safari and in-app browsers can restrict sessionStorage in embedded
    // documents. Keep the token login on the first-party top-level page.
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.location.assign('/register/?view=login');
      return;
    }
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
  // Receive successful login from the same-origin embedded registration page.
  window.addEventListener('message',function(event){
    if(event.origin!==location.origin||!event.data||event.data.type!=='newvps-account-authenticated')return;
    const overlay=document.getElementById('newvps-account-overlay');
    if(!overlay||event.source!==overlay.querySelector('iframe')?.contentWindow)return;
    overlay.remove();
    window.location.assign('/account/');
  });
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
  // Archived account pages contain a hard-coded token preview. Never show it as
  // the currently authenticated account's token.
  if(/^\/account\/?$/.test(location.pathname)){
    const updatePreview=(label)=>{
      document.querySelectorAll('.acc-tok').forEach(el=>{el.textContent=label});
      document.querySelectorAll('.dh-r [data-copy]').forEach(el=>{
        el.setAttribute('data-copy',label);
        el.setAttribute('title','Masked token hint only; the full access token is not recoverable.');
      });
    };
    updatePreview('****-****-****-****');
    const session=sessionStorage.getItem('newvps_session');
    if(session&&/^[0-9a-f]{64}$/.test(session)){
      fetch('https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/account-api',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},
        body:JSON.stringify({action:'me'}),cache:'no-store'
      }).then(res=>{if(!res.ok)throw Error('Account session unavailable');return res.json()})
        .then(data=>{
          const hint=String(data?.account?.token_hint||'').toUpperCase();
          if(/^[A-Z0-9]{4}$/.test(hint))updatePreview('****-****-****-'+hint);
        }).catch(()=>updatePreview('****-****-****-****'));
    }
  }
  // Keep admin navigation in the authenticated dashboard's existing tab.
  if(/^\/account\/?$/.test(location.pathname)){
    const mountAdminLink=async()=>{
      const token=sessionStorage.getItem('newvps_session');
      if(!token||!/^[0-9a-f]{64}$/.test(token))return;
      try{
        const res=await fetch('https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/account-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'me'}),cache:'no-store'});
        if(!res.ok)return;
        const json=await res.json();
        if(json.account?.role!=='admin')return;
        if(document.getElementById('newvps-admin-analytics-link'))return;
        const link=document.createElement('a');
        link.id='newvps-admin-analytics-link';
        link.href='/admin/analytics/';
        link.textContent='网站流量 / Site analytics';
        link.style.cssText='display:block;padding:12px 16px;margin:8px 0;color:#245fe4;font-weight:600;text-decoration:none;border:1px solid #d9e2f1;border-radius:8px;background:#f8faff';
        // Use the existing account navigation rather than introducing a new dashboard panel.
        const nav=document.querySelector('.dash-sidebar nav, .dash-nav, .dash-sidebar, .dash-side');
        if(nav)nav.appendChild(link);
        else{
          const heading=Array.from(document.querySelectorAll('h1,h2,h3')).find(el=>el.textContent?.trim()==='Dashboard');
          if(heading)heading.parentElement?.appendChild(link);
        }
      }catch(e){console.warn('Admin navigation unavailable',e)}
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAdminLink);
    else mountAdminLink();
  }
  // Mobile Telegram WebView: bypass the captured site's legacy login modal.
  // Its iframe can render as an empty dimmed backdrop on iOS.
  window.addEventListener('click',function(e){
    if(!window.matchMedia('(max-width: 900px)').matches)return;
    const target=e.target&&e.target.closest&&e.target.closest('a,button');
    if(!target||target.closest('#newvps-account-overlay, .dialog, #panel, form'))return;
    const label=(target.textContent||'').trim().toLowerCase();
    const href=(target.getAttribute('href')||'').toLowerCase();
    if(!['login','log in','sign in','登录','登入','登陆'].includes(label)&&
       !(href==='#'&&/login|sign.?in/i.test(target.getAttribute('aria-label')||'')))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.replace('/register/?view=login');
  },true);
  document.addEventListener('click',function(e){
    const target=e.target.closest('a,button');if(!target)return;
    if(target.id==='dh-logout'||target.classList.contains('dash-nav-logout')||
       (target.tagName==='BUTTON'&&target.textContent.trim().toLowerCase()==='sign out'&&location.pathname.includes('/account/'))){
      logout(e);return;
    }
    // Never hijack a form's Login submit or the account dialog's own controls.
    if(target.closest('form, #newvps-account-overlay, .dialog, #panel'))return;
    const label=(target.textContent||'').trim().toLowerCase();
    const href=(target.getAttribute('href')||'').trim().toLowerCase();
    if(['login','log in','sign in','登录','登入','登陆'].includes(label) ||
       (href==='#'&&/login|sign.?in/i.test(target.getAttribute('aria-label')||''))){
      login(e);
    }
  },true);
})();
