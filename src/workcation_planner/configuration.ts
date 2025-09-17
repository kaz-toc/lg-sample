import { Annotation } from "@langchain/langgraph"
import { RunnableConfig } from "@langchain/core/runnables"
import { CONDITION_CHECK_PROMPT, PLAN_GENERATION_PROMPT } from "./prompts.js"
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_LANGUAGE,
} from "../shared/constants.js"
import { DEFAULT_MAX_SEARCH_RESULTS } from "./constants.js"

/**
 * Workcation Planner Configuration
 * ワーケーションプランナーの設定管理
 */
export const WorkcationPlannerConfiguration = Annotation.Root({
  /**
   * LLMモデルの設定
   */
  model: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => DEFAULT_LLM_MODEL,
  }),

  /**
   * 検索結果の最大数
   */
  maxSearchResults: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => DEFAULT_MAX_SEARCH_RESULTS,
  }),

  /**
   * リトライの最大回数
   */
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => DEFAULT_MAX_RETRIES,
  }),

  /**
   * 言語設定
   */
  language: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => DEFAULT_LANGUAGE,
  }),

  /**
   * プロンプトテンプレート（条件確認用）
   */
  conditionCheckPrompt: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => CONDITION_CHECK_PROMPT,
  }),

  /**
   * プロンプトテンプレート（プラン作成用）
   */
  planGenerationPrompt: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => PLAN_GENERATION_PROMPT,
  }),
})

export type WorkcationPlannerConfigurationType =
  typeof WorkcationPlannerConfiguration.State

/**
 * 設定を確実に取得する関数
 */
export function ensureConfiguration(
  config?: RunnableConfig,
): WorkcationPlannerConfigurationType {
  const configurable = config?.configurable || {}

  return {
    model: configurable.model ?? DEFAULT_LLM_MODEL,
    maxSearchResults:
      configurable.maxSearchResults ?? DEFAULT_MAX_SEARCH_RESULTS,
    maxRetries: configurable.maxRetries ?? DEFAULT_MAX_RETRIES,
    language: configurable.language ?? DEFAULT_LANGUAGE,
    conditionCheckPrompt:
      configurable.conditionCheckPrompt ?? CONDITION_CHECK_PROMPT,
    planGenerationPrompt:
      configurable.planGenerationPrompt ?? PLAN_GENERATION_PROMPT,
  }
}
