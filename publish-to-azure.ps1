function Rewrite-Url([string] $url) {
    # Find JS file
    [string] $jsContent = Get-Content -Path "$PSScriptRoot/output/site-scripts/comments.js" -Raw;

    #Rewrite 'var BASE_URL = "http://localhost:7071";`
    $jsContent = $jsContent.Replace('var BASE_URL = "http://localhost:7071/api";', 'var BASE_URL = "https://travelneil-backend.azurewebsites.net/api";');    
    Set-Content -Path "$PSScriptRoot/output/site-scripts/comments.js" $jsContent;
}

Write-Host "Compiling TypeScript scripts...";
tsc -p './site-scripts';
Write-Host "...done. Rewriting BASE_URL to production URL...";
Rewrite-Url "https://travelneil-backend.azurewebsites.net";
Write-Host "...done. Engaging pelican.";
pelican content -o output -s publishconf.py;

Write-Host "Content generation complete. Publishing to Azure..."

# Use 'azcopy login' to get access if this fails.
& "C:\Users\mcali\azcopy\azcopy.exe" sync ./output "https://travelneil.blob.core.windows.net/`$web" --recursive --delete-destination true;

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey;

Write-Host "Copied to Azure storage. Updating CacheControl of the important files...`n";

$indexBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "index.html";
$indexBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$updateIndexMaxAgeTask = $indexBlob.ICloudBlob.SetPropertiesAsync();

$mainCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/main.css";
$mainCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$mainCssBlobUpdateTask = $mainCssBlob.ICloudBlob.SetPropertiesAsync();

$pygmentCssBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "theme/css/pygment.css";
$pygmentCssBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$pygmentCssBlobUpdateTask = $pygmentCssBlob.ICloudBlob.SetPropertiesAsync();

$commentsJsBlob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob "site-scripts/comments.js";
$commentsJsBlob.ICloudBlob.Properties.CacheControl = "max-age=300";
$commentsJsBlob.ICloudBlob.Properties.ContentType = "text/javascript; charset=utf-8"
$commentsJsBlobUpdateTask = $commentsJsBlob.ICloudBlob.SetPropertiesAsync();

[System.Threading.Tasks.Task]::WaitAll($updateIndexMaxAgeTask, $mainCssBlobUpdateTask, $pygmentCssBlobUpdateTask, $commentsJsBlobUpdateTask);

Write-Host "Finished setting max ages.`n All done!";