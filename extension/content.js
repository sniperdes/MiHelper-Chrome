console.log("MiHelper: content.js cargado y escaneando...");

// Escuchamos si el popup nos pide los datos visuales del reproductor de la página
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerDatosFisicosVideo") {
    const video = document.querySelector("video");
    if (video) {
      // Calculamos los minutos y segundos reales
      const totalSegundos = video.duration || 0;
      const minutos = Math.floor(totalSegundos / 60);
      const segundos = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
      const duracionFormateada = totalSegundos > 0 ? `${minutos}:${segundos}` : "En vivo / Desconocido";

      sendResponse({
        titulo: document.title || "Video Detectado",
        duracion: duracionFormateada,
        poster: video.poster || "" // Si tiene una imagen de portada asignada
      });
    } else {
      sendResponse({ titulo: document.title || "Video Detectado", duracion: "00:00", poster: "" });
    }
  }
  return true;
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
