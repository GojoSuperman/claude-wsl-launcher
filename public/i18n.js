// public/i18n.js
// 대시보드 다국어(ko/en/ja). 순수 부분(translate/DICT)은 node:test 로 단위 테스트.
// 브라우저는 ESM import 로, 언어 전환 시 window 'i18n:change' 이벤트를 발화한다.

export const LANGS = ['ko', 'en', 'ja'];
const LS_KEY = 'launcher.lang';

// 키 → 문자열. 동적 문자열은 함수형 값(인자로 포맷).
export const DICT = {
  ko: {
    appTitle: '프로젝트 런처',
    newProject: '+ 새 프로젝트',
    refresh: '새로고침',
    shutdown: '서버 종료',
    consoleTitle: '서버 콘솔',
    collapseTitle: '접기/펼치기',
    running: '● 실행 중',
    hasSession: '대화 이력 있음',
    newSession: '새 세션',
    launchContinue: 'claude 이어서 실행',
    launchNew: 'claude 새로 실행',
    checkRemote: '원격 확인',
    ghPublic: '공개', ghPrivate: '비공개',
    ghToggleHint: '클릭하면 전환',
    ghMakePublicConfirm: (x) => `"${x}" 저장소를 GitHub 에서 [공개]로 바꿉니다.\n\n코드·커밋 이력·이슈가 누구에게나 보이게 됩니다. 시크릿·개인정보가 없는지 먼저 확인하세요.\n\n계속할까요?`,
    ghMakePrivateConfirm: (x) => `"${x}" 저장소를 GitHub 에서 [비공개]로 바꿉니다.\n\n스타·워처가 사라지고, 다른 사람의 포크는 분리됩니다.\n\n계속할까요?`,
    ghToggleFail: (x) => `공개 설정 변경 실패: ${x} — 저장소 관리자 권한과 gh 로그인(gh auth login)을 확인하세요.`,
    ghPublicTitle: 'GitHub 공개 저장소 — 누구나 볼 수 있음',
    ghPrivateTitle: 'GitHub 비공개 저장소',
    ghVisibilityLoading: 'GitHub 공개 여부 확인 중…',
    ghVisibilityUnknown: '공개 여부를 알 수 없음 — gh CLI 로그인(gh auth login)이 필요합니다',
    themeSystem: '자동', themeSystemTitle: '테마: Windows 설정 따름', themeLightTitle: '테마: 라이트', themeDarkTitle: '테마: 다크',
    notGit: 'git 아님',
    dirty: '변경 있음',
    clean: '깨끗',
    noCommit: '커밋 없음',
    justNow: '방금',
    minAgo: (n) => `${n}분 전`,
    hourAgo: (n) => `${n}시간 전`,
    dayAgo: (n) => `${n}일 전`,
    behind: (n) => `↓ ${n}개 뒤짐`,
    ahead: (n) => `↑ ${n}개 앞섬`,
    pull: '받기',
    upToDate: '최신 ✓',
    launchToast: '✓ 창을 열었어요',
    launchFail: (x) => `실행 실패: ${x}`,
    launchReqFail: '실행 요청 실패 — 서버 연결을 확인하세요.',
    fetchFail: (x) => `원격 확인 실패: ${x}`,
    fetchReqFail: '원격 확인 요청 실패 — 서버 연결을 확인하세요.',
    pullConfirm: (name) => `${name} 을(를) 받을까요? (fast-forward만)`,
    pullFail: (x) => `받기 실패: ${x}`,
    pullReqFail: '받기 요청 실패 — 서버 연결을 확인하세요.',
    createPrompt: '새 프로젝트 폴더 이름:',
    createAsciiOnly: (x) => `"${x}" 는 사용할 수 없는 이름입니다.\n프로젝트 이름은 영문·숫자·'-'·'_'·'.' 만 가능합니다 (GitHub 저장소 규칙). 한글 설명은 만든 뒤 카드의 '메모' 에 적어 주세요.`,
    createFail: (x) => `생성 실패: ${x}`,
    createReqFail: '생성 요청 실패 — 서버 연결을 확인하세요.',
    rename: '✏️ 프로젝트 이름 변경',
    renameRunningBlocked: '실행 중이라 이름을 바꿀 수 없습니다 — claude 창을 닫고 새로고침하세요.',
    renameSelfBlocked: '이 대시보드 서버가 도는 폴더라 이름을 바꿀 수 없습니다 — 서버를 종료한 뒤 터미널에서 바꾸세요.',
    renameTitle: '폴더 이름 변경 (GitHub 저장소 이름도 함께)',
    renameConfirm: (x) => `"${x}" 의 이름을 바꿉니다.\n\n다른 claude 창이나 편집기에서 이 폴더를 수정 중이 아닌지 확인하세요.\n(다른 폴더에서 띄운 claude 가 이 폴더를 고치는 경우는 자동 감지되지 않습니다)\n\n계속할까요?`,
    renamePrompt: (x) => `"${x}" 의 새 이름 (GitHub 저장소 이름도 같이 바뀝니다):`,
    renameAsciiOnly: (x) => `"${x}" 는 사용할 수 없는 이름입니다.\n\n프로젝트 이름은 영문·숫자·'-'·'_'·'.' 만 가능합니다 (GitHub 저장소 규칙).\n한글 설명은 카드의 '메모' 에 적어 주세요.`,
    renameFail: (x) => `이름 변경 실패: ${x}`,
    renameWarn: (x) => `로컬 폴더는 변경됨. ${x} — GitHub 이름은 gh CLI 로그인(gh auth login) 후 다시 시도하거나 웹에서 바꾸세요.`,
    renameReqFail: '이름 변경 요청 실패 — 서버 연결을 확인하세요.',
    shutdownConfirm: '서버를 종료할까요? 열린 터미널도 모두 닫힙니다.',
    shutdownDone: '서버를 종료했습니다. 이 창은 닫아도 됩니다.',
    projectsError: (x) => `프로젝트 목록 오류: ${x}`,
    connectFail: '서버에 연결할 수 없습니다. (npm start 로 서버가 떠 있는지 확인)',
    noProjects: '~/projects 아래에 프로젝트 폴더가 없습니다.',
    consoleDisconnected: '[서버 연결 끊김 — 종료되었거나 재시작이 필요합니다]',
    serverError: '서버 오류',
    unknownError: '알 수 없는 오류',
    mergeNeeded: '수동 병합이 필요할 수 있습니다',
    help: '도움말',
    helpTitle: '사용법',
    helpClose: '닫기',
    helpFullGuide: '전체 가이드(설치 포함) → GitHub',
    helpLaunch: '[claude 실행] — 카드 폴더에서 새 WSL 창에 claude (대화 이력 있으면 이어서)',
    helpRemote: '[원격 확인]/받기 — git fetch 후 뒤처졌으면 git pull --ff-only',
    helpNewProject: '[+ 새 프로젝트] — ~/projects 아래 폴더 생성 + git init',
    helpRename: '[✏️ 이름 변경] — 폴더 이름 변경 + claude 대화 이력 유지 + GitHub 저장소 이름 변경(gh CLI 로그인 필요)',
    helpConsole: '하단 콘솔 — 서버 로그(읽기 전용). 서버가 켜져 있음을 보여줌',
    helpShutdown: '[서버 종료] — 로컬 대시보드 서버를 끔. 창을 그냥 닫아도 약 10초 뒤 자동 종료됨',
    helpLang: '한국어 | EN | 日本語 — 화면 언어 전환',
    helpTheme: '자동 | ☀️ | 🌙 — 라이트/다크 테마 전환 (자동 = Windows 설정 따름)',
    helpGithub: '카드의 GitHub 줄 — origin 저장소와 공개/비공개 배지 (gh CLI 로그인 필요, 없으면 ?). 배지를 클릭하면 확인 후 공개↔비공개 전환',
  },
  en: {
    appTitle: 'Project Launcher',
    newProject: '+ New Project',
    refresh: 'Refresh',
    shutdown: 'Shut Down',
    consoleTitle: 'Server Console',
    collapseTitle: 'Collapse/Expand',
    running: '● Running',
    hasSession: 'Has history',
    newSession: 'New session',
    launchContinue: 'Continue claude',
    launchNew: 'Start claude',
    checkRemote: 'Check remote',
    ghPublic: 'public', ghPrivate: 'private',
    ghToggleHint: 'click to switch',
    ghMakePublicConfirm: (x) => `Make the "${x}" repository PUBLIC on GitHub.\n\nCode, commit history and issues become visible to everyone. Check for secrets or personal data first.\n\nContinue?`,
    ghMakePrivateConfirm: (x) => `Make the "${x}" repository PRIVATE on GitHub.\n\nStars and watchers are lost, and other people's forks are detached.\n\nContinue?`,
    ghToggleFail: (x) => `Visibility change failed: ${x} — check admin permission on the repo and gh login (gh auth login).`,
    ghPublicTitle: 'Public GitHub repository — visible to everyone',
    ghPrivateTitle: 'Private GitHub repository',
    ghVisibilityLoading: 'Checking GitHub visibility…',
    ghVisibilityUnknown: 'Visibility unknown — log in with gh CLI (gh auth login)',
    themeSystem: 'Auto', themeSystemTitle: 'Theme: follow Windows setting', themeLightTitle: 'Theme: light', themeDarkTitle: 'Theme: dark',
    notGit: 'not git',
    dirty: 'modified',
    clean: 'clean',
    noCommit: 'no commits',
    justNow: 'just now',
    minAgo: (n) => `${n} min ago`,
    hourAgo: (n) => `${n} h ago`,
    dayAgo: (n) => `${n} d ago`,
    behind: (n) => `↓ ${n} behind`,
    ahead: (n) => `↑ ${n} ahead`,
    pull: 'Pull',
    upToDate: 'up to date ✓',
    launchToast: '✓ Opened a window',
    launchFail: (x) => `Launch failed: ${x}`,
    launchReqFail: 'Launch request failed — check the server connection.',
    fetchFail: (x) => `Remote check failed: ${x}`,
    fetchReqFail: 'Remote check request failed — check the server connection.',
    pullConfirm: (name) => `Pull ${name}? (fast-forward only)`,
    pullFail: (x) => `Pull failed: ${x}`,
    pullReqFail: 'Pull request failed — check the server connection.',
    createPrompt: 'New project folder name:',
    createAsciiOnly: (x) => `"${x}" is not a valid name.\nProject names may only contain letters, digits, '-', '_' and '.' (GitHub repo rule). Put non-ASCII descriptions in the card's note after creating it.`,
    createFail: (x) => `Create failed: ${x}`,
    createReqFail: 'Create request failed — check the server connection.',
    rename: '✏️ Rename project',
    renameRunningBlocked: 'Cannot rename while running — close the claude window and refresh.',
    renameSelfBlocked: 'This folder runs the dashboard server itself — stop the server and rename it from a terminal.',
    renameTitle: 'Rename folder (also renames the GitHub repo)',
    renameConfirm: (x) => `About to rename "${x}".\n\nMake sure no other claude window or editor is modifying this folder.\n(A claude launched from another folder editing this one is not detected automatically.)\n\nContinue?`,
    renamePrompt: (x) => `New name for "${x}" (the GitHub repo will be renamed too):`,
    renameAsciiOnly: (x) => `"${x}" is not a valid name.\n\nProject names may only contain letters, digits, '-', '_' and '.' (GitHub repo rule).\nPut non-ASCII descriptions in the card's note instead.`,
    renameFail: (x) => `Rename failed: ${x}`,
    renameWarn: (x) => `Local folder renamed. ${x} — log in with gh CLI (gh auth login) and retry, or rename on GitHub web.`,
    renameReqFail: 'Rename request failed — check the server connection.',
    shutdownConfirm: 'Shut down the server? All open terminals will close too.',
    shutdownDone: 'Server shut down. You can close this window.',
    projectsError: (x) => `Project list error: ${x}`,
    connectFail: 'Cannot connect to the server. (check it is running via npm start)',
    noProjects: 'No project folders under ~/projects.',
    consoleDisconnected: '[Server disconnected — it was shut down or needs a restart]',
    serverError: 'Server error',
    unknownError: 'Unknown error',
    mergeNeeded: 'a manual merge may be needed',
    help: 'Help',
    helpTitle: 'How to use',
    helpClose: 'Close',
    helpFullGuide: 'Full guide (incl. setup) → GitHub',
    helpLaunch: '[Launch claude] — opens claude in a new WSL window from that folder (continues if history exists)',
    helpRemote: '[Check remote]/Pull — git fetch, then git pull --ff-only if behind',
    helpNewProject: '[+ New Project] — creates a folder under ~/projects + git init',
    helpRename: '[✏️ Rename] — renames the folder, keeps claude history, renames the GitHub repo (needs gh CLI login)',
    helpConsole: 'Bottom console — server logs (read-only). Shows the server is running',
    helpShutdown: '[Shut Down] — stops the local dashboard server. Closing the window also stops it after ~10s',
    helpLang: '한국어 | EN | 日本語 — switch the display language',
    helpTheme: 'Auto | ☀️ | 🌙 — light/dark theme (Auto = follow Windows setting)',
    helpGithub: 'GitHub line on a card — origin repo and public/private badge (needs gh CLI login; shows ? otherwise). Click the badge to switch after confirming',
  },
  ja: {
    appTitle: 'プロジェクトランチャー',
    newProject: '+ 新規プロジェクト',
    refresh: '更新',
    shutdown: 'サーバー停止',
    consoleTitle: 'サーバーコンソール',
    collapseTitle: '折りたたみ/展開',
    running: '● 実行中',
    hasSession: '会話履歴あり',
    newSession: '新規セッション',
    launchContinue: 'claude を再開',
    launchNew: 'claude を起動',
    checkRemote: 'リモート確認',
    ghPublic: '公開', ghPrivate: '非公開',
    ghToggleHint: 'クリックで切替',
    ghMakePublicConfirm: (x) => `"${x}" リポジトリを GitHub で [公開] にします。\n\nコード・コミット履歴・Issue が誰にでも見えるようになります。シークレットや個人情報が無いか先に確認してください。\n\n続行しますか?`,
    ghMakePrivateConfirm: (x) => `"${x}" リポジトリを GitHub で [非公開] にします。\n\nスターとウォッチャーが失われ、他の人のフォークは切り離されます。\n\n続行しますか?`,
    ghToggleFail: (x) => `公開設定の変更に失敗: ${x} — リポジトリの管理者権限と gh ログイン (gh auth login) を確認してください。`,
    ghPublicTitle: 'GitHub 公開リポジトリ — 誰でも閲覧可能',
    ghPrivateTitle: 'GitHub 非公開リポジトリ',
    ghVisibilityLoading: 'GitHub の公開状態を確認中…',
    ghVisibilityUnknown: '公開状態が不明 — gh CLI でログイン (gh auth login) が必要です',
    themeSystem: '自動', themeSystemTitle: 'テーマ: Windows 設定に従う', themeLightTitle: 'テーマ: ライト', themeDarkTitle: 'テーマ: ダーク',
    notGit: 'git なし',
    dirty: '変更あり',
    clean: 'クリーン',
    noCommit: 'コミットなし',
    justNow: 'たった今',
    minAgo: (n) => `${n}分前`,
    hourAgo: (n) => `${n}時間前`,
    dayAgo: (n) => `${n}日前`,
    behind: (n) => `↓ ${n}件 遅れ`,
    ahead: (n) => `↑ ${n}件 先行`,
    pull: '取得',
    upToDate: '最新 ✓',
    launchToast: '✓ ウィンドウを開きました',
    launchFail: (x) => `起動失敗: ${x}`,
    launchReqFail: '起動リクエスト失敗 — サーバー接続を確認してください。',
    fetchFail: (x) => `リモート確認失敗: ${x}`,
    fetchReqFail: 'リモート確認リクエスト失敗 — サーバー接続を確認してください。',
    pullConfirm: (name) => `${name} を取得しますか？（fast-forward のみ）`,
    pullFail: (x) => `取得失敗: ${x}`,
    pullReqFail: '取得リクエスト失敗 — サーバー接続を確認してください。',
    createPrompt: '新規プロジェクトのフォルダ名:',
    createAsciiOnly: (x) => `"${x}" は使用できない名前です。\nプロジェクト名は英数字・'-'・'_'・'.' のみ使えます (GitHub リポジトリの規則)。日本語などの説明は作成後にカードの「メモ」に書いてください。`,
    createFail: (x) => `作成失敗: ${x}`,
    createReqFail: '作成リクエスト失敗 — サーバー接続を確認してください。',
    rename: '✏️ プロジェクト名変更',
    renameRunningBlocked: '実行中は名前を変更できません — claude ウィンドウを閉じて再読み込みしてください。',
    renameSelfBlocked: 'このダッシュボードサーバー自身のフォルダです — サーバーを終了してターミナルで変更してください。',
    renameTitle: 'フォルダ名を変更 (GitHub リポジトリ名も変更)',
    renameConfirm: (x) => `"${x}" の名前を変更します。\n\n他の claude ウィンドウやエディタでこのフォルダを編集中でないか確認してください。\n(別フォルダから起動した claude がこのフォルダを編集している場合は自動検出されません)\n\n続行しますか?`,
    renamePrompt: (x) => `"${x}" の新しい名前 (GitHub リポジトリ名も変わります):`,
    renameAsciiOnly: (x) => `"${x}" は使用できない名前です。\n\nプロジェクト名は英数字・'-'・'_'・'.' のみ使えます (GitHub リポジトリの規則)。\n日本語などの説明はカードの「メモ」に書いてください。`,
    renameFail: (x) => `名前変更失敗: ${x}`,
    renameWarn: (x) => `ローカルフォルダは変更済み。${x} — gh CLI でログイン (gh auth login) して再試行するか、GitHub ウェブで変更してください。`,
    renameReqFail: '名前変更リクエスト失敗 — サーバー接続を確認してください。',
    shutdownConfirm: 'サーバーを停止しますか？開いているターミナルもすべて閉じます。',
    shutdownDone: 'サーバーを停止しました。このウィンドウは閉じても構いません。',
    projectsError: (x) => `プロジェクト一覧エラー: ${x}`,
    connectFail: 'サーバーに接続できません。（npm start で起動しているか確認）',
    noProjects: '~/projects の下にプロジェクトフォルダがありません。',
    consoleDisconnected: '[サーバー接続が切断されました — 停止したか再起動が必要です]',
    serverError: 'サーバーエラー',
    unknownError: '不明なエラー',
    mergeNeeded: '手動マージが必要かもしれません',
    help: 'ヘルプ',
    helpTitle: '使い方',
    helpClose: '閉じる',
    helpFullGuide: '詳細ガイド（インストール含む） → GitHub',
    helpLaunch: '[claude 起動] — そのフォルダーから新しい WSL ウィンドウで claude（履歴があれば再開）',
    helpRemote: '[リモート確認]/取得 — git fetch 後、遅れていれば git pull --ff-only',
    helpNewProject: '[+ 新規プロジェクト] — ~/projects 配下にフォルダー作成 + git init',
    helpRename: '[✏️ 名前変更] — フォルダ名変更 + claude 履歴を維持 + GitHub リポジトリ名変更 (gh CLI ログイン必要)',
    helpConsole: '下部コンソール — サーバーログ（読み取り専用）。サーバーが稼働中であることを表示',
    helpShutdown: '[サーバー停止] — ローカルのダッシュボードサーバーを停止。ウィンドウを閉じても約10秒後に自動停止',
    helpLang: '한국어 | EN | 日本語 — 表示言語を切り替え',
    helpTheme: '自動 | ☀️ | 🌙 — ライト/ダークテーマ切替 (自動 = Windows 設定に従う)',
    helpGithub: 'カードの GitHub 行 — origin リポジトリと公開/非公開バッジ (gh CLI ログイン必要。無い場合は ?)。バッジをクリックすると確認後に切替',
  },
};

