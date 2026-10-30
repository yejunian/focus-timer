# CLAUDE.md

이 저장소에서 작업하는 LLM 에이전트가 새 세션에서도 알고 있어야 할 내용이다.
코드나 결정 사항이 바뀌면 이 파일도 함께 고친다. 작업 중에는 그 작업의 명세를 길게 적어 두어도 되지만, 작업을 끝낼 때는 장황하지 않고 명료하게 다듬는다. 코드를 읽으면 알 수 있는 세부 사항은 빼고 결정과 그 이유를 남긴다.

## 프로젝트 개요

- 집중 세션과 휴식 세션으로 이루어진 집중 타이머 웹 앱. 설정한 시간이 지나도 자동으로 넘어가지 않고, 진행 시간을 위로 세며 초과 여부를 보여 준다.
- "세션"은 집중과 휴식 한 쌍이다. 대기 화면에서 여러 세션을 계획하고 "세션 1 집중 → 세션 1 휴식 → 세션 2 집중 → …" 순서로 진행한다.
- GitHub Pages 프로젝트 사이트로 배포한다. base 경로 `/focus-timer`는 빌드할 때만 적용한다 (`vite.config.ts`).
- 다크 모드 고정 (`<html class="dark">`). 라이트 모드는 아직 구현하지 않는다.
- 모바일, 태블릿, 데스크톱, 높이가 낮은 가로 화면에 모두 대응한다.
- UI 문구, 코드 주석, 커밋 메시지는 한국어로 쓴다.

현재 상태 (2026-10-30): 여러 세션 계획, 이력 저장(IndexedDB), 집중 마무리 창, 그만두기까지 `main`에 머지했다. 다음 목표는 이 이력으로 통계 페이지를 만드는 것이다.

**데이터 호환성**: 배포 워크플로(GitHub Actions)를 작성하기 전까지는 저장 구조를 바꿔도 마이그레이션하지 않는다. 작성한 뒤에는 마이그레이션이 필요 없게 설계하고, 꼭 필요하면 "저장"의 규칙대로 데이터베이스 버전을 올린다.

## 명령어

```sh
pnpm dev      # 개발 서버
pnpm build    # 정적 빌드 (build/)
pnpm check    # svelte-check 타입 검사
pnpm lint     # prettier --check .
pnpm format   # prettier --write .
```

작업을 마치면 `pnpm check`, `pnpm lint`, `pnpm build`가 모두 통과해야 한다. 테스트 러너는 없다 ("검증 방법" 참고).

## 기술 스택과 주의할 점

예전 지식과 다른 최신 버전이 많다. 확신이 없으면 `node_modules`의 타입 정의를 직접 확인한다.

- **SvelteKit 3.1**: 설정은 `svelte.config.js`가 아니라 `vite.config.ts`의 `sveltekit({...})` 옵션에 있다. `$app/environment`는 `$app/env`로 바뀌었다.
- **Svelte 5.57**: runes 모드 강제. 쓰기 가능한 `$derived`와 함수 바인딩(`bind:value={() => get, (v) => set}`)을 쓴다.
- **경로 별칭**: `$lib` 대신 `package.json` `imports`의 `#lib`를 쓰고, `#lib/timer/model.js`처럼 `.js` 확장자로 import한다 (`.svelte.ts`는 `.svelte.js`).
- **Tailwind CSS 4**: 설정 파일 없이 `src/routes/layout.css`에서 테마를 정의한다.
- **shadcn-svelte 1.7**: style `nova`, baseColor `taupe`, bits-ui 2 기반. 아이콘은 `@lucide/svelte/icons/<이름>`으로 하나씩 import한다.
- **`cn`**: `clsx` + `tailwind-merge` 대신 `cn` 패키지를 `#lib/utils.js`에서 다시 내보낸다.
- TypeScript 6, Vite 8, pnpm 12, Node 24. pnpm 12는 `pnpm exec` 등을 실행할 때 lockfile에 맞춰 `node_modules`를 자동으로 고치므로, 예전 커밋에서 pnpm 명령을 실행했다면 돌아온 뒤 `pnpm install`을 실행한다.

## 디렉터리 구조

