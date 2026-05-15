#!/bin/bash
# 批量替换残余 uni.* API 调用
# 用法: cd class_mansys && bash scripts/migrate-uni-remaining.sh

set -e
SRC_DIR="src"

echo "=== 1/9: uni.navigateTo → router.push ==="
# Pattern: uni.navigateTo({ url: STRING })
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  # uni.navigateTo({ url: X }) → router.push(X)
  perl -i -pe 's/uni\.navigateTo\(\{ url:\s*([^}]+)\s*\}\)/router.push($1)/g' "$f"
done

echo "=== 2/9: uni.showLoading → showToast ==="
# uni.showLoading({ title: '...', mask: true }) or uni.showLoading({ title: '...' })
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.showLoading\(\{ title:\s*([^}]+)\s*\}(?:,\s*mask:\s*(?:true|false))?\}\)/showToast($1)/g' "$f"
done

echo "=== 3/9: uni.showToast → showToast ==="
# uni.showToast({ title: X, icon: 'none', duration: N })
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,]+),\s*icon:\s*'"'"'none'"'"'(?:,\s*duration:\s*\d+)?\}\)/showToast($1, '"'"'error'"'"')/g' "$f"
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^,]+),\s*icon:\s*'"'"'success'"'"'(?:,\s*duration:\s*\d+)?\}\)/showToast($1, '"'"'success'"'"')/g' "$f"
  # uni.showToast({ title: X }) — no icon
  perl -i -pe 's/uni\.showToast\(\{ title:\s*([^}]+)\s*\}\)/showToast($1)/g' "$f"
done

echo "=== 4/9: uni.setClipboardData → navigator.clipboard ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.setClipboardData\(\{ data:\s*([^}]+)\s*\}/navigator\.clipboard\.writeText($1)/g' "$f"
done

echo "=== 5/9: uni.removeStorageSync → localStorage.removeItem ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.removeStorageSync\(([^)]+)\)/localStorage\.removeItem($1)/g' "$f"
done

echo "=== 6/9: uni.getStorageSync → localStorage.getItem (with JSON.parse wrapper) ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.getStorageSync\(([^)]+)\)/JSON\.parse(localStorage\.getItem($1) || '"'"'null'"'"')/g' "$f"
done

echo "=== 7/9: uni.setStorageSync → localStorage.setItem (no JSON.stringify added — data is already string) ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.setStorageSync\(([^,]+),\s*([^)]+)\)/localStorage\.setItem($1, $2)/g' "$f"
done

echo "=== 8/9: uni.redirectTo → router.replace ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.redirectTo\(\{ url:\s*([^}]+)\s*\}/router\.replace($1)/g' "$f"
done

echo "=== 9/9: uni.reLaunch → router.replace ==="
find "$SRC_DIR" -name '*.vue' -o -name '*.ts' | while read f; do
  perl -i -pe 's/uni\.reLaunch\(\{ url:\s*([^}]+)\s*\}/router\.replace($1)/g' "$f"
done

echo "=== Done! ==="
