// Capture the deployed original-content pages at two fixed viewports.
// Screenshots are evidence for visual review, not proof of pixel-perfect parity.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const manifest = JSON.parse(fs.readFileSync('restoration/visual-audit-manifest.json','utf8'));
  const unique = [...new Map(manifest.items.map(item => [item.route, item])).values()];
  const output = 'visual-audit-screenshots';
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true});
  const results = [];
  const base = process.env.PREVIEW_URL || 'https://jill0010.github.io/NewVPS';
  for (let i=0;i<unique.length;i++) {
    const item=unique[i];
    for (const viewport of item.viewports) {
      const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
      const route=item.route;
      const url=base.replace(/\/$/,'')+(route==='/'?'/':route.replace(/\/$/,'')+'/');
      const name=String(i+1).padStart(3,'0')+'-'+viewport.name+'.png';
      const result={route,viewport:viewport.name,url,file:name,ok:false};
      try {
        const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForTimeout(350);
        result.http_status=response?.status()||null;
        result.title=await page.title();
        result.horizontal_overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
        result.broken_images=await page.locator('img').evaluateAll(imgs=>imgs.filter(img=>img.complete && img.naturalWidth===0).map(img=>img.currentSrc||img.src).slice(0,20));
        await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled',timeout:30000});
        result.ok=response?.ok()||false;
      } catch(e) {result.error=String(e).slice(0,400);}
      results.push(result);
      await page.close();
      console.log((result.ok?'OK':'ISSUE')+' '+route+' '+viewport.name);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify({pages:unique.length,viewports:results.length,results},null,2));
  if(results.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
