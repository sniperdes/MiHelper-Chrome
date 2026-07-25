try {
  chrome.webRequest.onBeforeRequest.addListener(
    (detalles) => {
      const url = detalles.url;
      const tabId = detalles.tabId;

      if (tabId === -1 || !tabId) return;

      // Filtro para omitir anuncios, scripts de analíticas e imágenes estáticas de pre-carga
      if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes(".jpg") || url.includes(".png") || url.includes(".gif")) return;

      // Capturar estrictamente los archivos de video e índices de transmisión válidos
      if (url.includes(".mp4") || url.includes(".m3u8")) {
        chrome.storage.local.get("videosPorPestaña").then((data) => {
          const videosPorPestaña = data.videosPorPestaña || {};

          if (!videosPorPestaña[tabId]) {
            videosPorPestaña[tabId] = [];
          }
          
          if (!videosPorPestaña[tabId].includes(url)) {
            videosPorPestaña[tabId].push(url);
            chrome.storage.local.set({ videosPorPestaña });
          }
        }).catch(err => console.log("Error de almacenamiento:", err));
      }
    },
    { urls: ["<all_urls>"] }
  );
} catch (error) {
  console.error("Error en capturador de red:", error);
}

// Manejador de eventos y puente de descargas nativas
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
    
    chrome.downloads.download({
      url: videoUrl,
      filename: request.nombreArchivo,
      conflictAction: "uniquify"
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Error al iniciar descarga nativa:", chrome.runtime.lastError.message);
        return;
      }
      
      // Notificar de inmediato al popup que la descarga comenzó exitosamente
      chrome.runtime.sendMessage({
        action: "descargaProgreso",
        url: videoUrl,
        downloadId: downloadId,
        estado: "en_progreso"
      });
    });
    sendResponse({ ok: true });
  }
  return true;
});

// Monitorear en tiempo real el progreso del gestor de descargas de Chrome
chrome.downloads.onChanged.addListener((delta) => {
  // Cuando una descarga cambia de estado, buscamos si finalizó con éxito
  if (delta.state && delta.state.current === "complete") {
    chrome.downloads.search({ id: delta.id }, (resultados) => {
      if (resultados && resultados.length > 0) {
        const itemDescarga = resultados[0];
        
        // Avisar al popup para cambiar el diseño del botón específico a "Reproducir"
        chrome.runtime.sendMessage({
          action: "descargaProgreso",
          url: itemDescarga.url,
          downloadId: delta.id,
          estado: "completado"
        });
      }
    });
  }
});

// Limpieza al cerrar la pestaña activa
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("videosPorPestaña");
  const videosPorPestaña = data.videosPorPestaña || {};
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
    await chrome.storage.local.set({ videosPorPestaña });
  }
});
