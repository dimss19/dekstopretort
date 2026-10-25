import NativePHP from '#plugin';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createSplash } from './splash.js';
// Inherit User's PATH in Process & ChildProcess
import fixPath from 'fix-path';
fixPath();

import fs from 'fs';

function findAppRoot() {
    if (process.env.APP_PATH && fs.existsSync(process.env.APP_PATH)) return process.env.APP_PATH;
    let curr = import.meta.dirname;
    for (let i = 0; i < 6; i++) {
        if (fs.existsSync(path.join(curr, 'artisan'))) {
            return curr;
        }
        curr = path.join(curr, '..');
    }
    return process.cwd();
}

const appRoot = findAppRoot();

const buildPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build')
    : (import.meta.env?.MAIN_VITE_NATIVEPHP_BUILD_PATH ? path.resolve(import.meta.dirname, import.meta.env.MAIN_VITE_NATIVEPHP_BUILD_PATH) : null)
        || process.env.NATIVEPHP_BUILD_PATH
        || path.join(appRoot, 'vendor', 'nativephp', 'desktop', 'resources', 'build');

process.env.NATIVEPHP_BUILD_PATH = buildPath;

const appPath = app.isPackaged ? path.join(buildPath, 'app') : appRoot;
process.env.APP_PATH = appPath;

const defaultIcon = path.join(buildPath, 'icon.png');
const certificate = path.join(buildPath, 'cacert.pem');

const executable = process.platform === 'win32' ? 'php.exe' : 'php';
const phpBinary = path.join(buildPath, 'php', executable);

// Ensure executable permissions on Unix (macOS / Linux)
if (process.platform !== 'win32' && fs.existsSync(phpBinary)) {
    try {
        fs.chmodSync(phpBinary, 0o755);
    } catch {
        // Ignore read-only filesystem errors (e.g. read-only DMG mount)
    }
}

let splashWindow;

app.whenReady().then(() => {
    try {
        splashWindow = createSplash(appPath, import.meta.dirname);
    } catch (error) {
        console.error('Error creating splash screen:', error);
    }

    NativePHP.bootstrap(app, defaultIcon, phpBinary, certificate, appPath);
});

app.on('browser-window-created', (event, window) => {
    if (splashWindow && window !== splashWindow) {
        window.webContents.on('did-navigate', (evt, url) => {
            if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
                if (splashWindow) {
                    splashWindow.close();
                    splashWindow = null;
                }
            }
        });
    }
});
