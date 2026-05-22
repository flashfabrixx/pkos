<script setup lang="ts">
import { FolderIcon, HashtagIcon, UsersIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

/**
 * Shared right-aside relation card used by all detail pages.
 *
 * The capture detail (documents/[id].vue) was the reference: each of
 * People / Projects / Tags is its own header row with icon, title,
 * count, optional inline picker, then either a list (people/projects)
 * or a pill cloud (tags) - and an always-rendered muted empty-state
 * line when the relation has no rows.
 *
 * Two modes:
 *   - writable: shows EntityPicker per section and a per-row remove
 *     button (capture detail)
 *   - readonly: links only, no picker, no remove (entity detail pages)
 */

type Kind = 'person' | 'project' | 'tag'

interface RelationItem {
  id: string
  name: string
}

const props = defineProps<{
  items: {
    people: RelationItem[]
    projects: RelationItem[]
    tags: RelationItem[]
  }
  mode: 'writable' | 'readonly'
  /**
   * In readonly mode the parent entity should not list itself as a
   * related entity. Pass {kind, id} to filter it out.
   */
  hideSelf?: { kind: Kind, id: string }
}>()

const emit = defineEmits<{
  (e: 'attach', payload: { kind: Kind, entity: { id?: string, name: string } }): void
  (e: 'detach', payload: { kind: Kind, entity: RelationItem }): void
}>()

const { t } = useI18n()

const DETAIL_BASE: Record<Kind, string> = {
  person: '/people',
  project: '/projects',
  tag: '/tags'
}

function filterSelf(list: RelationItem[], kind: Kind): RelationItem[] {
  if (!props.hideSelf) return list
  if (props.hideSelf.kind !== kind) return list
  const selfId = props.hideSelf.id
  return list.filter((row) => row.id !== selfId)
}

const visiblePeople = computed(() => filterSelf(props.items.people, 'person'))
const visibleProjects = computed(() => filterSelf(props.items.projects, 'project'))
const visibleTags = computed(() => filterSelf(props.items.tags, 'tag'))
</script>

<template>
  <aside class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
    <section class="space-y-2">
      <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
        <UsersIcon class="size-4 text-muted" aria-hidden="true" />
        <h3>{{ t('relations.people') }}</h3>
        <span class="text-xs font-normal text-muted">{{ visiblePeople.length }}</span>
        <div v-if="mode === 'writable'" class="ml-auto">
          <EntityPicker
            type="person"
            :exclude-ids="visiblePeople.map((p) => p.id)"
            @select="(payload) => emit('attach', { kind: 'person', entity: payload })"
          />
        </div>
      </div>
      <ul v-if="visiblePeople.length" class="space-y-0.5">
        <li
          v-for="person in visiblePeople"
          :key="person.id"
          class="group flex items-center gap-2"
        >
          <NuxtLink
            :to="`${DETAIL_BASE.person}/${person.id}`"
            class="min-w-0 flex-1 truncate py-1 text-sm text-text transition-colors hover:text-accent"
          >{{ person.name }}</NuxtLink>
          <button
            v-if="mode === 'writable'"
            type="button"
            class="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
            :aria-label="t('relations.remove', { name: person.name })"
            :title="t('relations.remove', { name: person.name })"
            @click.stop.prevent="emit('detach', { kind: 'person', entity: person })"
          >
            <XMarkIcon class="size-3.5" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-else class="text-xs text-muted">{{ t('relations.people_empty') }}</p>
    </section>

    <section class="space-y-2">
      <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
        <FolderIcon class="size-4 text-muted" aria-hidden="true" />
        <h3>{{ t('relations.projects') }}</h3>
        <span class="text-xs font-normal text-muted">{{ visibleProjects.length }}</span>
        <div v-if="mode === 'writable'" class="ml-auto">
          <EntityPicker
            type="project"
            :exclude-ids="visibleProjects.map((p) => p.id)"
            @select="(payload) => emit('attach', { kind: 'project', entity: payload })"
          />
        </div>
      </div>
      <ul v-if="visibleProjects.length" class="space-y-0.5">
        <li
          v-for="project in visibleProjects"
          :key="project.id"
          class="group flex items-center gap-2"
        >
          <NuxtLink
            :to="`${DETAIL_BASE.project}/${project.id}`"
            class="min-w-0 flex-1 truncate py-1 text-sm text-text transition-colors hover:text-accent"
          >{{ project.name }}</NuxtLink>
          <button
            v-if="mode === 'writable'"
            type="button"
            class="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
            :aria-label="t('relations.remove', { name: project.name })"
            :title="t('relations.remove', { name: project.name })"
            @click.stop.prevent="emit('detach', { kind: 'project', entity: project })"
          >
            <XMarkIcon class="size-3.5" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-else class="text-xs text-muted">{{ t('relations.projects_empty') }}</p>
    </section>

    <section class="space-y-2">
      <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
        <HashtagIcon class="size-4 text-muted" aria-hidden="true" />
        <h3>{{ t('relations.tags') }}</h3>
        <span class="text-xs font-normal text-muted">{{ visibleTags.length }}</span>
        <div v-if="mode === 'writable'" class="ml-auto">
          <EntityPicker
            type="tag"
            :exclude-ids="visibleTags.map((t) => t.id)"
            @select="(payload) => emit('attach', { kind: 'tag', entity: payload })"
          />
        </div>
      </div>
      <div v-if="visibleTags.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in visibleTags"
          :key="tag.id"
          class="group inline-flex items-center rounded-full bg-soft pl-2.5 pr-1 py-0.5 text-xs font-medium text-text-soft"
        >
          <NuxtLink
            :to="`${DETAIL_BASE.tag}/${tag.id}`"
            class="hover:text-accent"
          >#{{ tag.name }}</NuxtLink>
          <button
            v-if="mode === 'writable'"
            type="button"
            class="ml-1 inline-flex size-4 items-center justify-center rounded-full text-muted-soft opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
            :aria-label="t('relations.remove', { name: tag.name })"
            @click.stop.prevent="emit('detach', { kind: 'tag', entity: tag })"
          >
            <XMarkIcon class="size-3" aria-hidden="true" />
          </button>
          <span v-else class="pr-1.5" />
        </span>
      </div>
      <p v-else class="text-xs text-muted">{{ t('relations.tags_empty') }}</p>
    </section>
  </aside>
</template>
