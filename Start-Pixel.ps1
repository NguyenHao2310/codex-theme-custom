$ErrorActionPreference='Stop'
$port=19327
$log=Join-Path $PSScriptRoot 'trial.log'
try {
  if(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue){throw 'Hãy thoát hoàn toàn Codex/ChatGPT trước, rồi chạy lại Start-Pixel.cmd. Công cụ không tự đóng ứng dụng.'}
  # A closed app may leave TIME_WAIT rows. Test real connections, not those rows.
  $busy=$false
  for($attempt=0;$attempt -lt 20;$attempt++){
    $probe=[Net.Sockets.TcpClient]::new()
    try {$probe.ConnectAsync('127.0.0.1',$port).Wait(250) | Out-Null; $busy=$probe.Connected} catch {$busy=$false} finally {$probe.Dispose()}
    if(-not $busy){break};Start-Sleep -Milliseconds 500
  }
  if($busy){throw 'Cổng thử đang được dùng. Chưa khởi chạy.'}
  $package=Get-AppxPackage -Name OpenAI.Codex
  if(-not $package){throw 'Không tìm thấy gói OpenAI.Codex.'}
  $exe=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
  if(-not(Test-Path -LiteralPath $exe)){throw 'Không tìm thấy ChatGPT.exe.'}
  $node=(Get-Command node -ErrorAction Stop).Source
  Start-Process -FilePath $exe -ArgumentList '--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$port" -WindowStyle Hidden
  $ready=$false
  for($i=0;$i -lt 90;$i++){
    try {
      $version=Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 1
      if($version.webSocketDebuggerUrl){$ready=$true;break}
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if(-not $ready){throw 'Ứng dụng không mở endpoint CDP. Chưa chèn nền.'}
  $listener=Get-NetTCPConnection -LocalPort $port -ErrorAction Stop
  if(-not $listener){throw 'Không xác minh được địa chỉ CDP. Không chèn nền.'}
  if($listener | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}){throw 'Cổng CDP không giới hạn loopback! Hãy thoát ứng dụng ngay. Không chèn nền.'}
  $result=& $node (Join-Path $PSScriptRoot 'inject.mjs') 2>&1
  $result | Set-Content -LiteralPath $log -Encoding UTF8
  $result | Write-Output
  if($LASTEXITCODE -ne 0){throw 'Chèn nền thất bại. Xem trial.log.'}
} catch {
  $_ | Out-String | Set-Content -LiteralPath $log -Encoding UTF8
  throw
}
