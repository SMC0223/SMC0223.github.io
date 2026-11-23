(function () {
function evaluateLogic(A, B) {
  return { AND: Number(Boolean(A && B)), OR: Number(Boolean(A || B)), XOR: A ^ B, NOT_A: Number(!A), NOT_B: Number(!B), AND_NOT: Number(Boolean(A && !B)), OR_NOT: Number(Boolean(A || !B)), NOT_OR_NOT: Number(!A || !B) };
}

function initLogicReview(lab) {
  const inputs = { A: 0, B: 0 };
  function update() {
    const results = evaluateLogic(inputs.A, inputs.B);
    lab.querySelectorAll('[data-logic-input]').forEach(button => {
      const key = button.dataset.logicInput;
      button.textContent = inputs[key];
      button.setAttribute('aria-pressed', String(Boolean(inputs[key])));
      button.setAttribute('aria-label', `입력 ${key}: ${inputs[key]}, 클릭하여 변경`);
    });
    const summary = [];
    lab.querySelectorAll('[data-logic-result]').forEach(output => {
      const key = output.dataset.logicResult;
      const value = results[key];
      output.textContent = value;
      output.classList.toggle('is-true', Boolean(value));
      const expression = { AND: `A && B`, OR: `A || B`, XOR: `A ^ B`, NOT_A: `!A`, NOT_B: `!B`, AND_NOT: `A && !B`, OR_NOT: `A || !B`, NOT_OR_NOT: `!A || !B` }[key];
      summary.push(`${expression} → ${value}`);
    });
    lab.querySelector('[data-logic-summary]').textContent = summary.join('　 /　 ');
  }
  lab.querySelectorAll('[data-logic-input]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.logicInput;
      inputs[key] = 1 - inputs[key];
      update();
    });
  });
  lab.querySelector('[data-logic-reset]').addEventListener('click', () => {
    inputs.A = inputs.B = 0;
    update();
  });
  lab.addEventListener('keydown', event => {
    if (event.target.closest('button') && [' ', 'Enter'].includes(event.key)) event.stopPropagation();
  });
  update();
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-logic-review]').forEach(initLogicReview);
}
})();
