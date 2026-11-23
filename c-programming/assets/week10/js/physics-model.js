(function () {
  const G = 9.8;
  function duration(mode, params) {
    return mode === 'freefall' ? Math.sqrt(2 * params.height / G) : 2 * params.vy / G;
  }
  function evaluate(mode, params, time) {
    const end = duration(mode, params);
    const t = Math.max(0, Math.min(end, time));
    const x = mode === 'freefall' ? 0 : params.vx * t;
    const y = mode === 'freefall' ? params.height - 0.5 * G * t * t : params.vy * t - 0.5 * G * t * t;
    return { t, x, y: Math.max(0, y), speed: G * t, end };
  }
  globalThis.LecturePhysics = Object.freeze({ G, duration, evaluate });
})();
