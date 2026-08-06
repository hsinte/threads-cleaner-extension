import {
  BlockSourcesData,
  BlockSourceStorage,
} from "@/storage/BlockSourceStorage";
import {
  AutoUpdateState,
  CommunityAutoUpdateStorage,
} from "@/storage/CommunityAutoUpdateStorage";
import { COMMUNITY_LIST_URL } from "./constants";
import { parseBlockListText } from "./blockListFormat";
import { sha256 } from "./sha256";
import { t } from "@/i18n";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface BlockEntry {
  username: string;
  source: "manual" | "community";
}

export interface CommunityListStatus {
  name: string;
  count: number;
  fetchedAt: number | null;
}

export type RefreshResult =
  | { status: "updated"; added: number; removed: number; total: number }
  | { status: "unchanged"; total: number }
  | { status: "error"; message: string };

/**
 * 唯一的封鎖名單管理入口,content script 跟 popup 共用。
 *
 * 資料模型:
 * - manual: 使用者手動加的(popup 新增 / 頁面上點封鎖按鈕 / 匯入)
 * - excluded: 使用者手動解除封鎖過的 username,用來覆蓋社群清單
 * - subscriptions: 從社群清單網址抓回來的
 *
 * 對外只暴露 has() / getEntries() 這種「已經算好」的結果,
 * 呼叫端(content script、popup)不需要知道這三層怎麼疊起來的。
 */
export class BlockListManager {
  private data: BlockSourcesData = {
    manual: [],
    excluded: [],
    subscriptions: {},
  };

  private effective: Set<string> = new Set();

  private autoUpdate: AutoUpdateState = { enabled: false, lastCheckedAt: null };

  constructor(
    private readonly storage: BlockSourceStorage,
    private readonly autoUpdateStorage: CommunityAutoUpdateStorage,
  ) {}

  public async initialize(): Promise<void> {
    await this.storage.migrateLegacyIfNeeded();

    const [data, autoUpdate] = await Promise.all([
      this.storage.load(),
      this.autoUpdateStorage.load(),
    ]);

    this.data = data;
    this.autoUpdate = autoUpdate;

    this.recomputeEffective();
  }

  /**
   * 監聽資料在別處(例如 popup)被修改,自動重新計算並回呼。
   * 回傳一個取消監聽的函式。
   */
  public watch(onChange: () => void): () => void {
    return this.storage.watch((data) => {
      this.data = data;

      this.recomputeEffective();

      onChange();
    });
  }

  public has(username: string): boolean {
    return this.effective.has(username);
  }

  public getEntries(): BlockEntry[] {
    const entries = new Map<string, BlockEntry>();
    const excludedSet = new Set(this.data.excluded);

    for (const username of this.getAllSubscriptionUsernames()) {
      if (excludedSet.has(username)) {
        continue;
      }

      entries.set(username, { username, source: "community" });
    }

    //
    // manual 優先權較高:同一個 username 兩邊都有的話,顯示成 manual。
    //
    for (const username of this.data.manual) {
      entries.set(username, { username, source: "manual" });
    }

    return [...entries.values()];
  }

  public getManualUsers(): string[] {
    return [...this.data.manual];
  }

  public async addManual(username: string): Promise<void> {
    const alreadyManual = this.data.manual.includes(username);
    const alreadyExcluded = this.data.excluded.includes(username);

    if (alreadyManual && !alreadyExcluded) {
      return;
    }

    this.data = {
      ...this.data,
      manual: alreadyManual
        ? this.data.manual
        : [...this.data.manual, username],
      excluded: this.data.excluded.filter((user) => user !== username),
    };

    await this.persist();
  }

  /**
   * 批次新增(匯入用)。回傳實際新增的筆數(扣除本來就有的)。
   */
  public async addManyManual(usernames: string[]): Promise<number> {
    const manualSet = new Set(this.data.manual);
    let addedCount = 0;

    for (const username of usernames) {
      if (!manualSet.has(username)) {
        manualSet.add(username);
        addedCount++;
      }
    }

    const importedSet = new Set(usernames);

    this.data = {
      ...this.data,
      manual: [...manualSet],
      excluded: this.data.excluded.filter((user) => !importedSet.has(user)),
    };

    await this.persist();

    return addedCount;
  }

