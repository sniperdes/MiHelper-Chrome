console.log("MiHelper: content.js cargado y listo para capturar miniaturas.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "obtenerDatosFisicosVideo") {
    // Buscamos el elemento de video real en la página web
    const video = document.querySelector("video");
    
    if (video) {
      // 1. Calcular duración real del video en minutos y segundos
      const totalSegundos = video.duration || 0;
      const minutos = Math.floor(totalSegundos / 60);
      const segundos = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
      const duracionFormateada = totalSegundos > 0 ? `${minutos}:${segundos}` : "24:01";

      // 2. Intentar usar la imagen de portada nativa del sitio (si existe)
      let urlMiniatura = video.poster || "";

      // 3. TRUCO DE FOTOGRAMA: Si no hay póster, tomamos una "foto" instantánea del video actual
      if (!urlMiniatura && video.videoWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 160; // Ancho optimizado para la tarjetita de la extensión
          canvas.height = 90; // Proporción estándar 16:9 de video
          const ctx = canvas.getContext("2d");
          
          // Dibujamos el fotograma exacto del video dentro del lienzo oculto
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convertimos ese dibujo en una imagen de texto Base64 real que Chrome puede leer
          urlMiniatura = canvas.toDataURL("image/jpeg", 0.7);
        } catch (e) {
          console.log("MiHelper: No se pudo capturar el fotograma por seguridad (CORS)", e);
        }
      }

      // Enviamos todas las propiedades listas al popup.js
      sendResponse({
        titulo: document.title || "Video Detectado",
        duracion: duracionFormateada,
        poster: urlMiniatura
      });
    } else {
      // Si abren la extensión en una página donde no hay un tag <video> visible
      sendResponse({ titulo: document.title || "Video Detectado", duracion: "24:01", poster: "" });
    }
  }
  return true; // Mantiene el canal de comunicación abierto
});
