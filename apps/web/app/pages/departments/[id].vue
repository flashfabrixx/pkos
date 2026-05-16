<script setup lang="ts">
import {
  BuildingOffice2Icon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))

interface MemberRow {
  membership_id: string
  id: string
  name: string
  role: string | null
  started_on: string | null
  ended_on: string | null
}
interface DepartmentDetail {
  department: { id: string, name: string, parent_id: string | null }
  parent: { id: string, name: string } | null
  children: Array<{ id: string, name: string }>
  people: MemberRow[]
  projects: MemberRow[]
}

const { data, refresh, pending } = await useFetch<DepartmentDetail>(() => `/api/departments/${id.value}`)

const addingKind = ref<'person' | 'project' | null>(null)
const candidateId = ref('')
const candidates = ref<Array<{ id: string, name: string }>>([])

async function openAdd(kind: 'person' | 'project') {
  addingKind.value = kind
  candidateId.value = ''
  const url = kind === 'person' ? '/api/people' : '/api/projects'
  const r = await $fetch<{ people?: any[], projects?: any[] }>(url, { query: { limit: 200 } })
  candidates.value = (kind === 'person' ? r.people : r.projects)?.map((row: any) => ({ id: row.id, name: row.name })) || []
}

async function submitAdd() {
  if (!addingKind.value || !candidateId.value) return
  await $fetch(`/api/departments/${id.value}/members`, {
    method: 'POST',
    body: { member_id: candidateId.value, kind: addingKind.value }
  })
  addingKind.value = null
  await refresh()
}

async function removeMember(membershipId: string) {
  if (!confirm(t('departments.remove_confirm'))) return
  await $fetch(`/api/departments/${id.value}/members/${membershipId}`, { method: 'DELETE' })
  await refresh()
}

const dept = computed(() => data.value?.department)
</script>

<template>
  <div>
    <main v-if="dept" class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">{{ t('departments.eyebrow') }}</p>
            <h1>{{ dept.name }}</h1>
            <p v-if="data?.parent" class="muted">
              <BuildingOffice2Icon class="size-3.5 inline" aria-hidden="true" />
              <NuxtLink :to="`/departments/${data.parent.id}`">{{ data.parent.name }}</NuxtLink>
            </p>
          </div>
        </div>

        <section v-if="data?.children?.length" class="doc-section">
          <div class="doc-section-head">
            <BuildingOffice2Icon class="size-5 text-slate-500" aria-hidden="true" />
            <h2>{{ t('departments.subdepartments') }}</h2>
            <span class="count">{{ data.children.length }}</span>
          </div>
          <ul class="doc-list">
            <li v-for="child in data.children" :key="child.id" class="doc-list-row">
              <NuxtLink :to="`/departments/${child.id}`">{{ child.name }}</NuxtLink>
            </li>
          </ul>
        </section>

        <section class="doc-section">
          <div class="doc-section-head">
            <UsersIcon class="size-5 text-slate-500" aria-hidden="true" />
            <h2>{{ t('departments.members_title') }}</h2>
            <span class="count">{{ data?.people?.length || 0 }}</span>
            <button type="button" class="entity-index-add" @click="openAdd('person')">
              <PlusIcon class="size-4" aria-hidden="true" />
              <span>{{ t('departments.add_person') }}</span>
            </button>
          </div>
          <ul v-if="data?.people?.length" class="doc-list">
            <li v-for="m in data.people" :key="m.membership_id" class="doc-list-row">
              <NuxtLink :to="`/people/${m.id}`">{{ m.name }}</NuxtLink>
              <span v-if="m.role" class="muted">{{ m.role }}</span>
              <button type="button" class="trash-btn trash-btn--danger" @click="removeMember(m.membership_id)">
                <TrashIcon class="size-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="muted">{{ t('departments.no_people') }}</p>
        </section>

        <section class="doc-section">
          <div class="doc-section-head">
            <ClipboardDocumentCheckIcon class="size-5 text-slate-500" aria-hidden="true" />
            <h2>{{ t('departments.projects_title') }}</h2>
            <span class="count">{{ data?.projects?.length || 0 }}</span>
            <button type="button" class="entity-index-add" @click="openAdd('project')">
              <PlusIcon class="size-4" aria-hidden="true" />
              <span>{{ t('departments.add_project') }}</span>
            </button>
          </div>
          <ul v-if="data?.projects?.length" class="doc-list">
            <li v-for="m in data.projects" :key="m.membership_id" class="doc-list-row">
              <NuxtLink :to="`/projects/${m.id}`">{{ m.name }}</NuxtLink>
              <button type="button" class="trash-btn trash-btn--danger" @click="removeMember(m.membership_id)">
                <TrashIcon class="size-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="muted">{{ t('departments.no_projects') }}</p>
        </section>

        <div v-if="addingKind" class="dialog-backdrop" @click.self="addingKind = null">
          <form class="settings-section dialog-card" @submit.prevent="submitAdd">
            <h3>{{ addingKind === 'person' ? t('departments.add_person') : t('departments.add_project') }}</h3>
            <select v-model="candidateId" required>
              <option value="">—</option>
              <option v-for="c in candidates" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <div class="settings-enroll-actions">
              <button type="button" class="settings-secondary" @click="addingKind = null">{{ t('common.cancel') }}</button>
              <button type="submit" class="settings-primary" :disabled="!candidateId">{{ t('common.create') }}</button>
            </div>
          </form>
        </div>
      </section>
    </main>
    <main v-else-if="pending" class="workspace single">
      <p class="muted">{{ t('common.loading') }}</p>
    </main>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.dialog-card {
  width: 360px;
  max-width: 90vw;
}
</style>
