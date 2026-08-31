/**
 * Vercel Serverless Function: Google Maps Distance Matrix API プロキシ
 *
 * 本番環境では Vite dev proxy が無いため、この関数経由で Distance Matrix API を呼ぶ。
 * API キーはサーバー側の環境変数のみ使用し、クライアントには露出しない。
 */

const GOOGLE_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

function getApiKey() {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ status: 'INVALID_REQUEST', error_message: 'Method not allowed' })
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return res.status(500).json({
      status: 'REQUEST_DENIED',
      error_message: 'Google Maps API key is not configured on the server',
      rows: [],
    })
  }

  const targetUrl = new URL(GOOGLE_DISTANCE_MATRIX_URL)
  const query = req.query || {}

  for (const [key, value] of Object.entries(query)) {
    if (key === 'key') continue
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, String(item)))
    } else if (value != null) {
      targetUrl.searchParams.set(key, String(value))
    }
  }

  targetUrl.searchParams.set('key', apiKey)

  try {
    const response = await fetch(targetUrl.toString())
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Google Maps Distance Matrix proxy error:', error)
    return res.status(502).json({
      status: 'UNKNOWN_ERROR',
      error_message: error instanceof Error ? error.message : 'Upstream request failed',
      rows: [],
    })
  }
}
