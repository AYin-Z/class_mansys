#!/usr/bin/env python3
"""Merge duplicate Vue imports and router imports in .vue and .ts files."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

for root, dirs, files in os.walk(src):
    for fname in files:
        if not (fname.endswith('.vue') or fname.endswith('.ts')):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        orig = content
        lines = content.split('\n')
        
        # Collect all 'from vue' imports and merge into one
        vue_imports = []
        other_imports = []
        for line in lines:
            if 'from' in line and "'vue'" in line.strip() or 'from' in line and '"vue"' in line.strip():
                m = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'"]vue[\'"]', line)
                if m:
                    items = [x.strip() for x in m.group(1).split(',')]
                    vue_imports.extend(items)
                # Don't add this line to other_imports
            else:
                other_imports.append(line)
        
        # Also collect router imports
        router_imports = []
        filtered = []
        for line in other_imports:
            if 'from' in line and "'vue-router'" in line.strip():
                m = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'"]vue-router[\'"]', line)
                if m:
                    items = [x.strip() for x in m.group(1).split(',')]
                    router_imports.extend(items)
                # Skip this line
            else:
                filtered.append(line)
        other_imports = filtered
        
        if vue_imports:
            # Remove duplicates while preserving order
            seen = set()
            vue_dedup = []
            for item in vue_imports:
                if item not in seen:
                    seen.add(item)
                    vue_dedup.append(item)
            
            # Find where to insert the merged import
            # Look for first import line position
            insert_pos = 0
            for i, line in enumerate(other_imports):
                if line.strip().startswith('import ') or line.strip().startswith('// ') or line.strip().startswith('/*'):
                    insert_pos = i + 1
                elif line.strip().startswith('const ') or line.strip().startswith('function ') or line.strip().startswith('export '):
                    break
            
            # Insert merged vue import
            indent = '  '  # default indent
            if vue_dedup:
                other_imports.insert(insert_pos, f"import {{ {', '.join(vue_dedup)} }} from 'vue'")
        
        if router_imports:
            seen = set()
            router_dedup = []
            for item in router_imports:
                if item not in seen:
                    seen.add(item)
                    router_dedup.append(item)
            
            # Find last import position
            insert_pos = 0
            for i, line in enumerate(other_imports):
                if line.strip().startswith('import ') or line.strip().startswith('// '):
                    insert_pos = i + 1
            
            if router_dedup:
                other_imports.insert(insert_pos, f"import {{ {', '.join(router_dedup)} }} from 'vue-router'")
        
        new_content = '\n'.join(other_imports)
        
        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'  ✏️  {fpath[len(src)+1:]}')

print('\nDone!')
