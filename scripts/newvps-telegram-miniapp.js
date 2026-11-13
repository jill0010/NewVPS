/* Telegram Mini App enhancement. No token, initData or account credentials are sent to the client API. */
(function(){
  'use strict';
  var tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg)return;
  document.documentElement.classList.add('newvps-telegram-miniapp');
  // In Telegram's iOS WebView, archived navigation may open an iframe modal
  // behind the mobile menu. Route login to the first-party full page instead.
  window.addEventListener('click',function(event){
    var target=event.target&&event.target.closest&&event.target.closest('a,button');
    if(!target||target.closest('#panel,.dialog,form'))return;
    var label=(target.textContent||'').trim().toLowerCase();
    var href=(target.getAttribute('href')||'').trim().toLowerCase();
    if(['login','log in','sign in','登录','登入','登陆'].includes(label)||
       (href==='#'&&/login|sign.?in/i.test(target.getAttribute('aria-label')||''))){
      event.preventDefault();event.stopImmediatePropagation();
      location.assign('/register/?view=login');
    }
  },true);
  try{
    tg.ready();
    tg.expand();
    if(typeof tg.disableVerticalSwipes==='function')tg.disableVerticalSwipes();
    if(typeof tg.setHeaderColor==='function')tg.setHeaderColor('#ffffff');
    if(typeof tg.setBackgroundColor==='function')tg.setBackgroundColor('#f5f6f8');
  }catch(e){console.warn('Telegram Mini App setup unavailable',e)}
  // Telegram binding is explicit and requires an existing valid NewVPS session.
  // Never use initDataUnsafe as authentication.
  var endpoint='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/newvps-telegram-auth';
  function locale(){
    var lang=(document.documentElement.lang||'').toLowerCase();
    return lang.startsWith('zh')?'zh':lang.startsWith('ru')?'ru':'en';
  }
  var labels={
    zh:{title:'Telegram 账户绑定',intro:'将当前 Telegram 身份绑定到已登录的 AnonyPort 账户。原有访问令牌仍然有效。',bind:'绑定 Telegram',login:'请先使用原有访问令牌登录 AnonyPort，再返回此处绑定。',success:'Telegram 账户已绑定',linked:'此 Telegram 已绑定账户',fail:'绑定失败，请重试',checking:'正在验证 Telegram 身份…'},
    en:{title:'Telegram account',intro:'Link this Telegram identity to your signed-in AnonyPort account. Your existing access token stays valid.',bind:'Link Telegram',login:'Sign in to AnonyPort using your existing access token, then return to link.',success:'Telegram account linked',linked:'Telegram is already linked',fail:'Could not link account. Please retry.',checking:'Verifying Telegram identity…'},
    ru:{title:'Аккаунт Telegram',intro:'Привяжите Telegram к текущему аккаунту AnonyPort. Ваш токен доступа останется действительным.',bind:'Привязать Telegram',login:'Сначала войдите в AnonyPort с токеном доступа.',success:'Telegram привязан',linked:'Telegram уже привязан',fail:'Не удалось привязать аккаунт',checking:'Проверка Telegram…'}
  };
  // Restore a short-lived NewVPS session from a server-verified, already-linked
  // Telegram identity. Never trust initDataUnsafe or store bot credentials.
  var sessionPromise=null;
  function ensureSession(){
    var existing='';
    try{existing=sessionStorage.getItem('newvps_session')||''}catch(e){}
    if(/^[a-f0-9]{64}$/i.test(existing)){sessionStorage.removeItem('newvps_tg_signed_out');return Promise.resolve(existing)}
    if(sessionStorage.getItem('newvps_tg_signed_out')==='1')return Promise.reject(Error('Signed out. Sign in with your access token to continue.'));
    if(sessionPromise)return sessionPromise;
    sessionPromise=(async function(){
      if(!tg.initData)throw Error('Open the Mini App from @AnonyPortBot.');
      var response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session',initData:tg.initData}),cache:'no-store'});
      var data=await response.json();
      if(!response.ok)throw Error(data.error||'Telegram sign-in unavailable');
      if(!/^[a-f0-9]{64}$/i.test(data.session||''))throw Error('Invalid session response');
      sessionStorage.setItem('newvps_session',data.session);
      return data.session;
    })().catch(function(e){sessionPromise=null;throw e});
    return sessionPromise;
  }
  window.newvpsTelegramEnsureSession=ensureSession;
  // Bootstrap on Mini App launch so other account requests can use the session.
  // Defer session restoration until a protected action needs it; avoid blocking page load.
  function isAccountPage(){return /\/(dashboard|account|client|panel)(\/|$)/i.test(location.pathname)||/\/(login|profile)(\/|$)/i.test(location.pathname)}
  // Do not inject a Telegram account panel into the original dashboard layout.
  // Keep server-verified Telegram session restoration for Mini App flows.
  // Do not treat initDataUnsafe as proof of identity. Authentication remains
  // on the existing NewVPS account system until server-side validation exists.
  var style=document.createElement('style');
  style.textContent='html.newvps-telegram-miniapp{scroll-padding-top:env(safe-area-inset-top)}html.newvps-telegram-miniapp body{padding-bottom:env(safe-area-inset-bottom)}';
  document.head.appendChild(style);
})();
