(function () {
  function parseAnsi(text) {
    const runs = [];
    let style = {}, end = 0;
    const controls = /\x1b\[([0-?]*)([ -/]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
    const add = value => { if (value) runs.push({ text: value, ...style }); };
    for (const match of String(text).matchAll(controls)) {
      add(text.slice(end, match.index));
      if (match[3] === 'm') {
        const codes = (match[1] || '0').split(';').map(Number);
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];
          if (code === 0) style = {};
          else if (code === 1) style.bold = true;
          else if (code === 22) delete style.bold;
          else if (code === 4) style.underline = true;
          else if (code === 24) delete style.underline;
          else if (code === 39) delete style.color;
          else if (code >= 30 && code <= 37) style.color = code - 30;
          else if (code >= 90 && code <= 97) style.color = code - 90;
          else if (code === 38 || code === 48) {
            if (codes[i + 1] === 5) i += 2;
            else if (codes[i + 1] === 2) i += 4;
          }
        }
      }
      // GCC's erase-to-end-of-line (K) has no effect in a static diagnostics view.
      end = match.index + match[0].length;
    }
    add(text.slice(end));
    return runs;
  }
  globalThis.parseCompilerAnsi = parseAnsi;
  globalThis.renderCompilerAnsi = (target, text) => {
    const fragment = document.createDocumentFragment();
    for (const run of parseAnsi(text)) {
      const span = document.createElement('span');
      if (run.bold) span.classList.add('ansi-bold');
      if (run.underline) span.classList.add('ansi-underline');
      if (run.color !== undefined) span.classList.add(`ansi-color-${run.color}`);
      span.textContent = run.text;
      fragment.append(span);
    }
    target.replaceChildren(fragment);
  };
})();
