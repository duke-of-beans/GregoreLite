import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
with open(r'D:\Projects\GregLite\STATUS.md', encoding='utf-8') as f:
    lines = f.readlines()
# Print first 60 lines to understand the format
for i, l in enumerate(lines[:60], start=1):
    print(f"{i}: {l.rstrip()}")
