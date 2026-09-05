(function () {
  document.querySelectorAll("[data-c-runner]").forEach((runner) => {
    const editor = runner.querySelector("[data-code]");
    const input = runner.querySelector("[data-stdin]");
    const output = runner.querySelector("[data-output]");
    const status = runner.querySelector("[data-status]");
    const runButton = runner.querySelector("[data-run]");
    const initialCode = editor.value;
    const initialInput = input.value;

    const setStatus = (message, state) => {
      status.textContent = message;
      status.dataset.state = state;
    };

    runner.querySelector("[data-reset]").addEventListener("click", () => {
      editor.value = initialCode;
      input.value = initialInput;
      output.textContent = "실행 결과가 여기에 표시됩니다.";
      setStatus("실행 준비", "idle");
    });

    runButton.addEventListener("click", async () => {
      runButton.disabled = true;
      output.textContent = "컴파일 중…";
      setStatus("온라인 컴파일러에 연결 중", "running");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch("https://wandbox.org/api/compile.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            compiler: "gcc-head-c",
            code: editor.value,
            stdin: input.value,
            options: "warning,gnu11",
            save: false
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        const compilerMessage = result.compiler_error || result.compiler_message || "";
        const programMessage = result.program_output || result.program_message || "";
        const message = [compilerMessage, programMessage].filter(Boolean).join("\n");
        output.textContent = message || "프로그램이 출력 없이 종료되었습니다.";
        const failed = Boolean(result.compiler_error || result.program_error || result.signal);
        setStatus(failed ? "오류를 확인하세요" : "실행 완료", failed ? "error" : "success");
      } catch (error) {
        const reason = error.name === "AbortError" ? "요청 시간이 초과되었습니다." : "컴파일 서비스에 연결할 수 없습니다.";
        output.textContent = `${reason}\n인터넷 연결을 확인하고 다시 실행하세요.`;
        setStatus("실행 실패", "error");
      } finally {
        clearTimeout(timeout);
        runButton.disabled = false;
      }
    });
  });
})();
