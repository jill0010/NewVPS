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
     card.style.borderColor=active?'#3159e9':'';
     card.style.backgroundColor=active?'#edf1fc':'';
   });
   const total=price*years;
   // Match the original order-summary rows by label, then update the amount
   // in the same row rather than relying on nested markup or stale values.
   function summaryRow(labelPattern){
     const label=all.find(e=>e.children.length===0&&labelPattern.test((e.textContent||'').trim()));
     if(!label)return null;
     let row=label.parentElement;
     for(let depth=0;depth<4&&row;depth++,row=row.parentElement){
       if(row.querySelectorAll('*').length>20)break;
       if([...row.querySelectorAll('*')].some(e=>e.children.length===0&&/^\$[\d,.]+$/.test((e.textContent||'').trim())))return row;
     }
     return label.parentElement;
   }
   function updateRowAmount(pattern){
     const row=summaryRow(pattern);
     if(!row)return;
     const values=[...row.querySelectorAll('*')].filter(e=>e.children.length===0&&/^\$[\d,.]+$/.test(e.textContent.trim()));
     if(values.length)replaceMoney(values[values.length-1],total);
   }
   const period=all.find(e=>e.children.length===0&&/^\s*Period\s*$/i.test(e.textContent||''))?.parentElement;
   if(period){
     const value=[...period.querySelectorAll('*')].find(e=>e.children.length===0&&/^\s*(?:1|2|3|5)\s*years?\s*$/i.test(e.textContent||''));
     if(value)value.textContent=years+' '+(years===1?'year':'years');
   }
   const priceLabel=all.find(e=>e.children.length===0&&/^\s*Price\s*\(\s*\d+x\s*\)\s*$/i.test(e.textContent||''));
   if(priceLabel)priceLabel.textContent='Price ('+years+'x)';
   updateRowAmount(/^Price\s*\(\s*\d+x\s*\)$/i);
   updateRowAmount(/^Total today$/i);
   const topup=leafText(/You'll need to top up/i)[0];
   if(topup)topup.textContent=topup.textContent.replace(/\$[\d,.]+/,money(total));
   // Domain header, summary, and the captured price banner.
   const domainNodes=leafText(/anonymousmous|anonymshsh/i);
   domainNodes.forEach(e=>{e.textContent=e.textContent.replace(/anonymousmous\.com|anonymshsh\.com/gi,domain)});
   const banner=all.find(e=>e.children.length===0&&/^\$4\.99$/.test(e.textContent.trim()));
   if(banner&& !cards.some(c=>c?.contains(banner)))banner.textContent=money(price);
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
