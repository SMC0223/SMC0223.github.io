(function () {
  const keywords = new Set(('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local bool').split(' '));
  const tokens = /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|^[ \t]*#[ \t]*\w+|\b(?:0[xX][\da-fA-F]+(?:\.[\da-fA-F]*)?(?:[pP][+-]?\d+)?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)(?:[uUlLfF]*)\b|\b[A-Za-z_]\w*\b/gm;
  document.querySelectorAll('[data-c-runner] [data-code]').forEach((editor) => {
    const shell = document.createElement('div');
    shell.className = 'c-editor-shell';
    const paint = document.createElement('div');
    paint.className = 'c-editor-paint';
    paint.setAttribute('aria-hidden', 'true');
    editor.before(shell);
    shell.append(paint, editor);
    editor.wrap = 'off';
    function syncScroll() {
      paint.scrollTop = editor.scrollTop;
      paint.scrollLeft = editor.scrollLeft;
    }
    function update() {
      const source = editor.value;
      const fragment = document.createDocumentFragment();
      let end = 0;
      for (const match of source.matchAll(tokens)) {
        fragment.append(document.createTextNode(source.slice(end, match.index)));
        const word = match[0];
        let kind = '';
        if (word.startsWith('//') || word.startsWith('/*')) kind = 'comment';
        else if (/^["']/.test(word)) kind = 'string';
        else if (word.trimStart().startsWith('#')) kind = 'directive';
        else if (/^\d/.test(word)) kind = 'number';
        else if (keywords.has(word)) kind = 'keyword';
        else if (/^\s*\(/.test(source.slice(match.index + word.length))) kind = 'function';
        const part = document.createElement('span');
        if (kind) part.className = `c-token-${kind}`;
        part.textContent = word;
        fragment.append(part);
        end = match.index + word.length;
      }
      fragment.append(document.createTextNode(source.slice(end) + '\n'));
      paint.replaceChildren(fragment);
      syncScroll();
    }
    function resize() {
      const style = getComputedStyle(editor);
      for (const name of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'padding', 'tabSize', 'lineHeight']) paint.style[name] = style[name];
      paint.style.width = `${editor.clientWidth}px`;
      paint.style.height = `${editor.clientHeight}px`;
      syncScroll();
    }
    editor.addEventListener('input', update);
    editor.addEventListener('scroll', syncScroll);
    editor.addEventListener('compositionstart', () => shell.classList.add('is-composing'));
    editor.addEventListener('compositionend', () => { shell.classList.remove('is-composing'); update(); });
    editor.addEventListener('keydown', (event) => event.stopPropagation());
    new ResizeObserver(resize).observe(editor);
    update();
    resize();
    shell.classList.add('is-highlighted');
  });
})();
