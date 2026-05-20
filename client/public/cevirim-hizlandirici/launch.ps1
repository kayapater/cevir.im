$AppDir = $PSScriptRoot
$NodeDir = Join-Path $AppDir "node_portable"
$NodeZip = Join-Path $AppDir "node.zip"

Clear-Host
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "      Cevir.im Entegre Donanim Hizlandirici   " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Portable Node.js kontrolü
if (-not (Test-Path $NodeDir)) {
    Write-Host "[*] Node.js (Portatif) indiriliyor..." -ForegroundColor Yellow
    
    # We use Node v20.11.0 portable zip
    $NodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"
    
    # Download
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    
    # Extract
    Write-Host "[*] Node.js kuruluyor..." -ForegroundColor Yellow
    Expand-Archive -Path $NodeZip -DestinationPath $AppDir
    
    # Rename extracted directory to node_portable
    $ExtractedFolder = Join-Path $AppDir "node-v20.11.0-win-x64"
    Rename-Item -Path $ExtractedFolder -NewName "node_portable"
    
    # Remove temp zip
    Remove-Item $NodeZip -Force
    Write-Host "[+] Node.js basariyla kuruldu." -ForegroundColor Green
}

# Add node_portable to env PATH for this session only
$env:PATH = "$NodeDir;" + $env:PATH

$NodeBin = Join-Path $NodeDir "node.exe"
$NpmBin = Join-Path $NodeDir "npm.cmd"

# 2. Dependency kontrolü ve kurulumu
$NodeModules = Join-Path $AppDir "node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "[*] Bilesenler ve FFmpeg Donanim Hizlandirici yukleniyor..." -ForegroundColor Yellow
    Write-Host "    (Bu islem baglantiniza bagli olarak 1-2 dakika surebilir)" -ForegroundColor Gray
    
    # Run npm install using start-process to wait for it
    $installProc = Start-Process -FilePath $NpmBin -ArgumentList "install" -WorkingDirectory $AppDir -PassThru -NoNewWindow -Wait
    
    if ($installProc.ExitCode -eq 0) {
        Write-Host "[+] Bilesenler basariyla yuklendi." -ForegroundColor Green
    } else {
        Write-Host "[-] Hata: Bilesenler yuklenirken hata olustu. Exit code: $($installProc.ExitCode)" -ForegroundColor Red
        Exit 1
    }
}

# 3. Sunucuyu Başlatma
Write-Host ""
Write-Host "[+] Her sey hazir! Hizlandirici sunucusu baslatiliyor..." -ForegroundColor Green
Write-Host "[i] Bu pencere acik kaldigi surece web sitesinde donanim hizlandirma aktif olacaktir." -ForegroundColor Cyan
Write-Host "[i] Kapatmak icin bu pencereyi kapatabilir veya Ctrl+C tuslarina basabilirsiniz." -ForegroundColor Gray
Write-Host ""

# Run the node app directly in this console so logs are visible
& $NodeBin "server.js"
