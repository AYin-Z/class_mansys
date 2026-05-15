#!/usr/bin/env python3
"""Fix remaining escaped quotes in showConfirm and showToast calls."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

# Find files with backslash+quote sequences
for root, dirs, files in os.walk(src):
    for fname in files:
        if not fname.endswith('.vue'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Look for the literal bytes: backslash followed by single quote
        has_escaped = b"\\'" in content.encode('utf-8') if isinstance(content, str) else b"\\'" in content
        
        if has_escaped:
            print(f"  Escaped quotes in: {fpath[len(os.path.expanduser('~/Current_Works/class_mansys'))+1:]}")
