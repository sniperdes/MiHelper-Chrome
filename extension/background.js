const videosPorPestaña = {};

// Detectar videos que pasan por la red
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {

        if (details.tabId === -1)
            return;

        const url = details.url.toLowerCase();

        if (
            url.includes(".mp4") ||
            url.includes(".m3u8") ||
            url.includes(".m4s") ||
            url.includes(".ts")
        ) {

            if (!videosPorPestaña[details.tabId])
                videosPorPestaña[details.tabId] = [];

            if (!videosPorPestaña[details.tabId].includes(details.url)) {

                videosPorPestaña[details.tabId].push(details.url);

                console.log("[MiHelper] Video detectado:", details.url);

            }

        }

    },
    {
        urls: ["<all_urls>"]
    }
);


// Mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    switch (request.action) {

        case "obtenerVideosDeRed":

            sendResponse({
                videos: videosPorPestaña[request.tabId] || []
            });

            break;

        case "limpiarVideos":

            videosPorPestaña[request.tabId] = [];

            sendResponse({
                ok: true
            });

            break;

        case "procesarDescarga":

            console.log("[MiHelper] Iniciando descarga");

            iniciarDescarga(
                request.url,
                request.nombre
            );

            sendResponse({
                iniciado: true
            });

            break;

    }

    return true;

});


// Crear el documento Offscreen
async function iniciarDescarga(url, nombre) {

    try {

        await chrome.offscreen.createDocument({

            url: "offscreen.html",

            reasons: ["BLOBS"],

            justification: "Descarga de video"

        });

    } catch (e) {

        // Si ya existe no pasa nada
    }

    console.log("[MiHelper] Enviando al offscreen");

    chrome.runtime.sendMessage({

        action: "descargarVideo",

        url: url,

        nombre: nombre

    });

}


// Limpiar pestañas cerradas
chrome.tabs.onRemoved.addListener((tabId) => {

    delete videosPorPestaña[tabId];

});
