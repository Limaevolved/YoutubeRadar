// recebe o que a extensão manda e joga no Rich Presence do Discord
const http = require("http");
const { Client } = require("@xhayper/discord-rpc");

// Application ID do seu app em https://discord.com/developers/applications
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "COLOQUE_SEU_CLIENT_ID_AQUI";
// opcional: nome de uma imagem que você subiu em Rich Presence > Art Assets
const IMAGE_KEY = process.env.DISCORD_IMAGE_KEY || "";
const PORT = 3737;
const MAX_BODY = 16 * 1024; // os dados de um vídeo não passam de 1kb, isso é sobra
const RPC_TIMEOUT = 8000;

// ---------- conexão com o Discord ----------
// Quando o PC fica um tempo parado a conexão às vezes morre sem avisar e todo
// pedido dá "timed out". Por isso, se der erro, o cliente é jogado fora e um
// novo é criado do zero, em vez de ficar insistindo no mesmo.

let client = null;
let ready = false;
let reconnectTimer = null;

function connect() {
  clearTimeout(reconnectTimer);
  const c = new Client({ clientId: CLIENT_ID });
  client = c;

  c.on("ready", () => {
    if (client !== c) return;
    ready = true;
    applied = undefined; // força reenviar o status atual
    console.log(`Conectado ao Discord como ${c.user?.username ?? "?"}`);
    flush();
  });
  c.on("disconnected", () => {
    if (client !== c) return;
    console.log("Discord desconectou.");
    reconnect();
  });
  // sem isso um erro qualquer do rpc derrubava o servidor inteiro
  c.on("error", (e) => console.log("Erro no Discord:", e?.message ?? e));

  c.login().catch(() => {
    if (client !== c) return;
    console.log("Discord não encontrado (está aberto?). Tentando de novo em 10s...");
    reconnect(10000);
  });
}

function reconnect(delay = 3000) {
  ready = false;
  const old = client;
  client = null;
  if (old) {
    old.removeAllListeners();
    old.on("error", () => {});
    Promise.resolve().then(() => old.destroy()).catch(() => {});
  }
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, delay);
  if (delay < 10000) console.log("Reconectando ao Discord...");
}

const withTimeout = (p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), RPC_TIMEOUT))]);

// ---------- fila do status ----------
// Guarda só o último status pedido e manda um de cada vez. Assim não acumula
// pedido em cima de pedido se o Discord estiver lento.

let desired = null;      // { key, activity } ou null pra limpar
let applied = undefined; // key do que já está no Discord
let busy = false;

async function flush() {
  if (busy || !ready || !client) return;
  const want = desired;
  const wantKey = want ? want.key : null;
  if (wantKey === applied) return;

  busy = true;
  const c = client;
  try {
    if (want) {
      await withTimeout(c.user.setActivity(want.activity));
      console.log(`tocando: ${want.activity.details} — ${want.channel}`);
    } else {
      await withTimeout(c.user.clearActivity());
    }
    applied = wantKey;
  } catch (e) {
    console.log("Erro ao atualizar:", e?.message ?? e);
    if (client === c) reconnect(); // conexão travada: começa de novo
  } finally {
    busy = false;
  }
  // se mudou alguma coisa enquanto mandava, manda de novo
  if (ready && (desired ? desired.key : null) !== applied) setTimeout(flush, 1000);
}

// ---------- dados que vêm da extensão ----------

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

let lastStart = 0;

function setActivity(d) {
  const start = Math.round(Date.now() - d.currentTime * 1000);
  // o título entra na chave pq às vezes o yt demora pra trocar o título da página
  const base = `${d.videoId}|${d.title}|${d.channel}`;
  // mesma música e o tempo não pulou (seek)? não precisa atualizar
  if (desired && desired.base === base && Math.abs(start - lastStart) < 3000) return;
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

  desired = { base, key: `${base}|${start}`, activity, channel: d.channel };
  flush();
}

function clearActivity() {
  desired = null;
  flush();
}

// ---------- servidor local ----------

// Só a extensão pode falar com o servidor. Sem isso qualquer site aberto no
// navegador conseguia mandar um POST pro 127.0.0.1 e mudar seu status.
function allowed(req) {
  const host = req.headers.host || "";
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return false;
  const origin = req.headers.origin;
  return typeof origin === "string" && origin.startsWith("chrome-extension://");
}

let clearTimer = null;

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
      // Se parar de receber updates (aba fechada), limpa em 75s. Não dá pra ser
      // menos pq o Chrome deixa os timers lentos em aba que tá em segundo plano
      clearTimeout(clearTimer);
      clearTimer = setTimeout(clearActivity, 75000);
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
  connect();
});
