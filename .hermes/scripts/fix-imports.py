#!/usr/bin/env python3
"""Fix misplaced imports placed inside <style> blocks by the migration script."""
import os, re

src = os.path.expanduser('~/Current_Works/class_mansys/src')

fixed = 0
for root, dirs, files in os.walk(src):
    for fname in files:
        if not fname.endswith('.vue'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        orig = content
        
        # 1. Remove wrongly placed imports from inside <style> blocks
        # Pattern: import { showToast, showConfirm } from '@/utils/ui' (inside <style> or after @import)
        content = re.sub(
            r'\s*import\s*\{[^}]+\}\s*from\s*[\'\"](@/|\.\./)utils/ui[\'\"]\s*',
            '',
            content
        )
        
        # 2. Remove useRouter imports that were duplicated or placed wrong
        # Only remove if inside <style> block or duplicated
        # Actually let's just remove ALL misplaced imports that clearly aren't in <script>
        # Find all <style> content and remove imports from it
        def remove_imports_from_style(match):
            style_content = match.group(0)
            # Remove import statements from style content
            cleaned = re.sub(r'\s*import\s+.*?from\s+[\'\"].*?[\'\"]\s*', '', style_content)
            return cleaned
        
        content = re.sub(r'<style[\s\S]*?</style>', remove_imports_from_style, content)
        
        # 3. Remove misplaced useRouter imports that don't have a corresponding usage
        # (keep only the first valid import in <script>)
        
        if content != orig:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            fixed += 1
            # Show what changed
            diff = [f for f in content.split('\n') if 'import' in f and 'utils/ui' in f]
            if diff:
                print(f'  ✅ {fpath[len(src)+1:]} - kept imports: {diff}')

print(f'\nFiles fixed: {fixed}')
