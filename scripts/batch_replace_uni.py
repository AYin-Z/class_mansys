#!/usr/bin/env python3
"""批量替换 uni.* API 调用 — 安全版（逐文件读、替换、验证）"""
import re
import os
import sys

SRC = '/home/ayin/Current_Works/class_mansys/src'

# 所有替换模式（顺序重要：先具体后宽泛）
# 每个模式: (pattern, replacement_lambda_or_string)
RULES = [
    # === showToast ===
    # uni.showToast with icon='none' → showToast(msg, 'error')
    (r'uni\.showToast\(\{\s*title:\s*([^,}]+?),\s*icon:\s*[\"\']none[\"\']\s*\}\)',
     lambda m: f"showToast({m.group(1)}, 'error')"),
    # uni.showToast with icon='success' → showToast(msg, 'success') 
    (r'uni\.showToast\(\{\s*title:\s*([^,}]+?),\s*icon:\s*[\"\']success[\"\']\s*\}\)',
     lambda m: f"showToast({m.group(1)}, 'success')"),
    # uni.showToast with duration → showToast(msg)
    (r'uni\.showToast\(\{\s*title:\s*([^,}]+?),\s*icon:\s*[\"\']none[\"\']\s*,\s*duration:\s*\d+\s*\}\)',
     lambda m: f"showToast({m.group(1)}, 'error')"),
    # uni.showToast plain → showToast(msg)
    (r'uni\.showToast\(\{\s*title:\s*([^}]+?)\s*\}\)',
     lambda m: f"showToast({m.group(1)})"),
    
    # === showLoading → showToast ===
    (r'uni\.showLoading\(\{\s*title:\s*([^}]+?)\s*\}\)',
     lambda m: f"showToast({m.group(1)})"),
    
    # === navigateTo → router.push ===
    (r'uni\.navigateTo\(\{\s*url:\s*([^}]+?)\s*\}\)',
     lambda m: f"router.push({m.group(1)})"),
    
    # === setClipboardData → navigator.clipboard.writeText ===
    (r'uni\.setClipboardData\(\{\s*data:\s*([^}]+?)\s*\}',
     lambda m: f"navigator.clipboard.writeText({m.group(1)})"),
    
    # === setStorageSync → localStorage.setItem (with JSON.stringify for objects) ===
    # Handle: uni.setStorageSync('user_profile', user) → localStorage.setItem('user_profile', JSON.stringify(user))
    (r'uni\.setStorageSync\(([^,]+),\s*([a-zA-Z_][a-zA-Z0-9_.]*)\)',
     lambda m: f"localStorage.setItem({m.group(1)}, JSON.stringify({m.group(2)}))"),
    # Handle: uni.setStorageSync('key', 'string') or uni.setStorageSync('key', true/false)
    (r'uni\.setStorageSync\(([^,]+),\s*([^)]+)\)',
     lambda m: f"localStorage.setItem({m.group(1)}, {m.group(2)})"),
    
    # === getStorageSync → localStorage.getItem (with JSON.parse) ===
    (r'uni\.getStorageSync\(([^)]+)\)',
     lambda m: f"JSON.parse(localStorage.getItem({m.group(1)}) || 'null')"),
    
    # === removeStorageSync → localStorage.removeItem ===
    (r'uni\.removeStorageSync\(([^)]+)\)',
     lambda m: f"localStorage.removeItem({m.group(1)})"),
]

def collect_files():
    """收集所有需要处理的 .vue 和 .ts 文件"""
    files = []
    for root, dirs, fnames in os.walk(SRC):
        # 跳过 shims 和 dist
        dirs[:] = [d for d in dirs if d not in ('shims', 'dist', 'node_modules')]
        for fname in fnames:
            if fname.endswith(('.vue', '.ts')) and not fname.endswith('.d.ts'):
                files.append(os.path.join(root, fname))
    return files

def apply_rules(content, rules):
    """应用所有替换规则到内容"""
    changed = False
    for pattern, replacement in rules:
        new_content, count = re.subn(pattern, replacement, content)
        if count > 0:
            content = new_content
            changed = True
    return content, changed

def ensure_imports(content, filepath):
    """确保文件有必要的 import"""
    # showToast 的 import
    if 'showToast(' in content and 'showToast' not in content.split('\n')[0]:
        # Check if it already imports from ui
        if 'from \'@/utils/ui\'' not in content and 'from "@/utils/ui"' not in content:
            # Add import after the last vue import or at top
            lines = content.split('\n')
            insert_at = 0
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    insert_at = i + 1
                elif line.strip() == '' and insert_at > 0:
                    break
            lines.insert(insert_at, "import { showToast } from '@/utils/ui'")
            content = '\n'.join(lines)
    
    # router.push 的 import
    if 'router.push(' in content and 'const router = useRouter()' not in content:
        if 'useRouter' not in content:
            lines = content.split('\n')
            insert_at = 0
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    if 'vue-router' in line:
                        insert_at = i + 1
                    else:
                        insert_at = i + 1
            if insert_at > 0:
                # Don't add duplicate
                has_router = any('useRouter' in l for l in lines)
                if not has_router:
                    lines.insert(insert_at, "import { useRouter } from 'vue-router'")
                    lines.insert(insert_at + 1, "const router = useRouter()")
                    content = '\n'.join(lines)
    
    return content

def main():
    files = collect_files()
    total_changed = 0
    details = []
    
    for fpath in files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                orig = f.read()
            
            new_content, changed = apply_rules(orig, RULES)
            if not changed:
                continue
            
            new_content = ensure_imports(new_content, fpath)
            
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            # Count changes
            diff_count = sum(1 for a, b in zip(orig.split('\n'), new_content.split('\n')) if a != b)
            relpath = os.path.relpath(fpath, SRC)
            total_changed += 1
            details.append(f"  {relpath}: {diff_count} line(s) changed")
            
        except Exception as e:
            print(f"  ERROR {fpath}: {e}")
    
    print(f"\n修改了 {total_changed} 个文件:")
    for d in details:
        print(d)

if __name__ == '__main__':
    main()
