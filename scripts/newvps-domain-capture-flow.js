(function(){
'use strict';
function ready(){
 const form=document.getElementById('domSearchForm');
 const input=document.getElementById('domSearchInput');
 const grid=document.getElementById('domGrid');
 const head=document.getElementById('domResultsHd');
 if(!form||!input||!grid||!head)return;
 const cards=[...grid.querySelectorAll(':scope > .dom-card')];
 const originals=cards.map(card=>card.cloneNode(true));
 const title=document.getElementById('domResultsTitle');
 const over=document.getElementById('domResultsOv');
 const more=document.getElementById('domLoadMore');
 const initialCount=cards.filter(c=>!c.hidden).length||12;
 let showAll=false;
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
   if(title)title.textContent=(showAll?originals.length:Math.min(12,originals.length))+' domain extensions · Preview results';
   grid.replaceChildren();
   let availableCount=0;
   const demoTaken=new Set();
   // Deterministic visual-only states. Never present these as registrar results.
   originals.forEach(function(card,index){
     const tld=card.dataset.tld||'';
     let hash=2166136261;
     for(const char of name+'.'+tld){hash=Math.imul(hash^char.charCodeAt(0),16777619)}
     if((hash>>>0)%7<2)demoTaken.add(index);
   });
   originals.forEach(function(original,index){
     const card=original.cloneNode(true);
     const tld=card.dataset.tld;
     if(!tld)return;
     card.hidden=!showAll&&index>=12;
     const taken=demoTaken.has(index);
     card.classList.toggle('is-available',!taken);
     card.classList.toggle('is-taken',taken);
     if(taken){
       card.classList.remove('is-featured');
       card.removeAttribute('style');
       card.querySelectorAll('.dom-card-badge,.dom-card-price').forEach(el=>el.remove());
       const meta=card.querySelector('.dom-card-meta');
       if(meta)meta.textContent='● taken · demo status';
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
       link.href='/NewVPS/domain-order/?domain='+encodeURIComponent(name+'.'+tld);
     });
     card.querySelectorAll('.dom-card-meta').forEach(function(node){
       const label=node.textContent||'';
       if(/available|可用|доступ/i.test(label)){
         node.title='Visual preview only — availability not checked';
       }
     });
     grid.appendChild(card);
   });
   if(title)title.textContent=availableCount+' available · '+originals.length+' checked (demo)';
   if(more)more.hidden=showAll||originals.length<=12;
 }
 form.addEventListener('submit',function(event){event.preventDefault();showAll=false;render()});
 if(more)more.addEventListener('click',function(){showAll=true;render()});
 // Preserve the captured cards on initial load; only replace them after search.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();