import { UPLOAD_SECRET } from "@/composables/shareApi";

export const NARRATION_API_URL = "/media";
/** Recordings stop on their own after this many seconds. */
export const MAX_RECORDING_SECONDS = 300;
export const RECORDING_BITRATE = 48_000;

/** In order of preference: Opus where the browser records it, AAC (Safari) otherwise. */
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
];

export function pickRecordingMimeType(
  isTypeSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
): string | undefined {
  return RECORDING_MIME_TYPES.find((t) => isTypeSupported(t));
}

export interface StoredNarrationAudio {
  url: string;
  /** True when the clip went into the scenario file itself because no upload service answered. */
  embedded: boolean;
}

export class NarrationUploadError extends Error {}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Stores a narration clip and returns the URL to save on the event.
 *
 * Uploads to the /media function (R2). Where there is none, as in local
 * development or a build without the function, the clip is embedded as a data URL so
 * it still plays, at the cost of a larger scenario file. Rate and size limits are
 * reported, not embedded around.
 */
export async function storeNarrationAudio(
  blob: Blob,
  fetchFn: typeof fetch = fetch,
): Promise<StoredNarrationAudio> {
  let response: Response | undefined;
  try {
    response = await fetchFn(NARRATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": blob.type.split(";")[0] || "audio/webm",
        "X-ORBAT-SECRET": UPLOAD_SECRET,
      },
      body: blob,
    });
  } catch {
    response = undefined;
  }
  if (response?.ok) {
    const data = await response.json().catch(() => undefined);
    if (data?.url) return { url: data.url, embedded: false };
  }
  if (response?.status === 429) {
    throw new NarrationUploadError("You have reached the hourly upload limit.");
  }
  if (response?.status === 413) {
    throw new NarrationUploadError("The recording is too large (10 MB at most).");
  }
  if (response?.status === 415) {
    throw new NarrationUploadError("That audio format is not supported.");
  }
  return { url: await blobToDataUrl(blob), embedded: true };
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
