# CLAUDE.md

이 저장소에서 작업하는 LLM 에이전트가 새 세션에서도 알고 있어야 할 내용이다.
코드나 결정 사항이 바뀌면 이 파일도 함께 고친다.

## 프로젝트 개요

- 집중 세션과 휴식 세션으로 이루어진 집중 타이머 웹 앱. 설정한 시간이 지나도 자동으로 넘어가지 않고, 진행 시간을 위로 세며 초과 여부를 보여 준다.
- 대기 화면에서 여러 세션을 한 번에 계획한다. "세션"은 집중 세션과 휴식 세션 한 쌍이며, "세션 1 집중 → 세션 1 휴식 → 세션 2 집중 → …" 순서로 진행한다.
- 한 페이지(`src/routes/+page.svelte`) 안에서 상태에 따라 화면만 바꾼다. 상태가 바뀌어도 페이지를 이동하지 않는다.
- GitHub Pages 프로젝트 사이트로 배포한다. 빌드할 때만 base 경로가 `/focus-timer`이다 (`vite.config.ts`).
- 다크 모드 고정 (`src/app.html`의 `<html class="dark">`). 라이트 모드는 아직 구현하지 않는다.
- 모바일, 태블릿, 데스크톱, 높이가 낮은 가로 화면에 모두 대응해야 한다.
- UI 문구, 코드 주석, 커밋 메시지는 한국어로 쓴다.

현재 상태 (2026-10-24): MVP가 `feature/mvp`에서 `main`으로 머지되었다. `feature/multiple-plan`에서 여러 세션 계획 기능을 구현했다 (아직 `main`에 머지하지 않음).

## 명령어

```sh
pnpm dev      # 개발 서버
pnpm build    # 정적 빌드 (build/)
pnpm check    # svelte-check 타입 검사
pnpm lint     # prettier --check .
pnpm format   # prettier --write .
```

작업을 마치면 `pnpm check`, `pnpm lint`, `pnpm build`가 모두 통과해야 한다. 테스트 러너는 없다 (아래 "검증 방법" 참고).

## 기술 스택과 주의할 점

예전 지식과 다른 최신 버전이 많다. 확신이 없으면 `node_modules`의 타입 정의를 직접 확인한다.

- **SvelteKit 3.1**: 설정이 `svelte.config.js`가 아니라 `vite.config.ts`의 `sveltekit({...})` 플러그인 옵션에 있다. `$app/environment`는 `$app/env`로 바뀌었다.
- **Svelte 5.57**: runes 모드 강제. 쓰기 가능한 `$derived`와 함수 바인딩(`bind:value={() => get, (v) => set}`)을 쓴다.
- **경로 별칭**: `$lib`가 아니라 `package.json`의 `imports`에 정의한 `#lib`를 쓴다. `#lib/timer/model.js`처럼 `.js` 확장자로 import한다 (`.svelte.ts` 파일은 `.svelte.js`).
- **Tailwind CSS 4**: 설정 파일 없이 `src/routes/layout.css`에서 테마를 정의한다.
- **shadcn-svelte 1.7**: style `nova`, baseColor `taupe`, bits-ui 2 기반. 아이콘은 `@lucide/svelte/icons/<이름>`으로 하나씩 import한다.
- **`cn`**: `clsx` + `tailwind-merge` 대신 `cn` 패키지를 쓴다. `#lib/utils.js`에서 다시 내보낸다.
- TypeScript 6, Vite 8, pnpm 12, Node 24.
- **pnpm 12 자동 동기화**: `pnpm exec` 등을 실행하면 lockfile에 맞춰 `node_modules`를 자동으로 고친다. 예전 커밋을 체크아웃한 채로 pnpm 명령을 실행했다면 돌아온 뒤 `pnpm install`을 실행한다.

## 디렉터리 구조

