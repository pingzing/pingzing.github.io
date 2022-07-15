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

 ### Writing posts
 `{static}` must have a leading slash, i.e. `{sttaic}/path-relative-to-content`.
 `{photo}` results in a thumbnail, and is relative to the `{images}` folder
 The Python Markdown Attribute List Plugin (https://python-markdown.github.io/extensions/attr_list/) allows certain HTML attributes to be appended with syntax like this:
 `{: .someCssClass #someId somkey='some value'}`.
 Adding `markdown="1"` to a raw HTML element allows the text in its DIRECT child to be parsed as Markdown.