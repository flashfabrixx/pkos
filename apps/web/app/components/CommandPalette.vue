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
        <div class="fixed inset-0 bg-slate-500/25 transition-opacity" />
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
          <DialogPanel class="mx-auto max-w-2xl transform divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-2xl outline outline-1 outline-black/5 transition-all">
            <Combobox nullable @update:model-value="onSelect">
              <div class="grid grid-cols-1">
                <ComboboxInput
                  ref="searchInput"
                  class="command-palette-input col-start-1 row-start-1"
                  placeholder="Search..."
                  @input="updateQuery"
                />
                <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-4 size-5 self-center text-slate-400" aria-hidden="true" />
              </div>

              <ComboboxOptions v-if="hasVisibleResults" static as="ul" class="max-h-80 transform-gpu scroll-py-10 scroll-pb-2 space-y-4 overflow-y-auto p-4 pb-2">
                <li v-if="searchItem">
                  <ul class="-mx-4 text-sm text-slate-700">
                    <ComboboxOption :value="searchItem" as="template" v-slot="{ active }">
                      <li :class="['flex cursor-default items-center px-4 py-2 select-none', active && 'bg-blue-600 text-white outline-hidden']">
                        <component :is="searchItem.icon" :class="['size-5 flex-none', active ? 'text-white' : 'text-slate-400']" aria-hidden="true" />
                        <span class="ml-3 flex-auto truncate">{{ searchItem.title }}</span>
                        <span v-if="active" class="ml-3 flex-none text-blue-100">Open search</span>
                      </li>
                    </ComboboxOption>
                  </ul>
                </li>

                <li v-if="entityItems.length > 0">
                  <h2 class="text-xs font-semibold text-slate-900">Entities</h2>
                  <ul class="-mx-4 mt-2 text-sm text-slate-700">
                    <ComboboxOption v-for="item in entityItems" :key="item.id" :value="item" as="template" v-slot="{ active }">
                      <li :class="['flex cursor-default items-center px-4 py-2 select-none', active && 'bg-blue-600 text-white outline-hidden']">
                        <component :is="item.icon" :class="['size-5 flex-none', active ? 'text-white' : 'text-slate-400']" aria-hidden="true" />
                        <span class="ml-3 min-w-0 flex-auto">
                          <span class="block truncate">{{ item.title }}</span>
                          <span :class="['block truncate text-xs', active ? 'text-blue-100' : 'text-slate-500']">{{ item.subtitle }}</span>
                        </span>
                      </li>
                    </ComboboxOption>
                  </ul>
                </li>

                <li v-if="documentItems.length > 0">
                  <h2 class="text-xs font-semibold text-slate-900">Documents</h2>
                  <ul class="-mx-4 mt-2 text-sm text-slate-700">
                    <ComboboxOption v-for="item in documentItems" :key="item.id" :value="item" as="template" v-slot="{ active }">
                      <li :class="['flex cursor-default items-center px-4 py-2 select-none', active && 'bg-blue-600 text-white outline-hidden']">
                        <component :is="item.icon" :class="['size-5 flex-none', active ? 'text-white' : 'text-slate-400']" aria-hidden="true" />
                        <span class="ml-3 min-w-0 flex-auto">
                          <span class="block truncate">{{ item.title }}</span>
                          <span :class="['block truncate text-xs', active ? 'text-blue-100' : 'text-slate-500']">{{ item.subtitle }}</span>
                        </span>
                      </li>
                    </ComboboxOption>
                  </ul>
                </li>

                <li v-if="filteredCommands.length > 0">
                  <h2 class="text-xs font-semibold text-slate-900">{{ rawQuery === '' ? 'Quick actions' : 'Navigation' }}</h2>
                  <ul class="-mx-4 mt-2 text-sm text-slate-700">
                    <ComboboxOption v-for="item in filteredCommands" :key="item.id" :value="item" as="template" v-slot="{ active }">
                      <li :class="['flex cursor-default items-center px-4 py-2 select-none', active && 'bg-blue-600 text-white outline-hidden']">
                        <component :is="item.icon" :class="['size-5 flex-none', active ? 'text-white' : 'text-slate-400']" aria-hidden="true" />
                        <span class="ml-3 min-w-0 flex-auto">
                          <span class="block truncate">{{ item.title }}</span>
                          <span :class="['block truncate text-xs', active ? 'text-blue-100' : 'text-slate-500']">{{ item.subtitle }}</span>
                        </span>
                      </li>
                    </ComboboxOption>
                  </ul>
                </li>
              </ComboboxOptions>

              <div v-if="helpMode" class="px-6 py-14 text-center text-sm sm:px-14">
                <LifebuoyIcon class="mx-auto size-6 text-slate-400" aria-hidden="true" />
                <p class="mt-4 font-semibold text-slate-900">Help with searching</p>
                <p class="mt-2 text-slate-500">Use BKOS command search to jump between views and find documents. Prefix with # for document search or &gt; for navigation.</p>
              </div>

              <div v-if="query !== '' && !helpMode && !pending && !hasVisibleResults" class="px-6 py-14 text-center text-sm sm:px-14">
                <ExclamationTriangleIcon class="mx-auto size-6 text-slate-400" aria-hidden="true" />
                <p class="mt-4 font-semibold text-slate-900">No results found</p>
                <p class="mt-2 text-slate-500">BKOS could not find anything with that term.</p>
              </div>

              <div class="command-palette-footer">
                Type
                <kbd :class="['command-footer-key', documentMode ? 'active' : '']">#</kbd>
                <span class="hidden sm:inline">for documents,</span>
                <span class="sm:hidden">docs,</span>
                <kbd :class="['command-footer-key', commandMode ? 'active' : '']">&gt;</kbd>
                <span>for navigation,</span>
                <kbd :class="['command-footer-key', helpMode ? 'active' : '']">?</kbd>
                <span>for help.</span>
              </div>
            </Combobox>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
