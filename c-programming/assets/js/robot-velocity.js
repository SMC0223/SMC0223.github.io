import { STARTER_J, EXAMPLE_J, configuration, forward, cProgram, trajectory } from './robot-velocity-model.js';

document.querySelectorAll('[data-robot-velocity]').forEach(lab => {
  const get = selector => lab.querySelector(selector);
  const editor = get('[data-rv-code]'), inputs = [...lab.querySelectorAll('[data-rv-input]')];
  const apply = get('[data-rv-apply]'), example = get('[data-rv-example]');
  const play = get('[data-rv-play]'), step = get('[data-rv-step]'), reset = get('[data-rv-reset]');
  let states = [], index = 0, timer, settings = configuration(), stopReason = '', busy = false;
  const fmt = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(3);
  const point = p => [350 + p[0] * 100, 280 - p[1] * 100];
  const pause = () => { clearInterval(timer); timer = undefined; play.textContent = '재생'; };
  const status = (message, state = 'ready') => { get('[data-rv-status]').textContent = message; lab.dataset.state = state; };
  const read = () => configuration(Object.fromEntries(inputs.map(input => [input.dataset.rvInput, input.value])));
  const initial = () => [settings.q1 * Math.PI / 180, settings.q2 * Math.PI / 180];
  function render() {
    const frame = states[index], pose = forward(frame?.q || initial());
    const start = forward(initial()).tip;
    const target = [start[0] + settings.vx * settings.duration, start[1] + settings.vy * settings.duration];
    const [ex, ey] = point(pose.elbow), [tx, ty] = point(pose.tip), [sx, sy] = point(start), [gx, gy] = point(target);
    get('[data-rv-link="1"]').setAttribute('d', `M350 280L${ex} ${ey}`);
    get('[data-rv-link="2"]').setAttribute('d', `M${ex} ${ey}L${tx} ${ty}`);
    for (const [selector, x, y] of [['[data-rv-elbow]', ex, ey], ['[data-rv-tip]', tx, ty]]) {
      get(selector).setAttribute('cx', x); get(selector).setAttribute('cy', y);
    }
    get('[data-rv-target-path]').setAttribute('d', `M${sx} ${sy}L${gx} ${gy}`);
    get('[data-rv-vector]').setAttribute('d', `M${tx} ${ty}l${settings.vx * 170} ${-settings.vy * 170}`);
    get('[data-rv-vector]').style.display = Math.hypot(settings.vx, settings.vy) ? '' : 'none';
    get('[data-rv-trail]').setAttribute('d', states.slice(0, index + 1).map((f, i) => `${i ? 'L' : 'M'}${point(forward(f.q).tip).join(' ')}`).join(' '));
    const label = get('[data-rv-position]');
    label.setAttribute('x', tx + 12); label.setAttribute('y', ty - 15);
    label.textContent = `(${fmt(pose.tip[0])}, ${fmt(pose.tip[1])}) m`;
    const minX = Math.min(120, gx - 40), maxX = Math.max(590, gx + 105);
    const minY = Math.min(35, gy - 40), maxY = Math.max(520, gy + 40);
    get('[data-rv-scene]').setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    const matrix = get('[data-rv-j]');
    matrix.replaceChildren();
    if (frame) {
      frame.J.flat().forEach(value => { const cell = document.createElement('span'); cell.textContent = fmt(value); matrix.append(cell); });
      get('[data-rv-rates]').textContent = `θ̇₁ = ${fmt(frame.dq[0])}\nθ̇₂ = ${fmt(frame.dq[1])}`;
    } else { matrix.textContent = '—'; get('[data-rv-rates]').textContent = '—'; }
    get('[data-rv-time]').textContent = `t = ${(frame?.t || 0).toFixed(2)}s`;
    lab.dataset.frame = String(index);
    play.disabled = step.disabled = reset.disabled = busy || states.length < 2;
    apply.disabled = example.disabled = busy;
    inputs.forEach(input => input.disabled = busy);
    editor.disabled = busy;
  }
  function advance() {
    if (index < states.length - 1) { index++; render(); }
    if (index >= states.length - 1) { pause(); status(stopReason || '재생 완료'); }
  }
  function start() {
    if (states.length < 2) return;
    if (index >= states.length - 1) index = 0;
    play.textContent = '일시정지';
    timer = setInterval(advance, settings.dt * 1000);
  }
  async function calculate(autoPlay = false) {
    pause();
    try { settings = read(); } catch (error) { status(error.message, 'error'); return; }
    busy = true; states = []; index = 0; stopReason = ''; render();
    status('C 계산 중…', 'running');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('https://godbolt.org/api/compiler/cg142/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ source: cProgram(editor.value, settings), lang: 'c', allowStoreCodeDebug: false,
          options: { userArguments: '-std=c11 -O0 -Wall -Wextra -lm', compilerOptions: { skipAsm: true, executorRequest: false }, filters: { execute: true }, executeParameters: { args: [], stdin: '' }, tools: [], libraries: [] } })
      });
      if (!response.ok) throw Error(`컴파일 서비스 연결 실패 (${response.status})`);
      const result = await response.json(), lines = list => (list || []).map(line => line.text || '').join('\n');
      const errors = [lines(result.stderr), lines(result.execResult?.stderr)].filter(Boolean).join('\n');
      get('[data-rv-output]').textContent = errors || 'C 계산 완료';
      if (result.code !== 0 || result.execResult?.code !== 0 || !result.execResult?.didExecute) throw Error('C 코드의 컴파일러 출력 확인 필요');
      const calculated = trajectory(lines(result.execResult.stdout));
      states = calculated.states; stopReason = calculated.stop; index = 0;
      status(stopReason ? `계산 완료 · ${stopReason}` : '계산 완료: 재생으로 C 계산 경로 확인');
      if (autoPlay) start();
    } catch (error) {
      states = []; index = 0;
      status(error.name === 'AbortError' ? 'C 계산 시간 초과: 다시 시도' : error.message, 'error');
    } finally { clearTimeout(timeout); busy = false; render(); }
  }
  function changed() {
    pause(); states = []; index = 0;
    try { settings = read(); status('입력 변경: 코드 적용 필요', 'idle'); }
    catch (error) { status(error.message, 'error'); }
    render();
  }
  inputs.forEach(input => input.addEventListener('input', changed));
  editor.addEventListener('input', changed);
  editor.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Tab') { event.preventDefault(); editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end'); editor.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  lab.addEventListener('keydown', event => { if (event.target.matches('input,button')) event.stopPropagation(); });
  apply.addEventListener('click', () => calculate());
  example.addEventListener('click', () => { editor.value = EXAMPLE_J; calculate(true); });
  play.addEventListener('click', () => timer ? pause() : start());
  step.addEventListener('click', () => { pause(); advance(); });
  reset.addEventListener('click', () => { pause(); index = 0; render(); status('처음 자세로 이동'); });
  if (window.Reveal?.on) window.Reveal.on('slidechanged', event => { if (!event.currentSlide.contains(lab)) pause(); });
  editor.value = STARTER_J;
  render();
});