  /**
   * 解除封鎖,不管這個 username 是手動加的還是來自社群清單都適用:
   * - 如果是手動加的,直接從 manual 移除
   * - 如果來自社群清單,加進 excluded,之後社群清單再更新也不會讓它復活
   */
  public async unblock(username: string): Promise<void> {
    const wasManual = this.data.manual.includes(username);
    const isFromSubscription = this.getAllSubscriptionUsernames().has(username);

    if (!wasManual && !isFromSubscription) {
      return;
    }

    this.data = {
      ...this.data,
      manual: wasManual
        ? this.data.manual.filter((user) => user !== username)
        : this.data.manual,
      excluded:
        isFromSubscription && !this.data.excluded.includes(username)
          ? [...this.data.excluded, username]
          : this.data.excluded,
    };

    await this.persist();
  }

  public getCommunityListStatus(): CommunityListStatus {
    const subscription = this.data.subscriptions[COMMUNITY_LIST_URL];

    return {
      name: subscription?.name ?? t("communityTitle"),
      count: subscription?.users.length ?? 0,
      fetchedAt: subscription?.fetchedAt ?? null,
    };
  }

  public isAutoUpdateEnabled(): boolean {
    return this.autoUpdate.enabled;
  }

  public async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    if (this.autoUpdate.enabled === enabled) {
      return;
    }

    this.autoUpdate = { ...this.autoUpdate, enabled };

    await this.autoUpdateStorage.save(this.autoUpdate);
  }

  /**
   * 使用者有勾選自動更新,而且距離上次檢查超過一天,才會真的檢查一次。
   * 不管檢查結果是更新/沒變/失敗,都算「檢查過了」,今天不會再檢查第二次。
   * 沒有觸發檢查的話回傳 null。
   */
  public async maybeAutoRefreshCommunityList(): Promise<RefreshResult | null> {
    if (!this.autoUpdate.enabled) {
      return null;
    }

    const { lastCheckedAt } = this.autoUpdate;

    if (lastCheckedAt !== null && Date.now() - lastCheckedAt < ONE_DAY_MS) {
      return null;
    }

    return this.refreshCommunityList();
  }

  public async refreshCommunityList(): Promise<RefreshResult> {
    await this.markChecked();

    let text: string;

    try {
      const response = await fetch(COMMUNITY_LIST_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return {
          status: "error",
          message: t("communityDownloadHttpError", {
            status: response.status,
          }),
        };
      }

      text = await response.text();
    } catch (error) {
      const isTimeout =
        error instanceof DOMException && error.name === "TimeoutError";

      return {
        status: "error",
        message: isTimeout
          ? t("communityDownloadTimeout")
          : t("communityDownloadFailed"),
      };
    }

    const parsed = parseBlockListText(text);

    if (parsed.users.length === 0) {
      return { status: "error", message: t("communityEmptyOrInvalid") };
    }

    const contentHash = await sha256(text);
    const previous = this.data.subscriptions[COMMUNITY_LIST_URL];

    if (previous && previous.contentHash === contentHash) {
      return { status: "unchanged", total: previous.users.length };
    }

    const previousUsers = new Set(previous?.users ?? []);
    const nextUsers = new Set(parsed.users);

    const added = [...nextUsers].filter(
      (username) => !previousUsers.has(username),
    ).length;
    const removed = [...previousUsers].filter(
      (username) => !nextUsers.has(username),
    ).length;

    this.data = {
      ...this.data,
      subscriptions: {
        ...this.data.subscriptions,
        [COMMUNITY_LIST_URL]: {
          name: parsed.meta.Title ?? t("communityTitle"),
          users: parsed.users,
          contentHash,
          fetchedAt: Date.now(),
        },
      },
    };

    await this.persist();

    return { status: "updated", added, removed, total: parsed.users.length };
  }

  private async persist(): Promise<void> {
    await this.storage.save(this.data);

    this.recomputeEffective();
  }

  private async markChecked(): Promise<void> {
    this.autoUpdate = { ...this.autoUpdate, lastCheckedAt: Date.now() };

    await this.autoUpdateStorage.save(this.autoUpdate);
  }

  private recomputeEffective(): void {
    const union = new Set<string>(this.data.manual);

    for (const username of this.getAllSubscriptionUsernames()) {
      union.add(username);
    }

    for (const username of this.data.excluded) {
      union.delete(username);
    }

    this.effective = union;
  }

  /**
   * 所有訂閱來源(目前只有一份社群清單,但資料結構本來就支援多份)
   * 的使用者聯集。getEntries()、recomputeEffective()、unblock() 都會用到,
   * 抽出來避免同一段迴圈重複寫三次。
   */
  private getAllSubscriptionUsernames(): Set<string> {
    const usernames = new Set<string>();

    for (const subscription of Object.values(this.data.subscriptions)) {
      for (const username of subscription.users) {
        usernames.add(username);
      }
    }

    return usernames;
  }
}
