#!/usr/bin/env bash
# ==============================================================================
# Script Build macOS DMG (Intel x64 & Apple Silicon arm64) - SCADA Retort
# PT Indah Mesin
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "======================================================================"
echo "      BUILD SCADA RETORT MACOS DMG (.DMG) - PT INDAH MESIN"
echo "======================================================================"
echo ""

# 1. Pastikan script dijalankan pada macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "[ERROR] Kompilasi DMG (.dmg) macOS membutuhkan sistem operasi macOS."
    echo "Gunakan mesin Mac (MacBook/Mac Mini) atau jalankan GitHub Actions workflow."
    exit 1
fi

# 2. Pastikan binary PHP untuk macOS telah tersedia
echo "[1/5] Memeriksa PHP Runtime untuk macOS..."
mkdir -p "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/x64"
mkdir -p "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/arm64"
if [ ! -f "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/x64/php-8.3.zip" ]; then
    echo "Mengunduh PHP binary 8.3 untuk Intel Mac (x64)..."
    curl -L "https://raw.githubusercontent.com/NativePHP/php-bin/main/bin/mac/x64/php-8.3.zip" -o "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/x64/php-8.3.zip"
fi
if [ ! -f "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/arm64/php-8.3.zip" ]; then
    echo "Mengunduh PHP binary 8.3 untuk Apple Silicon (arm64)..."
    curl -L "https://raw.githubusercontent.com/NativePHP/php-bin/main/bin/mac/arm64/php-8.3.zip" -o "$PROJECT_ROOT/packages/nativephp/php-bin/bin/mac/arm64/php-8.3.zip"
fi

# 3. Build Frontend
echo "[2/5] Mengkompilasi Aset Frontend (React + Vite)..."
npm run build

# 3. Clear Cache Laravel
echo "[2/4] Membersihkan Cache Laravel..."
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 4. Build Intel Mac (x64)
echo "[3/4] Membangun installer DMG untuk Intel Mac (x64)..."
php artisan native:build mac x64 --no-interaction

# 5. Build Apple Silicon (arm64)
echo "[4/4] Membangun installer DMG untuk Apple Silicon (arm64)..."
php artisan native:build mac arm64 --no-interaction

mkdir -p "$PROJECT_ROOT/desktop-app/dist"

# Salin output ke desktop-app/dist
if [ -d "$PROJECT_ROOT/nativephp/electron/dist" ]; then
    cp -v "$PROJECT_ROOT"/nativephp/electron/dist/*.dmg "$PROJECT_ROOT/desktop-app/dist/" 2>/dev/null || true
fi

echo ""
echo "======================================================================"
echo "  BUILD MACOS SELESAI!"
echo "======================================================================"
echo "File .dmg tersedia di:"
ls -lh "$PROJECT_ROOT/desktop-app/dist/"*.dmg 2>/dev/null || true
echo ""
