(function(){
'use strict';
function ready(){
 const form=document.getElementById('domSearchForm');
 const input=document.getElementById('domSearchInput');
 const grid=document.getElementById('domGrid');
 const head=document.getElementById('domResultsHd');
 if(!form||!input||!grid||!head)return;
 // Archived static cards and promotional links may still use the former GitHub Pages prefix.
 // Normalize their destinations as well as dynamically generated search results.
 document.querySelectorAll('a[href*="/NewVPS/domain-order/"]').forEach(function(link){
   link.href=link.href.replace('/NewVPS/domain-order/','/domain-order/');
 });
 const cards=[...grid.querySelectorAll('.dom-card')];
 const originals=cards.map(card=>card.cloneNode(true));
 const fallbackTlds=['com','net','org','io','me','co','xyz','app','dev','ai','fr','de','is','li','ch','pw','nl','uk','info','biz','tech','pro','site','online','cc','tv'];
 if(!originals.length){
   fallbackTlds.forEach(function(tld){
     const card=document.createElement('div');card.className='dom-card';card.dataset.tld=tld;
     const label=document.createElement('strong');label.className='dom-card-domain';label.textContent='example.'+tld;
     const meta=document.createElement('div');meta.className='dom-card-meta';meta.textContent='● available · preview';
     const price=document.createElement('strong');price.className='dom-card-price';price.textContent='$14.99';
     const buy=document.createElement('a');buy.className='dom-card-buy';buy.textContent='Buy →';
     card.append(label,meta,price,buy);originals.push(card);
   });
 }
 const title=document.getElementById('domResultsTitle');
 const over=document.getElementById('domResultsOv');
 const more=document.getElementById('domLoadMore');
 const rowsByClick=[4,9,12,14,18,23,28,32];
 let moreClicks=0;
 let searchTimer=null;
 let searchSequence=0;
 const searchDelayMs=1250;
 const popularShortTlds=new Set(['com','net','org','io','co','app','dev','ai','me']);
 // The captured page contains a completed example search; start with an empty field.
 input.value='';
 input.defaultValue='';
 input.removeAttribute('value');
 grid.replaceChildren();
 grid.hidden=true;
 head.hidden=true;
 if(more)more.hidden=true;
 function normalize(value){
   let name=value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');
   name=name.replace(/\.[a-z]{2,}$/,'');
   return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)?name:null;
 }
 function render(){
   const name=normalize(input.value);
   if(!name){
     input.setCustomValidity('Enter a valid domain name');
     input.reportValidity();
     return;
   }
   input.setCustomValidity('');
   head.hidden=false;grid.hidden=false;
   if(over)over.textContent=name.toUpperCase();
   // The capture is a visual demo, not live registrar availability.
   const totalCards=rowsByClick[Math.min(moreClicks,7)]*3;
   if(!originals.length){if(title)title.textContent='No domain templates available';return;}
   grid.replaceChildren();
   let availableCount=0;
   const demoTaken=new Set();
   // Deterministic visual-only states. Never present these as registrar results.
   Array.from({length:totalCards},function(_,index){return originals[index%originals.length]}).forEach(function(card,index){
     const tld=card.dataset.tld||'';
     let hash=2166136261;
     for(const char of name+'.'+tld){hash=Math.imul(hash^char.charCodeAt(0),16777619)}
     if((name.length<=5&&popularShortTlds.has(tld))||(hash>>>0)%7<2)demoTaken.add(index);
   });
   Array.from({length:totalCards},function(_,index){return originals[index%originals.length]}).forEach(function(original,index){
     const card=original.cloneNode(true);
     const tld=card.dataset.tld;
     if(!tld)return;
     card.hidden=false;
     const taken=demoTaken.has(index);
     card.classList.toggle('is-available',!taken);
     card.classList.toggle('is-taken',taken);
     if(taken){
       card.classList.remove('is-featured');
       card.removeAttribute('style');
       card.querySelectorAll('.dom-card-badge,.dom-card-price').forEach(el=>el.remove());
       const meta=card.querySelector('.dom-card-meta');
       if(meta)meta.textContent='● taken';
       const buy=card.querySelector('.dom-card-buy');
       if(buy){
         const badge=document.createElement('span');
         badge.className='dom-card-buy is-disabled';
         badge.textContent='TAKEN';
         badge.setAttribute('aria-disabled','true');
         buy.replaceWith(badge);
       }
     }else{
       availableCount++;
     }
     card.querySelectorAll('.dom-card-domain').forEach(function(node){
       node.replaceChildren(document.createTextNode(name+'.'+tld));
     });
     card.querySelectorAll('a.dom-card-buy').forEach(function(link){
       const domain=name+'.'+tld;
       const priceNode=card.querySelector('.dom-card-price');
       // Read this card's displayed sale price, never a global or default price.
       const candidates=[...(priceNode?.querySelectorAll('*')||[])].filter(el=>el.children.length===0);
       const visiblePrices=[...candidates,priceNode].filter(Boolean).filter(el=>!el.closest('s,del,strike,[style*="line-through"]'));
       const displayed=(visiblePrices.map(el=>el.textContent||'').join(' ')||'');
       const matches=[...displayed.matchAll(/\$\s*(\d+(?:\.\d{2})?)/g)];
       const price=matches.length?matches[matches.length-1][1]:null;
       if(!price){
         link.removeAttribute('href');
         link.setAttribute('aria-disabled','true');
         link.title='No sale price in this captured card';
         return;
       }
       const destination=()=>'/domain-order/?domain='+encodeURIComponent(domain)+'&price='+encodeURIComponent(Number(price).toFixed(2));
       link.href=destination();
       link.dataset.domain=domain;
       link.dataset.price=Number(price).toFixed(2);
       link.addEventListener('click',function(event){
         event.preventDefault();
         location.assign(destination());
       });
     });
     card.querySelectorAll('.dom-card-meta').forEach(function(node){
       const label=node.textContent||'';
       if(/available|可用|доступ/i.test(label)){
         node.title='Visual preview only — availability not checked';
       }
     });
     grid.appendChild(card);
   });
   if(title)title.textContent=availableCount+' available · '+totalCards+' checked (demo)';
   if(more)more.hidden=moreClicks>=7;
 }
 function showLoading(name){
   head.hidden=false;
   grid.hidden=false;
   if(over)over.textContent=name.toUpperCase();
   if(title)title.textContent='Searching '+name+'...';
   if(more)more.hidden=true;
   grid.replaceChildren();
   for(let i=0;i<12;i++){
     const card=document.createElement('div');
     card.className='dom-card';
     card.setAttribute('aria-hidden','true');
     card.style.cssText='min-height:58px;background:#f8f9fb;border:1px dashed #e7eaf0;border-radius:8px;padding:12px;box-sizing:border-box';
     const bar=document.createElement('div');
     bar.style.cssText='height:10px;width:90%;background:#edf0f4;border-radius:4px;margin:2px 0 10px';
     const bar2=document.createElement('div');
     bar2.style.cssText='height:9px;width:55%;background:#edf0f4;border-radius:4px';
     card.append(bar,bar2);
     grid.append(card);
   }
 }
 form.addEventListener('submit',function(event){
   event.preventDefault();
   const name=normalize(input.value);
   if(!name){
     input.setCustomValidity('Enter a valid domain name');
     input.reportValidity();
     return;
   }
   input.setCustomValidity('');
   moreClicks=0;
   clearTimeout(searchTimer);
   const sequence=++searchSequence;
   showLoading(name);
   searchTimer=setTimeout(function(){
     if(sequence!==searchSequence)return;
     // Keep the submitted query stable even if the user types during loading.
     input.value=name;
     render();
   },searchDelayMs);
 });
 if(more)more.addEventListener('click',function(){if(moreClicks<7){moreClicks++;render()}});
 // Preserve the captured cards on initial load; only replace them after search.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();