import { tool } from "@langchain/core/tools"
import { Hands, HandValue, Result } from "./constants.js"
import { z } from "zod"

/**
 * Check if the given value is a valid hand in Rock, Paper, Scissors
 * @param hand - The hand value to validate
 * @returns True if the hand value is valid, false otherwise
 */
const isValidHand = (hand: number): boolean => {
  return Object.values(Hands).includes(hand as HandValue)
}

/**
 * Generate a random hand value for the game of Rock, Paper, Scissors
 * @returns A random hand value
 */
const randomHand = async (): Promise<HandValue> => {
  const handValues = Object.values(Hands)
  return handValues[Math.floor(Math.random() * handValues.length)]
}

/**
 * Judge the result of the game of Rock, Paper, Scissors
 * @param input - The input object containing the AI hand and user hand
 * @returns The result of the game
 */
const judgeHand = async (input: {
  aiHand: number
  userHand: number
}): Promise<string> => {
  const { aiHand, userHand } = input
  if (aiHand === userHand) return Result.draw

  // じゃんけんのルール:
  // グー(1) vs チョキ(3) = グーの勝ち
  // チョキ(3) vs パー(2) = チョキの勝ち
  // パー(2) vs グー(1) = パーの勝ち

  // AI視点での勝敗判定
  if (aiHand === Hands.rock && userHand === Hands.scissors) return Result.win
  if (aiHand === Hands.scissors && userHand === Hands.paper) return Result.win
  if (aiHand === Hands.paper && userHand === Hands.rock) return Result.win

  // それ以外はAIの負け
  return Result.lose
}

export const validateHandTool = tool(
  (async (input: { hand: number }) => {
    return isValidHand(input.hand)
  }) as any,
  {
    name: "validateHand",
    description: "Check if the hand value is valid for Rock, Paper, Scissors",
    schema: z.object({
      hand: z.number().describe("The hand value to validate"),
    }),
  },
)

export const generateHandTool = tool(randomHand as any, {
  name: "generateHand",
  description:
    "Generate a random hand value for the game of Rock, Paper, Scissors",
  schema: z.void(),
})

export const judgeHandTool = tool(
  (async (input: { aiHand: number; userHand: number }) => {
    return await judgeHand(input)
  }) as any,
  {
    name: "judgeHand",
    description: "Judge the result of the game of Rock, Paper, Scissors",
    schema: z.object({
      aiHand: z.number().describe("The hand value of the AI"),
      userHand: z.number().describe("The hand value of the user"),
    }),
  },
)
