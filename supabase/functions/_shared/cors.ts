// CORS configuration for Edge Functions

// Strict CORS allowlist - modify this for your domains
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  // Add your production domains here
  // 'https://yourapp.vercel.app',
]

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  
  // Check if origin is in allowlist
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.includes('vercel.app')
  
  return {
    ...defaultCorsHeaders,
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}