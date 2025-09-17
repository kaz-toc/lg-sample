import { Annotation } from "@langchain/langgraph"
import { HandKey, ResultType } from "./constants.js"

// 1回のゲーム記録
export interface GameRecord {
  round: number
  userChoice: HandKey
  aiChoice: HandKey
  result: ResultType
  aiResponse: string
}

// エージェントの状態
export const RockAgentState = Annotation.Root({
  userInput: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  userChoice: Annotation<HandKey | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  currentRound: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  userWins: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  aiWins: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  draws: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  gameHistory: Annotation<GameRecord[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  isGameOver: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  validationError: Annotation<string | null>({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => null,
  }),
  aiChoice: Annotation<HandKey | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  currentResult: Annotation<ResultType | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  aiResponse: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
})

export type RockAgentStateType = typeof RockAgentState.State
