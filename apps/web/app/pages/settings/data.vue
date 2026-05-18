<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  ClipboardIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('settings.page_title_data') })

const exportFlags = reactive({ includeTrashed: false, includeAttachments: true })

const exportCommand = computed(() => {
  const flags = [`--out pkos-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`]
  if (exportFlags.includeTrashed) flags.push('--include-trashed')
  return `pnpm pkos:export ${flags.join(' ')}`
})

const purgeConfirm = ref('')
const purgePhrase = 'delete my data'
const purgeReady = computed(() => purgeConfirm.value.trim().toLowerCase() === purgePhrase)

function copy(value: string) {
  navigator.clipboard?.writeText(value)
}

const purgeCommand = 'pnpm db:reset && rm -rf "$PKOS_FILES_PATH"/* "$PKOS_VAULT_PATH"/* && pnpm db:migrate'
</script>

<template>
  <SettingsShell>
    <SettingsSection
      title="Export your workspace"
      description="PKOS ships an offline export tool that bundles every document, entity, action, comment and attachment into a portable tar.gz archive. The archive is forward-compatible across PKOS versions and is the recommended way to migrate or back up a workspace."
    >
      <dl class="divide-y divide-border-subtle text-sm leading-6">
        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">What's included</dt>
          <dd class="mt-1 sm:mt-0 sm:flex-auto">
            <ul role="list" class="space-y-1 text-text-soft">
              <li>· <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">documents.jsonl</code>, <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">entities.jsonl</code>, <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">action_items.jsonl</code>, <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">comments.jsonl</code></li>
              <li>· <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">attachments.jsonl</code> + every binary blob under <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">assets/&lt;id&gt;/</code></li>
              <li>· <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">manifest.json</code> with schema version + row counts</li>
            </ul>
            <p class="mt-3 text-xs text-muted">Read-only on the database. Safe to run while PKOS is serving traffic.</p>
          </dd>
        </div>

        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">Options</dt>
          <dd class="mt-1 space-y-3 sm:mt-0 sm:flex-auto">
            <label class="flex items-start gap-3">
              <input
                v-model="exportFlags.includeTrashed"
                type="checkbox"
                class="mt-1 size-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-accent/20"
              >
              <span class="text-text-soft">
                <span class="font-medium text-text">Include trashed items</span>
                <span class="block text-xs text-muted">Soft-deleted documents, entities and actions are excluded by default.</span>
              </span>
            </label>
          </dd>
        </div>

        <div class="py-6 sm:flex">
          <dt class="font-medium text-text-strong sm:w-64 sm:flex-none sm:pr-6">Run the export</dt>
          <dd class="mt-1 space-y-3 sm:mt-0 sm:flex-auto">
            <p class="text-text-soft">SSH to the PKOS host and run:</p>
            <div class="relative">
              <pre class="overflow-auto rounded-card bg-surface-2 p-3 pr-12 font-mono text-xs leading-relaxed text-text">{{ exportCommand }}</pre>
              <button
                type="button"
                class="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3 hover:text-text"
                :aria-label="t('common.copy')"
                @click="copy(exportCommand)"
              >
                <ClipboardIcon class="size-4" aria-hidden="true" />
              </button>
            </div>
            <p class="text-xs text-muted">
              Or schedule it via cron and ship the archive to your offsite backup. See
              <a href="/docs/backup" class="text-accent hover:underline" target="_blank">docs/backup.md</a>
              for restore steps.
            </p>
          </dd>
        </div>
      </dl>

      <div class="mt-6 flex items-center gap-3 rounded-card border border-accent-soft bg-accent-soft px-4 py-3 text-sm text-accent">
        <ArrowDownTrayIcon class="size-5 shrink-0" aria-hidden="true" />
        <span>Streaming a workspace export over HTTP is on the roadmap. For now the CLI is the only way — it scales to multi-GB archives without blocking the web server.</span>
      </div>
    </SettingsSection>

    <SettingsSection
      title="Delete data"
      description="Permanently remove captures, entities, actions, comments, attachments and embeddings. There is no soft-delete here; the rows are gone. Export your workspace above before continuing."
      danger
    >
      <div class="space-y-6">
        <div class="flex items-start gap-3 rounded-card border border-danger-border bg-danger-soft p-4">
          <ExclamationTriangleIcon class="size-5 shrink-0 text-danger" aria-hidden="true" />
          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-danger">This wipes your entire workspace</h3>
            <p class="text-sm text-text-soft">
              Documents, entities, actions, comments, attachments on disk and the
              vector index are all dropped. Login credentials are preserved so
              you can sign in afterwards on an empty workspace. Webhook secrets,
              API keys and 2FA enrollment survive — revoke them manually if you
              want a fully cold start.
            </p>
          </div>
        </div>

        <dl class="space-y-5 text-sm">
          <div>
            <dt class="font-medium text-text-strong">1. Confirm the phrase</dt>
            <dd class="mt-1">
              <UiField :hint="`Type “${purgePhrase}” to enable the destructive command.`">
                <template #default="{ id }">
                  <UiInput
                    :id="id"
                    v-model="purgeConfirm"
                    type="text"
                    autocomplete="off"
                    spellcheck="false"
                    :placeholder="purgePhrase"
                  />
                </template>
              </UiField>
            </dd>
          </div>

          <div>
            <dt class="font-medium text-text-strong">2. Run on the host</dt>
            <dd class="mt-1 space-y-2">
              <div class="relative">
                <pre
                  :class="[
                    'overflow-auto rounded-card border p-3 pr-12 font-mono text-xs leading-relaxed transition-colors',
                    purgeReady
                      ? 'border-danger bg-surface-1 text-text'
                      : 'border-border-subtle bg-surface-2 text-muted'
                  ]"
                >pnpm db:reset
rm -rf "$PKOS_FILES_PATH"/* "$PKOS_VAULT_PATH"/*
pnpm db:migrate</pre>
                <button
                  type="button"
                  class="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="!purgeReady"
                  :aria-label="t('common.copy')"
                  @click="copy(purgeCommand)"
                >
                  <ClipboardIcon class="size-4" aria-hidden="true" />
                </button>
              </div>
              <p class="text-xs text-muted">
                The copy button unlocks after you type the confirmation phrase.
                PKOS does not expose this as an HTTP endpoint on purpose — the
                blast radius is too large for a single misclick.
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </SettingsSection>
  </SettingsShell>
</template>
