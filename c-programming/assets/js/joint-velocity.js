import { jointConfig, initialJoints, jointMotion, jointEquation, inverseEquation, jointProgram, jointPage, JOINT_PAGE_SIZE, TASK_PAGE_SIZE } from './joint-velocity-model.js';

const labs = [...document.querySelectorAll('[data-joint-velocity]')];
const math = labs.length ? (await import('../katex/katex-render.js')).default : null;

labs.forEach(lab => {
  const get = selector => lab.querySelector(selector);
  const play = get('[data-jv-play]'), editor = get('[data-jv-code]');
  const inverse = lab.dataset.jvMode === 'inverse', equationFor = inverse ? inverseEquation : jointEquation;
  const initialConfig = () => jointConfig(inverse ? {theta1:0,theta2:90} : {});
  const pageSize = inverse ? TASK_PAGE_SIZE : JOINT_PAGE_SIZE;
  let config = initialConfig(), q = initialJoints(config), elapsed = 0, running = false, last = 0, raf = 0, frames = [], index = 0;
  let stopReason = '';
  let lastEquation = '', lastMathUpdate = -Infinity;
  let appliedCode = '', busy = false;
  const point = p => [350 + p[0] * 150, 370 - p[1] * 150];
  const omega = () => frames[index]?.omega || [config.omega1, config.omega2];
  const status = (message, state = running ? 'playing' : 'paused') => { get('[data-jv-status]').textContent = message; lab.dataset.state = state; };
  function pause() { running = false; cancelAnimationFrame(raf); play.textContent = '재생'; }
  function put(name, x, y) { const label = get(`[data-jv-label="${name}"]`); label.setAttribute('x', x); label.setAttribute('y', y); }
  function arc(cx, cy, start, angle, radius) {
    const count = Math.max(20, Math.ceil(Math.abs(angle) * 20));
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = start + angle * i / count;
      return `${i ? 'L' : 'M'}${cx + radius * Math.cos(t)} ${cy - radius * Math.sin(t)}`;
    }).join(' ');
  }
  function render(forceMath = true) {
    const frame = frames[index];
    q = frame ? frame.theta : initialJoints(config);
    const values = jointMotion(q, omega()), [ex, ey] = point(values.elbow), [tx, ty] = point(values.tip);
    get('[data-jv-link="1"]').setAttribute('d', `M350 370L${ex} ${ey}`);
    get('[data-jv-link="2"]').setAttribute('d', `M${ex} ${ey}L${tx} ${ty}`);
    get('[data-jv-joint]').setAttribute('cx', ex); get('[data-jv-joint]').setAttribute('cy', ey);
    get('[data-jv-extension]').setAttribute('d', `M${ex} ${ey}l${60 * Math.cos(q[0])} ${-60 * Math.sin(q[0])}`);
    get('[data-jv-angle="1"]').setAttribute('d', arc(350, 370, 0, q[0], 52));
    get('[data-jv-angle="2"]').setAttribute('d', arc(ex, ey, q[0], q[1], 38));
    let arrows = '';
    [[350, 370, 0, q[0], 52], [ex, ey, q[0], q[1], 38]].forEach(([cx, cy, start, angle, radius]) => {
      if (Math.abs(angle) < 1e-6) return;
      const a = start + angle, sign = Math.sign(angle), x = cx + radius * Math.cos(a), y = cy - radius * Math.sin(a);
      const dx = -Math.sin(a) * sign, dy = -Math.cos(a) * sign;
      arrows += `M${x} ${y}l${-10 * dx + 4 * dy} ${-10 * dy - 4 * dx}l${-8 * dy} ${8 * dx}Z `;
    });
    get('[data-jv-angle-arrows]').setAttribute('d', arrows);
    put('theta1', 350 + 74 * Math.cos(q[0] / 2), 370 - 74 * Math.sin(q[0] / 2));
    put('theta2', ex + 59 * Math.cos(q[0] + q[1] / 2), ey - 59 * Math.sin(q[0] + q[1] / 2));
    [[350, 370, ex, ey, 1], [ex, ey, tx, ty, 2]].forEach(([ax, ay, bx, by, id]) => {
      const nx = (by - ay) / 150, ny = -(bx - ax) / 150, mx = (ax + bx) / 2, my = (ay + by) / 2;
      get(`[data-jv-dimension="${id}"]`).setAttribute('d', `M${ax} ${ay}Q${mx + nx * 65} ${my + ny * 65} ${bx} ${by}`);
      put(`length${id}`, mx + nx * 44 - 10, my + ny * 44);
    });
    const a = q[0] + q[1], ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux;
    const gripper = (f, s) => `${tx + f * ux + s * nx} ${ty + f * uy + s * ny}`;
    get('[data-jv-gripper]').setAttribute('d', `M${gripper(18,-13)}L${gripper(0,-13)}L${gripper(0,13)}L${gripper(18,13)}`);
    const [vx, vy] = (frame || values).velocity, vector = get('[data-jv-velocity]');
    const arrowX = tx + vx * 240, arrowY = ty - vy * 240;
    const showVelocity = Math.hypot(vx, vy) > 1e-9;
    vector.setAttribute('d', `M${tx} ${ty}L${arrowX} ${arrowY}`);
    vector.style.display = showVelocity ? '' : 'none';
    const minX = showVelocity ? Math.min(0, arrowX - 28) : 0;
    const minY = showVelocity ? Math.min(0, arrowY - 28) : 0;
    const maxX = showVelocity ? Math.max(760, arrowX + 28) : 760;
    const maxY = showVelocity ? Math.max(720, arrowY + 28) : 720;
    get('[data-jv-scene]').setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    put('elbow', ex + 15, ey + 25); put('tip', tx + 18, ty - 20);
    const trace = frames.length ? frames.slice(0, index + 1).map(f => jointMotion(f.theta, f.omega).tip) : [values.tip];
    get('[data-jv-trace]').setAttribute('d', trace.map((p, i) => `${i ? 'L' : 'M'}${point(p).join(' ')}`).join(' '));
    const now = performance.now();
    if (forceMath || now - lastMathUpdate >= 100) {
      const latex = equationFor(q, omega(), frame || values), equation = get('[data-jv-equation]');
      if (latex !== lastEquation) {
        math.render(latex, equation, { displayMode: true, throwOnError: true });
        equation.dataset.latex = latex;
        lastEquation = latex;
      }
      lastMathUpdate = now;
    }
    lab.dataset.time = String(frame?.t || 0); lab.dataset.q1 = String(q[0]); lab.dataset.q2 = String(q[1]); lab.dataset.frame = String(index);
  }
  function advance(dt) {
    elapsed = Math.min(frames.at(-1).t, elapsed + dt);
    const previous = index;
    while (index < frames.length - 1 && frames[index + 1].t <= elapsed + 1e-9) index++;
    if (index !== previous) render(false);
    if (index === frames.length - 1) { pause(); status(stopReason || '재생 완료', stopReason ? 'error' : 'paused'); render(); }
  }
  function tick(now) {
    if (!running) return;
    advance(Math.max(0, (now - last) / 1000)); last = now;
    if (running) raf = requestAnimationFrame(tick);
  }
  function restart() { pause(); elapsed = 0; index = 0; render(); }
  function start() {
    if (frames.length < 2) return;
    if (index === frames.length - 1) restart();
    running = true; last = performance.now(); play.textContent = '일시정지'; status('재생 중'); raf = requestAnimationFrame(tick);
  }
  async function applyCode() {
    pause();
    const code = editor.value;
    const withoutComments = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
    const prompt = inverse ? '// 1. 현재 관절각도로 역 Jacobian 행렬 J_inv 작성' : '// 1. 현재 관절각도로 Jacobian 행렬 J 작성';
    const assignment = inverse ? /\bJ_inv\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=(?!=)/ : /\bJ\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=(?!=)/;
    const missingJacobian = code.includes(prompt) && !assignment.test(withoutComments);
    if (missingJacobian || /\/\*\s*(?:관절 [12]의 속도|(?:목표|로봇 끝단) [xy] 속도|J[01][01] 작성)\s*\*\//.test(code)) { editor.setAttribute('aria-invalid', 'true'); status(`${inverse ? '로봇 끝단 속도와 역 Jacobian' : '관절속도와 Jacobian'}의 주석 빈칸 작성 필요`, 'error'); return; }
    busy = true; play.disabled = true; editor.disabled = true; play.textContent = 'C 실행 중…'; status('C 실행 중', 'compiling');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const source = jointProgram(code), collected = [];
      let total = Infinity, pendingStop = '';
      while (collected.length < total) {
        const first = collected.length;
        const response = await fetch('https://godbolt.org/api/compiler/cg142/compile', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ source, lang: 'c', allowStoreCodeDebug: false,
            options: { userArguments: '-std=c11 -O0 -Wall -Wextra -lm', compilerOptions: { skipAsm: true, executorRequest: false }, filters: { execute: true }, executeParameters: { args: [String(first), String(pageSize)], stdin: '' }, tools: [], libraries: [] } })
        });
        if (!response.ok) throw Error(`컴파일 서비스 연결 실패 (${response.status})`);
        const result = await response.json(), lines = list => (list || []).map(line => line.text || '').join('\n');
        const execution = result.execResult, stdout = lines(execution?.stdout);
        if (execution?.truncated || /\[truncated\]/i.test(stdout)) throw Error('온라인 실행 결과가 중간에 잘림: 다시 재생 필요');
        if (result.code !== 0 || (execution?.buildResult && execution.buildResult.code !== 0) || execution?.code !== 0 || !execution?.didExecute) {
          editor.title = [lines(result.stderr), lines(execution?.buildResult?.stderr), lines(execution?.stderr)].filter(Boolean).join('\n');
          throw Error('C 코드 확인 필요: 편집기에 마우스를 올려 컴파일 오류 확인 가능');
        }
        const page = jointPage(stdout, first, pageSize, inverse ? 5 : 1);
        if (total !== Infinity && page.total !== total) throw Error('C 실행 결과가 재생 중 달라짐: 같은 코드로 다시 실행 필요');
        if (collected.length && page.frames[0].t <= collected.at(-1).t) throw Error('C 실행 결과의 시간 순서 확인 필요');
        total = page.total;
        pendingStop = page.stop;
        collected.push(...page.frames);
      }
      frames = collected;
      stopReason = pendingStop;
      appliedCode = code; editor.title = ''; editor.setAttribute('aria-invalid', 'false'); restart();
      if (lab.closest('section')?.classList.contains('present') && !document.hidden) start();
      else status('C 실행 완료: 재생으로 움직임 확인 가능');
    } catch (error) { editor.setAttribute('aria-invalid', 'true'); status(error.name === 'AbortError' ? 'C 실행 시간 초과: 다시 시도' : error.message, 'error'); }
    finally { clearTimeout(timeout); busy = false; play.disabled = false; editor.disabled = false; play.textContent = running ? '일시정지' : '재생'; }
  }
  editor.addEventListener('input', () => { pause(); frames = []; stopReason = ''; config = initialConfig(); appliedCode = ''; editor.title = ''; editor.setAttribute('aria-invalid', 'false'); restart(); status('코드 변경: 재생으로 적용'); });
  play.addEventListener('click', () => {
    if (busy) return;
    if (running) { pause(); render(); status('일시정지'); }
    else if (!frames.length || appliedCode !== editor.value) applyCode();
    else start();
  });
  lab.addEventListener('keydown', event => { if (event.target.matches('textarea,button')) event.stopPropagation(); });
  if (window.Reveal?.on) window.Reveal.on('slidechanged', event => { if (!event.currentSlide.contains(lab)) { pause(); render(); status('일시정지'); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); status('일시정지'); } });
  restart();
});
