import { BlockEntry, BlockListManager } from "@/core/BlockListManager";
import {
  parseBlockListText,
  serializeBlockListText,
} from "@/core/blockListFormat";
import { normalizeUsername } from "@/core/normalizeUsername";
import { PopupElements } from "./PopupElements";

/**
 * popup 畫面的控制器:綁定 DOM 事件、呼叫 BlockListManager,並負責渲染畫面。
 */
export class PopupController {
  private searchQuery = "";

  constructor(
    private readonly manager: BlockListManager,
    private readonly elements: PopupElements,
  ) {}

  public async initialize(): Promise<void> {
    await this.manager.initialize();

    this.bindEvents();
    this.render();
    this.renderCommunityStatus();
  }

  private bindEvents(): void {
    this.elements.searchInput.addEventListener("input", () => {
      this.searchQuery = this.elements.searchInput.value.trim();

      this.render();
    });

    this.elements.addForm.addEventListener("submit", (event) => {
      event.preventDefault();

      void this.handleAdd();
    });

    this.elements.exportButton.addEventListener("click", () => {
      this.handleExport();
    });

    this.elements.importButton.addEventListener("click", () => {
      this.elements.importFileInput.click();
    });

    this.elements.importFileInput.addEventListener("change", () => {
      void this.handleImport();
    });

    this.elements.communityRefreshButton.addEventListener("click", () => {
      void this.handleCommunityRefresh();
    });
  }

  private async handleAdd(): Promise<void> {
    const username = normalizeUsername(this.elements.addInput.value);

    if (!username) {
      this.elements.addInput.focus();
      return;
    }

    await this.manager.addManual(username);

    this.elements.addInput.value = "";
    this.render();
  }

  private async handleRemove(username: string): Promise<void> {
    const confirmed = window.confirm(`是否解除封鎖 @${username}?`);

    if (!confirmed) {
      return;
    }

    await this.manager.unblock(username);

    this.render();
  }

  private handleExport(): void {
    const users = this.manager.getManualUsers();

    const text = serializeBlockListText(users, {
      Title: "本地封鎖清單",
      Exported: new Date().toISOString(),
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `threads-block-list-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private async handleImport(): Promise<void> {
    const file = this.elements.importFileInput.files?.[0];

    //
    // 清空 value,讓使用者可以連續兩次選同一個檔案也能觸發 change
    //
    this.elements.importFileInput.value = "";

    if (!file) {
      return;
    }

    let text: string;

    try {
      text = await file.text();
    } catch {
      this.showCommunityMessage("匯入失敗:無法讀取檔案內容", true);
      return;
    }

    const parsed = parseBlockListText(text);

    if (parsed.users.length === 0) {
      this.showCommunityMessage(
        "匯入失敗:檔案內容是空的,或格式無法辨識",
        true,
      );
      return;
    }

    const addedCount = await this.manager.addManyManual(parsed.users);
    const duplicateCount = parsed.users.length - addedCount;

    this.render();

    const skippedNote =
      parsed.skippedLines > 0 ? `,略過 ${parsed.skippedLines} 行無法辨識` : "";

    this.showCommunityMessage(
      `匯入完成:新增 ${addedCount} 位,重複 ${duplicateCount} 位${skippedNote}`,
      false,
    );
  }

  private async handleCommunityRefresh(): Promise<void> {
    this.elements.communityRefreshButton.disabled = true;
    this.showCommunityMessage("更新中...", false);

    const result = await this.manager.refreshCommunityList();

    this.elements.communityRefreshButton.disabled = false;

    if (result.status === "error") {
      this.showCommunityMessage(result.message, true);
      return;
    }

    if (result.status === "unchanged") {
      this.showCommunityMessage(`已是最新版本(共 ${result.total} 位)`, false);
    } else {
      this.showCommunityMessage(
        `已更新:+${result.added} / -${result.removed}(共 ${result.total} 位)`,
        false,
      );
    }

    this.render();
    this.renderCommunityStatus();
  }

  private showCommunityMessage(message: string, isError: boolean): void {
    this.elements.communityStatus.textContent = message;
    this.elements.communityStatus.classList.toggle("status--error", isError);
  }

  private renderCommunityStatus(): void {
    const status = this.manager.getCommunityListStatus();

    if (!status.fetchedAt) {
      this.showCommunityMessage("尚未下載過社群清單", false);
      return;
    }

    const updatedAt = new Date(status.fetchedAt).toLocaleString("zh-TW");

    this.showCommunityMessage(
      `${status.name}:共 ${status.count} 位(上次更新 ${updatedAt})`,
      false,
    );
  }

  private render(): void {
    const entries = this.getFilteredEntries();

    this.renderList(entries);
    this.renderCount();
  }

  private getFilteredEntries(): BlockEntry[] {
    if (!this.searchQuery) {
      return [];
    }

    const query = this.searchQuery.toLowerCase();

    return [...this.manager.getEntries()]
      .filter((entry) => entry.username.toLowerCase().includes(query))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  private renderCount(): void {
    const total = this.manager.getEntries().length;

    this.elements.countLabel.textContent = `已封鎖 ${total} 位使用者`;
  }

  private renderList(entries: BlockEntry[]): void {
    this.elements.listElement.innerHTML = "";

    if (entries.length === 0) {
      this.elements.listElement.append(this.createEmptyState());
      return;
    }

    for (const entry of entries) {
      this.elements.listElement.append(this.createListItem(entry));
    }
  }

  private createEmptyState(): HTMLLIElement {
    const li = document.createElement("li");

    li.className = "empty-state";
    li.textContent = this.searchQuery
      ? "找不到符合的使用者"
      : "輸入關鍵字以搜尋已封鎖的使用者";

    return li;
  }

  private createListItem(entry: BlockEntry): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "block-item";

    const name = document.createElement("span");
    name.className = "block-item__name";
    name.textContent = `@${entry.username}`;

    li.append(name);

    if (entry.source === "community") {
      const badge = document.createElement("span");
      badge.className = "block-item__badge";
      badge.textContent = "社群";
      badge.title = "來自社群清單";

      li.append(badge);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "block-item__remove";
    removeButton.textContent = "解除封鎖";

    removeButton.addEventListener("click", () => {
      void this.handleRemove(entry.username);
    });

    li.append(removeButton);

    return li;
  }
}
