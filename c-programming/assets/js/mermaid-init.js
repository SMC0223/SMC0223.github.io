(function () {
  const containers = () => document.querySelectorAll(".mermaid");
  if (!window.mermaid) {
    containers().forEach((container) => {
      container.classList.add("mermaid-error");
      container.textContent = "다이어그램 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.";
    });
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      primaryColor: "#eaf2f8",
      primaryBorderColor: "#0e4a84",
      primaryTextColor: "#18202a",
      lineColor: "#56616d",
      secondaryColor: "#ffffff",
      tertiaryColor: "#f5f7f9",
      fontFamily: "Yoon Gothic, Noto Sans KR, sans-serif"
    }
  });

  const renderDiagrams = async () => {
    try {
      await mermaid.run({ querySelector: ".mermaid" });
      if (window.Reveal?.layout) Reveal.layout();
    } catch (error) {
      console.error("Mermaid rendering failed:", error);
      containers().forEach((container) => {
        if (container.querySelector("svg")) return;
        container.classList.add("mermaid-error");
        container.textContent = "Mermaid 다이어그램을 그리지 못했습니다. 브라우저 콘솔에서 구문 오류를 확인하세요.";
      });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderDiagrams, { once: true });
  else renderDiagrams();
})();
