// Non-destructive tests of captured home-page menu and language controls.
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const url='https://jill0010.github.io/NewVPS/';
 const cases=[];
 for(const v of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
  const page=await browser.newPage({viewport:{width:v.width,height:v.height}});
  await page.goto(url,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(350);
  for(const c of [{name:'language',button:'#langBtn',panel:'#langMenu'},...(v.name==='mobile'?[{name:'mobile-menu',button:'#mobBtn',panel:'#mobMenu'}]:[])]){
   const button=page.locator(c.button);
   if(!await button.count()){cases.push({viewport:v.name,control:c.name,ok:false,reason:'button missing'});continue}
   const before=await button.getAttribute('aria-expanded');
   let after=null,visible=null,error=null;
   try{
    if(!await button.isVisible()){cases.push({viewport:v.name,control:c.name,ok:true,skipped:true,reason:'control intentionally hidden at this viewport'});continue}
    await button.click({timeout:8000});
    after=await button.getAttribute('aria-expanded');
    visible=await page.locator(c.panel).isVisible();
   }catch(e){error=String(e).slice(0,250)}
   let closedOnEscape=null, reopened=null, closedOutside=null;
   if(!error&&after==='true'){
     await page.keyboard.press('Escape');
     closedOnEscape=(await button.getAttribute('aria-expanded'))==='false';
     await button.click({timeout:8000});
     reopened=(await button.getAttribute('aria-expanded'))==='true';
     await page.locator('body').click({position:{x:1,y:1}});
     closedOutside=(await button.getAttribute('aria-expanded'))==='false';
   }
   cases.push({viewport:v.name,control:c.name,before,after,visible,closedOnEscape,reopened,closedOutside,ok:!error&&before==='false'&&after==='true'&&visible===true&&closedOnEscape&&reopened&&closedOutside,error});
  }
  await page.close();
 }
 // Verify real navigation targets from both captured menus without submitting forms.
 for(const nav of [{name:'language-zh',viewport:{width:1440,height:900},open:'#langBtn',link:'#langMenu a[href$="/zh"]',expected:'/NewVPS/zh/'},{name:'mobile-vps',viewport:{width:390,height:844},open:'#mobBtn',link:'#mobMenu a[href$="/vps"]',expected:'/NewVPS/vps/'}]){
  const page=await browser.newPage({viewport:nav.viewport});
  let target=null,error=null;
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator(nav.open).click({timeout:8000});
   const link=page.locator(nav.link).first();
   if(!await link.count())throw Error('captured menu link missing: '+nav.link);
   await link.click({timeout:8000});
   await page.waitForLoadState('domcontentloaded',{timeout:15000});
   target=new URL(page.url()).pathname;
  }catch(e){error=String(e).slice(0,300)}
  cases.push({control:nav.name,target,expected:nav.expected,ok:!error&&target===nav.expected,error});
  await page.close();
 }
 await browser.close();
 const summary={tests:cases.length,passed:cases.filter(x=>x.ok).length,failed:cases.filter(x=>!x.ok).length};
 fs.mkdirSync('interaction-audit',{recursive:true});
 fs.writeFileSync('interaction-audit/menu-report.json',JSON.stringify({summary,cases},null,2));
 console.log('MENU_AUDIT_SUMMARY '+JSON.stringify(summary));
 for(const c of cases)console.log('MENU_CASE '+JSON.stringify(c));
 if(summary.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
