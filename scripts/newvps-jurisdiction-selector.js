/* Restore the five archived jurisdiction-selector questions and navigation.
   Original captured HTML, labels, values, and ZIP files remain untouched.
   No fabricated country scoring is introduced: the original scoring engine
   was not included in the static capture. */
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
              heading.textContent='Your jurisdiction priorities';
              resultInner.appendChild(heading);
              const list=document.createElement('ol');
              Array.from(choices).sort(function(a,b){return a[0]-b[0]}).forEach(function(pair){
                const item=document.createElement('li');
                item.textContent=pair[1].dataset.label||pair[1].querySelector('.sel-opt-txt')?.textContent||'';
                list.appendChild(item);
              });
              resultInner.appendChild(list);
              const note=document.createElement('p');
              note.textContent='The original country-ranking calculation was not preserved in the archived page. Your five answers are shown without inventing a recommendation.';
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
