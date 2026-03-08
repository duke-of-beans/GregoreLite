import sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
f = open('test-results.txt', 'r', encoding='utf-8', errors='replace')
lines = f.readlines()
f.close()
for line in lines[-120:]:
    print(line, end='')
