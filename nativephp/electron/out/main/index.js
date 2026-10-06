import { optimizer, electronApp } from "@electron-toolkit/utils";
import { enable, initialize } from "@electron/remote/main/index.js";
import { session, app, utilityProcess, dialog, clipboard, nativeImage, shell, Menu, globalShortcut, screen, Tray, BrowserWindow, Notification, powerMonitor, systemPreferences, safeStorage, nativeTheme } from "electron";
import killSync from "kill-sync";
import path, { join, resolve } from "path";
import ps from "ps-node";
import * as express from "express";
import express__default from "express";
import url, { fileURLToPath } from "url";
import fs, { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "fs";
import fs_extra from "fs-extra";
import { spawn, spawnSync, execFile } from "child_process";
import Store from "electron-store";
import getPort, { portNumbers } from "get-port";
import { createServer } from "net";
import { promisify } from "util";
import axios from "axios";
import bodyParser from "body-parser";
import electronUpdater from "electron-updater";
import contextMenu from "electron-context-menu";
import { EventEmitter } from "events";
import playSoundLib from "play-sound";
import { readFileSync as readFileSync$1 } from "node:fs";
import windowStateKeeper from "electron-window-state";
import fixPath from "fix-path";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
var __awaiter$8 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
function appendCookie() {
  return __awaiter$8(this, void 0, void 0, function* () {
    const cookie = {
      url: `http://localhost:${state.phpPort}`,
      name: "_php_native",
      value: state.randomSecret
    };
    yield session.defaultSession.cookies.set(cookie);
  });
}
function notifyLaravel(endpoint_1) {
  return __awaiter$8(this, arguments, void 0, function* (endpoint, payload = {}) {
    if (endpoint === "events") {
      broadcastToWindows("native-event", payload);
    }
    try {
      yield axios.post(`http://127.0.0.1:${state.phpPort}/_native/api/${endpoint}`, payload, {
        headers: {
          "X-NativePHP-Secret": state.randomSecret
        }
      });
    } catch (e) {
      if (parseInt(process.env.SHELL_VERBOSITY) > 0) {
        console.error(`notifyLaravel('${endpoint}') failed:`, e instanceof Error ? e.message : e);
      }
    }
  });
}
function broadcastToWindows(event, payload) {
  var _a;
  Object.values(state.windows).forEach((window) => {
    window.webContents.send(event, payload);
  });
  if ((_a = state.activeMenuBar) === null || _a === void 0 ? void 0 : _a.window) {
    state.activeMenuBar.window.webContents.send(event, payload);
  }
}
function trimOptions(options) {
  Object.keys(options).forEach((key) => options[key] == null && delete options[key]);
  return options;
}
function appendWindowIdToUrl(url2, id) {
  return url2 + (url2.indexOf("?") === -1 ? "?" : "&") + "_windowId=" + id;
}
function goToUrl(url2, windowId) {
  var _a;
  (_a = state.windows[windowId]) === null || _a === void 0 ? void 0 : _a.loadURL(appendWindowIdToUrl(url2, windowId));
}
const settingsStore = new Store();
settingsStore.onDidAnyChange((newValue, oldValue) => {
  const changedKeys = Object.keys(newValue).filter((key) => newValue[key] !== oldValue[key]);
  changedKeys.forEach((key) => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Settings\\SettingChanged",
      payload: {
        key,
        value: newValue[key] || null
      }
    });
  });
});
function generateRandomString(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
const state = {
  electronApiPort: null,
  activeMenuBar: null,
  tray: null,
  php: null,
  phpPort: null,
  phpIni: null,
  caCert: null,
  appPath: null,
  icon: null,
  store: settingsStore,
  randomSecret: generateRandomString(32),
  processes: {},
  windows: {},
  notifications: {},
  noFocusOnRestart: false,
  findWindow(id) {
    return this.windows[id] || null;
  }
};
var __awaiter$7 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, [])).next());
  });
};
const { copySync, mkdirpSync } = fs_extra;
const storagePath = join(app.getPath("userData"), "storage");
const databasePath = join(app.getPath("userData"), "database");
const databaseFile = join(databasePath, "database.sqlite");
const bootstrapCache = join(app.getPath("userData"), "bootstrap", "cache");
const argumentEnv = getArgumentEnv();
mkdirpSync(bootstrapCache);
mkdirpSync(join(storagePath, "logs"));
mkdirpSync(join(storagePath, "framework", "cache"));
mkdirpSync(join(storagePath, "framework", "sessions"));
mkdirpSync(join(storagePath, "framework", "views"));
mkdirpSync(join(storagePath, "framework", "testing"));
function runningSecureBuild() {
  return existsSync(join(getAppPath(), "build", "__nativephp_app_bundle")) && process.env.NODE_ENV !== "development";
}
function shouldMigrateDatabase(store) {
  return store.get("migrated_version") !== app.getVersion() && process.env.NODE_ENV !== "development";
}
function shouldOptimize() {
  return process.env.NODE_ENV !== "development";
}
function hasNightwatchInstalled(appPath2) {
  const candidateRoots = [appPath2, join(appPath2, "build", "__nativephp_app_bundle")];
  for (const root of candidateRoots) {
    if (existsSync(join(root, "vendor", "laravel", "nightwatch"))) {
      return true;
    }
    const composerLock = join(root, "composer.lock");
    if (!existsSync(composerLock)) {
      continue;
    }
    try {
      if (readFileSync(composerLock, "utf8").includes('"name": "laravel/nightwatch"')) {
        return true;
      }
    } catch (_a) {
    }
  }
  return false;
}
function getNightwatchToken(appPath2) {
  if (process.env.NIGHTWATCH_TOKEN) {
    return process.env.NIGHTWATCH_TOKEN;
  }
  const candidateRoots = [appPath2, join(appPath2, "build", "__nativephp_app_bundle")];
  for (const root of candidateRoots) {
    const envPath = join(root, ".env");
    if (!existsSync(envPath)) {
      continue;
    }
    try {
      const content = readFileSync(envPath, "utf8");
      const match = content.match(/^NIGHTWATCH_TOKEN=(.+)$/m);
      if (match && match[1]) {
        return match[1].replace(/^['"]|['"]$/g, "");
      }
    } catch (_a) {
    }
  }
}
function getPhpPort() {
  return __awaiter$7(this, void 0, void 0, function* () {
    const suggestedPort = yield getPort({
      host: "127.0.0.1",
      port: portNumbers(8100, 9e3)
    });
    if (yield canBindToPort(suggestedPort)) {
      return suggestedPort;
    }
    console.warn(`Port ${suggestedPort} is not bindable, manually searching...`);
    for (let port = suggestedPort + 1; port < 9e3; port++) {
      if (yield canBindToPort(port)) {
        return port;
      }
    }
    throw new Error("Could not find an available port in range 8100-9000");
  });
}
function canBindToPort(port) {
  return new Promise((resolve2) => {
    const server = createServer();
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve2(true));
    });
    server.on("error", () => {
      resolve2(false);
    });
  });
}
function retrievePhpIniSettings() {
  return __awaiter$7(this, void 0, void 0, function* () {
    const env = Object.assign(Object.assign({}, process.env), getDefaultEnvironmentVariables());
    const appPath2 = getAppPath();
    const phpOptions = {
      cwd: appPath2,
      env
    };
    const command = ["artisan", "native:php-ini"];
    if (runningSecureBuild()) {
      command.unshift(join(appPath2, "build", "__nativephp_app_bundle"));
    }
    return yield promisify(execFile)(state.php, command, phpOptions);
  });
}
function retrieveNativePHPConfig() {
  return __awaiter$7(this, void 0, void 0, function* () {
    const env = Object.assign(Object.assign({}, process.env), getDefaultEnvironmentVariables());
    const appPath2 = getAppPath();
    const phpOptions = {
      cwd: appPath2,
      env
    };
    const command = ["artisan", "native:config"];
    if (runningSecureBuild()) {
      command.unshift(join(appPath2, "build", "__nativephp_app_bundle"));
    }
    return yield promisify(execFile)(state.php, command, phpOptions);
  });
}
function callPhp(args, options, phpIniSettings = {}) {
  if (args[0] === "artisan" && runningSecureBuild()) {
    args.unshift(join(getAppPath(), "build", "__nativephp_app_bundle"));
  }
  const iniSettings = Object.assign(getDefaultPhpIniSettings(), phpIniSettings);
  Object.keys(iniSettings).forEach((key) => {
    args.unshift("-d", `${key}=${iniSettings[key]}`);
  });
  if (parseInt(process.env.SHELL_VERBOSITY) > 0) {
    console.log("Calling PHP", state.php, args);
  }
  return spawn(state.php, args, {
    cwd: options.cwd,
    env: Object.assign(Object.assign({}, process.env), options.env)
  });
}
function callPhpSync(args, options, phpIniSettings = {}) {
  if (args[0] === "artisan" && runningSecureBuild()) {
    args.unshift(join(getAppPath(), "build", "__nativephp_app_bundle"));
  }
  const iniSettings = Object.assign(getDefaultPhpIniSettings(), phpIniSettings);
  Object.keys(iniSettings).forEach((key) => {
    args.unshift("-d", `${key}=${iniSettings[key]}`);
  });
  if (parseInt(process.env.SHELL_VERBOSITY) > 0) {
    console.log("Calling PHP", state.php, args);
  }
  return spawnSync(state.php, args, {
    cwd: options.cwd,
    env: Object.assign(Object.assign({}, process.env), options.env)
  });
}
function getArgumentEnv() {
  const envArgs = process.argv.filter((arg) => arg.startsWith("--env."));
  const env = {};
  envArgs.forEach((arg) => {
    const [key, value] = arg.slice(6).split("=");
    env[key] = value;
  });
  return env;
}
function getAppPath() {
  let appPath2 = state.appPath;
  if (process.env.NODE_ENV === "development" || argumentEnv.TESTING == 1) {
    appPath2 = process.env.APP_PATH || argumentEnv.APP_PATH;
  }
  return appPath2;
}
function ensureAppFoldersAreAvailable() {
  console.log("Copying storage folder...");
  console.log("Storage path:", storagePath);
  if (!existsSync(storagePath) || process.env.NODE_ENV === "development") {
    const appPath2 = getAppPath();
    console.log("App path:", appPath2);
    copySync(join(appPath2, "storage"), storagePath);
  }
  mkdirSync(databasePath, { recursive: true });
  try {
    statSync(databaseFile);
  } catch (_a) {
    writeFileSync(databaseFile, "");
  }
}
function startScheduler(secret, apiPort, phpIniSettings = {}) {
  const env = getDefaultEnvironmentVariables(secret, apiPort);
  const appPath2 = getAppPath();
  const phpOptions = {
    cwd: appPath2,
    env
  };
  return callPhp(["artisan", "schedule:run"], phpOptions, phpIniSettings);
}
function getPath(name) {
  try {
    return app.getPath(name);
  } catch (_a) {
    return "";
  }
}
function getDefaultEnvironmentVariables(secret, apiPort) {
  const variables = {
    APP_ENV: process.env.NODE_ENV === "development" ? "local" : "production",
    APP_DEBUG: process.env.NODE_ENV === "development" ? "true" : "false",
    LARAVEL_STORAGE_PATH: storagePath,
    NATIVEPHP_RUNNING: "true",
    NATIVEPHP_STORAGE_PATH: storagePath,
    NATIVEPHP_DATABASE_PATH: databaseFile,
    NATIVEPHP_USER_HOME_PATH: getPath("home"),
    NATIVEPHP_APP_DATA_PATH: getPath("appData"),
    NATIVEPHP_USER_DATA_PATH: getPath("userData"),
    NATIVEPHP_DESKTOP_PATH: getPath("desktop"),
    NATIVEPHP_DOCUMENTS_PATH: getPath("documents"),
    NATIVEPHP_DOWNLOADS_PATH: getPath("downloads"),
    NATIVEPHP_MUSIC_PATH: getPath("music"),
    NATIVEPHP_PICTURES_PATH: getPath("pictures"),
    NATIVEPHP_VIDEOS_PATH: getPath("videos"),
    NATIVEPHP_RECENT_PATH: getPath("recent"),
    NATIVEPHP_EXTRAS_PATH: app.isPackaged ? join(process.resourcesPath, "..", "extras") : join(process.env.APP_PATH || getAppPath(), "extras")
  };
  if (secret && apiPort) {
    variables.NATIVEPHP_API_URL = `http://127.0.0.1:${apiPort}/api/`;
    variables.NATIVEPHP_SECRET = secret;
  }
  if (runningSecureBuild()) {
    variables.APP_SERVICES_CACHE = join(bootstrapCache, "services.php");
    variables.APP_PACKAGES_CACHE = join(bootstrapCache, "packages.php");
    variables.APP_CONFIG_CACHE = join(bootstrapCache, "config.php");
    variables.APP_ROUTES_CACHE = join(bootstrapCache, "routes-v7.php");
    variables.APP_EVENTS_CACHE = join(bootstrapCache, "events.php");
  }
  return variables;
}
function getDefaultPhpIniSettings() {
  return {
    memory_limit: "512M",
    "curl.cainfo": state.caCert,
    "openssl.cafile": state.caCert
  };
}
function serveApp(secret, apiPort, phpIniSettings) {
  return __awaiter$7(this, void 0, void 0, function* () {
    const appPath2 = getAppPath();
    console.log("Starting PHP server...", `${state.php} artisan serve`, appPath2, phpIniSettings);
    ensureAppFoldersAreAvailable();
    console.log("Making sure app folders are available");
    const env = getDefaultEnvironmentVariables(secret, apiPort);
    const nightwatchToken = getNightwatchToken(appPath2);
    let phpNightWatchPort;
    if (nightwatchToken && hasNightwatchInstalled(appPath2)) {
      phpNightWatchPort = yield getPhpPort();
      env.NIGHTWATCH_TOKEN = nightwatchToken;
      env.NIGHTWATCH_INGEST_URI = `127.0.0.1:${phpNightWatchPort}`;
    } else if (nightwatchToken) {
      console.log("Skipping Nightwatch: package not installed.");
    }
    const phpOptions = {
      cwd: appPath2,
      env
    };
    const store = new Store({
      name: "nativephp"
    });
    if (env.NIGHTWATCH_INGEST_URI && phpNightWatchPort) {
      console.log("Starting Nightwatch server...");
      callPhp(["artisan", "nightwatch:agent", `--listen-on=${env.NIGHTWATCH_INGEST_URI}`], phpOptions, phpIniSettings);
      console.log("Nightwatch server started on port:", phpNightWatchPort);
    }
    if (shouldOptimize()) {
      console.log("Caching view and routes...");
      const result = callPhpSync(["artisan", "optimize"], phpOptions, phpIniSettings);
      if (result.status !== 0) {
        console.error("Failed to cache view and routes:", result.stderr.toString());
      } else {
        store.set("optimized_version", app.getVersion());
      }
    }
    if (shouldMigrateDatabase(store)) {
      console.log("Migrating database...");
      if (parseInt(process.env.SHELL_VERBOSITY) > 0) {
        console.log("Database path:", databaseFile);
      }
      const result = callPhpSync(["artisan", "migrate", "--force"], phpOptions, phpIniSettings);
      if (result.status !== 0) {
        console.error("Failed to migrate database:", result.stderr.toString());
      } else {
        store.set("migrated_version", app.getVersion());
      }
    }
    if (process.env.NODE_ENV === "development") {
      console.log("Skipping Database migration while in development.");
      console.log("You may migrate manually by running: php artisan native:migrate");
    }
    let serverPath;
    let cwd;
    if (runningSecureBuild()) {
      serverPath = join(appPath2, "build", "__nativephp_app_bundle");
    } else {
      console.log("* * * Running from source * * *");
      serverPath = join(appPath2, "vendor", "laravel", "framework", "src", "Illuminate", "Foundation", "resources", "server.php");
      cwd = join(appPath2, "public");
    }
    console.log("Starting PHP server...");
    const phpPort = yield getPhpPort();
    const phpServer = callPhp(["-S", `127.0.0.1:${phpPort}`, serverPath], {
      cwd,
      env
    }, phpIniSettings);
    const portRegex = /Development Server \(.*:([0-9]+)\) started/gm;
    return new Promise((resolve2, reject) => {
      phpServer.stdout.on("data", (data) => {
        if (parseInt(process.env.SHELL_VERBOSITY) > 0) {
          console.log(data.toString().trim());
        }
      });
      phpServer.stderr.on("data", (data) => {
        const error = data.toString();
        const match = portRegex.exec(data.toString());
        if (match) {
          const port = parseInt(match[1]);
          console.log("PHP Server started on port: ", port);
          resolve2({
            port,
            process: phpServer
          });
        } else if (error.includes("[NATIVE_EXCEPTION]:")) {
          const logFile = join(storagePath, "logs");
          console.log();
          console.error("Error in PHP:");
          console.error("  " + error.split("[NATIVE_EXCEPTION]:")[1].trim());
          console.log("Please check your log files:");
          console.log("  " + logFile);
          console.log();
        }
      });
      phpServer.on("error", (error) => {
        reject(error);
      });
      phpServer.on("close", (code) => {
        console.log(`PHP server exited with code ${code}`);
      });
    });
  });
}
var __awaiter$6 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, [])).next());
  });
};
const router$l = express__default.Router();
function startProcess(settings, useNodeRuntime = false) {
  const { alias, cmd, cwd, env, spawnTimeout = 3e4 } = settings;
  if (getProcess(alias) !== void 0) {
    return state.processes[alias];
  }
  try {
    const proc = utilityProcess.fork(fileURLToPath(new URL("../../electron-plugin/dist/server/childProcess.js", import.meta.url)), cmd, {
      cwd,
      stdio: "pipe",
      serviceName: alias,
      env: Object.assign(Object.assign(Object.assign({}, process.env), env), { USE_NODE_RUNTIME: useNodeRuntime ? "1" : "0" })
    });
    const startTimeout = setTimeout(() => {
      if (!state.processes[alias] || !state.processes[alias].pid) {
        console.error(`Process [${alias}] failed to start within timeout period`);
        try {
          proc.kill();
        } catch (_a) {
        }
        notifyLaravel("events", {
          event: "Native\\Desktop\\Events\\ChildProcess\\StartupError",
          payload: {
            alias,
            error: "Startup timeout exceeded"
          }
        });
      }
    }, spawnTimeout);
    proc.stdout.on("data", (data) => {
      notifyLaravel("events", {
        event: "Native\\Desktop\\Events\\ChildProcess\\MessageReceived",
        payload: {
          alias,
          data: data.toString()
        }
      });
    });
    proc.stderr.on("data", (data) => {
      console.error("Process [" + alias + "] ERROR:", data.toString().trim());
      notifyLaravel("events", {
        event: "Native\\Desktop\\Events\\ChildProcess\\ErrorReceived",
        payload: {
          alias,
          data: data.toString()
        }
      });
    });
    proc.on("spawn", () => {
      clearTimeout(startTimeout);
      console.log("Process [" + alias + "] spawned!");
      state.processes[alias] = {
        pid: proc.pid,
        proc,
        settings
      };
      notifyLaravel("events", {
        event: "Native\\Desktop\\Events\\ChildProcess\\ProcessSpawned",
        payload: [alias, proc.pid]
      });
    });
    proc.on("exit", (code) => {
      clearTimeout(startTimeout);
      console.log(`Process [${alias}] exited with code [${code}].`);
      notifyLaravel("events", {
        event: "Native\\Desktop\\Events\\ChildProcess\\ProcessExited",
        payload: {
          alias,
          code
        }
      });
      const settings2 = Object.assign({}, getSettings(alias));
      delete state.processes[alias];
      if (settings2 === null || settings2 === void 0 ? void 0 : settings2.persistent) {
        console.log("Process [" + alias + "] watchdog restarting...");
        setTimeout(() => startProcess(settings2), 1e3);
      }
    });
    return {
      pid: null,
      proc,
      settings
    };
  } catch (error) {
    console.error(`Failed to create process [${alias}]: ${error.message}`);
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\ChildProcess\\StartupError",
      payload: {
        alias,
        error: error.toString()
      }
    });
    return {
      pid: null,
      proc: null,
      settings,
      error: error.message
    };
  }
}
function startPhpProcess(settings) {
  const defaultEnv = getDefaultEnvironmentVariables(state.randomSecret, state.electronApiPort);
  const customIniSettings = settings.iniSettings || {};
  const iniSettings = Object.assign(Object.assign(Object.assign({}, getDefaultPhpIniSettings()), state.phpIni), customIniSettings);
  const iniArgs = Object.keys(iniSettings).map((key) => {
    return ["-d", `${key}=${iniSettings[key]}`];
  }).flat();
  if (settings.cmd[0] === "artisan" && runningSecureBuild()) {
    settings.cmd.unshift(join(getAppPath(), "build", "__nativephp_app_bundle"));
  }
  settings = Object.assign(Object.assign({}, settings), { cmd: [state.php, ...iniArgs, ...settings.cmd], env: Object.assign(Object.assign({}, settings.env), defaultEnv) });
  return startProcess(settings);
}
function stopProcess(alias) {
  const proc = getProcess(alias);
  if (proc === void 0) {
    return;
  }
  const settings = state.processes[alias].settings;
  settings.persistent = false;
  console.log("Process [" + alias + "] stopping with PID [" + proc.pid + "].");
  try {
    if (settings.handlesOwnShutdown && process.platform !== "win32") {
      process.kill(proc.pid, "SIGTERM");
    } else {
      killSync(proc.pid, "SIGTERM", true);
      proc.kill();
    }
  } catch (_a) {
    console.log("Process [" + alias + "] already exited — nothing to kill.");
  }
}
function stopAllProcesses() {
  for (const alias in state.processes) {
    stopProcess(alias);
  }
}
function getProcess(alias) {
  var _a;
  return (_a = state.processes[alias]) === null || _a === void 0 ? void 0 : _a.proc;
}
function getSettings(alias) {
  var _a;
  return (_a = state.processes[alias]) === null || _a === void 0 ? void 0 : _a.settings;
}
router$l.post("/start", (req, res) => {
  const proc = startProcess(req.body);
  res.json(proc);
});
router$l.post("/start-node", (req, res) => {
  const proc = startProcess(req.body, true);
  res.json(proc);
});
router$l.post("/start-php", (req, res) => {
  const proc = startPhpProcess(req.body);
  res.json(proc);
});
router$l.post("/stop", (req, res) => {
  const { alias } = req.body;
  stopProcess(alias);
  res.sendStatus(200);
});
router$l.post("/restart", (req, res) => __awaiter$6(void 0, void 0, void 0, function* () {
  const { alias } = req.body;
  const settings = Object.assign({}, getSettings(alias));
  stopProcess(alias);
  if (settings === void 0) {
    res.sendStatus(410);
    return;
  }
  const waitForProcessDeletion = (timeout, retry) => __awaiter$6(void 0, void 0, void 0, function* () {
    const start = Date.now();
    while (state.processes[alias] !== void 0) {
      if (Date.now() - start > timeout) {
        return;
      }
      yield new Promise((resolve2) => setTimeout(resolve2, retry));
    }
  });
  yield waitForProcessDeletion(5e3, 100);
  console.log("Process [" + alias + "] restarting...");
  const proc = startProcess(settings);
  res.json(proc);
}));
router$l.get("/get/:alias", (req, res) => {
  const { alias } = req.params;
  const proc = state.processes[alias];
  if (proc === void 0) {
    res.sendStatus(410);
    return;
  }
  res.json(proc);
});
router$l.get("/", (req, res) => {
  res.json(state.processes);
});
router$l.post("/message", (req, res) => {
  const { alias, message } = req.body;
  const proc = getProcess(alias);
  if (proc === void 0) {
    res.sendStatus(200);
    return;
  }
  proc.postMessage(message);
  res.sendStatus(200);
});
function middleware(secret) {
  return function(req, res, next) {
    if (req.headers["x-nativephp-secret"] !== secret) {
      res.sendStatus(403);
      return;
    }
    next();
  };
}
const router$k = express__default.Router();
router$k.post("/message", (req, res) => {
  const { message, type, title, detail, buttons, defaultId, cancelId } = req.body;
  const result = dialog.showMessageBoxSync({
    message,
    type: type !== null && type !== void 0 ? type : void 0,
    title: title !== null && title !== void 0 ? title : void 0,
    detail: detail !== null && detail !== void 0 ? detail : void 0,
    buttons: buttons !== null && buttons !== void 0 ? buttons : void 0,
    defaultId: defaultId !== null && defaultId !== void 0 ? defaultId : void 0,
    cancelId: cancelId !== null && cancelId !== void 0 ? cancelId : void 0
  });
  res.json({
    result
  });
});
router$k.post("/error", (req, res) => {
  const { title, message } = req.body;
  dialog.showErrorBox(title, message);
  res.json({
    result: true
  });
});
const router$j = express__default.Router();
router$j.post("/quit", (req, res) => {
  app.quit();
  res.sendStatus(200);
});
router$j.post("/relaunch", () => {
  app.relaunch();
  app.quit();
});
router$j.post("/show", (req, res) => {
  app.show();
  res.sendStatus(200);
});
router$j.post("/hide", (req, res) => {
  app.hide();
  res.sendStatus(200);
});
router$j.get("/is-hidden", (req, res) => {
  res.json({
    is_hidden: app.isHidden()
  });
});
router$j.get("/locale", (req, res) => {
  res.json({
    locale: app.getLocale()
  });
});
router$j.get("/locale-country-code", (req, res) => {
  res.json({
    locale_country_code: app.getLocaleCountryCode()
  });
});
router$j.get("/system-locale", (req, res) => {
  res.json({
    system_locale: app.getSystemLocale()
  });
});
router$j.get("/app-path", (req, res) => {
  res.json({
    path: app.getAppPath()
  });
});
router$j.get("/path/:name", (req, res) => {
  res.json({
    path: app.getPath(req.params.name)
  });
});
router$j.get("/version", (req, res) => {
  res.json({
    version: app.getVersion()
  });
});
router$j.post("/badge-count", (req, res) => {
  app.setBadgeCount(req.body.count);
  res.sendStatus(200);
});
router$j.get("/badge-count", (req, res) => {
  res.json({
    count: app.getBadgeCount()
  });
});
router$j.post("/recent-documents", (req, res) => {
  app.addRecentDocument(req.body.path);
  res.sendStatus(200);
});
router$j.delete("/recent-documents", (req, res) => {
  app.clearRecentDocuments();
  res.sendStatus(200);
});
router$j.post("/open-at-login", (req, res) => {
  app.setLoginItemSettings({
    openAtLogin: req.body.open
  });
  res.sendStatus(200);
});
router$j.get("/open-at-login", (req, res) => {
  res.json({
    open: app.getLoginItemSettings().openAtLogin
  });
});
router$j.get("/is-emoji-panel-supported", (req, res) => {
  res.json({
    supported: app.isEmojiPanelSupported()
  });
});
router$j.post("/show-emoji-panel", (req, res) => {
  app.showEmojiPanel();
  res.sendStatus(200);
});
const { autoUpdater: autoUpdater$1 } = electronUpdater;
const router$i = express__default.Router();
router$i.post("/check-for-updates", (req, res) => {
  autoUpdater$1.checkForUpdates();
  res.sendStatus(200);
});
router$i.post("/download-update", (req, res) => {
  autoUpdater$1.downloadUpdate();
  res.sendStatus(200);
});
router$i.post("/quit-and-install", (req, res) => {
  autoUpdater$1.quitAndInstall();
  res.sendStatus(200);
});
autoUpdater$1.addListener("checking-for-update", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\CheckingForUpdate`
  });
});
autoUpdater$1.addListener("update-available", (event) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\UpdateAvailable`,
    payload: {
      version: event.version,
      files: event.files,
      releaseDate: event.releaseDate,
      releaseName: event.releaseName,
      releaseNotes: event.releaseNotes,
      stagingPercentage: event.stagingPercentage,
      minimumSystemVersion: event.minimumSystemVersion
    }
  });
});
autoUpdater$1.addListener("update-not-available", (event) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\UpdateNotAvailable`,
    payload: {
      version: event.version,
      files: event.files,
      releaseDate: event.releaseDate,
      releaseName: event.releaseName,
      releaseNotes: event.releaseNotes,
      stagingPercentage: event.stagingPercentage,
      minimumSystemVersion: event.minimumSystemVersion
    }
  });
});
autoUpdater$1.addListener("error", (error) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\Error`,
    payload: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
});
autoUpdater$1.addListener("download-progress", (progressInfo) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\DownloadProgress`,
    payload: {
      total: progressInfo.total,
      delta: progressInfo.delta,
      transferred: progressInfo.transferred,
      percent: progressInfo.percent,
      bytesPerSecond: progressInfo.bytesPerSecond
    }
  });
});
autoUpdater$1.addListener("update-downloaded", (event) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\UpdateDownloaded`,
    payload: {
      downloadedFile: event.downloadedFile,
      version: event.version,
      files: event.files,
      releaseDate: event.releaseDate,
      releaseName: event.releaseName,
      releaseNotes: event.releaseNotes,
      stagingPercentage: event.stagingPercentage,
      minimumSystemVersion: event.minimumSystemVersion
    }
  });
});
autoUpdater$1.addListener("update-cancelled", (event) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\AutoUpdater\\UpdateCancelled`,
    payload: {
      version: event.version,
      files: event.files,
      releaseDate: event.releaseDate,
      releaseName: event.releaseName,
      releaseNotes: event.releaseNotes,
      stagingPercentage: event.stagingPercentage,
      minimumSystemVersion: event.minimumSystemVersion
    }
  });
});
const router$h = express__default.Router();
router$h.post("/", (req, res) => {
  const { event, payload } = req.body;
  broadcastToWindows("native-event", { event, payload });
  res.sendStatus(200);
});
const router$g = express.Router();
const DEFAULT_TYPE = "clipboard";
router$g.get("/text", (req, res) => {
  const { type } = req.query;
  res.json({
    text: clipboard.readText(type || DEFAULT_TYPE)
  });
});
router$g.post("/text", (req, res) => {
  const { text } = req.body;
  const { type } = req.query;
  clipboard.writeText(text, type || DEFAULT_TYPE);
  res.json({
    text
  });
});
router$g.get("/html", (req, res) => {
  const { type } = req.query;
  res.json({
    html: clipboard.readHTML(type || DEFAULT_TYPE)
  });
});
router$g.post("/html", (req, res) => {
  const { html } = req.body;
  const { type } = req.query;
  clipboard.writeHTML(html, type || DEFAULT_TYPE);
  res.json({
    html
  });
});
router$g.get("/image", (req, res) => {
  const { type } = req.query;
  const image = clipboard.readImage(type || DEFAULT_TYPE);
  res.json({
    image: image.isEmpty() ? null : image.toDataURL()
  });
});
router$g.post("/image", (req, res) => {
  const { image } = req.body;
  const { type } = req.query;
  try {
    const _nativeImage = nativeImage.createFromDataURL(image);
    clipboard.writeImage(_nativeImage, type || DEFAULT_TYPE);
  } catch (e) {
    res.status(400).json({
      error: e.message
    });
    return;
  }
  res.sendStatus(200);
});
router$g.delete("/", (req, res) => {
  const { type } = req.query;
  clipboard.clear(type || DEFAULT_TYPE);
  res.sendStatus(200);
});
function triggerMenuItemEvent(menuItem, combo) {
  notifyLaravel("events", {
    event: menuItem.event || "\\Native\\Desktop\\Events\\Menu\\MenuItemClicked",
    payload: {
      item: {
        id: menuItem.id,
        label: menuItem.label,
        checked: menuItem.checked
      },
      combo
    }
  });
}
function compileMenu(item) {
  var _a, _b;
  if (item.submenu) {
    if (Array.isArray(item.submenu)) {
      item.submenu = (_a = item.submenu) === null || _a === void 0 ? void 0 : _a.map(compileMenu);
    } else {
      item.submenu = (_b = item.submenu.submenu) === null || _b === void 0 ? void 0 : _b.map(compileMenu);
    }
  }
  if (item.type === "link") {
    item.type = "normal";
    item.click = (menuItem, focusedWindow, combo) => {
      triggerMenuItemEvent(item, combo);
      if (item.openInBrowser) {
        shell.openExternal(item.url);
        return;
      }
      if (!focusedWindow) {
        return;
      }
      const id = Object.keys(state.windows).find((key) => state.windows[key] === focusedWindow);
      goToUrl(item.url, id);
    };
    return item;
  }
  if (item.type === "checkbox" || item.type === "radio") {
    item.click = (menuItem, focusedWindow, combo) => {
      item.checked = !item.checked;
      triggerMenuItemEvent(item, combo);
    };
    return item;
  }
  if (item.type === "role") {
    const menuItem = {
      role: item.role
    };
    if (item.label) {
      menuItem["label"] = item.label;
    }
    return menuItem;
  }
  if (!item.click) {
    item.click = (menuItem, focusedWindow, combo) => {
      triggerMenuItemEvent(item, combo);
    };
  }
  return item;
}
const router$f = express__default.Router();
let contextMenuDisposable = null;
router$f.delete("/", (req, res) => {
  res.sendStatus(200);
  if (contextMenuDisposable) {
    contextMenuDisposable();
    contextMenuDisposable = null;
  }
});
router$f.post("/", (req, res) => {
  res.sendStatus(200);
  if (contextMenuDisposable) {
    contextMenuDisposable();
    contextMenuDisposable = null;
  }
  contextMenuDisposable = contextMenu({
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showInspectElement: false,
    prepend: () => {
      return req.body.entries.map(compileMenu);
    }
  });
});
const router$e = express__default.Router();
router$e.post("/log", (req, res) => {
  const { level, message, context } = req.body;
  broadcastToWindows("log", { level, message, context });
  res.sendStatus(200);
});
const router$d = express__default.Router();
router$d.post("/open", (req, res) => {
  const { title, buttonLabel, filters, properties, defaultPath, message, windowReference } = req.body;
  let options = {
    title,
    defaultPath,
    buttonLabel,
    filters,
    message,
    properties
  };
  options = trimOptions(options);
  let result;
  const browserWindow = state.findWindow(windowReference);
  if (browserWindow) {
    result = dialog.showOpenDialogSync(browserWindow, options);
  } else {
    result = dialog.showOpenDialogSync(options);
  }
  res.json({
    result
  });
});
router$d.post("/save", (req, res) => {
  const { title, buttonLabel, filters, properties, defaultPath, message, windowReference } = req.body;
  let options = {
    title,
    defaultPath,
    buttonLabel,
    filters,
    message,
    properties
  };
  options = trimOptions(options);
  let result;
  const browserWindow = state.findWindow(windowReference);
  if (browserWindow) {
    result = dialog.showSaveDialogSync(browserWindow, options);
  } else {
    result = dialog.showSaveDialogSync(options);
  }
  res.json({
    result
  });
});
const router$c = express__default.Router();
router$c.post("/", (req, res) => {
  const menuEntries = req.body.items.map(compileMenu);
  const menu = Menu.buildFromTemplate(menuEntries);
  app.dock.setMenu(menu);
  res.sendStatus(200);
});
router$c.post("/show", (req, res) => {
  app.dock.show();
  res.sendStatus(200);
});
router$c.post("/hide", (req, res) => {
  app.dock.hide();
  res.sendStatus(200);
});
router$c.post("/icon", (req, res) => {
  app.dock.setIcon(req.body.path);
  res.sendStatus(200);
});
router$c.post("/bounce", (req, res) => {
  const { type } = req.body;
  state.dockBounce = app.dock.bounce(type);
  res.sendStatus(200);
});
router$c.post("/cancel-bounce", (req, res) => {
  app.dock.cancelBounce(state.dockBounce);
  res.sendStatus(200);
});
router$c.get("/badge", (req, res) => {
  res.json({
    label: app.dock.getBadge()
  });
});
router$c.post("/badge", (req, res) => {
  app.dock.setBadge(req.body.label);
  res.sendStatus(200);
});
const router$b = express__default.Router();
router$b.post("/", (req, res) => {
  const { key, event } = req.body;
  globalShortcut.register(key, () => {
    notifyLaravel("events", {
      event,
      payload: [key]
    });
  });
  res.sendStatus(200);
});
router$b.delete("/", (req, res) => {
  const { key } = req.body;
  globalShortcut.unregister(key);
  res.sendStatus(200);
});
router$b.get("/:key", (req, res) => {
  const { key } = req.params;
  res.json({
    isRegistered: globalShortcut.isRegistered(key)
  });
});
const router$a = express__default.Router();
router$a.post("/", (req, res) => {
  Menu.setApplicationMenu(null);
  const menuEntries = req.body.items.map(compileMenu);
  const menu = Menu.buildFromTemplate(menuEntries);
  Menu.setApplicationMenu(menu);
  res.sendStatus(200);
});
class Positioner {
  constructor(browserWindow) {
    this.browserWindow = browserWindow;
    this.electronScreen = screen;
  }
  _getCoords(position, trayPosition) {
    const screenSize = this._getScreenSize(trayPosition);
    const windowSize = this._getWindowSize();
    if (trayPosition === void 0)
      trayPosition = {};
    const positions = {
      trayLeft: {
        x: Math.floor(trayPosition.x),
        y: screenSize.y
      },
      trayBottomLeft: {
        x: Math.floor(trayPosition.x),
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      trayRight: {
        x: Math.floor(trayPosition.x - windowSize[0] + trayPosition.width),
        y: screenSize.y
      },
      trayBottomRight: {
        x: Math.floor(trayPosition.x - windowSize[0] + trayPosition.width),
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      trayCenter: {
        x: Math.floor(trayPosition.x - windowSize[0] / 2 + trayPosition.width / 2),
        y: screenSize.y
      },
      trayBottomCenter: {
        x: Math.floor(trayPosition.x - windowSize[0] / 2 + trayPosition.width / 2),
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      topLeft: {
        x: screenSize.x,
        y: screenSize.y
      },
      topRight: {
        x: Math.floor(screenSize.x + (screenSize.width - windowSize[0])),
        y: screenSize.y
      },
      bottomLeft: {
        x: screenSize.x,
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      bottomRight: {
        x: Math.floor(screenSize.x + (screenSize.width - windowSize[0])),
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      topCenter: {
        x: Math.floor(screenSize.x + (screenSize.width / 2 - windowSize[0] / 2)),
        y: screenSize.y
      },
      bottomCenter: {
        x: Math.floor(screenSize.x + (screenSize.width / 2 - windowSize[0] / 2)),
        y: Math.floor(screenSize.height - (windowSize[1] - screenSize.y))
      },
      leftCenter: {
        x: screenSize.x,
        y: screenSize.y + Math.floor(screenSize.height / 2) - Math.floor(windowSize[1] / 2)
      },
      rightCenter: {
        x: Math.floor(screenSize.x + (screenSize.width - windowSize[0])),
        y: screenSize.y + Math.floor(screenSize.height / 2) - Math.floor(windowSize[1] / 2)
      },
      center: {
        x: Math.floor(screenSize.x + (screenSize.width / 2 - windowSize[0] / 2)),
        y: Math.floor((screenSize.height + screenSize.y) / 2 - windowSize[1] / 2)
      },
      upperCenter: {
        x: Math.floor(screenSize.x + (screenSize.width / 2 - windowSize[0] / 2)),
        y: Math.floor(screenSize.y + (screenSize.height - windowSize[1]) / 3)
      }
    };
    if (position.substr(0, 4) === "tray") {
      if (positions[position].x + windowSize[0] > screenSize.width + screenSize.x) {
        return {
          x: positions["topRight"].x,
          y: positions[position].y
        };
      }
    }
    return positions[position];
  }
  _getWindowSize() {
    return this.browserWindow.getSize();
  }
  _getScreenSize(trayPosition) {
    if (trayPosition) {
      return this.electronScreen.getDisplayMatching(trayPosition).workArea;
    } else {
      return this.electronScreen.getDisplayNearestPoint(this.electronScreen.getCursorScreenPoint()).workArea;
    }
  }
  move(position, trayPos) {
    const coords = this._getCoords(position, trayPos);
    this.browserWindow.setPosition(coords.x, coords.y);
  }
  calculate(position, trayPos) {
    const coords = this._getCoords(position, trayPos);
    return {
      x: coords.x,
      y: coords.y
    };
  }
}
const DEFAULT_WINDOW_HEIGHT = 400;
const DEFAULT_WINDOW_WIDTH = 400;
function cleanOptions(opts) {
  const options = Object.assign({}, opts);
  if (options.activateWithApp === void 0) {
    options.activateWithApp = true;
  }
  if (!options.dir) {
    options.dir = app.getAppPath();
  }
  if (!path.isAbsolute(options.dir)) {
    options.dir = path.resolve(options.dir);
  }
  if (options.index === void 0) {
    options.index = url.format({
      pathname: path.join(options.dir, "index.html"),
      protocol: "file:",
      slashes: true
    });
  }
  options.loadUrlOptions = options.loadUrlOptions || {};
  options.tooltip = options.tooltip || "";
  if (!options.browserWindow) {
    options.browserWindow = {};
  }
  options.browserWindow.width = options.browserWindow.width !== void 0 ? options.browserWindow.width : DEFAULT_WINDOW_WIDTH;
  options.browserWindow.height = options.browserWindow.height !== void 0 ? options.browserWindow.height : DEFAULT_WINDOW_HEIGHT;
  return options;
}
const isLinux = process.platform === "linux";
const trayToScreenRects = (tray) => {
  const { workArea, bounds: screenBounds } = screen.getDisplayMatching(tray.getBounds());
  workArea.x -= screenBounds.x;
  workArea.y -= screenBounds.y;
  return [screenBounds, workArea];
};
function taskbarLocation(tray) {
  const [screenBounds, workArea] = trayToScreenRects(tray);
  if (workArea.x > 0) {
    if (isLinux && workArea.y > 0)
      return "top";
    return "left";
  }
  if (workArea.y > 0) {
    return "top";
  }
  if (workArea.width < screenBounds.width) {
    return "right";
  }
  return "bottom";
}
function getWindowPosition(tray) {
  switch (process.platform) {
    case "darwin":
      return "trayCenter";
    case "linux":
    case "win32": {
      const traySide = taskbarLocation(tray);
      if (traySide === "top") {
        return isLinux ? "topRight" : "trayCenter";
      }
      if (traySide === "bottom") {
        return "bottomRight";
      }
      if (traySide === "left") {
        return "bottomLeft";
      }
      if (traySide === "right") {
        return "bottomRight";
      }
    }
  }
  return "topRight";
}
var __awaiter$5 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
class Menubar extends EventEmitter {
  constructor(app2, options) {
    super();
    this._blurTimeout = null;
    this._app = app2;
    this._options = cleanOptions(options);
    this._isVisible = false;
    if (app2.isReady()) {
      process.nextTick(() => this.appReady().catch((err) => console.error("menubar: ", err)));
    } else {
      app2.on("ready", () => {
        this.appReady().catch((err) => console.error("menubar: ", err));
      });
    }
  }
  get app() {
    return this._app;
  }
  get positioner() {
    if (!this._positioner) {
      throw new Error("Please access `this.positioner` after the `after-create-window` event has fired.");
    }
    return this._positioner;
  }
  get tray() {
    if (!this._tray) {
      throw new Error("Please access `this.tray` after the `ready` event has fired.");
    }
    return this._tray;
  }
  get window() {
    return this._browserWindow;
  }
  getOption(key) {
    return this._options[key];
  }
  hideWindow() {
    if (!this._browserWindow || !this._isVisible) {
      return;
    }
    this.emit("hide");
    this._browserWindow.hide();
    this.emit("after-hide");
    this._isVisible = false;
    if (this._blurTimeout) {
      clearTimeout(this._blurTimeout);
      this._blurTimeout = null;
    }
  }
  setOption(key, value) {
    this._options[key] = value;
  }
  showWindow(trayPos) {
    return __awaiter$5(this, void 0, void 0, function* () {
      if (!this.tray) {
        throw new Error("Tray should have been instantiated by now");
      }
      if (!this._browserWindow) {
        yield this.createWindow();
      }
      if (!this._browserWindow) {
        throw new Error("Window has been initialized just above. qed.");
      }
      if (["win32", "linux"].includes(process.platform)) {
        this._options.windowPosition = getWindowPosition(this.tray);
      }
      this.emit("show");
      if (trayPos && trayPos.x !== 0) {
        this._cachedBounds = trayPos;
      } else if (this._cachedBounds) {
        trayPos = this._cachedBounds;
      } else if (this.tray.getBounds) {
        trayPos = this.tray.getBounds();
      }
      let noBoundsPosition = void 0;
      if ((trayPos === void 0 || trayPos.x === 0) && this._options.windowPosition && this._options.windowPosition.startsWith("tray")) {
        noBoundsPosition = process.platform === "win32" ? "bottomRight" : "topRight";
      }
      const position = this.positioner.calculate(this._options.windowPosition || noBoundsPosition, trayPos);
      const x = this._options.browserWindow.x !== void 0 ? this._options.browserWindow.x : position.x;
      const y = this._options.browserWindow.y !== void 0 ? this._options.browserWindow.y : position.y;
      this._browserWindow.setPosition(Math.round(x), Math.round(y));
      this._browserWindow.show();
      this._isVisible = true;
      this.emit("after-show");
      return;
    });
  }
  appReady() {
    return __awaiter$5(this, void 0, void 0, function* () {
      if (this.app.dock && !this._options.showDockIcon) {
        this.app.dock.hide();
      }
      if (this._options.activateWithApp) {
        this.app.on("activate", (_event, hasVisibleWindows) => {
          if (!hasVisibleWindows) {
            this.showWindow().catch(console.error);
          }
        });
      }
      let trayImage = this._options.icon || path.join(this._options.dir, "IconTemplate.png");
      if (typeof trayImage === "string" && !fs.existsSync(trayImage)) {
        trayImage = path.join(__dirname, "..", "assets", "IconTemplate.png");
      }
      const defaultClickEvent = this._options.showOnRightClick ? "right-click" : "click";
      this._tray = this._options.tray || new Tray(trayImage);
      if (!this.tray) {
        throw new Error("Tray has been initialized above");
      }
      this.tray.on(defaultClickEvent, this.clicked.bind(this));
      this.tray.on("double-click", this.clicked.bind(this));
      this.tray.setToolTip(this._options.tooltip);
      if (!this._options.windowPosition) {
        this._options.windowPosition = getWindowPosition(this.tray);
      }
      if (this._options.preloadWindow) {
        yield this.createWindow();
      }
      this.emit("ready");
    });
  }
  clicked(event, bounds) {
    return __awaiter$5(this, void 0, void 0, function* () {
      if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        return this.hideWindow();
      }
      if (this._blurTimeout) {
        clearInterval(this._blurTimeout);
      }
      if (this._browserWindow && this._isVisible) {
        return this.hideWindow();
      }
      this._cachedBounds = bounds || this._cachedBounds;
      yield this.showWindow(this._cachedBounds);
    });
  }
  createWindow() {
    return __awaiter$5(this, void 0, void 0, function* () {
      this.emit("create-window");
      const defaults = {
        show: false,
        frame: false
      };
      this._browserWindow = new BrowserWindow(Object.assign(Object.assign({}, defaults), this._options.browserWindow));
      this._positioner = new Positioner(this._browserWindow);
      this._browserWindow.on("blur", () => {
        if (!this._browserWindow) {
          return;
        }
        if (this._browserWindow.isAlwaysOnTop()) {
          this.emit("focus-lost");
        } else {
          this._blurTimeout = setTimeout(() => {
            this.hideWindow();
          }, 100);
        }
      });
      if (this._options.showOnAllWorkspaces !== false) {
        this._browserWindow.setVisibleOnAllWorkspaces(true, {
          skipTransformProcessType: true
        });
      }
      this._browserWindow.on("close", this.windowClear.bind(this));
      this.emit("before-load");
      if (this._options.index !== false) {
        yield this._browserWindow.loadURL(this._options.index, this._options.loadUrlOptions);
      }
      this.emit("after-create-window");
    });
  }
  windowClear() {
    this._browserWindow = void 0;
    this.emit("after-close");
  }
}
function menubar(options) {
  return new Menubar(app, options);
}
const preloadPath = fileURLToPath(new URL("../../electron-plugin/dist/preload/index.mjs", import.meta.url));
const defaultWebPreferences = {
  spellcheck: false,
  nodeIntegration: false,
  backgroundThrottling: false
};
const requiredWebPreferences = {
  sandbox: false,
  preload: preloadPath,
  contextIsolation: true
};
function mergePreferences(userWebPreferences = {}) {
  return Object.assign(Object.assign(Object.assign({}, defaultWebPreferences), userWebPreferences), requiredWebPreferences);
}
const router$9 = express__default.Router();
router$9.post("/label", (req, res) => {
  var _a;
  res.sendStatus(200);
  const { label } = req.body;
  (_a = state.tray) === null || _a === void 0 ? void 0 : _a.setTitle(label);
});
router$9.post("/tooltip", (req, res) => {
  var _a;
  res.sendStatus(200);
  const { tooltip } = req.body;
  (_a = state.tray) === null || _a === void 0 ? void 0 : _a.setToolTip(tooltip);
});
router$9.post("/icon", (req, res) => {
  var _a;
  res.sendStatus(200);
  const { icon } = req.body;
  (_a = state.tray) === null || _a === void 0 ? void 0 : _a.setImage(icon);
});
router$9.post("/context-menu", (req, res) => {
  var _a;
  res.sendStatus(200);
  const { contextMenu: contextMenu2 } = req.body;
  (_a = state.tray) === null || _a === void 0 ? void 0 : _a.setContextMenu(buildMenu(contextMenu2));
});
router$9.post("/show-context-menu", (req, res) => {
  var _a;
  res.sendStatus(200);
  (_a = state.tray) === null || _a === void 0 ? void 0 : _a.popUpContextMenu();
});
router$9.post("/show", (req, res) => {
  res.sendStatus(200);
  state.activeMenuBar.showWindow();
});
router$9.post("/hide", (req, res) => {
  res.sendStatus(200);
  state.activeMenuBar.hideWindow();
});
router$9.post("/resize", (req, res) => {
  res.sendStatus(200);
  const { width, height } = req.body;
  state.activeMenuBar.window.setSize(width, height);
});
router$9.post("/create", (req, res) => {
  res.sendStatus(200);
  let shouldSendCreatedEvent = true;
  if (state.activeMenuBar) {
    state.activeMenuBar.tray.destroy();
    shouldSendCreatedEvent = false;
  }
  const { width, height, minWidth, minHeight, maxWidth, maxHeight, url: url2, label, alwaysOnTop, vibrancy, backgroundColor, transparency, icon, showDockIcon, onlyShowContextMenu, windowPosition, showOnAllWorkspaces, contextMenu: contextMenu2, tooltip, resizable, webPreferences } = req.body;
  if (onlyShowContextMenu) {
    const tray = new Tray(icon || state.icon.replace("icon.png", "IconTemplate.png"));
    tray.setContextMenu(buildMenu(contextMenu2));
    tray.setToolTip(tooltip);
    tray.setTitle(label);
    eventsForTray(tray, onlyShowContextMenu, contextMenu2, shouldSendCreatedEvent);
    state.tray = tray;
    if (!showDockIcon) {
      app.dock.hide();
    }
  } else {
    state.activeMenuBar = menubar({
      icon: icon || state.icon.replace("icon.png", "IconTemplate.png"),
      preloadWindow: true,
      tooltip,
      index: url2,
      showDockIcon,
      showOnAllWorkspaces: showOnAllWorkspaces !== null && showOnAllWorkspaces !== void 0 ? showOnAllWorkspaces : false,
      windowPosition: windowPosition !== null && windowPosition !== void 0 ? windowPosition : "trayCenter",
      activateWithApp: false,
      browserWindow: {
        width,
        height,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        resizable,
        alwaysOnTop,
        vibrancy,
        backgroundColor,
        transparent: transparency,
        visualEffectState: vibrancy ? "active" : void 0,
        webPreferences: mergePreferences(webPreferences)
      }
    });
    state.activeMenuBar.on("after-create-window", () => {
      enable(state.activeMenuBar.window.webContents);
    });
    state.activeMenuBar.on("ready", () => {
      eventsForTray(state.activeMenuBar.tray, onlyShowContextMenu, contextMenu2, shouldSendCreatedEvent);
      state.tray = state.activeMenuBar.tray;
      state.tray.setTitle(label);
      state.activeMenuBar.on("hide", () => {
        notifyLaravel("events", {
          event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarHidden"
        });
      });
      state.activeMenuBar.on("show", () => {
        notifyLaravel("events", {
          event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarShown"
        });
      });
    });
  }
});
function eventsForTray(tray, onlyShowContextMenu, contextMenu2, shouldSendCreatedEvent) {
  if (shouldSendCreatedEvent) {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarCreated"
    });
  }
  tray.on("drop-files", (event, files) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarDroppedFiles",
      payload: [files]
    });
  });
  tray.on("click", (combo, bounds, position) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarClicked",
      payload: {
        combo,
        bounds,
        position
      }
    });
  });
  tray.on("right-click", (combo, bounds) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarRightClicked",
      payload: {
        combo,
        bounds
      }
    });
    if (!onlyShowContextMenu) {
      state.activeMenuBar.hideWindow();
      tray.popUpContextMenu(buildMenu(contextMenu2));
    }
  });
  tray.on("double-click", (combo, bounds) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\MenuBar\\MenuBarDoubleClicked",
      payload: {
        combo,
        bounds
      }
    });
  });
}
function buildMenu(contextMenu2) {
  let menu = Menu.buildFromTemplate([{ role: "quit" }]);
  if (contextMenu2) {
    const menuEntries = contextMenu2.map(compileMenu);
    menu = Menu.buildFromTemplate(menuEntries);
  }
  return menu;
}
const isLocalFile = (sound) => {
  if (typeof sound !== "string")
    return false;
  if (/^https?:\/\//i.test(sound))
    return false;
  return sound.includes("/") || sound.includes("\\");
};
const router$8 = express__default.Router();
router$8.post("/", (req, res) => {
  const { title, body, subtitle, silent, icon, hasReply, timeoutType, replyPlaceholder, sound, urgency, actions, closeButtonText, toastXml, event: customEvent, reference } = req.body;
  const eventName = customEvent !== null && customEvent !== void 0 ? customEvent : "\\Native\\Desktop\\Events\\Notifications\\NotificationClicked";
  const notificationReference = reference !== null && reference !== void 0 ? reference : Date.now() + "." + Math.random().toString(36).slice(2, 9);
  const usingLocalFile = isLocalFile(sound);
  const notification = new Notification({
    title,
    body,
    subtitle,
    silent: usingLocalFile ? true : silent,
    icon,
    hasReply,
    timeoutType,
    replyPlaceholder,
    sound: usingLocalFile ? void 0 : sound,
    urgency,
    actions,
    closeButtonText,
    toastXml
  });
  if (usingLocalFile && !silent) {
    fs.access(sound, fs.constants.F_OK, (err) => {
      if (err) {
        broadcastToWindows("log", {
          level: "error",
          message: `Sound file not found: ${sound}`,
          context: { sound }
        });
        return;
      }
      playSoundLib().play(sound, () => {
      });
    });
  }
  notification.on("click", (event) => {
    delete state.notifications[notificationReference];
    notifyLaravel("events", {
      event: eventName || "\\Native\\Desktop\\Events\\Notifications\\NotificationClicked",
      payload: {
        reference: notificationReference,
        event: JSON.stringify(event)
      }
    });
  });
  notification.on("action", (event, index) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\Notifications\\NotificationActionClicked",
      payload: {
        reference: notificationReference,
        index,
        event: JSON.stringify(event)
      }
    });
  });
  notification.on("reply", (event, reply) => {
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\Notifications\\NotificationReply",
      payload: {
        reference: notificationReference,
        reply,
        event: JSON.stringify(event)
      }
    });
  });
  notification.on("close", (event) => {
    delete state.notifications[notificationReference];
    notifyLaravel("events", {
      event: "\\Native\\Desktop\\Events\\Notifications\\NotificationClosed",
      payload: {
        reference: notificationReference,
        event: JSON.stringify(event)
      }
    });
  });
  state.notifications[notificationReference] = notification;
  notification.show();
  res.status(200).json({
    reference: notificationReference
  });
});
const router$7 = express__default.Router();
router$7.get("/get-system-idle-state", (req, res) => {
  const threshold = Number(req.query.threshold) || 60;
  res.json({
    result: powerMonitor.getSystemIdleState(threshold)
  });
});
router$7.get("/get-system-idle-time", (req, res) => {
  res.json({
    result: powerMonitor.getSystemIdleTime()
  });
});
router$7.get("/get-current-thermal-state", (req, res) => {
  res.json({
    result: powerMonitor.getCurrentThermalState()
  });
});
router$7.get("/is-on-battery-power", (req, res) => {
  res.json({
    result: powerMonitor.isOnBatteryPower()
  });
});
powerMonitor.addListener("on-ac", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\PowerStateChanged`,
    payload: {
      state: "on-ac"
    }
  });
});
powerMonitor.addListener("on-battery", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\PowerStateChanged`,
    payload: {
      state: "on-battery"
    }
  });
});
powerMonitor.addListener("thermal-state-change", (details) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\ThermalStateChanged`,
    payload: {
      state: details.state
    }
  });
});
powerMonitor.addListener("speed-limit-change", (details) => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\SpeedLimitChanged`,
    payload: {
      limit: details.limit
    }
  });
});
powerMonitor.addListener("lock-screen", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\ScreenLocked`
  });
});
powerMonitor.addListener("unlock-screen", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\ScreenUnlocked`
  });
});
powerMonitor.addListener("shutdown", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\Shutdown`
  });
});
powerMonitor.addListener("user-did-become-active", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\UserDidBecomeActive`
  });
});
powerMonitor.addListener("user-did-resign-active", () => {
  notifyLaravel("events", {
    event: `\\Native\\Desktop\\Events\\PowerMonitor\\UserDidResignActive`
  });
});
const router$6 = express__default.Router();
router$6.get("/", (req, res) => {
  res.json({
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime()
  });
});
const router$5 = express__default.Router();
router$5.post("/update", (req, res) => {
  const { percent } = req.body;
  Object.values(state.windows).forEach((window) => {
    window.setProgressBar(percent);
  });
  res.sendStatus(200);
});
const router$4 = express__default.Router();
router$4.get("/displays", (req, res) => {
  res.json({
    displays: screen.getAllDisplays()
  });
});
router$4.get("/primary-display", (req, res) => {
  res.json({
    primaryDisplay: screen.getPrimaryDisplay()
  });
});
router$4.get("/cursor-position", (req, res) => {
  res.json(screen.getCursorScreenPoint());
});
router$4.get("/active", (req, res) => {
  const cursor = screen.getCursorScreenPoint();
  res.json(screen.getDisplayNearestPoint(cursor));
});
const router$3 = express__default.Router();
router$3.get("/:key", (req, res) => {
  const key = req.params.key;
  const value = state.store.get(key, null);
  res.json({ value });
});
router$3.post("/:key", (req, res) => {
  const key = req.params.key;
  const value = req.body.value;
  state.store.set(key, value);
  res.sendStatus(200);
});
router$3.delete("/:key", (req, res) => {
  const key = req.params.key;
  state.store.delete(key);
  res.sendStatus(200);
});
router$3.delete("/", (req, res) => {
  state.store.clear();
  res.sendStatus(200);
});
var __awaiter$4 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
const router$2 = express__default.Router();
router$2.post("/show-item-in-folder", (req, res) => {
  const { path: path2 } = req.body;
  shell.showItemInFolder(path2);
  res.sendStatus(200);
});
router$2.post("/open-item", (req, res) => __awaiter$4(void 0, void 0, void 0, function* () {
  const { path: path2 } = req.body;
  const result = yield shell.openPath(path2);
  res.json({
    result
  });
}));
router$2.post("/open-external", (req, res) => __awaiter$4(void 0, void 0, void 0, function* () {
  const { url: url2 } = req.body;
  try {
    yield shell.openExternal(url2);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({
      error: e
    });
  }
}));
router$2.delete("/trash-item", (req, res) => __awaiter$4(void 0, void 0, void 0, function* () {
  const { path: path2 } = req.body;
  try {
    yield shell.trashItem(path2);
    res.sendStatus(200);
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : String(e)
    });
  }
}));
const mediaBox = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/;
function parsePdfPageSizePoints(buffer) {
  const match = buffer.toString("latin1").match(mediaBox);
  if (!match) {
    return null;
  }
  const x0 = parseFloat(match[1]);
  const y0 = parseFloat(match[2]);
  const x1 = parseFloat(match[3]);
  const y1 = parseFloat(match[4]);
  const widthPt = Math.abs(x1 - x0);
  const heightPt = Math.abs(y1 - y0);
  if (!(widthPt > 0) || !(heightPt > 0)) {
    return null;
  }
  return { widthPt, heightPt };
}
function pointsToMicrons(points) {
  return Math.round(points / 72 * 25400);
}
function toPrintPageSize({ widthPt, heightPt }) {
  return {
    pageSize: {
      width: pointsToMicrons(widthPt),
      height: pointsToMicrons(heightPt)
    },
    landscape: widthPt > heightPt
  };
}
function buildNativePrintOptions(deviceName, page) {
  const { pageSize, landscape } = toPrintPageSize(page);
  return {
    silent: true,
    deviceName,
    color: false,
    landscape,
    pageSize,
    margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 }
  };
}
var __awaiter$3 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
const router$1 = express__default.Router();
router$1.get("/can-prompt-touch-id", (req, res) => {
  res.json({
    result: systemPreferences.canPromptTouchID()
  });
});
router$1.post("/prompt-touch-id", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  try {
    yield systemPreferences.promptTouchID(req.body.reason);
    res.sendStatus(200);
  } catch (e) {
    res.status(400).json({
      error: e.message
    });
  }
}));
router$1.get("/can-encrypt", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  res.json({
    result: yield safeStorage.isEncryptionAvailable()
  });
}));
router$1.post("/encrypt", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  try {
    res.json({
      result: yield safeStorage.encryptString(req.body.string).toString("base64")
    });
  } catch (e) {
    res.status(400).json({
      error: e.message
    });
  }
}));
router$1.post("/decrypt", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  try {
    res.json({
      result: yield safeStorage.decryptString(Buffer.from(req.body.string, "base64"))
    });
  } catch (e) {
    res.status(400).json({
      error: e.message
    });
  }
}));
router$1.get("/printers", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  const printers = yield BrowserWindow.getAllWindows()[0].webContents.getPrintersAsync();
  res.json({
    printers
  });
}));
router$1.post("/print", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  const { printer, html, settings } = req.body;
  let printWindow = new BrowserWindow({
    show: false
  });
  const defaultSettings = {
    silent: true,
    deviceName: printer
  };
  const mergedSettings = Object.assign(Object.assign({}, defaultSettings), settings && typeof settings === "object" ? settings : {});
  printWindow.webContents.on("did-finish-load", () => {
    printWindow.webContents.print(mergedSettings, (success, errorType) => {
      if (success) {
        console.log("Print job completed successfully.");
        res.sendStatus(200);
      } else {
        console.error("Print job failed:", errorType);
        res.sendStatus(500);
      }
      if (printWindow) {
        printWindow.close();
        printWindow = null;
      }
    });
  });
  yield printWindow.loadURL(`data:text/html;charset=UTF-8,${html}`);
}));
router$1.post("/print-file", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  const { path: filePath, printer, settings } = req.body;
  let pagePoints = null;
  try {
    pagePoints = parsePdfPageSizePoints(readFileSync$1(filePath));
  } catch (e) {
    console.error("Native print: failed to read PDF:", e.message);
    res.status(500).json({ error: e.message });
    return;
  }
  if (!pagePoints) {
    const message = "could not determine PDF page size (no MediaBox)";
    console.error("Native print:", message, filePath);
    res.status(500).json({ error: message });
    return;
  }
  const renderDelay = 1500;
  const options = Object.assign(Object.assign({}, buildNativePrintOptions(printer, pagePoints)), settings && typeof settings === "object" ? settings : {});
  let printWindow = new BrowserWindow({
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      plugins: true
    }
  });
  let responded = false;
  const respond = (statusCode, error) => {
    if (responded) {
      return;
    }
    responded = true;
    if (error) {
      res.status(statusCode).json({ error });
    } else {
      res.sendStatus(statusCode);
    }
    if (printWindow) {
      printWindow.close();
      printWindow = null;
    }
  };
  printWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      if (!printWindow) {
        return;
      }
      printWindow.webContents.print(options, (success, errorType) => {
        if (success) {
          respond(200);
        } else {
          console.error("Native print job failed:", errorType);
          respond(500, errorType);
        }
      });
    }, renderDelay);
  });
  printWindow.webContents.on("did-fail-load", (_event, _errorCode, errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame) {
      return;
    }
    console.error("Native print: failed to load PDF:", errorDescription);
    respond(500, errorDescription);
  });
  printWindow.loadFile(filePath).catch((e) => {
    respond(500, e.message);
  });
}));
router$1.post("/print-to-pdf", (req, res) => __awaiter$3(void 0, void 0, void 0, function* () {
  const { html, settings } = req.body;
  const printWindow = new BrowserWindow({
    show: false
  });
  printWindow.webContents.on("did-finish-load", () => {
    printWindow.webContents.printToPDF(settings !== null && settings !== void 0 ? settings : {}).then((data) => {
      printWindow.close();
      res.json({
        result: data.toString("base64")
      });
    }).catch((e) => {
      printWindow.close();
      res.status(400).json({
        error: e.message
      });
    });
  });
  yield printWindow.loadURL(`data:text/html;base64;charset=UTF-8,${html}`);
}));
router$1.get("/theme", (req, res) => {
  res.json({
    result: nativeTheme.themeSource
  });
});
router$1.post("/theme", (req, res) => {
  const { theme } = req.body;
  nativeTheme.themeSource = theme;
  res.json({
    result: theme
  });
});
const router = express__default.Router();
const DEFAULT_ZOOM_FACTOR = 1;
function parseZoomFactor(zoomFactor) {
  const zoom = parseFloat(zoomFactor);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_ZOOM_FACTOR;
}
router.post("/maximize", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.maximize();
  res.sendStatus(200);
});
router.post("/unmaximize", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.unmaximize();
  res.sendStatus(200);
});
router.post("/minimize", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.minimize();
  res.sendStatus(200);
});
router.post("/resize", (req, res) => {
  var _a;
  const { id, width, height } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setSize(parseInt(width), parseInt(height));
  res.sendStatus(200);
});
router.post("/title", (req, res) => {
  var _a;
  const { id, title } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setTitle(title);
  res.sendStatus(200);
});
router.post("/url", (req, res) => {
  const { id, url: url2 } = req.body;
  goToUrl(url2, id);
  res.sendStatus(200);
});
router.post("/closable", (req, res) => {
  var _a;
  const { id, closable } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setClosable(closable);
  res.sendStatus(200);
});
router.post("/window-button-visibility", (req, res) => {
  var _a;
  const { id, windowButtonVisibility } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setWindowButtonVisibility(windowButtonVisibility);
  res.sendStatus(200);
});
router.post("/show-dev-tools", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.webContents.openDevTools();
  res.sendStatus(200);
});
router.post("/hide-dev-tools", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.webContents.closeDevTools();
  res.sendStatus(200);
});
router.post("/set-zoom-factor", (req, res) => {
  var _a;
  const { id, zoomFactor } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.webContents.setZoomFactor(parseZoomFactor(zoomFactor));
  res.sendStatus(200);
});
router.post("/position", (req, res) => {
  var _a;
  const { id, x, y, animate } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setPosition(parseInt(x), parseInt(y), animate);
  res.sendStatus(200);
});
router.post("/reload", (req, res) => {
  var _a;
  const { id } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.reload();
  res.sendStatus(200);
});
router.post("/close", (req, res) => {
  const { id } = req.body;
  if (state.windows[id]) {
    state.windows[id].close();
    delete state.windows[id];
  }
  res.sendStatus(200);
});
router.post("/hide", (req, res) => {
  const { id } = req.body;
  if (state.windows[id]) {
    state.windows[id].hide();
  }
  res.sendStatus(200);
});
router.post("/show", (req, res) => {
  const { id } = req.body;
  if (state.windows[id]) {
    state.windows[id].show();
  }
  res.sendStatus(200);
});
router.post("/always-on-top", (req, res) => {
  var _a;
  const { id, alwaysOnTop } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setAlwaysOnTop(alwaysOnTop);
  res.sendStatus(200);
});
router.post("/fullscreen", (req, res) => {
  var _a;
  const { id, fullscreen } = req.body;
  (_a = state.windows[id]) === null || _a === void 0 ? void 0 : _a.setFullScreen(fullscreen);
  res.sendStatus(200);
});
router.get("/current", (req, res) => {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused) {
    res.sendStatus(404);
    return;
  }
  const currentWindow = Object.values(state.windows).find((window) => window.id === focused.id);
  const id = Object.keys(state.windows).find((key) => state.windows[key] === currentWindow);
  res.json(getWindowData(id));
});
router.get("/all", (req, res) => {
  res.json(Object.keys(state.windows).map((id) => getWindowData(id)));
});
router.get("/get/:id", (req, res) => {
  const { id } = req.params;
  if (state.windows[id] === void 0) {
    res.sendStatus(404);
    return;
  }
  res.json(getWindowData(id));
});
function getWindowData(id) {
  const currentWindow = state.windows[id];
  if (state.windows[id] === void 0) {
    throw `Window [${id}] not found`;
  }
  return {
    id,
    x: currentWindow.getPosition()[0],
    y: currentWindow.getPosition()[1],
    width: currentWindow.getSize()[0],
    height: currentWindow.getSize()[1],
    title: currentWindow.getTitle(),
    alwaysOnTop: currentWindow.isAlwaysOnTop(),
    url: currentWindow.webContents.getURL(),
    autoHideMenuBar: currentWindow.isMenuBarAutoHide(),
    fullscreen: currentWindow.isFullScreen(),
    fullscreenable: currentWindow.isFullScreenable(),
    kiosk: currentWindow.isKiosk(),
    devToolsOpen: currentWindow.webContents.isDevToolsOpened(),
    resizable: currentWindow.isResizable(),
    movable: currentWindow.isMovable(),
    minimizable: currentWindow.isMinimizable(),
    maximizable: currentWindow.isMaximizable(),
    closable: currentWindow.isClosable(),
    focusable: currentWindow.isFocusable(),
    focused: currentWindow.isFocused(),
    hasShadow: currentWindow.hasShadow()
  };
}
router.post("/open", (req, res) => {
  const { id, x, y, frame, width, height, minWidth, minHeight, maxWidth, maxHeight, focusable, skipTaskbar, hiddenInMissionControl, hasShadow, resizable, movable, minimizable, maximizable, closable, title, alwaysOnTop, titleBarStyle, trafficLightPosition, windowButtonVisibility, vibrancy, backgroundColor, transparency, showDevTools, fullscreen, fullscreenable, kiosk, autoHideMenuBar, webPreferences, zoomFactor, preventLeaveDomain, preventLeavePage, suppressNewWindows } = req.body;
  if (state.windows[id]) {
    state.windows[id].show();
    state.windows[id].focus();
    res.sendStatus(200);
    return;
  }
  let windowState = void 0;
  if (req.body.rememberState === true) {
    windowState = windowStateKeeper({
      file: `window-state-${id}.json`,
      defaultHeight: parseInt(height),
      defaultWidth: parseInt(width)
    });
  }
  const window = new BrowserWindow(Object.assign(Object.assign({
    width: resizable ? (windowState === null || windowState === void 0 ? void 0 : windowState.width) || parseInt(width) : parseInt(width),
    height: resizable ? (windowState === null || windowState === void 0 ? void 0 : windowState.height) || parseInt(height) : parseInt(height),
    frame: frame !== void 0 ? frame : true,
    x: (windowState === null || windowState === void 0 ? void 0 : windowState.x) || x,
    y: (windowState === null || windowState === void 0 ? void 0 : windowState.y) || y,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    show: false,
    title,
    backgroundColor,
    transparent: transparency,
    alwaysOnTop,
    resizable,
    movable,
    minimizable,
    maximizable,
    closable,
    hasShadow,
    titleBarStyle,
    trafficLightPosition,
    vibrancy,
    focusable,
    skipTaskbar,
    hiddenInMissionControl,
    autoHideMenuBar
  }, process.platform === "linux" ? { icon: state.icon } : {}), {
    webPreferences: mergePreferences(webPreferences),
    fullscreen,
    fullscreenable,
    kiosk
  }));
  if ((process.env.NODE_ENV === "development" || showDevTools === true) && showDevTools !== false) {
    window.webContents.openDevTools();
  }
  enable(window.webContents);
  if (req.body.rememberState === true) {
    windowState === null || windowState === void 0 ? void 0 : windowState.manage(window);
  }
  if (suppressNewWindows) {
    window.webContents.setWindowOpenHandler(() => {
      return { action: "deny" };
    });
  }
  if (process.platform === "darwin") {
    window.setWindowButtonVisibility(windowButtonVisibility);
  }
  window.on("blur", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowBlurred",
      payload: [id]
    });
  });
  window.on("focus", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowFocused",
      payload: [id]
    });
  });
  window.on("minimize", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowMinimized",
      payload: [id]
    });
  });
  window.on("maximize", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowMaximized",
      payload: [id]
    });
  });
  window.on("unmaximize", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowUnmaximized",
      payload: [id]
    });
  });
  window.on("enter-full-screen", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowFullscreened",
      payload: [id]
    });
  });
  window.on("leave-full-screen", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowUnfullscreened",
      payload: [id]
    });
  });
  window.on("show", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowShown",
      payload: [id]
    });
  });
  window.on("resized", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowResized",
      payload: [id, window.getSize()[0], window.getSize()[1]]
    });
  });
  window.on("page-title-updated", (evt) => {
    evt.preventDefault();
  });
  window.on("close", () => {
    if (state.windows[id]) {
      delete state.windows[id];
    }
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowClosed",
      payload: [id]
    });
  });
  window.on("hide", () => {
    notifyLaravel("events", {
      event: "Native\\Desktop\\Events\\Windows\\WindowHidden",
      payload: [id]
    });
  });
  const url2 = appendWindowIdToUrl(req.body.url, id);
  window.loadURL(url2);
  window.webContents.on("dom-ready", () => {
    window.webContents.setZoomFactor(parseZoomFactor(zoomFactor));
  });
  if (preventLeaveDomain || preventLeavePage) {
    window.webContents.on("will-navigate", (event, target) => {
      const origUrl = new URL(url2);
      const targetUrl = new URL(target);
      if (preventLeaveDomain && targetUrl.hostname !== origUrl.hostname) {
        event.preventDefault();
      }
      if (preventLeavePage && (targetUrl.origin !== origUrl.origin || targetUrl.pathname !== origUrl.pathname)) {
        event.preventDefault();
      }
    });
  }
  window.webContents.on("did-finish-load", () => {
    if (state.noFocusOnRestart && window.isVisible()) {
      return;
    }
    window.show();
  });
  window.webContents.on("did-fail-load", (event) => {
    console.error("failed to open window...", event);
  });
  state.windows[id] = window;
  res.sendStatus(200);
});
var __awaiter$2 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, [])).next());
  });
};
const API_HOST = "127.0.0.1";
function startAPIServer(randomSecret) {
  return __awaiter$2(this, void 0, void 0, function* () {
    const port = yield getPort({
      host: API_HOST,
      port: portNumbers(4e3, 5e3)
    });
    return new Promise((resolve2) => {
      const httpServer = express__default();
      httpServer.use(middleware(randomSecret));
      httpServer.use(bodyParser.json());
      httpServer.use("/api/clipboard", router$g);
      httpServer.use("/api/alert", router$k);
      httpServer.use("/api/app", router$j);
      httpServer.use("/api/auto-updater", router$i);
      httpServer.use("/api/screen", router$4);
      httpServer.use("/api/dialog", router$d);
      httpServer.use("/api/system", router$1);
      httpServer.use("/api/global-shortcuts", router$b);
      httpServer.use("/api/notification", router$8);
      httpServer.use("/api/dock", router$c);
      httpServer.use("/api/menu", router$a);
      httpServer.use("/api/window", router);
      httpServer.use("/api/process", router$6);
      httpServer.use("/api/settings", router$3);
      httpServer.use("/api/shell", router$2);
      httpServer.use("/api/context", router$f);
      httpServer.use("/api/menu-bar", router$9);
      httpServer.use("/api/progress-bar", router$5);
      httpServer.use("/api/power-monitor", router$7);
      httpServer.use("/api/child-process", router$l);
      httpServer.use("/api/broadcast", router$h);
      if (process.env.NODE_ENV === "development") {
        httpServer.use("/api/debug", router$e);
      }
      const server = httpServer.listen(port, API_HOST, () => {
        resolve2({
          server,
          port
        });
      });
    });
  });
}
var __awaiter$1 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
let schedulerProcess = null;
function startPhpApp() {
  return __awaiter$1(this, void 0, void 0, function* () {
    const result = yield serveApp(state.randomSecret, state.electronApiPort, state.phpIni);
    state.phpPort = result.port;
    yield appendCookie();
    return result.process;
  });
}
function runScheduler() {
  killScheduler();
  schedulerProcess = startScheduler(state.randomSecret, state.electronApiPort, state.phpIni);
}
function killScheduler() {
  if (schedulerProcess && !schedulerProcess.killed) {
    schedulerProcess.kill();
    schedulerProcess = null;
  }
}
function startAPI() {
  return startAPIServer(state.randomSecret);
}
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve2) {
      resolve2(value);
    });
  }
  return new (P || (P = Promise))(function(resolve2, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, [])).next());
  });
};
const { autoUpdater } = electronUpdater;
class NativePHP {
  constructor() {
    this.processes = [];
    this.mainWindow = null;
    this.schedulerInterval = void 0;
    this.quitting = false;
  }
  bootstrap(app2, icon, phpBinary2, cert, appPath2) {
    initialize();
    state.icon = icon;
    state.php = phpBinary2;
    state.caCert = cert;
    state.appPath = appPath2;
    this.bootstrapApp(app2);
    this.addEventListeners(app2);
  }
  addEventListeners(app2) {
    app2.on("open-url", (event, url2) => {
      notifyLaravel("events", {
        event: "\\Native\\Desktop\\Events\\App\\OpenedFromURL",
        payload: [url2]
      });
    });
    app2.on("open-file", (event, path2) => {
      notifyLaravel("events", {
        event: "\\Native\\Desktop\\Events\\App\\OpenFile",
        payload: [path2]
      });
    });
    app2.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app2.quit();
      }
    });
    app2.on("before-quit", (event) => __awaiter(this, void 0, void 0, function* () {
      if (this.quitting) {
        return;
      }
      this.quitting = true;
      event.preventDefault();
      this.killChildProcesses();
      stopAllProcesses();
      const deadline = Date.now() + 12e3;
      while (Object.keys(state.processes).length > 0 && Date.now() < deadline) {
        yield new Promise((resolve2) => setTimeout(resolve2, 200));
      }
      app2.quit();
    }));
    app2.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });
    app2.on("activate", function(event, hasVisibleWindows) {
      if (!hasVisibleWindows) {
        notifyLaravel("booted");
      }
      event.preventDefault();
    });
  }
  bootstrapApp(app2) {
    return __awaiter(this, void 0, void 0, function* () {
      yield app2.whenReady();
      const config = yield this.loadConfig();
      this.setDockIcon();
      this.setAppUserModelId(config);
      this.setDeepLinkHandler(config);
      this.startAutoUpdater(config);
      yield this.startElectronApi();
      state.phpIni = yield this.loadPhpIni();
      yield this.startPhpApp();
      this.startScheduler();
      powerMonitor.on("suspend", () => {
        this.stopScheduler();
      });
      powerMonitor.on("resume", () => {
        this.stopScheduler();
        this.startScheduler();
      });
      const filter = {
        urls: [`http://127.0.0.1:${state.phpPort}/*`]
      };
      session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        details.requestHeaders["X-NativePHP-Secret"] = state.randomSecret;
        callback({ requestHeaders: details.requestHeaders });
      });
      if (process.env.NATIVEPHP_NO_FOCUS) {
        state.noFocusOnRestart = true;
      }
      yield notifyLaravel("booted");
    });
  }
  loadConfig() {
    return __awaiter(this, void 0, void 0, function* () {
      let config = {};
      try {
        const result = yield retrieveNativePHPConfig();
        config = JSON.parse(result.stdout);
      } catch (error) {
        console.error(error);
      }
      return config;
    });
  }
  setDockIcon() {
    if (process.platform === "darwin" && process.env.NODE_ENV === "development") {
      app.dock.setIcon(state.icon);
    }
  }
  setAppUserModelId(config) {
    electronApp.setAppUserModelId(config === null || config === void 0 ? void 0 : config.app_id);
  }
  setDeepLinkHandler(config) {
    const deepLinkProtocol = config === null || config === void 0 ? void 0 : config.deeplink_scheme;
    if (deepLinkProtocol) {
      if (process.defaultApp) {
        if (process.argv.length >= 2) {
          app.setAsDefaultProtocolClient(deepLinkProtocol, process.execPath, [resolve(process.argv[1])]);
        }
      } else {
        app.setAsDefaultProtocolClient(deepLinkProtocol);
      }
      if (process.platform !== "darwin") {
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
          app.quit();
          return;
        } else {
          app.on("second-instance", (event, commandLine) => {
            if (this.mainWindow) {
              if (this.mainWindow.isMinimized())
                this.mainWindow.restore();
              this.mainWindow.focus();
            }
            notifyLaravel("events", {
              event: "\\Native\\Desktop\\Events\\App\\OpenedFromURL",
              payload: {
                url: commandLine[commandLine.length - 1]
              }
            });
          });
        }
      }
    }
  }
  startAutoUpdater(config) {
    var _a, _b, _c, _d, _e;
    if (((_a = config === null || config === void 0 ? void 0 : config.updater) === null || _a === void 0 ? void 0 : _a.enabled) === true) {
      const defaultProvider = (_b = config === null || config === void 0 ? void 0 : config.updater) === null || _b === void 0 ? void 0 : _b.default;
      const publicUrl = (_e = (_d = (_c = config === null || config === void 0 ? void 0 : config.updater) === null || _c === void 0 ? void 0 : _c.providers) === null || _d === void 0 ? void 0 : _d[defaultProvider]) === null || _e === void 0 ? void 0 : _e.public_url;
      if (publicUrl) {
        autoUpdater.setFeedURL({
          provider: "generic",
          url: publicUrl
        });
      }
      autoUpdater.checkForUpdatesAndNotify();
    }
  }
  startElectronApi() {
    return __awaiter(this, void 0, void 0, function* () {
      const electronApi = yield startAPI();
      state.electronApiPort = electronApi.port;
      console.log("Electron API server started on port", electronApi.port);
    });
  }
  loadPhpIni() {
    return __awaiter(this, void 0, void 0, function* () {
      let config = {};
      try {
        const result = yield retrievePhpIniSettings();
        config = JSON.parse(result.stdout);
      } catch (error) {
        console.error(error);
      }
      return config;
    });
  }
  startPhpApp() {
    return __awaiter(this, void 0, void 0, function* () {
      this.processes.push(yield startPhpApp());
    });
  }
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    killScheduler();
  }
  startScheduler() {
    const now = /* @__PURE__ */ new Date();
    const delay = (60 - now.getSeconds()) * 1e3 + (1e3 - now.getMilliseconds());
    setTimeout(() => {
      console.log("Running scheduler...");
      runScheduler();
      this.schedulerInterval = setInterval(() => {
        console.log("Running scheduler...");
        runScheduler();
      }, 60 * 1e3);
    }, delay);
  }
  killChildProcesses() {
    this.stopScheduler();
    this.processes.filter((p) => p !== void 0).forEach((process2) => {
      if (!process2 || !process2.pid)
        return;
      if (process2.killed && process2.exitCode !== null)
        return;
      try {
        killSync(process2.pid, "SIGTERM", true);
        ps.kill(process2.pid);
      } catch (err) {
        console.error(err);
      }
    });
  }
}
const NativePHP$1 = new NativePHP();
function getLaravelBaseDir(appPath2, importMetaDirname) {
  if (app.isPackaged) {
    return appPath2;
  }
  let currentPath = importMetaDirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentPath, ".env"))) {
      return currentPath;
    }
    const parentPath = path.join(currentPath, "..");
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }
  return process.cwd();
}
function getEnvConfig(baseDir, key, defaultValue = null) {
  if (!baseDir) return defaultValue;
  const envPath = path.join(baseDir, ".env");
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [lineKey, ...valueParts] = trimmed.split("=");
        if (lineKey.trim() === key) {
          return valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch (e) {
  }
  return defaultValue;
}
function createSplash(appPath2, importMetaDirname) {
  const baseDir = getLaravelBaseDir(appPath2, importMetaDirname);
  const enabled = getEnvConfig(baseDir, "NATIVEPHP_SPLASH_ENABLED", "false") === "true";
  if (!enabled) return null;
  const width = parseInt(getEnvConfig(baseDir, "NATIVEPHP_SPLASH_WIDTH", "400"));
  const height = parseInt(getEnvConfig(baseDir, "NATIVEPHP_SPLASH_HEIGHT", "300"));
  const splashRelativePath = getEnvConfig(baseDir, "NATIVEPHP_SPLASH_HTML", "public/splash.html");
  const splash = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false }
  });
  const finalHtmlPath = path.join(baseDir, splashRelativePath);
  if (fs.existsSync(finalHtmlPath)) {
    splash.loadURL("file:///" + finalHtmlPath.replace(/\\/g, "/"));
  } else {
    console.error(`[NativePHP Splash] HTML Not Found. Path: ${finalHtmlPath}`);
  }
  return splash;
}
fixPath();
function findAppRoot() {
  if (process.env.APP_PATH && fs.existsSync(process.env.APP_PATH)) return process.env.APP_PATH;
  let curr = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, "artisan"))) {
      return curr;
    }
    curr = path.join(curr, "..");
  }
  return process.cwd();
}
const appRoot = findAppRoot();
process.env.APP_PATH = appRoot;
const buildPath = path.resolve(import.meta.dirname, "../../../build") || process.env.NATIVEPHP_BUILD_PATH || path.join(appRoot, "vendor", "nativephp", "desktop", "resources", "build");
process.env.NATIVEPHP_BUILD_PATH = buildPath;
const defaultIcon = path.join(buildPath, "icon.png");
const certificate = path.join(buildPath, "cacert.pem");
const executable = process.platform === "win32" ? "php.exe" : "php";
const phpBinary = path.join(buildPath, "php", executable);
const appPath = app.isPackaged ? path.join(buildPath, "app") : appRoot;
let splashWindow;
app.whenReady().then(() => {
  try {
    splashWindow = createSplash(appPath, import.meta.dirname);
  } catch (error) {
    console.error("Error creating splash screen:", error);
  }
  NativePHP$1.bootstrap(app, defaultIcon, phpBinary, certificate, appPath);
});
app.on("browser-window-created", (event, window) => {
  if (splashWindow && window !== splashWindow) {
    window.webContents.on("did-navigate", (evt, url2) => {
      if (url2.startsWith("http://127.0.0.1") || url2.startsWith("http://localhost")) {
        if (splashWindow) {
          splashWindow.close();
          splashWindow = null;
        }
      }
    });
  }
});
