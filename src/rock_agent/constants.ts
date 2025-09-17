export const Hands = {
  rock: 1,
  paper: 2,
  scissors: 3,
} as const

export type HandValue = (typeof Hands)[keyof typeof Hands]

export type HandKey = keyof typeof Hands

export const Result = {
  win: "win",
  lose: "lose",
  draw: "draw",
} as const

export type ResultType = "win" | "lose" | "draw"

export type ResultValue = (typeof Result)[keyof typeof Result]

export type ResultKey = keyof typeof Result

export type ResultTypes = {
  win: number
  lose: number
  draw: number
}

// ゲーム設定
export const GameConfig = {
  MAX_ROUNDS: 10,
  WIN_THRESHOLD: 3,
} as const

// エージェントの名前（デフォルトはサムアルトマン）
export const AGENT_NAME = "サム・アルトマン" as const

// 手の表示名
export const HandDisplayNames = {
  rock: "グー",
  paper: "パー",
  scissors: "チョキ",
} as const

// 数値からHandKeyへのマッピング
export const HandKeyMap: { [key: number]: HandKey } = Object.entries(
  Hands,
).reduce(
  (acc, [key, value]) => {
    acc[value] = key as HandKey
    return acc
  },
  {} as { [key: number]: HandKey },
)

// 結果文字列からResultTypeへのマッピング
export const ResultMap: { [key: string]: ResultType } = {
  win: "win",
  lose: "lose",
  draw: "draw",
}
