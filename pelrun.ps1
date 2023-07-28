Write-Host "Compiling TypeScript scripts..."
npx tsc -p './site-scripts'
Write-Host "...done. Engaging pelican.";
pelican content --debug --verbose --autoreload --output output --settings pelicanconf.py