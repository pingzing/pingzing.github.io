Write-Host "Compiling TypeScript scripts..."
tsc -p './scripts'
Write-Host "...done. Engaging pelican.";
pelican content --debug --verbose --autoreload --output output --settings pelicanconf.py