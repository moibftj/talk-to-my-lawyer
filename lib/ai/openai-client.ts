import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai"

let openAIProviderInstance: OpenAIProvider | null = null

export function resetOpenAIProviderForTesting() {
  openAIProviderInstance = null
}

export function getOpenAIProvider() {
  if (openAIProviderInstance) {
    return openAIProviderInstance
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('[OpenAI] No API key configured. Set OPENAI_API_KEY environment variable.')
  }

  console.log('[OpenAI] Using direct OpenAI API connection')
  openAIProviderInstance = createOpenAI({
    apiKey: apiKey,
  })

  return openAIProviderInstance
}

export function getOpenAIModel(model: string = "gpt-4o") {
  return getOpenAIProvider()(model)
}
