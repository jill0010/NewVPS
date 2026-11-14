(function(){'use strict';
if(location.pathname.startsWith('/admin/'))return;
const endpoint='https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/newvps-site-analytics';
function getId(storage,key){try{let v=storage.getItem(key);if(!v){v=crypto.randomUUID();storage.setItem(key,v)}return v}catch{return crypto.randomUUID()}}
const visitor=getId(localStorage,'anonyport_visitor_v1'),session=getId(sessionStorage,'anonyport_visit_session_v1');
const p=new URLSearchParams(location.search);
const hasAd=p.has('gclid')||p.has('gbraid')||p.has('wbraid')||p.has('msclkid')||p.has('fbclid')||p.get('utm_medium')==='cpc'||p.get('utm_medium')==='paid';
let source=(p.get('utm_source')||'').slice(0,80);
if(!source&&hasAd)source=p.has('gclid')||p.has('gbraid')||p.has('wbraid')?'google':p.has('msclkid')?'bing':p.has('fbclid')?'facebook':'paid';
if(!source){try{const h=new URL(document.referrer).hostname;if(h&&!h.endsWith('anonyport.com'))source=h.slice(0,80)}catch{}}
source=source||'direct';
const clean=v=>String(v||'').replace(/[^\w.\-]/g,'').slice(0,100);
const payload={action:'collect',path:location.pathname,visitor,session,source:clean(source),medium:clean(p.get('utm_medium')),campaign:clean(p.get('utm_campaign')),ad_landing:hasAd};
let eventId=null,activeSeconds=0,lastTick=Date.now(),pending=false;
const send=(body,keepalive=false)=>fetch(endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}).catch(()=>null);
const visible=()=>document.visibilityState==='visible'&&document.hasFocus();
let wasVisible=visible();
function tick(){const now=Date.now();if(wasVisible)activeSeconds+=Math.min(30,Math.max(0,(now-lastTick)/1000));lastTick=now;wasVisible=visible()}
async function flush(){tick();if(!eventId||pending)return;pending=true;try{await send({action:'duration',event_id:eventId,session,duration_seconds:Math.min(86400,Math.floor(activeSeconds))},true)}finally{pending=false}}
send(payload,true).then(async r=>{if(!r||!r.ok)return;const j=await r.json();eventId=j.event_id;if(eventId)flush()}).catch(()=>{});
setInterval(()=>{if(document.visibilityState==='visible')flush()},15000);
document.addEventListener('visibilitychange',()=>{flush()});
window.addEventListener('pagehide',()=>{flush()});
})();