import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export interface StoredFile {
  /** Relative path under the store root; safe to round-trip as DB text. */
  storagePath: string
  sizeBytes: number
  checksumSha256: string
}

/**
 * Minimal file-store interface. The current implementation writes to the
 * local filesystem under `PKOS_FILES_PATH`. A future S3 backend can slot
 * in by implementing the same three methods without touching callers.
 */
export interface FileStore {
  put(filename: string, data: Buffer | Uint8Array): Promise<StoredFile>
  read(storagePath: string): Promise<Buffer>
  remove(storagePath: string): Promise<void>
}

let cachedStore: FileStore | null = null

export function getFileStore(): FileStore {
  if (cachedStore) return cachedStore
  const config = useRuntimeConfig() as { filesPath?: string }
  const root = resolve(process.cwd(), config.filesPath || './files')
  cachedStore = new LocalFileStore(root)
  return cachedStore
}

class LocalFileStore implements FileStore {
  constructor(private root: string) {}

  async put(filename: string, data: Buffer | Uint8Array): Promise<StoredFile> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const id = randomUUID()
    // 256 shards keep any single directory small even when a workspace
    // grows to hundreds of thousands of attachments.
    const shard = id.slice(0, 2)
    const folder = join(this.root, shard)
    await mkdir(folder, { recursive: true })
    const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file'
    const storagePath = join(shard, `${id}__${safeName}`)
    await writeFile(join(this.root, storagePath), buffer)
    const checksum = createHash('sha256').update(buffer).digest('hex')
    return { storagePath, sizeBytes: buffer.byteLength, checksumSha256: checksum }
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(join(this.root, storagePath))
  }

  async remove(storagePath: string): Promise<void> {
    try {
      await unlink(join(this.root, storagePath))
    } catch {
      // best-effort; missing file = already gone
    }
  }
}