```
src/
  app.html                    # html.dark, color-scheme/theme-color 메타
  routes/
    +layout.ts                # ssr = false, prerender = true
    +layout.svelte            # layout.css, favicon
    +page.svelte              # FocusTimer 생성, connect(), 탭 제목, 화면 전환, 초점 이동
    layout.css                # 테마, 세션 색상 토큰, short: 변형
  lib/
    timer/
      model.ts                # 자료구조, 상수, 순수 상태 전이 함수
      storage.ts              # localStorage 저장/불러오기/검증/버전 1 이전
      format.ts               # m:ss, 스크린 리더용 "12분 3초"
      focus-timer.svelte.ts   # 반응형 상태 클래스 FocusTimer
    components/
      timer/                  # 앱 컴포넌트
        idle-view.svelte              # 대기 화면 (제목, 계획 목록, 요약, 시작 버튼)
        plan-list.svelte              # 계획 목록, 세션 추가/삭제, 끌어서 순서 바꾸기
        plan-item.svelte              # 계획 목록의 세션 하나 (손잡이, 삭제, 입력란)
        add-session-button.svelte     # 목록 사이의 "세션 추가" 버튼
        goal-field.svelte             # 집중 목표 입력란
        duration-field.svelte         # 분 입력 + -/+ 버튼
        session-view.svelte           # 집중/휴식 공용 화면
        break-overview.svelte         # 휴식 화면의 지난 집중/다음 세션 영역
        session-progress.svelte       # 하단 진행 바와 남은/초과 시간
        discard-session-dialog.svelte # 세션 폐기 확인 창
      ui/                     # shadcn-svelte가 생성한 컴포넌트
```

## 상태 모델 (`src/lib/timer/model.ts`)

- 앱 상태는 대기(`idle`), 집중 세션(`focus`), 휴식 세션(`break`) 세 가지다. `getStatus(state)`는 `state.active?.current.kind ?? "idle"`이다.
- 용어: "세션"은 집중-휴식 한 쌍(`SessionPlan`)이고, 실제로 진행한 집중 또는 휴식 하나는 `SessionRecord`다.
- `TimerState = { plan, active }`
  - `plan: SessionPlan[]`: 대기 화면에서 계획한 세션 목록. 항상 하나 이상이다.
  - `active: ActivePlan | null`: 진행 중인 계획. `null`이면 대기 상태.
- `SessionPlan = { id, goal, focusMinutes, breakMinutes }`. `id`는 목록 안에서만 겹치지 않는 양의 정수이고 순서와 관계없다. 새 세션은 `max(id) + 1`이다.
- `ActivePlan = { sessions, index, finished, current }`
  - `sessions`: 시작할 때 `plan`을 복사해 둔다 (goal은 trim, 분은 범위 안으로). 진행 중에 고쳐도 대기 화면의 `plan`은 바뀌지 않는다.
  - `index`: 지금 진행 중인 세션의 위치.
  - 끝난 집중/휴식은 `finished`에 시간순으로 쌓고, 진행 중인 것은 `current`에 둔다.
- `SessionRecord = { kind, startedAt, endedAt | null, pauses }`, `PauseRecord = { startedAt, endedAt | null }`. 열린 일시정지는 마지막 하나만 있을 수 있다.
- **시각 기록**: 모든 시각은 `Date.now()` 밀리초다. 진행 시간은 `(endedAt ?? now) - startedAt - 일시정지 구간 합`으로 계산하므로, 새로고침하거나 브라우저를 다시 열어도 같은 값이 나온다.
- **전이 함수**: 순수 함수이고 원본을 바꾸지 않는다. 할 수 없는 전이는 같은 객체를 돌려준다.
  - 계획 고치기: `updatePlannedSession(state, id, patch)`, `insertPlannedSession(state, index)`(목표는 비우고 시간은 바로 앞, 맨 앞이면 바로 뒤 세션을 따른다), `removePlannedSession(state, id)`(하나 남으면 지우지 않는다), `movePlannedSession(state, id, to)`
  - `startPlan`
  - `pause`, `resume`
  - `switchSession(state, kind, now)`: 현재 집중/휴식을 끝내 `finished`에 넣고 새로 시작한다. 열린 일시정지는 닫는다. 집중 → 같은 세션의 휴식, 휴식 → 다음 세션의 집중(`index + 1`, 이때 그 세션의 goal을 trim). 마지막 세션의 휴식에서는 집중으로 넘어갈 수 없다.
  - `updateNextSession(state, patch)`: 휴식 중에만 다음 세션(`index + 1`)을 고친다.
  - `completePlan`: 휴식 중에만 동작한다. 마지막 세션이 아니면 남은 세션을 건너뛰고 끝낸다.
  - `discardPlan`
