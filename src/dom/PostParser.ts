import { normalizeUsername } from "@/core/normalizeUsername";
import { SELECTORS } from "./selectors";
import { ThreadPost } from "./ThreadPost";

/**
 * 把一個貼文的 DOM 根節點解析成 ThreadPost;
 * 如果找不到作者連結或使用者名稱,回傳 null(代表這不是一篇可辨識的貼文)。
 */
export class PostParser {
  public parse(rootElement: HTMLElement): ThreadPost | null {
    const anchor = this.findAuthorLink(rootElement);

    if (!anchor) {
      return null;
    }

    const username = this.extractUsername(anchor);

    if (!username) {
      return null;
    }

    const usernameElement = this.findUsernameElement(anchor);

    if (!usernameElement) {
      return null;
    }

    return new ThreadPost({ username, rootElement, usernameElement });
  }

  /**
   * 一篇貼文裡通常不只一個 `/@` 開頭的連結(大頭貼、名稱、時間戳記
   * 都可能是連結),這裡優先選「純粹的個人檔案連結」(例如 /@someone),
   * 避免選到時間戳記那種指向貼文本身的連結(例如 /@someone/post/xxxxx),
   * 才能保證封鎖按鈕插在使用者名稱旁邊。
   */
  private findAuthorLink(root: HTMLElement): HTMLAnchorElement | null {
    const anchors = root.querySelectorAll<HTMLAnchorElement>(
      SELECTORS.username,
    );

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") ?? "";

      if (/^\/@[^/?#]+\/?$/.test(href)) {
        return anchor;
      }
    }

    return anchors[0] ?? null;
  }

  private extractUsername(anchor: HTMLAnchorElement): string | null {
    const href = anchor.getAttribute("href");

    if (!href) {
      return null;
    }

    return normalizeUsername(href);
  }

  private findUsernameElement(anchor: HTMLAnchorElement): HTMLElement | null {
    //
    // 找最後一個 span 當作顯示名稱的元素,封鎖按鈕會插在它後面
    //
    const spans = anchor.querySelectorAll<HTMLElement>("span");

    if (spans.length === 0) {
      return null;
    }

    return spans[spans.length - 1];
  }
}
