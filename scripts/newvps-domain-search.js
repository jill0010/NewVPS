/* Restore captured domain search UI without inventing registration availability. */
(function(){
'use strict';
function init(){
 const form=document.getElementById('domSearchForm');
 const input=document.getElementById('domSearchInput');
 const grid=document.getElementById('domGrid');
 const header=document.getElementById('domResultsHd');
 const title=document.getElementById('domResultsTitle');
 const over=document.getElementById('domResultsOv');
 const more=document.getElementById('domLoadMore');
 if(!form||!input||!grid||!header)return;
 const tlds=['com','net','org','io','me','co','xyz','app','dev','ai','fr','de','info','biz','site','online','store','tech'];
 let count=12;
 function render(){
   const query=input.value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');
   const name=query.replace(/\.[a-z]{2,}$/,'');
   if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)){
     grid.hidden=false;header.hidden=false;
     if(over)over.textContent='DOMAIN SEARCH';
     if(title)title.textContent='Enter a valid domain name (letters, numbers, hyphens).';
     grid.replaceChildren();if(more)more.hidden=true;return;
   }
   header.hidden=false;grid.hidden=false;
   if(over)over.textContent=name.toUpperCase();
   if(title)title.textContent='Domain availability not verified';
   grid.replaceChildren();
   tlds.slice(0,count).forEach(function(tld){
     const card=document.createElement('div');card.className='dom-card';
     card.style.cssText='border:1px solid #e5e7eb;border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:10px';
     const info=document.createElement('div');
     const heading=document.createElement('strong');heading.textContent=name+'.'+tld;
     const status=document.createElement('div');status.textContent='Availability requires a live registrar check';status.style.cssText='color:#64748b;font-size:12px;margin-top:6px';
     info.append(heading,status);card.append(info);
     const btn=document.createElement('button');btn.type='button';btn.textContent='Check availability';btn.className='bt bt-p';
     btn.addEventListener('click',function(){window.open('https://www.icann.org/rdap','_blank','noopener,noreferrer')});
     card.append(btn);grid.append(card);
   });
   if(more)more.hidden=count>=tlds.length;
 }
 form.addEventListener('submit',function(e){e.preventDefault();render()});
 if(more)more.addEventListener('click',function(){count=tlds.length;render()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();