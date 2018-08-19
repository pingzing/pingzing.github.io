try {
    Push-Location
    Set-Location output/
    python -m pelican.server
}
finally {
    Pop-Location
}