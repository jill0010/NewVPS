// Read-only stage 08 language and responsive audit. No UI interactions.
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('restoration/visual-audit-manifest.json','utf8'));
 const items=[...new Map(manifest.items.map(x=>[x.route,x])).values()];
 const browser=await chromium.launch({headless:true});
 const results=[];
 for(const item of items){
  for(const v of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
   const page=await browser.newPage({viewport:{width:v.width,height:v.height}});
   const url='https://jill0010.github.io/NewVPS'+(item.route==='/'?'/':item.route.replace(/\/$/,'')+'/');
   try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    const data=await page.evaluate(()=>({
     lang:document.documentElement.getAttribute('lang')||'',
     title:document.title,
     viewportMeta:document.querySelector('meta[name="viewport"]')?.content||'',
     viewportWidth:window.innerWidth,
     scrollWidth:document.documentElement.scrollWidth,
     horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2,
     navigationLinks:[...document.querySelectorAll('a[hreflang]')].map(x=>({lang:x.hreflang,href:x.getAttribute('href')})).slice(0,20)
    }));
    results.push({route:item.route,viewport:v.name,http:response?.status(),expectedLang:item.language,...data,languageMatches:data.lang.toLowerCase()===String(item.language||'').toLowerCase(),ok:response?.status()===200});
   }catch(e){results.push({route:item.route,viewport:v.name,ok:false,error:String(e).slice(0,200)})}
   await page.close();
  }
 }
 await browser.close();
 const summary={cases:results.length,httpFailures:results.filter(x=>!x.ok).length,
  languageMismatches:results.filter(x=>x.ok&&!x.languageMatches).length,
  overflowCases:results.filter(x=>x.horizontalOverflow).length,
  missingViewportMeta:results.filter(x=>x.ok&&!x.viewportMeta).length,
  languages:[...new Set(results.filter(x=>x.ok).map(x=>x.lang))].sort()};
 fs.mkdirSync('responsive-audit',{recursive:true});
 fs.writeFileSync('responsive-audit/report.json',JSON.stringify({summary,results},null,2));
 console.log('RESPONSIVE_AUDIT_SUMMARY '+JSON.stringify(summary));
 for(const x of results.filter(x=>!x.ok||!x.languageMatches||x.horizontalOverflow||!x.viewportMeta))console.log('RESPONSIVE_ISSUE '+JSON.stringify(x));
 if(summary.httpFailures||summary.languageMismatches||summary.overflowCases||summary.missingViewportMeta)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
