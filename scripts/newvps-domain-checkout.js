/* Sync the original archived Checkout page with the selected domain plan. */
(function(){
'use strict';
function init(){
 if(!/\/domain-pay\/?$/.test(location.pathname))return;
 const q=new URLSearchParams(location.search);
 const domain=q.get('domain');
 const annual=Number(q.get('price'));
 const years=Number(q.get('years'));
 const period=[1,2,3,5].includes(years)?years:1;
 const validPrice=Number.isFinite(annual)&&annual>0&&annual<100000;
 const total=validPrice?Math.round(annual*100)*period/100:null;
 const money=n=>'$'+n.toFixed(2);
 const leaves=()=>[...document.querySelectorAll('body *')].filter(e=>e.children.length===0);
 const labelNode=pattern=>leaves().find(e=>pattern.test((e.textContent||'').trim()));
 function setRow(pattern,value,validator){
   const label=labelNode(pattern);
   if(!label)return;
   let row=label.parentElement;
   for(let i=0;i<6&&row&&row!==document.body;i++,row=row.parentElement){
     if((row.textContent||'').length>400)break;
     const candidates=leaves().filter(e=>row.contains(e)&&e!==label&&
       !label.contains(e)&&validator.test((e.textContent||'').trim()));
     if(candidates.length){
       candidates[candidates.length-1].textContent=value;
       return;
     }
   }
 }
 if(domain&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain)){
   setRow(/^Domain$/i,domain,/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i);
   leaves().forEach(el=>{
     if(/^(anonymousmous|anonymshsh)\.com$/i.test(el.textContent.trim()))el.textContent=domain;
   });
 }
 setRow(/^Period$/i,period+' '+(period===1?'year':'years'),/^\d+\s*years?$/i);
 if(total!==null){
   const pricePattern=/^\$\s*[\d,.]+$/;
   setRow(/^Domain price$/i,money(total),pricePattern);
   setRow(/^You need to add$/i,money(total),pricePattern);
   setRow(/^Total$/i,money(total),pricePattern);
   // The captured top-up button includes the price in its own text.
   document.querySelectorAll('a,button,[role="button"]').forEach(el=>{
     if(/top\s*up\s*\$\s*[\d,.]+\s*with\s*crypto/i.test(el.textContent||'')){
       const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
       let node;
       while((node=walker.nextNode())){
         if(/\$\s*[\d,.]+/.test(node.nodeValue)){
           node.nodeValue=node.nodeValue.replace(/\$\s*[\d,.]+/,money(total));
           break;
         }
       }
     }
   });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
