(function () {
  function parse(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2 || lines.length > 2001) throw Error('출력 형식: Time:시간 Value: 입력 필터출력');
    const rows = lines.map(line => {
      const number = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
      const match = line.trim().match(new RegExp(`^Time:\\s*(${number})\\s+Value:\\s*(${number})\\s+(${number})$`, 'i'));
      if (!match) throw Error('출력 형식: Time:시간 Value: 입력 필터출력');
      return match.slice(1).map(Number);
    });
    if (rows[0][0] !== 0 || rows.some((p, i) => p.some(v => !Number.isFinite(v)) || (i && p[0] <= rows[i - 1][0]))) throw Error('시간: 0부터 증가하는 값 필요');
    return rows;
  }
  globalThis.LectureLowpass = { parse };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-lowpass-filter]').forEach(lab => {
    const get = name => lab.querySelector(`[data-lp-${name}]`);
    function draw(rows) {
      const duration = rows.at(-1)[0] + (rows[1][0] - rows[0][0]);
      const values = rows.flatMap(p => p.slice(1));
      const low = Math.min(-1.5, ...values), high = Math.max(1.5, ...values);
      const path = column => rows.map((p, i) => `${i ? 'L' : 'M'}${(55 + p[0] / duration * 550).toFixed(2)} ${(325 - (p[column] - low) / (high - low) * 275).toFixed(2)}`).join(' ');
      get('input').setAttribute('d', path(1));
      get('output').setAttribute('d', rows[0].length === 3 ? path(2) : '');
      const labels = lab.querySelectorAll('svg text');
      labels[0].textContent = low.toFixed(1); labels[1].textContent = (low + (high - low) * .4).toFixed(1); labels[2].textContent = (low + (high - low) * .8).toFixed(1);
      labels[4].textContent = (duration / 2).toFixed(2); labels[5].textContent = duration.toFixed(2);
    }
    get('apply').addEventListener('click', () => {
      try {
        const source = lab.closest('section').querySelector('[data-lowpass-source]');
        if (source?.querySelector('[data-status]').dataset.state !== 'success') throw Error('C 코드 실행 완료 필요');
        const rows = parse(source.querySelector('[data-output]').dataset.stdout);
        draw(rows);
        const dt = rows[1][0] - rows[0][0];
        get('status').textContent = `${rows.length}개 샘플 · ${(rows.at(-1)[0] + dt).toFixed(3)}초 · 샘플 간격 ${(dt * 1000).toFixed(1)}ms`;
      } catch (error) { get('output').setAttribute('d', ''); get('status').textContent = error.message; }
    });
  });
})();
