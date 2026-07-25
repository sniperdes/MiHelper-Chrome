
// Escuchamos los bloques de video que nos envía el background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ensamblarYDescargarNativo") {
    
    // Convertimos los arrays de vuelta a bloques binarios
    const bloquesOriginales = request.bloques.map(b => new Uint8Array(b));
    const blobFinal = new Blob(bloquesOriginales, { type: "video/mp4" });
    
    // Aquí SÍ está permitido crear la URL del archivo
    const urlDescarga = URL.createObjectURL(blobFinal);

    // Mandamos a descargar el archivo de forma nativa a la PC
    chrome.downloads.download({
      url: urlDescarga,
      filename: request.nombre,
      saveAs: true
    }, () => {
      // Limpiamos la memoria para que el navegador no se ponga lento
      URL.revokeObjectURL(urlDescarga);
      sendResponse({ finalizado: true });
    });
    
    return true; // Mantiene la comunicación asíncrona activa
  }
});
