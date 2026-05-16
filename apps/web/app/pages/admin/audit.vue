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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Admin</p>
            <h1>Audit log</h1>
          </div>
          <a href="/api/admin/audit.csv" class="settings-secondary" download>
            <ArrowDownTrayIcon class="size-4" aria-hidden="true" />
            Download CSV
          </a>
        </div>

        <form class="search-bar" @submit.prevent="applyFilter">
          <input v-model="action" placeholder="Filter by action (e.g. auth.login)">
          <button type="submit" :disabled="pending">Apply</button>
        </form>

        <p v-if="pending" class="muted">Loading…</p>
        <p v-else-if="!events.length" class="muted">No audit events.</p>

        <table v-else class="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>IP</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in events" :key="ev.id">
              <td><time>{{ formatBrowserDate(ev.occurred_at) }}</time></td>
              <td>{{ ev.actor || '—' }}</td>
              <td><code>{{ ev.action }}</code></td>
              <td>
                <span v-if="ev.resource_kind">{{ ev.resource_kind }}</span>
                <span v-if="ev.resource_id" class="muted">/{{ ev.resource_id.slice(0, 8) }}</span>
              </td>
              <td>{{ ev.ip || '' }}</td>
              <td><code class="audit-meta">{{ JSON.stringify(ev.meta) }}</code></td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<style scoped>
.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.audit-table th,
.audit-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}
.audit-table th {
  background: var(--surface-3);
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 11px;
}
.audit-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
}
</style>
