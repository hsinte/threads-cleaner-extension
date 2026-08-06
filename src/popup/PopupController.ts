import {
  BlockEntry,
  BlockListManager,
  RefreshResult,
} from "@/core/BlockListManager";
import {
  parseBlockListText,
  serializeBlockListText,
} from "@/core/blockListFormat";
import { normalizeUsername } from "@/core/normalizeUsername";
import { getIntlLocale, t } from "@/i18n";
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

    this.elements.communityAutoUpdateCheckbox.checked =
      this.manager.isAutoUpdateEnabled();

    void this.runAutoUpdateIfDue();
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

    this.elements.communityAutoUpdateCheckbox.addEventListener(
      "change",
      () => {
        void this.handleAutoUpdateToggle();
      },
    );
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
    const confirmed = window.confirm(t("unblockConfirm", { username }));

    if (!confirmed) {
      return;
    }

    await this.manager.unblock(username);

    this.render();
  }

  private handleExport(): void {
    const users = this.manager.getManualUsers();

    const text = serializeBlockListText(users, {
      Title: t("exportTitle"),
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
      this.showCommunityMessage(t("importReadFailed"), true);
      return;
    }

    const parsed = parseBlockListText(text);

    if (parsed.users.length === 0) {
      this.showCommunityMessage(t("importEmptyOrInvalid"), true);
      return;
    }

    const addedCount = await this.manager.addManyManual(parsed.users);
    const duplicateCount = parsed.users.length - addedCount;

    this.render();

    const skippedNote =
      parsed.skippedLines > 0
        ? t("importSkippedNote", { count: parsed.skippedLines })
        : "";

    this.showCommunityMessage(
      t("importSuccess", {
        added: addedCount,
        duplicate: duplicateCount,
        skippedNote,
      }),
      false,
    );
  }

  private async handleCommunityRefresh(): Promise<void> {
    this.elements.communityRefreshButton.disabled = true;
    this.showCommunityMessage(t("communityRefreshing"), false);

    const result = await this.manager.refreshCommunityList();

    this.elements.communityRefreshButton.disabled = false;

    this.applyRefreshResult(result);
  }

  private async handleAutoUpdateToggle(): Promise<void> {
    const enabled = this.elements.communityAutoUpdateCheckbox.checked;

    await this.manager.setAutoUpdateEnabled(enabled);

    if (!enabled) {
      return;
    }

    //
    // 剛打開自動更新,如果已經超過一天沒檢查過,馬上檢查一次,
    // 不用等到下次重新打開 popup。
    //
    await this.runAutoUpdateIfDue();
  }

  /**
   * popup 開啟、或剛打開自動更新開關時呼叫。
   * 是否真的觸發檢查由 BlockListManager 內部判斷(有沒有勾選、隔了多久)。
   */
  private async runAutoUpdateIfDue(): Promise<void> {
    const result = await this.manager.maybeAutoRefreshCommunityList();

    if (!result) {
      return;
    }

    this.applyRefreshResult(result);
  }

  private applyRefreshResult(result: RefreshResult): void {
    if (result.status === "error") {
      this.showCommunityMessage(result.message, true);
      return;
    }

    if (result.status === "unchanged") {
      this.showCommunityMessage(
        t("communityUnchanged", { total: result.total }),
        false,
      );
    } else {
      this.showCommunityMessage(
        t("communityUpdated", {
          added: result.added,
          removed: result.removed,
          total: result.total,
        }),
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
      this.showCommunityMessage(t("communityNeverFetched"), false);
      return;
    }

    const updatedAt = new Date(status.fetchedAt).toLocaleString(
      getIntlLocale(),
    );

    this.showCommunityMessage(
      t("communityStatus", {
        name: status.name,
        count: status.count,
        updatedAt,
      }),
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

    this.elements.countLabel.textContent = t("countLabel", { count: total });
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
    li.textContent = this.searchQuery ? t("searchNoResult") : t("searchHint");

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
      badge.textContent = t("communityBadge");
      badge.title = t("communityBadgeTitle");

      li.append(badge);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "block-item__remove";
    removeButton.textContent = t("unblockButton");

    removeButton.addEventListener("click", () => {
      void this.handleRemove(entry.username);
    });

    li.append(removeButton);

    return li;
  }
}
