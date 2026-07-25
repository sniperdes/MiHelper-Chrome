const videosPorPestaña = {};

chrome.webRequest.onBeforeRequest.addListener(
  (detalles) => {
    const url = detalles.url;
    const tabId = detalles.tabId;

    if (tabId === -1) return;

    // Filtro para ignorar publicidad obvia
    if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes("adsterra")) return;

    // Captura flujos de video reales
    if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".m4s") || url.includes(".ts")) {
      if (!videosPorPestaña[tabId]) {
        videosPorPestaña[tabId] = [];
      }
      if (!videosPorPestaña[tabId].includes(url)) {
        videosPorPestaña[tabId].push(url);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerVideosDeRed") {
    sendResponse({ videos: videosPorPestaña[request.tabId] || [] });
  }
  if (request.action === "limpiarVideos") {
    videosPorPestaña[request.tabId] = [];
    sendResponse({ ok: true });
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (videosPorPestaña[tabId]) delete videosPorPestaña[tabId];
});

