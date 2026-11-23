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
      primaryColor: "#ffffff",
      primaryBorderColor: "#111111",
      primaryTextColor: "#111111",
      lineColor: "#111111",
      secondaryColor: "#ffffff",
      tertiaryColor: "#ffffff",
      edgeLabelBackground: "#ffffff",
      fontFamily: "Malgun Gothic, Noto Sans KR, sans-serif"
    },
    flowchart: { curve: "stepBefore", diagramPadding: 16 }
  });

  const renderDiagrams = async () => {
    const staging = document.createElement("div");
    staging.className = "reveal";
    staging.setAttribute("aria-hidden", "true");
    staging.style.cssText = "position:absolute;left:-20000px;top:0;width:1920px;height:auto;visibility:hidden;pointer-events:none";
    try {
      await document.fonts?.ready;
      // Reveal hides inactive slides. Measure diagrams in a laid-out container
      // instead of display:none slides, which gives Mermaid zero-length edges.
      const diagrams = Array.from(containers()).map((original) => {
        const holder = document.createElement("div");
        holder.className = "diagram-container";
        const copy = document.createElement("div");
        copy.className = "mermaid";
        copy.textContent = original.textContent;
        holder.appendChild(copy);
        staging.appendChild(holder);
        return { original, copy };
      });
      document.body.appendChild(staging);
      await mermaid.run({ nodes: diagrams.map(({ copy }) => copy) });
      diagrams.forEach(({ original, copy }) => original.replaceChildren(...copy.childNodes));
      // Horizontal layout: transform nodes and edges together so arrow
      // endpoints stay attached, while counter-scaling labels keeps text natural.
      containers().forEach((container) => {
        const svg = container.querySelector("svg");
        if (!svg || svg.dataset.wideFlowchart) return;
        const scale = Number(container.closest(".diagram-container")?.dataset.diagramStretch || 1.8);
        svg.querySelectorAll("g.label, g.edgeLabel").forEach((label) => {
          // Edge labels contain their own label group; adjust only the outer one.
          if (label.parentElement.closest("g.label, g.edgeLabel")) return;
          const box = label.getBBox();
          const center = box.x + box.width / 2;
          const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
          wrapper.setAttribute("transform", `translate(${center},0) scale(${1 / scale},1) translate(${-center},0)`);
          while (label.firstChild) wrapper.appendChild(label.firstChild);
          label.appendChild(wrapper);
        });
        Array.from(svg.children).filter((child) => child.tagName.toLowerCase() === "g").forEach((group) => {
          group.setAttribute("transform", `scale(${scale},1) ${group.getAttribute("transform") || ""}`);
        });
        const box = svg.viewBox.baseVal;
        const width = box.width * scale;
        svg.setAttribute("viewBox", `${box.x * scale} ${box.y} ${width} ${box.height}`);
        svg.style.maxWidth = `${width}px`;
        svg.dataset.wideFlowchart = "true";
      });
      if (window.Reveal?.layout) Reveal.layout();
    } catch (error) {
      console.error("Mermaid rendering failed:", error);
      containers().forEach((container) => {
        if (container.querySelector("svg")) return;
        container.classList.add("mermaid-error");
        container.textContent = "Mermaid 다이어그램을 그리지 못했습니다. 브라우저 콘솔에서 구문 오류를 확인하세요.";
      });
    } finally {
      staging.remove();
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderDiagrams, { once: true });
  else renderDiagrams();
})();
