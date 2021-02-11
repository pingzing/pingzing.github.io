function Rewrite-Url([string] $url) {
    # Find JS file
    [string] $jsContent = Get-Content -Path "$PSScriptRoot/output/site-scripts/comments.js" -Raw;

    #Rewrite 'var BASE_URL = "http://localhost:7071";`
    $jsContent = $jsContent.Replace('var BASE_URL = "http://localhost:7071/api";', 'var BASE_URL = "https://travelneil-backend.azurewebsites.net/api";');    
    Set-Content -Path "$PSScriptRoot/output/site-scripts/comments.js" $jsContent;
}

function HandleCompression([string] $folder) {
    $threadSafeBag = [System.Collections.Concurrent.ConcurrentBag[string]]::new();
    Get-ChildItem $folder -Recurse -File -Filter  "*.gz" | ForEach-Object -Parallel {        
        $bag = $using:threadSafeBag;
        $pathWithoutGz = $_.FullName.Replace(".gz", "");
        $bag.Add($pathWithoutGz);
        Move-Item -Path $_.FullName -Destination $pathWithoutGz -Force
    };
    return $threadSafeBag;
}

Write-Host "PSScriptRoot is: $PSScriptRoot";

Write-Host "Compiling TypeScript scripts...";
tsc -p './site-scripts';
Write-Host "...done. Rewriting BASE_URL to production URL...";
Rewrite-Url "https://travelneil-backend.azurewebsites.net";
Write-Host "...done. Engaging pelican.";
pelican content -o output -s publishconf.py;

Write-Host "Compressed version of site created. Removing extra files...";
$markedFiles = HandleCompression "$PSScriptRoot/output"
Write-Host "Compression complete. Publishing to Azure..."

# Use 'azcopy login' to get access if this fails.
& "C:\Users\mcali\azcopy\azcopy.exe" sync ./output "https://travelneil.blob.core.windows.net/`$web" --recursive --delete-destination true;

Write-Host "`nCopied to Azure storage. Setting Content-Encoding of files...`n";

$context = New-AzureStorageContext -StorageAccountName "travelneil" -StorageAccountKey $env:TravelNeilAzureKey;

$updateTasks = [System.Collections.ArrayList]@();
foreach ($compressed in $markedFiles) {
    $relativePath = $compressed.Replace("$PSScriptRoot\output\", "");
    $blob = Get-AzureStorageBlob -Context $context -Container '$web' -Blob $relativePath;
    $blob.ICloudBlob.Properties.ContentEncoding = "gzip";
    $updateBlobTask = $blob.ICloudBlob.SetPropertiesAsync();
    $updateTasks.Add($updateBlobTask);
}

[System.Threading.Tasks.Task]::WaitAll($updateTasks);

Write-Host "Updated Content-Encoding of all files, updating CacheControl of the important ones...`n";

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