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
      if(choices.size<2){
        board.textContent='Top jurisdictions appear after the second question.';
        return;
      }
      board.replaceChildren();
      ranking().slice(0,3).forEach(function(item,i){
        const line=document.createElement('div');
        line.className='sel-aside-rank';
        line.textContent=(i+1)+'. '+item.country.flag+' '+item.country.name+' — '+item.match+'/100';
        board.appendChild(line);
      });
      const disclaimer=document.createElement('small');
      disclaimer.textContent='Illustrative heuristic scores, not legal advice or verified country ratings.';
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
        step.classList.toggle('done',choices.has(n));
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
      if(result)result.hidden=true;
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
              const heading=document.createElement('h2');
              heading.textContent='Recommended jurisdictions';
              resultInner.appendChild(heading);
              const intro=document.createElement('p');
              intro.textContent='Independent estimates based on your five answers. Scores are heuristic (0–100), not measured compatibility probabilities or original-site results.';
              resultInner.appendChild(intro);
              const list=document.createElement('ol');
              ranking().forEach(function(item){
                const li=document.createElement('li');
                li.textContent=item.country.flag+' '+item.country.name+' — '+item.match+'/100';
                list.appendChild(li);
              });
              resultInner.appendChild(list);
              const note=document.createElement('p');
              note.textContent='Ratings are editorial assumptions, not verified legal, privacy, performance or service-availability claims. Independently verify requirements before purchasing.';
              resultInner.appendChild(note);
              const restart=document.createElement('button');
              restart.type='button';
              restart.className='sel-opt';
              restart.textContent='Start again';
              restart.addEventListener('click',function(){choices.clear();current=1;render()});
              resultInner.appendChild(restart);
              result.hidden=false;
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
