#!/bin/bash
# 安全批量替换 — 仅替换简单模式，不碰 showModal/setClipboardData/chooseImage
# 用法: cd class_mansys && bash scripts/safe_replace.sh

set -e
SRC="src"

echo "=== 1/3: uni.showToast → showToast ==="
# Pattern: uni.showToast({ title: X, icon: 'none' }) → showToast(X, 'error')
find "$SRC" -name '*.vue' -o -name '*.ts' ! -path '*/shims/*' ! -path '*/dist/*' | while read f; do
  # showToast with icon='none'
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,}]+?),\s*icon:\s*'"'"'none'"'"'\s*\}\)/showToast($1, '"'"'error'"'"')/g' "$f"
  # showToast with icon="none"
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,}]+?),\s*icon:\s*"none"\s*\}\)/showToast($1, '"'"'error'"'"')/g' "$f"
  # showToast with icon='success'
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,}]+?),\s*icon:\s*'"'"'success'"'"'\s*\}\)/showToast($1, '"'"'success'"'"')/g' "$f"
  # showToast with icon="success"  
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,}]+?),\s*icon:\s*"success"\s*\}\)/showToast($1, '"'"'success'"'"')/g' "$f"
  # showToast with duration
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,}]+?),\s*icon:\s*'"'"'none'"'"'\s*,\s*duration:\s*\d+\s*\}/showToast($1, '"'"'error'"'"')/g' "$f"
  # showToast without icon
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^}]+?)\s*\}/showToast($1)/g' "$f"
done

echo "=== 2/3: uni.showLoading → showToast ==="
find "$SRC" -name '*.vue' -o -name '*.ts' ! -path '*/shims/*' ! -path '*/dist/*' | while read f; do
  perl -i -pe 's/uni\.showLoading\(\{ title:\s*([^}]+?)\s*\}/showToast($1)/g' "$f"
done

echo "=== 3/3: uni.navigateTo → router.push ==="
find "$SRC" -name '*.vue' -o -name '*.ts' ! -path '*/shims/*' ! -path '*/dist/*' | while read f; do
  perl -i -pe 's/uni\.navigateTo\(\{ url:\s*([^}]+?)\s*\}/router.push($1)/g' "$f"
done

echo "=== 完成！==="
