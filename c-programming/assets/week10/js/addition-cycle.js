(function () {
  function nextValue(value) {
    const sum = Math.floor(value / 10) + value % 10;
    return (value % 10) * 10 + sum % 10;
  }
  if (typeof module !== 'undefined') module.exports = { nextValue };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-addition-cycle]').forEach(lab => {
    const get = name => lab.querySelector(`[data-${name}]`);
    let start = 26, current = 26, count = 0, done = false, timer = null;
    function stop() { clearInterval(timer); timer = null; get('play').textContent = '자동 실행'; }
    function show(value) {
      const tens = Math.floor(value / 10), ones = value % 10, sum = tens + ones;
      get('tens').textContent = tens; get('ones').textContent = ones;
      get('sum').textContent = `${tens} + ${ones} = ${sum}`;
      get('next-tens').textContent = ones; get('next-ones').textContent = sum % 10;
    }
    function chip(value, returned = false) {
      const el = document.createElement('span'); el.textContent = String(value).padStart(2, '0');
      if (returned) el.className = 'is-return';
      get('history').append(el); get('history').scrollTop = get('history').scrollHeight;
    }
    function reset() {
      stop();
      const raw = get('start').value.trim(), value = Number(raw);
      const valid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= 99;
      get('play').disabled = get('step').disabled = !valid;
      get('start').setAttribute('aria-invalid', String(!valid));
      get('history').replaceChildren(); get('log').textContent = ''; count = 0; done = false;
      get('count').textContent = '반복 0회';
      if (!valid) { get('status').textContent = '0~99 범위의 정수 입력 필요'; return false; }
      start = current = value; show(current); chip(current);
      get('status').textContent = '한 단계 또는 자동 실행으로 숫자 변화 확인'; return true;
    }
    function step() {
      if (done || get('step').disabled) return;
      const before = current; show(before); current = nextValue(before); count++;
      done = current === start; chip(current, done);
      get('count').textContent = `반복 ${count}회`;
      get('log').textContent += `${count}: ${String(before).padStart(2, '0')} → ${String(current).padStart(2, '0')}\n`;
      get('log').scrollTop = get('log').scrollHeight;
      get('status').textContent = done ? `시작 숫자 ${start}로 복귀 → break / 사이클 길이 ${count}` : `${count}번째 변환 완료 / 다음 단계에서 ${current} 사용`;
      if (done) { stop(); get('step').disabled = get('play').disabled = true; }
    }
    get('step').addEventListener('click', step);
    get('play').addEventListener('click', () => { if (timer) { stop(); return; } step(); if (!done) { get('play').textContent = '일시정지'; timer = setInterval(step, 200); } });
    get('reset').addEventListener('click', reset);
    get('start').addEventListener('input', reset);
    lab.addEventListener('keydown', e => { if (e.target.matches('input,button')) e.stopPropagation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    if (window.Reveal) window.Reveal.on('slidechanged', e => { if (!e.currentSlide.contains(lab)) stop(); });
    reset();
  });
})();
