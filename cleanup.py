import shutil, os

dirs_to_remove = [
    r'D:\Projects\GregLite\app\app\api\conversations',
    r'D:\Projects\GregLite\app\app\api\jobs',
    r'D:\Projects\GregLite\app\lib\database',
]

files_to_remove = [
    r'D:\Projects\GregLite\MORNING_BRIEFING.md',
]

for d in dirs_to_remove:
    if os.path.exists(d):
        shutil.rmtree(d)
        print(f"Deleted dir: {d}")
    else:
        print(f"Not found (skip): {d}")

for f in files_to_remove:
    if os.path.exists(f):
        os.remove(f)
        print(f"Deleted file: {f}")
    else:
        print(f"Not found (skip): {f}")

print("DONE")
