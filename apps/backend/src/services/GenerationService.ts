import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CohereClientV2 } from 'cohere-ai';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('GenerationService');

export interface GenerationOptions {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  model?: string;
}

export interface GenerationResult {
  content: string;
  model: string;
  tokens_used: number;
  provider: string;
  finish_reason: string;
  processing_time: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GenerationService {
  private static instance: GenerationService;
  private googleAI: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private cohere: CohereClientV2 | null = null;
  private availableProviders: string[] = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): GenerationService {
    if (!GenerationService.instance) {
      GenerationService.instance = new GenerationService();
    }
    return GenerationService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Google Gemini 초기화
      if (config.ai.google.api_key) {
        this.googleAI = new GoogleGenerativeAI(config.ai.google.api_key);
        this.availableProviders.push('google');
        logger.info('Google Gemini initialized');
      }

      // OpenAI 초기화
      if (config.ai.openai.api_key) {
        this.openai = new OpenAI({
          apiKey: config.ai.openai.api_key,
        });
        this.availableProviders.push('openai');
        logger.info('OpenAI initialized');
      }

      // Anthropic 초기화
      if (config.ai.anthropic.api_key) {
        this.anthropic = new Anthropic({
          apiKey: config.ai.anthropic.api_key,
        });
        this.availableProviders.push('anthropic');
        logger.info('Anthropic Claude initialized');
      }

      // Cohere 초기화
      if (config.ai.cohere.api_key) {
        this.cohere = new CohereClientV2({
          token: config.ai.cohere.api_key,
        });
        this.availableProviders.push('cohere');
        logger.info('Cohere initialized');
      }

      logger.info('Generation service initialized', {
        availableProviders: this.availableProviders,
        totalProviders: this.availableProviders.length,
      });

    } catch (error) {
      logger.logError(error as Error, 'Failed to initialize generation service');
    }
  }

  public async generateResponse(
    messages: ChatMessage[],
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    if (this.availableProviders.length === 0) {
      throw new Error('No AI providers available');
    }

    // 기본 옵션 설정
    const defaultOptions: GenerationOptions = {
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.9,
      model: options.model || 'auto',
    };

    // 모델이 'auto'면 사용 가능한 첫 번째 프로바이더 선택
    let selectedProvider: string;
    let selectedModel: string;

    if (defaultOptions.model === 'auto') {
      selectedProvider = this.availableProviders[0] || 'google';
      selectedModel = this.getDefaultModelForProvider(selectedProvider);
    } else {
      const [provider, model] = this.parseModelString(defaultOptions.model!);
      selectedProvider = provider;
      selectedModel = model;
    }

    const startTime = Date.now();

    try {
      let result: GenerationResult;

      switch (selectedProvider) {
        case 'google':
          result = await this.generateWithGoogle(messages, selectedModel, defaultOptions);
          break;
        case 'openai':
          result = await this.generateWithOpenAI(messages, selectedModel, defaultOptions);
          break;
        case 'anthropic':
          result = await this.generateWithAnthropic(messages, selectedModel, defaultOptions);
          break;
        case 'cohere':
          result = await this.generateWithCohere(messages, selectedModel, defaultOptions);
          break;
        default:
          throw new Error(`Unsupported provider: ${selectedProvider}`);
      }

      result.processing_time = Date.now() - startTime;

      logger.info('Generation completed successfully', {
        provider: selectedProvider,
        model: selectedModel,
        tokensUsed: result.tokens_used,
        processingTime: `${result.processing_time}ms`,
        contentLength: result.content.length,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.logError(error as Error, 'Generation failed', {
        provider: selectedProvider,
        model: selectedModel,
        processingTime: `${processingTime}ms`,
      });
      
      throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateWithGoogle(
    messages: ChatMessage[],
    model: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.googleAI) {
      throw new Error('Google AI not initialized');
    }

    const genModel = this.googleAI.getGenerativeModel({ model });
    
    // 메시지를 Google Gemini 형식으로 변환
    const prompt = this.formatMessagesForGoogle(messages);
    
    const generationConfig: any = {
      maxOutputTokens: options.max_tokens,
      temperature: options.temperature,
      topP: options.top_p,
      topK: options.top_k,
    };
    
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      generationConfig.stopSequences = options.stop_sequences;
    }
    
    const result = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const content = response.text();
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

    return {
      content,
      model,
      tokens_used: tokensUsed,
      provider: 'google',
      finish_reason: 'stop',
      processing_time: 0, // 상위에서 설정
    };
  }

  private async generateWithOpenAI(
    messages: ChatMessage[],
    model: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const requestParams: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      top_p: options.top_p,
    };
    
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      requestParams.stop = options.stop_sequences;
    }
    
    const response = await this.openai.chat.completions.create(requestParams);

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choices received from OpenAI');
    }
    
    const tokensUsed = response.usage?.total_tokens || 0;

    return {
      content: choice.message.content || '',
      model,
      tokens_used: tokensUsed,
      provider: 'openai',
      finish_reason: choice.finish_reason || 'stop',
      processing_time: 0,
    };
  }

  private async generateWithAnthropic(
    messages: ChatMessage[],
    model: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic not initialized');
    }

    // 시스템 메시지와 사용자 메시지 분리
    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    const anthropicParams: any = {
      model,
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature,
      top_p: options.top_p,
      system: systemMessage,
      messages: conversationMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    };
    
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      anthropicParams.stop_sequences = options.stop_sequences;
    }

    const response = await this.anthropic.messages.create(anthropicParams);

    const content = response.content[0];
    if (!content) {
      throw new Error('No content received from Anthropic');
    }
    
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    return {
      content: content.type === 'text' ? content.text : '',
      model,
      tokens_used: tokensUsed,
      provider: 'anthropic',
      finish_reason: response.stop_reason || 'stop',
      processing_time: 0,
    };
  }

  private async generateWithCohere(
    messages: ChatMessage[],
    model: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.cohere) {
      throw new Error('Cohere not initialized');
    }

    // Cohere는 채팅 형식을 지원하므로 메시지 변환
    const chatHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role as 'USER' | 'CHATBOT',
      message: msg.content,
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('No messages provided');
    }

    const cohereParams: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role === 'user' ? 'USER' : 'ASSISTANT' as const,
        content: [{ type: 'text', text: msg.content }],
      })),
      maxTokens: options.max_tokens,
      temperature: options.temperature,
      p: options.top_p,
    };
    
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      cohereParams.stopSequences = options.stop_sequences;
    }

    const response = await this.cohere.chat(cohereParams);

    const usage = response.usage as any;
    const tokensUsed = usage ? (usage.inputTokens || 0) + (usage.outputTokens || 0) : 0;

    const messageContent = response.message?.content?.[0];
    const responseText = messageContent && 'text' in messageContent ? messageContent.text : '';

    return {
      content: responseText,
      model,
      tokens_used: tokensUsed,
      provider: 'cohere',
      finish_reason: response.finishReason || 'COMPLETE',
      processing_time: 0,
    };
  }

  private formatMessagesForGoogle(messages: ChatMessage[]): string {
    return messages
      .map(msg => {
        const rolePrefix = msg.role === 'system' ? 'System: ' : 
                          msg.role === 'user' ? 'Human: ' : 'Assistant: ';
        return `${rolePrefix}${msg.content}`;
      })
      .join('\n\n');
  }

  private parseModelString(modelString: string): [string, string] {
    if (modelString.includes('gpt')) return ['openai', modelString];
    if (modelString.includes('claude')) return ['anthropic', modelString];
    if (modelString.includes('command')) return ['cohere', modelString];
    if (modelString.includes('gemini')) return ['google', modelString];
    
    // 기본값
    return [this.availableProviders[0] || 'google', this.getDefaultModelForProvider(this.availableProviders[0] || 'google')];
  }

  private getDefaultModelForProvider(provider: string): string {
    switch (provider) {
      case 'google':
        return 'gemini-2.0-flash-exp';
      case 'openai':
        return 'gpt-4o';
      case 'anthropic':
        return 'claude-3-5-haiku-20241022';
      case 'cohere':
        return 'command-r-plus-08-2024';
      default:
        return 'gemini-2.0-flash-exp';
    }
  }

  public getAvailableProviders(): string[] {
    return [...this.availableProviders];
  }

  public getAvailableModels(): Record<string, string[]> {
    const models: Record<string, string[]> = {};

    if (this.availableProviders.includes('google')) {
      models.google = ['gemini-2.0-flash-exp', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002'];
    }

    if (this.availableProviders.includes('openai')) {
      models.openai = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
    }

    if (this.availableProviders.includes('anthropic')) {
      models.anthropic = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
    }

    if (this.availableProviders.includes('cohere')) {
      models.cohere = ['command-r-plus-08-2024', 'command-r-08-2024'];
    }

    return models;
  }

  public async healthCheck(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {};

    for (const provider of this.availableProviders) {
      try {
        const testMessages: ChatMessage[] = [
          { role: 'user', content: 'Hello, this is a health check. Please respond with "OK".' }
        ];

        const result = await this.generateResponse(testMessages, {
          max_tokens: 10,
          temperature: 0,
          model: `${provider}:auto`,
        });

        healthStatus[provider] = result.content.length > 0;
      } catch (error) {
        logger.warn(`Health check failed for ${provider}`, error as Record<string, unknown>);
        healthStatus[provider] = false;
      }
    }

    return healthStatus;
  }
}

// 싱글톤 인스턴스 export
export const generationService = GenerationService.getInstance();