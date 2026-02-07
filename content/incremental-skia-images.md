Title: Incremental Image Loading with SkiaSharp
Date: 2026-02-07 16:42
Category: programming
Tags: programming, c#, windows, skia, skiasharp, images, incrementalDecode(), startIncrementalDecode()
Slug: incremental-image-loading-skiasharp
Authors: Neil McAlister
Summary: Load images a little bit at a time, for slow connections. Using SkiaSharp.
image: {photo}incremental_image_cover.png
teaser: <p>This blog post is about how to, in C#, using SkiaSharp, download an image and  display it incrementally, as it downloads. Browsers do it, but most native app toolkits' Image widgets don't, and don't offer the option to do so. If you're on a slow or spotty connection, that sucks.</p>

This is about how to, in C#, using SkiaSharp, download an image and  display it incrementally, as it downloads. Browsers do it, but most native app toolkits' Image widgets don't, and don't offer the option to do so. If you're on a slow or spotty connection, that sucks.

This blog post mostly exists for my own benefit, but also because I was angry that I couldn't find any
reference material on the internet about this specific problem, and had to figure it out myself. Hopefully
it helps someone else who runs into the same issue.

## Setting Up

Okay. Let's just get right to it. For context, the demo application I'm creating:

 - Is written in C#
 - Is a WinUI 3 application (packaged, but it doesn't really matter here)
 - Is explicitly a toy, because I just wanted to see how to do this

If you don't care about all this, and just want to see the code, cool beans. [Check it out on GitHub](https://github.com/pingzing/incrementalimageloading).

This thing uses two Skia-flavored packages to get WinUI talking to Skia:

 - [SkiaSharp](https://www.nuget.org/packages/SkiaSharp/) (I'm using 3.116.1)
 - [SkiaSharp.Views.WinUI](https://www.nuget.org/packages/SkiaSharp.Views.WinUI/). This gives you a control that you can draw Skia Stuff(tm) onto easily. If you're using a different GUI framework, choose the `SkiaSharp.Views.WhateverPackageIsAppropriate` for your platform.

 (Note that if you're using Avalonia, the process for doing Skia Stuff is a little different because Avalonia uses Skia internally. [This GitHub discussion](https://github.com/AvaloniaUI/Avalonia/discussions/13527) has some details, but I haven't done it myself.)

 
#### Intentionally Throttling Your Connection

 Also, this is really hard to test if you're on a good, fast desktop connection. On Windows, you can intentionally
 throttle connection speeds at the individual app level using QoS settings. There's a PowerShell cmdlet
 to do it:

```pwsh
Set-NetQosPolicy -Name "<Policy Name Here>" -AppPathNameMatchCondition "IncrementalImageLoading.exe" -ThrottleRateActionBitsPerSecond 32KB; 
```

 The `AppPathNameMatchCondition` needs to match the executable name. The `ThrottleRateActionBitsPerSecond` arg can either take a human-readable string like `16KB`, or just an actual number of bits-per-second.

 (I have no idea what you'd do on Linux or macOS. Presumably there are tools.)

## The Code

This is a toy app, so it doesn't do anything _too_ fancy. There's one window, with some ultra-basic UI:

**MainWindow.xaml**
```xml
<Window
    <!-- Blah blah namespace import boilerplate goes here.  Note that you'll want to include a namespace 
    import for the SkiaSharp.Views, so you can use its SKXamlCanvas. In my case, I did 
    the following:
    xmlns:skia="using:SkiaSharp.Views.Windows"
    -->
>
    <Grid HorizontalAlignment="Stretch" VerticalAlignment="Stretch" RowDefinitions="Auto, *">
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center" Spacing="15" Margin="0 15 0 0">
            <Button x:Name="DownloadButton" 
                    Content="Download Image"
                    Click="DownloadButton_Click" />
            <Button x:Name="ClearButton"
                    Content="Clear"
                    Click="ClearButton_Click"/>
        </StackPanel>

        <ScrollView Grid.Row="1" VerticalScrollBarVisibility="Visible">
            <skia:SKXamlCanvas x:Name="SkiaCanvas"
                                HorizontalAlignment="Stretch"
                                VerticalAlignment="Stretch"
                                PaintSurface="SKiaCanvas_OnPaint"/>
        </ScrollView>
    </Grid>
</Window>
```

Two buttons, and a Skia canvas inside a ScrollView in case the image is larger than the window. Easy-peasy.

Here's our starting point:

**MainWindow.xaml.cs**
```csharp
// usings and namespace declaration snipped for space

public sealed partial class MainWindow : Window
{
    private readonly HttpClient _httpClient = new HttpClient();
    private SKBitmap? _skImage;

    public MainWindow()
    {
        this.InitializeComponent();
    }

    private void DownloadButton_Click(object sender, RoutedEventArgs e)
    {
        _ = Task.Run(async () =>
        {
            HttpResponseMessage? response = await _httpClient.GetAsync(
                // It's a happy Fluttershy in a box, if you're wondering. Nice big 1.3MB PNG file.
                "https://derpicdn.net/img/view/2019/9/22/2150503.png",
                HttpCompletionOption.ResponseHeadersRead
            );

            if (response == null || !response.IsSuccessStatusCode)
            {
                Debug.WriteLine("Response failure. Boo.");
                return;
            }
            
            Stream imageStream = await response.Content.ReadAsStreamAsync();

            int initialReadSize = 1024;
            int readChunkSize = 16384;

            byte[] copyBuffer = new byte[readChunkSize];
            int totalBytesRead = await imageStream.ReadAtLeastAsync(
                copyBuffer,
                initialReadSize,
                throwOnEndOfStream: false
            );

            var bufferStream = new MemoryStream();
            bufferStream.Write(copyBuffer, 0, totalBytesRead);
            // Rewind the stream so that the decoder starts at the beginning
            bufferStream.Position -= totalBytesRead;
        });

        // More code to follow...
    }
}
```

This is all in a `Task.Run()` call so we're not doing it on the main UI thread. Otherwise, that'd defeat the
point of doing incremental loading, as the whole UI would lock up until download and rendering was complete.

We make the HTTP call with `HttpCompletionOption.ResponseHeadersRead`, so that the .NET HttpClient returns the 
data stream as soon as possible, instead of just giving us one big blob once it's done.

We read the first 1024 bytes to give Skia a fighting chance at figuring out what kind of image this is. I tried
smaller amounts, but that gave me occasional failures that I didn't have the patience to debug. If you have an 
image that's smaller than 1KB, well, this will just blow up. ¯\\\_(ツ)_/¯

We copy from the HTTP stream into a MemoryStream, because .NET HttpClient HTTP streams can't be rewound, and we need to rewind it once we've read those initial 1024 bytes. Otherwise, once we hand Skia the MemoryStream, the Stream pointer would be at the _end_ of the stream, and Skia would read 0 bytes (and blow up).

#### Streamin'

Okay. Let's flesh out our click handler a little further. Let's go do something with that HTTP stream of ours.

In order to do an incremental decode, we need the following:

- A stream containing our data _that can be rewound_, because Skia likes to rewind the Stream as it goes
- An `SKCodec`
- An `SKBitmap` with enough bytes allocated to hold the decoded image
- The memory address of that `SKBitmap`
- A PNG or (static) GIF image (!)

Let's add some more code where left off:

```csharp
// Previous block of code is above ^

// Also, this is a class member variable, pretend it's in class-scope here:
private SKBitmap? _skImage = null;
// ---

using var skCodec = SKCodec.Create(bufferStream, out SKCodecResult codecResult);
if (codecResult != SKCodecResult.Success)
{
    Debug.WriteLine($"Failed to create SKCodec. Result was: {codecResult}");
    return;
}

var info = new SKImageInfo(skCodec.Info.Width, skCodec.Info.Height);

_skImage?.Dispose();
_skImage = new SKBitmap(info);

IntPtr bitmapAddress = _skImage.GetPixels(out _);
```

So, we've got all our bullet points here:  

* We already set up the MemoryStream in the previous block. That's our `bufferStream`.
* Setting up the `skCodec` is the first thing we do in this block. We hand it those first 1024 bytes, and it
figures out what kind of image it's dealing with, and its width and height.
* We create a new `SKBitmap` named `_skImage` using the information that from our `SKCodec`.
* We get the memory address of our newly-allocated `SKBitmap` by calling `.GetPixels()` on it.
* ...and I know ahead of time that this is a PNG. If you wanted this to be more than a toy, you'd probably 
inspect the `SKCodec` to see what kind of image you were dealing with, and do different things appropriately. 
The reason we need a PNG or a static GIF is that Skia's `IncrementalDecode()` only supports those two image 
types. There are `StartScanlineDecode()` and `GetScanlines()` methods on `SKCodec` which are supposed to work  for JPEGs or BMPs, but I didn't test those.

Also, note that I'm getting an `out SKCodecResult codecResult` when I call `SKCodec.Create()`? That's basically your only tool to detect failures--otherwise, you just get a null `SKCodec`, and no further information.


We're almost to the actual incremental part. Here we go.

```csharp
SKCodecResult decodeResult = skCodec.StartIncrementalDecode(
    info,
    bitmapAddress,
    info.RowBytes
);

if (decodeResult != SKCodecResult.Success)
{
    Debug.WriteLine("Instead of start decoding success, got: " + decodeResult);
    return;
}

int bytesRead;
decodeResult = SKCodecResult.IncompleteInput;
while (decodeResult == SKCodecResult.IncompleteInput)
{
    decodeResult = skCodec.IncrementalDecode(out int rowDecoded);

    if (decodeResult == SKCodecResult.Success)
    {
        Debug.WriteLine("DecodeResult success, breaking.");
        break;
    }

    // Buffer a bit more of the HTTP stream
    bytesRead = imageStream.Read(copyBuffer, 0, readChunkSize);
    if (bytesRead == 0)
    {
        Debug.WriteLine("BytesRead was 0, breaking.");
        break;
    }
    bufferStream.Write(copyBuffer, 0, bytesRead);
    bufferStream.Position -= bytesRead;
    SkiaCanvas.Invalidate();
}

SkiaCanvas.Invalidate();
```

Before we do anything else, we have to start the incremental decode operation. I've never seen this
return anything other than `SKCodecResult.Success`, but it can probably fail somehow.

Next, remember that we have the `skCodec` pointing at our `bufferStream`. So first, we perform an incremental decode on whatever's currently available in `bufferStream`. If it reports `Success`, the image is complete, and
we're done.

Otherwise, we read a bit more from the HTTP response stream, and read that into `copyBuffer`. I read in 16KB chunks for  We then copy 
from `copyBuffer` into `bufferStream`, which our `skCodec` is pointed at. We then rewind the `bufferStream` 
the same number of bytes we just wrote to it, otherwise the next trip around the loop, `IncrementalDecode()` 
won't see them.

Note but there's one gotcha that surprised me a bit here: `skCodec.IncrementalDecode()` _will advance the `MemoryStream's` position_. 
If you weren't expecting this, it can play some real havoc with your stream manipulation. Beware.

Finally, we call `Invalidate()` on the `SkiaCanvas` each trip around the loop. That ensures that the image gets repainted each time more data gets loaded into it. This can (and does) causes issues with rendering 
because of how frequently it repaints. If you want to avoid potential performance problems, you'll want to 
hook into your windowing surface's repaint loop, and only call invalidate when it's actually about to paint.
(In the full code sample on GitHub, I actually do that, but I've omitted it for simplicity here).

We also do one final `Invalidate()` once we're out of the loop, to make sure we do one last repaint now that 
all the data is available.

## What else?

There's a bit more plumbing you need to do to hook this all together. The full GitHub sample shows it, but I'll also briefly go over it here:

**MainWindow.xaml.cs**
```csharp
private void SKiaCanvas_OnPaint(object sender, SKPaintSurfaceEventArgs e)
{
    Debug.WriteLine("Calling OnPaint");
    if (e != null)
    {
        e.Surface.Canvas.Clear();
        if (_shouldOnlyClear)
        {
            _shouldOnlyClear = false;
            return;
        }

        if (_skImage != null)
        {
            SkiaCanvas.Height = _skImage.Height;
            SkiaCanvas.Width = _skImage.Width;
            e.Surface.Canvas.DrawBitmap(_skImage, 0, 0);
        }
    }
}
```

Way up in the beginning, in the XAML code, the `SKXamlCanvas` has a `PaintSurface="SkiaCanvas_OnPaint"`. This 
is the event handler that actually takes care of painting the `_skImage` we're stuffing bytes into. This gets
called every time we call `.Invalidate()`, and probably some other times too. The important parts are just these two lines:

```csharp
e.Surface.Canvas.Clear();
e.Surface.Canvas.DrawBitmap(_skImage, 0, 0);
```

Arguably, setting the SkiaCanvas's Height and Width are important too. If you wanted to scale the image 
canvas down for display purposes, this is one place you could you do it. I'm just setting the canvas size to 
whatever the image's underlying size is.

Everything else in there is either just error handling, or handling the "Clear" button.

## Other Stuff

What about animated GIFs, JPEG, BMPs or WebPs?

Well...

Like I mentioned above, if you wanted to handle JPEGs or BMPs (I'm sorry), you'd have to use 
`StartScanlineDecode()` and `GetScanlines()`. I haven't played with those at all, but I think the process 
would be similar. The only difference is that you'd need to ensure you had an entire row before attempting 
to paint it, instead of being able to just throw arbitrary bytes at the canvas.

For _animated_ GIFs, I think you'd have to get the `FrameCount` out of the `SKCodec`, and then read the stream 
and use `GetFrameInfo(index)`.

As far as I can tell, while the WebP _format_ supports incremental decoding, _Skia's WebP codec_ doesn't implement it. Sorry. ¯\\\_(ツ)_/¯

## That's All, Folks
If you ever find yourself wanting to incrementally-decode stuff, hopefully this helps!

If anyone knows of a way to do this in a more general way (that also supports more image formats), lemme know! I spent a lot of time searching and hunting, couldn't find anything better!

The full code: [https://github.com/pingzing/incrementalimageloading](https://github.com/pingzing/incrementalimageloading)

[![Creative Commons BY badge]({static}/images/cc-by.png)](https://creativecommons.org/licenses/by/4.0/ "This work is licensed under a Creative Commons Attribution 4.0 International License.")

_This work is licensed under a Creative Commons Attribution 4.0 International License._