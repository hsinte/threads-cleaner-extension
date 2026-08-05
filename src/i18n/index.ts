import { MessageKey, messages as zhTW } from "./messages/zh-TW";
import { messages as en } from "./messages/en";
import { messages as ja } from "./messages/ja";
import { messages as es } from "./messages/es";
import { messages as pt } from "./messages/pt";

export type SupportedLocale = "en" | "zh-TW" | "ja" | "es" | "pt";

const CATALOGS: Record<SupportedLocale, Record<MessageKey, string>> = {
  en,
  "zh-TW": zhTW,
  ja,
  es,
  pt,
};

//
// Intl / toLocaleString 用的完整語言標籤
//
const INTL_LOCALE_TAGS: Record<SupportedLocale, string> = {
  en: "en-US",
  "zh-TW": "zh-TW",
  ja: "ja-JP",
  es: "es-ES",
  pt: "pt-PT",
};

//
// <html lang="..."> 用的標籤
//
const HTML_LANG_TAGS: Record<SupportedLocale, string> = {
  en: "en",
  "zh-TW": "zh-Hant",
  ja: "ja",
  es: "es",
  pt: "pt",
};

/**
 * 依照瀏覽器介面語言決定要用哪一套字典,找不到對應語言就用英文。
 * 只在模組載入時算一次,同一次 popup/content script 執行期間不會變動,
 * 也不會有使用者手動切換語言的功能(照使用者的要求,自動跟隨瀏覽器語言就好)。
 */
function detectLocale(): SupportedLocale {
  const browserLocale = chrome.i18n.getUILanguage().toLowerCase();

  if (browserLocale.startsWith("zh")) {
    //
    // 目前只有繁體中文字典。zh-TW / zh-HK / zh-MO 視為繁體,
    // 其餘(例如 zh-CN 簡體)沒有對應字典,也視為繁體。
    //
    return browserLocale.includes("tw") ||
      browserLocale.includes("hk") ||
      browserLocale.includes("mo") ||
      browserLocale.includes("cn")
      ? "zh-TW"
      : "en";
  }

  if (browserLocale.startsWith("ja")) {
    return "ja";
  }

  if (browserLocale.startsWith("es")) {
    return "es";
  }

  if (browserLocale.startsWith("pt")) {
    return "pt";
  }

  return "en";
}

const currentLocale = detectLocale();

/**
 * 翻譯查詢,支援 "{paramName}" 佔位符替換。
 * 找不到對應語言的字典或缺某個 key 時一路退回英文,
 * 英文也沒有就直接回傳 key 本身,至少畫面不會空白。
 */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = CATALOGS[currentLocale]?.[key] ?? CATALOGS.en[key] ?? key;

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];

    return value === undefined ? match : String(value);
  });
}

export function getIntlLocale(): string {
  return INTL_LOCALE_TAGS[currentLocale];
}

export function getHtmlLang(): string {
  return HTML_LANG_TAGS[currentLocale];
}

/**
 * 掃描 DOM,把帶有 data-i18n* 屬性的元素填上目前語言的文字。
 * 用來處理靜態的 HTML 文字(標籤、按鈕、placeholder、title、aria-label)。
 * TS 裡動態組出來的文字(狀態訊息、confirm 對話框...)則直接呼叫 t()。
 */
export function applyStaticTranslations(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;

    if (key) {
      element.textContent = t(key as MessageKey);
    }
  }

  for (const element of root.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >("[data-i18n-placeholder]")) {
    const key = element.dataset.i18nPlaceholder;

    if (key) {
      element.placeholder = t(key as MessageKey);
    }
  }

  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-i18n-title]",
  )) {
    const key = element.dataset.i18nTitle;

    if (key) {
      element.title = t(key as MessageKey);
    }
  }

  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-i18n-aria-label]",
  )) {
    const key = element.dataset.i18nAriaLabel;

    if (key) {
      element.setAttribute("aria-label", t(key as MessageKey));
    }
  }
}
