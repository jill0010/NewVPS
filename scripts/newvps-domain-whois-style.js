(function(){'use strict';
function init(){
 if(!/\/domain-order\/?$/.test(location.pathname))return;
 const candidates=[...document.querySelectorAll('input[type="checkbox"],input[role="switch"],button[role="switch"]')];
 const toggle=candidates.find(el=>{
   const container=el.closest('label')||el.parentElement?.parentElement;
   return /hide my registrant|whois privacy|public whois/i.test(container?.textContent||'');
 });
 if(!toggle)return;
 const panel=toggle.closest('label')||toggle.parentElement?.parentElement;
 if(!panel)return;
 function sync(){
   const enabled=toggle.matches('input[type="checkbox"]')?toggle.checked:toggle.getAttribute('aria-checked')==='true';
   panel.style.setProperty('background-color',enabled?'':'#ffffff','important');
   panel.style.setProperty('border',enabled?'':'none','important');
   panel.style.setProperty('box-shadow',enabled?'':'none','important');
   const track=toggle.matches('input[type="checkbox"]')?
     (toggle.nextElementSibling||toggle.parentElement):toggle;
   if(track){
     track.style.setProperty('background-color',enabled?'':'#e5e7eb','important');
     track.style.setProperty('border-color',enabled?'':'#d1d5db','important');
     track.style.setProperty('box-shadow',enabled?'':'none','important');
   }
 }
 toggle.addEventListener('change',sync);
 toggle.addEventListener('click',()=>setTimeout(sync,0));
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();