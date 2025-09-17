import { StateGraph, END, Annotation } from "@langchain/langgraph"
import { RunnableConfig } from "@langchain/core/runnables"
import { z } from "zod"
import {
  WorkcationPlannerState,
  WorkcationPlannerStateType,
  WorkcationPlan,
} from "./state.js"
import { ensureConfiguration } from "./configuration.js"
import { loadChatModel } from "./utils.js"
import { MODEL_TOOLS, toolNode } from "./tools.js"
import {
  CONDITION_CHECK_SYSTEM_PROMPT,
  PLAN_GENERATION_PROMPT,
  REFLECTION_PROMPT,
} from "./prompts.js"
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages"

/**
 * 必須条件（場所、時間、予算）を確認するノード
 */
async function checkConditions(
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
): Promise<Partial<WorkcationPlannerStateType>> {
  const configuration = ensureConfiguration(config)
  const model = await loadChatModel(configuration.model)

  // 現在の条件を確認
  const { requiredConditions, messages } = state
  const { location, duration, budget } = requiredConditions

  // もしmessagesが空の場合、初回の問いかけをする
  if (messages.length === 0) {
    const welcomeMessage = new AIMessage(
      "こんにちは！ワーケーションプランナーです。あなたに最適なワーケーションプランを作成します。\n\n以下の情報を教えてください：\n- 行きたい場所\n- 期間（何日間）\n- 予算",
    )
    return {
      messages: [welcomeMessage],
      requiredConditions: {
        location: null,
        duration: null,
        budget: null,
      },
    }
  }

  // すべての条件が揃っているかチェック
  if (location && duration && budget) {
    return {
      conditionsComplete: true,
    }
  }

  // LLMに条件を確認してもらう
  const systemMessage = new SystemMessage(CONDITION_CHECK_SYSTEM_PROMPT)
  const currentStatus = `
現在の収集状況:
- 場所: ${location || "未確認"}
- 期間: ${duration || "未確認"}
- 予算: ${budget || "未確認"}

足りない情報を自然に質問してください。`

  const response = await model.invoke([
    systemMessage,
    ...messages,
    new HumanMessage(currentStatus),
  ])

  // ユーザーの最新メッセージから情報を抽出
  const newConditions: any = { ...requiredConditions }

  // 最新のユーザーメッセージを取得
  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg instanceof HumanMessage)

  if (lastUserMessage) {
    const userContent = lastUserMessage.content as string

    // 場所の抽出
    if (!location) {
      // 都市名や地域名のパターンマッチング
      const locationMatch = userContent.match(
        /([ぁ-んァ-ヶー一-龠a-zA-Z]+(?:市|県|都|府|区|町|村|島))/,
      )
      if (locationMatch) {
        newConditions.location = locationMatch[1]
      } else if (
        userContent.includes("東京") ||
        userContent.includes("大阪") ||
        userContent.includes("京都") ||
        userContent.includes("沖縄") ||
        userContent.includes("北海道") ||
        userContent.includes("福岡")
      ) {
        // 主要都市の直接マッチング
        const cities = ["東京", "大阪", "京都", "沖縄", "北海道", "福岡"]
        for (const city of cities) {
          if (userContent.includes(city)) {
            newConditions.location = city
            break
          }
        }
      }
    }

    // 期間の抽出
    if (!duration) {
      // 日数のパターンマッチング
      const durationMatch = userContent.match(/(\d+)\s*(?:日間?|泊|週間)/)
      if (durationMatch) {
        const days = parseInt(durationMatch[1])
        if (durationMatch[0].includes("週")) {
          newConditions.duration = `${days * 7}日間`
        } else {
          newConditions.duration = `${days}日間`
        }
      }
    }

    // 予算の抽出
    if (!budget) {
      // 金額のパターンマッチング
      const budgetMatch = userContent.match(
        /(\d+(?:,\d{3})*|\d+)\s*(?:円|万円?)/,
      )
      if (budgetMatch) {
        let amount = budgetMatch[1].replace(/,/g, "")
        if (budgetMatch[0].includes("万")) {
          amount = (parseInt(amount) * 10000).toString()
        }
        newConditions.budget = `${parseInt(amount).toLocaleString()}円`
      }
    }
  }

  return {
    messages: [response],
    requiredConditions: newConditions,
    conditionsComplete: !!(
      newConditions.location &&
      newConditions.duration &&
      newConditions.budget
    ),
  }
}

