import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Full animations.ts
print("=== animations.ts FULL ===")
with open(r'D:\Projects\GregLite\app\lib\design\animations.ts', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    print(f"  {i}: {l.rstrip()}")

# tsconfig paths
print("\n=== tsconfig.json paths ===")
with open(r'D:\Projects\GregLite\app\tsconfig.json', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    if 'paths' in l or '@' in l or 'baseUrl' in l or 'rootDir' in l:
        print(f"  {i}: {l.rstrip()}")
