# YoutubeRadar

Sempre achei chato que o Discord mostra quando tô ouvindo Spotify, mas quando é no YouTube não aparece nada. Então fiz o YoutubeRadar: ele detecta o vídeo ou música que tá tocando no YouTube (ou YouTube Music) e mostra no seu perfil do Discord, igual o card do Spotify.

Aparece o título, o canal, a capa, a barra de tempo andando e um botão pra quem quiser ouvir junto.

## Como funciona

São duas partes:

- **extensão youtube para discord/** – extensão do Chrome que fica de olho na aba do YouTube e pega o que tá tocando (título, canal, tempo atual e duração)
- **server.js** – um servidorzinho local em Node que recebe isso da extensão e atualiza o Rich Presence do Discord

```
YouTube (Chrome)  →  extensão  →  server.js (127.0.0.1:3737)  →  Discord
```

Se pausar ou fechar a aba, o status some sozinho depois de alguns segundos.

O servidor só escuta no próprio PC e só aceita requisição vinda da extensão, então nenhum site que você abrir consegue mexer no seu status.

## O que precisa

- [Node.js](https://nodejs.org) (LTS)
- Discord **desktop** aberto (o do navegador não suporta Rich Presence)
- Chrome ou qualquer navegador baseado nele (Edge, Brave, Opera GX...)

## Instalando

### 1. Criar o app no Discord

1. Entra em https://discord.com/developers/applications e clica em **New Application**
2. O nome que você colocar é o que vai aparecer como "Ouvindo **nome**"
3. Copia o **Application ID**

Se quiser uma imagem fixa no lugar da capa do vídeo, sobe ela em **Rich Presence → Art Assets** e guarda o nome que você deu.

### 2. Servidor

```
git clone https://github.com/limacoder-lang/YoutubeRadar.git
cd YoutubeRadar
npm install
```

No Windows é só dar dois cliques no `iniciar.bat`. Na primeira vez ele pede o Application ID e salva num `id.txt` (e roda o `npm install` sozinho se você esqueceu).

Ou manualmente:

```powershell
# PowerShell
$env:DISCORD_CLIENT_ID="SEU_ID"; node server.js
```

```bash
# Linux / Mac
DISCORD_CLIENT_ID=SEU_ID node server.js
```

Pra usar a imagem fixa, coloca também `DISCORD_IMAGE_KEY=nome_da_imagem`.

Deixa a janela aberta. Quando aparecer `Conectado ao Discord como ...` tá pronto.

### 3. Extensão

1. Abre `chrome://extensions`
2. Liga o **Modo do desenvolvedor**
3. **Carregar sem compactação** e escolhe a pasta `extensão youtube para discord`

Agora é só dar play em qualquer coisa no YouTube.

## Problemas comuns

- **Não aparece nada no Discord:** vê em Configurações → Privacidade de atividade se "Compartilhar minha atividade" tá ligado
- **"node não é reconhecido" no `npm start`:** roda direto com `node server.js` ou usa o `iniciar.bat`
- **Erro de manifesto ao carregar a extensão:** você escolheu a pasta errada, tem que ser a `extensão youtube para discord` (a que tem o `manifest.json` dentro)
- **A imagem fixa não aparece:** o Discord demora uns minutos pra liberar imagem nova nos Art Assets

## Licença

MIT
