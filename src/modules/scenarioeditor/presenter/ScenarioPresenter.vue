<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useEventListener, useFullscreen } from "@vueuse/core";
import {
  IconClose,
  IconFullscreen,
  IconFullscreenExit,
  IconPause,
  IconPlay,
  IconSkipNext,
  IconSkipPrevious,
} from "@iconify-prerendered/vue-mdi";
import { injectStrict } from "@/utils";
import { activeScenarioKey } from "@/components/injects";
import { inputEventFilter } from "@/components/helpers";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/composables/formatting";
import { usePresenter } from "@/modules/scenarioeditor/presenter/usePresenter";
import { PRESENTER_DWELL_CHOICES, usePresenterStore } from "@/stores/presenterStore";
import { useSelectedItems } from "@/stores/selectedStore";
import { useTimeFormatStore } from "@/stores/timeFormatStore";

const { store, time } = injectStrict(activeScenarioKey);
const presenter = usePresenterStore();
const fmt = useTimeFormatStore();
const { clear: clearSelected } = useSelectedItems();

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const p = usePresenter(
  {
    state: store.state,
    setCurrentTime: (t) => time.setCurrentTime(t),
    goToScenarioEvent: (ev) => time.goToScenarioEvent(ev),
  },
  { transitionMs: reducedMotion ? 0 : 1200 },
);

const rootRef = ref<HTMLElement | null>(null);
// Full screen takes the map area, so the map and this overlay stay and the editor's
// panels and header drop away.
const fullscreenTarget = computed(
  () => rootRef.value?.closest("main")?.parentElement ?? null,
);
const {
  isFullscreen,
  toggle: toggleFullscreen,
  exit: exitFullscreen,
} = useFullscreen(fullscreenTarget);

const current = p.current;
const title = computed(() => current.value?.title ?? store.state.info.name);
const subTitle = computed(() => current.value?.subTitle ?? "");
const when = computed(() =>
  current.value ? fmt.scenarioFormatter.format(current.value.startTime) : "",
);
const media = computed(() => current.value?.media?.[0]);
const description = computed(() =>
  renderMarkdown(
    (current.value ? current.value.description : store.state.info.description) || "",
  ),
);
const progress = computed(() =>
  p.count.value ? (p.index.value + 1) / p.count.value : 0,
);

let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

// While playing, each event stays up for the dwell time, then the next one comes.
function schedule() {
  clearTimer();
  if (!presenter.playing) return;
  if (p.atEnd.value) {
    presenter.playing = false;
    return;
  }
  timer = setTimeout(async () => {
    await p.next();
    schedule();
  }, presenter.dwellSeconds * 1000);
}

async function next() {
  clearTimer();
  await p.next();
  schedule();
}

async function prev() {
  clearTimer();
  await p.prev();
  schedule();
}

async function togglePlay() {
  presenter.playing = !presenter.playing;
  if (presenter.playing && p.index.value < 0) await next();
  else schedule();
}

function exit() {
  presenter.stop();
}

watch(() => presenter.dwellSeconds, schedule);

