export const sourceTypes = ['meeting', 'voice_note', 'conversation', 'reflection', 'other'] as const
export const confidentialityLevels = ['private', 'internal', 'sensitive'] as const
export const actionStatuses = ['open', 'done', 'dismissed'] as const
export const openQuestionStatuses = ['open', 'resolved', 'dismissed'] as const

export type SourceType = typeof sourceTypes[number]
export type Confidentiality = typeof confidentialityLevels[number]
export type ActionStatus = typeof actionStatuses[number]
export type OpenQuestionStatus = typeof openQuestionStatuses[number]
export type EntityType = 'document' | 'person' | 'project' | 'topic' | 'decision' | 'insight' | 'question' | 'tag' | 'department'
export type RelationType =
  | 'mentioned_with'
  | 'belongs_to_project'
  | 'assigned_to'
  | 'decided_in'
  | 'insight_about'
  | 'question_about'
  | 'tagged_as'
  | 'document_mentions'

export interface CaptureInput {
  title: string
  sourceType: SourceType
  rawText: string
  participants?: string
  project?: string
  capturedAt?: string
  confidentiality: Confidentiality
}

export interface ExtractedKnowledge {
  summary: string
  people: string[]
  projects: string[]
  actionItems: string[]
  decisions: string[]
  insights: string[]
  openQuestions: string[]
  tags: string[]
}

export interface DocumentListItem {
  id: string
  title: string
  source_type: SourceType
  summary: string | null
  status: string
  archive_path: string | null
  captured_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export interface ActionItem {
  id: string
  title: string
  status: ActionStatus
  due_date: string | null
  document_id: string
  document_title: string
  document_source_type?: SourceType
  document_captured_at?: string | null
  project_id?: string | null
  project_name?: string | null
  person_id?: string | null
  person_name?: string | null
  created_at: string
}

export interface GraphNode {
  id: string
  type: EntityType
  name: string
  canonical_name: string
  mentions: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation_type: RelationType
  document_id: string | null
  document_title?: string | null
  evidence_excerpt: string | null
  confidence: number
}
