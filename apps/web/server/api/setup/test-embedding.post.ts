import { embedTexts } from '../../utils/embedding'

/**
 * Smoke-test the configured embedding provider during onboarding. The
 * client can read the result to decide whether to surface a warning
 * banner before the operator finishes setup.
 */
export default defineEventHandler(async () => {
  const result = await embedTexts(['PKOS provider smoke test']).catch(() => null)
  if (!result || !result[0]) return { ok: false, provider: 'placeholder', dim: 0 }
  const vector = result[0].vector
  return {
    ok: Boolean(vector && vector.length > 0),
    provider: result[0].provider,
    dim: vector?.length || 0,
    model: result[0].model
  }
})
