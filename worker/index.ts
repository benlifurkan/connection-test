export interface Env {
  ALLOWED_ORIGIN?: string
  ASSETS: Fetcher
}

function json(body: unknown, status = 200, origin = '*') {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  })
  return new Response(JSON.stringify(body), { status, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '*'
    const allowed = env.ALLOWED_ORIGIN ?? '*'

    if (allowed !== '*' && origin !== allowed) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, allowed)
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    } })

    const url = new URL(request.url)
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true, service: 'connection-test-api', timestamp: new Date().toISOString() }, 200, allowed)
    }

    if (url.pathname === '/api/download' && request.method === 'GET') {
      return json({ ok: true, receivedBytes: 0, timestamp: new Date().toISOString() }, 200, allowed)
    }

    if (url.pathname === '/api/echo' && request.method === 'POST') {
      const raw = await request.text()
      const receivedBytes = new TextEncoder().encode(raw).byteLength
      if (receivedBytes > 10_000) return json({ ok: false, error: 'Payload too large' }, 413, allowed)
      try {
        const echo: unknown = JSON.parse(raw)
        return json({ ok: true, receivedBytes, serverTime: new Date().toISOString(), echo }, 200, allowed)
      } catch {
        return json({ ok: false, error: 'Invalid JSON' }, 400, allowed)
      }
    }

    return env.ASSETS.fetch(request)
  },
}