- 조회 함수: `getCurrentSession`, `getNextSession`, `isLastSession`, `getPlannedMs`, `getLastFocusRecord`, `getElapsedMs`, `isPaused`
- **상수**:
  - `DURATION_LIMITS`: 집중 5–300분, 휴식 1–120분
  - `DEFAULT_SESSION`: 목표 없음, 집중 25분, 휴식 5분
  - `GOAL_MAX_LENGTH`: 100

## FocusTimer (`src/lib/timer/focus-timer.svelte.ts`)

- 불변 상태를 `$state.raw`로 들고 있다. 상태는 반드시 메서드를 거쳐 model.ts의 전이 함수로만 바꾼다. 바꿀 때마다 저장소에 기록한다.
  - 계획: `addSession(index)`, `removeSession(id)`, `moveSession(id, to)`, `updateSession(id, patch)`
  - 진행: `start`, `togglePause`, `startBreak`, `startFocus`, `updateNextSession(patch)`, `complete`, `discard`
- `elapsedMs`는 `#now`와 상태에서 계산하는 `$derived`다.
- `connect()`는 컴포넌트의 `$effect` 안에서 호출한다 (`$effect(() => timer.connect())`). 하는 일은 세 가지다.
  - 다른 탭에서 바뀐 상태를 `storage` 이벤트로 받아 온다.
  - 세션이 흘러가는 동안에만 다음 초 경계에 맞춘 `setTimeout`으로 `#now`를 갱신한다. 대기나 일시정지 중에는 타이머가 없다.
  - 탭이 다시 보이면(`visibilitychange`) 바로 갱신한다.

## 저장 (`src/lib/timer/storage.ts`)

- localStorage 키는 `focus-timer:state`, 값은 `{ version: 2, plan, active }`이다.
- 버전 1(`{ settings: { goal, focusMinutes, breakMinutes }, active: { goal, focusMinutes, breakMinutes, finished, current } }`)은 세션 하나짜리 계획으로 바꿔 불러온다. 진행 중이던 세트도 `index: 0`으로 이어진다.
- 불러올 때 모양을 검사한다.
  - `plan`이 비어 있거나 깨져 있으면 초기 상태로 되돌린다.
  - `active`만 깨져 있으면 `plan`은 살린다.
  - 범위를 벗어난 분 값은 범위 안으로 맞춘다.
  - 세션 `id`가 없거나 겹치면 1부터 다시 매긴다.
- 저장 실패(용량 초과, 접근 차단)는 무시하고 메모리에서만 유지한다. 저장소에 접근할 때는 `getBrowserStorage()`를 쓴다.
- 저장 구조를 바꾸면 `version`을 올리고 검증과 이전 데이터 처리를 함께 고친다.

## 확정된 동작 (사용자와 합의한 명세)

**대기 화면**

- Card 컴포넌트 없이 화면 가운데에 배치한다: 제목, 설명, 세션 계획 목록, (세션이 둘 이상이면) "세션 N개 · 집중 N분 · 휴식 N분" 요약, "집중 시작" 버튼. Enter로 폼을 제출해도 시작된다.
- 세션 계획 목록
  - 처음에는 세션 하나만 있다. 세션마다 테두리 상자 안에 "세션 N" 제목, 집중 목표, 집중 시간, 휴식 시간을 둔다.
  - 목록의 맨 앞, 맨 뒤, 세션 사이마다 "세션 추가" 버튼이 있다. 새 세션은 목표가 비어 있고 시간은 이웃 세션을 따른다. 추가하면 새 세션의 목표 입력란에 초점을 준다.
  - 세션이 둘 이상이면 세션마다 왼쪽에 순서 바꾸기 손잡이, 오른쪽에 삭제 버튼(확인 없음)을 표시한다. 삭제하면 그 자리의 "세션 추가" 버튼에 초점을 준다.
  - 손잡이를 끌어서 순서를 바꾼다 (마우스, 터치). 끄는 동안 "세션 추가" 버튼을 감추고, 화면 가장자리로 끌면 자동으로 스크롤한다. Esc를 누르면 취소한다. 손잡이에 초점이 있을 때 위/아래 화살표 키로도 옮길 수 있고, 결과를 `aria-live`로 알린다.
  - "세션 N" 번호는 목록의 순서다.
