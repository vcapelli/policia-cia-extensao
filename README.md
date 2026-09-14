# Habblet Tools (pessoal)

Extensão própria para habblet.city, sem depender de nenhum backend de terceiros.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no navegador.
2. Ative o **"Modo do desenvolvedor"** (canto superior direito).
3. Clique em **"Carregar sem compactação"**.
4. Selecione a pasta `habblet-tools` (esta pasta, com o `manifest.json` dentro).
5. Abra o habblet.city — a extensão já deve estar ativa.

Sempre que você editar um arquivo, volte em `chrome://extensions` e clique
no botão de recarregar (ícone circular) no card da extensão, depois dê F5
na aba do jogo.

## O que já funciona (Fase 1)

- **FPS** — contador no canto superior direito da tela, via
  `requestAnimationFrame`. Deve funcionar assim que carregar, sem ajuste.
- **Histórico de chat** — captura mensagens do chat em memória, usando os
  seletores reais do client (`.chat-bubble` / `.username`), confirmados
  contra o código de outra extensão que faz a mesma captura. Abra o
  popup, digite um nome de usuário pra filtrar (opcional) e clique em
  "Baixar histórico" — gera um `.txt`.
- **Remover anúncios** — usa os seletores reais (`.adTimer`,
  `.adsbygoogle`, `[id^="closeAd"]`, `[id*="btnCloseAd"]`) mais uma
  heurística pro banner de "seu navegador está bloqueando anúncios".
  Deve funcionar direto, sem ajuste.
- **Painel de histórico dentro do jogo** — um botão flutuante (💬) no
  canto inferior direito abre um painel com busca, chips clicáveis por
  usuário (clique pra adicionar/remover da seleção — dá pra selecionar
  vários nomes ao mesmo tempo), contador ao vivo ("X de Y msgs") e botão
  de download. O download usa a API `chrome.downloads` da extensão (não
  um clique simulado num link), pra não depender do comportamento da
  página. As abas "Geral"/"Sussurros" da Bananablet não estão aqui ainda
  porque exigem captura via pacote (Fase 2) — veja a nota abaixo.

## Esconder balão de digitação — não é Fase 1

Diferente do que parecia no início, isso **não dá pra fazer via CSS/DOM**:
o balão é desenhado pelo motor gráfico do jogo (canvas), não é um
elemento HTML. A forma certa é bloquear, no WebSocket, o pacote de saída
que avisa o servidor "estou digitando" — isso entra na Fase 2, junto do
anti-AFK, porque os dois dependem de identificar o header certo de um
pacote específico do protocolo do jogo.

## Fase 2 (em andamento): esconder balão de digitação

Já está com a lógica de bloqueio pronta em `content/protocol-stubs.js` —
só falta o número do header do pacote, que muda a cada instalação/versão
do jogo, então precisa ser descoberto na prática:

1. Abra o console do navegador (F12) na aba do jogo, dentro de um quarto.
2. Rode: `localStorage.setItem('ht-sniffer', '1')`
3. Recarregue a página (F5).
4. Digite algumas letras no chat (sem enviar, só digitando mesmo) e
   observe os logs `[HT][sniffer][OUT]` no console.
5. Um header deve aparecer repetidamente enquanto você digita e parar
   quando você para de digitar — esse é o candidato. Anote o número.
6. Me manda esse número que eu preencho o `TYPING_PACKET_HEADER` no
   `content/protocol-stubs.js` (hoje está `null`, ou seja, o bloqueio
   está desativado até isso ser preenchido).
7. Depois de preenchido, o toggle "Esconder balão de digitação" no
   popup já liga/desliga o bloqueio de verdade — não precisa de mais
   nada.
8. Pra desativar o sniffer depois: `localStorage.removeItem('ht-sniffer')`

## Fase 2 (ainda não implementada): anti-AFK, ping, copiar visual

Essas três dependem de identificar o "header" (um número) de pacotes
específicos do protocolo binário do jogo, do mesmo jeito que o balão de
digitação — mas anti-AFK também precisa saber a *estrutura do corpo* do
pacote (não só o header), já que envolve reenviar um pacote pro
servidor (não só bloquear um que já existe). Vamos deixar pra depois de
fechar o balão de digitação.

## Limitações gerais

- DOM e protocolo do jogo podem mudar em atualizações do Habblet — os
  seletores/headers descobertos hoje podem parar de funcionar amanhã.
- Eu não consigo testar nada disso ao vivo; o ciclo é sempre
  "eu escrevo → você testa → me diz o resultado → eu ajusto".
- Sem ícones definidos no `manifest.json` — o Chrome usa um ícone padrão
  genérico. Se quiser um ícone próprio, é só gerar um PNG 48x48 e 128x128
  e adicionar a chave `"icons"` no manifest.
