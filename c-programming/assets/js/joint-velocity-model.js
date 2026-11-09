export const DEFAULT_JOINT_CONFIG = Object.freeze({ theta1: 30, theta2: 60, omega1: 0, omega2: 0, duration: 5 });
export const JOINT_PAGE_SIZE = 96;
export const TASK_PAGE_SIZE = 64;

export const JOINT_STARTER_CODE = `#include <math.h>
#define PI 3.141592653589793
int main(void) {
    const double dt = 0.02, end_time = 5.0; // 시간 (s)
    // L[0]: 첫 링크 길이, L[1]: 둘째 링크 길이 (m)
    // 두 링크 길이는 각각 1m로 고정. L 값 변경 금지.
    const double L[2] = {1.0, 1.0};
    if (!check_robot_links(L)) return 0; // 제공 함수: 길이 검사
    double theta[2] = {30*PI/180, 60*PI/180}; // rad
    double theta_dot[2] = {
        0.2, 0.1 // 예시 관절속도
    }; // rad/s
    double J[2][2], x_dot[2];
    for (double t = 0.0; t <= end_time; t += dt) {
        // 1. 현재 관절각도로 Jacobian 행렬 J 계산
        J[0][0] = -L[0]*sin(theta[0]) - L[1]*sin(theta[0] + theta[1]);
        J[0][1] = -L[1]*sin(theta[0] + theta[1]);
        J[1][0] = L[0]*cos(theta[0]) + L[1]*cos(theta[0] + theta[1]);
        J[1][1] = L[1]*cos(theta[0] + theta[1]);

        // 2. 끝단 속도 계산: x_dot = J * theta_dot
        for (int i = 0; i < 2; i++) {
            x_dot[i] = 0.0;
            for (int j = 0; j < 2; j++)
                x_dot[i] += J[i][j] * theta_dot[j];
        }
        // 현재 상태로 그림·수식·속도 화살표 갱신
        show_robot(t, theta, J, theta_dot, x_dot);
        // 3. 관절각도 갱신
        for (int i = 0; i < 2; i++)
            theta[i] += theta_dot[i] * dt;
    }
    return 0;
}`;

export const TASK_STARTER_CODE = `#include <math.h>
#define PI 3.141592653589793
int main(void) {
    const double dt = 0.02, end_time = 2.0; // 시간 (s)
    // L[0]: 첫 링크 길이, L[1]: 둘째 링크 길이 (m)
    // 두 링크 길이는 각각 1m로 고정. L 값 변경 금지.
    const double L[2] = {1.0, 1.0};
    if (!check_robot_links(L)) return 0; // 제공 함수: 길이 검사
    double theta[2] = {0.0, 90*PI/180}; // rad
    double x_dot[2] = {
        0.2, 0.1 // 예시 끝단속도
    }; // m/s
    double J_inv[2][2], theta_dot[2];
    for (double t = 0.0; t <= end_time; t += dt) {
        // 역 Jacobian의 공통 분모
        double d = L[0]*L[1]*sin(theta[1]); // 공통 분모
        if (fabs(d) < 0.0001) {
            stop_robot("singular"); break;
        }
        // 1. 현재 관절각도로 역 Jacobian 행렬 J_inv 계산
        J_inv[0][0] = L[1]*cos(theta[0] + theta[1]) / d;
        J_inv[0][1] = L[1]*sin(theta[0] + theta[1]) / d;
        J_inv[1][0] = -(L[0]*cos(theta[0]) + L[1]*cos(theta[0] + theta[1])) / d;
        J_inv[1][1] = -(L[0]*sin(theta[0]) + L[1]*sin(theta[0] + theta[1])) / d;

        // 2. 관절속도 계산: theta_dot = J_inv * x_dot
        for (int i = 0; i < 2; i++) {
            theta_dot[i] = 0.0;
            for (int j = 0; j < 2; j++)
                theta_dot[i] += J_inv[i][j] * x_dot[j];
        }
        if (fabs(theta_dot[0]) > 5 || fabs(theta_dot[1]) > 5) {
            stop_robot("rate"); break;
        }
        // 현재 상태로 그림·수식·속도 화살표 갱신
        show_robot_inverse(t, theta, J_inv, theta_dot, x_dot);
        // 3. 관절각도 갱신
        for (int i = 0; i < 2; i++)
            theta[i] += theta_dot[i] * dt;
    }
    return 0;
}`;

