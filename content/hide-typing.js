// "Esconder balão de digitação" — NÃO é possível via CSS/DOM.
//
// Descobrimos (analisando o content.js da Bananablet) que esse balão é
// desenhado pelo motor gráfico do jogo (canvas/Pixi.js) por cima do seu
// avatar, não é um elemento HTML. A forma correta de implementar isso é
// bloquear o PACOTE de saída que avisa o servidor "estou digitando"
// (WebSocket), antes dele sair do seu navegador — assim o servidor nunca
// repassa esse aviso pra ninguém, e o balão nunca é desenhado por
// nenhum cliente.
//
// Essa lógica pertence à Fase 2 (protocol-stubs.js, mundo MAIN), porque
// precisa interceptar o WebSocket real do jogo. Veja o README, seção
// "Fase 2", para o passo a passo de descoberta do header do pacote.
(function () {
  // Nada a fazer aqui neste arquivo — mantido só como registro do que
  // NÃO funciona, pra não repetirmos a tentativa por engano.
})();
