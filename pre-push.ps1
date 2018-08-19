pelican content -o output -s publishconf.py

# Env var is user-specific 
& 'C:\Program Files (x86)\Microsoft SDKs\Azure\AzCopy\AzCopy.exe' /Source:./output '/Dest:https://travelneil.blob.core.windows.net/$web/' /DestKey:$env:TravelNeilAzureKey /S /Y