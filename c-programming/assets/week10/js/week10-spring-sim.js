(function () {
  const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function parseFrames(stdout) {
    if (typeof stdout !== 'string' || stdout.length > 120000) throw Error('출력 크기 확인 필요');
    const frames = [];
    for (const line of stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] !== 'SPRING') continue;
      if (parts.length !== 6 || parts.slice(1).some(value => !number.test(value))) throw Error('SPRING 출력 형식: 시간 위치 속도 가속도 힘');
      const [t, x, v, a, f] = parts.slice(1).map(Number);
      if (![t, x, v, a, f].every(Number.isFinite)) throw Error('유한한 숫자 출력 필요');
      if (t < 0 || t > 120) throw Error('시간은 0~120초 범위 필요');
      if ([x, v, a, f].some(value => Math.abs(value) > 1e6)) throw Error('위치·속도·가속도·힘의 절댓값은 100만 이하 필요');
      if (frames.length && t <= frames[frames.length - 1].t) throw Error('시간은 단계마다 증가해야 함');
      if (frames.length && t - frames[frames.length - 1].t < 0.000001 - 1e-12) throw Error('시간 간격은 0.000001초 이상 필요');
      frames.push({ t, x, v, a, f });
      if (frames.length > 600) throw Error('시간 단계는 600개 이하로 출력');
    }
    if (frames.length < 2) throw Error('SPRING 출력은 서로 다른 시간의 두 줄 이상 필요');
    if (frames[frames.length - 1].t - frames[0].t > 120) throw Error('시뮬레이션 시간은 120초 이하로 출력');
    return frames;
  }

  function initialize(lab) {
    const section = lab.closest('section');
    const runner = section?.querySelector('[data-c-runner]');
    if (!runner) return;
    const editor = runner.querySelector('[data-code]');
    const input = runner.querySelector('[data-stdin]');
    const get = name => lab.querySelector(`[data-spring-${name}]`);
    let frames = null, timer = null, epoch = 0, elapsed = 0, scale = 120, revision = 0, startRevision = -1;

    function status(message, state = 'idle') { get('status').textContent = message; lab.dataset.state = state; }
    function stop() { if (timer !== null) cancelAnimationFrame(timer); timer = null; }
    function format(value) { return Math.abs(value) < 0.0005 ? '0.00' : value.toFixed(2); }
    function paint(frame) {
      const x = 330 + frame.x * scale;
      get('mass').setAttribute('transform', `translate(${x} 0)`);
      const end = x - 35;
      const length = end - 38;
      const points = ['38,93', `${38 + length * 0.07},93`];
      for (let i = 0; i <= 11; i++) points.push(`${38 + length * (0.07 + 0.86 * i / 11)},${i % 2 ? 104 : 82}`);
      points.push(`${end},93`);
      get('coil').setAttribute('points', points.join(' '));
      get('stiffness').setAttribute('x', String((38 + end) / 2));
      const dir = Math.sign(frame.f);
      get('force').setAttribute('d', dir ? `M ${dir * 6} 49 h ${dir * 46} m ${-dir * 9} -7 l ${dir * 9} 7 l ${-dir * 9} 7` : '');
      get('force-label').setAttribute('visibility', dir ? 'visible' : 'hidden');
      get('force-label').setAttribute('x', String(dir * 29));
      get('values').textContent = `t ${format(frame.t)} s · x ${format(frame.x)} m · v ${format(frame.v)} m/s · a ${format(frame.a)} m/s² · f ${format(frame.f)} N`;
    }
    function clear(message) {
      stop(); frames = null; elapsed = 0; scale = 120;
      paint({ t: 0, x: 0, v: 0, a: 0, f: 0 });
      get('values').textContent = 't · x · v · a · f: 실행 결과 대기';
      get('play').disabled = true; get('play').textContent = '재생'; status(message);
    }
    function drawFrame(time) {
      let i = 0;
      while (i + 1 < frames.length && frames[i + 1].t <= time) i++;
      if (i + 1 === frames.length) return paint(frames[i]);
      const left = frames[i], right = frames[i + 1];
      const alpha = (time - left.t) / (right.t - left.t);
      const frame = { t: time };
      for (const key of ['x', 'v', 'a', 'f']) frame[key] = left[key] * (1 - alpha) + right[key] * alpha;
      paint(frame);
    }
    function animate(now) {
      if (!frames) return;
      const duration = frames.at(-1).t - frames[0].t;
      elapsed = Math.min(duration, (now - epoch) / 1000);
      drawFrame(frames[0].t + elapsed);
      if (elapsed >= duration) { stop(); get('play').textContent = '다시 재생'; status('C 출력 결과 재생 완료', 'success'); }
      else timer = requestAnimationFrame(animate);
    }
    function play() {
      if (!frames) return;
      const duration = frames.at(-1).t - frames[0].t;
      if (elapsed >= duration) elapsed = 0;
      epoch = performance.now() - elapsed * 1000;
      get('play').textContent = '일시 정지'; status('C 출력 결과 재생 중', 'running');
      timer = requestAnimationFrame(animate);
    }
    get('play').addEventListener('click', () => {
      if (timer !== null) { stop(); get('play').textContent = '재생'; status('일시 정지'); }
      else play();
    });
    const invalidate = () => { revision++; clear('코드 또는 입력 수정됨 · 다시 실행 필요'); };
    editor.addEventListener('input', invalidate);
    input.addEventListener('input', invalidate);
    runner.addEventListener('c-runner:start', () => { startRevision = revision; clear('C 코드 실행 중 · 결과 대기'); });
    runner.addEventListener('c-runner:complete', event => {
      const result = event.detail;
      if (revision !== startRevision || result.source !== editor.value || result.input !== input.value) return clear('코드 또는 입력 변경됨 · 다시 실행 필요');
      if (!result.success) return clear('실행 실패 · 컴파일러 출력 확인');
      try {
        frames = parseFrames(result.stdout);
        const maxX = Math.max(...frames.map(frame => Math.abs(frame.x)), 0.001);
        scale = Math.min(120, 240 / maxX);
        elapsed = 0; get('play').disabled = false; paint(frames[0]); play();
      } catch (error) { clear(error.message); lab.dataset.state = 'error'; }
    });
    globalThis.Reveal?.on('slidechanged', event => {
      if (!event.currentSlide.contains(lab) && timer !== null) { stop(); get('play').textContent = '재생'; status('슬라이드 전환으로 일시 정지'); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && timer !== null) { stop(); get('play').textContent = '재생'; status('화면 전환으로 일시 정지'); }
    });
  }

  globalThis.Week10SpringSimulation = { parseFrames, initialize };
  if (typeof document !== 'undefined') document.querySelectorAll('[data-week10-spring-sim]').forEach(initialize);
})();