export function jointProgram(code) {
  if (!String(code).trim()) throw Error('C 코드 작성 필요');
  return `#include <stdio.h>
#include <math.h>
#include <stdlib.h>
static int joint_first = 0, joint_limit = 2001, joint_count = 0;
static double joint_last_time = 0.0;
static inline int check_robot_links(const double lengths[2]) {
    if (!isfinite(lengths[0]) || !isfinite(lengths[1]) || lengths[0] != 1.0 || lengths[1] != 1.0) {
        puts("JV2 STOP links");
        return 0;
    }
    return 1;
}
static inline void joint_require_links(const double lengths[2]) {
    if (!check_robot_links(lengths)) exit(0);
}
static inline void joint_record(double t, const double theta[2], const double J[2][2], const double theta_dot[2], const double x_dot[2], const double inverse[2][2]) {
    int frame = joint_count++;
    joint_last_time = t;
    if (frame < joint_first || frame - joint_first >= joint_limit) return;
    printf("JV2 %.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g",
           t, theta[0], theta[1], J[0][0], J[0][1], J[1][0], J[1][1], theta_dot[0], theta_dot[1], x_dot[0], x_dot[1]);
    if (inverse) printf(" %.17g %.17g %.17g %.17g", inverse[0][0], inverse[0][1], inverse[1][0], inverse[1][1]);
    putchar('\\n');
}
static inline void show_robot(double t, const double theta[2], const double J[2][2], const double theta_dot[2], const double x_dot[2]) {
    joint_record(t, theta, J, theta_dot, x_dot, NULL);
}
static inline void show_robot_inverse(double t, const double theta[2], const double inverse[2][2], const double theta_dot[2], const double x_dot[2]) {
    const double unused[2][2] = {{0.0}};
    joint_record(t, theta, unused, theta_dot, x_dot, inverse);
}
static inline void stop_robot(const char *reason) {
    printf("JV2 STOP %s\\n", reason);
}
#define show_robot(...) (joint_require_links(L), show_robot(__VA_ARGS__))
#define show_robot_inverse(...) (joint_require_links(L), show_robot_inverse(__VA_ARGS__))
#define stop_robot(...) (joint_require_links(L), stop_robot(__VA_ARGS__))
#define main joint_student_main
${code}
#undef main
#undef show_robot
#undef show_robot_inverse
#undef stop_robot
int main(int argc, char **argv) {
    if (argc >= 3) { joint_first = atoi(argv[1]); joint_limit = atoi(argv[2]); }
    int result = joint_student_main();
    printf("JV2 END %d %.17g\\n", joint_count, joint_last_time);
    return result;
}
`;
}

export function jointTrajectory(stdout, maxRate = 1) {
  return jointPage(stdout, 0, Infinity, maxRate).frames;
}

export function jointPage(stdout, first = 0, limit = Infinity, maxRate = 1) {
  const lines = String(stdout).trim().split(/\r?\n/);
  if (lines.some(line => line === 'JV2 STOP links')) {
    throw Error('두 링크 길이는 각각 1m로 고정됨. L[0], L[1]을 1.0으로 복원한 뒤 재생.');
  }
  const footer = lines.find(line => /^JV2 END(?:\s|$)/.test(line));
  if (!footer || /\[truncated\]/i.test(stdout)) throw Error('온라인 실행 결과가 중간에 잘림: 다시 재생 필요');
  const metadata = footer.trim().split(/\s+/).slice(2);
  const total = metadata.length ? Number(metadata[0]) : null;
  const stopCode = lines.find(line => line.startsWith('JV2 STOP '))?.split(' ')[2];
  const stop = {singular:'J의 역행렬 계산 불가: 현재 자세와 작성한 원소 확인',rate:'관절속도가 5rad/s를 초과하여 계산 중단'}[stopCode] || '';
  if (total !== null && (!Number.isInteger(total) || total < 2 || total > 2001)) throw Error(stop || 'for 반복문과 show_robot 호출 횟수 확인 필요');
  if (metadata.length > 1 && (!Number.isFinite(Number(metadata[1])) || Number(metadata[1]) < 0 || Number(metadata[1]) > 10.000001)) throw Error('시뮬레이션 시간 범위: 0~10초');
  const frames = [];
  for (const line of lines) {
    if (line === footer) break;
    if (line.startsWith('JV2 STOP ')) continue;
    if (!line.startsWith('JV2 ')) continue;
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    if (values.length !== 11 && values.length !== 15) throw Error('C 상태 데이터가 불완전함: 다시 재생 필요');
    if (values.some(v => !Number.isFinite(v))) throw Error('C 계산값은 유한한 숫자여야 함');
    const [t, theta1, theta2, j00, j01, j10, j11, w1, w2, vx, vy] = values;
    if (frames.length >= 2001 || t < 0 || t > 10.000001 || (frames.length ? t <= frames.at(-1).t : first === 0 && Math.abs(t) > 1e-8)) throw Error('시뮬레이션 시간 범위: 0~10초, 시간은 순서대로 증가');
    if (Math.abs(w1) > maxRate || Math.abs(w2) > maxRate) throw Error(`관절속도 범위: −${maxRate}~${maxRate}rad/s`);
    if (Math.abs(theta1) > Math.max(20,maxRate*10+4) || Math.abs(theta2) > Math.max(20,maxRate*10+4)) throw Error('관절각도 갱신식과 라디안 단위 확인 필요');
    frames.push({ t, theta: [theta1, theta2], J: [[j00, j01], [j10, j11]], omega: [w1, w2], velocity: [vx, vy], ...(values.length === 15 ? {inverse:[values.slice(11,13),values.slice(13,15)]} : {}) });
  }
  if (!frames.length || (first === 0 && frames.length < 2)) throw Error('for 반복문과 show_robot 호출 확인 필요');
  const count = total ?? frames.length;
  if (frames.length !== Math.min(limit, count - first)) throw Error('온라인 실행 결과가 중간에 잘림: 다시 재생 필요');
  return { frames, total: count, stop };
}

