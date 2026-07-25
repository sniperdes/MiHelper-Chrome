const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

let tabGlobal = null;

async function cargarVideos() {
  resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Analizando transmisiones... 🔍</p>";
  
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) return;
  tabGlobal = pestañas[0];

  solicitarDatos();
}

function solicitarDatos() {
  if (!tabGlobal) return;
  
  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tabGlobal.id }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    if (response.videos && response.videos.length > 0) {
      resultado.innerHTML = ""; 

      response.videos.forEach((urlFinal, index) => {
        const nombreLimpio = (tabGlobal.title || "Video Detectado").replace(" - Google Chrome", "");
        const esM3u8 = urlFinal.toLowerCase().includes(".m3u8");
        const datosDescarga = response.descargas[urlFinal];

        const tarjeta = document.createElement("div");
        tarjeta.style.background = "#ffffff";
        tarjeta.style.border = "1px solid #e2e8f0";
        tarjeta.style.borderRadius = "8px";
        tarjeta.style.padding = "12px";
        tarjeta.style.marginBottom = "10px";
        tarjeta.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

        // Construcción de la interfaz de la tarjeta
        let contenidoDinamico = "";

        if (datosDescarga) {
          // Si el archivo se está descargando, dibujamos la barra celeste de tu captura
          contenidoDinamico = `
            <div style="width: 100%; margin-top: 8px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
                <span>Progreso: ${datosDescarga.progreso}%</span>
                <span style="font-weight:bold; color:#0284c7;">${datosDescarga.velocidad}</span>
              </div>
              <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                <div style="width:${datosDescarga.progreso}%; height:100%; background:#38bdf8; transition: width 0.1s linear;"></div>
              </div>
              <button class="btn-cancelar" data-url="${urlFinal}" style="margin-top:6px; background:#ef4444; color:white; border:none; padding:3px 8px; font-size:10px; border-radius:4px; cursor:pointer;">Cancelar</button>
            </div>
          `;
        } else {
          // Botón azul normal si no se está descargando
          contenidoDinamico = `
            <div style="margin-top: 8px; display:flex; justify-content:flex-end;">
              <button class="btn-descargar-avanzado" data-url="${urlFinal}" style="background-color:#007bff; color:white; border:none; padding:6px 14px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer;">
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

      // Configurar eventos de los botones de descarga
      document.querySelectorAll(".btn-descargar-avanzado").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlVideo = e.target.getAttribute("data-url");
          const nombreArchivo = `${(tabGlobal.title || "video").substring(0, 25).trim()}.mp4`;
          
          chrome.runtime.sendMessage({
            action: "procesarDescargaHLS",
            url: urlVideo,
            tabId: tabGlobal.id,
            nombre: nombreArchivo
          }, () => {
            solicitarDatos(); // Refrescar vista instantáneamente
          });
        });
      });

      // Configurar eventos de los botones cancelar
      document.querySelectorAll(".btn-cancelar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlVideo = e.target.getAttribute("data-url");
          chrome.runtime.sendMessage({ action: "cancelarDescargaHLS", url: urlVideo }, () => {
            solicitarDatos();
          });
        });
      });

    } else {
      resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>No se han detectado videos. Reproduce el video e intenta de nuevo. ❌</p>";
    }
  });
}

// Escuchar actualizaciones de progreso enviadas por el background.js en tiempo real
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "actualizarProgresoGlobal") {
    solicitarDatos(); // Redibujar popup con los nuevos porcentajes
  }
});

botonAnalizar.addEventListener("click", cargarVideos);

botonLimpiar.addEventListener("click", () => {
  if (!tabGlobal) return;
  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tabGlobal.id }, () => {
    resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Lista limpiada. 🗑️</p>";
  });
});
