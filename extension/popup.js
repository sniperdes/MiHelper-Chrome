
const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

async function cargarVideos() {
  resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Analizando flujos de red... 🔍</p>";
  
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) {
    resultado.innerHTML = "<p style='font-size:12px; color:#ef4444;'>No se pudo acceder a la pestaña activa.</p>";
    return;
  }
  const tab = pestañas[0];

  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    if (chrome.runtime.lastError) {
      resultado.innerHTML = "<p style='font-size:12px; color:#ef4444;'>Error de comunicación. Por favor recarga la página web.</p>";
      return;
    }

    if (response && response.videos && response.videos.length > 0) {
      resultado.innerHTML = ""; 

      response.videos.forEach((urlFinal) => {
        const nombreLimpio = (tab.title || "Video Detectado").replace(" - Google Chrome", "");
        const esM3u8 = urlFinal.toLowerCase().includes(".m3u8");

        const tarjeta = document.createElement("div");
        tarjeta.style.display = "flex";
        tarjeta.style.alignItems = "center";
        tarjeta.style.background = "#ffffff";
        tarjeta.style.border = "1px solid #e2e8f0";
        tarjeta.style.borderRadius = "8px";
        tarjeta.style.padding = "10px";
        tarjeta.style.marginBottom = "10px";
        tarjeta.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

        tarjeta.innerHTML = `
          <!-- Indicador visual -->
          <div style="width:40px; height:40px; background:${esM3u8 ? '#fef2f2' : '#f0fdf4'}; border-radius:6px; display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0; font-size:18px;">
            ${esM3u8 ? '🔴' : '🔵'}
          </div>

          <!-- Información -->
          <div style="flex-grow:1; min-width:0;">
            <p style="font-size:12px; font-weight:600; color:#334155; margin:0 0 4px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${nombreLimpio}">
              ${nombreLimpio}
            </p>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10px; color:${esM3u8 ? '#991b1b' : '#166534'}; background:${esM3u8 ? '#fee2e2' : '#dcfce7'}; padding:2px 6px; border-radius:4px; font-weight:bold;">
                ${esM3u8 ? 'M3U8 / STREAM' : 'MP4 DIRECTO'}
              </span>
            </div>
          </div>

          <!-- Botón Seguro -->
          <button class="btn-copiar-seguro" data-url="${urlFinal}" style="background-color:#007bff; color:white; border:none; padding:8px 12px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer; margin-left:10px; flex-shrink:0; transition: background 0.2s;">
            ${esM3u8 ? 'Copiar Link' : 'Descargar'}
          </button>
        `;

        resultado.appendChild(tarjeta);
      });

      // Lógica de los botones
      document.querySelectorAll(".btn-copiar-seguro").forEach(btn => {
        btn.onmouseenter = () => btn.style.backgroundColor = '#0056b3';
        btn.onmouseleave = () => btn.style.backgroundColor = '#007bff';
        
        btn.addEventListener("click", (e) => {
          const urlVideo = e.target.getAttribute("data-url");
          
          navigator.clipboard.writeText(urlVideo);
          e.target.textContent = "¡Copiado! 📋";
          e.target.style.backgroundColor = "#28a745";
          
          // Abre el enlace en una pestaña nueva (si es un MP4 real se descargará automáticamente)
          window.open(urlVideo, '_blank');

          setTimeout(() => {
            e.target.textContent = esM3u8 ? 'Copiar Link' : 'Descargar';
            e.target.style.backgroundColor = "#007bff";
          }, 1500);
        });
      });

    } else {
      resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>No se han detectado videos. Reproduce el video en la página web e intenta de nuevo. ❌</p>";
    }
  });
}

botonAnalizar.addEventListener("click", cargarVideos);

botonLimpiar.addEventListener("click", async () => {
  const pestañas = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestañas || pestañas.length === 0) return;
  const tab = pestañas[0];
  
  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tab.id }, () => {
    resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Lista limpiada correctamente. 🗑️</p>";
  });
});
