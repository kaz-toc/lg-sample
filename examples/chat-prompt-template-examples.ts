import { ChatPromptTemplate } from "@langchain/core/prompts"

// ChatPromptTemplateの基本的な使い方

// 1. 基本的な使い方 - fromMessagesメソッド
const basicTemplate = ChatPromptTemplate.fromMessages([
  ["system", "あなたは親切なアシスタントです。"],
  ["human", "{user_input}"],
])

// 2. roleを明示的に指定する使い方
const templateWithRoles = ChatPromptTemplate.fromMessages([
  {
    role: "system",
    content: "あなたはプログラミングの専門家です。",
  },
  {
    role: "user",
    content: "{question}",
  },
  {
    role: "assistant",
    content: "はい、お手伝いします。",
  },
  {
    role: "user",
    content: "{follow_up}",
  },
])

// 3. 複数のroleを使った会話履歴を含むテンプレート
const conversationTemplate = ChatPromptTemplate.fromMessages([
  ["system", "あなたは{language}の専門家です。"],
  ["human", "こんにちは！"],
  ["assistant", "こんにちは！{language}について何か質問はありますか？"],
  ["human", "{user_question}"],
])

// 4. MessagesPlaceholderを使った動的な会話履歴の挿入
import { MessagesPlaceholder } from "@langchain/core/prompts"

const dynamicTemplate = ChatPromptTemplate.fromMessages([
  ["system", "あなたは{role}として振る舞ってください。"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
])

// 5. fromTemplateメソッドを使ったシンプルな方法
const simpleTemplate = ChatPromptTemplate.fromTemplate(
  "次の質問に答えてください: {question}",
)

// 6. 複雑な例 - AIアシスタントのためのテンプレート
const aiAssistantTemplate = ChatPromptTemplate.fromMessages([
  {
    role: "system",
    content: `あなたは{company}のカスタマーサポートAIです。
    以下のガイドラインに従って応答してください：
    - 丁寧で親切な対応
    - 技術的な質問には正確に答える
    - 不明な点は確認する`,
  },
  new MessagesPlaceholder("chat_history"),
  {
    role: "user",
    content: "{user_message}",
  },
])

// 使用例
async function exampleUsage() {
  // 1. 基本的な使い方の例
  const formattedMessages1 = await basicTemplate.formatMessages({
    user_input: "TypeScriptの型について教えてください",
  })
  console.log("基本的な例:", formattedMessages1)

  // 2. roleを指定した例
  const formattedMessages2 = await templateWithRoles.formatMessages({
    question: "async/awaitの使い方は？",
    follow_up: "エラーハンドリングはどうすればいい？",
  })
  console.log("role指定の例:", formattedMessages2)

  // 3. 会話履歴を含む例
  const formattedMessages3 = await conversationTemplate.formatMessages({
    language: "TypeScript",
    user_question: "ジェネリクスについて説明してください",
  })
  console.log("会話履歴の例:", formattedMessages3)

  // 4. 動的な会話履歴の例
  import { HumanMessage, AIMessage } from "@langchain/core/messages"

  const formattedMessages4 = await dynamicTemplate.formatMessages({
    role: "React専門家",
    history: [
      new HumanMessage("Reactのフックについて教えて"),
      new AIMessage(
        "Reactのフックは関数コンポーネントで状態管理を可能にする機能です。",
      ),
    ],
    input: "useEffectの使い方を詳しく教えて",
  })
  console.log("動的履歴の例:", formattedMessages4)

  // 5. AIアシスタントの例
  const formattedMessages5 = await aiAssistantTemplate.formatMessages({
    company: "TechCorp",
    chat_history: [
      new HumanMessage("製品の返品について"),
      new AIMessage(
        "返品に関するお問い合わせですね。お手伝いさせていただきます。",
      ),
    ],
    user_message: "30日以内なら返品可能ですか？",
  })
  console.log("AIアシスタントの例:", formattedMessages5)
}

// roleの種類について
/*
ChatPromptTemplateで使用できる主なrole：
1. "system" - システムメッセージ（AIの振る舞いを定義）
2. "human" または "user" - ユーザーからのメッセージ
3. "assistant" または "ai" - AIからの応答
4. "function" - 関数呼び出しの結果（OpenAI互換）
5. "tool" - ツール使用の結果

これらのroleは以下の方法で指定できます：
- タプル形式: ["system", "メッセージ内容"]
- オブジェクト形式: { role: "system", content: "メッセージ内容" }
*/

// その他の便利な機能
const advancedTemplate = ChatPromptTemplate.fromMessages([
  ["system", "あなたは{expertise}の専門家です。"],
  ["human", "{question}"],
  ["assistant", "わかりました。{expertise}の観点からお答えします。"],
  ["human", "もっと詳しく教えてください。"],
])

// パーシャルテンプレート（一部の変数を事前に埋める）
const partialTemplate = await advancedTemplate.partial({
  expertise: "機械学習",
})

// これで{question}だけを渡せばよくなる
const partialResult = await partialTemplate.formatMessages({
  question: "ニューラルネットワークとは？",
})

export {
  basicTemplate,
  templateWithRoles,
  conversationTemplate,
  dynamicTemplate,
  aiAssistantTemplate,
  exampleUsage,
}
