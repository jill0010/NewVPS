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
 let years=1;
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
   if(amounts[0])replaceMoney(amounts[0],old*n);
   if(amounts[1])replaceMoney(amounts[1],price*n);
   const perYear=[...card.querySelectorAll('*')].filter(e=>e.children.length===0&&/\/yr/.test(e.textContent||''));
   perYear.forEach(e=>e.textContent=money(price)+'/yr');
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
   const total=price*years;
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
   const periodLabel=leaf(/^Period$/i);
   if(periodLabel){
     let row=periodLabel.parentElement;
     for(let i=0;i<4&&row;i++,row=row.parentElement){
       const value=leaf(/^(?:1|2|3|5)\s*years?$/i,row);
       if(value&&value!==periodLabel){value.textContent=years+' '+(years===1?'year':'years');break;}
     }
   }
   const priceLabel=leaf(/^Price\s*\(\s*\d+x\s*\)$/i);
   if(priceLabel)priceLabel.textContent='Price ('+years+'x)';
   setRowAmount(/^Price\s*\(\s*\d+x\s*\)$/i);
   setRowAmount(/^Total today$/i);
   // Locate the original top-up message by its wording and replace only its
   // amount, even when the captured HTML wraps the amount in a separate span.
   const topupText=[...document.querySelectorAll('*')].find(el=>
     el.children.length===0&&/you.ll need to top up/i.test(el.textContent||''));
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
         priceNodes[0].textContent=priceNodes[0].textContent.replace(/\$[\d,.]+/,money(old));
         priceNodes[1].textContent=priceNodes[1].textContent.replace(/\$[\d,.]+/,money(price));
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
   const choose=()=>{years=periods[i];update()};
   card.addEventListener('click',choose);
   card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
 });
 update();
 document.querySelectorAll('a[href*="domain-pay"],form[action*="domain-pay"]').forEach(el=>{
   if(el.tagName==='A'){
     const url=new URL(el.href,location.href);
     url.searchParams.set('domain',domain);
     url.searchParams.set('price',price.toFixed(2));
     url.searchParams.set('years',String(years));
     el.addEventListener('click',()=>{url.searchParams.set('years',String(years));el.href=url.pathname+url.search});
   }else el.addEventListener('submit',()=>{el.action='/NewVPS/domain-pay/?domain='+encodeURIComponent(domain)+'&price='+price.toFixed(2)+'&years='+years});
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
