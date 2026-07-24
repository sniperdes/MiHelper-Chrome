const boton = document.getElementById("analizar");
const resultado = document.getElementById("resultado");

boton.addEventListener("click", async () => {
  resultado.innerHTML = "Buscando flujos de video... 🔍";

  // Identificamos cuál es la pestaña activa actual del usuario
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    resultado.textContent = "Error al identificar la pestaña.";
    return;
  }

  // Le pedimos al background.js los videos capturados para el ID de esta pestaña
  chrome.runtime.sendMessage({ action: "obtenerVideosDeRed", tabId: tab.id }, (response) => {
    
    if (response && response.videos && response.videos.length > 0) {
      resultado.innerHTML = `<strong>¡Videos capturados en la red (${response.videos.length})!</strong><br><br>`;
      
      const lista = document.createElement("ol");
      lista.style.paddingLeft = "15px";
      lista.style.wordBreak = "break-all";

      response.videos.forEach((url) => {
        const elemento = document.createElement("li");
        elemento.style.marginBottom = "12px";

        // Identificar formato para la etiqueta visual
        let tipo = "📹 VIDEO";
        if (url.toLowerCase().includes(".m3u8")) tipo = "🔴 HLS / M3U8";
        if (url.toLowerCase().includes(".mp4")) tipo = "🔵 MP4";

        elemento.innerHTML = `
          <small style="background:#eee; padding:2px 4px; border-radius:3px;"><strong>${tipo}</strong></small><br>
          <textarea readonly style="width:90%; height:40px; margin-top:4px; font-size:10px;">${url}</textarea><br>
          <button class="btn-copiar" data-url="${url}" style="cursor:pointer; padding:3px 8px; margin-top:2px;">Copiar Enlace</button>
        `;
        lista.appendChild(elemento);
      });

      resultado.appendChild(lista);

      // Activamos la funcionalidad de los botones copiar
      document.querySelectorAll(".btn-copiar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlACopiar = e.target.getAttribute("data-url");
          navigator.clipboard.writeText(urlACopiar);
          e.target.textContent = "¡Copiado! Clipboard ✅";
          setTimeout(() => e.target.textContent = "Copiar Enlace", 2000);
        });
      });

    } else {
      resultado.textContent = "No se ha transmitido ningún video en la red aún. Intenta reproducir el video en la página y haz clic de nuevo. ❌";
    }
  });
});
