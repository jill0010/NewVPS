(function(){
'use strict';
var q=new URLSearchParams(location.search),type=(q.get('type')||'vps').toLowerCase(),plan=(q.get('plan')||'IS-L').toUpperCase(),region=(q.get('location')||'iceland').toLowerCase();
if(type==='vps'&&plan==='IS-L'&&region==='iceland')return;
var catalog={vps:'/vps/',dedicated:'/dedicated/',rdp:'/rdp/',gpu:'/gpu/'};
if(!catalog[type])return;
function put(selector,value){var e=document.querySelector(selector);if(e)e.textContent=value;}
function money(n){return '$'+n.toFixed(2)}
function start(){
fetch(catalog[type]).then(function(r){if(!r.ok)throw Error('catalog unavailable');return r.text()}).then(function(html){
 var doc=new DOMParser().parseFromString(html,'text/html');
 var link=Array.from(doc.querySelectorAll('a[href]')).find(function(a){try{var u=new URL(a.getAttribute('href'),location.origin),p=u.searchParams;return u.pathname.replace(/\/$/,'')==='/order'&&p.get('type')===type&&p.get('plan')===plan&&p.get('location')===region}catch(e){return false}});
 if(!link)return;
 var item=link.closest('tr')||link.closest('article,.plan-card,.pricing-card,.card');if(!item)return;
 var data={};item.querySelectorAll('[data-th]').forEach(function(el){data[el.getAttribute('data-th').toLowerCase()]=el.textContent.trim().replace(/\s+/g,' ')});
 var raw=(data.price||'').match(/\$?\s*([\d,]+(?:\.\d+)?)/);if(!raw)return;
 var price=Number(raw[1].replace(/,/g,''));if(!Number.isFinite(price)||price<=0)return;
 function value(k){return data[k]||''}
 var title={vps:'VPS',dedicated:'Dedicated',rdp:'RDP',gpu:'GPU'}[type];
 put('.order-title','Configure Your '+title+' Server');
 var recap=document.querySelector('.cfg-recap-info');
 if(recap){var strong=recap.querySelector('strong');if(strong)strong.textContent=plan;var label=Array.from(recap.childNodes).find(function(n){return n.nodeType===3&&/Iceland/i.test(n.textContent)});if(label)label.textContent=' in '+region.charAt(0).toUpperCase()+region.slice(1)+' ';}
 var flags={iceland:'is',panama:'pa',moldova:'md',romania:'ro',switzerland:'ch',netherlands:'nl',russia:'ru'};
 document.querySelectorAll('.cfg-recap-flag .fi,.summary-rows .fi').forEach(function(el){el.className='fi fi-'+(flags[region]||'');el.style.backgroundImage='';});
 var specs=recap&&recap.querySelector('.cfg-recap-specs');
 if(specs){var cells=Array.from(specs.children),values=[value('cpu'),value('processor'),value('ram'),value('storage')||value('nvme'),value('uplink'),value('bandwidth')];cells.forEach(function(el,i){if(values[i])el.textContent=values[i];else el.style.display='none'});}
 var rows=Array.from(document.querySelectorAll('.summary-rows .summary-row'));
 rows.forEach(function(row){var name=row.querySelector('span');if(!name)return;var key=name.textContent.trim().toLowerCase(),target=row.lastElementChild;
 if(key==='server')target.textContent=plan;
 else if(key==='location')target.textContent=region.charAt(0).toUpperCase()+region.slice(1);
 else if(data[key]&&target)target.textContent=data[key];
 else if(key==='storage'&&value('nvme'))target.textContent=value('nvme');
 else if(key==='processor'&&!value('processor'))row.style.display='none';
 });
 var recapPrice=document.querySelector('.cfg-recap-price');if(recapPrice)recapPrice.firstChild.textContent=money(price);
 var radios=Array.from(document.querySelectorAll('input[name="billing"]'));
 function update(){
  var radio=radios.find(function(x){return x.checked})||radios[0];
  var months=radio?Number(radio.value)||1:1,discount=radio?Number(radio.dataset.discount)||0:0;
  put('#sum-monthly',money(price));put('#sum-billing',months+' Month'+(months===1?'':'s'));
  put('#sum-total',money(Math.round(price*months*(1-discount/100)*100)/100));
  var disc=document.getElementById('sum-disc-row');if(disc)disc.style.display=discount?'':'none';
  if(discount)put('#sum-disc','-'+discount+'%');
 }
 radios.forEach(function(r){r.addEventListener('change',update)});update();
 }).catch(function(){/* Keep original archived page untouched when catalog cannot be verified. */});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();