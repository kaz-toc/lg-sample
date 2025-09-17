/**
 * Workcation Planner用のツール定義
 * Tavilyを使用してワーケーション関連の情報を検索
 */
import { TavilySearchResults } from "@langchain/community/tools/tavily_search"
import { RunnableConfig } from "@langchain/core/runnables"
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { ensureConfiguration } from "./configuration.js"
import { WorkcationPlannerStateType } from "./state.js"
import { AIMessage, isBaseMessage, ToolMessage } from "@langchain/core/messages"

/**
 * 実行時の状態とconfigにアクセスできるようにツールを初期化
 */
function initializeTools(
  _state?: WorkcationPlannerStateType,
  config?: RunnableConfig,
) {
  const configuration = ensureConfiguration(config)

  /**
   * Tavily検索ツール - ワーケーション関連の情報を検索
   */
  const searchTool = new TavilySearchResults({
    maxResults: configuration.maxSearchResults,
  })

  /**
   * 宿泊施設を検索する専用ツール
   */
  const accommodationTool = tool(
    (async (input: { location: string; budget: string }) => {
      const query = `${input.location} ワーケーション 宿泊施設 Wi-Fi完備 デスク付き ${input.budget}以内`
      const results = await searchTool.invoke(query)
      return `宿泊施設の検索結果:\n${results}`
    }) as any,
    {
      name: "searchAccommodations",
      description: "ワーケーション向けの宿泊施設を検索",
      schema: z.object({
        location: z.string().describe("検索する場所"),
        budget: z.string().describe("予算"),
      }),
    },
  )

  /**
   * コワーキングスペースを検索する専用ツール
   */
  const workspaceTool = tool(
    (async (input: { location: string }) => {
      const query = `${input.location} コワーキングスペース カフェ 仕事 Wi-Fi 電源`
      const results = await searchTool.invoke(query)
      return `ワークスペースの検索結果:\n${results}`
    }) as any,
    {
      name: "searchWorkspaces",
      description: "コワーキングスペースや仕事に適したカフェを検索",
      schema: z.object({
        location: z.string().describe("検索する場所"),
      }),
    },
  )

  /**
   * 観光・アクティビティを検索する専用ツール
   */
  const activityTool = tool(
    (async (input: { location: string; duration: string }) => {
      const query = `${input.location} 観光 アクティビティ おすすめ ${input.duration}`
      const results = await searchTool.invoke(query)
      return `観光・アクティビティの検索結果:\n${results}`
    }) as any,
    {
      name: "searchActivities",
      description: "観光地やアクティビティを検索",
      schema: z.object({
        location: z.string().describe("検索する場所"),
        duration: z.string().describe("滞在期間"),
      }),
    },
  )

  /**
   * 交通手段を検索する専用ツール
   */
  const transportTool = tool(
    (async (input: { location: string; origin?: string }) => {
      const query = input.origin
        ? `${input.origin}から${input.location} 交通手段 アクセス 料金`
        : `${input.location} 現地 交通手段 移動方法`
      const results = await searchTool.invoke(query)
      return `交通手段の検索結果:\n${results}`
    }) as any,
    {
      name: "searchTransportation",
      description: "交通手段やアクセス方法を検索",
      schema: z.object({
        location: z.string().describe("目的地"),
        origin: z.string().optional().describe("出発地（オプション）"),
      }),
    },
  )

  return [
    searchTool,
    accommodationTool,
    workspaceTool,
    activityTool,
    transportTool,
  ]
}

/**
 * ツールノード - LLMからのツール呼び出しを実行
 */
export const toolNode = async (
  state: WorkcationPlannerStateType,
  config: RunnableConfig,
) => {
  const message = state.messages[state.messages.length - 1]
  // 現在の状態とconfigのコンテキストでツールを初期化
  const tools = initializeTools(state, config)

  const outputs = await Promise.all(
    (message as AIMessage).tool_calls?.map(async (call) => {
      const tool = tools.find((tool) => tool.name === call.name)
      try {
        if (tool === undefined) {
          throw new Error(
            `申し訳ございません。ツール「${call.name}」が見つかりませんでした。`,
          )
        }
        const output = await (tool as any).invoke(call.args, config)

        if (isBaseMessage(output) && output instanceof ToolMessage) {
          return output
        } else {
          return new ToolMessage({
            name: tool.name,
            content:
              typeof output === "string" ? output : JSON.stringify(output),
            tool_call_id: call.id ?? "",
          })
        }
      } catch (e: any) {
        return new ToolMessage({
          content: `申し訳ございません。エラーが発生しました: ${e.message}\n お手数ですが、もう一度お試しください。`,
          name: call.name,
          tool_call_id: call.id ?? "",
          status: "error",
        })
      }
    }) ?? [],
  )

  return {
    messages: outputs,
    toolResults: outputs.map((msg) => {
      const content = msg.content
      return typeof content === "string" ? content : JSON.stringify(content)
    }),
  }
}

// モデルバインディング用のツール定義
export const MODEL_TOOLS = initializeTools()