let current = null; // 메모리 캐시(localStorage 없는 환경/테스트 대비)

/** 저장된 언어. 없거나 무효면 ko. */
export function getLang() {
  if (current && LANGS.includes(current)) return current;
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(LS_KEY);
      if (LANGS.includes(v)) { current = v; return v; }
    }
  } catch { /* 접근 불가 무시 */ }
  return 'ko';
}

/** 언어 설정 + 저장 + (브라우저면) 'i18n:change' 발화. */
export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, lang);
  } catch { /* 무시 */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('i18n:change', { detail: lang }));
  }
}

/** 순수 번역: 언어를 명시. 함수형 값이면 args 로 호출. 미존재 키는 ko 폴백 후 키 자체. */
export function translate(lang, key, ...args) {
  const dict = DICT[lang] || DICT.ko;
  let v;
  if (key in dict) v = dict[key];
  else if (key in DICT.ko) v = DICT.ko[key];
  else return key;
  return typeof v === 'function' ? v(...args) : v;
}

/** 현재 언어 기준 번역. */
export function t(key, ...args) {
  return translate(getLang(), key, ...args);
}

// 브라우저 전역 노출(모듈 import 안 하는 코드 대비, 선택적).
if (typeof window !== 'undefined') {
  window.i18n = { t, translate, getLang, setLang, LANGS, DICT };
}
