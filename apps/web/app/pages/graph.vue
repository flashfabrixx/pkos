<script setup lang="ts">
import type { GraphEdge, GraphNode } from '@bkos/core'

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

function nodeClass(type: string) {
  return `graph-node ${type}`
}
</script>

<template>
  <div>
    <main class="workspace graph-workspace">
      <section class="panel graph-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Knowledge Wave</p>
            <h1>Entity graph</h1>
          </div>
          <button type="button" class="secondary" @click="refresh">Refresh</button>
        </div>

        <div class="filters">
          <BkosSelect v-model="type" label="Node type" :options="nodeTypeOptions" />
          <BkosSelect v-model="relation" label="Relation" :options="relationOptions" />
        </div>

        <div class="graph-canvas">
          <svg viewBox="0 0 840 520" role="img" aria-label="Knowledge graph">
            <line
              v-for="edge in visibleEdges"
              :key="edge.id"
              :x1="edge.sourceNode!.x"
              :y1="edge.sourceNode!.y"
              :x2="edge.targetNode!.x"
              :y2="edge.targetNode!.y"
              class="graph-edge"
            />
            <g v-for="node in positionedNodes" :key="node.id">
              <circle :class="nodeClass(node.type)" :cx="node.x" :cy="node.y" :r="node.type === 'document' ? 19 : 13" />
              <text :x="node.x + 16" :y="node.y + 4">{{ node.name }}</text>
            </g>
          </svg>
        </div>

        <p v-if="pending" class="muted">Loading graph...</p>
        <p v-if="!pending && !nodes.length" class="muted">No graph data yet. Capture a document to create entities and edges.</p>
      </section>

      <aside class="panel side-panel">
        <section>
          <h2>Nodes</h2>
          <div class="list">
            <div v-for="node in nodes" :key="node.id" class="list-item compact">
              <span>{{ node.name }}</span>
              <small>{{ node.type }} · {{ node.mentions }} mention(s)</small>
            </div>
          </div>
        </section>

        <section>
          <h2>Edges</h2>
          <div class="list">
            <div v-for="edge in edges" :key="edge.id" class="list-item compact">
              <span>{{ edge.relation_type }}</span>
              <small>{{ edge.document_title || edge.document_id }} · confidence {{ Number(edge.confidence).toFixed(2) }}</small>
            </div>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
