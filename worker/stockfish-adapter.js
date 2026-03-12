(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.StockfishAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_BROWSER_ENGINE_PATHS = [
    "../stockfish-18-lite-single.js",
    "../stockfish-18-asm.js",
    "../stockfish-18-lite.js"
  ];

  const DEFAULT_NODE_ENGINE_PATHS = [
    "../stockfish-18-lite-single.js",
    "../stockfish-18-asm.js"
  ];

  function isNodeRuntime() {
    return typeof process !== "undefined"
      && process.versions
      && typeof process.versions.node === "string";
  }

  function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  }

  function normalizeError(error, code, message) {
    const normalized = error instanceof Error ? error : new Error(String(message || error || "Engine error"));
    if (!normalized.code) normalized.code = code || "engine-error";
    return normalized;
  }

  function splitLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseIntSafe(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseInfoLine(line) {
    if (typeof line !== "string" || !line.startsWith("info ")) return null;

    const tokens = line.trim().split(/\s+/);
    const info = {
      raw: line,
      depth: null,
      seldepth: null,
      multipv: 1,
      nodes: null,
      nps: null,
      time: null,
      scoreType: null,
      scoreCp: null,
      scoreMate: null,
      pv: []
    };

    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === "depth") info.depth = parseIntSafe(tokens[index + 1]);
      if (token === "seldepth") info.seldepth = parseIntSafe(tokens[index + 1]);
      if (token === "multipv") info.multipv = parseIntSafe(tokens[index + 1]) || 1;
      if (token === "nodes") info.nodes = parseIntSafe(tokens[index + 1]);
      if (token === "nps") info.nps = parseIntSafe(tokens[index + 1]);
      if (token === "time") info.time = parseIntSafe(tokens[index + 1]);
      if (token === "score") {
        info.scoreType = tokens[index + 1] || null;
        if (info.scoreType === "cp") info.scoreCp = parseIntSafe(tokens[index + 2]);
        if (info.scoreType === "mate") info.scoreMate = parseIntSafe(tokens[index + 2]);
      }
      if (token === "pv") {
        info.pv = tokens.slice(index + 1);
        break;
      }
    }

    return info;
  }

  function parseBestmoveLine(line) {
    if (typeof line !== "string") return null;
    const match = line.trim().match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
    if (!match) return null;
    return {
      bestmove: match[1],
      ponder: match[2] || null
    };
  }

  function sortMultiPv(entries) {
    return entries.slice().sort((left, right) => {
      if ((left.multipv || 1) !== (right.multipv || 1)) {
        return (left.multipv || 1) - (right.multipv || 1);
      }
      return (right.depth || 0) - (left.depth || 0);
    });
  }

  function buildGoCommand(options = {}) {
    if (Number.isInteger(options.movetime) && options.movetime > 0) {
      return `go movetime ${Math.max(20, options.movetime)}`;
    }
    if (Number.isInteger(options.depth) && options.depth > 0) {
      return `go depth ${options.depth}`;
    }
    return "go movetime 200";
  }

  function createBrowserTransport(enginePath) {
    const resolvedPath = typeof URL !== "undefined" && typeof self !== "undefined" && self.location
      ? new URL(enginePath, self.location.href).toString()
      : enginePath;
    const worker = new Worker(resolvedPath);
    let onLine = null;
    let onError = null;

    worker.onmessage = (event) => {
      splitLines(event?.data).forEach((line) => {
        if (onLine) onLine(line);
      });
    };

    worker.onerror = (event) => {
      if (!onError) return;
      const error = normalizeError(event?.message || "Browser engine worker failed", "engine-worker-failed");
      error.event = event || null;
      onError(error);
    };

    return {
      backend: "browser-worker",
      setListener(listener) {
        onLine = listener;
      },
      setErrorListener(listener) {
        onError = listener;
      },
      send(command) {
        worker.postMessage(command);
      },
      terminate() {
        worker.terminate();
      }
    };
  }

  function createNodeTransport(enginePath) {
    const childProcess = require("node:child_process");
    const path = require("node:path");
    const resolvedPath = path.resolve(__dirname, enginePath);
    const processPath = process.execPath;
    const child = childProcess.spawn(processPath, [resolvedPath], { stdio: ["pipe", "pipe", "pipe"] });
    let onLine = null;
    let onError = null;

    const emitLines = (chunk) => {
      splitLines(chunk).forEach((line) => {
        if (onLine) onLine(line);
      });
    };

    child.stdout.on("data", emitLines);
    child.stderr.on("data", emitLines);
    child.on("error", (error) => {
      if (onError) onError(normalizeError(error, "engine-process-failed"));
    });
    child.on("exit", (code) => {
      if (code === 0 || code === null) return;
      if (onError) {
        const error = normalizeError(`Engine exited with code ${code}`, "engine-process-exit");
        error.exitCode = code;
        onError(error);
      }
    });

    return {
      backend: "node-process",
      setListener(listener) {
        onLine = listener;
      },
      setErrorListener(listener) {
        onError = listener;
      },
      send(command) {
        child.stdin.write(`${command}\n`);
      },
      terminate() {
        if (!child.killed) child.kill();
      }
    };
  }

  function createTransport(enginePath) {
    return isNodeRuntime()
      ? createNodeTransport(enginePath)
      : createBrowserTransport(enginePath);
  }

  class EngineSession {
    constructor(options = {}) {
      this.options = options;
      this.transport = null;
      this.enginePath = null;
      this.backend = null;
      this.initialized = false;
      this.initPromise = null;
      this.commandLock = Promise.resolve();
      this.currentRequest = null;
      this.lastOptions = {};
    }

    _getEngineCandidates() {
      const explicit = toArray(this.options.enginePaths);
      if (explicit.length > 0) return explicit;
      return isNodeRuntime() ? DEFAULT_NODE_ENGINE_PATHS.slice() : DEFAULT_BROWSER_ENGINE_PATHS.slice();
    }

    _disposeTransport() {
      if (!this.transport) return;
      this.transport.terminate();
      this.transport = null;
      this.backend = null;
      this.enginePath = null;
      this.currentRequest = null;
    }

    _bindTransport(transport, enginePath) {
      this.transport = transport;
      this.backend = transport.backend;
      this.enginePath = enginePath;
      transport.setListener((line) => this._handleLine(line));
      transport.setErrorListener((error) => this._handleTransportError(error));
    }

    _handleTransportError(error) {
      if (!this.currentRequest) return;
      const request = this.currentRequest;
      this.currentRequest = null;
      clearTimeout(request.timeoutHandle);
      request.reject(normalizeError(error, error?.code || "engine-transport-error"));
    }

    _handleLine(line) {
      if (!this.currentRequest) return;
      const request = this.currentRequest;
      request.lines.push(line);
      if (request.onLine) request.onLine(line, request.lines.slice());
      if (!request.isDone(line, request.lines)) return;
      clearTimeout(request.timeoutHandle);
      this.currentRequest = null;
      request.resolve(request.lines.slice());
    }

    _enqueue(task) {
      const next = this.commandLock.then(task, task);
      this.commandLock = next.then(() => undefined, () => undefined);
      return next;
    }

    _send(command) {
      if (!this.transport) {
        throw normalizeError("Engine transport is not ready", "engine-not-ready");
      }
      this.transport.send(command);
    }

    _sendNoWait(command) {
      return this._enqueue(async () => {
        this._send(command);
      });
    }

    _sendAndWait(command, options = {}) {
      const timeoutMs = Math.max(1000, options.timeoutMs || 8000);
      const isDone = typeof options.isDone === "function" ? options.isDone : (() => false);
      const onLine = typeof options.onLine === "function" ? options.onLine : null;

      return this._enqueue(() => new Promise((resolve, reject) => {
        if (this.currentRequest) {
          reject(normalizeError("Another engine request is already running", "engine-busy"));
          return;
        }

        const timeoutHandle = setTimeout(() => {
          if (this.currentRequest) this.currentRequest = null;
          reject(normalizeError(`Engine command timed out: ${command}`, "engine-timeout"));
        }, timeoutMs);

        this.currentRequest = {
          lines: [],
          timeoutHandle,
          resolve,
          reject,
          onLine,
          isDone
        };

        try {
          this._send(command);
        } catch (error) {
          clearTimeout(timeoutHandle);
          this.currentRequest = null;
          reject(normalizeError(error, "engine-send-failed"));
        }
      }));
    }

    async init() {
      if (this.initialized) return this;
      if (this.initPromise) return this.initPromise;

      this.initPromise = (async () => {
        let lastError = null;
        const candidates = this._getEngineCandidates();

        for (let index = 0; index < candidates.length; index += 1) {
          const enginePath = candidates[index];
          try {
            const transport = createTransport(enginePath);
            this._bindTransport(transport, enginePath);
            await this._sendAndWait("uci", {
              timeoutMs: 12000,
              isDone: (line) => line === "uciok"
            });
            await this._sendAndWait("isready", {
              timeoutMs: 8000,
              isDone: (line) => line === "readyok"
            });
            this.initialized = true;
            return this;
          } catch (error) {
            lastError = normalizeError(error, error?.code || "engine-init-failed");
            this._disposeTransport();
          }
        }

        throw lastError || normalizeError("Unable to initialize Stockfish", "engine-init-failed");
      })();

      return this.initPromise;
    }

    async ready() {
      if (!this.initPromise) {
        await this.init();
      } else {
        await this.initPromise;
      }
      await this._sendAndWait("isready", {
        timeoutMs: 8000,
        isDone: (line) => line === "readyok"
      });
      return this;
    }

    async newGame() {
      await this.init();
      await this._sendNoWait("ucinewgame");
      await this.ready();
      return this;
    }

    async configure(options = {}) {
      await this.init();

      const commands = [];
      if (Number.isInteger(options.skillLevel) && this.lastOptions.skillLevel !== options.skillLevel) {
        commands.push(`setoption name Skill Level value ${options.skillLevel}`);
      }
      if (Number.isInteger(options.multipv) && this.lastOptions.multipv !== options.multipv) {
        commands.push(`setoption name MultiPV value ${Math.max(1, options.multipv)}`);
      }
      if (Number.isInteger(options.threads) && this.lastOptions.threads !== options.threads) {
        commands.push(`setoption name Threads value ${Math.max(1, options.threads)}`);
      }
      if (Number.isInteger(options.hash) && this.lastOptions.hash !== options.hash) {
        commands.push(`setoption name Hash value ${Math.max(1, options.hash)}`);
      }

      for (let index = 0; index < commands.length; index += 1) {
        await this._sendNoWait(commands[index]);
      }

      if (commands.length > 0) {
        this.lastOptions = {
          ...this.lastOptions,
          skillLevel: Number.isInteger(options.skillLevel) ? options.skillLevel : this.lastOptions.skillLevel,
          multipv: Number.isInteger(options.multipv) ? options.multipv : this.lastOptions.multipv,
          threads: Number.isInteger(options.threads) ? options.threads : this.lastOptions.threads,
          hash: Number.isInteger(options.hash) ? options.hash : this.lastOptions.hash
        };
        await this.ready();
      }

      return this;
    }

    async analyzePosition(options = {}) {
      const fen = String(options.fen || "").trim();
      if (!fen) {
        throw normalizeError("analyzePosition requires a FEN string", "analysis-missing-fen");
      }

      await this.init();
      await this.configure({
        skillLevel: options.skillLevel,
        multipv: options.multipv || 1,
        threads: options.threads,
        hash: options.hash
      });

      await this._sendNoWait(`position fen ${fen}`);

      const infoByPv = new Map();
      const lines = await this._sendAndWait(buildGoCommand(options), {
        timeoutMs: Math.max(8000, (options.movetime || 0) + 6000),
        isDone: (line) => line.startsWith("bestmove"),
        onLine: (line) => {
          if (!line.startsWith("info ")) return;
          const info = parseInfoLine(line);
          if (!info) return;
          const key = info.multipv || 1;
          const previous = infoByPv.get(key);
          if (!previous || (info.depth || 0) >= (previous.depth || 0)) {
            infoByPv.set(key, info);
          }
          if (typeof options.onInfo === "function") {
            options.onInfo(info, sortMultiPv(Array.from(infoByPv.values())));
          }
        }
      });

      const bestmove = parseBestmoveLine(lines[lines.length - 1] || "") || { bestmove: null, ponder: null };
      const multipv = sortMultiPv(Array.from(infoByPv.values()));
      const primary = multipv[0] || null;

      return {
        bestmove: bestmove.bestmove,
        ponder: bestmove.ponder,
        pv: primary?.pv || [],
        scoreCp: primary?.scoreCp ?? null,
        scoreMate: primary?.scoreMate ?? null,
        depth: primary?.depth ?? null,
        multipv,
        backend: this.backend,
        enginePath: this.enginePath,
        rawLines: lines
      };
    }

    async stop() {
      if (!this.transport) return;
      this._send("stop");
    }

    dispose() {
      this._disposeTransport();
      this.initialized = false;
      this.initPromise = null;
    }
  }

  function createSnapshotFromInfo(info, backend = "partial") {
    if (!info) return null;
    return {
      bestmove: info.pv?.[0] || null,
      ponder: null,
      pv: info.pv || [],
      scoreCp: info.scoreCp ?? null,
      scoreMate: info.scoreMate ?? null,
      depth: info.depth ?? null,
      multipv: [info],
      backend,
      enginePath: null,
      rawLines: [info.raw || ""]
    };
  }

  function createEngineSession(options = {}) {
    return new EngineSession(options);
  }

  return {
    DEFAULT_BROWSER_ENGINE_PATHS,
    DEFAULT_NODE_ENGINE_PATHS,
    createEngineSession,
    parseInfoLine,
    parseBestmoveLine,
    createSnapshotFromInfo
  };
});
