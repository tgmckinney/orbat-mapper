import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useNarrationPlayer } from "./useNarrationPlayer";

class FakeAudio {
  src = "";
  currentTime = 0;
  duration = NaN;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

function setup(muted = false) {
  const audio = new FakeAudio();
  const mutedRef = ref(muted);
  const player = useNarrationPlayer({
    muted: mutedRef,
    gapMs: 500,
    createAudio: () => audio as unknown as HTMLAudioElement,
  });
  return { audio, muted: mutedRef, player };
}

const clip = { url: "https://h/media?id=narration/a.webm", duration: 10 };

async function isSettled(p: Promise<void>) {
  let settled = false;
  p.then(() => (settled = true));
  await Promise.resolve();
  await Promise.resolve();
  return settled;
}

afterEach(() => vi.useRealTimers());

describe("useNarrationPlayer", () => {
  it("settles straight away with nothing to play or when muted", async () => {
    expect(await isSettled(setup().player.play(undefined))).toBe(true);
    const { player, audio } = setup(true);
    expect(await isSettled(player.play(clip))).toBe(true);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("settles a gap after the clip ends, tracking progress", async () => {
    vi.useFakeTimers();
    const { player, audio } = setup();
    const done = player.play(clip);
    expect(audio.src).toBe(clip.url);
    expect(player.playing.value).toBe(true);
    audio.currentTime = 5;
    audio.ontimeupdate!();
    expect(player.progress.value).toBe(0.5); // falls back to the stored duration
    audio.onended!();
    expect(await isSettled(done)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(await isSettled(done)).toBe(true);
  });

  it("settled() waits for a clip started while waiting", async () => {
    const { player, audio } = setup();
    player.play(clip);
    const waiting = player.settled();
    player.play({ url: "https://h/media?id=narration/b.webm" }); // e.g. replay
    expect(await isSettled(waiting)).toBe(false);
    player.stop();
    await Promise.resolve();
    expect(await isSettled(waiting)).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("stops when muted and carries on when playback is blocked", async () => {
    const { player, audio, muted } = setup();
    const done = player.play(clip);
    muted.value = true;
    await nextTick();
    expect(audio.pause).toHaveBeenCalled();
    expect(await isSettled(done)).toBe(true);

    muted.value = false;
    await nextTick();
    audio.play.mockRejectedValueOnce(new Error("NotAllowedError"));
    const blocked = player.play(clip);
    await Promise.resolve();
    expect(await isSettled(blocked)).toBe(true);
    expect(player.playing.value).toBe(false);
  });
});
