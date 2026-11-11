(function(){
'use strict';
var q=new URLSearchParams(location.search);
var type=(q.get('type')||'vps').toLowerCase(),plan=(q.get('plan')||'IS-L').toUpperCase(),region=(q.get('location')||'iceland').toLowerCase();
if(type==='vps'&&plan==='IS-L'&&region==='iceland')return;
var categories={dedicated:'/dedicated/',gpu:'/gpu/',rdp:'/rdp/',vps:'/vps/'};
function init(){
 var main=document.createElement('section');
 main.id='newvps-original-plan-details';
 main.style.cssText='max-width:1100px;margin:30px auto;padding:26px;border:1px solid #dce2eb;border-radius:12px;background:white;color:#182230;font:15px/1.6 system-ui,sans-serif';
 main.innerHTML='<h1 style="font-size:23px;margin:0 0 12px">Original product configuration</h1><p id="newvps-plan-status">Reading original archived product data…</p>';
 // Frontend-only replica: display original catalog details, then navigate to the archived top-up screen. No order or charge is submitted.
 document.body.replaceChildren(main);
 var url=categories[type];
 if(!url){document.getElementById('newvps-plan-status').textContent='Unsupported original product category.';return;}
 fetch(url).then(function(r){if(!r.ok)throw Error('Catalog HTTP '+r.status);return r.text()}).then(function(html){
   var doc=new DOMParser().parseFromString(html,'text/html');
   var matched=[...doc.querySelectorAll('a[href]')].find(function(a){
     var u;try{u=new URL(a.getAttribute('href'),location.origin)}catch(e){return false}
     var p=u.searchParams;
     return u.pathname.replace(/\/$/,'')==='/order'&&p.get('type')===type&&p.get('plan')===plan&&p.get('location')===region;
   });
   if(!matched)throw Error('Exact plan not present in archived '+type+' catalog');
   var row=matched.closest('tr'),card=matched.closest('article,.plan-card,.pricing-card,.card');
   var original=row||card;
   if(!original)throw Error('Original product detail container not found');
   var labels={},cells=[...original.querySelectorAll('[data-th]')];
   cells.forEach(function(c){labels[c.getAttribute('data-th')]=(c.innerText||c.textContent||'').trim().replace(/\s+/g,' ')});
   if(!Object.keys(labels).length){
     var headings=[...original.querySelectorAll('th')].map(x=>x.textContent.trim());
     [...original.querySelectorAll('td')].forEach(function(c,i){if(headings[i])labels[headings[i]]=c.textContent.trim().replace(/\s+/g,' ')});
   }
   var h=document.createElement('h2');h.textContent=type.toUpperCase()+' · '+plan+' · '+region;main.append(h);
   var table=document.createElement('table');table.style.cssText='border-collapse:collapse;width:100%;margin:18px 0';
   Object.entries(labels).forEach(function(pair){if(/^(order|buy)$/i.test(pair[0]))return;var tr=document.createElement('tr');pair.forEach(function(v,i){var el=document.createElement(i?'td':'th');el.textContent=v;el.style.cssText='padding:10px;border-bottom:1px solid #e5e7eb;text-align:left';tr.append(el)});table.append(tr)});
   if(!table.children.length){var pre=document.createElement('p');pre.textContent=original.textContent.trim().replace(/\s+/g,' ');main.append(pre)}else main.append(table);
   document.getElementById('newvps-plan-status').textContent='Original archived product specifications. Frontend preview only; continuing opens the payment/top-up page without placing an order.';
   var action=document.createElement('a');action.href='/account/?tab=topup';action.textContent='Continue to payment';action.style.cssText='display:inline-block;padding:12px 22px;border-radius:8px;background:#1a56db;color:white;text-decoration:none;font-weight:700';main.append(action);
 }).catch(function(e){document.getElementById('newvps-plan-status').textContent='Cannot verify original plan details: '+e.message+'. Checkout is disabled.'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();