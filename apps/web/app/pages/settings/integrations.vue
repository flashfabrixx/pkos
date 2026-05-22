<script setup lang="ts">
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('settings.integrations_title') })

const baseUrl = ref('')
onMounted(() => {
  baseUrl.value = window.location.origin
})

const sampleCaptureBody = computed(() => JSON.stringify({
  sourceType: 'voice_note',
  rawText: 'Sample capture from iOS Shortcut',
  capturedAt: new Date().toISOString().slice(0, 10),
  confidentiality: 'private'
}, null, 2))

const sampleCurl = computed(() => [
  `curl -X POST "${baseUrl.value || 'https://your-pkos.example'}/api/v1/captures" \\`,
  `  -H "Authorization: Bearer pkos_XXXX_YYYY" \\`,
  `  -H "Content-Type: application/json" \\`,
  `  -d '${sampleCaptureBody.value.replace(/\n/g, '')}'`
].join('\n'))

const copied = ref<string | null>(null)
async function copy(value: string, key: string) {
  await navigator.clipboard?.writeText(value)
  copied.value = key
  setTimeout(() => { if (copied.value === key) copied.value = null }, 1500)
}
</script>

<template>
  <SettingsShell>
    <SettingsSection
      :title="t('settings.integrations_url_title')"
      :description="t('settings.integrations_url_intro')"
    >
      <div class="grid gap-3">
        <div class="flex items-center gap-2 rounded-card bg-surface-2 px-3 py-2 font-mono text-sm text-text">
          <span class="flex-1 truncate">{{ baseUrl || '…' }}</span>
          <UiButton
            v-if="baseUrl"
            type="button"
            variant="ghost"
            size="sm"
            :title="t('settings.integrations_copy_url')"
            @click="copy(baseUrl, 'url')"
          >
            <ClipboardDocumentIcon class="size-4" aria-hidden="true" />
            {{ copied === 'url' ? t('common.copied') : t('common.copy') }}
          </UiButton>
        </div>
        <p class="text-xs text-muted">{{ t('settings.integrations_url_hint') }}</p>
      </div>
    </SettingsSection>

    <SettingsSection
      :title="t('settings.integrations_ios_title')"
      :description="t('settings.integrations_ios_intro')"
    >
      <ol class="list-decimal space-y-3 pl-5 text-sm text-text-soft">
        <li>{{ t('settings.integrations_ios_step1') }}</li>
        <li>
          {{ t('settings.integrations_ios_step2') }}
          <NuxtLink to="/settings" class="font-medium text-accent hover:underline">
            {{ t('settings.integrations_ios_step2_link') }}
          </NuxtLink>
          {{ t('settings.integrations_ios_step2_tail') }}
        </li>
        <li>{{ t('settings.integrations_ios_step3') }}</li>
        <li>{{ t('settings.integrations_ios_step4') }}</li>
      </ol>

      <div class="mt-5 grid gap-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            {{ t('settings.integrations_shortcut_request') }}
          </h3>
          <UiButton type="button" variant="ghost" size="sm" @click="copy(sampleCurl, 'curl')">
            <ClipboardDocumentIcon class="size-4" aria-hidden="true" />
            {{ copied === 'curl' ? t('common.copied') : t('common.copy') }}
          </UiButton>
        </div>
        <pre class="overflow-auto rounded-card bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text whitespace-pre">{{ sampleCurl }}</pre>
      </div>

      <div class="mt-5 grid gap-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            {{ t('settings.integrations_shortcut_payload') }}
          </h3>
          <UiButton type="button" variant="ghost" size="sm" @click="copy(sampleCaptureBody, 'body')">
            <ClipboardDocumentIcon class="size-4" aria-hidden="true" />
            {{ copied === 'body' ? t('common.copied') : t('common.copy') }}
          </UiButton>
        </div>
        <pre class="overflow-auto rounded-card bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text whitespace-pre">{{ sampleCaptureBody }}</pre>
      </div>

      <p class="mt-5 text-xs text-muted">{{ t('settings.integrations_ios_docs') }}</p>
    </SettingsSection>
  </SettingsShell>
</template>
