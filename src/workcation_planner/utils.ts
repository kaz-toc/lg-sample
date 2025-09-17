import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { MessageContent, MessageContentComplex } from "@langchain/core/messages"
import { initChatModel } from "langchain/chat_models/universal"

/**
 * 複雑なメッセージコンテンツからテキストを抽出するヘルパー関数
 */
function getSingleTextContent(content: MessageContentComplex) {
  if (content?.type === "text") {
    return content.text
  } else if (content.type === "array") {
    return content.content.map(getSingleTextContent).join(" ")
  }
  return ""
}

/**
 * 様々なメッセージタイプからテキストコンテンツを抽出するヘルパー関数
 */
export function getTextContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content
  } else if (Array.isArray(content)) {
    return content.map(getSingleTextContent).join(" ")
  }
  return ""
}

/**
 * 完全指定された名前からチャットモデルをロード
 * @param fullySpecifiedName - 'provider/model' 形式の文字列
 * @returns BaseChatModel インスタンスを返すPromise
 */
export async function loadChatModel(
  fullySpecifiedName: string,
): Promise<BaseChatModel> {
  const index = fullySpecifiedName.indexOf("/")
  if (index === -1) {
    // If there's no "/", assume it's just the model
    return await initChatModel(fullySpecifiedName)
  } else {
    const provider = fullySpecifiedName.slice(0, index)
    const model = fullySpecifiedName.slice(index + 1)
    return await initChatModel(model, { modelProvider: provider })
  }
}
