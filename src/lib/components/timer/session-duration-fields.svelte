<script lang="ts">
  import {
    DURATION_LIMITS,
    getDefaultBreakMinutes,
    type SessionPlan,
    type SessionPlanPatch,
  } from "#lib/timer/model.js";
  import DurationField from "./duration-field.svelte";

  interface Props {
    /** 입력란 id 앞에 붙일 값. `<idPrefix>-focus-minutes`, `<idPrefix>-break-minutes`가 된다. */
    idPrefix: string;
    session: SessionPlan;
    onChange: (patch: SessionPlanPatch) => void;
  }

  let { idPrefix, session, onChange }: Props = $props();
</script>

<!-- 대기 화면의 계획과 휴식 화면의 "다음 세션"이 같은 입력란을 쓰도록 한곳에 모았다.
     감싸는 요소 없이 입력란 두 개만 그린다. 부모의 grid에 바로 들어간다. -->
<DurationField
  id="{idPrefix}-focus-minutes"
  label="집중 시간"
  value={session.focusMinutes}
  min={DURATION_LIMITS.focus.min}
  max={DURATION_LIMITS.focus.max}
  step={5}
  onValueChange={(focusMinutes) => onChange({ focusMinutes })}
/>
<DurationField
  id="{idPrefix}-break-minutes"
  label="휴식 시간"
  value={session.breakMinutes}
  min={DURATION_LIMITS.break.min}
  max={DURATION_LIMITS.break.max}
  step={5}
  defaultValue={getDefaultBreakMinutes(session.focusMinutes)}
  onValueChange={(breakMinutes) => onChange({ breakMinutes })}
/>
