/* Restore captured language selector interaction without editing archived HTML. */
(function(){
  'use strict';
  function init(){
    document.querySelectorAll('.lang-sw').forEach(function(wrapper){
      const button=wrapper.querySelector('.lang-btn');
      const menu=wrapper.querySelector('.lang-menu');
      if(!button||!menu)return;
      const options=menu.querySelectorAll('a.lang-opt');
      if(!options.length)return;
      // Existing archive already provides English, Russian and Simplified Chinese.
      let open=false;
      function toggle(next){
        open=next;button.setAttribute('aria-expanded',String(open));
        wrapper.classList.toggle('open',open);
        menu.style.setProperty('display',open?'block':'none','important');
        menu.style.setProperty('visibility',open?'visible':'hidden','important');
        menu.style.setProperty('opacity',open?'1':'0','important');
        menu.style.setProperty('pointer-events',open?'auto':'none','important');
        menu.style.setProperty('z-index','9999','important');
      }
      toggle(false);
      button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggle(!open)});
      document.addEventListener('click',function(e){if(!wrapper.contains(e.target))toggle(false)});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});
      options.forEach(function(a){
        const href=a.getAttribute('href');
        if(href&&href.startsWith('/')){
          a.setAttribute('href','/NewVPS'+href);
        }
      });
    });
    document.querySelectorAll('a.mob-lang-opt').forEach(function(a){
      const href=a.getAttribute('href');
      if(href&&href.startsWith('/')&&!href.startsWith('/NewVPS/'))a.setAttribute('href','/NewVPS'+href);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();