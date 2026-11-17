// recebe o que a extensão manda e joga no Rich Presence do Discord
const http = require("http");
const { Client } = require("@xhayper/discord-rpc");

// Application ID do seu app em https://discord.com/developers/applications
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "COLOQUE_SEU_CLIENT_ID_AQUI";
// opcional: nome de uma imagem que você subiu em Rich Presence > Art Assets
const IMAGE_KEY = process.env.DISCORD_IMAGE_KEY || "";
const PORT = 3737;
const MAX_BODY = 16 * 1024; // os dados de um vídeo não passam de 1kb, isso é sobra

const client = new Client({ clientId: CLIENT_ID });
let ready = false;
let clearTimer = null;
let lastKey = "";
let lastStart = 0;

client.on("ready", () => {
  ready = true;
  console.log(`Conectado ao Discord como ${client.user?.username ?? "?"}`);
});

client.on("disconnected", () => {
  ready = false;
  console.log("Discord desconectou, reconectando em 10s...");
  setTimeout(connect, 10000);
});

// sem isso um erro qualquer do rpc derrubava o servidor inteiro
client.on("error", (e) => console.log("Erro no Discord:", e?.message ?? e));

async function connect() {
  try {
    await client.login();
  } catch {
    console.log("Discord não encontrado (está aberto?). Tentando de novo em 10s...");
    setTimeout(connect, 10000);
  }
}
connect();

async function clearActivity() {
  lastKey = "";
  if (ready) {
    try { await client.user?.clearActivity(); } catch {}
  }
}

const str = (v, max = 128) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// só aceita o formato que a extensão manda, o resto é descartado
function parseUpdate(d) {
  if (!d || typeof d !== "object") return null;
  const videoId = str(d.videoId, 20);
  if (!/^[\w-]{6,20}$/.test(videoId)) return null;

  const title = str(d.title);
  if (!title) return null;

  const currentTime = Number(d.currentTime);
  if (!isFinite(currentTime) || currentTime < 0) return null;
  const duration = Number(d.duration);

  return {
    videoId,
    title: title.length < 2 ? title + " " : title, // discord exige no mínimo 2 caracteres
    channel: str(d.channel, 120) || "YouTube",
    // monta a url e a thumb aqui mesmo em vez de confiar no que veio
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    currentTime,
    duration: isFinite(duration) && duration > 0 ? duration : 0,
  };
}

async function setActivity(d) {
  if (!ready) return;

  // Evita spam: só atualiza se a música mudou ou se o tempo pulou (seek)
  const start = Math.round(Date.now() - d.currentTime * 1000);
  // o título entra na chave pq às vezes o yt demora pra trocar o título da página
  const key = `${d.videoId}|${d.title}|${d.channel}`;
  if (key === lastKey && Math.abs(start - lastStart) < 3000) return;
  lastKey = key;
  lastStart = start;

  const activity = {
    type: 2, // 2 = "Ouvindo"
    details: d.title,
    state: `de ${d.channel}`.slice(0, 128),
    // usa a imagem fixa se tiver configurado, senão vai a thumb do vídeo
    largeImageKey: IMAGE_KEY || d.thumbnail,
    largeImageText: d.title,
    instance: false,
    buttons: [{ label: "Ouvir no YouTube", url: d.url }],
    startTimestamp: start,
  };
  if (d.duration) activity.endTimestamp = Math.round(start + d.duration * 1000);

  try {
    await client.user?.setActivity(activity);
    console.log(`tocando: ${d.title} — ${d.channel}`);
  } catch (e) {
    console.log("Erro ao atualizar:", e?.message ?? e);
  }
}

// Só a extensão pode falar com o servidor. Sem isso qualquer site aberto no
// navegador conseguia mandar um POST pro 127.0.0.1 e mudar seu status.
function allowed(req) {
  const host = req.headers.host || "";
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return false;
  const origin = req.headers.origin;
  return typeof origin === "string" && origin.startsWith("chrome-extension://");
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !allowed(req)) {
    res.writeHead(403);
    return res.end();
  }

  let body = "";
  let tooBig = false;
  req.on("data", (c) => {
    if (tooBig) return;
    body += c;
    if (body.length > MAX_BODY) {
      tooBig = true;
      res.writeHead(413);
      res.end();
      req.destroy();
    }
  });
  req.on("end", () => {
    if (tooBig) return;
    if (req.url === "/update") {
      let data = null;
      try { data = parseUpdate(JSON.parse(body)); } catch {}
      if (!data) { res.writeHead(400); return res.end("bad request"); }
      setActivity(data);
      // Se parar de receber updates (aba fechada), limpa em 20s
      clearTimeout(clearTimer);
      clearTimer = setTimeout(clearActivity, 20000);
    } else if (req.url === "/clear") {
      clearTimeout(clearTimer);
      clearActivity();
    } else {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200);
    res.end("ok");
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`A porta ${PORT} já está em uso. O YoutubeRadar já está aberto em outra janela?`);
  } else {
    console.log("Erro no servidor:", e.message);
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`Servidor rodando em http://127.0.0.1:${PORT}`)
);
