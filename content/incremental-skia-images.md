Title: Incremental Image Loading with SkiaSharp
Date: 2024-12-30 17:00
Category: programming
Tags: programming, c#, windows, skia, skiasharp, images, incrementalDecode(), startIncrementalDecode()
Slug: incremental-image-loading-skiasharp
Authors: Neil McAlister
Summary: Loading images incrementally with SkiaSharp
Status: draft
image: {photo}incremental_image_cover.png
teaser: <p> One of my pet peeves when using non-browser applications that download images (image gallery and social media apps come to mind) is the way that many of them show absolutely no progress indicator when downloading images. If you're <em>lucky</em> you'll get a little, unsatisfying progress bar. This is especially annoying when on flaky mobile internet connections. </p>

## The Problem

One of my pet peeves when using non-browser applications that download images (image gallery and social media apps come to mind) is the way that
many of them show absolutely no progress indicator when downloading images. If you're _lucky_ you'll get a little, unsatisfying progress bar.
This is especially annoying when on flaky mobile internet connections.

It so happened that I was making a little Windows application using WinUI (the Latest and Greatest UI framework that <s>definitely doesn't have enough budget allocated to its development</s>)
and wanted to be able to show an image's progress without waiting for the entire thing to be downloaded, but with something a little more satisfying 
than a loading bar or a little "100 kB / 500 kB" text display. 

_Web browsers have solved this for_ literal decades, I think to myself, _Surely it cannot be that hard?_

The solution that web browsers have hit upon, of course, is to show images as they download, row by row (or whatever the image format in question 
reasonably allows). The term for this is, surprise surprise, "incremental loading" (or "incremental decoding", depending on how pedantic
you'd like to be).

And while it is That Hard, Actually, we live in a world where other people have poured lots of time into making nice, reusable libraries
that do all the hard parts for us.

In this instance, [Skia, Google's cross-platform graphics library](https://skia.org/docs/) does literally 
everything we need, including a tantalizingly-named function called 
[`incrementalDecode()`](https://github.com/google/skia/blob/main/include/codec/SkCodec.h#L508). 
And there's even a nice [C# wrapper around Skia called SkiaSharp](https://github.com/mono/SkiaSharp) 
(as Skia itself is all C++), so it's easy to use for our purposes.

Unfortunately, there appear to be _zero instances on the internet_ of people **actually using the `incremnetalDecode()` feature**. 
Google Search becoming worse and worse by the week in recent years certainly didn't help, but even GitHub's 
search turned up (almost! more on that in a bit) nothing in either SkiaSharp's C# or Skia's original C++.

So, this blog post will document my efforts--and eventual success!--at using this API to do the thing I described above.

## In Short

Here's what we want to do: make an HTTP request for an image. Listen to the bytestream as it comes in, and draw the 
partially-downloaded image as it arrives. This is tricky for a few reasons! We don't know what format the image is in, we don't 
know its dimensions, we might not even know how many bytes are in it.

Image formats have headers that describe all of this information, but all their formats differ, as well as the details
of how they actually store image information.

Fortunately, Skia handles all this heavy lifting for us. All we need to do is figure out how to pass it the information in a format 
that it likes.

## Setting Up

Okay. Let's just get right to it. For context, the application I'm creating:

 - Is written in C#
 - Is a WinUI 3 application (packaged, but it doesn't really matter here)
 - Is explicitly a toy, because I just wanted to see how to do this

So with that in mind, let's move forward. If you're following along at home, I'm going to assume you know how 
to [create a WinUI 3 application](https://learn.microsoft.com/en-us/windows/apps/winui/winui3/create-your-first-winui3-app), 
because getting an environment up an running is complex enough that I don't want to repeat it here.

That said, none of the steps in this blog post are really WinUI-specific. Any C# GUI framework  is going to 
follow more or less the same process. (Avalonia is an exception. See the note below.)

So, you've got a new, blank app created. Great! Next up, you'll need two NuGet packages: 
 - [SkiaSharp](https://www.nuget.org/packages/SkiaSharp/) (I'm using 3.116.1)
 - [SkiaSharp.Views.WinUI](https://www.nuget.org/packages/SkiaSharp.Views.WinUI/). This gives you a control that you can draw Skia Stuff(tm) onto easily. If you're using a different GUI framework, choose the `SkiaSharp.Views.WhateverPackageIsAppropriate` for your platform.

 (Note that if you're using Avalonia, the process for doing Skia Stuff is a little different because Avalonia uses Skia internally. [This GitHub discussion](https://github.com/AvaloniaUI/Avalonia/discussions/13527) has some details, but I haven't done it myself.)

 Once that's done, you have all the stuff you need to start doing Skia Stuff(tm). Let's see some code, huh?

## The Code

Like I said, this is a toy app, so let's not do anything complex. We'll slap some basic UI on the MainWindow,
and just make a hard-coded HTTP request to see some incremental loading in action.

So, here's what we'll start with:

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
Let's take a look at the code:

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
            "https://derpicdn.net/img/view/2019/9/22/2150503.png",
            HttpCompletionOption.ResponseHeadersRead
        );

        if (response == null || !response.IsSuccessStatusCode)
        {
            Debug.WriteLine("Response failure. Boo.");
            return;
        }

        // We have an HTTP Stream, now we gotta do *something* with it.
        });
    }

    private void SKiaCanvas_OnPaint(object sender, SKPaintSurfaceEventArgs e)
    {
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

    private bool _shouldOnlyClear = false;
    private void ClearButton_Click(object sender, RoutedEventArgs e)
    {
        _shouldOnlyClear = true;
        SkiaCanvas.Invalidate();
    }
}
```

This is a _starting point_. Notice that we're not doing anything with the HTTP stream yet. There are some basics
here I want to take a moment to explain before we start fleshing out the actual incremental stuff.

Also, take note: when we call `_httpClient.GetAsync()`, we're passing in `HttpCompletionOption.ResponseHeadersRead` as the second argument. This ensures that the method returns as soon as it finishes reading the response's headers, instead of waiting for the entire response. This is important! 

### Why's Everything in `Task.Run()`?

Spotted that, huh? It's because button handlers run on the UI thread by default, and we're about to do buffer shenanigans in tight loops. Because C# `Task`s are Complicated(tm), starting a new `Task` doesn't
_guarantee_ that you'll get a separate thread, but in in the Windows GUI frameworks, it's a safe assumption to make.

Doing our work in `Task.Run()` gets us off the UI thread, and should help keep the window responsive.

### What's the Deal With That `SkiaCanvas_OnPaint()` Thing?

Ah. The fun. Skia has its own way of doing things, and it's largely disconnected from the host GUI framework's
way of doing things. In this case, we have a Skia canvas, and whenever anything in that canvas gets invalidated
in anyway way (via explicit invalidation, resizes, or a variety of other ways), the `PaintSurface` event handler
is called.

We've created a handler named `SKiaCanvas_OnPaint()` to handle that event. Peeking into the `SKPaintSurfaceEventArgs` `Surface.Canvas` property is the only way to get access to the actual Skia canvas upon
which we want to draw things. It is, therefore, also the only place we _can_ draw things.

It's a very imperative style! Generally, whenever we hear a `Paint` event, we want to erase and redraw the entire canvas with the (presumably updated) current state of the universe.

In our case, our canvas will be dedicated to one task: showing a single image. So if we hear an invalidation, we
know for _sure_ that we want to redraw that image. So, we clear the canvas, make sure that the `_skImage` has
some content, and then draw that image.

### Is That Why `ClearButton_Click()` Doesn't Actually Do Anything?

Yep! It sets a little boolean flag that we can check inside `OnPaint`, and then calls `Invalidate()` on the 
canvas, which results in `OnPaint` being called, which then does a check for our boolean flag.

### HTTP Stream Time

Okay. Let's flesh out our click handler a little further. Let's go do something with that HTTP stream of ours.

In order to do an incremental decode, we need the following:

- A stream containing our data _that can be rewound_
- An `SKCodec`
- An `SKBitmap` with enough bytes allocated to hold the decoded image
- The memory address of that `SKBitmap`
- A PNG or (static) GIF image (!)

Let's go through those in order.

#### A Rewindable Stream?

Skia likes to rewind the stream that it's reading during incremental decoding. Problem! The `Stream` that
C#'s `HttpClient` gives us when we call `ReadAsStreamAsync()` isn't rewindable! It's one-and-done, probably
to save on memory.

The easiest way to do that in C#: our good pal `MemoryStream`! We'll read from the HTTP stream in chunks, and read those directly into a `MemoryStream`.

#### An `SKCodec`?

An `SKCodec` is a little data structure that contains a bunch of metadata that tells Skia how to encode or 
decode a given image. i.e. "This is a PNG, using this color mode, and has this many bytes".

You create it with 
```csharp
var skCodec = SKCodec.Create(someStream);
```

You can also get an `out` parameter out of it that will tell you if it succeeded, or if it failed, like so:
```csharp
var skCodec = SKCodec.Create(someStream, out SKCodecResult result);
if (result != SKCodecResult.Success) 
{
    Debug.WriteLine($"Sadness. {result}");
}
```

This _can_ be helpful when debugging, but the information it gives you is minimal. It's better than `SKCodec`'s
usual failure mode though: it just returns `null` with no further information.

#### `SKBitmap` With Enough Bytes?

"This is C#!" I hear you say. "What do you mean I need to allocate things manually?"

Fear not, it's less painful than you might think. All you need for this is the image's height and width, and
`SKCodec` figures those out for you. Them you just...

```csharp
var info = new SKImageInfo(skCodec.Info.Width, skCodec.Info.Height);
_skImage = new SKBitmap(info);
```

...and now our `_skImage` has the appropriate amount of memory allocated to it. No sweat.

#### The `SKBitmap`'s Memory Address?!

Okay, yeah, now we're getting a little crunchy. Still not bad though, I promise! `SKBitmap`'s `GetPixels()`
returns a pointer to its location in memory (and also has an `out` parameter for how large the `SKBitmap` is, 
but we don't actually need that.)

```csharp
IntPtr bitmapAddress = _skImage.GetPixels(out _);
```

(Newer versions of C# will probably want to use `nint` instead of `IntPtr`. That's fine.)

#### Gluing It All Together

Let's see some code. Continuing where we left off, we've just gotten `response` and verified that it has some
content for us:

```csharp
 int initialReadSize = 1024;
 byte[] copyBuffer = new byte[16384];

 using var responseStream = await response.Content.ReadAsStreamAsync();

 var bufferStream = new MemoryStream();
```

Cool. Now, in order for `SKCodec` to work, it needs enough bytes read into the stream to determine what the
iamge is. In practice, I found that 1 kilobyte was enough for this (and is probably overkill, honestly).

```csharp
int bytesRead = responseStream.Read(copyBuffer, 0, initialReadSize);
bufferStream.Write(copyBuffer, 0, bytesRead);

// Rewind the stream so that the decoder starts at the beginning
bufferStream.Position -= bytesRead;
```

See that little rewind at the end there? Very important! `SKCodec` just starts reading from the `Stream` that
you hand to it, _at whatever position it's currently at_. We'll need to repeat this trick again later, too.
Now you see why we needed a rewindable stream.

Let's create our `SKCodec` and `SKBitmap` and so on.

```csharp
using var skCodec = SKCodec.Create(bufferStream, out SKCodecResult codecResult);
if (codecResult != SKCodecResult.Success)
{
    Debug.WriteLine($"Failed to create SKCodec. Result was: {codecResult}");
    return;
}

var info = new SKImageInfo(skCodec.Info.Width, skCodec.Info.Height);
_skImage?.Dispose(); // This is a class member, so let's make sure there isn't an old image here
_skImage = new SKBitmap(info);

IntPtr bitmapAddress = _skImage.GetPixels(out _);
```

Okay. We've got everything lined up. But you may have noticed I never addressed the final bullet point from my list above:

> - A PNG or (static) GIF image (!)

It's also a little late if you've already got a JPEG stream. Oops.

But the reason for this is that `IncrementalDecode()` only supports PNGs and non-animated GIFs.

There _are_ the `StartScanlineDecode()` and `GetScanlines()` methods on `SKCodec` which, I understand,
are supposed to be the JPEG equivalent, but I haven't played with those yet, and can't talk about them with confidence.

And you get no WebP support at all. Sorry.

(I'm not sure which of these methods you'd use for BMP. If you have to support BMP, I'm sorry, for multiple
reasons.)

Okay. Let's keep moving we're almost there. The fun is about to begin.

```csharp
//  This MUST be called first.
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
```

Before we do anything else, we have to start the incremental decode operation. I've never seen this
return anything other than `SKCodecResult.Success`, but it can probably fail somehow.

Now, let's get to the actual "incremental", decoding, the whole point of this increasingly-lengthy blog post.

```csharp
int readChunkSize = 16384; // This is a bit of a magic number. I'll explain later.

// Now we begin the incremental decoding loop.
SKCodecResult incrementalResult = SKCodecResult.IncompleteInput;
while (incrementalResult == SKCodecResult.IncompleteInput)
{
    // We expect incrementalResult here to be either 'Success' or 'IncompleteInput'.
    // 'IncompleteInput' means that we need to take another trip around the loop, and feed it more data.
    incrementalResult = skCodec.IncrementalDecode(out int rowsDecoded);
    if (decodeResult == SKCodecResult.Success)
    {
        break;
    }

    SkiaCanvas.Invalidate();

    // Buffer a bit more of the HTTP stream into the MemoryStream after each incremental decode
    bytesRead = responseStream.Read(copyBuffer, 0, readChunkSize);
    if (bytesRead == 0)
    {
        Debug.WriteLine("BytesRead was 0, breaking.");
        break;
    }
    bufferStream.Write(copyBuffer, 0, bytesRead);

    // And of course, don't forget to rewind the MemoryStream--writing to it advances it, but
    // the new bytes haven't gone through the decoder yet!
    bufferStream.Position -= bytesRead;
}
```

I mention it kind of implicitly with the comment about rewinding the `MemoryStream`, but there's one gotcha
that might surprise you here: `skCodec.IncrementalDecode()` _will advance your `MemoryStream's position`_. 
If you weren't expecting this, it can play some real havoc with your stream manipulation. Beware.

Note that we call `Invalidate()` on the `SkiaCanvas` each trip around the loop. That ensures that the image gets repainted each time more data gets loaded into it. This can (and does) causes issues with rendering 
because of how frequently it repaints, but we'll address that a bit later.

## Success!

Just out side of the `while` loop, add in one last 

```csharp
SkiaCanvas.Invalidate();
```

...and boom! You should now have an image that downloads, and renders incrementally as it's downloading in your application.

Piece of cake.

todo: show entire Download method in one uninterrupted block

## Edge Cases

- Edge case handling
    - Other formats
    - Initial read size
    - HTTP buffer size 16384
    - Rendering speed

<!--
An image looks like this: 
[![Alt-text]({photo}imagename.jpg){loading='lazy'}]({static}/images/imagename.jpg "Mouseover text here")

An internal link looks like this:
[other post]({filename}/this-websites-architecture-personal-soapbox.md)

Code looks like this:

    :::shortlangname
    using Code;    
    
    namespace code
    {    
        public static class Program
        {                    
            static void Main()
            {
                code code code
            }
        }
    }
-->