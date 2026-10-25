<script setup lang="ts">
// georgewyrd fork only: the landing page for orbat.georgewyrd.com, branded like the rest of
// georgewyrd (www.georgewyrd.com, battles.georgewyrd.com). It lists the battle maps published on
// battles.georgewyrd.com and keeps the upstream scenario panel (your saved scenarios, load from
// file / URL / clipboard, demos). Kept in its own file so the weekly upstream sync of
// LandingPage.vue does not conflict.
import { onMounted, ref } from "vue";
import { MoonStarIcon, SunIcon } from "@lucide/vue";
import { UseDark } from "@vueuse/components";
import LandingPageScenarios from "./LandingPageScenarios.vue";

const BATTLES = "https://battles.georgewyrd.com";
const WWW = "https://www.georgewyrd.com";

interface BattleMap {
  id: string;
  title: string;
  file: string;
  page?: string;
  date?: string;
}

const maps = ref<BattleMap[]>([]);

onMounted(async () => {
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
    maps.value = Object.entries(index as Record<string, { file: string; title: string }>).map(
      ([id, e]) => {
        const b = bySlug.get(id.replace(/^battle-of-/, ""));
        return {
          id,
          title: e.title,
          file: `${BATTLES}/orbat/${e.file}`,
          page: b?.url,
          date: b?.date_text,
        };
      },
    );
  } catch {
    maps.value = [];
  }
});

const openUrl = (m: BattleMap) => `/?loadScenarioURL=${encodeURIComponent(m.file)}#scenarios`;
</script>

<template>
  <div class="gw bg-background flex h-full flex-col">
    <header class="gw-site">
      <a class="gw-brand" :href="WWW">georgewyrd</a>
      <nav>
        <a :href="`${BATTLES}/`">Battles</a>
        <a :href="`${WWW}/scenarios/`">Scenarios</a>
        <a href="https://index.georgewyrd.com/">Wargame index</a>
        <a href="/" aria-current="page">Maps</a>
      </nav>
      <UseDark v-slot="{ isDark, toggleDark }">
        <button class="gw-mode" type="button" title="Toggle dark mode" @click="toggleDark()">
          <SunIcon v-if="isDark" class="size-4" /><MoonStarIcon v-else class="size-4" />
        </button>
      </UseDark>
    </header>

    <main>
      <section class="gw-intro">
        <div class="gw-kicker">georgewyrd</div>
        <h1>Battles on the map</h1>
        <p class="gw-lede">
          The units, engagements and fronts from the battle pages, moving over time. Open one of
          ours, or build your own: what you make here stays in your browser.
        </p>
      </section>

      <section class="gw-maps" v-if="maps.length">
        <h2>From the battle pages</h2>
        <ul>
          <li v-for="m in maps" :key="m.id">
            <a class="gw-card" :href="openUrl(m)">
              <span class="gw-card-title">{{ m.title }}</span>
              <span class="gw-card-meta" v-if="m.date">{{ m.date }}</span>
              <span class="gw-card-go">Open on the map →</span>
            </a>
            <a v-if="m.page" class="gw-page" :href="m.page">Read the battle page</a>
          </li>
        </ul>
      </section>

      <section id="scenarios">
        <LandingPageScenarios class="mt-4" title="Your maps" :show-demos="false" />
      </section>
    </main>

    <footer class="gw-foot">
      <p>
        Part of <a :href="WWW">georgewyrd</a>: battles, orders of battle, maps and scenarios
        for wargamers. Scenarios you build are stored on this computer only.
      </p>
      <p class="gw-licence">
        Map engine released under the <a href="/LICENSE.txt">MIT licence</a>.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.gw {
  --gw-bg: #fbf9f5;
  --gw-fg: #1d1b18;
  --gw-muted: #6b655c;
  --gw-line: #e2ddd3;
  --gw-card: #f2eee6;
  --gw-card-hover: #ebe5da;
  --gw-accent: #7a1f1f;
  --gw-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --gw-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--gw-bg);
  color: var(--gw-fg);
  overflow-y: auto;
}
:global(.dark .gw) {
  --gw-bg: #161513;
  --gw-fg: #ece8e1;
  --gw-muted: #a39c90;
  --gw-line: #34312c;
  --gw-card: #201e1b;
  --gw-card-hover: #2a2723;
  --gw-accent: #f0a493;
}
.gw a {
  color: var(--gw-accent);
}
.gw-site,
main > section.gw-intro,
.gw-maps,
.gw-foot {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding-left: 16px;
  padding-right: 16px;
}
.gw-site {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  padding-top: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--gw-line);
  font: 14px var(--gw-sans);
}
.gw-site .gw-brand {
  font: 700 18px var(--gw-serif);
  color: var(--gw-fg);
  text-decoration: none;
  margin-right: auto;
}
.gw-site nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}
.gw-site nav a {
  color: var(--gw-muted);
  text-decoration: none;
}
.gw-site nav a:hover,
.gw-site nav a[aria-current] {
  color: var(--gw-accent);
}
.gw-mode {
  color: var(--gw-muted);
  padding: 4px;
  border-radius: 4px;
}
.gw-mode:hover {
  background: var(--gw-card);
}
.gw-intro {
  padding-top: 36px;
}
.gw-kicker {
  font: 600 12px/1.4 var(--gw-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gw-muted);
}
.gw-intro h1 {
  font: 700 clamp(34px, 6vw, 52px) / 1.05 var(--gw-serif);
  margin: 6px 0 12px;
}
.gw-lede {
  font: 20px/1.6 var(--gw-serif);
  max-width: 40em;
  margin: 0;
}
.gw-maps {
  margin-top: 32px;
}
.gw-maps h2 {
  font: 700 24px var(--gw-serif);
  margin: 0 0 12px;
}
.gw-maps ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.gw-maps li {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gw-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--gw-card);
  border-top: 3px solid var(--gw-accent);
  border-radius: 8px;
  padding: 18px 20px;
  text-decoration: none;
  color: var(--gw-fg) !important;
}
.gw-card:hover {
  background: var(--gw-card-hover);
}
.gw-card-title {
  font: 700 21px/1.25 var(--gw-serif);
}
.gw-card-meta {
  font: 14px var(--gw-sans);
  color: var(--gw-muted);
}
.gw-card-go {
  font: 600 13px var(--gw-sans);
  letter-spacing: 0.04em;
  color: var(--gw-accent);
}
.gw-page {
  font: 14px var(--gw-sans);
  padding-left: 4px;
}
.gw-foot {
  margin-top: 56px;
  padding-top: 16px;
  padding-bottom: 32px;
  border-top: 1px solid var(--gw-line);
  color: var(--gw-muted);
  font: 13px/1.5 var(--gw-sans);
}
.gw-foot p {
  margin: 0 0 4px;
}
.gw-licence {
  font-size: 12px;
}
/* The upstream scenario panel inside our page: our width, heading font and background. */
#scenarios {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
}
#scenarios :deep(h2) {
  font-family: var(--gw-serif);
}
#scenarios :deep([data-testid="landing-scenarios"]) {
  background: transparent;
}
</style>
