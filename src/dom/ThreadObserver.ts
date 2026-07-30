import { PostParser } from "./PostParser";
import { ThreadFeed } from "./ThreadFeed";
import { ThreadPost } from "./ThreadPost";

/**
 * 監看頁面 DOM 變化,偵測新出現的貼文並解析成 ThreadPost,
 * 透過 onPostAdded() 註冊的 handler 通知外部。
 *
 * 效能設計分成兩條路徑:
 * - 「發現新貼文」:MutationObserver 抓到新節點,或 scroll 停下來後的
 *   保底全頁掃描。保底掃描會用 processedElements 跳過已經處理過的節點,
 *   不會每次都重新解析整頁。
 * - 「重新套用顯示狀態」:封鎖名單在別處(例如 popup)被修改時呼叫的
 *   rescan(),直接對 trackedPosts 裡已知的貼文重新通知,完全不查詢 DOM,
 *   成本跟頁面上貼文數量、DOM 查詢都無關。
 */
export class ThreadObserver {
  private observer: MutationObserver;
  private scanTimer?: number;

  private readonly boundOnScroll = this.onScroll.bind(this);

  /**
   * 已經解析過、還在追蹤的貼文,rescan() 靠這份清單重新套用顯示狀態,
   * 不必重新查詢 DOM。定期在掃描時清掉已經離開 DOM 的項目,避免無限增長。
   */
  private readonly trackedPosts = new Set<ThreadPost>();

  /**
   * 已經處理過的元素。保底全頁掃描用它跳過已知節點,只解析真正新出現的,
   * 用 WeakSet 是因為節點離開 DOM 後不需要手動清除,會自然被回收。
   */
  private readonly processedElements = new WeakSet<HTMLElement>();

  private postAddedHandlers: Array<(post: ThreadPost) => void> = [];

  constructor(
    private readonly parser: PostParser,
    private readonly feed: ThreadFeed,
  ) {
    this.observer = new MutationObserver(this.onMutation.bind(this));
  }

  public onPostAdded(handler: (post: ThreadPost) => void): void {
    this.postAddedHandlers.push(handler);
  }

  public start(): void {
    //
    // 第一次先掃整個頁面
    //
    this.scanAllPosts();

    //
    // 開始監聽
    //
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("scroll", this.boundOnScroll, { passive: true });
  }

  public stop(): void {
    this.observer.disconnect();
    window.removeEventListener("scroll", this.boundOnScroll);
    window.clearTimeout(this.scanTimer);
    this.trackedPosts.clear();
  }

  /**
   * 封鎖名單在別處(例如 popup)被修改後,重新套用已知貼文的顯示狀態。
   * 不查詢 DOM,只處理已經追蹤到的貼文。
   */
  public rescan(): void {
    this.pruneDisconnectedPosts();

    for (const post of this.trackedPosts) {
      this.notifyHandlers(post);
    }
  }

  private onScroll(): void {
    window.clearTimeout(this.scanTimer);

    this.scanTimer = window.setTimeout(() => {
      this.scanAllPosts();
    }, 200);
  }

  /**
   * 保底全頁掃描:抓目前頁面所有貼文元素,跳過已經處理過的節點,
   * 只處理真正新出現的。
   */
  private scanAllPosts(): void {
    this.pruneDisconnectedPosts();

    const elements = this.feed.getAllPostElements();

    for (const element of elements) {
      this.processPostElement(element);
    }
  }

  private onMutation(records: MutationRecord[]): void {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        this.processNode(node);
      }
    }
  }

  private processNode(node: HTMLElement): void {
    const elements = this.feed.findPostElements(node);

    for (const element of elements) {
      this.processPostElement(element);
    }
  }

  private processPostElement(element: HTMLElement): void {
    if (this.processedElements.has(element)) {
      return;
    }

    const post = this.parser.parse(element);

    if (!post) {
      return;
    }

    this.processedElements.add(element);
    this.trackedPosts.add(post);

    this.notifyHandlers(post);
  }

  private notifyHandlers(post: ThreadPost): void {
    for (const handler of this.postAddedHandlers) {
      handler(post);
    }
  }

  /**
   * 清掉已經離開 DOM 的貼文,避免 trackedPosts 長時間瀏覽下無限增長。
   */
  private pruneDisconnectedPosts(): void {
    for (const post of this.trackedPosts) {
      if (!post.rootElement.isConnected) {
        this.trackedPosts.delete(post);
      }
    }
  }
}
