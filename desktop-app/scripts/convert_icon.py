import os
import shutil
from PIL import Image, ImageDraw

base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(base_dir, '..', '..'))
src_png = os.path.join(root_dir, 'desktop-app', 'assets', 'icon.png')

if not os.path.exists(src_png):
    print(f"Error: {src_png} does not exist")
    exit(1)

img = Image.open(src_png).convert("RGBA")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# 1. ICO Files
ico_targets = [
    os.path.join(root_dir, 'desktop-app', 'assets', 'icon.ico'),
    os.path.join(root_dir, 'public', 'icon.ico'),
    os.path.join(root_dir, 'public', 'favicon.ico'),
    os.path.join(root_dir, 'nativephp', 'electron', 'build', 'icon.ico'),
    os.path.join(root_dir, 'vendor', 'nativephp', 'desktop', 'resources', 'electron', 'build', 'icon.ico'),
]

for p in ico_targets:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, format='ICO', sizes=sizes)
    print(f"Saved ICO: {p}")

# 2. ICNS Files (macOS)
icns_targets = [
    os.path.join(root_dir, 'desktop-app', 'assets', 'icon.icns'),
    os.path.join(root_dir, 'public', 'icon.icns'),
    os.path.join(root_dir, 'nativephp', 'electron', 'build', 'icon.icns'),
    os.path.join(root_dir, 'vendor', 'nativephp', 'desktop', 'resources', 'electron', 'build', 'icon.icns'),
]

for p in icns_targets:
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p, format='ICNS')
        print(f"Saved ICNS: {p}")
    except Exception as e:
        print(f"ICNS error for {p}: {e}")

# 3. PNG Copies
png_targets = [
    os.path.join(root_dir, 'public', 'icon.png'),
    os.path.join(root_dir, 'public', 'assets', 'logo.png'),
    os.path.join(root_dir, 'nativephp', 'electron', 'build', 'icon.png'),
    os.path.join(root_dir, 'vendor', 'nativephp', 'desktop', 'resources', 'electron', 'build', 'icon.png'),
]

for p in png_targets:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    shutil.copyfile(src_png, p)
    print(f"Copied PNG: {p}")

# 4. NSIS Assisted Setup Wizard Bitmaps (164x314 Sidebar, 150x57 Header)
sidebar = Image.new('RGB', (164, 314), color=(26, 43, 76))
draw = ImageDraw.Draw(sidebar)
for y in range(314):
    r = int(26 + (15 - 26) * (y / 314))
    g = int(43 + (23 - 43) * (y / 314))
    b = int(76 + (42 - 76) * (y / 314))
    draw.line([(0, y), (164, y)], fill=(r, g, b))

logo_sidebar = img.resize((120, 120), Image.Resampling.LANCZOS)
sidebar.paste(logo_sidebar, (22, 45), logo_sidebar)

header = Image.new('RGB', (150, 57), color=(255, 255, 255))
header_logo = img.resize((48, 48), Image.Resampling.LANCZOS)
header.paste(header_logo, (92, 4), header_logo)

sidebar_targets = [
    os.path.join(root_dir, 'desktop-app', 'assets', 'installerSidebar.bmp'),
    os.path.join(root_dir, 'nativephp', 'electron', 'build', 'installerSidebar.bmp'),
]
for p in sidebar_targets:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    sidebar.save(p, format='BMP')
    print(f"Saved Sidebar BMP: {p}")

header_targets = [
    os.path.join(root_dir, 'desktop-app', 'assets', 'installerHeader.bmp'),
    os.path.join(root_dir, 'nativephp', 'electron', 'build', 'installerHeader.bmp'),
]
for p in header_targets:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    header.save(p, format='BMP')
    print(f"Saved Header BMP: {p}")

print("All app icons and NSIS Setup Wizard bitmaps synced successfully!")
