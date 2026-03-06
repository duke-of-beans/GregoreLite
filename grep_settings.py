content = open(r'D:\Projects\GregLite\app\components\chat\ChatInterface.tsx', encoding='utf-8').read()
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if 'setting' in line.lower():
        print(f'{i}: {line}')
