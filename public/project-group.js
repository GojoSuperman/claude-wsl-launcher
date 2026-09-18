// public/project-group.js
// 프로젝트 목록을 GitHub 연결 여부로 분할하고 각 그룹을 이름순 정렬한다 (순수).
// github 필드(owner/repo|null)는 서버 /api/projects 가 채운다.
export function groupProjects(projects) {
  if (!Array.isArray(projects)) return { noGithub: [], github: [] };
  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    noGithub: projects.filter((p) => !p.github).sort(byName),
    github: projects.filter((p) => p.github).sort(byName),
  };
}
