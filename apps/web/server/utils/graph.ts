import type pg from 'pg'
import type { EntityType, ExtractedKnowledge, RelationType } from '@bkos/core'
import { embedTexts, vectorToPg } from './embedding'
import { recordActivity } from './entity-activity'

interface EntityRef {
  id: string
  type: EntityType
  name: string
}

export async function upsertEntity(client: pg.PoolClient, type: EntityType, name: string, metadata: Record<string, unknown> = {}) {
  const canonicalName = canonicalize(name)
  const result = await client.query<{ id: string, embedding: string | null, was_inserted: boolean }>(
    `INSERT INTO entities (type, name, canonical_name, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (type, canonical_name)
     DO UPDATE SET name = EXCLUDED.name, metadata = entities.metadata || EXCLUDED.metadata, updated_at = now()
     RETURNING id, embedding::text AS embedding, (xmax = 0) AS was_inserted`,
    [type, name.trim(), canonicalName, metadata]
  )
  const row = result.rows[0]
  if (!row) throw new Error(`Failed to upsert entity ${type}:${name}`)

  if (row.was_inserted && (type === 'person' || type === 'project' || type === 'tag')) {
    await recordActivity({ client, entityId: row.id, kind: 'created', payload: { type, name: name.trim() } })
  }

  // Generate / refresh the entity embedding from its name. Fail-open: if the
  // provider is unavailable, the entity stays without a vector.
  if (!row.embedding) {
    const [embedding] = await embedTexts([describeEntity(type, name, metadata)])
    const vec = vectorToPg(embedding?.vector ?? null)
    if (vec) {
      await client.query(
        `UPDATE entities
         SET embedding = $1::vector,
             embedding_source = $2,
             embedding_updated_at = now()
         WHERE id = $3`,
        [vec, `${embedding!.provider}:${embedding!.model || 'unknown'}`, row.id]
      )
    }
  }

  return { id: row.id, type, name: name.trim() } satisfies EntityRef
}

function describeEntity(type: EntityType, name: string, metadata: Record<string, unknown>): string {
  const description = typeof metadata?.description === 'string' ? metadata.description : ''
  return description ? `${type}: ${name}\n${description}` : `${type}: ${name}`
}

export async function addMention(
  client: pg.PoolClient,
  entityId: string,
  documentId: string,
  excerpt: string | null,
  confidence = 0.75
) {
  const result = await client.query(
    `INSERT INTO entity_mentions (entity_id, document_id, excerpt, confidence)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [entityId, documentId, excerpt, confidence]
  )
  if (result.rowCount) {
    await recordActivity({
      client,
      entityId,
      kind: 'mentioned_in_document',
      documentId,
      payload: { excerpt: excerpt?.slice(0, 240) || null, confidence }
    })
  }
}

export async function addEdge(
  client: pg.PoolClient,
  sourceEntityId: string,
  targetEntityId: string,
  relationType: RelationType,
  documentId: string,
  evidenceExcerpt: string | null,
  confidence = 0.7
) {
  if (sourceEntityId === targetEntityId) return
  await client.query(
    `INSERT INTO knowledge_edges (source_entity_id, target_entity_id, relation_type, document_id, evidence_excerpt, confidence)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [sourceEntityId, targetEntityId, relationType, documentId, evidenceExcerpt, confidence]
  )
}

export async function writeKnowledgeGraph(
  client: pg.PoolClient,
  documentId: string,
  documentTitle: string,
  extracted: ExtractedKnowledge
) {
  const documentEntity = await upsertEntity(client, 'document', documentTitle, { document_id: documentId })
  await addMention(client, documentEntity.id, documentId, extracted.summary, 1)

  const people = await upsertEntities(client, 'person', extracted.people)
  const projects = await upsertEntities(client, 'project', extracted.projects)
  const decisions = await upsertEntities(client, 'decision', extracted.decisions)
  const insights = await upsertEntities(client, 'insight', extracted.insights)
  const questions = await upsertEntities(client, 'question', extracted.openQuestions)
  const tags = await upsertEntities(client, 'tag', extracted.tags)

  const allMentioned = [...people, ...projects, ...decisions, ...insights, ...questions, ...tags]
  for (const entity of allMentioned) {
    await addMention(client, entity.id, documentId, excerptFor(entity.name, extracted), confidenceFor(entity.type))
    await addEdge(client, documentEntity.id, entity.id, 'document_mentions', documentId, extracted.summary, 0.9)
  }

  for (const person of people) {
    for (const project of projects) {
      await addEdge(client, person.id, project.id, 'belongs_to_project', documentId, extracted.summary, 0.75)
    }
    for (const decision of decisions) {
      await addEdge(client, person.id, decision.id, 'decided_in', documentId, decision.name, 0.62)
    }
  }

  for (const decision of decisions) {
    for (const project of projects) {
      await addEdge(client, decision.id, project.id, 'decided_in', documentId, decision.name, 0.78)
    }
  }

  for (const action of extracted.actionItems) {
    const actionEntity = await upsertEntity(client, 'topic', action, { kind: 'action_item' })
    await addMention(client, actionEntity.id, documentId, action, 0.7)
    await addEdge(client, documentEntity.id, actionEntity.id, 'document_mentions', documentId, action, 0.8)
    for (const person of people.slice(0, 1)) {
      await addEdge(client, actionEntity.id, person.id, 'assigned_to', documentId, action, 0.55)
    }
    for (const project of projects) {
      await addEdge(client, actionEntity.id, project.id, 'belongs_to_project', documentId, action, 0.72)
    }
  }

  for (const insight of insights) {
    for (const project of projects) {
      await addEdge(client, insight.id, project.id, 'insight_about', documentId, insight.name, 0.78)
    }
  }

  for (const question of questions) {
    for (const project of projects) {
      await addEdge(client, question.id, project.id, 'question_about', documentId, question.name, 0.76)
    }
  }

  for (const tag of tags) {
    for (const project of projects) {
      await addEdge(client, project.id, tag.id, 'tagged_as', documentId, tag.name, 0.6)
    }
  }

  const relationshipCandidates = [...people, ...projects, ...decisions, ...insights, ...questions]
  for (let i = 0; i < relationshipCandidates.length; i += 1) {
    for (let j = i + 1; j < relationshipCandidates.length; j += 1) {
      const left = relationshipCandidates[i]
      const right = relationshipCandidates[j]
      if (!left || !right) continue
      await addEdge(client, left.id, right.id, 'mentioned_with', documentId, extracted.summary, 0.45)
    }
  }
}

async function upsertEntities(client: pg.PoolClient, type: EntityType, names: string[]) {
  const refs: EntityRef[] = []
  for (const name of names) {
    refs.push(await upsertEntity(client, type, name))
  }
  return refs
}

function canonicalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function confidenceFor(type: EntityType) {
  if (type === 'person' || type === 'project') return 0.82
  if (type === 'decision' || type === 'insight' || type === 'question') return 0.74
  return 0.65
}

function excerptFor(name: string, extracted: ExtractedKnowledge) {
  return [
    extracted.summary,
    ...extracted.decisions,
    ...extracted.insights,
    ...extracted.openQuestions,
    ...extracted.actionItems
  ].find((value) => value.toLowerCase().includes(name.toLowerCase())) || extracted.summary
}
