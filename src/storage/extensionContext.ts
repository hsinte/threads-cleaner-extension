/**
 * 擴充功能被重新載入 / 更新 / 停用時,已經開著的分頁裡的 content script
 * 不會自動消失或重新整理,但這時候呼叫任何 chrome.* API 都會失敗、
 * 丟出「Extension context invalidated」這個錯誤。這種情況下我們什麼都
 * 做不了(只能等使用者重新整理分頁),所以判斷到這個錯誤就安靜地略過,
 * 不要讓它變成一個嚇人的 uncaught error。
 */
export function isExtensionContextInvalidated(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  );
}
