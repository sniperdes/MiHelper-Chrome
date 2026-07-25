try {
  chrome.webRequest.onBeforeRequest.addListener(
    (detalles) => {
      const url = detalles.url;
      const tabId = detalles.tabId;

      if (tabId === -1 || !tabId) return;

      if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes("adsterra")) return;

      // Captura de flujos reales
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
    const nombreSugerido = request.nombreArchivo ? request.nombreArchivo.replace(".m3u8", ".mp4") : "video.mp4";
    
    if (videoUrl.includes(".m3u8")) {
      procesarYDescargarM3U8(videoUrl, tabId, nombreSugerido);
    } else {
      chrome.downloads.download({
        url: videoUrl,
        filename: nombreSugerido,
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

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("videosPorPestaña");
  const videosPorPestaña = data.videosPorPestaña || {};
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
    await chrome.storage.local.set({ videosPorPestaña });
  }
});

async function procesarYDescargarM3U8(urlM3u8, tabId, nombreArchivo) {
  try {
    const baseURLEndpoint = urlM3u8.substring(0, urlM3u8.lastIndexOf("/") + 1);
    const respuesta = await fetch(urlM3u8);
    const texto = await respuesta.text();
    
    const lineas = texto.split("\n");
    let fragmentosUrls = [];
    
    for (let linea of lineas) {
      linea = linea.trim();
      if (linea === "" || linea.startsWith("#")) continue;
      
      if (!linea.startsWith("http") && !linea.startsWith("//")) {
        fragmentosUrls.push(baseURLEndpoint + linea);
      } else {
        fragmentosUrls.push(linea);
      }
    }

    if (fragmentosUrls.length === 0) return;

    let bloquesBinarios = [];
    
    for (let i = 0; i < fragmentosUrls.length; i++) {
      try {
        const resFragmento = await fetch(fragmentosUrls[i]);
        const buffer = await resFragmento.arrayBuffer();
        bloquesBinarios.push(buffer);
        
        let porcentajeCalculado = Math.round(((i + 1) / fragmentosUrls.length) * 100);
        chrome.runtime.sendMessage({ 
          action: "progresoDescarga", 
          porcentaje: porcentajeCalculado, 
          url: urlM3u8,
          tabId: tabId 
        });
      } catch (errFragmento) {
        console.error("Error bajando fragmento:", errFragmento);
      }
    }

    const videoCompletoBlob = new Blob(bloquesBinarios, { type: "video/mp4" });
    
    const reader = new FileReader();
    reader.onloadend = function() {
      const dataUrlBinaria = reader.result;
      
      chrome.downloads.download({
        url: dataUrlBinaria,
        filename: nombreArchivo,
        conflictAction: "uniquify"
      }, (downloadId) => {
        chrome.runtime.sendMessage({ 
          action: "descargaIniciada", 
          downloadId: downloadId, 
          url: urlM3u8, 
          tabId: tabId 
        });
      });
    };
    reader.readAsDataURL(videoCompletoBlob);

  } catch (error) {
    console.error("Error compilando hls:", error);
  }
}
