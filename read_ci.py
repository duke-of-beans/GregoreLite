import sys
sys.stdout.reconfigure(encoding='utf-8')
lines = open('D:/Projects/GregLite/app/components/chat/ChatInterface.tsx', encoding='utf-8', errors='replace').readlines()
for i, l in enumerate(lines[84:105], 85):
    print(f'{i}: {l}', end='')
print('...')
for i, l in enumerate(lines[714:748], 715):
    print(f'{i}: {l}', end='')
print('...')
for i, l in enumerate(lines[40:62], 41):
    print(f'{i}: {l}', end='')
