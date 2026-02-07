import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai"

let openAIProviderInstance: OpenAIProvider | null = null

export function resetOpenAIProviderForTesting() {
  openAIProviderInstance = null
}

export function getOpenAIProvider() {
  if (openAIProviderInstance) {
    return openAIProviderInstance
  }

  const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  const replitBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  const directApiKey = process.env.OPENAI_API_KEY

  if (replitApiKey && replitBaseURL) {
    console.log('[OpenAI] Using Replit AI Integrations')
    openAIProviderInstance = createOpenAI({
      apiKey: replitApiKey,
      baseURL: replitBaseURL,
    })
  } else if (directApiKey) {
    console.log('[OpenAI] Using direct OpenAI API connection')
    openAIProviderInstance = createOpenAI({
      apiKey: directApiKey,
    })
  } else {
    console.warn('[OpenAI] No API key configured. Set OPENAI_API_KEY or use Replit AI Integrations.')
    openAIProviderInstance = createOpenAI({
      apiKey: '',
    })
  }

  return openAIProviderInstance
}

export function getOpenAIModel(model: string = "gpt-4o") {
  return getOpenAIProvider()(model)
}
