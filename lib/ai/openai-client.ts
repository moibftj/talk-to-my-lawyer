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

  if (apiKey) {
    openAIProviderInstance = createOpenAI({
      apiKey: apiKey,
    })
  } else {
    console.warn('[OpenAI] OPENAI_API_KEY is not configured.')
    openAIProviderInstance = createOpenAI({
      apiKey: '',
    })
  }

  return openAIProviderInstance
}

export function getOpenAIModel(model: string = "gpt-4o") {
  return getOpenAIProvider()(model)
}
