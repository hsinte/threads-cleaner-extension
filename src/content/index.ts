import { BlockListManager } from "@/core/BlockListManager";
import { BlockButtonInjector } from "@/dom/BlockButtonInjector";
import { PostParser } from "@/dom/PostParser";
import { PostVisibilityController } from "@/dom/PostVisibilityController";
import { ThreadFeed } from "@/dom/ThreadFeed";
import { ThreadObserver } from "@/dom/ThreadObserver";
import { BlockSourceStorage } from "@/storage/BlockSourceStorage";

const parser = new PostParser();
const feed = new ThreadFeed();
const observer = new ThreadObserver(parser, feed);

const blockListManager = new BlockListManager(new BlockSourceStorage());
await blockListManager.initialize();

const visibilityController = new PostVisibilityController(blockListManager);
const injector = new BlockButtonInjector(blockListManager);

observer.onPostAdded((post) => {
  visibilityController.syncVisibility(post);
  injector.inject(post);
});

observer.start();

//
// 封鎖名單可能在 popup 被新增/刪除/更新社群清單,
// 監聽 storage 變化並重新掃描頁面,讓畫面即時同步。
//
blockListManager.watch(() => {
  observer.rescan();
});
