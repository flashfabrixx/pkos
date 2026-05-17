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
  <SettingsShell>
    <SettingsSection
      title="Web clipper"
      description="The clipper sends the current tab's URL, the page title and any text you have selected to /api/v1/captures/url. The server re-fetches the page (SSRF-safe) to canonicalize the title and a short description, then runs your normal capture pipeline."
    >
      <dl class="divide-y divide-border-subtle border-t border-border-subtle text-sm leading-6">
        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">1. Paste your API key</dt>
          <dd class="mt-1 sm:mt-0 sm:flex-auto">
            <UiField hint="Generate one in Settings → API keys with the captures:write scope.">
              <template #default="{ id }">
                <UiInput :id="id" v-model="apiKey" type="password" autocomplete="off" placeholder="bkos_…" />
              </template>
            </UiField>
          </dd>
        </div>

        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">2. Add the bookmarklet</dt>
          <dd class="mt-1 space-y-3 sm:mt-0 sm:flex-auto">
            <p class="text-text-soft">Drag the link to your bookmark bar, or copy the snippet and create a bookmark manually with this URL.</p>
            <p>
              <a
                :href="bookmarkletJs"
                class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
                draggable="true"
              >
                <BookmarkIcon class="size-4" aria-hidden="true" />
                Save to BKOS
              </a>
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
          </dd>
        </div>

        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">3. Use it</dt>
          <dd class="mt-1 sm:mt-0 sm:flex-auto">
            <p class="text-text-soft">Visit any page, optionally select some text, and click the bookmarklet. You'll get an alert confirming the capture id. Open the Captures inbox to find it.</p>
          </dd>
        </div>
      </dl>
    </SettingsSection>
  </SettingsShell>
</template>
