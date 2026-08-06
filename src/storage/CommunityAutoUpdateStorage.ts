import { isExtensionContextInvalidated } from "./extensionContext";

export interface AutoUpdateState {
  enabled: boolean;
  lastCheckedAt: number | null;
}

function emptyState(): AutoUpdateState {
  return { enabled: false, lastCheckedAt: null };
}

/**
 * 社群清單「自動更新」開關與上次檢查時間。
 * 跟 BlockSourceStorage(封鎖名單本體)分開存,這是使用者偏好設定,不是名單資料。
 */
export class CommunityAutoUpdateStorage {
  private static readonly KEY = "community-auto-update";

  public async load(): Promise<AutoUpdateState> {
    try {
      const result = await chrome.storage.local.get({
        [CommunityAutoUpdateStorage.KEY]: null,
      });

      return this.ensureShape(result[CommunityAutoUpdateStorage.KEY]);
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        return emptyState();
      }

      throw error;
    }
  }

  public async save(state: AutoUpdateState): Promise<void> {
    try {
      await chrome.storage.local.set({
        [CommunityAutoUpdateStorage.KEY]: state,
      });
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        return;
      }

      throw error;
    }
  }

  private ensureShape(value: unknown): AutoUpdateState {
    if (!value || typeof value !== "object") {
      return emptyState();
    }

    const raw = value as Partial<AutoUpdateState>;

    return {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : false,
      lastCheckedAt:
        typeof raw.lastCheckedAt === "number" ? raw.lastCheckedAt : null,
    };
  }
}
