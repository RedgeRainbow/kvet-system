var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance2 = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance2)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance2)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance2, key, desc);
      }
    }
  }
}
globalThis.performance = performance2;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now2 = Date.now();
  const seconds = Math.trunc(now2 / 1e3);
  const nanos = now2 % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str2, encoding, cb) {
    if (str2 instanceof Uint8Array) {
      str2 = new TextDecoder().decode(str2);
    }
    try {
      console.log(str2);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// ../public/js/shared.js
var shared_exports = {};
__export(shared_exports, {
  APPROVAL_KINDS: () => APPROVAL_KINDS,
  ASSIGNABLE: () => ASSIGNABLE,
  BEHAVIOR: () => BEHAVIOR,
  CERT_LABELS: () => CERT_LABELS,
  CO_MODES: () => CO_MODES,
  DASH_TILES: () => DASH_TILES,
  DEFAULT_DASH: () => DEFAULT_DASH,
  DEFAULT_NUM: () => DEFAULT_NUM,
  DOH_Q: () => DOH_Q,
  FB_GROUPS: () => FB_GROUPS,
  HEADER_AUTO: () => HEADER_AUTO,
  HEADER_TYPES: () => HEADER_TYPES,
  MIN: () => MIN,
  PUNCTUALITY: () => PUNCTUALITY,
  RANK: () => RANK,
  ROLES: () => ROLES,
  ROLE_NAV: () => ROLE_NAV,
  ROLE_ONLY: () => ROLE_ONLY,
  ROLE_PLUS: () => ROLE_PLUS,
  SHEET_MODES: () => SHEET_MODES,
  SOON_DAYS: () => SOON_DAYS,
  annotateCerts: () => annotateCerts,
  approvalsCfg: () => approvalsCfg,
  bakuNow: () => bakuNow,
  bakuToday: () => bakuToday,
  buildFilter: () => buildFilter,
  can: () => can,
  certCompanyLine: () => certCompanyLine,
  certCounterName: () => certCounterName,
  certCounters: () => certCounters,
  certDelivered: () => certDelivered,
  certLabel: () => certLabel,
  certNames: () => certNames,
  cleanLabels: () => cleanLabels,
  cleanName: () => cleanName,
  computeOutcome: () => computeOutcome,
  dashCfg: () => dashCfg,
  dayMarks: () => dayMarks,
  daysBetween: () => daysBetween,
  defaultRule: () => defaultRule,
  docsReady: () => docsReady,
  dohYes: () => dohYes,
  evaluateSheet: () => evaluateSheet,
  expiringWithin: () => expiringWithin,
  expiryFrom: () => expiryFrom,
  finalDay: () => finalDay,
  fmtCertNo: () => fmtCertNo,
  fmtDate: () => fmtDate,
  fmtDateTime: () => fmtDateTime,
  fmtMin: () => fmtMin,
  fmtTime: () => fmtTime,
  foldText: () => foldText,
  fullAz: () => fullAz,
  fullEn: () => fullEn,
  goodCertNo: () => goodCertNo,
  goodEmail: () => goodEmail,
  goodFin: () => goodFin,
  goodPhone: () => goodPhone,
  goodQImg: () => goodQImg,
  hasAzChars: () => hasAzChars,
  initials: () => initials,
  isDate: () => isDate,
  isPrivateCompany: () => isPrivateCompany,
  keepOrder: () => keepOrder,
  learnerNo: () => learnerNo,
  legacyRole: () => legacyRole,
  loginSlug: () => loginSlug,
  mayPublish: () => mayPublish,
  multiDay: () => multiDay,
  normCertNo: () => normCertNo,
  normFin: () => normFin,
  normPhone: () => normPhone,
  numCfg: () => numCfg,
  optList: () => optList,
  optText: () => optText,
  pad: () => pad,
  parseFilter: () => parseFilter,
  parseQuestions: () => parseQuestions,
  penaltyRange: () => penaltyRange,
  periodRange: () => periodRange,
  qImgUrl: () => qImgUrl,
  questionsFromRows: () => questionsFromRows,
  rollDay: () => rollDay,
  sessionActiveOn: () => sessionActiveOn,
  sessionDays: () => sessionDays,
  sessionEnd: () => sessionEnd,
  sessionStatus: () => sessionStatus,
  sheetItems: () => sheetItems,
  slug: () => slug,
  suggestTimePenalty: () => suggestTimePenalty,
  testScore: () => testScore,
  timeCalc: () => timeCalc,
  toMin: () => toMin,
  transliterateAzToEn: () => transliterateAzToEn,
  uniq: () => uniq,
  usable: () => usable,
  validateSheetData: () => validateSheetData,
  yearPart: () => yearPart
});
var RANK = { editor: 2, admin: 3, superadmin: 4, approver: 1, auditor: 1, emergency: 3 };
var legacyRole = /* @__PURE__ */ __name((r) => r === "reader" ? "auditor" : r === "creator" ? "editor" : r, "legacyRole");
var ROLES = Object.keys(RANK).filter((r) => r !== "emergency");
var ROLE_ONLY = {
  approver: /* @__PURE__ */ new Set(["state", "view", "approve", "material.view", "cert.sign", "doc.sign", "cand.approve", "download"]),
  auditor: /* @__PURE__ */ new Set(["state", "view", "material.view", "analytics"])
};
var ROLE_PLUS = { emergency: /* @__PURE__ */ new Set(["users", "perf", "analytics"]) };
var ASSIGNABLE = /* @__PURE__ */ __name((r) => r !== "emergency", "ASSIGNABLE");
var ROLE_NAV = { approver: ["approvals", "sessions", "certificates"], auditor: ["analytics", "sessions", "certificates"] };
var MIN = {
  view: 1,
  state: 1,
  "material.view": 1,
  libdocs: 3,
  messages: 3,
  // library (question banks, groups, AI settings page) and the dashboard: editor and up (not auditors / approvers)
  library: 2,
  dashboard: 2,
  // taking files out of the system (PDF, ZIP, Excel, certificate download): everyone except auditors
  download: 1,
  // confirming new candidates sent by a company
  "cand.approve": 3,
  // approval queue: admin and up, and the approver role
  approve: 3,
  // AI knowledge base (switching the AI module on / off is superadmin: 'users')
  "ai.kb": 3,
  // analytics dashboards with AI summary: admin and up (auditors see the oversight view, trainers and companies their own in their portals)
  analytics: 3,
  // performance and feedback analysis of individual trainers and trainees: superadmin / admin
  perf: 3,
  // content
  "blank.save": 2,
  "sheet.save": 2,
  "material.save": 2,
  "session.save": 2,
  "exam.save": 2,
  "practical.save": 2,
  "attendance.confirm": 2,
  "test.save": 2,
  "seed": 3,
  // online tests: reviewing answers and deciding pass / fail (the session's own trainer may do it too, in the trainer portal)
  "test.review": 3,
  // people and portals (they carry the confidential ID/FIN, so admin and up)
  "company.save": 3,
  "trainer.save": 3,
  "trainee.save": 3,
  "trainee.import": 3,
  "credentials.reset": 3,
  // certificates
  "issue": 3,
  "cert.update": 3,
  "cert.revoke": 3,
  // signing certificates and session documents: superadmin (and the approver role, see ROLE_ONLY)
  "cert.sign": 4,
  "doc.sign": 4,
  // system
  "settings.save": 3,
  "backup.create": 3,
  "backup.view": 3,
  "audit.view": 3,
  "fin.view": 3,
  "requests": 3,
  // backups hold every ID/FIN and password hash: download is superadmin only
  "backup.download": 4,
  // destructive or high-risk: superadmin only
  "delete": 4,
  "archive": 4,
  "users": 4,
  "backup.restore": 4,
  "backup.delete": 4,
  "camera": 4,
  "cert.delete": 4
};
var can = /* @__PURE__ */ __name((role, action) => ROLE_ONLY[role] ? ROLE_ONLY[role].has(action) : (RANK[role] || 0) >= (MIN[action] ?? 99) || !!ROLE_PLUS[role]?.has(action), "can");
var TR = {
  \u0259: "a",
  \u018F: "A",
  \u0131: "i",
  I: "I",
  \u0130: "I",
  \u00F6: "o",
  \u00D6: "O",
  \u00FC: "u",
  \u00DC: "U",
  \u015F: "sh",
  \u015E: "Sh",
  \u00E7: "ch",
  \u00C7: "Ch",
  \u011F: "gh",
  \u011E: "Gh",
  c: "j",
  C: "J",
  x: "kh",
  X: "Kh",
  q: "g",
  Q: "G",
  j: "zh",
  J: "Zh"
};
var transliterateAzToEn = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[əƏıIİöÖüÜşŞçÇğĞcCxXqQjJ]/g, (c) => TR[c] ?? c), "transliterateAzToEn");
var hasAzChars = /* @__PURE__ */ __name((s) => /[əƏıİöÖüÜşŞçÇğĞ]/.test(String(s ?? "")), "hasAzChars");
var clean = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/\s+/g, " ").trim(), "clean");
var cleanName = clean;
var fullAz = /* @__PURE__ */ __name((p, withFather = true) => [p.name, p.surname, withFather ? p.father : ""].map(clean).filter(Boolean).join(" "), "fullAz");
var fullEn = /* @__PURE__ */ __name((p, withFather = true) => [p.nameEn || transliterateAzToEn(p.name), p.surnameEn || transliterateAzToEn(p.surname), withFather ? p.fatherEn || transliterateAzToEn(p.father) : ""].map(clean).filter(Boolean).join(" "), "fullEn");
function certNames(p, withFather = false) {
  const en = fullEn(p, withFather);
  return p.foreign ? { az: "", en } : { az: fullAz(p, withFather), en };
}
__name(certNames, "certNames");
var initials = /* @__PURE__ */ __name((s) => clean(s).split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase(), "initials");
var goodFin = /* @__PURE__ */ __name((v, foreign) => foreign ? /^[A-Za-z0-9-]{4,20}$/.test(v) : /^[A-Za-z0-9]{7}$/.test(v), "goodFin");
var foldText = /* @__PURE__ */ __name((s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ə/g, "e").replace(/ı/g, "i"), "foldText");
var normFin = /* @__PURE__ */ __name((v) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, ""), "normFin");
var normPhone = /* @__PURE__ */ __name((v) => {
  const s = String(v ?? "").trim().replace(/[^\d+]/g, "");
  return s;
}, "normPhone");
var goodPhone = /* @__PURE__ */ __name((v) => normPhone(v).replace(/\D/g, "").length >= 7, "goodPhone");
var goodEmail = /* @__PURE__ */ __name((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "goodEmail");
var isDate = /* @__PURE__ */ __name((v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !isNaN(Date.parse(v + "T00:00:00Z")), "isDate");
var bakuToday = /* @__PURE__ */ __name((now2 = Date.now()) => new Date(now2 + 4 * 36e5).toISOString().slice(0, 10), "bakuToday");
var bakuNow = /* @__PURE__ */ __name((now2 = Date.now()) => new Date(now2 + 4 * 36e5).toISOString().slice(0, 16).replace("T", " "), "bakuNow");
var pad = /* @__PURE__ */ __name((n, l = 2) => String(n).padStart(l, "0"), "pad");
function fmtDate(d) {
  if (!d) return "";
  const s = String(d).slice(0, 10), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const x = new Date(d);
  return isNaN(x.getTime()) ? "" : `${pad(x.getUTCDate())}.${pad(x.getUTCMonth() + 1)}.${x.getUTCFullYear()}`;
}
__name(fmtDate, "fmtDate");
function fmtDateTime(iso) {
  if (!iso) return "";
  const x = new Date(new Date(iso).getTime() + 4 * 36e5);
  if (isNaN(x.getTime())) return "";
  return `${pad(x.getUTCDate())}.${pad(x.getUTCMonth() + 1)}.${x.getUTCFullYear()} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
}
__name(fmtDateTime, "fmtDateTime");
var fmtTime = /* @__PURE__ */ __name((iso) => fmtDateTime(iso).slice(11), "fmtTime");
function expiryFrom(startIso, months) {
  const [y, m, d] = String(startIso).slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + Number(months || 0), d));
  if (t.getUTCDate() !== d) t.setUTCDate(0);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}
__name(expiryFrom, "expiryFrom");
var daysBetween = /* @__PURE__ */ __name((a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5), "daysBetween");
var DEFAULT_NUM = { prefix: "CRT", sep: "/", yearFmt: "YY", pad: 4, start: 1 };
var numCfg = /* @__PURE__ */ __name((st) => ({ ...DEFAULT_NUM, ...st?.num || {} }), "numCfg");
var yearPart = /* @__PURE__ */ __name((cfg, year) => cfg.yearFmt === "YYYY" ? String(year) : String(year).slice(2), "yearPart");
var fmtCertNo = /* @__PURE__ */ __name((cfg, prefix, year, n) => `${prefix || cfg.prefix}${cfg.sep}${yearPart(cfg, year)}${cfg.sep}${String(n).padStart(cfg.pad, "0")}`, "fmtCertNo");
var certCounterName = /* @__PURE__ */ __name((cfg, prefix, year) => `cert:${prefix || cfg.prefix}:${year}`, "certCounterName");
var normCertNo = /* @__PURE__ */ __name((v) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, ""), "normCertNo");
var goodCertNo = /* @__PURE__ */ __name((v) => /^[A-Z0-9][A-Z0-9/._-]{2,39}$/.test(v), "goodCertNo");
var learnerNo = /* @__PURE__ */ __name((year, seq) => `E-${year}${String(seq).padStart(5, "0")}`, "learnerNo");
var SOON_DAYS = 60;
function annotateCerts(certs, today, soonDays = SOON_DAYS) {
  const newest = /* @__PURE__ */ new Map();
  for (const c of certs) {
    if (c.revoked) continue;
    const k = c.tid + "|" + c.bid, cur = newest.get(k);
    if (!cur || c.start > cur.start || c.start === cur.start && c.issuedAt > cur.issuedAt) newest.set(k, c);
  }
  return certs.map((c) => {
    let st;
    if (c.revoked) st = "REVOKED";
    else if (newest.get(c.tid + "|" + c.bid) !== c) st = "RENEWED";
    else {
      const left = daysBetween(today, c.expiry);
      st = left < 0 ? "EXPIRED" : left <= soonDays ? "SOON" : "ACTIVE";
    }
    return { ...c, st };
  });
}
__name(annotateCerts, "annotateCerts");
var expiringWithin = /* @__PURE__ */ __name((c, today, days) => c.st !== "REVOKED" && c.st !== "RENEWED" && daysBetween(today, c.expiry) >= 0 && daysBetween(today, c.expiry) <= days, "expiringWithin");
function certCounters(annotated) {
  const k = { total: 0, ACTIVE: 0, SOON: 0, EXPIRED: 0 };
  for (const c of annotated) if (c.st in k) {
    k.total++;
    k[c.st]++;
  }
  return k;
}
__name(certCounters, "certCounters");
var CERT_LABELS = {
  intro: { az: "Bu sertifikatla t\u0259sdiq olunur ki,", en: "This is to certify that," },
  provider: { az: "T\u0259sdiql\u0259nmi\u015F T\u0259lim M\u0259rk\u0259zi:", en: "Approved Training Provider:" },
  start: { az: "T\u0259limin Ba\u015Flama Tarixi", en: "Training Start Date" },
  end: { az: "T\u0259limin Bitm\u0259 Tarixi", en: "Training Completion Date" },
  credits: { az: "{0} Kredit", en: "{0} Credits" },
  learner: { az: "\u0130\u015Ftirak\xE7\u0131 N\xF6mr\u0259si:", en: "Learner Number:" },
  trainer: { az: "T\u0259sdiq olunmu\u015F T\u0259lim\xE7i:", en: "Approved Trainer:" },
  valid: { az: "Etibarl\u0131d\u0131r:", en: "Valid till:" },
  signature: { az: "\u0130mza", en: "Signature" },
  chief: { az: "Ba\u015F icra\xE7\u0131", en: "Chief Executive" }
};
var certLabel = /* @__PURE__ */ __name((blank, k) => {
  const x = blank?.labels?.[k];
  return { az: x?.az ?? CERT_LABELS[k].az, en: x?.en ?? CERT_LABELS[k].en };
}, "certLabel");
var cleanLabels = /* @__PURE__ */ __name((v) => Object.fromEntries(Object.keys(CERT_LABELS).filter((k) => v && v[k] && typeof v[k] === "object").map((k) => [k, { az: String(v[k].az ?? "").trim().slice(0, 120), en: String(v[k].en ?? "").trim().slice(0, 120) }])), "cleanLabels");
var CO_MODES = ["", "show", "hide", "custom"];
function certCompanyLine(snap) {
  const m = snap?.coMode || (snap?.showCo ? "show" : "hide");
  return m === "custom" ? String(snap.coText || "").trim() : m === "show" ? String(snap.company || "").trim() : "";
}
__name(certCompanyLine, "certCompanyLine");
var sessionEnd = /* @__PURE__ */ __name((s) => s.endDate || s.date, "sessionEnd");
function sessionDays(s) {
  const out3 = [], end = sessionEnd(s);
  let d = s.date;
  while (d && d <= end && out3.length < 31) {
    out3.push(d);
    d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
  }
  return out3.length ? out3 : [s.date];
}
__name(sessionDays, "sessionDays");
function rollDay(s, today, asked) {
  const days = sessionDays(s).filter((d) => d <= today);
  return days.includes(asked) ? asked : days.includes(today) ? today : days[days.length - 1] || null;
}
__name(rollDay, "rollDay");
var multiDay = /* @__PURE__ */ __name((s) => sessionDays(s).length > 1, "multiDay");
var finalDay = /* @__PURE__ */ __name((s) => sessionEnd(s), "finalDay");
var docsReady = /* @__PURE__ */ __name((s) => !multiDay(s) || !!s.docsOpen, "docsReady");
var dayMarks = /* @__PURE__ */ __name((s, e) => Object.fromEntries(sessionDays(s).map((d) => [d, e?.days?.[d]?.absent ? "A" : e?.days?.[d]?.at ? "P" : ""])), "dayMarks");
function sessionStatus(s, stats, today) {
  if (s.cancelled) return "cancelled";
  if (s.closed) return "completed";
  if (stats && stats.total > 0 && stats.finalized >= stats.total) return "completed";
  if (today < s.date) return "upcoming";
  if (today <= sessionEnd(s)) return "ongoing";
  return "review";
}
__name(sessionStatus, "sessionStatus");
var sessionActiveOn = /* @__PURE__ */ __name((s, today) => !s.cancelled && !s.closed && today >= s.date && today <= sessionEnd(s), "sessionActiveOn");
var BEHAVIOR = ["excellent", "good", "satisfactory", "poor"];
var PUNCTUALITY = ["ontime", "late", "vlate"];
var SHEET_MODES = ["passfail", "penalty", "rating"];
var sheetItems = /* @__PURE__ */ __name((sh) => (sh.sections || []).flatMap((s) => s.items || []), "sheetItems");
function penaltyRange(it2) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*$/.exec(String(it2.penalty ?? ""));
  if (!m) return { min: 0, max: 0 };
  const a = Number(m[1]), b = m[2] === void 0 ? a : Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
__name(penaltyRange, "penaltyRange");
function defaultRule(mode) {
  return mode === "penalty" ? { maxPenalty: 40 } : mode === "rating" ? { minAvg: 3, failBelow: 2 } : {};
}
__name(defaultRule, "defaultRule");
function evaluateSheet(sheet, data) {
  const items = sheetItems(sheet), a = data?.answers || {}, rule = { ...defaultRule(sheet.mode), ...sheet.rule || {} };
  const out3 = { result: "PASS", total: 0, max: 0, avg: null, failed: [], reason: "" };
  const disq = (data?.disq || []).filter((id) => (sheet.disq || []).some((d) => d.id === id));
  if (sheet.mode === "penalty") {
    let total2 = 0;
    for (const it2 of items) {
      const v = Number(a[it2.id] || 0);
      if (!(v > 0)) continue;
      total2 += v;
      out3.failed.push(it2.id);
    }
    total2 += Math.max(0, Number(data?.timePenalty) || 0);
    out3.total = total2;
    out3.max = rule.maxPenalty;
    if (disq.length) {
      out3.result = "FAIL";
      out3.reason = "disq";
    } else if (total2 > rule.maxPenalty) {
      out3.result = "FAIL";
      out3.reason = "penalty";
    } else if (!data?.done) out3.result = "INCOMPLETE";
    return out3;
  }
  const answered = items.filter((it2) => a[it2.id] !== void 0 && a[it2.id] !== null && a[it2.id] !== "");
  if (sheet.mode === "passfail") {
    for (const it2 of items) if (a[it2.id] === "F") out3.failed.push(it2.id);
    out3.total = items.filter((it2) => a[it2.id] === "P").length;
    out3.max = items.filter((it2) => a[it2.id] !== "NA").length;
    if (disq.length) {
      out3.result = "FAIL";
      out3.reason = "disq";
    } else if (out3.failed.length) {
      out3.result = "FAIL";
      out3.reason = "item";
    } else if (answered.length < items.length) out3.result = "INCOMPLETE";
    return out3;
  }
  const rated = items.filter((it2) => typeof a[it2.id] === "number");
  for (const it2 of rated) if (a[it2.id] < (rule.failBelow ?? 2)) out3.failed.push(it2.id);
  out3.total = rated.reduce((s, it2) => s + a[it2.id], 0);
  out3.max = rated.length * 5;
  out3.avg = rated.length ? out3.total / rated.length : null;
  if (disq.length) {
    out3.result = "FAIL";
    out3.reason = "disq";
  } else if (out3.failed.length) {
    out3.result = "FAIL";
    out3.reason = "item";
  } else if (answered.length < items.length) out3.result = "INCOMPLETE";
  else if (out3.avg === null || out3.avg < (rule.minAvg ?? 3)) {
    out3.result = "FAIL";
    out3.reason = "avg";
  }
  return out3;
}
__name(evaluateSheet, "evaluateSheet");
var HEADER_TYPES = ["text", "time", "number", "duration", "excess"];
var HEADER_AUTO = ["", "candidate", "company", "date", "learnerNo", "training", "location"];
var toMin = /* @__PURE__ */ __name((v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}, "toMin");
var fmtMin = /* @__PURE__ */ __name((n) => n === null || n === void 0 || !Number.isFinite(n) ? "" : `${Math.floor(n / 60)}:${pad(n % 60)}`, "fmtMin");
function timeCalc(sheet, header = {}) {
  const f = /* @__PURE__ */ __name((type) => (sheet.headerFields || []).find((h) => (h.type || "text") === type), "f");
  const st = f("time") && (sheet.headerFields || []).filter((h) => h.type === "time");
  const set = f("number"), start = st?.[0], finish = st?.[1];
  const a = start ? toMin(header[start.id]) : null, b = finish ? toMin(header[finish.id]) : null;
  let duration = null;
  if (a !== null && b !== null) duration = b >= a ? b - a : b + 1440 - a;
  const allowed = set ? Number(header[set.id]) : NaN;
  const excess = duration !== null && Number.isFinite(allowed) && allowed > 0 ? Math.max(0, duration - allowed) : null;
  return { duration, excess };
}
__name(timeCalc, "timeCalc");
var suggestTimePenalty = /* @__PURE__ */ __name((sheet, header) => {
  const { excess } = timeCalc(sheet, header);
  return excess ? Math.ceil(excess) * (Number(sheet.timeRate) > 0 ? Number(sheet.timeRate) : 1) : 0;
}, "suggestTimePenalty");
function validateSheetData(sheet, data) {
  const items = new Map(sheetItems(sheet).map((i) => [i.id, i])), a = data?.answers || {}, clean3 = {}, faults = {}, pts = {};
  if (sheet.mode === "penalty") {
    for (const id of Object.keys(data?.faults || {})) if (!items.has(id)) throw "badInput";
    for (const [id, it2] of items) {
      const r = penaltyRange(it2), hasF = data?.faults && id in data.faults;
      if (hasF) {
        const n = Number(data.faults[id]);
        if (!Number.isInteger(n) || n < 0 || n > 99) throw "badInput";
        if (!n) continue;
        let p = data.pts?.[id] === void 0 || data.pts?.[id] === "" ? r.max : Number(data.pts[id]);
        if (!Number.isFinite(p) || p < r.min || p > r.max) throw "badInput";
        faults[id] = n;
        pts[id] = p;
        clean3[id] = n * p;
      } else if (id in a) {
        const v = a[id];
        if (v === null || v === "" || v === void 0) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > Math.max(r.max, 0) * 2 + 10) throw "badInput";
        if (n > 0) {
          clean3[id] = n;
          faults[id] = 1;
          pts[id] = n;
        }
      }
    }
  } else {
    for (const [id, v] of Object.entries(a)) {
      const it2 = items.get(id);
      if (!it2) throw "badInput";
      if (v === null || v === "" || v === void 0) continue;
      if (sheet.mode === "passfail") {
        if (!["P", "F", "NA"].includes(v)) throw "badInput";
        clean3[id] = v;
      } else if (sheet.mode === "rating") {
        if (v === "NA") clean3[id] = "NA";
        else if (Number.isInteger(v) && v >= 1 && v <= 5) clean3[id] = v;
        else throw "badInput";
      }
    }
  }
  const disq = [...new Set(data?.disq || [])].filter((id) => (sheet.disq || []).some((d) => d.id === id));
  const header = {};
  for (const f of sheet.headerFields || []) header[f.id] = String(data?.header?.[f.id] ?? "").slice(0, 120);
  const tc = timeCalc(sheet, header);
  for (const f of sheet.headerFields || []) {
    if (f.type === "duration") header[f.id] = tc.duration === null ? "" : fmtMin(tc.duration);
    if (f.type === "excess") header[f.id] = tc.excess === null ? "" : fmtMin(tc.excess);
  }
  const out3 = { done: !!data?.done, answers: clean3, disq, header, timePenalty: Math.max(0, Math.min(999, data?.timePenalty === void 0 || data?.timePenalty === null || data?.timePenalty === "" ? sheet.timePenalty ? suggestTimePenalty(sheet, header) : 0 : Number(data.timePenalty) || 0)), comments: String(data?.comments ?? "").slice(0, 2e3) };
  if (sheet.mode === "penalty") {
    out3.faults = faults;
    out3.pts = pts;
  }
  return out3;
}
__name(validateSheetData, "validateSheetData");
function computeOutcome(enr, session, opts = {}) {
  if (!enr?.att) return { outcome: "ABSENT", reason: "absent" };
  if (session?.sheetId) {
    if (!enr.prac || enr.prac.result === "INCOMPLETE") return { outcome: "PENDING_PRACTICAL" };
    if (enr.prac.result === "FAIL") return { outcome: "FAIL", reason: "practical" };
  }
  if (enr.exam?.passed === false) return { outcome: "FAIL", reason: "exam" };
  if (enr.exam?.passed === true) return opts.fbRequired && !enr.fb ? { outcome: "PENDING_FEEDBACK" } : { outcome: "PASS" };
  return { outcome: "PENDING_EXAM" };
}
__name(computeOutcome, "computeOutcome");
var FB_GROUPS = ["g1", "g2", "g3", "g4", "g6"];
var DASH_TILES = ["issued", "passRate", "expiring", "trained", "passed", "ongoing", "ready", "soon", "expired"];
var DEFAULT_DASH = { expDays: 90, tiles: ["issued", "passRate", "expiring", "ongoing", "ready", "expired"], top: 8, period: "month" };
function dashCfg(st) {
  const d = st?.dash || {};
  return {
    expDays: Number.isInteger(d.expDays) && d.expDays >= 1 && d.expDays <= 730 ? d.expDays : DEFAULT_DASH.expDays,
    tiles: Array.isArray(d.tiles) ? d.tiles.filter((k) => DASH_TILES.includes(k)) : DEFAULT_DASH.tiles,
    top: [5, 8, 10, 15, 20].includes(d.top) ? d.top : DEFAULT_DASH.top,
    period: ["month", "lastMonth", "year"].includes(d.period) ? d.period : DEFAULT_DASH.period
  };
}
__name(dashCfg, "dashCfg");
function periodRange(p, today) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), last = /* @__PURE__ */ __name((yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate(), "last");
  const mon = /* @__PURE__ */ __name((yy, mm) => [`${yy}-${pad(mm)}-01`, `${yy}-${pad(mm)}-${pad(last(yy, mm))}`], "mon");
  if (p === "year") return [`${y}-01-01`, `${y}-12-31`];
  if (p === "lastMonth") return m === 1 ? mon(y - 1, 12) : mon(y, m - 1);
  if (/^\d{4}-\d{2}$/.test(p || "")) return mon(Number(p.slice(0, 4)), Number(p.slice(5)));
  return mon(y, m);
}
__name(periodRange, "periodRange");
var parseFilter = /* @__PURE__ */ __name((tok) => Object.fromEntries(String(tok || "").split("~").filter((x) => x.includes("=")).map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)])), "parseFilter");
var buildFilter = /* @__PURE__ */ __name((o) => Object.entries(o).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => `${k}=${v}`).join("~"), "buildFilter");
var slug = /* @__PURE__ */ __name((s) => transliterateAzToEn(s).toLowerCase().replace(/[^a-z0-9]+/g, ""), "slug");
var uniq = /* @__PURE__ */ __name((a) => [...new Set(a)], "uniq");
var LOGIN_FOLD = { \u0259: "a", \u018F: "a", \u015F: "sh", \u015E: "sh", \u00E7: "ch", \u00C7: "ch", \u011F: "gh", \u011E: "gh", \u0131: "i", I: "i", \u0130: "i", \u00F6: "o", \u00D6: "o", \u00FC: "u", \u00DC: "u" };
var loginSlug = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[əƏşŞçÇğĞıIİöÖüÜ]/g, (c) => LOGIN_FOLD[c]).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""), "loginSlug");
var isPrivateCompany = /* @__PURE__ */ __name((name, id) => !id || /^(private|fərdi|ferdi|individual)$/i.test(String(name || "").trim()), "isPrivateCompany");
var DOH_Q = [
  ["epilepsy", "Epilepsi", "Epilepsy", "\u042D\u043F\u0438\u043B\u0435\u043F\u0441\u0438\u044F"],
  ["heart", "\xDCr\u0259k tutmas\u0131", "Heart attack", "\u0418\u043D\u0444\u0430\u0440\u043A\u0442"],
  ["angina", "Angina", "Angina", "\u0421\u0442\u0435\u043D\u043E\u043A\u0430\u0440\u0434\u0438\u044F"],
  ["breath", "N\u0259f\u0259s \xE7atmazl\u0131\u011F\u0131 v\u0259 ya n\u0259f\u0259s alark\u0259n \xE7\u0259tinlik", "Shortness of breath or difficulty with breathing", "\u041E\u0434\u044B\u0448\u043A\u0430 \u0438\u043B\u0438 \u0437\u0430\u0442\u0440\u0443\u0434\u043D\u0451\u043D\u043D\u043E\u0435 \u0434\u044B\u0445\u0430\u043D\u0438\u0435"],
  ["diabetes", "Diabet", "Diabetes", "\u0414\u0438\u0430\u0431\u0435\u0442"],
  ["hearing", "E\u015Fitm\u0259 x\u0259sar\u0131", "Hearing impairment", "\u041D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0435 \u0441\u043B\u0443\u0445\u0430"],
  ["vision", "Optik k\xF6m\u0259k il\u0259 d\xFCz\u0259ldil\u0259 bilm\u0259y\u0259n g\xF6rm\u0259 x\u0259sar\u0131", "Visual impairment not correctable by optical aids", "\u041D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0435 \u0437\u0440\u0435\u043D\u0438\u044F, \u043D\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u0443\u0435\u043C\u043E\u0435 \u043E\u043F\u0442\u0438\u043A\u043E\u0439"],
  ["mental", "H\u0259r hans\u0131 \u0259qli v\u0259 ya psixoloji narahatl\u0131q", "Any mental or psychological disorders", "\u041B\u044E\u0431\u044B\u0435 \u043F\u0441\u0438\u0445\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438\u043B\u0438 \u043F\u0441\u0438\u0445\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0430\u0441\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430"],
  ["medical", "Avadanl\u0131qlardan istifad\u0259 v\u0259 ya sinif f\u0259aliyy\u0259tin\u0259 qo\u015Fulman\u0131za mane\u0259 olan h\u0259r hans\u0131 bir tibbi s\u0259b\u0259biniz varm\u0131?", "Is there any medical reason you are aware of that may impair your ability to operate the equipment or to take part in classroom activities?", "\u0415\u0441\u0442\u044C \u043B\u0438 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u0432\u0430\u043C \u043C\u0435\u0434\u0438\u0446\u0438\u043D\u0441\u043A\u0438\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0433\u0443\u0442 \u043F\u043E\u043C\u0435\u0448\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0435 \u0441 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u0442\u0438\u044E \u0432 \u0437\u0430\u043D\u044F\u0442\u0438\u044F\u0445?"],
  ["medication", "H\u0259r hans\u0131 bir d\u0259rman vasit\u0259sind\u0259n istifad\u0259 edirsinizmi?", "Are you currently taking any prescribed or non-prescribed medication?", "\u041F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442\u0435 \u043B\u0438 \u0432\u044B \u0441\u0435\u0439\u0447\u0430\u0441 \u043A\u0430\u043A\u0438\u0435-\u043B\u0438\u0431\u043E \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0430 (\u043F\u043E \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044E \u0438\u043B\u0438 \u0431\u0435\u0437)?"]
];
var goodQImg = /* @__PURE__ */ __name((v) => typeof v === "string" && /^[a-f0-9]{16}\.(webp|jpg|png)$/.test(v), "goodQImg");
var qImgUrl = /* @__PURE__ */ __name((k) => "/api/qimg/" + k, "qImgUrl");
var dohYes = /* @__PURE__ */ __name((d) => !!d && !d.paper && DOH_Q.some(([k]) => d.answers?.[k] === "Y"), "dohYes");
function testScore(qs, answers = {}, marks = {}) {
  let score = 0, max = 0, open = 0, pending = 0;
  for (const q2 of qs || []) {
    const pts = q2.points || 1;
    max += pts;
    if (q2.kind === "open") {
      open++;
      const m = marks[q2.id];
      if (m === void 0 || m === null || m === "") pending++;
      else score += Math.max(0, Math.min(pts, Number(m) || 0));
    } else if (answers[q2.id] === q2.correct) score += pts;
  }
  return { score, max, open, pending, pct: max ? Math.round(score / max * 1e3) / 10 : 0 };
}
__name(testScore, "testScore");
function parseQuestions(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n"), out3 = [], errors = [];
  let cur = null;
  const flush = /* @__PURE__ */ __name(() => {
    if (!cur) return;
    const q2 = cur;
    cur = null;
    if (!q2.text) return;
    if (!q2.options.length) out3.push({ kind: "open", text: q2.text, points: 1 });
    else {
      if (q2.correct < 0 || q2.correct >= q2.options.length) errors.push(q2.line);
      out3.push({ kind: "mc", text: q2.text, options: q2.options, correct: q2.correct, points: 1 });
    }
  }, "flush");
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l) {
      flush();
      return;
    }
    const ans = /^(answer|correct|cavab|düzgün cavab|duzgun cavab|doğru cavab)\s*[:\-]\s*([A-Ja-j])\b/i.exec(l);
    if (ans && cur) {
      cur.correct = ans[2].toUpperCase().charCodeAt(0) - 65;
      return;
    }
    const opt = /^(\*?)\s*([A-Ja-j])\s*[).:]\s*(.+?)\s*(\*?)$/.exec(l);
    if (opt && cur && (cur.options.length || /[?:.]$|\S/.test(cur.text)) && opt[2].toUpperCase().charCodeAt(0) - 65 === cur.options.length) {
      if (opt[1] || opt[4]) cur.correct = cur.options.length;
      cur.options.push(opt[3].replace(/\s*\*$/, ""));
      return;
    }
    const num2 = /^(?:sual\s*)?(\d{1,3})\s*[).:-]\s*(.+)$/i.exec(l);
    if (num2 || !cur || cur.options.length) {
      flush();
      cur = { text: (num2 ? num2[2] : l).trim(), options: [], correct: -1, line: i + 1 };
      return;
    }
    cur.text += " " + l;
  });
  flush();
  return { questions: out3, errors };
}
__name(parseQuestions, "parseQuestions");
function questionsFromRows(rows) {
  const out3 = [], errors = [];
  (rows || []).slice(1).forEach((r, i) => {
    const text = String(r[0] ?? "").trim();
    if (!text) return;
    const options = r.slice(2, 8).map((x) => String(x ?? "").trim()).filter(Boolean), open = /open|açıq|aciq/i.test(String(r[1] ?? "")) || !options.length;
    const points = Math.min(100, Math.max(1, parseInt(r[9], 10) || 1));
    if (open) return out3.push({ kind: "open", text, points });
    const c = String(r[8] ?? "").trim().toUpperCase(), correct = /^[A-F]$/.test(c) ? c.charCodeAt(0) - 65 : /^\d$/.test(c) ? Number(c) - 1 : -1;
    if (correct < 0 || correct >= options.length) errors.push(i + 2);
    out3.push({ kind: "mc", text, options, correct, points });
  });
  return { questions: out3, errors };
}
__name(questionsFromRows, "questionsFromRows");
var optList = /* @__PURE__ */ __name((q2) => (q2?.options || []).map((o, k) => o && typeof o === "object" ? o : { id: k, text: String(o ?? "") }), "optList");
var optText = /* @__PURE__ */ __name((q2, id) => optList(q2).find((o) => o.id === id)?.text, "optText");
var keepOrder = /* @__PURE__ */ __name((q2) => optList(q2).some((o) => /hamısı|hamisi|heç biri|hec biri|\b[A-F]\s*(və|ve|and|и)\s*[A-F]\b|all of the above|none of the above|both|все (перечисленные|вышеперечисленное)|ни один/i.test(o.text)), "keepOrder");
var usable = /* @__PURE__ */ __name((x) => !!x && !x.draft && (x.status || "active") === "active", "usable");
var APPROVAL_KINDS = ["tests", "materials", "certs"];
var approvalsCfg = /* @__PURE__ */ __name((st) => Object.fromEntries(APPROVAL_KINDS.map((k) => [k, !!st?.approvals?.[k]])), "approvalsCfg");
var mayPublish = /* @__PURE__ */ __name((user, st, what) => user?.kind === "staff" && (RANK[user.role] >= RANK.admin && !ROLE_ONLY[user.role] || user.role === "editor" && !approvalsCfg(st)[what]), "mayPublish");
var certDelivered = /* @__PURE__ */ __name((x) => !x?.approval || x.approval.status === "approved", "certDelivered");

// _lib/shapes.js
var SHAPES = {
  trainees: { key: "id", req: { att: "string" } },
  trainers: { key: "id", req: { name: "string", login: "string" } },
  companies: { key: "id", req: { name: "string", login: "string" } },
  staff: { req: { email: "string", role: "string" } },
  logins: { req: { login: "string" } },
  sessions: { key: "id", req: { bid: "string", date: "string" }, date: ["date", "endDate"] },
  enr: { req: { sid: "string", tid: "string" } },
  certs: { key: "no", req: { no: "string", tid: "string", bid: "string", start: "string", snap: "object" }, date: ["start", "end", "expiry"] },
  blanks: { key: "id", req: { name: "string" } },
  sheets: { key: "id", req: { name: "string" } },
  tests: { key: "id", req: { title: "string", questions: "array" } },
  groups: { key: "id", req: { name: "string" } },
  cogroups: { key: "id", req: { co: "string", name: "string", ids: "array" } },
  requests: { key: "id", req: { co: "string", status: "string" } },
  candreq: { key: "id", req: { co: "string", status: "string" } },
  signs: { key: "id", req: { doc: "string", role: "string", hash: "string" } },
  audit: { req: { action: "string", at: "string" } },
  notes: { req: { to: "string", k: "string", at: "string" } },
  threads: { key: "id", req: { kind: "string", acc: "string" } },
  msgs: { key: "id", req: { th: "string", from: "string", text: "string" } },
  libdocs: { key: "id", req: { title: "string", key: "string" } },
  materials: { key: "id", req: { title: "string" } },
  links: { key: "id", req: { status: "string" } },
  errlog: { req: { at: "string", path: "string" } }
};
var TABLES = [...Object.keys(SHAPES), "archive", "retired", "rel", "fins", "settings", "kb", "sigs", "cams", "snaps", "nseen", "claims", "importres", "aireport"];
function repairRecord(col, id, data) {
  if (col === "enr" && data && typeof data === "object" && !data.tid && typeof id === "string" && id.includes("|")) return { ...data, tid: id.slice(id.lastIndexOf("|") + 1) };
  return data;
}
__name(repairRecord, "repairRecord");

// _lib/store.js
var H = class extends Error {
  static {
    __name(this, "H");
  }
  constructor(status, msg, extra) {
    super(msg);
    this.status = status;
    this.extra = extra;
  }
};
var q = encodeURIComponent;
var ID_COLS = /* @__PURE__ */ new Set(["trainees", "trainers", "companies", "sessions", "blanks", "sheets", "tests", "groups", "materials", "requests", "cams", "sigs", "snaps"]);
var withId = /* @__PURE__ */ __name((col, id, data) => fill(col, id, repairRecord(col, id, data)), "withId");
var fill = /* @__PURE__ */ __name((col, id, data) => ID_COLS.has(col) && data && typeof data === "object" && (data.id === void 0 || data.id === null || data.id === "") ? { ...data, id } : data, "fill");
function supabaseStore(env2) {
  let rpcIn = null;
  const K = env2.SUPABASE_SERVICE_KEY;
  const A = K.startsWith("sb_") ? { apikey: K } : { apikey: K, authorization: "Bearer " + K };
  const call2 = /* @__PURE__ */ __name(async (path2, o = {}) => {
    const r = await fetch(env2.SUPABASE_URL + "/rest/v1/" + path2, { ...o, headers: { ...A, "content-type": "application/json", ...o.headers } });
    const t = await r.text();
    if (!r.ok && /"23514"/.test(t)) throw new H(422, "badRecord", { detail: t.slice(0, 300) });
    if (!r.ok) {
      const e = new Error("db " + r.status + " " + t);
      e.status = r.status;
      e.body = t;
      throw e;
    }
    return t ? JSON.parse(t) : null;
  }, "call");
  const callN = /* @__PURE__ */ __name(async (path2) => {
    const r = await fetch(env2.SUPABASE_URL + "/rest/v1/" + path2, { headers: { ...A, prefer: "count=exact" } });
    const t = await r.text();
    if (!r.ok) {
      const e = new Error("db " + r.status + " " + t);
      e.status = r.status;
      e.body = t;
      throw e;
    }
    const total2 = Number((r.headers.get("content-range") || "").split("/")[1]);
    return { rows: t ? JSON.parse(t) : [], total: Number.isFinite(total2) ? total2 : null };
  }, "callN");
  const PAGE = 1e3;
  const page = /* @__PURE__ */ __name(async (filter, select = "col,id,data", order = "id") => {
    const base = `records?${filter}&select=${select}&order=${order}`, map = /* @__PURE__ */ __name((p) => p.map((r) => ({ id: r.id, data: withId(r.col, r.id, r.data) })), "map");
    const first = await callN(`${base}&limit=${PAGE}&offset=0`), out3 = map(first.rows);
    if (first.rows.length < PAGE) return out3;
    const n = first.total ?? Infinity, offs = [];
    for (let o = PAGE; o < n && offs.length < 1e3; o += PAGE) offs.push(o);
    if (!Number.isFinite(n)) {
      for (let o = PAGE; ; o += PAGE) {
        const p = await call2(`${base}&limit=${PAGE}&offset=${o}`);
        out3.push(...map(p));
        if (p.length < PAGE) return out3;
      }
    }
    for (let i = 0; i < offs.length; i += 6) for (const p of await Promise.all(offs.slice(i, i + 6).map((o) => call2(`${base}&limit=${PAGE}&offset=${o}`)))) out3.push(...map(p));
    return out3;
  }, "page");
  const path = /* @__PURE__ */ __name((f) => {
    if (f === "id") return "id";
    const p = String(f).split(".");
    return "data" + p.slice(0, -1).map((k) => "->" + k).join("") + "->>" + p.at(-1);
  }, "path");
  const lit = /* @__PURE__ */ __name((v) => {
    const x = String(v);
    return /[,()"\\:]/.test(x) ? '"' + x.replace(/["\\]/g, (m) => "\\" + m) + '"' : x;
  }, "lit");
  function filterOf(col, spec = {}) {
    const f = [`col=eq.${q(col)}`], ors = [];
    for (const [k, op, v] of spec.where || []) {
      if (op === "nn") {
        ors.push(`or(${path(k)}.is.null,${path(k)}.neq.${lit(v)})`);
        continue;
      }
      if (op === "empty") {
        ors.push(v ? `or(${path(k)}.is.null,${path(k)}.eq.)` : `and(${path(k)}.not.is.null,${path(k)}.neq.)`);
        continue;
      }
      if (op === "has") {
        f.push(`data=cs.${q(JSON.stringify({ [k]: [v] }))}`);
        continue;
      }
      if (op === "null") {
        f.push(`${path(k)}=${v ? "is.null" : "not.is.null"}`);
        continue;
      }
      if (op === "in") {
        f.push(`${path(k)}=in.(${q(v.map(lit).join(","))})`);
        continue;
      }
      const o = { eq: "eq", ne: "neq", gt: "gt", gte: "gte", lt: "lt", lte: "lte" }[op];
      if (!o) throw new Error("bad op " + op);
      f.push(`${path(k)}=${o}.${q(String(v))}`);
    }
    for (const w of searchWords(spec.search)) f.push(`data->>sk=ilike.${q("*" + w + "*")}`);
    if (ors.length) f.push("and=" + q("(" + ors.join(",") + ")"));
    return f.join("&");
  }
  __name(filterOf, "filterOf");
  return {
    A,
    call: call2,
    all: /* @__PURE__ */ __name((col) => page(`col=eq.${col}`), "all"),
    async get(col, id) {
      return withId(col, id, (await call2(`records?col=eq.${col}&id=eq.${q(id)}&select=data`))[0]?.data);
    },
    /* several records of one collection in one query (ids quoted for PostgREST, 80 per request to keep URLs short) */
    // many ids at once: one call to records_in (schema.sql); chunked "in" queries if that function is not installed yet
    async getMany(col, ids) {
      return (await this.inList(col, "id", ids)).map((r) => ({ id: r.id, data: withId(col, r.id, r.data) }));
    },
    async inList(col, field, vals, fields) {
      const u = [...new Set(vals.map(String))], out3 = [];
      if (rpcIn !== false) try {
        for (let i = 0; i < u.length; i += 5e3) out3.push(...await call2("rpc/records_in", { method: "POST", body: JSON.stringify({ p_col: col, p_field: field, p_vals: u.slice(i, i + 5e3), p_fields: fields || null }) }));
        rpcIn = true;
        return out3.map((r) => ({ id: r.id, data: withId(col, r.id, r.data) }));
      } catch (e) {
        if (!(e.status === 404 || /records_in/.test(e.body || ""))) throw e;
        rpcIn = false;
        out3.length = 0;
      }
      for (let i = 0; i < u.length; i += 60 * 6) out3.push(...(await Promise.all(Array.from({ length: Math.ceil(Math.min(360, u.length - i) / 60) }, (_, k) => this.query(col, { where: [[field, "in", u.slice(i + k * 60, i + k * 60 + 60)]], fields }).then((r) => r.rows)))).flat());
      return out3;
    },
    byField: /* @__PURE__ */ __name((col, f, v) => page(`col=eq.${col}&data->>${f}=eq.${q(v)}`), "byField"),
    async query(col, spec = {}) {
      const sel = spec.fields ? "col,id," + spec.fields.map((k) => `${k}:data->${k}`).join(",") : "col,id,data";
      const [ok, dir3] = spec.order || ["id", "asc"], d = dir3 === "desc" ? "desc" : "asc", order = ok === "id" ? "id." + d : `${path(ok)}.${d}.nullslast,id.${d}`;
      const fl = filterOf(col, spec), shape = /* @__PURE__ */ __name((r) => withId(col, r.id, spec.fields ? Object.fromEntries(spec.fields.filter((k) => r[k] !== null && r[k] !== void 0).map((k) => [k, r[k]])) : r.data), "shape");
      if (spec.limit === void 0) {
        const base2 = `records?${fl}&select=${sel}&order=${order}`, first = await callN(`${base2}&limit=${PAGE}&offset=0`), out3 = [...first.rows];
        if (first.rows.length === PAGE) {
          const offs = [];
          for (let o = PAGE; o < (first.total ?? 0); o += PAGE) offs.push(o);
          for (let i = 0; i < offs.length; i += 6) for (const p of await Promise.all(offs.slice(i, i + 6).map((o) => call2(`${base2}&limit=${PAGE}&offset=${o}`)))) out3.push(...p);
        }
        return { rows: out3.map((r) => ({ id: r.id, data: shape(r) })), total: out3.length };
      }
      const base = `records?${fl}&select=${sel}&order=${order}&limit=${Math.max(0, Math.min(spec.limit, PAGE))}&offset=${spec.offset || 0}`;
      const res = spec.count ? await callN(base) : { rows: await call2(base), total: null };
      return { rows: res.rows.map((r) => ({ id: r.id, data: shape(r) })), total: res.total };
    },
    prefix: /* @__PURE__ */ __name((col, p) => page(`col=eq.${col}&id=like.${q(p)}*`), "prefix"),
    async put(col, rows) {
      for (let i = 0; i < rows.length; i += 500)
        await call2("records?on_conflict=col,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500).map((r) => ({ col, id: r.id, data: r.data }))) });
    },
    /* Plain INSERT: fails with 409 when the id already exists (used for numbers that must stay unique). */
    async insert(col, id, data) {
      try {
        await call2("records", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ col, id, data }) });
      } catch (e) {
        if (e.status === 409 || /23505/.test(e.body || "")) throw new H(409, "dup");
        throw e;
      }
    },
    del: /* @__PURE__ */ __name((col, id) => call2(`records?col=eq.${col}&id=eq.${q(id)}`, { method: "DELETE" }), "del"),
    /* Deletes many ids with one request per 40 ids (the Worker has a small sub-request budget). */
    async delMany(col, ids) {
      ids = [...ids];
      let batch = [], len = 0;
      const flush = /* @__PURE__ */ __name(async () => {
        if (!batch.length) return;
        const list2 = "(" + batch.join(",") + ")";
        batch = [];
        len = 0;
        await call2(`records?col=eq.${col}&id=in.${q(list2)}`, { method: "DELETE" });
      }, "flush");
      for (const x of ids) {
        const v = '"' + String(x).replace(/([\\"])/g, "\\$1") + '"';
        if (len + q(v).length + 3 > 6e3) await flush();
        batch.push(v);
        len += q(v).length + 3;
      }
      await flush();
    },
    delCol: /* @__PURE__ */ __name((col) => call2(`records?col=eq.${col}`, { method: "DELETE" }), "delCol"),
    seq: /* @__PURE__ */ __name((n) => call2("rpc/next_seq", { method: "POST", body: JSON.stringify({ n }) }), "seq"),
    async peek(n) {
      return (await call2(`counters?name=eq.${q(n)}&select=val`))[0]?.val ?? 0;
    },
    bump: /* @__PURE__ */ __name((n, v) => call2("rpc/bump_seq", { method: "POST", body: JSON.stringify({ n, v }) }), "bump"),
    counters: /* @__PURE__ */ __name(() => call2("counters?select=name,val"), "counters"),
    /* k numbers at once; returns the first of them */
    async seqN(n, k) {
      const last = Number(await call2("rpc/next_seq_n", { method: "POST", body: JSON.stringify({ n, k }) }));
      return last - k + 1;
    },
    /* INSERT many rows, skipping ids that already exist; returns the ids that were actually inserted. */
    async insertMany(col, rows) {
      const out3 = [];
      for (let i = 0; i < rows.length; i += 500) {
        const r = await call2("records?on_conflict=col,id&select=id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows.slice(i, i + 500).map((r2) => ({ col, id: r2.id, data: r2.data }))) });
        out3.push(...(r || []).map((x) => x.id));
      }
      return out3;
    },
    /* login throttling, atomic in the database */
    lockState: /* @__PURE__ */ __name(async (k) => {
      const v = await call2("rpc/login_state", { method: "POST", body: JSON.stringify({ k }) });
      return v ? Date.parse(v) : 0;
    }, "lockState"),
    lockFail: /* @__PURE__ */ __name(async (k, max, secs) => {
      const v = await call2("rpc/login_fail", { method: "POST", body: JSON.stringify({ k, max_fails: max, lock_secs: secs }) });
      return v ? Date.parse(v) : 0;
    }, "lockFail"),
    lockOk: /* @__PURE__ */ __name((k) => call2("rpc/login_ok", { method: "POST", body: JSON.stringify({ k }) }), "lockOk"),
    /* all-or-nothing restore: stage the rows, then swap them in with one database transaction */
    async restore(cols, data, ctrs) {
      await call2("records_restore?col=neq.__none__", { method: "DELETE" });
      for (const col of cols) {
        const rows = (data[col] || []).map((x) => ({ col, id: x.id, data: repairRecord(col, x.id, x.data) }));
        for (let i = 0; i < rows.length; i += 500) await call2("records_restore", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
      }
      return call2("rpc/apply_restore", { method: "POST", body: JSON.stringify({ cols, ctrs: ctrs || [] }) });
    },
    setCounters: /* @__PURE__ */ __name((rows) => call2("counters?on_conflict=name", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }), "setCounters")
  };
}
__name(supabaseStore, "supabaseStore");
var searchWords = /* @__PURE__ */ __name((s) => foldText(s).split(/\s+/).map((w) => w.replace(/[,()"*\\%_:]/g, "")).filter(Boolean).slice(0, 6), "searchWords");

// _lib/auth.js
var enc = new TextEncoder();
var hex = /* @__PURE__ */ __name((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""), "hex");
var unhex = /* @__PURE__ */ __name((h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16))), "unhex");
var rnd = /* @__PURE__ */ __name((n) => hex(crypto.getRandomValues(new Uint8Array(n))), "rnd");
var sha = /* @__PURE__ */ __name(async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s))), "sha");
var pbk = /* @__PURE__ */ __name(async (p, salt) => hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unhex(salt), iterations: 1e5, hash: "SHA-256" }, await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]), 256)), "pbk");
var hmac = /* @__PURE__ */ __name(async (secret, msg) => {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}, "hmac");
var ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function candidatePassword() {
  const U = "ABCDEFGHJKMNPQRSTUVWXYZ", L = "abcdefghjkmnpqrstuvwxyz", r = crypto.getRandomValues(new Uint32Array(3));
  return U[r[0] % U.length] + L[r[1] % L.length] + U[r[2] % U.length] + "12345";
}
__name(candidatePassword, "candidatePassword");
function genPassword(n = 8) {
  const out3 = [];
  const buf = crypto.getRandomValues(new Uint8Array(n * 4));
  for (const b of buf) {
    if (b < 256 - 256 % ALPHA.length) out3.push(ALPHA[b % ALPHA.length]);
    if (out3.length === n) break;
  }
  return out3.join("");
}
__name(genPassword, "genPassword");
function same(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(same, "same");
var TTL = 12 * 36e5;
async function mkTok(env2, p, ttl = TTL) {
  const b = btoa(JSON.stringify({ ...p, exp: Date.now() + ttl }));
  return b + "." + await hmac(env2.TOKEN_SECRET, b);
}
__name(mkTok, "mkTok");
async function readTok(env2, token) {
  const [b, s] = String(token || "").split(".");
  if (!b || !s || !same(await hmac(env2.TOKEN_SECRET, b), s)) throw new H(401, "auth");
  let p;
  try {
    p = JSON.parse(atob(b));
  } catch {
    throw new H(401, "auth");
  }
  if (!(p.exp > Date.now())) throw new H(401, "auth");
  return p;
}
__name(readTok, "readTok");
var bearer = /* @__PURE__ */ __name((r) => (r.headers.get("authorization") || "").slice(7), "bearer");
var loginKey = /* @__PURE__ */ __name((role, login) => `${role}:${String(login).trim().toLowerCase()}`, "loginKey");
async function claimLogin(D, role, wanted, accountId) {
  const base = String(wanted).trim().replace(/[^A-Za-z0-9._-]/g, "") || role;
  for (let i = 0; i < 40; i++) {
    const login = i === 0 ? base : base + Math.floor(10 + Math.random() * 990);
    try {
      await D.insert("logins", loginKey(role, login), { login, id: accountId });
      return login;
    } catch (e) {
      if (!(e instanceof H) || e.message !== "dup") throw e;
    }
  }
  throw new H(500, "server");
}
__name(claimLogin, "claimLogin");
var LOCK = { account: 8, ip: 100, secs: 15 * 60 };
var ipOf = /* @__PURE__ */ __name((c) => (c.req?.headers?.get?.("cf-connecting-ip") || c.req?.headers?.get?.("x-forwarded-for") || "").split(",")[0].trim(), "ipOf");
function attemptKeys(c, key) {
  const ip = ipOf(c);
  return ip ? [[key, LOCK.account], ["ip:" + ip, LOCK.ip]] : [[key, LOCK.account]];
}
__name(attemptKeys, "attemptKeys");
async function attempt(c, keys) {
  for (const [k2] of keys) {
    const u2 = await c.D.lockState(k2);
    if (u2) throw new H(429, "locked", { until: new Date(u2).toISOString() });
  }
  const [k, max] = keys[0];
  const u = await c.D.lockFail(k, max + 1, LOCK.secs);
  if (u) throw new H(429, "locked", { until: new Date(u).toISOString() });
}
__name(attempt, "attempt");
async function attemptBad(c, keys) {
  for (const [k, max] of keys.slice(1)) await c.D.lockFail(k, max, LOCK.secs).catch(() => {
  });
}
__name(attemptBad, "attemptBad");
async function attemptOk(c, keys) {
  await c.D.lockOk(keys[0][0]);
}
__name(attemptOk, "attemptOk");
async function aesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("kvet-at-rest|" + secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(aesKey, "aesKey");
async function seal(secret, plain) {
  if (!plain) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return "enc:" + hex(iv) + "." + hex(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(plain)));
}
__name(seal, "seal");
async function unseal(secret, v) {
  if (!v || !String(v).startsWith("enc:")) return v || "";
  const [iv, ct] = String(v).slice(4).split(".");
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(iv) }, await aesKey(secret), unhex(ct)));
  } catch {
    return "";
  }
}
__name(unseal, "unseal");
var b64u = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), (ch) => ch.charCodeAt(0)), "b64u");
var jwtClaims = /* @__PURE__ */ __name((tok) => {
  try {
    return JSON.parse(new TextDecoder().decode(b64u(String(tok).split(".")[1])));
  } catch {
    return null;
  }
}, "jwtClaims");
var jwksCache = { at: 0, keys: [] };
async function jwks(base) {
  if (Date.now() - jwksCache.at < 6e5 && jwksCache.keys.length) return jwksCache.keys;
  try {
    const r = await fetch(base + "/auth/v1/.well-known/jwks.json");
    if (r.ok) jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  } catch {
  }
  return jwksCache.keys;
}
__name(jwks, "jwks");
async function verifyJwt(token, { base, secret }) {
  const [h, p, sg] = String(token || "").split(".");
  if (!h || !p || !sg) throw new H(401, "auth");
  let head;
  try {
    head = JSON.parse(new TextDecoder().decode(b64u(h)));
  } catch {
    throw new H(401, "auth");
  }
  const data = enc.encode(h + "." + p), sig = b64u(sg);
  let ok = (
    /** @type {any} */
    null
  );
  if (head.alg === "HS256") {
    if (!secret) return null;
    const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    ok = await crypto.subtle.verify("HMAC", k, sig, data);
  } else if (head.alg === "ES256" || head.alg === "RS256") {
    const jwk = (await jwks(base)).find((k) => k.kid === head.kid);
    if (!jwk) return null;
    const alg = head.alg === "ES256" ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, alg, false, ["verify"]);
    ok = await crypto.subtle.verify(head.alg === "ES256" ? { name: "ECDSA", hash: "SHA-256" } : alg, key, sig, data);
  } else return null;
  if (!ok) throw new H(401, "auth");
  const c = jwtClaims(token);
  if (!c || !(c.exp * 1e3 > Date.now())) throw new H(401, "auth");
  return c;
}
__name(verifyJwt, "verifyJwt");
function supabaseAuth(env2) {
  const base = env2.SUPABASE_URL, pub2 = { apikey: env2.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" };
  const srv = env2.SUPABASE_SERVICE_KEY.startsWith("sb_") ? { apikey: env2.SUPABASE_SERVICE_KEY } : { apikey: env2.SUPABASE_SERVICE_KEY, authorization: "Bearer " + env2.SUPABASE_SERVICE_KEY };
  const tokens = /* @__PURE__ */ __name((d) => ({ access: d.access_token, refresh: d.refresh_token, user: { id: d.user.id, email: d.user.email } }), "tokens");
  return {
    async login(email, password) {
      const r = await fetch(base + "/auth/v1/token?grant_type=password", { method: "POST", headers: pub2, body: JSON.stringify({ email, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new H(401, "badLogin");
      return tokens(d);
    },
    async refresh(refresh) {
      const r = await fetch(base + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: pub2, body: JSON.stringify({ refresh_token: refresh }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new H(401, "auth");
      return tokens(d);
    },
    /* { id, email, aal } from a valid access token: checked locally (JWKS / JWT secret) when possible, else by Supabase */
    async user(token) {
      const claims = await verifyJwt(token, { base, secret: env2.SUPABASE_JWT_SECRET });
      if (claims) return { id: claims.sub, email: claims.email, aal: claims.aal || "aal1" };
      const r = await fetch(base + "/auth/v1/user", { headers: { apikey: env2.SUPABASE_PUBLISHABLE_KEY, authorization: "Bearer " + token } });
      if (!r.ok) throw new H(401, "auth");
      const u = await r.json();
      return { id: u.id, email: u.email, aal: jwtClaims(token)?.aal || "aal1" };
    },
    /* ---- two-factor (TOTP) through Supabase Auth MFA ---- */
    async factors(token) {
      const r = await fetch(base + "/auth/v1/user", { headers: { apikey: env2.SUPABASE_PUBLISHABLE_KEY, authorization: "Bearer " + token } });
      if (!r.ok) throw new H(401, "auth");
      return ((await r.json()).factors || []).filter((f) => f.factor_type === "totp").map((f) => ({ id: f.id, status: f.status }));
    },
    async enroll(token) {
      const r = await fetch(base + "/auth/v1/factors", { method: "POST", headers: { ...pub2, authorization: "Bearer " + token }, body: JSON.stringify({ factor_type: "totp", friendly_name: "KVET " + Date.now() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new H(400, "mfaError");
      return { id: d.id, qr: d.totp?.qr_code || "", secret: d.totp?.secret || "", uri: d.totp?.uri || "" };
    },
    async verifyFactor(token, factorId, code) {
      const h = { ...pub2, authorization: "Bearer " + token }, f = encodeURIComponent(factorId);
      const ch = await fetch(base + "/auth/v1/factors/" + f + "/challenge", { method: "POST", headers: h, body: "{}" });
      const c = await ch.json().catch(() => ({}));
      if (!ch.ok) throw new H(400, "mfaError");
      const r = await fetch(base + "/auth/v1/factors/" + f + "/verify", { method: "POST", headers: h, body: JSON.stringify({ challenge_id: c.id, code: String(code) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new H(401, "badCode");
      return tokens(d);
    },
    async unenroll(token, factorId) {
      await fetch(base + "/auth/v1/factors/" + encodeURIComponent(factorId), { method: "DELETE", headers: { ...pub2, authorization: "Bearer " + token } });
    },
    async adminResetMfa(userId) {
      const r = await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(userId) + "/factors", { headers: srv });
      const list2 = r.ok ? await r.json() : [];
      for (const f of Array.isArray(list2) ? list2 : list2.factors || []) await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(userId) + "/factors/" + encodeURIComponent(f.id), { method: "DELETE", headers: srv });
    },
    /* A new staff sign-in. If Supabase already has an account with this e-mail (created earlier in the Supabase dashboard, by
       an old sign-up, or left over after a staff record was deleted), that account is reused: confirmed and given this password.
       Otherwise the staff record would point to nothing and the person could never sign in. */
    async createUser(email, password) {
      const r = await fetch(base + "/auth/v1/admin/users", { method: "POST", headers: { ...srv, "content-type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const id = d.id || d.user?.id;
        if (!id) throw new H(502, "authFailed");
        return { id };
      }
      const msg = String(d.msg || d.message || d.error_description || d.error_code || d.code || "");
      if (r.status === 422 && /exist|already|registered/i.test(msg)) {
        const old = await this.findByEmail(email);
        if (!old) throw new H(409, "userExists");
        const u = await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(old.id), { method: "PUT", headers: { ...srv, "content-type": "application/json" }, body: JSON.stringify({ password, email_confirm: true, ban_duration: "none" }) });
        if (!u.ok) throw new H(400, "weakPassword");
        return { id: old.id, reused: true };
      }
      if (/password/i.test(msg)) throw new H(400, "weakPassword");
      throw new H(400, "authFailed");
    },
    async findByEmail(email) {
      for (let page = 1; page <= 50; page++) {
        const r = await fetch(base + "/auth/v1/admin/users?page=" + page + "&per_page=200", { headers: srv });
        if (!r.ok) return null;
        const d = await r.json().catch(() => ({})), list2 = Array.isArray(d) ? d : d.users || [];
        const hit = list2.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
        if (hit) return hit;
        if (list2.length < 200) return null;
      }
      return null;
    },
    async setPassword(id, password) {
      const r = await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(id), { method: "PUT", headers: { ...srv, "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (!r.ok) throw new H(400, "badInput");
    },
    async deleteUser(id) {
      await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(id), { method: "DELETE", headers: srv });
    }
  };
}
__name(supabaseAuth, "supabaseAuth");

// _lib/core.js
var J = /* @__PURE__ */ __name((d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...h } }), "J");
var str = /* @__PURE__ */ __name((v, n = 200) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n), "str");
var bool = /* @__PURE__ */ __name((v) => v === true || v === "true" || v === 1, "bool");
var uid = /* @__PURE__ */ __name((p) => p + Date.now().toString(36) + rnd(2), "uid");
function num(v, lo, hi, d = null) {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
}
__name(num, "num");
var httpUrl = /* @__PURE__ */ __name((v) => {
  const s = str(v, 500);
  if (!s) return "";
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}, "httpUrl");
var enrId = /* @__PURE__ */ __name((sid, tid) => `${sid}|${tid}`, "enrId");
function need(cond, msg = "badInput", status = 400) {
  if (!cond) throw new H(status, msg);
}
__name(need, "need");
var MASK = /* @__PURE__ */ new Set(["fin", "hash", "salt", "password"]);
var short = /* @__PURE__ */ __name((v) => {
  if (v === void 0 || v === null || v === "") return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 120 ? s.slice(0, 117) + "\u2026" : s;
}, "short");
function diff(before, after, fields) {
  const out3 = [];
  for (const f of fields || Object.keys(after || {})) {
    const a = before?.[f], b = after?.[f];
    if (JSON.stringify(a ?? "") === JSON.stringify(b ?? "")) continue;
    out3.push(MASK.has(f) ? { f, from: "", to: "(changed)" } : { f, from: short(a), to: short(b) });
  }
  return out3.slice(0, 30);
}
__name(diff, "diff");
async function audit(c, action, detail = "", extra = {}) {
  const by = extra.by || (c.user ? { id: c.user.id, name: c.user.email || c.user.name || c.user.id, role: c.user.role || c.user.kind } : { name: "system" });
  const at = new Date(c.now()).toISOString(), ip = c.req?.headers?.get?.("cf-connecting-ip") || c.req?.headers?.get?.("x-forwarded-for") || "";
  const row = { at, by, action, detail: String(detail).slice(0, 300) };
  if (ip) row.ip = String(ip).split(",")[0].trim().slice(0, 45);
  if (extra.entity) row.eid = String(extra.entity.id || "").slice(0, 100);
  if (extra.entity) row.entity = { kind: String(extra.entity.kind || "").slice(0, 20), id: String(extra.entity.id || "").slice(0, 100), label: String(extra.entity.label || "").slice(0, 120) };
  if (extra.changes?.length) row.changes = extra.changes;
  await c.D.put("audit", [{ id: at + "-" + rnd(3), data: row }]);
}
__name(audit, "audit");
var getSettings = /* @__PURE__ */ __name(async (D) => await D.get("settings", "main") || {}, "getSettings");
var DEFAULT_ACCRED = [1, 2, 3, 4, 5, 6, 7].map((i) => `default:${i}`);
var accredKeys = /* @__PURE__ */ __name((st) => Array.isArray(st.accred) ? st.accred : DEFAULT_ACCRED, "accredKeys");
var assetUrl = /* @__PURE__ */ __name((k) => !k ? "" : String(k).startsWith("default:") ? `/img/accred/accred-${Number(String(k).slice(8))}.png` : "/api/asset/" + k, "assetUrl");
async function assetsOut(D, st) {
  const sigs = (await D.all("sigs")).map((r) => r.data);
  const act = sigs.find((s) => s.on);
  return { logo: assetUrl(st.logo), stamp: assetUrl(st.stamp), accred: accredKeys(st).map(assetUrl), sig: act ? { id: act.id, img: assetUrl(act.key) } : null, sigs: sigs.map((s) => ({ ...s, img: assetUrl(s.key) })) };
}
__name(assetsOut, "assetsOut");
var remindCfg = /* @__PURE__ */ __name((st) => ({ on: !!st.remind?.on, days: (st.remind?.days || [90, 30]).filter((d) => Number.isInteger(d) && d > 0 && d <= 365).slice(0, 4), toCompany: st.remind?.toCompany !== false, toTrainee: st.remind?.toTrainee !== false }), "remindCfg");
var privacyCfg = /* @__PURE__ */ __name((st) => ({ consentRequired: !!st.privacy?.consentRequired, finYears: Number.isInteger(st.privacy?.finYears) ? st.privacy.finYears : 0 }), "privacyCfg");
var publicSettings = /* @__PURE__ */ __name((st) => ({
  company: st.company || {},
  num: numCfg(st),
  soonDays: st.soonDays ?? SOON_DAYS,
  showFather: !!st.showFather,
  dash: dashCfg(st),
  fbRequired: st.fbRequired !== false,
  certCompany: !!st.certCompany,
  mfa: st.mfa || "off",
  remind: remindCfg(st),
  privacy: privacyCfg(st),
  approvals: approvalsCfg(st)
}), "publicSettings");
var stripSecret = /* @__PURE__ */ __name(({ hash, salt, sk, ...x }) => x, "stripSecret");
function traineeOut(x, withFin) {
  const o = stripSecret(x);
  if (!withFin) delete o.fin;
  o.provisional = !!x.temp || !x.fin || !x.phone;
  return o;
}
__name(traineeOut, "traineeOut");
var trainerOut = /* @__PURE__ */ __name((x, withFin) => {
  const o = stripSecret(x);
  if (!withFin) delete o.fin;
  return o;
}, "trainerOut");
var personLite = /* @__PURE__ */ __name((x) => ({ id: x.id, att: x.att, name: x.name, surname: x.surname, father: x.father, nameEn: x.nameEn, surnameEn: x.surnameEn, fatherEn: x.fatherEn, foreign: !!x.foreign, co: x.co || "" }), "personLite");
async function enrOf(D, sid, tid) {
  return await D.get("enr", enrId(sid, tid)) || { sid, tid };
}
__name(enrOf, "enrOf");
var saveEnr = /* @__PURE__ */ __name((D, e) => D.put("enr", [{ id: enrId(e.sid, e.tid), data: e }]), "saveEnr");
async function enrsOfSession(D, s) {
  const rows = new Map((await D.prefix("enr", s.id + "|")).map((r) => [r.data.tid, r.data]));
  return (s.traineeIds || []).map((tid) => rows.get(tid) || { sid: s.id, tid });
}
__name(enrsOfSession, "enrsOfSession");
function statsOf(s, enrs) {
  const st = { total: (s.traineeIds || []).length, confirmed: 0, feedback: 0, evaluated: 0, practical: 0, finalized: 0, passed: 0, failed: 0 };
  for (const e of enrs) {
    if (e.att) st.confirmed++;
    if (e.fb) st.feedback++;
    if (e.ev) st.evaluated++;
    if (e.prac && e.prac.result !== "INCOMPLETE") st.practical++;
    if (e.final) {
      st.finalized++;
      if (e.final.outcome === "PASS") st.passed++;
      else st.failed++;
    }
  }
  return st;
}
__name(statsOf, "statsOf");
var RECENT_DAYS = 120;
var daysBefore = /* @__PURE__ */ __name((d, n) => new Date(Date.parse(d + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10), "daysBefore");
var ENR_LITE = ["sid", "tid", "att", "attBy", "fb", "ev", "prac", "final", "absent", "days", "doh", "exam"];
var chunks = /* @__PURE__ */ __name((a, n) => {
  const o = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
}, "chunks");
async function enrsFor(D, sids, fields = ENR_LITE) {
  const m = /* @__PURE__ */ new Map();
  if (!sids.length) return m;
  for (const e of await queryIn(D, "enr", "sid", sids, { fields })) {
    if (!m.has(e.sid)) m.set(e.sid, []);
    m.get(e.sid).push(e);
  }
  return m;
}
__name(enrsFor, "enrsFor");
async function queryIn(D, col, field, values, { fields, where = (
  /** @type {any[]} */
  []
) } = {}) {
  const u = [...new Set(values.filter(Boolean))];
  if (!u.length) return [];
  const f = fields && !fields.includes(field) && field !== "id" ? [...fields, field] : fields;
  const out3 = /* @__PURE__ */ __name((r) => field === "id" && r.data && r.data.id === void 0 ? { ...r.data, id: r.id } : r.data, "out");
  if (!where.length && D.inList) return (await D.inList(col, field, u, f)).map(out3);
  const parts = await Promise.all(chunks(u, 60).map((v) => D.query(col, { where: [[field, "in", v], ...where], fields: f })));
  return parts.flatMap((p) => p.rows.map(out3));
}
__name(queryIn, "queryIn");
async function getMany(D, col, ids) {
  const u = [...new Set(ids.filter(Boolean))];
  const v = await Promise.all(u.map((id) => D.get(col, id)));
  return new Map(
    /** @type {[string, any][]} */
    u.map((id, i) => [id, v[i]]).filter(([, x]) => x)
  );
}
__name(getMany, "getMany");
var sessionsOf = /* @__PURE__ */ __name(async (D, tid) => (await D.query("sessions", { where: [["traineeIds", "has", tid]] })).rows.map((r) => r.data), "sessionsOf");
var sessionRow = /* @__PURE__ */ __name((s, enrs, today) => {
  const stats = statsOf(s, enrs || []);
  return { ...s, stats, status: sessionStatus(s, stats, today) };
}, "sessionRow");
async function edgeCached(req, make) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    try {
      const hit = await cache.match(req);
      if (hit) return hit;
    } catch {
    }
  }
  const res = await make();
  if (cache && res.ok) {
    try {
      await cache.put(req, res.clone());
    } catch {
    }
  }
  return res;
}
__name(edgeCached, "edgeCached");
function buildSnap({ trainee, company, trainer, blank, st, session = (
  /** @type {any} */
  null
) }) {
  const coMode = session?.coMode || (st.certCompany ? "show" : "hide");
  return {
    names: certNames(trainee, !!st.showFather),
    foreign: !!trainee.foreign,
    att: trainee.att,
    lang: trainee.foreign && trainee.certLang === "en" ? "en" : "both",
    showCo: coMode === "show",
    coMode,
    coText: session?.coText || "",
    company: company && !isPrivateCompany(company.name, company.id) ? company.name : "",
    trainer: trainer ? fullEn(trainer, false) : "",
    details: session?.certDetails || "",
    reg: session?.certReg || "",
    blank: { ...Object.fromEntries(["name", "titleAz", "titleEn", "qualAz", "qualEn", "descAz", "descEn", "footAz", "footEn", "provider", "credits"].map((k) => [k, blank[k] ?? ""])), labels: cleanLabels(blank.labels) }
  };
}
__name(buildSnap, "buildSnap");

// _lib/ai.js
var PROVIDERS = {
  anthropic: { env: "ANTHROPIC_API_KEY", model: "claude-haiku-5-5" },
  gemini: { env: "GEMINI_API_KEY", model: "gemini-flash-latest", base: "https://generativelanguage.googleapis.com/v1beta/openai" },
  groq: { env: "GROQ_API_KEY", model: "llama-3.3-70b-versatile", base: "https://api.groq.com/openai/v1" },
  openrouter: { env: "OPENROUTER_API_KEY", model: "meta-llama/llama-3.3-70b-instruct:free", base: "https://openrouter.ai/api/v1" },
  openai: { env: "OPENAI_API_KEY", model: "" },
  workers: { env: "CF_AI_TOKEN", model: "@cf/google/gemma-4-26b-a4b-it" }
};
var AI_DEFAULTS = { on: false, provider: "gemini", models: {}, baseUrl: "", accountId: "", keys: {}, chat: true, reports: true, daily: 40 };
var aiCfg = /* @__PURE__ */ __name((st) => {
  const a = { ...AI_DEFAULTS, ...st?.ai || {} };
  a.models = { ...a.models || {} };
  if (st?.ai?.model && !a.models.anthropic) a.models.anthropic = st.ai.model;
  if (st?.ai?.workersModel && !a.models.workers) a.models.workers = st.ai.workersModel;
  if (!PROVIDERS[a.provider]) a.provider = "gemini";
  a.model = a.models[a.provider] || PROVIDERS[a.provider].model;
  return a;
}, "aiCfg");
var aiCfgPublic = /* @__PURE__ */ __name((st) => {
  const { keys, ...a } = aiCfg(st);
  return { ...a, keyHint: Object.fromEntries(Object.entries(keys || {}).filter(([, v]) => v?.v).map(([k, v]) => [k, v.tail || "\u2022\u2022\u2022\u2022"])) };
}, "aiCfgPublic");
var LANG_NAME = { az: "Azerbaijani", en: "English", ru: "Russian" };
async function aiKey(c, provider) {
  const sealed = aiCfg(c.settings).keys?.[provider]?.v;
  if (sealed) {
    const k = await unseal(c.env.TOKEN_SECRET, sealed);
    if (k) return k;
  }
  return c.env[PROVIDERS[provider].env] || "";
}
__name(aiKey, "aiKey");
var baseOf = /* @__PURE__ */ __name((cfg, p) => p === "openai" ? String(cfg.baseUrl || "").replace(/\/+$/, "") : PROVIDERS[p].base, "baseOf");
async function call(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    console.error("ai fetch", e?.message);
    throw new H(502, "aiFailed");
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    console.error("ai", res.status, body);
    throw new H(res.status === 429 ? 429 : 502, res.status === 429 ? "aiBusy" : res.status === 401 || res.status === 403 ? "aiBadKey" : "aiFailed");
  }
  return res.json();
}
__name(call, "call");
async function llm(c, { system, messages, max = 700 }) {
  if (typeof c.env.__llm === "function") return c.env.__llm({ system, messages, max });
  const cfg = aiCfg(c.settings), p = cfg.provider, model = cfg.model;
  if (p === "workers") {
    const msgs = { messages: [{ role: "system", content: system }, ...messages], max_tokens: max };
    if (c.env.AI?.run) {
      const r2 = await c.env.AI.run(model, msgs);
      return String(r2?.response ?? r2?.choices?.[0]?.message?.content ?? "").trim();
    }
    const tok = await aiKey(c, "workers");
    if (!tok || !cfg.accountId) throw new H(503, "aiNotConfigured");
    const d2 = await call(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/ai/run/${model}`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify(msgs) });
    const r = d2.result || {};
    return String(r.response ?? r.choices?.[0]?.message?.content ?? "").trim();
  }
  const key = await aiKey(c, p);
  if (!key) throw new H(503, "aiNotConfigured");
  if (p === "anthropic") {
    const d2 = await call("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: max, system, messages }) });
    return (d2.content || []).map((b) => b.text || "").join("").trim();
  }
  const base = baseOf(cfg, p);
  if (!base || !model) throw new H(503, "aiNotConfigured");
  const d = await call(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key, ...p === "openrouter" ? { "X-Title": "KVET Training" } : {} },
    body: JSON.stringify({ model, max_tokens: max, temperature: 0.2, messages: [{ role: "system", content: system }, ...messages] })
  });
  const m = d.choices?.[0]?.message?.content;
  return String(Array.isArray(m) ? m.map((x) => x.text || "").join("") : m || "").trim();
}
__name(llm, "llm");
async function listModels(c) {
  const cfg = aiCfg(c.settings), p = cfg.provider;
  if (p === "workers") {
    const tok = await aiKey(c, "workers");
    if (!tok || !cfg.accountId) return [];
    const d2 = await call(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/ai/models/search?task=Text%20Generation&per_page=100`, { headers: { authorization: "Bearer " + tok } });
    return (d2.result || []).map((m) => m.name).filter(Boolean).sort();
  }
  const key = await aiKey(c, p);
  if (!key) throw new H(503, "aiNotConfigured");
  if (p === "anthropic") {
    const d2 = await call("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
    return (d2.data || []).map((m) => m.id);
  }
  const base = baseOf(cfg, p);
  if (!base) throw new H(503, "aiNotConfigured");
  const d = await call(base + "/models", { headers: { authorization: "Bearer " + key } });
  let ids = (d.data || d.models || []).map((m) => String(m.id || m.name || "").replace(/^models\//, "")).filter(Boolean);
  if (p === "gemini") ids = ids.filter((id) => /gemini|gemma/.test(id) && !/embedding|image|tts|audio|live|veo|imagen/.test(id));
  if (p === "openrouter") ids.sort((a, b) => b.endsWith(":free") - a.endsWith(":free") || a.localeCompare(b));
  else ids.sort();
  return ids;
}
__name(listModels, "listModels");
var aiReady = /* @__PURE__ */ __name(async (c) => {
  if (typeof c.env.__llm === "function") return true;
  const cfg = aiCfg(c.settings), p = cfg.provider;
  if (p === "workers") return !!c.env.AI?.run || !!cfg.accountId && !!await aiKey(c, "workers");
  if (p === "openai" && !cfg.baseUrl) return false;
  return !!await aiKey(c, p);
}, "aiReady");
var FOLD = { \u0259: "e", \u0131: "i", \u015F: "s", \u00E7: "c", \u011F: "g", \u00F6: "o", \u00FC: "u", \u0451: "\u0435" };
function terms(text) {
  return String(text || "").toLowerCase().replace(/[əışçğöüё]/g, (ch) => FOLD[ch]).normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9Ѐ-ӿ]+/).filter((w) => w.length >= 3).map((w) => w.length > 7 ? w.slice(0, 7) : w);
}
__name(terms, "terms");
function chunk(text, size = 1600) {
  const paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean), out3 = [];
  let cur = "";
  const flush = /* @__PURE__ */ __name(() => {
    if (cur) out3.push(cur);
    cur = "";
  }, "flush");
  for (const p of paras) {
    if (p.length > size) {
      flush();
      const head = (p.match(/^[^.!?\n]{3,120}[.!?]?/) || [""])[0].trim(), parts = p.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) || [p];
      let piece = "";
      for (const sx of parts) {
        if ((piece + sx).length > size && piece) {
          out3.push(piece.trim());
          piece = head && !sx.startsWith(head) ? head + " \u2026 " : "";
        }
        if (sx.length > size) {
          for (let i = 0; i < sx.length; i += size) out3.push(sx.slice(i, i + size));
          continue;
        }
        piece += sx;
      }
      if (piece.trim()) out3.push(piece.trim());
      continue;
    }
    if (cur && (cur.length >= 300 || (cur + "\n\n" + p).length > size)) flush();
    cur = cur ? cur + "\n\n" + p : p;
  }
  flush();
  return out3.map((t) => ({ t, w: [...new Set(terms(t))] }));
}
__name(chunk, "chunk");
function search(docs, query, top = 6) {
  const q2 = [...new Set(terms(query))];
  if (!q2.length) return [];
  const all = docs.flatMap((d) => (d.chunks || []).map((ch, i) => ({ doc: d, i, ch, tf: ch.w })));
  const N = all.length || 1, avg3 = all.reduce((s, x) => s + x.ch.t.length, 0) / N || 1, df = {};
  for (const x of all) for (const w of new Set(x.tf)) df[w] = (df[w] || 0) + 1;
  const scored = all.map((x) => {
    const bag = terms(x.ch.t), cnt = {};
    for (const w of bag) cnt[w] = (cnt[w] || 0) + 1;
    let s = 0;
    for (const w of q2) {
      const f = cnt[w] || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
      s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * x.ch.t.length / avg3));
    }
    return { score: s, title: x.doc.title, id: x.doc.id, text: x.ch.t };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, top);
}
__name(search, "search");

// _lib/ops.js
async function loadSession(c, sid) {
  const s = await c.D.get("sessions", str(sid, 60));
  if (!s) throw new H(404, "noRec");
  return s;
}
__name(loadSession, "loadSession");
async function loadEnrolled(c, sid, tid) {
  const s = await loadSession(c, sid);
  need((s.traineeIds || []).includes(str(tid, 60)), "notEnrolled", 404);
  return { s, e: await enrOf(c.D, s.id, str(tid, 60)) };
}
__name(loadEnrolled, "loadEnrolled");
var trainerOpen = /* @__PURE__ */ __name((c, s) => {
  if (c.user?.kind === "trainer") need(!s.closed && !s.cancelled, "sessionClosed", 409);
}, "trainerOpen");
var docsGate = /* @__PURE__ */ __name((c, s) => {
  if (c.user?.kind !== "staff" && !shared_exports.docsReady(s)) throw new H(409, "docsNotOpen", { day: shared_exports.finalDay(s) });
}, "docsGate");
async function openDocs(c, s, open) {
  need(shared_exports.multiDay(s), "notMultiDay", 409);
  need(!s.cancelled && !s.closed, "sessionClosed", 409);
  if (open && c.user?.kind === "trainer" && c.today() < shared_exports.finalDay(s)) throw new H(409, "notFinalDay", { day: shared_exports.finalDay(s) });
  if (open) s.docsOpen = { at: new Date(c.now()).toISOString(), by: c.user?.kind === "trainer" ? shared_exports.fullAz(c.me, false) : c.user?.email || "" };
  else delete s.docsOpen;
  await c.D.put("sessions", [{ id: s.id, data: s }]);
  await audit(c, open ? "docs.open" : "docs.close", s.id);
  if (open) await notify(c, (s.traineeIds || []).map((x) => "trainee:" + x), "nDocsOpen", []);
  return s;
}
__name(openDocs, "openDocs");
var attSlots = /* @__PURE__ */ __name((s, day) => shared_exports.multiDay(s) ? day ? [slot.att(s.id, day)] : shared_exports.sessionDays(s).map((d) => slot.att(s.id, d)) : [slot.att(s.id)], "attSlots");
var actor = /* @__PURE__ */ __name((c) => c.user ? { id: c.user.id, name: c.user.email || c.user.name, role: c.user.role || c.user.kind } : null, "actor");
async function confirmFor(c, sid, tid, undo = false) {
  const { s, e } = await loadEnrolled(c, sid, tid);
  need(!s.cancelled, "sessionClosed", 409);
  trainerOpen(c, s);
  if (undo) {
    need(!e.fb && !e.ev && !e.prac && !e.exam && !e.final, "hasData", 409);
    delete e.att;
    delete e.attBy;
    delete e.days;
  } else {
    need(!s.closed, "sessionClosed", 409);
    need(c.today() >= s.date, "notStarted", 409);
    const at = new Date(c.now()).toISOString(), by = c.user.kind === "trainer" ? "trainer" : "staff";
    if (!e.att) {
      e.att = at;
      e.attBy = by;
    }
    delete e.absent;
    if (shared_exports.sessionDays(s).length > 1) {
      const d = shared_exports.rollDay(s, c.today(), "");
      if (d) {
        e.days ||= {};
        if (!e.days[d]?.at) e.days[d] = { at, by };
      }
    }
  }
  await saveEnr(c.D, e);
  await audit(c, undo ? "attendance.undo" : "attendance.confirm", `${s.id} ${tid}`);
  await unsign(c, attSlots(s, undo ? "" : shared_exports.multiDay(s) ? shared_exports.rollDay(s, c.today(), "") : ""));
  return e;
}
__name(confirmFor, "confirmFor");
async function rollCall(c, sid, absentIds = (
  /** @type {any[]} */
  []
), askedDay = "") {
  const s = await loadSession(c, sid);
  need(!s.cancelled && !s.closed, "sessionClosed", 409);
  need(c.today() >= s.date, "notStarted", 409);
  const absent = new Set((absentIds || []).map((x) => str(x, 60))), by = c.user.kind === "trainer" ? "trainer" : "staff", at = new Date(c.now()).toISOString(), out3 = { present: 0, absent: 0 };
  if (shared_exports.sessionDays(s).length > 1) {
    const asked = str(askedDay, 10);
    if (asked) need(shared_exports.sessionDays(s).includes(asked) && asked <= c.today(), "dayNotYet", 409);
    const day = asked || shared_exports.rollDay(s, c.today(), "");
    need(day, "notStarted", 409);
    out3.day = day;
    for (const tid of s.traineeIds || []) {
      const e = await enrOf(c.D, s.id, tid);
      e.days ||= {};
      const was = JSON.stringify(e.days[day] || null);
      e.days[day] = absent.has(tid) ? { absent: { at, by } } : { at: e.days[day]?.at || at, by: e.days[day]?.by || by };
      const marks = Object.values(e.days), firstIn = marks.filter((m) => m.at).map((m) => m.at).sort()[0];
      if (firstIn) {
        if (!e.att) {
          e.att = firstIn;
          e.attBy = by;
        }
        delete e.absent;
      } else if (!(e.fb || e.ev || e.prac || e.exam || e.test || e.final)) {
        delete e.att;
        delete e.attBy;
        e.absent = { at, by };
      }
      if (JSON.stringify(e.days[day]) !== was) {
        await saveEnr(c.D, e);
        await audit(c, absent.has(tid) ? "attendance.absent" : "attendance.confirm", `${s.id} ${tid} ${day}`);
      }
      absent.has(tid) ? out3.absent++ : out3.present++;
    }
    await unsign(c, attSlots(s, day));
    return out3;
  }
  for (const tid of s.traineeIds || []) {
    const e = await enrOf(c.D, s.id, tid);
    if (absent.has(tid)) {
      if (e.att && (e.fb || e.ev || e.prac || e.exam || e.test || e.final)) continue;
      if (e.att || !e.absent) {
        delete e.att;
        delete e.attBy;
        e.absent = { at, by };
        await saveEnr(c.D, e);
        await audit(c, "attendance.absent", `${s.id} ${tid}`);
      }
      out3.absent++;
    } else {
      if (!e.att) {
        e.att = at;
        e.attBy = by;
        delete e.absent;
        await saveEnr(c.D, e);
        await audit(c, "attendance.confirm", `${s.id} ${tid}`);
      }
      out3.present++;
    }
  }
  await unsign(c, attSlots(s));
  return out3;
}
__name(rollCall, "rollCall");
async function saveEvaluation(c, sid, tid, b) {
  const { s, e } = await loadEnrolled(c, sid, tid);
  trainerOpen(c, s);
  docsGate(c, s);
  need(e.att, "notConfirmed", 409);
  need(!e.final, "locked", 409);
  const ev = {
    behavior: shared_exports.BEHAVIOR.includes(b.behavior) ? b.behavior : null,
    punctuality: shared_exports.PUNCTUALITY.includes(b.punctuality) ? b.punctuality : null,
    engagement: num(b.engagement, 1, 5),
    comment: str(b.comment, 2e3),
    at: new Date(c.now()).toISOString(),
    by: actor(c)
  };
  need(ev.behavior && ev.punctuality && ev.engagement, "badInput");
  e.ev = ev;
  await saveEnr(c.D, e);
  await audit(c, "trainer.evaluate", `${s.id} ${tid}`);
  await unsign(c, [slot.ev(s.id)]);
  return e;
}
__name(saveEvaluation, "saveEvaluation");
async function savePractical(c, sid, tid, b) {
  const { s, e } = await loadEnrolled(c, sid, tid);
  trainerOpen(c, s);
  docsGate(c, s);
  need(s.sheetId, "noSheet", 409);
  const sheet = await c.D.get("sheets", s.sheetId);
  need(sheet, "noRec", 404);
  need(e.att, "notConfirmed", 409);
  need(!e.final, "locked", 409);
  need(e.doh, "needDoh", 409);
  let clean3;
  try {
    clean3 = shared_exports.validateSheetData(sheet, b);
  } catch (x) {
    throw new H(400, typeof x === "string" ? x : "badInput");
  }
  const r = shared_exports.evaluateSheet(sheet, clean3);
  e.prac = {
    sheetId: sheet.id,
    ...clean3,
    result: r.result,
    total: r.total,
    max: r.max,
    avg: r.avg,
    failed: r.failed,
    reason: r.reason,
    examiner: str(b.examiner, 120) || (c.user.name || c.user.email || ""),
    examinerReg: str(b.examinerReg, 40),
    at: new Date(c.now()).toISOString(),
    by: actor(c)
  };
  await saveEnr(c.D, e);
  await audit(c, "practical.save", `${s.id} ${tid} ${r.result}`);
  await unsign(c, [slot.prac(s.id, e.tid, "examiner")]);
  if (r.result !== "INCOMPLETE" && c.user?.kind === "trainer") e.prac.sign = await sign(c, slot.prac(s.id, e.tid, "examiner"), "prac", { sid: s.id, tid: e.tid }, "examiner");
  return e;
}
__name(savePractical, "savePractical");

// _lib/search.js
var SK_VERSION = 2;
var line = /* @__PURE__ */ __name((...v) => foldText(v.flat(Infinity).filter((x) => x !== null && x !== void 0 && x !== "").join(" ")).replace(/\s+/g, " ").trim().slice(0, 400), "line");
var KEYS = {
  // names and numbers only: ID/FIN, phone and e-mail are found by exact match, and only by staff allowed to see them
  trainees: /* @__PURE__ */ __name((t) => line(fullAz(t), fullEn(t), t.att, t.id, t.login), "trainees"),
  certs: /* @__PURE__ */ __name((x) => line(x.no, x.att, x.snap?.names?.az, x.snap?.names?.en, x.snap?.blank?.name, x.snap?.company), "certs"),
  archive: /* @__PURE__ */ __name((x) => line(x.no, x.cert?.no, x.att, x.name, x.cert?.att, x.cert?.snap?.names?.az, x.cert?.snap?.names?.en, x.trainee?.name, x.trainee?.att), "archive")
};
var skOf = /* @__PURE__ */ __name((col, data) => KEYS[col] && data && typeof data === "object" ? KEYS[col](data) : void 0, "skOf");
var certExtra = /* @__PURE__ */ __name((x) => ({ exp: x.expiry || "9999-12-31", cox: x.co || "-" }), "certExtra");
var withSk = /* @__PURE__ */ __name((col, data) => {
  if (!data || typeof data !== "object") return data;
  const k = skOf(col, data), extra = col === "certs" ? certExtra(data) : {};
  const same2 = (k === void 0 || data.sk === k) && Object.entries(extra).every(([f, v]) => data[f] === v);
  return same2 ? data : { ...data, ...k === void 0 ? {} : { sk: k }, ...extra };
}, "withSk");
function renewedMap(list2) {
  const newest = /* @__PURE__ */ new Map();
  for (const c of list2) {
    if (c.revoked) continue;
    const k = c.bid, cur = newest.get(k);
    if (!cur || c.start > cur.start || c.start === cur.start && c.issuedAt > cur.issuedAt) newest.set(k, c);
  }
  return new Map(list2.map((c) => [c.no, !c.revoked && newest.get(c.bid) !== c ? newest.get(c.bid).no : null]));
}
__name(renewedMap, "renewedMap");
async function renewals(D, tids) {
  await Promise.all([...new Set([...tids].filter(Boolean))].map(async (tid) => {
    const list2 = (await D.byField("certs", "tid", tid)).map((r) => r.data), m = renewedMap(list2);
    const fix = list2.filter((c) => (c.renewed || null) !== m.get(c.no)).map((c) => {
      const x = { ...c };
      if (m.get(c.no)) x.renewed = m.get(c.no);
      else delete x.renewed;
      return { id: c.no, data: withSk("certs", x) };
    });
    if (fix.length) await D.put("certs", fix);
  }));
}
__name(renewals, "renewals");
function certSt(c, today, soonDays) {
  if (c.revoked) return "REVOKED";
  if (c.renewed) return "RENEWED";
  const left = daysBetween(today, c.expiry);
  return left < 0 ? "EXPIRED" : left <= soonDays ? "SOON" : "ACTIVE";
}
__name(certSt, "certSt");
var RENEW_KEYS = ["tid", "bid", "start", "issuedAt", "revoked"];
function indexed(D) {
  if (!D) return D;
  return {
    ...D,
    __inner: D,
    async put(col, rows) {
      if (!KEYS[col]) return D.put(col, rows);
      const olds = col === "certs" ? await Promise.all(rows.map((x) => D.get(col, x.id))) : [];
      const r = await D.put(col, rows.map((x) => ({ ...x, data: withSk(col, x.data) })));
      if (col === "certs") await renewals(D, rows.flatMap((x, i) => RENEW_KEYS.some((k) => JSON.stringify(olds[i]?.[k] ?? null) !== JSON.stringify(x.data?.[k] ?? null)) ? [x.data?.tid, olds[i]?.tid] : []));
      return r;
    },
    async insert(col, id, data) {
      const r = await D.insert(col, id, KEYS[col] ? withSk(col, data) : data);
      if (col === "certs") await renewals(D, [data?.tid]);
      return r;
    },
    async insertMany(col, rows) {
      const r = await D.insertMany(col, KEYS[col] ? rows.map((x) => ({ ...x, data: withSk(col, x.data) })) : rows);
      if (col === "certs") await renewals(D, rows.map((x) => x.data?.tid));
      return r;
    },
    async del(col, id) {
      const old = col === "certs" ? await D.get(col, id) : null;
      const r = await D.del(col, id);
      if (old) await renewals(D, [old.tid]);
      return r;
    },
    async delMany(col, ids) {
      const olds = col === "certs" ? await Promise.all(ids.map((id) => D.get(col, id))) : [];
      const r = await D.delMany(col, ids);
      if (olds.length) await renewals(D, olds.map((x) => x?.tid));
      return r;
    }
  };
}
__name(indexed, "indexed");
async function reindex(D) {
  let n = 0;
  for (const col of Object.keys(KEYS)) {
    const all = await D.all(col), ren = /* @__PURE__ */ new Map();
    if (col === "certs") {
      const g = /* @__PURE__ */ new Map();
      for (const r of all) {
        if (!g.has(r.data.tid)) g.set(r.data.tid, []);
        g.get(r.data.tid).push(r.data);
      }
      for (const l of g.values()) for (const [no, v] of renewedMap(l)) ren.set(no, v);
    }
    const fixRen = /* @__PURE__ */ __name((r) => {
      if (col !== "certs") return r;
      const x = { ...r.data };
      if (ren.get(r.id)) x.renewed = ren.get(r.id);
      else delete x.renewed;
      return { id: r.id, data: x };
    }, "fixRen");
    const todo = all.map(fixRen).filter((r, i) => r.data && (withSk(col, r.data) !== r.data || (r.data.renewed || null) !== (all[i].data.renewed || null)));
    const W = D.__inner || D;
    for (let i = 0; i < todo.length; i += 500) {
      await W.put(col, todo.slice(i, i + 500).map((r) => ({ id: r.id, data: withSk(col, r.data) })));
    }
    n += todo.length;
  }
  return n;
}
__name(reindex, "reindex");

// _lib/identity.js
var ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var tempId = /* @__PURE__ */ __name(() => "T-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALNUM[b % ALNUM.length]).join(""), "tempId");
async function moveTrainee(c, from, to) {
  const D = c.D, moved = { sessions: 0, enr: 0 };
  for (const s of await sessionsOf(D, from)) {
    s.traineeIds = [...new Set(s.traineeIds.map((x) => x === from ? to : x))];
    await D.put("sessions", [{ id: s.id, data: s }]);
    moved.sessions++;
    const old = await D.get("enr", enrId(s.id, from));
    if (old) {
      if (!await D.get("enr", enrId(s.id, to))) await D.put("enr", [{ id: enrId(s.id, to), data: { ...old, tid: to } }]);
      await D.del("enr", enrId(s.id, from));
      moved.enr++;
    }
    await unsign(c, [
      ...["prac", "doh", "test"].flatMap((k) => k === "prac" ? [`prac|${s.id}|${from}|examiner`, `prac|${s.id}|${from}|candidate`] : [`${k}|${s.id}|${from}|${k === "doh" ? "participant" : "grader"}`]),
      `fb|${s.id}|${from}|participant`,
      `tbt|${s.id}|${from}|participant`
    ]);
  }
  for (const { data: g } of await D.all("groups")) if ((g.traineeIds || []).includes(from)) {
    g.traineeIds = [...new Set(g.traineeIds.map((x) => x === from ? to : x))];
    await D.put("groups", [{ id: g.id, data: g }]);
  }
  for (const { data: r } of (await D.query("candreq", { where: [["traineeId", "eq", from]] })).rows) {
    r.traineeId = to;
    await D.put("candreq", [{ id: r.id, data: r }]);
  }
  return moved;
}
__name(moveTrainee, "moveTrainee");
async function completeTemp(c, t, { fin, phone, docType }) {
  const D = c.D, year = new Date(c.now()).getUTCFullYear(), att = shared_exports.learnerNo(year, await D.seq("attendance"));
  if (t.fin && t.fin === fin) await D.put("fins", [{ id: fin, data: { id: att } }]);
  else try {
    await D.insert("fins", fin, { id: att });
  } catch (e) {
    if (e instanceof H && e.message === "dup") throw new H(409, "finExists");
    throw e;
  }
  const login = await claimLogin(D, "trainee", att, att);
  const { temp, tempLogin, ...rest } = t;
  const x = { ...rest, id: att, att, fin, phone, ...t.foreign && docType ? { docType } : {}, login, registeredAt: new Date(c.now()).toISOString(), wasTemp: t.id };
  await D.put("trainees", [{ id: att, data: x }]);
  await moveTrainee(c, t.id, att);
  await D.del("trainees", t.id);
  await D.del("logins", loginKey("trainee", t.login));
  await audit(c, "trainee.register", `${t.id} \u2192 ${att} ${shared_exports.fullAz(x)} (FIN and phone given at the first sign-in)`, { entity: { kind: "trainee", id: att, label: `${att} ${shared_exports.fullAz(x)}` } });
  return x;
}
__name(completeTemp, "completeTemp");
async function requestLink(c, t, { fin, phone }) {
  const D = c.D, ex = await D.get("fins", fin), existing = ex && await D.get("trainees", ex.id);
  need(existing, "finExists", 409);
  const open = (await D.query("links", { where: [["tempId", "eq", t.id], ["status", "eq", "pending"]], limit: 1 })).rows[0]?.data;
  const x = open || { id: "L" + rnd(6), tempId: t.id, existingId: existing.id, fin, phone, status: "pending", at: new Date(c.now()).toISOString() };
  Object.assign(x, { fin, phone, existingId: existing.id });
  await D.put("links", [{ id: x.id, data: x }]);
  t.linkPending = x.id;
  await D.put("trainees", [{ id: t.id, data: t }]);
  await audit(c, "trainee.linkRequest", `${t.id} \u2192 ${existing.att} (same FIN)`);
  return { att: existing.att };
}
__name(requestLink, "requestLink");
async function decideLink(c, id, ok, review) {
  const D = c.D, x = await D.get("links", str(id, 40));
  need(x && x.status === "pending", "noRec", 404);
  const t = await D.get("trainees", x.tempId), ex = await D.get("trainees", x.existingId);
  need(ex, "noRec", 404);
  if (ok && t) {
    await moveTrainee(c, t.id, ex.id);
    if (!ex.phone && x.phone) {
      ex.phone = x.phone;
      await D.put("trainees", [{ id: ex.id, data: ex }]);
    }
    await D.del("trainees", t.id);
    await D.del("logins", loginKey("trainee", t.login));
  } else if (t) {
    delete t.linkPending;
    t.linkReturned = review.note;
    await D.put("trainees", [{ id: t.id, data: t }]);
  }
  x.status = ok ? "approved" : "returned";
  x.review = review;
  await D.put("links", [{ id: x.id, data: x }]);
  await audit(c, ok ? "trainee.link" : "trainee.linkReturn", `${x.tempId} \u2192 ${ex.att}${review.note ? " \xB7 " + review.note : ""}`);
  return { link: x };
}
__name(decideLink, "decideLink");
async function pendingLinks(c) {
  const out3 = [], list2 = (await c.D.query("links", { where: [["status", "eq", "pending"]] })).rows.map((r) => r.data);
  const ppl = await getMany(c.D, "trainees", list2.flatMap((x) => [x.tempId, x.existingId]));
  for (const x of list2) {
    const t = ppl.get(x.tempId), ex = ppl.get(x.existingId);
    out3.push({
      ...x,
      fin: shared_exports.can(c.user.role, "fin.view") ? x.fin : "\u2022\u2022\u2022\u2022\u2022" + String(x.fin).slice(-2),
      temp: t && { id: t.id, name: shared_exports.fullAz(t), createdAt: t.createdAt },
      existing: ex && { id: ex.id, att: ex.att, name: shared_exports.fullAz(ex), phone: shared_exports.can(c.user.role, "fin.view") ? ex.phone : "" }
    });
  }
  return out3.sort((a, b) => a.at.localeCompare(b.at));
}
__name(pendingLinks, "pendingLinks");

// _lib/routes_people.js
var DOC_TYPES = ["id", "passport", "residence", "other"];
async function newCreds(c, role, wanted, id) {
  const login = await claimLogin(c.D, role, wanted, id), password = role === "trainee" ? candidatePassword() : genPassword(), salt = rnd(16);
  return { login, password, salt, hash: await pbk(password, salt), pv: 0 };
}
__name(newCreds, "newCreds");
async function resetCreds(acc, kind) {
  const password = kind === "trainee" ? candidatePassword() : genPassword();
  acc.salt = rnd(16);
  acc.hash = await pbk(password, acc.salt);
  acc.pv = (acc.pv || 0) + 1;
  return password;
}
__name(resetCreds, "resetCreds");
var COL = { trainee: "trainees", trainer: "trainers", company: "companies" };
function readPerson(b, { foreignAllowed = true, finOptional = false, phoneRequired = false } = {}) {
  const p = {
    name: shared_exports.cleanName(str(b.name, 60)),
    surname: shared_exports.cleanName(str(b.surname, 60)),
    father: shared_exports.cleanName(str(b.father, 60)),
    nameEn: shared_exports.cleanName(str(b.nameEn, 60)),
    surnameEn: shared_exports.cleanName(str(b.surnameEn, 60)),
    fatherEn: shared_exports.cleanName(str(b.fatherEn, 60)),
    foreign: foreignAllowed && bool(b.foreign),
    fin: shared_exports.normFin(b.fin),
    phone: shared_exports.normPhone(b.phone),
    email: str(b.email, 120).toLowerCase()
  };
  need(p.name && p.surname, "badName");
  if (!p.nameEn) p.nameEn = p.foreign ? p.name : shared_exports.transliterateAzToEn(p.name);
  if (!p.surnameEn) p.surnameEn = p.foreign ? p.surname : shared_exports.transliterateAzToEn(p.surname);
  if (!p.fatherEn && p.father) p.fatherEn = p.foreign ? p.father : shared_exports.transliterateAzToEn(p.father);
  need(finOptional && !p.fin || shared_exports.goodFin(p.fin, p.foreign), "badId");
  if (foreignAllowed) {
    p.docType = DOC_TYPES.includes(b.docType) ? b.docType : p.foreign ? "passport" : "id";
    p.nationality = p.foreign ? str(b.nationality, 60) : "";
    p.certLang = p.foreign && b.certLang === "en" ? "en" : "both";
  }
  need(!phoneRequired || p.phone, "needPhone");
  need(!p.phone || shared_exports.goodPhone(p.phone), "badPhone");
  need(shared_exports.goodEmail(p.email), "badEmail");
  return p;
}
__name(readPerson, "readPerson");
async function claimFin(D, fin, id, reveal = false) {
  try {
    await D.insert("fins", fin, { id });
  } catch (e) {
    if (e instanceof H && e.message === "dup") {
      if (!reveal) throw new H(409, "dupFin");
      const ex = await D.get("fins", fin), t = ex && await D.get("trainees", ex.id);
      throw new H(409, "dupFin", { existing: t ? { id: t.id, att: t.att, name: shared_exports.fullAz(t) } : null });
    }
    throw e;
  }
}
__name(claimFin, "claimFin");
var canSeeFin = /* @__PURE__ */ __name((c) => c.user?.kind === "staff" && shared_exports.can(c.user.role, "fin.view"), "canSeeFin");
var consentOf = /* @__PURE__ */ __name((c, b) => b.consent ? { at: new Date(c.now()).toISOString(), by: c.user?.email || c.user?.name || "" } : null, "consentOf");
async function companyId(D, v) {
  const id = str(v, 60);
  if (!id) return "";
  need(await D.get("companies", id), "badCompany");
  return id;
}
__name(companyId, "companyId");
async function sameNamePeople(c, p, exceptId = "") {
  const f = /* @__PURE__ */ __name((x) => shared_exports.foldText(x || "").trim().replace(/\s+/g, " "), "f"), key = [p.name, p.surname, p.father].map(f).join("|");
  if (!f(p.name) || !f(p.surname)) return [];
  const { rows } = await c.D.query("trainees", { search: [p.name, p.surname, p.father].filter(Boolean).join(" "), limit: 50 });
  return rows.map((r) => r.data).filter((t) => t.id !== exceptId && [t.name, t.surname, t.father].map(f).join("|") === key).map((t) => ({ id: t.id, att: t.att || "", login: t.login, temp: !!t.temp, name: shared_exports.fullAz(t), createdAt: t.createdAt || "" }));
}
__name(sameNamePeople, "sameNamePeople");
async function createTrainee(c, b, { strict = c.user?.kind !== "staff" } = {}) {
  const p = readPerson(b, { finOptional: !strict, phoneRequired: strict }), co = await companyId(c.D, b.co);
  const st = await c.D.get("settings", "main") || {};
  need(!st.privacy?.consentRequired || b.consent, "needConsent");
  let sameName = 0;
  if (!p.fin) {
    const same2 = await sameNamePeople(c, p);
    sameName = same2.length;
    if (same2.length && !bool(b.sameNameOk)) throw new H(409, "sameName", { people: same2.slice(0, 10) });
  }
  if (!p.fin || !p.phone) {
    const id = tempId();
    if (p.fin) await claimFin(c.D, p.fin, id, canSeeFin(c));
    const cred2 = await newCreds(c, "trainee", id, id);
    const t2 = { id, att: "", temp: true, ...p, co, on: true, consent: consentOf(c, b), createdAt: new Date(c.now()).toISOString(), createdBy: { kind: c.user?.kind || "staff", name: c.user?.name || c.user?.email || "" }, login: cred2.login, salt: cred2.salt, hash: cred2.hash, pv: 0 };
    await c.D.put("trainees", [{ id, data: t2 }]);
    return { t: t2, password: cred2.password, sameName };
  }
  const year = new Date(c.now()).getUTCFullYear(), att = shared_exports.learnerNo(year, await c.D.seq("attendance"));
  if (p.fin) await claimFin(c.D, p.fin, att, canSeeFin(c));
  const cred = await newCreds(c, "trainee", att, att);
  const t = { id: att, att, ...p, co, on: true, consent: consentOf(c, b), createdAt: new Date(c.now()).toISOString(), createdBy: { kind: c.user?.kind || "staff", name: c.user?.name || c.user?.email || "" }, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0 };
  await c.D.put("trainees", [{ id: att, data: t }]);
  return { t, password: cred.password };
}
__name(createTrainee, "createTrainee");
var peopleRoutes = {
  /* ------------------------------------------------------------ companies */
  "POST /company/save": { auth: "staff", act: "company.save", async fn(c) {
    const b = await c.body();
    let x;
    const f = {
      name: str(b.name, 120),
      contactPerson: str(b.contactPerson, 120),
      contractNo: str(b.contractNo, 60),
      contractDate: str(b.contractDate, 10),
      phone: shared_exports.normPhone(b.phone),
      email: str(b.email, 120).toLowerCase(),
      address: str(b.address, 250),
      taxId: str(b.taxId, 30),
      notes: str(b.notes, 1e3),
      on: b.on !== false,
      reqOptional: bool(b.reqOptional)
      // the centre may let this company register candidates without ID/FIN and phone
    };
    need(f.name, "badInput");
    need(!f.contractDate || shared_exports.isDate(f.contractDate), "badInput");
    need(!f.phone || shared_exports.goodPhone(f.phone), "badPhone");
    need(shared_exports.goodEmail(f.email), "badEmail");
    if (b.id) {
      x = await c.D.get("companies", str(b.id, 60));
      need(x, "noRec", 404);
      const was = { ...x };
      Object.assign(x, f);
      await c.D.put("companies", [{ id: x.id, data: x }]);
      await audit(c, "company.update", x.name, { entity: { kind: "company", id: x.id, label: x.name }, changes: diff(was, x, Object.keys(f)) });
      return { company: stripSecret(x) };
    }
    const id = uid("c");
    const cred = await newCreds(c, "company", shared_exports.loginSlug(f.name).slice(0, 16) || "co", id);
    x = { id, ...f, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0, createdAt: new Date(c.now()).toISOString() };
    await c.D.put("companies", [{ id, data: x }]);
    await audit(c, "company.create", x.name, { entity: { kind: "company", id, label: x.name } });
    return { company: stripSecret(x), creds: { login: cred.login, password: cred.password } };
  } },
  /* ------------------------------------------------------------- trainers */
  "POST /trainer/save": { auth: "staff", act: "trainer.save", async fn(c) {
    const b = await c.body(), p = readPerson(b, { foreignAllowed: false });
    const extra = { specialty: str(b.specialty, 160), on: b.on !== false };
    if (b.id) {
      const x2 = await c.D.get("trainers", str(b.id, 60));
      need(x2, "noRec", 404);
      const was = { ...x2 };
      Object.assign(x2, p, extra);
      await c.D.put("trainers", [{ id: x2.id, data: x2 }]);
      await audit(c, "trainer.update", shared_exports.fullAz(x2), { entity: { kind: "trainer", id: x2.id, label: shared_exports.fullAz(x2) }, changes: diff(was, x2, [...Object.keys(p), ...Object.keys(extra)]) });
      return { trainer: trainerOut(x2, true) };
    }
    const id = uid("t"), cred = await newCreds(c, "trainer", "trainer_" + shared_exports.loginSlug(p.nameEn || p.name), id);
    const x = { id, ...p, ...extra, login: cred.login, salt: cred.salt, hash: cred.hash, pv: 0, createdAt: new Date(c.now()).toISOString() };
    await c.D.put("trainers", [{ id, data: x }]);
    await audit(c, "trainer.create", shared_exports.fullAz(x), { entity: { kind: "trainer", id, label: shared_exports.fullAz(x) } });
    return { trainer: trainerOut(x, true), creds: { login: cred.login, password: cred.password } };
  } },
  /* ------------------------------------------------------------- trainees */
  "POST /trainee/save": { auth: "staff", act: "trainee.save", async fn(c) {
    const b = await c.body();
    if (!b.id) {
      const { t, password } = await createTrainee(c, b);
      await audit(c, "trainee.create", `${t.att} ${shared_exports.fullAz(t)}`, { entity: { kind: "trainee", id: t.id, label: `${t.att} ${shared_exports.fullAz(t)}` } });
      return { trainee: traineeOut(t, true), creds: { login: t.login, password } };
    }
    const x = await c.D.get("trainees", str(b.id, 60));
    need(x, "noRec", 404);
    const p = readPerson(b, { finOptional: true }), co = await companyId(c.D, b.co);
    if (p.fin && p.fin !== x.fin) {
      await claimFin(c.D, p.fin, x.id, true);
      if (x.fin) await c.D.del("fins", x.fin);
      delete x.finRemovedAt;
    }
    if (!p.fin) p.fin = x.fin || "";
    const was = { ...x };
    Object.assign(x, p, { co, on: b.on !== false });
    if (b.consent && !x.consent) x.consent = consentOf(c, b);
    else if (b.consent === false) x.consent = null;
    await c.D.put("trainees", [{ id: x.id, data: x }]);
    await audit(c, "trainee.update", `${x.att} ${shared_exports.fullAz(x)}`, { entity: { kind: "trainee", id: x.id, label: `${x.att} ${shared_exports.fullAz(x)}` }, changes: diff(was, x, [...Object.keys(p), "co", "on"]) });
    return { trainee: traineeOut(x, true) };
  } },
  /* Batch registration from the Excel form. The browser sends at most 100 rows per request (Workers have a CPU and
     sub-request budget); learner numbers, ID/FIN claims, logins and the people themselves are written in a few bulk requests. */
  "POST /trainee/import": { auth: "staff", act: "trainee.import", async fn(c) {
    const b = await c.body(), rows = Array.isArray(b.rows) ? b.rows.slice(0, 300) : [];
    need(rows.length, "badInput");
    const pk = /^[a-z0-9]{8,40}$/.test(String(b.pk || "")) ? "imp|" + b.pk : "";
    if (pk) {
      const done = await c.D.get("importres", pk);
      if (done) return { results: done.results.map((r) => r.status === "created" ? { ...r, password: "", pwLost: true } : r), repeated: true };
    }
    const st = await c.D.get("settings", "main") || {};
    const cos = (await c.D.all("companies")).map((r) => r.data), byName = new Map(cos.map((x) => [x.name.trim().toLowerCase(), x.id]));
    const seen = /* @__PURE__ */ new Set(), out3 = [], ok = [];
    for (const [i, r] of rows.entries()) {
      const row = { row: r.row ?? i + 2 };
      try {
        const p = readPerson(r, { finOptional: true });
        if (p.fin) {
          if (seen.has(p.fin)) throw new H(409, "dupInFile");
          seen.add(p.fin);
        }
        let co = "";
        const cname = str(r.company, 120);
        if (cname && !shared_exports.isPrivateCompany(cname, "x")) {
          co = byName.get(cname.toLowerCase()) || "";
          if (!co) throw new H(400, "badCompany");
        }
        if (st.privacy?.consentRequired && !bool(r.consent)) throw new H(400, "needConsent");
        ok.push({ row, p, co, cname, consent: bool(r.consent) });
      } catch (e) {
        if (!(e instanceof H)) throw e;
        out3.push({ ...row, status: "error", error: e.message });
      }
    }
    const noFin = ok.filter((k) => !k.p.fin);
    if (noFin.length) {
      const f = /* @__PURE__ */ __name((x) => shared_exports.foldText(x || "").trim().replace(/\s+/g, " "), "f"), key = /* @__PURE__ */ __name((p) => [p.name, p.surname, p.father].map(f).join("|"), "key");
      const cap = /* @__PURE__ */ __name((w) => w.charAt(0).toLocaleUpperCase("az") + w.slice(1).toLocaleLowerCase("az"), "cap");
      const sur = [...new Set(noFin.flatMap((k) => [k.p.surname, k.p.surname.toLocaleUpperCase("az"), k.p.surname.toLocaleLowerCase("az"), cap(k.p.surname)]))];
      const known = /* @__PURE__ */ new Map();
      for (let i = 0; i < sur.length; i += 200) for (const r of (await c.D.query("trainees", { where: [["surname", "in", sur.slice(i, i + 200)]], limit: 5e3, fields: ["name", "surname", "father"] })).rows) {
        const k = key(r.data);
        known.set(k, (known.get(k) || 0) + 1);
      }
      const inFile = /* @__PURE__ */ new Map();
      for (const k of noFin) inFile.set(key(k.p), (inFile.get(key(k.p)) || 0) + 1);
      const now2 = new Date(c.now()).toISOString(), made = noFin.map((x) => ({ x, id: tempId() }));
      const claimed = new Set(await c.D.insertMany("logins", made.map((m) => ({ id: loginKey("trainee", m.id), data: { login: m.id, id: m.id } }))));
      const people2 = [];
      for (const m of made) {
        const login = claimed.has(loginKey("trainee", m.id)) ? m.id : await claimLogin(c.D, "trainee", m.id, m.id), password = candidatePassword(), salt = rnd(16);
        const t = { id: m.id, att: "", temp: true, ...m.x.p, co: m.x.co, on: true, consent: m.x.consent ? { at: now2, by: c.user.email } : null, createdAt: now2, createdBy: { kind: "staff", name: c.user?.email || "" }, login, salt, hash: await pbk(password, salt), pv: 0 };
        people2.push({ id: m.id, data: t });
        const same2 = (known.get(key(m.x.p)) || 0) + (inFile.get(key(m.x.p)) || 1) - 1;
        out3.push({ ...m.x.row, status: "created", temp: true, id: t.id, att: "", name: shared_exports.fullAz(t), company: m.x.cname, login, password, ...same2 ? { sameName: same2 } : {} });
      }
      await c.D.put("trainees", people2);
    }
    for (const x of ok.filter((k) => k.p.fin && !k.p.phone)) {
      try {
        const { t, password, sameName } = await createTrainee(c, { ...x.p, co: x.co, consent: x.consent, sameNameOk: true });
        out3.push({ ...x.row, status: "created", temp: true, id: t.id, att: "", name: shared_exports.fullAz(t), company: x.cname, login: t.login, password, ...sameName ? { sameName } : {} });
      } catch (e) {
        if (!(e instanceof H)) throw e;
        out3.push({ ...x.row, status: e.message === "dupFin" ? "exists" : "error", error: e.message, existing: e.extra?.existing || null });
      }
    }
    ok.splice(0, ok.length, ...ok.filter((k) => k.p.fin && k.p.phone));
    if (ok.length) {
      const year = new Date(c.now()).getUTCFullYear(), first = await c.D.seqN("attendance", ok.length), now2 = new Date(c.now()).toISOString();
      ok.forEach((x, i) => x.att = shared_exports.learnerNo(year, first + i));
      const claimed = new Set(await c.D.insertMany("fins", ok.filter((x) => x.p.fin).map((x) => ({ id: x.p.fin, data: { id: x.att } }))));
      const fresh = ok.filter((x) => !x.p.fin || claimed.has(x.p.fin));
      for (const x of ok) if (x.p.fin && !claimed.has(x.p.fin)) {
        const ex = await c.D.get("fins", x.p.fin), t = ex && await c.D.get("trainees", ex.id);
        out3.push({ ...x.row, status: "exists", error: "dupFin", existing: t ? { id: t.id, att: t.att, name: shared_exports.fullAz(t) } : null });
      }
      const logins = new Set(await c.D.insertMany("logins", fresh.map((x) => ({ id: loginKey("trainee", x.att), data: { login: x.att, id: x.att } }))));
      const people2 = [];
      for (const x of fresh) {
        const password = candidatePassword(), salt = rnd(16), login = logins.has(loginKey("trainee", x.att)) ? x.att : await claimLogin(c.D, "trainee", x.att, x.att);
        const t = { id: x.att, att: x.att, ...x.p, co: x.co, on: true, consent: x.consent ? { at: now2, by: c.user.email } : null, createdAt: now2, login, salt, hash: await pbk(password, salt), pv: 0 };
        people2.push({ id: t.id, data: t });
        out3.push({ ...x.row, status: "created", id: t.id, att: t.att, name: shared_exports.fullAz(t), company: x.cname, login, password });
      }
      await c.D.put("trainees", people2);
    }
    out3.sort((a, b2) => a.row - b2.row);
    await audit(c, "trainee.import", `${out3.filter((x) => x.status === "created").length}/${rows.length}`);
    if (pk) await c.D.put("importres", [{ id: pk, data: { at: new Date(c.now()).toISOString(), results: out3.map(({ password, ...r }) => r) } }]);
    return { results: out3 };
  } },
  /* New one-time passwords (shown once). Also invalidates the person's open portal sessions. */
  "POST /credentials/reset": { auth: "staff", act: "credentials.reset", async fn(c) {
    const b = await c.body(), col = COL[b.kind], ids = [...new Set((b.ids || []).map((x) => str(x, 60)))].slice(0, 500);
    need(col && ids.length, "badInput");
    const out3 = [];
    for (const id of ids) {
      const x = await c.D.get(col, id);
      if (!x) continue;
      const password = await resetCreds(x, b.kind);
      await c.D.put(col, [{ id, data: x }]);
      await c.D.lockOk(loginKey(b.kind, x.login));
      out3.push({ id, name: b.kind === "company" ? x.name : shared_exports.fullAz(x), att: x.att, login: x.login, password });
    }
    await audit(c, "credentials.reset", `${b.kind} x${out3.length}: ${out3.map((o) => o.login).slice(0, 8).join(", ")}`, { entity: out3.length === 1 ? { kind: b.kind, id: out3[0].id, label: out3[0].name } : void 0 });
    return { list: out3 };
  } }
};

// _lib/routes_tests.js
function readTest(b) {
  const seen = /* @__PURE__ */ new Set();
  const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, 1e3).map((q2, i) => {
    let id = str(q2.id, 20) || "q" + (i + 1);
    while (seen.has(id)) id += "x";
    seen.add(id);
    const kind = q2.kind === "open" ? "open" : "mc", text = str(q2.text, 4e3), points = num(q2.points, 1, 100, 1), grp = str(q2.grp, 20).replace(/[^\w-]/g, "");
    const img = shared_exports.goodQImg(q2.img) ? q2.img : "";
    if (kind === "open") return { id, kind, text, points, ...grp ? { grp } : {}, ...img ? { img } : {} };
    const raw = (Array.isArray(q2.options) ? q2.options : []).map((o) => o && typeof o === "object" ? { id: str(o.id, 12), text: str(o.text, 1e3) } : { id: "", text: str(o, 1e3) });
    const used = /* @__PURE__ */ new Set(), options = [];
    raw.forEach((o, k) => {
      if (!o.text || options.length >= 10) return;
      let oid = /^[\w-]{3,12}$/.test(o.id) && !used.has(o.id) ? o.id : "";
      while (!oid || used.has(oid)) oid = rid();
      used.add(oid);
      options.push({ id: oid, text: o.text, k });
    });
    const ci = typeof q2.correct === "number" ? q2.correct : -1, cid = typeof q2.correct === "string" ? q2.correct : null;
    const correct = (cid !== null ? options.find((o) => o.id === cid || raw[o.k]?.id === cid) : options.find((o) => o.k === ci))?.id ?? -1;
    return { id, kind, text, options: options.map(({ id: i2, text: t2 }) => ({ id: i2, text: t2 })), correct, points, ...grp ? { grp } : {}, ...img ? { img } : {} };
  }).filter((q2) => q2.text);
  need(questions.length, "noQuestions");
  const bad = questions.findIndex((q2) => q2.kind === "mc" && !(q2.options.length >= 2 && q2.options.some((o) => o.id === q2.correct)));
  if (bad >= 0 && !bool(b.draft)) throw new H(400, "badQuestion", { n: bad + 1 });
  const grading = b.grading === "review" ? "review" : "rate";
  const pickBy = {};
  for (const [k, v] of Object.entries(b.pickBy || {})) {
    const n = num(v, 0, 1e3, 0), key = str(k, 20).replace(/[^\w-]/g, "");
    if (n && key && questions.some((q2) => (q2.grp || "") === key)) pickBy[key] = n;
  }
  return {
    bid: str(b.bid, 60),
    title: str(b.title, 200),
    intro: str(b.intro, 1500),
    questions,
    grading,
    passRate: num(b.passRate, 1, 100, 80),
    timeLimit: num(b.timeLimit, 0, 600, 0),
    pick: Object.keys(pickBy).length ? 0 : num(b.pick, 0, 1e3, 0),
    pickBy,
    draft: bad >= 0,
    source: str(b.source, 120)
  };
}
__name(readTest, "readTest");
var rndIdx = /* @__PURE__ */ __name((n) => crypto.getRandomValues(new Uint32Array(1))[0] % n, "rndIdx");
var rid = /* @__PURE__ */ __name(() => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""), "rid");
var shuffle = /* @__PURE__ */ __name((list2) => {
  const a = [...list2];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rndIdx(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}, "shuffle");
var sample = /* @__PURE__ */ __name((list2, n) => shuffle(list2).slice(0, n), "sample");
function drawQuestions(x, count3 = 0) {
  const all = x.questions, by = x.pickBy || {};
  let chosen;
  if (count3 > 0) chosen = sample(all, Math.min(count3, all.length));
  else if (Object.keys(by).length) {
    chosen = [];
    for (const g of [...new Set(all.map((q2) => q2.grp || ""))]) {
      const list2 = all.filter((q2) => (q2.grp || "") === g);
      chosen.push(...by[g] ? sample(list2, by[g]) : list2);
    }
    chosen = shuffle(chosen);
  } else chosen = x.pick > 0 && x.pick < all.length ? sample(all, x.pick) : shuffle(all);
  return chosen.map((q2) => {
    if (q2.kind === "open") return { ...q2 };
    const opts = shared_exports.optList(q2), ids = new Map(opts.map((o) => [o.id, rid()]));
    return { ...q2, options: (shared_exports.keepOrder(q2) ? opts : shuffle(opts)).map((o) => ({ id: ids.get(o.id), text: o.text })), correct: ids.get(q2.correct) ?? "" };
  });
}
__name(drawQuestions, "drawQuestions");
var poolSize = /* @__PURE__ */ __name((x) => x?.questions?.length || 0, "poolSize");
var forTrainee = /* @__PURE__ */ __name((q2) => ({ ...q2.kind === "open" ? { id: q2.id, kind: "open", text: q2.text, points: q2.points } : { id: q2.id, kind: "mc", text: q2.text, options: shared_exports.optList(q2), points: q2.points }, ...q2.img ? { img: q2.img } : {} }), "forTrainee");
var examLabel = "Online test";
async function grade(c, s, e, b) {
  const x = e.test;
  need(x?.at, "noTest", 409);
  need(!e.final, "locked", 409);
  const marks = {};
  for (const q2 of x.qs) if (q2.kind === "open") {
    const v = b.marks?.[q2.id];
    if (v !== void 0 && v !== null && v !== "") marks[q2.id] = num(v, 0, q2.points, 0);
  }
  const sc = shared_exports.testScore(x.qs, x.answers, marks);
  need(!sc.pending, "marksMissing", 409);
  need(typeof b.passed === "boolean", "chooseResult");
  const by = c.user.kind === "trainer" ? shared_exports.fullAz(c.me, false) : c.user.email;
  Object.assign(x, { marks, score: sc.score, max: sc.max, pct: sc.pct, passed: b.passed, status: "graded", note: str(b.note, 500), gradedAt: new Date(c.now()).toISOString(), gradedBy: by });
  e.exam = { passed: b.passed, score: sc.pct, note: x.note || examLabel, at: x.gradedAt, by, test: true };
  await saveEnr(c.D, e);
  await audit(c, "test.grade", `${s.id} ${e.tid} ${sc.pct}% ${b.passed ? "PASS" : "FAIL"}`);
  await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]);
  if (c.user.kind === "trainer") x.sign = await sign(c, slot.test(s.id, e.tid), "test", { sid: s.id, tid: e.tid }, "grader");
  return e;
}
__name(grade, "grade");
function readDoh(b) {
  const answers = {};
  for (const [k] of shared_exports.DOH_Q) {
    need(b.answers?.[k] === "Y" || b.answers?.[k] === "N", "answerAll");
    answers[k] = b.answers[k];
  }
  const x = { dob: str(b.dob, 10), company: str(b.company, 160), answers, details: str(b.details, 2e3) };
  need(shared_exports.isDate(x.dob), "badDob");
  need(!Object.values(answers).includes("Y") || x.details, "needDetails");
  need(bool(b.agree), "needAgree");
  return x;
}
__name(readDoh, "readDoh");
async function paperDoh(c, sid, tid, on2) {
  const { s, e } = await loadEnrolled(c, sid, tid);
  docsGate(c, s);
  need(s.sheetId, "noSheet", 409);
  need(!e.final, "locked", 409);
  if (on2) {
    need(!e.doh || e.doh.paper, "dohDone", 409);
    e.doh = { paper: true, at: new Date(c.now()).toISOString(), by: c.user.kind === "trainer" ? shared_exports.fullAz(c.me, false) : c.user.email };
  } else {
    need(!e.doh || e.doh.paper, "dohDone", 409);
    need(!e.prac, "hasData", 409);
    delete e.doh;
  }
  await saveEnr(c.D, e);
  await audit(c, on2 ? "doh.paper" : "doh.paper.undo", `${s.id} ${tid}`);
  return e;
}
__name(paperDoh, "paperDoh");
async function saveTbt(c, s, b) {
  need(s.sheetId, "noSheet", 409);
  need(!s.cancelled, "sessionClosed", 409);
  docsGate(c, s);
  const was = s.tbt ? JSON.stringify((({ at, by, sign: sign2, open, ...x }) => x)(s.tbt)) : null;
  const trades = {};
  for (const tid of s.traineeIds || []) {
    const v = str(b.trades?.[tid], 80);
    if (v) trades[tid] = v;
  }
  s.tbt = {
    topic: str(b.topic, 300),
    company: str(b.company, 160),
    location: str(b.location, 160),
    talkBy: str(b.talkBy, 120),
    date: shared_exports.isDate(b.date) ? b.date : s.date,
    notes: str(b.notes, 2e3),
    trades,
    at: new Date(c.now()).toISOString(),
    by: c.user.kind === "trainer" ? shared_exports.fullAz(c.me, false) : c.user.email
  };
  need(s.tbt.topic, "needTopic");
  s.tbt.open = true;
  await c.D.put("sessions", [{ id: s.id, data: s }]);
  await audit(c, "tbt.save", `${s.id} ${s.tbt.topic}`);
  const now2 = JSON.stringify((({ at, by, sign: sign2, open, ...x }) => x)(s.tbt));
  if (was !== now2) {
    await notify(c, (s.traineeIds || []).map((x) => "trainee:" + x), "nTbtOpen", [s.tbt.topic]);
    await unsign(c, [slot.tbt(s.id), ...(s.traineeIds || []).map((tid) => slot.tbtP(s.id, tid))]);
    for (const tid of s.traineeIds || []) {
      const e = await enrOf(c.D, s.id, tid);
      if (e.tbtAck) {
        delete e.tbtAck;
        await saveEnr(c.D, e);
      }
    }
  }
  return s;
}
__name(saveTbt, "saveTbt");
async function examSwitch(c, s, open) {
  need(s.examMode === "bank" && s.examId, "noTest", 409);
  need(!s.cancelled, "sessionClosed", 409);
  const who = c.user.kind === "trainer" ? shared_exports.fullAz(c.me, false) : c.user.email, at = new Date(c.now()).toISOString();
  if (open) {
    docsGate(c, s);
    const x = await c.D.get("tests", s.examId);
    need(x && !x.draft, "testDraft", 409);
    need(shared_exports.usable(x), "testNotApproved", 409);
    s.exam = { open: true, openedAt: at, openedBy: who };
  } else {
    need(s.exam?.open, "examNotStarted", 409);
    s.exam = { ...s.exam, open: false, closedAt: at, closedBy: who };
    for (const tid of s.traineeIds || []) {
      const e = await enrOf(c.D, s.id, tid);
      if (e.test && !e.test.at) await finishTest(c, s, e, e.test.draft || {}, "closed");
    }
  }
  await c.D.put("sessions", [{ id: s.id, data: s }]);
  await audit(c, open ? "exam.open" : "exam.close", `${s.id} \xB7 ${who}`, { entity: { kind: "session", id: s.id, label: s.date } });
  return s.exam;
}
__name(examSwitch, "examSwitch");
async function testFields(c, b) {
  const f = readTest(b), bl = f.bid ? await c.D.get("blanks", f.bid) : null;
  need(!f.bid || bl, "badInput");
  if (!f.title) f.title = bl?.name || "";
  need(f.title, "needTitle");
  return f;
}
__name(testFields, "testFields");
async function storeTest(c, x, f, { submit, direct, owner }) {
  const now2 = new Date(c.now()).toISOString(), by = owner.name;
  if (x) {
    if (direct) {
      Object.assign(x, f, { updatedAt: now2, status: "active" });
      delete x.proposal;
      delete x.review;
    } else if ((x.status || "active") === "active") {
      need(submit && !f.draft, f.draft ? "badQuestion" : "needSubmit");
      x.proposal = { ...f, by, at: now2 };
    } else {
      Object.assign(x, f, { updatedAt: now2, status: submit && !f.draft ? "pending" : "draft" });
      delete x.review;
    }
  } else x = { id: uid("x"), ...f, owner, createdAt: now2, status: direct ? "active" : submit && !f.draft ? "pending" : "draft" };
  await c.D.put("tests", [{ id: x.id, data: x }]);
  await audit(c, x.proposal?.at === now2 ? "test.propose" : x.createdAt === now2 ? "test.create" : "test.update", `${x.title} (${(x.proposal || x).questions.length}) \xB7 ${x.proposal?.at === now2 ? "pending" : x.status}`, { entity: { kind: "test", id: x.id, label: x.title } });
  return x;
}
__name(storeTest, "storeTest");
var testsStaff = {
  "GET /tests": { auth: "staff", act: "library", async fn(c) {
    return { list: (await c.D.all("tests")).map((r) => r.data).sort((a, b) => (a.title || "").localeCompare(b.title || "")) };
  } },
  "POST /test/save": { auth: "staff", act: "test.save", async fn(c) {
    const b = await c.body(), f = await testFields(c, b);
    const old = b.id ? await c.D.get("tests", str(b.id, 60)) : null;
    if (b.id) need(old, "noRec", 404);
    const x = await storeTest(c, old, f, { submit: true, direct: shared_exports.mayPublish(c.user, await getSettings(c.D), "tests"), owner: { kind: "staff", id: c.user.id, name: c.user.email } });
    return { test: x };
  } },
  "POST /test/delete": { auth: "staff", act: "test.save", async fn(c) {
    const b = await c.body(), x = await c.D.get("tests", str(b.id, 60));
    need(x, "noRec", 404);
    const used = (await c.D.query("sessions", { where: [["examId", "eq", x.id], ["examMode", "eq", "bank"]], limit: 0, count: true })).total;
    if (used) throw new H(409, "testInUse", { n: used });
    await c.D.del("tests", x.id);
    await audit(c, "test.delete", x.title);
    return { ok: 1 };
  } },
  "POST /test/grade": { auth: "staff", act: "test.review", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    return { enr: await grade(c, s, e, b) };
  } },
  /* a new attempt (e.g. a technical problem); a released result cannot be reset */
  "POST /test/reset": { auth: "staff", act: "test.review", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(e.test, "noTest", 409);
    need(!e.final, "locked", 409);
    delete e.test;
    if (e.exam?.test) delete e.exam;
    await saveEnr(c.D, e);
    await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]);
    await audit(c, "test.reset", `${s.id} ${e.tid}`);
    return { enr: e };
  } },
  "POST /session/exam": { auth: "staff", act: "exam.save", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    return { exam: await examSwitch(c, s, bool(b.open)) };
  } },
  "POST /enr/doh/paper": { auth: "staff", act: "practical.save", async fn(c) {
    const b = await c.body();
    return { enr: await paperDoh(c, b.sid, b.tid, b.on !== false) };
  } },
  /* a declaration filled online can be cleared (wrong answers); it then has to be filled again */
  "POST /enr/doh/reset": { auth: "staff", act: "test.review", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(!e.final, "locked", 409);
    delete e.doh;
    await saveEnr(c.D, e);
    await unsign(c, [slot.doh(s.id, e.tid)]);
    await audit(c, "doh.reset", `${s.id} ${e.tid}`);
    return { enr: e };
  } },
  "POST /session/tbt": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    return { session: await saveTbt(c, s, b) };
  } }
};
var own = /* @__PURE__ */ __name((c, s) => need(s.tid === c.me.id, "forbidden", 403), "own");
var testsTrainer = {
  /* the trainer opens a candidate's answers (with the answer key): recorded on the session, because after this a new attempt
     for anyone in the session needs the trainer's explicit agreement (they have seen the correct answers) */
  "GET /portal/trainer/test": { auth: "trainer", async fn(c) {
    const { s, e } = await loadEnrolled(c, c.url.searchParams.get("sid"), c.url.searchParams.get("tid"));
    own(c, s);
    need(e.test?.at, "noTest", 404);
    if (!s.keySeen) {
      s.keySeen = { at: new Date(c.now()).toISOString(), by: shared_exports.fullAz(c.me, false) };
      await c.D.put("sessions", [{ id: s.id, data: s }]);
      await audit(c, "test.keyView", `${s.id} ${e.tid}`);
    }
    return { test: e.test };
  } },
  /* a new attempt for one candidate: the old attempt is removed and the next opening draws new random questions */
  "POST /portal/trainer/test/reset": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    own(c, s);
    need(!s.cancelled && !s.closed, "sessionClosed", 409);
    need(e.test, "noTest", 409);
    need(!e.final, "locked", 409);
    if (s.keySeen && !bool(b.force)) throw new H(409, "keySeen", { at: s.keySeen.at, by: s.keySeen.by });
    const was = e.test.at ? `${e.test.pct ?? "?"}%` : "not submitted";
    delete e.test;
    if (e.exam?.test) delete e.exam;
    await saveEnr(c.D, e);
    await unsign(c, [slot.test(s.id, e.tid), slot.exam(s.id)]);
    await audit(c, "test.reset", `${s.id} ${e.tid} by trainer (was ${was})${s.keySeen ? " \xB7 after viewing the answer key" : ""}`);
    return { ok: 1 };
  } },
  "POST /portal/trainer/test/grade": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    own(c, s);
    need(!s.cancelled, "sessionClosed", 409);
    const r = await grade(c, s, e, b);
    return { test: r.test };
  } },
  "POST /portal/trainer/exam": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    own(c, s);
    return { exam: await examSwitch(c, s, bool(b.open)) };
  } },
  "POST /portal/trainer/doh/paper": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    own(c, s);
    need(!s.closed && !s.cancelled, "sessionClosed", 409);
    return { doh: (await paperDoh(c, b.sid, b.tid, b.on !== false)).doh || null };
  } },
  "POST /portal/trainer/tbt": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    own(c, s);
    return { tbt: (await saveTbt(c, s, b)).tbt };
  } },
  "POST /portal/trainer/sign/tbt": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    own(c, s);
    need(s.tbt, "nothingToSign", 409);
    return { sign: await sign(c, slot.tbt(s.id), "tbt", { sid: s.id }, "trainer") };
  } }
};
async function myEnrol(c, sid) {
  const s = await c.D.get("sessions", str(sid, 60));
  need(s && (s.traineeIds || []).includes(c.me.id), "noRec", 404);
  return { s, e: await enrOf(c.D, s.id, c.me.id) };
}
__name(myEnrol, "myEnrol");
async function testOpen(c, s, e) {
  need(s.examMode === "bank" && s.examId, "noTest", 404);
  need(!s.cancelled, "sessionClosed", 409);
  need(e.att && !e.absent, "notConfirmed", 409);
  need(!e.final, "locked", 409);
  need(s.exam?.open, s.exam?.closedAt ? "examClosed" : "examNotStarted", 409);
  if ((await getSettings(c.D)).fbRequired !== false) need(e.fb, "needFeedback", 409);
}
__name(testOpen, "testOpen");
var testState = /* @__PURE__ */ __name((s, e) => s.examMode !== "bank" ? null : e.test?.at ? e.test.status === "graded" ? "graded" : "review" : e.test ? "started" : s.exam?.open ? "new" : s.exam?.closedAt ? "closed" : "locked", "testState");
function cleanAnswers(x, raw = {}) {
  const out3 = {};
  for (const q2 of x.qs) {
    const v = raw[q2.id];
    if (v === void 0 || v === null || v === "") continue;
    if (q2.kind === "open") {
      const t = str(v, 4e3);
      if (t) out3[q2.id] = t;
    } else if (shared_exports.optList(q2).some((o) => o.id === v)) out3[q2.id] = v;
  }
  return out3;
}
__name(cleanAnswers, "cleanAnswers");
var deadline = /* @__PURE__ */ __name((x) => x.timeLimit > 0 ? new Date(x.startedAt).getTime() + (x.timeLimit * 60 + 120) * 1e3 : Infinity, "deadline");
async function finishTest(c, s, e, answers, why = "submit") {
  const x = e.test, now2 = c.now(), late = why === "submit" && now2 > deadline(x);
  const sc = shared_exports.testScore(x.qs, answers, {});
  Object.assign(x, { answers, at: new Date(now2).toISOString(), late: late || void 0, closedBy: why === "submit" ? void 0 : why, auto: { score: sc.score, max: sc.max } });
  delete x.draft;
  if (x.grading === "rate" && !sc.open && !late) {
    Object.assign(x, { status: "graded", score: sc.score, max: sc.max, pct: sc.pct, passed: sc.pct >= x.passRate, gradedAt: x.at, gradedBy: "auto" });
    e.exam = { passed: x.passed, score: sc.pct, note: examLabel, at: x.at, by: "auto", test: true };
  } else x.status = "review";
  await saveEnr(c.D, e);
  if (x.status === "graded") await unsign(c, [slot.exam(s.id)]);
  await audit(c, "test.submit", `${s.id} ${e.tid} ${x.status}${x.status === "graded" ? " " + x.pct + "%" : ""}${why !== "submit" ? " (" + why + ")" : ""}`);
  return { status: x.status, ...x.status === "graded" ? { pct: x.pct, passed: x.passed } : {} };
}
__name(finishTest, "finishTest");
var doneOut = /* @__PURE__ */ __name((x) => ({ done: true, status: x.status, ...x.status === "graded" ? { pct: x.pct, passed: x.passed } : {} }), "doneOut");
var IMG = [["png", [137, 80, 78, 71], "image/png"], ["jpg", [255, 216, 255], "image/jpeg"], ["webp", [82, 73, 70, 70], "image/webp"]];
async function saveQImage(c) {
  const buf = await c.req.arrayBuffer();
  need(buf.byteLength > 100 && buf.byteLength <= 3e6, "badFile");
  const head = new Uint8Array(buf.slice(0, 12)), kind = IMG.find(([, sig]) => sig.every((v, i) => head[i] === v));
  need(kind, "badFile");
  if (kind[0] === "webp") need(String.fromCharCode(...head.slice(8, 12)) === "WEBP", "badFile");
  const key = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("") + "." + kind[0];
  await c.B.put("qimg/" + key, buf, { httpMetadata: { contentType: kind[2] } });
  return { img: key };
}
__name(saveQImage, "saveQImage");
var MAX_WARN = 3;
var testsTrainee = {
  "GET /portal/trainee/test": { auth: "trainee", async fn(c) {
    const { s, e } = await myEnrol(c, c.url.searchParams.get("sid"));
    if (e.test?.at) return doneOut(e.test);
    if (e.test && c.now() > deadline(e.test)) return { ...doneOut({}), ...await finishTest(c, s, e, e.test.draft || {}, "time"), done: true };
    await testOpen(c, s, e);
    if (!e.test) {
      const x2 = await c.D.get("tests", s.examId);
      need(x2, "noTest", 404);
      need(!x2.draft, "testDraft", 409);
      e.test = { examId: x2.id, title: x2.title, grading: x2.grading, passRate: x2.passRate, timeLimit: s.examMinutes || x2.timeLimit || 0, qs: drawQuestions(x2, s.examCount || 0), intro: x2.intro || "", startedAt: new Date(c.now()).toISOString(), draft: {} };
      await saveEnr(c.D, e);
      await audit(c, "test.start", `${s.id} ${c.me.att} (${e.test.qs.length})`);
    }
    const x = e.test;
    return { title: x.title, intro: x.intro, timeLimit: x.timeLimit, startedAt: x.startedAt, now: new Date(c.now()).toISOString(), questions: x.qs.map(forTrainee), saved: x.draft || {}, warns: (x.warns || []).length, maxWarns: MAX_WARN };
  } },
  /* exam integrity: leaving the exam page (another tab, window or app) is reported by the browser; each counts as a warning
     and the 3rd ends the attempt at once with what was answered. Counted on the server, so a reload does not reset it. */
  "POST /portal/trainee/test/warn": { auth: "trainee", async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid);
    const x = e.test;
    need(x && !x.at, "noTest", 409);
    await testOpen(c, s, e);
    x.warns ||= [];
    const last = x.warns[x.warns.length - 1], now2 = c.now();
    if (!last || now2 - Date.parse(last.at) > 2500) {
      x.warns.push({ at: new Date(now2).toISOString(), kind: ["hidden", "blur", "copy", "menu"].includes(b.kind) ? b.kind : "hidden" });
      await saveEnr(c.D, e);
      await audit(c, "test.warning", `${s.id} ${c.me.att} ${x.warns.length}/${MAX_WARN}`);
    }
    if (x.warns.length >= MAX_WARN) return { warns: x.warns.length, max: MAX_WARN, done: true, result: await finishTest(c, s, e, x.draft || {}, "warnings") };
    return { warns: x.warns.length, max: MAX_WARN };
  } },
  /* answers are saved as the trainee goes (the whole set each time, so a lost request never loses an earlier answer) */
  "POST /portal/trainee/test/save": { auth: "trainee", async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid);
    const x = e.test;
    need(x && !x.at, "noTest", 409);
    await testOpen(c, s, e);
    need(c.now() <= deadline(x), "timeUp", 409);
    x.draft = cleanAnswers(x, b.answers);
    x.savedAt = new Date(c.now()).toISOString();
    await saveEnr(c.D, e);
    return { saved: Object.keys(x.draft).length, at: x.savedAt };
  } },
  "POST /portal/trainee/test/submit": { auth: "trainee", async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid);
    const x = e.test;
    need(x && !x.at, "noTest", 409);
    if (!s.exam?.open) need(!s.exam?.closedAt || x, "examClosed", 409);
    else await testOpen(c, s, e);
    try {
      await c.D.insert("claims", `submit|${s.id}|${e.tid}|${x.startedAt}`, { at: new Date(c.now()).toISOString() });
    } catch (er) {
      if (er.message === "dup") throw new H(409, "noTest");
      throw er;
    }
    const late = c.now() > deadline(x) + 18e4;
    if (late) x.lateHandIn = Math.round((c.now() - deadline(x)) / 1e3);
    return finishTest(c, s, e, late ? { ...x.draft || {} } : { ...x.draft || {}, ...cleanAnswers(x, b.answers) });
  } },
  "POST /portal/trainee/doh": { auth: "trainee", async fn(c) {
    const b = await c.body(), { s, e } = await myEnrol(c, b.sid);
    docsGate(c, s);
    need(s.sheetId, "noSheet", 409);
    need(!s.cancelled, "sessionClosed", 409);
    need(!e.final, "locked", 409);
    need(!e.doh, "dohDone", 409);
    e.doh = { ...readDoh(b), at: new Date(c.now()).toISOString() };
    await saveEnr(c.D, e);
    await audit(c, "doh.submit", `${s.id} ${c.me.att}${shared_exports.dohYes(e.doh) ? " YES" : ""}`);
    e.doh.sign = await sign(c, slot.doh(s.id, e.tid), "doh", { sid: s.id, tid: e.tid }, "participant");
    return { doh: e.doh };
  } }
};
var testsImages = {
  "POST /test/image": { auth: "staff", act: "test.save", raw: true, async fn(c) {
    return saveQImage(c);
  } },
  "POST /portal/trainer/test/image": { auth: "trainer", raw: true, async fn(c) {
    return saveQImage(c);
  } },
  /* pictures are public by their unguessable name (a question picture never shows the answer key) */
  "GET /qimg/:key": { auth: "none", raw: true, async fn(c) {
    const k = c.params.key;
    if (!shared_exports.goodQImg(k)) throw new H(404, "noRec");
    return edgeCached(c.req, async () => {
      const o = await c.B.get("qimg/" + k);
      if (!o) throw new H(404, "noRec");
      return new Response(o.body, { headers: { "content-type": k.endsWith(".png") ? "image/png" : k.endsWith(".jpg") ? "image/jpeg" : "image/webp", "cache-control": "public,max-age=31536000,immutable", "x-content-type-options": "nosniff" } });
    });
  } }
};
var testRoutes = { ...testsStaff, ...testsTrainer, ...testsTrainee, ...testsImages };

// _lib/routes_portal.js
var blankLite = /* @__PURE__ */ __name((b) => b && { id: b.id, name: b.name, titleAz: b.titleAz, titleEn: b.titleEn, qualAz: b.qualAz, qualEn: b.qualEn, credits: b.credits || 0 }, "blankLite");
var names = /* @__PURE__ */ __name((x) => ({ az: shared_exports.fullAz(x), en: shared_exports.fullEn(x) }), "names");
var testSummary = /* @__PURE__ */ __name((x) => ({ status: x.status, pct: x.pct, passed: x.passed, at: x.at, late: x.late, title: x.title, grading: x.grading, passRate: x.passRate, closedBy: x.closedBy, warns: (x.warns || []).length }), "testSummary");
var trainerRoutes = {
  "GET /portal/trainer/home": { auth: "trainer", async fn(c) {
    const today = c.today(), me = c.me;
    const all = c.url.searchParams.get("all") === "1", since = daysBefore(today, 365), mine = [["tid", "eq", me.id]];
    const [sessions, blanks, older] = await Promise.all([
      c.D.query("sessions", { where: all ? mine : [...mine, ["date", "gte", since]] }).then((r) => r.rows.map((x) => x.data)),
      c.D.all("blanks").then((r) => new Map(r.map((x) => [x.id, x.data]))),
      all ? 0 : c.D.query("sessions", { where: [...mine, ["date", "lt", since]], limit: 0, count: true }).then((r) => r.total || 0)
    ]);
    const by = await enrsFor(c.D, sessions.map((s) => s.id));
    const live = sessions.filter((s) => !s.cancelled && !s.closed && today >= s.date).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 30);
    const todo = new Map(
      /** @type {[string, number][]} */
      await Promise.all(live.map(async (s) => {
        const [sg, enrs] = await Promise.all([sessionSigns(c, s.id), enrsOfSession(c.D, s)]);
        return [s.id, trainerTodo(s, enrs, sg, today).length];
      }))
    );
    return {
      today,
      me: { id: me.id, ...names(me), specialty: me.specialty || "", login: me.login },
      sessions: sessions.map((s) => ({ ...sessionRow(s, by.get(s.id), today), blank: blankLite(blanks.get(s.bid)), todo: todo.get(s.id) || 0 })).sort((a, b) => a.date < b.date ? 1 : -1),
      older,
      info: (await getSettings(c.D)).company || {}
    };
  } },
  /* Candidates the trainer can pick: only people who are (or were) in the trainer's OWN sessions. Anyone else is added by their exact
     learner number (GET /portal/trainer/lookup). Names, learner number and company only - never ID/FIN, phone or e-mail. */
  "GET /portal/trainer/candidates": { auth: "trainer", async fn(c) {
    const cos = (await c.D.all("companies")).map((r) => r.data).filter((x) => x.on !== false), coName = new Map(cos.map((x) => [x.id, x.name]));
    const mine = new Set((await c.D.byField("sessions", "tid", c.me.id)).flatMap((r) => r.data.traineeIds || []));
    const list2 = [];
    for (const id of mine) {
      const x = await c.D.get("trainees", id);
      if (x && x.on !== false) list2.push({ ...personLite(x), company: shared_exports.isPrivateCompany(coName.get(x.co || ""), x.co) ? "" : coName.get(x.co || "") || "" });
    }
    return { list: list2, companies: cos.map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name)) };
  } },
  "GET /portal/trainer/lookup": { auth: "trainer", async fn(c) {
    const att = str(c.url.searchParams.get("att"), 20).toUpperCase();
    need(/^E-\d{9}$/.test(att), "badInput");
    const x = await c.D.get("trainees", att);
    need(x && x.on !== false, "noRec", 404);
    const co = x.co ? await c.D.get("companies", x.co) : null;
    await audit(c, "trainer.lookup", att);
    return { person: { ...personLite(x), company: co && !shared_exports.isPrivateCompany(co.name, co.id) ? co.name : "" } };
  } },
  /* New candidate registered by a trainer. The ID/FIN is write-only: needed once for the unique-person check, never shown back. Optionally joins the trainer's own session straight away. */
  "POST /portal/trainer/trainee/save": { auth: "trainer", async fn(c) {
    const b = await c.body();
    let s = (
      /** @type {any} */
      null
    );
    if (b.sid) {
      s = await c.D.get("sessions", str(b.sid, 60));
      need(s && s.tid === c.me.id, "noRec", 404);
      need(!s.cancelled && !s.closed, "sessionClosed", 409);
    }
    const { t, password } = await createTrainee(c, { ...b, co: str(b.co, 60) });
    await audit(c, "trainee.create", `${t.att} ${shared_exports.fullAz(t)} (by trainer)`, { entity: { kind: "trainee", id: t.id, label: `${t.att} ${shared_exports.fullAz(t)}` } });
    if (s && !(s.traineeIds || []).includes(t.id)) {
      s.traineeIds = [...s.traineeIds || [], t.id];
      await c.D.put("sessions", [{ id: s.id, data: s }]);
      await audit(c, "session.trainees", `${s.id} +${t.att}`, { entity: { kind: "session", id: s.id, label: s.date } });
    }
    return { trainee: personLite(t), creds: { login: t.login, password } };
  } },
  /* Add / remove candidates on one of the trainer's own sessions. Anyone who already has attendance or results stays. */
  "POST /portal/trainer/session/trainees": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    need(!s.cancelled && !s.closed, "sessionClosed", 409);
    const add = [...new Set((b.add || []).map((x) => str(x, 60)))].slice(0, 200), rem = [...new Set((b.remove || []).map((x) => str(x, 60)))].slice(0, 200);
    for (const t of await Promise.all(add.map((id) => c.D.get("trainees", id)))) need(t && t.on !== false, "badInput");
    for (const id of rem) {
      const e = await c.D.get("enr", enrId(s.id, id));
      if (e && (e.fb || e.ev || e.prac || e.exam || e.test || e.doh || e.final)) throw new H(409, "hasData", { tid: id });
      await c.D.del("enr", enrId(s.id, id));
    }
    s.traineeIds = [.../* @__PURE__ */ new Set([...(s.traineeIds || []).filter((x) => !rem.includes(x)), ...add])].slice(0, 500);
    await c.D.put("sessions", [{ id: s.id, data: s }]);
    await audit(c, "session.trainees", `${s.id} +${add.length} -${rem.length}`, { entity: { kind: "session", id: s.id, label: s.date } });
    return { ok: 1, count: s.traineeIds.length };
  } },
  "GET /portal/trainer/session": { auth: "trainer", async fn(c) {
    const s = await c.D.get("sessions", str(c.url.searchParams.get("id"), 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    const today = c.today(), enrs = await enrsOfSession(c.D, s);
    const [blank, sheet, cos, st] = await Promise.all([c.D.get("blanks", s.bid), s.sheetId ? c.D.get("sheets", s.sheetId) : null, c.D.all("companies"), getSettings(c.D)]);
    const coName = new Map(cos.map((r) => [r.id, r.data.name]));
    const mats = (await Promise.all((s.materials || []).map((id) => c.D.get("materials", id)))).filter((m) => !!m).map((m) => (
      /** @type {import('../../types/records').Material} */
      m
    )).map((m) => ({ id: m.id, title: m.title, slides: m.slides }));
    const trainees = [], people2 = await Promise.all(enrs.map((e) => c.D.get("trainees", e.tid)));
    for (const [i, e] of enrs.entries()) {
      const t = people2[i];
      if (!t) continue;
      trainees.push({
        ...personLite(t),
        company: shared_exports.isPrivateCompany(coName.get(t.co), t.co) ? "" : coName.get(t.co),
        att: t.att,
        attAt: e.att || null,
        attBy: e.attBy || null,
        fbDone: !!e.fb,
        ev: e.ev || null,
        prac: e.prac || null,
        final: e.final ? { outcome: e.final.outcome } : null,
        doh: e.doh || null,
        test: e.test?.at ? testSummary(e.test) : null,
        testStarted: !!(e.test && !e.test.at),
        exam: e.exam || null,
        absent: e.absent || null,
        days: e.days || null,
        hasData: !!(e.fb || e.ev || e.prac || e.exam || e.test || e.final || e.doh),
        fbAt: e.fb?.at || null,
        tbtAck: e.tbtAck?.at || null
      });
    }
    const signs = await sessionSigns(c, s.id);
    return {
      today,
      session: sessionRow(s, enrs, today),
      signs,
      todo: trainerTodo(s, enrs, signs, today),
      multi: shared_exports.multiDay(s),
      finalDay: shared_exports.finalDay(s),
      docsReady: shared_exports.docsReady(s),
      blank: blankLite(blank),
      sheet,
      materials: mats,
      trainees,
      test: s.examMode === "bank" ? await c.D.get("tests", s.examId || "") : null,
      trainer: { id: c.me.id, ...names(c.me) },
      info: st.company || {},
      assets: await assetsOut(c.D, st)
    };
  } },
  /* the trainer signs the attendance sheet of an own session; a multi-day training: one signature per day (b.day) */
  "POST /portal/trainer/sign/att": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    need(!s.cancelled, "sessionClosed", 409);
    if (!shared_exports.multiDay(s)) return { sign: await sign(c, slot.att(s.id), "att", { sid: s.id }, "trainer") };
    const day = str(b.day, 10) || shared_exports.rollDay(s, c.today(), "");
    need(shared_exports.sessionDays(s).includes(day) && day <= c.today(), "dayNotYet", 409);
    return { sign: await sign(c, slot.att(s.id, day), "att", { sid: s.id, day }, "trainer"), day };
  } },
  /* the trainer signs the evaluation of the candidates, or the exam results once they are all confirmed */
  "POST /portal/trainer/sign/doc": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    need(!s.cancelled, "sessionClosed", 409);
    const doc = str(b.doc, 10), enrs = await enrsOfSession(c.D, s), present = enrs.filter((e) => e.att);
    if (doc === "ev") {
      need(present.length && present.every((e) => e.ev), "evIncomplete", 409);
      return { sign: await sign(c, slot.ev(s.id), "ev", { sid: s.id }, "trainer") };
    }
    if (doc === "exam") {
      need(examConfirmed(present), "examNotConfirmed", 409);
      return { sign: await sign(c, slot.exam(s.id), "exam", { sid: s.id }, "trainer") };
    }
    throw new H(400, "badInput");
  } },
  /* the trainer opens the final-day documents of a multi-day training (on the final day) */
  "POST /portal/trainer/docs": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    const x = await openDocs(c, s, b.open !== false);
    return { docsOpen: x.docsOpen || null };
  } },
  /* roll call: the trainer ticks only who is absent; everybody else is saved as present */
  "POST /portal/trainer/attendance": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    return rollCall(c, s.id, b.absent, b.day);
  } },
  /* the trainer confirms attendance for every candidate of the session in one go */
  "POST /portal/trainer/confirm-all": { auth: "trainer", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && s.tid === c.me.id, "noRec", 404);
    let n = 0;
    for (const tid of s.traineeIds || []) {
      const e = await enrOf(c.D, s.id, tid);
      if (!e.att) {
        await confirmFor(c, s.id, tid);
        n++;
      }
    }
    return { confirmed: n };
  } },
  /* the trainer signs a practical sheet again (e.g. after the office corrected it) */
  "POST /portal/trainer/sign/prac": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(s.tid === c.me.id, "forbidden", 403);
    need(!s.cancelled, "sessionClosed", 409);
    need(e.prac && e.prac.result !== "INCOMPLETE", "nothingToSign", 409);
    return { sign: await sign(c, slot.prac(s.id, e.tid, "examiner"), "prac", { sid: s.id, tid: e.tid }, "examiner") };
  } },
  "POST /portal/trainer/confirm": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid);
    need(s.tid === c.me.id, "forbidden", 403);
    const e = await confirmFor(c, b.sid, b.tid, bool(b.undo));
    return { att: e.att || null, attBy: e.attBy || null };
  } },
  "POST /portal/trainer/evaluate": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid);
    need(s.tid === c.me.id, "forbidden", 403);
    return { ev: (await saveEvaluation(c, b.sid, b.tid, b)).ev };
  } },
  "POST /portal/trainer/practical": { auth: "trainer", async fn(c) {
    const b = await c.body(), { s } = await loadEnrolled(c, b.sid, b.tid);
    need(s.tid === c.me.id, "forbidden", 403);
    return { prac: (await savePractical(c, b.sid, b.tid, b.data || {})).prac };
  } },
  /* The presentation bytes are only handed to the assigned trainer while the session is on, never as a file download. */
  "GET /portal/trainer/material": { auth: "trainer", raw: true, async fn(c) {
    const sid = str(c.url.searchParams.get("sid"), 60), id = str(c.url.searchParams.get("id"), 60);
    const s = await c.D.get("sessions", sid);
    need(s && s.tid === c.me.id && (s.materials || []).includes(id), "noRec", 404);
    {
      const mx = await c.D.get("materials", id);
      need(shared_exports.usable(mx), "materialNotApproved", 409);
    }
    need(!s.cancelled && c.today() >= s.date, "notStarted", 409);
    const m = await c.D.get("materials", id), o = m && await c.B.get("materials/" + m.key);
    need(o, "noRec", 404);
    await audit(c, "material.view", `${m.title} (${s.id})`);
    return new Response(o.body, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store, private", "content-disposition": "inline", "x-content-type-options": "nosniff" } });
  } }
};
async function certsOf(c, tid) {
  const st = await getSettings(c.D);
  const list2 = (await c.D.byField("certs", "tid", tid)).map((r) => r.data).filter(shared_exports.certDelivered);
  return shared_exports.annotateCerts(list2, c.today(), st.soonDays ?? shared_exports.SOON_DAYS);
}
__name(certsOf, "certsOf");
var certFact = /* @__PURE__ */ __name((x) => ({ fact: true, training: x.snap?.blank?.name || "", start: x.start, end: x.end, expiry: x.expiry, st: x.st }), "certFact");
var traineeRoutes = {
  /* first sign-in of someone registered without ID/FIN or phone: these are asked for before the portal opens */
  /* first sign-in of someone registered without ID/FIN or phone (temporary account): these are asked for before the portal opens.
     New FIN -> full registration with a learner number (a new sign-in token is returned: the record is now the learner number).
     FIN already registered -> a link request to the office (the same person must not get a second record). */
  "POST /portal/trainee/profile/complete": { auth: "trainee", async fn(c) {
    const b = await c.body(), me = c.me, fin = me.fin || shared_exports.normFin(b.fin), phone = me.phone || shared_exports.normPhone(b.phone);
    need(shared_exports.goodFin(fin, me.foreign), "badId");
    need(phone && shared_exports.goodPhone(phone), "badPhone");
    if (me.linkPending) throw new H(409, "linkPending");
    const owner = await c.D.get("fins", fin);
    if (owner && owner.id !== me.id) {
      if (!me.temp) throw new H(409, "dupFin");
      const r = await requestLink(c, me, { fin, phone });
      return { linkPending: true, att: "\u2022\u2022\u2022\u2022" + String(r.att).slice(-4) };
    }
    if (me.temp) {
      const x = await completeTemp(c, me, { fin, phone, docType: b.docType });
      return { registered: true, att: x.att, login: x.login, token: await mkTok(c.env, { r: "trainee", id: x.id, pv: x.pv || 0 }) };
    }
    if (!me.fin) {
      await claimFin(c.D, fin, me.id);
      me.fin = fin;
    }
    if (!me.phone) me.phone = phone;
    await c.D.put("trainees", [{ id: me.id, data: me }]);
    await audit(c, "trainee.profile", `${me.att} completed ID/FIN and phone at first sign-in`);
    return { ok: 1 };
  } },
  "GET /portal/trainee/home": { auth: "trainee", async fn(c) {
    const me = c.me, today = c.today(), st = await getSettings(c.D);
    if (me.temp || !me.fin || !me.phone) return { needProfile: { fin: !me.fin, phone: !me.phone, foreign: !!me.foreign, temp: !!me.temp, linkPending: !!me.linkPending, linkReturned: me.linkReturned || "" }, me: { att: me.att, ...names(me), foreign: !!me.foreign }, today, settings: publicSettings(st), assets: await assetsOut(c.D, st), info: st.company || {} };
    const [all, blankRows, trainerRows, co, certs0, aiFlags, assets] = await Promise.all([
      sessionsOf(c.D, me.id),
      c.D.all("blanks"),
      c.D.all("trainers"),
      me.co ? c.D.get("companies", me.co) : null,
      certsOf(c, me.id),
      (async () => {
        c.settings = st;
        const cfg = aiCfg(st), ok = cfg.on && await aiReady(c);
        return { chat: ok && cfg.chat };
      })(),
      assetsOut(c.D, st)
    ]);
    const blanks = new Map(blankRows.map((r) => [r.id, r.data])), trainers = new Map(trainerRows.map((r) => [r.id, r.data]));
    const sessions = await Promise.all(all.map(async (s) => {
      const [e, sg] = await Promise.all([enrOf(c.D, s.id, me.id), sessionSigns(c, s.id)]), tr = trainers.get(s.tid);
      return {
        id: s.id,
        date: s.date,
        endDate: s.endDate || "",
        time: s.time || "",
        location: s.location || "",
        blank: blankLite(blanks.get(s.bid)),
        trainer: tr ? shared_exports.fullEn(tr, false) : "",
        cancelled: !!s.cancelled,
        closed: !!s.closed,
        active: shared_exports.sessionActiveOn(s, today),
        upcoming: today < s.date,
        att: e.att || null,
        fbDone: !!e.fb,
        fbOpen: !e.fb && !e.final && !!e.att && !s.cancelled && !s.closed && today >= s.date && today <= shared_exports.sessionEnd(s) && shared_exports.docsReady(s),
        multi: shared_exports.multiDay(s),
        finalDay: shared_exports.finalDay(s),
        docsReady: shared_exports.docsReady(s),
        fbSigned: !!sg.fb[me.id],
        tbt: s.tbt?.open && !s.cancelled ? { topic: s.tbt.topic, notes: s.tbt.notes || "", date: s.tbt.date || s.date, acked: e.tbtAck?.at || null, canSign: !!e.att && !e.tbtAck && !s.closed && shared_exports.docsReady(s) } : null,
        examLink: e.fb && s.examMode !== "bank" ? s.examLink || "" : "",
        hasExam: s.examMode === "bank" || !!s.examLink,
        test: testState(s, e),
        testResult: e.test?.status === "graded" ? { pct: e.test.pct, passed: e.test.passed } : null,
        examOpen: !!s.exam?.open,
        fbRequired: st.fbRequired !== false,
        needDoh: !!s.sheetId,
        doh: e.doh ? { at: e.doh.at, paper: !!e.doh.paper } : null,
        final: e.final ? { outcome: e.final.outcome, certNo: e.final.certNo || null } : null,
        prac: e.prac && e.prac.result !== "INCOMPLETE" ? { result: e.prac.result, total: e.prac.total, max: e.prac.max } : null,
        pracSigns: sg.prac[me.id] || {}
      };
    }));
    sessions.sort((a, b) => a.date < b.date ? 1 : -1);
    const viaCompany = !!co && !shared_exports.isPrivateCompany(co.name, co.id);
    const certs = certs0.filter((x) => x.st !== "REVOKED");
    return {
      today,
      company: co && !shared_exports.isPrivateCompany(co.name, co.id) ? co.name : "",
      me: { ...personLite(me), login: me.login, ...names(me), phone: me.phone || "", email: me.email || "" },
      ai: aiFlags,
      sessions,
      certs: viaCompany ? certs.map(certFact) : certs,
      certsViaCompany: viaCompany,
      info: st.company || {},
      assets,
      settings: publicSettings(st)
    };
  } },
  "POST /portal/trainee/feedback": { auth: "trainee", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && (s.traineeIds || []).includes(c.me.id), "noRec", 404);
    const e = await enrOf(c.D, s.id, c.me.id);
    need(e.att, "notConfirmed", 409);
    need(!e.fb, "dupFb", 409);
    need(!s.cancelled && !s.closed && c.today() >= s.date && c.today() <= shared_exports.sessionEnd(s), "notDuringTraining", 409);
    docsGate(c, s);
    const r = {}, cm = {};
    for (const g of shared_exports.FB_GROUPS) {
      const v = b.r?.[g];
      need(Number.isInteger(v) && v >= 1 && v <= 10, "badRating");
      r[g] = v;
      cm[g] = str(b.cm?.[g], 2e3);
    }
    e.fb = { r, cm, at: new Date(c.now()).toISOString() };
    await saveEnr(c.D, e);
    await audit(c, "feedback", `${s.id} ${c.me.id}`);
    const sg = await sign(c, slot.fb(s.id, c.me.id), "fb", { sid: s.id, tid: c.me.id }, "participant");
    return { examLink: s.examLink || "", sign: sg };
  } },
  /* the candidate acknowledges and signs the toolbox talk the trainer opened (date and time are recorded) */
  "POST /portal/trainee/tbt": { auth: "trainee", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.sid, 60));
    need(s && (s.traineeIds || []).includes(c.me.id), "noRec", 404);
    need(s.tbt?.open && !s.cancelled && !s.closed, "tbtNotOpen", 409);
    docsGate(c, s);
    const e = await enrOf(c.D, s.id, c.me.id);
    need(e.att, "notConfirmed", 409);
    need(!e.tbtAck, "dupSign", 409);
    e.tbtAck = { at: new Date(c.now()).toISOString() };
    await saveEnr(c.D, e);
    await audit(c, "tbt.ack", `${s.id} ${c.me.id}`);
    return { sign: await sign(c, slot.tbtP(s.id, c.me.id), "tbt", { sid: s.id, tid: c.me.id }, "participant") };
  } }
};
var PCOL = { trainer: "trainers", trainee: "trainees", company: "companies" };
var passwordRoutes = Object.fromEntries(Object.keys(PCOL).map((kind) => [`POST /portal/${kind}/password`, { auth: kind, async fn(c) {
  const b = await c.body(), acc = await c.D.get(PCOL[kind], c.me.id), nw = String(b.next || "");
  need(acc && acc.salt && same(await pbk(String(b.current || ""), acc.salt), acc.hash), "badPassword", 400);
  need(nw.length >= 8 && nw.length <= 100 && /[A-Za-z]/.test(nw) && /\d/.test(nw), "weakPassword");
  acc.salt = rnd(16);
  acc.hash = await pbk(nw, acc.salt);
  acc.pv = (acc.pv || 0) + 1;
  await c.D.put(PCOL[kind], [{ id: acc.id, data: acc }]);
  await audit(c, "password.change", `${kind} ${acc.login}`);
  return { token: await mkTok(c.env, { r: kind, id: acc.id, pv: acc.pv }) };
} }]));
var REQ_KINDS = ["training", "renewal"];
var companyRoutes = {
  /* Training / renewal requests sent to the training centre; staff answer them in Admin -> Requests. */
  "POST /portal/company/request": { auth: "company", async fn(c) {
    const b = await c.body(), kind = REQ_KINDS.includes(b.kind) ? b.kind : null;
    need(kind, "badInput");
    const own2 = new Set((await c.D.byField("trainees", "co", c.me.id)).map((r) => r.id));
    const people2 = [...new Set((b.people || []).map((x2) => str(x2, 60)))].filter((id) => own2.has(id)).slice(0, 200);
    const askCerts = [...new Set((b.certs || []).map((x2) => shared_exports.normCertNo(str(x2, 40))))].slice(0, 200);
    const certs = askCerts.length ? (await c.D.getMany("certs", askCerts)).filter((r) => r.data && (r.data.co === c.me.id || own2.has(r.data.tid))).map((r) => r.id) : [];
    const bid = str(b.bid, 60);
    if (bid) need(await c.D.get("blanks", bid), "badInput");
    const x = {
      id: "q" + Date.now().toString(36) + rnd(2),
      co: c.me.id,
      coName: c.me.name,
      kind,
      bid,
      people: people2,
      certs,
      count: num(b.count, 0, 999, people2.length || 0),
      date: shared_exports.isDate(b.date) ? b.date : "",
      note: str(b.note, 1e3),
      contact: str(b.contact, 160),
      status: "new",
      at: new Date(c.now()).toISOString()
    };
    need(x.bid || x.certs.length || x.note, "badInput");
    await c.D.put("requests", [{ id: x.id, data: x }]);
    await audit(c, "request.create", `${c.me.name} \xB7 ${kind}`);
    await notify(c, "staff:a:requests", "nRqNew", [c.me.name], "#/requests");
    return { request: x };
  } },
  /* results of one of the company's OWN candidates: attendance, trainer's feedback, practical, exam, outcome per session */
  "GET /portal/company/person": { auth: "company", async fn(c) {
    const x = await c.D.get("trainees", str(c.url.searchParams.get("id"), 60));
    need(x && x.co === c.me.id, "noRec", 404);
    const blanks = new Map((await c.D.all("blanks")).map((r) => [r.id, r.data])), trainers = new Map((await c.D.all("trainers")).map((r) => [r.id, r.data]));
    const out3 = [];
    for (const s of (await sessionsOf(c.D, x.id)).sort((a, b) => a.date < b.date ? 1 : -1)) {
      const e = await enrOf(c.D, s.id, x.id), tr = trainers.get(s.tid);
      out3.push({
        sid: s.id,
        date: s.date,
        endDate: s.endDate || "",
        training: blanks.get(s.bid)?.name || "",
        trainer: tr ? shared_exports.fullEn(tr, false) : "",
        cancelled: !!s.cancelled,
        attendance: e.att ? "present" : e.absent ? "absent" : "pending",
        ev: e.ev ? { behavior: e.ev.behavior, punctuality: e.ev.punctuality, engagement: e.ev.engagement, comment: e.ev.comment || "" } : null,
        practical: e.prac && e.prac.result !== "INCOMPLETE" ? { result: e.prac.result, total: e.prac.total, max: e.prac.max } : null,
        exam: e.exam ? { passed: e.exam.passed, score: e.exam.score ?? null } : e.test?.at ? { pending: true } : null,
        outcome: e.final?.outcome || shared_exports.computeOutcome(e, s, { fbRequired: false }).outcome,
        certNo: e.final?.certNo || null
      });
    }
    await audit(c, "company.view.person", `${c.me.name} \xB7 ${x.att}`);
    return { person: { ...personLite(x), ...names(x) }, sessions: out3 };
  } },
  "GET /portal/company/requests": { auth: "company", async fn(c) {
    return { list: (await c.D.byField("requests", "co", c.me.id)).map((r) => r.data).sort((a, b) => (a.at || "") < (b.at || "") ? 1 : -1), blanks: (await c.D.all("blanks")).map((r) => ({ id: r.id, name: r.data.name })) };
  } },
  "GET /portal/company/cert": { auth: "company", async fn(c) {
    const x = await c.D.get("certs", shared_exports.normCertNo(str(c.url.searchParams.get("no"), 60)));
    need(x && x.co === c.me.id && !x.revoked && shared_exports.certDelivered(x), "noRec", 404);
    const st = await getSettings(c.D), { by, sk, exp, cox, ...o } = x;
    return { cert: { ...o, st: certSt(x, c.today(), st.soonDays ?? shared_exports.SOON_DAYS) } };
  } },
  "GET /portal/company/home": { auth: "company", async fn(c) {
    const co = c.me, st = await getSettings(c.D), today = c.today();
    const trainees = (await c.D.byField("trainees", "co", co.id)).map((r) => r.data);
    const soon = st.soonDays ?? shared_exports.SOON_DAYS;
    const certs = (await c.D.query("certs", { where: [["co", "eq", co.id], ["revoked", "null", true], ["renewed", "null", true]] })).rows.map((r) => r.data).filter(shared_exports.certDelivered);
    const live = certs.map(({ by, vh: vh2, sk, exp, cox, snap, ...x }) => ({ ...x, st: certSt(x, today, soon), snap: snap && { names: snap.names, foreign: snap.foreign, att: snap.att, company: snap.company, blank: { name: snap.blank?.name || "" } } }));
    const nBy = /* @__PURE__ */ new Map();
    for (const x of live) nBy.set(x.tid, (nBy.get(x.tid) || 0) + 1);
    return {
      today,
      company: { id: co.id, name: co.name, contactPerson: co.contactPerson || "", phone: co.phone || "", email: co.email || "", reqOptional: !!co.reqOptional },
      trainees: trainees.map((t) => ({ ...personLite(t), certs: nBy.get(t.id) || 0 })),
      certs: live,
      counters: shared_exports.certCounters(live),
      assets: await assetsOut(c.D, st),
      info: st.company || {},
      settings: publicSettings(st)
    };
  } }
};
var examConfirmed = /* @__PURE__ */ __name((present) => present.length > 0 && present.every((e) => e.exam && e.test?.status !== "review"), "examConfirmed");
function trainerTodo(s, enrs, sg, today) {
  if (s.cancelled) return [];
  const out3 = [], present = enrs.filter((e) => e.att), started = today >= s.date;
  if (shared_exports.multiDay(s)) {
    for (const d of shared_exports.sessionDays(s)) if (d <= today && !sg.attDays[d] && enrs.some((e) => e.days?.[d])) out3.push({ doc: "att", day: d });
  } else if (started && present.length && !sg.att) out3.push({ doc: "att" });
  if (shared_exports.multiDay(s) && !s.docsOpen && today >= shared_exports.finalDay(s)) out3.push({ doc: "docsOpen" });
  if (present.length && present.every((e) => e.ev) && !sg.ev) out3.push({ doc: "ev" });
  if (s.tbt && !sg.tbt) out3.push({ doc: "tbt", acks: present.filter((e) => e.tbtAck).length, of: present.length });
  for (const e of present) if (e.prac && e.prac.result !== "INCOMPLETE" && !sg.prac[e.tid]?.examiner) out3.push({ doc: "prac", tid: e.tid });
  if (examConfirmed(present) && !sg.exam) out3.push({ doc: "exam" });
  return out3;
}
__name(trainerTodo, "trainerTodo");
var portalRoutes = { ...trainerRoutes, ...traineeRoutes, ...companyRoutes, ...passwordRoutes };

// _lib/routes_notify.js
var NOTE_ACTS = ["requests", "approve", "cand.approve", "cert.sign", "messages", "issue"];
var KEEP = 40;
var now = /* @__PURE__ */ __name((c) => new Date(c.now()).toISOString(), "now");
function addrOf(c) {
  if (c.user?.kind === "staff" || c.user && !c.me) {
    const r = c.user.role;
    return { me: "staff:u:" + c.user.id, to: ["staff:*", "staff:u:" + c.user.id, ...NOTE_ACTS.filter((a) => shared_exports.can(r, a)).map((a) => "staff:a:" + a)] };
  }
  const k = c.user.kind + ":" + c.me.id;
  return { me: k, to: [k] };
}
__name(addrOf, "addrOf");
async function notify(c, to, k, a = (
  /** @type {any[]} */
  []
), link = "") {
  const list2 = [...new Set([].concat(to).filter(Boolean))];
  if (!list2.length) return;
  const at = now(c);
  try {
    await c.D.put("notes", list2.map((t) => ({ id: uid("n"), data: { to: t, k, a: a.map((x) => String(x ?? "").slice(0, 160)), link, at } })));
  } catch {
  }
}
__name(notify, "notify");
async function todoStaff(c) {
  const r = c.user.role, out3 = [], q2 = /* @__PURE__ */ __name((col, where) => c.D.query(col, { where, limit: 0, count: true }).then((x) => x.total || 0), "q");
  if (shared_exports.can(r, "cert.sign")) {
    const n = await q2("certs", [["sign", "null", true], ["esign", "null", true], ["revoked", "null", true], ["approval.status", "nn", "pending"], ["approval.status", "nn", "returned"]]);
    if (n) out3.push({ k: "nCertsToSign", n, link: shared_exports.can(r, "approve") ? "#/approvals" : "#/certificates/st=UNSIGNED", icon: "\u270D" });
  }
  if (shared_exports.can(r, "approve")) {
    const [a, b, d] = await Promise.all([q2("tests", [["approval.status", "eq", "pending"]]).catch(() => 0), q2("materials", [["status", "eq", "pending"]]), q2("certs", [["approval.status", "eq", "pending"]])]);
    const cands = shared_exports.can(r, "cand.approve") ? await q2("candreq", [["status", "eq", "pending"]]).catch(() => 0) : 0;
    if (a + b + d + cands) out3.push({ k: "nApprovals", n: a + b + d + cands, link: "#/approvals", icon: "\u2705" });
  }
  if (shared_exports.can(r, "requests")) {
    const n = await q2("requests", [["status", "eq", "new"]]);
    if (n) out3.push({ k: "nRequests", n, link: "#/requests", icon: "\u{1F4E8}" });
  }
  return out3;
}
__name(todoStaff, "todoStaff");
async function todoTrainer(c) {
  const today = c.today(), ss = (await c.D.query("sessions", { where: [["tid", "eq", c.me.id]] })).rows.map((r) => r.data).filter((s) => !s.cancelled && !s.closed && today >= s.date).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 30);
  const out3 = [];
  for (const s of ss) {
    const [sg, enrs] = await Promise.all([sessionSigns(c, s.id), enrsOfSession(c.D, s)]);
    const n = trainerTodo(s, enrs, sg, today).length;
    if (n) out3.push({ k: "nTrainerTodo", n, a: [shared_exports.fmtDate(s.date)], link: "#/" + s.id, icon: "\u270D" });
  }
  return out3;
}
__name(todoTrainer, "todoTrainer");
async function todoTrainee(c) {
  const today = c.today(), out3 = [];
  for (const s of await sessionsOf(c.D, c.me.id)) {
    if (s.cancelled || s.closed || today < s.date || today > shared_exports.sessionEnd(s)) continue;
    const e = await enrOf(c.D, s.id, c.me.id);
    if (!e.att || e.final) continue;
    const ready = shared_exports.docsReady(s);
    let n = 0;
    if (ready && s.sheetId && !e.doh) n++;
    if (ready && !e.fb) n++;
    if (ready && s.tbt?.open && !e.tbtAck) n++;
    if (n) out3.push({ k: "nTraineeTodo", n, link: "", icon: "\u270D" });
    else if (shared_exports.multiDay(s) && !ready) out3.push({ k: "nWaitFinalDay", n: 0, a: [shared_exports.fmtDate(shared_exports.finalDay(s))], link: "", icon: "\u23F3" });
  }
  return out3;
}
__name(todoTrainee, "todoTrainee");
async function todoCompany(c) {
  const st = await getSettings(c.D), soon = st.soonDays ?? shared_exports.SOON_DAYS, lim = new Date(Date.parse(c.today()) + soon * 864e5).toISOString().slice(0, 10), out3 = [];
  const n = (await c.D.query("certs", { where: [["co", "eq", c.me.id], ["revoked", "null", true], ["renewed", "null", true], ["expiry", "lte", lim]], limit: 0, count: true })).total || 0;
  if (n) out3.push({ k: "nCoExpiring", n, link: "", icon: "\u23F0" });
  const ret = (await c.D.byField("candreq", "co", c.me.id)).filter((r) => r.data.status === "returned" && !r.data.seenReturn).length;
  if (ret) out3.push({ k: "nCoReturned", n: ret, link: "", icon: "\u21A9" });
  return out3;
}
__name(todoCompany, "todoCompany");
var TODO = { staff: todoStaff, trainer: todoTrainer, trainee: todoTrainee, company: todoCompany };
async function feed(c, kind) {
  const ad = addrOf(c), [notes, seen, todo, th] = await Promise.all([
    c.D.query("notes", { where: [["to", "in", ad.to]], order: ["at", "desc"], limit: KEEP }).then((r) => r.rows.map((x) => ({ id: x.id, ...x.data }))),
    c.D.get("nseen", ad.me),
    TODO[kind](c).catch(() => []),
    kind === "staff" ? shared_exports.can(c.user.role, "messages") ? c.D.query("threads", { where: [["unreadStaff", "gt", 0]], limit: 0, count: true }).then((r) => r.total || 0) : 0 : c.D.get("threads", ad.me).then((t) => t?.unreadAcc || 0)
  ]);
  const since = seen?.at || "";
  return { todo, notes: notes.map(({ to, ...n }) => ({ ...n, unread: n.at > since })), unread: notes.filter((n) => n.at > since).length, msgs: th, canMsg: kind !== "staff" || shared_exports.can(c.user.role, "messages") };
}
__name(feed, "feed");
async function markSeen(c) {
  const ad = addrOf(c);
  await c.D.put("nseen", [{ id: ad.me, data: { at: now(c) } }]);
  return { ok: 1 };
}
__name(markSeen, "markSeen");
var TH_KINDS = ["trainer", "trainee", "company"];
var nameOfAcc = /* @__PURE__ */ __name((kind, x) => kind === "company" ? x.name : shared_exports.fullAz(x) || shared_exports.fullEn(x), "nameOfAcc");
async function post(c, th, from, text) {
  const t = str(text, 2e3).trim();
  need(t, "badInput");
  const by = from === "staff" ? (await c.D.get("staff", c.user.id))?.name || "" : th.name;
  const m = { id: uid("g"), th: th.id, from, by, ...from === "staff" ? { uid: c.user.id } : {}, text: t, at: now(c) };
  await c.D.put("msgs", [{ id: m.id, data: m }]);
  Object.assign(th, { last: t.slice(0, 140), lastAt: m.at, lastFrom: from });
  if (from === "staff") th.unreadAcc = (th.unreadAcc || 0) + 1;
  else th.unreadStaff = (th.unreadStaff || 0) + 1;
  await c.D.put("threads", [{ id: th.id, data: th }]);
  return m;
}
__name(post, "post");
async function relast(c, th) {
  const l = await msgsOf(c, th.id), m = l[l.length - 1];
  Object.assign(th, m ? { last: m.text.slice(0, 140), lastAt: m.at, lastFrom: m.from } : { last: "", lastAt: th.lastAt || now(c), lastFrom: "" });
  await c.D.put("threads", [{ id: th.id, data: th }]);
}
__name(relast, "relast");
async function editMsg(c, th, id, text, mine) {
  const m = await c.D.get("msgs", str(id, 60));
  need(m && m.th === th.id, "noRec", 404);
  need(mine(m), "forbidden", 403);
  m.text = str(text, 2e3).trim();
  need(m.text, "badInput");
  m.editedAt = now(c);
  await c.D.put("msgs", [{ id: m.id, data: m }]);
  await relast(c, th);
  return m;
}
__name(editMsg, "editMsg");
async function delMsg(c, th, id, mine) {
  const m = await c.D.get("msgs", str(id, 60));
  need(m && m.th === th.id, "noRec", 404);
  need(mine(m), "forbidden", 403);
  await c.D.del("msgs", m.id);
  await relast(c, th);
  return { ok: 1 };
}
__name(delMsg, "delMsg");
var msgsOf = /* @__PURE__ */ __name(async (c, id) => (await c.D.query("msgs", { where: [["th", "eq", id]], order: ["at", "desc"], limit: 200 })).rows.map((r) => r.data).reverse(), "msgsOf");
async function threadFor(c, kind, id) {
  need(TH_KINDS.includes(kind), "badInput");
  const acc = await c.D.get(kind === "company" ? "companies" : kind + "s", str(id, 60));
  need(acc, "noRec", 404);
  const tid = kind + ":" + acc.id;
  return await c.D.get("threads", tid) || { id: tid, kind, acc: acc.id, name: nameOfAcc(kind, acc), att: acc.att || "", unreadStaff: 0, unreadAcc: 0 };
}
__name(threadFor, "threadFor");
var portal = /* @__PURE__ */ __name((kind) => ({
  [`GET /portal/${kind}/notify`]: { auth: kind, async fn(c) {
    return feed(c, kind);
  } },
  [`POST /portal/${kind}/notify/seen`]: { auth: kind, async fn(c) {
    return markSeen(c);
  } },
  [`GET /portal/${kind}/messages`]: { auth: kind, async fn(c) {
    const th = await threadFor(c, kind, c.me.id), list2 = await msgsOf(c, th.id);
    if (th.unreadAcc) {
      th.unreadAcc = 0;
      await c.D.put("threads", [{ id: th.id, data: th }]);
    }
    return { list: list2.map(({ by, uid: _u, ...m }) => ({ ...m, by: m.from === "staff" ? by : "" })) };
  } },
  // own messages only
  [`POST /portal/${kind}/message/edit`]: { auth: kind, async fn(c) {
    const b = await c.body();
    return { message: await editMsg(c, await threadFor(c, kind, c.me.id), b.id, b.text, (m) => m.from === "acc") };
  } },
  [`POST /portal/${kind}/message/delete`]: { auth: kind, async fn(c) {
    const b = await c.body();
    return delMsg(c, await threadFor(c, kind, c.me.id), b.id, (m) => m.from === "acc");
  } },
  [`POST /portal/${kind}/message`]: { auth: kind, async fn(c) {
    const b = await c.body(), th = await threadFor(c, kind, c.me.id);
    const hour = new Date(c.now() - 36e5).toISOString(), recent = (await msgsOf(c, th.id)).filter((m2) => m2.from !== "staff" && m2.at > hour).length;
    need(recent < 30, "tooMany", 429);
    const m = await post(c, th, "acc", b.text);
    await notify(c, "staff:a:messages", "nMsgFrom", [th.name], "#/messages/" + encodeURIComponent(th.id));
    return { message: m };
  } }
}), "portal");
var notifyRoutes = {
  "GET /notify": { auth: "staff", act: "view", async fn(c) {
    return feed(c, "staff");
  } },
  "POST /notify/seen": { auth: "staff", act: "view", async fn(c) {
    return markSeen(c);
  } },
  ...portal("trainer"),
  ...portal("trainee"),
  ...portal("company"),
  /* staff side of the conversations */
  "GET /msg/threads": { auth: "staff", act: "messages", async fn(c) {
    const q2 = shared_exports.foldText(str(c.url.searchParams.get("q"), 80)).trim();
    const rows = (await c.D.query("threads", { order: ["lastAt", "desc"], limit: 300 })).rows.map((r) => r.data);
    return { list: q2 ? rows.filter((t) => shared_exports.foldText(`${t.name} ${t.att || ""}`).includes(q2)) : rows };
  } },
  "GET /msg/thread": { auth: "staff", act: "messages", async fn(c) {
    const p = c.url.searchParams, [kind, id] = str(p.get("id"), 80).split(":"), th = await threadFor(c, kind, id);
    if (th.unreadStaff) {
      th.unreadStaff = 0;
      await c.D.put("threads", [{ id: th.id, data: th }]);
    }
    return { thread: th, list: (await msgsOf(c, th.id)).map((m) => ({ ...m, mine: m.from === "staff" && m.uid === c.user.id })) };
  } },
  // staff edit their own answers; they may delete any message, or the whole conversation (kept in the audit trail)
  "POST /msg/edit": { auth: "staff", act: "messages", async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(":");
    return { message: await editMsg(c, await threadFor(c, kind, id), b.id, b.text, (m) => m.from === "staff" && m.uid === c.user.id) };
  } },
  "POST /msg/delete": { auth: "staff", act: "messages", async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(":"), th = await threadFor(c, kind, id);
    const r = await delMsg(c, th, b.id, () => true);
    await audit(c, "message.delete", th.name);
    return r;
  } },
  "POST /msg/thread/delete": { auth: "staff", act: "messages", async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(":"), th = await threadFor(c, kind, id), ids = (await c.D.query("msgs", { where: [["th", "eq", th.id]], limit: 5e3, fields: ["th"] })).rows.map((r) => r.id);
    if (ids.length) await c.D.delMany("msgs", ids);
    await c.D.del("threads", th.id);
    await audit(c, "message.history.delete", `${th.name} \xB7 ${ids.length}`);
    return { ok: 1, n: ids.length };
  } },
  "POST /msg/send": { auth: "staff", act: "messages", async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(":"), th = await threadFor(c, kind, id);
    const m = await post(c, th, "staff", b.text);
    th.unreadStaff = 0;
    await c.D.put("threads", [{ id: th.id, data: th }]);
    await notify(c, th.id, "nMsgFromCentre", [], "msg");
    await audit(c, "message.send", th.name);
    return { message: m, thread: th };
  } }
};

// _lib/signs.js
var slot = {
  cert: /* @__PURE__ */ __name((no) => `cert|${no}|issuer`, "cert"),
  att: /* @__PURE__ */ __name((sid, day) => day ? `att|${sid}|day:${day}` : `att|${sid}|trainer`, "att"),
  prac: /* @__PURE__ */ __name((sid, tid, role) => `prac|${sid}|${tid}|${role}`, "prac"),
  doh: /* @__PURE__ */ __name((sid, tid) => `doh|${sid}|${tid}|participant`, "doh"),
  tbt: /* @__PURE__ */ __name((sid) => `tbt|${sid}|trainer`, "tbt"),
  tbtP: /* @__PURE__ */ __name((sid, tid) => `tbt|${sid}|${tid}|participant`, "tbtP"),
  test: /* @__PURE__ */ __name((sid, tid) => `test|${sid}|${tid}|grader`, "test"),
  ev: /* @__PURE__ */ __name((sid) => `ev|${sid}|trainer`, "ev"),
  fb: /* @__PURE__ */ __name((sid, tid) => `fb|${sid}|${tid}|participant`, "fb"),
  exam: /* @__PURE__ */ __name((sid) => `exam|${sid}|trainer`, "exam"),
  appr: /* @__PURE__ */ __name((doc, sid, tid) => `${doc}|${sid}|${tid || "-"}|approver`, "appr")
};
var APPR_DOCS = { prac: true, doh: true, test: true };
var SIGNERS = { trainer: /* @__PURE__ */ new Set(["att", "ev", "tbt", "prac", "test", "exam"]), trainee: /* @__PURE__ */ new Set(["doh", "fb", "tbt", "prac"]) };
async function signerOf(c, doc = "") {
  const u = c.user;
  if (u.kind === "staff") {
    const s = await c.D.get("staff", u.id) || {};
    if (!String(s.name || "").trim()) throw new H(409, "needName");
    return { kind: "staff", id: u.id, name: s.name.trim(), title: String(s.title || "").trim() };
  }
  if (u.kind === "trainer" && SIGNERS.trainer.has(doc)) return { kind: "trainer", id: c.me.id, name: shared_exports.fullAz(c.me, false), title: "T\u0259lim\xE7i / Trainer" };
  if (u.kind === "trainee" && SIGNERS.trainee.has(doc)) return { kind: "trainee", id: c.me.id, name: c.me.foreign ? shared_exports.fullEn(c.me, false) : shared_exports.fullAz(c.me, false), title: "\u0130\u015Ftirak\xE7\u0131 / Participant" };
  throw new H(403, "forbidden");
}
__name(signerOf, "signerOf");
async function content(c, doc, ref2) {
  if (doc === "cert") {
    const x = await c.D.get("certs", ref2.no) || (await c.D.get("archive", ref2.no))?.cert;
    return x && { no: x.no, names: x.snap?.names, att: x.att, bid: x.bid, start: x.start, end: x.end, expiry: x.expiry };
  }
  if (doc === "att" && ref2.day) {
    const s = await c.D.get("sessions", ref2.sid);
    if (!s) return null;
    const rows = [];
    for (const tid of [...s.traineeIds || []].sort()) {
      const m = (await c.D.get("enr", `${s.id}|${tid}`))?.days?.[ref2.day];
      rows.push([tid, m?.absent ? "A" : m?.at ? "P" : ""]);
    }
    return rows.some((r) => r[1]) ? { sid: s.id, bid: s.bid, day: ref2.day, tid: s.tid, rows } : null;
  }
  if (doc === "att") {
    const s = await c.D.get("sessions", ref2.sid);
    if (!s) return null;
    const rows = [];
    for (const tid of [...s.traineeIds || []].sort()) {
      const e = await c.D.get("enr", `${s.id}|${tid}`);
      rows.push([tid, e?.att || null]);
    }
    return { sid: s.id, bid: s.bid, date: s.date, endDate: s.endDate || "", tid: s.tid, rows };
  }
  if (doc === "prac") {
    const e = await c.D.get("enr", `${ref2.sid}|${ref2.tid}`);
    if (!e?.prac) return null;
    const { at, by, ...p } = e.prac;
    return { sid: ref2.sid, tid: ref2.tid, prac: p };
  }
  if (doc === "doh") {
    const e = await c.D.get("enr", `${ref2.sid}|${ref2.tid}`);
    if (!e?.doh || e.doh.paper) return null;
    const { dob, company, answers, details } = e.doh;
    return { sid: ref2.sid, tid: ref2.tid, dob, company, answers, details };
  }
  if (doc === "tbt") {
    const s = await c.D.get("sessions", ref2.sid);
    if (!s?.tbt) return null;
    const { at, by, sign: sign2, open, ...x } = s.tbt;
    if (!ref2.tid) return { sid: s.id, tbt: x };
    const e = await c.D.get("enr", `${ref2.sid}|${ref2.tid}`);
    return e?.tbtAck ? { sid: s.id, tid: ref2.tid, tbt: x } : null;
  }
  if (doc === "fb" && ref2.tid) {
    const e = await c.D.get("enr", `${ref2.sid}|${ref2.tid}`);
    if (!e?.fb) return null;
    const { at, by, ...x } = e.fb;
    return { sid: ref2.sid, tid: ref2.tid, fb: x };
  }
  if (doc === "exam") {
    const s = await c.D.get("sessions", ref2.sid);
    if (!s) return null;
    const rows = [];
    for (const tid of [...s.traineeIds || []].sort()) {
      const e = await c.D.get("enr", `${s.id}|${tid}`);
      rows.push([tid, e?.exam ? { passed: e.exam.passed, score: e.exam.score ?? null } : null, e?.test?.status === "graded" ? { pct: e.test.pct, passed: e.test.passed } : e?.test?.status || null]);
    }
    return rows.some((r) => r[1] || r[2]) ? { sid: s.id, rows } : null;
  }
  if (doc === "ev" || doc === "fb") {
    const s = await c.D.get("sessions", ref2.sid);
    if (!s) return null;
    const rows = [];
    for (const tid of [...s.traineeIds || []].sort()) {
      const e = await c.D.get("enr", `${s.id}|${tid}`);
      const v = e?.[doc];
      if (v) {
        const { at, by, ...x } = v;
        rows.push([tid, x]);
      }
    }
    return rows.length ? { sid: s.id, doc, rows } : null;
  }
  if (doc === "test") {
    const e = await c.D.get("enr", `${ref2.sid}|${ref2.tid}`);
    const x = e?.test;
    if (!x || x.status !== "graded") return null;
    return { sid: ref2.sid, tid: ref2.tid, answers: x.answers, marks: x.marks, pct: x.pct, passed: x.passed };
  }
  return null;
}
__name(content, "content");
var canon = /* @__PURE__ */ __name((v) => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x), "canon");
var fingerprint = /* @__PURE__ */ __name(async (c, doc, ref2) => {
  const x = await content(c, doc, ref2);
  return x ? sha(canon(x)) : null;
}, "fingerprint");
async function signCert(c, no, mode) {
  const x = await c.D.get("certs", no);
  if (!x) throw new H(404, "noRec");
  if (x.revoked) throw new H(409, "revoked");
  let img = "";
  if (mode === "image") {
    const s = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
    {};
    if (!s.sigKey) throw new H(409, "needSigImage");
    img = s.sigKey;
  } else if (mode !== "esign") throw new H(400, "badInput");
  const pubRec = await sign(c, slot.cert(no), "cert", { no }, "issuer");
  x.sign = { ...pubRec, mode, img };
  delete x.esign;
  delete x.sigId;
  await c.D.put("certs", [{ id: no, data: x }]);
  if (shared_exports.certDelivered(x)) {
    const tr = x.snap?.blank?.name || "";
    await notify(c, "trainee:" + x.tid, "nCertReady", [no, tr]);
    if (x.co) await notify(c, "company:" + x.co, "nCoCertReady", [x.snap?.names?.az || x.snap?.names?.en || "", tr, no]);
  }
  return x;
}
__name(signCert, "signCert");
async function unsignCert(c, no) {
  const x = await c.D.get("certs", no);
  if (!x) return null;
  await unsign(c, [slot.cert(no)]);
  delete x.sign;
  delete x.esign;
  await c.D.put("certs", [{ id: no, data: x }]);
  return x;
}
__name(unsignCert, "unsignCert");
async function sign(c, id, doc, ref2, role, { mode = "esign" } = {}) {
  if (c.user?.kind === "staff" && !(doc === "cert" || role === "approver")) throw new H(403, "signNotYours");
  const hash = await fingerprint(c, doc, ref2);
  if (!hash) throw new H(409, "nothingToSign");
  const by = await signerOf(c, doc), at = new Date(c.now()).toISOString();
  let img = "";
  if (mode === "image") {
    const st = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
    {};
    if (c.user.kind !== "staff" || !st.sigKey) throw new H(409, "needSigImage");
    img = st.sigKey;
  }
  const raw = (await hmac(c.env.TOKEN_SECRET, `sign|${id}|${at}`)).slice(0, 8).toUpperCase(), code = raw.slice(0, 4) + "-" + raw.slice(4);
  const rec = { id, doc, ref: ref2, role, by, at, hash, code, ...img ? { mode: "image", img } : {} };
  await c.D.put("signs", [{ id, data: rec }]);
  await audit(c, "sign", `${doc} ${Object.values(ref2).join(" ")} \xB7 ${role} \xB7 ${by.name} \xB7 ${code}`);
  return pub(rec);
}
__name(sign, "sign");
var pub = /* @__PURE__ */ __name((r) => r ? { name: r.by.name, title: r.by.title, at: r.at, code: r.code, role: r.role, ...r.img ? { mode: "image", img: r.img } : {} } : null, "pub");
async function unsign(c, ids) {
  const ex = [];
  for (const id of ids) if (await c.D.get("signs", id)) ex.push(id);
  if (ex.length) {
    await c.D.delMany("signs", ex);
    await audit(c, "sign.withdrawn", ex.join(", "));
  }
}
__name(unsign, "unsign");
async function sessionSigns(c, sid) {
  const out3 = { att: null, attDays: {}, ev: null, exam: null, tbt: null, tbtP: {}, fb: {}, prac: {}, doh: {}, test: {}, appr: { prac: {}, doh: {}, test: {} } };
  const kinds = ["att", "ev", "fb", "prac", "doh", "tbt", "test", "exam"], lists = await Promise.all(kinds.map((k) => c.D.prefix("signs", `${k}|${sid}|`)));
  for (const list2 of lists) for (const { data: r } of list2) {
    if (r.role === "approver") {
      if (APPR_DOCS[r.doc]) out3.appr[r.doc][r.ref.tid] = pub(r);
      continue;
    }
    if (r.doc === "att") {
      if (r.ref.day) out3.attDays[r.ref.day] = pub(r);
      else out3.att = pub(r);
    } else if (r.doc === "tbt") {
      if (r.ref.tid) out3.tbtP[r.ref.tid] = pub(r);
      else out3.tbt = pub(r);
    } else if (r.doc === "ev" || r.doc === "exam") {
      if (!r.ref.tid) out3[r.doc] = pub(r);
    } else if (r.doc === "fb") {
      if (r.ref.tid) out3.fb[r.ref.tid] = pub(r);
    } else if (r.doc === "prac") (out3.prac[r.ref.tid] ||= {})[r.role] = pub(r);
    else if (out3[r.doc]) out3[r.doc][r.ref.tid] = pub(r);
  }
  return out3;
}
__name(sessionSigns, "sessionSigns");
async function checkCode(c, code) {
  const k = String(code || "").toUpperCase().replace(/[^A-F0-9]/g, "");
  if (k.length !== 8) return null;
  const r = (await c.D.byField("signs", "code", k.slice(0, 4) + "-" + k.slice(4)))[0]?.data;
  if (!r) return null;
  const now2 = await fingerprint(c, r.doc, r.ref);
  let status = now2 === r.hash ? "VALID" : "CHANGED";
  if (r.doc === "cert") {
    const x = await c.D.get("certs", r.ref.no);
    if (!x) status = "WITHDRAWN";
    else if (x.revoked) status = "REVOKED";
  }
  return { doc: r.doc, role: r.role, name: r.by.name, title: r.by.title, at: r.at, code: r.code, status, ref: r.doc === "cert" ? r.ref.no : "" };
}
__name(checkCode, "checkCode");

// _lib/routes_public.js
var ACCOUNT_COL = { trainer: "trainers", trainee: "trainees", company: "companies" };
var vh = /* @__PURE__ */ __name(async (env2, no) => (await hmac(env2.TOKEN_SECRET, "verify|" + no)).slice(0, 12), "vh");
var EMERGENCY_LOGIN = "admin_emergency";
async function emergencyLogin(c, password, keys) {
  const secret = String(c.env.EMERGENCY_PASSWORD || ""), who = { name: EMERGENCY_LOGIN, role: "emergency" };
  if (secret.length < 16 || !same(password, secret)) {
    await attemptBad(c, keys);
    await audit(c, "login.fail", `${EMERGENCY_LOGIN} \xB7 ${secret.length < 16 ? "emergency account not enabled" : "wrong password"}`, { by: who }).catch(() => {
    });
    throw new H(401, "badLogin");
  }
  await attemptOk(c, keys);
  const ip = c.req.headers.get("cf-connecting-ip") || "", at = new Date(c.now()).toISOString();
  const st = await c.D.get("settings", "main") || {};
  st.emergencyUses = [...st.emergencyUses || [], { at, ip }].slice(-50);
  await c.D.put("settings", [{ id: "main", data: st }]);
  await audit(c, "login.emergency", `EMERGENCY ACCOUNT SIGNED IN${ip ? " from " + ip : ""}`, { by: who });
  return { access: await mkTok(c.env, { r: "emergency", id: "emergency", k: (await hmac(c.env.TOKEN_SECRET, "em|" + secret)).slice(0, 12) }, 4 * 36e5), refresh: "", role: "emergency", email: EMERGENCY_LOGIN };
}
__name(emergencyLogin, "emergencyLogin");
var publicRoutes = {
  "GET /public/info": { auth: "none", async fn(c) {
    const st = await getSettings(c.D), a = await assetsOut(c.D, st);
    return { name: st.company?.name || "KVET", logo: a.logo };
  } },
  /* QR target. Shows ONLY: learner number, name and surname, training date, expiry date (+ validity). No FIN, no download. */
  "GET /verify": { auth: "none", async fn(c) {
    const no = shared_exports.normCertNo(c.url.searchParams.get("n")), h = str(c.url.searchParams.get("h"), 20);
    need(no && h, "noRec", 404);
    const cert = await c.D.get("certs", no);
    if (!cert || cert.vh !== h) {
      const ar = await c.D.get("archive", no);
      if (ar?.cert?.vh === h) {
        const st2 = await getSettings(c.D);
        return { status: "INVALID", no, info: { name: st2.company?.name || "KVET", logo: (await assetsOut(c.D, st2)).logo } };
      }
      throw new H(404, "noRec");
    }
    if (!shared_exports.certDelivered(cert)) {
      const st0 = await getSettings(c.D);
      return { status: "PENDING_APPROVAL", no: cert.no, info: { name: st0.company?.name || "KVET", logo: (await assetsOut(c.D, st0)).logo } };
    }
    const st = await getSettings(c.D), sib = (await c.D.byField("certs", "tid", cert.tid)).map((r) => r.data).filter(shared_exports.certDelivered);
    const me = shared_exports.annotateCerts(sib, shared_exports.bakuToday(c.now()), st.soonDays ?? shared_exports.SOON_DAYS).find((x) => x.no === cert.no);
    return { status: me.st, no: cert.no, revokedAt: cert.revoked?.at || null, att: cert.snap.att, names: cert.snap.names, foreign: !!cert.snap.foreign, start: cert.start, end: cert.end, expiry: cert.expiry, sign: cert.sign ? { name: cert.sign.name, title: cert.sign.title || "", at: cert.sign.at, code: cert.sign.code, mode: cert.sign.mode || "esign" } : null, info: { name: st.company?.name || "KVET", logo: (await assetsOut(c.D, st)).logo } };
  } },
  /* checks a printed electronic-signature code */
  "GET /verify-sign": { auth: "none", async fn(c) {
    const r = await checkCode(c, c.url.searchParams.get("c"));
    need(r, "noRec", 404);
    const st = await getSettings(c.D);
    return { ...r, info: { name: st.company?.name || "KVET", logo: (await assetsOut(c.D, st)).logo } };
  } },
  "GET /asset/:key": { auth: "none", raw: true, async fn(c) {
    const n = c.params.key;
    if (!/^[a-f0-9]{16}\.png$/.test(n)) throw new H(404, "noRec");
    const o = await c.B.get("assets/" + n);
    if (!o) throw new H(404, "noRec");
    return new Response(o.body, { headers: { "content-type": "image/png", "cache-control": "public,max-age=31536000,immutable" } });
  } },
  /* ---- staff sign-in (Supabase Auth behind the API). Every attempt lands in the audit trail. ---- */
  "POST /staff/login": { auth: "none", async fn(c) {
    const b = await c.body(), email = str(b.email, 120).toLowerCase(), keys = attemptKeys(c, "staff:" + email), who = { name: email || "?", role: "staff" };
    try {
      await attempt(c, keys);
    } catch (e) {
      await audit(c, "login.locked", email, { by: who }).catch(() => {
      });
      throw e;
    }
    if (email === EMERGENCY_LOGIN) return emergencyLogin(c, String(b.password || ""), keys);
    let t;
    try {
      t = await c.A.login(email, String(b.password || ""));
    } catch (e) {
      await attemptBad(c, keys);
      await audit(c, "login.fail", `${email} \xB7 wrong e-mail or password`, { by: who }).catch(() => {
      });
      throw e;
    }
    await attemptOk(c, keys);
    let u;
    try {
      u = await c.staffFromToken(t.access, { mfa: "skip" });
    } catch (e) {
      await audit(c, "login.fail", `${email} \xB7 no staff role`, { by: who }).catch(() => {
      });
      throw e;
    }
    if (u.mfa) {
      const f = (await c.A.factors(t.access)).find((x) => x.status === "verified");
      if (f) {
        await audit(c, "login.mfa", email, { by: { id: u.id, name: email, role: u.role } }).catch(() => {
        });
        return { mfa: true, ticket: t.access, factorId: f.id, email: u.email };
      }
    }
    await audit(c, "login.ok", email, { by: { id: u.id, name: email, role: u.role } }).catch(() => {
    });
    return { access: t.access, refresh: t.refresh, role: u.role, email: u.email };
  } },
  /* Two-factor sign-in, second step. Also throttled: a 6-digit code must not be guessable. */
  "POST /staff/mfa/verify": { auth: "none", async fn(c) {
    const b = await c.body(), ticket = String(b.ticket || ""), u0 = await c.A.user(ticket), keys = attemptKeys(c, "mfa:" + u0.id);
    await attempt(c, keys);
    let t;
    try {
      t = await c.A.verifyFactor(ticket, str(b.factorId, 80), str(b.code, 10));
    } catch (e) {
      await attemptBad(c, keys);
      await audit(c, "login.fail", `${u0.email} \xB7 wrong two-factor code`, { by: { name: u0.email, role: "staff" } }).catch(() => {
      });
      throw e;
    }
    await attemptOk(c, keys);
    const u = await c.staffFromToken(t.access);
    await audit(c, "login.ok", `${u.email} (2FA)`, { by: { id: u.id, name: u.email, role: u.role } }).catch(() => {
    });
    return { access: t.access, refresh: t.refresh, role: u.role, email: u.email };
  } },
  "POST /staff/refresh": { auth: "none", async fn(c) {
    const b = await c.body();
    const t = await c.A.refresh(String(b.refresh || ""));
    return { access: t.access, refresh: t.refresh };
  } },
  /* ---- trainer / trainee / company sign-in ----
     Accounts created before the login registry existed (or restored from an old backup) are found by their stored login and the registry is repaired. */
  "POST /login": { auth: "none", async fn(c) {
    const b = await c.body(), role = str(b.role, 10), login = str(b.login, 60);
    need(ACCOUNT_COL[role] && login && b.password, "badLogin", 401);
    const key = loginKey(role, login), keys = attemptKeys(c, key), who = { name: login, role };
    try {
      await attempt(c, keys);
    } catch (e) {
      await audit(c, "login.locked", `${role} ${login}`, { by: who }).catch(() => {
      });
      throw e;
    }
    const col = ACCOUNT_COL[role], reg = await c.D.get("logins", key);
    const acc = reg?.id && await c.D.get(col, reg.id) || null;
    const why = !acc ? "unknown login" : !acc.hash || !acc.salt ? "no password set (reset it in Admin)" : acc.on === false ? "account disabled" : "";
    const ok = !why && same(await pbk(String(b.password), acc.salt), acc.hash);
    if (!ok) {
      await attemptBad(c, keys);
      await audit(c, "login.fail", `${role} ${login} \xB7 ${why || "wrong password"}`, { by: who }).catch(() => {
      });
      throw new H(401, "badLogin");
    }
    await attemptOk(c, keys);
    await audit(c, "login.ok", `${role} ${login}`, { by: { id: acc.id, name: login, role } }).catch(() => {
    });
    return { token: await mkTok(c.env, { r: role, id: acc.id, pv: acc.pv || 0 }), role };
  } }
};

// _lib/routes_find.js
var EXPORT_MAX = 2e4;
var canFin = /* @__PURE__ */ __name((c) => shared_exports.can(c.user.role, "fin.view"), "canFin");
var strip = /* @__PURE__ */ __name((c, t) => {
  const o = traineeOut(t, canFin(c));
  if (c.user.role === "auditor") {
    delete o.phone;
    delete o.email;
    delete o.login;
  }
  return o;
}, "strip");
var pageOf = /* @__PURE__ */ __name((q2) => ({ size: q2.get("size") === null ? 50 : num(q2.get("size"), 0, 500, 50), page: num(q2.get("page"), 0, 1e6, 0) }), "pageOf");
var clean2 = /* @__PURE__ */ __name((x) => {
  if (!x) return x;
  const { sk, exp, cox, ...o } = x;
  return o;
}, "clean");
async function findTrainees(c, { q: q2 = "", co = "", on: on2 = "", size = 50, page = 0, from = "", to = "", type = "", sort = "", idsOnly = false } = {}) {
  const where = [], text = String(q2).trim();
  if (shared_exports.isDate(from)) where.push(["createdAt", "gte", from]);
  if (shared_exports.isDate(to)) where.push(["createdAt", "lt", to + "T99"]);
  if (type === "temp") where.push(["temp", "eq", "true"]);
  else if (type === "foreign") where.push(["foreign", "eq", "true"]);
  else if (type === "local") {
    where.push(["foreign", "nn", "true"]);
    where.push(["temp", "nn", "true"]);
  }
  const order = sort === "old" ? ["createdAt", "asc"] : sort === "new" ? ["createdAt", "desc"] : sort === "name" ? ["surname", "asc"] : ["id", "desc"];
  if (idsOnly) {
    if (on2 === "on") where.push(["on", "nn", "false"]);
    else if (on2 === "off") where.push(["on", "eq", "false"]);
    if (co) where.push(co === "-" ? ["co", "empty", true] : ["co", "eq", co]);
    const r2 = await c.D.query("trainees", { where, search: text, limit: 5e3, fields: ["id"] });
    return { ids: r2.rows.map((x) => x.id) };
  }
  if (co) where.push(co === "-" ? ["co", "empty", true] : ["co", "eq", co]);
  if (on2 === "on") where.push(["on", "nn", "false"]);
  else if (on2 === "off") where.push(["on", "eq", "false"]);
  const exact = [];
  if (text && !/\s/.test(text) && canFin(c) && c.user.role !== "auditor") {
    const fin = await c.D.get("fins", shared_exports.normFin(text));
    if (fin?.id) exact.push(fin.id);
    const ph = shared_exports.normPhone(text);
    if (ph.replace(/\D/g, "").length >= 7) for (const r2 of (await c.D.query("trainees", { where: [["phone", "eq", ph]], limit: 20 })).rows) exact.push(r2.id);
    if (text.includes("@")) for (const r2 of (await c.D.query("trainees", { where: [["email", "eq", text.toLowerCase()]], limit: 20 })).rows) exact.push(r2.id);
  }
  const r = await c.D.query("trainees", { where, search: text, order, limit: size, offset: page * size, count: true });
  const ex = exact.length ? [...(await getMany(c.D, "trainees", exact)).values()].filter((t) => !co || (co === "-" ? !t.co : t.co === co)) : [];
  const ids = new Set(ex.map((t) => t.id)), list2 = [...ex, ...r.rows.map((x) => x.data).filter((t) => !ids.has(t.id))];
  if (on2 === "on" || on2 === "off") {
    const want = on2 === "on";
    for (let i = list2.length - 1; i >= 0; i--) if (list2[i].on !== false !== want) list2.splice(i, 1);
  }
  return { list: list2.map((t) => strip(c, clean2(t))), total: (r.total || 0) + ex.filter((t) => !r.rows.some((x) => x.id === t.id)).length };
}
__name(findTrainees, "findTrainees");
async function certsQuery(c, p) {
  const st = await getSettings(c.D), today = c.today(), soon = st.soonDays ?? shared_exports.SOON_DAYS, soonDate = daysBefore(today, -soon);
  const base = [];
  if (p.bid) base.push(["bid", "eq", p.bid]);
  if (p.co) base.push(["cox", "eq", p.co]);
  if (p.tid) base.push(["tid", "eq", p.tid]);
  if (p.sid) base.push(["sid", "eq", p.sid]);
  if (p.nos?.length) base.push(["id", "in", p.nos]);
  if (p.unsigned) base.push(["sign", "null", true], ["esign", "null", true], ["revoked", "null", true], ["approval.status", "nn", "pending"], ["approval.status", "nn", "returned"]);
  if (p.issued) {
    const [a, z] = String(p.issued).split("..");
    if (shared_exports.isDate(a)) base.push(["issuedAt", "gte", a]);
    if (shared_exports.isDate(z)) base.push(["issuedAt", "lte", z + "T99"]);
    base.push(["revoked", "null", true]);
  }
  const live = [["revoked", "null", true], ["renewed", "null", true]];
  const ST = {
    REVOKED: [["revoked", "null", false]],
    RENEWED: [["revoked", "null", true], ["renewed", "null", false]],
    EXPIRED: [...live, ["exp", "lt", today]],
    SOON: [...live, ["exp", "gte", today], ["exp", "lte", soonDate]],
    ACTIVE: [...live, ["exp", "gt", soonDate]]
  };
  const where = [...base, ...ST[p.st] || [], ...p.exp ? [...live, ["exp", "gte", today], ["exp", "lte", daysBefore(today, -Number(p.exp))]] : []];
  const out3 = /* @__PURE__ */ __name((x) => {
    const o = clean2(x);
    o.st = certSt(x, today, soon);
    return o;
  }, "out");
  return { where, base, ST, out: out3, today, soon };
}
__name(certsQuery, "certsQuery");
async function findCerts(c, p) {
  const { where, base, ST, out: out3 } = await certsQuery(c, p), search2 = p.q;
  const spec = { where, search: search2, order: p.sort === "expiry" ? ["exp", "asc"] : ["issuedAt", "desc"] };
  if (p.all && !p.tid && !p.sid && !p.nos?.length) {
    const n = (await c.D.query("certs", { ...spec, limit: 0, count: true })).total || 0;
    if (n > EXPORT_MAX) throw new H(413, "tooMany", { n, max: EXPORT_MAX });
  }
  const [res, ...counts] = await Promise.all([
    p.all ? c.D.query("certs", spec) : c.D.query("certs", { ...spec, limit: p.size, offset: p.page * p.size, count: true }),
    ...p.counts ? ["ACTIVE", "SOON", "EXPIRED"].map((k2) => c.D.query("certs", { where: [...base, ...ST[k2]], search: search2, limit: 0, count: true }).then((r) => r.total || 0)) : []
  ]);
  const k = p.counts ? { ACTIVE: counts[0], SOON: counts[1], EXPIRED: counts[2] } : null;
  if (k) k.total = k.ACTIVE + k.SOON + k.EXPIRED;
  return { certs: res.rows.map((r) => out3(r.data)), total: res.total ?? res.rows.length, counts: k };
}
__name(findCerts, "findCerts");
var findRoutes = {
  "GET /trainees/find": { auth: "staff", act: "view", async fn(c) {
    const q2 = c.url.searchParams;
    return findTrainees(c, { q: str(q2.get("q"), 100), co: str(q2.get("co"), 60), on: str(q2.get("on"), 3), from: str(q2.get("from"), 10), to: str(q2.get("to"), 10), type: str(q2.get("type"), 10), sort: str(q2.get("sort"), 6), idsOnly: q2.get("ids") === "1", ...pageOf(q2) });
  } },
  /* trainee records by id (names for lists that only hold ids: groups, requests, chips) */
  "POST /people": { auth: "staff", act: "view", async fn(c) {
    const b = await c.body(), ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => str(x, 40)).filter(Boolean).slice(0, 3e3);
    return { list: [...(await getMany(c.D, "trainees", ids)).values()].map((t) => strip(c, clean2(t))) };
  } },
  /* Excel import preview: which ID/FINs are already registered */
  "POST /fins/check": { auth: "staff", act: "trainee.import", async fn(c) {
    const b = await c.body(), fins = [...new Set((Array.isArray(b.fins) ? b.fins : []).map((f) => shared_exports.normFin(f)).filter(Boolean))].slice(0, 5e3);
    const owners = await getMany(c.D, "fins", fins), people2 = await getMany(c.D, "trainees", [...owners.values()].map((x) => x.id));
    return { found: Object.fromEntries([...owners].map(([fin, o]) => [fin, people2.get(o.id) ? strip(c, clean2(people2.get(o.id))) : { id: o.id }])) };
  } },
  /* one person's history: sessions and certificates */
  "GET /trainee/history": { auth: "staff", act: "view", async fn(c) {
    const id = str(c.url.searchParams.get("id"), 40), [sessions, certs] = await Promise.all([sessionsOf(c.D, id), findCerts(c, { tid: id, all: true })]);
    return { sessions: sessions.sort((a, b) => a.date < b.date ? 1 : -1).map((s) => ({ id: s.id, date: s.date, bid: s.bid, cancelled: !!s.cancelled })), certs: certs.certs };
  } },
  "GET /certs": { auth: "staff", act: "view", async fn(c) {
    const q2 = c.url.searchParams, nos = str(q2.get("nos"), 4e3);
    return findCerts(c, {
      st: str(q2.get("st"), 10),
      bid: str(q2.get("bid"), 60),
      co: str(q2.get("co"), 60),
      q: str(q2.get("q"), 100),
      issued: str(q2.get("issued"), 30),
      exp: num(q2.get("exp"), 0, 3650, 0) || 0,
      tid: str(q2.get("tid"), 40),
      sid: str(q2.get("sid"), 60),
      nos: nos ? nos.split(",").map(shared_exports.normCertNo).filter(Boolean).slice(0, 500) : [],
      all: q2.get("all") === "1",
      counts: q2.get("counts") !== "0",
      unsigned: q2.get("unsigned") === "1",
      sort: q2.get("sort") === "expiry" ? "expiry" : "",
      ...pageOf(q2)
    });
  } },
  /* sessions outside the start-up window (GET /state has the recent ones): by period, training, trainer */
  "GET /sessions/find": { auth: "staff", act: "view", async fn(c) {
    const q2 = c.url.searchParams, from = str(q2.get("from"), 10), to = str(q2.get("to"), 10), today = c.today(), where = [];
    need(shared_exports.isDate(from) || shared_exports.isDate(to), "badInput");
    if (shared_exports.isDate(from)) where.push(["date", "gte", from]);
    if (shared_exports.isDate(to)) where.push(["date", "lte", to]);
    if (q2.get("bid")) where.push(["bid", "eq", str(q2.get("bid"), 60)]);
    if (q2.get("tid")) where.push(["tid", "eq", str(q2.get("tid"), 60)]);
    const rows = await c.D.query("sessions", { where, order: ["date", "desc"], limit: 1e3, count: true });
    const by = await enrsFor(c.D, rows.rows.map((r) => r.id));
    return { sessions: rows.rows.map((r) => sessionRow(r.data, by.get(r.id), today)), total: rows.total };
  } },
  /* how many sessions use each template / sheet / presentation / test (library pages) */
  "GET /usage": { auth: "staff", act: "view", async fn(c) {
    const { rows } = await c.D.query("sessions", { fields: ["bid", "sheetId", "materials", "examId", "examMode"] }), u = { blanks: {}, sheets: {}, materials: {}, tests: {} };
    const inc2 = /* @__PURE__ */ __name((m, k) => {
      if (k) m[k] = (m[k] || 0) + 1;
    }, "inc");
    for (const { data: s } of rows) {
      inc2(u.blanks, s.bid);
      inc2(u.sheets, s.sheetId);
      for (const m of s.materials || []) inc2(u.materials, m);
      if (s.examMode === "bank") inc2(u.tests, s.examId);
    }
    return u;
  } }
};

// _lib/routes_training.js
function readBlank(b) {
  const x = {
    name: str(b.name, 100),
    prefix: str(b.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    months: num(b.months, 0, 240, 24),
    credits: num(b.credits, 0, 99, 0),
    provider: str(b.provider, 160),
    titleAz: str(b.titleAz, 120),
    titleEn: str(b.titleEn, 120),
    qualAz: str(b.qualAz, 160),
    qualEn: str(b.qualEn, 160),
    descAz: str(b.descAz, 1200),
    descEn: str(b.descEn, 1200),
    footAz: str(b.footAz, 500),
    footEn: str(b.footEn, 500),
    defaultSheetId: str(b.defaultSheetId, 60),
    category: str(b.category, 60),
    note: str(b.note, 300),
    labels: shared_exports.cleanLabels(b.labels)
  };
  need(x.name && x.titleAz && x.titleEn, "badInput");
  return x;
}
__name(readBlank, "readBlank");
function applyLines(snap, s) {
  const coMode = s.coMode || snap.coMode || (snap.showCo ? "show" : "hide");
  Object.assign(snap, { details: s.certDetails || "", reg: s.certReg || "", coMode, coText: s.coText || "", showCo: coMode === "show" });
}
__name(applyLines, "applyLines");
async function certLinesBehind(c, s) {
  const certs = (await c.D.query("certs", { where: [["sid", "eq", s.id], ["revoked", "null", true]] })).rows.map((r) => r.data);
  return certs.filter((x) => {
    const t = structuredClone(x.snap || {});
    applyLines(t, s);
    return ["details", "reg", "coMode", "coText"].some((k) => (t[k] || "") !== (x.snap?.[k] || ""));
  });
}
__name(certLinesBehind, "certLinesBehind");
var idList = /* @__PURE__ */ __name((arr, p) => {
  const seen = /* @__PURE__ */ new Set();
  return (arr || []).map((x, i) => {
    let id = str(x.id, 20) || p + (i + 1);
    while (seen.has(id)) id += "x";
    seen.add(id);
    return { ...x, id };
  });
}, "idList");
function readSheet(b) {
  const mode = shared_exports.SHEET_MODES.includes(b.mode) ? b.mode : null;
  need(mode && str(b.name, 140), "badInput");
  const sections = idList(b.sections, "s").slice(0, 30).map((s) => ({
    id: s.id,
    title: str(s.title, 120),
    ...mode === "penalty" && bool(s.col2) ? { col2: true } : {},
    items: idList(s.items, "i" + s.id + "_").slice(0, 80).map((it2) => ({ id: it2.id, text: str(it2.text, 240), ...mode === "penalty" ? { penalty: str(it2.penalty, 8) || "3" } : {} }))
  }));
  need(sections.some((s) => s.items.length) && sections.every((s) => s.items.every((i) => i.text)), "badInput");
  const rule = mode === "penalty" ? { maxPenalty: num(b.rule?.maxPenalty, 0, 9999, 40) } : mode === "rating" ? { minAvg: num(b.rule?.minAvg, 1, 5, 3), failBelow: num(b.rule?.failBelow, 1, 5, 2) } : {};
  return {
    name: str(b.name, 140),
    mode,
    title: str(b.title, 120),
    subtitle: str(b.subtitle, 120),
    note: str(b.note, 600),
    disqNote: str(b.disqNote, 200),
    sections,
    rule,
    timePenalty: mode === "penalty" && bool(b.timePenalty),
    headerFields: idList(b.headerFields, "h").slice(0, 24).map((h) => ({ id: h.id, label: str(h.label, 60), type: shared_exports.HEADER_TYPES.includes(h.type) ? h.type : "text", auto: shared_exports.HEADER_AUTO.includes(h.auto) ? h.auto : "", group: str(h.group, 40) })).filter((h) => h.label),
    ...mode === "penalty" ? { timeRate: num(b.timeRate, 0, 100, 1) } : {},
    disq: mode === "rating" ? [] : idList(b.disq, "d").slice(0, 20).map((d) => ({ id: d.id, text: str(d.text, 120) })).filter((d) => d.text)
  };
}
__name(readSheet, "readSheet");
async function suggestNo(c, st, prefix, year) {
  const cfg = shared_exports.numCfg(st), name = shared_exports.certCounterName(cfg, prefix, year);
  let n = Math.max(await c.D.peek(name), cfg.start - 1) + 1;
  for (let i = 0; i < 5e3; i++, n++) {
    const no = shared_exports.fmtCertNo(cfg, prefix, year, n);
    if (!await c.D.get("certs", no) && !await c.D.get("retired", no) && !await c.D.get("archive", no)) return { no, n, name, cfg };
  }
  throw new H(500, "server");
}
__name(suggestNo, "suggestNo");
async function insertCert(c, st, prefix, year, requested, build) {
  const cfg = shared_exports.numCfg(st), name = shared_exports.certCounterName(cfg, prefix, year);
  if (requested) {
    const no = shared_exports.normCertNo(requested);
    need(shared_exports.goodCertNo(no), "badCertNo");
    if (await c.D.get("retired", no) || await c.D.get("archive", no)) throw new H(409, "dupCert");
    const doc = await build(no);
    try {
      await c.D.insert("certs", no, doc);
    } catch (e) {
      if (e instanceof H && e.message === "dup") throw new H(409, "dupCert");
      throw e;
    }
    const head = `${prefix || cfg.prefix}${cfg.sep}${shared_exports.yearPart(cfg, year)}${cfg.sep}`, tail = no.startsWith(head) ? no.slice(head.length) : "";
    if (/^\d+$/.test(tail)) await c.D.bump(name, Number(tail));
    return doc;
  }
  for (let i = 0; i < 25; i++) {
    if (await c.D.peek(name) < cfg.start - 1) await c.D.bump(name, cfg.start - 1);
    const no = shared_exports.fmtCertNo(cfg, prefix, year, await c.D.seq(name));
    if (await c.D.get("retired", no) || await c.D.get("archive", no)) continue;
    const doc = await build(no);
    try {
      await c.D.insert("certs", no, doc);
      return doc;
    } catch (e) {
      if (!(e instanceof H && e.message === "dup")) throw e;
    }
  }
  throw new H(500, "server");
}
__name(insertCert, "insertCert");
var s_bid = /* @__PURE__ */ __name((b, blank) => blank.id, "s_bid");
function applyCertOverrides(snap, o) {
  const v = /* @__PURE__ */ __name((k) => {
    const x = (o[k] ?? "").toString().trim();
    return x;
  }, "v");
  if (v("nameAz") || v("nameEn")) snap.names = { az: v("nameAz") || snap.names.az, en: v("nameEn") || snap.names.en };
  for (const k of ["titleAz", "titleEn", "qualAz", "qualEn", "descAz", "descEn", "footAz", "footEn", "provider"]) if (o[k] !== void 0 && String(o[k]).trim()) snap.blank[k] = String(o[k]).slice(0, 2e3);
  if (o.trainingName !== void 0 && String(o.trainingName).trim()) snap.blank.name = String(o.trainingName).slice(0, 200);
  if (o.credits !== void 0 && String(o.credits).trim()) snap.blank.credits = String(o.credits).slice(0, 20);
  if (o.trainerName !== void 0) snap.trainer = String(o.trainerName).slice(0, 120);
  if (o.companyName !== void 0 && String(o.companyName).trim()) {
    snap.company = String(o.companyName).slice(0, 120);
    if (!o.coMode) {
      snap.coMode = "show";
      snap.showCo = true;
    }
  }
  if (o.labels) snap.blank.labels = shared_exports.cleanLabels(o.labels);
}
__name(applyCertOverrides, "applyCertOverrides");
var trainingRoutes = {
  /* ---------------------------------------------------------------- blanks */
  "POST /blank/save": { auth: "staff", act: "blank.save", async fn(c) {
    const b = await c.body(), f = readBlank(b);
    let x;
    if (f.defaultSheetId) need(await c.D.get("sheets", f.defaultSheetId), "badInput");
    let was = null;
    if (b.id) {
      x = await c.D.get("blanks", str(b.id, 60));
      need(x, "noRec", 404);
      was = { ...x };
      Object.assign(x, f);
    } else x = { id: uid("b"), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put("blanks", [{ id: x.id, data: x }]);
    await audit(c, b.id ? "blank.update" : "blank.create", x.name, { entity: { kind: "blank", id: x.id, label: x.name }, changes: was ? diff(was, x, Object.keys(f)) : [] });
    return { blank: x };
  } },
  /* ----------------------------------------------------------------- sheets */
  "POST /sheet/save": { auth: "staff", act: "sheet.save", async fn(c) {
    const b = await c.body(), f = readSheet(b);
    let x, was = (
      /** @type {any} */
      null
    );
    if (b.id) {
      x = await c.D.get("sheets", str(b.id, 60));
      need(x, "noRec", 404);
      need(x.mode === f.mode || !(await c.D.query("enr", { where: [["prac.sheetId", "eq", x.id]], limit: 1 })).rows.length, "sheetModeLocked", 409);
      was = { ...x };
      Object.assign(x, f);
    } else x = { id: uid("p"), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put("sheets", [{ id: x.id, data: x }]);
    await audit(c, b.id ? "sheet.update" : "sheet.create", x.name, { entity: { kind: "sheet", id: x.id, label: x.name }, changes: was ? diff({ name: was.name, mode: was.mode, note: was.note, rule: was.rule, items: shared_exports.sheetItems(was).map((i) => i.text + ":" + (i.penalty || "")).join("|"), disq: (was.disq || []).length }, { name: x.name, mode: x.mode, note: x.note, rule: x.rule, items: shared_exports.sheetItems(x).map((i) => i.text + ":" + (i.penalty || "")).join("|"), disq: (x.disq || []).length }) : [] });
    return { sheet: x };
  } },
  /* -------------------------------------------------------------- materials */
  "POST /material/upload": { auth: "staff", act: "material.save", raw: true, async fn(c) {
    const title2 = str(c.url.searchParams.get("title"), 140), file = str(c.url.searchParams.get("name"), 200), slides = num(c.url.searchParams.get("slides"), 0, 2e3, 0);
    const buf = await c.req.arrayBuffer();
    need(title2 && buf.byteLength > 100 && buf.byteLength <= 6e7, "badInput");
    const sig = new Uint8Array(buf.slice(0, 4)), pptx = sig[0] === 80 && sig[1] === 75 && /\.pptx$/i.test(file), pdf = sig[0] === 37 && sig[1] === 80 && sig[2] === 68 && sig[3] === 70 && /\.pdf$/i.test(file);
    need(pptx || pdf, "badFile");
    const id = uid("m"), key = id + "-" + rnd(6) + (pdf ? ".pdf" : ".pptx");
    await c.B.put("materials/" + key, buf, { httpMetadata: { contentType: "application/octet-stream" } });
    const x = {
      id,
      title: title2,
      key,
      fileName: file,
      format: pdf ? "pdf" : "pptx",
      size: buf.byteLength,
      slides,
      at: new Date(c.now()).toISOString(),
      by: c.user.email,
      status: shared_exports.mayPublish(c.user, await getSettings(c.D), "materials") ? "active" : "pending"
    };
    await c.D.put("materials", [{ id, data: x }]);
    await audit(c, "material.upload", title2);
    return J({ material: x });
  } },
  "POST /material/update": { auth: "staff", act: "material.save", async fn(c) {
    const b = await c.body(), x = await c.D.get("materials", str(b.id, 60));
    need(x, "noRec", 404);
    need(str(b.title, 140), "badInput");
    x.title = str(b.title, 140);
    await c.D.put("materials", [{ id: x.id, data: x }]);
    return { material: x };
  } },
  "GET /material/get": { auth: "staff", act: "material.view", raw: true, async fn(c) {
    const x = await c.D.get("materials", str(c.url.searchParams.get("id"), 60));
    need(x, "noRec", 404);
    const o = await c.B.get("materials/" + x.key);
    need(o, "noRec", 404);
    return new Response(o.body, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  } },
  /* --------------------------------------------------------------- sessions */
  "POST /session/save": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), today = c.today();
    const f = {
      bid: str(b.bid, 60),
      tid: str(b.tid, 60),
      date: str(b.date, 10),
      endDate: str(b.endDate, 10),
      time: str(b.time, 5),
      location: str(b.location, 160),
      notes: str(b.notes, 600),
      sheetId: str(b.sheetId, 60),
      materials: [...new Set((b.materials || []).map((x) => str(x, 60)))].slice(0, 30),
      traineeIds: [...new Set((b.traineeIds || []).map((x) => str(x, 60)))].slice(0, 500),
      // printed on this session's certificates (they can differ every time): details under the training name, a registration
      // line above "valid till", and the company line
      certDetails: str(b.certDetails, 600),
      certReg: str(b.certReg, 160),
      coMode: shared_exports.CO_MODES.includes(b.coMode) ? b.coMode : "",
      coText: str(b.coText, 200)
    };
    need(await c.D.get("blanks", f.bid), "badInput");
    const tr = await c.D.get("trainers", f.tid);
    need(tr && tr.on !== false, "badTrainer");
    need(shared_exports.isDate(f.date), "badDate");
    need(!f.endDate || shared_exports.isDate(f.endDate) && f.endDate >= f.date && shared_exports.daysBetween(f.date, f.endDate) < MAX_DAYS, "badDate");
    if (f.endDate === f.date) f.endDate = "";
    need(!f.time || /^\d{2}:\d{2}$/.test(f.time), "badInput");
    if (f.sheetId) need(await c.D.get("sheets", f.sheetId), "badInput");
    for (const m of f.materials) {
      const mx = await c.D.get("materials", m);
      need(mx, "badInput");
      need(shared_exports.usable(mx), "materialNotApproved", 409);
    }
    for (const t of f.traineeIds) need(await c.D.get("trainees", t), "badInput");
    const link = httpUrl(b.examLink);
    need(link !== null, "badLink");
    f.examLink = link;
    f.examMode = ["", "link", "bank"].includes(b.examMode) ? b.examMode : link ? "link" : "";
    f.examId = "";
    if (f.examMode === "link") need(link, "badLink");
    f.examCount = 0;
    f.examMinutes = f.examMode === "bank" ? num(b.examMinutes, 0, 600, 0) : 0;
    if (f.examMode === "bank") {
      f.examId = str(b.examId, 60);
      const x = f.examId && await c.D.get("tests", f.examId);
      need(x, "needTest");
      need(!x.draft, "testDraft", 409);
      need(shared_exports.usable(x), "testNotApproved", 409);
      f.examLink = "";
      f.examCount = num(b.examCount, 0, 1e3, 0);
      if (f.examCount > poolSize(x)) throw new H(400, "poolTooSmall", { n: poolSize(x), k: f.examCount });
    }
    if (!f.examMode) f.examLink = "";
    let s;
    if (b.id) {
      s = await c.D.get("sessions", str(b.id, 60));
      need(s, "noRec", 404);
      for (const gone of (s.traineeIds || []).filter((t) => !f.traineeIds.includes(t))) {
        const e = await c.D.get("enr", enrId(s.id, gone));
        if (e && (e.att || e.fb || e.ev || e.prac || e.exam || e.final)) throw new H(409, "hasData", { tid: gone });
        await c.D.del("enr", enrId(s.id, gone));
      }
      var was = { ...s };
      Object.assign(s, f);
    } else s = { id: uid("s"), ...f, createdAt: new Date(c.now()).toISOString(), by: c.user.email };
    const warnings = clashes(s, await overlapping(c.D, s.date, s.endDate || s.date));
    await c.D.put("sessions", [{ id: s.id, data: s }]);
    await audit(c, b.id ? "session.update" : "session.create", `${s.id} ${s.date}`, { entity: { kind: "session", id: s.id, label: `${s.date} ${(await c.D.get("blanks", s.bid))?.name || ""}` }, changes: was ? diff({ ...was, traineeIds: (was.traineeIds || []).length, materials: (was.materials || []).length }, { ...s, traineeIds: s.traineeIds.length, materials: s.materials.length }, [...Object.keys(f)]) : [] });
    {
      const tn = (await c.D.get("blanks", s.bid))?.name || "", when = shared_exports.fmtDate(s.date) + (s.endDate ? " \u2013 " + shared_exports.fmtDate(s.endDate) : "");
      if (!was || was.tid !== s.tid) await notify(c, "trainer:" + s.tid, "nSessionNew", [tn, when], "#/" + s.id);
      const added = s.traineeIds.filter((x) => !(was?.traineeIds || []).includes(x));
      if (added.length) await notify(c, added.map((x) => "trainee:" + x), "nSessionAdded", [tn, when]);
    }
    const certsBehind = b.id ? (await certLinesBehind(c, s)).length : 0;
    return { session: sessionRow(s, await enrsOfSession(c.D, s), today), warnings, certsBehind };
  } },
  /* The session's certificate lines (details, registration line, company line) copied onto the certificates already issued
     from it. { id, withdraw }: withdraw = the signatures are withdrawn (they are signed again); otherwise they are kept - the
     signed data (names, learner number, training, dates) does not change. */
  "POST /session/cert-lines": { auth: "staff", act: "cert.update", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.id, 60));
    need(s, "noRec", 404);
    const list2 = await certLinesBehind(c, s), withdraw = bool(b.withdraw), appr = shared_exports.approvalsCfg(await getSettings(c.D)).certs;
    for (const x of list2) {
      applyLines(x.snap, s);
      if (withdraw) {
        await unsign(c, [slot.cert(x.no)]);
        delete x.sign;
        delete x.esign;
        if (appr) x.approval = { status: "pending", at: new Date(c.now()).toISOString(), by: c.user.email, change: true };
      }
    }
    if (list2.length) await c.D.put("certs", list2.map((x) => ({ id: x.no, data: x })));
    await audit(c, "cert.lines", `${s.id} \xB7 ${list2.length} certificate(s)${withdraw ? " \xB7 signatures withdrawn" : ""}`);
    return { updated: list2.length };
  } },
  "GET /session/clashes": { auth: "staff", act: "view", async fn(c) {
    const q2 = c.url.searchParams, qf = q2.get("from") || "", qt = q2.get("to") || "", from = shared_exports.isDate(qf) ? qf : daysBefore(c.today(), RECENT_DAYS), to = shared_exports.isDate(qt) ? qt : "9999-12-31";
    const all = await overlapping(c.D, from, to), out3 = {};
    for (const s of all) {
      if (s.date < from) continue;
      const w = clashes(s, all);
      if (w.length) out3[s.id] = w;
    }
    return { clashes: out3 };
  } },
  "POST /session/close": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), s = await c.D.get("sessions", str(b.id, 60));
    need(s, "noRec", 404);
    if ("closed" in b) s.closed = bool(b.closed);
    if ("cancelled" in b) s.cancelled = bool(b.cancelled);
    await c.D.put("sessions", [{ id: s.id, data: s }]);
    await audit(c, "session.status", `${s.id} closed=${!!s.closed} cancelled=${!!s.cancelled}`);
    return { session: sessionRow(s, await enrsOfSession(c.D, s), c.today()) };
  } },
  "GET /session": { auth: "staff", act: "view", async fn(c) {
    const s = await c.D.get("sessions", str(c.url.searchParams.get("id"), 60));
    need(s, "noRec", 404);
    const [enrs, certs, st, signs, people2] = await Promise.all([enrsOfSession(c.D, s), c.D.query("certs", { where: [["sid", "eq", s.id]] }), getSettings(c.D), sessionSigns(c, s.id), getMany(c.D, "trainees", s.traineeIds || [])]);
    const today = c.today(), soon = st.soonDays ?? shared_exports.SOON_DAYS;
    return { session: sessionRow(s, enrs, today), enrs, certs: certs.rows.map((r) => ({ ...clean2(r.data), st: certSt(r.data, today, soon) })), signs, people: [...people2.values()].map((t) => strip(c, clean2(t))) };
  } },
  /* ------------------------------------------------- enrolment (admin side) */
  "POST /enr/confirm": { auth: "staff", act: "attendance.confirm", async fn(c) {
    const b = await c.body();
    return { enr: await confirmFor(c, b.sid, b.tid, bool(b.undo)) };
  } },
  "POST /enr/attendance": { auth: "staff", act: "attendance.confirm", async fn(c) {
    const b = await c.body();
    return rollCall(c, b.sid, b.absent, b.day);
  } },
  /* approval countersignature on any session document: approver or superadmin, electronic or with their own signature image */
  "POST /sign/doc": { auth: "staff", act: "doc.sign", async fn(c) {
    const b = await c.body(), doc = str(b.doc, 10), s = await loadSession(c, b.sid);
    need(doc in APPR_DOCS, "badInput");
    const tid = APPR_DOCS[doc] ? str(b.tid, 60) : "";
    need(!APPR_DOCS[doc] || (s.traineeIds || []).includes(tid), "badInput");
    const mode = b.mode === "image" ? "image" : "esign";
    const sg = await sign(c, slot.appr(doc, s.id, tid), doc, { sid: s.id, ...tid ? { tid } : {} }, "approver", { mode });
    return { sign: sg, signs: await sessionSigns(c, s.id) };
  } },
  "POST /sign/doc/withdraw": { auth: "staff", act: "doc.sign", async fn(c) {
    const b = await c.body(), doc = str(b.doc, 10), s = await loadSession(c, b.sid);
    need(doc in APPR_DOCS, "badInput");
    const id = slot.appr(doc, s.id, APPR_DOCS[doc] ? str(b.tid, 60) : ""), r = await c.D.get("signs", id);
    need(r, "noRec", 404);
    need(r.by.id === c.user.id || c.user.role === "superadmin", "forbidden", 403);
    await unsign(c, [id]);
    return { signs: await sessionSigns(c, s.id) };
  } },
  /* attendance sheets are signed only by the trainer (trainer portal): the office does not sign them */
  /* final-day documents of a multi-day training: opened by the trainer on the final day (the office can also open / close them) */
  "POST /session/docs": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid);
    return { session: await openDocs(c, s, bool(b.open)) };
  } },
  "POST /enr/practical": { auth: "staff", act: "practical.save", async fn(c) {
    const b = await c.body();
    return { enr: await savePractical(c, b.sid, b.tid, b.data || {}) };
  } },
  /* Exam result. Not possible after a failed practical (automatic fail) or while the practical is still open. */
  "POST /enr/exam": { auth: "staff", act: "exam.save", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(e.att, "notConfirmed", 409);
    need(!e.final, "locked", 409);
    if (s.sheetId) {
      need(e.prac && e.prac.result !== "INCOMPLETE", "needPractical", 409);
      need(e.prac.result !== "FAIL", "practicalFail", 409);
    }
    if (b.passed === null || b.passed === void 0) delete e.exam;
    else {
      need(typeof b.passed === "boolean", "badInput");
      e.exam = { passed: b.passed, score: num(b.score, 0, 1e3), note: str(b.note, 500), at: new Date(c.now()).toISOString(), by: c.user.email };
    }
    await saveEnr(c.D, e);
    await unsign(c, [slot.exam(s.id)]);
    await audit(c, "exam.save", `${s.id} ${b.tid} ${b.passed}`);
    return { enr: e };
  } },
  /* Exam results from a CSV file (learner number; score; optional PASS/FAIL). Rows are matched to this session's candidates. */
  "POST /enr/exam/bulk": { auth: "staff", act: "exam.save", async fn(c) {
    const b = await c.body(), s = await loadSession(c, b.sid), rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
    need(rows.length, "badInput");
    const passMark = num(b.passMark, 0, 1e3, null), byAtt = /* @__PURE__ */ new Map();
    for (const tid of s.traineeIds || []) {
      const t = await c.D.get("trainees", tid);
      if (t) byAtt.set(String(t.att).toUpperCase(), t);
    }
    const out3 = [];
    for (const [i, r] of rows.entries()) {
      const att = str(r.att, 20).toUpperCase(), t = byAtt.get(att), res = { row: r.row ?? i + 1, att };
      try {
        need(t, "notEnrolled", 404);
        const e = await enrOf(c.D, s.id, t.id);
        need(e.att, "notConfirmed", 409);
        need(!e.final, "locked", 409);
        if (s.sheetId) {
          need(e.prac && e.prac.result !== "INCOMPLETE", "needPractical", 409);
          need(e.prac.result !== "FAIL", "practicalFail", 409);
        }
        const score = num(String(r.score ?? "").replace(",", "."), 0, 1e3), word = str(r.result, 10).toUpperCase();
        const passed = /^(PASS|P|KEÇDİ|KECDI|1|YES)$/.test(word) ? true : /^(FAIL|F|KƏSİLDİ|KESILDI|0|NO)$/.test(word) ? false : score !== null && passMark !== null ? score >= passMark : null;
        need(passed !== null, "badInput");
        e.exam = { passed, score, note: "CSV", at: new Date(c.now()).toISOString(), by: c.user.email };
        await saveEnr(c.D, e);
        await unsign(c, [slot.exam(e.sid)]);
        out3.push({ ...res, ok: true, passed, score, name: shared_exports.fullAz(t) });
      } catch (x) {
        if (!(x instanceof H)) throw x;
        out3.push({ ...res, ok: false, error: x.message, name: t ? shared_exports.fullAz(t) : "" });
      }
    }
    await audit(c, "exam.import", `${s.id} ${out3.filter((x) => x.ok).length}/${rows.length}`, { entity: { kind: "session", id: s.id, label: s.date } });
    return { results: out3 };
  } },
  "POST /enr/reopen": { auth: "staff", act: "issue", async fn(c) {
    const b = await c.body(), { s, e } = await loadEnrolled(c, b.sid, b.tid);
    need(e.final && !e.final.certNo, "badInput", 409);
    delete e.final;
    await saveEnr(c.D, e);
    await c.D.del("rel", enrId(s.id, b.tid));
    await audit(c, "enr.reopen", `${s.id} ${b.tid}`);
    return { enr: e };
  } },
  /* ------------------------------------------------------- issue / release */
  /* Open results only: enrolments with attendance and no final decision (database index), not every enrolment ever. */
  "GET /issue/queue": { auth: "staff", act: "issue", async fn(c) {
    const today = c.today(), out3 = [];
    const [open, st, blanks, cos] = await Promise.all([
      c.D.query("enr", { where: [["final", "null", true], ["att", "null", false]] }),
      getSettings(c.D),
      c.D.all("blanks").then((r) => new Map(r.map((x) => [x.id, x.data]))),
      c.D.all("companies").then((r) => new Map(r.map((x) => [x.id, x.data.name])))
    ]);
    const enrs = open.rows.map((r) => r.data), opts = outcomeOpts(st);
    const [sessions, trainees] = await Promise.all([getMany(c.D, "sessions", enrs.map((e) => e.sid)), getMany(c.D, "trainees", enrs.map((e) => e.tid))]);
    for (const e of enrs) {
      const s = sessions.get(e.sid), t = trainees.get(e.tid);
      if (!s || s.cancelled || !t || !(s.traineeIds || []).includes(e.tid)) continue;
      out3.push({
        sid: s.id,
        tid: e.tid,
        date: s.date,
        endDate: s.endDate || "",
        status: shared_exports.sessionStatus(s, null, today),
        blank: blanks.get(s.bid)?.name || "",
        bid: s.bid,
        att: t.att,
        az: shared_exports.fullAz(t),
        en: shared_exports.fullEn(t),
        foreign: !!t.foreign,
        company: shared_exports.isPrivateCompany(cos.get(t.co), t.co) ? "" : cos.get(t.co),
        ...shared_exports.computeOutcome(e, s, opts)
      });
    }
    return { list: out3.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0) };
  } },
  "GET /issue/suggest": { auth: "staff", act: "issue", async fn(c) {
    const st = await getSettings(c.D), blank = await c.D.get("blanks", str(c.url.searchParams.get("bid"), 60));
    need(blank, "noRec", 404);
    const end = str(c.url.searchParams.get("end"), 10);
    need(shared_exports.isDate(end), "badDate");
    const year = Number(c.today().slice(0, 4)), sg = await suggestNo(c, st, blank.prefix, year);
    return { no: sg.no, expiry: shared_exports.expiryFrom(end, blank.months), months: blank.months };
  } },
  /* Release: decides PASS/FAIL. FAIL never creates a certificate. PASS creates it with the confirmed number + expiry. */
  "POST /issue": { auth: "staff", act: "issue", async fn(c) {
    const b = await c.body();
    return release2(c, b.sid, b.tid, { no: b.no, expiry: b.expiry, signMode: str(b.sign, 10) });
  } },
  /* Several releases in one go ("Release all ready"). Each one is independent; numbers are allocated automatically. */
  "POST /issue/bulk": { auth: "staff", act: "issue", async fn(c) {
    const b = await c.body(), items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
    need(items.length, "badInput");
    const out3 = [];
    for (const it2 of items) {
      try {
        const r = await release2(c, it2.sid, it2.tid, { signMode: str(b.sign, 10) });
        out3.push({ sid: it2.sid, tid: it2.tid, ok: true, ...r });
      } catch (e) {
        if (!(e instanceof H)) throw e;
        out3.push({ sid: it2.sid, tid: it2.tid, ok: false, error: e.message });
      }
    }
    return { results: out3 };
  } },
  /* Direct certificate (superadmin only): a fully custom certificate issued without a training session, e.g. for an external
     achievement or a correction. It is tied to an existing trainee (so the learner number and renewals stay correct); every
     printed field can be overridden. The number is unique, like every other certificate. "renewOf" carries the learner
     number forward when renewing an expired certificate. */
  "POST /cert/issue-direct": { auth: "staff", act: "issue", async fn(c) {
    need(c.user.role === "superadmin", "forbidden", 403);
    const b = await c.body(), st = await getSettings(c.D);
    const trainee = await c.D.get("trainees", str(b.tid, 60));
    need(trainee, "noTrainee", 404);
    need(!trainee.temp && trainee.att, "tempAccount", 409);
    const blank = await c.D.get("blanks", str(b.bid, 60));
    need(blank, "badBlank", 400);
    const trainer = b.trainerId ? await c.D.get("trainers", str(b.trainerId, 60)) : null;
    const company = trainee.co ? await c.D.get("companies", trainee.co) : null;
    const start = str(b.start, 10) || c.today();
    need(shared_exports.isDate(start), "badDate");
    const end = str(b.end, 10) || start;
    need(shared_exports.isDate(end) && end >= start, "badDate");
    const expiry = str(b.expiry, 10) || shared_exports.expiryFrom(end, blank.months);
    need(shared_exports.isDate(expiry) && expiry >= end, "badDate");
    const snap = buildSnap({ trainee, company, trainer, blank, st, session: { certDetails: str(b.custom?.details, 600), certReg: str(b.custom?.reg, 160), coMode: shared_exports.CO_MODES.includes(b.custom?.coMode) ? b.custom.coMode : "", coText: str(b.custom?.coText, 200) } });
    applyCertOverrides(snap, b.custom || {});
    const year = Number(start.slice(0, 4)), at = new Date(c.now()).toISOString();
    const doc = await insertCert(c, st, blank.prefix, year, str(b.no, 40), async (n) => ({
      no: n,
      tid: trainee.id,
      att: trainee.att,
      sid: "",
      bid: s_bid(b, blank),
      co: company && !shared_exports.isPrivateCompany(company.name, company.id) ? company.id : "",
      start,
      end,
      expiry,
      issuedAt: at,
      by: c.user.email,
      direct: true,
      vh: await vh(c.env, n),
      snap,
      ...shared_exports.approvalsCfg(st).certs && str(b.sign, 10) !== "esign" && str(b.sign, 10) !== "image" ? { approval: { status: "pending", at, by: c.user.email } } : {}
    }));
    await audit(c, "cert.direct", `${doc.no} ${trainee.att}${b.renewOf ? " \xB7 renew of " + shared_exports.normCertNo(b.renewOf) : ""}`, { entity: { kind: "cert", id: doc.no, label: doc.no } });
    const mode = str(b.sign, 10);
    if (mode && shared_exports.can(c.user.role, "cert.sign")) {
      try {
        return { cert: await signCert(c, doc.no, mode) };
      } catch (x) {
        if (!(x instanceof H)) throw x;
        return { cert: doc, signError: x.message };
      }
    }
    return { cert: doc };
  } },
  /* ----------------------------------------------------------- certificates */
  // GET /certs: routes_find.js (searched and paged in the database)
  "POST /cert/update": { auth: "staff", act: "cert.update", async fn(c) {
    const b = await c.body(), no = shared_exports.normCertNo(b.no), x = await c.D.get("certs", no);
    need(x, "noRec", 404);
    const p = b.patch || {}, was = { names: x.snap.names, company: x.snap.company, trainer: x.snap.trainer, start: x.start, end: x.end, expiry: x.expiry, texts: JSON.stringify([x.snap.blank, x.snap.details, x.snap.reg, x.snap.coMode, x.snap.coText, x.snap.att]) };
    if (p.names) {
      x.snap.names = { az: str(p.names.az, 160), en: str(p.names.en, 160) };
      need(x.snap.names.en, "badInput");
    }
    if ("company" in p) x.snap.company = str(p.company, 160);
    if ("trainer" in p) x.snap.trainer = str(p.trainer, 120);
    if ("coMode" in p) {
      x.snap.coMode = shared_exports.CO_MODES.includes(p.coMode) && p.coMode ? p.coMode : "hide";
      x.snap.showCo = x.snap.coMode === "show";
    }
    if ("coText" in p) x.snap.coText = str(p.coText, 200);
    if ("details" in p) x.snap.details = str(p.details, 600);
    if ("reg" in p) x.snap.reg = str(p.reg, 160);
    if ("att" in p) x.snap.att = str(p.att, 40);
    if ("lang" in p) x.snap.lang = p.lang === "en" ? "en" : "both";
    const bl = p.blank || {}, LIM = { name: 100, titleAz: 120, titleEn: 120, qualAz: 160, qualEn: 160, descAz: 1200, descEn: 1200, footAz: 500, footEn: 500, provider: 160 };
    for (const [k, n] of Object.entries(LIM)) if (k in bl) x.snap.blank[k] = str(bl[k], n);
    if ("credits" in bl) x.snap.blank.credits = num(bl.credits, 0, 99, 0);
    if (bl.labels) x.snap.blank.labels = shared_exports.cleanLabels(bl.labels);
    need(x.snap.blank.titleAz || x.snap.blank.titleEn, "badInput");
    for (const k of ["start", "end", "expiry"]) if (p[k]) {
      need(shared_exports.isDate(p[k]), "badDate");
      x[k] = p[k];
    }
    const end = x.end || x.start;
    need(end >= x.start && (!x.expiry || x.expiry >= end), "badDate");
    if (shared_exports.approvalsCfg(await getSettings(c.D)).certs) x.approval = { status: "pending", at: new Date(c.now()).toISOString(), by: c.user.email, change: true };
    const nn = p.newNo && shared_exports.normCertNo(p.newNo);
    if (nn && nn !== no) {
      need(shared_exports.goodCertNo(nn), "badCertNo");
      x.no = nn;
      x.vh = await vh(c.env, nn);
      try {
        await c.D.insert("certs", nn, x);
      } catch (e2) {
        if (e2 instanceof H && e2.message === "dup") throw new H(409, "dupCert");
        throw e2;
      }
      await c.D.del("certs", no);
      await c.D.put("retired", [{ id: no, data: { now: nn, at: new Date(c.now()).toISOString(), by: c.user.email } }]);
      const e = await c.D.get("enr", enrId(x.sid, x.tid));
      if (e?.final) {
        e.final.certNo = nn;
        await saveEnr(c.D, e);
      }
    } else await c.D.put("certs", [{ id: no, data: x }]);
    await unsign(c, [slot.cert(no), slot.cert(x.no)]);
    if (x.sign || x.esign) {
      delete x.sign;
      delete x.esign;
      await c.D.put("certs", [{ id: x.no, data: x }]);
    }
    await audit(c, "cert.update", `${no}${nn && nn !== no ? " -> " + nn : ""}`, { entity: { kind: "cert", id: x.no, label: x.no }, changes: [...diff(was, { names: x.snap.names, company: x.snap.company, trainer: x.snap.trainer, start: x.start, end: x.end, expiry: x.expiry, texts: JSON.stringify([x.snap.blank, x.snap.details, x.snap.reg, x.snap.coMode, x.snap.coText, x.snap.att]) }), ...nn && nn !== no ? [{ f: "no", from: no, to: nn }] : []] });
    return { cert: x };
  } },
  /* Signing certificates: admin / superadmin only, under their own name; electronically or with their own signature image.
     { nos: [...], mode: 'esign' | 'image' }  ·  /cert/unsign { no } withdraws a signature. */
  "POST /cert/sign": { auth: "staff", act: "cert.sign", async fn(c) {
    const b = await c.body(), nos = [...new Set((b.nos || [b.no]).filter(Boolean).map((x) => shared_exports.normCertNo(x)))].slice(0, 100);
    need(nos.length, "badInput");
    const out3 = [];
    for (const no of nos) {
      try {
        const x = await signCert(c, no, str(b.mode, 10));
        out3.push({ no, ok: true, sign: x.sign });
      } catch (e) {
        if (!(e instanceof H) || ["needName", "needSigImage"].includes(e.message)) throw e;
        out3.push({ no, ok: false, error: e.message });
      }
    }
    return { results: out3 };
  } },
  "POST /cert/unsign": { auth: "staff", act: "cert.sign", async fn(c) {
    const b = await c.body(), x = await unsignCert(c, shared_exports.normCertNo(b.no));
    need(x, "noRec", 404);
    return { cert: x };
  } },
  "POST /cert/revoke": { auth: "staff", act: "cert.revoke", async fn(c) {
    const b = await c.body(), no = shared_exports.normCertNo(b.no), x = await c.D.get("certs", no);
    need(x, "noRec", 404);
    if (bool(b.revoke)) x.revoked = { at: new Date(c.now()).toISOString(), by: c.user.email, reason: str(b.reason, 300) };
    else delete x.revoked;
    await c.D.put("certs", [{ id: no, data: x }]);
    await audit(c, bool(b.revoke) ? "cert.revoke" : "cert.restore", no + (x.revoked?.reason ? " \xB7 " + x.revoked.reason : ""), { entity: { kind: "cert", id: no, label: no } });
    return { cert: x };
  } }
};
var outcomeOpts = /* @__PURE__ */ __name((st) => ({ fbRequired: st.fbRequired !== false }), "outcomeOpts");
async function release2(c, sid, tid, { no, expiry: wanted, signMode = "" } = {}) {
  const { s, e } = await loadEnrolled(c, sid, tid), st = await getSettings(c.D);
  need(!e.final, "alreadyReleased", 409);
  const o = shared_exports.computeOutcome(e, s, outcomeOpts(st));
  if (o.outcome.startsWith("PENDING")) throw new H(409, { PENDING_PRACTICAL: "needPractical", PENDING_FEEDBACK: "needFeedback" }[o.outcome] || "needExam");
  const key = enrId(s.id, e.tid);
  try {
    await c.D.insert("rel", key, { at: new Date(c.now()).toISOString(), by: c.user.email });
  } catch (x) {
    if (x instanceof H && x.message === "dup") throw new H(409, "alreadyReleased");
    throw x;
  }
  try {
    const at = new Date(c.now()).toISOString();
    if (o.outcome !== "PASS") {
      e.final = { outcome: "FAIL", reason: o.reason || o.outcome.toLowerCase(), at, by: c.user.email };
      await saveEnr(c.D, e);
      await audit(c, "release.fail", `${s.id} ${e.tid} ${e.final.reason}`);
      return { result: "FAIL", reason: e.final.reason };
    }
    const [trainee, trainer, blank] = await Promise.all([c.D.get("trainees", e.tid), s.tid ? c.D.get("trainers", s.tid) : null, c.D.get("blanks", s.bid)]);
    need(trainee && blank, "noRec", 404);
    need(!trainee.temp && trainee.att, "tempAccount", 409);
    const company = trainee.co ? await c.D.get("companies", trainee.co) : null, end = shared_exports.sessionEnd(s);
    const expiry = str(wanted, 10) || shared_exports.expiryFrom(end, blank.months);
    need(shared_exports.isDate(expiry) && expiry >= end, "badDate");
    const year = Number(c.today().slice(0, 4));
    const doc = await insertCert(c, st, blank.prefix, year, str(no, 40), async (n) => ({
      no: n,
      tid: trainee.id,
      att: trainee.att,
      sid: s.id,
      bid: s.bid,
      co: company && !shared_exports.isPrivateCompany(company.name, company.id) ? company.id : "",
      start: s.date,
      end,
      expiry,
      issuedAt: at,
      by: c.user.email,
      vh: await vh(c.env, n),
      snap: buildSnap({ trainee, company, trainer, blank, st, session: s }),
      // with certificate approval on, the certificate reaches the candidate / company / QR page only after the approver's decision
      ...shared_exports.approvalsCfg(st).certs ? { approval: { status: "pending", at, by: c.user.email } } : {}
    }));
    e.final = { outcome: "PASS", certNo: doc.no, at, by: c.user.email };
    await saveEnr(c.D, e);
    await audit(c, "release.pass", `${doc.no} ${trainee.att}`, { entity: { kind: "cert", id: doc.no, label: doc.no } });
    if (signMode && shared_exports.can(c.user.role, "cert.sign")) {
      try {
        return { result: "PASS", cert: await signCert(c, doc.no, signMode) };
      } catch (x) {
        if (!(x instanceof H)) throw x;
        return { result: "PASS", cert: doc, signError: x.message };
      }
    }
    return { result: "PASS", cert: doc };
  } catch (x) {
    if (!e.final) await c.D.del("rel", key).catch(() => {
    });
    throw x;
  }
}
__name(release2, "release");
var MAX_DAYS = 62;
var overlapping = /* @__PURE__ */ __name(async (D, from, to) => (await D.query("sessions", { where: [["date", "gte", daysBefore(from, MAX_DAYS)], ["date", "lte", to]] })).rows.map((r) => r.data), "overlapping");
function clashes(s, all) {
  if (s.cancelled) return [];
  const end = /* @__PURE__ */ __name((x) => x.endDate || x.date, "end"), over = /* @__PURE__ */ __name((x) => x.date <= end(s) && s.date <= end(x), "over"), room = /* @__PURE__ */ __name((v) => String(v || "").trim().toLowerCase(), "room"), out3 = [];
  for (const x of all) {
    if (x.id === s.id || x.cancelled || !over(x)) continue;
    if (s.tid && x.tid === s.tid) out3.push({ kind: "trainer", id: x.id, date: x.date });
    else if (room(s.location) && room(s.location) === room(x.location) && (!s.time || !x.time || s.time === x.time)) out3.push({ kind: "room", id: x.id, date: x.date });
  }
  return out3;
}
__name(clashes, "clashes");

// _lib/mail.js
var mailReady = /* @__PURE__ */ __name((env2) => !!(env2?.RESEND_API_KEY && env2?.MAIL_FROM), "mailReady");
async function sendMail(env2, { to, subject, html }) {
  if (!mailReady(env2) || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env2.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: env2.MAIL_FROM, to: [to], subject, html, ...env2.MAIL_REPLY_TO ? { reply_to: env2.MAIL_REPLY_TO } : {} })
    });
    return r.ok;
  } catch {
    return false;
  }
}
__name(sendMail, "sendMail");
async function sendSms(env2, { to, text }) {
  if (!env2?.SMS_WEBHOOK_URL || !to) return false;
  try {
    const r = await fetch(env2.SMS_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", ...env2.SMS_WEBHOOK_TOKEN ? { authorization: "Bearer " + env2.SMS_WEBHOOK_TOKEN } : {} }, body: JSON.stringify({ to, text }) });
    return r.ok;
  } catch {
    return false;
  }
}
__name(sendSms, "sendSms");

// _lib/jobs.js
var escH = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]), "escH");
async function dueReminders(c) {
  const st = await getSettings(c.D), cfg = remindCfg(st), today = c.today();
  const horizon = new Date(Date.parse(today + "T00:00:00Z") + Math.max(0, ...cfg.days) * 864e5).toISOString().slice(0, 10);
  const certs = (await c.D.query("certs", { where: [["revoked", "null", true], ["renewed", "null", true], ["exp", "gte", today], ["exp", "lte", horizon]] })).rows.map((r) => r.data);
  const out3 = [];
  for (const x of certs) {
    if (x.st === "REVOKED" || x.st === "RENEWED") continue;
    const left = shared_exports.daysBetween(today, x.expiry);
    if (left < 0) continue;
    const due = cfg.days.filter((d) => left <= d && !x.rem?.[d]);
    if (!due.length) continue;
    out3.push({ cert: x, left, due });
  }
  return { cfg, st, list: out3 };
}
__name(dueReminders, "dueReminders");
async function runReminders(c, { dry = false } = {}) {
  const { cfg, st, list: list2 } = await dueReminders(c);
  const info3 = st.company || {}, sent = { company: 0, trainee: 0, sms: 0, skipped: 0 };
  if (dry || !cfg.on || !list2.length) return { dry: true, on: cfg.on, mail: mailReady(c.env), due: list2.map((r) => ({ no: r.cert.no, name: r.cert.snap?.names?.en, expiry: r.cert.expiry, left: r.left, co: r.cert.co })), sent };
  const [trainees, companies, blanks] = await Promise.all([getMany(c.D, "trainees", list2.map((r) => r.cert.tid)), ...["companies", "blanks"].map(async (k) => new Map((await c.D.all(k)).map((r) => [r.id, r.data])))]);
  const name = /* @__PURE__ */ __name((r) => r.cert.snap?.names?.en || r.cert.snap?.names?.az || r.cert.att, "name"), course = /* @__PURE__ */ __name((r) => blanks.get(r.cert.bid)?.name || r.cert.snap?.blank?.qualEn || "", "course");
  const line2 = /* @__PURE__ */ __name((r) => `${name(r)} \xB7 ${course(r)} \xB7 ${r.cert.no} \xB7 ${shared_exports.fmtDate(r.cert.expiry)} (${r.left} d)`, "line");
  const sign2 = `<p>${escH(info3.name || "KVET")}<br>${escH([info3.phone, info3.email, info3.website].filter(Boolean).join(" \xB7 "))}</p>`;
  if (cfg.toCompany) {
    const byCo = /* @__PURE__ */ new Map();
    for (const r of list2) if (r.cert.co) {
      if (!byCo.has(r.cert.co)) byCo.set(r.cert.co, []);
      byCo.get(r.cert.co).push(r);
    }
    for (const [co, rows] of byCo) {
      const x = companies.get(co);
      if (!x?.email) {
        sent.skipped += rows.length;
        continue;
      }
      const ok = await sendMail(c.env, {
        to: x.email,
        subject: `Sertifikatlar\u0131n m\xFCdd\u0259ti bitir / Certificates expiring \u2013 ${x.name}`,
        html: `<p>H\xF6rm\u0259tli ${escH(x.contactPerson || x.name)},</p><p>A\u015Fa\u011F\u0131dak\u0131 \u0259m\u0259kda\u015Flar\u0131n\u0131z\u0131n sertifikatlar\u0131n\u0131n m\xFCdd\u0259ti yax\u0131nla\u015F\u0131r. Yenil\u0259m\u0259 t\u0259limi \xFC\xE7\xFCn biziml\u0259 \u0259laq\u0259 saxlay\u0131n.<br><i>The certificates below expire soon. Please contact us to book refresher training.</i></p><ul>${rows.map((r) => `<li>${escH(line2(r))}</li>`).join("")}</ul>${sign2}`
      });
      if (ok) sent.company++;
    }
  }
  if (cfg.toTrainee) for (const r of list2) {
    const t = trainees.get(r.cert.tid);
    if (!t) continue;
    if (t.email && await sendMail(c.env, {
      to: t.email,
      subject: `Sertifikat\u0131n\u0131z\u0131n m\xFCdd\u0259ti bitir / Your certificate expires on ${shared_exports.fmtDate(r.cert.expiry)}`,
      html: `<p>${escH(name(r))},</p><p>${escH(course(r))} sertifikat\u0131n\u0131z\u0131n (${escH(r.cert.no)}) m\xFCdd\u0259ti ${escH(shared_exports.fmtDate(r.cert.expiry))} tarixind\u0259 bitir.<br><i>Your ${escH(course(r))} certificate (${escH(r.cert.no)}) expires on ${escH(shared_exports.fmtDate(r.cert.expiry))}.</i></p>${sign2}`
    })) sent.trainee++;
    if (t.phone && await sendSms(c.env, { to: t.phone, text: `${info3.name || "KVET"}: ${course(r)} sertifikat\u0131n\u0131z ${shared_exports.fmtDate(r.cert.expiry)} bitir / certificate expires.` })) sent.sms++;
  }
  const at = new Date(c.now()).toISOString();
  await c.D.put("certs", list2.map((r) => {
    const { st: _s, sk: _k, ...doc } = r.cert;
    doc.rem = { ...doc.rem || {} };
    for (const d of r.due) doc.rem[d] = at;
    return { id: doc.no, data: doc };
  }));
  await audit(c, "reminder.sent", `${list2.length} certificate(s) \xB7 company mails ${sent.company} \xB7 trainee mails ${sent.trainee} \xB7 sms ${sent.sms}`);
  return { dry: false, on: true, count: list2.length, sent };
}
__name(runReminders, "runReminders");
async function dueRetention(c) {
  const st = await getSettings(c.D), years = privacyCfg(st).finYears;
  if (!years) return { years, list: [] };
  const today = c.today(), limit = `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;
  const last = /* @__PURE__ */ new Map(), bump = /* @__PURE__ */ __name((tid, d) => {
    if (d && (!last.has(tid) || d > last.get(tid))) last.set(tid, d);
  }, "bump");
  const [certs, sessions, people2] = await Promise.all([c.D.query("certs", { fields: ["tid", "expiry"] }), c.D.query("sessions", { fields: ["traineeIds", "date", "endDate"] }), c.D.query("trainees", { where: [["fin", "empty", false]], fields: ["fin", "createdAt"] })]);
  for (const { data: x } of certs.rows) bump(x.tid, x.expiry);
  for (const { data: s } of sessions.rows) for (const tid of s.traineeIds || []) bump(tid, shared_exports.sessionEnd(s));
  const ids = people2.rows.filter((r) => (last.get(r.id) || (r.data.createdAt || "").slice(0, 10)) < limit).map((r) => r.id);
  const list2 = [...(await getMany(c.D, "trainees", ids)).values()].filter((t) => t.fin);
  return { years, limit, list: list2 };
}
__name(dueRetention, "dueRetention");
async function runRetention(c, { dry = false } = {}) {
  const { years, limit, list: list2 } = await dueRetention(c);
  if (dry || !list2.length) return { dry: true, years, limit, count: list2.length, people: list2.slice(0, 200).map((t) => ({ id: t.id, att: t.att, name: shared_exports.fullAz(t) })) };
  const at = new Date(c.now()).toISOString();
  await c.D.delMany("fins", list2.map((t) => t.fin));
  await c.D.put("trainees", list2.map((t) => ({ id: t.id, data: { ...t, fin: "", finRemovedAt: at } })));
  await audit(c, "privacy.retention", `ID/FIN removed for ${list2.length} person(s) inactive since before ${limit}`);
  return { dry: false, years, count: list2.length };
}
__name(runRetention, "runRetention");

// _lib/deletion.js
var KINDS = ["blank", "sheet", "material", "company", "trainer", "trainee", "session", "cert", "enrol"];
async function loadWorld(c) {
  const rows = /* @__PURE__ */ __name(async (col) => (await c.D.all(col)).map((r) => r.data), "rows");
  const [sessions, enrs, certs, trainees, trainers, companies, blanks, sheets, materials, groups] = await Promise.all(["sessions", "enr", "certs", "trainees", "trainers", "companies", "blanks", "sheets", "materials", "groups"].map(rows));
  const by = /* @__PURE__ */ __name((list2) => new Map(list2.map((x) => [x.id, x])), "by");
  return { sessions, enrs, certs, trainees, trainers, companies, blanks, sheets, materials, groups, sById: by(sessions), tById: by(trainees), certByNo: new Map(certs.map((x) => [x.no, x])), enrBy: new Map(enrs.map((e) => [enrId(e.sid, e.tid), e])) };
}
__name(loadWorld, "loadWorld");
async function loadWorldFor(c, kind, id) {
  const D = c.D, rows = /* @__PURE__ */ __name((r) => r.rows.map((x) => x.data), "rows"), q2 = /* @__PURE__ */ __name((col, where) => D.query(col, { where }).then(rows), "q");
  const sess = /* @__PURE__ */ new Map(), enrs = /* @__PURE__ */ new Map(), certs = /* @__PURE__ */ new Map(), people2 = /* @__PURE__ */ new Set();
  const addS = /* @__PURE__ */ __name((list2) => {
    for (const s of list2) if (s) {
      sess.set(s.id, s);
      for (const t of s.traineeIds || []) people2.add(t);
    }
  }, "addS");
  const addC = /* @__PURE__ */ __name((list2) => {
    for (const x of list2) if (x) {
      certs.set(x.no, x);
      people2.add(x.tid);
    }
  }, "addC");
  const addE = /* @__PURE__ */ __name((list2) => {
    for (const e of list2) if (e) {
      enrs.set(enrId(e.sid, e.tid), e);
      people2.add(e.tid);
    }
  }, "addE");
  if (kind === "session") addS([await D.get("sessions", id)]);
  else if (kind === "enrol") {
    const [sid] = id.split("|");
    addS([await D.get("sessions", sid)]);
  } else if (kind === "trainee") {
    people2.add(id);
    const [ss, es, cs] = await Promise.all([sessionsOf(D, id), q2("enr", [["tid", "eq", id]]), q2("certs", [["tid", "eq", id]])]);
    addS(ss);
    addE(es);
    addC(cs);
  } else if (kind === "blank") {
    const [ss, cs] = await Promise.all([q2("sessions", [["bid", "eq", id]]), q2("certs", [["bid", "eq", id]])]);
    addS(ss);
    addC(cs);
  } else if (kind === "sheet") addS(await q2("sessions", [["sheetId", "eq", id]]));
  else if (kind === "material") addS(await q2("sessions", [["materials", "has", id]]));
  else if (kind === "trainer") addS(await q2("sessions", [["tid", "eq", id]]));
  else if (kind === "company") {
    const [ts, cs] = await Promise.all([q2("trainees", [["co", "eq", id]]), q2("certs", [["co", "eq", id]])]);
    for (const t of ts) people2.add(t.id);
    addC(cs);
  } else if (kind === "cert") {
    const x = await D.get("certs", id);
    if (x) {
      addC([x]);
      if (x.sid) addS([await D.get("sessions", x.sid)]);
    }
  }
  const sids = [...sess.keys()];
  for (let i = 0; i < sids.length; i += 60) {
    const part = sids.slice(i, i + 60);
    const [es, cs] = await Promise.all([q2("enr", [["sid", "in", part]]), q2("certs", [["sid", "in", part]])]);
    addE(es);
    addC(cs);
  }
  const small = /* @__PURE__ */ __name(async (col) => (await D.all(col)).map((r) => r.data), "small");
  const [trainees, trainers, companies, blanks, sheets, materials, groups] = await Promise.all([getMany(D, "trainees", [...people2]).then((m) => [...m.values()]), ...["trainers", "companies", "blanks", "sheets", "materials", "groups"].map(small)]);
  const sessions = [...sess.values()], E = [...enrs.values()], C = [...certs.values()], by = /* @__PURE__ */ __name((list2) => new Map(list2.map((x) => [x.id, x])), "by");
  return { sessions, enrs: E, certs: C, trainees, trainers, companies, blanks, sheets, materials, groups, sById: by(sessions), tById: by(trainees), certByNo: new Map(C.map((x) => [x.no, x])), enrBy: new Map(E.map((e) => [enrId(e.sid, e.tid), e])) };
}
__name(loadWorldFor, "loadWorldFor");
function newPlan(c, w) {
  const P = { del: {}, upd: {}, arch: /* @__PURE__ */ new Map(), files: [], touched: {}, w };
  const set = /* @__PURE__ */ __name((o, col) => o[col] ??= /* @__PURE__ */ new Map(), "set");
  const del = /* @__PURE__ */ __name((col, id) => {
    set(P.del, col).set(id, true);
    if (col === "enr") set(P.del, "rel").set(id, true);
  }, "del");
  const gone = /* @__PURE__ */ __name((col, id) => !!P.del[col]?.has(id), "gone");
  const upd = /* @__PURE__ */ __name((col, id, data) => set(P.upd, col).set(id, data), "upd");
  const sess = /* @__PURE__ */ __name((id) => P.upd.sessions?.get(id) || w.sById.get(id), "sess");
  const by = c.user ? c.user.email || c.user.name || c.user.id : "system";
  const bump = /* @__PURE__ */ __name((k, id) => (P.touched[k] ??= /* @__PURE__ */ new Set()).add(id), "bump");
  P.archiveCert = (x, via, touchEnr) => {
    if (!x || P.arch.has(x.no)) return;
    const e = w.enrBy.get(enrId(x.sid, x.tid));
    P.arch.set(x.no, { cert: x, final: e?.final?.certNo === x.no ? e.final : null, archivedAt: new Date(c.now()).toISOString(), by, via });
    del("certs", x.no);
    if (touchEnr && e?.final?.certNo === x.no && !gone("enr", enrId(x.sid, x.tid))) {
      const n = { ...e };
      delete n.final;
      upd("enr", enrId(x.sid, x.tid), n);
      set(P.del, "rel").set(enrId(x.sid, x.tid), true);
    }
  };
  P.session = (id, via = "session") => {
    const s = w.sById.get(id);
    if (!s || gone("sessions", id)) return;
    del("sessions", id);
    for (const e of w.enrs) if (e.sid === id) del("enr", enrId(e.sid, e.tid));
    for (const x of w.certs) if (x.sid === id) P.archiveCert(x, via, false);
  };
  P.enrol = (sid, tid) => {
    const s = sess(sid);
    if (!s || gone("sessions", sid)) return;
    if ((s.traineeIds || []).includes(tid)) upd("sessions", sid, { ...s, traineeIds: s.traineeIds.filter((t) => t !== tid) });
    del("enr", enrId(sid, tid));
    for (const x of w.certs) if (x.sid === sid && x.tid === tid) P.archiveCert(x, "enrolment", false);
  };
  P.trainee = (id) => {
    const x = w.tById.get(id);
    if (!x || gone("trainees", id)) return;
    for (const s of w.sessions) if ((s.traineeIds || []).includes(id)) P.enrol(s.id, id);
    for (const e of w.enrs) if (e.tid === id) del("enr", enrId(e.sid, e.tid));
    for (const k of w.certs) if (k.tid === id) P.archiveCert(k, "trainee", false);
    for (const g of w.groups) if ((g.traineeIds || []).includes(id)) upd("groups", g.id, { ...P.upd.groups?.get(g.id) || g, traineeIds: (P.upd.groups?.get(g.id) || g).traineeIds.filter((x2) => x2 !== id) });
    del("trainees", id);
    if (x.fin) del("fins", x.fin);
    if (x.login) del("logins", loginKey("trainee", x.login));
  };
  P.cert = (no) => {
    const x = w.certByNo.get(no);
    if (x) P.archiveCert(x, "delete", true);
  };
  P.blank = (id) => {
    if (!w.blanks.some((b) => b.id === id) || gone("blanks", id)) return;
    for (const s of w.sessions) if (s.bid === id) P.session(s.id, "training");
    for (const k of w.certs) if (k.bid === id) P.archiveCert(k, "training", false);
    del("blanks", id);
  };
  P.sheet = (id) => {
    for (const s of w.sessions) if (s.sheetId === id && !gone("sessions", s.id)) {
      upd("sessions", s.id, { ...sess(s.id), sheetId: "" });
      bump("sessions", s.id);
    }
    for (const b of w.blanks) if (b.defaultSheetId === id && !gone("blanks", b.id)) upd("blanks", b.id, { ...P.upd.blanks?.get(b.id) || b, defaultSheetId: "" });
    del("sheets", id);
  };
  P.material = (id) => {
    const m = w.materials.find((x) => x.id === id);
    if (!m) return;
    for (const s of w.sessions) if ((s.materials || []).includes(id) && !gone("sessions", s.id)) {
      upd("sessions", s.id, { ...sess(s.id), materials: sess(s.id).materials.filter((x) => x !== id) });
      bump("sessions", s.id);
    }
    if (m.key) P.files.push("materials/" + m.key);
    del("materials", id);
  };
  P.company = (id) => {
    const x = w.companies.find((k) => k.id === id);
    if (!x) return;
    for (const t of w.trainees) if (t.co === id && !gone("trainees", t.id)) {
      upd("trainees", t.id, { ...P.upd.trainees?.get(t.id) || t, co: "" });
      bump("trainees", t.id);
    }
    for (const k of w.certs) if (k.co === id && !P.arch.has(k.no)) {
      upd("certs", k.no, { ...P.upd.certs?.get(k.no) || k, co: "" });
      bump("certs", k.no);
    }
    del("companies", id);
    if (x.login) del("logins", loginKey("company", x.login));
  };
  P.trainer = (id) => {
    const x = w.trainers.find((k) => k.id === id);
    if (!x) return;
    for (const s of w.sessions) if (s.tid === id && !gone("sessions", s.id)) {
      upd("sessions", s.id, { ...sess(s.id), tid: "" });
      bump("sessions", s.id);
    }
    del("trainers", id);
    if (x.login) del("logins", loginKey("trainer", x.login));
  };
  return P;
}
__name(newPlan, "newPlan");
function runKind(P, kind, id) {
  const f = { blank: P.blank, sheet: P.sheet, material: P.material, company: P.company, trainer: P.trainer, trainee: P.trainee, session: P.session, cert: P.cert }[kind];
  if (kind === "enrol") {
    const [sid, tid] = String(id).split("|");
    return P.enrol(sid, tid);
  }
  if (!f) throw new Error("kind");
  return f(id);
}
__name(runKind, "runKind");
function impact(P) {
  const n = /* @__PURE__ */ __name((col) => P.del[col]?.size || 0, "n");
  const unlinked = /* @__PURE__ */ __name((col) => [...P.touched[col] || []].filter((id) => !P.del[col]?.has(id)).length, "unlinked");
  return {
    sessions: n("sessions"),
    enrolments: n("enr"),
    certs: P.arch.size,
    trainees: n("trainees"),
    trainers: n("trainers"),
    companies: n("companies"),
    blanks: n("blanks"),
    sheets: n("sheets"),
    materials: n("materials"),
    unlinkedSessions: unlinked("sessions"),
    unlinkedTrainees: unlinked("trainees"),
    unlinkedCerts: unlinked("certs")
  };
}
__name(impact, "impact");
var total = /* @__PURE__ */ __name((i) => i.sessions + i.enrolments + i.certs + i.trainees + i.trainers + i.companies + i.blanks + i.sheets + i.materials, "total");
async function applyPlan(c, P) {
  if (P.arch.size) await c.D.put("archive", [...P.arch].map(([no, data]) => ({ id: no, data })));
  for (const [col, m] of Object.entries(P.upd)) {
    const rows = [...m].filter(([id]) => !P.del[col]?.has(id)).map(([id, data]) => ({ id, data }));
    if (rows.length) await c.D.put(col, rows);
  }
  for (const [col, m] of Object.entries(P.del)) if (m.size) await c.D.delMany(col, [...m.keys()]);
  for (const k of P.files) await c.B.delete(k).catch(() => {
  });
}
__name(applyPlan, "applyPlan");
async function restoreFromArchive(c, no) {
  const a = await c.D.get("archive", no);
  if (!a) return null;
  await c.D.insert("certs", no, a.cert);
  if (a.final) {
    const e = await c.D.get("enr", enrId(a.cert.sid, a.cert.tid));
    if (e && !e.final) {
      e.final = a.final;
      await c.D.put("enr", [{ id: enrId(e.sid, e.tid), data: e }]);
      await c.D.put("rel", [{ id: enrId(e.sid, e.tid), data: { at: a.final.at, by: "restore" } }]);
    }
  }
  await c.D.del("archive", no);
  return a.cert;
}
__name(restoreFromArchive, "restoreFromArchive");

// _lib/seed.js
var it = /* @__PURE__ */ __name((id, text, penalty) => penalty === void 0 ? { id, text } : { id, text, penalty: String(penalty) }, "it");
var SEED_BLANKS = [{
  id: "sample-pa",
  name: "Performing Authority",
  prefix: "",
  months: 24,
  credits: 0,
  provider: "KVET \u018FTM / KVET LEC",
  titleAz: "S\u018FR\u0130\u015ET\u018FL\u0130L\u0130K SERT\u0130F\u0130KATI",
  titleEn: "CERTIFICATE OF COMPETENCE",
  qualAz: "\u0130\u015F \u0130cra\xE7\u0131s\u0131",
  qualEn: "Performing Authority",
  descAz: "{qual} t\u0259limini u\u011Furla tamamlam\u0131\u015Fd\u0131r. T\u0259lim proqram\u0131 AR \u201CTexniki T\u0259hl\xFCk\u0259sizlik\u201D haqq\u0131nda qanununa, ISO 45001 beyn\u0259lxalq standart\u0131na v\u0259 ECITB kompetensiya \xE7\u0259r\xE7iv\u0259sin\u0259 uy\u011Fun t\u0259rtib olunmu\u015Fdur",
  descEn: "Has successfully completed the {qual} training course. The training program is designed in compliance with the Law of the Republic of Azerbaijan On Technical Safety, the ISO 45001 international standard, and the ECITB competency framework.",
  footAz: "Bu t\u0259lim \u018Fm\u0259yin T\u0259hl\xFCk\u0259sizliyi v\u0259 Sa\u011Flaml\u0131q Komissiyas\u0131n\u0131n T\u0259sdiq edilmi\u015F T\u0259cr\xFCb\u0259 Kodeksinin (ACOP) t\u0259l\u0259bl\u0259rin\u0259 uy\u011Fundur",
  footEn: "This training conforms to the requirements of the Health and Safety Commission Approved Code of Practice",
  defaultSheetId: ""
}];
var hf = /* @__PURE__ */ __name((id, label, type = "text", auto = "", group3 = "") => ({ id, label, type, auto, group: group3 }), "hf");
var SEED_SHEETS = [
  {
    id: "sample-ogc",
    name: "Practical Test Marking Sheet (Overhead Crane)",
    mode: "penalty",
    title: "Practical Test Marking Sheet",
    subtitle: "(Overhead Crane)",
    rule: { maxPenalty: 40 },
    note: "*Allow 1 adjustment per operation ** The phase \u2018fork arms\u2019 includes attachments, if applicable",
    disqNote: "(tick appropriate box and record comments overleaf)",
    headerFields: [
      hf("h1", "Full Name", "text", "candidate", "Candidate"),
      hf("h2", "Organisation", "text", "company", "Candidate"),
      hf("h4", "Truck Group", "text", "", "Truck Type"),
      hf("h5", "Capacity (SWL)", "text", "", "Truck Type"),
      hf("h6", "Load Centre", "text", "", "Truck Type"),
      hf("h7", "Height", "text", "", "Truck Type"),
      hf("h8", "Height used on test", "text", "", "Truck Type"),
      hf("h9", "Attachments", "text", "", "Truck Type"),
      hf("h10", "a. Set time", "number", "", "Time"),
      hf("h11", "b. Start time", "time", "", "Time"),
      hf("h12", "c. Finish time", "time", "", "Time"),
      hf("h13", "d. Duration", "duration", "", "Time"),
      hf("h14", "Excess time (d minus a)", "excess", "", "Time")
    ],
    timeRate: 1,
    timePenalty: true,
    disq: ["Exceed Max. Time", "Unsafe Stacking", "Violent Collision", "Operating Dangerously", "Overloads Crane"].map((text, i) => ({ id: "d" + (i + 1), text })),
    sections: [
      { id: "s1", title: "Operator Safety", items: [it("i1", "Fails to wear safety equipment W/A", 5), it("i2", "Mounts/dismounts incorrectly", 3), it("i3", "Fails to maintain a safe operating position", 5)] },
      { id: "s2", title: "Operator Observation", items: [it("i4", "Fails to look in direction of travel", 5), it("i5", "Fails to check all round", 5), it("i6", "Fails to observe/obey slinger\u2019s signals", 5), it("i7", "Misinterprets slinger\u2019s signals", 3), it("i8", "Rides foot brake", 5)] },
      { id: "s3", title: "Using Machine Controls", items: [it("i9", "Selects wrong hydraulic control", 3), it("i10", "Excessive use of hydraulic controls", 3), it("i11", "Rough use of hydraulic controls", "3-5"), it("i12", "Fails to hold steering wheel/assistors", 3), it("i13", "Fork arms/load too high when travelling", 5), it("i14", "Fork arms/load too low when travelling", 1)] },
      { id: "s4", title: "Lifting/Lowering/Transporting", items: [it("i15", "Fails to \u201Cspot\u201D hook/attachment", "3-5"), it("i16", "Engages/disengages attachment incorrectly", "3-5"), it("i17", "Fails to take a test lift", 3)] },
      { id: "s5", title: "Lifting/Lowering/Transporting Continued", col2: true, items: [it("i18", "Imposes shock load", 5), it("i19", "Allows the load to swing excessively", 5), it("i20", "Fails to correct load swing", 5), it("i21", "Travels with load too high/low", "3-5"), it("i22", "Traverses incorrectly", 3), it("i23", "Long travel incorrectly", 3), it("i24", "Fails to check landing area is clear", 3), it("i25", "Positioning load incorrectly", 3), it("i26", "Load incorrectly stacked", 3), it("i27", "Travel with hook incorrectly positioned", 3), it("i28", "Touches course", 3), it("i29", "Allows load to hit obstruction", 5)] },
      { id: "s6", title: "Parking", items: [it("i30", "Fails to park crane in correct position", 3), it("i31", "Leaves hook incorrectly positioned", 3), it("i32", "Fails to switch off lights", 3), it("i33", "Fails to switch off crane", 3), it("i34", "Fails to isolate machine", 3)] }
    ]
  },
  {
    id: "sample-ap",
    name: "Practical Test Marking Sheet \u2013 Appointed Person (Rigging & Lifting)",
    mode: "rating",
    title: "Practical Test Marking Sheet",
    subtitle: "Appointed Person (Rigging Lifting)",
    rule: { minAvg: 3, failBelow: 2 },
    note: "A rating of 1 (Unsafe) on any duty fails the candidate; the average of the rated duties must reach 3 (Satisfactory).",
    // left column: Delegate Name / Position / Location, right column: Company / Location / Date (as on the form)
    headerFields: [hf("h1", "Delegate Name", "text", "candidate"), hf("h3", "Position"), hf("h4", "Location", "text", "location"), hf("h2", "Company", "text", "company"), hf("h6", "Location"), hf("h5", "Date", "text", "date")],
    timePenalty: false,
    disq: [],
    sections: [
      { id: "s1", title: "Appointed Person Duties", items: ["Carry out risk assessment & toolbox talk (TBT)", "Identify hazards and instigate control measures", "Determine the weight of the load", "Identify approximate Centre of Gravity (C.o.G.)", "Select suitable lifting equipment", "Control and direct slingers/signallers", "Direct the lifting operation", "Prepare and control lay-down area"].map((t, i) => it("i" + (i + 1), t)) },
      { id: "s2", title: "General Performance", items: ["Secure / barrier off immediate lifting area", "Select appropriate lifting gear for the job", "Inspect lifting equipment before use", "Safely rig / install equipment", "Rig the load correctly (sling modes & angles)", "Attach accessories correctly to crane hook", "Demonstrate practical skill & knowledge"].map((t, i) => it("i" + (i + 9), t)) }
    ]
  }
];

// _lib/routes_system.js
var DCOLS = ["blanks", "sheets", "tests", "groups", "kb", "materials", "companies", "trainers", "trainees", "sessions", "enr", "rel", "signs", "certs", "archive", "retired", "fins", "logins", "requests", "candreq", "libdocs", "cogroups", "notes", "nseen", "threads", "msgs", "links", "settings", "sigs", "cams", "snaps", "audit"];
var RESTORE_COLS = DCOLS.filter((k) => k !== "audit");
async function rebuildLogins(c) {
  let n = 0;
  const rows = [];
  for (const [role, col] of [["trainer", "trainers"], ["trainee", "trainees"], ["company", "companies"]])
    for (const { data: x } of await c.D.all(col)) if (x.login) {
      rows.push({ id: loginKey(role, x.login), data: { login: x.login, id: x.id } });
      n++;
    }
  await c.D.put("logins", rows);
  return n;
}
__name(rebuildLogins, "rebuildLogins");
async function dump(c) {
  const cols = {};
  for (const k of DCOLS) cols[k] = await c.D.all(k);
  return { v: 2, at: new Date(c.now()).toISOString(), cols, counters: await c.D.counters() };
}
__name(dump, "dump");
async function makeBackup(c, tag = "") {
  const key = `backups/kvet-${new Date(c.now()).toISOString().replace(/[:.]/g, "-")}${tag}.json`;
  await c.B.put(key, JSON.stringify(await dump(c)), { httpMetadata: { contentType: "application/json" } });
  return key;
}
__name(makeBackup, "makeBackup");
var listBackups = /* @__PURE__ */ __name(async (c) => (await c.B.list({ prefix: "backups/", limit: 1e3 })).objects.map((o) => ({ key: o.key, size: o.size, at: o.uploaded })).sort((a, b) => a.key < b.key ? 1 : -1), "listBackups");
var goodKey = /* @__PURE__ */ __name((k) => /^backups\/[\w.-]+\.json$/.test(k || ""), "goodKey");
var png = /* @__PURE__ */ __name((buf) => {
  const b = new Uint8Array(buf.slice(0, 4));
  return b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71;
}, "png");
var jpg = /* @__PURE__ */ __name((buf) => {
  const b = new Uint8Array(buf.slice(0, 3));
  return b[0] === 255 && b[1] === 216 && b[2] === 255;
}, "jpg");
var PURGE = {
  sessions: /* @__PURE__ */ __name((w, before) => w.sessions.filter((x) => !before || (x.date || "") < before).map((x) => ["session", x.id]), "sessions"),
  certs: /* @__PURE__ */ __name((w, before) => w.certs.filter((x) => !before || (x.issuedAt || "").slice(0, 10) < before).map((x) => ["cert", x.no]), "certs"),
  trainees: /* @__PURE__ */ __name((w, before) => w.trainees.filter((x) => !before || (x.createdAt || "").slice(0, 10) < before).map((x) => ["trainee", x.id]), "trainees"),
  trainers: /* @__PURE__ */ __name((w, before) => w.trainers.filter((x) => !before || (x.createdAt || "").slice(0, 10) < before).map((x) => ["trainer", x.id]), "trainers"),
  companies: /* @__PURE__ */ __name((w, before) => w.companies.filter((x) => !before || (x.createdAt || "").slice(0, 10) < before).map((x) => ["company", x.id]), "companies"),
  blanks: /* @__PURE__ */ __name((w, before) => w.blanks.filter((x) => !before || (x.createdAt || "").slice(0, 10) < before).map((x) => ["blank", x.id]), "blanks"),
  sheets: /* @__PURE__ */ __name((w, before) => w.sheets.filter((x) => !before || (x.createdAt || "").slice(0, 10) < before).map((x) => ["sheet", x.id]), "sheets"),
  materials: /* @__PURE__ */ __name((w, before) => w.materials.filter((x) => !before || (x.at || "").slice(0, 10) < before).map((x) => ["material", x.id]), "materials")
};
var PURGE_KEYS = [...Object.keys(PURGE), "archive", "snaps"];
function auditCat(a) {
  a = String(a || "");
  if (/^(login|logout)/.test(a)) return "auth";
  if (/^(delete|purge|archive|cert\.restore\.archive|backup\.delete|user\.delete|camera\.(delete|clear))/.test(a)) return "delete";
  if (/^(cert|release|issue)/.test(a)) return "cert";
  if (/^(trainee|trainer|company|credentials)/.test(a)) return "people";
  if (/^(session|attendance|enr|practical|exam|feedback|trainer\.evaluate|material|blank|sheet)/.test(a)) return "training";
  return "system";
}
__name(auditCat, "auditCat");
function people(role, companies, trainers, trainees) {
  if (role !== "auditor") return { companies, trainers, trainees };
  const strip2 = /* @__PURE__ */ __name(({ phone, email, login, contactPerson, ...x }) => x, "strip");
  return { companies: companies.map(strip2), trainers: trainers.map(strip2), trainees: trainees.map(strip2) };
}
__name(people, "people");
async function otherRequests(c) {
  const fin = shared_exports.can(c.user.role, "fin.view"), since = new Date(c.now() - 180 * 864e5).toISOString();
  const [pend, recent, trainersAdded] = await Promise.all([
    c.D.query("candreq", { where: [["status", "eq", "pending"]] }),
    c.D.query("candreq", { where: [["at", "gte", since]] }),
    c.D.query("trainees", { where: [["createdAt", "gte", since], ["createdBy.kind", "eq", "trainer"]] })
  ]);
  const seen = /* @__PURE__ */ new Set(), cand = [...pend.rows, ...recent.rows].map((r) => r.data).filter((x) => !seen.has(x.id) && seen.add(x.id));
  const candidates = cand.map((x) => ({ ...x, person: { ...x.person, fin: fin ? x.person.fin : "" } })).sort((a, b) => b.at.localeCompare(a.at));
  const byTrainers = trainersAdded.rows.map((r) => r.data).filter((t) => t.createdBy?.kind === "trainer" && (t.createdAt || "") >= since).map((t) => ({ id: t.id, att: t.att, name: shared_exports.fullAz(t), co: t.co || "", by: t.createdBy.name, at: t.createdAt })).sort((a, b) => b.at.localeCompare(a.at));
  return { candidates, byTrainers };
}
__name(otherRequests, "otherRequests");
async function recentRequests(c) {
  const since = new Date(c.now() - 365 * 864e5).toISOString();
  const [open, recent] = await Promise.all([c.D.query("requests", { where: [["status", "in", ["new", "planned"]]] }), c.D.query("requests", { where: [["at", "gte", since]] })]);
  const seen = /* @__PURE__ */ new Set();
  return [...open.rows, ...recent.rows].map((r) => r.data).filter((x) => !seen.has(x.id) && seen.add(x.id)).sort((a, b) => a.at < b.at ? 1 : -1);
}
__name(recentRequests, "recentRequests");
var ownStaff = /* @__PURE__ */ __name(async (c) => await c.D.get("staff", c.user.id) || { email: c.user.email || "", role: c.user.role || "" }, "ownStaff");
var systemRoutes = {
  /* ------------------------------------------------------------ bootstrap */
  "GET /state": { auth: "staff", act: "state", async fn(c) {
    const fin = shared_exports.can(c.user.role, "fin.view"), today = c.today(), st = await getSettings(c.D);
    if (!shared_exports.can(c.user.role, "view")) {
      const me2 = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
      {};
      return { role: c.user.role, me: { id: c.user.id, email: c.user.email, name: me2.name || "", title: me2.title || "" }, today, settings: publicSettings(st), assets: await assetsOut(c.D, st), blanks: [], sheets: [], materials: [], tests: [], groups: [], companies: [], trainers: [], trainees: [], sessions: [] };
    }
    if (st.skV !== SK_VERSION) {
      await reindex(c.D);
      const s2 = await getSettings(c.D);
      s2.skV = SK_VERSION;
      await c.D.put("settings", [{ id: "main", data: s2 }]);
    }
    const rows = /* @__PURE__ */ __name(async (col) => (await c.D.all(col)).map((r) => r.data), "rows"), since = daysBefore(today, RECENT_DAYS);
    const [blanks, sheets, materials, companies, trainers, sessions, tests, groups, nTrainees, nCerts, nSessions] = await Promise.all([
      ...["blanks", "sheets", "materials", "companies", "trainers"].map(rows),
      c.D.query("sessions", { where: [["date", "gte", since]] }).then((r) => r.rows.map((x) => x.data)),
      rows("tests"),
      rows("groups"),
      ...["trainees", "certs", "sessions"].map((k) => c.D.query(k, { limit: 0, count: true }).then((r) => r.total))
    ]);
    const by = await enrsFor(c.D, sessions.map((s) => s.id)), trainees = [];
    const me = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
    {};
    const emergency = c.user.role === "superadmin" ? (st.emergencyUses || []).filter((u) => u.at > (st.emergencyAck || "")) : c.user.emergency ? true : void 0;
    return {
      role: c.user.role,
      emergency,
      me: { id: c.user.id, email: c.user.email, name: me.name || "", title: me.title || "", sigImg: me.sigKey ? "/api/asset/" + me.sigKey : "" },
      today,
      settings: publicSettings(st),
      assets: await assetsOut(c.D, st),
      blanks,
      sheets,
      materials,
      // auditors and approvers read the training section: test names only (no questions or answer keys), no groups
      tests: shared_exports.can(c.user.role, "library") ? tests : tests.map(({ questions, proposal, ...x }) => ({ ...x, questions: [], nQuestions: (questions || []).length })),
      groups: shared_exports.can(c.user.role, "library") ? groups : [],
      ...people(c.user.role, companies.map(stripSecret), trainers.map((t) => trainerOut(t, fin)), trainees.map((t) => traineeOut(t, fin))),
      sessions: sessions.map((s) => sessionRow(s, by.get(s.id), today)).sort((a, b) => a.date < b.date ? 1 : -1),
      sessionsSince: since,
      counts: { trainees: nTrainees, certs: nCerts, sessions: nSessions }
    };
  } },
  /* -------------------------------------------------------------- settings */
  "POST /settings/save": { auth: "staff", act: "settings.save", async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), was = JSON.parse(JSON.stringify(st));
    if (b.company) st.company = { name: str(b.company.name, 120), nameEn: str(b.company.nameEn, 120), phone: str(b.company.phone, 60), email: str(b.company.email, 120), website: str(b.company.website, 120), address: str(b.company.address, 250), director: str(b.company.director, 120), directorTitle: str(b.company.directorTitle, 120) };
    if (b.num) {
      const n = b.num, cur = shared_exports.numCfg(st);
      st.num = { prefix: str(n.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || cur.prefix, sep: ["/", "-", ".", ""].includes(n.sep) ? n.sep : cur.sep, yearFmt: n.yearFmt === "YYYY" ? "YYYY" : "YY", pad: num(n.pad, 1, 8, cur.pad), start: num(n.start, 1, 99999999, cur.start) };
    }
    if (b.soonDays !== void 0) st.soonDays = num(b.soonDays, 1, 365, shared_exports.SOON_DAYS);
    if (b.showFather !== void 0) st.showFather = bool(b.showFather);
    if (b.dash) {
      const d = b.dash, cur = shared_exports.dashCfg(st);
      st.dash = { expDays: num(d.expDays, 1, 730, cur.expDays), tiles: Array.isArray(d.tiles) ? [...new Set(d.tiles)].filter((k) => shared_exports.DASH_TILES.includes(k)) : cur.tiles, top: [5, 8, 10, 15, 20].includes(Number(d.top)) ? Number(d.top) : cur.top, period: ["month", "lastMonth", "year"].includes(d.period) ? d.period : cur.period };
    }
    if (b.fbRequired !== void 0) st.fbRequired = bool(b.fbRequired);
    if (b.certCompany !== void 0) st.certCompany = bool(b.certCompany);
    if (b.mfa !== void 0) {
      need(shared_exports.can(c.user.role, "users"), "forbidden", 403);
      st.mfa = ["off", "admins", "all"].includes(b.mfa) ? b.mfa : "off";
    }
    if (b.remind) {
      const r = b.remind;
      st.remind = { on: bool(r.on), days: [...new Set((r.days || []).map(Number))].filter((d) => Number.isInteger(d) && d > 0 && d <= 365).sort((a, z) => z - a).slice(0, 4), toCompany: r.toCompany !== false, toTrainee: r.toTrainee !== false };
    }
    if (b.approvals) {
      need(shared_exports.can(c.user.role, "users"), "forbidden", 403);
      st.approvals = shared_exports.approvalsCfg({ approvals: b.approvals });
    }
    if (b.privacy) st.privacy = { consentRequired: bool(b.privacy.consentRequired), finYears: num(b.privacy.finYears, 0, 50, 0) };
    await c.D.put("settings", [{ id: "main", data: st }]);
    await audit(c, "settings.save", "", { entity: { kind: "settings", id: "main", label: "Settings" }, changes: [...diff(was.company, st.company, Object.keys(st.company || {})), ...diff(was.num, st.num, Object.keys(st.num || {})), ...diff({ soonDays: was.soonDays, showFather: was.showFather, dash: was.dash, fbRequired: was.fbRequired, certCompany: was.certCompany, mfa: was.mfa, remind: was.remind, privacy: was.privacy }, { soonDays: st.soonDays, showFather: st.showFather, dash: st.dash, fbRequired: st.fbRequired, certCompany: st.certCompany, mfa: st.mfa, remind: st.remind, privacy: st.privacy })] });
    return { settings: publicSettings(st) };
  } },
  "POST /numbering/set": { auth: "staff", act: "settings.save", async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), cfg = shared_exports.numCfg(st);
    const prefix = str(b.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || cfg.prefix, year = num(b.year, 2e3, 2200), next = num(b.next, 1, 99999999);
    need(year && next, "badInput");
    await c.D.setCounters([{ name: shared_exports.certCounterName(cfg, prefix, year), val: next - 1 }]);
    await audit(c, "numbering.set", `${prefix} ${year} next=${next}`);
    return { next: (await suggestNo(c, st, prefix, year)).no };
  } },
  "POST /upload": { auth: "staff", act: "settings.save", raw: true, async fn(c) {
    const kind = c.url.searchParams.get("kind") || "";
    need(["logo", "accred", "sig", "stamp"].includes(kind), "badInput");
    const buf = await c.req.arrayBuffer();
    need(buf.byteLength && buf.byteLength <= 3e6 && png(buf), "badFile");
    const key = rnd(8) + ".png";
    await c.B.put("assets/" + key, buf, { httpMetadata: { contentType: "image/png" } });
    if (kind === "sig") {
      for (const x of await c.D.all("sigs")) if (x.data.on) {
        x.data.on = false;
        await c.D.put("sigs", [x]);
      }
      const id = "g" + Date.now();
      await c.D.put("sigs", [{ id, data: { id, key, at: new Date(c.now()).toISOString(), on: true } }]);
    } else {
      const st = await getSettings(c.D);
      if (kind === "accred") st.accred = [...accredKeys(st), key];
      else st[kind] = key;
      await c.D.put("settings", [{ id: "main", data: st }]);
    }
    await audit(c, "upload", kind);
    return J({ ok: 1, assets: await assetsOut(c.D, await getSettings(c.D)) });
  } },
  "POST /asset/remove": { auth: "staff", act: "settings.save", async fn(c) {
    const b = await c.body(), st = await getSettings(c.D);
    if (b.kind === "accredDefault") delete st.accred;
    else if (b.kind === "accred") {
      st.accred = [...accredKeys(st)];
      st.accred.splice(Number(b.i), 1);
    } else if (b.kind === "accredMove") {
      st.accred = [...accredKeys(st)];
      const i = Number(b.i), j = i + (Number(b.dir) < 0 ? -1 : 1);
      if (st.accred[i] && st.accred[j]) [st.accred[i], st.accred[j]] = [st.accred[j], st.accred[i]];
    } else if (b.kind === "logo" || b.kind === "stamp") delete st[b.kind];
    else throw new H(400, "badInput");
    await c.D.put("settings", [{ id: "main", data: st }]);
    await audit(c, "asset.remove", b.kind);
    return { assets: await assetsOut(c.D, st) };
  } },
  /* ---------------------------------------------------------------- seed */
  "POST /seed": { auth: "staff", act: "seed", async fn(c) {
    let added = 0;
    const b = await c.body();
    for (const s of SEED_SHEETS) if (bool(b.refresh) && await c.D.get("sheets", s.id)) {
      const old = await c.D.get("sheets", s.id);
      await c.D.put("sheets", [{ id: s.id, data: { ...s, createdAt: old?.createdAt || new Date(c.now()).toISOString() } }]);
      added++;
    } else if (!await c.D.get("sheets", s.id)) {
      await c.D.put("sheets", [{ id: s.id, data: { ...s, createdAt: new Date(c.now()).toISOString() } }]);
      added++;
    }
    for (const b2 of SEED_BLANKS) if (!await c.D.get("blanks", b2.id)) {
      await c.D.put("blanks", [{ id: b2.id, data: { ...b2, createdAt: new Date(c.now()).toISOString() } }]);
      added++;
    }
    await audit(c, "seed", String(added));
    return { added };
  } },
  /* -------------------------------------------------------------- deletes
     { kind, id, dry } -> dry: only the impact numbers; otherwise the cascade described in deletion.js is applied. Certificates go to the archive. */
  "POST /delete": { auth: "staff", act: "delete", async fn(c) {
    const b = await c.body(), kind = str(b.kind, 20), id = kind === "cert" ? shared_exports.normCertNo(str(b.id, 100)) : str(b.id, 100);
    need(KINDS.includes(kind) && id, "badInput");
    const w = await loadWorldFor(c, kind, id), P = newPlan(c, w);
    runKind(P, kind, id);
    const imp = impact(P);
    if (bool(b.dry)) return { impact: imp, total: total(imp) };
    need(total(imp) > 0, "noRec", 404);
    const label = {
      session: /* @__PURE__ */ __name(() => w.sById.get(id) && `${w.sById.get(id).date} ${w.blanks.find((x) => x.id === w.sById.get(id).bid)?.name || ""}`, "session"),
      trainee: /* @__PURE__ */ __name(() => {
        const x = w.tById.get(id);
        return x && `${x.att} ${shared_exports.fullAz(x)}`;
      }, "trainee"),
      trainer: /* @__PURE__ */ __name(() => {
        const x = w.trainers.find((k) => k.id === id);
        return x && shared_exports.fullAz(x);
      }, "trainer"),
      company: /* @__PURE__ */ __name(() => w.companies.find((k) => k.id === id)?.name, "company"),
      blank: /* @__PURE__ */ __name(() => w.blanks.find((k) => k.id === id)?.name, "blank"),
      sheet: /* @__PURE__ */ __name(() => w.sheets.find((k) => k.id === id)?.name, "sheet"),
      material: /* @__PURE__ */ __name(() => w.materials.find((k) => k.id === id)?.title, "material"),
      cert: /* @__PURE__ */ __name(() => id, "cert")
    }[kind]?.() || id;
    await applyPlan(c, P);
    await audit(c, "delete." + kind, `${label}${imp.certs ? ` \xB7 ${imp.certs} certificate(s) archived` : ""}`, { entity: { kind, id, label: String(label) }, changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: "", to: String(v) })) });
    return { ok: 1, impact: imp };
  } },
  /* Batch delete (People pages: select, or "select all that match the filter", then delete): { kind, ids, dry, confirm:'DELETE' }.
     One plan for all of them: the same cascade and certificate archiving as a single delete. More than 20: a backup is taken first. */
  "POST /delete/many": { auth: "staff", act: "delete", async fn(c) {
    const b = await c.body(), kind = str(b.kind, 20), ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map((x) => str(x, 100)).filter(Boolean))].slice(0, 5e3);
    need(["trainee", "trainer", "company", "session", "blank", "sheet", "material"].includes(kind) && ids.length, "badInput");
    const w = await loadWorld(c), P = newPlan(c, w);
    for (const id of ids) runKind(P, kind, id);
    const imp = impact(P);
    if (bool(b.dry)) return { impact: imp, total: total(imp) };
    need(b.confirm === "DELETE", "badInput");
    need(total(imp) > 0, "noRec", 404);
    const backup = ids.length > 20 ? await makeBackup(c, "-before-batch-delete") : null;
    await applyPlan(c, P);
    await audit(c, "delete.many." + kind, `${ids.length} ${kind}(s)${imp.certs ? ` \xB7 ${imp.certs} certificate(s) archived` : ""}`, { changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: "", to: String(v) })) });
    return { ok: 1, impact: imp, backup: backup || null };
  } },
  /* Bulk "delete old data": { kinds:[...], before:'YYYY-MM-DD' (optional), dry, confirm:'DELETE' }. Takes a backup first. */
  "POST /purge": { auth: "staff", act: "delete", async fn(c) {
    const b = await c.body(), kinds = [...new Set((b.kinds || []).map((x) => str(x, 20)))].filter((k) => PURGE_KEYS.includes(k)), before = str(b.before, 10);
    need(kinds.length && (!before || shared_exports.isDate(before)), "badInput");
    const w = await loadWorld(c), P = newPlan(c, w);
    for (const k of kinds) if (PURGE[k]) for (const [kind, id] of PURGE[k](w, before)) runKind(P, kind, id);
    let archiveCount = 0, archiveIds = [];
    if (kinds.includes("archive")) {
      archiveIds = (await c.D.all("archive")).filter((r) => !before || (r.data.cert?.issuedAt || "").slice(0, 10) < before).map((r) => r.id);
      archiveCount = archiveIds.length;
    }
    const snaps = kinds.includes("snaps") ? await c.D.all("snaps") : [];
    const imp = { ...impact(P), archive: archiveCount, snaps: snaps.length };
    if (bool(b.dry)) return { impact: imp, total: total(imp) + archiveCount + snaps.length };
    need(b.confirm === "DELETE", "badInput");
    const backup = await makeBackup(c, "-before-purge");
    await applyPlan(c, P);
    if (kinds.includes("archive")) {
      const ids = before ? archiveIds : (await c.D.all("archive")).map((r) => r.id);
      await c.D.delMany("archive", ids);
      imp.archive = ids.length;
    }
    for (const r of snaps) {
      await c.B.delete(r.data.key).catch(() => {
      });
    }
    if (snaps.length) await c.D.delMany("snaps", snaps.map((r) => r.id));
    await audit(c, "purge", `${kinds.join(",")}${before ? " before " + before : " (all)"} \xB7 backup ${backup}`, { entity: { kind: "purge", id: backup, label: kinds.join(", ") }, changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: "", to: String(v) })) });
    return { ok: 1, impact: imp, backup };
  } },
  /* ------------------------------------------------------------- archive (deleted certificates) */
  "GET /archive": { auth: "staff", act: "archive", async fn(c) {
    return { list: (await c.D.all("archive")).map((r) => ({ no: r.id, ...r.data })).sort((a, b) => a.archivedAt < b.archivedAt ? 1 : -1) };
  } },
  "POST /archive/restore": { auth: "staff", act: "archive", async fn(c) {
    const no = shared_exports.normCertNo((await c.body()).no);
    let x;
    try {
      x = await restoreFromArchive(c, no);
    } catch (e) {
      if (e instanceof H && e.message === "dup") throw new H(409, "dupCert");
      throw e;
    }
    need(x, "noRec", 404);
    await audit(c, "cert.restore.archive", no, { entity: { kind: "cert", id: no, label: no } });
    return { cert: x };
  } },
  "POST /archive/delete": { auth: "staff", act: "archive", async fn(c) {
    const b = await c.body(), nos = (b.all ? (await c.D.all("archive")).map((r) => r.id) : [shared_exports.normCertNo(b.no)]).filter(Boolean);
    need(nos.length, "noRec", 404);
    await c.D.delMany("archive", nos);
    await audit(c, "archive.delete", b.all ? `all (${nos.length})` : nos[0], { entity: { kind: "cert", id: nos[0], label: nos.length > 1 ? `${nos.length} certificates` : nos[0] } });
    return { removed: nos.length };
  } },
  /* the superadmin has seen the emergency sign-in warning */
  "POST /emergency/ack": { auth: "staff", act: "delete", async fn(c) {
    const st = await getSettings(c.D);
    st.emergencyAck = new Date(c.now()).toISOString();
    await c.D.put("settings", [{ id: "main", data: st }]);
    await audit(c, "emergency.ack", "");
    return { ok: 1 };
  } },
  /* ---------------------------------------------------------------- users */
  "GET /users": { auth: "staff", act: "users", async fn(c) {
    return { today: c.today(), list: (await c.D.all("staff")).filter((x) => x.id !== "emergency").map((x) => ({ id: x.id, ...x.data, role: shared_exports.legacyRole(x.data.role), mfa: !!x.data.mfa })) };
  } },
  "POST /users": { auth: "staff", act: "users", async fn(c) {
    const b = await c.body(), email = str(b.email, 120).toLowerCase();
    need(shared_exports.goodEmail(email) && email && String(b.password || "").length >= 8 && shared_exports.RANK[b.role] && shared_exports.ASSIGNABLE(b.role), "badInput");
    const expires = shared_exports.isDate(b.expires) ? b.expires : "";
    need(!expires || expires >= c.today(), "badExpiry");
    const taken = (await c.D.all("staff")).find((r) => String(r.data.email || "").toLowerCase() === email);
    need(!taken, "userExists", 409);
    const u = await c.A.createUser(email, b.password);
    await c.D.put("staff", [{ id: u.id, data: { email, role: b.role, name: str(b.name, 120), title: str(b.title, 120), ...expires ? { expires } : {} } }]);
    await audit(c, "user.create", `${email} ${b.role}${expires ? " until " + expires : ""}${u.reused ? " (existing sign-in account linked)" : ""}`);
    return { ok: 1, reused: !!u.reused };
  } },
  "POST /users/update": { auth: "staff", act: "users", async fn(c) {
    const b = await c.body(), x = await c.D.get("staff", str(b.id, 80));
    need(x, "noRec", 404);
    if (b.role) {
      need(shared_exports.RANK[b.role] && shared_exports.ASSIGNABLE(b.role) && b.id !== c.user.id, "badInput");
      x.role = b.role;
      await c.D.put("staff", [{ id: b.id, data: x }]);
    }
    if (b.password) {
      need(String(b.password).length >= 8, "badInput");
      await c.A.setPassword(b.id, b.password);
    }
    if ("name" in b || "title" in b || "expires" in b) {
      if ("name" in b) x.name = str(b.name, 120);
      if ("title" in b) x.title = str(b.title, 120);
      if ("expires" in b) {
        if (shared_exports.isDate(b.expires)) x.expires = b.expires;
        else delete x.expires;
      }
      await c.D.put("staff", [{ id: b.id, data: x }]);
    }
    await audit(c, "user.update", x.email);
    return { ok: 1 };
  } },
  "POST /users/delete": { auth: "staff", act: "users", async fn(c) {
    const b = await c.body();
    need(b.id !== c.user.id, "badInput");
    const x = await c.D.get("staff", String(b.id));
    await c.A.deleteUser(String(b.id));
    await c.D.del("staff", String(b.id));
    await audit(c, "user.delete", `${x?.email || b.id} ${x?.role || ""}`);
    return { ok: 1 };
  } },
  /* -------------------------------------------------------------- backups */
  "GET /backups": { auth: "staff", act: "backup.view", async fn(c) {
    return { list: await listBackups(c) };
  } },
  "POST /backup": { auth: "staff", act: "backup.create", async fn(c) {
    const key = await makeBackup(c);
    await audit(c, "backup.create", key);
    return { key };
  } },
  "POST /backup/auto": { auth: "staff", act: "backup.create", async fn(c) {
    const l = await listBackups(c);
    if (l[0] && c.now() - Date.parse(l[0].at) < 864e5) return { skipped: 1 };
    const key = await makeBackup(c);
    for (const o of l.slice(89)) await c.B.delete(o.key);
    return { key };
  } },
  "GET /backup/get": { auth: "staff", act: "backup.download", raw: true, async fn(c) {
    const k = c.url.searchParams.get("key") || "";
    need(goodKey(k), "badInput");
    const o = await c.B.get(k);
    need(o, "noRec", 404);
    return new Response(o.body, { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="' + k.split("/")[1] + '"' } });
  } },
  "POST /backup/delete": { auth: "staff", act: "backup.delete", async fn(c) {
    const b = await c.body();
    need(goodKey(b.key), "badInput");
    await c.B.delete(b.key);
    await audit(c, "backup.delete", b.key);
    return { ok: 1 };
  } },
  "POST /restore": { auth: "staff", act: "backup.restore", async fn(c) {
    const b = await c.body();
    need(goodKey(b.key), "badInput");
    const o = await c.B.get(b.key);
    need(o, "noRec", 404);
    const d = await o.json();
    need(d?.cols, "badInput");
    const before = await makeBackup(c, "-before-restore");
    await c.D.restore(RESTORE_COLS, d.cols, d.counters || []);
    const logins = await rebuildLogins(c);
    await audit(c, "backup.restore", `${b.key} \xB7 safety backup ${before} \xB7 ${logins} logins re-registered`);
    return { ok: 1, before };
  } },
  "POST /system/logins/repair": { auth: "staff", act: "backup.restore", async fn(c) {
    const n = await rebuildLogins(c);
    await audit(c, "logins.repair", String(n));
    return { count: n };
  } },
  /* ------------------------------------------------------------ scheduled jobs */
  "POST /cron/run": { auth: "cron", async fn(c) {
    const b = await c.body(), tasks = Array.isArray(b.tasks) && b.tasks.length ? b.tasks : ["backup", "reminders", "retention"], out3 = {};
    if (tasks.includes("backup")) {
      const l = await listBackups(c);
      if (l[0] && c.now() - Date.parse(l[0].at) < 20 * 36e5) out3.backup = "skipped";
      else {
        out3.backup = await makeBackup(c, "-auto");
        for (const o of l.slice(89)) await c.B.delete(o.key);
        await audit(c, "backup.auto", out3.backup);
      }
    }
    if (tasks.includes("reminders")) out3.reminders = await runReminders(c);
    if (tasks.includes("retention")) out3.retention = await runRetention(c);
    {
      const old = new Date(c.now() - 60 * 864e5).toISOString(), ids = (await c.D.query("errlog", { where: [["at", "lt", old]], limit: 1e3, fields: ["at"] })).rows.map((r) => r.id);
      if (ids.length) await c.D.delMany("errlog", ids);
      out3.errlog = ids.length;
    }
    return out3;
  } },
  /* System health: what to check before a training day. Database and file storage response times (measured now), the last
     backup, unexpected errors, API requests counted per day against the hosting plan's daily limit, database size. */
  "GET /health": { auth: "staff", act: "backup.view", async fn(c) {
    const st = await getSettings(c.D), today = c.today(), dayAgo = new Date(c.now() - 864e5).toISOString(), weekAgo = new Date(c.now() - 7 * 864e5).toISOString();
    const time3 = /* @__PURE__ */ __name(async (f) => {
      const t0 = performance.now();
      try {
        await f();
        return Math.round(performance.now() - t0);
      } catch {
        return null;
      }
    }, "time");
    const db = [];
    for (let i = 0; i < 3; i++) db.push(await time3(() => c.D.query("settings", { where: [["id", "eq", "main"]], limit: 1, offset: i, fields: ["id"] })));
    const r2 = await time3(() => c.B.list({ prefix: "backups/", limit: 1 }));
    const [backups, err1, err7, size] = await Promise.all([
      listBackups(c).catch(() => []),
      c.D.query("errlog", { where: [["at", "gte", dayAgo]], limit: 0, count: true }).then((r) => r.total || 0),
      c.D.query("errlog", { where: [["at", "gte", weekAgo]], limit: 0, count: true }).then((r) => r.total || 0),
      c.D.call ? c.D.call("rpc/db_size", { method: "POST", body: "{}" }).then(Number).catch(() => null) : null
    ]);
    const [tables, problems] = c.D.call ? await Promise.all([
      c.D.call("rpc/table_sizes", { method: "POST", body: "{}" }).catch(() => null),
      c.D.call("shape_problems?select=col,id&limit=50").catch(() => null)
    ]) : [void 0, void 0];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.parse(today) - i * 864e5).toISOString().slice(0, 10);
      days.push({ d, n: await c.D.peek("req|" + d) });
    }
    const ok = db.filter((x) => x !== null), med = ok.length ? ok.sort((a, b) => a - b)[Math.floor(ok.length / 2)] : null;
    return {
      at: new Date(c.now()).toISOString(),
      db: { ms: med, ok: ok.length === 3 },
      r2: { ms: r2, ok: r2 !== null },
      backup: backups[0] ? { at: backups[0].at, size: backups[0].size, count: backups.length } : null,
      errors: { day: err1, week: err7 },
      requests: { days, plan: st.cfPlan || "free", limit: (st.cfPlan || "free") === "free" ? 1e5 : 0 },
      dbSize: size,
      dbLimit: (st.dbPlan || "free") === "free" ? 500 * 1048576 : 8 * 1073741824,
      dbPlan: st.dbPlan || "free",
      schema: tables === void 0 ? null : { tables: tables ? tables.map((x) => ({ col: x.col, rows: Number(x.rows), bytes: Number(x.bytes) })) : null, problems: problems || [] }
    };
  } },
  "POST /health/plan": { auth: "staff", act: "settings.save", async fn(c) {
    const b = await c.body(), st = await getSettings(c.D);
    if (["free", "paid"].includes(b.cfPlan)) st.cfPlan = b.cfPlan;
    if (["free", "pro"].includes(b.dbPlan)) st.dbPlan = b.dbPlan;
    await c.D.put("settings", [{ id: "main", data: st }]);
    return { ok: 1 };
  } },
  /* Error log: unexpected server failures (the reference shown to the person is in "ref"). Superadmin / auditor read it. */
  "GET /errors": { auth: "staff", act: "audit.view", async fn(c) {
    const r = await c.D.query("errlog", { order: ["at", "desc"], limit: 200, count: true });
    return { list: r.rows.map((x) => x.data), total: r.total };
  } },
  "POST /errors/clear": { auth: "staff", act: "settings.save", async fn(c) {
    const ids = (await c.D.query("errlog", { limit: 1e3, fields: ["at"] })).rows.map((r) => r.id);
    if (ids.length) await c.D.delMany("errlog", ids);
    await audit(c, "errors.clear", String(ids.length));
    return { n: ids.length };
  } },
  "POST /reminders/run": { auth: "staff", act: "settings.save", async fn(c) {
    const b = await c.body();
    return runReminders(c, { dry: bool(b.dry) });
  } },
  "POST /retention/run": { auth: "staff", act: "delete", async fn(c) {
    const b = await c.body();
    return runRetention(c, { dry: bool(b.dry) });
  } },
  /* -------------------------------------------------------- company requests */
  "GET /requests": { auth: "staff", act: "requests", async fn(c) {
    return { ...await otherRequests(c), list: await recentRequests(c) };
  } },
  "POST /request/update": { auth: "staff", act: "requests", async fn(c) {
    const b = await c.body(), x = await c.D.get("requests", str(b.id, 60));
    need(x, "noRec", 404);
    if (["new", "planned", "done", "rejected"].includes(b.status)) x.status = b.status;
    if ("reply" in b) x.reply = str(b.reply, 1e3);
    x.updatedAt = new Date(c.now()).toISOString();
    x.updatedBy = c.user.email;
    await c.D.put("requests", [{ id: x.id, data: x }]);
    await audit(c, "request.update", `${x.coName} \xB7 ${x.status}`);
    await notify(c, "company:" + x.co, "nRqUpdated", ["rq_" + x.status, x.reply || ""], "requests");
    return { request: x };
  } },
  /* --------------------------------------------------- two-factor sign-in (own account) */
  "GET /staff/mfa": { auth: "staff", mfa: "skip", async fn(c) {
    const st = await getSettings(c.D), pol = st.mfa || "off";
    const me = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
    {};
    return { name: me.name || "", title: me.title || "", sigImg: me.sigKey ? "/api/asset/" + me.sigKey : "", canSignCerts: shared_exports.can(c.user.role, "cert.sign"), enabled: c.user.mfa, aal: c.user.aal, required: pol === "all" || pol === "admins" && shared_exports.RANK[c.user.role] >= shared_exports.RANK.admin };
  } },
  "POST /staff/mfa/enroll": { auth: "staff", mfa: "skip", async fn(c) {
    const tok = (c.req.headers.get("authorization") || "").slice(7);
    for (const f of await c.A.factors(tok)) if (f.status !== "verified") await c.A.unenroll(tok, f.id);
    return c.A.enroll(tok);
  } },
  "POST /staff/mfa/activate": { auth: "staff", mfa: "skip", async fn(c) {
    const b = await c.body(), tok = (c.req.headers.get("authorization") || "").slice(7);
    const t = await c.A.verifyFactor(tok, str(b.factorId, 80), str(b.code, 10));
    const s = await ownStaff(c);
    s.mfa = true;
    await c.D.put("staff", [{ id: c.user.id, data: s }]);
    await audit(c, "mfa.enable", c.user.email);
    return { access: t.access, refresh: t.refresh };
  } },
  /* own name and job title: used when this person signs documents electronically */
  "POST /staff/profile": { auth: "staff", async fn(c) {
    const b = await c.body(), s = await ownStaff(c);
    s.name = str(b.name, 120);
    s.title = str(b.title, 120);
    await c.D.put("staff", [{ id: c.user.id, data: s }]);
    await audit(c, "profile.update", s.name);
    return { name: s.name, title: s.title };
  } },
  /* own password (staff): the current one is checked by signing in with it */
  "POST /staff/password": { auth: "staff", async fn(c) {
    need(!c.user.emergency, "forbidden", 403);
    const b = await c.body(), nw = String(b.next || "");
    try {
      await c.A.login(c.user.email, String(b.current || ""));
    } catch {
      throw new H(400, "badPassword");
    }
    need(nw.length >= 8 && nw.length <= 100 && /[A-Za-z]/.test(nw) && /\d/.test(nw), "weakPassword");
    await c.A.setPassword(c.user.id, nw);
    await audit(c, "password.change", `staff ${c.user.email}`);
    return { ok: 1 };
  } },
  /* own handwritten signature image (PNG), used when an admin signs certificates "with my signature image" */
  "POST /staff/signature": { auth: "staff", act: "cert.sign", raw: true, async fn(c) {
    const buf = await c.req.arrayBuffer();
    need(buf.byteLength && buf.byteLength <= 2e6 && png(buf), "badFile");
    const key = rnd(8) + ".png";
    await c.B.put("assets/" + key, buf, { httpMetadata: { contentType: "image/png" } });
    const s = await ownStaff(c);
    s.sigKey = key;
    await c.D.put("staff", [{ id: c.user.id, data: s }]);
    await audit(c, "signature.upload", s.name || c.user.email);
    return J({ img: "/api/asset/" + key });
  } },
  "POST /staff/signature/remove": { auth: "staff", act: "cert.sign", async fn(c) {
    const s = await ownStaff(c);
    delete s.sigKey;
    await c.D.put("staff", [{ id: c.user.id, data: s }]);
    await audit(c, "signature.remove", s.name || c.user.email);
    return { ok: 1 };
  } },
  "POST /staff/mfa/disable": { auth: "staff", async fn(c) {
    const st = await getSettings(c.D), pol = st.mfa || "off";
    need(!(pol === "all" || pol === "admins" && shared_exports.RANK[c.user.role] >= shared_exports.RANK.admin), "mfaMandatory", 409);
    const tok = (c.req.headers.get("authorization") || "").slice(7);
    for (const f of await c.A.factors(tok)) await c.A.unenroll(tok, f.id);
    const s = await ownStaff(c);
    delete s.mfa;
    await c.D.put("staff", [{ id: c.user.id, data: s }]);
    await audit(c, "mfa.disable", c.user.email);
    return { ok: 1 };
  } },
  /* superadmin: a colleague lost the phone */
  "POST /users/mfa/reset": { auth: "staff", act: "users", async fn(c) {
    const b = await c.body(), x = await c.D.get("staff", str(b.id, 80));
    need(x, "noRec", 404);
    await c.A.adminResetMfa(b.id);
    delete x.mfa;
    await c.D.put("staff", [{ id: b.id, data: x }]);
    await audit(c, "mfa.reset", x.email);
    return { ok: 1 };
  } },
  /* Audit trail: filters by date range, user, category and free text. Rows are read per month (their ids start with the timestamp). */
  "GET /audit": { auth: "staff", act: "audit.view", async fn(c) {
    const q2 = c.url.searchParams, from = str(q2.get("from"), 10), to = str(q2.get("to"), 10), user = str(q2.get("user"), 120).toLowerCase(), cat = str(q2.get("cat"), 20), text = str(q2.get("q"), 100).toLowerCase(), entity = str(q2.get("entity"), 120);
    const lim = num(q2.get("limit"), 1, 500, 100), off2 = num(q2.get("offset"), 0, 1e6, 0);
    let rows;
    if (entity && !shared_exports.isDate(from) && !shared_exports.isDate(to)) {
      const recent = [];
      for (let i = 0; i < 4; i++) {
        const d = new Date(c.now());
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - i);
        recent.push(d.toISOString().slice(0, 7));
      }
      const [byId, ...months] = await Promise.all([c.D.query("audit", { where: [["eid", "eq", entity]] }), ...recent.map((p) => c.D.prefix("audit", p))]);
      const seen = /* @__PURE__ */ new Set();
      rows = [...byId.rows, ...months.flat()].filter((r) => !seen.has(r.id) && seen.add(r.id));
    } else if (shared_exports.isDate(from) || shared_exports.isDate(to)) {
      const a = shared_exports.isDate(from) ? from : "2000-01-01", z = shared_exports.isDate(to) ? to : c.today(), months = [];
      for (let y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7)); `${y}-${shared_exports.pad(m)}` <= z.slice(0, 7) && months.length < 60; m++) {
        if (m > 12) {
          m = 1;
          y++;
        }
        months.push(`${y}-${shared_exports.pad(m)}`);
      }
      rows = (await Promise.all(months.map((p) => c.D.prefix("audit", p)))).flat();
    } else {
      const months = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(c.now());
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - i);
        months.push(d.toISOString().slice(0, 7));
      }
      rows = (await Promise.all(months.map((p) => c.D.prefix("audit", p)))).flat();
    }
    let list2 = rows.map((r) => r.data);
    const day = /* @__PURE__ */ __name((x) => shared_exports.bakuToday(Date.parse(x.at)), "day");
    if (shared_exports.isDate(from)) list2 = list2.filter((x) => day(x) >= from);
    if (shared_exports.isDate(to)) list2 = list2.filter((x) => day(x) <= to);
    if (user) list2 = list2.filter((x) => (x.by?.name || "").toLowerCase().includes(user) || (x.by?.role || "").toLowerCase() === user);
    if (cat) list2 = list2.filter((x) => auditCat(x.action) === cat);
    if (entity) list2 = list2.filter((x) => x.entity?.id === entity || (x.detail || "").includes(entity));
    if (text) list2 = list2.filter((x) => [x.action, x.detail, x.by?.name, x.entity?.label, x.entity?.id, x.ip, (x.changes || []).map((k) => `${k.f} ${k.from} ${k.to}`).join(" ")].join(" ").toLowerCase().includes(text));
    list2.sort((a, b) => a.at < b.at ? 1 : -1);
    const cats = {};
    for (const x of list2) cats[auditCat(x.action)] = (cats[auditCat(x.action)] || 0) + 1;
    const users = [...new Set(list2.map((x) => x.by?.name).filter(Boolean))].slice(0, 100);
    return { total: list2.length, cats, users, list: list2.slice(off2, off2 + lim), recentOnly: !entity && !shared_exports.isDate(from) && !shared_exports.isDate(to) };
  } },
  /* ------------------------------------------------------------ dashboard numbers
     "Trained" = confirmed attendance in a session that starts in the period; pass rate = passed / released results. */
  "GET /stats": { auth: "staff", act: "dashboard", async fn(c) {
    const st = await getSettings(c.D), cfg = shared_exports.dashCfg(st), today = c.today(), p = c.url.searchParams;
    const [from, to] = shared_exports.isDate(p.get("from")) && shared_exports.isDate(p.get("to")) ? [p.get("from"), p.get("to")] : shared_exports.periodRange(str(p.get("period"), 16) || cfg.period, today);
    const [sessAll, companies, blanks] = await Promise.all([c.D.query("sessions", { where: [["date", "gte", from], ["date", "lte", to]] }).then((r) => r.rows.map((x) => x.data)), c.D.all("companies"), c.D.all("blanks")]);
    const cos = new Map(companies.map((r) => [r.id, r.data.name])), bl = new Map(blanks.map((r) => [r.id, r.data.name]));
    const sess = sessAll.filter((s) => !s.cancelled), sid = new Set(sess.map((s) => s.id)), sById = new Map(sess.map((s) => [s.id, s]));
    const live = [["revoked", "null", true], ["renewed", "null", true]], n = /* @__PURE__ */ __name((where) => c.D.query("certs", { where, limit: 0, count: true }).then((r) => r.total || 0), "n");
    const [enrMap, tById, issuedN, soonN, expiredN] = await Promise.all([
      enrsFor(c.D, [...sid], ["sid", "tid", "att", "final"]),
      queryIn(c.D, "trainees", "id", sess.flatMap((s) => s.traineeIds || []), { fields: ["co"] }).then((l) => new Map(l.map((t) => [t.id, t]))),
      n([["revoked", "null", true], ["issuedAt", "gte", from], ["issuedAt", "lte", to + "T99"]]),
      n([...live, ["exp", "gte", today], ["exp", "lte", daysBefore(today, -cfg.expDays)]]),
      n([...live, ["exp", "lt", today]])
    ]);
    const w = { enrs: [...enrMap.values()].flat(), tById };
    const out3 = { from, to, today, expDays: cfg.expDays, trained: 0, passed: 0, failed: 0, pending: 0, sessions: sess.length, issued: 0, expiring: 0, expired: 0, byCompany: (
      /** @type {any[]} */
      []
    ), byCourse: (
      /** @type {any[]} */
      []
    ) };
    const co = /* @__PURE__ */ new Map(), cr = /* @__PURE__ */ new Map();
    for (const s of sess) cr.set(s.bid, { bid: s.bid, name: bl.get(s.bid) || "\u2014", sessions: 0, trainees: 0, passed: 0, ...cr.get(s.bid) }), cr.get(s.bid).sessions++;
    for (const e of w.enrs) {
      if (!sid.has(e.sid) || !e.att) continue;
      const s = sById.get(e.sid), t = w.tById.get(e.tid);
      out3.trained++;
      const key = t?.co && cos.has(t.co) ? t.co : "", row = co.get(key) || { id: key, name: key ? cos.get(key) : "", trainees: 0, passed: 0 };
      row.trainees++;
      co.set(key, row);
      const cur = s && cr.get(s.bid);
      if (cur) cur.trainees++;
      if (e.final?.outcome === "PASS") {
        out3.passed++;
        row.passed++;
        cur.passed++;
      } else if (e.final) out3.failed++;
      else out3.pending++;
    }
    const released = out3.passed + out3.failed;
    out3.passRate = released ? Math.round(out3.passed / released * 1e3) / 10 : null;
    out3.issued = issuedN;
    out3.expiring = soonN;
    out3.expired = expiredN;
    const top = cfg.top;
    out3.byCompany = [...co.values()].sort((a, b) => b.trainees - a.trainees).slice(0, top);
    out3.companiesTotal = co.size;
    out3.byCourse = [...cr.values()].sort((a, b) => b.trainees - a.trainees || b.sessions - a.sessions).slice(0, top);
    out3.coursesTotal = cr.size;
    return out3;
  } },
  /* -------------------------------------------------------------- cameras
     Saved camera set-ups (browser/USB cameras by device label, or network cameras by URL) and snapshots, superadmin only. */
  "GET /cameras": { auth: "staff", act: "camera", async fn(c) {
    const cams = await Promise.all((await c.D.all("cams")).map(async (r) => ({ ...r.data, pass: await unseal(c.env.TOKEN_SECRET, r.data.pass) })));
    return { cams: cams.sort((a, b) => a.createdAt < b.createdAt ? -1 : 1), snaps: (await c.D.all("snaps")).map((r) => r.data).sort((a, b) => a.at < b.at ? 1 : -1) };
  } },
  "POST /camera/save": { auth: "staff", act: "camera", async fn(c) {
    const b = await c.body();
    let x;
    const f = {
      name: str(b.name, 80),
      kind: b.kind === "ip" ? "ip" : "usb",
      deviceId: str(b.deviceId, 200),
      label: str(b.label, 200),
      url: str(b.url, 500),
      notes: str(b.notes, 300),
      res: str(b.res, 20),
      host: str(b.host, 120),
      port: num(b.port, 1, 65535) ?? "",
      user: str(b.user, 80),
      pass: str(b.pass, 120),
      mode: ["mjpeg", "snap", "rtsp"].includes(b.mode) ? b.mode : ""
    };
    need(f.name, "badInput");
    if (f.kind === "ip") {
      need(/^(https?|rtsp):\/\/[^\s]+$/i.test(f.url), "badLink");
      if (f.url.startsWith("rtsp")) f.mode = "rtsp";
    }
    f.pass = await seal(c.env.TOKEN_SECRET, f.pass);
    if (b.id) {
      x = await c.D.get("cams", str(b.id, 60));
      need(x, "noRec", 404);
      if (!b.pass && x.pass) f.pass = x.pass;
      Object.assign(x, f);
    } else x = { id: uid("cam"), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put("cams", [{ id: x.id, data: x }]);
    await audit(c, "camera.save", `${x.name}${x.host ? " " + x.host : ""}`, { entity: { kind: "camera", id: x.id, label: x.name } });
    return { cam: { ...x, pass: await unseal(c.env.TOKEN_SECRET, x.pass) } };
  } },
  "POST /camera/snapshot": { auth: "staff", act: "camera", raw: true, async fn(c) {
    const cid = str(c.url.searchParams.get("cid"), 60), cam = await c.D.get("cams", cid);
    need(cam, "noRec", 404);
    const buf = await c.req.arrayBuffer();
    need(buf.byteLength && buf.byteLength <= 3e6 && jpg(buf), "badFile");
    const key = "camera/" + rnd(8) + ".jpg", id = uid("sn");
    await c.B.put(key, buf, { httpMetadata: { contentType: "image/jpeg" } });
    const x = { id, cid, camName: cam.name, key, note: str(c.url.searchParams.get("note"), 200), at: new Date(c.now()).toISOString(), by: c.user.email, size: buf.byteLength };
    await c.D.put("snaps", [{ id, data: x }]);
    await audit(c, "camera.snapshot", cam.name);
    return J({ snap: x });
  } },
  "GET /camera/snap": { auth: "staff", act: "camera", raw: true, async fn(c) {
    const k = c.url.searchParams.get("key") || "";
    need(/^camera\/[a-f0-9]{16}\.jpg$/.test(k), "badInput");
    const o = await c.B.get(k);
    need(o, "noRec", 404);
    return new Response(o.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" } });
  } },
  "POST /camera/delete": { auth: "staff", act: "camera", async fn(c) {
    const b = await c.body(), id = str(b.id, 60);
    if (b.snap) {
      const x = await c.D.get("snaps", id);
      if (x) {
        await c.B.delete(x.key);
        await c.D.del("snaps", id);
      }
    } else {
      await c.D.del("cams", id);
    }
    await audit(c, "camera.delete", id);
    return { ok: 1 };
  } },
  /* "Clear camera data": all saved snapshots, or snapshots + camera set-ups. */
  "POST /cameras/clear": { auth: "staff", act: "camera", async fn(c) {
    const b = await c.body();
    let n = 0;
    for (const r of await c.D.all("snaps")) {
      await c.B.delete(r.data.key);
      n++;
    }
    await c.D.delCol("snaps");
    if (b.all) await c.D.delCol("cams");
    await audit(c, "camera.clear", b.all ? "all" : "snapshots");
    return { removed: n };
  } }
};

// _lib/cache.js
var cp = /* @__PURE__ */ __name((v) => v === null || v === void 0 ? v : structuredClone(v), "cp");
function cached(D) {
  const one = /* @__PURE__ */ new Map(), full = /* @__PURE__ */ new Map(), misc = /* @__PURE__ */ new Map(), pend = /* @__PURE__ */ new Map();
  const key = /* @__PURE__ */ __name((col, id) => col + "\0" + id, "key");
  const dropMisc = /* @__PURE__ */ __name((col) => {
    for (const k of misc.keys()) if (k.startsWith(col + "\0")) misc.delete(k);
  }, "dropMisc");
  const flush = /* @__PURE__ */ __name(async (col) => {
    const p = pend.get(col);
    pend.delete(col);
    const ids = [...p.keys()];
    try {
      let rows;
      if (ids.length === 1 || !D.getMany) rows = await Promise.all(ids.map(async (id) => ({ id, data: await D.get(col, id) })));
      else rows = await D.getMany(col, ids);
      const got = new Map(rows.map((r) => [String(r.id), r.data ?? null]));
      for (const id of ids) {
        const v = got.has(String(id)) ? got.get(String(id)) : null;
        one.set(key(col, id), Promise.resolve(v));
        for (const [res] of p.get(id)) res(cp(v));
      }
    } catch (e) {
      for (const id of ids) {
        one.delete(key(col, id));
        for (const [, rej] of p.get(id)) rej(e);
      }
    }
  }, "flush");
  const loadFull = /* @__PURE__ */ __name((col) => {
    if (full.has(col)) return full.get(col);
    const f = { m: null, ops: [], p: (
      /** @type {any} */
      null
    ) };
    f.p = D.all(col).then((rows) => {
      const m = new Map(rows.map((r) => [String(r.id), r]));
      for (const op of f.ops || []) op(m);
      f.ops = null;
      f.m = m;
      return m;
    });
    f.p.catch(() => full.delete(col));
    full.set(col, f);
    return f;
  }, "loadFull");
  const onFull = /* @__PURE__ */ __name((col, op) => {
    const f = full.get(col);
    if (!f) return;
    if (f.m) op(f.m);
    else f.ops.push(op);
  }, "onFull");
  const put1 = /* @__PURE__ */ __name((col, id, data) => {
    one.set(key(col, id), Promise.resolve(cp(data)));
    if (full.has(col)) {
      const r = { id, data: cp(data) };
      onFull(col, (m) => m.set(String(id), r));
    }
    dropMisc(col);
  }, "put1");
  const del1 = /* @__PURE__ */ __name((col, id) => {
    one.set(key(col, id), Promise.resolve(null));
    onFull(col, (m) => m.delete(String(id)));
    dropMisc(col);
  }, "del1");
  const rowsOf = /* @__PURE__ */ __name(async (col) => [...(await loadFull(col).p).values()], "rowsOf");
  const copies = /* @__PURE__ */ __name((rows) => rows.map((r) => ({ id: r.id, data: cp(r.data) })), "copies");
  return {
    ...D,
    get(col, id) {
      const k = key(col, id);
      if (one.has(k)) return one.get(k).then(cp);
      if (full.has(col)) {
        const v = loadFull(col).p.then((m) => m.get(String(id))?.data ?? null);
        one.set(k, v);
        return v.then(cp);
      }
      return new Promise((res, rej) => {
        let p = pend.get(col);
        if (!p) {
          p = /* @__PURE__ */ new Map();
          pend.set(col, p);
          Promise.resolve().then(() => flush(col));
        }
        if (!p.has(id)) p.set(id, []);
        p.get(id).push([res, rej]);
      });
    },
    all(col) {
      return rowsOf(col).then(copies);
    },
    byField(col, f, v) {
      if (full.has(col)) return rowsOf(col).then((rows) => copies(rows.filter((r) => String(r.data?.[f]) === String(v))));
      const k = col + "\0f\0" + f + "\0" + v;
      if (!misc.has(k)) misc.set(k, D.byField(col, f, v));
      return misc.get(k).then(copies);
    },
    prefix(col, p) {
      if (full.has(col)) return rowsOf(col).then((rows) => copies(rows.filter((r) => String(r.id).startsWith(p)).sort((a, b) => String(a.id) < String(b.id) ? -1 : 1)));
      const k = col + "\0p\0" + p;
      if (!misc.has(k)) misc.set(k, D.prefix(col, p));
      return misc.get(k).then(copies);
    },
    query(col, spec = {}) {
      const k = col + "\0q\0" + JSON.stringify(spec);
      if (!misc.has(k)) {
        const p = D.query(col, spec);
        misc.set(k, p);
        p.catch(() => misc.delete(k));
      }
      return misc.get(k).then((r) => ({ total: r.total, rows: copies(r.rows) }));
    },
    async put(col, rows) {
      const r = await D.put(col, rows);
      for (const x of rows) put1(col, x.id, x.data);
      return r;
    },
    async insert(col, id, data) {
      const r = await D.insert(col, id, data);
      put1(col, id, data);
      return r;
    },
    async insertMany(col, rows) {
      const r = await D.insertMany(col, rows);
      const by = new Map(rows.map((x) => [x.id, x]));
      for (const id of r || []) {
        const x = by.get(id);
        if (x) put1(col, id, x.data);
      }
      return r;
    },
    async del(col, id) {
      const r = await D.del(col, id);
      del1(col, id);
      return r;
    },
    async delMany(col, ids) {
      const r = await D.delMany(col, ids);
      for (const id of ids) del1(col, id);
      return r;
    },
    async restore(...a) {
      const r = await D.restore(...a);
      one.clear();
      full.clear();
      misc.clear();
      return r;
    }
  };
}
__name(cached, "cached");

// _lib/live.js
var QUIET = /* @__PURE__ */ new Set(["audit", "notes", "nseen", "msgs", "threads"]);
var MANY = 50;
function tracked(D) {
  const t = { any: false, keys: /* @__PURE__ */ new Set() };
  const note = /* @__PURE__ */ __name((col, rows) => {
    if (QUIET.has(col)) return;
    t.any = true;
    for (const { id, data } of rows) {
      const k = String(id ?? "");
      if (col === "enr") {
        const [sid, tid] = k.split("|");
        t.keys.add("rev|s|" + sid);
        if (tid) t.keys.add("rev|p|" + tid);
      } else if (col === "sessions") {
        t.keys.add("rev|s|" + k);
        if (data?.tid) t.keys.add("rev|t|" + data.tid);
        const ids = data?.traineeIds || [];
        if (ids.length > MANY) t.keys.add("rev|p|*");
        else ids.forEach((x) => t.keys.add("rev|p|" + x));
      } else if (col === "signs") {
        const [doc, sid] = k.split("|");
        if (doc !== "cert" && sid) t.keys.add("rev|s|" + sid);
      } else if (col === "certs") {
        if (data?.sid) t.keys.add("rev|s|" + data.sid);
        if (data?.tid) t.keys.add("rev|p|" + data.tid);
        if (data?.co) t.keys.add("rev|c|" + data.co);
      } else if (col === "trainees") {
        t.keys.add("rev|p|" + k);
        if (data?.co) t.keys.add("rev|c|" + data.co);
      } else if (col === "requests" || col === "companies") t.keys.add("rev|c|" + (data?.co || (col === "companies" ? k : "")));
      else if (col === "tests" || col === "blanks" || col === "trainers") t.keys.add("rev|p|*");
    }
  }, "note");
  const wrap = {
    ...D,
    put: /* @__PURE__ */ __name(async (col, rows) => {
      const r = await D.put(col, rows);
      note(col, rows);
      return r;
    }, "put"),
    insert: /* @__PURE__ */ __name(async (col, id, data) => {
      const r = await D.insert(col, id, data);
      note(col, [{ id, data }]);
      return r;
    }, "insert"),
    del: /* @__PURE__ */ __name(async (col, id) => {
      const r = await D.del(col, id);
      note(col, [{ id }]);
      return r;
    }, "del"),
    delMany: /* @__PURE__ */ __name(async (col, ids) => {
      const r = await D.delMany(col, ids);
      note(col, ids.map((id) => ({ id })));
      return r;
    }, "delMany"),
    restore: /* @__PURE__ */ __name(async (...a) => {
      const r = await D.restore(...a);
      t.any = true;
      t.keys.add("rev|p|*");
      return r;
    }, "restore")
  };
  const flush = /* @__PURE__ */ __name(async () => {
    if (!t.any) return;
    let keys = [...t.keys];
    const per = keys.filter((k) => k.startsWith("rev|p|") && k !== "rev|p|*");
    if (per.length > 10) keys = [...keys.filter((k) => !per.includes(k) && k !== "rev|p|*"), "rev|p|*"];
    if (keys.length > 30) keys = [...keys.filter((k) => k.startsWith("rev|c|") || k === "rev|p|*").slice(0, 25), ...keys.filter((k) => k.startsWith("rev|s|") || k.startsWith("rev|t|")).slice(0, 5)];
    await Promise.all([D.seq("rev"), ...keys.map((k) => D.seq(k))]).catch(() => {
    });
  }, "flush");
  return { D: wrap, flush };
}
__name(tracked, "tracked");
var revOf = /* @__PURE__ */ __name(async (D, ...keys) => (await Promise.all(keys.map((k) => D.peek(k)))).join("."), "revOf");

// _lib/routes_groups.js
async function readGroup(c, b) {
  const name = str(b.name, 120);
  need(name, "needName");
  const ids = [...new Set((b.traineeIds || []).map((x) => str(x, 60)))].slice(0, 1e3);
  for (const id of ids) need(await c.D.get("trainees", id), "badInput");
  return { name, note: str(b.note, 500), traineeIds: ids };
}
__name(readGroup, "readGroup");
var groupRoutes = {
  "GET /groups": { auth: "staff", act: "library", async fn(c) {
    return { list: (await c.D.all("groups")).map((r) => r.data).sort((a, b) => a.name.localeCompare(b.name)) };
  } },
  "POST /group/save": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), f = await readGroup(c, b);
    let x;
    if (b.id) {
      x = await c.D.get("groups", str(b.id, 60));
      need(x, "noRec", 404);
      Object.assign(x, f, { updatedAt: new Date(c.now()).toISOString() });
    } else x = { id: uid("g"), ...f, createdAt: new Date(c.now()).toISOString(), by: c.user.email };
    await c.D.put("groups", [{ id: x.id, data: x }]);
    await audit(c, b.id ? "group.update" : "group.create", `${x.name} (${x.traineeIds.length})`, { entity: { kind: "group", id: x.id, label: x.name } });
    return { group: x };
  } },
  "POST /groups/delete": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), ids = [...new Set((b.ids || []).map((x) => str(x, 60)))].slice(0, 1e3);
    need(ids.length, "badInput");
    let n = 0;
    for (const id of ids) {
      const x = await c.D.get("groups", id);
      if (x) {
        await c.D.del("groups", id);
        n++;
      }
    }
    await audit(c, "group.delete", `${n} group(s)`);
    return { ok: 1, n };
  } },
  "POST /group/delete": { auth: "staff", act: "session.save", async fn(c) {
    const b = await c.body(), x = await c.D.get("groups", str(b.id, 60));
    need(x, "noRec", 404);
    await c.D.del("groups", x.id);
    await audit(c, "group.delete", x.name);
    return { ok: 1 };
  } }
};

// _lib/routes_candidates.js
var mask = /* @__PURE__ */ __name((fin) => fin ? "\u2022\u2022\u2022\u2022\u2022" + String(fin).slice(-2) : "", "mask");
var out = /* @__PURE__ */ __name((x, fin) => ({ ...x, person: { ...x.person, fin: fin ? x.person.fin : mask(x.person.fin) } }), "out");
async function dupFinChecks(c, fin) {
  need(!await c.D.get("fins", fin), "finRegistered", 409);
  const open = (await c.D.query("candreq", { where: [["status", "eq", "pending"], ["person.fin", "eq", fin]], limit: 1 })).rows[0];
  need(!open, "dupRequest", 409);
}
__name(dupFinChecks, "dupFinChecks");
var candidateRoutes = {
  "POST /portal/company/candidate": { auth: "company", async fn(c) {
    const b = await c.body(), co = c.me, strict = !co.reqOptional;
    const p = readPerson(b, { finOptional: !strict, phoneRequired: strict });
    const st = await getSettings(c.D);
    need(!st.privacy?.consentRequired || bool(b.consent), "needConsent");
    if (p.fin) {
      await dupFinChecks(c, p.fin);
    }
    const x = { id: uid("cr"), co: co.id, coName: co.name, person: p, consent: bool(b.consent), status: "pending", at: new Date(c.now()).toISOString(), by: co.contactPerson || co.name };
    await c.D.put("candreq", [{ id: x.id, data: x }]);
    await audit(c, "candidate.request", `${co.name} \xB7 ${shared_exports.fullAz(p)}`);
    await notify(c, "staff:a:cand.approve", "nCandNew", [co.name, shared_exports.fullAz(p)], "#/approvals");
    return { request: out(x, false) };
  } },
  /* batch registration from the Excel form (same template as the office; FIN + phone required unless the company is set optional) */
  "POST /portal/company/candidates/import": { auth: "company", async fn(c) {
    const b = await c.body(), co = c.me, rows = Array.isArray(b.rows) ? b.rows.slice(0, 100) : [];
    need(rows.length, "badInput");
    const strict = !co.reqOptional, st = await getSettings(c.D);
    const pending = (await c.D.byField("candreq", "co", co.id)).map((r) => r.data).filter((x) => x.status === "pending" && x.person.fin);
    const openFins = new Set(pending.map((x) => x.person.fin)), seen = /* @__PURE__ */ new Set(), out1 = [], mk = [];
    for (const [i, r] of rows.entries()) {
      const row = { row: r.row ?? i + 2 };
      try {
        const p = readPerson(r, { finOptional: !strict, phoneRequired: strict });
        if (p.fin) {
          if (seen.has(p.fin)) throw new H(409, "dupInFile");
          seen.add(p.fin);
          if (await c.D.get("fins", p.fin)) throw new H(409, "finRegistered");
          if (openFins.has(p.fin)) throw new H(409, "dupRequest");
        }
        if (st.privacy?.consentRequired && !bool(r.consent)) throw new H(400, "needConsent");
        mk.push({ row, person: p, consent: bool(r.consent) });
      } catch (e) {
        if (!(e instanceof H)) throw e;
        out1.push({ ...row, status: "error", error: e.message });
      }
    }
    const put = [];
    for (const x of mk) {
      const rec = { id: uid("cr"), co: co.id, coName: co.name, person: x.person, consent: x.consent, status: "pending", at: new Date(c.now()).toISOString(), by: co.contactPerson || co.name };
      put.push({ id: rec.id, data: rec });
      out1.push({ ...x.row, status: "queued", name: shared_exports.fullAz(x.person) });
    }
    if (put.length) await c.D.put("candreq", put);
    out1.sort((a, b2) => a.row - b2.row);
    await audit(c, "candidate.request", `${co.name} \xB7 Excel ${put.length}/${rows.length}`);
    return { results: out1 };
  } },
  "GET /portal/company/candidates": { auth: "company", async fn(c) {
    return { list: (await c.D.byField("candreq", "co", c.me.id)).map((r) => out(r.data, false)).sort((a, b) => b.at.localeCompare(a.at)) };
  } },
  "POST /portal/company/candidate/cancel": { auth: "company", async fn(c) {
    const b = await c.body(), x = await c.D.get("candreq", str(b.id, 60));
    need(x && x.co === c.me.id && x.status === "pending", "noRec", 404);
    await c.D.del("candreq", x.id);
    await audit(c, "candidate.cancel", `${c.me.name} \xB7 ${shared_exports.fullAz(x.person)}`);
    return { ok: 1 };
  } }
};
async function pendingCandidates(c) {
  const fin = shared_exports.can(c.user.role, "fin.view");
  const list2 = (await c.D.query("candreq", { where: [["status", "eq", "pending"]] })).rows.map((r) => r.data);
  const same2 = await Promise.all(list2.map((x) => x.person?.fin ? [] : sameNamePeople(c, x.person)));
  return list2.map((x, i) => ({ ...out(x, fin), ...same2[i].length ? { sameName: same2[i].map((p) => ({ att: p.att || p.login, name: p.name })) } : {} })).sort((a, b) => a.at.localeCompare(b.at));
}
__name(pendingCandidates, "pendingCandidates");
async function decideCandidate(c, id, ok, review) {
  need(shared_exports.can(c.user.role, "cand.approve"), "forbidden", 403);
  const x = await c.D.get("candreq", str(id, 60));
  need(x && x.status === "pending", "noRec", 404);
  let created = null;
  if (ok) {
    need(await c.D.get("companies", x.co), "badCompany");
    created = await createTrainee(c, { ...x.person, co: x.co, consent: x.consent, sameNameOk: true }, { strict: false });
    x.traineeId = created.t.id;
  }
  x.status = ok ? "approved" : "returned";
  x.review = review;
  await c.D.put("candreq", [{ id: x.id, data: x }]);
  await notify(c, "company:" + x.co, ok ? "nCandOk" : "nCandRet", [shared_exports.fullAz(x.person), review.note || ""], "cands");
  await audit(c, ok ? "candidate.approve" : "candidate.return", `${x.coName} \xB7 ${shared_exports.fullAz(x.person)}${created ? " \u2192 " + created.t.att : ""}${review.note ? " \xB7 " + review.note : ""}`);
  return { request: out(x, shared_exports.can(c.user.role, "fin.view")), ...created ? { trainee: { id: created.t.id, att: created.t.att, name: shared_exports.fullAz(created.t) }, creds: { login: created.t.login, password: created.password } } : {} };
}
__name(decideCandidate, "decideCandidate");

// _lib/routes_approvals.js
var testItem = /* @__PURE__ */ __name((x) => ({
  id: x.id,
  title: x.title,
  bid: x.bid || "",
  owner: x.owner || null,
  at: x.proposal?.at || x.updatedAt || x.createdAt,
  change: !!x.proposal,
  current: x.proposal ? { questions: x.questions, title: x.title } : null,
  ...x.proposal ? { ...x.proposal, id: x.id } : x,
  status: x.status
}), "testItem");
var pendingTest = /* @__PURE__ */ __name((x) => x.status === "pending" || x.proposal && !x.proposal.returned, "pendingTest");
var approvalRoutes = {
  "GET /approvals": { auth: "staff", act: "approve", async fn(c) {
    const cand = shared_exports.can(c.user.role, "cand.approve");
    const [testRows, matRows, certRows, candidates, links, st] = await Promise.all([
      c.D.all("tests"),
      c.D.all("materials"),
      c.D.query("certs", { where: [["approval.status", "eq", "pending"]] }),
      cand ? pendingCandidates(c) : [],
      cand ? pendingLinks(c) : [],
      getSettings(c.D)
    ]);
    const tests = testRows.map((r) => r.data).filter(pendingTest).map(testItem);
    const materials = matRows.map((r) => r.data).filter((m) => m.status === "pending");
    const certs = certRows.rows.map((r) => r.data).map(({ vh: vh2, sk, exp, cox, ...x }) => x);
    return { tests, materials, certs, candidates, links, settings: shared_exports.approvalsCfg(st) };
  } },
  "POST /approval/decide": { auth: "staff", act: "approve", async fn(c) {
    const b = await c.body(), ok = bool(b.approve), note = str(b.note, 1e3), at = new Date(c.now()).toISOString(), by = c.user.email;
    need(ok || note, "needNote");
    const review = { by, at, note, decision: ok ? "approved" : "returned" };
    if (b.kind === "test") {
      const x = await c.D.get("tests", str(b.id, 60));
      need(x && pendingTest(x), "noRec", 404);
      if (x.proposal) {
        if (ok) {
          const { by: _b, at: _a, returned: _r, ...f } = x.proposal;
          Object.assign(x, f, { updatedAt: at });
          delete x.proposal;
        } else x.proposal.returned = review;
      } else x.status = ok ? "active" : "returned";
      x.review = review;
      await c.D.put("tests", [{ id: x.id, data: x }]);
      await audit(c, ok ? "approval.approve" : "approval.return", `test \xB7 ${x.title}${note ? " \xB7 " + note : ""}`, { entity: { kind: "test", id: x.id, label: x.title } });
      return { test: x };
    }
    if (b.kind === "material") {
      const x = await c.D.get("materials", str(b.id, 60));
      need(x && x.status === "pending", "noRec", 404);
      x.status = ok ? "active" : "returned";
      x.review = review;
      await c.D.put("materials", [{ id: x.id, data: x }]);
      await audit(c, ok ? "approval.approve" : "approval.return", `material \xB7 ${x.title}${note ? " \xB7 " + note : ""}`);
      return { material: x };
    }
    if (b.kind === "cert") {
      const no = shared_exports.normCertNo(b.id), x = await c.D.get("certs", no);
      need(x && x.approval?.status === "pending", "noRec", 404);
      const mode = ok && ["esign", "image"].includes(b.sign) ? b.sign : "";
      if (mode) {
        need(shared_exports.can(c.user.role, "cert.sign"), "forbidden", 403);
        const me = await c.D.get("staff", c.user.id) || /** @type {import('../../types/records').StaffRecord} */
        {};
        need(String(me.name || "").trim(), "needName", 409);
        if (mode === "image") need(me.sigKey, "needSigImage", 409);
      }
      x.approval = { ...x.approval, status: ok ? "approved" : "returned", review };
      await c.D.put("certs", [{ id: no, data: x }]);
      await audit(c, ok ? "approval.approve" : "approval.return", `certificate \xB7 ${no}${note ? " \xB7 " + note : ""}`, { entity: { kind: "cert", id: no, label: no } });
      return { cert: mode ? await signCert(c, no, mode) : x };
    }
    if (b.kind === "cand") return decideCandidate(c, b.id, ok, review);
    if (b.kind === "link") {
      need(shared_exports.can(c.user.role, "cand.approve"), "forbidden", 403);
      return decideLink(c, b.id, ok, review);
    }
    throw new H(400, "badInput");
  } },
  /* a returned certificate is corrected (Certificates -> edit) and sent back to the approver */
  "POST /cert/resubmit": { auth: "staff", act: "cert.update", async fn(c) {
    const no = shared_exports.normCertNo((await c.body()).no), x = await c.D.get("certs", no);
    need(x && x.approval?.status === "returned", "noRec", 404);
    x.approval = { status: "pending", at: new Date(c.now()).toISOString(), by: c.user.email, again: true };
    await c.D.put("certs", [{ id: no, data: x }]);
    await audit(c, "approval.resubmit", `certificate \xB7 ${no}`);
    return { cert: x };
  } },
  /* ---------------------------------------------- a trainer's own question banks (always reviewed) */
  "GET /portal/trainer/tests": { auth: "trainer", async fn(c) {
    const mine = (await c.D.all("tests")).map((r) => r.data).filter((x) => x.owner?.kind === "trainer" && x.owner.id === c.me.id).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return { list: mine, blanks: (await c.D.all("blanks")).map((r) => ({ id: r.id, name: r.data.name })) };
  } },
  "POST /portal/trainer/test/save": { auth: "trainer", async fn(c) {
    const b = await c.body(), f = await testFields(c, b);
    let x = null;
    if (b.id) {
      x = await c.D.get("tests", str(b.id, 60));
      need(x && x.owner?.kind === "trainer" && x.owner.id === c.me.id, "noRec", 404);
    }
    return { test: await storeTest(c, x, f, { submit: bool(b.submit), direct: false, owner: { kind: "trainer", id: c.me.id, name: shared_exports.fullAz(c.me, false) } }) };
  } },
  "POST /portal/trainer/test/delete": { auth: "trainer", async fn(c) {
    const b = await c.body(), x = await c.D.get("tests", str(b.id, 60));
    need(x && x.owner?.kind === "trainer" && x.owner.id === c.me.id, "noRec", 404);
    need((x.status || "active") !== "active", "testActive", 409);
    await c.D.del("tests", x.id);
    await audit(c, "test.delete", `${x.title} (by trainer)`);
    return { ok: 1 };
  } }
};

// _lib/routes_ai.js
var NO = "NO_ANSWER";
var FALLBACK = { az: "Bu sual\u0131n cavab\u0131 t\u0259sdiql\u0259nmi\u015F bilik bazas\u0131nda yoxdur. Z\u0259hm\u0259t olmasa, t\u0259lim\xE7inizd\u0259n soru\u015Fun.", en: "The approved knowledge base does not cover this question. Please ask your trainer.", ru: "\u0412 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0439 \u0431\u0430\u0437\u0435 \u0437\u043D\u0430\u043D\u0438\u0439 \u043D\u0435\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0432\u043E\u043F\u0440\u043E\u0441. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0443." };
var lang = /* @__PURE__ */ __name((v) => ["az", "en", "ru"].includes(v) ? v : "az", "lang");
async function ctx(c, part) {
  c.settings = await getSettings(c.D);
  const cfg = aiCfg(c.settings);
  need(cfg.on && (!part || cfg[part]), "aiOff", 404);
  need(await aiReady(c), "aiNotConfigured", 503);
  return cfg;
}
__name(ctx, "ctx");
var activeDocs = /* @__PURE__ */ __name(async (c) => (await c.D.all("kb")).map((r) => r.data).filter((d) => d.on !== false), "activeDocs");
async function expand(c, q2) {
  try {
    return await llm(c, { system: "You turn a question into search keywords. Output one line only: 8-25 keywords in Azerbaijani, English and Russian (synonyms and technical terms included), separated by spaces. No explanations.", messages: [{ role: "user", content: q2.slice(0, 600) }], max: 120 });
  } catch {
    return "";
  }
}
__name(expand, "expand");
async function answer(c, question, history, lg) {
  const docs = await activeDocs(c);
  let hits = search(docs, question);
  if (hits.length < 3) {
    const more = search(docs, question + " " + await expand(c, question));
    const seen = new Set(hits.map((h) => h.id + h.text));
    hits = [...hits, ...more.filter((h) => !seen.has(h.id + h.text))].slice(0, 6);
  }
  if (!hits.length) return { answer: FALLBACK[lg], grounded: false, sources: [] };
  const excerpts = hits.map((h, i) => `[${i + 1}] (${h.title})
${h.text}`).join("\n\n");
  const system = `You are the training assistant of a vocational training centre (lifting operations, health and safety).
Answer the trainee's question using ONLY the EXCERPTS below. Do not use any other knowledge.
If the excerpts do not contain the answer, reply with exactly: ${NO}
Reply in ${LANG_NAME[lg]}, clearly and briefly (at most about 150 words). Put the excerpt numbers you used in square brackets, e.g. [1].
Never invent regulations, numbers or procedures. Safety-critical instructions must match the excerpts word for word in meaning.

EXCERPTS:
${excerpts}`;
  const msgs = [...(history || []).slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: str(m.text, 1500) })).filter((m) => m.content), { role: "user", content: question }];
  const out3 = await llm(c, { system, messages: msgs, max: 600 });
  if (!out3 || out3.includes(NO)) return { answer: FALLBACK[lg], grounded: false, sources: [] };
  const used = [...new Set([...out3.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]).filter((n) => n >= 1 && n <= hits.length))];
  return { answer: out3, grounded: true, sources: [...new Set((used.length ? used : [1]).map((n) => hits[n - 1].title))] };
}
__name(answer, "answer");
async function rateLimit(c, who, cfg) {
  const n = await c.D.seq(`ai|${who}|${c.today()}`);
  need(n <= cfg.daily, "aiLimit", 429);
}
__name(rateLimit, "rateLimit");
var aiRoutes = {
  /* ---------------------------------------------------------------- admin */
  "GET /ai": { auth: "staff", act: "library", async fn(c) {
    c.settings = await getSettings(c.D);
    const cfg = aiCfgPublic(c.settings), sup = shared_exports.can(c.user.role, "users");
    return {
      cfg: sup ? cfg : { on: cfg.on, provider: cfg.provider, model: cfg.model, chat: cfg.chat, reports: cfg.reports, daily: cfg.daily },
      ready: await aiReady(c),
      defaults: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.model])),
      envKeys: sup ? Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, !!c.env[v.env]])) : {},
      binding: !!c.env.AI?.run,
      docs: (await c.D.all("kb")).map((r) => {
        const { chunks: chunks2, text, ...d } = r.data;
        return { ...d, chars: (text || "").length, parts: (chunks2 || []).length };
      }).sort((a, b) => a.title.localeCompare(b.title))
    };
  } },
  /* switching the module on / off, provider, model and key: superadmin. A key is stored encrypted; an empty key field keeps
     the stored one, "clearKey" removes it. Keys are never sent back. */
  "POST /ai/settings": { auth: "staff", act: "users", async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), cur = aiCfg(st);
    const provider = PROVIDERS[b.provider] ? b.provider : cur.provider;
    const models = { ...cur.models };
    if (b.model !== void 0) {
      const m = str(b.model, 160).trim();
      if (m) models[provider] = m;
      else delete models[provider];
    }
    const keys = { ...st.ai?.keys || {} };
    if (b.clearKey) delete keys[provider];
    const k = String(b.key || "").trim();
    if (k) {
      need(k.length >= 8 && k.length <= 400 && !/\s/.test(k), "badInput");
      keys[provider] = { v: await seal(c.env.TOKEN_SECRET, k), tail: k.slice(-4), at: new Date(c.now()).toISOString(), by: c.user.email };
    }
    let baseUrl = cur.baseUrl;
    if (b.baseUrl !== void 0) {
      baseUrl = str(b.baseUrl, 200).trim();
      need(!baseUrl || /^https:\/\/[^\s/]+/i.test(baseUrl), "badInput");
    }
    const accountId = b.accountId !== void 0 ? str(b.accountId, 64).trim() : cur.accountId;
    st.ai = {
      on: b.on !== void 0 ? bool(b.on) : cur.on,
      provider,
      models,
      keys,
      baseUrl,
      accountId,
      chat: b.chat !== void 0 ? bool(b.chat) : cur.chat,
      reports: b.reports !== void 0 ? bool(b.reports) : cur.reports,
      daily: num(b.daily, 1, 5e3, cur.daily)
    };
    await c.D.put("settings", [{ id: "main", data: st }]);
    await audit(c, "ai.settings", `on=${st.ai.on} ${provider} ${models[provider] || PROVIDERS[provider].model} chat=${st.ai.chat} reports=${st.ai.reports}${k ? " \xB7 key changed" : ""}${b.clearKey ? " \xB7 key removed" : ""}`);
    c.settings = st;
    return { cfg: aiCfgPublic(st), ready: await aiReady(c) };
  } },
  /* models of the chosen provider (with the stored key) */
  "GET /ai/models": { auth: "staff", act: "users", async fn(c) {
    c.settings = await getSettings(c.D);
    return { models: await listModels(c) };
  } },
  /* a short test call with the saved settings (works while the module is still switched off) */
  "POST /ai/test": { auth: "staff", act: "users", async fn(c) {
    c.settings = await getSettings(c.D);
    need(await aiReady(c), "aiNotConfigured", 503);
    const t0 = Date.now();
    const out3 = await llm(c, { system: "Reply with one short sentence.", messages: [{ role: "user", content: "Say hello in Azerbaijani, English and Russian." }], max: 80 });
    return { ok: !!out3, text: str(out3, 300), ms: Date.now() - t0, provider: aiCfg(c.settings).provider, model: aiCfg(c.settings).model };
  } },
  /* knowledge base: documents provided and approved by the training centre (admins manage them) */
  "GET /ai/kb": { auth: "staff", act: "library", async fn(c) {
    const x = await c.D.get("kb", str(c.url.searchParams.get("id"), 60));
    need(x, "noRec", 404);
    const { chunks: chunks2, ...d } = x;
    return { doc: d };
  } },
  "POST /ai/kb/save": { auth: "staff", act: "ai.kb", async fn(c) {
    const b = await c.body(), title2 = str(b.title, 200), text = String(b.text || "").slice(0, 4e5).replace(/\u0000/g, "");
    need(title2 && text.trim().length >= 20, "badInput");
    let x;
    if (b.id) {
      x = await c.D.get("kb", str(b.id, 60));
      need(x, "noRec", 404);
    } else x = { id: uid("k"), createdAt: new Date(c.now()).toISOString() };
    Object.assign(x, { title: title2, text, lang: ["az", "en", "ru", "mix"].includes(b.lang) ? b.lang : "mix", source: str(b.source, 200), on: b.on !== false, chunks: chunk(text), updatedAt: new Date(c.now()).toISOString(), by: c.user.email });
    await c.D.put("kb", [{ id: x.id, data: x }]);
    await audit(c, b.id ? "ai.kb.update" : "ai.kb.add", `${title2} (${x.chunks.length})`);
    return { doc: { id: x.id, title: title2, parts: x.chunks.length } };
  } },
  "POST /ai/kb/delete": { auth: "staff", act: "ai.kb", async fn(c) {
    const b = await c.body(), x = await c.D.get("kb", str(b.id, 60));
    need(x, "noRec", 404);
    await c.D.del("kb", x.id);
    await audit(c, "ai.kb.delete", x.title);
    return { ok: 1 };
  } },
  /* admins try the chatbot with the same rules as trainees */
  "POST /ai/try": { auth: "staff", act: "ai.kb", async fn(c) {
    const b = await c.body();
    await ctx(c);
    return answer(c, str(b.q, 1e3), b.history, lang(b.lang));
  } },
  /* -------------------------------------------------------------- trainee */
  "GET /portal/trainee/ai": { auth: "trainee", async fn(c) {
    c.settings = await getSettings(c.D);
    const cfg = aiCfg(c.settings);
    const ok = cfg.on && await aiReady(c);
    return { chat: ok && cfg.chat };
  } },
  "POST /portal/trainee/ai/chat": { auth: "trainee", async fn(c) {
    const cfg = await ctx(c, "chat"), b = await c.body(), q2 = str(b.q, 1e3);
    need(q2.trim().length >= 2, "badInput");
    await rateLimit(c, c.me.id, cfg);
    const r = await answer(c, q2, b.history, lang(b.lang));
    await audit(c, "ai.chat", `${c.me.att} \xB7 ${r.grounded ? "answered" : "not in knowledge base"}`);
    return r;
  } }
  /* No question review for candidates: test questions are confidential. A candidate sees the result only (score, pass / fail). */
};

// _lib/analytics.js
var r1 = /* @__PURE__ */ __name((v) => v === null || v === void 0 || Number.isNaN(v) ? null : Math.round(v * 10) / 10, "r1");
var pct = /* @__PURE__ */ __name((a, b) => b ? r1(a / b * 100) : null, "pct");
var avg = /* @__PURE__ */ __name((xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null, "avg");
var sd = /* @__PURE__ */ __name((xs) => {
  const m = avg(xs);
  return m !== null && xs.length > 1 ? Math.sqrt(avg(xs.map((x) => (x - m) ** 2)) || 0) : null;
}, "sd");
var inc = /* @__PURE__ */ __name((o, k, n = 1) => {
  o[k] = (o[k] || 0) + n;
}, "inc");
var RULES = { attendance: 85, passRate: 70, feedback: 7, question: 40, practical: 75, evalDone: 80, fbDone: 60, reviewDays: 3, expiring: 30 };
function defaultRange(today) {
  const d = new Date(Date.parse(today) - 89 * 864e5).toISOString().slice(0, 10);
  return [d, today];
}
__name(defaultRange, "defaultRange");
async function certFigures(c, scope, from, to, today, st) {
  const D = c.D, soon = st.soonDays ?? SOON_DAYS, in90 = daysBefore(today, -90), in30 = daysBefore(today, -RULES.expiring);
  if (scope.tid) {
    const sids = (await D.query("sessions", { where: [["tid", "eq", scope.tid]], fields: ["date"] })).rows.map((r) => r.id), list2 = [];
    for (let i = 0; i < sids.length; i += 60) list2.push(...(await D.query("certs", { where: [["sid", "in", sids.slice(i, i + 60)], ...scope.bid ? [["bid", "eq", scope.bid]] : []], fields: ["bid", "issuedAt", "expiry", "revoked", "renewed", "approval"] })).rows.map((r) => r.data));
    const ok = list2.filter((x) => !x.revoked), live2 = ok.filter((x) => !x.renewed), left = /* @__PURE__ */ __name((x) => daysBetween(today, x.expiry), "left"), inn = /* @__PURE__ */ __name((d) => live2.filter((x) => left(x) >= 0 && left(x) <= d), "inn");
    return {
      issuedN: ok.filter((x) => String(x.issuedAt || "").slice(0, 10) >= from && String(x.issuedAt || "").slice(0, 10) <= to).length,
      activeN: live2.filter((x) => !(left(x) < 0)).length,
      exp30N: inn(RULES.expiring).length,
      exp90: inn(90),
      expiredN: live2.filter((x) => left(x) < 0).length,
      pendingCert: ok.filter((x) => x.approval?.status === "pending").length
    };
  }
  const base = [...scope.bid ? [["bid", "eq", scope.bid]] : [], ...scope.co ? [["co", "eq", scope.co], ["approval.status", "nn", "pending"], ["approval.status", "nn", "returned"]] : []];
  const live = [...base, ["revoked", "null", true], ["renewed", "null", true]], n = /* @__PURE__ */ __name((where) => D.query("certs", { where, limit: 0, count: true }).then((r) => r.total || 0), "n");
  const [issuedN, activeN, exp30N, exp90, expiredN, pendingCert] = await Promise.all([
    n([...base, ["revoked", "null", true], ["issuedAt", "gte", from], ["issuedAt", "lte", to + "T99"]]),
    n([...live, ["exp", "gte", today]]),
    n([...live, ["exp", "gte", today], ["exp", "lte", in30]]),
    D.query("certs", { where: [...live, ["exp", "gte", today], ["exp", "lte", in90]], fields: ["bid"] }).then((r) => r.rows.map((x) => x.data)),
    n([...live, ["exp", "lt", today]]),
    scope.co ? 0 : n([...base, ["revoked", "null", true], ["approval.status", "eq", "pending"]])
  ]);
  return { issuedN, activeN, exp30N, exp90, expiredN, pendingCert };
}
__name(certFigures, "certFigures");
async function buildAnalytics(c, scope) {
  const D = c.D, today = c.today(), st = await getSettings(D);
  const from = isDate(scope.from) ? scope.from : defaultRange(today)[0], to = isDate(scope.to) ? scope.to : today;
  need(from <= to, "badInput");
  const sw = [["date", "gte", from], ["date", "lte", to], ...scope.tid ? [["tid", "eq", scope.tid]] : []];
  const [sessR, blanksR, trainersR, companiesR] = await Promise.all([D.query("sessions", { where: sw }).then((r) => r.rows), D.all("blanks"), D.all("trainers"), D.all("companies")]);
  const sessionsAll = sessR, ids = sessR.map((r) => r.id);
  const [enrMap, trainees, certStats] = await Promise.all([enrsFor(D, ids, [...ENR_LITE, "test"]), getMany(D, "trainees", sessR.flatMap((r) => r.data.traineeIds || [])), certFigures(c, scope, from, to, today, st)]);
  const enrR = [...enrMap.values()].flat().map((data) => ({ data }));
  const blanks = new Map(blanksR.map((r) => [r.id, r.data])), trainers = new Map(trainersR.map((r) => [r.id, r.data]));
  const companies = new Map(companiesR.map((r) => [r.id, r.data]));
  const enrBy = /* @__PURE__ */ new Map();
  for (const r of enrR) {
    const e = r.data;
    if (!enrBy.has(e.sid)) enrBy.set(e.sid, /* @__PURE__ */ new Map());
    enrBy.get(e.sid).set(e.tid, e);
  }
  const bName = /* @__PURE__ */ __name((id) => blanks.get(id)?.name || "\u2014", "bName"), trName = /* @__PURE__ */ __name((id) => {
    const x = trainers.get(id);
    return x ? fullAz(x, false) : "\u2014";
  }, "trName");
  const kind = scope.kind;
  const trainingOpts = [...new Set(sessionsAll.map((r) => r.data).filter((s) => !s.cancelled && s.date >= from && s.date <= to && (!scope.tid || s.tid === scope.tid) && (!scope.co || (s.traineeIds || []).some((id) => trainees.get(id)?.co === scope.co))).map((s) => s.bid))].map((id) => ({ id, name: bName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  const sessions = sessionsAll.map((r) => r.data).filter((s) => !s.cancelled && s.date >= from && s.date <= to && (!scope.bid || s.bid === scope.bid) && (!scope.tid || s.tid === scope.tid));
  const rows = [];
  for (const s of sessions) for (const tid of s.traineeIds || []) {
    const p = trainees.get(tid);
    if (!p) continue;
    if (scope.co && p.co !== scope.co) continue;
    rows.push({ s, p, e: enrBy.get(s.id)?.get(tid) || { sid: s.id, tid } });
  }
  const sessIds = new Set(rows.map((x) => x.s.id)), inScope = sessions.filter((s) => sessIds.has(s.id) || !scope.co && !(s.traineeIds || []).length);
  const past = /* @__PURE__ */ __name((x) => x.s.date <= today, "past");
  const attRows = rows.filter(past), present = attRows.filter((x) => x.e.att), absent = attRows.filter((x) => !x.e.att && x.e.absent);
  const decided = present.length + absent.length;
  const byTrainingAtt = {};
  for (const x of attRows) {
    const k = x.s.bid;
    byTrainingAtt[k] ??= { name: bName(k), enrolled: 0, present: 0 };
    byTrainingAtt[k].enrolled++;
    if (x.e.att) byTrainingAtt[k].present++;
  }
  const fbs = rows.filter((x) => x.e.fb?.r), fbScores = fbs.map((x) => avg(FB_GROUPS.map((g) => x.e.fb.r[g]).filter(Number.isFinite)));
  const byQ = Object.fromEntries(FB_GROUPS.map((g) => [g, r1(avg(fbs.map((x) => x.e.fb.r[g]).filter(Number.isFinite)))]));
  const dist = Array(10).fill(0);
  for (const x of fbs) for (const g of FB_GROUPS) {
    const v = x.e.fb.r[g];
    if (v >= 1 && v <= 10) dist[v - 1]++;
  }
  const fbByTrainer = {};
  for (const [i, x] of fbs.entries()) {
    const k = x.s.tid;
    fbByTrainer[k] ??= { name: trName(k), n: 0, sum: 0 };
    fbByTrainer[k].n++;
    fbByTrainer[k].sum += fbScores[i];
  }
  const fbByTraining = {};
  for (const [i, x] of fbs.entries()) {
    const k = x.s.bid;
    fbByTraining[k] ??= { name: bName(k), n: 0, sum: 0 };
    fbByTraining[k].n++;
    fbByTraining[k].sum += fbScores[i];
  }
  const comments = fbs.flatMap((x) => FB_GROUPS.map((g) => ({ g, text: String(x.e.fb.cm?.[g] || "").trim(), score: x.e.fb.r[g], training: bName(x.s.bid), date: x.s.date })).filter((k) => k.text)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const evs = present.filter((x) => x.e.ev), beh = {}, pun = {};
  for (const x of evs) {
    inc(beh, x.e.ev.behavior);
    inc(pun, x.e.ev.punctuality);
  }
  const evDue = present.filter((x) => x.s.date < today || x.e.final || x.e.ev);
  const tests = rows.filter((x) => x.e.test?.at), graded = tests.filter((x) => x.e.test.status === "graded"), review = tests.filter((x) => x.e.test.status === "review");
  const byTest = {};
  for (const x of graded) {
    const k = x.e.test.examId || x.e.test.title;
    byTest[k] ??= { title: x.e.test.title, n: 0, sum: 0, pass: 0 };
    byTest[k].n++;
    byTest[k].sum += x.e.test.pct || 0;
    if (x.e.test.passed) byTest[k].pass++;
  }
  const qStat = /* @__PURE__ */ new Map();
  for (const x of graded) for (const q2 of x.e.test.qs || []) {
    if (q2.kind !== "mc") continue;
    const k = q2.text.trim().toLowerCase().slice(0, 300);
    const cur = qStat.get(k) || { text: q2.text, test: x.e.test.title, n: 0, right: 0, wrong: {} };
    const a = x.e.test.answers?.[q2.id];
    cur.n++;
    if (a !== void 0 && String(a) === String(q2.correct)) cur.right++;
    else inc(cur.wrong, a === void 0 || a === null ? "\u2014" : optText(q2, a) || "\u2014");
    qStat.set(k, cur);
  }
  const hardest = [...qStat.values()].filter((q2) => q2.n >= 3).map((q2) => ({ text: q2.text, test: q2.test, n: q2.n, correct: pct(q2.right, q2.n), commonWrong: Object.entries(q2.wrong).sort((a, b) => b[1] - a[1])[0]?.[0] || "" })).sort((a, b) => (a.correct ?? 0) - (b.correct ?? 0)).slice(0, 8);
  const reviewDays = graded.filter((x) => x.e.test.gradedBy !== "auto" && x.e.test.gradedAt && x.e.test.at).map((x) => (Date.parse(x.e.test.gradedAt) - Date.parse(x.e.test.at)) / 864e5);
  const oldReview = review.filter((x) => (c.now() - Date.parse(x.e.test.at)) / 864e5 > RULES.reviewDays).length;
  const exams = rows.filter((x) => x.e.exam && typeof x.e.exam.passed === "boolean"), examScores = exams.map((x) => Number(x.e.exam.score)).filter((v) => Number.isFinite(v) && v <= 100);
  const pracs = rows.filter((x) => x.e.prac && ["PASS", "FAIL"].includes(x.e.prac.result));
  const pracByTraining = {};
  for (const x of pracs) {
    const k = x.s.bid;
    pracByTraining[k] ??= { name: bName(k), n: 0, pass: 0 };
    pracByTraining[k].n++;
    if (x.e.prac.result === "PASS") pracByTraining[k].pass++;
  }
  const outcomes = {};
  for (const x of rows) {
    const o = x.e.final?.outcome || (x.s.date > today ? "UPCOMING" : computeOutcome(x.e, x.s, { fbRequired: false }).outcome);
    inc(outcomes, o);
  }
  const passN = outcomes.PASS || 0, failN = outcomes.FAIL || 0;
  const pracSessions = rows.filter((x) => x.s.sheetId && past(x) && x.e.att), dohs = pracSessions.filter((x) => x.e.doh), dohFlag = dohs.filter((x) => dohYes(x.e.doh));
  const { issuedN, activeN, exp30N, exp90, expiredN, pendingCert } = certStats;
  const expByTraining = {};
  for (const x of exp90) inc(expByTraining, bName(x.bid));
  const cohorts = inScope.map((s) => {
    const mine = rows.filter((x) => x.s.id === s.id), att = mine.filter((x) => past(x) && x.e.att).length, pastN = mine.filter(past).length;
    const sc = mine.filter((x) => x.e.test?.status === "graded").map((x) => x.e.test.pct), fbv = mine.filter((x) => x.e.fb?.r).map((x) => avg(FB_GROUPS.map((g) => x.e.fb.r[g])));
    const out4 = mine.map((x) => x.e.final?.outcome || computeOutcome(x.e, x.s, { fbRequired: false }).outcome), dec = out4.filter((o) => o === "PASS" || o === "FAIL");
    return {
      id: s.id,
      date: s.date,
      training: bName(s.bid),
      trainer: trName(s.tid),
      size: mine.length,
      attendance: pct(att, pastN),
      testAvg: r1(avg(sc)),
      testSd: r1(sd(sc)),
      passRate: pct(dec.filter((o) => o === "PASS").length, dec.length),
      feedback: r1(avg(fbv)),
      upcoming: s.date > today
    };
  }).filter((g) => g.size).sort((a, b) => b.date.localeCompare(a.date));
  const months = {};
  for (const x of rows) {
    const m = x.s.date.slice(0, 7);
    months[m] ??= { month: m, enrolled: 0, present: 0, past: 0, pass: 0, decided: 0, fb: [] };
    const k = months[m];
    k.enrolled++;
    if (past(x)) {
      k.past++;
      if (x.e.att) k.present++;
    }
    const o = x.e.final?.outcome || computeOutcome(x.e, x.s, { fbRequired: false }).outcome;
    if (o === "PASS" || o === "FAIL") {
      k.decided++;
      if (o === "PASS") k.pass++;
    }
    if (x.e.fb?.r) k.fb.push(avg(FB_GROUPS.map((g) => x.e.fb.r[g])));
  }
  const trend = Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map((k) => ({ month: k.month, enrolled: k.enrolled, attendance: pct(k.present, k.past), passRate: pct(k.pass, k.decided), feedback: r1(avg(k.fb)) }));
  const people2 = kind === "audit" ? [] : rows.filter((x) => past(x)).map((x) => ({ x, o: x.e.final?.outcome || computeOutcome(x.e, x.s, { fbRequired: false }).outcome })).filter(({ x, o }) => o === "FAIL" || o === "ABSENT" && x.e.absent).map(({ x, o }) => ({ name: x.p.foreign ? x.p.en : fullAz(x.p, false), att: x.p.att, training: bName(x.s.bid), date: x.s.date, outcome: o, reason: o === "FAIL" ? x.e.prac?.result === "FAIL" ? "practical" : "exam" : "absent", score: x.e.exam?.score ?? null })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const kpi = {
    sessions: inScope.length,
    enrolments: rows.length,
    people: new Set(rows.map((x) => x.p.id)).size,
    attendance: pct(present.length, decided || attRows.length),
    absent: absent.length,
    notMarked: attRows.length - decided,
    feedbackAvg: r1(avg(fbScores)),
    feedbackN: fbs.length,
    feedbackRate: pct(fbs.length, present.length),
    evalRate: pct(evs.filter((x) => evDue.includes(x)).length, evDue.length),
    engagement: r1(avg(evs.map((x) => x.e.ev.engagement))),
    testN: graded.length,
    testAvg: r1(avg(graded.map((x) => x.e.test.pct))),
    testPass: pct(graded.filter((x) => x.e.test.passed).length, graded.length),
    testReview: review.length,
    reviewDays: r1(avg(reviewDays)),
    examPass: pct(exams.filter((x) => x.e.exam.passed).length, exams.length),
    examAvg: r1(avg(examScores)),
    pracN: pracs.length,
    pracPass: pct(pracs.filter((x) => x.e.prac.result === "PASS").length, pracs.length),
    passRate: pct(passN, passN + failN),
    pass: passN,
    fail: failN,
    dohRate: pct(dohs.length, pracSessions.length),
    dohFlags: dohFlag.length,
    certsIssued: issuedN,
    certsActive: activeN,
    exp30: exp30N,
    exp90: exp90.length,
    expired: expiredN,
    certPending: pendingCert
  };
  const A = [], add = /* @__PURE__ */ __name((level, key, args = [], extra = {}) => A.push({ level, key, args, ...extra }), "add");
  if (kpi.attendance !== null && decided >= 5 && kpi.attendance < RULES.attendance) add("warn", "atAttendance", [kpi.attendance, RULES.attendance]);
  for (const g of cohorts) if (!g.upcoming && g.size >= 3 && g.attendance !== null && g.attendance < 75) add("warn", "atCohortAttendance", [g.training, fmtDate(g.date), g.attendance]);
  if (kpi.passRate !== null && passN + failN >= 5 && kpi.passRate < RULES.passRate) add("bad", "atPassRate", [kpi.passRate, RULES.passRate]);
  for (const t of Object.values(byTest)) if (t.n >= 5 && t.pass / t.n * 100 < RULES.passRate) add("warn", "atTestPass", [t.title, pct(t.pass, t.n)]);
  for (const q2 of hardest.filter((q3) => (q3.correct ?? 0) < RULES.question).slice(0, 3)) add("warn", "atQuestion", [q2.text.slice(0, 90), q2.correct]);
  if (kpi.feedbackAvg !== null && fbs.length >= 5 && kpi.feedbackAvg < RULES.feedback) add("warn", "atFeedback", [kpi.feedbackAvg, RULES.feedback]);
  for (const t of Object.values(fbByTrainer)) if (t.n >= 5 && t.sum / t.n < RULES.feedback) add("warn", "atTrainerFb", [t.name, r1(t.sum / t.n)]);
  for (const g of FB_GROUPS) if (byQ[g] !== null && fbs.length >= 5 && byQ[g] < RULES.feedback) add("warn", "atFbQuestion", [g, byQ[g]]);
  if (kpi.feedbackRate !== null && present.length >= 5 && kpi.feedbackRate < RULES.fbDone) add("info", "atFbMissing", [kpi.feedbackRate]);
  if (kpi.evalRate !== null && evDue.length >= 5 && kpi.evalRate < RULES.evalDone) add("warn", "atEvalMissing", [kpi.evalRate, evDue.length - evs.filter((x) => evDue.includes(x)).length]);
  if (kpi.pracPass !== null && pracs.length >= 5 && kpi.pracPass < RULES.practical) add("warn", "atPractical", [kpi.pracPass]);
  if (oldReview) add("bad", "atReviewOld", [oldReview, RULES.reviewDays]);
  else if (review.length) add("info", "atReview", [review.length]);
  if (dohFlag.length) add("info", "atDohFlags", [dohFlag.length]);
  if (pracSessions.length && dohs.length < pracSessions.length) add("warn", "atDohMissing", [pracSessions.length - dohs.length]);
  if (attRows.length - decided > 0) add("info", "atNotMarked", [attRows.length - decided]);
  if (kind !== "audit") {
    if (exp30N) add("bad", "atExpiring", [exp30N, RULES.expiring]);
    if (pendingCert) add("info", "atCertPending", [pendingCert]);
  }
  const order = { bad: 0, warn: 1, info: 2 };
  A.sort((a, b) => order[a.level] - order[b.level]);
  const sortN = /* @__PURE__ */ __name((o, f) => Object.values(o).map(f).sort((a, b) => (b.n ?? b.enrolled) - (a.n ?? a.enrolled)), "sortN");
  const out3 = {
    kind,
    from,
    to,
    today,
    rules: RULES,
    trainings: trainingOpts,
    kpi,
    attention: A,
    attendance: sortN(byTrainingAtt, (x) => ({ ...x, rate: pct(x.present, x.enrolled) })).slice(0, 12),
    feedback: { byQ, dist, byTrainer: sortN(fbByTrainer, (x) => ({ name: x.name, n: x.n, avg: r1(x.sum / x.n) })), byTraining: sortN(fbByTraining, (x) => ({ name: x.name, n: x.n, avg: r1(x.sum / x.n) })).slice(0, 12), comments },
    evaluation: { n: evs.length, behavior: beh, punctuality: pun, engagement: kpi.engagement },
    tests: { byTest: sortN(byTest, (x) => ({ title: x.title, n: x.n, avg: r1(x.sum / x.n), passRate: pct(x.pass, x.n) })).slice(0, 12), hardest },
    practical: sortN(pracByTraining, (x) => ({ ...x, rate: pct(x.pass, x.n) })).slice(0, 12),
    outcomes,
    cohorts: cohorts.slice(0, 60),
    trend,
    certs: kind === "audit" ? null : { expiringByTraining: Object.entries(expByTraining).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 10) },
    people: people2
  };
  if (kind === "audit") {
    for (const k of ["certsIssued", "certsActive", "exp30", "exp90", "expired", "certPending"]) delete out3.kpi[k];
  }
  return out3;
}
__name(buildAnalytics, "buildAnalytics");
var ROLE_TXT = { all: "the management of the training centre", audit: "an external auditor reviewing feedback and evaluation quality", trainer: "a trainer looking at their own groups", company: "a client company looking at its own employees" };
async function aiSummary(c, data, lg, { force = false, who }) {
  c.settings = await getSettings(c.D);
  const cfg = aiCfg(c.settings);
  need(cfg.on && cfg.reports !== false, "aiOff", 404);
  need(await aiReady(c), "aiNotConfigured", 503);
  const { people: people2, comments, ...figures } = { ...data, comments: data.feedback.comments };
  figures.feedback = { ...data.feedback, comments: void 0 };
  const payload = { ...figures, comments: comments.slice(0, 25).map((k) => ({ topic: k.g, score: k.score, text: k.text.slice(0, 300) })), peopleNeedingFollowUp: people2.length };
  const key = "r" + (await sha(JSON.stringify([payload, lg]))).slice(0, 40);
  if (!force) {
    const hit = await c.D.get("aireport", key);
    if (hit) return { text: hit.text, at: hit.at, cached: true };
  }
  const n = await c.D.seq(`aiR|${who}|${c.today()}`);
  need(n <= Math.max(20, cfg.daily), "aiLimit", 429);
  const system = `You are a data analyst for a vocational training centre (lifting operations, health and safety, industrial machinery).
Write a short report for ${ROLE_TXT[data.kind]} in ${LANG_NAME[lg]}, based ONLY on the JSON figures provided.
Format (plain text, no tables, no headings other than these three, use "- " for list items):
1. An overview paragraph of 3-5 sentences with the most important numbers.
2. A line with the heading for "Needs attention" in ${LANG_NAME[lg]}, then 2-6 list items, most serious first.
3. A line with the heading for "Recommendations" in ${LANG_NAME[lg]}, then 2-4 practical list items.
Rules: quote numbers exactly as given (percentages are 0-100, feedback scores are out of 10, engagement out of 5). Never invent figures, names or causes that the data does not show; if something is unknown say so. If there is too little data (few enrolments), say that conclusions are limited. Mention recurring themes from the anonymous comments if any. Feedback topics: g1 = instructor effectiveness, g2 = content and curriculum, g3 = learning materials and resources, g4 = logistics and environment, g6 = overall satisfaction. Do not mention JSON or field names.`;
  const text = await llm(c, { system, messages: [{ role: "user", content: JSON.stringify(payload).slice(0, 24e3) }], max: 900 });
  if (!text) throw new H(502, "aiFailed");
  const at = new Date(c.now()).toISOString();
  await c.D.put("aireport", [{ id: key, data: { text, at, lang: lg, kind: data.kind } }]);
  await audit(c, "ai.report", `${data.kind} ${data.from}..${data.to} ${lg}`);
  return { text, at };
}
__name(aiSummary, "aiSummary");
var reportsOn = /* @__PURE__ */ __name(async (c) => {
  c.settings = await getSettings(c.D);
  const cfg = aiCfg(c.settings);
  return cfg.on && cfg.reports !== false && await aiReady(c);
}, "reportsOn");
var qScope = /* @__PURE__ */ __name((c, extra = {}) => {
  const q2 = /* @__PURE__ */ __name((k) => str(c.url?.searchParams?.get(k) || "", 60), "q");
  return { from: q2("from"), to: q2("to"), bid: q2("bid"), tid: q2("tid"), co: q2("co"), ...extra };
}, "qScope");
var bScope = /* @__PURE__ */ __name((b, extra = {}) => ({ from: str(b.from, 10), to: str(b.to, 10), bid: str(b.bid, 60), tid: str(b.tid, 60), co: str(b.co, 60), ...extra }), "bScope");

// _lib/performance.js
var r12 = /* @__PURE__ */ __name((v) => v === null || v === void 0 || Number.isNaN(v) ? null : Math.round(v * 10) / 10, "r1");
var pct2 = /* @__PURE__ */ __name((a, b) => b ? r12(a / b * 100) : null, "pct");
var avg2 = /* @__PURE__ */ __name((xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null, "avg");
var fbAvg = /* @__PURE__ */ __name((fb) => avg2(FB_GROUPS.map((g) => fb.r[g]).filter(Number.isFinite)), "fbAvg");
var outcomeOf = /* @__PURE__ */ __name((e, s) => e.final?.outcome || computeOutcome(e, s, { fbRequired: false }).outcome, "outcomeOf");
var BEH = { excellent: 4, good: 3, satisfactory: 2, poor: 1 };
async function load(c, from, to, { people: people2 = true, extra = (
  /** @type {any[]} */
  []
) } = {}) {
  const D = c.D, ss = (await D.query("sessions", { where: [["date", "gte", from], ["date", "lte", to]] })).rows.map((r) => r.data).filter((s) => !s.cancelled);
  const pids = [.../* @__PURE__ */ new Set([...ss.flatMap((s) => s.traineeIds || []), ...extra])];
  const [enr, trainers, blanks, companies, trainees, certs] = await Promise.all([
    enrsFor(D, ss.map((s) => s.id), [...ENR_LITE, "test"]),
    D.all("trainers"),
    D.all("blanks"),
    D.all("companies"),
    getMany(D, "trainees", pids),
    people2 ? queryIn(D, "certs", "tid", pids, { fields: ["no", "tid", "bid", "start", "issuedAt", "expiry", "revoked", "renewed"] }) : []
  ]);
  const by = /* @__PURE__ */ new Map();
  for (const list2 of enr.values()) for (const e of list2) by.set(e.sid + "|" + e.tid, e);
  const certsBy = /* @__PURE__ */ new Map();
  for (const k of certs) {
    if (!certsBy.has(k.tid)) certsBy.set(k.tid, []);
    certsBy.get(k.tid).push(k);
  }
  return { ss, by, trainers: new Map(trainers.map((r) => [r.id, r.data])), trainees, blanks: new Map(blanks.map((r) => [r.id, r.data])), companies: new Map(companies.map((r) => [r.id, r.data])), certsBy };
}
__name(load, "load");
function trainerFigures(X, tid, today) {
  const ss = X.ss.filter((s) => s.tid === tid), rows = ss.flatMap((s) => (s.traineeIds || []).map((id) => ({ s, e: X.by.get(s.id + "|" + id) || { sid: s.id, tid: id } })));
  const past = rows.filter((x) => x.s.date <= today), present = past.filter((x) => x.e.att), absent = past.filter((x) => !x.e.att && x.e.absent);
  const fbs = rows.filter((x) => x.e.fb?.r), tests = rows.filter((x) => x.e.test?.status === "graded"), pracs = rows.filter((x) => ["PASS", "FAIL"].includes(x.e.prac?.result));
  const out3 = rows.map((x) => outcomeOf(x.e, x.s)), pass = out3.filter((o) => o === "PASS").length, fail = out3.filter((o) => o === "FAIL").length;
  const evDue = present.filter((x) => x.s.date < today || x.e.final || x.e.ev), evDone = evDue.filter((x) => x.e.ev);
  return {
    sessions: ss.length,
    trainees: rows.length,
    trainings: [...new Set(ss.map((s) => X.blanks.get(s.bid)?.name || "\u2014"))].slice(0, 12),
    attendance: pct2(present.length, present.length + absent.length || past.length),
    feedback: r12(avg2(fbs.map((x) => fbAvg(x.e.fb)))),
    feedbackN: fbs.length,
    feedbackRate: pct2(fbs.length, present.length),
    byTopic: Object.fromEntries(FB_GROUPS.map((g) => [g, r12(avg2(fbs.map((x) => x.e.fb.r[g]).filter(Number.isFinite)))])),
    testPass: pct2(tests.filter((x) => x.e.test.passed).length, tests.length),
    testAvg: r12(avg2(tests.map((x) => x.e.test.pct))),
    testN: tests.length,
    pracPass: pct2(pracs.filter((x) => x.e.prac.result === "PASS").length, pracs.length),
    pracN: pracs.length,
    passRate: pct2(pass, pass + fail),
    pass,
    fail,
    evalRate: pct2(evDone.length, evDue.length),
    reviewOpen: rows.filter((x) => x.e.test?.status === "review").length,
    comments: fbs.flatMap((x) => FB_GROUPS.map((g) => ({ topic: g, score: x.e.fb.r[g], text: String(x.e.fb.cm?.[g] || "").trim().slice(0, 300) })).filter((k) => k.text)).slice(-30),
    perSession: ss.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((s) => {
      const mine = rows.filter((x) => x.s.id === s.id), f = mine.filter((x) => x.e.fb?.r), tt = mine.filter((x) => x.e.test?.status === "graded"), oc = mine.map((x) => outcomeOf(x.e, x.s));
      return { date: s.date, training: X.blanks.get(s.bid)?.name || "\u2014", size: mine.length, attendance: pct2(mine.filter((x) => x.e.att).length, mine.filter((x) => x.s.date <= today).length), feedback: r12(avg2(f.map((x) => fbAvg(x.e.fb)))), testAvg: r12(avg2(tt.map((x) => x.e.test.pct))), passRate: pct2(oc.filter((o) => o === "PASS").length, oc.filter((o) => o === "PASS" || o === "FAIL").length) };
    })
  };
}
__name(trainerFigures, "trainerFigures");
function traineeFigures(X, pid2, today) {
  const ss = X.ss.filter((s) => (s.traineeIds || []).includes(pid2)), rows = ss.map((s) => ({ s, e: X.by.get(s.id + "|" + pid2) || { sid: s.id, tid: pid2 } }));
  const past = rows.filter((x) => x.s.date <= today), days = past.flatMap((x) => Object.values(x.e.days || {})), evs = rows.filter((x) => x.e.ev);
  const tests = rows.filter((x) => x.e.test?.status === "graded"), out3 = rows.map((x) => outcomeOf(x.e, x.s));
  const certs = (X.certsBy.get(pid2) || []).filter((k) => !k.revoked && !k.renewed).map((k) => ({ ...k, st: certSt(k, today, SOON_DAYS) }));
  return {
    sessions: ss.length,
    attended: past.filter((x) => x.e.att).length,
    absent: past.filter((x) => !x.e.att && x.e.absent).length,
    missedDays: days.filter((d) => d.absent).length,
    testAvg: r12(avg2(tests.map((x) => x.e.test.pct))),
    testN: tests.length,
    examWarnings: rows.reduce((n, x) => n + (x.e.test?.warns?.length || 0), 0),
    pass: out3.filter((o) => o === "PASS").length,
    fail: out3.filter((o) => o === "FAIL").length,
    pending: out3.filter((o) => o.startsWith("PENDING")).length,
    pracPass: rows.filter((x) => x.e.prac?.result === "PASS").length,
    pracFail: rows.filter((x) => x.e.prac?.result === "FAIL").length,
    behavior: r12(avg2(evs.map((x) => BEH[x.e.ev.behavior]).filter(Boolean))),
    engagement: r12(avg2(evs.map((x) => x.e.ev.engagement))),
    late: evs.filter((x) => x.e.ev.punctuality !== "ontime").length,
    evalN: evs.length,
    feedbackGiven: rows.filter((x) => x.e.fb).length,
    feedbackAvg: r12(avg2(rows.filter((x) => x.e.fb?.r).map((x) => fbAvg(x.e.fb)))),
    certsValid: certs.filter((k) => k.st === "ACTIVE" || k.st === "SOON").length,
    certsExpired: certs.filter((k) => k.st === "EXPIRED").length,
    comments: evs.map((x) => String(x.e.ev.comment || "").trim().slice(0, 300)).filter(Boolean).slice(-10),
    perSession: rows.sort((a, b) => b.s.date.localeCompare(a.s.date)).slice(0, 20).map((x) => ({
      date: x.s.date,
      training: X.blanks.get(x.s.bid)?.name || "\u2014",
      attended: !!x.e.att,
      absent: !!x.e.absent && !x.e.att,
      test: x.e.test?.status === "graded" ? x.e.test.pct : null,
      practical: x.e.prac?.result || null,
      outcome: outcomeOf(x.e, x.s),
      behavior: x.e.ev?.behavior || null,
      engagement: x.e.ev?.engagement || null
    }))
  };
}
__name(traineeFigures, "traineeFigures");
function flagsOf(kind, f) {
  const out3 = [];
  if (kind === "trainer") {
    if (f.feedbackN >= 5 && f.feedback < 7) out3.push("pfLowFeedback");
    if (f.byTopic?.g1 !== null && f.feedbackN >= 5 && f.byTopic.g1 < 7) out3.push("pfLowInstructor");
    if (f.pass + f.fail >= 5 && f.passRate < 70) out3.push("pfLowPass");
    if (f.evalRate !== null && f.evalRate < 80 && f.trainees >= 5) out3.push("pfEvalMissing");
    if (f.reviewOpen) out3.push("pfReviewOpen");
    if (f.attendance !== null && f.attendance < 85 && f.trainees >= 5) out3.push("pfLowAttendance");
  } else {
    if (f.fail) out3.push("pfFailed");
    if (f.absent || f.missedDays) out3.push("pfAbsent");
    if (f.examWarnings) out3.push("pfWarnings");
    if (f.behavior !== null && f.behavior < 2.5) out3.push("pfBehavior");
    if (f.late >= 2) out3.push("pfLate");
    if (f.certsExpired) out3.push("pfExpired");
  }
  return out3;
}
__name(flagsOf, "flagsOf");
async function buildPeople(c, { kind, from: f0, to: t0, q: q2 }) {
  const today = c.today(), from = isDate(f0) && f0 ? f0 : defaultRange(today)[0], to = isDate(t0) && t0 ? t0 : today;
  need(from <= to, "badInput");
  const X = await load(c, from, to, { people: kind !== "trainer" });
  let rows;
  if (kind === "trainer") {
    const ids = [...new Set(X.ss.map((s) => s.tid))].filter((id) => X.trainers.has(id));
    rows = ids.map((id) => {
      const p = X.trainers.get(id), f = trainerFigures(X, id, today);
      delete f.comments;
      delete f.perSession;
      return { id, name: fullAz(p, false), ...f, flags: flagsOf("trainer", f) };
    });
  } else {
    const ids = [...new Set(X.ss.flatMap((s) => s.traineeIds || []))].filter((id) => X.trainees.has(id));
    rows = ids.map((id) => {
      const p = X.trainees.get(id), f = traineeFigures(X, id, today);
      delete f.comments;
      delete f.perSession;
      return { id, name: p.foreign ? fullEn(p) : fullAz(p), att: p.att, company: p.co ? X.companies.get(p.co)?.name || "" : "", ...f, flags: flagsOf("trainee", f) };
    });
  }
  rows.sort((a, b) => b.flags.length - a.flags.length || b.sessions - a.sessions || a.name.localeCompare(b.name));
  return { kind, from, to, rows: rows.slice(0, 1e3), total: rows.length };
}
__name(buildPeople, "buildPeople");
async function personDetail(c, { kind, id, from, to }) {
  const today = c.today();
  from = isDate(from) ? from : defaultRange(today)[0];
  to = isDate(to) ? to : today;
  const X = await load(c, from, to, { people: kind !== "trainer", extra: kind === "trainer" ? [] : [id] });
  if (kind === "trainer") {
    const p2 = X.trainers.get(id);
    need(p2, "noRec", 404);
    const f2 = trainerFigures(X, id, today);
    return { kind, id, name: fullAz(p2, false), from, to, ...f2, flags: flagsOf("trainer", f2) };
  }
  const p = X.trainees.get(id);
  need(p, "noRec", 404);
  const f = traineeFigures(X, id, today);
  return { kind, id, name: p.foreign ? fullEn(p) : fullAz(p), att: p.att, company: p.co ? X.companies.get(p.co)?.name || "" : "", from, to, ...f, flags: flagsOf("trainee", f) };
}
__name(personDetail, "personDetail");
var TOPICS = "Feedback topics: g1 = instructor effectiveness, g2 = content and curriculum, g3 = learning materials and resources, g4 = logistics and environment, g6 = overall satisfaction (scores out of 10).";
async function ai(c, payload, system, lg, force, who) {
  c.settings = await getSettings(c.D);
  const cfg = aiCfg(c.settings);
  need(cfg.on && cfg.reports !== false, "aiOff", 404);
  need(await aiReady(c), "aiNotConfigured", 503);
  const key = "p" + (await sha(JSON.stringify([payload, system.length, lg]))).slice(0, 40);
  if (!force) {
    const hit = await c.D.get("aireport", key);
    if (hit) return { text: hit.text, at: hit.at, cached: true };
  }
  const n = await c.D.seq(`aiR|${who}|${c.today()}`);
  need(n <= Math.max(40, cfg.daily * 2), "aiLimit", 429);
  const text = await llm(c, { system, messages: [{ role: "user", content: JSON.stringify(payload).slice(0, 24e3) }], max: 900 });
  if (!text) throw new H(502, "aiFailed");
  const at = new Date(c.now()).toISOString();
  await c.D.put("aireport", [{ id: key, data: { text, at, lang: lg } }]);
  return { text, at };
}
__name(ai, "ai");
var FORMAT = /* @__PURE__ */ __name((lg) => `Write in ${LANG_NAME[lg]}. Plain text. Use exactly three short sections with headings in ${LANG_NAME[lg]} for "Strengths", "Concerns" and "Recommendations", each with 1-4 items starting with "- ". Quote numbers exactly (percentages are 0-100). Never invent figures or causes the data does not show; with little data say that conclusions are limited. Do not mention JSON or field names.`, "FORMAT");
async function personSummary(c, d, lg, force) {
  const { name, att, id, company, ...fig } = d;
  const role = d.kind === "trainer" ? "a trainer (instructor) of the training centre, based on the trainees' anonymous feedback about their sessions, attendance, test, practical and pass results of their groups, and how completely they recorded evaluations" : "one trainee (candidate), based on attendance, test and practical results, outcomes, the trainers' evaluations of their behaviour, punctuality and engagement, and exam-integrity warnings";
  const system = `You are an analyst for a vocational training centre (lifting operations, health and safety, industrial machinery).
Analyse the performance of ${role}. The person is called "${d.kind === "trainer" ? "the trainer" : "the trainee"}" \u2014 never guess a name. ${TOPICS}
${FORMAT(lg)}`;
  const r = await ai(c, { kind: d.kind, ...fig }, system, lg, force, "s" + c.user.id);
  await audit(c, "ai.performance", `${d.kind} ${d.id} ${lg}`);
  return r;
}
__name(personSummary, "personSummary");
async function peopleSummary(c, data, lg, force) {
  const pre = data.kind === "trainer" ? "T" : "P", list2 = data.rows.slice(0, 60);
  const codes = list2.map((r2, i) => ({ code: pre + (i + 1), id: r2.id, name: r2.name }));
  const rows = list2.map((r2, i) => {
    const { id, name, att, company, trainings, ...f } = r2;
    return { code: pre + (i + 1), ...f };
  });
  const system = `You are an analyst for a vocational training centre. Compare the ${data.kind === "trainer" ? "trainers" : "trainees"} below (each is a code like ${pre}1; never guess names) over the period ${data.from} to ${data.to}. ${TOPICS}
Write in ${LANG_NAME[lg]}: an overview paragraph (3-5 sentences), then a heading for "Needs attention" with 2-6 items naming the codes and the figures, then a heading for "Recommendations" with 2-4 items. Items start with "- ". Quote numbers exactly. Never invent figures. Do not mention JSON or field names.`;
  const r = await ai(c, { kind: data.kind, from: data.from, to: data.to, rows }, system, lg, force, "s" + c.user.id);
  await audit(c, "ai.performance", `${data.kind} overview ${lg}`);
  return { ...r, codes };
}
__name(peopleSummary, "peopleSummary");
var kindOf = /* @__PURE__ */ __name((v) => v === "trainer" ? "trainer" : "trainee", "kindOf");
var qp = /* @__PURE__ */ __name((c, k) => str(c.url.searchParams.get(k) || "", 60), "qp");

// _lib/routes_analytics.js
var lang2 = /* @__PURE__ */ __name((v) => ["az", "en", "ru"].includes(v) ? v : "az", "lang");
var staffKind = /* @__PURE__ */ __name((c) => c.user.role === "auditor" ? "audit" : "all", "staffKind");
async function view(c, scope) {
  const d = await buildAnalytics(c, scope);
  return { ...d, ai: await reportsOn(c) };
}
__name(view, "view");
var analyticsRoutes = {
  /* superadmin / admin: the whole system (filters: training, trainer, company); auditor: feedback and evaluation oversight */
  "GET /analytics": { auth: "staff", act: "analytics", async fn(c) {
    return view(c, qScope(c, { kind: staffKind(c) }));
  } },
  "POST /analytics/summary": { auth: "staff", act: "analytics", async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: staffKind(c) }));
    return aiSummary(c, d, lang2(b.lang), { force: bool(b.force), who: "s" + c.user.id });
  } },
  /* trainer: only the sessions (groups) assigned to them */
  "GET /portal/trainer/analytics": { auth: "trainer", async fn(c) {
    return view(c, qScope(c, { kind: "trainer", tid: c.me.id, co: "" }));
  } },
  "POST /portal/trainer/analytics/summary": { auth: "trainer", async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: "trainer", tid: c.me.id, co: "" }));
    return aiSummary(c, d, lang2(b.lang), { force: bool(b.force), who: "t" + c.me.id });
  } },
  /* company: only its own employees */
  "GET /portal/company/analytics": { auth: "company", async fn(c) {
    return view(c, qScope(c, { kind: "company", co: c.me.id, tid: "" }));
  } },
  "POST /portal/company/analytics/summary": { auth: "company", async fn(c) {
    const b = await c.body(), d = await buildAnalytics(c, bScope(b, { kind: "company", co: c.me.id, tid: "" }));
    return aiSummary(c, d, lang2(b.lang), { force: bool(b.force), who: "c" + c.me.id });
  } },
  /* performance and feedback analysis of trainers and trainees: superadmin / admin */
  "GET /performance": { auth: "staff", act: "perf", async fn(c) {
    return { ...await buildPeople(c, { kind: kindOf(qp(c, "kind")), from: qp(c, "from"), to: qp(c, "to") }), ai: await reportsOn(c) };
  } },
  "GET /performance/person": { auth: "staff", act: "perf", async fn(c) {
    return { ...await personDetail(c, { kind: kindOf(qp(c, "kind")), id: qp(c, "id"), from: qp(c, "from"), to: qp(c, "to") }), ai: await reportsOn(c) };
  } },
  "POST /performance/person/summary": { auth: "staff", act: "perf", async fn(c) {
    const b = await c.body();
    return personSummary(c, await personDetail(c, { kind: kindOf(b.kind), id: str(b.id, 60), from: str(b.from, 10), to: str(b.to, 10) }), lang2(b.lang), bool(b.force));
  } },
  "POST /performance/summary": { auth: "staff", act: "perf", async fn(c) {
    const b = await c.body();
    return peopleSummary(c, await buildPeople(c, { kind: kindOf(b.kind), from: str(b.from, 10), to: str(b.to, 10) }), lang2(b.lang), bool(b.force));
  } }
};

// _lib/routes_library.js
var TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip"
};
var LIBDOC_EXT = Object.keys(TYPES);
var extOf = /* @__PURE__ */ __name((name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "", "extOf");
var out2 = /* @__PURE__ */ __name((x) => ({ id: x.id, title: x.title, fileName: x.fileName, ext: x.ext, size: x.size, at: x.at, category: x.category || "" }), "out");
var list = /* @__PURE__ */ __name(async (c) => (await c.D.all("libdocs")).map((r) => r.data).sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.title.localeCompare(b.title)), "list");
async function fileResp(c, id) {
  const x = await c.D.get("libdocs", str(id, 60));
  need(x, "noRec", 404);
  const o = await c.B.get("libdocs/" + x.key);
  need(o, "noRec", 404);
  return new Response(o.body, { headers: { "content-type": TYPES[x.ext] || "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(x.fileName)}`, "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
__name(fileResp, "fileResp");
async function ownGroup(c, id) {
  const g = await c.D.get("cogroups", str(id, 60));
  need(g && g.co === c.me.id, "noRec", 404);
  return g;
}
__name(ownGroup, "ownGroup");
var libraryRoutes = {
  "GET /libdocs": { auth: "staff", act: "libdocs", async fn(c) {
    return { list: (await list(c)).map(out2) };
  } },
  "POST /libdoc/upload": { auth: "staff", act: "libdocs", raw: true, async fn(c) {
    const q2 = c.url.searchParams, name = str(q2.get("name"), 200), ext = extOf(name), title2 = str(q2.get("title"), 140) || name.replace(/\.[^.]+$/, "");
    const buf = await c.req.arrayBuffer();
    need(name && TYPES[ext] && buf.byteLength > 0 && buf.byteLength <= 3e7, "badFile");
    const id = uid("d"), key = id + "-" + rnd(6) + "." + ext;
    await c.B.put("libdocs/" + key, buf, { httpMetadata: { contentType: "application/octet-stream" } });
    const x = { id, title: title2, key, fileName: name, ext, size: buf.byteLength, category: str(q2.get("category"), 60), at: new Date(c.now()).toISOString(), by: c.user.email };
    await c.D.put("libdocs", [{ id, data: x }]);
    await audit(c, "libdoc.upload", title2);
    return J({ doc: out2(x) });
  } },
  "POST /libdoc/update": { auth: "staff", act: "libdocs", async fn(c) {
    const b = await c.body(), x = await c.D.get("libdocs", str(b.id, 60));
    need(x, "noRec", 404);
    x.title = str(b.title, 140) || x.title;
    x.category = str(b.category, 60);
    await c.D.put("libdocs", [{ id: x.id, data: x }]);
    return { doc: out2(x) };
  } },
  "POST /libdoc/delete": { auth: "staff", act: "libdocs", async fn(c) {
    const b = await c.body(), x = await c.D.get("libdocs", str(b.id, 60));
    need(x, "noRec", 404);
    try {
      await c.B.delete("libdocs/" + x.key);
    } catch {
    }
    await c.D.del("libdocs", x.id);
    await audit(c, "libdoc.delete", x.title);
    return { ok: 1 };
  } },
  "GET /libdoc/get": { auth: "staff", act: "libdocs", raw: true, async fn(c) {
    return fileResp(c, c.url.searchParams.get("id"));
  } },
  // trainers: read only
  "GET /portal/trainer/libdocs": { auth: "trainer", async fn(c) {
    return { list: (await list(c)).map(out2) };
  } },
  "GET /portal/trainer/libdoc": { auth: "trainer", raw: true, async fn(c) {
    const r = await fileResp(c, c.url.searchParams.get("id"));
    await audit(c, "libdoc.download", c.url.searchParams.get("id"));
    return r;
  } },
  /* company groups */
  "GET /portal/company/groups": { auth: "company", async fn(c) {
    return { list: (await c.D.byField("cogroups", "co", c.me.id)).map((r) => r.data).sort((a, b) => a.name.localeCompare(b.name)) };
  } },
  "POST /portal/company/group/save": { auth: "company", async fn(c) {
    const b = await c.body(), name = str(b.name, 120);
    need(name, "needName");
    const own2 = new Set((await c.D.byField("trainees", "co", c.me.id)).map((r) => r.id));
    const ids = [...new Set((b.ids || []).map((x) => str(x, 60)))].filter((id) => own2.has(id)).slice(0, 1e3);
    const g = b.id ? await ownGroup(c, b.id) : { id: uid("cg"), co: c.me.id, at: new Date(c.now()).toISOString() };
    Object.assign(g, { name, ids });
    await c.D.put("cogroups", [{ id: g.id, data: g }]);
    return { group: g };
  } },
  "POST /portal/company/group/delete": { auth: "company", async fn(c) {
    const g = await ownGroup(c, (await c.body()).id);
    await c.D.del("cogroups", g.id);
    return { ok: 1 };
  } }
};

// _lib/index.js
var liveRoutes = {
  "GET /rev": { auth: "staff", act: "view", async fn(c) {
    return { rev: await revOf(c.D, "rev") };
  } },
  "GET /portal/company/rev": { auth: "company", async fn(c) {
    return { rev: await revOf(c.D, "rev|c|" + c.me.id) };
  } },
  "GET /portal/trainee/rev": { auth: "trainee", async fn(c) {
    return { rev: await revOf(c.D, "rev|p|" + c.me.id, "rev|p|*") };
  } },
  "GET /portal/trainer/rev": { auth: "trainer", async fn(c) {
    const sid = String(c.url.searchParams.get("sid") || "").slice(0, 60);
    return { rev: await revOf(c.D, "rev|t|" + c.me.id, "rev|p|*", ...sid ? ["rev|s|" + sid] : []) };
  } }
};
var TRAINEE_OPEN = /* @__PURE__ */ new Set(["/portal/trainee/home", "/portal/trainee/profile/complete", "/portal/trainee/password", "/portal/trainee/rev"]);
var TABLE = { ...publicRoutes, ...portalRoutes, ...peopleRoutes, ...trainingRoutes, ...findRoutes, ...systemRoutes, ...testRoutes, ...liveRoutes, ...groupRoutes, ...approvalRoutes, ...aiRoutes, ...analyticsRoutes, ...candidateRoutes, ...libraryRoutes, ...notifyRoutes };
var ROUTES = Object.entries(TABLE).map(([k, v]) => {
  const [m, p] = k.split(" "), keys = [];
  const re = new RegExp("^" + p.replace(/:(\w+)/g, (_, n) => {
    keys.push(n);
    return "([^/]+)";
  }) + "$");
  return { m, re, keys, v };
});
var PORTAL_COL = { trainer: "trainers", trainee: "trainees", company: "companies" };
function createHandler(deps) {
  const MAX_JSON = 2 * 1048576;
  async function readJson(request) {
    if (request.method !== "POST") return {};
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_JSON) throw new H(413, "tooLarge");
    const text = await request.text();
    if (text.length > MAX_JSON) throw new H(413, "tooLarge");
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
  __name(readJson, "readJson");
  const SEC = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "same-origin",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "cross-origin-resource-policy": "same-origin"
  };
  function secure(res) {
    const r = new Response(res.body, res);
    for (const [k, v] of Object.entries(SEC)) if (!r.headers.has(k)) r.headers.set(k, v);
    if (!r.headers.has("cache-control")) r.headers.set("cache-control", "no-store");
    return r;
  }
  __name(secure, "secure");
  const countReq = /* @__PURE__ */ __name((env2, wu) => {
    try {
      if ((deps.rand || Math.random)() >= 0.1) return;
      const d = new Date((deps.now || Date.now)()).toISOString().slice(0, 10), p = deps.store(env2).seqN("req|" + d, 10).catch(() => {
      });
      wu ? wu(p) : p;
    } catch {
    }
  }, "countReq");
  return /* @__PURE__ */ __name(async function handle2(request, env2, wu) {
    return secure(await serve(request, env2, wu));
  }, "handle");
  async function serve(request, env2, wu) {
    countReq(env2, wu);
    const url = new URL(request.url), path = url.pathname.replace(/^\/api/, "").replace(/\/$/, "") || "/";
    let who = "";
    try {
      deps.validate?.(env2);
      const origin = request.headers.get("origin");
      if (origin && request.method !== "GET" && origin !== url.origin) throw new H(403, "badOrigin");
      let route = null;
      let params = {};
      for (const r of ROUTES) {
        if (r.m !== request.method) continue;
        const m = r.re.exec(path);
        if (m) {
          route = r;
          r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
          break;
        }
      }
      if (!route) throw new H(404, "noRec");
      const now2 = deps.now || Date.now;
      const live = tracked(indexed(cached(deps.store(env2))));
      const c = {
        env: env2,
        req: request,
        url,
        params,
        D: live.D,
        B: deps.bucket(env2),
        A: deps.auth(env2),
        now: now2,
        today: /* @__PURE__ */ __name(() => shared_exports.bakuToday(now2()), "today"),
        user: (
          /** @type {any} */
          null
        ),
        me: (
          /** @type {any} */
          null
        ),
        body: /* @__PURE__ */ __name(() => readJson(request), "body")
      };
      c.staffFromToken = async (token, opts = {}) => {
        if (!token) throw new H(401, "auth");
        if (token.split(".").length === 2) {
          const p = await readTok(env2, token), secret = String(env2.EMERGENCY_PASSWORD || "");
          if (p.r !== "emergency" || secret.length < 16 || !same(p.k || "", (await hmac(env2.TOKEN_SECRET, "em|" + secret)).slice(0, 12))) throw new H(401, "auth");
          return { id: "emergency", email: "admin_emergency", role: "emergency", kind: "staff", mfa: false, aal: "aal2", emergency: true };
        }
        const u = await c.A.user(token), settingsP = c.D.get("settings", "main");
        let s = await c.D.get("staff", u.id);
        const boot = String(env2.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
        if (boot && u.email?.toLowerCase() === boot && s?.role !== "superadmin" && !(await c.D.all("staff")).some((r) => r.data.role === "superadmin")) {
          s = { ...s || {}, email: u.email, role: "superadmin" };
          await c.D.put("staff", [{ id: u.id, data: s }]);
        }
        if (!s) throw new H(403, "forbidden");
        if (s.expires && shared_exports.bakuToday(now2()) > s.expires) throw new H(403, "accountExpired");
        const user = { id: u.id, email: u.email || s.email, role: shared_exports.legacyRole(s.role), kind: "staff", mfa: !!s.mfa, aal: u.aal };
        if (opts.mfa !== "skip") {
          if (s.mfa && u.aal !== "aal2") throw new H(401, "mfaRequired");
          const pol = (await settingsP)?.mfa || "off";
          if (!s.mfa && (pol === "all" || pol === "admins" && shared_exports.RANK[user.role] >= shared_exports.RANK.admin)) throw new H(403, "mfaSetup");
        }
        return user;
      };
      const auth = route.v.auth;
      if (auth === "cron") {
        const k = String(env2.CRON_SECRET || "");
        if (k.length < 16 || !same(request.headers.get("x-cron-key") || "", k)) throw new H(401, "auth");
        c.user = { kind: "system", name: "scheduler", role: "system" };
      } else if (auth === "staff") {
        c.user = await c.staffFromToken(bearer(request), { mfa: route.v.mfa });
        who = "staff:" + (c.user?.email || c.user?.id || "");
        if (!shared_exports.can(c.user.role, route.v.act || "view")) throw new H(403, "forbidden");
        if (c.user.emergency && request.method !== "GET") await audit(c, "emergency.action", path).catch(() => {
        });
        if (c.user.role === "auditor" && request.method === "GET" && path !== "/rev" && path !== "/notify") await audit(c, "auditor.view", path + (url.search || "").replace(/[?&]?(token|key)=[^&]*/g, "")).catch(() => {
        });
      } else if (PORTAL_COL[auth]) {
        const t = await readTok(env2, bearer(request));
        if (t.r !== auth) throw new H(401, "auth");
        const [acc] = await Promise.all([c.D.get(PORTAL_COL[auth], t.id), c.D.get("settings", "main").catch(() => null)]);
        if (!acc || acc.on === false || (acc.pv || 0) !== (t.pv || 0)) throw new H(401, "auth");
        c.me = acc;
        c.user = { kind: auth, id: acc.id, name: shared_exports.fullEn(acc) || acc.name };
        who = auth + ":" + acc.id;
        if (auth === "company") c.user.name = acc.name;
        if (auth === "trainee" && (acc.temp || !acc.fin || !acc.phone) && !TRAINEE_OPEN.has(path)) throw new H(403, "needProfile");
      }
      try {
        const out3 = await route.v.fn(c);
        return out3 instanceof Response ? out3 : J(out3);
      } finally {
        await live.flush();
      }
    } catch (e) {
      if (e instanceof H) return J({ error: e.message, ...e.extra || {} }, e.status);
      console.error(e);
      const ref2 = (request.headers.get("cf-ray") || "").split("-")[0] || Math.random().toString(36).slice(2, 10);
      try {
        const D = deps.store(env2), at = new Date((deps.now || Date.now)()).toISOString();
        await D.put("errlog", [{ id: at + "-" + ref2, data: { at, ref: ref2, method: request.method, path, who, msg: String(e?.message || e).slice(0, 300), stack: String(e?.stack || "").split("\n").slice(0, 6).join("\n").slice(0, 900), status: e?.status || 0, body: String(e?.body || "").slice(0, 300) } }]);
      } catch {
      }
      return J({ error: "server", ref: ref2 }, 500);
    }
  }
  __name(serve, "serve");
  ;
}
__name(createHandler, "createHandler");

// api/[[path]].js
var trim = /* @__PURE__ */ __name((v) => String(v || "").trim(), "trim");
var handle = createHandler({
  validate(env2) {
    for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_PUBLISHABLE_KEY", "TOKEN_SECRET"]) if (!trim(env2[k])) throw new H(500, "server");
  },
  store: /* @__PURE__ */ __name((env2) => supabaseStore({ ...env2, SUPABASE_URL: trim(env2.SUPABASE_URL).replace(/\/+$/, ""), SUPABASE_SERVICE_KEY: trim(env2.SUPABASE_SERVICE_KEY) }), "store"),
  auth: /* @__PURE__ */ __name((env2) => supabaseAuth({ ...env2, SUPABASE_URL: trim(env2.SUPABASE_URL).replace(/\/+$/, ""), SUPABASE_SERVICE_KEY: trim(env2.SUPABASE_SERVICE_KEY), SUPABASE_PUBLISHABLE_KEY: trim(env2.SUPABASE_PUBLISHABLE_KEY) }), "auth"),
  bucket: /* @__PURE__ */ __name((env2) => env2.BUCKET, "bucket")
});
var onRequest = /* @__PURE__ */ __name(({ request, env: env2, waitUntil }) => handle(request, env2, waitUntil), "onRequest");

// ../.wrangler/tmp/pages-TfrTyU/functionsRoutes-0.6784186508008225.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count3 = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count3--;
          if (count3 === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count3++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count3)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function getOriginalPathPrefix(requestPath, normalizedPrefix) {
  let end = 0;
  for (let index = 0; index < normalizedPrefix.length; index++) {
    end++;
    if (normalizedPrefix[index] === "/") {
      while (requestPath[end] === "/") {
        end++;
      }
    }
  }
  return requestPath.slice(0, end);
}
__name(getOriginalPathPrefix, "getOriginalPathPrefix");
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  const normalizedRequestPath = requestPath.replace(/\/+/g, "/");
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath) || routeMatcher(normalizedRequestPath);
    const originalMountMatch = mountMatcher(requestPath);
    const mountMatchResult = originalMountMatch || mountMatcher(normalizedRequestPath);
    if (matchResult && mountMatchResult) {
      const path = originalMountMatch ? originalMountMatch.path : getOriginalPathPrefix(requestPath, mountMatchResult.path);
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env2, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context2 = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env: env2,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context2);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error3) {
      if (isFailOpen) {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error3;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
