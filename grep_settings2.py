content = open(r'D:\Projects\GregLite\app\components\chat\ChatInterface.tsx', encoding='utf-8').read()
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if 'settingsOpen' in line or 'SettingsPanel' in line or 'Cmd+,' in line or 'settings' in line.lower():
        try:
            print(f'{i}: {line}')
        except Exception:
            print(f'{i}: [unprintable]')
