/* Visual wordmark update only; original captured assets and links remain intact. */
(function(){
'use strict';
function apply(){
 const roots=document.querySelectorAll('header,footer,[role="banner"],[role="contentinfo"],.site-header,.site-footer,.navbar,.nav,.header,.footer');
 roots.forEach(root=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
     if(node.parentElement?.closest('script,style,svg,code,pre'))continue;
     if(/AnonPort/i.test(node.nodeValue||''))node.nodeValue=node.nodeValue.replace(/AnonPort/g,'AnonyPort');
     // Wordmarks sometimes split "Anon" and "Port" across styled spans.
     else if(/^\s*Anon\s*$/.test(node.nodeValue||'')&&
       /Port/.test(node.parentElement?.parentElement?.textContent||''))
       node.nodeValue=node.nodeValue.replace('Anon','Anony');
   }
   root.querySelectorAll('img[alt="AnonPort"],img[alt="Anonport"]').forEach(img=>img.alt='AnonyPort');
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
