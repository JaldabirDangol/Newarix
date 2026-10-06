// Enforce limits before the framework parses JSON or multipart data, including
// chunked bodies whose sender omits or lies about Content-Length.
export const MAX_REQUEST_BYTES = 6 * 1024 * 1024
export class RequestLimitError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function boundedRequest(
  request: Request,
  maxBytes = MAX_REQUEST_BYTES,
  timeoutMs = 15_000,
): Promise<Request> {
  if (request.url.length > 8192)
    throw new RequestLimitError(414, 'Request URI too long')
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new RequestLimitError(413, 'Request body too large')
  if (!request.body) return request
  // Accept no compressed bodies: limits must apply to what the parser sees.
  const encoding = request.headers.get('content-encoding')
  if (encoding && encoding !== 'identity')
    throw new RequestLimitError(415, 'Unsupported content encoding')
  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RequestLimitError(408, 'Request body timeout')),
      timeoutMs,
    )
  })
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout])
      if (done) break
      size += value.byteLength
      if (size > maxBytes)
        throw new RequestLimitError(413, 'Request body too large')
      parts.push(value)
    }
    // Nitro may supply a Request proxy, which fails Undici's private-field
    // checks if passed to the native Request constructor directly.
    const bounded = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: Buffer.concat(parts),
      signal: request.signal,
    })
    // Nitro/h3 attach the trusted peer identity to the incoming Request.
    // Preserve it; never derive it from client-supplied forwarding headers.
    for (const property of ['context', 'ip']) {
      if (property in request)
        Object.defineProperty(bounded, property, {
          value: Reflect.get(request, property),
          configurable: true,
        })
    }
    return bounded
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}
