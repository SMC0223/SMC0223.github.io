import { JOINT_PAGE_SIZE, jointProgram, jointPage, jointMotion } from './jacobian-model.js';

const endpoint = 'https://godbolt.org/api/compiler/cg142/compile';
const lines = items => Array.isArray(items) ? items.map(item => item.text ?? '').join('\n') : '';
const failure = (message, diagnostics = '') => Object.assign(new Error(message), { diagnostics });

async function executePage(source, first, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ source, lang: 'c', options: {
        userArguments: '-std=c11 -O0 -Wall -Wextra -lm',
        compilerOptions: { skipAsm: true, executorRequest: false },
        filters: { execute: true },
        executeParameters: { args: [String(first), String(JOINT_PAGE_SIZE)], stdin: '' },
        tools: [], libraries: []
      }, allowStoreCodeDebug: false }),
      signal: controller.signal
    });
    if (!response.ok) throw failure(response.status === 429 ? '실행 요청 한도 초과: 잠시 후 다시 실행' : `실행 서비스 연결 실패: HTTP ${response.status}`);
    const result = await response.json();
    if (!result || typeof result.code !== 'number') throw failure('올바른 실행 응답 수신 실패');
    const execution = result.execResult, build = execution?.buildResult;
    const diagnostics = [lines(result.stdout), lines(result.stderr), lines(build?.stdout), lines(build?.stderr), lines(execution?.stderr)].filter(Boolean).join('\n');
    if (result.timedOut || build?.timedOut || execution?.timedOut) throw failure('C 실행 제한 시간 초과', diagnostics);
    if (result.code !== 0 || (build && build.code !== 0)) throw failure('컴파일 오류: 함수 선언·본문 확인', diagnostics);
    if (!execution || execution.didExecute !== true || typeof execution.code !== 'number') throw failure('C 실행 결과 수신 실패', diagnostics);
    if (execution.code !== 0) throw failure(`C 실행 오류: 종료 코드 ${execution.code}`, diagnostics);
    return { stdout: lines(execution.stdout), diagnostics };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function compileJacobian(code, { signal, progress = () => {} } = {}) {
  const source = jointProgram(code), frames = [];
  let total = null, stop = '', diagnostics = '';
  do {
    signal?.throwIfAborted();
    // Repeat the boundary frame to detect differing results between executions.
    const first = frames.length ? frames.length - 1 : 0;
    progress(frames.length, total);
    const execution = await executePage(source, first, signal);
    signal?.throwIfAborted();
    const page = jointPage(execution.stdout, first, JOINT_PAGE_SIZE);
    if (total !== null && page.total !== total) throw failure('반복 실행 결과 불일치: 같은 입력으로 다시 실행 필요');
    if (frames.length) {
      if (JSON.stringify(page.frames[0]) !== JSON.stringify(frames.at(-1))) throw failure('반복 실행 결과 불일치: 같은 입력·초기값 확인');
      page.frames.shift();
      if (!page.frames.length || page.frames[0].t <= frames.at(-1).t) throw failure('시간 순서 불일치: 반복문·시간 갱신 확인');
    }
    total = page.total;
    frames.push(...page.frames);
    stop = page.stop;
    if (execution.diagnostics) diagnostics = execution.diagnostics;
  } while (frames.length < total);
  return { frames, stop, diagnostics };
}

const keywords = new Set('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while'.split(' '));
const tokens = /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|^[ \t]*#[ \t]*\w+|\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)(?:[uUlLfF]*)\b|\b[A-Za-z_]\w*\b/gm;

