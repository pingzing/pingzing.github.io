pelican content -o output -s publishconf.py 

Write-Host "Publish-ready version of site created. Copying to Azure Storage...`n"

# Env var is user-specific 
& 'C:\Program Files (x86)\Microsoft SDKs\Azure\AzCopy\AzCopy.exe' /Source:./output '/Dest:https://travelneil.blob.core.windows.net/$web/' /DestKey:$env:TravelNeilAzureKey /S /Y /SetContentType

Write-Host "`n Copied to Azure storage. Pushing to git.`n"