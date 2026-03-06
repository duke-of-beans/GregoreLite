import sys
sys.stdout.reconfigure(encoding='utf-8')
lines = open('D:/Projects/GregLite/app/components/chat/Message.tsx', encoding='utf-8', errors='replace').readlines()
# hover action area
for i, l in enumerate(lines[265:295], 266):
    print(f'{i}: {l}', end='')
print('...')
for i, l in enumerate(lines[365:400], 366):
    print(f'{i}: {l}', end='')
# props interface
print('...')
for i, l in enumerate(lines[215:270], 216):
    print(f'{i}: {l}', end='')
