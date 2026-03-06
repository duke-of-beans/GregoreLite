import urllib.request, json

urls = [
    'http://localhost:3001/api/conversations?page=1&pageSize=10',
    'http://localhost:3001/api/threads',
    'http://localhost:3001/api/costs/today',
    'http://localhost:3001/api/settings',
]

for url in urls:
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            body = r.read().decode()[:120]
            print(f'[{r.status}] {url.split("/api/")[1]}: {body}')
    except Exception as e:
        print(f'[ERR] {url}: {e}')
