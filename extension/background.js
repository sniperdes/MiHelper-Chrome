const videosPorPestaña = {};

chrome.webRequest.onBeforeRequest.addListener(
  (detalles) => {
    const url = detalles.url;
    const tabId = detalles.tabId;

    if (tabId === -1) return;

    // Ignorar archivos basura de publicidad o imágenes que tengan esas letras por casualidad
    if (url.includes("analytics") || url.includes("ads") || url.includes(".jpg") || url.includes(".png")) return;

    let tipoDetectado = null;

    // Clasificación estricta del recurso de video
    if (url.includes(".m3u8")) {
      tipoDetectado = "🔴 LISTA M3U8 (HLS)";
    } else if (url.includes(".mp4")) {
      tipoDetectado = "🔵 VIDEO MP4";
    } else if (url.includes(".m4s") || url.includes(".ts")) {
      tipoDetectado = "📦 FRAGMENTO DE VIDEO (TS/M4S)";
    }

    if (tipoDetectado) {
      if (!videosPorPestaña[tabId]) {
        videosPorPestaña[tabId] = [];
      }

      // Validamos si la URL ya existe para no duplicarla
      const yaExiste = videosPorPestaña[tabId].some(item => item.url === url);
      
      if (!yaExiste) {
        videosPorPestaña[tabId].push({
          url: url,
          tipo: tipoDetectado,
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        console.log(`[MiHelper] Detectado: ${tipoDetectado} -> ${url}`);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Escuchamos las peticiones del popup (incluyendo la opción de limpiar la lista)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerVideosDeRed") {
    sendResponse({ videos: videosPorPestaña[request.tabId] || [] });
  }
  
  if (request.action === "limpiarVideos") {
    videosPorPestaña[request.tabId] = [];
    sendResponse({ num: 0 });
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (videosPorPestaña[tabId]) delete videosPorPestaña[tabId];
});
