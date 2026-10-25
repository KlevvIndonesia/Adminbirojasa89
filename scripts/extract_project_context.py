import os
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

IGNORE_DIRS = {
    '.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build', 
    '.gemini', 'test-results', 'backups'
}
IGNORE_FILES = {
    '.env', 'bun.lock', 'package-lock.json', 'Thumbs.db', '.DS_Store'
}

def generate_tree(dir_path='.', prefix=''):
    output = []
    try:
        entries = sorted(os.listdir(dir_path))
    except Exception:
        return output

    filtered = []
    for e in entries:
        full_path = os.path.join(dir_path, e)
        if e in IGNORE_FILES:
            continue
        if os.path.isdir(full_path) and e in IGNORE_DIRS:
            continue
        # Skip binary / large mock uploads to keep tree clean
        if 'server\\uploads' in full_path or 'server/uploads' in full_path:
            if e != '.gitkeep':
                continue
        # Skip individual backup dumps in server
        if 'server\\backups' in full_path or 'server/backups' in full_path:
            continue
        filtered.append(e)

    for i, item in enumerate(filtered):
        full_path = os.path.join(dir_path, item)
        is_last = (i == len(filtered) - 1)
        connector = '└── ' if is_last else '├── '
        sub_prefix = '    ' if is_last else '│   '

        if os.path.isdir(full_path):
            output.append(f"{prefix}{connector}{item}/")
            output.extend(generate_tree(full_path, prefix + sub_prefix))
        else:
            output.append(f"{prefix}{connector}{item}")
    return output

def read_file_safe(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()

def get_language(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    mapping = {
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
        '.json': 'json',
        '.css': 'css',
        '.html': 'html',
        '.sh': 'bash',
        '.sql': 'sql',
        '.md': 'markdown',
        '.py': 'python',
        '.conf': 'nginx',
        '': 'text'
    }
    basename = os.path.basename(filepath)
    if basename in ['Caddyfile']:
        return 'caddyfile'
    if basename.startswith('.env'):
        return 'bash'
    return mapping.get(ext, 'text')

def format_file_block(rel_path):
    norm_path = rel_path.replace('\\', '/')
    content = read_file_safe(rel_path)
    lang = get_language(rel_path)
    return f"File: `{norm_path}`\n```{lang}\n{content}\n```\n"

if __name__ == '__main__':
    print("# KONTEKS LENGKAP PROYEK ADMIN SUN89\n")
    print("## 1. Struktur Proyek (Directory Tree)\n")
    print("```text")
    print(".")
    for line in generate_tree('.'):
        print(line)
    print("```\n")

    dependency_and_config_files = [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        ".env.example",
        "server/src/config/env.ts",
        "deploy/.env.production.template",
        "deploy/nginx/admin-sun89.conf",
        "deploy/caddy/Caddyfile",
        "deploy/admin-sun89.service",
    ]

    print("## 2. Dependensi & Konfigurasi Lingkungan\n")
    for f in dependency_and_config_files:
        if os.path.exists(f):
            print(format_file_block(f))

    entry_and_routing_files = [
        "server/src/server.ts",
        "server/src/app.ts",
        "src/main.tsx",
        "src/app/config/routeConfig.ts",
        "src/app/App.tsx",
    ]

    print("## 3. Entry Point & Arsitektur Inti\n")
    for f in entry_and_routing_files:
        if os.path.exists(f):
            print(format_file_block(f))

    schema_files = [
        "server/src/database/db.ts",
        "server/src/database/schema.ts",
        "src/domain/order/types.ts",
        "src/domain/finance/types.ts",
        "src/domain/user/types.ts",
    ]

    print("## 4. Model Data (Database Schema & Entities)\n")
    for f in schema_files:
        if os.path.exists(f):
            print(format_file_block(f))
