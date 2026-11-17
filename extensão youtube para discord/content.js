// Roda dentro das páginas do YouTube / YouTube Music.
// Lê o que está tocando e manda pro background.js, que repassa ao servidor local.

function getInfo() {
  const video = document.querySelector("video");
  if (!video || video.paused || video.ended || !video.duration) return null;

  const isMusic = location.hostname === "music.youtube.com";
  const params = new URLSearchParams(location.search);
  const videoId = params.get("v");
  if (!videoId) return null;

  let title = "";
  let channel = "";

  if (isMusic) {
    title = document.querySelector("ytmusic-player-bar .title")?.textContent?.trim() || "";
    const byline = document.querySelector("ytmusic-player-bar .byline")?.textContent?.trim() || "";
    channel = byline.split("•")[0].trim();
  } else {
    title =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
      document.title.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "");
    channel =
      document.querySelector("ytd-watch-metadata ytd-channel-name a")?.textContent?.trim() ||
      document.querySelector("#owner #channel-name a")?.textContent?.trim() ||
      "YouTube";
  }

  if (!title) return null;

  return {
    videoId,
    title,
    channel: channel || "YouTube",
    // mqdefault é 16:9 puro (sem as tarjas pretas do hqdefault)
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    currentTime: video.currentTime,
    duration: video.duration,
  };
}

let wasPlaying = false;

function tick() {
  try {
    const info = getInfo();
    if (info) {
      wasPlaying = true;
      chrome.runtime.sendMessage({ type: "update", data: info });
    } else if (wasPlaying) {
      wasPlaying = false;
      chrome.runtime.sendMessage({ type: "clear" });
    }
  } catch {
    // extensão foi recarregada; ignora
  }
}

// Checa a cada 2s (antes era 5s)
setInterval(tick, 2000);

// Reage na hora aos eventos do player, sem esperar o próximo ciclo
function hookVideo(video) {
  if (video.__discordHooked) return;
  video.__discordHooked = true;
  ["playing", "seeked", "loadeddata"].forEach((ev) =>
    video.addEventListener(ev, () => setTimeout(tick, 400))
  );
  ["pause", "ended"].forEach((ev) =>
    video.addEventListener(ev, () => setTimeout(tick, 100))
  );
}
setInterval(() => {
  const v = document.querySelector("video");
  if (v) hookVideo(v);
}, 1000);

// Trocou de vídeo dentro do YouTube (sem recarregar a página)
window.addEventListener("yt-navigate-finish", () => setTimeout(tick, 1000));
setTimeout(tick, 500);

window.addEventListener("beforeunload", () => {
  try { chrome.runtime.sendMessage({ type: "clear" }); } catch {}
});