- 집중 목표는 선택 입력이고 최대 100자다.
- 시간 입력
  - 집중 시간: -/+ 버튼은 5분 단위이고, 단위에 맞춰 스냅한다 (23 → 25, 23 → 20).
  - 휴식 시간: -/+ 버튼은 1분 단위다.
  - 값이 최소·최대에 닿은 -/+ 버튼은 `disabled` 대신 `aria-disabled`로 표시한다. 흐려지지 않고 초점도 유지되며, 눌러도 값은 바뀌지 않는다. (휴식 화면의 "다음 세션" 입력란도 같은 `DurationField`를 쓴다.)
  - 범위를 벗어나게 입력하면 `aria-invalid`를 표시하고, 브라우저 기본 검증으로 시작을 막는다.
  - 입력란을 벗어나면(blur) 범위 안으로 맞추고, 빈 값은 원래 값으로 되돌린다.
- 대기 화면의 계획(목표 포함)은 저장되며, 계획을 완료하거나 폐기해도 그대로 남는다. 휴식 중에 다음 세션을 고친 내용은 대기 화면의 계획에 반영하지 않는다.

**집중 화면**

- 가운데:
  - "집중 세션" 라벨. 세션이 둘 이상이면 옆에 `2/3`처럼 순서를 표시한다 (스크린 리더용 "세션 3개 중 2번째").
  - 진행 시간 `m:ss`. 위로 세며, 60분을 넘기면 `75:03`처럼 표시한다.
  - 목표
  - "집중 시간 N분"
  - 일시정지/재개 버튼, "휴식 시작" 버튼
- 오른쪽 위: "세션 폐기". 확인 창(AlertDialog)에서 "폐기"를 눌러야만 대기 상태로 돌아간다. 취소나 Esc를 누르면 세션이 그대로 이어진다.

**휴식 화면**

- 가운데:
  - "휴식 세션" 라벨 (세션이 둘 이상이면 `2/3`)
  - 진행 시간 `m:ss`
  - "휴식 시간 N분"
  - 일시정지/재개 버튼, "집중 시작" 버튼. 마지막 세션의 휴식에서는 "집중 시작" 대신 "세션 완료"를 표시한다.
  - "지난 집중" 영역: 첫 줄은 `지난 집중 · 52:15 / 50분 (105%)`(진행 시간 / 설정한 집중 시간 (비율)), 그 아래에 목표. 비율은 초 단위로 내린 진행 시간으로 계산해 5% 단위로 반올림한다 (102.5% → 105%). 스크린 리더에는 "52분 15초 진행, 설정한 50분의 105%"로 읽힌다.
  - "다음 세션" 영역(마지막 세션이 아닐 때): 다음 세션의 집중 목표, 집중 시간, 휴식 시간을 고칠 수 있다.
  - 두 영역은 테두리 없이 표시한다. "다음 세션"이 있으면 왼쪽 정렬, "지난 집중"만 있으면(마지막 휴식) 가운데 정렬이다.
  - 높이가 낮은 가로 화면에서는 두 영역을 타이머 오른쪽에 둔다.
- 오른쪽 위: "세션 폐기" 대신 "세션 완료"를 표시한다 (남은 세션을 건너뛰고 끝낸다). 마지막 세션의 휴식에서는 가운데 버튼과 겹치므로 표시하지 않는다. 휴식 중에는 폐기할 수 없다.

**버튼 동작**

- "집중 시작"(휴식 중): 다음 세션의 집중을 시작한다. 끝난 집중/휴식은 `finished`에 쌓인다.
- "세션 완료": 지금은 대기 상태로 돌아가기만 한다. 나중에 완료한 계획을 기록하는 등의 동작을 붙일 예정이다.

**진행 바**

