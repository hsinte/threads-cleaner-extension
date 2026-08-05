import { t } from "@/i18n";

export interface SubscriptionData {
  name: string;
  users: string[];
  contentHash: string;
  fetchedAt: number;
}

export interface BlockSourcesData {
  manual: string[];

  //
  // 使用者手動排除的 username,用來覆蓋社群清單
  // (社群清單裡還在,但使用者自己解除封鎖過)
  //
  excluded: string[];

  subscriptions: Record<string, SubscriptionData>;
}

function emptyData(): BlockSourcesData {
  return { manual: [], excluded: [], subscriptions: {} };
}

/**
 * 唯一的儲存來源:manual(手動)+ excluded(手動排除)+ subscriptions(社群訂閱)。
 * content script 跟 popup 都直接讀寫這一份,不再另外維護一份壓平後的清單。
 */
export class BlockSourceStorage {
  private static readonly KEY = "block-sources";

  //
  // 舊版(拆分兩層之前)的 key,只用來做一次性資料搬移。
  //
  private static readonly LEGACY_KEY = "local-block-users";

  public async load(): Promise<BlockSourcesData> {
    const result = await chrome.storage.local.get({
      [BlockSourceStorage.KEY]: null,
    });

    return this.ensureShape(result[BlockSourceStorage.KEY]);
  }

  public async save(data: BlockSourcesData): Promise<void> {
    await chrome.storage.local.set({
      [BlockSourceStorage.KEY]: data,
    });
  }

  /**
   * 監聽資料變化(例如在 popup 修改後,讓 content script 同步)。
   * 回傳一個取消監聽的函式。
   */
  public watch(onChange: (data: BlockSourcesData) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ): void => {
      if (areaName !== "local") {
        return;
      }

      const change = changes[BlockSourceStorage.KEY];

      if (!change) {
        return;
      }

      onChange(this.ensureShape(change.newValue));
    };

    chrome.storage.onChanged.addListener(listener);

    return () => chrome.storage.onChanged.removeListener(listener);
  }

  /**
   * 把舊版扁平清單(local-block-users)搬進 manual,只會實際搬移一次。
   * 不管有沒有搬移,舊 key 用不到了就清掉。
   */
  public async migrateLegacyIfNeeded(): Promise<void> {
    const result = await chrome.storage.local.get({
      [BlockSourceStorage.KEY]: null,
      [BlockSourceStorage.LEGACY_KEY]: null,
    });

    const legacyValue = result[BlockSourceStorage.LEGACY_KEY];

    if (legacyValue === null) {
      return;
    }

    const alreadyMigrated = result[BlockSourceStorage.KEY] !== null;

    if (!alreadyMigrated) {
      const legacyUsers = this.ensureStringArray(legacyValue);

      if (legacyUsers.length > 0) {
        await this.save({ ...emptyData(), manual: legacyUsers });
      }
    }

    await chrome.storage.local.remove(BlockSourceStorage.LEGACY_KEY);
  }

  private ensureShape(value: unknown): BlockSourcesData {
    if (!value || typeof value !== "object") {
      return emptyData();
    }

    const raw = value as Partial<BlockSourcesData>;

    return {
      manual: this.ensureStringArray(raw.manual),
      excluded: this.ensureStringArray(raw.excluded),
      subscriptions: this.ensureSubscriptions(raw.subscriptions),
    };
  }

  private ensureSubscriptions(
    value: unknown,
  ): Record<string, SubscriptionData> {
    if (!value || typeof value !== "object") {
      return {};
    }

    const result: Record<string, SubscriptionData> = {};

    for (const [url, subscription] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!subscription || typeof subscription !== "object") {
        continue;
      }

      const rawSubscription = subscription as Partial<SubscriptionData>;

      result[url] = {
        name:
          typeof rawSubscription.name === "string"
            ? rawSubscription.name
            : t("communityTitle"),
        users: this.ensureStringArray(rawSubscription.users),
        contentHash:
          typeof rawSubscription.contentHash === "string"
            ? rawSubscription.contentHash
            : "",
        fetchedAt:
          typeof rawSubscription.fetchedAt === "number"
            ? rawSubscription.fetchedAt
            : 0,
      };
    }

    return result;
  }

  private ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  }
}
