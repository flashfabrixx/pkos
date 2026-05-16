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
useHead({ title: () => dept.value?.name || 'Department' })

const candidateOptions = computed(() => [
  { value: '', label: '—' },
  ...candidates.value.map((c) => ({ value: c.id, label: c.name }))
])
</script>

<template>
  <main v-if="dept" class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header>
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('departments.eyebrow') }}</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ dept.name }}</h1>
        <p v-if="data?.parent" class="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
          <BuildingOffice2Icon class="size-3.5" aria-hidden="true" />
          <NuxtLink :to="`/departments/${data.parent.id}`" class="hover:text-accent">{{ data.parent.name }}</NuxtLink>
        </p>
      </header>

      <section v-if="data?.children?.length" class="space-y-2">
        <div class="flex items-center gap-2">
          <BuildingOffice2Icon class="size-5 text-muted" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-text-strong">{{ t('departments.subdepartments') }}</h2>
          <span class="text-xs text-muted">{{ data.children.length }}</span>
        </div>
        <ul class="divide-y divide-border-subtle">
          <li v-for="child in data.children" :key="child.id" class="py-2">
            <NuxtLink :to="`/departments/${child.id}`" class="text-sm text-text hover:text-accent">{{ child.name }}</NuxtLink>
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <UsersIcon class="size-5 text-muted" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-text-strong">{{ t('departments.members_title') }}</h2>
          <span class="text-xs text-muted">{{ data?.people?.length || 0 }}</span>
          <UiButton size="sm" class="ml-auto" @click="openAdd('person')">
            <PlusIcon class="size-4" aria-hidden="true" />
            {{ t('departments.add_person') }}
          </UiButton>
        </div>
        <ul v-if="data?.people?.length" class="divide-y divide-border-subtle">
          <li v-for="m in data.people" :key="m.membership_id" class="flex items-center justify-between gap-3 py-2">
            <NuxtLink :to="`/people/${m.id}`" class="text-sm text-text hover:text-accent">{{ m.name }}</NuxtLink>
            <div class="flex items-center gap-2">
              <span v-if="m.role" class="text-xs text-muted">{{ m.role }}</span>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-soft hover:bg-danger-soft hover:text-danger"
                :aria-label="t('departments.remove_confirm')"
                @click="removeMember(m.membership_id)"
              >
                <TrashIcon class="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">{{ t('departments.no_people') }}</p>
      </section>

      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <ClipboardDocumentCheckIcon class="size-5 text-muted" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-text-strong">{{ t('departments.projects_title') }}</h2>
          <span class="text-xs text-muted">{{ data?.projects?.length || 0 }}</span>
          <UiButton size="sm" class="ml-auto" @click="openAdd('project')">
            <PlusIcon class="size-4" aria-hidden="true" />
            {{ t('departments.add_project') }}
          </UiButton>
        </div>
        <ul v-if="data?.projects?.length" class="divide-y divide-border-subtle">
          <li v-for="m in data.projects" :key="m.membership_id" class="flex items-center justify-between gap-3 py-2">
            <NuxtLink :to="`/projects/${m.id}`" class="text-sm text-text hover:text-accent">{{ m.name }}</NuxtLink>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md text-muted-soft hover:bg-danger-soft hover:text-danger"
              :aria-label="t('departments.remove_confirm')"
              @click="removeMember(m.membership_id)"
            >
              <TrashIcon class="size-4" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">{{ t('departments.no_projects') }}</p>
      </section>

      <UiDialog
        :open="addingKind !== null"
        :title="addingKind === 'person' ? t('departments.add_person') : t('departments.add_project')"
        size="sm"
        @close="addingKind = null"
      >
        <form class="space-y-3" @submit.prevent="submitAdd">
          <UiField :label="addingKind === 'person' ? 'Person' : 'Project'" required>
            <UiSelect v-model="candidateId" :options="candidateOptions" />
          </UiField>
          <div class="flex justify-end gap-2 pt-2">
            <UiButton type="button" variant="secondary" size="sm" @click="addingKind = null">{{ t('common.cancel') }}</UiButton>
            <UiButton type="submit" size="sm" :disabled="!candidateId">{{ t('common.create') }}</UiButton>
          </div>
        </form>
      </UiDialog>
    </section>
  </main>
  <main v-else-if="pending" class="mx-auto max-w-5xl p-5">
    <p class="text-sm text-muted">{{ t('common.loading') }}</p>
  </main>
</template>
