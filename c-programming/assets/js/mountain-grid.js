(function () {
  // Validate only the coordinates printed by the student's executed program.
  function inspect(data, output) {
    const path = [];
    const fail = (error, attempt = null) => ({ path, attempt, error, complete: false, moves: Math.max(0, path.length - 1) });
    if (typeof output !== 'string' || !output.trim()) return fail('좌표 출력 없음: 선택한 경로를 행 열 형식으로 출력');
    const lines = output.trim().split(/\r?\n/);
    if (lines.length > 201 || output.length > 20000) return fail('좌표 출력은 201줄 이하로 제한');
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*[+-]?\d+\s+[+-]?\d+\s*$/.test(lines[i])) return fail(`${i + 1}번째 줄: 행 열 정수 두 개만 출력`);
      const point = lines[i].trim().split(/\s+/).map(Number);
      const [r, c] = point;
      if (!point.every(Number.isSafeInteger) || r < 0 || r >= data.height.length || c < 0 || c >= data.height[r].length) return fail(`${i + 1}번째 좌표: 지도 범위 밖`, point);
      if (i === 0) {
        if (r !== data.start[0] || c !== data.start[1]) return fail(`첫 좌표는 출발점 ${data.start.join(' ')} 필요`, point);
      } else {
        const [pr, pc] = path.at(-1);
        if (pr === data.goal[0] && pc === data.goal[1]) return fail('도착점 이후 추가 좌표 출력', point);
        if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) return fail(`${i + 1}번째 좌표: 상하좌우 한 칸씩 이동 필요`, point);
        const current = data.height[pr][pc], next = data.height[r][c], drop = current - next;
        if (next <= 0) return fail(`${i + 1}번째 좌표 [${r}][${c}]: 강 또는 육지 밖으로 이동 불가`, point);
        if (drop < 0) return fail(`${i + 1}번째 좌표 [${r}][${c}]: 오르막 이동 불가 (${current} → ${next})`, point);
        if (drop >= 3) return fail(`${i + 1}번째 좌표 [${r}][${c}]: 높이 차이 ${drop}, 급경사 이동 불가`, point);
      }
      path.push(point);
    }
    const last = path.at(-1);
    if (last[0] !== data.goal[0] || last[1] !== data.goal[1]) return fail(`도착점 미도착: 마지막 좌표 [${last[0]}][${last[1]}]`);
    return { path, attempt: null, error: null, complete: true, moves: path.length - 1 };
  }
  function bestCandidateMoves(data) {
    const lengths = data.paths.map(path => inspect(data, path.map(p => p.join(' ')).join('\n'))).filter(result => result.complete).map(result => result.moves);
    return lengths.length ? Math.min(...lengths) : null;
  }
  globalThis.LectureMountain = { inspect, bestCandidateMoves };
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-mountain-grid]').forEach(lab => {
    const data = JSON.parse(lab.dataset.config);
    const get = name => lab.querySelector(`[data-mt-${name}]`);
    const source = lab.closest('section').querySelector('[data-mountain-source]');
    if (!source) return;
    const editor = source.querySelector('[data-code]');
    const output = source.querySelector('[data-output]');
    const runnerStatus = source.querySelector('[data-status]');
    const minimum = bestCandidateMoves(data);
    let result = null, index = 0, timer = null, settled = false;
    const center = ([r, c]) => [110 + (c + .5) * 72, 90 + (r + .5) * 72];
    function currentOutput() {
      return runnerStatus.dataset.state === 'success' && output.dataset.executedSource === editor.value && output.dataset.executedInput === source.querySelector('[data-stdin]').value;
    }
    function stop() { clearInterval(timer); timer = null; }
    function status(text, state = 'idle') { get('status').textContent = text; lab.dataset.state = state; }
    function paint() {
      const position = result?.path[index] || data.start;
      const [x, y] = center(position);
      const previous = result?.path[index - 1];
      let angle = 180;
      if (previous) angle = Math.atan2(position[1] - previous[1], previous[0] - position[0]) * 180 / Math.PI;
      get('robot').setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
      get('robot').dataset.row = String(position[0]); get('robot').dataset.col = String(position[1]);
      const points = result ? result.path.slice(0, index + 1).map(p => center(p).join(',')).join(' ') : '';
      get('trail').setAttribute('points', points); get('trail-outline').setAttribute('points', points);
      get('position').textContent = `현재 [${position[0]}][${position[1]}] · 높이 ${data.height[position[0]][position[1]]} · 이동 ${result?.path.length ? index : 0}회`;
      get('apply').disabled = !currentOutput();
      get('play').disabled = !result?.path.length;
      get('play').textContent = timer ? '일시 정지' : settled ? '다시 재생' : '재생';
      get('play').setAttribute('aria-pressed', String(Boolean(timer)));
      get('step').disabled = !result?.path.length || settled;
      get('rewind').disabled = !result;
    }
    function clear(message = '코드 수정됨: 다시 실행 필요') {
      stop(); result = null; index = 0; settled = false;
      get('blocked').setAttribute('visibility', 'hidden');
      status(message); paint();
    }
    function rewind() {
      stop(); index = 0; settled = false;
      get('blocked').setAttribute('visibility', 'hidden');
      status('시작 위치: 재생 또는 한 칸 이동 선택'); paint();
    }
    function finish() {
      stop(); settled = true;
      if (result.error) {
        const point = result.attempt;
        if (point && point.every(Number.isSafeInteger) && point[0] >= 0 && point[0] < 10 && point[1] >= 0 && point[1] < 10) {
          get('blocked').setAttribute('x', 110 + point[1] * 72 + 3);
          get('blocked').setAttribute('y', 90 + point[0] * 72 + 3);
          get('blocked').setAttribute('visibility', 'visible');
        }
        status(`이동 중단 · ${result.error}`, 'error');
      } else if (minimum !== null && result.moves > minimum) {
        status(`도착 · ${result.moves}회 이동 · 더 짧은 후보 경로 존재`, 'warning');
      } else {
        status(`도착 성공 · ${result.moves}회 이동 · 최단 후보 길이 충족`, 'success');
      }
      paint();
    }
    function advance() {
      if (!result || settled) return;
      if (index + 1 < result.path.length) {
        index++; paint();
        status(`이동 중 · ${index}/${result.moves}회`, 'running');
        if (result.complete && index === result.path.length - 1) finish();
      } else finish();
    }
    function play() {
      if (!result?.path.length) return;
      if (settled) rewind();
      stop(); timer = setInterval(advance, Number(get('speed').value));
      status('C 코드의 출력 좌표를 순서대로 재생 중', 'running'); paint();
    }
    function apply() {
      if (!currentOutput()) return clear('현재 코드의 실행 완료 후 결과 적용 가능');
      stop(); result = inspect(data, output.dataset.stdout || ''); index = 0; settled = false;
      get('blocked').setAttribute('visibility', 'hidden'); paint();
      if (result.path.length <= 1) finish(); else play();
    }
    get('apply').addEventListener('click', apply);
    get('play').addEventListener('click', () => {
      if (timer) { stop(); status('일시 정지: 한 칸 이동 또는 재생 선택'); paint(); } else play();
    });
    get('step').addEventListener('click', () => { stop(); advance(); paint(); });
    get('rewind').addEventListener('click', rewind);
    get('speed').addEventListener('change', () => { if (timer) play(); });
    source.addEventListener('c-runner:start', () => clear('C 코드 실행 중: 결과 수신 대기'));
    source.addEventListener('c-runner:complete', event => {
      if (event.detail.source !== editor.value || event.detail.input !== source.querySelector('[data-stdin]').value) return clear('코드 또는 입력 변경됨: 다시 실행 필요');
      if (event.detail.success) apply(); else clear('C 코드 실행 실패: 컴파일러 출력 확인');
    });
    editor.addEventListener('input', () => clear());
    source.querySelector('[data-stdin]').addEventListener('input', () => clear('입력 변경됨: 다시 실행 필요'));
    lab.addEventListener('keydown', event => { if (event.target.closest('button, select, input')) event.stopPropagation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { stop(); status('화면 전환으로 일시 정지'); paint(); } });
    if (globalThis.Reveal?.on) Reveal.on('slidechanged', event => {
      if (!event.currentSlide.contains(lab) && timer) { stop(); status('슬라이드 전환으로 일시 정지'); paint(); }
    });
    paint();
  });
})();
