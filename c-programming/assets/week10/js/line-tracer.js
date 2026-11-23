(function () {
  const model = globalThis.LectureLineTracer;
  if (!model || typeof document === 'undefined') return;
  document.querySelectorAll('[data-line-tracer]').forEach(lab => {
    const get = name => lab.querySelector(`[data-lt-${name}]`);
    let state = model.initial(), policy = { ...model.defaults };
    let trail = [];
    let lastLap = null, bestLap = null;
    let running = false, frame = 0, previous = null;
    const editor = document.querySelector('[data-line-tracer-source] [data-code]');
    let appliedSource = null, busy = false, requestId = 0, controller;
    function ready() { return !busy && editor && appliedSource === editor.value; }
    function paint() {
      const { sensors, command } = model.sample(state, policy);
      get('robot').setAttribute('transform', `translate(${state.x} ${state.y}) rotate(${state.heading * 180 / Math.PI})`);
      ['left', 'right'].forEach(side => {
        get(side).textContent = sensors[side].value;
        get(side).setAttribute('data-sensor-value', String(sensors[side].value));
        get(side).setAttribute('aria-label', `${side === 'left' ? '왼쪽' : '오른쪽'} 센서: ${sensors[side].value}, ${sensors[side].value ? '검은 선' : '흰 바닥'}`);
        const marker = lab.querySelector(`[data-lt-sensor="${side}"]`);
        marker.setAttribute('fill', sensors[side].value ? '#000000' : '#ffffff');
        marker.setAttribute('stroke', sensors[side].value ? '#ffffff' : '#000000');
      });
      lab.querySelectorAll('[data-lt-row]').forEach(row => row.classList.toggle('is-active', ready() && row.dataset.ltRow === command.key));
      get('command').textContent = ready() ? `${command.label} (왼쪽 ${command.left} / 오른쪽 ${command.right})` : '코드 적용 필요';
      get('actual').textContent = `${state.actualLeft.toFixed(1)} / ${state.actualRight.toFixed(1)}`;
      get('trail').setAttribute('points', trail.map(point => point.join(',')).join(' '));
      const lapEnded = Boolean(state.lap && ['finished', 'invalid'].includes(state.lap.status));
      get('run').disabled = !ready() || lapEnded;
      get('race').disabled = !ready();
      get('lap').textContent = state.lap ? `${state.lap.elapsed.toFixed(3)}초${state.lap.status === 'invalid' ? ' · 코스 이탈' : state.lap.status === 'finished' ? ' · 완주' : ''}` : '대기';
      get('last').textContent = lastLap === null ? '—' : `${lastLap.toFixed(3)}초`;
      get('best').textContent = bestLap === null ? '—' : `${bestLap.toFixed(3)}초`;
      get('apply').disabled = busy || !editor;
      get('run').textContent = running ? '일시 정지' : '주행 시작';
      get('run').setAttribute('aria-pressed', String(running));
    }
    function pause(message) {
      running = false;
      cancelAnimationFrame(frame);
      previous = null;
      if (message) get('status').textContent = message;
      paint();
    }
    function advance(dt) {
      if (state.lap && ['finished', 'invalid'].includes(state.lap.status)) return;
      state = model.step(state, dt, policy);
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(state.x - last[0], state.y - last[1]) > 1) {
        trail.push([state.x, state.y]);
        if (trail.length > 1200) trail.shift();
      }
      const { command } = model.sample(state, policy);
      if (state.lap?.status === 'finished') {
        lastLap = state.lap.elapsed;
        bestLap = bestLap === null ? lastLap : Math.min(bestLap, lastLap);
        pause('정지선 도착 후 정지 완료: 코드 수정 후 다시 도전 가능');
        return;
      }
      if (state.lap?.status === 'invalid') {
        pause(state.lap.reason === 'missed-stop' ? '정지선 통과: 기록 무효. 센서값 11의 정지 명령과 감속 거리 확인' : '코스 이탈: 기록 무효. 속도 조정 후 다시 도전');
        return;
      }
      if (state.x < 25 || state.x > 795 || state.y < 25 || state.y > 435) {
        pause('화면 경계 도달: 코드 적용 또는 랩타임 도전으로 다시 시작');
      } else if (command.action === 'STOP' && state.actualLeft === 0 && state.actualRight === 0) {
        pause('정지 조건 선택: 센서값과 해당 조건의 동작 확인');
      }
      paint();
    }
    function tick(now) {
      if (!running) return;
      if (previous !== null) advance(Math.min((now - previous) / 1000, 0.05));
      previous = now;
      if (running) frame = requestAnimationFrame(tick);
    }
    get('run').addEventListener('click', () => {
      if (!ready()) return;
      if (state.lap && ['finished', 'invalid'].includes(state.lap.status)) return;
      if (running) return pause('일시 정지: 현재 센서값과 조건 확인');
      if (!state.lap) state = model.startLap();
      running = true;
      previous = null;
      get('status').textContent = '센서 감지 → 조건 판단 → 이동';
      paint();
      frame = requestAnimationFrame(tick);
    });
    get('race').addEventListener('click', () => {
      if (!ready()) return;
      pause();
      state = model.startLap();
      trail = [];
      running = true;
      previous = null;
      get('status').textContent = '랩타임 측정 중: 같은 코드를 유지하며 시계 방향 한 바퀴';
      paint();
      frame = requestAnimationFrame(tick);
    });
    get('apply').addEventListener('click', async () => {
      if (busy || !editor) return;
      pause('코드 확인 중: 주행 일시 정지');
      busy = true;
      const source = editor.value, id = ++requestId;
      controller = new AbortController();
      const signal = controller.signal;
      const currentController = controller;
      const timeout = setTimeout(() => currentController.abort(), 120000);
      paint();
      try {
        const nextPolicy = await globalThis.LectureLineTracerCompiler.compilePolicy(source, {
          signal, progress: key => { get('apply-status').textContent = `센서 ${key[0]} ${key[1]} 실행 확인 중…`; }
        });
        if (id !== requestId || source !== editor.value) return;
        policy = nextPolicy;
        appliedSource = source;
        state = model.initial();
        trail = [];
        lab.querySelectorAll('[data-lt-policy]').forEach(output => { const speeds = policy[output.dataset.ltPolicy]; output.textContent = `${speeds.left} / ${speeds.right}`; });
        get('apply-status').textContent = '네 가지 입력 확인 완료: 수정한 코드 적용됨. 주행 시작 선택.';
        get('status').textContent = '코드 적용 완료: 시작 위치로 이동';
      } catch (error) {
        if (id !== requestId) return;
        appliedSource = null;
        lab.querySelectorAll('[data-lt-policy]').forEach(output => { output.textContent = '미적용'; });
        get('apply-status').textContent = error.name === 'AbortError'
          ? '응답 대기 시간 초과: 인터넷 연결 확인 후 다시 적용.'
          : `적용 실패: ${error.message}\n코드 또는 인터넷 연결 확인 후 다시 적용.`;
      } finally {
        clearTimeout(timeout);
        if (id === requestId) { busy = false; paint(); }
      }
    });
    editor?.addEventListener('input', () => {
      requestId++;
      controller?.abort();
      busy = false;
      appliedSource = null;
      delete state.lap;
      pause('코드 수정됨: 다시 적용 필요');
      lab.querySelectorAll('[data-lt-policy]').forEach(output => { output.textContent = '미적용'; });
      get('apply-status').textContent = '코드 수정됨: 코드 적용 버튼으로 네 가지 입력을 다시 확인.';
    });
    lab.addEventListener('keydown', event => { if (event.target.closest('button, select, input')) event.stopPropagation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause('화면 전환으로 일시 정지'); });
    if (globalThis.Reveal?.on) Reveal.on('slidechanged', event => {
      if (!event.currentSlide.contains(lab) && running) pause('슬라이드 전환으로 일시 정지');
    });
    paint();
  });
})();
