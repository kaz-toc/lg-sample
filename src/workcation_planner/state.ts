import { Annotation } from "@langchain/langgraph"
import { BaseMessage } from "@langchain/core/messages"

// ワーケーションプランの情報
export interface WorkcationPlan {
  location: string
  duration: string
  budget: string
  accommodations: string[]
  workspaces: string[]
  activities: string[]
  transportation: string
  estimatedCost: string
  tips: string[]
}

// 必須条件の状態
export interface RequiredConditions {
  location: string | null
  duration: string | null
  budget: string | null
}

// エージェントの状態定義
export const WorkcationPlannerState = Annotation.Root({
  // 会話履歴
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 必須条件（場所、時間、予算）
  requiredConditions: Annotation<RequiredConditions>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      location: null,
      duration: null,
      budget: null,
    }),
  }),

  // すべての条件が揃ったかどうか
  conditionsComplete: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),

  // ツール実行結果（検索結果）を保持
  toolResults: Annotation<string[]>({
    reducer: (x, y) => (y.length > 0 ? y : x),
    default: () => [],
  }),

  // 生成されたプランのテキスト
  generatedPlanText: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // 現在のプラン（構造化された形式）
  currentPlan: Annotation<WorkcationPlan | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // リフレクションの結果
  reflectionResult: Annotation<{
    satisfactory: boolean
    feedback: string | null
  } | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // 改善指示
  improvementInstructions: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // 最終的なプラン
  finalPlan: Annotation<WorkcationPlan | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
})

export type WorkcationPlannerStateType = typeof WorkcationPlannerState.State
