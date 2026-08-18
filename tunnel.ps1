# Запускает lilbrumessage (порт 4000) + Cloudflare-туннель, печатает свежий адрес.
# Требование: WARP включён (Cloudflare Zero Trust / WARP клиент).
param(
  [string]$Root = "C:\Users\itired\Downloads\ва\ва"
)

$cf = "C:\Windows\TEMP\opencode\cloudflared\cloudflared.exe"
if (-not (Test-Path -LiteralPath $cf)) {
  Write-Error "Нет cloudflared. Скачай: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe в C:\Windows\TEMP\opencode\cloudflared\cloudflared.exe"
  exit 1
}

$listening = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Process -FilePath "node" -ArgumentList "dist\index.js" -WorkingDirectory "$Root\server" -RedirectStandardOutput "C:\Windows\TEMP\opencode\server.log" -RedirectStandardError "C:\Windows\TEMP\opencode\server.err.log"
  Start-Sleep -Seconds 3
}
Write-Output "Сервер: http://localhost:4000  ($(if ((Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue)) { 'OK' } else { 'FAIL' }))"

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://localhost:4000","--protocol","http2","--no-autoupdate" -RedirectStandardOutput "C:\Windows\TEMP\opencode\cf.log" -RedirectStandardError "C:\Windows\TEMP\opencode\cf.err.log"

$url = $null
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 4
  $m = Get-Content "C:\Windows\TEMP\opencode\cf.err.log" -ErrorAction SilentlyContinue | Select-String -Pattern "trycloudflare.com" | Select-Object -Last 1
  if ($m -and $m.Line -match "(https://[a-z0-9-]+\.trycloudflare\.com)") {
    $url = $Matches[1]
    break
  }
}
if ($url) {
  Write-Output ""
  Write-Output "САЙТ ДОСТУПЕН: $url"
  Write-Output "Совет: держи WARP включённым, пока скрипт работает."
} else {
  Write-Output ""
  Write-Output "Адрес не получен. Проверь WARP и логи: C:\Windows\TEMP\opencode\cf.err.log"
  exit 1
}
