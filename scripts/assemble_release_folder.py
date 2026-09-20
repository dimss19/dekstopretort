import os
import shutil
import glob

SOURCE_ROOT = r"d:\laragon\www\scadaretort"
TARGET_DIR  = r"d:\laragon\www\scadaretort\scada-retort-installer-release"
LARAGON_PHP = r"D:\laragon\bin\php\php-8.3.24-Win32-vs16-x64"

print("==================================================================")
print("  ASSEMBLING SCADA RETORT RELEASE INSTALLER FOLDER")
print(f"  Target: {TARGET_DIR}")
print("==================================================================")

# 1. Clean / Recreate target directory
if os.path.exists(TARGET_DIR):
    print("Removing previous release folder...")
    shutil.rmtree(TARGET_DIR, ignore_errors=True)
os.makedirs(TARGET_DIR, exist_ok=True)

# 2. Copy Portable PHP 8.3
print("\n[1/6] Copying Portable PHP 8.3.24 runtime...")
target_php = os.path.join(TARGET_DIR, "php")
os.makedirs(target_php, exist_ok=True)

# Copy binaries and DLLs
php_files = [
    "php.exe", "php-cgi.exe", "php-win.exe",
    "libsqlite3.dll", "libcrypto-3-x64.dll", "libssl-3-x64.dll",
    "nghttp2.dll", "libssh2.dll", "libsasl.dll", "libenchant2.dll"
]
for f in php_files:
    src_f = os.path.join(LARAGON_PHP, f)
    if os.path.exists(src_f):
        shutil.copy2(src_f, os.path.join(target_php, f))

# Copy ICU DLLs
for icu in glob.glob(os.path.join(LARAGON_PHP, "icu*.dll")):
    shutil.copy2(icu, os.path.join(target_php, os.path.basename(icu)))

# Copy ext folder with essential DLLs
target_ext = os.path.join(target_php, "ext")
os.makedirs(target_ext, exist_ok=True)
exts = [
    "php_pdo_sqlite.dll", "php_sqlite3.dll",
    "php_curl.dll", "php_mbstring.dll", "php_fileinfo.dll",
    "php_openssl.dll", "php_pdo_mysql.dll", "php_gd.dll",
    "php_sodium.dll", "php_zip.dll"
]
for ext in exts:
    src_ext = os.path.join(LARAGON_PHP, "ext", ext)
    if os.path.exists(src_ext):
        shutil.copy2(src_ext, os.path.join(target_ext, ext))

# Create pre-configured php.ini
php_ini_content = """[PHP]
engine = On
short_open_tag = Off
precision = 14
output_buffering = 4096
zlib.output_compression = Off
implicit_flush = Off
serialize_precision = -1
zend.enable_gc = On
zend.multibyte = Off
max_execution_time = 300
max_input_time = 60
memory_limit = 512M
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = Off
display_startup_errors = Off
log_errors = On
post_max_size = 64M
default_mimetype = "text/html"
default_charset = "UTF-8"
file_uploads = On
upload_max_filesize = 64M
max_file_uploads = 20
allow_url_fopen = On
allow_url_include = Off
default_socket_timeout = 60

extension_dir = "ext"
extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_sqlite
extension=sqlite3
extension=pdo_mysql

[Date]
date.timezone = "Asia/Jakarta"
"""
with open(os.path.join(target_php, "php.ini"), "w", encoding="utf-8") as f:
    f.write(php_ini_content)
print("  -> PHP 8.3 Portable assembled with pre-configured php.ini.")

# 3. Copy Drivers
print("\n[2/6] Copying USB-RS485 Drivers...")
target_drivers = os.path.join(TARGET_DIR, "drivers")
shutil.copytree(os.path.join(SOURCE_ROOT, "drivers"), target_drivers, dirs_exist_ok=True)
print("  -> Drivers copied (CH341SER.EXE, install_driver_ch340.bat, README_DRIVER.txt).")

# 4. Copy Launchers and Documentation
print("\n[3/6] Copying Launchers & Visual Documentation...")
launchers = [
    "START_SCADA.bat",
    "STOP_SCADA.bat",
    "CREATE_DESKTOP_SHORTCUT.bat",
    "ENABLE_AUTOSTART.bat",
    "DISABLE_AUTOSTART.bat",
    "PANDUAN_INSTALASI_LOKAL.html",
    "README.md",
    "artisan",
    "composer.json",
    "composer.lock",
    "package.json",
    ".env.example"
]
for l in launchers:
    src_l = os.path.join(SOURCE_ROOT, l)
    if os.path.exists(src_l):
        shutil.copy2(src_l, os.path.join(TARGET_DIR, l))
print("  -> Launchers & Documentation copied.")

# 5. Copy Core Application Folders
print("\n[4/6] Copying Application Source Folders (app, bootstrap, config, database, public, resources, routes, scripts)...")
app_dirs = ["app", "bootstrap", "config", "database", "public", "resources", "routes", "scripts"]
for d in app_dirs:
    src_d = os.path.join(SOURCE_ROOT, d)
    dst_d = os.path.join(TARGET_DIR, d)
    if os.path.exists(src_d):
        shutil.copytree(src_d, dst_d, dirs_exist_ok=True, ignore=shutil.ignore_patterns(
            "__pycache__", "*.pyc", ".git*", "hot"
        ))
print("  -> Application source code copied.")

# 6. Copy Vendor (Production PHP dependencies)
print("\n[5/6] Copying vendor/ (Production PHP packages)...")
src_vendor = os.path.join(SOURCE_ROOT, "vendor")
dst_vendor = os.path.join(TARGET_DIR, "vendor")
if os.path.exists(src_vendor):
    shutil.copytree(src_vendor, dst_vendor, dirs_exist_ok=True, ignore=shutil.ignore_patterns(
        ".git*", "test", "tests", "Tests", "*.md", "doc", "docs"
    ))
print("  -> vendor/ copied.")

# 7. Setup Clean Storage Hierarchy
print("\n[6/6] Initializing clean storage hierarchy...")
storage_dirs = [
    "storage/app/public",
    "storage/app/private",
    "storage/framework/cache/data",
    "storage/framework/sessions",
    "storage/framework/views",
    "storage/framework/testing",
    "storage/logs",
    "bootstrap/cache"
]
for sd in storage_dirs:
    p = os.path.join(TARGET_DIR, sd)
    os.makedirs(p, exist_ok=True)
    gitkeep = os.path.join(p, ".gitignore")
    if not os.path.exists(gitkeep):
        with open(gitkeep, "w") as f:
            f.write("*\n!.gitignore\n")

# Ensure storage/installed does NOT exist so installer triggers on first run
installed_lock = os.path.join(TARGET_DIR, "storage", "installed")
if os.path.exists(installed_lock):
    os.remove(installed_lock)

# Ensure empty sqlite database file template exists in database/
sqlite_db = os.path.join(TARGET_DIR, "database", "database.sqlite")
if not os.path.exists(sqlite_db):
    open(sqlite_db, "a").close()

print("\n==================================================================")
print("  ASSEMBLY COMPLETE!")
print(f"  Release folder is ready at: {TARGET_DIR}")
print("==================================================================")
