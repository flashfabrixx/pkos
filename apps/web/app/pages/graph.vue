<script setup lang="ts">
import type { GraphEdge, GraphNode } from '@bkos/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('graph.title') })

const type = ref('all')
const relation = ref('all')
const nodeTypeOptions = [
  { value: 'all', label: 'All' },
  { value: 'document', label: 'Documents' },
  { value: 'person', label: 'People' },
  { value: 'project', label: 'Projects' },
  { value: 'decision', label: 'Decisions' },
  { value: 'insight', label: 'Insights' },
  { value: 'question', label: 'Questions' },
  { value: 'tag', label: 'Tags' },
  { value: 'topic', label: 'Topics' }
]
const relationOptions = [
  { value: 'all', label: 'All' },
  { value: 'document_mentions', label: 'Document mentions' },
  { value: 'mentioned_with', label: 'Mentioned with' },
  { value: 'belongs_to_project', label: 'Belongs to project' },
  { value: 'assigned_to', label: 'Assigned to' },
  { value: 'decided_in', label: 'Decided in' },
  { value: 'insight_about', label: 'Insight about' },
  { value: 'question_about', label: 'Question about' },
  { value: 'tagged_as', label: 'Tagged as' }
]
const { data, refresh, pending } = await useFetch<{ nodes: GraphNode[], edges: GraphEdge[] }>('/api/graph', {
  query: { type, relation },
  watch: [type, relation]
})

const nodes = computed(() => data.value?.nodes || [])
const edges = computed(() => data.value?.edges || [])
const positionedNodes = computed(() => {
  const centerX = 420
  const centerY = 260
  const radius = Math.max(120, Math.min(220, nodes.value.length * 12))
  return nodes.value.map((node, index) => {
    const angle = (index / Math.max(nodes.value.length, 1)) * Math.PI * 2
    const isDocument = node.type === 'document'
    return {
      ...node,
      x: isDocument ? centerX : centerX + Math.cos(angle) * radius,
      y: isDocument ? centerY : centerY + Math.sin(angle) * radius
    }
  })
})
const nodeMap = computed(() => new Map(positionedNodes.value.map((node) => [node.id, node])))
const visibleEdges = computed(() => edges.value
  .map((edge) => ({ ...edge, sourceNode: nodeMap.value.get(edge.source), targetNode: nodeMap.value.get(edge.target) }))
  .filter((edge) => edge.sourceNode && edge.targetNode))

const NODE_FILL: Record<string, string> = {
  document: 'var(--accent)',
  person: 'var(--graph-person)',
  project: 'var(--graph-project)',
  decision: 'var(--success)',
  insight: 'var(--warning)',
  question: 'var(--danger)',
  tag: 'var(--accent-strong)',
  topic: 'var(--muted)'
}

function nodeFill(t: string) {
  return NODE_FILL[t] || 'var(--muted)'
}
</script>

<template>
  <main class="mx-auto grid max-w-[1280px] gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Knowledge Wave</p>
          <h1 class="text-xl font-semibold tracking-tight text-text-strong">Entity graph</h1>
        </div>
        <UiButton variant="secondary" size="sm" @click="refresh">Refresh</UiButton>
      </header>

      <div class="mb-4 grid gap-3 md:grid-cols-2">
        <UiField label="Node type">
          <UiSelect v-model="type" :options="nodeTypeOptions" />
        </UiField>
        <UiField label="Relation">
          <UiSelect v-model="relation" :options="relationOptions" />
        </UiField>
      </div>

      <div class="overflow-hidden rounded-card border border-border-subtle bg-surface-2">
        <svg viewBox="0 0 840 520" class="block h-auto w-full" role="img" aria-label="Knowledge graph">
          <line
            v-for="edge in visibleEdges"
            :key="edge.id"
            :x1="edge.sourceNode!.x"
            :y1="edge.sourceNode!.y"
            :x2="edge.targetNode!.x"
            :y2="edge.targetNode!.y"
            stroke="var(--border-strong)"
            stroke-width="1"
            stroke-opacity="0.6"
          />
          <g v-for="node in positionedNodes" :key="node.id">
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="node.type === 'document' ? 19 : 13"
              :fill="nodeFill(node.type)"
              fill-opacity="0.9"
            />
            <text
              :x="node.x + 16"
              :y="node.y + 4"
              fill="var(--text)"
              font-size="11"
              font-family="Inter, sans-serif"
            >{{ node.name }}</text>
          </g>
        </svg>
      </div>

      <p v-if="pending" class="mt-3 text-sm text-muted">Loading graph…</p>
      <p v-if="!pending && !nodes.length" class="mt-3 text-sm text-muted">No graph data yet. Capture a document to create entities and edges.</p>
    </section>

    <aside class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-text-strong">Nodes</h2>
        <ul class="space-y-1">
          <li v-for="node in nodes" :key="node.id" class="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
            <span class="truncate text-text">{{ node.name }}</span>
            <small class="shrink-0 text-xs text-muted">{{ node.type }} · {{ node.mentions }}</small>
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-text-strong">Edges</h2>
        <ul class="space-y-1">
          <li v-for="edge in edges" :key="edge.id" class="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
            <span class="truncate text-text">{{ edge.relation_type }}</span>
            <small class="shrink-0 text-xs text-muted">{{ Number(edge.confidence).toFixed(2) }}</small>
          </li>
        </ul>
      </section>
    </aside>
  </main>
</template>
