<script setup lang="ts">
import type { Component } from 'vue'
import type { DocumentListItem, SourceType, Confidentiality } from '@bkos/core'
import {
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  LockClosedIcon,
  MicrophoneIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'

const form = reactive({
  title: '',
  sourceType: 'meeting' as SourceType,
  rawText: '',
  participants: '',
  project: '',
  capturedAt: new Date().toISOString().slice(0, 10),
  confidentiality: 'internal' as Confidentiality
})
const sourceOptions: Array<{ value: SourceType, label: string, icon: Component }> = [
  { value: 'meeting', label: 'Meeting', icon: UserGroupIcon },
  { value: 'voice_note', label: 'Voice note', icon: MicrophoneIcon },
  { value: 'conversation', label: 'Conversation', icon: ChatBubbleLeftRightIcon },
  { value: 'reflection', label: 'Reflection', icon: LightBulbIcon },
  { value: 'other', label: 'Other', icon: DocumentTextIcon }
]
const confidentialityOptions: Array<{ value: Confidentiality, label: string, icon: Component }> = [
  { value: 'private', label: 'Private', icon: LockClosedIcon },
  { value: 'internal', label: 'Internal', icon: BuildingOffice2Icon },
  { value: 'sensitive', label: 'Sensitive', icon: ExclamationTriangleIcon }
]
const pending = ref(false)
const error = ref('')
const fileError = ref('')
const importPending = ref(false)
const dragActive = ref(false)
const showRecentDocuments = ref(false)

const { data, refresh } = await useFetch<{ documents: DocumentListItem[] }>('/api/documents')
const documents = computed(() => data.value?.documents || [])
const { data: actionsData, refresh: refreshActions } = await useFetch<{ actions: Array<{ id: string, title: string, document_id: string, document_title: string }> }>('/api/actions', {
  query: { status: 'open' }
})
const openActions = computed(() => actionsData.value?.actions || [])
const recentDocumentsLabel = computed(() => `${documents.value.length} recent document${documents.value.length === 1 ? '' : 's'}`)
const openActionsLabel = computed(() => `${openActions.value.length} open action${openActions.value.length === 1 ? '' : 's'}`)

function fileTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
}

function normalizeVtt(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      if (line === 'WEBVTT') return false
      if (/^\d+$/.test(line)) return false
      if (/-->/.test(line)) return false
      if (/^(NOTE|STYLE|REGION)(\s|$)/.test(line)) return false
      return true
    })
    .join('\n')
}

async function extractFileText(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value.trim()
  }

  if (extension === 'vtt') {
    return normalizeVtt(await file.text())
  }

  if (['md', 'markdown', 'txt'].includes(extension || '') || file.type.startsWith('text/')) {
    return (await file.text()).trim()
  }

  throw new Error(`${file.name} is not supported. Use DOCX, VTT, Markdown, or text files.`)
}

async function importFiles(files: FileList | File[]) {
  const list = Array.from(files)
  if (!list.length) return

  fileError.value = ''
  importPending.value = true
  try {
    const imported = await Promise.all(list.map(async (file) => ({
      title: fileTitle(file),
      text: await extractFileText(file)
    })))
    const content = imported
      .filter((item) => item.text)
      .map((item) => list.length > 1 ? `# ${item.title}\n\n${item.text}` : item.text)
      .join('\n\n---\n\n')

    form.rawText = [form.rawText.trim(), content].filter(Boolean).join('\n\n')
    const importedDocument = imported[0]
    if (!form.title && imported.length === 1 && importedDocument) {
      form.title = importedDocument.title
    }
  } catch (err) {
    fileError.value = err instanceof Error ? err.message : 'Could not import file.'
  } finally {
    importPending.value = false
    dragActive.value = false
  }
}

async function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (!event.dataTransfer?.files?.length) return
  await importFiles(event.dataTransfer.files)
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  await importFiles(input.files)
  input.value = ''
}

async function submitCapture() {
  error.value = ''
  pending.value = true
  try {
    const result = await $fetch<{ documentId: string }>('/api/documents', {
      method: 'POST',
      body: form
    })
    form.title = ''
    form.rawText = ''
    form.participants = ''
    form.project = ''
    await refresh()
    await refreshActions()
    await navigateTo(`/documents/${result.documentId}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Capture failed.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <main class="mx-auto grid min-h-[calc(100vh-72px)] max-w-5xl content-start gap-8 px-5 py-14">
      <section class="grid gap-6">
        <div class="text-center">
          <h1 class="text-[30px] font-medium leading-tight text-slate-950">What do you want to remember?</h1>
        </div>

        <form
          :class="[
            'rounded-xl border bg-white/70 p-3 shadow-[0_14px_45px_rgba(15,23,42,0.07)] backdrop-blur',
            dragActive ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-300'
          ]"
          @submit.prevent="submitCapture"
          @dragenter.prevent="dragActive = true"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="handleDrop"
        >
          <label class="relative">
            <span class="sr-only">Transcript / Note <strong class="required">*</strong></span>
            <textarea
              v-model="form.rawText"
              required
              rows="14"
              class="min-h-[320px] rounded-lg border-0 bg-transparent p-3 text-[15px] leading-6 shadow-none focus:border-transparent focus:shadow-none focus:ring-0"
              placeholder="Paste or drop a meeting transcript, voice-note transcript, conversation note, or business reflection..."
            ></textarea>
            <span v-if="dragActive" class="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-white/75 text-sm font-semibold text-blue-700">
              Drop files to import
            </span>
          </label>

          <div class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
            <BkosSelect v-model="form.sourceType" label="Source" :options="sourceOptions" required />

            <label>
              <span>Date <strong class="required">*</strong></span>
              <input v-model="form.capturedAt" type="date" required>
            </label>

            <BkosSelect v-model="form.confidentiality" label="Confidentiality" :options="confidentialityOptions" required />

            <button class="h-[42px] whitespace-nowrap" type="submit" :disabled="pending">
              {{ pending ? 'Processing...' : 'Capture' }}
            </button>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{{ importPending ? 'Importing file...' : 'Drop DOCX, VTT, Markdown, or text files into the input.' }}</span>
            <label class="file-import-trigger">
              <input class="sr-only" type="file" accept=".docx,.vtt,.md,.markdown,.txt,text/*" multiple @change="handleFileSelect">
              <span>Choose files</span>
            </label>
          </div>

          <p v-if="fileError" class="error mt-3">{{ fileError }}</p>
          <p v-if="error" class="error mt-3">{{ error }}</p>
        </form>

        <div class="flex flex-wrap items-center justify-center gap-2">
          <NuxtLink class="info-pill" to="/actions">
            <ClipboardDocumentListIcon class="size-4" aria-hidden="true" />
            <span>{{ openActionsLabel }}</span>
          </NuxtLink>
          <button class="info-pill" type="button" :aria-expanded="showRecentDocuments" @click="showRecentDocuments = !showRecentDocuments">
            <ClockIcon class="size-4" aria-hidden="true" />
            <span>{{ recentDocumentsLabel }}</span>
          </button>
        </div>
      </section>

      <section v-if="showRecentDocuments" class="px-1">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2>Recent documents</h2>
        </div>

        <div class="list ghost-list">
          <NuxtLink v-for="document in documents.slice(0, 6)" :key="document.id" class="list-item compact" :to="`/documents/${document.id}`">
            <span>{{ document.title }}</span>
            <small>{{ document.source_type }} · {{ document.status }}</small>
          </NuxtLink>
          <p v-if="!documents.length" class="muted">No documents captured yet.</p>
        </div>
      </section>
    </main>
  </div>
</template>
