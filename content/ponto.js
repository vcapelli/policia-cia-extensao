// content/ponto.js
// ISOLATED world / document_end
//
// Camada de dados do sistema de Ponto (CIA), adaptada do formulário
// HTML "Controle de Ponto" original. O panel.js consome esta API pra
// desenhar as abas "Ponto" e "Histórico".
//
// Toda chamada cross-origin (Apps Script, opensheet.elk.sh,
// api.habblet.city) passa pelo relay 'fetchJSON' do background.js, em
// vez de um fetch direto daqui — mesmo problema que o hide-typing.js já
// documentou pro chrome.downloads: o CSP da própria página do jogo pode
// bloquear fetches pra domínios de fora, e um service worker de
// extensão não sofre essa restrição.
//
// A detecção de sessão do fórum (fetch('/forum')) é a exceção: é
// same-origin com a própria página, então funciona direto daqui, sem
// passar pelo relay.
(function () {
  'use strict';

  if (window.__HTPontoInstalled) return;
  window.__HTPontoInstalled = true;

  // Cole aqui a URL do Apps Script implantado (termina em /exec).
  const APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbwWcOrsjVLrx68zIowH6-3Vlc10JnY5VrrMwfOtNkuiTjYSrNJDfGxDLJZDNMyPGt-W/exec';

  const HABBLET_API = 'https://api.habblet.city';
  const HABBLET_IMAGING = 'https://imaging.habblet.city/avatarimage';

  // Planilha "CIA: Listagens" — usada só pra identificar o nickname da
  // sessão e (no fallback manual) sugerir nicknames válidos.
  const SHEET_ID = '1eiyugYk_lTFAIAQW4Zgm9TDZg5m3f5chLX8Zmlqa76U';
  const URL_PRACAS = 'https://opensheet.elk.sh/' + SHEET_ID + '/Corpo+de+Praças';
  const URL_OFICIAIS = 'https://opensheet.elk.sh/' + SHEET_ID + '/Corpo+de+Oficiais';
  const URL_EXECUTIVO = 'https://opensheet.elk.sh/' + SHEET_ID + '/Corpo+Executivo';

  function fetchJSON(url, options) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'fetchJSON', url, options }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'sem resposta do background',
          });
          return;
        }
        resolve(resp);
      });
    });
  }

  function capitalizar(texto) {
    return texto.toLowerCase().replace(/(^|[\s\-\/])\S/g, (c) => c.toUpperCase());
  }

  function parsePatente(valor, patente) {
    if (!valor) return null;
    const m = valor.match(/^(.*)\s\[([^\]]+)\]\s.+$/);
    if (!m) return null;
    return { nickname: m[1].trim(), patente: capitalizar(patente.trim()) };
  }

  const state = {
    autor: null,
    listaUsuarios: [], // [{ nickname, patente }]
    patentePorNickname: {},
    militares: [],
    cacheFiguras: {},
    cacheHistorico: {},
  };

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function warn(...args) {
    if (window.__HT && window.__HT.log) window.__HT.log('[ponto]', ...args);
    else console.warn('[HT][ponto]', ...args);
  }

  async function carregarPatentes(url) {
    const resp = await fetchJSON(url);
    if (!resp.ok || !Array.isArray(resp.data)) {
      warn('falha ao carregar planilha', url, resp);
      return;
    }
    resp.data.forEach((linha) => {
      Object.keys(linha).forEach((patente) => {
        const u = parsePatente(linha[patente], patente);
        if (!u) return;
        state.listaUsuarios.push(u);
        state.patentePorNickname[u.nickname.toLowerCase()] = u;
      });
    });
  }

  async function carregarListagemPatentes() {
    state.listaUsuarios = [];
    state.patentePorNickname = {};
    await Promise.all([carregarPatentes(URL_PRACAS), carregarPatentes(URL_OFICIAIS), carregarPatentes(URL_EXECUTIVO)]);
  }

  function resolverAutor(nick) {
    const registro = state.patentePorNickname[nick.toLowerCase()];
    if (registro) return { nick: registro.nickname, patente: registro.patente };
    // se não estiver na listagem de patentes, ainda assim permite bater
    // ponto com o nick detectado na sessão
    return { nick, patente: '' };
  }

  // O nick é detectado por uma ponte separada (forum-bridge-main.js +
  // forum-bridge.js) que roda DENTRO de ciahbt.forumeiros.com — o
  // fórum é um domínio diferente do habblet.city, então um fetch
  // daqui não serviria (nem teria o cookie de sessão, já que uma
  // chamada de fetch fora de uma navegação de verdade não carrega
  // cookies SameSite=Lax). Aquela ponte grava o nick no
  // chrome.storage.local; aqui só lemos.
  function detectarSessaoForum() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['htForumNick', 'htForumNickAt'], (data) => {
        const nick = data && data.htForumNick;
        if (!nick) {
          warn('nenhum nick de fórum em cache. Abra https://ciahbt.forumeiros.com/ logado pelo menos uma vez com a extensão ativa.');
          resolve({ logado: true, nick: null });
          return;
        }
        resolve({ logado: true, nick });
      });
    });
  }

  function encodeNickParaApi(nick) {
    return encodeURIComponent(nick).replace(/%40/g, '@').replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2E/g, '.');
  }

  async function buscarPlayer(nick) {
    const resp = await fetchJSON(HABBLET_API + '/player/' + encodeNickParaApi(nick));
    if (!resp.ok || !resp.data || !resp.data.figure) return null;
    return resp.data.figure;
  }

  async function buscarFigura(nick) {
    const chave = nick.toLowerCase();
    if (state.cacheFiguras.hasOwnProperty(chave)) return state.cacheFiguras[chave];

    const limpo = nick.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

    let figura = await buscarPlayer(nick);
    if (!figura && limpo && limpo !== nick) {
      figura = await buscarPlayer(limpo);
    }
    state.cacheFiguras[chave] = figura;
    return figura;
  }

  function urlAvatarCabeca(figura) {
    return (
      HABBLET_IMAGING +
      '?figure=' +
      encodeURIComponent(figura) +
      '&headonly=1&direction=2&head_direction=2&size=m&img_format=png'
    );
  }

  async function urlAvatarPorNick(nick) {
    const figura = await buscarFigura(nick);
    return figura ? urlAvatarCabeca(figura) : null;
  }

  function definirAutor(dados) {
    state.autor = dados;
    emit('ht-ponto-autor', dados);
  }

  function definirAutorManual(nick) {
    definirAutor(resolverAutor(nick));
  }

  function buscarSugestoes(termo) {
    const q = String(termo || '').trim().toLowerCase();
    if (q.length < 2) return [];
    return state.listaUsuarios.filter((u) => u.nickname.toLowerCase().indexOf(q) !== -1).slice(0, 8);
  }

  async function baterPonto(tipo) {
    if (!state.autor) throw new Error('Confirme sua identificação antes de bater o ponto.');

    const resp = await fetchJSON(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ nome: state.autor.nick, tipo }),
    });

    if (!resp.ok || !resp.data || !resp.data.ok) {
      throw new Error((resp.data && resp.data.erro) || 'Erro ao registrar o ponto.');
    }

    delete state.cacheHistorico[state.autor.nick];
    await carregarLista();
    return resp.data;
  }

  async function carregarLista() {
    const resp = await fetchJSON(APPS_SCRIPT_URL);
    if (!resp.ok) warn('falha ao carregar lista do Apps Script', resp);
    state.militares = (resp.ok && resp.data && resp.data.militares) || [];
    emit('ht-ponto-roster', state.militares);
    return state.militares;
  }

  async function buscarHistorico(nome) {
    if (state.cacheHistorico[nome]) return state.cacheHistorico[nome];
    const resp = await fetchJSON(APPS_SCRIPT_URL + '?action=history&nome=' + encodeURIComponent(nome));
    const registros = (resp.ok && resp.data && resp.data.registros) || [];
    state.cacheHistorico[nome] = registros;
    return registros;
  }

  let initStarted = false;
  async function init() {
    if (initStarted) return;
    initStarted = true;

    carregarLista();

    await carregarListagemPatentes();
    const sessao = await detectarSessaoForum();

    if (sessao.nick) {
      definirAutor(resolverAutor(sessao.nick));
    } else {
      emit('ht-ponto-manual', null);
    }
  }

  window.__HT = window.__HT || {};
  window.__HT.ponto = {
    init,
    getAutor: () => state.autor,
    definirAutorManual,
    buscarSugestoes,
    baterPonto,
    carregarLista,
    getMilitares: () => state.militares.slice(),
    buscarHistorico,
    urlAvatarPorNick,
  };
})();