```
src/
  routes/
    +layout.ts                # ssr = false, prerender = true
    +page.ts                  # load: FocusTimer.load()
    +page.svelte              # connect(), 탭 제목, 화면 전환, 초점 이동
    layout.css                # 테마, 세션 색상 토큰, short: 변형
  lib/
    timer/
      model.ts                # 자료구조, 상수, 순수 상태 전이 함수
      history.ts              # 이력(HistoryEntry) 자료구조와 생성
      database.ts             # IndexedDB 열기/업그레이드, 탭 간 변경 알림
      storage.ts              # 타이머 상태 저장/불러오기/검증
      format.ts               # m:ss, 스크린 리더용 "12분 3초"
      focus-timer.svelte.ts   # 반응형 상태 클래스 FocusTimer
    components/
      timer/                  # 앱 컴포넌트 (대기 idle-view, 집중·휴식 session-view 등)
      ui/                     # shadcn-svelte가 생성한 컴포넌트
```

## 상태 모델 (`src/lib/timer/model.ts`)

- 용어: "세션"은 집중-휴식 한 쌍(`SessionPlan`), 실제로 진행한 집중이나 휴식 하나는 `SessionRecord`, 끝나서 이력에 남긴 것은 `HistoryEntry`다.
- `TimerState = { plan, active }`. `plan`은 대기 화면의 계획(항상 하나 이상)이고, `active`는 진행 중인 계획으로 `null`이면 대기 상태다.
  - `active.sessions`는 시작할 때 `plan`을 복사한 것이라, 진행 중에 고쳐도 `plan`은 바뀌지 않는다.
  - 끝난 집중/휴식은 `active.finished`에 시간순으로 쌓고, 진행 중인 것은 `active.current`에 둔다.
- 계획한 세션의 `id`는 목록 안에서만 겹치지 않는 정수다. `SessionRecord`의 `id`는 UUID이고 이력에도 그대로 남는다. `crypto.randomUUID()`는 http로 연 개발 서버에서 쓸 수 없어 `getRandomValues`로 만든다.
- 시각은 `Date.now()` 밀리초로 기록하고, 진행 시간은 `(endedAt ?? now) - startedAt - 일시정지 합`으로 계산한다. 그래서 새로고침해도 같다.
- 전이 함수는 순수 함수이고, 할 수 없는 전이는 같은 객체를 돌려준다. 집중/휴식을 끝내는 전이(`finishFocus`, `startNextFocus`, `completePlan`)는 `{ state, entry }`를 돌려준다. `quitPlan`은 진행 중인 것을 이력에 남기지 않는다.
- `finishFocus`는 마무리 창에서 저장한 때에 집중을 끝내고(열린 일시정지도 닫음) 바로 휴식을 시작한다. 넘겨받은 `sessionId`가 지금 집중과 다르면 무시한다.
- 상수: 집중 5–300분, 휴식 1–120분, 기본 집중 25분·휴식 5분, 목표 최대 100자.

## FocusTimer (`src/lib/timer/focus-timer.svelte.ts`)

- `FocusTimer.load()`로 만든다 (생성자는 private). 데이터베이스에서 상태를 다 읽은 뒤 돌려준다.
- 불변 상태를 `$state.raw`로 들고, 메서드를 거쳐 model.ts의 전이 함수로만 바꾼다. 바꿀 때마다 IndexedDB에 기록하고, 세션을 끝내는 전이는 상태와 이력을 한 트랜잭션으로 저장한다.
- 메모리의 상태를 먼저 바꾸고 저장은 기다리지 않는다. 저장 실패는 무시한다. 단, 이력이 겹쳐(ConstraintError) 거부되면 이 탭이 뒤처진 것이므로 저장된 상태를 다시 읽는다. 다시 읽는 동안 이 탭에서 상태를 바꿨으면(`#revision`) 읽은 값을 버린다.
- `connect()`는 `$effect(() => timer.connect())`로 호출한다. 다른 탭의 변경 알림을 받으면 다시 읽고, 세션이 흘러가는 동안에만 다음 초 경계에 맞춘 `setTimeout`으로 `#now`를 갱신하며, 탭이 다시 보이면 바로 갱신한다.

