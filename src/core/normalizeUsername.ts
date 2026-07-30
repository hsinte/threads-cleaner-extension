/**
 * 將使用者輸入正規化成純使用者名稱(不含 @ 或網址)。
 *
 * 支援以下輸入格式:
 * - username
 * - @username
 * - https://www.threads.com/@username
 * - https://www.threads.com/@username/post/xxxxx
 *
 * 輸入不合法時回傳 null。
 */
export function normalizeUsername(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(/\/@([^/?#\s]+)/);

  const candidate = urlMatch
    ? urlMatch[1]
    : trimmed.startsWith("@")
      ? trimmed.slice(1)
      : trimmed;

  //
  // Threads 使用者名稱僅允許英數字、句點與底線
  //
  if (!/^[A-Za-z0-9._]+$/.test(candidate)) {
    return null;
  }

  return candidate;
}
