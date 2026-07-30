import { BlockListManager } from "@/core/BlockListManager";
import { BlockSourceStorage } from "@/storage/BlockSourceStorage";
import { PopupController } from "./PopupController";
import "./style.css";

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`找不到元素: ${selector}`);
  }

  return element;
}

async function bootstrap(): Promise<void> {
  const manager = new BlockListManager(new BlockSourceStorage());

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
    communityStatus: queryElement<HTMLElement>("#community-status"),
    listElement: queryElement<HTMLUListElement>("#block-list"),
    countLabel: queryElement<HTMLElement>("#count-label"),
  });

  await controller.initialize();
}

void bootstrap();
