/* Preserve the captured shield, replace only the image-based brand wordmark. */
(function(){
'use strict';
function apply(){
 document.querySelectorAll('img').forEach(function(img){
   if(img.dataset.anonyWordmark)return;
   const src=img.getAttribute('src')||'';
   if(!/AnonPort/i.test(img.alt||'')&&!/AnonPort-[^/]+\.(webp|png|svg)/i.test(src))return;
   const parent=img.parentElement;
   if(!parent||!parent.closest('header,footer,.hd,.ft,.logo,[class*="footer"],[class*="header"]'))return;
   const h=Number(img.getAttribute('height'))||28;
   const scale=h/28;
   const wrapper=document.createElement('span');
   wrapper.className='anonyport-wordmark';
   wrapper.style.cssText='display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;line-height:1;gap:5px';
   const shield=document.createElement('span');
   shield.style.cssText='position:relative;display:inline-block;overflow:hidden;flex:none;width:'+Math.round(30*scale)+'px;height:'+h+'px';
   parent.insertBefore(wrapper,img);
   wrapper.appendChild(shield);
   shield.appendChild(img);
   img.dataset.anonyWordmark='1';
   img.alt='AnonyPort';
   img.style.cssText='position:absolute;display:block;left:0;top:0;width:'+Math.round(105*scale)+'px;height:'+h+'px;max-width:none';
   const name=document.createElement('span');
   name.style.cssText='display:inline-block;position:relative;margin-left:2px;font-family:Arial,Helvetica,sans-serif;font-size:'+Math.round(14*scale)+'px;font-weight:700;letter-spacing:-.5px;white-space:nowrap';
   const black=document.createElement('span');black.style.color='#17191f';black.textContent='Anony';
   const blue=document.createElement('span');blue.style.color='#315ed5';blue.textContent='Port';
   name.append(black,blue);wrapper.appendChild(name);
 });
 document.querySelectorAll('header,footer,.hd,.ft').forEach(function(root){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
     if(node.parentElement&&node.parentElement.closest('script,style,svg,code,pre'))continue;
     if(/AnonPort/.test(node.nodeValue||''))node.nodeValue=node.nodeValue.replace(/AnonPort/g,'AnonyPort');
   }
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
