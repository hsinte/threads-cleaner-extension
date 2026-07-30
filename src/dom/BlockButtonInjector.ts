import { BlockListManager } from "@/core/BlockListManager";
import { ThreadPost } from "./ThreadPost";

/**
 * 在貼文的使用者名稱旁邊插入封鎖按鈕,並處理點擊後的確認與封鎖流程。
 */
export class BlockButtonInjector {
  constructor(private readonly blockListManager: BlockListManager) {}

  public inject(post: ThreadPost): void {
    if (this.hasButton(post)) {
      return;
    }

    const button = document.createElement("span");
    button.textContent = "🚫";
    button.className = "threads-block-button";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      void this.handleClick(post);
    });

    post.usernameElement.append(button);
  }

  private async handleClick(post: ThreadPost): Promise<void> {
    const confirmed = window.confirm(`是否封鎖 @${post.username}?`);

    if (!confirmed) {
      return;
    }

    await this.blockListManager.addManual(post.username);

    post.hide();
  }

  private hasButton(post: ThreadPost): boolean {
    return post.rootElement.querySelector(".threads-block-button") !== null;
  }
}
