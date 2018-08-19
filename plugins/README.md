# Travel Neil Blog source

The source files behind my Travel Neil blog. There's a pre-push hook set up to automatically upload to Azure on push.

Requirements for Azure upload:
 * AzCopy: https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy
 * An environment variable named `TravelNeilAzureKey` that contains one of the Azure access keys for the storage account that hosts the website.
 * Push operations should be run from the repo root (as that's where the hook expects to find the PowerShell script)