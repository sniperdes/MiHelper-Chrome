// Variable temporal para evitar colisiones si se duerme el Service Worker
let cacheVideos = {};

// Inicializar el analizador de red de forma segura
try {
  chrome.webRequest.onBeforeRequest.addListener(
    (detalles) => {
      const url = detalles.url;
      const tabId = detalles.tabId;

      if (tabId === -1 || !tabId) return;

      // Filtro estricto para ignorar publicidad molesta
      if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes("adsterra")) return;

      // Captura flujos de video reales
      if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".m4s") || url.includes(".ts")) {
        
        chrome.storage.local.get("videosPorPestaña").then((data) => {
          const videosPorPestaña = data.videosPorPestaña || {};

          if (!videosPorPestaña[tabId]) {
            videosPorPestaña[tabId] = [];
          }
          
          if (!videosPorPestaña[tabId].includes(url)) {
            videosPorPestaña[tabId].push(url);
            chrome.storage.local.set({ videosPorPestaña });
          }
        }).catch(err => console.log("Error de almacenamiento temporal:", err));
      }
    },
    { urls: ["<all_urls>"] }
  );
} catch (error) {
  console.error("Error crítico al registrar el capturador de red:", error);
}

// Gestión de mensajes asíncronos del Popup y descargas
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "obtenerVideosDeRed") {
    chrome.storage.local.get("videosPorPestaña").then((data) => {
      const videosPorPestaña = data.videosPorPestaña || {};
      sendResponse({ videos: videosPorPestaña[request.tabId] || [] });
    });
    return true; 
  }

  if (request.action === "limpiarVideos") {
    chrome.storage.local.get("videosPorPestaña").then((data) => {
      const videosPorPestaña = data.videosPorPestaña || {};
      videosPorPestaña[request.tabId] = [];
      chrome.storage.local.set({ videosPorPestaña }).then(() => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (request.action === "iniciarDescarga") {
    const videoUrl = request.url;
    const tabId = request.tabId;
    
    if (videoUrl.includes(".m3u8")) {
      procesarYDescargarM3U8(videoUrl, tabId);
    } else {
      chrome.downloads.download({
        url: videoUrl,
        filename: request.nombreArchivo || "video_descargado.mp4",
        conflictAction: "uniquify"
      }, (downloadId) => {
        chrome.runtime.sendMessage({ 
          action: "descargaIniciada", 
          downloadId: downloadId, 
          url: videoUrl, 
          tabId: tabId 
        });
      });
    }
    sendResponse({ procesando: true });
  }
  return true;
});

// Limpieza automática al cerrar pestañas activas
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("videosPorPestaña");
  const videosPorPestaña = data.videosPorPestaña || {};
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
    await chrome.storage.local.set({ videosPorPestaña });
  }
});

// Gestor de transmisiones HLS continuas
async function procesarYDescargarM3U8(url, tabId) {
  try {
    chrome.runtime.sendMessage({ action: "progresoDescarga", porcentaje: 15, tabId });

    // Descarga directa del manifiesto estructurado
    chrome.downloads.download({
      url: url,
      filename: "video_streaming.m3u8",
      conflictAction: "uniquify"
    }, (downloadId) => {
      chrome.runtime.sendMessage({ 
        action: "descargaIniciada", 
        downloadId: downloadId, 
        url: url, 
        tabId: tabId 
      });
    });
  } catch (error) {
    console.error("Error procesando flujo M3U8:", error);
  }
}