- 진행률은 `경과 / 설정 시간`이며 최대 100%다.
- 화면의 초 단위와 맞추려고 초 단위로 내림해서 비교한다. 경과 초가 설정 초보다 크면 초과 상태다.
- 색: 집중은 파랑(`session-focus`), 휴식은 초록(`session-break`), 초과는 주황(`session-overtime`).
- 캡션: 평소에는 "남은 시간 m:ss", 초과하면 "초과 시간 +m:ss".

**기타**

- 일시정지 중에는 숫자를 흐리게 하고 `motion-safe` pulse를 적용하며, "· 일시정지됨"을 표시한다 (`aria-live`).
- 탭 제목: 세션 중에는 `12:34 집중 · 집중 타이머`(일시정지 중이면 `(일시정지)`가 붙는다), 대기 중에는 `집중 타이머`.
- 같은 브라우저의 여러 탭은 서로 동기화된다.
- 초점 관리
  - 처음 열 때는 초점을 건드리지 않는다.
  - 화면이 바뀐 뒤에는 대기 화면에서 "집중 시작" 버튼, 세션 화면에서 일시정지 버튼에 초점을 준다.
  - 집중과 휴식은 같은 `SessionView`로 그리므로, "휴식 시작"을 누르면 초점이 같은 자리의 "집중 시작"(마지막 세션이면 "세션 완료") 버튼에 남는다.
  - 끌어서 순서를 바꾸면 항목의 DOM 위치가 바뀌어 초점이 풀릴 수 있으므로, 옮긴 뒤 원래 초점을 되돌린다.

## 렌더링과 빌드

- `src/routes/+layout.ts`
  - `ssr = false`: 상태가 브라우저에만 있어서 서버에서 그릴 내용이 없다. 저장된 상태를 불러오기 전에 대기 화면이 잠깐 보이는 현상도 막는다.
  - `prerender = true`: 빌드할 때 빈 앱 셸을 `index.html`로 만든다. 이게 없으면 GitHub Pages가 첫 화면을 404 상태 코드와 함께 응답한다.
- `@sveltejs/adapter-static`의 `fallback: "404.html"`이 미리 렌더링하지 않은 경로를 처리한다.

## 스타일 규칙

- 세션 색상 토큰은 `layout.css`에 있다.
  - `--session-focus`, `--session-break`, `--session-overtime`: `:root`와 `.dark`에 정의한다.
  - `@theme inline`의 `--color-session-*`: 이 덕분에 `bg-session-focus`, `text-session-overtime` 같은 클래스를 쓸 수 있다.
- `short:` 커스텀 변형은 `@media (max-height: 32rem)`이다. 가로로 돌린 휴대폰처럼 높이가 낮은 화면에서 세로 공간을 줄일 때 쓴다.
- 한국어 문장에는 단어 중간 줄바꿈을 막도록 `break-keep`을 쓴다. 숫자에는 `tabular-nums`를 쓴다.
- Progress 막대 색은 생성된 컴포넌트를 고치지 않고 부모에서 `*:data-[slot=progress-indicator]:bg-...`로 바꾼다.
- `layout.css`의 Pretendard 폰트 import는 사용자가 주석 처리해 둔 것이므로 건드리지 않는다.

## 코딩 규칙

- 들여쓰기는 공백 2칸이다 (Prettier 기본값, `.zed/settings.json`). Prettier는 svelte, tailwindcss 플러그인을 쓰며 클래스 순서를 자동으로 정렬한다.
- 파일 이름은 kebab-case로 짓는다. 앱 컴포넌트는 `src/lib/components/<기능>/`에, 로직은 `src/lib/<기능>/`에 둔다.
- shadcn-svelte가 생성한 컴포넌트(`src/lib/components/ui/`)는 되도록 고치지 않고, props와 class로 조정한다.
- 화면 컴포넌트에는 `timer` 객체를 prop으로 넘기고, 컴포넌트는 그 메서드를 호출한다.
- 끌어서 순서 바꾸기는 라이브러리 없이 Pointer Events로 구현했다 (`plan-list.svelte`). 끄는 동안에는 `transform`으로 보이는 위치만 옮기고, 놓을 때 제자리로 미끄러지는 애니메이션(150ms, `prefers-reduced-motion`이면 생략) 뒤에 한 번만 상태를 바꾼다. 손잡이에는 `touch-none`을 붙인다.
- 목표 입력값은 받은 그대로 저장한다. 바로 trim하거나 잘라서 다시 쓰면 한글 IME 조합이 깨진다. trim은 세트를 시작할 때 한다.
- 접근성
  - 타이머에는 `role="timer"`, 진행 바에는 `aria-label`과 한국어 `aria-valuetext`를 붙인다.
  - 상태 문구에는 `aria-live`를 쓴다.
  - 아이콘 버튼에는 `aria-label`을 붙인다. 같은 글자의 버튼이 여러 개면 `aria-label`로 구분하되 보이는 글자를 포함한다 (예: "맨 앞에 세션 추가").
  - 상태를 색으로만 구분하지 않고 글자로도 표시한다.

