import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import {
  MAX_RECORDING_SECONDS,
  pickRecordingMimeType,
  RECORDING_BITRATE,
} from "@/modules/scenarioeditor/narration/narration";

export type RecorderState = "idle" | "requesting" | "recording" | "recorded";

/** Records one clip from the microphone with MediaRecorder. */
export function useNarrationRecorder() {
  const state = ref<RecorderState>("idle");
  const elapsed = ref(0);
  const blob = shallowRef<Blob | null>(null);
  const previewUrl = ref<string | null>(null);
  const error = ref("");
  const isSupported =
    typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;

  function releaseMic() {
    if (ticker) clearInterval(ticker);
    ticker = undefined;
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
  }

  function clearClip() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
    blob.value = null;
    elapsed.value = 0;
  }

  async function start() {
    if (!isSupported || state.value === "recording") return;
    error.value = "";
    clearClip();
    state.value = "requesting";
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      state.value = "idle";
      error.value =
        (e as DOMException)?.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in the browser's site settings."
          : "No microphone is available.";
      return;
    }
    const mimeType = pickRecordingMimeType();
    recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: RECORDING_BITRATE,
    });
    chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      releaseMic();
      elapsed.value = (performance.now() - startedAt) / 1000;
      const clip = new Blob(chunks, {
        type: recorder?.mimeType || mimeType || "audio/webm",
      });
      chunks = [];
      if (!clip.size) {
        state.value = "idle";
        error.value = "Nothing was recorded.";
        return;
      }
      blob.value = clip;
      previewUrl.value = URL.createObjectURL(clip);
      state.value = "recorded";
    };
    startedAt = performance.now();
    elapsed.value = 0;
    recorder.start(1000);
    state.value = "recording";
    ticker = setInterval(() => {
      elapsed.value = (performance.now() - startedAt) / 1000;
      if (elapsed.value >= MAX_RECORDING_SECONDS) stop();
    }, 250);
  }

  function stop() {
    if (recorder?.state === "recording") recorder.stop();
  }

  function discard() {
    if (recorder?.state === "recording") {
      recorder.onstop = null;
      recorder.stop();
    }
    releaseMic();
    clearClip();
    state.value = "idle";
  }

  onBeforeUnmount(discard);

  return {
    state,
    elapsed,
    blob,
    previewUrl,
    error,
    isSupported,
    isBusy: computed(() => state.value === "requesting" || state.value === "recording"),
    start,
    stop,
    discard,
  };
}
