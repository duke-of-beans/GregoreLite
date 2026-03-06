import subprocess, sys

# Force UTF-8 on Windows console
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

r = subprocess.run(
    ['pnpm.cmd', 'test:run', '--reporter=dot'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    cwd=r'D:\Projects\GregLite\app'
)
combined = (r.stdout or '') + (r.stderr or '')
lines = combined.splitlines()

# Strip ANSI escape codes for readability
import re
ansi = re.compile(r'\x1b\[[0-9;]*m')
clean = [ansi.sub('', l) for l in lines]

# Print the vitest summary block (last occurrence of lines with counts)
interesting = [l for l in clean if l.strip()]
# Find summary lines
summary_lines = [l for l in interesting if 
    l.strip().startswith('Test Files') or 
    l.strip().startswith('Tests ') or
    l.strip().startswith('Duration')]
print('\n=== VITEST SUMMARY ===')
for l in summary_lines[-6:]:
    print(l)
print('=== FAILURES (last 30 lines) ===')
for l in interesting[-30:]:
    print(l)

print('\nEXIT CODE:', r.returncode)
