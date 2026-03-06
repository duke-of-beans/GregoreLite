content = open(r'D:\Projects\GregLite\app\components\chat\ChatInterface.tsx', encoding='utf-8').read()
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if 'useUIStore' in line or 'ui-store' in line:
        try:
            print(f'{i}: {line}')
        except Exception:
            print(f'{i}: [unprintable]')
