(function () {
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  function parseFrames(stdout) {
    if (typeof stdout !== 'string' || !stdout.trim()) throw new Error('좌표 출력 없음');
    if (stdout.length > 100000) throw new Error('출력이 너무 많음');
    const lines = stdout.trim().split(/\r?\n/).filter(line => /^\s*FK(?:\s|$)/.test(line));
    if (!lines.length) throw new Error('FK로 시작하는 좌표 출력 없음');
    if (lines.length > 500) throw new Error('출력은 최대 500줄');
    return lines.map((line, i) => {
      const parts = line.trim().split(/\s+/).slice(1);
      if (parts.length !== 6 || !parts.every(p => numeric.test(p))) throw new Error(`${i + 1}번째 줄: 관절각 두 개, 좌표 두 개, 링크 길이 두 개 필요`);
      const values = parts.map(Number);
      if (!values.every(Number.isFinite) || values.some((v, index) => Math.abs(v) > (index < 2 ? 36000 : 1000))) throw new Error(`${i + 1}번째 줄: 유한한 값 필요`);
      if (values[4] <= 0 || values[5] <= 0) throw new Error(`${i + 1}번째 줄: 양수 링크 길이 필요`);
      return { q1: values[0], q2: values[1], x: values[2], y: values[3], l1: values[4], l2: values[5] };
    });
  }
  globalThis.Week10FkSimulation = { parseFrames };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-week10-fk]').forEach(lab => {
    const section = lab.closest('section');
    const source = section?.querySelector('[data-c-runner]');
    if (!source) return;
    const editor = source.querySelector('[data-code]');
    const input = source.querySelector('[data-stdin]');
    const get = name => lab.querySelector(`[data-fk-${name}]`);
    let frames = [], index = 0, timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    const status = (s, state = 'idle') => { get('status').textContent = s; lab.dataset.state = state; };
    const fmt = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(2);
    function paint() {
      const frame = frames[index];
      get('guide').style.display = frame ? 'none' : '';
      get('arm').style.display = frame ? '' : 'none';
      get('play').disabled = !frame;
      get('first-frame').disabled = !frame;
      get('play').textContent = timer ? '일시 정지' : index === frames.length - 1 && frames.length > 1 ? '다시 재생' : '재생';
      get('frame').textContent = frame ? `${index + 1} / ${frames.length}` : '';
      if (!frame) { get('value').textContent = 'C 코드 실행 후 좌표 표시'; return; }
      const t = frame.q1 * Math.PI / 180;
      const jx = frame.l1 * Math.cos(t), jy = frame.l1 * Math.sin(t);
      const extent = Math.max(frame.l1 + frame.l2, Math.abs(frame.x), Math.abs(frame.y));
      const scale = 95.4 / extent;
      // 좌표축 원점도 결과 범위와 무관하게 동일하게 표시.
      const [ox, oy] = [160, 110];
      const mapped = (x, y) => [ox + x * scale, oy - y * scale];
      const [ax, ay] = mapped(jx, jy), [bx, by] = mapped(frame.x, frame.y);
      get('first').setAttribute('d', `M${ox} ${oy}L${ax} ${ay}`);
      get('second').setAttribute('d', `M${ax} ${ay}L${bx} ${by}`);
      get('joint').setAttribute('cx', ax); get('joint').setAttribute('cy', ay);
      get('tip').setAttribute('cx', bx); get('tip').setAttribute('cy', by);
      // 주어진 링크 길이와 각도는 보조선에만 사용. 끝점은 항상 C 출력값 사용.
      const attr = (name, key, value) => get(name)?.setAttribute(key, value);
      const point = (name, x, y) => { attr(name, 'x', x); attr(name, 'y', y); };
      const r1 = frame.l1 * scale, r2 = frame.l2 * scale;
      attr('circle1', 'r', r1);
      attr('circle2', 'cx', ax); attr('circle2', 'cy', ay); attr('circle2', 'r', r2);
      attr('projection', 'd', `M${bx} ${oy}V${by}H${ox}`);
      attr('extension', 'd', `M${ax} ${ay}l${28 * Math.cos(t)} ${-28 * Math.sin(t)}`);
      function arc(cx, cy, start, angle, radius) {
        const span = angle % 360;
        return Array.from({ length: 41 }, (_, i) => {
          const a = (start + span * i / 40) * Math.PI / 180;
          return `${i ? 'L' : 'M'}${cx + radius * Math.cos(a)} ${cy - radius * Math.sin(a)}`;
        }).join(' ');
      }
      attr('arc1', 'd', arc(ox, oy, 0, frame.q1, 22));
      attr('arc2', 'd', arc(ax, ay, frame.q1, frame.q2, 17));
      const text = (name, value, x, y) => { const el = get(name); if (el) el.textContent = value; point(name, x, y); };
      text('label1', 'L₁', (ox + ax) / 2 - 12, (oy + ay) / 2 - 9);
      text('label2', 'L₂', (ax + bx) / 2 + 7, (ay + by) / 2 - 7);
      const angle1 = (frame.q1 % 360) * Math.PI / 360;
      const angle2 = (frame.q1 + (frame.q2 % 360) / 2) * Math.PI / 180;
      text('angle1', 'q₁', ox + 27 * Math.cos(angle1), oy - 27 * Math.sin(angle1) - 3);
      text('angle2', 'q₂', ax + 21 * Math.cos(angle2), ay - 21 * Math.sin(angle2) - 3);
      const left = Math.min(0, ox - r1 - 14, ax - r2 - 14, bx - 14);
      const right = Math.max(320, ox + r1 + 14, ax + r2 + 14, bx + 30);
      const top = Math.min(0, oy - r1 - 14, ay - r2 - 14, by - 14);
      const bottom = Math.max(215, oy + r1 + 14, ay + r2 + 14, by + 14);
      const height = Math.max(bottom - top, (right - left) * 215 / 320), width = height * 320 / 215;
      const vx = (left + right - width) / 2, vy = (top + bottom - height) / 2;
      lab.querySelector('.week10-fk-scene')?.setAttribute('viewBox', `${vx} ${vy} ${width} ${height}`);
      attr('axes', 'd', `M${vx + 10} ${oy}H${vx + width - 15} M${ox} ${vy + height - 10}V${vy + 12}`);
      point('axis-x', vx + width - 13, oy + 14); point('axis-y', ox + 8, vy + 18);
      get('value').textContent = `q = (${fmt(frame.q1)}°, ${fmt(frame.q2)}°)  ·  x = ${fmt(frame.x)} m, y = ${fmt(frame.y)} m`;
    }
    function clear(message) { stop(); frames = []; index = 0; status(message); paint(); }
    function advance() {
      if (index >= frames.length - 1) { stop(); status('출력한 좌표 표시 완료', 'success'); paint(); return; }
      index++; paint();
      if (index === frames.length - 1) { stop(); status('출력한 좌표 표시 완료', 'success'); paint(); }
    }
    function play() {
      if (!frames.length) return;
      if (index >= frames.length - 1) index = 0;
      stop();
      if (frames.length > 1) { timer = setInterval(advance, 120); status('C 출력 순서대로 재생 중', 'running'); }
      else status('출력한 좌표 표시 완료', 'success');
      paint();
    }
    get('play').addEventListener('click', () => { if (timer) { stop(); status('일시 정지'); paint(); } else play(); });
    get('first-frame').addEventListener('click', () => { stop(); index = 0; status('첫 번째 출력 표시'); paint(); });
    source.addEventListener('c-runner:start', () => clear('C 코드 실행 중: 출력 결과 수신 대기'));
    source.addEventListener('c-runner:complete', event => {
      const d = event.detail;
      if (d.source !== editor.value || d.input !== input.value) { clear('코드 또는 입력 변경됨: 다시 실행 필요'); return; }
      if (!d.success) { clear('C 코드 실행 실패: 출력 확인'); lab.dataset.state = 'error'; return; }
      try { frames = parseFrames(d.stdout); index = 0; play(); }
      catch (error) { clear(`출력 확인: ${error.message}`); lab.dataset.state = 'error'; }
    });
    editor.addEventListener('input', () => clear('코드 수정됨: 다시 실행 필요'));
    input.addEventListener('input', () => clear('입력 변경됨: 다시 실행 필요'));
    lab.addEventListener('keydown', event => { if (event.target.closest('button')) event.stopPropagation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { stop(); status('화면 전환으로 일시 정지'); paint(); } });
    if (globalThis.Reveal?.on) Reveal.on('slidechanged', event => { if (!event.currentSlide.contains(lab) && timer) { stop(); status('슬라이드 전환으로 일시 정지'); paint(); } });
    paint();
  });
})();
