import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Check animations.ts for panelSlideUp
print("=== animations.ts exports ===")
with open(r'D:\Projects\GregLite\app\lib\design\animations.ts', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    if 'export' in l or 'panelSlide' in l:
        print(f"  {i}: {l.rstrip()}")

# Check EventDetailPanel imports
print("\n=== EventDetailPanel.tsx first 25 lines ===")
with open(r'D:\Projects\GregLite\app\components\transit\EventDetailPanel.tsx', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines[:25], 1):
    print(f"  {i}: {l.rstrip()}")

# Check for duplicates
import_lines = [(i+1, l.rstrip()) for i, l in enumerate(lines) if l.strip().startswith('import')]
print(f"\n=== All import lines ({len(import_lines)}) ===")
for n, t in import_lines:
    print(f"  {n}: {t}")

# Check GhostCard CSSProperties annotations
print("\n=== GhostCard.tsx style/type lines ===")
with open(r'D:\Projects\GregLite\app\components\ghost\GhostCard.tsx', encoding='utf-8') as f:
    glines = f.readlines()
for i, l in enumerate(glines, 1):
    if 'CSSProperties' in l or 'cardStyle' in l or 'motion' in l or 'MotionStyle' in l:
        print(f"  {i}: {l.rstrip()}")