/**
 * ワーケーションプランを生成するノード
 */
async function generatePlan(
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
): Promise<Partial<WorkcationPlannerStateType>> {
  const configuration = ensureConfiguration(config)
  const model = await loadChatModel(configuration.model)
  const modelWithTools = model.bindTools?.(MODEL_TOOLS) || model

  const { requiredConditions } = state
  const { location, duration, budget } = requiredConditions

  // プロンプトを生成
  const prompt = PLAN_GENERATION_PROMPT.replace("{location}", location!)
    .replace("{duration}", duration!)
    .replace("{budget}", budget!)

  // ツールを使用してプランを生成
  const response = await modelWithTools.invoke([
    new SystemMessage("あなたは優秀なワーケーションプランナーです。"),
    new HumanMessage(prompt),
  ])

  return {
    messages: [response],
  }
}

/**
 * ツール実行結果を整理してプランを生成するノード
 */
async function consolidatePlan(
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
): Promise<Partial<WorkcationPlannerStateType>> {
  const configuration = ensureConfiguration(config)
  const model = await loadChatModel(configuration.model)

  const { messages, requiredConditions, improvementInstructions } = state
  const { location, duration, budget } = requiredConditions

  // ツール実行結果を取得
  const toolMessages = messages.filter((m) => m instanceof ToolMessage)
  const toolResults = toolMessages.map((m) => {
    const content = m.content
    return typeof content === "string" ? content : JSON.stringify(content)
  })
  const toolResultsText = toolResults.join("\n\n")

  let consolidatePrompt = `
以下の検索結果を基に、${location}での${duration}、予算${budget}のワーケーションプランを整理してください。

検索結果:
${toolResultsText}

プランには以下を含めてください:
- おすすめの宿泊施設（具体的な名前と特徴）
- 仕事に適したワークスペース（Wi-Fi、電源、環境など）
- 観光・アクティビティ（時間帯別の提案）
- 交通手段（アクセス方法と所要時間）
- 概算費用（内訳付き）
- ワーケーションのTips（現地での過ごし方のアドバイス）
`

  // 改善指示がある場合は追加
  if (improvementInstructions) {
    consolidatePrompt += `\n\n改善指示:\n${improvementInstructions}`
  }

  const response = await model.invoke([
    new SystemMessage(
      "あなたは優秀なワーケーションプランナーです。検索結果を基に魅力的で実用的なプランを提案してください。",
    ),
    new HumanMessage(consolidatePrompt),
  ])

  // response.contentが空でないことを確認
  const planText = response.content as string
  if (!planText || planText.trim() === "") {
    console.error("consolidatePlan: Empty response from model")
    throw new Error("プランの生成に失敗しました。もう一度お試しください。")
  }

  return {
    messages: [response],
    toolResults: toolResults,
    generatedPlanText: planText,
    currentPlan: {
      location: location!,
      duration: duration!,
      budget: budget!,
      accommodations: [],
      workspaces: [],
      activities: [],
      transportation: "",
      estimatedCost: "",
      tips: [],
    },
  }
}

/**
 * プランの品質を評価するノード（リフレクション）
 */
