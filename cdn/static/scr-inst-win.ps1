# Define vars
$folderPath = "C:\installs\scripted-install-temp"
$bundleURL = "https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Installers/Builds/bundle.zip"
# Made temp folder
if (-not (Test-Path -Path $folderPath)) { # Check if the folder exists
    New-Item -Path $folderPath -ItemType Directory -Force # Create the folder and ensure all folders in the path exist
}
# Down source build
$markerFilePath = Join-Path -Path $folderPath -ChildPath "wasdown.empty"
if (-not (Test-Path -Path $markerFilePath)) {
    Invoke-WebRequest -Uri $bundleURL -OutFile "$folderPath\bundle.zip"
    Expand-Archive -Path "$folderPath\bundle.zip" -DestinationPath $folderPath -Force
    New-Item -Path $markerFilePath -ItemType File -Force
    Remove-Item -Path "$folderPath\bundle.zip" -Force
}
# Run windows.bat
$batchFilePath = Join-Path -Path $folderPath -ChildPath "windows.bat"
if (Test-Path -Path $batchFilePath -PathType Leaf) {
    Start-Process -FilePath $batchFilePath -NoNewWindow
} else {
    Write-Host "Batch file not found: $batchFilePath"
}