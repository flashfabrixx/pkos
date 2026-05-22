import { z } from 'zod'

/**
 * Saved-view filter schema. Mirrors the query params accepted by
 * `runHybridSearch()` so the UI can hydrate the /search form 1:1 from
 * a stored view. Anything not in this list is rejected so the JSONB
 * column doesn't drift into a free-form bag.
 */
export const filtersSchema = z.object({
  kinds: z.array(z.string().min(1).max(40)).max(20).optional(),
  lang: z.string().min(2).max(8).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(50).optional()
}).strict()

export type SavedViewFilters = z.infer<typeof filtersSchema>

export interface SavedViewRow {
  id: string
  name: string
  q: string
  filters: SavedViewFilters
  created_at: string
  updated_at: string
}
