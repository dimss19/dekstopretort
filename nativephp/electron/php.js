import fs from 'fs';
import fs_extra from 'fs-extra';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import unzip from 'yauzl';
const { removeSync, ensureDirSync } = fs_extra;

const isBuilding = Boolean(process.env.NATIVEPHP_BUILDING);
const appRoot = process.env.APP_PATH || join(import.meta.dirname, '..', '..');
const phpBinaryPath = process.env.NATIVEPHP_PHP_BINARY_PATH || join(appRoot, 'vendor', 'nativephp', 'php-bin', 'bin');
const phpVersion = process.env.NATIVEPHP_PHP_BINARY_VERSION || '8.3';

// Differentiates for Serving and Building
const isArm64 = isBuilding ? process.argv.includes('--arm64') : process.arch.includes('arm64');
const isWindows = isBuilding ? process.argv.includes('--win') : process.platform.includes('win32');
const isLinux = isBuilding ? process.argv.includes('--linux') : process.platform.includes('linux');
const isDarwin = isBuilding ? process.argv.includes('--mac') : process.platform.includes('darwin');

// false because string mapping is done in is{OS} checks
const platform = {
    os: false,
    arch: false,
    phpBinary: 'php',
};

if (isWindows) {
    platform.os = 'win';
    platform.arch = 'x64';
    platform.phpBinary += '.exe';
}

if (isLinux) {
    platform.os = 'linux';
    platform.arch = 'x64';
}

if (isDarwin) {
    platform.os = 'mac';
    platform.arch = 'x64';
}

if (isArm64) {
    platform.arch = 'arm64';
}

// isBuilding overwrites platform to the desired architecture
if (isBuilding) {
    // Only one will be used by the configured build commands in package.json
    platform.arch = process.argv.includes('--x64') ? 'x64' : platform.arch;
    platform.arch = process.argv.includes('--arm64') ? 'arm64' : platform.arch;
}

const phpVersionZip = 'php-' + phpVersion + '.zip';
const binarySrcDir = join(phpBinaryPath, platform.os, platform.arch, phpVersionZip);
const binaryDestDir = join(process.env.NATIVEPHP_BUILD_PATH || join(appRoot, 'vendor', 'nativephp', 'desktop', 'resources', 'build'), 'php');

console.log('Binary Source: ', binarySrcDir);
console.log('Binary Filename: ', platform.phpBinary);
console.log('PHP version: ' + phpVersion);

if (platform.phpBinary) {
    try {
        const targetBinary = join(binaryDestDir, platform.phpBinary);
        if (fs.existsSync(targetBinary) && fs.statSync(targetBinary).size > 1000000) {
            console.log('PHP binary already present at ' + targetBinary + ', reusing existing binary.');
        } else {
            console.log('Unzipping PHP binary from ' + binarySrcDir + ' to ' + binaryDestDir);
            try {
                removeSync(binaryDestDir);
            } catch (ignoreErr) {
                // Ignore removal error if locked
            }

            ensureDirSync(binaryDestDir);

        await new Promise((resolve, reject) => {
            unzip.open(binarySrcDir, { lazyEntries: true }, function (err, zipfile) {
                if (err) {
                    reject(err);
                    return;
                }

                zipfile.on('error', reject);
                zipfile.on('end', resolve);
                zipfile.on('entry', function (entry) {
                    zipfile.openReadStream(entry, function (err, readStream) {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const binaryPath = join(binaryDestDir, platform.phpBinary);
                        const writeStream = fs.createWriteStream(binaryPath);

                        pipeline(readStream, writeStream)
                            .then(() => fs.promises.chmod(binaryPath, 0o755))
                            .then(() => {
                                console.log('Copied PHP binary to ', binaryPath);
                                zipfile.readEntry();
                            })
                            .catch(reject);
                    });
                });
                zipfile.readEntry();
            });
        });
        }
    } catch (e) {
        console.error('Error copying PHP binary', e);
        process.exitCode = 1;
    }
}
