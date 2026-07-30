import { normalizeUsername } from "./normalizeUsername";

export interface ParsedBlockList {
  users: string[];
  meta: Record<string, string>;
  skippedLines: number;
}

//
// 註解行格式: "# Key: Value" 或 "! Key: Value",
// 用來放 Title / Updated / Homepage 這類 metadata。
//
const META_LINE_PATTERN = /^[#!]\s*([A-Za-z][A-Za-z0-9 _-]*)\s*:\s*(.+)$/;

/**
 * 解析封鎖名單純文字格式:
 * - 空行略過
 * - "#"、"!" 開頭是註解,符合 "Key: Value" 格式的會被視為 metadata
 * - 其餘每行視為一個使用者,經過 normalizeUsername() 驗證
 */
export function parseBlockListText(text: string): ParsedBlockList {
  const users = new Set<string>();
  const meta: Record<string, string> = {};
  let skippedLines = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("#") || line.startsWith("!")) {
      const metaMatch = line.match(META_LINE_PATTERN);

      if (metaMatch) {
        meta[metaMatch[1].trim()] = metaMatch[2].trim();
      }

      continue;
    }

    const username = normalizeUsername(line);

    if (!username) {
      skippedLines++;
      continue;
    }

    users.add(username);
  }

  return { users: [...users], meta, skippedLines };
}

/**
 * 把使用者名單序列化成跟 parseBlockListText 相容的純文字格式。
 */
export function serializeBlockListText(
  users: string[],
  meta: Record<string, string> = {},
): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(meta)) {
    lines.push(`# ${key}: ${value}`);
  }

  if (lines.length > 0) {
    lines.push("");
  }

  const sortedUsers = [...users].sort((a, b) => a.localeCompare(b));

  lines.push(...sortedUsers);
  lines.push("");

  return lines.join("\n");
}
