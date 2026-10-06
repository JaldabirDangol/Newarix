import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { store } from './kv'
import { WorkLimit } from './concurrency'
import { isAllowedPoster } from '#/lib/images'

const imageWork = new WorkLimit(4)

const MAX_BYTES = 8 * 1024 * 1024
export const IMAGE_WIDTHS = [64, 128, 225, 320, 450, 640, 960] as const

export function posterUrl(value: string): URL {
  const url = new URL(value)
  if (!isAllowedPoster(url)) throw new Error('Unsupported image URL')
  url.hash = ''
  return url
}

export async function avatarImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024 || file.size === 0)
    throw new Error('Choose an image smaller than 5 MB.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP image.')
  return imageWork.run(async () => {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25_000_000,
      failOn: 'error',
    })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format))
      throw new Error('Choose a JPEG, PNG or WebP image.')
    return (
      await image
        .rotate()
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer()
    ).toString('base64')
  })
}

const pending = new Map<string, Promise<Buffer>>()
export async function resizedPoster(url: URL, width: number): Promise<Buffer> {
  const key = `nx:img:${createHash('sha256').update(`${url.href}:${width}`).digest('hex')}`
  const cached = await store.get(key)
  if (cached) return Buffer.from(cached, 'base64')
  const running = pending.get(key)
  if (running) return running
  const task = imageWork
    .run(async () => {
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok || !response.body) throw new Error('Image unavailable')
      if (Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body.cancel()
        throw new Error('Image too large')
      }
      const reader = response.body.getReader()
      const parts: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_BYTES) {
            await reader.cancel()
            throw new Error('Image too large')
          }
          parts.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const output = await sharp(Buffer.concat(parts), {
        limitInputPixels: 25_000_000,
        failOn: 'error',
      })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      await store.set(key, output.toString('base64'), 7 * 24 * 60 * 60_000)
      return output
    })
    .finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}
