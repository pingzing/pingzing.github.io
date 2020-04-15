pelican content -o output -s publishconf.py 

Write-Host "Publish-ready version of site created. Copying to Azure Storage..."

# Env var is an SAS-token that has full access to the $web resource in my azure account. It expires Dec 20, 2020. 
& "C:\Users\mcali\azcopy\azcopy.exe" sync ./output "https://travelneil.blob.core.windows.net/`$web?$env:TravelNeil2020SasKey" --recursive --delete-destination true

Write-Host "`nCopied to Azure storage. Setting cache-control of index.html and main.css...`n"

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey
$indexBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "index.html"
$indexBlob.ICloudBlob.Properties.CacheControl = "max-age=300"
$updateIndexMaxAgeTask = $indexBlob.ICloudBlob.SetPropertiesAsync()

$mainCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/main.css"
$mainCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300"
$mainCssBlobUpdateTask = $mainCssBlob.ICloudBlob.SetPropertiesAsync()

[System.Threading.Tasks.Task]::WaitAll($updateIndexMaxAgeTask, $mainCssBlobUpdateTask)

Write-Host "Finished setting index.html's and main.css's max age."