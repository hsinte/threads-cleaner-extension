import { BlockListManager } from "@/core/BlockListManager";
import { BlockSourceStorage } from "@/storage/BlockSourceStorage";
import { CommunityAutoUpdateStorage } from "@/storage/CommunityAutoUpdateStorage";
import { applyStaticTranslations, getHtmlLang, t } from "@/i18n";
import { FeedbackController } from "./FeedbackController";
import { PopupController } from "./PopupController";
import { ThemeController } from "./ThemeController";
import "./style.css";

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(t("elementNotFound", { selector }));
  }

  return element;
}

async function bootstrap(): Promise<void> {
  //
  // 語言偵測是同步的,盡早套用靜態文字,不會有畫面閃爍
  //
  document.documentElement.lang = getHtmlLang();
  document.title = t("headerTitle");
  applyStaticTranslations();

  //
  // 主題盡早套用,減少畫面閃爍
  //
  const themeController = new ThemeController(
    queryElement<HTMLButtonElement>("#theme-toggle-button"),
  );
  const themeReady = themeController.initialize();

  const manager = new BlockListManager(
    new BlockSourceStorage(),
    new CommunityAutoUpdateStorage(),
  );

  const controller = new PopupController(manager, {
    searchInput: queryElement<HTMLInputElement>("#search-input"),
    addForm: queryElement<HTMLFormElement>("#add-form"),
    addInput: queryElement<HTMLInputElement>("#add-input"),
    exportButton: queryElement<HTMLButtonElement>("#export-button"),
    importButton: queryElement<HTMLButtonElement>("#import-button"),
    importFileInput: queryElement<HTMLInputElement>("#import-file-input"),
    communityRefreshButton: queryElement<HTMLButtonElement>(
      "#community-refresh-button",
    ),
    communityAutoUpdateCheckbox: queryElement<HTMLInputElement>(
      "#community-auto-update-checkbox",
    ),
    communityStatus: queryElement<HTMLElement>("#community-status"),
    listElement: queryElement<HTMLUListElement>("#block-list"),
    countLabel: queryElement<HTMLElement>("#count-label"),
  });

  await controller.initialize();

  //
  // FeedbackController 需要跟 popup 主流程共用同一個 manager 實例,
  // 「載入目前清單」按鈕才能拿到已經 initialize() 過的資料
  //
  new FeedbackController(manager, {
    openButton: queryElement<HTMLButtonElement>("#feedback-open-button"),
    dialog: queryElement<HTMLDialogElement>("#feedback-dialog"),
    form: queryElement<HTMLFormElement>("#feedback-form"),
    typeSelect: queryElement<HTMLSelectElement>("#feedback-type"),
    fillListButton: queryElement<HTMLButtonElement>(
      "#feedback-fill-list-button",
    ),
    descriptionInput: queryElement<HTMLTextAreaElement>(
      "#feedback-description",
    ),
    emailInput: queryElement<HTMLInputElement>("#feedback-email"),
    fileInput: queryElement<HTMLInputElement>("#feedback-file"),
    cancelButton: queryElement<HTMLButtonElement>("#feedback-cancel-button"),
    submitButton: queryElement<HTMLButtonElement>("#feedback-submit-button"),
    statusMessage: queryElement<HTMLElement>("#feedback-status"),
  });

  await themeReady;
}

void bootstrap();
