import sys

def show(path, start=0, end=None):
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    for i, l in enumerate(lines[start:end], start+1):
        print(f"{i}: {l}", end='')

print("=== EventDetailPanel imports (lines 1-25) ===")
show(r'D:\Projects\GregLite\app\components\transit\EventDetailPanel.tsx', 0, 25)

print("\n=== animations.ts — panelSlideUp search ===")
with open(r'D:\Projects\GregLite\app\lib\design\animations.ts', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    if 'panelSlide' in l:
        print(f"{i}: {l}", end='')

print("\n=== GhostCard.tsx — cardStyle area ===")
with open(r'D:\Projects\GregLite\app\components\ghost\GhostCard.tsx', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    if 'cardStyle' in l or 'CSSProperties' in l or 'MotionStyle' in l:
        print(f"{i}: {l}", end='')