async function reflectOnPlan(
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
): Promise<Partial<WorkcationPlannerStateType>> {
  const configuration = ensureConfiguration(config)
  const model = await loadChatModel(configuration.model)

  const { generatedPlanText, requiredConditions } = state

  if (!generatedPlanText) {
    throw new Error(
      "申し訳ございません。評価するプランが見つかりませんでした。",
    )
  }

  // リフレクションスキーマ
  const ReflectionSchema = z.object({
    satisfactory: z.boolean().describe("プランが満足できるものかどうか"),
    feedback: z
      .string()
      .nullable()
      .describe("改善が必要な場合のフィードバック"),
    improvements: z.string().nullable().describe("具体的な改善提案"),
  })

  const reflectionPrompt = `
プランの内容:
${generatedPlanText}

条件:
- 場所: ${requiredConditions.location}
- 期間: ${requiredConditions.duration}
- 予算: ${requiredConditions.budget}

${REFLECTION_PROMPT}

以下のJSON形式で応答してください:
{
  "satisfactory": true または false,
  "feedback": "改善が必要な場合のフィードバック（満足の場合はnull）",
  "improvements": "具体的な改善提案（満足の場合はnull）"
}`

  console.log("Reflection prompt:", reflectionPrompt)

  try {
    let reflection

    // withStructuredOutputが使える場合
    if (model.withStructuredOutput) {
      try {
        const reflectionModel = model.withStructuredOutput(ReflectionSchema)
        reflection = await reflectionModel.invoke([
          new SystemMessage("プランを評価してください。"),
          new HumanMessage(reflectionPrompt),
        ])
      } catch (structuredError) {
        console.warn(
          "Structured output failed, falling back to JSON parsing:",
          structuredError,
        )
        // フォールバック処理へ
        reflection = null
      }
    }

    // withStructuredOutputが使えない、または失敗した場合
    if (!reflection) {
      const response = await model.invoke([
        new SystemMessage(
          "プランを評価してください。必ずJSON形式で応答してください。",
        ),
        new HumanMessage(reflectionPrompt),
      ])

      const content = response.content as string
      console.log("Raw reflection response:", content)

      // JSONを抽出してパース
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          reflection = JSON.parse(jsonMatch[0])
          // スキーマ検証
          ReflectionSchema.parse(reflection)
        } catch (parseError) {
          console.error("JSON parse or validation error:", parseError)
          console.error("Attempted to parse:", jsonMatch[0])
          throw new Error("評価結果のパースに失敗しました")
        }
      } else {
        throw new Error("評価結果にJSONが含まれていません")
      }
    }

    console.log("Reflection result:", reflection)

    // reflectionがnullまたはundefinedの場合のデフォルト値
    if (!reflection) {
      console.warn(
        "Reflection returned null or undefined, using default values",
      )
      return {
        reflectionResult: {
          satisfactory: false,
          feedback: "プランの評価に失敗しました。もう一度お試しください。",
        },
        improvementInstructions: null,
      }
    }

    return {
      reflectionResult: {
        satisfactory: reflection.satisfactory ?? false,
        feedback: reflection.feedback ?? null,
      },
      improvementInstructions: reflection.improvements ?? null,
    }
  } catch (error) {
    console.error("Error in reflection:", error)
    // エラーが発生した場合のフォールバック
    return {
      reflectionResult: {
        satisfactory: false,
        feedback: "プランの評価中にエラーが発生しました。",
      },
      improvementInstructions: null,
    }
  }
}

/**
 * 最終的なプランを整形するノード
 */
