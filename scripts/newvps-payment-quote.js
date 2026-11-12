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
    const noticeLabels={
      en:{title:'Order Notifications',empty:'No notifications yet.'},
      ru:{title:'Уведомления о заказе',empty:'Пока нет уведомлений.'},
      'zh-CN':{title:'订单通知',empty:'暂无通知。'}
    };
    function noticeLanguage(){
      let lang='en';
      try{lang=localStorage.getItem('newvps_language')||'en'}catch(e){}
      return noticeLabels[lang]?lang:'en';
    }
    function noticeStrings(){return noticeLabels[noticeLanguage()]}
    const translatedNotices=new Map();
    async function translateNotice(message,lang){
      if(lang==='zh-CN'||!message.trim())return message;
      const key=lang+'\u0000'+message;
      if(translatedNotices.has(key))return translatedNotices.get(key);
      const lines=message.split('\n');
      const result=await Promise.all(lines.map(async function(line){
        if(!/[\u3400-\u9fff]/.test(line))return line;
        // Preserve amounts, IDs, URLs and wallet addresses as-is.
        const protectedParts=[];
        const masked=line.replace(/(?:https?:\/\/\S+|(?:0x[a-fA-F0-9]{12,})|(?:[A-Za-z0-9_-]{35,})|(?:\d[\d,.]*\s*(?:USD|USDT|BTC|ETH|TON|TRX|XMR|LTC|SOL)))/g,function(part){
          protectedParts.push(part);
          return ' __NV'+(protectedParts.length-1)+'__ ';
        });
        const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl='+encodeURIComponent(lang)+'&dt=t&q='+encodeURIComponent(masked);
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),6500);
        try{
          const response=await fetch(url,{signal:controller.signal});
          if(!response.ok)throw new Error('Translation HTTP '+response.status);
          const data=await response.json();
          let translated=Array.isArray(data?.[0])?data[0].map(x=>x?.[0]||'').join(''):'';
          if(!translated)return line;
          translated=translated.replace(/__NV\s*(\d+)\s*__/gi,function(match,i){return protectedParts[Number(i)]??match});
          if(protectedParts.some(x=>!translated.includes(x)))return line;
          return translated;
        }catch(e){console.warn('Notice translation unavailable',e);return line}
        finally{clearTimeout(timeout)}
      }));
      const translated=result.join('\n');
      if(translated!==message)translatedNotices.set(key,translated);
      return translated;
    }
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
        const session=sessionStorage.getItem('newvps_session');
        if(!session)throw new Error('Please sign in before creating a payment order.');
        const currency=value==='USDT'?'USDT_ERC20':value==='USDTTRC'?'USDT_TRC20':value;
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),15000);
        let created;
        try{
          const response=await fetch('https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/payment-order-api',{
            method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},
            body:JSON.stringify({action:'create',currency,usd}),signal:controller.signal,cache:'no-store'
          });
          created=await response.json();
          if(!response.ok||!created.order)throw new Error(created.error||'Order creation failed');
        }finally{clearTimeout(timeout)}
        if(request!==serial)return;
        const order=created.order;
        const price=Number(order.rate_usd);
        const payable=String(order.asset_amount);
        const quoteRef=order.quote_ref;
        const paymentAddress=order.destination_address;
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
        const notice=el('section',undefined,'nv-order-notice notranslate');
        notice.setAttribute('translate','no');
        notice.style.cssText='margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fafbfc';
        const noticeTitle=el('strong',noticeStrings().title);notice.appendChild(noticeTitle);
        const noticeBody=el('p',noticeStrings().empty);noticeBody.style.cssText='margin:10px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#697586';
        notice.appendChild(noticeBody);left.appendChild(notice);
        let noticeMessage='',translatedMessage='',translatedKey='',translationSerial=0;
        async function updateNoticeTranslation(){
          const language=noticeLanguage(),message=noticeMessage;
          const key=language+'\u0000'+message;
          if(key===translatedKey)return;
          translatedKey=key;
          const version=++translationSerial;
          translatedMessage=language==='zh-CN'?message:message;
          renderNotice();
          if(!message||language==='zh-CN')return;
          const result=await translateNotice(message,language);
          if(version!==translationSerial||request!==serial||!notice.isConnected)return;
          translatedMessage=result;
          renderNotice();
        }
        function renderNotice(){
          const labels=noticeStrings();
          const nextTitle=labels.title;
          const nextBody=translatedMessage||noticeMessage||labels.empty;
          const nextColor=noticeMessage?'#dc2626':'#697586';
          if(noticeTitle.textContent!==nextTitle)noticeTitle.textContent=nextTitle;
          if(noticeBody.textContent!==nextBody)noticeBody.textContent=nextBody;
          if(noticeBody.style.color!==nextColor)noticeBody.style.color=nextColor;
        }
        const noticeLanguageTimer=setInterval(function(){
          if(!notice.isConnected){clearInterval(noticeLanguageTimer);return}
          updateNoticeTranslation();
        },500);
        async function refreshNotice(){
          try{const data=await noticeRequest('get',quoteRef);if(data&&request===serial){noticeMessage=data.message||'';updateNoticeTranslation()}}catch(e){console.warn('Order notice unavailable',e)}
        }
        noticeRequest('register',quoteRef,{usd,asset:value}).then(refreshNotice).catch(e=>console.warn('Quote notification registration unavailable',e));
        noticeTimer=setInterval(refreshNotice,10000);
        
        const right=el('div',undefined,'nv-right');grid.appendChild(right);
        right.appendChild(el('strong','Pay with '+coin.name));
        const qr=el('img',undefined,'nv-qr');qr.alt='QR code for '+coin.name+' address';qr.loading='eager';
        qr.src='https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(paymentAddress);
        right.appendChild(qr);
        right.appendChild(el('p','SEND EXACTLY','nv-subtle'));
        right.appendChild(el('strong',payable+' '+value));
        const buttons=el('div',undefined,'nv-copy');right.appendChild(buttons);
        const copyAmount=el('button','Copy amount');copyAmount.onclick=()=>navigator.clipboard.writeText(payable).then(()=>copyAmount.textContent='Copied').catch(()=>{});buttons.appendChild(copyAmount);
        right.appendChild(el('p','TO ADDRESS · '+coin.name,'nv-subtle'));
        right.appendChild(el('div',coin.address,'nv-address'));
        const copyAddress=el('button','Copy address');copyAddress.style.marginTop='10px';copyAddress.onclick=()=>navigator.clipboard.writeText(coin.address).then(()=>copyAddress.textContent='Copied').catch(()=>{});right.appendChild(copyAddress);
        
      }catch(err){if(request===serial)progress.textContent=err?.message||'Could not create a payment order. Please try again.'}
    }
    form.addEventListener('submit',function(event){event.preventDefault();event.stopImmediatePropagation();show()},true);
    
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
