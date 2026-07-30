import { SELECTORS } from "./selectors";

/**
 * 負責從頁面 DOM 找出貼文元素,不管是全頁掃描還是從某個新增節點往下找。
 */
export class ThreadFeed {
  /**
   * 找目前頁面所有貼文
   */
  public getAllPostElements(): HTMLElement[] {
    return this.dedupeNested(
      Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.post)),
    );
  }

  /**
   * 從某個 root(通常是 MutationObserver 新增的節點)找貼文
   */
  public findPostElements(root: HTMLElement): HTMLElement[] {
    //
    // root 自己就是貼文
    //
    if (root.matches(SELECTORS.post)) {
      return [root];
    }

    return this.dedupeNested(
      Array.from(root.querySelectorAll<HTMLElement>(SELECTORS.post)),
    );
  }

  /**
   * 如果一篇貼文卡片包在另一篇貼文卡片裡面(例如引用/分享貼文),
   * 只保留最外層,避免同一則內容被拆成兩個 ThreadPost。
   */
  private dedupeNested(elements: HTMLElement[]): HTMLElement[] {
    return elements.filter((element) => {
      const parent = element.parentElement;

      return !parent?.closest(SELECTORS.post);
    });
  }
}
