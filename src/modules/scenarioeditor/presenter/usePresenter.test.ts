import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { NScenarioEvent } from "@/types/internalModels";
import { usePresenter, type PresenterScenario } from "./usePresenter";

function scenario(times: number[], currentTime = 0) {
  const eventMap: Record<string, NScenarioEvent> = {};
  times.forEach((t, i) => {
    eventMap[`e${i}`] = { id: `e${i}`, title: `E${i}`, startTime: t, _type: "scenario" };
  });
  const state = reactive({ events: Object.keys(eventMap), eventMap, currentTime });
  const sc: PresenterScenario = {
    state,
    setCurrentTime: vi.fn((t: number) => {
      state.currentTime = t;
    }),
    goToScenarioEvent: vi.fn((ev: NScenarioEvent) => {
      state.currentTime = ev.startTime as number;
    }),
  };
  return sc;
}

// A fake clock: every frame is 100 ms after the last.
function frames() {
  let now = 0;
  return () => Promise.resolve((now += 100));
}

describe("usePresenter", () => {
  it("visits events that share a start time one by one", async () => {
    const sc = scenario([10, 20, 20, 30]);
    const p = usePresenter(sc, { transitionMs: 0 });
    p.sync();
    expect(p.index.value).toBe(-1);
    for (const expected of ["e0", "e1", "e2", "e3"]) {
      expect(await p.next()).toBe(true);
      expect(p.current.value?.id).toBe(expected);
    }
    expect(p.atEnd.value).toBe(true);
    expect(await p.next()).toBe(false);
    expect(p.current.value?.id).toBe("e3");
  });

  it("picks up at the last event at or before the current time", () => {
    const p = usePresenter(scenario([10, 20, 30], 25), { transitionMs: 0 });
    p.sync();
    expect(p.current.value?.id).toBe("e1");
  });

  it("runs the clock forward before going to the next event", async () => {
    const sc = scenario([0, 1000]);
    const p = usePresenter(sc, { transitionMs: 500, frame: frames() });
    await p.next();
    await p.next();
    const times = vi.mocked(sc.setCurrentTime).mock.calls.map(([t]) => t);
    expect(times.length).toBeGreaterThan(2);
    expect(times.every((t, i) => i === 0 || t >= times[i - 1])).toBe(true);
    expect(sc.goToScenarioEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "e1" }),
    );
    expect(sc.state.currentTime).toBe(1000);
  });

  it("steps back without running the clock and stops at the first event", async () => {
    const sc = scenario([0, 1000, 2000], 2000);
    const p = usePresenter(sc, { transitionMs: 500, frame: frames() });
    p.sync();
    await p.prev();
    expect(p.current.value?.id).toBe("e1");
    expect(sc.setCurrentTime).not.toHaveBeenCalled();
    await p.prev();
    expect(await p.prev()).toBe(false);
    expect(p.index.value).toBe(0);
  });

  it("cancel abandons a transition in progress", async () => {
    const sc = scenario([0, 1000]);
    let release: (n: number) => void = () => {};
    const p = usePresenter(sc, {
      transitionMs: 500,
      frame: () => new Promise((r) => (release = r)),
    });
    const moving = p.next();
    p.cancel();
    release(0);
    expect(await moving).toBe(false);
    expect(sc.goToScenarioEvent).not.toHaveBeenCalled();
    expect(p.busy.value).toBe(false);
  });
});