export function mountJacobianLab(lab) {
  const get = name => lab.querySelector(`[data-jl-${name}]`);
  const editor = get('code'), paint = get('paint'), initialCode = editor.value;
  let frames = [], resultSource = null, cursor = 0, generation = 0;
  let controller, animation = 0, previous = null, playTime = 0, running = false, busy = false, stopReason = '';
  const ready = () => !busy && frames.length > 1 && resultSource === editor.value;
  const active = () => !document.hidden && (!globalThis.Reveal?.getCurrentSlide || globalThis.Reveal.getCurrentSlide()?.contains(lab));
  const status = (message, state = 'idle') => { get('status').textContent = message; lab.dataset.state = state; };
  const syncScroll = () => { paint.scrollTop = editor.scrollTop; paint.scrollLeft = editor.scrollLeft; };
  function highlight() {
    const fragment = document.createDocumentFragment(), code = editor.value;
    let end = 0;
    for (const match of code.matchAll(tokens)) {
      fragment.append(document.createTextNode(code.slice(end, match.index)));
      const word = match[0];
      const kind = word.startsWith('//') || word.startsWith('/*') ? 'comment' : /^["']/.test(word) ? 'string' : word.trimStart().startsWith('#') ? 'directive' : /^\d/.test(word) ? 'number' : keywords.has(word) ? 'keyword' : /^\s*\(/.test(code.slice(match.index + word.length)) ? 'function' : '';
      const span = document.createElement('span');
      if (kind) span.className = `jl-token-${kind}`;
      span.textContent = word;
      fragment.append(span);
      end = match.index + word.length;
    }
    fragment.append(document.createTextNode(code.slice(end) + '\n'));
    paint.replaceChildren(fragment);
    syncScroll();
  }
  function controls() {
    get('run').disabled = busy || running;
    get('run').textContent = busy ? '실행 중…' : ready() ? '재생' : '실행·재생';
    get('pause').disabled = !running;
  }
  const point = p => [350 + p[0] * 150, 370 - p[1] * 150];
  const path = points => points.map((p, index) => `${index ? 'L' : 'M'}${point(p).join(' ')}`).join(' ');
  const number = value => Math.abs(value) >= 1000 ? value.toExponential(2) : (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
  function draw() {
    const state = frames[cursor];
    // Geometry follows C's recorded angles. No trajectory is synthesized when C fails.
    const q = state ? state.theta : [Math.PI / 6, Math.PI / 3];
    const { elbow, tip } = jointMotion(q, [0, 0]);
    lab.querySelector('[data-jl-link="1"]').setAttribute('d', path([[0, 0], elbow]));
    lab.querySelector('[data-jl-link="2"]').setAttribute('d', path([elbow, tip]));
    const joint = point(elbow);
    get('joint').setAttribute('cx', joint[0]); get('joint').setAttribute('cy', joint[1]);
    const [tx, ty] = point(tip), angle = -(q[0] + q[1]) * 180 / Math.PI;
    get('gripper').setAttribute('d', 'M18 -13L0 -13L0 13L18 13');
    get('gripper').setAttribute('transform', `translate(${tx} ${ty}) rotate(${angle})`);
    get('trace').setAttribute('d', frames.length ? path(frames.slice(0, cursor + 1).map(frame => jointMotion(frame.theta, [0, 0]).tip)) : '');
    const velocity = get('velocity');
    velocity.style.display = state && Math.hypot(...state.velocity) > 1e-8 ? '' : 'none';
    if (state) {
      // The blue arrow uses x_dot from the student's C program, including errors in its calculation.
      const [vx, vy] = state.velocity;
      const scale = Math.min(130, 240 / Math.max(Math.hypot(vx, vy), 1e-9));
      velocity.setAttribute('d', `M${tx} ${ty}L${tx + vx * scale} ${ty - vy * scale}`);
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) lab.querySelector(`[data-jl-j="${i}${j}"]`).textContent = state ? number(state.J[i][j]) : '—';
    get('time').textContent = state ? state.t.toFixed(2) : '0.00';
    get('vx').textContent = state ? number(state.velocity[0]) : '—';
    get('vy').textContent = state ? number(state.velocity[1]) : '—';
    controls();
  }
  function pause(message) {
    running = false;
    cancelAnimationFrame(animation);
    previous = null;
    if (message) status(message, ready() ? 'ready' : 'idle');
    controls();
  }
  function tick(now) {
    if (!running) return;
    if (!ready() || !active()) return pause('화면 전환으로 일시정지');
    if (previous !== null) playTime += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    while (cursor + 1 < frames.length && frames[cursor + 1].t <= playTime) cursor++;
    draw();
    if (cursor === frames.length - 1) return pause(stopReason || '재생 완료 · 다시 재생 가능');
    animation = requestAnimationFrame(tick);
  }
  function play() {
    if (!ready() || !active()) return;
    if (cursor === frames.length - 1) cursor = 0;
    playTime = frames[cursor].t;
    previous = null;
    running = true;
    status('C 실행 결과 재생 중', 'playing');
    draw();
    animation = requestAnimationFrame(tick);
  }
  function invalidate() {
    generation++;
    controller?.abort();
    busy = false;
    pause();
    frames = []; resultSource = null; cursor = 0; stopReason = '';
    draw();
  }
  get('run').addEventListener('click', async () => {
    if (busy || running) return;
    if (ready()) return play();
    invalidate();
    busy = true;
    const current = generation, code = editor.value;
    controller = new AbortController();
    controls();
    get('output').textContent = 'C 코드 실행 중…';
    get('diagnostics').open = false;
    try {
      const result = await compileJacobian(code, { signal: controller.signal, progress: (first, total) => status(total ? `C 실행 결과 확인 중 · ${first}/${total}` : 'C 코드 실행 중…', 'running') });
      if (current !== generation || code !== editor.value) return;
      frames = result.frames; resultSource = code; cursor = 0; stopReason = result.stop;
      get('output').textContent = result.diagnostics || '컴파일·실행 완료';
      busy = false;
      status('실행 완료 · 재생 가능', 'ready');
      draw();
      play();
    } catch (error) {
      if (current !== generation) return;
      frames = []; resultSource = null; cursor = 0;
      const message = error.name === 'AbortError' ? '실행 응답 대기 시간 초과: 다시 실행 필요' : error instanceof TypeError ? '실행 서비스 연결 실패: 인터넷 연결 확인' : error.message;
      status(message, 'error');
      get('output').textContent = error.diagnostics || message;
      get('diagnostics').open = true;
      draw();
    } finally {
      if (current === generation) { busy = false; controls(); }
    }
  });
  get('pause').addEventListener('click', () => pause('일시정지 · 재생으로 이어보기'));
  get('reset').addEventListener('click', () => {
    invalidate();
    editor.value = initialCode;
    editor.scrollTop = editor.scrollLeft = 0;
    highlight();
    get('output').textContent = '실행 결과 대기';
    get('diagnostics').open = false;
    status('초기 코드·자세 복원');
  });
  editor.addEventListener('input', () => { invalidate(); highlight(); status('코드 수정됨 · 다시 실행 필요'); get('output').textContent = '수정한 코드 실행 대기'; });
  editor.addEventListener('scroll', syncScroll);
  editor.addEventListener('compositionstart', () => editor.parentElement.classList.add('is-composing'));
  editor.addEventListener('compositionend', () => { editor.parentElement.classList.remove('is-composing'); highlight(); });
  let releaseTab = false;
  editor.setAttribute('aria-description', 'Tab: 공백 4칸 들여쓰기. Esc 다음 Tab: 편집기 밖으로 이동.');
  editor.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === 'Escape') { releaseTab = true; event.preventDefault(); return; }
    const leave = releaseTab; releaseTab = false;
    if (event.key !== 'Tab' || leave || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const top = editor.scrollTop, left = editor.scrollLeft;
    editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.scrollTop = top; editor.scrollLeft = left;
  });
  lab.addEventListener('keydown', event => { if (event.target.closest('button, textarea, summary')) event.stopPropagation(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause('화면 전환으로 일시정지'); });
  globalThis.Reveal?.on?.('slidechanged', event => { if (!event.currentSlide.contains(lab) && running) pause('슬라이드 전환으로 일시정지'); });
  highlight(); draw();
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-jacobian-lab]').forEach(mountJacobianLab);
