console.log("MiHelper: content.js cargado y escaneando...");

// Escuchamos el mensaje que nos envíe el popup pidiendo los videos
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "detectarVideos") {
    let videosEncontrados = [];

    // 1. Buscar en etiquetas de video estándar (<video src="...">)
    const elementosVideo = document.querySelectorAll("video, source");
    elementosVideo.forEach(el => {
      const url = el.src || el.currentSrc;
      if (url && (url.includes(".mp4") || url.includes(".m3u8") || url.includes("blob:"))) {
        if (!videosEncontrados.includes(url)) videosEncontrados.push(url);
      }
    });

    // 2. Buscar enlaces de video ocultos en el código HTML de la página (textos/scripts)
    const htmlCompleto = document.documentElement.innerHTML;
    // Expresión regular para capturar URLs que terminen en .mp4 o .m3u8 con o sin parámetros
    const regexVideo = /(https?:\/\/[^\s"'><]+?\.(?:mp4|m3u8)(?:\?[^\s"'><]*)?)/gi;
    let coincidencia;
    
    while ((coincidencia = regexVideo.exec(htmlCompleto)) !== null) {
      let urlDetectada = coincidencia[1];
      if (!videosEncontrados.includes(urlDetectada)) {
        videosEncontrados.push(urlDetectada);
      }
    }

    // Le devolvemos la lista de videos encontrados al popup
    sendResponse({ videos: videosEncontrados });
  }
  return true; // Mantiene el canal de comunicación abierto de forma asíncrona
});
