const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

// Variable global para verificar si el motor ya fue inyectado
let hlsCargado = false;

// Función para descargar e inyectar el motor HLS en caliente
async function inyectarMotorHLS() {
  if (hlsCargado || typeof Hls !== 'undefined') return true;
  try {
    const respuesta = await fetch("https://jsdelivr.net");
    const codigoTexto = await respuesta.text();
    
    // Inyectamos de forma segura el script descargado en la sesión activa del popup
    const scriptTag = document.createElement("script");
    scriptTag.textContent = codigoTexto;
    document.head.appendChild(scriptTag);
    hlsCargado = true;
    return true;
  } catch (error) {
    console.log("Error cargando el reproductor dinámico:", error);
    return false;
  }
}

async function cargarVideos() {
  resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Inicializando reproductor multimedia... 🔍</p>";
  
  // 1. Forzamos la descarga del motor HLS de forma interna antes de pintar la lista
  const motorListo = await inyectarMotorHLS();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    if (response && response.videos && response.videos.length > 0) {
      resultado.innerHTML = ""; 

      response.videos.forEach((item, index) => {
        const urlFinal = typeof item === 'string' ? item : item.url;
        const nombreLimpio = (tab.title || "Video Detectado").replace(" - Google Chrome", "");
        const videoId = `mini-reproductor-${index}`;

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
          <!-- Miniatura interactiva de video -->
          <div style="position:relative; width:95px; height:55px; background:#000; border-radius:6px; overflow:hidden; margin-right:12px; flex-shrink:0;">
            <video id="${videoId}" muted loop playsinline style="width:100%; height:100%; object-fit:cover; display:block;"></video>
            <div style="position:absolute; bottom:4px; left:4px; background:rgba(0,0,0,0.8); color:#fff; font-size:9px; padding:1px 4px; border-radius:4px; font-weight:bold;">
              ▶ preview
            </div>
          </div>

          <!-- Información central -->
          <div style="flex-grow:1; min-width:0;">
            <p style="font-size:12px; font-weight:600; color:#334155; margin:0 0 6px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${nombreLimpio}">
              <span style="background:#e0f2fe; color:#0369a1; font-size:10px; padding:1px 4px; border-radius:4px; font-weight:bold; margin-right:4px;">HLS</span> 
              ${nombreLimpio}
            </p>
            
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10px; color:#64748b; border:1px solid #cbd5e1; padding:2px 5px; border-radius:4px; background:#f8fafc; font-weight:500;">
                M3U8
              </span>
              <select style="font-size:11px; padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; color:#334155; cursor:pointer;">
                <option value="auto">Calidad Auto</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
              </select>
            </div>
          </div>

          <!-- Botón de descarga -->
          <button class="btn-descargar-azul" data-url="${urlFinal}" style="background-color:#007bff; color:white; border:none; padding:8px 12px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer; margin-left:10px; flex-shrink:0; transition: background 0.2s;">
            Descargar
          </button>
        `;

        resultado.appendChild(tarjeta);

        const elementoVideo = document.getElementById(videoId);
        
        // Ejecución condicional del minireproductor usando el motor inyectado
        if (urlFinal.includes(".m3u8") && motorListo && typeof Hls !== 'undefined') {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(urlFinal);
            hls.attachMedia(elementoVideo);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              elementoVideo.play().catch(e => console.log("Bloqueo de reproducción:", e));
            });
          }
        } else {
          elementoVideo.src = urlFinal;
          elementoVideo.play().catch(e => console.log("Bloqueo de reproducción:", e));
        }
      });

      // Configurar acción del botón
      document.querySelectorAll(".btn-descargar-azul").forEach(btn => {
        btn.onmouseenter = () => btn.style.backgroundColor = '#0056b3';
        btn.onmouseleave = () => btn.style.backgroundColor = '#007bff';
        
        btn.addEventListener("click", (e) => {
          const urlVideo = e.target.getAttribute("data-url");
          navigator.clipboard.writeText(urlVideo);
          e.target.textContent = "¡Copiado! ✅";
          e.target.style.backgroundColor = "#28a745";
          
          setTimeout(() => {
            e.target.textContent = "Descargar";
            e.target.style.backgroundColor = "#007bff";
          }, 1500);
        });
      });

    } else {
      resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>No se han detectado flujos de video. Re-reproduce el video e intenta otra vez. ❌</p>";
    }
  });
}

botonAnalizar.addEventListener("click", cargarVideos);

botonLimpiar.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tab.id }, () => {
    resultado.innerHTML = "<p style='font-size:12px; color:#64748b;'>Lista limpiada correctamente. 🗑️</p>";
  });
});
