export const STARTER_J = `J[0][0] = 0.0;
J[0][1] = 0.0;
J[1][0] = 0.0;
J[1][1] = 0.0;`;

export const EXAMPLE_J = `J[0][0] = -L[0] * sin(theta1) - L[1] * sin(theta1 + theta2);
J[0][1] = -L[1] * sin(theta1 + theta2);
J[1][0] =  L[0] * cos(theta1) + L[1] * cos(theta1 + theta2);
J[1][1] =  L[1] * cos(theta1 + theta2);`;

export function configuration(values = {}) {
  const config = { q1: 0, q2: 90, vx: 0.2, vy: 0.1, duration: 2, ...values };
  for (const key of ['q1', 'q2', 'vx', 'vy', 'duration']) {
    if (values[key] === '') throw Error('빈 입력값 확인');
    config[key] = Number(config[key]);
    if (!Number.isFinite(config[key])) throw Error('숫자 입력값 확인');
  }
  if (Math.abs(config.q1) > 180 || Math.abs(config.q2) > 180) throw Error('각도 범위: −180~180°');
  if (Math.abs(config.vx) > 0.5 || Math.abs(config.vy) > 0.5) throw Error('목표 속도 범위: −0.5~0.5m/s');
  if (config.duration < 0.2 || config.duration > 5) throw Error('계산 시간 범위: 0.2~5초');
  config.dt = 0.02;
  config.steps = Math.round(config.duration / config.dt);
  config.duration = config.steps * config.dt;
  return config;
}

export function forward(q) {
  const elbow = [Math.cos(q[0]), Math.sin(q[0])];
  return { elbow, tip: [elbow[0] + Math.cos(q[0] + q[1]), elbow[1] + Math.sin(q[0] + q[1])] };
}

export function cProgram(jacobianCode, values = {}) {
  const c = configuration(values);
  if (!String(jacobianCode).trim()) throw Error('Jacobian의 네 원소 작성 필요');
  const number = n => Number(n).toPrecision(17);
  return `#include <stdio.h>
#include <math.h>
int main(void) {
    const double L[2] = {1.0, 1.0}, dt = ${number(c.dt)};
    const double vx = ${number(c.vx)}, vy = ${number(c.vy)};
    double theta1 = ${number(c.q1 * Math.PI / 180)}, theta2 = ${number(c.q2 * Math.PI / 180)};
    const int steps = ${c.steps};
    printf("RV1 %d %.9g\\n", steps + 1, dt);
    for (int n = 0; n <= steps; n++) {
        double J[2][2] = {{0.0, 0.0}, {0.0, 0.0}};
${String(jacobianCode).split('\n').map(line => '        ' + line).join('\n')}
        double det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
        if (!isfinite(det)) { puts("STOP nonfinite"); break; }
        if (fabs(det) < 0.0001) { puts("STOP singular"); break; }
        double dtheta1 = (J[1][1] * vx - J[0][1] * vy) / det;
        double dtheta2 = (-J[1][0] * vx + J[0][0] * vy) / det;
        if (!isfinite(dtheta1) || !isfinite(dtheta2)) { puts("STOP nonfinite"); break; }
        if (fabs(dtheta1) > 5.0 || fabs(dtheta2) > 5.0) { puts("STOP rate"); break; }
        printf("S %.9g %.9g %.9g %.9g %.9g %.9g %.9g %.9g %.9g\\n",
               n * dt, theta1, theta2, J[0][0], J[0][1], J[1][0], J[1][1], dtheta1, dtheta2);
        if (n < steps) { theta1 += dtheta1 * dt; theta2 += dtheta2 * dt; }
    }
    puts("END");
    return 0;
}
`;
}

export function trajectory(stdout) {
  const lines = String(stdout).trim().split(/\r?\n/);
  const header = lines.shift()?.split(/\s+/);
  if (header?.length !== 3 || header[0] !== 'RV1') throw Error('C 출력 형식 확인 필요');
  const count = Number(header[1]), dt = Number(header[2]);
  if (!Number.isInteger(count) || count < 2 || count > 251 || dt !== 0.02) throw Error('C 출력의 계산 간격 확인 필요');
  const states = [];
  let stop = '', ended = false;
  for (const line of lines) {
    if (line === 'END') { ended = true; break; }
    if (line.startsWith('STOP ')) { stop = line.slice(5); continue; }
    const fields = line.trim().split(/\s+/), n = fields.slice(1).map(Number);
    if (fields[0] !== 'S' || n.length !== 9 || n.some(v => !Number.isFinite(v))) throw Error('C 계산 결과의 숫자 확인 필요');
    if (states.length >= count || Math.abs(n[0] - states.length * dt) > 1e-6) throw Error('C 계산 결과의 시간 순서 확인 필요');
    states.push({ t: n[0], q: n.slice(1, 3), J: [n.slice(3, 5), n.slice(5, 7)], dq: n.slice(7, 9) });
  }
  const reason = { singular: 'J의 역행렬 계산 불가: 현재 자세와 작성한 원소 확인', rate: '관절속도가 5rad/s를 초과하여 계산 중단', nonfinite: '유한하지 않은 계산값: 작성한 수식 확인' }[stop] || '';
  if (!ended || (!stop && states.length !== count)) throw Error('C 계산 결과가 중간에 끊김');
  if (!states.length) throw Error(reason || '재생할 C 계산 결과 없음');
  if (stop && !reason) throw Error('C 계산 중단 사유 확인 필요');
  return { states, dt, stop: reason };
}
