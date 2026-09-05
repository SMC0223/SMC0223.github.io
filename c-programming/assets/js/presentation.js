(function () {
  const root = document.documentElement;
  const base = root.dataset.assetBase || ".";
  const logoPath = `${base}/logo/HYU_logotype_ERICA_blue_kor_eng.svg`;

  document.querySelectorAll(".brand-logo, .logo-fallback").forEach((element) => {
    const wrapper = element.parentElement;
    element.remove();
    if (wrapper && !wrapper.children.length && !wrapper.textContent.trim()) wrapper.remove();
  });

  document.querySelectorAll(".reveal .slides > section").forEach((slide) => {
    const logo = document.createElement("img");
    logo.className = "page-logo";
    logo.src = logoPath;
    logo.alt = "한양대학교 ERICA 로고";
    slide.appendChild(logo);
  });

  const dateTargets = document.querySelectorAll("[data-live-date]");
  if (dateTargets.length) {
    const formatDate = (value) => new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(value);
    const showDate = (value, source) => dateTargets.forEach((target) => {
      target.textContent = formatDate(value);
      target.dataset.dateSource = source;
    });
    fetch("https://timeapi.io/api/Time/current/zone?timeZone=Asia%2FSeoul")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => showDate(new Date(data.dateTime), "network"))
      .catch(() => showDate(new Date(), "device"));
  }

  if (!window.Reveal) return;
  Reveal.initialize({
    hash: true,
    history: true,
    center: false,
    controls: true,
    controlsTutorial: false,
    progress: true,
    slideNumber: "c/t",
    showSlideNumber: "all",
    transition: "fade",
    transitionSpeed: "fast",
    width: 1920,
    height: 1080,
    margin: 0,
    minScale: 0.2,
    maxScale: 1.5,
    keyboard: {
      70: () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    },
    plugins: window.RevealHighlight ? [RevealHighlight] : []
  });
})();
