/* Restore interaction on archived server configuration forms; original HTML untouched. */
(function(){
'use strict';
function init(){
  // Archived OS icons use capture-relative paths that break on nested routes.
  // Resolve the exact original asset filename from the shared capture directory.
  document.querySelectorAll('.cfg-card.cfg-os img').forEach(function(img){
    const raw=img.getAttribute('src')||'';
    const marker='anonport_com/';
    const at=raw.lastIndexOf(marker);
    if(at<0)return;
    const filename=raw.slice(at+marker.length).split(/[?#]/)[0];
    if(!/^[a-zA-Z0-9._-]+\\.(svg|png|webp)$/.test(filename))return;
    const correct='/NewVPS/_captures/shared/assets/anonport_com/'+filename;
    if(img.getAttribute('src')!==correct)img.setAttribute('src',correct);
    img.loading='eager';
    img.addEventListener('error',function(){console.warn('Missing archived OS icon:',correct)},{once:true});
  });
  const tabs=[...document.querySelectorAll('.os-tab')];
  const panels=[...document.querySelectorAll('.os-panel')];
  const ips=document.querySelector('select[name="extra_ips"]');
  const billing=[...document.querySelectorAll('input[name="billing"]')];
  const os=[...document.querySelectorAll('input[name="os"]')];
  const password=document.querySelector('#rootpw');
  if(!tabs.length&&!ips&&!billing.length&&!password)return;
  function activeCard(input,selector){
    document.querySelectorAll(selector).forEach(function(card){
      const checked=!!card.querySelector('input:checked');
      card.classList.toggle('on',checked);
      card.style.borderColor=checked?'#1a56db':'#ececec';
      card.style.backgroundColor=checked?'#edf1fc':'#fff';
      card.style.boxShadow=checked?'0 0 0 1px #1a56db':'none';
    });
  }
  function setTab(index){
    tabs.forEach(function(tab,i){
      const on=i===index;
      tab.classList.toggle('on',on);
      tab.setAttribute('aria-selected',String(on));
      tab.style.backgroundColor=on?'#1a56db':'#f7f8fa';
      tab.style.color=on?'#fff':'#5d666f';
      tab.style.borderColor=on?'#1a56db':'#ececec';
    });
    panels.forEach(function(panel,i){
      const key=panel.dataset.panel;
      const show=key!==undefined?Number(key)===index:i===index;
      panel.classList.toggle('on',show);
      panel.style.display=show?'block':'none';
      panel.hidden=!show;
    });
  }
  tabs.forEach(function(tab,i){tab.addEventListener('click',function(){setTab(i)})});
  const checkedOS=document.querySelector('input[name="os"]:checked');
  const initialPanel=checkedOS?.closest('.os-panel');
  setTab(initialPanel?Math.max(0,panels.indexOf(initialPanel)):Math.max(0,tabs.findIndex(t=>t.classList.contains('on'))));
  os.forEach(function(input){
    input.addEventListener('change',function(){activeCard(input,'.cfg-card.cfg-os')});
  });
  activeCard(null,'.cfg-card.cfg-os');
  const selectedBilling=billing.find(x=>x.checked)||billing[0];
  if(selectedBilling)selectedBilling.checked=true;
  billing.forEach(function(input){
    input.addEventListener('change',function(){activeCard(input,'.cfg-card.cfg-billing');refreshSummary()});
  });
  activeCard(null,'.cfg-card.cfg-billing');
  function refreshSummary(){
    const count=Number(ips?.value||0);
    const months=Number(document.querySelector('input[name="billing"]:checked')?.value||1);
    const discount=Number(document.querySelector('input[name="billing"]:checked')?.dataset.discount||0);
    const ipRow=document.getElementById('sum-ips-row');
    if(ipRow)ipRow.style.display=count?'':'none';
    const ipText=document.getElementById('sum-ips');
    if(ipText)ipText.textContent=String(count);
    const billingText=document.getElementById('sum-billing');
    if(billingText)billingText.textContent=months+' Month'+(months===1?'':'s');
    const discRow=document.getElementById('sum-disc-row');
    if(discRow)discRow.style.display=discount?'':'none';
    const discText=document.getElementById('sum-disc');
    if(discText)discText.textContent='-'+discount+'%';
    // Preserve the original archived base price; never invent a new product rate.
    const monthlyEl=document.getElementById('sum-monthly');
    const original=monthlyEl?.dataset.newvpsBase||monthlyEl?.textContent||'';
    if(monthlyEl&&!monthlyEl.dataset.newvpsBase)monthlyEl.dataset.newvpsBase=original;
    const base=Number(original.replace(/[^0-9.]/g,''));
    if(!Number.isFinite(base)||base<=0)return;
    const monthly=base+count*2.10;
    const total=monthly*months*(1-discount/100);
    if(monthlyEl)monthlyEl.textContent='$'+monthly.toFixed(2);
    const totalEl=document.getElementById('sum-total');
    if(totalEl)totalEl.textContent='$'+total.toFixed(2);
    const balance=document.getElementById('sumBalance');
    if(balance)balance.dataset.total=total.toFixed(2);
  }
  if(ips){ips.disabled=false;ips.addEventListener('change',refreshSummary)}
  refreshSummary();
  const generate=password?.parentElement?.querySelector('button');
  if(password&&generate){
    generate.addEventListener('click',function(){
      if(!window.crypto?.getRandomValues){alert('Secure password generation is unavailable in this browser.');return}
      const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';
      const bytes=new Uint32Array(24);crypto.getRandomValues(bytes);
      password.value=Array.from(bytes,n=>chars[n%chars.length]).join('');
      password.dispatchEvent(new Event('input',{bubbles:true}));
      password.dispatchEvent(new Event('change',{bubbles:true}));
      const hint=document.getElementById('pwHint');
      if(hint)hint.textContent='Strong password generated. Save it securely.';
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();