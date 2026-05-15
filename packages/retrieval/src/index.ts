export interface SearchResult {
  document_id: string
  title: string
  source_type: string
  summary: string | null
  captured_at: string | null
  created_at: string
  excerpt: string
  rank: number
}

export function makeExcerpt(content: string, query: string, maxLength = 320): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  const token = query.split(/\s+/).find((part) => part.length > 3)
  const idx = token ? normalized.toLowerCase().indexOf(token.toLowerCase()) : -1
  const start = idx > 80 ? idx - 80 : 0
  return `${start > 0 ? '…' : ''}${normalized.slice(start, start + maxLength).trim()}…`
}
