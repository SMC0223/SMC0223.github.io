// Only records values supplied by the student's C program; no dynamics are synthesized here.
export const BOX_MAX_FRAMES = 1001;
export function boxProgram(code) {
  if (!String(code).trim()) throw Error('C 코드 작성 필요');
  return `#include <stdio.h>
#include <math.h>
#include <stdlib.h>
static int box_count = 0;
static double box_last_time = -1.0;
static inline void show_box(double t, double x, double xdot, double xddot) {
    if (!isfinite(t) || !isfinite(x) || !isfinite(xdot) || !isfinite(xddot)) {
        puts("BOX1 STOP finite");
        exit(0);
    }
    if (t < 0.0 || t > 10.000001 || (box_count == 0 ? fabs(t) > 1e-8 : t <= box_last_time)) {
        puts("BOX1 STOP time");
        exit(0);
    }
    if (box_count >= ${BOX_MAX_FRAMES}) {
        puts("BOX1 STOP frames");
        exit(0);
    }
    printf("BOX1 %.17g %.17g %.17g %.17g\\n", t, x, xdot, xddot);
    box_count++;
    box_last_time = t;
}
#define main box_student_main
#line 1 "exercise.c"
${code}
#line 1 "freefall_runtime.c"
#undef main
int main(void) {
    int result = box_student_main();
    printf("BOX1 END %d %.17g\\n", box_count, box_last_time);
    return result;
}
`;
}

export function boxTrajectory(stdout) {
  const text = String(stdout), lines = text.trim().split(/\r?\n/);
  const stop = lines.find(line => /^BOX1 STOP(?:\s|$)/.test(line));
  if (stop) {
    const reason = stop.trim().split(/\s+/)[2];
    throw Error({ finite: 'C 계산값은 유한한 숫자여야 함', time: '시뮬레이션 시간 범위: 0~10초, 0초부터 순서대로 증가', frames: `show_box 호출 횟수 초과: 최대 ${BOX_MAX_FRAMES}회` }[reason] || 'C 상태 기록 중단: show_box 호출 확인');
  }
  const footers = lines.filter(line => /^BOX1 END(?:\s|$)/.test(line));
  if (footers.length !== 1 || /\[truncated\]/i.test(text)) throw Error('온라인 실행 결과가 중간에 잘림: 다시 실행 필요');
  const footer = footers[0], metadata = footer.trim().split(/\s+/).slice(2);
  if (metadata.length !== 2 || metadata.some(value => !value.trim() || !Number.isFinite(Number(value)))) throw Error('C 상태 기록의 종료 정보 확인 필요');
  const [total, lastTime] = metadata.map(Number);
  if (!Number.isInteger(total) || total < 2 || total > BOX_MAX_FRAMES) throw Error(`show_box 호출 횟수 확인: 2~${BOX_MAX_FRAMES}회 필요`);
  if (lastTime < 0 || lastTime > 10.000001) throw Error('시뮬레이션 시간 범위: 0~10초');
  const frames = [];
  let ended = false;
  for (const line of lines) {
    if (line === footer) { ended = true; continue; }
    if (!line.startsWith('BOX1')) continue;
    if (ended) throw Error('C 상태 기록의 종료 순서 확인 필요');
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    if (!line.startsWith('BOX1 ') || values.length !== 4) throw Error('C 상태 데이터가 불완전함: show_box 호출 확인');
    if (values.some(value => !Number.isFinite(value))) throw Error('C 계산값은 유한한 숫자여야 함');
    const [t, x, xdot, xddot] = values;
    if (frames.length >= BOX_MAX_FRAMES || t < 0 || t > 10.000001 || (frames.length ? t <= frames.at(-1).t : Math.abs(t) > 1e-8)) throw Error('시뮬레이션 시간 범위: 0~10초, 0초부터 순서대로 증가');
    frames.push({ t, x, xdot, xddot });
  }
  if (frames.length !== total || Math.abs(frames.at(-1).t - lastTime) > 1e-8) throw Error('온라인 실행 결과가 중간에 잘림: 다시 실행 필요');
  return { frames };
}
