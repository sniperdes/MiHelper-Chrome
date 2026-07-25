const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

let tabGlobal = null;
function actualizarEstado(texto) {
  const estado = document.getElementById("estado");
  if (estado) {
    estado.textContent = texto;
  }
  console.log("[MiHelper]", texto);
}
async function cargarVideos() {
  actualizarEstado("🔍 Analizando transmisiones...");
resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Analizando transmisiones... 🔍</p>";
  
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) return;
  tabGlobal = pestañas[0]; // Corrección de índice nativo para fijar la pestaña

  solicitarDatos();
}

function solicitarDatos() {
  if (!tabGlobal) return;
  
  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tabGlobal.id }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    if (response.videos && response.videos.length > 0) {
      resultado.innerHTML = ""; 

      response.videos.forEach((item, index) => {
        // CORRECCIÓN SEGURO: Soportamos si viene como objeto o como texto plano
        const urlFinal = typeof item === 'string' ? item : (item.url || item);
        const nombreLimpio = (tabGlobal.title || "Video Detectado").replace(" - Google Chrome", "");
        const esM3u8 = urlFinal.toLowerCase().includes(".m3u8");
        
        // Buscamos si este enlace específico se está descargando en el motor offscreen
        const datosDescarga = response.descargas ? response.descargas[urlFinal] : null;
        const videoId = `mini-reproductor-${index}`;

        const tarjeta = document.createElement("div");
        tarjeta.style.background = "#ffffff";
        tarjeta.style.border = "1px solid #e2e8f0";
        tarjeta.style.borderRadius = "8px";
        tarjeta.style.padding = "12px";
        tarjeta.style.marginBottom = "10px";
        tarjeta.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

        let contenidoDinamico = "";

        if (datosDescarga) {
          // Si está descargando, pintamos la barra celeste interactiva
          contenidoDinamico = `
            <div style="width: 100%; margin-top: 8px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
                <span>Progreso: ${datosDescarga.progreso}%</span>
                <span style="font-weight:bold; color:#0284c7;">${datosDescarga.velocidad}</span>
              </div>
              <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                <div style="width:${datosDescarga.progreso}%; height:100%; background:#38bdf8; transition: width 0.1s linear;"></div>
              </div>
            </div>
          `;
        } else {
          // Si está libre, pintamos el botón azul de descarga normal
          contenidoDinamico = `
            <div style="margin-top: 8px; display:flex; justify-content:flex-end;">
              <button class="btn-descargar-avanzado" data-url="${urlFinal}" style="background-color:#007bff; color:white; border:none; padding:6px 14px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer; transition: background 0.2s;">
                ${esM3u8 ? "Descargar Stream" : "Descargar MP4"}
              </button>
            </div>
          `;
        }

        tarjeta.innerHTML = `
          <div style="display: flex; align-items: center;">
            <div style="width:35px; height:35px; background:${esM3u8 ? '#fef2f2' : '#f0fdf4'}; border-radius:6px; display:flex; align-items:center; justify-content:center; margin-right:10px; font-size:16px;">
              ${esM3u8 ? '🎬' : '📹'}
            </div>
            <div style="flex-grow:1; min-width:0;">
              <p style="font-size:12px; font-weight:600; color:#334155; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${nombreLimpio}
              </p>
              <span style="font-size:9px; color:#64748b; font-weight:bold;">${esM3u8 ? 'HLS / M3U8' : 'MP4 NATIVO'}</span>
            </div>
          </div>
          ${contenidoDinamico}
        `;

        resultado.appendChild(tarjeta);
      });

      // Enganchamos el evento de clic a los botones azules recién dibujados
      document.querySelectorAll(".btn-descargar-avanzado").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlVideo = e.target.getAttribute("data-url");
          // Creamos el nombre del archivo de forma segura usando el título actual
          const nombreArchivo = `${(tabGlobal.title || "video").substring(0, 20).trim()}.mp4`;
          
          e.target.textContent = "Iniciando...";
e.target.style.backgroundColor = "#64748b";

actualizarEstado("🚀 Enviando descarga...");
console.log("URL:", urlVideo);
console.log("Nombre:", nombreArchivo);

chrome.runtime.sendMessage({
            action: "procesarDescargaHLS",
            url: urlVideo,
            tabId: tabGlobal.id,
            nombre: nombreArchivo
          }, (response) => {

  if (chrome.runtime.lastError) {
    actualizarEstado("❌ Error: " + chrome.runtime.lastError.message);
    console.error(chrome.runtime.lastError);
    return;
  }

  console.log("Respuesta del background:", response);

  if (response && response.iniciado) {
    actualizarEstado("✅ Descarga iniciada");
  } else {
    actualizarEstado("⚠️ El background respondió, pero no inició la descarga");
  }

  setTimeout(solicitarDatos, 300);

});
        });
      });

    } else {
      resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>No se han detectado videos. Reproduce el video e intenta de nuevo. ❌</p>";
    }
  });
}

// Escuchamos los latidos del progreso que manda el background en tiempo real para mover la barra
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "actualizarProgresoGlobal") {
    solicitarDatos();
  }
});

botonAnalizar.addEventListener("click", cargarVideos);

botonLimpiar.addEventListener("click", () => {
  if (!tabGlobal) return;
  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tabGlobal.id }, () => {
    resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Lista limpiada. 🗑️</p>";
  });
});
