const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiar");
const resultado = document.getElementById("resultado");

// Función para solicitar y renderizar los videos
async function cargarVideos() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    if (chrome.runtime.lastError) {
      resultado.textContent = "Error de comunicación con la extensión.";
      return;
    }

    if (response && response.videos && response.videos.length > 0) {
      resultado.innerHTML = `<p><strong>Enlaces detectados (${response.videos.length}):</strong></p>`;
      
      const contenedor = document.createElement("div");

      response.videos.forEach((item) => {
        const tarjeta = document.createElement("div");
        tarjeta.style.background = "#f1f3f5";
        tarjeta.style.border = "1px solid #dee2e6";
        tarjeta.style.borderRadius = "5px";
        tarjeta.style.padding = "10px";
        tarjeta.style.marginBottom = "10px";

        tarjeta.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
            <span style="font-weight: bold; color: #495057;">${item.tipo}</span>
            <span style="color: #868e96;">${item.hora}</span>
          </div>
          <textarea readonly>${item.url}</textarea>
          <div style="margin-top: 5px;">
            <button class="btn-copiar" data-url="${item.url}">Copiar Enlace</button>
          </div>
        `;
        contenedor.appendChild(tarjeta);
      });

      resultado.appendChild(contenedor);

      // Configurar botones de copiado
      document.querySelectorAll(".btn-copiar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlACopiar = e.target.getAttribute("data-url");
          navigator.clipboard.writeText(urlACopiar);
          e.target.textContent = "¡Copiado! ✅";
          setTimeout(() => e.target.textContent = "Copiar Enlace", 1500);
        });
      });

    } else {
      resultado.textContent = "No se han detectado videos en esta pestaña aún. ❌";
    }
  });
}

// Evento para el botón Analizar
botonAnalizar.addEventListener("click", cargarVideos);

// Evento para el botón Limpiar
botonLimpiar.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.runtime.sendMessage({ action: "limpiarVideos", tabId: tab.id }, () => {
    resultado.textContent = "Lista limpiada correctamente. 🗑️";
  });
});
                              
