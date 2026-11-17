// Service worker: recebe mensagens do content.js e manda pro servidor local.
const SERVER = "http://127.0.0.1:3737";

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "update") {
    fetch(`${SERVER}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.data),
    }).catch(() => {}); // servidor desligado: ignora
  } else if (msg.type === "clear") {
    fetch(`${SERVER}/clear`, { method: "POST", body: "{}" }).catch(() => {});
  }
});
