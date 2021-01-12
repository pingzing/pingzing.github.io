try {
    Push-Location
    Set-Location output/
    & "C:\Program Files\Python36\python.exe" -m pelican.server
}
finally {
    Pop-Location
}