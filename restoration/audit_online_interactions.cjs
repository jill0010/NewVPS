// Read-only browser audit of deployed controls; no form submissions or purchases.
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('restoration/visual-audit-manifest.json','utf8'));
 const items=[...new Map(manifest.items.map(x=>[x.route,x])).values()];
 const browser=await chromium.launch({headless:true});
 const results=[];
 for(const item of items){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const url='https://jill0010.github.io/NewVPS'+(item.route==='/'?'/':item.route.replace(/\/$/,'')+'/');
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   const data=await page.evaluate(()=>{
    const links=[...document.querySelectorAll('a[href]')];
    const buttons=[...document.querySelectorAll('button')];
    const forms=[...document.querySelectorAll('form')];
    const invalidLocalLinks=links.filter(a=>{
      try{
        const u=new URL(a.href);
        return u.hostname==='jill0010.github.io' && !u.pathname.startsWith('/NewVPS/');
      }catch{return false;}
    }).map(a=>({href:a.getAttribute('href'),text:(a.textContent||'').trim().slice(0,70)})).slice(0,30);
    return {links:links.length,buttons:buttons.length,forms:forms.length,
      buttonsWithoutLabel:buttons.filter(b=>!((b.innerText||'').trim()||b.getAttribute('aria-label')||b.getAttribute('title'))).length,
      invalidLocalLinks};
   });
   results.push({route:item.route,ok:true,...data});
  }catch(e){results.push({route:item.route,ok:false,error:String(e).slice(0,250)})}
  await page.close();
 }
 await browser.close();
 const summary={routes:results.length,failed:results.filter(x=>!x.ok).length,
   pagesWithInvalidLocalLinks:results.filter(x=>x.invalidLocalLinks?.length).length,
   pagesWithUnlabeledButtons:results.filter(x=>x.buttonsWithoutLabel>0).length,
   totalButtons:results.reduce((n,x)=>n+(x.buttons||0),0),
   totalForms:results.reduce((n,x)=>n+(x.forms||0),0)};
 fs.mkdirSync('interaction-audit',{recursive:true});
 fs.writeFileSync('interaction-audit/report.json',JSON.stringify({summary,results},null,2));
 console.log('INTERACTION_AUDIT_SUMMARY '+JSON.stringify(summary));
 for(const r of results.filter(x=>x.invalidLocalLinks?.length))console.log('INVALID_LOCAL_LINKS '+JSON.stringify(r));
 if(summary.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
