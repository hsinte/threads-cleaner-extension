export interface ThreadPostData {
  username: string;
  rootElement: HTMLElement;
  usernameElement: HTMLElement;
}

/**
 * 代表頁面上一篇已經被解析出來的貼文,
 * 包裝實際的 DOM 節點,提供隱藏/顯示的操作介面。
 */
export class ThreadPost {
  public readonly username: string;

  private readonly _rootElement: HTMLElement;
  private readonly _usernameElement: HTMLElement;

  constructor(data: ThreadPostData) {
    this.username = data.username;
    this._rootElement = data.rootElement;
    this._usernameElement = data.usernameElement;
  }

  public get rootElement(): HTMLElement {
    return this._rootElement;
  }

  public get usernameElement(): HTMLElement {
    return this._usernameElement;
  }

  public hide(): void {
    if (this._rootElement.hidden) {
      return;
    }

    this._rootElement.hidden = true;
  }

  public show(): void {
    this._rootElement.hidden = false;
  }
}
