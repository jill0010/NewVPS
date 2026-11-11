/* Update visible header/footer brand marks, retaining the archived shield image. */
(function(){
'use strict';
function apply(){
 document.querySelectorAll('a.logo img,header img,footer img,.hd img,.ft img').forEach(img=>{
   if(img.dataset.anonyWordmark)return;
   const src=img.getAttribute('src')||'';
   if(!/AnonPort/i.test(img.alt||'')&&!/AnonPort-[^/]+\.(?:webp|png|svg)/i.test(src))return;
   if(!img.closest('a.logo,.logo,header,footer,.hd,.ft'))return;
   const originalParent=img.parentNode;\n   const nextSibling=img.nextSibling;\n   img.dataset.anonyWordmark='1';
   const h=Number(img.getAttribute('height'))||28;
   const scale=h/28;
   const wrap=document.createElement('span');
   wrap.className='anonyport-wordmark';
   wrap.style.cssText='display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;gap:'+Math.round(2*scale)+'px;line-height:1';
   const shield=document.createElement('span');
   shield.style.cssText='display:inline-block;position:relative;overflow:hidden;width:'+Math.round(27*scale)+'px;height:'+h+'px;flex:none';
   img.style.cssText='display:block;position:absolute;left:0;top:0;width:'+Math.round(105*scale)+'px;height:'+h+'px;max-width:none;object-fit:fill';
   img.alt='';
   shield.appendChild(img);
   const name=document.createElement('span');
   name.style.cssText='font-family:Arial,Helvetica,sans-serif;font-size:'+Math.round(14*scale)+'px;font-weight:750;letter-spacing:-.55px;line-height:1;white-space:nowrap';
   const first=document.createElement('span');first.style.color='#17191f';first.textContent='Anony';
   const last=document.createElement('span');last.style.color='#315ed5';last.textContent='Port';
   name.append(first,last);wrap.append(shield,name);
   shield.parentNode; // shield contains the original logo asset's untouched icon.
   const parent=img.parentNode;
   // img is already in shield; place the replacement at the original position.
   if(parent===shield){
     const anchor=img.closest('a.logo,.logo,header,footer,.hd,.ft');
     if(anchor)anchor.insertBefore(wrap,anchor.firstChild);
   }
 });
 document.querySelectorAll('header,footer,.hd,.ft').forEach(root=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   let node;while((node=walker.nextNode())){
     if(node.parentElement?.closest('script,style,svg,code,pre'))continue;
     if(/AnonPort/.test(node.nodeValue||''))node.nodeValue=node.nodeValue.replace(/AnonPort/g,'AnonyPort');
   }
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
