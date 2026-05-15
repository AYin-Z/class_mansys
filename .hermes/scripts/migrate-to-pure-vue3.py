#!/usr/bin/env python3
"""
Migration script: uni-app → pure Vue 3
Batch replaces all uni-app patterns in .vue and .ts files.
"""
import os, re, sys

PROJECT = os.path.expanduser('~/Current_Works/class_mansys/src')

# ============================================================
# Pattern: replace view → div (but not </view> or self-closing)
# Pattern: replace text → span (but not </text> or import/extend)
# Pattern: replace scroll-view → div (no mapping needed, just <scroll-view> tag)
# Pattern: replace <image → <img
# Pattern: replace </scroll-view> → </div>
# Pattern: replace </image> → (remove, img is self-closing)
# ============================================================

def find_uni_app_imports(content):
    """Find @dcloudio/uni-app import lines and return replacements."""
    # onLoad → need useRoute as well
    # onShow → onMounted + onActivated
    # onHide → onUnmounted + onDeactivated
    # onLaunch → onMounted (only in App.vue)
    
    lines = content.split('\n')
    new_lines = []
    has_import = False
    needs_vue = False
    needs_route = False
    
    for line in lines:
        m = re.match(r'^(\s*)import\s*\{([^}]+)\}\s*from\s*[\'"]@dcloudio/uni-app[\'"]\s*$', line)
        if m:
            has_import = True
            indent = m.group(1)
            hooks = m.group(2).strip()
            hook_list = [h.strip() for h in hooks.split(',')]
            
            vue_hooks = []
            for h in hook_list:
                if h == 'onLoad':
                    vue_hooks.append('onMounted')
                    needs_route = True
                elif h == 'onShow':
                    vue_hooks.append('onMounted')
                    vue_hooks.append('onActivated')
                elif h == 'onHide':
                    vue_hooks.append('onUnmounted')
                    vue_hooks.append('onDeactivated')
                elif h == 'onLaunch':
                    vue_hooks.append('onMounted')
                else:
                    vue_hooks.append(h)
            
            # Remove duplicates while preserving order
            seen = set()
            vue_hooks_dedup = []
            for h in vue_hooks:
                if h not in seen:
                    seen.add(h)
                    vue_hooks_dedup.append(h)
            
            new_lines.append(f'{indent}import {{ {", ".join(vue_hooks_dedup)} }} from \'vue\'')
            if needs_route:
                new_lines.append(f'{indent}import {{ useRoute }} from \'vue-router\'')
            continue
        new_lines.append(line)
    
    if has_import:
        return '\n'.join(new_lines)
    return content


def replace_onload_calls(content):
    """Replace onLoad((query) => {...}) with onMounted pattern."""
    # onLoad((query) => { ... }) → onMounted(() => { const query = useRoute().query; ... })
    # onLoad(({ id }) => { ... }) → onMounted(() => { const { id } = useRoute().query; ... })
    # onLoad(() => { ... }) → onMounted(() => { ... })
    
    def replace_onload(match):
        before = match.group(1)
        params = match.group(2)
        body = match.group(3)
        
        if params.strip() == '':
            # onLoad(() => { ... })
            return f'{before}onMounted(() => {body}'
        else:
            # onLoad((query) => { ... })
            return f'{before}onMounted(() => {{ const query = useRoute().query; {body.lstrip(" {")}'
    
    # Match onLoad((query) => { ... }) or onLoad(() => { ... })
    content = re.sub(
        r'(\s*)onLoad\(\(\s*(\w*)\s*\)\s*=>\s*(\{[\s\S]*?\})\)\s*\)',
        replace_onload,
        content
    )
    return content


def replace_onshow_calls(content):
    """Replace onShow(() => {}) with onMounted(() => {}) + onActivated(() => {})."""
    def replace_onshow(match):
        before = match.group(1)
        body = match.group(2)
        return f'{before}onMounted(() => {body}\n{before}onActivated(() => {body}'
    
    content = re.sub(
        r'(\s*)onShow\(\(\)\s*=>\s*(\{[\s\S]*?\})\)\)',
        replace_onshow,
        content
    )
    return content


def replace_nav_apis(content, filepath):
    """Replace uni.navigateTo / uni.reLaunch / uni.navigateBack / uni.redirectTo."""
    # uni.navigateTo({ url: '/path' }) → router.push('/path')
    # uni.navigateTo({ url: '/path?key=val' }) → router.push({ path: '/path', query: { key: 'val' } })
    # uni.reLaunch({ url: '/path' }) → router.replace('/path')  
    # uni.navigateBack() → router.back()
    # uni.redirectTo({ url: '/path' }) → router.replace('/path')
    
    content = re.sub(
        r'uni\.navigateTo\(\{\s*url:\s*[\'"]([^\'"]+)[\'"]\s*\}\)',
        r"router.push('\1')",
        content
    )
    content = re.sub(
        r'uni\.reLaunch\(\{\s*url:\s*[\'"]([^\'"]+)[\'"]\s*\}\)',
        r"router.replace('\1')",
        content
    )
    content = re.sub(
        r'uni\.redirectTo\(\{\s*url:\s*[\'"]([^\'"]+)[\'"]\s*\}\)',
        r"router.replace('\1')",
        content
    )
    content = re.sub(
        r'uni\.navigateBack\(\)',
        'router.back()',
        content
    )
    
    # If router.push/router.replace/router.back was introduced, ensure router is imported
    if 'router.push(' in content or 'router.replace(' in content or 'router.back()' in content:
        if 'from \'vue-router\'' not in content and 'useRouter' not in content:
            # Check if there's already a router import
            lines = content.split('\n')
            for line in lines:
                if 'from \'@/router\'' in line or 'from \'../router\'' in line:
                    break
            else:
                # Import useRouter
                import_line = None
                for i, line in enumerate(lines):
                    if 'from \'vue\'' in line:
                        import_line = i
                        break
                if import_line is not None:
                    # Add useRouter import
                    indent = lines[import_line][:len(lines[import_line]) - len(lines[import_line].lstrip())]
                    lines.insert(import_line + 1, f'{indent}import {{ useRouter }} from \'vue-router\'')
                    content = '\n'.join(lines)
    
    return content


