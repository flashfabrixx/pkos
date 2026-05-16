import { lookup } from 'node:dns/promises'
import { createError } from 'h3'

const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 8000

const PRIVATE_BLOCKS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i
]

export interface FetchedPage {
  url: string
  finalUrl: string
  contentType: string
  status: number
  bodyText: string
  title: string | null
  description: string | null
}

/**
 * Server-side URL fetcher with SSRF defenses: hostname must resolve to
 * a public IP, redirects don't escape that policy, total size capped,
 * timeout enforced. The bookmarklet endpoint (B6) and any future
 * "extract OG card" feature uses this single chokepoint.
 */
export async function safeFetchUrl(url: string): Promise<FetchedPage> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError({ statusCode: 400, statusMessage: 'URL must be http(s)' })
  }
  await assertPublicHost(parsed.hostname)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'BKOS-WebClipper/1.0 (+https://github.com/your-org/bkos)',
        accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: `Upstream ${response.status}` })
    }
    const contentType = response.headers.get('content-type') || 'text/plain'
    // Re-check the final URL host in case redirects landed somewhere private.
    await assertPublicHost(new URL(response.url).hostname)

    const limited = await readLimited(response, MAX_BYTES)
    const bodyText = limited.text
    return {
      url,
      finalUrl: response.url,
      contentType,
      status: response.status,
      bodyText,
      title: extractTag(bodyText, 'title'),
      description: extractMeta(bodyText, 'description') || extractMeta(bodyText, 'og:description')
    }
  } finally {
    clearTimeout(timer)
  }
}

async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) return { text: await response.text() }
  let received = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        throw createError({ statusCode: 413, statusMessage: 'Response too large' })
      }
      chunks.push(value)
    }
  }
  return { text: new TextDecoder().decode(Buffer.concat(chunks)) }
}

async function assertPublicHost(hostname: string) {
  if (!hostname) {
    throw createError({ statusCode: 400, statusMessage: 'Missing hostname' })
  }
  // DNS resolve once and reject anything that points into private space.
  try {
    const records = await lookup(hostname, { all: true })
    for (const record of records) {
      if (PRIVATE_BLOCKS.some((re) => re.test(record.address))) {
        throw createError({ statusCode: 400, statusMessage: 'Refusing to fetch private address' })
      }
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 400, statusMessage: `Could not resolve host: ${(error as Error).message}` })
  }
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return match?.[1]?.trim() || null
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  const match = html.match(re)
  return match?.[1]?.trim() || null
}
