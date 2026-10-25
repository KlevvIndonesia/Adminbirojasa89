import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = [
    'src/app/components/BuatOrder.tsx',
    'src/app/components/PlateNumberInput.tsx',
    'src/app/components/SearchableSamsatSelect.tsx',
]

def get_language(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ['.tsx', '.ts']:
        return 'tsx' if ext == '.tsx' else 'typescript'
    return 'text'

output_file = 'BUAT_ORDER_CONTEXT.md'
with open(output_file, 'w', encoding='utf-8') as out:
    out.write("# KONTEKS KODE SUMBER MODUL BUAT ORDER\n\n")
    for f in files:
        if os.path.exists(f):
            lang = get_language(f)
            norm_path = f.replace('\\', '/')
            with open(f, 'r', encoding='utf-8') as fp:
                content = fp.read()
            out.write(f"File: `{norm_path}`\n```{lang}\n{content}\n```\n\n")
            print(f"Added {f} ({len(content)} chars, {content.count(chr(10))} lines)")

print("Saved successfully to BUAT_ORDER_CONTEXT.md")
