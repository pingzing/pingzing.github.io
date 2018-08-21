pelican content -o output -s publishconf.py 

Write-Host "Publish-ready version of site created. Copying to Azure Storage...`n"

# Env var is user-specific 
& 'C:\Program Files (x86)\Microsoft SDKs\Azure\AzCopy\AzCopy.exe' /Source:./output '/Dest:https://travelneil.blob.core.windows.net/$web/' /DestKey:$env:TravelNeilAzureKey /S /Y /SetContentType /XO

Write-Host "`n Copied to Azure storage. Setting cache-control of index.html...`n"

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey
$blob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "index.html"
$blob.ICloudBlob.Properties.CacheControl = "max-age=300"
$blob.ICloudBlob.SetPropertiesAsync().GetAwaiter().GetResult()

Write-Host "`n Finished setting index.html's max age. Pushing to git...`n"