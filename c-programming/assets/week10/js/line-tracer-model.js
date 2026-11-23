(function () {
  const track = Object.freeze({ x1: 230, x2: 590, cy: 230, radius: 140, width: 26 });
  // Educational parameters, not measurements of the pictured hardware.
  // Length and speed use drawing units and drawing units/second respectively.
  const dynamics = Object.freeze({ wheelBase: 37, motorTimeConstant: 0.12, controlPeriod: 0.05 });
  const defaults = Object.freeze({ '11': Object.freeze({ left: 0, right: 0 }), '10': Object.freeze({ left: 25, right: 80 }), '01': Object.freeze({ left: 80, right: 25 }), '00': Object.freeze({ left: 65, right: 65 }) });
  const actions = Object.freeze({
    FORWARD: { label: '직진', left: 65, right: 65 },
    LEFT: { label: '좌회전', left: 25, right: 80 },
    RIGHT: { label: '우회전', left: 80, right: 25 },
    STOP: { label: '정지', left: 0, right: 0 }
  });
  function initial(preset = 'center') {
    const offset = { center: 0, left: 9, right: -9, lost: 65 }[preset] ?? 0;
    return { x: 330, y: 90 + offset, heading: 0, time: 0, distance: 0,
      actualLeft: 0, actualRight: 0, controlRemaining: 0, heldCommand: null };
  }
  function distanceToLine(x, y) {
    const nearestX = Math.max(track.x1, Math.min(track.x2, x));
    return Math.abs(Math.hypot(x - nearestX, y - track.cy) - track.radius);
  }
  const lapLength = 2 * (track.x2 - track.x1) + 2 * Math.PI * track.radius;
  function trackPosition(x, y) {
    const straight = track.x2 - track.x1;
    if (x >= track.x1 && x <= track.x2) return y < track.cy
      ? x - track.x1 : straight + Math.PI * track.radius + track.x2 - x;
    if (x > track.x2) return straight + (Math.atan2(y - track.cy, x - track.x2) + Math.PI / 2) * track.radius;
    let angle = Math.atan2(y - track.cy, x - track.x1);
    if (angle < 0) angle += 2 * Math.PI;
    return 2 * straight + Math.PI * track.radius + (angle - Math.PI / 2) * track.radius;
  }
  function startLap() {
    const state = initial();
    state.lap = { status: 'running', progress: 0, position: trackPosition(state.x, state.y), elapsed: 0 };
    return state;
  }
  function updateLap(state, h) {
    if (state.lap?.status !== 'running') return;
    const lap = state.lap;
    if (distanceToLine(state.x, state.y) > track.width / 2) {
      lap.status = 'invalid';
      return;
    }
    const position = trackPosition(state.x, state.y);
    let delta = position - lap.position;
    if (delta > lapLength / 2) delta -= lapLength;
    if (delta < -lapLength / 2) delta += lapLength;
    lap.progress += delta;
    lap.position = position;
    lap.elapsed += h;
    const input = sensors(state);
    const atFinish = lap.progress > lapLength - 70 && state.y < 130 && state.x > 285 && state.x < 350;
    if (atFinish && input.key === '11' && state.heldCommand?.action === 'STOP'
        && state.actualLeft === 0 && state.actualRight === 0) {
      lap.status = 'finished';
    } else if (lap.progress > lapLength + 20) {
      lap.status = 'invalid';
      lap.reason = 'missed-stop';
    }
  }

  function isBlack(x, y) {
    if (x >= 315 && x <= 345 && y >= 58 && y <= 122) return 1;
    return Number(distanceToLine(x, y) <= track.width / 2);
  }
  function sensors(state) {
    const c = Math.cos(state.heading), s = Math.sin(state.heading);
    const frontX = state.x + 19 * c, frontY = state.y + 19 * s;
    const left = { x: frontX + 18 * s, y: frontY - 18 * c };
    const right = { x: frontX - 18 * s, y: frontY + 18 * c };
    left.value = isBlack(left.x, left.y);
    right.value = isBlack(right.x, right.y);
    return { left, right, key: `${left.value}${right.value}` };
  }
  function decide(left, right, policy = defaults) {
    let key;
    if (left && right) key = '11';
    else if (left) key = '10';
    else if (right) key = '01';
    else key = '00';
    const speeds = policy[key];
    const valid = speeds && [speeds.left, speeds.right].every(value => Number.isInteger(value) && value >= 0 && value <= 255);
    const l = valid ? speeds.left : 0, r = valid ? speeds.right : 0;
    const action = l === 0 && r === 0 ? 'STOP' : l === r ? 'FORWARD' : l < r ? 'LEFT' : 'RIGHT';
    return { key, action, label: actions[action].label, left: l, right: r };
  }
  function sample(state, policy = defaults) {
    const input = sensors(state);
    return { sensors: input, command: state.heldCommand || decide(input.left.value, input.right.value, policy) };
  }
  function step(state, dt, policy = defaults) {
    if (state.lap && ['finished', 'invalid'].includes(state.lap.status)) return state;
    let next = { ...state, ...(state.lap ? { lap: { ...state.lap } } : {}) };
    let remaining = Math.max(0, Math.min(1, Number(dt) || 0));
    // Small fixed steps keep sensor decisions stable at different display frame rates.
    while (remaining > 1e-9) {
      if (next.controlRemaining <= 1e-9) {
        const input = sensors(next);
        next.heldCommand = decide(input.left.value, input.right.value, policy);
        next.controlRemaining = dynamics.controlPeriod;
      }
      const h = Math.min(0.005, remaining, next.controlRemaining);
      const command = next.heldCommand;
      const decay = Math.exp(-h / dynamics.motorTimeConstant);
      const mean = (current, target) => target + (current - target) * dynamics.motorTimeConstant * (1 - decay) / h;
      const left = mean(next.actualLeft, command.left), right = mean(next.actualRight, command.right);
      next.actualLeft = command.left + (next.actualLeft - command.left) * decay;
      next.actualRight = command.right + (next.actualRight - command.right) * decay;
      if (!command.left && next.actualLeft < 0.01) next.actualLeft = 0;
      if (!command.right && next.actualRight < 0.01) next.actualRight = 0;
      const speed = (left + right) / 2;
      const omega = (left - right) / dynamics.wheelBase;
      const angle = next.heading + omega * h;
      if (Math.abs(omega) > 1e-10) {
        next.x += speed / omega * (Math.sin(angle) - Math.sin(next.heading));
        next.y += speed / omega * (Math.cos(next.heading) - Math.cos(angle));
      } else {
        next.x += speed * h * Math.cos(next.heading);
        next.y += speed * h * Math.sin(next.heading);
      }
      next.heading = angle;
      next.time += h;
      next.distance += speed * h;
      remaining -= h;
      next.controlRemaining -= h;
      updateLap(next, h);
      if (next.lap && ['finished', 'invalid'].includes(next.lap.status)) break;
    }
    return next;
  }
  globalThis.LectureLineTracer = Object.freeze({ track, dynamics, defaults, actions, initial, startLap, lapLength, trackPosition, distanceToLine, isBlack, sensors, decide, sample, step });
})();