## 저장 (`database.ts`, `storage.ts`)

- 모든 데이터를 IndexedDB `focus-timer`(버전 1)에 둔다. localStorage는 쓰지 않는다.
  - `state` 저장소: `timer` 키에 `TimerState`를 그대로 둔다.
  - `history` 저장소: keyPath `id`, `startedAt` 인덱스. `add`로만 넣으므로 같은 세션을 두 번 넣으면 ConstraintError가 나고, 같은 트랜잭션의 상태 저장도 취소된다.
- IndexedDB를 쓸 수 없으면 `getDatabase()`가 `null`이고 메모리에서만 유지한다.
- 저장이 끝나면 BroadcastChannel(`focus-timer`)로 알린다. 다른 버전의 탭이 보낸 것일 수 있으므로 메시지 내용은 보지 않고 다시 읽기만 한다.
- 불러올 때 `parseState`로 모양을 검사해, 깨진 `active`는 버리더라도 `plan`은 되도록 살린다.
- **스키마를 바꿀 때** (배포 뒤)
  - `DATABASE_VERSION`을 올리고 `upgrade()`에 새 단계를 덧붙인다. 이미 배포한 단계는 고치지 않는다.
  - 다른 탭에서 버전을 올리면 열린 연결은 `versionchange`를 받아 닫고 새로고침한다. 첫 배포부터 있어야 하는 처리이므로 지우지 않는다.
  - 버전을 올리지 않은 배포에서는 옛 탭과 새 탭이 같은 데이터를 쓰므로, 값의 모양은 양쪽이 모두 읽을 수 있게 바꾼다.

## 이력 (`src/lib/timer/history.ts`)

- 집중/휴식을 끝낼 때마다 `HistoryEntry` 하나를 남기고, 저장한 이력은 고치지 않는다.
- 공통 필드: `id`(세션 id), `kind`, `startedAt`, `endedAt`(밀리초), `plannedMinutes`(설정한 시간).
- 집중에만 있는 필드: `pauses`(닫힌 일시정지 구간), `goal`(trim, 없으면 `""`), `outcome`(한 일, trim 후 500자로 자름, 없으면 `""`), `concentration`(집중도 1–5 정수, 필수).
- 필드를 지우거나 이름, 뜻, 단위를 바꾸지 않는다. 새 필드를 더하면 읽는 쪽에서 예전 이력에 그 필드가 없는 경우를 처리한다.
- 진행 시간은 저장하지 않고 `endedAt - startedAt - 일시정지 합`으로 계산한다.

## 확정된 동작 (사용자와 합의한 명세)

**대기 화면**

- 계획 목록의 맨 앞, 맨 뒤, 사이마다 "세션 추가" 버튼이 있다. 세션이 둘 이상이면 삭제 버튼(확인 없음)과 순서 바꾸기 손잡이(끌기, 위/아래 화살표 키)를 둔다.
- 시간 입력: 집중은 -/+ 5분 단위로 스냅하고 휴식은 1분 단위다. 휴식 시간에는 집중 시간에 맞춘 기본값(`getDefaultBreakMinutes`)으로 되돌리는 버튼이 있다. 범위를 벗어나면 브라우저 검증으로 시작을 막고, blur하면 범위 안으로 맞춘다.
- 계획은 저장되며 완료하거나 그만둬도 남는다. 휴식 중에 다음 세션을 고친 내용은 계획에 반영하지 않는다.

**집중·휴식 화면** (같은 `SessionView`)

