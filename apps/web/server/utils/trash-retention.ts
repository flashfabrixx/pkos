/**
 * How long an item stays in the trash before it gets purged
 * automatically. The frontend uses this to render a countdown next to
 * each row; the trash:purge scheduled task uses it as the cutoff for
 * hard-delete.
 *
 * Shared in a tiny util so the two sides cannot drift apart silently.
 */
export const TRASH_RETENTION_DAYS = 30
