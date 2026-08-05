import { BlockListManager } from "@/core/BlockListManager";
import { t } from "@/i18n";
import { serializeBlockListText } from "@/core/blockListFormat";
import { encodeAttachment, EncodedAttachment } from "./compressImage";
import { FeedbackElements } from "./FeedbackElements";

const SUBMIT_ENDPOINT = "https://hsinte-mail.qazx0931.workers.dev";

//
// 這個類型不用強制填描述,因為使用者主要是靠附件/帶入的清單內容表達內容
//
const TYPE_WITHOUT_REQUIRED_DESCRIPTION = "提供名單";

//
// 約略對應 3MB 原始檔案大小(base64 編碼後會膨脹約 33%)
//
const MAX_ATTACHMENT_BASE64_LENGTH = 4_000_000;

/**
 * popup header 的意見回饋按鈕與彈出的 dialog:
 * 收集類型/描述/email/附件,送到 Cloudflare Worker 轉寄成 email。
 *
 * 「提供名單」這個類型有個「帶入目前的本地封鎖清單」按鈕,會把清單內容
 * 直接寫進使用者看得到、能刪改的描述欄位裡,而不是在背後偷偷夾帶——
 * 不管資料從哪來,使用者送出前一定親眼看過實際內容。
 *
 * 送出永遠是使用者自己按下「提交」才會發生,沒有任何自動送出的行為。
 */
export class FeedbackController {
  constructor(
    private readonly blockListManager: BlockListManager,
    private readonly elements: FeedbackElements,
  ) {
    this.bindEvents();
  }

  private bindEvents(): void {
    this.elements.openButton.addEventListener("click", () => {
      this.openDialog();
    });

    this.elements.cancelButton.addEventListener("click", () => {
      this.closeDialog();
    });

    this.elements.typeSelect.addEventListener("change", () => {
      this.syncFillListButtonVisibility();
    });

    this.elements.fillListButton.addEventListener("click", () => {
      this.fillCurrentList();
    });

    this.elements.form.addEventListener("submit", (event) => {
      event.preventDefault();

      void this.handleSubmit();
    });

    this.elements.dialog.addEventListener("close", () => {
      this.resetForm();
    });
  }

  private openDialog(): void {
    this.resetForm();
    this.elements.dialog.showModal();
  }

  private closeDialog(): void {
    this.elements.dialog.close();
  }

  private resetForm(): void {
    this.elements.form.reset();
    this.setStatus("", false);
    this.setSubmitting(false);
    this.syncFillListButtonVisibility();
  }

  private syncFillListButtonVisibility(): void {
    this.elements.fillListButton.hidden =
      this.elements.typeSelect.value !== TYPE_WITHOUT_REQUIRED_DESCRIPTION;
  }

  /**
   * 把目前的本地封鎖清單(跟「匯出本地名單」同一份序列化邏輯)
   * 直接寫進描述欄位,使用者可以在送出前自己刪改。
   */
  private fillCurrentList(): void {
    const users = this.blockListManager.getManualUsers();

    if (users.length === 0) {
      this.setStatus(t("feedbackFillListEmpty"), true);
      return;
    }

    const text = serializeBlockListText(users, {
      Title: t("exportTitle"),
      Exported: new Date().toISOString(),
    });

    const existing = this.elements.descriptionInput.value.trim();

    this.elements.descriptionInput.value = existing
      ? `${existing}\n\n${text}`
      : text;

    this.setStatus("", false);
  }

  private async handleSubmit(): Promise<void> {
    const type = this.elements.typeSelect.value;
    const description = this.elements.descriptionInput.value.trim();
    const email = this.elements.emailInput.value.trim();
    const file = this.elements.fileInput.files?.[0] ?? null;

    if (
      type !== TYPE_WITHOUT_REQUIRED_DESCRIPTION &&
      description.length === 0
    ) {
      this.setStatus(t("feedbackDescriptionRequired"), true);
      this.elements.descriptionInput.focus();
      return;
    }

    this.setSubmitting(true);

    try {
      let attachment: EncodedAttachment | null = null;

      if (file) {
        this.setStatus(t("feedbackProcessingAttachment"), false);
        attachment = await encodeAttachment(file);

        if (attachment.base64.length > MAX_ATTACHMENT_BASE64_LENGTH) {
          this.setStatus(t("feedbackAttachmentTooLarge"), true);
          this.setSubmitting(false);
          return;
        }
      }

      this.setStatus(t("feedbackSubmitting"), false);

      const response = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, email, attachment }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.setStatus(t("feedbackSubmitSuccess"), false);

      window.setTimeout(() => {
        this.closeDialog();
      }, 1200);
    } catch {
      this.setStatus(t("feedbackSubmitFailed"), true);
      this.setSubmitting(false);
    }
  }

  private setSubmitting(submitting: boolean): void {
    this.elements.submitButton.disabled = submitting;
    this.elements.cancelButton.disabled = submitting;
  }

  private setStatus(message: string, isError: boolean): void {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.classList.toggle("status--error", isError);
  }
}
