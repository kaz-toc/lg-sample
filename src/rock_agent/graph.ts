import { StateGraph, END } from "@langchain/langgraph"
import { RockAgentState, RockAgentStateType } from "./state.js"
import {
  validateInput,
  generateAIHand,
  judgeGame,
  generateAgentResponse,
  updateGameState,
  hasValidationError,
  isGameOver,
} from "./node.js"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { loadChatModel } from "./utils.js"

/**
 * Rock Paper Scissors エージェントのグラフを作成
 */
function createRockAgentGraph(model: BaseChatModel) {
  const workflow = new StateGraph(RockAgentState)
    .addNode("validateInput", validateInput)
    .addNode("generateAIHand", generateAIHand)
    .addNode("judgeGame", judgeGame)
    .addNode("generateAgentResponse", (state: RockAgentStateType) =>
      generateAgentResponse(state, model),
    )
    .addNode("updateGameState", updateGameState)

  // エッジの設定
  workflow.addEdge("__start__", "validateInput")
  workflow.addConditionalEdges("validateInput", hasValidationError, {
    error: END,
    continue: "generateAIHand",
  })
  workflow.addEdge("generateAIHand", "judgeGame")
  workflow.addEdge("judgeGame", "generateAgentResponse")
  workflow.addEdge("generateAgentResponse", "updateGameState")
  workflow.addConditionalEdges("updateGameState", isGameOver, {
    end: END,
    continue: END,
  })

  return workflow.compile()
}

// デフォルトのモデルを使用してグラフを作成してエクスポート
let defaultModel: BaseChatModel
try {
  // モデル名を環境変数から取得、なければデフォルトを使用
  const modelName = process.env.ROCK_AGENT_MODEL || "gpt-3.5-turbo"
  console.log("[RockAgent] Loading model:", modelName)
  defaultModel = await loadChatModel(modelName)
  console.log("[RockAgent] Model loaded successfully")
} catch (error) {
  console.error("[RockAgent] Failed to load default model:", error)
  // フォールバックとしてOpenAIのモデルを使用
  try {
    console.log("[RockAgent] Trying fallback model: gpt-3.5-turbo")
    defaultModel = await loadChatModel("gpt-3.5-turbo")
    console.log("[RockAgent] Fallback model loaded successfully")
  } catch (fallbackError) {
    console.error("[RockAgent] Failed to load fallback model:", fallbackError)
    throw new Error(
      "Could not initialize any chat model. Please check your API keys and model configuration.",
    )
  }
}

export const graph = createRockAgentGraph(defaultModel)
graph.name = "RockPaperScissors"
