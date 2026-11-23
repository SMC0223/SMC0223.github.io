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
    let releaseTab = false;
    editor.setAttribute('aria-description', 'Tab: 공백 4칸 들여쓰기. Shift+Tab: 들여쓰기 줄이기. Esc 다음 Tab: 편집기 밖으로 이동.');
    editor.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        releaseTab = true;
        event.preventDefault();
        return;
      }
      const leave = releaseTab;
      releaseTab = false;
      if (event.key !== 'Tab' || leave || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      const source = editor.value;
      const start = editor.selectionStart, end = editor.selectionEnd;
      const direction = editor.selectionDirection;
      const top = editor.scrollTop, left = editor.scrollLeft;
      if (!event.shiftKey && !source.slice(start, end).includes('\n')) {
        editor.setRangeText('    ', start, end, 'end');
      } else {
        const first = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
        const last = end > start && source[end - 1] === '\n' ? end - 1 : end;
        const lineEnd = source.indexOf('\n', last);
        const stop = lineEnd < 0 ? source.length : lineEnd;
        const edits = [];
        let offset = first;
        const replacement = source.slice(first, stop).split('\n').map(line => {
          const count = event.shiftKey ? (line.match(/^(?:\t| {1,4})/)?.[0].length || 0) : 0;
          const inserted = event.shiftKey ? '' : '    ';
          edits.push({ at: offset, count, added: inserted.length });
          offset += line.length + 1;
          return inserted + line.slice(count);
        }).join('\n');
        const mapPosition = position => position + edits.reduce((delta, edit) =>
          edit.at <= position ? delta + edit.added - Math.min(edit.count, position - edit.at) : delta, 0);
        editor.setRangeText(replacement, first, stop, 'preserve');
        editor.setSelectionRange(mapPosition(start), mapPosition(end), direction);
      }
      editor.scrollTop = top;
      editor.scrollLeft = left;
      if (editor.value !== source) editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    new ResizeObserver(resize).observe(editor);
    update();
    resize();
    shell.classList.add('is-highlighted');
  });
})();
