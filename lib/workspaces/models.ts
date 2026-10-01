/**
 * Workspace AI model fallback chain.
 *
 * 6 providers — none overlap with the existing summarizer (lib/summarizer.ts).
 * Env vars are workspace-prefixed (WORKSPACE_*) to avoid any collision.
 *
 * Order: Gemini → Groq → Cohere → Mistral → DeepSeek → OpenRouter
 * Each has a generous free tier.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

// Dynamic imports for optional providers — only loaded if keys exist
async function getWorkspaceModels(): Promise<{ id: string; model: LanguageModel }[]> {
  const chain: { id: string; model: LanguageModel }[] = []

  // 1. Google Gemini — 1M tokens/day free
  if (process.env.WORKSPACE_GEMINI_API_KEY) {
    try {
      const g = createGoogleGenerativeAI({ apiKey: process.env.WORKSPACE_GEMINI_API_KEY })
      chain.push({ id: 'gemini/gemini-2.0-flash', model: g('gemini-2.0-flash') as LanguageModel })
    } catch { /* provider not available */ }
  }

  // 2. Groq — 500K tokens/day free, extremely fast
  if (process.env.WORKSPACE_GROQ_API_KEY) {
    try {
      const { createGroq } = await import('@ai-sdk/groq')
      const groq = createGroq({ apiKey: process.env.WORKSPACE_GROQ_API_KEY })
      chain.push({ id: 'groq/llama-3.3-70b', model: groq('llama-3.3-70b-versatile') as LanguageModel })
    } catch { /* provider not available */ }
  }

  // 3. Cohere — trial credits + free tier
  if (process.env.WORKSPACE_COHERE_API_KEY) {
    try {
      const { createCohere } = await import('@ai-sdk/cohere')
      const cohere = createCohere({ apiKey: process.env.WORKSPACE_COHERE_API_KEY })
      chain.push({ id: 'cohere/command-r-plus', model: cohere('command-r-plus') as LanguageModel })
    } catch { /* provider not available */ }
  }

  // 4. Mistral — free open-mistral-nemo tier
  if (process.env.WORKSPACE_MISTRAL_API_KEY) {
    try {
      const { createMistral } = await import('@ai-sdk/mistral')
      const mistral = createMistral({ apiKey: process.env.WORKSPACE_MISTRAL_API_KEY })
      chain.push({ id: 'mistral/open-mistral-nemo', model: mistral('open-mistral-nemo') as LanguageModel })
    } catch { /* provider not available */ }
  }

  // 5. DeepSeek — extremely generous/cheap
  if (process.env.WORKSPACE_DEEPSEEK_API_KEY) {
    try {
      const { createDeepSeek } = await import('@ai-sdk/deepseek')
      const deepseek = createDeepSeek({ apiKey: process.env.WORKSPACE_DEEPSEEK_API_KEY })
      chain.push({ id: 'deepseek/deepseek-chat', model: deepseek('deepseek-chat') as LanguageModel })
    } catch { /* provider not available */ }
  }

  // 6. OpenRouter — access to free Llama/Mistral models
  if (process.env.WORKSPACE_OPENROUTER_API_KEY) {
    try {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
      const openrouter = createOpenRouter({ apiKey: process.env.WORKSPACE_OPENROUTER_API_KEY })
      chain.push({ id: 'openrouter/meta-llama/llama-3.1-8b-instruct:free', model: openrouter('meta-llama/llama-3.1-8b-instruct:free') as LanguageModel })
    } catch { /* provider not available */ }
  }

  return chain
}

/**
 * Runs fn against each model in the fallback chain.
 * Returns the first successful result with the model ID used.
 * Returns null if all models fail or no models are configured.
 */
export async function runWithFallback<T>(
  fn: (model: LanguageModel) => Promise<T>,
): Promise<{ result: T; modelId: string } | null> {
  const models = await getWorkspaceModels()

  if (models.length === 0) {
    console.warn('[workspace/models] No workspace AI models configured. Add WORKSPACE_*_API_KEY env vars.')
    return null
  }

  for (const { id, model } of models) {
    try {
      const result = await fn(model)
      return { result, modelId: id }
    } catch (err) {
      console.warn(`[workspace/models] Model ${id} failed, trying next:`, err instanceof Error ? err.message : err)
    }
  }

  console.error('[workspace/models] All models in the fallback chain failed.')
  return null
}