useEventListener(
  window,
  "keydown",
  (e: KeyboardEvent) => {
    if (!inputEventFilter(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const actions: Record<string, () => unknown> = {
      ArrowRight: next,
      PageDown: next,
      " ": next,
      ArrowLeft: prev,
      PageUp: prev,
      p: togglePlay,
      f: toggleFullscreen,
      Escape: exit,
    };
    const action = actions[e.key];
    if (!action) return;
    // Keep the editor's own shortcuts and MapLibre's arrow-key panning out of it.
    e.preventDefault();
    e.stopImmediatePropagation();
    action();
  },
  { capture: true },
);

onMounted(() => {
  clearSelected();
  p.sync();
});

onBeforeUnmount(() => {
  clearTimer();
  p.cancel();
  if (isFullscreen.value) exitFullscreen();
  presenter.stop(); // also when the editor itself closes
});
</script>

<template>
  <div ref="rootRef" class="pointer-events-none absolute inset-0 z-20" data-presenter>
    <section
      class="bg-card/95 text-card-foreground pointer-events-auto absolute bottom-4 left-4 flex max-h-[calc(100%-6rem)] w-[34rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border shadow-xl backdrop-blur"
      aria-live="polite"
    >
      <figure v-if="media" class="shrink-0">
        <img
          draggable="false"
          class="max-h-56 w-full object-cover"
          :src="media.url"
          :alt="media.caption ?? ''"
        />
        <figcaption
          v-if="media.credits"
          class="text-muted-foreground truncate px-4 pt-1 text-[11px]"
          :title="media.caption"
        >
          <a
            v-if="media.creditsUrl"
            :href="media.creditsUrl"
            target="_blank"
            class="hover:underline"
            >{{ media.credits }}</a
          >
          <span v-else>{{ media.credits }}</span>
        </figcaption>
      </figure>
      <header class="shrink-0 px-4 pt-3">
        <p v-if="when" class="text-muted-foreground text-xs tabular-nums">{{ when }}</p>
        <h2 class="text-lg leading-snug font-semibold">{{ title }}</h2>
        <p v-if="subTitle" class="text-muted-foreground text-sm">{{ subTitle }}</p>
      </header>
      <div
        class="prose prose-sm dark:prose-invert min-h-0 max-w-none flex-auto overflow-y-auto px-4 pt-2 pb-3 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-xs [&_td]:px-1.5 [&_th]:px-1.5"
        v-html="description"
      />
      <p
        v-if="p.index.value < 0"
        class="text-muted-foreground shrink-0 px-4 pb-2 text-xs"
      >
        Press → or Space to begin, P to play.
      </p>
      <div class="bg-muted h-1 shrink-0">
        <div
          class="bg-primary h-full transition-[width]"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>
      <footer class="flex shrink-0 items-center gap-1 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Previous (←)"
          :disabled="p.index.value <= 0"
          @click="prev"
        >
          <IconSkipPrevious class="size-5" aria-hidden="true" />
          <span class="sr-only">Previous event</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :title="presenter.playing ? 'Pause (P)' : 'Play (P)'"
          :disabled="p.atEnd.value && !presenter.playing"
          @click="togglePlay"
        >
          <IconPause v-if="presenter.playing" class="size-5" aria-hidden="true" />
          <IconPlay v-else class="size-5" aria-hidden="true" />
          <span class="sr-only">{{ presenter.playing ? "Pause" : "Play" }}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Next (→)"
          :disabled="p.atEnd.value"
          @click="next"
        >
          <IconSkipNext class="size-5" aria-hidden="true" />
          <span class="sr-only">Next event</span>
        </Button>
        <span class="text-muted-foreground ml-1 text-xs tabular-nums">
          {{ Math.max(p.index.value + 1, 0) }} / {{ p.count.value }}
        </span>
        <label class="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
          <span class="sr-only sm:not-sr-only">Each</span>
          <select
            v-model.number="presenter.dwellSeconds"
            class="bg-background min-w-14 rounded border py-0.5 pr-1 pl-1.5 text-xs"
            title="Time on each event while playing"
          >
            <option v-for="s in PRESENTER_DWELL_CHOICES" :key="s" :value="s">
              {{ s }} s
            </option>
          </select>
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          :title="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'"
          @click="toggleFullscreen"
        >
          <IconFullscreenExit v-if="isFullscreen" class="size-5" aria-hidden="true" />
          <IconFullscreen v-else class="size-5" aria-hidden="true" />
          <span class="sr-only">Full screen</span>
        </Button>
        <Button variant="ghost" size="icon-sm" title="Exit presenter (Esc)" @click="exit">
          <IconClose class="size-5" aria-hidden="true" />
          <span class="sr-only">Exit presenter</span>
        </Button>
      </footer>
    </section>
  </div>
</template>
