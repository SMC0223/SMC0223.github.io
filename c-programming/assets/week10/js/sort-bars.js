(function(){
  function inspect(initial,output){
    const frames=[];
    const fail=error=>({frames,error,complete:false});
    if(typeof output!=='string'||!output.trim())return fail('배열 출력 없음: 한 줄에 정수 5개 출력');
    const lines=output.trim().split(/\r?\n/);
    if(lines.length>51||output.length>20000)return fail('출력이 너무 많음: 반복 횟수 확인');
    const ordered=initial.slice().sort((a,b)=>a-b);
    for(let i=0;i<lines.length;i++){
      if(!/^\s*[+-]?\d+(?:\s+[+-]?\d+)*\s*$/.test(lines[i]))return fail(`${i+1}번째 줄: 정수 5개만 공백으로 구분하여 출력`);
      const values=lines[i].trim().split(/\s+/).map(Number);
      if(values.length!==initial.length||!values.every(Number.isSafeInteger))return fail(`${i+1}번째 줄: 배열 원소 5개 필요`);
      if(values.slice().sort((a,b)=>a-b).some((v,j)=>v!==ordered[j]))return fail(`${i+1}번째 줄: 원소 중복·누락 발생. temp를 이용한 교환 확인`);
      if(i===0&&values.some((v,j)=>v!==initial[j]))return fail('첫 줄에는 초기 배열 5 3 4 1 2 출력');
      frames.push(values);
    }
    if(frames.length!==initial.length)return fail('초기 배열과 바깥 반복 4회 직후의 배열을 총 5줄 출력');
    if(frames.at(-1).some((v,j)=>v!==ordered[j]))return fail('정렬 미완료: 최솟값 비교와 값 교환 확인');
    return {frames,error:null,complete:true};
  }
  globalThis.LectureSort={inspect};
  if(typeof document==='undefined')return;
  const ns='http://www.w3.org/2000/svg';
  document.querySelectorAll('[data-sort-bars]').forEach(lab=>{
    const data=JSON.parse(lab.dataset.config), initial=data.initial;
    const get=name=>lab.querySelector(`[data-sort-${name}]`);
    const source=lab.closest('section').querySelector('[data-sort-source]');
    if(!source)return;
    const editor=source.querySelector('[data-code]'), output=source.querySelector('[data-output]'), runnerStatus=source.querySelector('[data-status]');
    const chart=lab.querySelector('svg'), bars=new Map();
    let result=null,index=0,timer=null,settled=false;
    function element(tag,attrs,text){const node=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
    initial.forEach((value,i)=>{
      get('slots').append(element('text',{x:90+i*130,y:407,'text-anchor':'middle','font-size':25,fill:'#64748b'},i));
      const group=element('g',{'class':'sort-bar','data-value':value,transform:`translate(${48+i*130} 0)`});
      group.append(element('rect',{x:0,y:370-value*55,width:84,height:value*55,rx:7,fill:data.colors[value]}));
      group.append(element('text',{x:42,y:353-value*55,'text-anchor':'middle','font-size':34,'font-weight':700,fill:'#233b53'},value));
      get('bars-layer').append(group);bars.set(value,group);
    });
    function stop(){clearInterval(timer);timer=null;}
    function status(message,state='idle'){get('status').textContent=message;lab.dataset.state=state;}
    function ready(){return runnerStatus.dataset.state==='success'&&output.dataset.executedSource===editor.value&&output.dataset.executedInput===source.querySelector('[data-stdin]').value;}
    function paint(instant=false){
      const values=result?.frames[index]||initial, previous=result?.frames[index-1];
      if(instant)chart.classList.add('sort-no-motion');
      values.forEach((value,i)=>{const bar=bars.get(value);bar.style.transform=`translate(${48+i*130}px,0px)`;bar.dataset.index=String(i);bar.classList.toggle('is-moving',Boolean(previous&&previous[i]!==value));});
      if(instant){chart.getBoundingClientRect();chart.classList.remove('sort-no-motion');}
      get('array').textContent=values.join('  ');
      get('stage').textContent=result?`단계 ${index}/4`:'초기 배열';
      get('apply').disabled=!ready();get('play').disabled=!result?.frames.length;get('step').disabled=!result?.frames.length||settled;get('rewind').disabled=!result;
      get('play').textContent=timer?'일시 정지':settled?'다시 재생':'재생';get('play').setAttribute('aria-pressed',String(Boolean(timer)));
    }
    function clear(message='코드 수정됨: 다시 실행 필요'){stop();result=null;index=0;settled=false;status(message);paint(true);}
    function rewind(){stop();index=0;settled=false;status('초기 배열로 복귀: 재생 또는 한 단계 선택');paint(true);}
    function finish(){stop();settled=true;status(result.error?`확인 필요 · ${result.error}`:'정렬 완료 · 1 2 3 4 5',''+(result.error?'error':'success'));paint();}
    function advance(){
      if(!result||settled)return;
      if(index+1<result.frames.length){index++;paint();status(`배열의 순서 변경 · 단계 ${index}/4`,'running');if(index===result.frames.length-1)finish();}else finish();
    }
    function play(){if(!result?.frames.length)return;if(settled)rewind();stop();timer=setInterval(advance,Number(get('speed').value));status('C 코드의 출력 단계대로 막대 이동 중','running');paint();}
    function apply(){if(!ready())return clear('현재 코드 실행 완료 후 적용 가능');stop();result=inspect(initial,output.dataset.stdout||'');index=0;settled=false;paint(true);if(result.frames.length<=1)finish();else play();}
    get('apply').addEventListener('click',apply);
    get('play').addEventListener('click',()=>{if(timer){stop();status('일시 정지: 한 단계 또는 재생 선택');paint();}else play();});
    get('step').addEventListener('click',()=>{stop();advance();paint();});get('rewind').addEventListener('click',rewind);
    get('speed').addEventListener('change',()=>{if(timer)play();});
    source.addEventListener('c-runner:start',()=>clear('C 코드 실행 중: 출력 결과 수신 대기'));
    source.addEventListener('c-runner:complete',event=>{if(event.detail.source!==editor.value||event.detail.input!==source.querySelector('[data-stdin]').value)return clear('코드 또는 입력 변경됨: 다시 실행 필요');if(event.detail.success)apply();else clear('C 코드 실행 실패: 컴파일러 출력 확인');});
    editor.addEventListener('input',()=>clear());source.querySelector('[data-stdin]').addEventListener('input',()=>clear('입력 변경됨: 다시 실행 필요'));
    lab.addEventListener('keydown',event=>{if(event.target.closest('button,select,input'))event.stopPropagation();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){stop();status('화면 전환으로 일시 정지');paint();}});
    if(globalThis.Reveal?.on)Reveal.on('slidechanged',event=>{if(!event.currentSlide.contains(lab)&&timer){stop();status('슬라이드 전환으로 일시 정지');paint();}});
    paint(true);
  });
})();
