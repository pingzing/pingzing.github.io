pelican content -o output -s publishconf.py 

Write-Host "Publish-ready version of site created. Copying to Azure Storage...`n"

# Env var is user-specific 
& 'C:\Program Files (x86)\Microsoft SDKs\Azure\AzCopy\AzCopy.exe' /Source:./output '/Dest:https://travelneil.blob.core.windows.net/$web/' /DestKey:$env:TravelNeilAzureKey /S /Y /SetContentType /XO

Write-Host "`n Copied to Azure storage. Setting cache-control of index.html and main.css...`n"

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey
$indexBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "index.html"
$indexBlob.ICloudBlob.Properties.CacheControl = "max-age=300"
$updateIndexMaxAgeTask = $indexBlob.ICloudBlob.SetPropertiesAsync()

$mainCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/main.css"
$mainCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300"
$mainCssBlobUpdateTask = $mainCssBlob.ICloudBlob.SetPropertiesAsync()

[System.Threading.Tasks.Task]::WaitAll($updateIndexMaxAgeTask, $mainCssBlobUpdateTask)

Write-Host "Finished setting index.html's max age. Pushing to git...`n"