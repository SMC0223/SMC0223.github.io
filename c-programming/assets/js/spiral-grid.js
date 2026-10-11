(function () {
  function expected(n) {
    const path = [];
    let top = 0, bottom = n - 1, left = 0, right = n - 1;
    for (; top <= bottom && left <= right;) {
      for (let c = left; c <= right; c++) path.push([top, c]);
      top++;
      for (let r = top; r <= bottom; r++) path.push([r, right]);
      right--;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) path.push([bottom, c]);
        bottom--;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) path.push([r, left]);
        left++;
      }
    }
    return path;
  }
  function inspect(n, output) {
    if (!Number.isInteger(n) || n < 1 || n > 25) throw Error('화면 크기: 1~25의 정수 필요');
    const rows = output.trim() ? output.trim().split(/\r?\n/) : [];
    const path = [];
    const target = expected(n);
    for (let i = 0; i < rows.length; i++) {
      if (!/^\s*-?\d+\s+-?\d+\s*$/.test(rows[i])) return { path, failureIndex: i, error: `${i + 1}번째 줄: 행 열 형식 필요`, complete: false };
      path.push(rows[i].trim().split(/\s+/).map(Number));
      if (!target[i] || path[i][0] !== target[i][0] || path[i][1] !== target[i][1]) {
        return { path, failureIndex: i, error: `${i + 1}번째 방문 오류: (${path[i].join(', ')}) / 예상 ${target[i] ? '(' + target[i].join(', ') + ')' : '이동 종료'}`, complete: false };
      }
    }
    return { path, complete: path.length === n * n, failureIndex: path.length,
      error: path.length === n * n ? null : `경로 부족: ${path.length}/${n * n}칸 출력` };
  }
  function validate(n, output) {
    const result = inspect(n, output);
    if (result.error && result.failureIndex < output.trim().split(/\r?\n/).length && result.path.length) throw Error(result.error);
    if (result.error?.includes('형식')) throw Error(result.error);
    return result;
  }
  globalThis.LectureSpiral = { expected, validate, inspect };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-spiral-grid]').forEach(lab => {
    const get = name => lab.querySelector(`[data-${name}]`);
    const source = document.querySelector('[data-spiral-source]');
    let path = [], index = -1, size = 5, timer = null, result = null, failed = false;
    function stop() { clearInterval(timer); timer = null; }
    function paint() {
      const board = get('board');
      board.replaceChildren();
      board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      const low = Math.floor((size - 1) / 2), high = Math.floor(size / 2);
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'spiral-cell';
        if (r >= low && r <= high && c >= low && c <= high) cell.classList.add('center');
        const visit = path.findIndex(p => p[0] === r && p[1] === c);
        if (visit >= 0 && visit <= index) { cell.textContent = visit + 1; cell.classList.add('visited'); }
        if (path[index]?.[0] === r && path[index]?.[1] === c) cell.classList.add('current');
        if (failed && path[index]?.[0] === r && path[index]?.[1] === c) cell.classList.add('failed');
        cell.title = `(${r}, ${c})`;
        board.append(cell);
      }
      if (path[index]) get('message').textContent = `방문 ${index + 1}/${size * size} · 현재 (${path[index].join(', ')})`;
    }
    function advance() {
      const next = index + 1;
      if (next < path.length) index = next;
      failed = Boolean(result.error && next >= result.failureIndex);
      paint();
      if (failed) { stop(); get('message').textContent = `실패 · ${result.error}`; }
      else if (result.complete && index === path.length - 1) { stop(); get('message').textContent += ' · 중심 도착 · 성공'; }
    }
    get('apply').addEventListener('click', () => {
      stop(); path = []; index = -1; failed = false;
      try {
        const n = Number(get('size').value);
        if (!Number.isInteger(n) || n < 3 || n > 25 || n % 2 !== 1) throw Error('격자 크기: 3~25의 홀수 필요');
        if (source?.querySelector('[data-status]').dataset.state !== 'success') throw Error('C 코드 실행 완료 필요');
        const output = source.querySelector('[data-output]');
        result = inspect(n, output.dataset.stdout);
        path = result.path; size = n;
        paint();
        get('message').textContent = '경로 이동 중';
        timer = setInterval(advance, 250);
      } catch (error) { paint(); get('message').textContent = error.message; }
    });
    get('size').addEventListener('change', () => {
      stop(); const n = Number(get('size').value);
      path = []; index = -1; failed = false;
      if (!Number.isInteger(n) || n < 3 || n > 25 || n % 2 !== 1) {
        get('size').value = size;
        paint(); get('message').textContent = '격자 크기: 3~25의 홀수 필요';
        return;
      }
      size = n;
      paint(); get('message').textContent = '코드의 n 변경 후 다시 실행';
    });
    if (globalThis.Reveal?.on) Reveal.on('slidechanged', () => stop());
    paint();
  });
})();
