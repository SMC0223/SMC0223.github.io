(function () {
  document.querySelectorAll('[data-matrix-product]').forEach(root => {
    const steps = [...root.querySelectorAll('[data-mp-step]')];
    const previous = root.querySelector('[data-mp-prev]');
    const next = root.querySelector('[data-mp-next]');
    const progress = root.querySelector('[data-mp-progress]');
    let current = 0;
    function show(index) {
      current = Math.max(0, Math.min(steps.length - 1, index));
      steps.forEach((step, i) => { step.hidden = i !== current; });
      previous.disabled = current === 0;
      next.disabled = current === steps.length - 1;
      progress.textContent = `${current + 1} / ${steps.length}`;
      progress.setAttribute('aria-label', `${current + 1}단계: ${Math.floor(current / 2) + 1}행과 ${current % 2 + 1}열의 곱`);
      root.dataset.step = String(current + 1);
    }
    previous.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    root.addEventListener('keydown', event => {
      if (!event.target.closest('button')) return;
      if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.stopPropagation();
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        show(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    show(0);
  });
})();
