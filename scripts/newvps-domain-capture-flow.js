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
   originals.forEach(function(original,index){
     const card=original.cloneNode(true);
     const tld=card.dataset.tld;
     if(!tld)return;
     card.hidden=!showAll&&index>=12;
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
   if(more)more.hidden=showAll||originals.length<=12;
 }
 form.addEventListener('submit',function(event){event.preventDefault();showAll=false;render()});
 if(more)more.addEventListener('click',function(){showAll=true;render()});
 // Preserve the captured cards on initial load; only replace them after search.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();