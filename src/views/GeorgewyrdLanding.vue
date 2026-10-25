<script setup lang="ts">
// georgewyrd fork only: the landing page for orbat.georgewyrd.com, on the georgewyrd design
// system (www.georgewyrd.com/design/, source in the hub repo tgmckinney/georgewyrd). It lists the
// battle maps published on battles.georgewyrd.com and keeps the upstream scenario panel (your
// saved scenarios, load from file / URL / clipboard). Kept in its own file so the weekly upstream
// sync of LandingPage.vue does not conflict.
//
// The design CSS is loaded only while this page is mounted: its --radius-sm/--radius-md would
// otherwise override Tailwind's in the editor.
import { onBeforeUnmount, onMounted, ref, watchEffect } from "vue";
import { MoonStarIcon, SunIcon } from "@lucide/vue";
import { useDark, useToggle } from "@vueuse/core";
import LandingPageScenarios from "./LandingPageScenarios.vue";

const BATTLES = "https://battles.georgewyrd.com";
const WWW = "https://www.georgewyrd.com";
const DESIGN = `${WWW}/design`;

interface BattleMap {
  id: string;
  title: string;
  file: string;
  page?: string;
  date?: string;
}

const maps = ref<BattleMap[]>([]);
const styled = ref(false);
const isDark = useDark();
const toggleDark = useToggle(isDark);
const links: HTMLLinkElement[] = [];

// The design system's Canvas / Lantern themes follow the app's own dark-mode switch.
watchEffect(() => {
  document.documentElement.dataset.theme = isDark.value ? "lantern" : "canvas";
});

function loadDesign() {
  const sheets = ["tokens.css", "components.css"].map((name) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${DESIGN}/${name}`;
    links.push(link);
    document.head.append(link);
    return new Promise((done) => {
      link.onload = link.onerror = done;
    });
  });
  // Show the page once the styles are in (or failed), never unstyled.
  Promise.all(sheets).then(() => (styled.value = true));
}

onMounted(async () => {
  loadDesign();
  try {
    const [index, feed] = await Promise.all([
      fetch(`${BATTLES}/orbat/index.json`).then((r) => r.json()),
      fetch(`${BATTLES}/api/battles.json`)
        .then((r) => r.json())
        .catch(() => ({ battles: [] })),
    ]);
    const bySlug = new Map<string, { url: string; date_text: string }>(
      (feed.battles ?? []).map((b: any) => [b.slug, b]),
    );
    maps.value = Object.entries(
      index as Record<string, { file: string; title: string }>,
    ).map(([id, e]) => {
      const b = bySlug.get(id.replace(/^battle-of-/, ""));
      return {
        id,
        title: e.title,
        file: `${BATTLES}/orbat/${e.file}`,
        page: b?.url,
        date: b?.date_text,
      };
    });
  } catch {
    maps.value = [];
  }
});

onBeforeUnmount(() => {
  links.forEach((link) => link.remove());
  delete document.documentElement.dataset.theme;
});

const openUrl = (m: BattleMap) =>
  `/?loadScenarioURL=${encodeURIComponent(m.file)}#scenarios`;
</script>

<template>
  <div class="gw gw-root flex h-full flex-col" :class="{ 'gw-root--ready': styled }">
    <header class="gw-masthead">
      <div class="gw-masthead__inner">
        <a
          class="gw-brand"
          :href="`${WWW}/`"
          aria-label="Meditations in the Military Arts: home"
        >
          <img
            class="gw-logo"
            :src="`${DESIGN}/logos/georgewyrd-gw.svg`"
            alt=""
            width="44"
            height="44"
          />
        </a>
        <nav aria-label="Sections" class="gw-root__nav">
          <ul class="gw-nav">
            <li><a :href="`${BATTLES}/`">battles</a></li>
            <li><a :href="`${WWW}/scenarios/`">scenarios</a></li>
            <li><a href="https://index.georgewyrd.com/">wargame index</a></li>
            <li><a href="/" aria-current="page">maps</a></li>
          </ul>
          <button
            class="gw-mode"
            type="button"
            title="Toggle dark mode"
            @click="toggleDark()"
          >
            <SunIcon v-if="isDark" class="size-4" /><MoonStarIcon v-else class="size-4" />
          </button>
        </nav>
      </div>
    </header>

    <main class="gw-page">
      <section class="gw-intro">
        <h1 class="gw-title">Battles on the map</h1>
        <p class="gw-lede">
          The units, engagements and fronts from the battle pages, moving over time. Open
          one of ours, or build your own: what you make here stays in your browser.
        </p>
      </section>

      <section class="gw-section" v-if="maps.length">
        <h2 class="gw-section__title">From the battle pages</h2>
        <ul class="gw-cards gw-root__maps">
          <li v-for="m in maps" :key="m.id">
            <a class="gw-card" :href="openUrl(m)">
              <h3 class="gw-card__title">{{ m.title }}</h3>
              <p class="gw-card__body" v-if="m.date">{{ m.date }}</p>
              <p class="gw-card__count">Open on the map →</p>
            </a>
            <a v-if="m.page" class="gw-root__page" :href="m.page">Read the battle page</a>
          </li>
        </ul>
      </section>

      <section id="scenarios" class="gw-section">
        <LandingPageScenarios title="Your maps" :show-demos="false" />
      </section>
    </main>

    <footer class="gw-footer">
      <div class="gw-footer__inner">
        <img
          class="gw-footer__logo"
          :src="`${DESIGN}/logos/georgewyrd-gw.svg`"
          alt=""
          width="32"
          height="32"
        />
        <p>Scenarios you build are stored on this computer only.</p>
        <p>Map engine released under the <a href="/LICENSE.txt">MIT licence</a>.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.gw-root {
  overflow-y: auto;
  visibility: hidden;
}
.gw-root--ready {
  visibility: visible;
}
.gw-root__nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.gw-mode {
  color: var(--ink-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
}
.gw-mode:hover {
  color: var(--ink);
  background: var(--canvas-raised);
}
.gw-root__maps {
  list-style: none;
  margin: 0;
  padding: 0;
}
.gw-root__maps li {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.gw-root__page {
  font-size: 14px;
  line-height: 20px;
}
/* The upstream scenario panel inside our page: our ground, width and heading face. */
#scenarios :deep([data-testid="landing-scenarios"]) {
  background: transparent;
  padding: 0;
  color: var(--ink);
}
#scenarios :deep([data-testid="landing-scenarios"] > div:first-child),
#scenarios :deep([data-testid="landing-scenarios"] section) {
  padding-left: 0;
  padding-right: 0;
  max-width: none;
}
#scenarios :deep([data-testid="landing-scenarios"] > div:first-child) {
  text-align: left;
}
#scenarios :deep(h2) {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 40px;
  line-height: 46px;
  letter-spacing: 0;
  color: var(--ink);
}
/* The create / load tiles as collection cards. */
#scenarios :deep(.border-dashed) {
  border: var(--border-hairline) solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--canvas-raised);
  color: var(--ink);
}
#scenarios :deep(.border-dashed:hover) {
  border-color: var(--leather);
}
#scenarios :deep(.border-dashed svg) {
  color: var(--leather);
}
main.gw-page {
  flex: 1 0 auto;
  width: 100%;
}
</style>
