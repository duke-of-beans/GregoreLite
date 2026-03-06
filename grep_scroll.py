content = open(r'D:\Projects\GregLite\app\components\chat\ChatInterface.tsx', encoding='utf-8').read()
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if any(k in line for k in ['Message list', 'overflow', 'flex-1', 'flex flex', 'MessageList', 'scroll']):
        try:
            print(f'{i}: {line}')
        except Exception:
            print(f'{i}: [unprintable]')
