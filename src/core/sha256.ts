/**
 * 計算文字內容的 SHA-256 雜湊值(hex 字串)。
 * 用來判斷遠端清單這次抓下來的內容跟上次是否相同。
 */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