export function jointConfig(values = {}) {
  const config = { ...DEFAULT_JOINT_CONFIG, ...values };
  for (const key of Object.keys(DEFAULT_JOINT_CONFIG)) {
    if (config[key] === '') throw Error('빈 입력값 확인');
    config[key] = Number(config[key]);
    if (!Number.isFinite(config[key])) throw Error('숫자 입력값 확인');
  }
  if (Math.abs(config.theta1) > 180 || Math.abs(config.theta2) > 180) throw Error('처음 각도 범위: −180~180°');
  if (Math.abs(config.omega1) > 1 || Math.abs(config.omega2) > 1) throw Error('관절속도 범위: −1~1rad/s');
  if (config.duration < 0.2 || config.duration > 10) throw Error('재생 시간 범위: 0.2~10초');
  return config;
}

export function initialJoints(config) {
  return [config.theta1 * Math.PI / 180, config.theta2 * Math.PI / 180];
}

export function advanceJoints(q, omega, dt) {
  return [q[0] + omega[0] * dt, q[1] + omega[1] * dt];
}

export function jointMotion(q, omega) {
  const [a, b] = q, c1 = Math.cos(a), s1 = Math.sin(a), c12 = Math.cos(a + b), s12 = Math.sin(a + b);
  const J = [[-s1 - s12, -s12], [c1 + c12, c12]];
  return {
    elbow: [c1, s1], tip: [c1 + c12, s1 + s12], J,
    velocity: J.map(row => row[0] * omega[0] + row[1] * omega[1])
  };
}

function matrix(rows) {
  const number = value => {
    const rounded = Math.abs(value) < 0.0005 ? 0 : value;
    return `${rounded < 0 ? '-' : '\\phantom{-}'}${Math.abs(rounded).toFixed(3)}`;
  };
  return `\\begin{bmatrix}${rows.map(row => row.map(number).join('&')).join('\\\\')}\\end{bmatrix}`;
}

export function jointEquation(q, omega, values = jointMotion(q, omega)) {
  const { J, velocity } = values;
  return `\\underbrace{${matrix(J)}}_{J(\\boldsymbol{\\theta})}\\;\\underbrace{${matrix(omega.map(v => [v]))}}_{\\dot{\\boldsymbol{\\theta}}\\;(\\mathrm{rad/s})}=\\underbrace{${matrix(velocity.map(v => [v]))}}_{\\dot{\\mathbf{x}}\\;(\\mathrm{m/s})}`;
}

export function inverseEquation(q, omega, values = jointMotion(q, omega)) {
  const {J,velocity}=values, det=J[0][0]*J[1][1]-J[0][1]*J[1][0];
  const inverse=values.inverse || [[J[1][1]/det,-J[0][1]/det],[-J[1][0]/det,J[0][0]/det]];
  return `\\underbrace{${matrix(omega.map(v=>[v]))}}_{\\dot{\\boldsymbol{\\theta}}\\;(\\mathrm{rad/s})}=\\underbrace{${matrix(inverse)}}_{J^{-1}(\\boldsymbol{\\theta})}\\;\\underbrace{${matrix(velocity.map(v=>[v]))}}_{\\dot{\\mathbf{x}}\\;(\\mathrm{m/s})}`;
}
