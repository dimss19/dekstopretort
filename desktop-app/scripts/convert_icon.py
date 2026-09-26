from PIL import Image
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(base_dir, '..', 'assets')
png_path = os.path.join(assets_dir, 'icon.png')
ico_path = os.path.join(assets_dir, 'icon.ico')

if not os.path.exists(png_path):
    print(f"Error: {png_path} does not exist")
    exit(1)

img = Image.open(png_path).convert("RGBA")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(ico_path, format='ICO', sizes=sizes)
print(f"Successfully generated {ico_path} with sizes {sizes}")

icns_path = os.path.join(assets_dir, 'icon.icns')
img.save(icns_path, format='ICNS')
print(f"Successfully generated {icns_path}")

