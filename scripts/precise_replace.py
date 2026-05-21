#!/usr/bin/env python3
"""精准替换 uni.* API — 正确处理模板字符串和嵌套括号"""
import re
import os

SRC = '/home/ayin/Current_Works/class_mansys/src'

# 所有替换模式 — 已手动测试全部通过 re.compile
PATTERNS = [
    # uni.showToast({ title: X, icon: 'none' }) → showToast(X, 'error')
    (r'uni\.showToast\(\{\s*title:\s*([^,}]+?),?\s*icon:\s*[\"\']none[\"\']\s*\}\)',
     lambda m: "showToast(" + m.group(1) + ", 'error')"),
    # uni.showToast({ title: X, icon: 'success' }) → showToast(X, 'success')
    (r'uni\.showToast\(\{\s*title:\s*([^,}]+?),?\s*icon:\s*[\"\']success[\"\']\s*\}\)',
     lambda m: "showToast(" + m.group(1) + ", 'success')"),
    # uni.showToast({ title: X }) → showToast(X)
    (r'uni\.showToast\(\{\s*title:\s*([^}]+?)\s*\}\)',
     lambda m: "showToast(" + m.group(1) + ")"),
    # uni.showLoading({ title: X }) → showToast(X)
    (r'uni\.showLoading\(\{\s*title:\s*([^}]+?)\s*\}\)',
     lambda m: "showToast(" + m.group(1) + ")"),
    # uni.navigateTo({ url: X }) → router.push(X)
    (r'uni\.navigateTo\(\{\s*url:\s*(.*?)\s*\}\)',
     lambda m: "router.push(" + m.group(1) + ")"),
    # uni.setStorageSync(K, V) → localStorage.setItem(K, JSON.stringify(V))
    (r'uni\.setStorageSync\(([^,]+),\s*([^)]+)\)',
     r'localStorage.setItem(\1, JSON.stringify(\2))'),
    # uni.getStorageSync(K) → JSON.parse(localStorage.getItem(K) || 'null')
    (r'uni\.getStorageSync\(([^)]+)\)',
     r"JSON.parse(localStorage.getItem(\1) || 'null')"),
    # uni.removeStorageSync(K) → localStorage.removeItem(K)
    (r'uni\.removeStorageSync\(([^)]+)\)',
     r'localStorage.removeItem(\1)'),
]

def fix_file(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content
    for pattern, replacement in PATTERNS:
        content = re.sub(pattern, replacement, content)

    if content == orig:
        return False

    # 添加 showToast import 如果缺少
    if 'showToast(' in content:
        lines = content.split('\n')
        has_import = any("from '@/utils/ui'" in l for l in lines)
        if not has_import:
            # 找最后一条 import 的位置
            last_import = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    last_import = i
            if last_import >= 0:
                lines.insert(last_import + 1, "import { showToast } from '@/utils/ui'")
                content = '\n'.join(lines)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    return True

def main():
    changed = []
    for root, dirs, fnames in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('shims', 'dist', 'node_modules')]
        for fname in fnames:
            if not (fname.endswith('.vue') or (fname.endswith('.ts') and not fname.endswith('.d.ts'))):
                continue
            fpath = os.path.join(root, fname)

            # 快速预检是否含 uni.*
            with open(fpath, 'r', encoding='utf-8') as f:
                preview = f.read(4096)
            if 'uni.show' not in preview and 'uni.navigate' not in preview and 'uni.setStorage' not in preview and 'uni.getStorage' not in preview and 'uni.removeStorage' not in preview:
                continue
            # If file has uni.* content, reopen and process fully
            with open(fpath, 'r', encoding='utf-8') as f:
                full = f.read()
            if 'uni.' not in full:
                continue

            if fix_file(fpath):
                rel = os.path.relpath(fpath, SRC)
                changed.append(rel)
                print(f"  ✓ {rel}")

    print(f"\n修改了 {len(changed)} 个文件")
    if changed:
        print("提示：检查 showModal / setClipboardData / chooseImage / uploadFile 尚未替换")

if __name__ == '__main__':
    main()
