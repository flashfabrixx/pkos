<script setup lang="ts">
import type { Component } from 'vue'
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import {
  ChartBarSquareIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  HashtagIcon,
  HomeIcon,
  LifebuoyIcon,
  QueueListIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'

type SearchResult = {
  document_id: string
  title: string
  source_type: string
  summary: string | null
  captured_at: string | null
  excerpt: string
}

type EntityHit = { id: string, type: 'person' | 'project' | 'tag', name: string }

type PaletteTarget = string | { path: string, query?: Record<string, string> }

type PaletteItem = {
  id: string
  kind: 'command' | 'document' | 'search'
  title: string
  subtitle: string
  to: PaletteTarget
  icon: Component
}

const route = useRoute()
const open = defineModel<boolean>('open', { default: false })
const rawQuery = ref('')
const pending = ref(false)
const results = ref<SearchResult[]>([])
const entityHits = ref<EntityHit[]>([])
const searchInput = ref<HTMLInputElement | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | undefined

const query = computed(() => rawQuery.value.toLowerCase().replace(/^[#>]/, '').trim())
const documentMode = computed(() => rawQuery.value.startsWith('#'))
const commandMode = computed(() => rawQuery.value.startsWith('>'))
const helpMode = computed(() => rawQuery.value === '?')

const commands = computed<PaletteItem[]>(() => [
  {
    id: 'dashboard',
    kind: 'command',
    title: 'Dashboard',
    subtitle: 'Capture new business context',
    to: '/',
    icon: HomeIcon
  },
  {
    id: 'actions',
    kind: 'command',
    title: 'Actions',
    subtitle: 'Review open and completed action items',
    to: '/actions',
    icon: QueueListIcon
  },
  {
    id: 'graph',
    kind: 'command',
    title: 'Knowledge graph',
    subtitle: 'Explore entities and relations',
    to: '/graph',
    icon: ChartBarSquareIcon
  }
])

const filteredCommands = computed(() => {
  if (rawQuery.value === '') return commands.value
  if (documentMode.value || helpMode.value) return []
  if (commandMode.value && !query.value) return commands.value
  return commands.value.filter((command) => {
    const haystack = `${command.title} ${command.subtitle}`.toLowerCase()
    return haystack.includes(query.value)
  })
})

const documentItems = computed<PaletteItem[]>(() => results.value.slice(0, 6).map((result) => ({
  id: `document:${result.document_id}`,
  kind: 'document',
  title: result.title,
  subtitle: `${result.source_type}${result.captured_at ? ` · ${formatBrowserDate(result.captured_at)}` : ''}`,
  to: `/documents/${result.document_id}`,
  icon: DocumentTextIcon
})))

function entityRoute(hit: EntityHit) {
  if (hit.type === 'person') return `/people/${hit.id}`
  if (hit.type === 'project') return `/projects/${hit.id}`
  return `/tags/${hit.id}`
}
function entityIconFor(type: EntityHit['type']) {
  if (type === 'person') return UsersIcon
  if (type === 'project') return FolderIcon
  return HashtagIcon
}

const entityItems = computed<PaletteItem[]>(() => entityHits.value.slice(0, 6).map((hit) => ({
  id: `entity:${hit.id}`,
  kind: 'command',
  title: (hit.type === 'tag' ? '#' : '') + hit.name,
  subtitle: hit.type.charAt(0).toUpperCase() + hit.type.slice(1),
  to: entityRoute(hit),
  icon: entityIconFor(hit.type)
})))

const searchItem = computed<PaletteItem | null>(() => {
  if (!query.value || commandMode.value || helpMode.value) return null
  return {
    id: 'search',
    kind: 'search',
    title: `Search for "${query.value}"`,
    subtitle: 'Open full knowledge search',
    to: { path: '/search', query: { q: query.value } },
    icon: MagnifyingGlassIcon
  }
})

const hasVisibleResults = computed(() => Boolean(searchItem.value) || entityItems.value.length > 0 || documentItems.value.length > 0 || filteredCommands.value.length > 0)

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

function handleGlobalKeydown(event: KeyboardEvent) {
  const isCommandPaletteShortcut = (event.key.toLowerCase() === 'k' || event.code === 'KeyK') && (event.metaKey || event.ctrlKey)
  if (!isCommandPaletteShortcut) return

  event.preventDefault()
  event.stopPropagation()

  if (open.value && isEditableTarget(event.target)) {
    open.value = false
    return
  }

  openPalette()
}

function openPalette() {
  if (route.path === '/login') return
  open.value = true
  void nextTick(() => searchInput.value?.focus())
}

function resetPalette() {
  rawQuery.value = ''
  results.value = []
  entityHits.value = []
  pending.value = false
}

function updateQuery(event: Event) {
  rawQuery.value = (event.target as HTMLInputElement).value
}

async function choose(to: PaletteTarget) {
  open.value = false
  await navigateTo(to)
}

async function onSelect(item: PaletteItem | null) {
  if (!item) return
  await choose(item.to)
}

watch(rawQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  if (query.value.length < 2 || commandMode.value || helpMode.value) {
    results.value = []
    entityHits.value = []
    pending.value = false
    return
  }

  pending.value = true
  searchTimer = setTimeout(async () => {
    try {
      const data = await $fetch<{ results: SearchResult[], entities: EntityHit[] }>('/api/search', {
        query: { q: query.value }
      })
      results.value = data.results
      entityHits.value = data.entities || []
    } finally {
      pending.value = false
    }
  }, 180)
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
})
</script>

<template>
  <TransitionRoot :show="open" as="template" appear @after-leave="resetPalette">
    <Dialog class="relative z-50" :initial-focus="searchInput" @close="open = false">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-150"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel class="mx-auto max-w-2xl transform divide-y divide-border-subtle overflow-hidden rounded-card bg-surface-1 shadow-popover ring-1 ring-border-default transition-all">
            <Combobox nullable @update:model-value="onSelect">
              <div class="grid grid-cols-1">
                <ComboboxInput
                  ref="searchInput"
                  class="col-start-1 row-start-1 h-12 w-full border-0 bg-transparent pl-11 pr-4 text-base text-text outline-none placeholder:text-muted-soft focus:ring-0"
                  placeholder="Search…"
                  @input="updateQuery"
                />
                <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-4 size-5 self-center text-muted-soft" aria-hidden="true" />
              </div>

              <ComboboxOptions v-if="hasVisibleResults" static as="ul" class="max-h-80 scroll-py-10 scroll-pb-2 space-y-4 overflow-y-auto p-3 pb-2">
                <li v-if="searchItem">
                  <ul class="text-sm">
                    <ComboboxOption :value="searchItem" as="template" v-slot="{ active }">
                      <li :class="['flex cursor-pointer select-none items-center rounded-md px-3 py-2', active ? 'bg-accent text-accent-fg' : 'text-text']">
                        <component :is="searchItem.icon" :class="['size-5 flex-none', active ? 'text-accent-fg' : 'text-muted']" aria-hidden="true" />
                        <span class="ml-3 flex-auto truncate">{{ searchItem.title }}</span>
                        <span v-if="active" class="ml-3 flex-none text-accent-fg/80">Open search</span>
                      </li>
                    </ComboboxOption>
                  </ul>
                </li>

                <li v-for="(group, index) in [
                  { items: entityItems, label: 'Entities' },
                  { items: documentItems, label: 'Documents' },
                  { items: filteredCommands, label: rawQuery === '' ? 'Quick actions' : 'Navigation' }
                ]" :key="index">
                  <template v-if="group.items.length > 0">
                    <h2 class="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{{ group.label }}</h2>
                    <ul class="mt-1 text-sm">
                      <ComboboxOption v-for="item in group.items" :key="item.id" :value="item" as="template" v-slot="{ active }">
                        <li :class="['flex cursor-pointer select-none items-center rounded-md px-3 py-2', active ? 'bg-accent text-accent-fg' : 'text-text']">
                          <component :is="item.icon" :class="['size-5 flex-none', active ? 'text-accent-fg' : 'text-muted']" aria-hidden="true" />
                          <span class="ml-3 min-w-0 flex-auto">
                            <span class="block truncate">{{ item.title }}</span>
                            <span :class="['block truncate text-xs', active ? 'text-accent-fg/80' : 'text-muted']">{{ item.subtitle }}</span>
                          </span>
                        </li>
                      </ComboboxOption>
                    </ul>
                  </template>
                </li>
              </ComboboxOptions>

              <div v-if="helpMode" class="px-6 py-14 text-center text-sm sm:px-14">
                <LifebuoyIcon class="mx-auto size-6 text-muted-soft" aria-hidden="true" />
                <p class="mt-4 font-semibold text-text-strong">Help with searching</p>
                <p class="mt-2 text-text-soft">Use BKOS command search to jump between views and find documents. Prefix with # for document search or &gt; for navigation.</p>
              </div>

              <div v-if="query !== '' && !helpMode && !pending && !hasVisibleResults" class="px-6 py-14 text-center text-sm sm:px-14">
                <ExclamationTriangleIcon class="mx-auto size-6 text-muted-soft" aria-hidden="true" />
                <p class="mt-4 font-semibold text-text-strong">No results found</p>
                <p class="mt-2 text-text-soft">BKOS could not find anything with that term.</p>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 bg-surface-2 px-3 py-2.5 text-xs text-text-soft">
                Type
                <UiKbd :class="documentMode && 'border-accent text-accent'">#</UiKbd>
                <span class="hidden sm:inline">for documents,</span>
                <span class="sm:hidden">docs,</span>
                <UiKbd :class="commandMode && 'border-accent text-accent'">&gt;</UiKbd>
                <span>for navigation,</span>
                <UiKbd :class="helpMode && 'border-accent text-accent'">?</UiKbd>
                <span>for help.</span>
              </div>
            </Combobox>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
