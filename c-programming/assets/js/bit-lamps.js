(function () {
  document.querySelectorAll('[data-bit-lab]').forEach((lab) => {
    const inputs = { A: 0, B: 0 };
    let shift = 1;
    function update() {
      const { A, B } = inputs;
      const values = { A, B, AND: A & B, OR: A | B, XOR: A ^ B, NOT_A: (~A) & 255, LEFT: (A << shift) & 255, RIGHT: A >>> shift };
      lab.querySelectorAll('[data-bit-row]').forEach((row) => {
        const key = row.dataset.bitRow;
        const value = values[key];
        row.querySelector('[data-bit-value]').textContent = value;
        row.querySelectorAll('[data-bit]').forEach((lamp) => {
          const on = Boolean(value & (1 << Number(lamp.dataset.bit)));
          lamp.classList.toggle('is-on', on);
          lamp.textContent = on ? '1' : '0';
          if (lamp.matches('button')) {
            lamp.setAttribute('aria-pressed', String(on));
            lamp.setAttribute('aria-label', `입력 ${key}, ${2 ** Number(lamp.dataset.bit)} 자리, ${on ? '켜짐' : '꺼짐'}`);
          }
        });
      });
      const count = lab.querySelector("[data-shift-count]");
      if (count) {
        count.textContent = shift;
        lab.querySelector('[data-bit-division]').textContent = `${A} >> ${shift} = ${A} ÷ ${2 ** shift}의 정수 몫 = ${values.RIGHT}`;
        lab.querySelectorAll("[data-shift-step]").forEach(button => button.disabled = Number(button.dataset.shiftStep) < 0 ? shift === 0 : shift === 7);
      }
      lab.querySelector("[data-bit-summary]").textContent = [...lab.querySelectorAll("[data-bit-row]")].map(row => row.querySelector("strong").textContent + " " + values[row.dataset.bitRow]).join(", ");
    }
    lab.addEventListener('click', (event) => {
      const lamp = event.target.closest('[data-bit-input]');
      if (lamp && lab.contains(lamp)) {
        inputs[lamp.dataset.bitInput] ^= 1 << Number(lamp.dataset.bit);
        update();
      } else if (event.target.closest('[data-shift-step]')) {
        shift = Math.max(0, Math.min(7, shift + Number(event.target.closest('[data-shift-step]').dataset.shiftStep)));
        update();
      } else if (event.target.closest('[data-bit-reset]')) {
        inputs.A = inputs.B = 0;
        shift = 1;
        update();
      }
    });
    // Keep Enter/Space on a lamp from advancing the presentation.
    lab.addEventListener('keydown', (event) => {
      if (event.target.closest('button') && [' ', 'Enter'].includes(event.key)) event.stopPropagation();
    });
    update();
  });
})();
