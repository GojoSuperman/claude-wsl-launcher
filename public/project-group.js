// public/project-group.js
// 프로젝트 목록을 GitHub 연결 여부로 분할하고 각 그룹을 정렬한다 (순수).
// github 필드(owner/repo|null)는 서버 /api/projects 가 채운다.
// order(사용자가 드래그로 정한 프로젝트명 배열)가 있으면 그 순서를 따르고,
// 목록에 없는 프로젝트(새로 생긴 것)는 그룹 맨 앞에 이름순으로 놓는다. order 가 비면 전체 이름순.
export function groupProjects(projects, order = []) {
  if (!Array.isArray(projects)) return { noGithub: [], github: [] };
  const rank = new Map((Array.isArray(order) ? order : []).map((n, i) => [n, i]));
  const sort = (a, b) => {
    const ra = rank.has(a.name) ? rank.get(a.name) : -1;
    const rb = rank.has(b.name) ? rank.get(b.name) : -1;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  };
  return {
    noGithub: projects.filter((p) => !p.github).sort(sort),
    github: projects.filter((p) => p.github).sort(sort),
  };
}
