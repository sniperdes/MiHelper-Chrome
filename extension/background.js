const videosPorPestaña = {};
const descargasActivas = {}; // Almacena el progreso de lo que se está bajando

chrome.webRequest.onBeforeRequest.addListener(
  (detalles) => {
    const url = detalles.url;
    const tabId = detalles.tabId;
    if (tabId === -1) return;

    if (url.includes("ads") || url.includes("analytics") || url.includes("popads")) return;

    if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".m4s") || url.includes(".ts")) {
      if (!videosPorPestaña[tabId]) videosPorPestaña[tabId] = [];
      if (!videosPorPestaña[tabId].includes(url)) {
        videosPorPestaña[tabId].push(url);
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// LÓGICA AVANZADA DE DESCARGA POR FRAGMENTOS (STREAM DOWNLOADER)
async function iniciarDescargaHLS(urlM3u8, tabId, nombreArchivo) {
  try {
    descargasActivas[urlM3u8] = { progreso: 0, velocidad: "0 MB/s", estado: "descargando" };
    notificarPopup();

    // 1. Descargar el archivo indexador .m3u8
    const respuesta = await fetch(urlM3u8);
    const textoM3u8 = await respuesta.text();
    
    // 2. Extraer las URLs de los fragmentos de video (.ts)
    const lineas = textoM3u8.split("\n");
    const baseUrl = urlM3u8.substring(0, urlM3u8.lastIndexOf("/") + 1);
    const urlsFragmentos = [];

    lineas.forEach(linea => {
      linea = linea.trim();
      if (linea && !linea.startsWith("#")) {
        // Si la URL es relativa, le pegamos la base
        if (!linea.startsWith("http")) {
          urlsFragmentos.push(baseUrl + linea);
        } else {
          urlsFragmentos.push(linea);
        }
      }
    });

    if (urlsFragmentos.length === 0) {
      descargasActivas[urlM3u8].estado = "error";
      notificarPopup();
      return;
    }

    const totalFragmentos = urlsFragmentos.length;
    const bloquesDescargados = [];
    let tiempoInicio = Date.now();
    let bytesDescargadosEnSegundo = 0;

    // 3. Descargar los fragmentos uno por uno en bucle
    for (let i = 0; i < totalFragmentos; i++) {
      // Verificamos si el usuario canceló la descarga
      if (!descargasActivas[urlM3u8] || descargasActivas[urlM3u8].estado === "cancelado") return;

      const resFrag = await fetch(urlsFragmentos[i]);
      const buffer = await resFrag.arrayBuffer();
      bloquesDescargados.push(new Uint8Array(buffer));

      bytesDescargadosEnSegundo += buffer.byteLength;

      // Calcular velocidad cada segundo
      let tiempoActual = Date.now();
      if (tiempoActual - tiempoInicio >= 1000) {
        let mbs = (bytesDescargadosEnSegundo / (1024 * 1024)).toFixed(2);
        descargasActivas[urlM3u8].velocidad = `${mbs} MB/s`;
        bytesDescargadosEnSegundo = 0;
        tiempoInicio = tiempoActual;
      }

      // Calcular porcentaje real
      descargasActivas[urlM3u8].progreso = Math.floor(((i + 1) / totalFragmentos) * 100);
      notificarPopup();
    }

    // 4. UNIR LOS FRAGMENTOS EN UN SOLO ARCHIVO EN MEMORIA (BLOB)
    descargasActivas[urlM3u8].estado = "ensamblando";
    notificarPopup();

    const blobFinal = new Blob(bloquesDescargados, { type: "video/mp4" });
    const reader = new FileReader();
    
    reader.onloadend = function() {
      const dataUrl = reader.result;
      // Forzamos a Chrome a bajar el archivo MP4 ya unido
      chrome.downloads.download({
        url: dataUrl,
        filename: nombreArchivo,
        saveAs: true
      }, () => {
        delete descargasActivas[urlM3u8];
        notificarPopup();
      });
    };
    reader.readAsDataURL(blobFinal);

  } catch (error) {
    console.error("Error en el motor de descarga:", error);
    if (descargasActivas[urlM3u8]) {
      descargasActivas[urlM3u8].estado = "error";
      notificarPopup();
    }
  }
}

// Avisar a la ventanita popup de los cambios de porcentaje
function notificarPopup() {
  chrome.runtime.sendMessage({ action: "actualizarProgresoGlobal", descargas: descargasActivas }).catch(() => {
    // Ignorar error si el popup está cerrado
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerVideosDeRed") {
    sendResponse({ videos: videosPorPestaña[request.tabId] || [], descargas: descargasActivas });
  }
  if (request.action === "limpiarVideos") {
    videosPorPestaña[request.tabId] = [];
    sendResponse({ num: 0 });
  }
  if (request.action === "procesarDescargaHLS") {
    iniciarDescargaHLS(request.url, request.tabId, request.nombre);
    sendResponse({ iniciado: true });
  }
  if (request.action === "cancelarDescargaHLS") {
    if (descargasActivas[request.url]) {
      descargasActivas[request.url].estado = "cancelado";
      delete descargasActivas[request.url];
    }
    sendResponse({ cancelado: true });
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (videosPorPestaña[tabId]) delete videosPorPestaña[tabId];
});
