(function () {
  const dt = 0.001, steps = 1000;
  function forwardDynamics(q) {
    const m = 1, L = 1, g = 9.81, Lc = L / 2, I = m * L * L / 3;
    return -m * g * Lc * Math.cos(q) / I;
  }
  function simulate(initialDegrees) {
    if (!Number.isFinite(initialDegrees) || Math.abs(initialDegrees) > 180)
      throw new RangeError('initial angle must be between -180 and 180 degrees');
    let q = initialDegrees * Math.PI / 180, dq = 0, ddq = forwardDynamics(q);
    const samples = [{time: 0, q, dq, ddq}];
    for (let i = 1; i <= steps; i++) {
      dq += ddq * dt;
      q += dq * dt;
      ddq = forwardDynamics(q);
      samples.push({time: i * dt, q, dq, ddq});
    }
    return samples;
  }
  const endpoint = q => ({x: Math.cos(q), y: Math.sin(q)});
  const signed = v => `${v < 0 || Object.is(v,-0) ? '-' : '+'}${Math.abs(v).toFixed(3)}`;
  const formatSample = s => `t=${s.time.toFixed(3)} q=${signed(s.q)} dq=${signed(s.dq)} ddq=${signed(s.ddq)}\n`;
  const header = 'time(s) q(rad) dq(rad/s) ddq(rad/s^2)\n';
  globalThis.LectureOneLink = {forwardDynamics, simulate, endpoint, dt, steps, formatSample, header};
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-one-link]').forEach(lab => {
    const get = s => lab.querySelector(s);
    const input = get('[data-ol-input]'), output = get('[data-ol-output]');
    const run = get('[data-ol-run]'), halt = get('[data-ol-stop]'), status = get('[data-ol-status]');
    let samples = simulate(0), index = 0, running = false, frame = 0, start = 0;
    function stop(message) {
      running = false; cancelAnimationFrame(frame); run.disabled = false; halt.disabled = true; input.readOnly = false;
      if (message) status.textContent = message;
    }
    function angleInput() {
      const text = input.value.trim();
      const value = Number(text);
      const valid = text !== '' && Number.isFinite(value) && Math.abs(value) <= 180;
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid) {status.textContent = '-180~180 사이의 초기 각도 1개 입력'; return null;}
      return value;
    }
    function draw() {
      const p = endpoint(samples[index].q), initial = endpoint(samples[0].q);
      get('[data-ol-link]').setAttribute('d', `M300 265L${300+190*p.x} ${265-190*p.y}`);
      get('[data-ol-initial]').setAttribute('d', `M300 265L${300+190*initial.x} ${265-190*initial.y}`);
      get('[data-ol-tip]').setAttribute('cx',300+190*p.x);get('[data-ol-tip]').setAttribute('cy',265-190*p.y);
      const angle = Math.atan2(Math.sin(samples[index].q),Math.cos(samples[index].q));
      get('[data-ol-arc]').setAttribute('d',Array.from({length:41},(_,i)=>{
        const a=angle*i/40;return `${i?'L':'M'}${300+48*Math.cos(a)} ${265-48*Math.sin(a)}`;
      }).join(' '));
      get('[data-ol-clock]').textContent = `${samples[index].time.toFixed(3)} s`;
    }
    function tick(now) {
      if (!running) return;
      const next = Math.min(steps,Math.max(index,0,Math.floor((now-start)/(dt*1000))));
      const following = output.scrollTop + output.clientHeight >= output.scrollHeight - 16;
      let text = '';
      for (let i = index+1;i<=next;i++) text += formatSample(samples[i]);
      if (text) output.value += text;
      if (following) output.scrollTop=output.scrollHeight;
      index=next;draw();
      if(index===steps) stop('1초 실행 완료'); else frame=requestAnimationFrame(tick);
    }
    run.addEventListener('click',()=>{
      const angle=angleInput();if(angle===null)return;
      stop();samples=simulate(angle);index=0;output.value=header;output.scrollTop=0;draw();
      running=true;run.disabled=true;halt.disabled=false;input.readOnly=true;status.textContent='실행 중';
      start=performance.now();frame=requestAnimationFrame(tick);
    });
    halt.addEventListener('click',()=>stop('정지 · 실행 시 처음부터 시작'));
    input.addEventListener('input',()=>{
      const angle=angleInput();if(angle===null)return;
      samples=simulate(angle);index=0;output.value='';draw();status.textContent='실행 준비';
    });
    get('[data-ol-reset]').addEventListener('click',()=>{
      stop();input.value='0';input.setAttribute('aria-invalid','false');samples=simulate(0);index=0;output.value='';draw();status.textContent='실행 준비';
    });
    lab.addEventListener('keydown',e=>{if(e.target.matches('textarea,button'))e.stopPropagation();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stop('정지');});
    if(globalThis.Reveal?.on)globalThis.Reveal.on('slidechanged',e=>{if(!e.currentSlide.contains(lab)&&running)stop('정지');});
    draw();
  });
})();
