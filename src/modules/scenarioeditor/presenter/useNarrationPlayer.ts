import { ref, watch, type Ref } from "vue";
import type { Narration } from "@/types/scenarioModels";

export interface NarrationPlayerOptions {
  muted: Ref<boolean>;
  /** Pause after a clip ends before it counts as finished. */
  gapMs?: number;
  createAudio?: () => HTMLAudioElement;
}

/**
 * Plays event narration in presenter mode, one clip at a time.
 *
 * `play()` returns a promise that settles when the clip has finished (plus a short
 * gap), was stopped, failed, or there was nothing to play, so auto-play can wait on it.
 */
export function useNarrationPlayer({
  muted,
  gapMs = 1000,
  createAudio = () => new Audio(),
}: NarrationPlayerOptions) {
  const playing = ref(false);
  const progress = ref(0);
  const clipDuration = ref<number | undefined>(undefined);

  let audio: HTMLAudioElement | undefined;
  let done: Promise<void> = Promise.resolve();
  let finish: (() => void) | undefined;
  let gapTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  function settle() {
    if (gapTimer) clearTimeout(gapTimer);
    gapTimer = undefined;
    finish?.();
    finish = undefined;
  }

  function stop() {
    if (audio) {
      audio.onended = audio.onerror = audio.ontimeupdate = null;
      audio.pause();
    }
    playing.value = false;
    progress.value = 0;
    settle();
  }

  function play(narration: Narration | undefined | null): Promise<void> {
    stop();
    clipDuration.value = narration?.duration;
    if (!narration?.url || muted.value) {
      done = Promise.resolve();
      return done;
    }
    const run = ++generation;
    const el = (audio ??= createAudio());
    done = new Promise<void>((resolve) => (finish = resolve));
    el.ontimeupdate = () => {
      const total = Number.isFinite(el.duration) ? el.duration : narration.duration;
      if (total) progress.value = Math.min(1, el.currentTime / total);
    };
    el.onended = () => {
      playing.value = false;
      progress.value = 1;
      gapTimer = setTimeout(settle, gapMs);
    };
    el.onerror = () => stop();
    el.src = narration.url;
    el.currentTime = 0;
    playing.value = true;
    Promise.resolve(el.play()).catch(() => {
      // Blocked or unplayable: carry on as if there were no clip.
      // A newer clip interrupting this one also lands here; leave that one alone.
      if (run === generation) stop();
    });
    return done;
  }

  /** Settles once whatever is playing now has finished, including clips started meanwhile. */
  async function settled(): Promise<void> {
    let current: Promise<void>;
    do {
      current = done;
      await current;
    } while (current !== done);
  }

  watch(muted, (m) => {
    if (m) stop();
  });

  return { playing, progress, clipDuration, play, stop, settled };
}
