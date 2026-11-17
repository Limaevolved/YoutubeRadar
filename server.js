// recebe o que a extensão manda e joga no Rich Presence do Discord
const http = require("http");
const { Client } = require("@xhayper/discord-rpc");

// Application ID do seu app em https://discord.com/developers/applications
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "COLOQUE_SEU_CLIENT_ID_AQUI";
// opcional: nome de uma imagem que você subiu em Rich Presence > Art Assets
const IMAGE_KEY = process.env.DISCORD_IMAGE_KEY || "";
const PORT = 3737;

const client = new Client({ clientId: CLIENT_ID });
let ready = false;
let clearTimer = null;
let lastKey = "";

client.on("ready", () => {
  ready = true;
  console.log(`Conectado ao Discord como ${client.user.username}`);
});

client.on("disconnected", () => {
  ready = false;
  console.log("Discord desconectou, reconectando...");
  connect();
});

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

async function setActivity(d) {
  if (!ready) return;

  // Evita spam: só atualiza se a música mudou ou se o tempo pulou (seek)
  const start = Math.round(Date.now() - d.currentTime * 1000);
  // o título entra na chave pq às vezes o yt demora pra trocar o título da página
  const key = `${d.videoId}|${d.title}|${d.channel}`;
  const drift = Math.abs(start - (setActivity.lastStart || 0));
  if (key === lastKey && drift < 3000) return;
  lastKey = key;
  setActivity.lastStart = start;

  const activity = {
    type: 2, // 2 = "Ouvindo"
    details: d.title.slice(0, 128),
    state: `de ${d.channel}`.slice(0, 128),
    // usa a imagem fixa se tiver configurado, senão vai a thumb do vídeo
    largeImageKey: IMAGE_KEY || d.thumbnail,
    largeImageText: d.title.slice(0, 128),
    instance: false,
    buttons: [{ label: "Ouvir no YouTube", url: d.url }],
  };

  if (d.duration && isFinite(d.duration)) {
    activity.startTimestamp = start;
    activity.endTimestamp = Math.round(start + d.duration * 1000);
  } else {
    activity.startTimestamp = start;
  }

  try {
    await client.user?.setActivity(activity);
    console.log(`tocando: ${d.title} — ${d.channel}`);
  } catch (e) {
    console.log("Erro ao atualizar:", e.message);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      if (req.url === "/update") {
        const data = JSON.parse(body);
        setActivity(data);
        // Se parar de receber updates (aba fechada), limpa em 20s
        clearTimeout(clearTimer);
        clearTimer = setTimeout(clearActivity, 20000);
      } else if (req.url === "/clear") {
        clearTimeout(clearTimer);
        clearActivity();
      }
      res.writeHead(200); res.end("ok");
    } catch {
      res.writeHead(400); res.end("bad request");
    }
  });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`Servidor rodando em http://127.0.0.1:${PORT}`)
);
