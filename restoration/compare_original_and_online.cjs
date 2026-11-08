// Compare archived HTML rendered directly from the checkout against deployed routes.
// Both sides use the same Chromium, viewport, and animation settings.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const manifest=JSON.parse(fs.readFileSync('restoration/visual-audit-manifest.json','utf8'));
  const items=[...new Map(manifest.items.map(x=>[x.route,x])).values()];
  const browser=await chromium.launch({headless:true});
  const results=[];
  const base='https://jill0010.github.io/NewVPS';
  const out='visual-baseline-comparison';
  fs.mkdirSync(out,{recursive:true});
  for(let i=0;i<items.length;i++){
    const item=items[i];
    for(const v of item.viewports){
      const context=await browser.newContext({viewport:{width:v.width,height:v.height},deviceScaleFactor:1});
      const offline=await context.newPage();
      const online=await context.newPage();
      const local=pathToFileURL(path.resolve(item.source)).href;
      const url=base+(item.route==='/'?'/':item.route.replace(/\/$/,'')+'/');
      const result={route:item.route,viewport:v.name,source:item.source,online:url};
      try{
        await offline.goto(local,{waitUntil:'domcontentloaded',timeout:25000});
        await online.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
        // Wait for layout-affecting resources on both pages; DOMContentLoaded
        // alone is insufficient for screenshots and creates nondeterministic differences.
        const settle=async p=>{
          // Captures may reference third-party fonts/images that never finish.
          // Bound each resource wait; do not allow one page to stall all 132 views.
          await Promise.race([
            p.evaluate(async()=>{
              await Promise.all([
                document.fonts.ready.catch(()=>{}),
                ...[...document.images].filter(img=>img.getAttribute('src')?.trim())
                  .map(img=>img.decode().catch(()=>{}))
              ]);
            }).catch(()=>{}),
            new Promise(resolve=>setTimeout(resolve,2500))
          ]);
          await p.waitForTimeout(100);
        };
        await settle(offline);await settle(online);
        const info=async p=>p.evaluate(()=>({
          title:document.title,
          bodyText:(document.body?.innerText||'').replace(/\s+/g,' ').trim().slice(0,300),
          scrollWidth:document.documentElement.scrollWidth,
          scrollHeight:document.documentElement.scrollHeight,
          images:[...document.images].filter(x=>x.hasAttribute('src')&&x.getAttribute('src')?.trim()).length,
          brokenImages:[...document.images].filter(x=>x.hasAttribute('src')&&x.getAttribute('src')?.trim()&&x.complete&&x.naturalWidth===0).length
        }));
        result.offline=await info(offline);
        result.deployed=await info(online);
        result.height_difference=Math.abs(result.offline.scrollHeight-result.deployed.scrollHeight);
        result.width_difference=Math.abs(result.offline.scrollWidth-result.deployed.scrollWidth);
        result.title_matches=result.offline.title===result.deployed.title;
        result.text_matches=result.offline.bodyText===result.deployed.bodyText;
        if(!result.text_matches){
          const a=result.offline.bodyText,b=result.deployed.bodyText;
          let pos=0;while(pos<Math.min(a.length,b.length)&&a[pos]===b[pos])pos++;
          result.textDiff={firstDifferentIndex:pos,original:a.slice(Math.max(0,pos-65),pos+120),deployed:b.slice(Math.max(0,pos-65),pos+120)};
        }
        result.resourceMismatch={
          brokenImagesOffline:result.offline.brokenImages,
          brokenImagesOnline:result.deployed.brokenImages
        };
        if(result.height_difference>10){
          const metrics=async p=>p.evaluate(()=>({
            fonts:document.fonts.status,
            bodyFont:getComputedStyle(document.body).fontFamily,
            mainHeight:document.querySelector('main')?.getBoundingClientRect().height??null,
            headerHeight:document.querySelector('header')?.getBoundingClientRect().height??null,
            footerHeight:document.querySelector('footer')?.getBoundingClientRect().height??null,
            images:[...document.images].slice(0,10).map(x=>({alt:x.alt,width:x.naturalWidth,height:x.naturalHeight})),
            elements:[...document.querySelectorAll('main > *, article > *')].slice(0,15).map(x=>({tag:x.tagName,cls:String(x.className).slice(0,60),height:Math.round(x.getBoundingClientRect().height)}))
          }));
          result.offlineMetrics=await metrics(offline);
          result.onlineMetrics=await metrics(online);
        }
        const prefix=String(i+1).padStart(3,'0')+'-'+v.name;
        if(process.env.BASELINE_SCREENSHOTS!=='0'){
          await offline.screenshot({path:path.join(out,prefix+'-original.png'),fullPage:true,animations:'disabled',timeout:30000});
          await online.screenshot({path:path.join(out,prefix+'-deployed.png'),fullPage:true,animations:'disabled',timeout:30000});
        }
        result.ok=true;
      }catch(e){result.ok=false;result.error=String(e).slice(0,300);}
      results.push(result);
      console.log('BASELINE '+JSON.stringify({route:result.route,viewport:result.viewport,ok:result.ok,height_difference:result.height_difference,width_difference:result.width_difference,title_matches:result.title_matches,text_matches:result.text_matches,textDiff:result.textDiff,offlineMetrics:result.offlineMetrics,onlineMetrics:result.onlineMetrics,error:result.error}));
      await context.close();
    }
  }
  await browser.close();
  const summary={routes:items.length,views:results.length,errors:results.filter(x=>!x.ok).length,title_mismatches:results.filter(x=>x.ok&&!x.title_matches).length,text_mismatches:results.filter(x=>x.ok&&!x.text_matches).length,height_mismatches_over_10px:results.filter(x=>x.ok&&x.height_difference>10).length,width_mismatches_over_2px:results.filter(x=>x.ok&&x.width_difference>2).length};
  fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify({summary,results},null,2));
  console.log('BASELINE_SUMMARY '+JSON.stringify(summary));
  if(summary.errors)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
