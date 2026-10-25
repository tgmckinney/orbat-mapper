<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import {
  IconDeleteOutline,
  IconMicrophone,
  IconStop,
  IconUpload,
} from "@iconify-prerendered/vue-mdi";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDuration,
  MAX_RECORDING_SECONDS,
  NarrationUploadError,
  storeNarrationAudio,
} from "@/modules/scenarioeditor/narration/narration";
import { useNarrationRecorder } from "@/modules/scenarioeditor/narration/useNarrationRecorder";
import type { Narration } from "@/types/scenarioModels";

const props = defineProps<{ narration?: Narration }>();
const emit = defineEmits<{ update: [narration: Narration | undefined] }>();

const rec = useNarrationRecorder();

// A clip waiting to be saved, from the microphone or a file.
interface PendingClip {
  blob: Blob;
  url: string;
  duration?: number;
  fromFile: boolean;
}
const pending = shallowRef<PendingClip | null>(null);
const transcript = ref("");
const editingTranscript = ref(false);
const saving = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const embedded = computed(() => props.narration?.url.startsWith("data:") ?? false);
const shownError = computed(() => error.value || rec.error.value);

watch(rec.state, (state) => {
  if (state === "recorded" && rec.blob.value && rec.previewUrl.value) {
    pending.value = {
      blob: rec.blob.value,
      url: rec.previewUrl.value,
      duration: rec.elapsed.value,
      fromFile: false,
    };
  }
});

function beginRecording() {
  error.value = "";
  transcript.value = props.narration?.transcript ?? "";
  rec.start();
}

function chooseFile() {
  error.value = "";
  fileInput.value?.click();
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    error.value = "Choose an audio file.";
    return;
  }
  discardPending();
  transcript.value = props.narration?.transcript ?? "";
  const url = URL.createObjectURL(file);
  const clip: PendingClip = { blob: file, url, fromFile: true };
  pending.value = clip;
  // Read the length from the file's own metadata.
  const probe = new Audio();
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    if (pending.value === clip && Number.isFinite(probe.duration)) {
      pending.value = { ...clip, duration: probe.duration };
    }
  };
  probe.src = url;
}

function discardPending() {
  if (pending.value?.fromFile) URL.revokeObjectURL(pending.value.url);
  pending.value = null;
  rec.discard();
}

async function savePending() {
  const clip = pending.value;
  if (!clip) return;
  saving.value = true;
  error.value = "";
  try {
    const stored = await storeNarrationAudio(clip.blob);
    const text = transcript.value.trim();
    emit("update", {
      url: stored.url,
      mimeType: clip.blob.type.split(";")[0] || undefined,
      ...(clip.duration ? { duration: Math.round(clip.duration * 10) / 10 } : {}),
      ...(text ? { transcript: text } : {}),
    });
    discardPending();
  } catch (e) {
    error.value =
      e instanceof NarrationUploadError ? e.message : "The recording could not be saved.";
  } finally {
    saving.value = false;
  }
}

function editTranscript() {
  transcript.value = props.narration?.transcript ?? "";
  editingTranscript.value = true;
}

function saveTranscript() {
  if (!props.narration) return;
  const text = transcript.value.trim();
  emit("update", { ...props.narration, transcript: text || undefined });
  editingTranscript.value = false;
}

function remove() {
  discardPending();
  emit("update", undefined);
}
</script>

<template>
  <section class="mt-6 border-t pt-4" data-narration-panel>
    <header class="flex items-center justify-between">
      <h3 class="text-sm font-medium">Narration</h3>
      <span v-if="narration?.duration && !pending" class="text-muted-foreground text-xs">
        {{ formatDuration(narration.duration) }}
      </span>
    </header>
    <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile" />

    <div v-if="rec.isBusy.value" class="mt-3 flex items-center gap-3">
      <span class="relative flex size-3" aria-hidden="true">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none"
        />
        <span class="relative inline-flex size-3 rounded-full bg-red-600" />
      </span>
      <span class="text-sm tabular-nums" aria-live="polite">
        <template v-if="rec.state.value === 'requesting'"
          >Waiting for microphone…</template
        >
        <template v-else>
          Recording {{ formatDuration(rec.elapsed.value) }}
          <span class="text-muted-foreground">
            / {{ formatDuration(MAX_RECORDING_SECONDS) }}</span
          >
        </template>
      </span>
      <Button size="sm" class="ml-auto" @click="rec.stop()">
        <IconStop aria-hidden="true" /> Stop
      </Button>
      <Button size="sm" variant="outline" @click="discardPending">Cancel</Button>
    </div>

    <form v-else-if="pending" class="mt-3 space-y-3" @submit.prevent="savePending">
      <audio controls :src="pending.url" class="h-9 w-full" />
      <label class="block text-xs font-medium">
        Transcript <span class="text-muted-foreground font-normal">(optional)</span>
        <Textarea v-model="transcript" rows="3" class="mt-1 text-sm" />
      </label>
      <div class="flex items-center justify-end gap-2">
        <Spinner v-if="saving" class="size-4" />
        <Button type="submit" size="sm" :disabled="saving">Save narration</Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :disabled="saving"
          @click="discardPending"
          >Discard</Button
        >
      </div>
    </form>

    <div v-else-if="narration" class="mt-3 space-y-2">
      <audio controls preload="metadata" :src="narration.url" class="h-9 w-full" />
      <form v-if="editingTranscript" class="space-y-2" @submit.prevent="saveTranscript">
        <Textarea v-model="transcript" rows="3" class="text-sm" aria-label="Transcript" />
        <div class="flex justify-end gap-2">
          <Button type="submit" size="sm">Save</Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            @click="editingTranscript = false"
            >Cancel</Button
          >
        </div>
      </form>
      <p
        v-else-if="narration.transcript"
        class="text-muted-foreground text-sm whitespace-pre-line"
      >
        {{ narration.transcript }}
      </p>
      <p v-if="embedded" class="text-muted-foreground text-xs">
        Stored inside the scenario file (no upload service was available).
      </p>
      <div v-if="!editingTranscript" class="flex flex-wrap gap-1">
        <Button
          v-if="rec.isSupported"
          size="sm"
          variant="outline"
          @click="beginRecording"
        >
          <IconMicrophone aria-hidden="true" /> Re-record
        </Button>
        <Button size="sm" variant="outline" @click="chooseFile">
          <IconUpload aria-hidden="true" /> Replace
        </Button>
        <Button size="sm" variant="ghost" @click="editTranscript">
          {{ narration.transcript ? "Edit transcript" : "Add transcript" }}
        </Button>
        <Button size="sm" variant="ghost" title="Remove narration" @click="remove">
          <IconDeleteOutline aria-hidden="true" />
          <span class="sr-only">Remove narration</span>
        </Button>
      </div>
    </div>

    <div v-else class="mt-3">
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="rec.isSupported"
          size="sm"
          variant="outline"
          @click="beginRecording"
        >
          <IconMicrophone aria-hidden="true" /> Record narration
        </Button>
        <Button size="sm" variant="outline" @click="chooseFile">
          <IconUpload aria-hidden="true" /> Upload audio
        </Button>
      </div>
      <p class="text-muted-foreground mt-2 text-xs">
        A voice-over for this event. Presenter mode plays it, and auto-play waits for it
        to finish.
      </p>
    </div>

    <p v-if="shownError" class="text-destructive mt-2 text-xs" role="alert">
      {{ shownError }}
    </p>
  </section>
</template>
