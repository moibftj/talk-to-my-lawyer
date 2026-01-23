/**
 * Shared OpenAI client configuration
 *
 * This module provides a centralized OpenAI client using direct connection.
 * Uses OPENAI_API_KEY environment variable.
 */

import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai"

let openAIProviderInstance: OpenAIProvider | null = null

/**
 * Get an OpenAI provider configured for direct connection
 *
 * @returns OpenAI provider function (call with model name to get a model)
 */
export function getOpenAIProvider() {
  if (openAIProviderInstance) {
    return openAIProviderInstance
  }

  // Direct OpenAI connection
  // Uses OPENAI_API_KEY environment variable by default
  openAIProviderInstance = createOpenAI()

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
