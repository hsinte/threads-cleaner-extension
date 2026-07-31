const STORAGE_KEY = "popup-theme";

type Theme = "light" | "dark";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * 管理 popup 的淺色/深色主題切換,並把使用者的選擇記在 chrome.storage.local。
 * 沒有存過偏好時,預設跟隨系統目前的淺色/深色設定。
 */
export class ThemeController {
  private theme: Theme = "dark";

  constructor(private readonly toggleButton: HTMLButtonElement) {
    this.toggleButton.addEventListener("click", () => {
      void this.toggle();
    });
  }

  public async initialize(): Promise<void> {
    const stored = await chrome.storage.local.get({ [STORAGE_KEY]: null });

    this.theme = isTheme(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY]
      : getSystemTheme();

    this.apply();
  }

  private async toggle(): Promise<void> {
    this.theme = this.theme === "dark" ? "light" : "dark";
    this.apply();

    await chrome.storage.local.set({ [STORAGE_KEY]: this.theme });
  }

  private apply(): void {
    document.documentElement.dataset.theme = this.theme;
    this.toggleButton.textContent = this.theme === "dark" ? "☀️" : "🌙";
    this.toggleButton.title =
      this.theme === "dark" ? "切換成淺色主題" : "切換成深色主題";
  }
}
