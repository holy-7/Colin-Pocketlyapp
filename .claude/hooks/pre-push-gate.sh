#!/usr/bin/env bash
# ============================================================
# PreToolUse Hook — 测试质量门（git push 前置检查）
#
# 拦截所有含 "git push" 的 Bash 命令，检查测试通行证文件。
# - tester-result.txt = PASS  → 放行
# - tester-result.txt = FAIL  → 阻止，打印失败信息
# - tester-result.txt 不存在  → 阻止，提示先运行测试
# - 非 git push 命令          → 直接放行
# ============================================================
set -euo pipefail

HOOK_JSON=$(cat)

# 提取 tool_input 字段（Bash 命令字符串）
TOOL_INPUT=$(echo "$HOOK_JSON" | node -e "
  process.stdin.on('data', function(d) {
    try { console.log(JSON.parse(d).tool_input || '') }
    catch(e) { console.log('') }
  })
" 2>/dev/null)

# 不是 git push 命令，直接放行
if ! echo "$TOOL_INPUT" | grep -qi 'git[[:space:]]\+push'; then
  exit 0
fi

GATE_FILE=".claude/results/tester-result.txt"
REPORT_FILE=".claude/results/test-report.md"

# 检查通行证文件是否存在
if [ ! -f "$GATE_FILE" ]; then
  echo ""
  echo "⛔ ============================================"
  echo "  测试质量门：推送被阻止"
  echo "============================================"
  echo ""
  echo "  未找到测试通行证文件: $GATE_FILE"
  echo ""
  echo "  请通过 /git-manager 流程提交，它会自动触发测试。"
  echo "  或手动调用 test-engineer agent（Gate Mode）。"
  echo ""
  echo "============================================"
  echo ""
  exit 1
fi

# 读取通行证内容（第一行，去除空白）
RESULT=$(head -n1 "$GATE_FILE" | tr -d '[:space:]')

if [ "$RESULT" = "PASS" ]; then
  echo ""
  echo "✅ ============================================"
  echo "  测试质量门：全部通过"
  echo "============================================"
  echo ""
  exit 0
else
  echo ""
  echo "⛔ ============================================"
  echo "  测试质量门：推送被阻止"
  echo "============================================"
  echo ""
  echo "  测试结果: FAIL"
  echo "  详细报告: $REPORT_FILE"
  echo ""
  echo "——— 失败摘要 ———"
  cat "$GATE_FILE"
  echo ""
  echo "============================================"
  echo ""
  exit 1
fi
