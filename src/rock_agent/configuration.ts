import { Annotation } from "@langchain/langgraph"

/**
 * Rock Agent Configuration State
 * This configuration manages settings for the Rock Paper Scissors game agent
 */
export const RockAgentConfiguration = Annotation.Root({
  /**
   * LLM model configuration
   */
  llm: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => process.env.ROCK_AGENT_MODEL || "gpt-3.5-turbo",
  }),

  /**
   * Temperature for LLM responses
   * Higher values make responses more creative/random
   */
  llmTemperature: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0.7,
  }),

  /**
   * Maximum number of retries for tool calls
   */
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 3,
  }),

  /**
   * Whether to show detailed game statistics
   */
  showDetailedStats: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => true,
  }),

  /**
   * Language for game messages
   */
  language: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "ja",
  }),

  /**
   * Whether to enable Baba's special giant power mode (easter egg)
   */
  giantMode: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
})

export type RockAgentConfigurationType = typeof RockAgentConfiguration.State
