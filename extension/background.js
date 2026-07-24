// Objeto temporal para guardar los videos encontrados agrupados por Pestaña (Tab ID)
const videosPorPestaña = {};

// Escuchamos todas las peticiones web de Chrome antes de que envíen datos
chrome.webRequest.onBeforeRequest.addListener(
  (detalles) => {
    const url = detalles.url;
    const tabId = detalles.tabId;

    // Si la petición no pertenece a una pestaña válida, la ignoramos
    if (tabId === -1) return;

    // Filtro básico para detectar formatos de video comunes
    if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".m4s") || url.includes(".ts")) {
      
      // Si es la primera vez que encontramos algo en esta pestaña, inicializamos su lista
      if (!videosPorPestaña[tabId]) {
        videosPorPestaña[tabId] = [];
      }

      // Evitamos duplicar la misma URL en la lista
      if (!videosPorPestaña[tabId].includes(url)) {
        videosPorPestaña[tabId].push(url);
        console.log(`[MiHelper] Video detectado en Tab ${tabId}: ${url}`);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Escuchamos cuando el popup nos pregunte si hay videos para la pestaña activa
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerVideosDeRed") {
    const listaVideos = videosPorPestaña[request.tabId] || [];
    sendResponse({ videos: listaVideos });
  }
  return true;
});

// Limpiamos la memoria cuando el usuario cierra una pestaña para no gastar RAM
chrome.tabs.onRemoved.addListener((tabId) => {
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
  }
});

