import { RockAgentStateType, GameRecord } from "./state.js"
import { generateHandTool, judgeHandTool } from "./tools.js"
import {
  Hands,
  GameConfig,
  HandDisplayNames,
  HandKeyMap,
  ResultMap,
  HandKey,
} from "./constants.js"
import { AI_RESPONSE_PROMPT } from "./prompts.js"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"

/**
 * ユーザーの入力を検証するノード
 * 1, 2, 3のみを受け付ける
 */
export async function validateInput(
  state: RockAgentStateType,
): Promise<Partial<RockAgentStateType>> {
  const { userInput } = state

  // 入力を数値に変換
  const handValue = parseInt(userInput.trim())

  // 1, 2, 3以外は無効
  if (isNaN(handValue) || handValue < 1 || handValue > 3) {
    return {
      validationError:
        "無効な入力ダー！1(グー)、2(パー)、3(チョキ)のいずれかを入力してほしいダー。",
      userChoice: null,
    }
  }

  // 有効な入力の場合、HandKeyに変換
  const userChoice = HandKeyMap[handValue]

  return {
    validationError: null,
    userChoice: userChoice,
  }
}

/**
 * AIの手を生成するノード
 */
export async function generateAIHand(
  _state: RockAgentStateType,
): Promise<Partial<RockAgentStateType>> {
  const aiHandValue = await generateHandTool.invoke(undefined)

  return {
    aiChoice: HandKeyMap[aiHandValue],
  }
}

/**
 * ゲーム結果を判定するノード
 */
export async function judgeGame(
  state: RockAgentStateType,
): Promise<Partial<RockAgentStateType>> {
  const { userChoice, aiChoice } = state

  if (!userChoice || !aiChoice) {
    return {}
  }

  // HandKeyをnumberに変換
  const userHandValue = Hands[userChoice]
  const aiHandValue = Hands[aiChoice]

  const result = await judgeHandTool.invoke({
    userHand: userHandValue,
    aiHand: aiHandValue,
  })

  // 結果をResultTypeに変換
  return {
    currentResult: ResultMap[result],
  }
}

/**
 * エージェントのレスポンスを生成するノード
 */
export async function generateAgentResponse(
  state: RockAgentStateType,
  model: BaseChatModel,
): Promise<Partial<RockAgentStateType>> {
  console.log("[generateAgentResponse] Starting response generation...")

  const {
    currentResult,
    userChoice,
    aiChoice,
    currentRound,
    userWins,
    aiWins,
    draws,
  } = state

  if (!currentResult || !userChoice || !aiChoice) {
    console.log(
      "[generateAgentResponse] Missing required state values, returning empty",
    )
    return {}
  }

  const userHandName = HandDisplayNames[userChoice]
  const aiHandName = HandDisplayNames[aiChoice]

  // スコア更新（次のラウンドの値を計算）
  const newUserWins = currentResult === "lose" ? userWins + 1 : userWins
  const newAIWins = currentResult === "win" ? aiWins + 1 : aiWins
  const newDraws = currentResult === "draw" ? draws + 1 : draws

  // ゲーム終了判定
  const totalRounds = currentRound + 1
  const willGameEnd =
    totalRounds >= GameConfig.MAX_ROUNDS ||
    newUserWins >= GameConfig.WIN_THRESHOLD ||
    newAIWins >= GameConfig.WIN_THRESHOLD

  let response: any
  try {
    console.log("[generateAgentResponse] Preparing to call LLM...")
    console.log("[generateAgentResponse] Model:", model.constructor.name)

    // タイムアウトを設定してモデルを呼び出す
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("LLM response timeout")), 30000) // 30秒のタイムアウト
    })

    const modelPromise = model.invoke(
      await AI_RESPONSE_PROMPT.format({
        round: totalRounds,
        aiChoice: aiHandName,
        userChoice: userHandName,
        result:
          currentResult === "win"
            ? "あなたの負け"
            : currentResult === "lose"
              ? "あなたの勝ち"
              : "引き分け",
        aiWins: newAIWins,
        userWins: newUserWins,
      }),
    )

    console.log("[generateAgentResponse] Invoking model...")
    response = await Promise.race([modelPromise, timeoutPromise])
    console.log("[generateAgentResponse] Model response received")
  } catch (error) {
    console.error(
      "[generateAgentResponse] Error generating AI response:",
      error,
    )
    // エラー時はフォールバックレスポンスを使用
    const fallbackMessages = {
      win: `私の${aiHandName}があなたの${userHandName}に勝ちました！`,
      lose: `おめでとう！あなたの${userHandName}が私の${aiHandName}に勝ちました！`,
      draw: `おっと、お互い${aiHandName}で引き分けです！`,
    }
    response = {
      content:
        fallbackMessages[currentResult] || "次のラウンドに進みましょう！",
    }
  }

  let aiResponse =
    typeof response?.content === "string"
      ? response.content
      : "次のラウンドに進みましょう！"

  // ゲーム終了時はサマリも追加
  if (willGameEnd) {
    const gameHistory = [
      ...state.gameHistory,
      {
        round: totalRounds,
        userChoice,
        aiChoice,
        result: currentResult,
        aiResponse: "",
      },
    ]

    const gameSummary = generateGameSummary(
      newUserWins,
      newAIWins,
      newDraws,
      totalRounds,
      gameHistory,
    )

    aiResponse = aiResponse + "\n\n" + gameSummary
  }

  return {
    aiResponse,
  }
}

