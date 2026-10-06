import { describe, expect, it } from 'vitest'
import { boundedRequest } from './request-limits'

const request = (body: ReadableStream<Uint8Array>, headers?: HeadersInit) =>
  new Request('http://localhost/test', {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  } as RequestInit)
describe('request limits before deserialization', () => {
  it('preserves bytes and trusted peer metadata', async () => {
    const incoming = new Request('http://localhost/test', {
      method: 'POST',
      body: 'hello',
    })
    Object.defineProperty(incoming, 'ip', { value: '127.0.0.1' })
    const safe = await boundedRequest(incoming, 10)
    expect(await safe.text()).toBe('hello')
    expect(Reflect.get(safe, 'ip')).toBe('127.0.0.1')
  })
  it('rejects oversized chunked data without Content-Length', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8))
        controller.enqueue(new Uint8Array(8))
        controller.close()
      },
    })
    await expect(boundedRequest(request(body), 10)).rejects.toMatchObject({
      status: 413,
    })
  })
  it('checks actual bytes even with a false declared size', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(11))
        controller.close()
      },
    })
    await expect(
      boundedRequest(request(body, { 'Content-Length': '1' }), 10),
    ).rejects.toMatchObject({ status: 413 })
  })
  it('rejects declared oversized bodies and compressed input', async () => {
    await expect(
      boundedRequest(
        new Request('http://localhost', {
          method: 'POST',
          body: 'x',
          headers: { 'Content-Length': '11' },
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 })
    await expect(
      boundedRequest(
        new Request('http://localhost', {
          method: 'POST',
          body: 'x',
          headers: { 'Content-Encoding': 'gzip' },
        }),
      ),
    ).rejects.toMatchObject({ status: 415 })
  })
  it('times out a stalled body', async () => {
    await expect(
      boundedRequest(request(new ReadableStream<Uint8Array>()), 10, 5),
    ).rejects.toMatchObject({ status: 408 })
  })
})

it('accepts Nitro-style Request proxies without native private-field errors', async () => {
  const native = new Request('http://localhost/test', {
    method: 'POST',
    body: 'payload',
  })
  const proxy = new Proxy(native, {
    get(target, key) {
      return Reflect.get(target, key, target)
    },
  })
  expect(await (await boundedRequest(proxy)).text()).toBe('payload')
})
