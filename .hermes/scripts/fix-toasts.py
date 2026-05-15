#!/usr/bin/env python3
"""Fix escaped quotes in showToast calls and remaining uni.* calls."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

# Find all .vue files
for root, dirs, files in os.walk(src):
    for fname in files:
        if not fname.endswith('.vue'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        orig = content
        
        # Fix 1: showToast(\\'text\\') → showToast('text')
        content = re.sub(r"showToast\\(\\\\'([^']*?)\\\\'\\)", r"showToast('\1')", content)
        
        # Fix 2: still have uni.showToast?
        content = re.sub(
            r'uni\.showToast\(\{[^}]*title:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
            r"showToast('\1')",
            content
        )
        
        # Fix 3: still have uni.showModal?
        # With title+content
        content = re.sub(
            r'uni\.showModal\(\{[^}]*title:\s*[\'"]([^\'"]+)[\'"][^}]*content:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
            r"showConfirm('\1', '\2')",
            content
        )
        # With content only
        content = re.sub(
            r'uni\.showModal\(\{[^}]*content:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
            r"showConfirm('', '\1')",
            content
        )
        
        # Fix 4: uni.hideLoading()
        content = re.sub(r'uni\.hideLoading\(\)', '', content)
        
        # Fix 5: uni.showLoading()
        content = re.sub(r'uni\.showLoading\(\)', '', content)
        
        if content != orig:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  ✅ {fpath[len(src)+1:]}')

print('\nDone!')
