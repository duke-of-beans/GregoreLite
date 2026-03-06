import os

hits = []
for root, dirs, files in os.walk(r'D:\Projects\GregLite\app'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            path = os.path.join(root, f)
            try:
                content = open(path, encoding='utf-8', errors='ignore').read()
                if 'SettingsPanel' in content or 'settingsOpen' in content or 'toggleSettings' in content:
                    hits.append(path)
            except Exception:
                pass

print('\n'.join(hits) if hits else 'none found')
