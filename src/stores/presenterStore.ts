import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";

export const PRESENTER_DWELL_CHOICES = [5, 8, 12, 20, 30] as const;

export const usePresenterStore = defineStore("presenterStore", () => {
  const active = ref(false);
  const playing = ref(false);
  // Seconds an event stays on screen before auto-advance moves on.
  const dwellSeconds = useLocalStorage("presenterDwellSeconds", 8);
  const narrationMuted = useLocalStorage("presenterNarrationMuted", false);

  function start() {
    active.value = true;
    playing.value = false;
  }

  function stop() {
    active.value = false;
    playing.value = false;
  }

  function toggle() {
    if (active.value) stop();
    else start();
  }

  return { active, playing, dwellSeconds, narrationMuted, start, stop, toggle };
});
