#!/usr/bin/env python3
"""Fix escaped quotes in showToast calls."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

count = 0
for root, dirs, files in os.walk(src):
    for fname in files:
        if not fname.endswith('.vue'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        orig = content
        
        # Fix showToast(\'text\') → showToast('text')
        content = re.compile(r"showToast\\(\\'([^']*?)\\'\\)").sub(r"showToast('\1')", content)
        
        if content != orig:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            count += 1

print(f'Fixed {count} files')