/**
 * ゲーム終了時のサマリを生成する関数
 */
function generateGameSummary(
  userWins: number,
  aiWins: number,
  draws: number,
  totalRounds: number,
  gameHistory: GameRecord[],
): string {
  // 全体の勝敗結果
  const winner =
    userWins > aiWins
      ? "あなたの勝利"
      : aiWins > userWins
        ? "AIの勝利"
        : "引き分け"

  // 各手の使用頻度を集計
  const userHandCounts = { rock: 0, paper: 0, scissors: 0 }
  const aiHandCounts = { rock: 0, paper: 0, scissors: 0 }

  gameHistory.forEach((record) => {
    userHandCounts[record.userChoice]++
    aiHandCounts[record.aiChoice]++
  })

  // 最も使った手を判定
  const getMostUsedHand = (counts: typeof userHandCounts) => {
    const entries = Object.entries(counts) as [HandKey, number][]
    const max = Math.max(...entries.map(([_, count]) => count))
    const mostUsed = entries
      .filter(([_, count]) => count === max)
      .map(([hand, _]) => HandDisplayNames[hand])
      .join(", ")
    return mostUsed
  }

  const userMostUsed = getMostUsedHand(userHandCounts)
  const aiMostUsed = getMostUsedHand(aiHandCounts)

  // サマリテキストを生成
  return `
🎮 ゲーム終了！🎮

【最終結果】
${winner}ダー！🏆

【スコア】
あなた: ${userWins}勝
AI: ${aiWins}勝
引き分け: ${draws}回

【合計ラウンド数】
${totalRounds}ラウンド

【統計】
あなたが最も使った手: ${userMostUsed}
AIが最も使った手: ${aiMostUsed}

${
  userWins > aiWins
    ? "素晴らしい戦いぶりダー！またチャレンジしてほしいダー！"
    : aiWins > userWins
      ? "次は頑張ってほしいダー！リベンジ待ってるダー！"
      : "接戦だったダー！次で決着をつけるダー！"
}
`
}

/**
 * ゲーム状態を更新するノード
 */
export async function updateGameState(
  state: RockAgentStateType,
): Promise<Partial<RockAgentStateType>> {
  const {
    currentResult,
    userChoice,
    aiChoice,
    currentRound,
    userWins,
    aiWins,
    draws,
    gameHistory,
    aiResponse,
  } = state

  if (!currentResult || !userChoice || !aiChoice) {
    return {}
  }

  // 新しいゲーム記録
  const newRecord = {
    round: currentRound + 1,
    userChoice,
    aiChoice,
    result: currentResult,
    aiResponse,
  }

  // スコア更新
  // currentResultはAI視点での結果なので：
  // - "win" = AIの勝ち
  // - "lose" = AIの負け = ユーザーの勝ち
  const newUserWins = currentResult === "lose" ? userWins + 1 : userWins
  const newAIWins = currentResult === "win" ? aiWins + 1 : aiWins
  const newDraws = currentResult === "draw" ? draws + 1 : draws

  // ゲーム終了判定
  const totalRounds = currentRound + 1
  const isGameOver =
    totalRounds >= GameConfig.MAX_ROUNDS ||
    newUserWins >= GameConfig.WIN_THRESHOLD ||
    newAIWins >= GameConfig.WIN_THRESHOLD

  return {
    currentRound: totalRounds,
    userWins: newUserWins,
    aiWins: newAIWins,
    draws: newDraws,
    gameHistory: [...gameHistory, newRecord],
    isGameOver,
  }
}

/**
 * 入力検証エラーかどうかを判定
 */
export function hasValidationError(state: RockAgentStateType): string {
  return state.validationError ? "error" : "continue"
}

/**
 * ゲームが終了したかどうかを判定
 */
export function isGameOver(state: RockAgentStateType): string {
  return state.isGameOver ? "end" : "continue"
}
