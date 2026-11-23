(function () {
  const validDimension = value => Number.isInteger(value) && value >= 1 && value <= 28;

  function parseResult(text) {
    const tokens = String(text).trim().split(/\s+/);
    if (tokens.length < 3 || tokens.length > 786 || tokens.some(token => !/^\d+$/.test(token))) throw Error('영상 결과 확인 필요: 정수 밝기 값 사용');
    const values = tokens.map(Number);
    const [height, width] = values;
    if (!validDimension(height) || !validDimension(width)) throw Error('영상 결과 확인 필요: 행·열 크기는 1~28');
    if (values.length !== 2 + height * width) throw Error('영상 결과 확인 필요: 행·열 크기와 픽셀 개수 불일치');
    const pixels = values.slice(2);
    if (pixels.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw Error('영상 결과 확인 필요: 밝기 범위는 0~255');
    return { height, width, pixels };
  }

  function validateImage(data) {
    if (!data || data.width !== 28 || data.height !== 28 || !Array.isArray(data.pixels) || data.pixels.length !== 784 || data.pixels.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw Error('원본 이미지 읽기 실패');
    return { width: data.width, height: data.height, pixels: data.pixels, credit: String(data.credit || 'MNIST'), sourceUrl: String(data.sourceUrl || '') };
  }

  function paint(canvas, frame) {
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(frame.width, frame.height);
    frame.pixels.forEach((value, index) => {
      image.data[index * 4] = value;
      image.data[index * 4 + 1] = value;
      image.data[index * 4 + 2] = value;
      image.data[index * 4 + 3] = 255;
    });
    context.putImageData(image, 0, 0);
  }

  async function initialize(lab) {
    const runner = lab.querySelector('[data-c-runner]');
    const editor = runner.querySelector('[data-code]');
    const input = runner.querySelector('[data-stdin]');
    const run = runner.querySelector('[data-run]');
    const reset = runner.querySelector('[data-reset]');
    const get = name => lab.querySelector(`[data-${name}]`);
    let frame, revision = 0, startedRevision = -1;

    function showExercise() {
      const marker = editor.value.indexOf('// TODO 1:');
      if (marker < 0 || typeof getComputedStyle !== 'function' || !editor.getClientRects().length) return;
      const line = editor.value.slice(0, marker).split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
      if (!Number.isFinite(lineHeight)) return;
      editor.scrollTop = Math.max(0, (line - 7) * lineHeight);
      editor.scrollLeft = 0;
      editor.dispatchEvent(new Event('scroll'));
    }

    globalThis.Reveal?.on('slidechanged', showExercise);

    function imageStatus(message, error = false) {
      get('image-status').textContent = message;
      get('image-status').hidden = !error;
    }

    function clearResult(message) {
      get('result').hidden = true;
      get('result-placeholder').hidden = false;
      get('result-placeholder').textContent = message;
      get('result-size').textContent = '—';
      get('result-frame').dataset.state = 'empty';
    }

    editor.addEventListener('input', () => {
      revision++;
      clearResult('수정한 코드 실행 후 표시');
      imageStatus(frame ? '코드 수정됨 · 실행하여 결과 확인' : '원본 이미지 준비 중');
    });
    reset.addEventListener('click', () => {
      revision++;
      input.value = '';
      clearResult('초기화됨 · 코드 실행 후 표시');
      imageStatus(frame ? '초기 코드로 복원됨 · 실행 준비' : '원본 이미지 준비 중');
      run.disabled = !frame;
      showExercise();
    });
    runner.addEventListener('c-runner:start', () => {
      startedRevision = revision;
      clearResult('C 코드 계산 중');
      imageStatus('C 코드 실행 중 · 평균 계산 결과 대기');
    });
    runner.addEventListener('c-runner:complete', event => {
      const result = event.detail;
      if (startedRevision !== revision || result.source !== editor.value || result.input !== input.value) {
        clearResult('수정한 코드 실행 후 표시');
        imageStatus('실행 중 코드 변경됨 · 다시 실행 필요');
        return;
      }
      if (!result.success) {
        clearResult('실행 실패 · 코드 확인 후 다시 실행');
        imageStatus('실행 실패 · 컴파일러 출력 확인', true);
        return;
      }
      try {
        const image = parseResult(result.stdout);
        paint(get('result'), image);
        get('result').hidden = false;
        get('result-placeholder').hidden = true;
        get('result-frame').dataset.state = 'success';
        get('result-size').textContent = `${image.width} × ${image.height}`;
        imageStatus('현재 C 코드의 실행 결과 적용됨');
      } catch (error) {
        clearResult('출력 확인 후 다시 실행');
        imageStatus(error.message, true);
      }
    });

    try {
      const response = await fetch(lab.dataset.imageUrl);
      if (!response.ok) throw Error('원본 이미지 읽기 실패');
      frame = validateImage(await response.json());
      input.value = '';
      paint(get('original'), frame);
      get('original-size').textContent = `${frame.width} × ${frame.height}`;
      const credit = get('image-credit');
      if (/^https:\/\//i.test(frame.sourceUrl)) {
        const link = document.createElement('a');
        link.href = frame.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = frame.credit;
        credit.replaceChildren('자료: ', link);
      } else credit.textContent = `자료: ${frame.credit}`;
      imageStatus('실행하여 원본과 평균 필터 결과 비교');
      runner.querySelector('[data-status]').textContent = '실행 준비';
      run.disabled = false;
      showExercise();
    } catch (error) {
      run.disabled = true;
      imageStatus(`${error.message} · 페이지를 다시 열어 확인`, true);
      runner.querySelector('[data-status]').textContent = '이미지 준비 실패';
    }
  }

  globalThis.LectureConvolution = { parseResult, validateImage, initialize };
  if (typeof document !== 'undefined') document.querySelectorAll('[data-convolution-lab]').forEach(lab => initialize(lab));
})();
