#!/usr/bin/env python3
"""Fix misplaced imports in .vue files - only modify within <script> block."""
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
        
        # Remove ALL import statements that are NOT at the top level (in <script>)
        # Strategy: extract <script> block, fix it, put it back
        
        def fix_script(match):
            script_content = match.group(1)
            
            # Remove all existing import lines
            lines = script_content.split('\n')
            clean_lines = []
            vue_imports = set()
            router_imports = set()
            other_imports = {}
            
            for line in lines:
                stripped = line.strip()
                # Check if it's an import line
                m = re.match(r'(\s*)(import\s+\{[^}]+\}\s+from\s+[\'"]([^\'"]+)[\'"])', line)
                if m:
                    indent = m.group(1)
                    from_path = m.group(3)
                    if from_path == 'vue':
                        # Extract what's imported
                        items = re.findall(r'\{([^}]+)\}', m.group(2))[0]
                        for item in items.split(','):
                            vue_imports.add(item.strip())
                    elif from_path == 'vue-router':
                        items = re.findall(r'\{([^}]+)\}', m.group(2))[0]
                        for item in items.split(','):
                            router_imports.add(item.strip())
                    else:
                        # Preserve other imports in order
                        if from_path not in other_imports:
                            other_imports[from_path] = (indent, line.strip())
                    continue
                
                # Also handle type-only imports and default imports
                m2 = re.match(r'(\s*)(import\s+\S+(?:,\s*\{[^}]+\})?\s+from\s+[\'"]([^\'"]+)[\'"])', line)
                if m2:
                    from_path = m2.group(3)
                    if from_path not in other_imports and from_path not in ('vue', 'vue-router'):
                        other_imports[from_path] = (m2.group(1), line.strip())
                    continue
                
                clean_lines.append(line)
            
            # Build new import block
            new_imports = []
            
            # Vue imports first
            if vue_imports:
                sorted_vue = sorted(vue_imports)  # Sort for consistency
                new_imports.append(f"import {{ {', '.join(sorted_vue)} }} from 'vue'")
            
            # Router imports
            if router_imports:
                sorted_router = sorted(router_imports)
                new_imports.append(f"import {{ {', '.join(sorted_router)} }} from 'vue-router'")
            
            # Other imports (preserve order)
            for path, (indent, line_text) in other_imports.items():
                new_imports.append(line_text.lstrip())
            
            # Insert new imports at the top of script (after any opening blank/template lines)
            # Find first non-import, non-comment, non-blank line
            insert_pos = 0
            for i, line in enumerate(clean_lines):
                stripped = line.strip()
                if stripped == '' or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
                    insert_pos = i + 1
                else:
                    break
            
            new_lines = clean_lines[:insert_pos]
            for imp in new_imports:
                new_lines.append(imp)
            new_lines.extend(clean_lines[insert_pos:])
            
            return '\n'.join(new_lines)
        
        content = re.sub(
            r'<script[^>]*>([\s\S]*?)</script>',
            lambda m: f'<script setup lang="ts">\n{fix_script(m)}\n</script>',
            content,
            count=1
        )
        
        if content != orig:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            fixed += 1
    
    if fixed > 0 and fixed % 20 == 0:
        print(f'  ... {fixed} files')

print(f'\nFixed: {fixed} files')
