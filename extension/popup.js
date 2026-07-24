const boton = document.getElementById("analizar");
const resultado = document.getElementById("resultado");

boton.addEventListener("click", async () => {
  resultado.innerHTML = "Analizando la página... 🔍";

  // Obtenemos la pestaña actual del navegador
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    resultado.textContent = "Error: No se pudo acceder a la pestaña.";
    return;
  }

  // Enviamos un mensaje al content.js de esa pestaña específica
  chrome.tabs.sendMessage(tab.id, { action: "detectarVideos" }, (response) => {
    // Si Chrome arroja un error (ej. en páginas internas como chrome://)
    if (chrome.runtime.lastError) {
      resultado.textContent = "No se pueden detectar videos en esta página.";
      return;
    }

    // Si todo sale bien y encuentra videos
    if (response && response.videos && response.videos.length > 0) {
      resultado.innerHTML = `<strong>Se encontraron ${response.videos.length} videos:</strong><br><br>`;
      
      // Creamos una lista ordenada para mostrarlos
      const lista = document.createElement("ol");
      lista.style.paddingLeft = "20px";
      lista.style.wordBreak = "break-all";

      response.videos.forEach((url) => {
        const elemento = document.createElement("li");
        elemento.style.marginBottom = "10px";

        // Determinar qué tipo de formato es para poner una etiqueta visual
        const esM3u8 = url.toLowerCase().includes(".m3u8");
        const etiqueta = esM3u8 ? "🔴 HLS/M3U8" : "🔵 MP4";

        elemento.innerHTML = `
          <small><strong>${etiqueta}</strong></small><br>
          <a href="${url}" target="_blank" style="color: #0066cc;">Ver enlace</a>
          <button class="btn-copiar" data-url="${url}" style="margin-left: 5px; padding: 2px 5px; font-size: 11px; cursor: pointer;">Copiar</button>
        `;
        lista.appendChild(elemento);
      });

      resultado.appendChild(lista);

      // Programar los botones de "Copiar" creados dinámicamente
      document.querySelectorAll(".btn-copiar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const urlACopiar = e.target.getAttribute("data-url");
          navigator.clipboard.writeText(urlACopiar);
          e.target.textContent = "¡Copiado! Clipboard ✅";
          setTimeout(() => e.target.textContent = "Copiar", 2000);
        });
      });

    } else {
      resultado.textContent = "No se detectaron archivos de video en esta página. ❌";
    }
  });
});
