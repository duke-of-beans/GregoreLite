import sys

path = r'D:\Projects\GregLite\app\lib\ghost\email\oauth.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_func_start = 'async function openInBrowser(url: string): Promise<void> {'
# Find function start
start_idx = content.find(old_func_start)
# Find function end (closing brace before Token exchange comment)
end_marker = '\n\n// \u2500\u2500 Token exchange'
end_idx = content.find(end_marker, start_idx)
end_idx_with_newline = end_idx  # we'll keep the \n\n

old_block = content[start_idx:end_idx]

new_block = '''async function openInBrowser(url: string): Promise<void> {
  // Only attempt Tauri shell in actual Tauri runtime.
  // webpackIgnore prevents Turbopack/webpack from resolving this module at
  // build time, eliminating the "Module not found" warning during pnpm dev.
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error \u2014 @tauri-apps/plugin-shell only resolves at Tauri runtime
      const { open } = await import(/* webpackIgnore: true */ '@tauri-apps/plugin-shell');
      await open(url);
      return;
    } catch {
      // Fall through to Node.js fallback
    }
  }

  // Non-Tauri context (Node.js / dev server): open URL via child_process
  const { exec } = await import('child_process');
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd);
}'''

new_content = content[:start_idx] + new_block + content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done. Replaced openInBrowser function.')
print(f'Old length: {len(old_block)}, New length: {len(new_block)}')
