import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemRow, SummarySentence } from '@/types/domain'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'

/**
 * Helper to fetch a list of available AI models based on environment variables.
 * They are ordered by preference (Gemini -> OpenRouter).
 */
function getAvailableModels() {
  const models = []
  
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    models.push({ id: 'gemini-2.5-flash', model: google('gemini-2.5-flash') })
    models.push({ id: 'gemini-2.5-pro', model: google('gemini-2.5-pro') })
  }
  
  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter uses the OpenAI SDK format. Appending ':free' guarantees you aren't charged.
    const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
    models.push({ id: 'openrouter/llama-3.1-8b-free', model: openrouter('meta-llama/llama-3.1-8b-instruct:free') })
    models.push({ id: 'openrouter/gemini-flash-free', model: openrouter('google/gemini-2.0-flash-lite-preview-02-05:free') })
  }

  return models
}

/**
 * Generates a summary for a cluster of items.
 *
 * Uses the Vercel AI SDK to generate a 2-4 sentence summary with citations.
 * Automatically falls back through available models. If all fail or no keys
 * are present, uses a deterministic fallback.
 */
export async function generateSummaryText(
  clusterTitle: string,
  items: ItemRow[]
): Promise<{ summary: SummarySentence[]; model: string }> {
  const models = getAvailableModels()

  if (models.length > 0) {
    const prompt = `
      Summarize the following items in 2-4 sentences. It must be factual, with no unsupported claims.
      Use the provided item IDs as citations for the facts you extract.
      
      Items:
      ${JSON.stringify(items.map(i => ({ id: i.id, title: i.title, text: i.text })))}
    `

    // Try models in order (fallback chain)
    for (const { id, model } of models) {
      try {
        const { object } = await generateObject({
          model,
          schema: z.object({
            sentences: z.array(z.object({
              text: z.string().describe("A single factual sentence of the summary."),
              citationItemIds: z.array(z.string()).describe("Array of item IDs that support this sentence.")
            }))
          }),
          prompt,
        })
        
        return { summary: object.sentences, model: id }
      } catch (err) {
        console.error(`Model ${id} failed to generate summary:`, err)
        // continue to next model
      }
    }
  }

  // Deterministic fallback: Use cluster headline and source count
  const topItems = items.slice(0, 3)
  const citations = topItems.map((item) => item.id)

  return {
    model: 'fallback-deterministic',
    summary: [
      {
        text: `Cluster revolves around: ${clusterTitle}.`,
        citationItemIds: [],
      },
      {
        text: `This event has been reported across ${items.length} source(s).`,
        citationItemIds: citations,
      },
    ],
  }
}

/**
 * Recomputes and persists the cluster summary.
 */
export async function updateClusterSummary(
  db: SupabaseClient,
  clusterId: string,
  clusterTitle: string,
  items: ItemRow[]
) {
  if (items.length === 0) return

  const { summary, model } = await generateSummaryText(clusterTitle, items)

  const { data: existing } = await db
    .from('cluster_summaries')
    .select('id, version')
    .eq('cluster_id', clusterId)
    .single()

  if (existing) {
    await db
      .from('cluster_summaries')
      .update({
        summary_json: summary,
        model,
        status: 'ready',
        version: existing.version + 1,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await db.from('cluster_summaries').insert({
      cluster_id: clusterId,
      summary_json: summary,
      model,
      status: 'ready',
      version: 1,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}
