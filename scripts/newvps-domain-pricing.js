/* Captured domain configuration: original DOM, dynamic price/period only. */
(function(){
'use strict';
const PRICE_TABLE={
'4.99':15.98,'7.99':11.98,'8.99':11.98,'9.99':14.98,
'11.99':15.98,'12.99':17.98,'13.99':19.98,'14.99':20.98,
'17.99':24.98,'19.99':32.98,'24.99':39.98,'69.99':84.98,'84.99':109.98
};
const money=n=>'$'+n.toFixed(2);
function init(){
 if(!/\/domain-order\/?$/.test(location.pathname))return;
 const params=new URLSearchParams(location.search);
 const domain=params.get('domain')||'anonymousmous.com';
 const rate=params.get('price');
 const price=rate&&Object.hasOwn(PRICE_TABLE,rate)?Number(rate):4.99;
 const old=PRICE_TABLE[price.toFixed(2)];
 let years=[1,2,3,5].includes(Number(params.get('years')))?Number(params.get('years')):1;
 const annualPrice=price;
 const annualOriginal=old;
 const amountFor=(annual,period)=>Math.round(annual*100)*period/100;
 const periods=[1,2,3,5];
 const all=[...document.querySelectorAll('body *')];
 const leafText=(regex)=>all.filter(e=>e.children.length===0&&regex.test((e.textContent||'').trim()));
 const findPeriodCards=()=>periods.map(n=>{
   const label=[...document.querySelectorAll('body *')].find(el=>
     el.children.length===0 && el.textContent.trim().toLowerCase()===n+(n===1?' year':' years'));
   if(!label)return null;
   let el=label;
   while(el.parentElement&&el.parentElement!==document.body){
     el=el.parentElement;
     if(el.querySelectorAll('*').length>20)break;
     if(/\/yr/i.test(el.textContent||'')&&/\$/.test(el.textContent||''))return el;
   }
   return label.parentElement;
 });
 const cards=findPeriodCards();
 if(cards.some(c=>!c))console.warn('NewVPS: missing captured registration period card');
 function replaceMoney(el,value){
   if(!el)return;
   const node=[...el.childNodes].find(n=>n.nodeType===3&&/\$/.test(n.textContent||''));
   if(node)node.textContent=node.textContent.replace(/\$\s*[\d,.]+/,money(value));
   else el.textContent=money(value);
 }
 function setPriceTexts(card,n){
   if(!card)return;
   const amounts=[...card.querySelectorAll('*')].filter(e=>e.children.length===0&&/^\$[\d,.]+$/.test(e.textContent.trim()));
   if(amounts[0])replaceMoney(amounts[0],amountFor(annualOriginal,n));
   if(amounts[1])replaceMoney(amounts[1],amountFor(annualPrice,n));
   const perYear=[...card.querySelectorAll('*')].filter(e=>e.children.length===0&&/\/yr/.test(e.textContent||''));
   perYear.forEach(e=>e.textContent=money(annualPrice)+'/yr');
 }
 function update(){
   cards.forEach((card,i)=>{
     const n=periods[i];if(!card)return;
     setPriceTexts(card,n);
     const active=n===years;
     card.classList.toggle('on',active);
     card.classList.toggle('selected',active);
     card.setAttribute('aria-pressed',String(active));
     card.style.setProperty('border',active?'2px solid #3159e9':'1px solid #e5e7eb','important');
     card.style.setProperty('box-shadow','none','important');
     card.style.setProperty('outline','none','important');
     card.style.setProperty('background-color',active?'#edf1fc':'#fff','important');
   });
   const total=amountFor(annualPrice,years);
   // Match the original order-summary rows by label, then update the amount
   // in the same row rather than relying on nested markup or stale values.
   function leaf(regex,root=document){
     return [...root.querySelectorAll('*')].find(e=>e.children.length===0&&regex.test((e.textContent||'').trim()));
   }
   function setRowAmount(labelPattern){
     const label=leaf(labelPattern);
     if(!label)return;
     let row=label.parentElement;
     for(let i=0;i<5&&row;i++,row=row.parentElement){
       const amounts=[...row.querySelectorAll('*')].filter(e=>e.children.length===0&&/^\$[\d,.]+$/.test(e.textContent.trim()));
       if(amounts.length&&row.textContent.length<180){
         replaceMoney(amounts[amounts.length-1],total);
         return;
       }
     }
   }
   // Update the summary's two rows by finding the label text node and
   // the nearest value alongside it. Captured HTML may split either value
   // into nested spans, so use the label's bounding row, not leaf selectors.
   function updateSummaryField(labelRegex,valueRegex,newValue){
     const labels=[...document.querySelectorAll('*')].filter(el=>
       el.children.length===0&&labelRegex.test((el.textContent||'').trim()));
     const label=labels.find(el=>!cards.some(card=>card&&card.contains(el)));
     if(!label)return;
     let row=label.parentElement;
     for(let depth=0;depth<7&&row;depth++,row=row.parentElement){
       if((row.textContent||'').length>260)break;
       const candidates=[...row.querySelectorAll('*')].filter(el=>
         el!==label&&el.children.length===0&&valueRegex.test((el.textContent||'').trim()));
       if(candidates.length){
         const value=candidates[candidates.length-1];
         value.textContent=newValue;
         return;
       }
       // Some captures put the label and value in separate text nodes
       // directly within the same wrapper.
       const walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
       let node;
       while((node=walker.nextNode())){
         if(node.parentElement===label)continue;
         if(valueRegex.test((node.textContent||'').trim())){
           node.textContent=newValue;
           return;
         }
       }
     }
   }
   updateSummaryField(/^Period$/i,/^(?:1|2|3|5)\s*years?$/i,
     years+' '+(years===1?'year':'years'));
   // The original summary may render label and amount in either DOM order.
   // Locate the smallest wrapper containing "Price (Nx)" and a currency value.
   const summaryPriceLabel=[...document.querySelectorAll('body *')].find(el=>
     el.children.length===0&&/^\s*Price\s*\(\s*\d+\s*[x×]\s*\)\s*$/i.test(el.textContent||'') &&
     !cards.some(card=>card&&card.contains(el)));
   if(summaryPriceLabel){
     let row=summaryPriceLabel.parentElement;
     for(let depth=0;depth<9&&row;depth++,row=row.parentElement){
       if((row.textContent||'').length>400)break;
       const amounts=[...row.querySelectorAll('*')].filter(el=>
         el.children.length===0&&/^\s*\$\s*[\d,.]+\s*$/.test(el.textContent||'') &&
         !cards.some(card=>card&&card.contains(el)));
       if(amounts.length){
         replaceMoney(amounts[amounts.length-1],total);
         break;
       }
       const walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
       let node;
       while((node=walker.nextNode())){
         if(node.parentElement===summaryPriceLabel)continue;
         if(/\$\s*[\d,.]+/.test(node.nodeValue||'')){
           node.nodeValue=node.nodeValue.replace(/\$\s*[\d,.]+/,money(total));
           row=null;break;
         }
       }
       if(!row)break;
     }
     summaryPriceLabel.textContent='Price ('+years+'×)';
   }
   setRowAmount(/^Total today$/i);
   // Locate the original top-up message by its wording and replace only its
   // amount, even when the captured HTML wraps the amount in a separate span.
   const textWalker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   let topupNode=null,scanNode;
   while((scanNode=textWalker.nextNode())){
     if(/you.ll need to top up/i.test(scanNode.textContent||'')){
       topupNode=scanNode;
       break;
     }
   }
   const topupText=topupNode?.parentElement||null;
   if(topupText){
     let scope=topupText;
     for(let i=0;i<5&&scope.parentElement;i++){
       if(/\$[\d,.]+/.test(scope.textContent||''))break;
       scope=scope.parentElement;
     }
     if((scope.textContent||'').length<300){
       const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
       let node;
       while((node=walker.nextNode())){
         if(/\$[\d,.]+/.test(node.textContent||'')){
           node.textContent=node.textContent.replace(/\$[\d,.]+/,money(total));
           break;
         }
       }
     }
   }
   // The captured header has a "change" link. Its enclosing compact
   // banner contains the crossed-out old price and annual sale price.
   const changeLink=[...document.querySelectorAll('a')].find(el=>
     /^change$/i.test((el.textContent||'').trim()));
   if(changeLink){
     let banner=changeLink.parentElement;
     for(let i=0;i<6&&banner;i++,banner=banner.parentElement){
       if((banner.textContent||'').length>500)break;
       if(!/\$[\d,.]+/.test(banner.textContent||''))continue;
       const walker=document.createTreeWalker(banner,NodeFilter.SHOW_TEXT);
       const priceNodes=[];
       let node;
       while((node=walker.nextNode())){
         if(/\$[\d,.]+/.test(node.textContent||''))priceNodes.push(node);
       }
       if(priceNodes.length>=2){
         priceNodes[0].textContent=priceNodes[0].textContent.replace(/\$[\d,.]+/,money(annualOriginal));
         priceNodes[1].textContent=priceNodes[1].textContent.replace(/\$[\d,.]+/,money(annualPrice));
         break;
       }
     }
   }
   const domainNodes=leafText(/anonymousmous|anonymshsh/i);
   domainNodes.forEach(e=>{
     e.textContent=e.textContent.replace(/anonymousmous\.com|anonymshsh\.com/gi,domain);
   });

 }
 cards.forEach((card,i)=>{
   if(!card)return;
   card.style.cursor='pointer';
   card.setAttribute('role','button');
   card.setAttribute('tabindex','0');
   const choose=()=>{years=periods[i];update();queueMicrotask(update)};
   card.addEventListener('click',choose);
   card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
 });
 update();
 // The archived checkout form POSTs to a static page, which returns HTTP 405.
 // Convert checkout navigation to GET and preserve selected registration years.
 const checkoutUrl=()=>'/NewVPS/domain-pay/?domain='+encodeURIComponent(domain)+
   '&price='+encodeURIComponent(price.toFixed(2))+'&years='+encodeURIComponent(years);
 const checkoutPattern=/continue\\s+to\\s+checkout|继续结账|继续付款|перейти\\s+к\\s+оплате/i;
 const isCheckoutControl=el=>!!el&&checkoutPattern.test((el.textContent||el.value||'').trim());
 const controls=[...document.querySelectorAll('a,button,input[type="submit"],[role="button"]')]
   .filter(isCheckoutControl);
 controls.forEach(control=>{
   if(control.tagName==='A')control.href=checkoutUrl();
   if(control.form){control.form.method='get';control.form.action='/NewVPS/domain-pay/';}
 });
 document.addEventListener('click',function(event){
   const control=event.target.closest('a,button,input[type="submit"],[role="button"]');
   if(!control||!isCheckoutControl(control))return;
   event.preventDefault();
   event.stopImmediatePropagation();
   location.assign(checkoutUrl());
 },true);
 document.addEventListener('submit',function(event){
   const form=event.target;
   if(!form||!form.querySelector)return;
   if(!controls.some(control=>control.form===form||form.contains(control))&&
      !/domain-pay|checkout/i.test(form.action||''))return;
   event.preventDefault();
   event.stopImmediatePropagation();
   location.assign(checkoutUrl());
 },true);
 document.querySelectorAll('a[href*="domain-pay"]').forEach(el=>{
   el.href=checkoutUrl();
   el.addEventListener('click',function(event){
     event.preventDefault();
     location.assign(checkoutUrl());
   });
 });

}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
