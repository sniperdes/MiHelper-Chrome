const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

// Guardamos referencias globales de los ID de descarga vinculados a sus URLs
let descargasActivas = {};

// Carga automática al abrir el popup
document.addEventListener("DOMContentLoaded", cargarVideos);

async function cargarVideos() {
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) {
    resultado.innerHTML = '<div class="sin-videos">No se pudo acceder a la pestaña activa.</div>';
    return;
  }
  const tab = pestañas[0]; // <--- CORREGIDO: Añadido el [0] para extraer la pestaña real
  const urlObjeto = new URL(tab.url || "https://localhost");
  const dominioLimpio = urlObjeto.hostname.replace("www.", "");
  
  // ... (el resto del archivo popup.js se queda igual)

  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    if (chrome.runtime.lastError || !response || !response.videos || response.videos.length === 0) {
      resultado.innerHTML = '<div class="sin-videos">No se han detectado videos en esta página. Reproduce el video para capturarlo. ❌</div>';
      return;
    }

    resultado.innerHTML = ""; // Limpiar el indicador base

    response.videos.forEach((urlFinal, index) => {
      const nombreLimpio = (tab.title || "Video Detectado").replace(" - Google Chrome", "").trim();
      const esM3u8 = urlFinal.toLowerCase().includes(".m3u8");

      const tarjeta = document.createElement("div");
      tarjeta.className = "video-card";
      tarjeta.innerHTML = `
        <div class="video-meta">
          <!-- Miniatura Simulada -->
          <div class="video-thumbnail">
            <span class="thumbnail-icon">${esM3u8 ? '🎥' : '🎞️'}</span>
            <span class="thumbnail-overlay">⏱️ 24:01</span>
          </div>

          <!-- Detalles del Video -->
          <div class="video-details">
            <h4 class="video-title" title="${nombreLimpio}">${nombreLimpio}</h4>
            
            <div class="action-group">
              <button class="btn-icon btn-carpeta" id="folder-${index}" style="display:none;" title="Mostrar en Carpeta">📂</button>
              <button class="btn-icon btn-borrar" id="delete-${index}" style="display:none;" title="Eliminar archivo">🗑️</button>
              <button class="btn-main btn-descargar-inteligente" id="action-${index}" data-url="${urlFinal}" data-index="${index}">
                ${esM3u8 ? 'Descargar Stream' : 'Reproducir'}
              </button>
            </div>
          </div>
        </div>

        <!-- Estado de Progreso unificado -->
        <div class="status-container">
          <div class="status-top">
            <span class="status-text" id="status-txt-${index}">${esM3u8 ? 'Stream Detectado' : 'Disponible para descargar'}</span>
          </div>
          <span class="status-domain">${dominioLimpio}</span>
        </div>
      `;

      resultado.appendChild(tarjeta);

      // Evento del botón principal de acción inteligente
      const botonAccion = tarjeta.querySelector(`#action-${index}`);
      botonAccion.addEventListener("click", () => {
        const urlVideo = botonAccion.getAttribute("data-url");
        const statusTxt = tarjeta.querySelector(`#status-txt-${index}`);

        if (botonAccion.textContent.trim() === "Reproducir") {
          // Si ya terminó, el botón se convierte en "Reproducir" y abre el archivo en la PC
          const dId = descargasActivas[urlVideo];
          if (dId) chrome.downloads.open(dId);
          return;
        }

        // Si es una descarga nueva, se delega al background.js
        botonAccion.textContent = "Procesando...";
        botonAccion.classList.add("downloading");
        botonAccion.disabled = true;

        const nombreArchivoSeguro = `${nombreLimpio.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 30).trim()}.${esM3u8 ? 'm3u8' : 'mp4'}`;

        chrome.runtime.sendMessage({
          action: "iniciarDescarga",
          url: urlVideo,
          tabId: tab.id,
          nombreArchivo: nombreArchivoSeguro
        }, (res) => {
          statusTxt.textContent = "Descargando en segundo plano...";
        });
      });
    });
  });
}

// Escucha en tiempo real el progreso de las descargas enviadas por el background
chrome.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.action === "descargaIniciada") {
    // Al iniciar, mapeamos los botones para cambiar su estado visual al de tu referencia
    const botones = document.querySelectorAll(".btn-descargar-inteligente");
    botones.forEach((btn) => {
      if (btn.getAttribute("data-url") === mensaje.url || btn.textContent === "Procesando...") {
        const index = btn.getAttribute("data-index");
        descargasActivas[mensaje.url] = mensaje.downloadId;

        // Configuración visual completa "Estilo Premium"
        btn.textContent = "Reproducir";
        btn.style.backgroundColor = "#10b981"; // Cambia a Verde
        btn.classList.remove("downloading");
        btn.disabled = false;

        // Mostrar botones de herramientas secundarias
        const btnCarpeta = document.getElementById(`folder-${index}`);
        const btnBorrar = document.getElementById(`delete-${index}`);
        const statusTxt = document.getElementById(`status-txt-${index}`);

        if (statusTxt) statusTxt.textContent = "Complete";
        if (btnCarpeta) {
          btnCarpeta.style.display = "inline-flex";
          btnCarpeta.onclick = () => chrome.downloads.show(mensaje.downloadId);
        }
        if (btnBorrar) {
          btnBorrar.style.display = "inline-flex";
          btnBorrar.onclick = () => chrome.downloads.erase({ id: mensaje.downloadId });
        }
      }
    });
  }

  // Actualizaciones de streams M3U8 por fragmentos
  if (mensaje.action === "progresoDescarga") {
    const statusTxts = document.querySelectorAll(`[id^="status-txt-"]`);
    statusTxts.forEach((txt) => {
      txt.textContent = `Descargando fragmentos... ${mensaje.porcentaje}%`;
    });
  }
});

// Botón de limpieza de caché de videos capturados
botonLimpiar.addEventListener("click", async () => {
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) return;
  const tab = pestañas[0];

  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tab.id }, () => {
    resultado.innerHTML = '<div class="sin-videos">Lista limpiada correctamente. 🗑️</div>';
    descargasActivas = {};
  });
});
