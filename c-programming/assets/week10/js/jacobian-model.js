// Week 07 joint-velocity model reused for the Week 09 function exercise.
export const JOINT_PAGE_SIZE = 96;
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
#line 1 "exercise.c"
${code}
#line 1 "jacobian_runtime.c"
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

export function jointMotion(q, omega) {
  const [a, b] = q, c1 = Math.cos(a), s1 = Math.sin(a), c12 = Math.cos(a + b), s12 = Math.sin(a + b);
  const J = [[-s1 - s12, -s12], [c1 + c12, c12]];
  return {
    elbow: [c1, s1], tip: [c1 + c12, s1 + s12], J,
    velocity: J.map(row => row[0] * omega[0] + row[1] * omega[1])
  };
}

