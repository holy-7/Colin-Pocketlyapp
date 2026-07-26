# Create desktop shortcut for Colin Accounting
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Colin记账.lnk"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = "D:\nodeJs\node24\npm.cmd"
$s.Arguments = "run dev"
$s.WorkingDirectory = "d:\Agent\Colin项目库\Colin记账"
$s.Description = "Colin记账 - AI对话式财务助手"
$s.Save()

Write-Output "Desktop shortcut created: $shortcutPath"
