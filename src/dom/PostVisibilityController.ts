import { BlockListManager } from "@/core/BlockListManager";
import { ThreadPost } from "./ThreadPost";

/**
 * 根據封鎖名單同步一篇貼文的顯示狀態:
 * 在名單裡就藏起來,不在名單裡(包含名單在別處被更新、解除封鎖)就還原顯示。
 */
export class PostVisibilityController {
  constructor(private readonly blockListManager: BlockListManager) {}

  public syncVisibility(post: ThreadPost): void {
    if (this.blockListManager.has(post.username)) {
      post.hide();
      return;
    }

    post.show();
  }
}
