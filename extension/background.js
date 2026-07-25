// Listener para capturar videos sin bloquear la navegación (Ultra estable)
chrome.webRequest.onBeforeRequest.addListener(
  async (detalles) => {
    const url = detalles.url;
    const tabId = detalles.tabId;

    if (tabId === -1 || !tabId) return;

    // Filtro para ignorar publicidad obvia
    if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes("adsterra")) return;

    // Captura flujos de video reales
    if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".m4s") || url.includes(".ts")) {
      
      // Recuperar de almacenamiento persistente porque el Service Worker se duerme
      const data = await chrome.storage.local.get("videosPorPestaña");
      const videosPorPestaña = data.videosPorPestaña || {};

      if (!videosPorPestaña[tabId]) {
        videosPorPestaña[tabId] = [];
      }
      
      if (!videosPorPestaña[tabId].includes(url)) {
        videosPorPestaña[tabId].push(url);
        // Guardar de forma persistente
        await chrome.storage.local.set({ videosPorPestaña });
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Gestión de mensajes del Popup y control de Descargas Activas
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "obtenerVideosDeRed") {
    chrome.storage.local.get("videosPorPestaña").then((data) => {
      const videosPorPestaña = data.videosPorPestaña || {};
      sendResponse({ videos: videosPorPestaña[request.tabId] || [] });
    });
    return true; // Mantiene el canal abierto asíncronamente
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

  // LOGICA DE DESCARGA DESDE SEGUNDO PLANO
  if (request.action === "iniciarDescarga") {
    const videoUrl = request.url;
    
    if (videoUrl.includes(".m3u8")) {
      // Si es una lista M3U8, requiere procesamiento por fragmentos
      procesarYDescargarM3U8(videoUrl, request.tabId);
    } else {
      // Si es MP4 directo, usamos la API nativa directamente
      chrome.downloads.download({
        url: videoUrl,
        filename: request.nombreArchivo || "video_descargado.mp4",
        conflictAction: "uniq"
      }, (downloadId) => {
        // Informamos al popup el ID de descarga para controlar botones de reproducción
        chrome.runtime.sendMessage({ action: "descargaIniciada", downloadId, tabId: request.tabId });
      });
    }
    sendResponse({ procesando: true });
  }
  return true;
});

// Limpieza al cerrar pestañas
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("videosPorPestaña");
  const videosPorPestaña = data.videosPorPestaña || {};
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
    await chrome.storage.local.set({ videosPorPestaña });
  }
});

// Función base para descargar transmisiones M3U8 de forma asíncrona
async function procesarYDescargarM3U8(url, tabId) {
  try {
    // 1. Notificar al popup que empezó el procesamiento
    chrome.runtime.sendMessage({ action: "progresoDescarga", porcentaje: 5, tabId });

    const respuesta = await fetch(url);
    const textoM3u8 = await respuesta.text();
    
    // Filtro simple para obtener las líneas de segmentos (.ts)
    const lineas = textoM3u8.split("\n");
    const segmentosUrls = lineas.filter(linea => linea.trim() !== "" && !linea.startsWith("#"));

    if (segmentosUrls.length === 0) {
      chrome.runtime.sendMessage({ action: "errorDescarga", error: "No se encontraron fragmentos de video.", tabId });
      return;
    }

    // Para evitar congelamientos, en lugar de descargar 300 fragmentos en memoria local por JS,
    // si el servidor permite acceso directo, descargamos la lista de reproducción mapeada
    // o enviamos el flujo corregido. Para videos protegidos, forzamos la descarga del archivo índice:
    chrome.downloads.download({
      url: url,
      filename: "stream_lista.m3u8",
      conflictAction: "uniq"
    });

    chrome.runtime.sendMessage({ action: "progresoDescarga", porcentaje: 100, tabId });
  } catch (error) {
    chrome.runtime.sendMessage({ action: "errorDescarga", error: error.message, tabId });
  }
}
