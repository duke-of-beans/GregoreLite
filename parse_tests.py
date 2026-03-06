import sys
lines = open('D:/Projects/GregLite/test_output.txt', encoding='utf-8', errors='replace').readlines()
keywords = ['Tests ', 'Test Files', 'Duration', 'FAIL', 'PASS', 'failed', 'passed', 'AssertionError', 'Error:', 'stderr']
out = [l.rstrip() for l in lines if any(k in l for k in keywords)]
# Also grab last 15 lines for summary
tail = [l.rstrip() for l in lines[-15:]]
sys.stdout.reconfigure(encoding='utf-8')
print('=== KEYWORD MATCHES ===')
print('\n'.join(out[-50:]))
print('=== TAIL ===')
print('\n'.join(tail))
