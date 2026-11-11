(function(){
'use strict';
var q=new URLSearchParams(location.search);
var type=(q.get('type')||'vps').toLowerCase(),plan=(q.get('plan')||'IS-L').toUpperCase(),region=(q.get('location')||'iceland').toLowerCase();
var catalog={vps:'/vps/',dedicated:'/dedicated/',rdp:'/rdp/',gpu:'/gpu/'};
if(!catalog[type])return;
function text(el,value){if(el)el.textContent=value}
function labelValue(root,name,value){if(!value)return;root.querySelectorAll('.summary-row').forEach(function(row){var label=row.querySelector('span');if(label&&label.textContent.trim().toLowerCase()===name.toLowerCase()){text(row.lastElementChild,value)}})}
function start(){
 fetch(catalog[type]).then(function(r){if(!r.ok)throw Error('catalog unavailable');return r.text()}).then(function(html){
  var doc=new DOMParser().parseFromString(html,'text/html');
  var link=[...doc.querySelectorAll('a[href]')].find(function(a){
   var u;try{u=new URL(a.getAttribute('href'),location.origin)}catch(e){return false}
   return u.pathname.replace(/\/$/,'')==='/order'&&u.searchParams.get('type')===type&&u.searchParams.get('plan')===plan&&u.searchParams.get('location')===region;
  });
  if(!link)throw Error('plan not found in original catalog');
  var row=link.closest('tr')||link.closest('article,.plan-card,.pricing-card,.card');
  if(!row)throw Error('original plan row missing');
  var data={};
  row.querySelectorAll('[data-th]').forEach(function(el){data[el.getAttribute('data-th').trim().toLowerCase()]=el.textContent.trim().replace(/\s+/g,' ')});
  if(!Object.keys(data).length){var table=row.closest('table');var heads=table?[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase()):[];[...row.querySelectorAll('td')].forEach(function(el,i){if(heads[i])data[heads[i]]=el.textContent.trim().replace(/\s+/g,' ')})}
  var raw=data.price||data.monthly||'';
  var match=raw.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if(!match)throw Error('original monthly price missing');
  var base=Number(match[1].replace(/,/g,''));if(!Number.isFinite(base)||base<=0)throw Error('invalid original price');
  var money=function(n){return '$'+n.toFixed(2)};
  var recap=document.querySelector('.cfg-recap'),summary=document.querySelector('.order-summary');
  if(!recap||!summary)throw Error('original order markup missing');
  document.title='Order '+plan+' in '+region+' — AnonPort';
  text(document.querySelector('.order-title'),'Configure Your '+({vps:'VPS',dedicated:'Dedicated',gpu:'GPU',rdp:'RDP'}[type])+' Server');
  var info=recap.querySelector('.cfg-recap-info');
  if(info){var specsNode=info.querySelector('.cfg-recap-specs');[...info.childNodes].forEach(function(n){if(n!==specsNode)info.removeChild(n)});info.insertBefore(document.createTextNode(plan+' in '+region.charAt(0).toUpperCase()+region.slice(1)+' '),specsNode||null)}
  var specs=recap.querySelector('.cfg-recap-specs');
  if(specs){
   specs.replaceChildren();
   ['gpu','vram','cpu','processor','ram','nvme','storage','bandwidth','uplink'].forEach(function(k){if(data[k]){var sp=document.createElement('span');sp.textContent=data[k];specs.append(sp)}});
  }
  var recapPrice=recap.querySelector('.cfg-recap-price');if(recapPrice){recapPrice.replaceChildren(document.createTextNode(money(base)));var small=document.createElement('small');small.textContent='/mo';recapPrice.append(small)}
  labelValue(summary,'Server',plan);
  labelValue(summary,'Location',region.charAt(0).toUpperCase()+region.slice(1));
  ['gpu','vram','cpu','processor','ram','storage','bandwidth','uplink'].forEach(function(k){labelValue(summary,k,data[k]||((k==='storage')?data.nvme:null))});
  var inputs=[...document.querySelectorAll('input[name="billing"]')];
  function update(){
   var checked=inputs.find(x=>x.checked)||inputs[0];
   var months=checked?Number(checked.value):1;
   var discount=checked?Number(checked.dataset.discount||0):0;
   if(!Number.isFinite(months)||months<=0)return;
   var total=Math.round(base*months*(1-discount/100)*100)/100;
   text(document.getElementById('sum-monthly'),money(base));
   text(document.getElementById('sum-total'),money(total));
   text(document.getElementById('sum-billing'),months+' Month'+(months===1?'':'s'));
   text(document.getElementById('sum-disc'),discount?'-'+discount+'%':'');
   var balance=document.getElementById('sumBalance');if(balance)balance.dataset.total=total.toFixed(2);
  }
  inputs.forEach(function(input){input.addEventListener('change',function(){setTimeout(update,0)})});
  update();
 }).catch(function(e){console.error('Original catalog order price binding:',e.message)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();