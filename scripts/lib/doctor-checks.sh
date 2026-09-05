#!/usr/bin/env bash
# scripts/lib/doctor-checks.sh
# doctor.sh 의 순수(부수효과 없는) 판정 함수 + 대화형 보조.
# 단위 테스트가 source 해서 함수 단위로 검증할 수 있게 분리한다. (실행 안 함 — source 전용)

# claude 경로를 분류한다: missing | windows | native
#   인자: command -v claude 결과(빈 문자열 가능)
classify_claude() {
  local p="${1:-}"
  if [ -z "$p" ]; then echo missing; return 0; fi
  case "$p" in
    /mnt/*) echo windows ;;
    *)      echo native ;;
  esac
}

# "v24.16.0" → "24". 파싱 불가면 빈 문자열.
parse_node_major() {
  printf '%s' "${1:-}" | sed -n 's/^v\{0,1\}\([0-9][0-9]*\).*/\1/p'
}

# is_node_ge <버전문자열> <최소major(기본20)>
#   종료코드: 0=충분, 1=너무낮음, 2=파싱불가
is_node_ge() {
  local major; major="$(parse_node_major "${1:-}")"
  if [ -z "$major" ]; then return 2; fi
  [ "$major" -ge "${2:-20}" ]
}

# ask_yn <메시지> : 0=예, 1=아니요. 기본 N(그냥 Enter=아니요).
#   프롬프트는 stderr 로 보내 stdout(결과 캡처)을 더럽히지 않는다.
ask_yn() {
  local msg="${1:-진행할까요?}" ans
  # SETUP_YES=1 (setup.sh --yes): 비대화형 설치 — 모든 질문을 '예'로
  if [ -n "${SETUP_YES:-}" ]; then printf '%s\n[자동: 예]\n' "$msg" >&2; return 0; fi
  printf '%s\n[Y = 네 / N = 아니요]  (그냥 Enter = 아니요): ' "$msg" >&2
  read -r ans 2>/dev/null || ans=""
  case "$ans" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# run_or_show <명령...> : DOCTOR_DRY_RUN 이 비어있지 않으면 실행 대신 "RUN> ..." 출력.
run_or_show() {
  if [ -n "${DOCTOR_DRY_RUN:-}" ]; then
    printf 'RUN> %s\n' "$*"
  else
    "$@"
  fi
}
