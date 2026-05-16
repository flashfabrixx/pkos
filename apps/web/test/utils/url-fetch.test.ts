import { describe, expect, it } from 'vitest'
import { safeFetchUrl } from '../../server/utils/url-fetch'

describe('safeFetchUrl SSRF guard', () => {
  it('rejects non-http schemes', async () => {
    await expect(safeFetchUrl('file:///etc/passwd')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects loopback addresses', async () => {
    await expect(safeFetchUrl('http://127.0.0.1/internal')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects RFC1918 ranges', async () => {
    await expect(safeFetchUrl('http://10.0.0.1/admin')).rejects.toMatchObject({ statusCode: 400 })
    await expect(safeFetchUrl('http://192.168.1.1')).rejects.toMatchObject({ statusCode: 400 })
    await expect(safeFetchUrl('http://172.16.0.5')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects link-local', async () => {
    await expect(safeFetchUrl('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject({ statusCode: 400 })
  })
})
