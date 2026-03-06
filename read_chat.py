import sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
with open(r'D:\Projects\GregLite\app\components\chat\ChatInterface.tsx', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines[100:220], start=101):
    print(f"{i}: {l.rstrip()}")
