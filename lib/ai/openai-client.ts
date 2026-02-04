/**
 * Shared OpenAI client configuration
 *
 * This module provides a centralized OpenAI client with support for:
 * 1. Emergent Universal Key (via proxy) - default when EMERGENT_LLM_KEY or sk-emergent-* key is used
 * 2. Direct OpenAI API - when using standard OpenAI API key (sk-*)
 * 
 * Uses OPENAI_API_KEY environment variable.
 */

import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai"

let openAIProviderInstance: OpenAIProvider | null = null

// Emergent LLM proxy endpoint for universal key
const EMERGENT_BASE_URL = "https://ai.emergentmethods.ai/v1"

// Test-only: reset the singleton cache
export function resetOpenAIProviderForTesting() {
  openAIProviderInstance = null
}

/**
 * Check if the API key is an Emergent Universal Key
 */
function isEmergentKey(apiKey: string | undefined): boolean {
  return !!apiKey && apiKey.startsWith('sk-emergent-')
}

/**
 * Get an OpenAI provider configured for either Emergent or direct OpenAI
 *
 * @returns OpenAI provider function (call with model name to get a model)
 */
export function getOpenAIProvider() {
  if (openAIProviderInstance) {
    return openAIProviderInstance
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY

  if (!apiKey) {
    console.warn('[OpenAI] No API key configured. Set OPENAI_API_KEY or EMERGENT_LLM_KEY environment variable.')
  }

  // Use Emergent proxy for universal key, otherwise direct OpenAI
  if (isEmergentKey(apiKey)) {
    console.log('[OpenAI] Using Emergent Universal Key with proxy endpoint')
    openAIProviderInstance = createOpenAI({
      apiKey: apiKey,
      baseURL: EMERGENT_BASE_URL,
    })
  } else {
    console.log('[OpenAI] Using direct OpenAI API connection')
    openAIProviderInstance = createOpenAI({
      apiKey: apiKey,
    })
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
