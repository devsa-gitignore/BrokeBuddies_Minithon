import { requireUser, apiError } from '@/lib/api'
import { runWorkspacePipeline, type PipelineProgress } from '@/lib/workspaces/pipeline'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120 // 2 min serverless limit

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  // Server-Sent Events stream so the UI can show progress
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: PipelineProgress) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Need a fresh server client inside the stream callback
      const db = await createClient()

      await runWorkspacePipeline(db, id, user.id, send)
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
