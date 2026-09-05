#!/usr/bin/env bash
# scripts/lib/find-projects-root.sh — 사용자의 "프로젝트 폴더" 후보 찾기 (순수 조회, 변경 없음)
#
# 홈 아래 1~2단계 폴더 중 하위에 git 저장소(.git)를 품은 폴더를 세어 후보로 만든다.
# 출력: "<저장소수>\t<절대경로>" 를 저장소수 내림차순으로 한 줄씩. (후보 없으면 아무것도 출력 안 함)
# 사용: bash scripts/lib/find-projects-root.sh [HOME]
#   ROOT_SCAN_MAXDEPTH (기본 2) : 홈 기준 몇 단계까지 후보 폴더로 볼지
# 제외: 숨김 폴더, node_modules, /mnt/* 는 후보에서 뺀다(느리고 claude 함정 — 원하면 직접 입력 가능).
set -uo pipefail
HOME_DIR="${1:-$HOME}"
MAXDEPTH="${ROOT_SCAN_MAXDEPTH:-2}"

# 후보 폴더 목록: 홈 직속 + 2단계, 숨김/node_modules 제외
find "$HOME_DIR" -mindepth 1 -maxdepth "$MAXDEPTH" -type d \
  ! -name '.*' ! -path '*/.*' ! -name node_modules ! -path '*/node_modules/*' 2>/dev/null |
while IFS= read -r dir; do
  # dir 의 "직속 자식" 중 git 저장소인 것만 센다 (dir 자체가 저장소면 프로젝트 폴더가 아니라 프로젝트)
  [ -d "$dir/.git" ] && continue
  n=0
  for child in "$dir"/*/; do
    [ -d "$child/.git" ] && n=$((n + 1))
  done
  [ "$n" -ge 1 ] && printf '%s\t%s\n' "$n" "$dir"
done | sort -t$'\t' -k1,1nr -k2,2