- 진행 시간을 `m:ss`로 위로 센다 (60분을 넘으면 `75:03`). 세션이 둘 이상이면 라벨 옆에 `2/3`을 표시한다.
- 일시정지는 집중에만 있다. 일시정지 중에는 숫자를 흐리게 하고 "· 일시정지됨"을 표시한다.
- "휴식 시작"은 마무리 창을 연다. 집중도(1–5, 필수)와 한 일(선택)을 받고, 저장한 때에 집중을 끝내 바로 휴식을 0:00부터 시작한다. 창이 열린 동안에도 집중은 흐르고, 취소하면 그대로 이어진다.
- 휴식 화면에는 "지난 집중"(진행 시간 / 설정 시간 (비율을 5% 단위로 반올림), 목표)과, 마지막 세션이 아니면 고칠 수 있는 "다음 세션"을 둔다. 주요 버튼은 "집중 시작", 마지막 세션이면 "세션 완료"다. 남은 세션을 건너뛰는 기능은 없다.
- 오른쪽 위 "그만두기"는 확인을 받은 뒤 진행 중인 세션을 기록하지 않고 대기로 돌아간다. 마지막 세션의 휴식에서는 "세션 완료"로 마치므로 표시하지 않는다.
- 진행 바는 `경과 / 설정 시간`(최대 100%)이다. 초 단위로 내려 비교해 경과가 더 크면 초과(주황)로, 아니면 집중은 파랑, 휴식은 초록으로 표시한다.
- 탭 제목은 세션 중 `12:34 집중 · 집중 타이머`, 대기 중 `집중 타이머`다. 같은 브라우저의 탭끼리 동기화된다.

**UI 초점**

- 처음 열 때는 건드리지 않는다. 화면이 바뀌면 그 화면의 주요 버튼(집중 화면은 일시정지 버튼)에 준다.
- 세션을 추가하면 새 목표 입력란, 삭제하면 그 자리의 "세션 추가"로 옮긴다. 끌어서 옮기면 DOM 위치가 바뀌므로 원래 초점을 되돌린다.
- 마무리 창을 저장하고 닫으면 bits-ui가 초점을 "휴식 시작"이 있던 자리, 즉 "집중 시작"(또는 "세션 완료")으로 돌려준다.

## 렌더링과 빌드

- `+layout.ts`의 `ssr = false`, `prerender = true`: 빌드 시 SSG(정적 사이트 생성)를 위한 설정. 미리 렌더링하지 않은 경로는 adapter-static의 `fallback: "404.html"`이 처리한다.
- `+page.ts`의 `load`가 `FocusTimer.load()`를 기다린 뒤 그리므로, 처음 그린 화면이 곧 저장된 상태의 화면이다.

## 스타일 규칙

- 여백과 테두리 선이 겹겹이 쌓이지 않도록 Card 컴포넌트는 가능한 한 쓰지 않는다.
- 세션 색상은 `layout.css`의 토큰(`--session-focus`, `--session-break`, `--session-overtime`)으로 정의해 `bg-session-focus` 같은 클래스로 쓴다.
- `short:` 커스텀 변형(`@media (max-height: 32rem)`)으로 높이가 낮은 화면의 세로 공간을 줄인다.
- 한국어 문장에는 `break-keep`, 숫자에는 `tabular-nums`를 쓴다.
- Progress 막대 색은 부모에서 `*:data-[slot=progress-indicator]:bg-...`로 바꾼다.
- `layout.css`의 Pretendard 폰트 import는 사용자가 주석 처리한 것이다. 배포 워크플로(GitHub Actions)를 작성하기 전까지는 건드리지 않는다.

## 코딩 규칙

- 들여쓰기는 공백 2칸이다. Prettier(svelte, tailwindcss 플러그인)가 클래스 순서도 정렬한다.
- 파일 이름은 kebab-case. 앱 컴포넌트는 `src/lib/components/<기능>/`, 로직은 `src/lib/<기능>/`에 둔다.
- shadcn-svelte가 생성한 컴포넌트(`ui/`)는 되도록 고치지 않고 props와 class로 조정한다.
- 화면 컴포넌트에는 `timer` 객체를 prop으로 넘기고, 컴포넌트는 그 메서드를 호출한다.
- 끌어서 순서 바꾸기는 라이브러리 없이 Pointer Events로 구현했다 (`plan-list.svelte`).
- 목표와 한 일 입력값은 받은 그대로 둔다. 바로 trim하거나 자르면 한글 IME 조합이 깨진다. 목표는 그 집중을 시작할 때, 한 일은 이력을 만들 때 trim한다.
- bits-ui 대화상자는 열린 채로 컴포넌트째 없애지 않는다 (닫는 애니메이션과 초점 복원이 끊기고 화면 잠금이 남을 수 있다). `open`만 false로 바꾼다.
- 접근성
  - 타이머에는 `role="timer"`, 진행 바에는 한국어 `aria-valuetext`, 상태 문구에는 `aria-live`를 쓴다. 상태를 색으로만 구분하지 않는다.
  - 아이콘 버튼에는 `aria-label`을 붙인다. 같은 글자의 버튼이 여럿이면 보이는 글자를 포함한 `aria-label`로 구분한다 (예: "맨 앞에 세션 추가").
  - 범위 끝에 닿은 -/+ 버튼처럼 잠시 누를 수 없는 버튼은 `disabled` 대신 `aria-disabled`로 표시해 초점을 유지한다.
  - 필수 입력란의 라벨에는 빨간 `*`(`aria-hidden`)를 붙이고, 입력란에는 `required`를 둔다.

