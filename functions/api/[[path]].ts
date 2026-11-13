export interface Env {
  ALLOWED_ORIGIN?: string
}

const corsHeaders = (origin: string, allowedOrigin: string) => ({
  'Access-Control-Allow-Origin': allowedOrigin === '*' || origin === allowedOrigin ? origin : allowedOrigin,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, max-age=0',
  'Vary': 'Origin',
})

function response(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? '*'
    const allowedOrigin = env.ALLOWED_ORIGIN ?? '*'
    const headers = corsHeaders(origin, allowedOrigin)

    if (allowedOrigin !== '*' && origin !== allowedOrigin) {
      return response({ ok: false, error: 'Origin not allowed' }, 403, headers)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return response({ ok: true, service: 'connection-test-api', timestamp: new Date().toISOString() }, 200, headers)
    }

    if (url.pathname === '/api/download' && request.method === 'GET') {
      return response({ ok: true, receivedBytes: 0, timestamp: new Date().toISOString() }, 200, headers)
    }

    if (url.pathname === '/api/echo' && request.method === 'POST') {
      const declaredLength = Number(request.headers.get('Content-Length') ?? 0)
      if (declaredLength > 10_000) return response({ ok: false, error: 'Payload too large' }, 413, headers)
      const raw = await request.text()
      const receivedBytes = new TextEncoder().encode(raw).byteLength
      if (receivedBytes > 10_000) return response({ ok: false, error: 'Payload too large' }, 413, headers)

      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch {
        return response({ ok: false, error: 'Invalid JSON' }, 400, headers)
      }

      return response({
        ok: true,
        receivedBytes,
        serverTime: new Date().toISOString(),
        echo: payload,
      }, 200, headers)
    }

    return response({ ok: false, error: 'Not found' }, 404, headers)
  },
}
