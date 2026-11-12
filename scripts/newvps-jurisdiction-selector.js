/* Independent, illustrative jurisdiction recommender using the five archived
   questions. The country ratings below are editorial assumptions (0-10),
   NOT the original site's algorithm or verified legal/compliance assessments.
   Original HTML and ZIP files remain unchanged. */
(function(){
  'use strict';
  function init(){
    const root=document.getElementById('selectorTool');
    if(!root)return;
    const questions=Array.from(root.querySelectorAll('.sel-q[data-q]'));
    if(questions.length!==5)return;
    const steps=Array.from(root.querySelectorAll('.sel-step[data-step]'));
    const back=root.querySelector('#selBack');
    const number=root.querySelector('#selStepNum');
    const progress=root.querySelector('#selProgress');
    const profile=root.querySelector('#selProfile');
    const result=root.querySelector('.sel-result');
    const resultInner=root.querySelector('.sel-result-inner');
    // Heuristic profiles, not legal claims or original AnonPort ratings.
    // Dimensions: dmca, gdpr, budget, latency_eu, latency_us, perf,
    // geo_neutral, speech. Ratings 0-10 are transparent and editable.
    const countries=[
      {name:'Iceland',flag:'🇮🇸',scores:{dmca:6,gdpr:2,budget:3,latency_eu:7,latency_us:5,perf:7,geo_neutral:8,speech:9}},
      {name:'Switzerland',flag:'🇨🇭',scores:{dmca:5,gdpr:8,budget:2,latency_eu:9,latency_us:5,perf:9,geo_neutral:10,speech:8}},
      {name:'Panama',flag:'🇵🇦',scores:{dmca:8,gdpr:10,budget:6,latency_eu:3,latency_us:9,perf:5,geo_neutral:7,speech:6}},
      {name:'Moldova',flag:'🇲🇩',scores:{dmca:8,gdpr:10,budget:10,latency_eu:7,latency_us:3,perf:5,geo_neutral:5,speech:6}},
      {name:'Romania',flag:'🇷🇴',scores:{dmca:5,gdpr:2,budget:8,latency_eu:9,latency_us:4,perf:8,geo_neutral:4,speech:6}},
      {name:'Netherlands',flag:'🇳🇱',scores:{dmca:3,gdpr:2,budget:5,latency_eu:10,latency_us:7,perf:10,geo_neutral:4,speech:7}},
      {name:'Russia',flag:'🇷🇺',scores:{dmca:8,gdpr:10,budget:9,latency_eu:5,latency_us:2,perf:6,geo_neutral:3,speech:2}}
    ];
    function ranking(){
      const weights={};
      choices.forEach(function(option){
        const key=option.dataset.key;
        const value=Number(option.dataset.val)||0;
        if(key)weights[key]=(weights[key]||0)+value;
      });
      const total=Object.values(weights).reduce(function(a,b){return a+b},0);
      return countries.map(function(country){
        const sum=Object.keys(weights).reduce(function(acc,key){
          return acc+weights[key]*(country.scores[key]||0);
        },0);
        return {country:country,match:total?Math.round(sum/total*10):0};
      }).sort(function(a,b){return b.match-a.match||a.country.name.localeCompare(b.country.name)});
    }
    function renderLeaderboard(){
      const board=root.querySelector('#selLeaderboard');
      if(!board)return;
      board.replaceChildren();
      if(!choices.size){
        const hint=document.createElement('div');
        hint.className='sel-aside-hint';
        hint.textContent='Top jurisdictions appear as you answer.';
        board.appendChild(hint);
        return;
      }
      ranking().slice(0,3).forEach(function(item,i){
        const row=document.createElement('div');
        row.className='sel-aside-rank';
        row.style.cssText='display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #ececec;border-radius:5px;';
        if(i===0)row.style.background='#edf1fc';
        const rank=document.createElement('span');
        rank.textContent=String(i+1);
        rank.style.cssText='width:15px;font-size:11px;color:#64748b;';
        const flag=document.createElement('span');
        flag.textContent=item.country.flag;
        flag.style.fontSize='23px';
        const name=document.createElement('span');
        name.textContent=item.country.name;
        name.style.cssText='font-size:13px;flex:1;';
        if(i===0){name.style.color='#1a56db';name.style.fontWeight='700';}
        const bar=document.createElement('span');
        bar.style.cssText='display:block;width:48px;height:5px;background:#e9edf2;border-radius:9px;overflow:hidden;';
        const fill=document.createElement('span');
        fill.style.cssText='display:block;height:100%;border-radius:9px;background:'+(i===0?'#3b82f6':'#17a568')+';width:'+item.match+'%;';
        bar.appendChild(fill);
        const score=document.createElement('strong');
        score.textContent=item.match+'%';
        score.style.cssText='font-size:12px;color:#555;';
        row.append(rank,flag,name,bar,score);
        board.appendChild(row);
      });
      const disclaimer=document.createElement('small');
      disclaimer.textContent='Estimated scores from a custom model.';
      disclaimer.style.cssText='display:block;color:#68707a;font-size:10px;margin-top:9px;';
      board.appendChild(disclaimer);
    }
    const choices=new Map();
    let current=1;
    function render(){
      questions.forEach(function(q){
        const active=Number(q.dataset.q)===current;
        q.classList.toggle('on',active);
        q.hidden=!active;
        q.style.display=active?'block':'none';
      });
      steps.forEach(function(step){
        const n=Number(step.dataset.step);
        step.classList.toggle('on',n===current);
        step.classList.toggle('done',n<current||choices.has(n));
        const completed=n<=current;
        step.style.backgroundColor=completed?'#1a56db':'#fff';
        step.style.borderColor=completed?'#1a56db':'#ececec';
        step.style.color=completed?'#fff':'#68707a';
        step.setAttribute('aria-current',n===current?'step':'false');
        step.disabled=n>1&&!choices.has(n-1);
      });
      if(number)number.textContent=String(current);
      if(progress)progress.style.width=(current*20)+'%';
      if(back){
        back.disabled=current===1;
        back.classList.toggle('hidden',current===1);
        back.style.opacity=current===1?'0':'1';
        back.style.visibility=current===1?'hidden':'visible';
        back.style.pointerEvents=current===1?'none':'auto';
        back.querySelectorAll('*').forEach(function(el){el.style.visibility=current===1?'hidden':'visible'});
      }
      questions.forEach(function(q){
        const n=Number(q.dataset.q);
        q.querySelectorAll('.sel-opt').forEach(function(opt){
          const selected=choices.get(n)===opt;
          opt.classList.toggle('on',selected);
          opt.classList.toggle('selected',selected);
          opt.setAttribute('aria-pressed',String(selected));
          opt.style.borderColor=selected?'#1a56db':'';
          opt.style.backgroundColor=selected?'#edf1fc':'';
        });
      });
      if(profile){
        profile.replaceChildren();
        if(!choices.size){
          const empty=document.createElement('li');
          empty.className='sel-aside-empty';
          empty.textContent='Your answers will build up here as you progress.';
          profile.appendChild(empty);
        }else{
          Array.from(choices).sort(function(a,b){return a[0]-b[0]}).forEach(function(pair){
            const item=document.createElement('li');
            const label=pair[1].dataset.label||pair[1].querySelector('.sel-opt-txt')?.textContent||'';
            item.textContent=pair[0]+'. '+label;
            profile.appendChild(item);
          });
        }
      }
      renderLeaderboard();
      if(result){result.hidden=true;result.style.display='none';}
      const head=root.querySelector('.sel-head');
      if(head)head.style.display='';
    }
    questions.forEach(function(q){
      const n=Number(q.dataset.q);
      q.querySelectorAll('.sel-opt').forEach(function(option){
        option.addEventListener('click',function(){
          choices.set(n,option);
          if(n<5){current=n+1;render();}
          else{
            render();
            if(result&&resultInner){
              resultInner.replaceChildren();
              const ranked=ranking();
              const best=ranked[0];
              const others=ranked.slice(1,4);
              const descriptions={
                Iceland:'Free Speech Haven',Switzerland:'Premium Privacy',
                Panama:'No Data Retention',Moldova:'Budget Offshore',
                Romania:'EU Connectivity',Netherlands:'High Performance',
                Russia:'Budget Infrastructure'
              };
              const prices={Moldova:'$7.50/mo',Panama:'$8.50/mo',Russia:'$7.50/mo'};
              const hero=document.createElement('div');
              hero.style.cssText='text-align:center;padding:36px 20px 40px;background:linear-gradient(115deg,#f1f4fc,#fff);border-bottom:1px solid #ececec;';
              const badge=document.createElement('div');
              badge.textContent='BEST MATCH';
              badge.style.cssText='display:inline-block;background:#078348;color:#fff;border-radius:18px;padding:5px 15px;font-size:11px;font-weight:800;margin-bottom:16px;';
              const flag=document.createElement('div');
              flag.textContent=best.country.flag;
              flag.style.cssText='font-size:74px;line-height:1.3;';
              const title=document.createElement('h2');
              title.textContent=best.country.name;
              title.style.cssText='font-size:36px;margin:8px 0 0;color:#111;';
              const subtitle=document.createElement('p');
              subtitle.textContent=descriptions[best.country.name];
              subtitle.style.cssText='color:#1a56db;font-size:14px;font-weight:600;margin:0 0 18px;';
              const match=document.createElement('div');
              match.style.cssText='display:inline-flex;align-items:center;gap:12px;border:1px solid #ececec;background:white;border-radius:30px;padding:10px 18px;min-width:230px;justify-content:center;';
              const matchLabel=document.createElement('span');
              matchLabel.textContent='Match';
              const matchBar=document.createElement('span');
              matchBar.style.cssText='height:6px;width:110px;background:#edf0f4;border-radius:9px;overflow:hidden;';
              const matchFill=document.createElement('span');
              matchFill.style.cssText='display:block;height:100%;width:'+best.match+'%;background:linear-gradient(90deg,#078348,#36cf91);';
              matchBar.appendChild(matchFill);
              const matchScore=document.createElement('strong');
              matchScore.textContent=best.match+'%';
              match.append(matchLabel,matchBar,matchScore);
              hero.append(badge,flag,title,subtitle,match);
              const lower=document.createElement('div');
              lower.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));';
              const why=document.createElement('section');
              why.style.cssText='padding:28px 30px;background:#fff;';
              const whyTitle=document.createElement('h3');
              whyTitle.textContent='WHY THIS JURISDICTION FITS YOU';
              whyTitle.style.cssText='font-size:12px;letter-spacing:.05em;color:#5d666f;margin:0 0 18px;';
              const reasons=document.createElement('ul');
              reasons.style.cssText='padding-left:18px;color:#555;line-height:1.7;font-size:13px;';
              Array.from(choices).sort(function(a,b){return a[0]-b[0]}).slice(0,3).forEach(function(pair){
                const li=document.createElement('li');
                li.textContent='Matches your priority: '+(pair[1].dataset.label||pair[1].textContent.trim());
                reasons.appendChild(li);
              });
              const actions=document.createElement('div');
              actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;';
              [['View plans →','/vps/'],['VPS','/vps/'],['Dedicated','/dedicated/'],['GPU','/gpu/']].forEach(function(pair,i){
                const link=document.createElement('a');
                link.href=pair[1];
                link.textContent=pair[0];
                link.style.cssText='padding:9px 12px;border:1px solid #ececec;border-radius:5px;text-decoration:none;font-size:13px;color:'+(i===0?'white':'#111')+';background:'+(i===0?'#1a56db':'white')+';';
                actions.appendChild(link);
              });
              why.append(whyTitle,reasons,actions);
              const alternatives=document.createElement('section');
              alternatives.style.cssText='padding:28px 30px;background:#f7f8fa;border-left:1px solid #ececec;';
              const altTitle=document.createElement('h3');
              altTitle.textContent='ALTERNATIVES WORTH CONSIDERING';
              altTitle.style.cssText='font-size:12px;letter-spacing:.05em;color:#5d666f;margin:0 0 18px;';
              alternatives.appendChild(altTitle);
              others.forEach(function(item){
                const row=document.createElement('div');
                row.style.cssText='display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #ececec;border-radius:6px;padding:12px;margin:8px 0;';
                const f=document.createElement('span');f.textContent=item.country.flag;f.style.fontSize='25px';
                const name=document.createElement('div');name.style.flex='1';
                const strong=document.createElement('strong');strong.textContent=item.country.name;strong.style.fontSize='13px';
                const desc=document.createElement('div');desc.textContent=descriptions[item.country.name];desc.style.cssText='color:#68707a;font-size:12px;margin-top:3px;';
                name.append(strong,desc);
                const score=document.createElement('strong');
                score.textContent=item.match+'%';
                score.style.cssText='color:#1a56db;font-size:13px;';
                row.append(f,name,score);
                alternatives.appendChild(row);
              });
              const restart=document.createElement('button');
              restart.type='button';
              restart.textContent='↻ Start over';
              restart.style.cssText='border:1px solid #ececec;background:#fff;border-radius:5px;padding:10px 14px;cursor:pointer;margin-top:12px;';
              restart.addEventListener('click',function(){choices.clear();current=1;render();});
              alternatives.appendChild(restart);
              lower.append(why,alternatives);
              const disclaimer=document.createElement('p');
              disclaimer.textContent='Independent estimated scores, not the original website algorithm or verified legal assessments. Country ratings are illustrative; verify legal and service details before ordering.';
              disclaimer.style.cssText='font-size:11px;color:#68707a;padding:10px 24px;background:#f7f8fa;margin:0;';
              resultInner.append(hero,lower,disclaimer);
              result.hidden=false;
              result.style.display='block';
              const head=root.querySelector('.sel-head');
              if(head)head.style.display='none';
              questions.forEach(function(el){el.hidden=true;el.style.display='none'});
            }
          }
        });
      });
    });
    steps.forEach(function(step){
      step.addEventListener('click',function(){
        const n=Number(step.dataset.step);
        if(n===1||choices.has(n-1)){current=n;render();}
      });
    });
    if(back)back.addEventListener('click',function(){if(current>1){current--;render();}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
