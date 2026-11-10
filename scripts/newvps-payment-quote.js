/* NewVPS payment quote presentation. Original archived captures remain unchanged.
   This static Pages preview does not create payable orders or credit balances. */
(function () {
  'use strict';
  const currencies = {
    BTC: {id:'bitcoin', name:'Bitcoin', address:'bc1pulkdswkehc7ck9ajjynlxet0ptftlgcp58fyznvdp53da7ps5trsyf7ehu', precision:8},
    XMR: {id:'monero', name:'Monero', address:'874FwY5eyW4EDk7m23yUzwFUjdyU4Z9UNdhjPSreTmFmQezXWz9i5JMe5z5rADUveVTe6mTxab3Z5FiGGkX9me5qSjBRpVb', precision:8},
    ETH: {id:'ethereum', name:'Ethereum', address:'0xfc20a17b56cd97ffe2551fc8518257e4aacf36cf', precision:8},
    USDT: {id:'tether', name:'USDT (ERC-20)', address:'0xfc20a17b56cd97ffe2551fc8518257e4aacf36cf', precision:6},
    USDTTRC: {id:'tether', name:'USDT (TRC-20)', address:'TNjmN9KYUmEDCz5PoAttDcxeCuFvrxBBce', precision:6},
    LTC: {id:'litecoin', name:'Litecoin', address:'MQ3z4NC8YWA4i4d2QM1fLz8zRv8x2T3SKe', precision:8},
    TRX: {id:'tron', name:'TRON', address:'TNjmN9KYUmEDCz5PoAttDcxeCuFvrxBBce', precision:6},
    SOL: {id:'solana', name:'Solana', address:'5A1rpSKKZtCgZpVwS1PLqc5M77oVkAWD4NfKKMuzd5Jz', precision:8}
  };
  function el(tag, value, cls) {
    const x=document.createElement(tag);
    if(value!==undefined)x.textContent=value;
    if(cls)x.className=cls;
    return x;
  }
  function money(x){return '$'+x.toFixed(2)}
  function init(){
    const form=document.getElementById('topup-form');
    if(!form)return;
    const style=el('style');
    style.textContent='#nv-payment{width:100%;font-family:inherit;color:#152238}#nv-payment .nv-shell{width:100%;background:white}#nv-payment .nv-heading{padding:0 0 18px;display:flex;justify-content:space-between;align-items:center}#nv-payment .nv-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);gap:22px}#nv-payment .nv-left,#nv-payment .nv-right{min-width:0}#nv-payment .nv-right{border:1px solid #e8eaee;border-radius:8px;text-align:center;padding:18px}#nv-payment .nv-row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #e8eaee;padding:15px 0}#nv-payment .nv-row strong{text-align:right}#nv-payment .nv-subtle{font-size:12px;color:#697586}#nv-payment .nv-address{padding:12px;border:1px solid #e5e7eb;background:#f7f8fa;overflow-wrap:anywhere;text-align:left;font-family:monospace;font-size:12px;border-radius:5px}#nv-payment button{background:white;border:1px solid #dce1e8;border-radius:5px;padding:8px 12px;cursor:pointer}#nv-payment .nv-qr{width:192px;height:192px;max-width:100%;display:block;margin:18px auto}#nv-payment .nv-copy{display:flex;justify-content:center;gap:8px;margin:10px 0}#nv-payment .nv-status{padding:15px;border-top:1px solid #e8eaee;text-align:center;color:#697586;font-size:12px}@media(max-width:650px){#nv-payment .nv-grid{grid-template-columns:1fr}#nv-payment .nv-right{border-top:1px solid #e5e7eb}}';
    document.head.appendChild(style);
    let serial=0,noticeTimer=null;
    const noticeApi='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/quote-notice';
    async function noticeRequest(action,quote_ref,extra={}){
      const session=sessionStorage.getItem('newvps_session');
      if(!session)return null;
      const response=await fetch(noticeApi,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},body:JSON.stringify({action,quote_ref,...extra}),cache:'no-store'});
      if(!response.ok)throw new Error('Notice API '+response.status);
      return response.json();
    }
    function close(){if(noticeTimer){clearInterval(noticeTimer);noticeTimer=null}serial++;document.getElementById('nv-payment')?.remove();form.closest('.tu-grid')?.querySelectorAll(':scope > *').forEach(x=>{if(x!==form)x.style.display=''});form.style.display='';}
    async function show(){
      const value=document.getElementById('cs-topup-val')?.value;
      const coin=currencies[value];
      const usd=Number(document.getElementById('topup-amount')?.value);
      const msg=document.getElementById('topup-msg');
      if(!coin){if(msg)msg.textContent='Select a cryptocurrency first.';return}
      if(!Number.isFinite(usd)||usd<50||usd>2000){if(msg)msg.textContent='Choose an amount between $50 and $2,000.';return}
      if(msg)msg.textContent='';
      close();
      const request=++serial;
      const overlay=el('div',undefined);overlay.id='nv-payment';
      const shell=el('div',undefined,'nv-shell');overlay.appendChild(shell);
      const heading=el('div',undefined,'nv-heading');heading.appendChild(el('strong','Topup balance'));
      const x=el('button','← Back to top up');x.type='button';x.onclick=close;heading.appendChild(x);shell.appendChild(heading);
      const progress=el('div','Fetching current USD exchange rate…');progress.style.padding='28px';shell.appendChild(progress);
      const area=form.closest('.tu-grid') || form.parentElement;
      Array.from(area.children).forEach(child=>{if(child!==form)child.style.display='none'});
      form.style.display='none';
      area.appendChild(overlay);
      area.style.display='block';
      try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),10000);
        let response;
        try{response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+encodeURIComponent(coin.id)+'&vs_currencies=usd',{cache:'no-store',signal:controller.signal})}
        finally{clearTimeout(timeout)}
        if(!response.ok)throw new Error('Rate unavailable');
        const prices=await response.json();
        const price=Number(prices[coin.id]?.usd);
        if(!Number.isFinite(price)||price<=0)throw new Error('Invalid rate');
        if(request!==serial)return;
        // The fractional suffix is a quote identifier only, not a unique
        // on-chain order assignment. A server must reserve suffixes atomically.
        const rand=crypto.getRandomValues(new Uint32Array(1))[0]%900+100;
        const scale=10**coin.precision;
        const payable=((Math.ceil(usd/price*scale)+rand)/scale).toFixed(coin.precision);
        progress.remove();
        const grid=el('div',undefined,'nv-grid');shell.appendChild(grid);
        const left=el('div',undefined,'nv-left');grid.appendChild(left);
        left.appendChild(el('h2','Add '+money(usd)+' to your account'));
        left.appendChild(el('p','Credit applies only after a verified on-chain payment.','nv-subtle'));
        function row(label,value){const r=el('div',undefined,'nv-row');r.appendChild(el('span',label));r.appendChild(el('strong',value));left.appendChild(r)}
        row("What you're paying",money(usd)+' USD');
        row('What you receive',money(usd)+' account credit (not yet credited)');
        row('Reference rate','1 '+value+' = '+money(price)+' USD');
        row('Total',payable+' '+value);
        const quoteRef=Date.now().toString(36)+'-'+rand;
        left.appendChild(el('p','Indicative quote · '+new Date().toLocaleString()+' · Ref '+quoteRef,'nv-subtle'));
        const notice=el('section',undefined,'nv-order-notice');
        notice.style.cssText='margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fafbfc';
        const noticeTitle=el('strong','订单通知');notice.appendChild(noticeTitle);
        const noticeBody=el('p','暂无通知。');noticeBody.style.cssText='margin:10px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#697586';
        notice.appendChild(noticeBody);left.appendChild(notice);
        async function refreshNotice(){
          try{const data=await noticeRequest('get',quoteRef);if(data&&request===serial){noticeBody.textContent=data.message||'暂无通知。';noticeBody.style.color=data.message?'#152238':'#697586'}}catch(e){console.warn('Order notice unavailable',e)}
        }
        noticeRequest('register',quoteRef,{usd,asset:value}).then(refreshNotice).catch(e=>console.warn('Quote notification registration unavailable',e));
        noticeTimer=setInterval(refreshNotice,10000);
        
        const right=el('div',undefined,'nv-right');grid.appendChild(right);
        right.appendChild(el('strong','Pay with '+coin.name));
        const qr=el('img',undefined,'nv-qr');qr.alt='QR code for '+coin.name+' address';qr.loading='eager';
        qr.src='https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(coin.address);
        right.appendChild(qr);
        right.appendChild(el('p','SEND EXACTLY','nv-subtle'));
        right.appendChild(el('strong',payable+' '+value));
        const buttons=el('div',undefined,'nv-copy');right.appendChild(buttons);
        const copyAmount=el('button','Copy amount');copyAmount.onclick=()=>navigator.clipboard.writeText(payable).then(()=>copyAmount.textContent='Copied').catch(()=>{});buttons.appendChild(copyAmount);
        right.appendChild(el('p','TO ADDRESS · '+coin.name,'nv-subtle'));
        right.appendChild(el('div',coin.address,'nv-address'));
        const copyAddress=el('button','Copy address');copyAddress.style.marginTop='10px';copyAddress.onclick=()=>navigator.clipboard.writeText(coin.address).then(()=>copyAddress.textContent='Copied').catch(()=>{});right.appendChild(copyAddress);
        
      }catch(err){if(request===serial)progress.textContent='Could not obtain a live exchange rate. No payment amount was generated. Please try again.'}
    }
    form.addEventListener('submit',function(event){event.preventDefault();event.stopImmediatePropagation();show()},true);
    
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
