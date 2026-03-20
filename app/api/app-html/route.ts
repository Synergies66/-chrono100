import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const html = readFileSync(join(process.cwd(), 'public/app.html'), 'utf8')
  const injected = html
    .replace(/MAPBOX_TOKEN_PLACEHOLDER/g, process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '')
  return new Response(injected, {
    headers: { 'Content-Type': 'text/html' }
  })
}
