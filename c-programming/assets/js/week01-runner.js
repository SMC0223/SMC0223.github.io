(function () {
  const endpoint = "https://godbolt.org/api/compiler/cg142/compile";
  const lines = (items) => Array.isArray(items) ? items.map((item) => item.text ?? "").join("\n") : "";

  document.querySelectorAll("[data-c-runner]").forEach((runner) => {
    const editor = runner.querySelector("[data-code]");
    const input = runner.querySelector("[data-stdin]");
    const output = runner.querySelector("[data-output]");
    const status = runner.querySelector("[data-status]");
    const runButton = runner.querySelector("[data-run]");
    const resetButton = runner.querySelector("[data-reset]");
    const initialCode = editor.value;
    const initialInput = input.value;

    const setStatus = (message, state) => {
      status.textContent = message;
      status.dataset.state = state;
    };

    resetButton.addEventListener("click", () => {
      editor.value = initialCode;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      input.value = initialInput;
      output.textContent = "실행 결과가 여기에 표시됩니다.";
      setStatus("실행 준비", "idle");
    });

    runButton.addEventListener("click", async () => {
      runButton.disabled = true;
      resetButton.disabled = true;
      output.textContent = "컴파일 중…";
      setStatus("Compiler Explorer에 연결 중", "running");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            source: editor.value,
            lang: "c",
            options: {
              userArguments: "-std=c11 -O0 -Wall -Wextra -lm",
              compilerOptions: { skipAsm: true, executorRequest: false },
              filters: { execute: true },
              executeParameters: { args: [], stdin: input.value },
              tools: [],
              libraries: []
            },
            allowStoreCodeDebug: false
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.httpStatus = response.status;
          throw error;
        }
        const result = await response.json();
        if (!result || typeof result.code !== "number") throw new Error("Invalid API response");
        const execution = result.execResult;
        const build = execution?.buildResult;
        const messages = [lines(result.stdout), lines(result.stderr), lines(build?.stdout), lines(build?.stderr)];
        let outcome;
        if (result.timedOut || build?.timedOut || execution?.timedOut) {
          outcome = "실행 시간 초과";
          messages.push("컴파일 또는 실행 제한 시간을 초과했습니다.");
        } else if (result.code !== 0 || (build && build.code !== 0)) {
          outcome = "컴파일 오류";
        } else if (!execution || execution.didExecute !== true || typeof execution.code !== "number") {
          outcome = "실행 실패";
          messages.push("Compiler Explorer에서 실행 결과를 받지 못했습니다.");
        } else if (execution.code !== 0) {
          outcome = "실행 오류";
          messages.push(`프로그램 종료 코드: ${execution.code}`);
        }
        messages.push(lines(execution?.stdout), lines(execution?.stderr));
        const displayText = messages.filter(Boolean).join("\n") || (outcome ? outcome : "프로그램이 출력 없이 종료되었습니다.");
        globalThis.renderCompilerAnsi(output, displayText);
        setStatus(outcome || "실행 완료", outcome ? "error" : "success");
      } catch (error) {
        let reason = "Compiler Explorer에 연결할 수 없습니다. 네트워크 또는 브라우저의 교차 출처 요청(CORS) 제한을 확인하세요.";
        if (error.name === "AbortError") reason = "Compiler Explorer 응답 대기 시간이 30초를 초과했습니다.";
        else if (error.httpStatus === 429) reason = "Compiler Explorer 요청 한도를 초과했습니다. 잠시 후 다시 실행하세요.";
        else if (error.httpStatus) reason = `Compiler Explorer 요청 실패: HTTP ${error.httpStatus}`;
        else if (error.name === "SyntaxError" || error.message === "Invalid API response") reason = "Compiler Explorer에서 올바른 실행 응답을 받지 못했습니다.";
        output.textContent = reason;
        setStatus("실행 실패", "error");
      } finally {
        clearTimeout(timeout);
        runButton.disabled = false;
        resetButton.disabled = false;
      }
    });
  });
})();
