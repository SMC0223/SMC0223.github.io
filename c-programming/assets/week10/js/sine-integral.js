(function () {
  function parse(text) {
    const rows = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
    if (rows.length < 2 || rows.length > 2001 || rows.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw Error('출력 형식: x 누적값, 한 줄에 두 실수');
    if (rows[0][0] !== 0 || rows.some((p, i) => p[0] < 0 || p[0] > 2 * Math.PI + .00001 || (i && p[0] <= rows[i - 1][0]))) throw Error('x 범위: 0부터 2π까지 증가');
    return rows;
  }
  globalThis.LectureSineIntegral = { parse };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-sine-integral]').forEach(lab => {
    const get = name => lab.querySelector(`[data-si-${name}]`);
    const path = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${(55 + x / (2 * Math.PI) * 550).toFixed(2)} ${(235 - y * 90).toFixed(2)}`).join(' ');
    const points = fn => Array.from({length: 241}, (_, i) => { const x = 2 * Math.PI * i / 240; return [x, fn(x)]; });
    get('sin').setAttribute('d', path(points(Math.sin)));
    get('cos').setAttribute('d', path(points(Math.cos)));
    get('exact').setAttribute('d', path(points(x => 1 - Math.cos(x))));
    get('apply').addEventListener('click', () => {
      try {
        const source = document.querySelector('[data-sine-integral-source]');
        if (source?.querySelector('[data-status]').dataset.state !== 'success') throw Error('C 코드 실행 완료 필요');
        const rows = parse(source.querySelector('[data-output]').dataset.stdout);
        get('numeric').setAttribute('d', path(rows));
        const error = Math.max(...rows.map(([x, y]) => Math.abs(y - (1 - Math.cos(x)))));
        get('status').textContent = `비교점 ${rows.length}개 · 최대 오차 ${error.toFixed(6)}`;
      } catch (error) { get('numeric').setAttribute('d', ''); get('status').textContent = error.message; }
    });
  });
})();
