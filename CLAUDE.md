# ToDo-mini 작업 메모 (새 대화에서 이 파일을 먼저 읽을 것)

## 사용자
- 코딩을 전혀 모르는 한국어 사용자(Windows). 쉬운 말로, 핵심만 짧게 설명한다.
- 자주 수정 요청이 오고, 수정하면 앱 안의 "새 버전" 막대로 업데이트한다.

## 이 프로젝트
- 바탕화면에 붙는 작은 To-Do 위젯(Electron, Windows). 저장소: github.com/e0neve-918/todo-mini (공개)
- 구성: `app/`(시작용 껍데기, 거의 안 바뀜) / `core/`(실제 앱 코드, 업데이트로 바뀜) / `docs/index.html`(GitHub Pages 소개·다운로드 페이지) / `tools/set-exe-icon.js`(exe 아이콘 삽입) / `.github/workflows/release.yml`
- core 안: `main.js`(창·트레이·업데이트·설정 저장), `preload.js`, `theme.js`(색/그라데이션 계산, 위젯·설정이 공유), `renderer/`(위젯 화면), `settings/`(설정 창)

## 배포 규칙 (중요)
1. 수정은 `core/` 안에서 한다.
2. `core/package.json`의 `version`을 올린다 (예: 0.4.2 → 0.4.3). 이 숫자가 릴리스 기준이다.
3. main에 커밋·푸시하면 GitHub Actions가 약 1분 안에 릴리스(`core.zip` + `ToDo-mini-win64.zip`)를 만든다. 같은 버전의 릴리스가 이미 있으면 건너뛴다.
4. 앱은 `core.zip`을 받아 알아서 업데이트한다. exe 자체(아이콘, 이름, Electron 버전)를 바꿀 때만 사용자가 zip을 새로 받아야 한다.
- 태그 푸시는 막혀 있다(릴리스는 `gh release create --target`으로 workflow가 만든다). `gh`는 REST(`gh api`)만 가능, GraphQL 불가. npm 레지스트리는 샌드박스에서 막혀 있다.
- 커밋 메시지 끝에는 세션이 알려주는 Co-Authored-By 줄을 붙인다.

## 현재 동작 (v0.4.4)
- 위젯은 항상 맨 위. 평소엔 체크만 가능(클릭 통과: 체크박스·제목·업데이트 막대만 클릭됨).
- 제목(To-Do) 더블클릭 또는 트레이 메뉴 → "편집 화면"(탭·추가 칸·간이 바: 스티커/투명도/위치 잠금/설정) 열고 닫기. 간이 바는 위젯과 같은 폭(340px), 높이 약 32px. 트레이 클릭은 편집 화면 + 설정 창.
- 설정 창: 테마 색(색1·색2 그라데이션, 번짐 위치 바꾸기), 글자색(자동/직접), 강조색 — 모두 RGB 색판(색 네모+색조+RGB 숫자+스포이드), 글꼴(설치된 글꼴), 글자 크기·굵기, 스티커 보관함, 작업표시줄 표시, 윈도우 시작 시 실행, 업데이트 확인.
- 스티커: PNG, 최대 20개 보관 / 30개 부착, 끌기·휠로 크기·오른쪽 클릭으로 떼기.
- 데이터: `%APPDATA%\todo-widget\data.json`

## 알려진 한계 / 확인 안 된 것
- Electron 투명 창에서는 뒤 화면을 흐리는 블러가 안 된다(반투명 색 + 무광 알갱이로 대체).
- Windows 실제 동작은 샌드박스에서 못 돌려봄(더블클릭, 클릭 통과, 글꼴 목록, 업데이트 적용/재시작).
- 아이콘: `core/build/icon.ico`(16~256 여러 크기, icon.png와 같은 그림). 바꿀 땐 둘 다 다시 만든다.
  - 작업표시줄 고정 아이콘 대책(v0.4.3): 창마다 `setAppDetails`로 고정용 아이콘(`%APPDATA%\todo-widget\pin-icon-2.ico`)·실행 파일·이름을 알려 줌 → core 업데이트만으로 적용. 아이콘을 또 바꾸면 파일 이름 번호(`pin-icon-N`)를 올려야 Windows 캐시를 피한다.
  - v0.4.2까지 exe에는 256 PNG 한 장만 들어 있었음. v0.4.3부터 exe에도 여러 크기 ico 삽입.
  - 이미 고정해 둔 아이콘은 사용자가 "고정 해제 → 다시 고정"해야 바뀐다.
- 오래된 설정 키(`auto`, `pin`, `ctl`)는 더 이상 쓰지 않는다.

## 화면 테스트 방법
- 브라우저(Playwright)에서 `window.api`를 가짜로 만들어 `core/renderer/index.html`, `core/settings/index.html`을 열어 스크린샷으로 확인한다.
