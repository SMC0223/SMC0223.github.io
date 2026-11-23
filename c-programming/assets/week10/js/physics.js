(function () {
  const model = globalThis.LecturePhysics;
  document.querySelectorAll('[data-physics]').forEach(lab => {
    const mode = lab.dataset.physics;
    const free = mode === 'freefall';
    const defaults = free ? { height: 20 } : { vx: 12, vy: 16 };
    const params = { ...defaults };
    let time = 0, playing = false, frame = 0, last = 0;
    const get = name => lab.querySelector(`[data-physics-${name}]`);
    const fields = [...lab.querySelectorAll('[data-physics-param]')];
    const fmt = n => n.toFixed(3);
    const valid = () => fields.every(field => field.value !== '' && field.checkValidity());
    const play = get('play');
    play.textContent = '재생';
    get('second').textContent = '1초 값 확인';
    function pause() {
      playing = false;
      cancelAnimationFrame(frame);
      play.textContent = '재생';
    }
    function render() {
      const v = model.evaluate(mode, params, time);
      time = v.t;
      const height = free ? params.height : params.vy ** 2 / (2 * model.G);
      const width = free ? 10 : Math.max(1, params.vx * v.end);
      const pos = (x, y) => [free ? 400 : 85 + x / width * 640, 350 - y / height * 280];
      const [x, y] = pos(v.x, v.y);
      get('ball').setAttribute('cx', x);
      get('ball').setAttribute('cy', y);
      get('position').setAttribute('x', Math.min(605, x + 20));
      get('position').setAttribute('y', Math.max(25, y - 20));
      get('position').textContent = free ? `y = ${v.y.toFixed(2)} m` : `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}) m`;
      get('top').textContent = `높이 눈금: ${height.toFixed(2)} m`;
      get('range').textContent = free ? '' : `${width.toFixed(2)} m`;
      get('path').setAttribute('d', Array.from({length: 81}, (_, i) => {
        const q = model.evaluate(mode, params, v.end * i / 80);
        const [qx, qy] = pos(q.x, q.y);
        return `${i ? 'L' : 'M'}${qx},${qy}`;
      }).join(' '));
      get('time').max = v.end;
      get('time').value = time;
      get('clock').textContent = `${fmt(time)} s`;
      get('formula-one').textContent = free ? `${params.height} − 0.5 × 9.8 × ${fmt(time)}² = ${fmt(v.y)} m` : `${params.vx} × ${fmt(time)} = ${fmt(v.x)} m`;
      get('formula-two').textContent = free ? `9.8 × ${fmt(time)} = ${fmt(v.speed)} m/s` : `${params.vy} × ${fmt(time)} − 0.5 × 9.8 × ${fmt(time)}² = ${fmt(v.y)} m`;
      get('result').textContent = free ? `높이 ${v.y.toFixed(2)} m · 낙하 속력 ${v.speed.toFixed(2)} m/s` : `x = ${v.x.toFixed(2)} m · y = ${v.y.toFixed(2)} m`;
      get('landing').textContent = `지면 도달 시간: ${fmt(v.end)} s · 표시값은 반올림함.`;
      get('state').textContent = !valid() ? '입력 범위 확인 필요' : time >= v.end ? '지면 도달' : playing ? '재생 중' : time === 0 ? '준비' : '일시정지';
    }
    function tick(now) {
      if (!playing) return;
      if (document.hidden || lab.closest('section')?.offsetParent === null) { pause(); render(); return; }
      time += (now - last) / 1000;
      last = now;
      if (time >= model.duration(mode, params)) pause();
      render();
      if (playing) frame = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => {
      if (!valid()) return;
      if (playing) pause();
      else {
        if (time >= model.duration(mode, params)) time = 0;
        playing = true; last = performance.now(); play.textContent = '일시정지';
        frame = requestAnimationFrame(tick);
      }
      render();
    });
    fields.forEach(field => field.addEventListener('input', () => {
      pause();
      const ok = valid();
      play.disabled = get('second').disabled = get('time').disabled = !ok;
      fields.forEach(f => f.setAttribute('aria-invalid', String(!f.checkValidity() || f.value === '')));
      if (ok) { fields.forEach(f => params[f.dataset.physicsParam] = Number(f.value)); time = 0; }
      render();
    }));
    get('time').addEventListener('input', () => { pause(); time = Number(get('time').value); render(); });
    get('second').addEventListener('click', () => { pause(); time = Math.min(1, model.duration(mode, params)); render(); });
    get('reset').addEventListener('click', () => {
      pause(); Object.assign(params, defaults); time = 0;
      fields.forEach(f => { f.value = defaults[f.dataset.physicsParam]; f.removeAttribute('aria-invalid'); });
      play.disabled = get('second').disabled = get('time').disabled = false;
      render();
    });
    lab.addEventListener('keydown', e => { if (e.target.matches('input,button')) e.stopPropagation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); } });
    render();
  });
})();