async function finalizePlan(
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
): Promise<Partial<WorkcationPlannerStateType>> {
  const configuration = ensureConfiguration(config)
  const model = await loadChatModel(configuration.model)
  const { requiredConditions, generatedPlanText } = state

  // 構造化出力用のスキーマ
  const PlanExtractionSchema = z.object({
    accommodations: z.array(z.string()).describe("宿泊施設のリスト"),
    workspaces: z.array(z.string()).describe("ワークスペースのリスト"),
    activities: z.array(z.string()).describe("観光・アクティビティのリスト"),
    transportation: z.string().describe("交通手段の詳細"),
    estimatedCost: z.string().describe("概算費用"),
    tips: z.array(z.string()).describe("ワーケーションのTips"),
  })

  const extractionModel = model.withStructuredOutput(PlanExtractionSchema)

  const extractionPrompt = `
以下のワーケーションプランから、各項目の情報を抽出してください。

プラン:
${generatedPlanText}

抽出する項目:
- accommodations: 宿泊施設の名前と特徴
- workspaces: コワーキングスペースやカフェの名前と特徴
- activities: 観光地やアクティビティ
- transportation: 交通手段とアクセス方法
- estimatedCost: 概算費用（総額と内訳）
- tips: ワーケーションを楽しむためのアドバイス
`

  const extractedInfo = await extractionModel.invoke([
    new SystemMessage("プランから情報を正確に抽出してください。"),
    new HumanMessage(extractionPrompt),
  ])

  // 最終的なプランを作成
  const finalPlan: WorkcationPlan = {
    location: requiredConditions.location!,
    duration: requiredConditions.duration!,
    budget: requiredConditions.budget!,
    accommodations: extractedInfo.accommodations,
    workspaces: extractedInfo.workspaces,
    activities: extractedInfo.activities,
    transportation: extractedInfo.transportation,
    estimatedCost: extractedInfo.estimatedCost,
    tips: extractedInfo.tips,
  }

  const summaryMessage = `
ワーケーションプランが完成しました！

**場所**: ${finalPlan.location}
**期間**: ${finalPlan.duration}
**予算**: ${finalPlan.budget}

**宿泊施設**:
${finalPlan.accommodations.map((acc) => `- ${acc}`).join("\n")}

**ワークスペース**:
${finalPlan.workspaces.map((ws) => `- ${ws}`).join("\n")}

**観光・アクティビティ**:
${finalPlan.activities.map((act) => `- ${act}`).join("\n")}

**交通手段**:
${finalPlan.transportation}

**概算費用**:
${finalPlan.estimatedCost}

**Tips**:
${finalPlan.tips.map((tip) => `- ${tip}`).join("\n")}
`

  return {
    finalPlan,
    currentPlan: finalPlan,
    messages: [new AIMessage(summaryMessage)],
  }
}

/**
 * 条件判定関数
 */
function shouldContinueChecking(state: WorkcationPlannerStateType): string {
  // すべての条件が揃っている場合は、プラン生成へ
  if (state.conditionsComplete) {
    return "generate"
  }

  // 条件が揃っていない場合は、ENDに向かう
  // ユーザーからの新しい入力を待つ
  return END
}

function shouldImprove(state: WorkcationPlannerStateType): string {
  return state.reflectionResult?.satisfactory ? "finalize" : "improve"
}

/**
 * ワーケーションプランナーのグラフを作成
 */
export async function createWorkcationPlannerGraph() {
  const workflow = new StateGraph(WorkcationPlannerState)
    .addNode("checkConditions", checkConditions)
    .addNode("generatePlan", generatePlan)
    .addNode("tools", toolNode)
    .addNode("consolidate", consolidatePlan)
    .addNode("reflect", reflectOnPlan)
    .addNode("finalize", finalizePlan)

  // エッジの設定
  workflow
    .addEdge("__start__", "checkConditions")
    .addConditionalEdges("checkConditions", shouldContinueChecking, {
      generate: "generatePlan",
      [END]: END,
    })
    .addEdge("generatePlan", "tools")
    .addEdge("tools", "consolidate")
    .addEdge("consolidate", "reflect")
    .addConditionalEdges("reflect", shouldImprove, {
      improve: "consolidate",
      finalize: "finalize",
    })
    .addEdge("finalize", END)

  return workflow.compile()
}

// デフォルトグラフのエクスポート
export const graph = await createWorkcationPlannerGraph()
graph.name = "WorkcationPlanner"
