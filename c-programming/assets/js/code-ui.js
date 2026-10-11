(function () {
  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      const codeElement = button.closest(".code-container")?.querySelector("code, .explanation-content");
      const numberedLines = codeElement?.querySelectorAll(".hljs-ln-code");
      const containerCode = numberedLines?.length
        ? Array.from(numberedLines, (line) => line.textContent).join("\n")
        : codeElement?.innerText;
      const comparisonCode = [...(button.closest(".code-comparison-table")?.querySelectorAll(".code-comparison-row > code") || [])]
        .map((line) => line.innerText)
        .join("\n");
      const code = containerCode || comparisonCode;
      if (!code || !navigator.clipboard) return;
      await navigator.clipboard.writeText(code);
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = old; }, 1200);
    });
  });

  document.querySelectorAll("[data-demo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = button.closest(".editor-workspace")?.querySelector(".test-result");
      if (result) result.textContent = "[TEST RESULT]";
    });
  });
})();
