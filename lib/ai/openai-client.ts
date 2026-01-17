/**
 * Shared OpenAI client configuration with Vercel AI Gateway support
 *
 * This module provides a centralized OpenAI client that can route through
 * Vercel AI Gateway when AI_GATEWAY_API_KEY is configured, providing:
 * - Request/response logging
 * - Rate limiting
 * - Cost tracking
 * - Caching
 * - Fallback models
 */

import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai"

let openAIProviderInstance: OpenAIProvider | null = null

/**
 * Get an OpenAI provider configured for Vercel AI Gateway (if available)
 * or direct OpenAI connection (fallback)
 *
 * @returns OpenAI provider function (call with model name to get a model)
 */
export function getOpenAIProvider() {
  if (openAIProviderInstance) {
    return openAIProviderInstance
  }

  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY

  if (gatewayApiKey) {
    // Route through Vercel AI Gateway for enhanced observability and control
    openAIProviderInstance = createOpenAI({
      baseURL: 'https://gateway.vercel.ai/api/providers/openai',
      apiKey: gatewayApiKey,
    })
  } else {
    // Direct OpenAI connection (fallback)
    // Uses OPENAI_API_KEY environment variable by default
    openAIProviderInstance = createOpenAI()
  }

  return openAIProviderInstance
}

/**
 * Get an OpenAI model instance
 *
 * @param model - Model name (default: "gpt-4-turbo")
 * @returns OpenAI model instance
 */
export function getOpenAIModel(model: string = "gpt-4-turbo") {
  return getOpenAIProvider()(model)
}
