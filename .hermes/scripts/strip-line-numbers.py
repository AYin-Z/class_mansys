#!/usr/bin/env python3
"""Strip line-number corruption from .vue files caused by script failures."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

fixed = 0
for root, dirs, files in os.walk(src):
    for fname in files:
        if not fname.endswith('.vue'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'rb') as f:
            raw = f.read()
        
        # Check for the corruption pattern: lines starting with "     N|"
        if b'    1|' in raw[:100]:
            # Strip leading line numbers
            text = raw.decode('utf-8', errors='replace')
            lines = text.split('\n')
            clean = []
            for line in lines:
                # Remove leading spaces + number + | pattern
                cleaned = re.sub(r'^\s+\d+\|(\s*)', r'\1', line)
                # Also handle empty line-number-only lines
                cleaned = re.sub(r'^\s+\d+\|$', '', cleaned)
                # Remove stray "   N|" in middle of content
                cleaned = re.sub(r'\s+\d+\|', '', cleaned)
                clean.append(cleaned)
            
            new_text = '\n'.join(clean)
            
            # Additional fix: remove duplicate blank lines
            new_text = re.sub(r'\n{3,}', '\n\n', new_text)
            
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_text)
            fixed += 1

print(f'Fixed {fixed} corrupted files')
