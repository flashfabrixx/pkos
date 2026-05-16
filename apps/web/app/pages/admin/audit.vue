<script setup lang="ts">
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('audit.title') })

interface AuditEvent {
  id: string
  actor: string | null
  action: string
  resource_kind: string | null
  resource_id: string | null
  meta: Record<string, unknown>
  ip: string | null
  occurred_at: string
}

const action = ref('')
const { data, refresh, pending } = await useFetch<{ events: AuditEvent[], hasMore: boolean }>('/api/admin/audit', {
  query: computed(() => ({ action: action.value }))
})

const events = computed(() => data.value?.events || [])

function applyFilter() {
  refresh()
}
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Admin</p>
          <h1 class="text-xl font-semibold tracking-tight text-text-strong">Audit log</h1>
        </div>
        <a
          href="/api/admin/audit.csv"
          class="inline-flex h-9 items-center gap-2 rounded-md border border-border-default bg-surface-1 px-3 text-sm font-medium text-text transition-colors hover:bg-surface-3"
          download
        >
          <ArrowDownTrayIcon class="size-4" aria-hidden="true" />
          Download CSV
        </a>
      </header>

      <form class="mb-4 flex gap-2" @submit.prevent="applyFilter">
        <UiInput v-model="action" placeholder="Filter by action (e.g. auth.login)" class="flex-1" />
        <UiButton type="submit" :loading="pending">Apply</UiButton>
      </form>

      <p v-if="pending" class="text-sm text-muted">Loading…</p>
      <p v-else-if="!events.length" class="text-sm text-muted">No audit events.</p>

      <div v-else class="overflow-x-auto rounded-card border border-border-subtle">
        <table class="min-w-full divide-y divide-border-subtle text-xs">
          <thead class="bg-surface-2">
            <tr class="text-left">
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">When</th>
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Actor</th>
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Action</th>
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Resource</th>
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">IP</th>
              <th class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Meta</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            <tr v-for="ev in events" :key="ev.id" class="align-top">
              <td class="px-3 py-2 tabular-nums text-text-soft"><time>{{ formatBrowserDate(ev.occurred_at) }}</time></td>
              <td class="px-3 py-2 text-text">{{ ev.actor || '—' }}</td>
              <td class="px-3 py-2"><code class="rounded bg-soft px-1 py-0.5 font-mono text-[11px] text-text-soft">{{ ev.action }}</code></td>
              <td class="px-3 py-2 text-text-soft">
                <span v-if="ev.resource_kind">{{ ev.resource_kind }}</span>
                <span v-if="ev.resource_id" class="text-muted">/{{ ev.resource_id.slice(0, 8) }}</span>
              </td>
              <td class="px-3 py-2 text-text-soft">{{ ev.ip || '' }}</td>
              <td class="px-3 py-2"><code class="block break-all font-mono text-[11px] text-muted">{{ JSON.stringify(ev.meta) }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
