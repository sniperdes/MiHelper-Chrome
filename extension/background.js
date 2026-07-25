const videosPorPestaña = {};
const descargasActivas = {}; 

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "reportarProgresoDesdeOffscreen") {
    descargasActivas[request.url] = { 
      progreso: request.progreso, 
      velocidad: request.velocidad, 
      estado: request.estado 
    };
    if (request.estado === "finalizado") {
      delete descargasActivas[request.url];
    }
    chrome.runtime.sendMessage({ action: "actualizarProgresoGlobal", descargas: descargasActivas }).catch(() => {});
    sendResponse({ ok: true });
  }

  if (request.action === "obtenerVideosDeRed") {
    sendResponse({ videos: videosPorPestaña[request.tabId] || [], descargas: descargasActivas });
  }
  
  if (request.action === "limpiarVideos") {
    videosPorPestaña[request.tabId] = [];
    sendResponse({ num: 0 });
  }

  if (request.action === "procesarDescargaHLS") {
    crearYEjecutarOffscreen(request.url, request.nombre);
    sendResponse({ iniciado: true });
  }
  return true;
});

async function crearYEjecutarOffscreen(url, nombre) {
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['LOCAL_STORAGE'],
      justification: 'Descarga activa de flujos multimedia'
    });
    
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "iniciarDescargaDesdeCero",
        url: url,
        nombre: nombre
      }).catch(() => {});
    }, 500);

  } catch (e) {
    chrome.runtime.sendMessage({
      action: "iniciarDescargaDesdeCero",
      url: url,
      nombre: nombre
    }).catch(() => {});
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (videosPorPestaña[tabId]) delete videosPorPestaña[tabId];
});
