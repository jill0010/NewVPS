/* Telegram Mini App enhancement. No token, initData or account credentials are sent to the client API. */
(function(){
  'use strict';
  var tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg||!tg.initData)return;
  document.documentElement.classList.add('newvps-telegram-miniapp');
  try{
    tg.ready();
    tg.expand();
    if(typeof tg.disableVerticalSwipes==='function')tg.disableVerticalSwipes();
    if(typeof tg.setHeaderColor==='function')tg.setHeaderColor('#ffffff');
    if(typeof tg.setBackgroundColor==='function')tg.setBackgroundColor('#f5f6f8');
  }catch(e){console.warn('Telegram Mini App setup unavailable',e)}
  // Do not treat initDataUnsafe as proof of identity. Authentication remains
  // on the existing NewVPS account system until server-side validation exists.
  var style=document.createElement('style');
  style.textContent='html.newvps-telegram-miniapp{scroll-padding-top:env(safe-area-inset-top)}html.newvps-telegram-miniapp body{padding-bottom:env(safe-area-inset-bottom)}';
  document.head.appendChild(style);
})();
