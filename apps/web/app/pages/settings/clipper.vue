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
  // The bookmarklet is a single-line javascript: URL. We construct it
  // from a template, escape the URL fragments, and let the user copy
  // the result. Run on demand from any tab in the user's browser.
  const source = `(()=>{const s=document.getSelection()?.toString()||'';fetch('${base}/api/v1/captures/url',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer ${key}'},body:JSON.stringify({url:location.href,selection:s,title:document.title})}).then(r=>r.ok?alert('Captured to BKOS'):r.text().then(t=>alert('BKOS error: '+t)));})();`
  return `javascript:${encodeURI(source)}`
})

function copyToClipboard(value: string) {
  navigator.clipboard?.writeText(value)
}
</script>

<template>
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Settings</p>
            <h1>Web clipper</h1>
          </div>
        </div>

        <p>
          The clipper sends the current tab's URL, the page title and any text
          you have selected to <code>/api/v1/captures/url</code>. The server
          re-fetches the page (SSRF-safe) to canonicalize the title and a
          short description, then runs your normal capture pipeline.
        </p>

        <section class="settings-section">
          <header class="settings-section-head">
            <BookmarkIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>1. Paste your API key</h2>
              <p class="muted">Generate one in Settings → API keys with the <code>captures:write</code> scope.</p>
            </div>
          </header>
          <label>
            API key
            <input v-model="apiKey" type="password" autocomplete="off" placeholder="bkos_…">
          </label>
        </section>

        <section class="settings-section">
          <header class="settings-section-head">
            <BookmarkIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>2. Add the bookmarklet</h2>
              <p class="muted">Drag the link to your bookmark bar, or copy the snippet and create a bookmark manually with this URL.</p>
            </div>
          </header>

          <p>
            <a :href="bookmarkletJs" class="settings-primary" draggable="true">Save to BKOS</a>
          </p>

          <details class="settings-backup-codes">
            <summary>Raw bookmarklet (for manual install)</summary>
            <pre class="settings-backup-list">{{ bookmarkletJs }}</pre>
            <button type="button" class="settings-secondary" @click="copyToClipboard(bookmarkletJs)">
              <ClipboardIcon class="size-4" aria-hidden="true" />
              Copy
            </button>
          </details>
        </section>

        <section class="settings-section">
          <header class="settings-section-head">
            <BookmarkIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>3. Use it</h2>
              <p class="muted">Visit any page, optionally select some text, and click the bookmarklet.</p>
            </div>
          </header>
          <p>You'll get an alert confirming the capture id. Open the Captures inbox to find it.</p>
        </section>
      </section>
    </main>
  </div>
</template>
