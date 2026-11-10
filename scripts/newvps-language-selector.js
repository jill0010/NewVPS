/* Global client-side translation of the original English archive.
   Original captures and routes are not changed. */
(function(){
  'use strict';
  const KEY='newvps_language';
  const languages=['en','ru','zh-CN'];
  let current=localStorage.getItem(KEY)||'en';
  if(!languages.includes(current))current='en';
  const base='/NewVPS/';
  // Immediate local fallback for essential navigation and checkout labels.
  const words={
    ru:{'Home':'Главная','Login':'Войти','Log in':'Войти','Dashboard':'Панель управления','Account':'Аккаунт','Overview':'Обзор','Top up':'Пополнить','Topup balance':'Пополнить баланс','Add credit':'Пополнить счёт','Orders':'Заказы','Services':'Услуги','Support':'Поддержка','Logout':'Выйти','Log out':'Выйти','Language':'Язык','Select language':'Выбрать язык','Order notification':'Уведомление о заказе','订单通知':'Уведомление о заказе','暂无通知。':'Пока нет уведомлений.','Copy amount':'Копировать сумму','Copy address':'Копировать адрес','Back to top up':'Назад к пополнению','What you\'re paying':'Сумма платежа','What you receive':'Вы получите','Reference rate':'Курс','Total':'Итого','Pay with':'Оплатить','SEND EXACTLY':'ОТПРАВЬТЕ ТОЧНО','TO ADDRESS':'НА АДРЕС','Create order':'Создать заказ','Choose amount':'Выбрать сумму','Custom amount':'Другая сумма','Bitcoin':'Биткоин','English':'Английский','Simplified Chinese':'Упрощённый китайский','Russian':'Русский'},
    'zh-CN':{'Home':'首页','Login':'登录','Log in':'登录','Dashboard':'控制面板','Account':'账户','Overview':'概览','Top up':'充值','Topup balance':'充值余额','Add credit':'充值余额','Orders':'订单','Services':'服务','Support':'支持','Logout':'退出登录','Log out':'退出登录','Language':'语言','Select language':'选择语言','Order notification':'订单通知','订单通知':'订单通知','暂无通知。':'暂无通知。','Copy amount':'复制金额','Copy address':'复制地址','Back to top up':'返回充值','What you\'re paying':'支付金额','What you receive':'到账金额','Reference rate':'参考汇率','Total':'总计','Pay with':'支付方式','SEND EXACTLY':'请准确支付','TO ADDRESS':'收款地址','Create order':'创建订单','Choose amount':'选择金额','Custom amount':'自定义金额','Bitcoin':'比特币','English':'英语','Simplified Chinese':'简体中文','Russian':'俄语'}
  };
  const originalText=new WeakMap();
  function localTranslate(root){
    if(current==='en')return;
    const dict=words[current]||{};
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest('script,style,textarea,code,pre,.lang-menu,#newvps-google-translate,.notranslate'))continue;
      const value=node.nodeValue,trim=value.trim();
      if(!trim||trim.length>150)continue;
      if(!originalText.has(node))originalText.set(node,value);
      const translated=dict[trim];
      if(translated)node.nodeValue=value.replace(trim,translated);
    }
  }

  // Google Translate is loaded on demand, never for the default English page.
  function installTranslator(){
    if(document.getElementById('newvps-google-translate'))return;
    const host=document.createElement('div');
    host.id='newvps-google-translate';
    host.style.cssText='position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none;z-index:-1';
    document.body.appendChild(host);
    window.googleTranslateElementInit=function(){
      if(!window.google?.translate?.TranslateElement)return;
      new window.google.translate.TranslateElement({
        pageLanguage:'en',includedLanguages:'ru,zh-CN',
        autoDisplay:false
      },'newvps-google-translate');
      let attempts=0;
      const retry=setInterval(function(){if(applyLanguage()||++attempts>60)clearInterval(retry)},250);
    };
    const script=document.createElement('script');
    script.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async=true;
    script.onerror=function(){console.warn('Global translation service unavailable')};
    document.head.appendChild(script);
  }
  let applying=false;
  function applyLanguage(){
    const select=document.querySelector('#newvps-google-translate select.goog-te-combo');
    if(!select)return false;
    const desired=current==='en'?'':current;
    if(select.value!==desired)select.value=desired;
    if(select.value!==desired)return false;
    if(!applying){
      applying=true;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      setTimeout(function(){applying=false},1200);
    }
    return true;
  }
  function choose(lang){
    if(!languages.includes(lang))return;
    localStorage.setItem(KEY,lang);
    if(lang==='en'){
      // Reset translation cookie and reload the English source.
      document.cookie='googtrans=/en/en;path=/';
      document.cookie='googtrans=/en/en;path=/;domain='+location.hostname;
      location.reload();
      return;
    }
    current=lang;
    document.documentElement.lang=lang;
    document.querySelectorAll('.lang-sw').forEach(function(w){const c=w.querySelector('.lang-btn span:not(.fi)');if(c)c.textContent=lang==='ru'?'RU':'中文'});
    document.cookie='googtrans=/en/'+lang+';path=/;SameSite=Lax';
    installTranslator();
    // Reload is required for Google Translate to pick up a newly selected
    // googtrans cookie consistently, including when switching ru <-> zh-CN.
    location.reload();
  }
  function init(){
    const style=document.createElement('style');
    style.textContent='body{top:0!important}.goog-te-banner-frame,.skiptranslate iframe{display:none!important}';
    document.head.appendChild(style);
    document.querySelectorAll('.lang-sw').forEach(function(wrapper){
      const button=wrapper.querySelector('.lang-btn');
      const menu=wrapper.querySelector('.lang-menu');
      if(!button||!menu)return;
      let open=false;
      function toggle(next){
        open=next;
        button.setAttribute('aria-expanded',String(open));
        wrapper.classList.toggle('open',open);
        for(const [name,value] of Object.entries({
          display:open?'block':'none',visibility:open?'visible':'hidden',
          opacity:open?'1':'0','pointer-events':open?'auto':'none',
          'z-index':'9999'
        }))menu.style.setProperty(name,value,'important');
      }
      toggle(false);
      button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggle(!open)});
      document.addEventListener('click',function(e){if(!wrapper.contains(e.target))toggle(false)});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});
      menu.querySelectorAll('a.lang-opt').forEach(function(a){
        const href=a.getAttribute('href')||'';
        const lang=href.startsWith('/ru/')?'ru':href.startsWith('/zh/')?'zh-CN':'en';
        a.href='#';
        a.addEventListener('click',function(e){e.preventDefault();toggle(false);choose(lang)});
        a.classList.toggle('on',lang===current);
        a.setAttribute('aria-selected',String(lang===current));
      });
      const code=button.querySelector('span:not(.fi)');
      if(code)code.textContent=current==='ru'?'RU':current==='zh-CN'?'中文':'EN';
    });
    document.querySelectorAll('a.mob-lang-opt').forEach(function(a){
      const href=a.getAttribute('href')||'';
      const lang=href.startsWith('/ru/')?'ru':href.startsWith('/zh/')?'zh-CN':'en';
      a.href='#';
      a.addEventListener('click',function(e){e.preventDefault();choose(lang)});
    });
    // Always navigate the English route, preserving language in localStorage.
    document.addEventListener('click',function(e){
      const a=e.target.closest('a[href]');if(!a)return;
      const url=new URL(a.href,location.href);
      if(url.origin!==location.origin||!url.pathname.startsWith(base))return;
      const route=url.pathname.slice(base.length);
      if(route.startsWith('ru/')||route.startsWith('zh/')){
        e.preventDefault();
        location.assign(base+route.replace(/^(ru|zh)\//,'')+url.search+url.hash);
      }
    },true);
    if(current!=='en'){
      localTranslate(document.body);
      const observer=new MutationObserver(function(){localTranslate(document.body)});
      observer.observe(document.body,{childList:true,subtree:true});
      document.cookie='googtrans=/en/'+current+';path=/;SameSite=Lax';
      installTranslator();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();