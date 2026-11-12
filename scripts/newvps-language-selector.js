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
    'zh-CN':{'Home':'首页','Login':'登录','Log in':'登录','Dashboard':'控制面板','Account':'账户','Overview':'概览','Top up':'充值','Topup balance':'充值余额','Add credit':'充值余额','Orders':'订单','Services':'服务','Support':'支持','Logout':'退出登录','Log out':'退出登录','Language':'语言','Select language':'选择语言','Order notification':'订单通知','订单通知':'订单通知','暂无通知。':'暂无通知。','Copy amount':'复制金额','Copy address':'复制地址','Back to top up':'返回充值','What you\'re paying':'支付金额','What you receive':'到账金额','Reference rate':'参考汇率','Total':'总计','Pay with':'支付方式','SEND EXACTLY':'请准确支付','TO ADDRESS':'收款地址','Create order':'创建订单','Choose amount':'选择金额','Custom':'自定义','Custom amount':'自定义金额','Bitcoin':'比特币','English':'英语','Simplified Chinese':'简体中文','Russian':'俄语'}
  };
  // Google Translate can interpret the top-up option "Custom" as
  // "风俗" (customs). Correct this exact UI label after translation,
  // including asynchronous text-node replacements.
  function correctCustomAmountLabel(root){
    if(current!=='zh-CN')return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest('script,style,textarea,code,pre'))continue;
      if(node.nodeValue.trim()==='风俗')node.nodeValue=node.nodeValue.replace('风俗','自定义');
    }
  }
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

  // Hide Google's floating translation launcher and top banner while
  // retaining the underlying translation engine and our own language menu.
  function hideTranslateChrome(){
    if(document.getElementById('newvps-translate-chrome-style'))return;
    const style=document.createElement('style');
    style.id='newvps-translate-chrome-style';
    style.textContent=[
      '.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate',
      '.goog-te-balloon-frame,.goog-te-gadget-icon',
      '#goog-gt-tt,.goog-tooltip,.goog-tooltip:hover',
      '.VIpgJd-ZVi9od-ORHb-OEVmcd',
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf',
      '.VIpgJd-ZVi9od-l4eHX-hSRGPd',
      '.skiptranslate iframe[title*="Translate"]'
    ].join(',')+'{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}'+
    'html,body{top:0!important;}';
    document.head.appendChild(style);
  }
  hideTranslateChrome();
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
  // Keep the flag on the collapsed language button in sync with the selection.
  function syncButtonFlag(wrapper,lang){
    const button=wrapper.querySelector('.lang-btn');
    if(!button)return;
    const flag=button.querySelector('.fi, [class*="fi-"]');
    if(!flag)return;
    const code=lang==='ru'?'ru':lang==='zh-CN'?'cn':'gb';
    Array.from(flag.classList).forEach(function(name){
      if(/^fi-[a-z]{2}(?:-[a-z]+)?$/.test(name))flag.classList.remove(name);
    });
    flag.classList.add('fi','fi-'+code);
    // Archived captures put a fixed background-image inline on the button.
    // That inline image overrides the fi-xx CSS class, so copy the actual
    // flag asset from the corresponding original dropdown option as well.
    const option=Array.from(wrapper.querySelectorAll('.lang-opt')).find(function(a){
      return !!a.querySelector('.fi-'+code);
    });
    const optionFlag=option&&option.querySelector('.fi-'+code);
    if(optionFlag){
      const image=optionFlag.style.backgroundImage||getComputedStyle(optionFlag).backgroundImage;
      if(image&&image!=='none'){
        flag.style.setProperty('background-image',image,'important');
        flag.style.backgroundPosition='50% 50%';
        flag.style.backgroundSize='contain';
        flag.style.backgroundRepeat='no-repeat';
      }
    }
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
    document.querySelectorAll('.lang-sw').forEach(function(w){const c=w.querySelector('.lang-btn span:not(.fi)');if(c)c.textContent=lang==='ru'?'RU':'中文';syncButtonFlag(w,lang)});
    document.cookie='googtrans=/en/'+lang+';path=/;SameSite=Lax';
    installTranslator();
    // Reload is required for Google Translate to pick up a newly selected
    // googtrans cookie consistently, including when switching ru <-> zh-CN.
    localTranslate(document.body);
    correctCustomAmountLabel(document.body);
    document.querySelectorAll('.lang-sw').forEach(function(w){
      const btn=w.querySelector('.lang-btn');
      if(btn){const target=btn.querySelector('span:not(.fi)');if(target)target.textContent=lang==='ru'?'RU':'中文';syncButtonFlag(w,lang);}
      w.querySelectorAll('.lang-opt').forEach(function(a){a.classList.toggle('on',a.dataset.newvpsLang===lang)});
    });
    setTimeout(function(){if(!applyLanguage())installTranslator()},100);
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
        const path=href.replace(/^\/NewVPS(?=\/)/,'').split(/[?#]/)[0];
        const lang=/^\/ru(?:\/|$)/.test(path)?'ru':/^\/zh(?:\/|$)/.test(path)?'zh-CN':'en';
        a.dataset.newvpsLang=lang;
        a.href='#';
        a.addEventListener('click',function(e){e.preventDefault();toggle(false);choose(lang)});
        a.classList.toggle('on',lang===current);
        a.setAttribute('aria-selected',String(lang===current));
      });
      const code=button.querySelector('span:not(.fi)');
      if(code)code.textContent=current==='ru'?'RU':current==='zh-CN'?'中文':'EN';
      syncButtonFlag(wrapper,current);
    });
    document.querySelectorAll('a.mob-lang-opt').forEach(function(a){
      const href=a.getAttribute('href')||'';
      const path=href.replace(/^\/NewVPS(?=\/)/,'').split(/[?#]/)[0];
        const lang=/^\/ru(?:\/|$)/.test(path)?'ru':/^\/zh(?:\/|$)/.test(path)?'zh-CN':'en';
      a.dataset.newvpsLang=lang;
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
      correctCustomAmountLabel(document.body);
      const observer=new MutationObserver(function(){
        localTranslate(document.body);
        correctCustomAmountLabel(document.body);
      });
      observer.observe(document.body,{childList:true,characterData:true,subtree:true});
      document.cookie='googtrans=/en/'+current+';path=/;SameSite=Lax';
      installTranslator();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();