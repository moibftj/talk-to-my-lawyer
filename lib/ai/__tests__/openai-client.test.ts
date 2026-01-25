/**
 * OpenAI Client Tests
 *
 * Tests the OpenAI provider configuration and model retrieval
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'

// Mock the @ai-sdk/openai module at the top level
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(),
}))

const mockCreateOpenAI = createOpenAI as any

describe('OpenAI Client', () => {
  let resetOpenAIProviderForTesting: (() => void) | undefined

  beforeEach(async () => {
    vi.clearAllMocks()
    // Import the reset function dynamically
    const module = await import('../openai-client')
    resetOpenAIProviderForTesting = module.resetOpenAIProviderForTesting
    resetOpenAIProviderForTesting()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOpenAIProvider', () => {
    it('should create and return OpenAI provider', async () => {
      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')
      const provider = getOpenAIProvider()

      expect(mockCreateOpenAI).toHaveBeenCalled()
      expect(provider).toBe(mockProvider)
    })

    it('should cache provider instance', async () => {
      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')
      const provider1 = getOpenAIProvider()
      const provider2 = getOpenAIProvider()

      expect(provider1).toBe(provider2)
      expect(mockCreateOpenAI).toHaveBeenCalledTimes(1)
    })

    it('should call createOpenAI with default config', async () => {
      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')
      getOpenAIProvider()

      expect(mockCreateOpenAI).toHaveBeenCalledWith()
    })
  })

  describe('getOpenAIModel', () => {
    it('should return model from provider', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel('gpt-4-turbo')

      expect(model).toBe(mockModel)
      expect(mockProvider).toHaveBeenCalledWith('gpt-4-turbo')
    })

    it('should use gpt-4-turbo as default model', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel()

      expect(mockProvider).toHaveBeenCalledWith('gpt-4-turbo')
      expect(model).toBe(mockModel)
    })

    it('should support custom model names', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      getOpenAIModel('gpt-4o')
      getOpenAIModel('gpt-4o-mini')
      getOpenAIModel('gpt-3.5-turbo')

      expect(mockProvider).toHaveBeenNthCalledWith(1, 'gpt-4o')
      expect(mockProvider).toHaveBeenNthCalledWith(2, 'gpt-4o-mini')
      expect(mockProvider).toHaveBeenNthCalledWith(3, 'gpt-3.5-turbo')
    })

    it('should reuse cached provider', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      getOpenAIModel('gpt-4-turbo')
      getOpenAIModel('gpt-4o')

      expect(mockCreateOpenAI).toHaveBeenCalledTimes(1)
      expect(mockProvider).toHaveBeenCalledTimes(2)
    })
  })

  describe('Environment Integration', () => {
    it('should use OPENAI_API_KEY from environment', async () => {
      const originalKey = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = 'test-key-123'

      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')
      getOpenAIProvider()

      expect(mockCreateOpenAI).toHaveBeenCalled()

      process.env.OPENAI_API_KEY = originalKey
    })

    it('should work with different environment configurations', async () => {
      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')

      // Production-like config
      process.env.OPENAI_API_KEY = 'sk-prod-123'
      let provider = getOpenAIProvider()
      expect(provider).toBeTruthy()

      // Development-like config - should reuse cached provider
      process.env.OPENAI_API_KEY = 'sk-dev-456'
      provider = getOpenAIProvider()
      expect(provider).toBeTruthy()
    })
  })

  describe('Model Configuration', () => {
    it('should support GPT-4 Turbo model', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel('gpt-4-turbo')

      expect(mockProvider).toHaveBeenCalledWith('gpt-4-turbo')
      expect(model).toBeDefined()
    })

    it('should support GPT-4O model', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel('gpt-4o')

      expect(mockProvider).toHaveBeenCalledWith('gpt-4o')
      expect(model).toBeDefined()
    })

    it('should support GPT-4O Mini model', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel('gpt-4o-mini')

      expect(mockProvider).toHaveBeenCalledWith('gpt-4o-mini')
      expect(model).toBeDefined()
    })

    it('should support GPT-3.5 Turbo model', async () => {
      const mockModel = vi.fn()
      const mockProvider = vi.fn().mockReturnValue(mockModel)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model = getOpenAIModel('gpt-3.5-turbo')

      expect(mockProvider).toHaveBeenCalledWith('gpt-3.5-turbo')
      expect(model).toBeDefined()
    })
  })

  describe('Singleton Pattern', () => {
    it('should maintain single provider instance', async () => {
      const mockProvider = vi.fn()
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIProvider } = await import('../openai-client')
      const provider1 = getOpenAIProvider()
      const provider2 = getOpenAIProvider()
      const provider3 = getOpenAIProvider()

      expect(provider1).toBe(provider2)
      expect(provider2).toBe(provider3)
      expect(mockCreateOpenAI).toHaveBeenCalledTimes(1)
    })

    it('should allow different models from same provider', async () => {
      const mockModel1 = vi.fn()
      const mockModel2 = vi.fn()
      const mockProvider = vi.fn()
        .mockReturnValueOnce(mockModel1)
        .mockReturnValueOnce(mockModel2)
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')
      const model1 = getOpenAIModel('gpt-4-turbo')
      const model2 = getOpenAIModel('gpt-4o')

      expect(mockProvider).toHaveBeenCalledTimes(2)
      expect(model1).toBe(mockModel1)
      expect(model2).toBe(mockModel2)
    })
  })

  describe('Error Handling', () => {
    it('should propagate provider creation errors', async () => {
      mockCreateOpenAI.mockImplementation(() => {
        throw new Error('OpenAI API key not configured')
      })

      const { getOpenAIProvider } = await import('../openai-client')

      expect(() => getOpenAIProvider()).toThrow('OpenAI API key not configured')
    })

    it('should propagate model retrieval errors', async () => {
      const mockProvider = vi.fn().mockImplementation(() => {
        throw new Error('Model not found')
      })
      mockCreateOpenAI.mockReturnValue(mockProvider)

      const { getOpenAIModel } = await import('../openai-client')

      expect(() => getOpenAIModel('invalid-model')).toThrow('Model not found')
    })
  })
})
