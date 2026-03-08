from PIL import Image
import shutil

icon_dir = r'D:\Projects\GregLite\app\src-tauri\icons'
src = f'{icon_dir}\\icon.png'

img = Image.open(src)
print(f'Source: {img.size} {img.mode}')

# Generate Tauri-required icon sizes
sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
}

for name, size in sizes.items():
    out = img.resize((size, size), Image.LANCZOS)
    out.save(f'{icon_dir}\\{name}')
    print(f'Created {name} ({size}x{size})')

# Also generate icon.icns placeholder (macOS) - just copy the 256px as a PNG
# Tauri only needs icns on macOS, won't break on Windows if missing
print('Done - all Tauri icon sizes generated')
