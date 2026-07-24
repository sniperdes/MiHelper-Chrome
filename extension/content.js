console.log("MiHelper: content.js cargado (Buscador inteligente de miniaturas).");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerDatosFisicosVideo") {
    const video = document.querySelector("video");
    
    // 1. Duración base por si no detecta el reproductor físico
    let duracionFormateada = "24:01";
    if (video && video.duration) {
      const totalSegundos = video.duration;
      const minutos = Math.floor(totalSegundos / 60);
      const segundos = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
      duracionFormateada = `${minutos}:${segundos}`;
    }

    // 2. BUSCADOR INTELIGENTE DE MINIATURAS (Evita errores de CORS)
    let urlMiniatura = "";

    // Intento A: Si el reproductor HTML5 tiene una portada nativa asignada
    if (video && video.poster) {
      urlMiniatura = video.poster;
    }

    // Intento B: Buscar la imagen de vista previa en las etiquetas Open Graph del sitio (Muy común en anime)
    if (!urlMiniatura) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && ogImage.content) urlMiniatura = ogImage.content;
    }

    // Intento C: Buscar en las etiquetas estándar de Twitter Cards
    if (!urlMiniatura) {
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage && twitterImage.content) urlMiniatura = twitterImage.content;
    }

    // Intento D: Buscar la imagen del reproductor jwplayer o reproductores personalizados
    if (!urlMiniatura) {
      const imgPortada = document.querySelector('img[class*="poster"], div[class*="poster"] img, .jw-preview');
      if (imgPortada && imgPortada.src) urlMiniatura = imgPortada.src;
    }

    // 3. ENVIAR RESULTADOS AL POPUP
    sendResponse({
      titulo: document.title || "Video Detectado",
      duracion: duracionFormateada,
      poster: urlMiniatura // Si todas fallan, viajará vacío y se activará el emoji 🎬
    });
  }
  return true;
});
