/* Telegram Mini App enhancement. No token, initData or account credentials are sent to the client API. */
(function(){
  'use strict';
  var tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg)return;
  document.documentElement.classList.add('newvps-telegram-miniapp');
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
  function isAccountPage(){return /\/(dashboard|account|client|panel)(\/|$)/i.test(location.pathname)||/\/(login|profile)(\/|$)/i.test(location.pathname)}
  function render(){
    if(document.getElementById('newvps-tg-link')||!isAccountPage())return;
    var t=labels[locale()],box=document.createElement('section');
    box.id='newvps-tg-link';
    box.style.cssText='box-sizing:border-box;margin:18px auto;padding:18px;max-width:720px;border:1px solid #dbe2ec;border-radius:12px;background:#fff;color:#182235;font:14px/1.55 system-ui,sans-serif';
    var heading=document.createElement('h3');heading.textContent=t.title;heading.style.margin='0 0 6px';
    var intro=document.createElement('p');intro.textContent=t.intro;intro.style.margin='0 0 12px';
    var status=document.createElement('p');status.textContent='';status.style.margin='8px 0';
    var btn=document.createElement('button');btn.type='button';btn.textContent=t.bind;btn.style.cssText='border:0;border-radius:8px;background:#2864df;color:white;padding:10px 18px;cursor:pointer;font-weight:600';
    box.append(heading,intro,btn,status);
    var target=document.querySelector('main')||document.querySelector('[role="main"]')||document.body;
    // Put the control near the top of the dashboard, not below all account sections.
    target.insertBefore(box,target.firstChild);
    btn.addEventListener('click',async function(){
      if(!tg.initData){status.textContent='Telegram identity unavailable. Reopen from @AnonyPortBot.';return}
      var token=sessionStorage.getItem('newvps_session')||localStorage.getItem('newvps_session')||'';
      if(!/^[a-f0-9]{64}$/i.test(token)){status.textContent=t.login;return}
      btn.disabled=true;status.textContent=t.checking;
      try{
        var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'bind',initData:tg.initData}),signal:AbortSignal.timeout(12000)});
        var result=await res.json();
        if(!res.ok)throw Error(result.error||t.fail);
        status.textContent=t.success;btn.textContent=t.linked;btn.disabled=true;
      }catch(e){status.textContent=(e&&e.message)||t.fail;btn.disabled=false}
    });
    if(tg.initData)fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',initData:tg.initData}),signal:AbortSignal.timeout(12000)}).then(function(r){return r.json()}).then(function(d){if(d.linked){status.textContent=t.linked;btn.textContent=t.linked;btn.disabled=true}}).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
  // Do not treat initDataUnsafe as proof of identity. Authentication remains
  // on the existing NewVPS account system until server-side validation exists.
  var style=document.createElement('style');
  style.textContent='html.newvps-telegram-miniapp{scroll-padding-top:env(safe-area-inset-top)}html.newvps-telegram-miniapp body{padding-bottom:env(safe-area-inset-bottom)}';
  document.head.appendChild(style);
})();