## shadcn-svelte CLI

- `pnpm exec shadcn-svelte add <컴포넌트> -y`로 추가한 뒤, 탭 들여쓰기를 `pnpm exec prettier --write src/lib/components/ui`로 고친다.
- 이미 있는 파일과 겹치면 CLI가 대화형으로 멈춘다. `-o`로 덮어쓰고 포매팅한 뒤 `git diff`로 기존 파일이 바뀌지 않았는지 확인한다.
- 작업과 관계없는 의존성 버전이 함께 올라가면 `package.json`, `pnpm-lock.yaml`을 되돌리고 `pnpm install`을 실행한다.
- dialog의 닫기(X) 버튼은 영어 "Close" 라벨이므로 `showCloseButton={false}`로 끄고 "취소" 버튼을 직접 둔다.

## Git 규칙

- 커밋 메시지는 `.gitmessage.txt` 템플릿을 따른다.
  - 형식: `<gitmoji> <유형>: <제목>`
  - 유형: ✨ feat, 🐛 fix, 📝 docs, 🎨 style, ♻️ refactor, ✅ test, 📦️ deps, 🔧 config, 🚚 rename, 💬 chore
  - 제목은 마침표 없는 명사구로 50자 이내, 본문은 한 줄 72자 이내로 무엇을 왜 어떻게 했는지 쓴다.
- 커밋은 성격별로 나눈다 (예: 의존성 추가, 설정 변경, 기능별 변경).
- 기능 작업은 `feature/<이름>` 브랜치에서 하고 `main`에 merge commit으로 합친다.
- 커밋과 푸시는 사용자가 요청할 때만 한다. 히스토리를 다시 쓰기 전에는 원격에 푸시되었는지 확인한다.

## 알려진 문제

- `pnpm preview`로는 화면이 뜨지 않는다 (base 경로가 build에만 적용됨). 빌드 결과는 `build/`를 `/focus-timer/` 아래에서 서빙하는 정적 서버로 확인한다.
- 콘솔의 `/favicon.ico` 404는 SSR을 꺼서 favicon `<link>`가 늦게 붙기 때문이며 동작에는 영향이 없다.

## 검증 방법

저장소에는 테스트 도구가 없어서 저장소 밖 임시 폴더에서 검증한다. 저장소에 테스트 도구를 추가하려면 먼저 사용자에게 묻는다.

- **로직**: `src/lib/timer/*.ts`(`.svelte.ts` 제외)를 `"type": "module"`인 임시 폴더로 복사하고, import 확장자를 `.ts`로 바꿔 `node --test`로 실행한다.
- **저장**: `fake-indexeddb/auto`로 `database.ts`, `storage.ts`를 시험한다. 열린 BroadcastChannel 때문에 `node --test --test-force-exit <파일>`로 실행한다.
- **화면**: `playwright-core`로 로컬 Chrome(`channel: "chrome"`)을 띄운다. 시간 초과는 `page.clock`으로 만들되 가짜 시계도 조금씩 흐르므로 오차를 둔다. 여러 탭은 같은 `context`의 페이지 두 개로, 동기화가 늦은 탭은 `addInitScript`로 `window.BroadcastChannel`을 없애 흉내 낸다. 여러 화면 크기에서 스크린샷을 찍는다.
