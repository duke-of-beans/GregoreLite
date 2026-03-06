import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
with open(r'D:\Projects\GregLite\app\lib\memory\shimmer-query.ts', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines[:80], start=1):
    print(f"{i}: {l.rstrip()}")
