$AppDir = $PSScriptRoot
$NodeDir = Join-Path $AppDir "node_portable"
$NodeZip = Join-Path $AppDir "node.zip"

Clear-Host
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "      Cevir.im Entegre Donanim Hizlandirici   " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Port 5000 kontrolü (Zaten çalışıyorsa tekrar başlatma)
$portActive = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($portActive) {
    Write-Host "[+] Hizlandirici zaten arka planda aktif ve calisiyor!" -ForegroundColor Green
    Write-Host "[i] Tarayicidan Cevir.im sitesine girerek kullanmaya baslayabilirsiniz." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    Exit
}

# 1. Portable Node.js kontrolü ve kurulumu
if (-not (Test-Path $NodeDir)) {
    Write-Host "[*] Node.js (Portatif) indiriliyor..." -ForegroundColor Yellow
    $NodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    
    Write-Host "[*] Node.js kuruluyor..." -ForegroundColor Yellow
    Expand-Archive -Path $NodeZip -DestinationPath $AppDir
    Rename-Item -Path (Join-Path $AppDir "node-v20.11.0-win-x64") -NewName "node_portable"
    Remove-Item $NodeZip -Force
    Write-Host "[+] Node.js kuruldu." -ForegroundColor Green
}

# Env PATH'e ekle (Sadece bu oturum için)
$env:PATH = "$NodeDir;" + $env:PATH
$NodeBin = Join-Path $NodeDir "node.exe"
$NpmBin = Join-Path $NodeDir "npm.cmd"

# 2. Bağımlılıkların kontrolü ve kurulumu
$NodeModules = Join-Path $AppDir "node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "[*] Bilesenler ve FFmpeg Donanim Hizlandirici yukleniyor..." -ForegroundColor Yellow
    Write-Host "    (Bu islem baglantiniza bagli olarak 1-2 dakika surebilir)" -ForegroundColor Gray
    
    $installProc = Start-Process -FilePath $NpmBin -ArgumentList "install" -WorkingDirectory $AppDir -PassThru -NoNewWindow -Wait
    if ($installProc.ExitCode -eq 0) {
        Write-Host "[+] Bilesenler yuklendi." -ForegroundColor Green
    } else {
        Write-Host "[-] Hata: Bilesenler yuklenemedi. Exit: $($installProc.ExitCode)" -ForegroundColor Red
        Exit 1
    }
}

# 3. Otomatik Başlangıca Ekleme (Windows Startup)
try {
    $StartupFolder = [System.Environment]::GetFolderPath('Startup')
    $ShortcutPath = Join-Path $StartupFolder "CevirimHizlandirici.lnk"
    if (-not (Test-Path $ShortcutPath)) {
        Write-Host "[*] Hizlandirici Windows baslangicina ekleniyor..." -ForegroundColor Yellow
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = Join-Path $AppDir "baslat.bat"
        $Shortcut.WorkingDirectory = $AppDir
        $Shortcut.WindowStyle = 7 # Minimized/Hidden
        $Shortcut.Save()
        Write-Host "[+] Baslangica eklendi! Bilgisayar her acildiginda otomatik calisacaktir." -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Uyarici: Otomatik baslangica eklenemedi (Yetki sorunu)." -ForegroundColor Yellow
}

# 4. Sunucuyu Arka Planda (Gizli Pencereyle) Başlatma
Write-Host ""
Write-Host "[+] Hizlandirici arka planda baslatiliyor..." -ForegroundColor Green
Write-Host "[i] Sunucu artik gizli modda calisiyor. Bu pencereyi kapatabilirsiniz!" -ForegroundColor Cyan
Write-Host ""

Start-Process -FilePath $NodeBin -ArgumentList "server.js" -WorkingDirectory $AppDir -WindowStyle Hidden

Start-Sleep -Seconds 3
