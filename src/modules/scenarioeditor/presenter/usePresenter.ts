import { computed, ref } from "vue";
import type { EntityId } from "@/types/base";
import type { NScenarioEvent } from "@/types/internalModels";

export interface PresenterScenario {
  state: {
    events: EntityId[];
    eventMap: Record<EntityId, NScenarioEvent>;
    currentTime: number;
  };
  setCurrentTime: (timestamp: number) => void;
  goToScenarioEvent: (event: NScenarioEvent) => void;
}

export interface PresenterOptions {
  /** How long the clock runs from one event to the next, in ms. 0 jumps straight there. */
  transitionMs?: number;
  /** Next animation frame; injectable for tests. */
  frame?: () => Promise<number>;
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/**
 * Steps through a scenario's events in order, one at a time.
 *
 * Unlike the toolbar's next/previous event buttons, which look for the first event
 * strictly later or earlier than the current time, this walks the event list by
 * position, so events that share a start time are each shown. Moving forward runs the
 * clock to the next event, so units move on the map, and then goes to the event, which
 * moves the camera to its `where`.
 */
export function usePresenter(
  scenario: PresenterScenario,
  options: PresenterOptions = {},
) {
  const { transitionMs = 1200, frame = nextFrame } = options;
  const index = ref(-1);
  const busy = ref(false);
  let generation = 0;

  const events = computed(() =>
    scenario.state.events.map((id) => scenario.state.eventMap[id]),
  );
  const current = computed(() => events.value[index.value] ?? null);
  const count = computed(() => events.value.length);
  const atEnd = computed(() => index.value >= count.value - 1);

  /** Pick up from the current time: the last event at or before it, or none. */
  function sync() {
    const t = scenario.state.currentTime;
    let found = -1;
    events.value.forEach((ev, i) => {
      if (ev.startTime <= t) found = i;
    });
    index.value = found;
  }

  async function runClock(to: number, run: number) {
    const from = scenario.state.currentTime;
    if (transitionMs <= 0 || to <= from) return;
    const started = await frame();
    for (let now = started; now - started < transitionMs; now = await frame()) {
      if (run !== generation) return;
      scenario.setCurrentTime(
        from + (to - from) * easeInOut((now - started) / transitionMs),
      );
    }
  }

  async function show(i: number, animate: boolean) {
    const ev = events.value[i];
    if (!ev) return false;
    const run = ++generation;
    busy.value = true;
    try {
      if (animate) await runClock(ev.startTime, run);
      if (run !== generation) return false;
      scenario.goToScenarioEvent(ev);
      index.value = i;
      return true;
    } finally {
      if (run === generation) busy.value = false;
    }
  }

  const next = () => show(index.value + 1, true);
  const prev = () =>
    index.value > 0 ? show(index.value - 1, false) : Promise.resolve(false);
  const goTo = (i: number) => show(i, i === index.value + 1);

  /** Stop any clock transition in progress. */
  function cancel() {
    generation++;
    busy.value = false;
  }

  return { index, current, count, atEnd, busy, events, sync, next, prev, goTo, cancel };
}
