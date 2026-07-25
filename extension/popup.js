const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

// Mapeo para registrar los IDs de descarga vinculados a sus URLs
let descargasActivas = {};

document.addEventListener("DOMContentLoaded", cargarVideos);

async function cargarVideos() {
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) {
    resultado.innerHTML = '<div class="sin-videos">No se pudo acceder a la pestaña activa.</div>';
    return;
  }
  
  const tab = pestañas[0]; 
  const urlObjeto = new URL(tab.url || "https://localhost");
  const dominioLimpio = urlObjeto.hostname.replace("www.", "");

  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    if (chrome.runtime.lastError || !response || !response.videos || response.videos.length === 0) {
      resultado.innerHTML = '<div class="sin-videos">No se han detectado videos en esta página. Reproduce el video para capturarlo. ❌</div>';
      return;
    }

    resultado.innerHTML = ""; 

    response.videos.forEach((urlFinal, index) => {
      const nombreLimpio = (tab.title || "Video Detectado").replace(" - Google Chrome", "").trim();
      const esM3u8 = urlFinal.toLowerCase().includes(".m3u8");

      const tarjeta = document.createElement("div");
      tarjeta.className = "video-card";
      tarjeta.innerHTML = `
        <div class="video-meta">
          <div class="video-thumbnail">
            <span class="thumbnail-icon">${esM3u8 ? '🎥' : '🎞️'}</span>
            <span class="thumbnail-overlay">VIDEO</span>
          </div>

          <div class="video-details">
            <h4 class="video-title" title="${nombreLimpio}">${nombreLimpio}</h4>
            
            <div class="action-group">
              <button class="btn-icon btn-carpeta" id="folder-${index}" style="display:none;" title="Mostrar en Carpeta">📂</button>
              <button class="btn-main btn-descargar-inteligente" id="action-${index}" data-url="${urlFinal}" data-index="${index}">
                ${esM3u8 ? 'Descargar Stream' : 'Descargar MP4'}
              </button>
            </div>
          </div>
        </div>

        <div class="status-container">
          <div class="status-top">
            <span class="status-text" id="status-txt-${index}">${esM3u8 ? 'Stream Detectado (.m3u8)' : 'Video MP4 Directo'}</span>
          </div>
          <span class="status-domain">${dominioLimpio}</span>
        </div>
      `;

      resultado.appendChild(tarjeta);

      const botonAccion = tarjeta.querySelector(`#action-${index}`);
      botonAccion.addEventListener("click", () => {
        const urlVideo = botonAccion.getAttribute("data-url");
        const statusTxt = tarjeta.querySelector(`#status-txt-${index}`);

        // Comportamiento si la descarga ya finalizó
        if (botonAccion.textContent.trim() === "Reproducir") {
          const dId = descargasActivas[urlVideo];
          if (dId) chrome.downloads.open(dId);
          return;
        }

        // Estado inicial de procesamiento
        botonAccion.textContent = "Iniciando...";
        botonAccion.classList.add("downloading");
        botonAccion.disabled = true;

        // Limpiar nombre de archivo para evitar caracteres inválidos del sistema operativo
        const nombreArchivoSeguro = `${nombreLimpio.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 40).trim()}.${esM3u8 ? 'm3u8' : 'mp4'}`;

        chrome.runtime.sendMessage({
          action: "iniciarDescarga",
          url: urlVideo,
          tabId: tab.id,
          nombreArchivo: nombreArchivoSeguro
        });
      });
    });
  });
}

// Intercepta los cambios de estado enviados desde background.js
chrome.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.action === "descargaProgreso") {
    const botones = document.querySelectorAll(".btn-descargar-inteligente");
    botones.forEach((btn) => {
      if (btn.getAttribute("data-url") === mensaje.url) {
        const index = btn.getAttribute("data-index");
        const statusTxt = document.getElementById(`status-txt-${index}`);
        
        descargasActivas[mensaje.url] = mensaje.downloadId;
        btn.disabled = false;

        if (mensaje.estado === "en_progreso") {
          btn.textContent = "Descargando...";
          if (statusTxt) statusTxt.textContent = "El navegador está descargando el archivo...";
        } 
        
        if (mensaje.estado === "completado") {
          btn.textContent = "Reproducir";
          btn.style.backgroundColor = "#10b981"; // Cambia a verde al finalizar
          btn.classList.remove("downloading");
          
          if (statusTxt) statusTxt.textContent = "Complete";
          
          const btnCarpeta = document.getElementById(`folder-${index}`);
          if (btnCarpeta) {
            btnCarpeta.style.display = "inline-flex";
            btnCarpeta.onclick = () => chrome.downloads.show(mensaje.downloadId);
          }
        }
      }
    });
  }
});

botonLimpiar.addEventListener("click", async () => {
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) return;
  const tab = pestañas[0];

  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tab.id }, () => {
    resultado.innerHTML = '<div class="sin-videos">Lista limpiada correctamente. 🗑️</div>';
    descargasActivas = {};
  });
});
