import sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open(r'D:\Projects\GregLite\app\tsconfig.json', encoding='utf-8') as f:
    print(f.read())
