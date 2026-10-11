// public/whats-new-data.js
// '✨ 새 기능' 창의 소식 목록 — 최신이 맨 위. 업데이트할 때 맨 위에 한 묶음 추가한다.
//   id = 'YYYY-MM-DD' (같은 날 두 번이면 'YYYY-MM-DD-2'). 이미 낸 id 는 바꾸지 않는다(본 기록이 id 로 남음).
//   items[lang] = [{ t: 제목, d: 설명 }] — ko/en/ja 셋 다 채운다(없는 언어는 ko 로 보임).

export const RELEASES = [
  {
    id: '2026-10-11',
    items: {
      ko: [
        { t: '📁 작업 폴더가 ~/projects 로 고정됐어요', d: '프로젝트는 이제 WSL(리눅스) 공간 안의 ~/projects 에서만 작업해요. Windows 폴더에서 바로 작업할 때 생기던 느림·줄바꿈 문제를 막기 위해서예요. 예전에 스캔 폴더를 바꿔 쓰셨다면 카드가 안 보일 수 있어요 → 아래 ⬇ 가져오기로 그 폴더의 프로젝트를 옮겨 오세요.' },
        { t: '⬇ 가져오기 창이 세 탭으로', d: 'GitHub(저장소 받기) / 💻 내 PC(바탕 화면·문서·다운로드·드라이브에서 골라 복사, 원본은 그대로) / 🐧 WSL(홈의 폴더를 ~/projects 로 이동). GitHub 연결(.git)은 그대로 유지돼요.' },
        { t: '🗑 휴지통', d: '카드를 삭제하면 작업 폴더 옆에 🗑 휴지통 (n) 버튼이 생겨요. 눌러서 되살리거나 영구 삭제할 수 있어요. (Windows 휴지통과는 별개)' },
        { t: '👥 팀 프로젝트 표시', d: '협업 저장소 카드에 👑 팀장 / 👥 팀원 배지가 붙고, GitHub 확인을 누르면 "병합 끝 — main 받고 새 작업" 같은 할 일을 띠로 알려 줘요. ⓘ 를 누르면 자세한 상태와 claude 에게 할 말을 볼 수 있어요.' },
        { t: '🛡 작업 중인 프로젝트 보호', d: 'claude 가 열려 있는 카드에서 받기를 누르면 위험 안내가 나와요. 같은 프로젝트를 한 번 더 열면 새 대화로 열려서 서로 덮어쓰지 않아요.' },
      ],
      en: [
        { t: '📁 The work folder is now fixed to ~/projects', d: 'Projects now live only in ~/projects inside the WSL (Linux) space, which avoids the slowness and line-ending problems of working directly in Windows folders. If you used a different scan folder before, your cards may be missing → bring those projects over with ⬇ Import below.' },
        { t: '⬇ Import now has three tabs', d: 'GitHub (clone a repo) / 💻 My PC (pick from Desktop, Documents, Downloads or a drive and copy it — the original stays) / 🐧 WSL (move a folder from your home into ~/projects). The GitHub link (.git) is kept.' },
        { t: '🗑 Trash', d: 'After you delete a card, a 🗑 Trash (n) button appears next to the work folder. Restore projects or delete them forever from there. (Separate from the Windows Recycle Bin)' },
        { t: '👥 Team projects', d: 'Collaboration repos get 👑 lead / 👥 member badges, and Check GitHub shows to-dos like "Merged — pull main and start new work" as a strip. Press ⓘ for details and what to tell claude.' },
        { t: '🛡 Protecting projects in use', d: 'Pressing Pull on a card where claude is open shows a warning. Opening the same project again starts a new conversation so the two windows don\'t overwrite each other.' },
      ],
      ja: [
        { t: '📁 作業フォルダが ~/projects に固定されました', d: 'プロジェクトは WSL (Linux) 空間内の ~/projects でのみ作業します。Windows のフォルダで直接作業したときの遅さや改行コードの問題を防ぐためです。以前スキャンフォルダを変更していた場合はカードが見えないことがあります → 下の ⬇ 取り込みでそのフォルダのプロジェクトを移してください。' },
        { t: '⬇ 取り込み画面が 3 つのタブに', d: 'GitHub (リポジトリ取得) / 💻 PC (デスクトップ・ドキュメント・ダウンロード・ドライブから選んでコピー、元は残ります) / 🐧 WSL (ホームのフォルダを ~/projects へ移動)。GitHub との連携 (.git) はそのまま残ります。' },
        { t: '🗑 ゴミ箱', d: 'カードを削除すると作業フォルダの横に 🗑 ゴミ箱 (n) ボタンが出ます。そこから元に戻したり完全に削除したりできます。(Windows のごみ箱とは別)' },
        { t: '👥 チームプロジェクト表示', d: '共同作業リポジトリのカードに 👑 リーダー / 👥 メンバーのバッジが付き、GitHub 確認で「マージ完了 — main を取得して新しい作業へ」などのやることを帯で知らせます。ⓘ で詳しい状態と claude に伝える言葉を確認できます。' },
        { t: '🛡 作業中のプロジェクトを保護', d: 'claude が開いているカードで取得を押すと注意が表示されます。同じプロジェクトをもう一度開くと新しい会話で開くので、互いに上書きしません。' },
      ],
    },
  },
];
