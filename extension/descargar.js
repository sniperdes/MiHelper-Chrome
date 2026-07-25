
// Capturamos los datos que nos pasaron por la URL de la pestaña
const urlParams = new URLSearchParams(window.location.search);
const urlM3u8 = urlParams.get('url');
const tituloVideo = urlParams.get('titulo') || "Video_Detectado";

document.getElementById("titulo-video").textContent = tituloVideo;

async function iniciarProceso() {
  try {
    // 1. Descargar el archivo indexador .m3u8
    const respuesta = await fetch(urlM3u8);
    const textoM3u8 = await respuesta.text();
    
    // 2. Extraer los fragmentos (.ts)
    const lineas = textoM3u8.split("\n");
    const baseUrl = urlM3u8.substring(0, urlM3u8.lastIndexOf("/") + 1);
    const urlsFragmentos = [];

    lineas.forEach(linea => {
      linea = linea.trim();
      if (linea && !linea.startsWith("#")) {
        urlsFragmentos.push(linea.startsWith("http") ? linea : baseUrl + linea);
      }
    });

    if (urlsFragmentos.length === 0) {
      document.getElementById("mensaje-estado").textContent = "Error: No se encontraron fragmentos de video válidos.";
      return;
    }

    const total = urlsFragmentos.length;
    const bloques = [];
    let tiempoInicio = Date.now();
    let bytesEnSegundo = 0;

    // 3. Bucle de descarga interactivo
    for (let i = 0; i < total; i++) {
      const resFrag = await fetch(urlsFragmentos[i]);
      const buffer = await resFrag.arrayBuffer();
      bloques.push(new Uint8Array(buffer));
      bytesEnSegundo += buffer.byteLength;

      // Calcular velocidad cada 1 segundo
      let tiempoActual = Date.now();
      if (tiempoActual - tiempoInicio >= 1000) {
        let mbs = (bytesEnSegundo / (1024 * 1024)).toFixed(2);
        document.getElementById("velocidad-texto").textContent = `${mbs} MB/s`;
        bytesEnSegundo = 0;
        tiempoInicio = tiempoActual;
      }

      // Actualizar Barra Celeste
      let porcentaje = Math.floor(((i + 1) / total) * 100);
      document.getElementById("barra").style.width = `${porcentaje}%`;
      document.getElementById("porcentaje-texto").textContent = `Progreso: ${porcentaje}%`;
    }

    // 4. Ensamblar y Guardar en la PC de forma nativa
    document.getElementById("mensaje-estado").textContent = "Ensamblando fragmentos... Por favor espera.";
    document.getElementById("velocidad-texto").textContent = "Uniendo...";

    const blobFinal = new Blob(bloques, { type: "video/mp4" });
    const blobUrl = URL.createObjectURL(blobFinal);

    chrome.downloads.download({
      url: blobUrl,
      filename: `${tituloVideo.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 25)}.mp4`,
      saveAs: true
    }, () => {
      URL.revokeObjectURL(blobUrl);
      document.getElementById("mensaje-estado").textContent = "¡Descarga completada con éxito! Ya puedes cerrar esta pestaña.";
      document.getElementById("velocidad-texto").textContent = "¡Listo! 🎉";
    });

  } catch (error) {
    document.getElementById("mensaje-estado").textContent = "Ocurrió un error al descargar el stream: " + error.message;
  }
}

// Arranca la descarga automáticamente en cuanto abre la pestaña
iniciarProceso();