## shadcn-svelte CLI

- 컴포넌트는 `pnpm exec shadcn-svelte add <컴포넌트> -y`로 추가한다. 생성된 파일은 탭 들여쓰기이므로, 추가한 뒤 `pnpm exec prettier --write src/lib/components/ui`를 실행한다.
- 이미 있는 파일(예: button)과 겹치면 CLI가 대화형으로 물어보다가 멈춘다. 이때는 `-o`로 덮어쓰고 prettier로 포매팅한 뒤, `git diff`로 기존 파일이 실제로 바뀌지 않았는지 확인한다.
- 설치된 컴포넌트: alert-dialog, button, field, input, input-group, label, progress, separator, textarea. card는 쓰지 않기로 해서 제거했다.

## Git 규칙

- 커밋 메시지는 `.gitmessage.txt` 템플릿을 따른다.
  - 형식: `<gitmoji> <유형>: <제목>`
  - 유형: ✨ feat, 🐛 fix, 📝 docs, 🎨 style, ♻️ refactor, ✅ test, 📦️ deps, 🔧 config, 🚚 rename, 💬 chore
  - 제목: 명사구로 쓰고, 마침표 없이 50자 이내로 한다.
  - 본문: 한 줄을 72자 이내로 하고, 무엇을 왜 어떻게 했는지 쓴다.
- 커밋은 성격별로 나눈다. 예: 의존성 추가, 설정 변경, 기능별 변경을 각각 커밋한다.
- 기능 작업은 `feature/<이름>` 브랜치에서 하고, `main`에 merge commit으로 합친다.
- 커밋과 푸시는 사용자가 요청할 때만 한다. 히스토리를 다시 쓰기 전에는 원격에 푸시되었는지 먼저 확인한다.

## 알려진 문제

- `pnpm preview`로는 화면이 뜨지 않는다. `vite.config.ts`가 base(`/focus-timer`)를 build에만 적용해서 에셋 경로가 어긋나기 때문이다. 프로덕션 빌드는 `build/`를 `/focus-timer/` 경로 아래에서 서빙하는 정적 서버로 확인한다.
- 브라우저 콘솔에 `/favicon.ico` 404가 찍힌다. SSR이 꺼져 있어 favicon `<link>`가 JS로 늦게 붙고, 그 전에 Chrome이 루트의 favicon을 요청하기 때문이다. 동작에는 영향이 없다.

## 검증 방법

저장소에는 테스트 도구가 없다. 지금까지는 저장소 밖 임시 폴더에서 다음과 같이 검증했다. 저장소에 테스트 도구를 추가하려면 먼저 사용자에게 묻는다.

- **로직**: `src/lib/timer/*.ts`를 임시 폴더로 복사하고 import 확장자를 `.js`에서 `.ts`로 바꾼 뒤 `node --test`로 실행한다. Node 24는 TypeScript를 바로 실행할 수 있다.
- **화면**:
  - 임시 폴더에 설치한 `playwright-core`로 로컬 Chrome(`channel: "chrome"`)을 띄운다.
  - `page.clock`으로 가짜 시간을 흘려 시간 초과 같은 상황을 확인한다.
  - 여러 화면 크기에서 스크린샷을 찍어 레이아웃을 확인한다.
