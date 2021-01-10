pelican content -o output -s publishconf.py;

Write-Host "Publish-ready version of site created. Copying to Azure Storage...";

# Use 'azcopy login' to get access.
& "C:\Users\mcali\azcopy\azcopy.exe" sync ./output "https://travelneil.blob.core.windows.net/`$web" --recursive --delete-destination true;

Write-Host "`nCopied to Azure storage. Setting cache-control of index.html, main.css and pygment.css...`n";

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey;
$indexBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "index.html";
$indexBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$updateIndexMaxAgeTask = $indexBlob.ICloudBlob.SetPropertiesAsync();

$mainCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/main.css";
$mainCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$mainCssBlobUpdateTask = $mainCssBlob.ICloudBlob.SetPropertiesAsync();

$pygmentCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/pygment.css";
$pygmentCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$pygmentCssBlob = $pygmentCssBlob.ICloudBlob.SetPropertiesAsync();

[System.Threading.Tasks.Task]::WaitAll($updateIndexMaxAgeTask, $mainCssBlobUpdateTask, $pygmentCssBlob);

Write-Host "Finished setting index.html's, main.css's and pygment.css's max age.";