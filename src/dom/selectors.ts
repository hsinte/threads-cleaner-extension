const PAGELET_PREFIXES = [
  "threads_feed_",
  "threads_post_page_",
  "threads_search_results_",
];

export const SELECTORS = {
  //
  // 一個 data-pagelet 容器(首頁動態消息 / 單篇貼文頁 / 搜尋結果)裡面
  // 可能不只一篇貼文,例如貼文下面會直接接一則「最高讚回覆」,
  // 兩者共用同一個 pagelet。所以「一篇貼文」的實際邊界要用
  // data-pressable-container,並且限定在上述三種 pagelet 裡面,
  // 避免抓到頁面上其他不相關、但也有這個屬性的元素。
  //
  post: PAGELET_PREFIXES.map(
    (prefix) =>
      `[data-pagelet^="${prefix}"] [data-pressable-container="true"]`,
  ).join(", "),
  username: 'a[href^="/@"]',
} as const;
