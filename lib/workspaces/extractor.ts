/**
 * Workspace resource extractor.
 * Deterministic — no AI. Extracts content from URLs before agents run.
 */

import type { ResourceType } from '@/types/workspace'

export type ExtractResult = {
  title: string | null
  text: string | null
  meta: Record<string, unknown>
  resourceType: ResourceType
  error: string | null
}

/** Detects the resource type from a URL */
export function detectResourceType(url: string): ResourceType {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube'
    if (host === 'reddit.com' || host === 'old.reddit.com') return 'reddit'
    if (host === 'github.com' || host === 'raw.githubusercontent.com') return 'github'
    if (u.pathname.toLowerCase().endsWith('.pdf')) return 'pdf'
    return 'article'
  } catch {
    return 'other_url'
  }
}

/** Extracts YouTube video ID from any YouTube URL */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /embed\/([^?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

/** Strips HTML tags and collapses whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extracts an og: or meta tag value from HTML */
function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1].trim()
  }
  return null
}

/** Extracts title tag from HTML */
function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim() : null
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WorkspaceBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('text/html') && !ct.includes('application/json')) {
    throw new Error(`Unexpected content type: ${ct}`)
  }
  return res.text()
}

// -------------------------------------------------------
// Per-type extractors
// -------------------------------------------------------

async function extractYouTube(url: string): Promise<ExtractResult> {
  const videoId = extractYouTubeId(url)
  if (!videoId) return { title: null, text: null, meta: {}, resourceType: 'youtube', error: 'Could not parse YouTube video ID' }

  try {
    // Fetch oEmbed for title/author
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as { title?: string; author_name?: string }
      return {
        title: data.title ?? null,
        text: `YouTube video: ${data.title ?? 'Unknown'}. Channel: ${data.author_name ?? 'Unknown'}.`,
        meta: { videoId, author: data.author_name, embedUrl: `https://www.youtube.com/embed/${videoId}` },
        resourceType: 'youtube',
        error: null,
      }
    }
  } catch { /* fall through */ }

  // Fallback: just use the video ID
  return {
    title: `YouTube Video (${videoId})`,
    text: `YouTube video with ID: ${videoId}`,
    meta: { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` },
    resourceType: 'youtube',
    error: null,
  }
}

async function extractReddit(url: string): Promise<ExtractResult> {
  try {
    const jsonUrl = url.replace(/\/?$/, '.json')
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'WorkspaceBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as unknown[]
    // Reddit JSON structure: [listing of post, listing of comments]
    const post = (data[0] as { data?: { children?: { data?: { title?: string; selftext?: string; subreddit?: string } }[] } })
      ?.data?.children?.[0]?.data
    if (!post) throw new Error('Could not parse Reddit post data')
    return {
      title: post.title ?? null,
      text: [post.title, post.selftext].filter(Boolean).join('\n\n').slice(0, 4000),
      meta: { subreddit: post.subreddit },
      resourceType: 'reddit',
      error: null,
    }
  } catch (err) {
    return { title: null, text: null, meta: {}, resourceType: 'reddit', error: String(err) }
  }
}

async function extractGitHub(url: string): Promise<ExtractResult> {
  try {
    // Convert to raw README URL
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) throw new Error('Could not parse GitHub URL')
    const [, owner, repo] = match
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const firstLine = text.split('\n').find(l => l.trim())?.replace(/^#+\s*/, '') ?? `${owner}/${repo}`
    return {
      title: firstLine,
      text: text.slice(0, 4000),
      meta: { owner, repo, rawUrl },
      resourceType: 'github',
      error: null,
    }
  } catch (err) {
    return { title: null, text: null, meta: {}, resourceType: 'github', error: String(err) }
  }
}

async function extractArticle(url: string): Promise<ExtractResult> {
  try {
    const html = await fetchHtml(url)
    const title = extractMeta(html, 'title') ?? extractTitle(html)
    const description = extractMeta(html, 'description')

    // Extract main content — look for article/main tags first
    const articleMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const rawContent = articleMatch ? articleMatch[1] : html
    const text = stripHtml(rawContent).slice(0, 4000)

    return {
      title,
      text: [description, text].filter(Boolean).join('\n\n').slice(0, 4000),
      meta: { description },
      resourceType: 'article',
      error: null,
    }
  } catch (err) {
    return { title: null, text: null, meta: {}, resourceType: 'article', error: String(err) }
  }
}

async function extractOtherUrl(url: string): Promise<ExtractResult> {
  try {
    const html = await fetchHtml(url)
    const title = extractMeta(html, 'title') ?? extractTitle(html)
    const description = extractMeta(html, 'description')
    return {
      title,
      text: description ?? null,
      meta: { description },
      resourceType: 'other_url',
      error: null,
    }
  } catch (err) {
    return { title: null, text: null, meta: {}, resourceType: 'other_url', error: String(err) }
  }
}

// -------------------------------------------------------
// Main entry point
// -------------------------------------------------------

export async function extractResource(url: string): Promise<ExtractResult> {
  const type = detectResourceType(url)

  switch (type) {
    case 'youtube': return extractYouTube(url)
    case 'reddit':  return extractReddit(url)
    case 'github':  return extractGitHub(url)
    case 'pdf': {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        
        // Dynamically import to avoid edge runtime issues if this runs on edge (though it's Node)
        const pdfParse = (await import('pdf-parse')).default
        const data = await pdfParse(Buffer.from(buffer))
        
        return {
          title: data.info?.Title || url.split('/').pop() || 'PDF Document',
          text: data.text.slice(0, 10000), // PDF can be long
          meta: { pages: data.numpages, info: data.info },
          resourceType: 'pdf',
          error: null
        }
      } catch (err) {
        return {
          title: url.split('/').pop() ?? 'PDF Document',
          text: null,
          meta: { note: 'PDF content could not be extracted automatically.' },
          resourceType: 'pdf',
          error: String(err)
        }
      }
    }
    case 'article': return extractArticle(url)
    default:        return extractOtherUrl(url)
  }
}
