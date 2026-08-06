import { BlockListManager } from "@/core/BlockListManager";
import { BlockSourceStorage } from "@/storage/BlockSourceStorage";
import { CommunityAutoUpdateStorage } from "@/storage/CommunityAutoUpdateStorage";

const ALARM_NAME = "community-list-auto-update";

//
// MV3 的 service worker 不是常駐的,沒辦法「睡一整天再準時醒來」,
// 改成每小時醒來一次、檢查「距離上次檢查是否已經超過一天」——
// 真正的一天節流邏輯在 BlockListManager.maybeAutoRefreshCommunityList()
// 裡面判斷,這裡的 alarm 只負責定期把 service worker 叫醒而已,
// 就算瀏覽器整天沒開過 popup,只要瀏覽器有在執行,還是會被叫醒檢查。
//
const ALARM_PERIOD_MINUTES = 60;

function ensureAlarmExists(): void {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (existing) {
      return;
    }

    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: ALARM_PERIOD_MINUTES,
    });
  });
}

async function runAutoUpdateCheck(): Promise<void> {
  const manager = new BlockListManager(
    new BlockSourceStorage(),
    new CommunityAutoUpdateStorage(),
  );

  await manager.initialize();

  //
  // 有沒有勾選自動更新、距離上次檢查是否已經超過一天,
  // 都是 BlockListManager 內部判斷,這裡不用重複寫一次。
  //
  await manager.maybeAutoRefreshCommunityList();
}

//
// 安裝、更新擴充功能,或瀏覽器啟動時,確保 alarm 存在。
// chrome.alarms.create() 是冪等的(同名 alarm 會被取代),
// 但先用 get() 檢查可以避免每次都重設週期的起算時間。
//
chrome.runtime.onInstalled.addListener(() => {
  ensureAlarmExists();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarmExists();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  void runAutoUpdateCheck();
});
