<script setup lang="ts">
import { BookmarkIcon, ClipboardIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('settings.page_title_clipper') })

const apiKey = ref('')
const origin = ref('')

onMounted(() => {
  origin.value = window.location.origin
})

const bookmarkletJs = computed(() => {
  const base = origin.value || 'https://YOUR-BKOS-HOST'
  const key = apiKey.value || 'YOUR_API_KEY'
  const source = `(()=>{const s=document.getSelection()?.toString()||'';fetch('${base}/api/v1/captures/url',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer ${key}'},body:JSON.stringify({url:location.href,selection:s,title:document.title})}).then(r=>r.ok?alert('Captured to BKOS'):r.text().then(t=>alert('BKOS error: '+t)));})();`
  return `javascript:${encodeURI(source)}`
})

function copyToClipboard(value: string) {
  navigator.clipboard?.writeText(value)
}
</script>

<template>
  <main class="mx-auto grid max-w-3xl gap-4 p-5">
    <section class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header>
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Settings</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">Web clipper</h1>
      </header>

      <p class="text-sm text-text-soft">
        The clipper sends the current tab's URL, the page title and any text
        you have selected to <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">/api/v1/captures/url</code>.
        The server re-fetches the page (SSRF-safe) to canonicalize the title and a short
        description, then runs your normal capture pipeline.
      </p>

      <section class="space-y-3">
        <header class="flex items-start gap-3">
          <BookmarkIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 class="text-sm font-semibold text-text-strong">1. Paste your API key</h2>
            <p class="text-xs text-muted">Generate one in Settings → API keys with the <code class="rounded bg-soft px-1 py-0.5 font-mono text-[11px]">captures:write</code> scope.</p>
          </div>
        </header>
        <UiField label="API key">
          <template #default="{ id }">
            <UiInput :id="id" v-model="apiKey" type="password" autocomplete="off" placeholder="bkos_…" />
          </template>
        </UiField>
      </section>

      <section class="space-y-3">
        <header class="flex items-start gap-3">
          <BookmarkIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 class="text-sm font-semibold text-text-strong">2. Add the bookmarklet</h2>
            <p class="text-xs text-muted">Drag the link to your bookmark bar, or copy the snippet and create a bookmark manually with this URL.</p>
          </div>
        </header>

        <p>
          <a
            :href="bookmarkletJs"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            draggable="true"
          >Save to BKOS</a>
        </p>

        <details class="rounded-card border border-border-subtle bg-surface-2 p-3">
          <summary class="cursor-pointer text-xs font-semibold text-text-soft">Raw bookmarklet (for manual install)</summary>
          <pre class="mt-3 overflow-auto rounded-card bg-surface-1 p-3 font-mono text-xs leading-relaxed text-text">{{ bookmarkletJs }}</pre>
          <div class="mt-2">
            <UiButton type="button" variant="secondary" size="sm" @click="copyToClipboard(bookmarkletJs)">
              <ClipboardIcon class="size-4" aria-hidden="true" />
              Copy
            </UiButton>
          </div>
        </details>
      </section>

      <section class="space-y-2">
        <header class="flex items-start gap-3">
          <BookmarkIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 class="text-sm font-semibold text-text-strong">3. Use it</h2>
            <p class="text-xs text-muted">Visit any page, optionally select some text, and click the bookmarklet.</p>
          </div>
        </header>
        <p class="text-sm text-text-soft">You'll get an alert confirming the capture id. Open the Captures inbox to find it.</p>
      </section>
    </section>
  </main>
</template>