def replace_toast_apis(content, filepath):
    """Replace uni.showToast / uni.showModal / uni.hideLoading."""
    content = re.sub(
        r'uni\.showToast\(\{[^}]*title:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
        r'showToast(\'\1\')',
        content
    )
    content = re.sub(
        r'uni\.showModal\(\{[^}]*content:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
        r'showConfirm(\'\', \'\1\')',
        content
    )
    content = re.sub(
        r'uni\.showModal\(\{[^}]*title:\s*[\'"]([^\'"]+)[\'"][^}]*content:\s*[\'"]([^\'"]+)[\'"][^}]*\}\)',
        r'showConfirm(\'\1\', \'\2\')',
        content
    )
    content = re.sub(
        r'uni\.hideLoading\(\)',
        '',  # no-op
        content
    )
    
    # Add import for showToast/showConfirm if needed
    if 'showToast(' in content or 'showConfirm(' in content:
        if 'from \'../utils/ui\'' not in content and 'from \'@/utils/ui\'' not in content:
            # Check if it's already imported
            need_import = True
            for line in content.split('\n'):
                if 'from' in line and 'utils/ui' in line:
                    need_import = False
                    break
            if need_import:
                # Find last import line
                lines = content.split('\n')
                last_import = -1
                for i, line in enumerate(lines):
                    if 'from' in line or 'import' in line:
                        last_import = i
                indent = '  ' if last_import >= 0 else ''
                lines.insert(last_import + 1, f'{indent}import {{ showToast, showConfirm }} from \'@/utils/ui\'')
                content = '\n'.join(lines)
    
    return content


def replace_tags(content, filepath):
    """Replace uni-app custom tags with HTML equivalents."""
    # Only apply to .vue files
    if not filepath.endswith('.vue'):
        return content
    
    # Don't touch the <template> and </template> lines themselves
    # Only replace inside template content
    
    # <view → <div
    content = re.sub(r'<(view)(\s|>|/)', r'<div\2', content)
    # </view> → </div>
    content = re.sub(r'</view>', '</div>', content)
    
    # <text → <span (but not </text>)
    content = re.sub(r'<(text)(\s|>|/)', r'<span\2', content)
    # </text> → </span>
    content = re.sub(r'</text>', '</span>', content)
    
    # <scroll-view → <div (with CSS class hint)
    content = re.sub(r'<scroll-view(\s|>)', r'<div\1', content)
    content = re.sub(r'</scroll-view>', '</div>', content)
    
    # <image → <img
    content = re.sub(r'<image(\s|>)', r'<img\1', content)
    # </image> → (remove)
    content = re.sub(r'</image>', '', content)
    
    # navigator with url → regular link with hash
    content = re.sub(r'<navigator\s+url="([^"]+)"', r'<router-link to="\1"', content)
    content = re.sub(r'</navigator>', '</router-link>', content)
    
    return content


def add_router_import(content, filepath):
    """Add router import if router.push/replace/back is used but no router import exists."""
    if 'router.push(' not in content and 'router.replace(' not in content and 'router.back()' not in content:
        return content
    
    # Already has import
    for line in content.split('\n'):
        if 'useRouter' in line or 'from \'@/router\'' in line or 'from \'vue-router\'' in line:
            return content
    
    # Add useRouter import after vue imports
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'from \'vue\'' in line:
            indent = line[:len(line) - len(line.lstrip())]
            lines.insert(i + 1, f'{indent}import {{ useRouter }} from \'vue-router\'')
            return '\n'.join(lines)
        if 'from \'vue-router\'' in line:
            return content
    
    return content


def main():
    src = os.path.expanduser('~/Current_Works/class_mansys/src')
    
    changes = 0
    for root, dirs, files in os.walk(src):
        for fname in files:
            if not (fname.endswith('.vue') or fname.endswith('.ts')):
                continue
            fpath = os.path.join(root, fname)
            
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                orig = f.read()
            
            content = orig
            
            # Apply transformations in order
            content = find_uni_app_imports(content)
            content = replace_onload_calls(content)
            content = replace_onshow_calls(content)
            content = replace_nav_apis(content, fpath)
            content = replace_toast_apis(content, fpath)
            content = replace_tags(content, fpath)
            content = add_router_import(content, fpath)
            
            if content != orig:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(content)
                changes += 1
                print(f'  ✏️  {fpath[len(src)+1:]}')
    
    print(f'\nTotal files changed: {changes}')


if __name__ == '__main__':
    main()
