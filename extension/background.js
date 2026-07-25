// Variable temporal para almacenar videos capturados
let cacheVideos = {};

// Inicializar el analizador de red de forma segura
try {
  chrome.webRequest.onBeforeRequest.addListener(
    (detalles) => {
      const url = detalles.url;
      const tabId = detalles.tabId;

      if (tabId === -1 || !tabId) return;

      // Filtro para ignorar publicidad molesta
      if (url.includes("ads") || url.includes("analytics") || url.includes("popads") || url.includes("adsterra")) return;

      // Captura flujos de video reales
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
    const nombreSugerido = request.nombreArchivo ? request.nombreArchivo.replace(".m3u8", ".mp4") : "video.mp4";
    
    if (videoUrl.includes(".m3u8")) {
      // Inicia el nuevo motor de descarga de fragmentos en segundo plano
      procesarYDescargarM3U8(videoUrl, tabId, nombreSugerido);
    } else {
      // Descarga normal para archivos MP4 directos
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

// Limpieza automática al cerrar pestañas
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("videosPorPestaña");
  const videosPorPestaña = data.videosPorPestaña || {};
  if (videosPorPestaña[tabId]) {
    delete videosPorPestaña[tabId];
    await chrome.storage.local.set({ videosPorPestaña });
  }
});

// MOTOR AVANZADO: Descarga fragmentos de transmisión HLS y los une en un MP4 real
async function procesarYDescargarM3U8(urlM3u8, tabId, nombreArchivo) {
  try {
    // 1. Obtener el archivo de texto índice (.m3u8)
    const baseURLEndpoint = urlM3u8.substring(0, urlM3u8.lastIndexOf("/") + 1);
    const respuesta = await fetch(urlM3u8);
    const texto = await respuesta.text();
    
    // 2. Extraer todas las líneas que sean fragmentos de video (.ts)
    const lineas = texto.split("\n");
    let fragmentosUrls = [];
    
    for (let linea of lineas) {
      linea = linea.trim();
      if (linea === "" || linea.startsWith("#")) continue;
      
      // Si la URL es relativa, la convertimos en absoluta usando la dirección base
      if (!linea.startsWith("http") && !linea.startsWith("//")) {
        fragmentosUrls.push(baseURLEndpoint + linea);
      } else {
        fragmentosUrls.push(linea);
      }
    }

    if (fragmentosUrls.length === 0) {
      console.error("No se encontraron fragmentos de video válidos en el archivo M3U8.");
      return;
    }

    console.log(`Detectados ${fragmentosUrls.length} fragmentos para descargar...`);
    
    // 3. Descargar uno a uno los fragmentos binarios en un Array para unirlos
    let bloquesBinarios = [];
    
    for (let i = 0; i < fragmentosUrls.length; i++) {
      try {
        const resFragmento = await fetch(fragmentosUrls[i]);
        const buffer = await resFragmento.arrayBuffer();
        bloquesBinarios.push(buffer);
        
        // Enviar el porcentaje de progreso en tiempo real al popup si sigue abierto
        let porcentajeCalculado = Math.round(((i + 1) / fragmentosUrls.length) * 100);
        chrome.runtime.sendMessage({ 
          action: "progresoDescarga", 
          porcentaje: porcentajeCalculado, 
          url: urlM3u8,
          tabId: tabId 
        });
      } catch (errFragmento) {
        console.error(`Error al bajar el fragmento número ${i}:`, errFragmento);
      }
    }

    // 4. Crear un super objeto binario (Blob) unificando todas las partes recolectadas
    // Aunque los fragmentos sean formato .ts, al unirlos consecutivamente los reproductores como VLC los leen directo como MP4
    const videoCompletoBlob = new Blob(bloquesBinarios, { type: "video/mp4" });
    
    // 5. Convertir el Blob en una URL local del navegador para poder forzar la descarga nativa
    const reader = new FileReader();
    reader.onloadend = function() {
      const dataUrlBinaria = reader.result;
      
      chrome.downloads.download({
        url: dataUrlBinaria,
        filename: nombreArchivo,
        conflictAction: "uniquify"
      }, (downloadId) => {
        // Notificar al popup que la descarga terminó de ensamblarse
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
    console.error("Error crítico en el motor de compilación HLS:", error);
  }
}
