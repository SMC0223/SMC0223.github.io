(function () {
  const inputs = ['11', '10', '01', '00'];
  const lines = items => Array.isArray(items) ? items.map(item => item.text ?? '').join('\n') : '';
  async function compilePolicy(source, { signal, progress = () => {}, request = fetch } = {}) {
    const policy = {};
    for (const key of inputs) {
      progress(key);
      const response = await request('https://godbolt.org/api/compiler/cg142/compile', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ source, lang: 'c', options: {
          userArguments: '-std=c11 -O0 -Wall -Wextra',
          compilerOptions: { skipAsm: true, executorRequest: false }, filters: { execute: true },
          executeParameters: { args: [], stdin: `${key[0]} ${key[1]}\n` }, tools: [], libraries: []
        }, allowStoreCodeDebug: false })
      });
      if (!response.ok) throw new Error(`연결 오류: HTTP ${response.status}`);
      const result = await response.json();
      const execution = result?.execResult, build = execution?.buildResult;
      const diagnostics = [lines(result?.stderr), lines(build?.stderr), lines(execution?.stderr)].filter(Boolean).join('\n');
      if (result?.timedOut || build?.timedOut || execution?.timedOut) throw new Error(`입력 ${key}: 실행 시간 초과\n${diagnostics}`);
      if (result?.code !== 0 || (build && build.code !== 0)) throw new Error(`입력 ${key}: 컴파일 오류\n${diagnostics}`);
      if (!execution?.didExecute || execution.code !== 0) throw new Error(`입력 ${key}: 실행 실패\n${diagnostics}`);
      const output = lines(execution.stdout).trim();
      const match = output.match(/^(\d+)\s+(\d+)$/);
      if (!match || match.slice(1).some(value => Number(value) > 255)) throw new Error(`입력 ${key}: 출력 확인 필요\n왼쪽·오른쪽 바퀴 속도를 0~255 정수 두 개로만 출력. 예: 25 80\n현재 출력: ${output || '(없음)'}`);
      policy[key] = { left: Number(match[1]), right: Number(match[2]) };
    }
    return policy;
  }
  globalThis.LectureLineTracerCompiler = { compilePolicy };
})();
