# Travel Neil Blog source

The source files behind my Travel Neil blog.

## Local development

### Requirements:
 * Python 3.x, for Pelican
 * Some version of the TypeScript compiler installed, to run `tsc`.
 * The Azure Functions Core Tools installed. Probably the .NET SDK?

### How-to:
 * `pip install -r requirements.txt`
 * Start the local version of the Azure Functions backend by navigating to `/backend` and running `func start`.
 * Run `pelserve.ps1` to run a small HTTP server that serves up the `./output` directory.
 * Run `pelrun.ps1` to compile the TypeScript file, and make Pelican monitor the content files for changes.
 * Once started, the website is accessible at localhost:8000

 * Run `publish-to-azure.ps1` to publish.
 * TS lives in `/site-scripts`. 

Requirements for Azure upload: 
 * AzCopy: https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy
 * An environment variable named `TravelNeilAzureKey` that contains one of the Azure access keys for the storage account that hosts the website.