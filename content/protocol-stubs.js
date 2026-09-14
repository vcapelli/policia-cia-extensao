// content/protocol-stubs.js
// MAIN world / document_start / all_frames=true
//
// V10 final: auto-calibracao por sessao + bloqueio do typing logico 1597.
// Sem sniff/probes pesados. Mantem apenas uma API pequena de diagnostico/fallback.
(function () {
  'use strict';

  if (window.__HTProtocolInstalledV10) return;
  window.__HTProtocolInstalledV10 = true;

  const FRAME_ID =
    Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36);

  const IS_TOP = window === window.top;
  const PREFIX = '[HT][protocol-v10]';

  const TYPING_LOGICAL_HEADER = 1597;
  const AUTO_CALIBRATION_WINDOW_MS = 350;

  const SETTINGS_CACHE_KEY = 'ht-main-settings-cache-v3';
  const SETTINGS_DOM_ATTR = 'data-ht-settings';

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== 'function') return;

  let settings = {
    hideTyping: false
  };

  let autoCalibrationEnabled = true;
  let outgoingOffset = null;
  let outgoingOffsetSource = null;

  let lastTypingIntentAt = 0;
  let lastTypingIntent = null;
  let lastCalibration = null;

  let socketGeneration = 0;
  let blockedTypingPackets = 0;
  let lastBlockedAt = null;

  const sockets = new Set();
  const initializedSockets = new WeakSet();
  const insideSend = new WeakSet();

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function bool(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
  }

  function parseJSON(value) {
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  function normalizeSettings(value) {
    const source = parseJSON(value);
    if (!source || typeof source !== 'object') return null;

    return {
      hideTyping: bool(
        source.hideTyping ??
          source.hideMyTypingBalloon ??
          source.hideTypingBalloon ??
          source.hide_typing ??
          source['hide-typing'],
        settings.hideTyping
      )
    };
  }

  function toArrayBuffer(value) {
    if (value instanceof ArrayBuffer) {
      return value;
    }

    if (ArrayBuffer.isView(value)) {
      return value.buffer.slice(
        value.byteOffset,
        value.byteOffset + value.byteLength
      );
    }

    return null;
  }

  function readWireHeader(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 6) {
      return null;
    }

    return new DataView(buffer).getUint16(4, false);
  }

  function logicalOutgoingHeader(wire) {
    if (wire == null || outgoingOffset == null) {
      return null;
    }

    return (wire - outgoingOffset) & 0xffff;
  }

  function isPrintableTypingKey(event) {
    if (!event || event.isComposing || event.repeat) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;

    const key = String(event.key || '');

    if (key.length === 1) return true;
    return key === 'Backspace';
  }

  function getTypingIntentAgeMs() {
    if (!lastTypingIntentAt) return null;
    return Date.now() - lastTypingIntentAt;
  }

  // ------------------------------------------------------------
  // Estado / comunicacao entre frames
  // ------------------------------------------------------------
  function getLocalState() {
    return {
      version: 10,
      frameId: FRAME_ID,
      top: IS_TOP,
      href: location.href,
      readyState: document.readyState,

      settingHideTyping: !!settings.hideTyping,
      effectiveHideTyping: !!settings.hideTyping,

      socketCount: sockets.size,
      socketGeneration,

      calibrated: outgoingOffset != null,
      outgoingOffset,
      outgoingOffsetHex:
        outgoingOffset == null
          ? null
          : '0x' + outgoingOffset.toString(16).padStart(4, '0'),
      outgoingOffsetSource,

      autoCalibrationEnabled,
      autoCalibrationWindowMs: AUTO_CALIBRATION_WINDOW_MS,
      typingIntentAgeMs: getTypingIntentAgeMs(),
      lastCalibration,

      typingLogicalHeader: TYPING_LOGICAL_HEADER,

      blockedTypingPackets,
      lastBlockedAt
    };
  }

  function publishState() {
    const state = getLocalState();

    if (IS_TOP) {
      if (window.__HTProtocolFrames) {
        window.__HTProtocolFrames.set(FRAME_ID, state);
      }
      return;
    }

    try {
      window.top.postMessage(
        {
          source: 'ht-protocol-frame-v10',
          type: 'state',
          state
        },
        '*'
      );
    } catch (_) {}
  }

  function postToChildren(message) {
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          window.frames[i].postMessage(message, '*');
        } catch (_) {}
      }
    } catch (_) {}
  }

  function setOutgoingOffsetLocal(value, source) {
    if (value == null) {
      outgoingOffset = null;
      outgoingOffsetSource = null;
      return;
    }

    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return;

    outgoingOffset = numeric & 0xffff;
    outgoingOffsetSource = String(source || 'manual');
  }

  function resetCalibrationLocal() {
    outgoingOffset = null;
    outgoingOffsetSource = null;

    lastTypingIntentAt = 0;
    lastTypingIntent = null;
    lastCalibration = null;
  }

  function noteTypingIntent(value) {
    const meta =
      value && typeof value === 'object'
        ? value
        : {};

    const at = Number(meta.at);

    lastTypingIntentAt =
      Number.isFinite(at) && at > 0
        ? at
        : Date.now();

    lastTypingIntent = {
      at: lastTypingIntentAt,
      key: String(meta.key || ''),
      originFrameId: String(meta.originFrameId || FRAME_ID),
      originHref: String(meta.originHref || location.href)
    };
  }

  function applyControl(command, value, relay = true) {
    if (command === 'typingIntent') {
      noteTypingIntent(value);
    }

    if (command === 'outgoingOffset') {
      let rawValue = value;
      let source = 'manual';

      if (value && typeof value === 'object') {
        rawValue = value.value;
        source = value.source || 'manual';
      }

      setOutgoingOffsetLocal(rawValue, source);
    }

    if (command === 'autoCalibration') {
      autoCalibrationEnabled = !!value;

      if (!autoCalibrationEnabled) {
        lastTypingIntentAt = 0;
        lastTypingIntent = null;
      }
    }

    if (command === 'resetCalibration') {
      resetCalibrationLocal();
    }

    publishState();

    if (relay) {
      postToChildren({
        source: 'ht-protocol-control-v10',
        type: 'command',
        command,
        value
      });
    }
  }

  if (IS_TOP) {
    window.__HTProtocolFrames = new Map();
    window.__HTProtocolFrames.set(FRAME_ID, getLocalState());

    window.addEventListener('message', (event) => {
      const data = event.data;

      if (!data || data.source !== 'ht-protocol-frame-v10') {
        return;
      }

      if (
        data.type === 'state' &&
        data.state &&
        data.state.frameId
      ) {
        window.__HTProtocolFrames.set(
          data.state.frameId,
          data.state
        );
        return;
      }

      if (
        data.type === 'typing-intent' &&
        data.intent
      ) {
        // O top redistribui a intencao para todos os frames.
        applyControl('typingIntent', data.intent, true);
      }
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (
      data.source === 'ht-settings-bridge' &&
      data.type === 'settings'
    ) {
      applySettings(data.settings);
      return;
    }

    if (
      data.source === 'ht-protocol-control-v10' &&
      data.type === 'command'
    ) {
      // Nao retransmite aqui: o emissor ja percorre a arvore de frames.
      applyControl(data.command, data.value, true);
    }
  });

  // ------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------
  function applySettings(value) {
    const next = normalizeSettings(value);
    if (!next) return false;

    settings = Object.assign({}, settings, next);
    publishState();
    return true;
  }

  function pullDomSettings() {
    try {
      const root = document.documentElement;
      if (!root) return false;

      const raw = root.getAttribute(SETTINGS_DOM_ATTR);
      return raw ? applySettings(raw) : false;
    } catch (_) {
      return false;
    }
  }

  try {
    applySettings(localStorage.getItem(SETTINGS_CACHE_KEY));
  } catch (_) {}

  pullDomSettings();

  window.addEventListener('ht-settings-update', (event) => {
    applySettings(event && event.detail);
  });

  if (
    document.documentElement &&
    typeof MutationObserver === 'function'
  ) {
    try {
      const observer = new MutationObserver(pullDomSettings);

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [SETTINGS_DOM_ATTR]
      });
    } catch (_) {}
  }

  // ------------------------------------------------------------
  // Intencao de digitacao
  // ------------------------------------------------------------
  document.addEventListener(
    'keydown',
    (event) => {
      if (!autoCalibrationEnabled) return;
      if (outgoingOffset != null) return;
      if (!settings.hideTyping) return;
      if (!isPrintableTypingKey(event)) return;

      const intent = {
        at: Date.now(),
        key: String(event.key || ''),
        originFrameId: FRAME_ID,
        originHref: location.href
      };

      // Registra imediatamente no frame atual.
      noteTypingIntent(intent);

      if (IS_TOP) {
        applyControl('typingIntent', intent, true);
      } else {
        try {
          window.top.postMessage(
            {
              source: 'ht-protocol-frame-v10',
              type: 'typing-intent',
              intent
            },
            '*'
          );
        } catch (_) {}
      }
    },
    true
  );

  // ------------------------------------------------------------
  // Auto-calibracao
  // ------------------------------------------------------------
  function tryAutoCalibrate(buffer, wire, source) {
    if (!autoCalibrationEnabled) return null;
    if (outgoingOffset != null) return null;
    if (!settings.hideTyping) return null;
    if (!lastTypingIntentAt) return null;
    if (!(buffer instanceof ArrayBuffer)) return null;

    const ageMs = Date.now() - lastTypingIntentAt;

    if (
      ageMs < 0 ||
      ageMs > AUTO_CALIBRATION_WINDOW_MS
    ) {
      return null;
    }

    // Estrutura validada nos testes:
    // [uint32 length = 2][uint16 wire header]
    if (buffer.byteLength !== 6) return null;

    const view = new DataView(buffer);

    if (view.getUint32(0, false) !== 2) {
      return null;
    }

    const offset =
      (wire - TYPING_LOGICAL_HEADER) & 0xffff;

    setOutgoingOffsetLocal(
      offset,
      'auto-keydown:' +
        (
          lastTypingIntent &&
          lastTypingIntent.key
            ? lastTypingIntent.key
            : '?'
        )
    );

    lastCalibration = {
      at: Date.now(),
      mode: 'auto',
      source,
      typingIntentAgeMs: ageMs,
      wireHeader: wire,
      wireHeaderHex:
        '0x' + wire.toString(16).padStart(4, '0'),
      logicalHeader: TYPING_LOGICAL_HEADER,
      outgoingOffset: offset,
      outgoingOffsetHex:
        '0x' + offset.toString(16).padStart(4, '0')
    };

    publishState();

    console.info(
      PREFIX,
      'outOffset auto-calibrado',
      {
        wire,
        offset,
        ageMs
      }
    );

    return lastCalibration;
  }

  function markTypingBlocked() {
    blockedTypingPackets += 1;
    lastBlockedAt = Date.now();
    publishState();
  }

  // Retorna true quando o envio deve ser cancelado.
  function inspectOutgoing(data, source) {
    const buffer = toArrayBuffer(data);

    if (!buffer || buffer.byteLength < 6) {
      return false;
    }

    const wire = readWireHeader(buffer);
    if (wire == null) return false;

    const calibratedNow =
      tryAutoCalibrate(buffer, wire, source);

    const logical =
      logicalOutgoingHeader(wire);

    if (
      settings.hideTyping &&
      logical === TYPING_LOGICAL_HEADER
    ) {
      markTypingBlocked();

      // O proprio frame usado para auto-calibrar tambem e bloqueado.
      return true;
    }

    return false;
  }

  // ------------------------------------------------------------
  // WebSocket hook
  // ------------------------------------------------------------
  function installInstanceSendHook(socket) {
    if (!socket || typeof socket.send !== 'function') return;
    if (socket.send.__HTV10InstanceHook) return;

    const previousSend = socket.send;

    function instanceSendHook(data) {
      if (insideSend.has(this)) {
        return previousSend.call(this, data);
      }

      if (inspectOutgoing(data, 'instance')) {
        return;
      }

      insideSend.add(this);

      try {
        return previousSend.call(this, data);
      } finally {
        insideSend.delete(this);
      }
    }

    try {
      Object.defineProperty(
        instanceSendHook,
        '__HTV10InstanceHook',
        { value: true }
      );
    } catch (_) {
      instanceSendHook.__HTV10InstanceHook = true;
    }

    try {
      socket.send = instanceSendHook;
    } catch (_) {}
  }

  function registerSocket(socket) {
    if (
      !socket ||
      typeof socket.addEventListener !== 'function'
    ) {
      return;
    }

    sockets.add(socket);

    if (!initializedSockets.has(socket)) {
      initializedSockets.add(socket);

      const hadPreviousSocket =
        socketGeneration > 0;

      socketGeneration += 1;

      if (hadPreviousSocket) {
        // Offset nunca e reaproveitado entre novas conexoes.
        applyControl(
          'resetCalibration',
          null,
          true
        );
      }

      socket.addEventListener('close', () => {
        sockets.delete(socket);
        publishState();
      });
    }

    installInstanceSendHook(socket);
    publishState();
  }

  const previousPrototypeSend =
    NativeWebSocket.prototype.send;

  function prototypeSendHook(data) {
    registerSocket(this);

    if (
      !insideSend.has(this) &&
      inspectOutgoing(data, 'prototype')
    ) {
      return;
    }

    return previousPrototypeSend.call(
      this,
      data
    );
  }

  try {
    Object.defineProperty(
      prototypeSendHook,
      '__HTV10PrototypeHook',
      { value: true }
    );
  } catch (_) {
    prototypeSendHook.__HTV10PrototypeHook = true;
  }

  NativeWebSocket.prototype.send =
    prototypeSendHook;

  function WrappedWebSocket(...args) {
    const socket = Reflect.construct(
      NativeWebSocket,
      args,
      NativeWebSocket
    );

    registerSocket(socket);
    return socket;
  }

  Object.setPrototypeOf(
    WrappedWebSocket,
    NativeWebSocket
  );

  WrappedWebSocket.prototype =
    NativeWebSocket.prototype;

  // Copia os estaticos (CONNECTING/OPEN/CLOSING/CLOSED) de forma
  // defensiva: em alguns sites um script anterior (ou o proprio
  // browser, em certas versoes) ja deixa essas propriedades
  // nao-configuraveis na funcao nativa, e um assign direto
  // (`WrappedWebSocket.CONNECTING = ...`) lanca TypeError e aborta o
  // resto do arquivo (window.WebSocket nunca chegava a ser
  // substituido). defineProperty com um fallback em try/catch evita
  // que isso derrube a instalacao do hook.
  function copyStaticSafely(name) {
    try {
      Object.defineProperty(WrappedWebSocket, name, {
        value: NativeWebSocket[name],
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (err) {
      console.warn(
        PREFIX,
        'nao foi possivel copiar WebSocket.' + name,
        err
      );
    }
  }

  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(
    copyStaticSafely
  );

  window.WebSocket = WrappedWebSocket;

  // Reaplica apenas se algum codigo substituir socket.send depois do hook.
  const watchdog = setInterval(() => {
    for (const socket of Array.from(sockets)) {
      try {
        if (
          socket &&
          typeof socket.send === 'function' &&
          !socket.send.__HTV10InstanceHook
        ) {
          installInstanceSendHook(socket);
        }
      } catch (_) {}
    }
  }, 1500);

  // ------------------------------------------------------------
  // API pequena de diagnostico/fallback
  // ------------------------------------------------------------
  function offsetFromTypingWire(wireValue, source) {
    const wire = Number(wireValue);

    if (!Number.isInteger(wire)) {
      throw new TypeError(
        'wire header precisa ser inteiro'
      );
    }

    const normalizedWire = wire & 0xffff;
    const offset =
      (
        normalizedWire -
        TYPING_LOGICAL_HEADER
      ) & 0xffff;

    applyControl(
      'outgoingOffset',
      {
        value: offset,
        source:
          source ||
          'manual-typing-wire:' +
            normalizedWire
      },
      true
    );

    lastCalibration = {
      at: Date.now(),
      mode: 'manual',
      wireHeader: normalizedWire,
      wireHeaderHex:
        '0x' +
        normalizedWire
          .toString(16)
          .padStart(4, '0'),
      logicalHeader: TYPING_LOGICAL_HEADER,
      outgoingOffset: offset,
      outgoingOffsetHex:
        '0x' +
        offset
          .toString(16)
          .padStart(4, '0')
    };

    publishState();

    return Object.assign(
      {},
      lastCalibration,
      { validation: true }
    );
  }

  function offsetFromTypingBase64(base64) {
    const input =
      String(base64 || '').trim();

    if (!input) {
      throw new TypeError(
        'Informe o Base64 do pacote'
      );
    }

    let binary;

    try {
      binary = atob(input);
    } catch (_) {
      throw new Error(
        'Base64 invalido: ' + input
      );
    }

    const bytes = Uint8Array.from(
      binary,
      (char) => char.charCodeAt(0)
    );

    if (bytes.byteLength < 6) {
      throw new Error(
        'Pacote pequeno demais: ' +
          bytes.byteLength +
          ' bytes'
      );
    }

    const view =
      new DataView(bytes.buffer);

    const lengthField =
      view.getUint32(0, false);

    const wire =
      view.getUint16(4, false);

    const result =
      offsetFromTypingWire(
        wire,
        'manual-base64:' + input
      );

    return Object.assign(
      {
        base64: input,
        packetBytes: bytes.byteLength,
        lengthField
      },
      result,
      {
        validation:
          lengthField === 2 &&
          ((wire - result.outgoingOffset) & 0xffff) ===
            TYPING_LOGICAL_HEADER
      }
    );
  }

  window.__HTProtocol = {
    getState: getLocalState,

    getFrames() {
      if (!IS_TOP) {
        return [getLocalState()];
      }

      return Array.from(
        window.__HTProtocolFrames.values()
      );
    },

    getAutoCalibrationState() {
      return {
        enabled: autoCalibrationEnabled,
        calibrated: outgoingOffset != null,
        outgoingOffset,
        outgoingOffsetHex:
          outgoingOffset == null
            ? null
            : '0x' +
              outgoingOffset
                .toString(16)
                .padStart(4, '0'),
        source: outgoingOffsetSource,
        windowMs:
          AUTO_CALIBRATION_WINDOW_MS,
        typingIntentAgeMs:
          getTypingIntentAgeMs(),
        last: lastCalibration,
        blockedTypingPackets,
        lastBlockedAt
      };
    },

    resetAutoCalibration() {
      applyControl(
        'resetCalibration',
        null,
        true
      );

      return this.getFrames();
    },

    setAutoCalibration(value) {
      applyControl(
        'autoCalibration',
        !!value,
        true
      );

      return this.getFrames();
    },

    setOutgoingOffset(value) {
      const numeric = Number(value);

      if (!Number.isInteger(numeric)) {
        throw new TypeError(
          'outgoingOffset precisa ser inteiro'
        );
      }

      applyControl(
        'outgoingOffset',
        {
          value: numeric & 0xffff,
          source: 'manual-number'
        },
        true
      );

      return this.getFrames();
    },

    offsetFromTypingWire(value) {
      return offsetFromTypingWire(value);
    },

    offsetFromTypingBase64(value) {
      return offsetFromTypingBase64(value);
    },

    stopWatchdog() {
      clearInterval(watchdog);
      return true;
    }
  };

  // Compatibilidade com os atalhos usados nos testes V8/V9.
  window.__HTOffsetFromTypingBase64 =
    function (base64) {
      return window.__HTProtocol
        .offsetFromTypingBase64(base64);
    };

  window.__HTOffsetFromTypingWire =
    function (wire) {
      return window.__HTProtocol
        .offsetFromTypingWire(wire);
    };

  window.__HTSetOutgoingOffset =
    function (offset) {
      return window.__HTProtocol
        .setOutgoingOffset(offset);
    };

  window.__HTClearOutgoingOffset =
    function () {
      return window.__HTProtocol
        .resetAutoCalibration();
    };

  window.__HTResetAutoCalibration =
    function () {
      return window.__HTProtocol
        .resetAutoCalibration();
    };

  window.__HTAutoCalibrationState =
    function () {
      return window.__HTProtocol
        .getAutoCalibrationState();
    };

  publishState();

  try {
    window.postMessage(
      {
        source: 'ht-protocol',
        type: 'ready'
      },
      '*'
    );
  } catch (_) {}

  console.info(
    PREFIX,
    'ativo',
    {
      autoCalibration: true,
      typingLogicalHeader:
        TYPING_LOGICAL_HEADER
    }
  );
})();
