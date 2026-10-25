import { describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  NarrationUploadError,
  pickRecordingMimeType,
  storeNarrationAudio,
} from "./narration";

const clip = () => new Blob(["abc"], { type: "audio/webm;codecs=opus" });

describe("pickRecordingMimeType", () => {
  it("prefers Opus and falls back to AAC", () => {
    expect(pickRecordingMimeType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecordingMimeType((t) => t.startsWith("audio/mp4"))).toBe(
      "audio/mp4;codecs=mp4a.40.2",
    );
    expect(pickRecordingMimeType(() => false)).toBeUndefined();
  });
});

describe("storeNarrationAudio", () => {
  it("uploads and returns the stored URL", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "narration/x.webm",
            url: "https://h/media?id=narration/x.webm",
          }),
        ),
    );
    const out = await storeNarrationAudio(clip(), fetchFn as typeof fetch);
    expect(out).toEqual({ url: "https://h/media?id=narration/x.webm", embedded: false });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm");
  });

  it("embeds the clip when there is no upload service", async () => {
    const notFound = vi.fn(async () => new Response("nope", { status: 404 }));
    const out = await storeNarrationAudio(clip(), notFound as typeof fetch);
    expect(out.embedded).toBe(true);
    expect(out.url).toMatch(/^data:audio\/webm/);

    const offline = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect((await storeNarrationAudio(clip(), offline as typeof fetch)).embedded).toBe(
      true,
    );
  });

  it("reports limits instead of embedding", async () => {
    const limited = vi.fn(async () => new Response("", { status: 429 }));
    await expect(storeNarrationAudio(clip(), limited as typeof fetch)).rejects.toThrow(
      NarrationUploadError,
    );
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.4)).toBe("1:05");
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(Infinity)).toBe("");
  });
});
