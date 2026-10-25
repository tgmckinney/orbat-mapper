import { injectStrict } from "@/utils";
import { activeScenarioKey } from "@/components/injects";
import { useGeoStore } from "@/stores/geoStore";
import type { EntityId } from "@/types/base";
import type { ScenarioEventAction } from "@/types/constants";
import type { GeometryWhere } from "@/types/scenarioModels";

/**
 * A scenario event's `where` that frames the given map view.
 *
 * Stored as the view's bounding box polygon, so it uses the existing `where` format and
 * every ORBAT Mapper build plays it back: going to the event fits the map to the box.
 * Bearing and pitch are not kept.
 */
export function whereFromViewBbox(bbox: [number, number, number, number]): GeometryWhere {
  const [w, s, e, n] = bbox.map((v) => Math.round(v * 1e6) / 1e6);
  return {
    type: "geometry",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
    mapAnimation: "flyTo",
  };
}

/** Handles the event menu's camera actions; returns false for any other action. */
export function useEventCameraActions() {
  const {
    time: { updateScenarioEvent },
  } = injectStrict(activeScenarioKey);
  const geoStore = useGeoStore();

  return function onCameraAction(
    action: ScenarioEventAction,
    eventId: EntityId,
  ): boolean {
    if (action === "setCamera") {
      const bbox = geoStore.getMapViewBbox();
      if (bbox) updateScenarioEvent(eventId, { where: whereFromViewBbox(bbox) });
      return true;
    }
    if (action === "clearCamera") {
      updateScenarioEvent(eventId, { where: undefined });
      return true;
    }
    return false;
  };
}
