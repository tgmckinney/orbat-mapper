import { describe, expect, it } from "vitest";
import { useNewScenarioStore } from "@/scenariostore/newScenarioStore";
import { useScenarioTime } from "@/scenariostore/time";
import { whereFromViewBbox } from "./eventCamera";

describe("whereFromViewBbox", () => {
  it("frames the view as a closed polygon in the existing where format", () => {
    const where = whereFromViewBbox([127.1234567, 26.1, 127.9, 26.8]);
    expect(where.type).toBe("geometry");
    expect(where.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [127.123457, 26.1],
          [127.9, 26.1],
          [127.9, 26.8],
          [127.123457, 26.8],
          [127.123457, 26.1],
        ],
      ],
    });
  });

  it("is set on an event and undone as one step", () => {
    const store = useNewScenarioStore({
      id: "s",
      type: "ORBAT-mapper",
      version: "2.5.0",
      name: "Scenario",
      startTime: 0,
      sides: [],
      events: [{ id: "e1", title: "E1", startTime: 0 }],
    });
    const time = useScenarioTime(store);
    time.updateScenarioEvent("e1", { where: whereFromViewBbox([0, 0, 1, 1]) });
    expect(store.state.eventMap.e1.where?.type).toBe("geometry");
    store.undo();
    expect(store.state.eventMap.e1.where).toBeUndefined();
  });
});
