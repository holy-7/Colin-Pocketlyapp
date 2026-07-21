#!/usr/bin/env bash
# ============================================================
# PostToolUse Hook — 推送成功后清理测试通行证
#
# git push 成功后自动删除 tester-result.txt，
# 避免影响下一次提交。
# 如果推送失败，保留通行证文件以便重试。
# ============================================================
set -euo pipefail

HOOK_JSON=$(cat)

# 提取 tool_input 和 tool_response.exitCode
TOOL_INPUT=$(echo "$HOOK_JSON" | node -e "
  process.stdin.on('data', function(d) {
    try { console.log(JSON.parse(d).tool_input || '') }
    catch(e) { console.log('') }
  })
" 2>/dev/null)

EXIT_CODE=$(echo "$HOOK_JSON" | node -e "
  process.stdin.on('data', function(d) {
    try {
      var resp = JSON.parse(d).tool_response;
      console.log(resp && typeof resp === 'object' ? (resp.exitCode !== undefined ? resp.exitCode : -1) : -1)
    } catch(e) { console.log(-1) }
  })
" 2>/dev/null)

# 不是 git push 命令，不处理
if ! echo "$TOOL_INPUT" | grep -qi 'git[[:space:]]\+push'; then
  exit 0
fi

GATE_FILE=".claude/results/tester-result.txt"

if [ "$EXIT_CODE" = "0" ] && [ -f "$GATE_FILE" ]; then
  rm "$GATE_FILE"
  echo ""
  echo "🧹 ============================================"
  echo "  推送成功 — 已清理测试通行证文件"
  echo "============================================"
  echo ""
else
  # 推送失败或文件已不存在，静默退出
  :
fi

exit 0
