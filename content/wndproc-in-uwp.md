Title: Accessing the WndProc in a UWP Application
Date: 2021-01-10 8:00
Category: programming
Tags: programming, uwp, win32, c#, horror
Slug: wndproc-in-uwp
Authors: Neil McAlister
Summary: Using WndProc in UWP apps
cover_image: wndproc-in-uwp-cover.png

I was putting together a [Raspberry Pi-powered bus schedule board](https://github.com/pingzing/TrippitKiosk) running Windows 10 IoT the other day, when I realized that if I didn't want the thing blinding me while I tried to sleep, I needed some way to control the screen's brightness. Eventually, I found the required Windows registry keys to configure the display timeout. Unfortunately, turning the display off just made it go black–it didn't actually turn off the backlight. Some more investigation eventually yielded a method to control this particular display's backlight brightness over SPI, but now I had a new problem--I needed a way to dim the backlight when the display turned off, and to restore it when it came back on.

Now, this little Raspberry Pi is running Windows 10 IoT Core. That means that I'm limited to a single UWP foreground application, and any number of UWP-style background applications. In theory, a UWP application is limited to [WinRT APIs](https://docs.microsoft.com/en-us/uwp/api/) and a [subset of Win32 APIs](https://docs.microsoft.com/en-us/uwp/win32-and-com/win32-and-com-for-uwp-apps). Anything else is officially unsupported.

In practice, however, if you can P/Invoke it, you can use it. (Though you probably won't be allowed to publish it on the store.)

In this case, I determined that the [RegisterPowerSettingNotification](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerpowersettingnotification) Win32 API was probably my best bet. It's a very classic sort of Win32 design--first, you register your application for power notifications, then you have to listen for them in your [WndProc](https://docs.microsoft.com/en-us/previous-versions/windows/desktop/legacy/ms633573(v=vs.85)).

Problem. UWP doesn't _have_ a WndProc.

Except... Kenny Kerr, the father of C++/WinRT himself, explained [back in 2012](https://kennykerr.ca/2012/11/09/windows-8-whered-you-put-my-hwnd/) that even UWP apps (then known as Modern/Windows 8 Apps) have an HWND. And if it has an HWND, I reasoned, it's _got_ to have a WndProc, right?

To my surprise, yes. Not only that, hooking into it is quite simple.

(Also, spoiler alert: turns out my Raspberry Pi's display doesn't send power events. My code worked just fine on my dev machine, but the Pi never sent any display on/off events. I eventually just went with an app-side timeout that just-so-happened to match the display-off timeout. Ah, well.)

So, the first thing that we need to do is crowbar an HWND out of our UWP application's window. This is a bit of a challenge, because they've gone to great pains to obscure it from us. But it's nothing a bit of determination and underhandedness can't resolve. It just so happens that there's a COM interface that allows exactly what we need: [`ICoreWindowInterop`](https://docs.microsoft.com/en-us/windows/win32/api/corewindow/nn-corewindow-icorewindowinterop). By default, this is only accessible to C++ code, but there's no reason to let that stop us. C# is perfectly capable of working with COM interfaces through the use of the `[ComImport]` attribute. Let's define it ourselves.

    :::csharp
    [ComImport, Guid("45D64A29-A63E-4CB6-B498-5781D298CB4F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ICoreWindowInterop
    {
        IntPtr WindowHandle { get; }
        bool MessageHandled { get; }
    }

The only secret sauce here is the magic GUID. That's _not_ guaranteed to remain the same between Windows verions (though it has, thus far). You can find the interface definition in `C:\Program Files (x86)\Windows Kits\10\Include\<version>\winrt\CoreWindow.idl`, which will have the GUID you need for whichever version of Windows your application targets.

Now we just have to get our hands on our application's `CoreWindow`, and cast it to an `ICoreWindowInterop`, and voila–access to the HWND awaits. This, too, requires some trickery, however; the compiler rightly claims that a `CoreWindow` cannot be cast to an `ICoreWindowInterop` because as far as the C# compiler can tell, they share no common ancestor. We know better however, so we can just tell the compiler where to shove it by getting a `dynamic` reference to the CoreWindow, and casting it anyway:

    :::csharp
    private static IntPtr GetCoreWindowHwnd()
    {
        dynamic coreWindow = Windows.UI.Core.CoreWindow.GetForCurrentThread();
        var interop = (ICoreWindowInterop)coreWindow;
        return interop.WindowHandle;
    }

Note that this snippet assumes your application only has a single CoreWindow, and that you're calling it on the UI thread. Adjust as necessary if that's not true.

Okay! We have an HWND. Now we can start doing some Win32 stuff. How do we add custom logic to a WndProc? The tool for that is [`SetWindowLongPtr`](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowlongptra).

    :::csharp
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
    public static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

...except, not quite. The documentation claims the following: 

"To write code that is compatible with both 32-bit and 64-bit versions of Windows, use SetWindowLongPtr. When compiling for 32-bit Windows, SetWindowLongPtr is defined as a call to the SetWindowLong function." 

_Unfortunately_, that's only true if you're actually importing the headers and writing C/C++ code. In the case of C#, we have to be a little more explicit, and import both the 32-bit and 64-bit versions, then discriminate between them ourselves.

    :::csharp
    [DllImport("user32.dll", EntryPoint = "SetWindowLong")] //32-bit
    public static extern IntPtr SetWindowLong(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")] // 64-bit
    public static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

Great! How do we use it? We already have an HWND, now we need an `nIndex` and a `dwNewLong`. The documentation reveals that, in order to set a new WndProc, we need to pass in the `GWLP_WNDPROC` constant (also know as `-4`) as our `nIndex`, followed by the address of our new WndProc function for `dwNewLong`. But this is C#–how do we get a function pointer?

Fortunately for us, there just so happens to be a static `GetFunctionPointerForDelegate()` method inside the `System.Runtime.InteropServices.Marshal` class. All we have to do is define a delegate that matches the WndProc signature, pass it to that function, and we've got ourselves a pointer. 

A C++ WndProc signature is defined as so:

    ::cplusplus
    LRESULT CALLBACK WindowProc(
        _In_ HWND   hwnd,
        _In_ UINT   uMsg,
        _In_ WPARAM wParam,
        _In_ LPARAM lParam
    );

Or, in C# terms:

    :::csharp
    IntPtr WindowProc(IntPtr hwnd, uint uMsg, IntPtr wParam, IntPtr lParam);

So let's turn that into a delegate definition so we can allow `GetFunctionPointerForDelegate()` to do its grim work.

    :::csharp
    public delegate IntPtr WndProcDelegate(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

Now we've got most of the foundation laid. Let's pull the camera back a little, and start putting things together. First, let's define a function that accepts a `WndProcDelegate`, and registers it for us.

    :::csharp
    using System.Runtime.InteropServices;

    private const int GWLP_WNDPROC = -4;
    public delegate IntPtr WndProcDelegate(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    public static IntPtr SetWndProc(WndProcDelegate newProc)
    {
        dynamic coreWindow = Windows.UI.Core.CoreWindow.GetForCurrentThread();
        var interop = (ICoreWindowInterop)coreWindow;
        var hwnd = interop.WindowHandle;

        IntPtr functionPointer = Marshal.GetFunctionPointerForDelegate(newProc);

        if (IntPtr.Size == 8)
        {
            return Interop.SetWindowLongPtr(hwnd, GWLP_WNDPROC, newWndProcPtr);
        } 
        else
        {
            return Interop.SetWindowLong(hwnd, GWLP_WNDPROC, newWndProcPtr);
        }
    }

You can see that it's using our code snippet from earlier to pull in the HWND, and handles both 32-bit and 64-bit version of `SetWindowLong()`. You should also note that it's returning whatever it is that `SetWindowLong()` returns. According to the documentation, that's a pointer to the _old_ WndProc function. It's considered best practice to hold onto that, and make your new WndProc call it once it's done. The Win32 API even provides a function explicitly for that purpose, [`CallWindowProc`](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-callwindowproca). Let's add it to our P/Invoke declarations...

    :::csharp
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr CallWindowProc(IntPtr lpPrevWndFunc, IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

We're pretty close now. We just need to define our custom WndProc, and register it. We have to be careful to wait until the application's CoreWindow is initialized before we start trying to do any of this–we need it to be alive to get its HWND, after all. By a little bit of trial and error, I've found that the `OnLaunched()` callback is a good place for that.

So, over in `App.xaml.cs`...

    :::csharp
    private IntPtr _oldWndProc;

    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs e)
    {
        Frame rootFrame = Window.Current.Content as Frame;
        if (rootFrame == null)
        {                
            rootFrame = new Frame();
            Window.Current.Content = rootFrame;

            // We could probably do this a little earlier, but we need to wait
            // for the CoreWindow to be ready so can get its HWND, and this is
            // Good Enough(tm).
            _oldWndProc = SetWndProc(WindowProcess);
        }

        if (e.UWPLaunchActivatedEventArgs.PrelaunchActivated == false)
        {
            if (rootFrame.Content == null)
            {
                rootFrame.Navigate(typeof(MainPage), e.Arguments);
            }
            Window.Current.Activate();
        }
    }

    private IntPtr WindowProcess(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam)
    {
        // Any custom WndProc handling code goes here...

        // Call the "base" WndProc
        return Interop.CallWindowProc(_oldWndProc, hwnd, message, wParam, lParam);
    }

Looks good to me. Let's try to run it.

...huh, that's funny. Why does our app keep crashing with an `ExecutionEngineException` in native code? Simple! Garbage collection.

Our call to `SetWndProc()` creates a new `WndProcDelegate`, which we then get a function pointer from, and pass along to `SetWindowLong()/SetWindowLongPtr()`. Then, after an indeterminate amount of time, the C# garbage collector comes along, sees that there are no active references to that delegate, and helpfully cleans it up. The next time Windows attempts to call our WndProc, it finds that that pointer no longer points to a valid function. Oops. There are any number of ways to keep the garbage collector from cleaning something up, and the easiest is to just hold onto a reference to it. Let's modify the `SetWndProc()` function to do just that...

    :::csharp
    private const int GWLP_WNDPROC = -4;
    private static WndProcDelegate _currDelegate = null;

    public static IntPtr SetWndProc(WndProcDelegate newProc)
    {
        // Assign the delegate to a static variable, so that garbage collector won't 
        // wipe it out from underneath us
        _currDelegate = newProc;

        dynamic coreWindow = Windows.UI.Core.CoreWindow.GetForCurrentThread();
        var interop = (ICoreWindowInterop)coreWindow;
        var hwnd = interop.WindowHandle;

        IntPtr functionPointer = Marshal.GetFunctionPointerForDelegate(newProc);

        if (IntPtr.Size == 8)
        {
            return Interop.SetWindowLongPtr(hwnd, GWLP_WNDPROC, newWndProcPtr);
        } 
        else
        {
            return Interop.SetWindowLong(hwnd, GWLP_WNDPROC, newWndProcPtr);
        }
    }

That's it! Through a combination of skullduggery and determination, we've heaved our UWP app's WndProc into the light, where we are now free to do whatever terrible things we desire to it.

All the code snippets from this post are available [over on GitHub](https://github.com/pingzing/UwpWndProc) in a slightly more organized form. The [Native folder](https://github.com/pingzing/UwpWndProc/tree/main/Native) contains the most interesting bits, and the custom WndProc is [defined in App.xaml.cs](https://github.com/pingzing/UwpWndProc/blob/main/App.xaml.cs). Note that the app on GitHub is technically a WinUI 3.0 UWP app, but all the techniques here should work just fine on any version of UWP.

As always, feel free to leave comments or feedback on Twitter ([@pingzingy](https://twitter.com/pingzingy)) and Github ([pingzing](https://github.com/pingzing/))!

[![Creative Commons BY badge]({filename}images/cc-by.png)](https://creativecommons.org/licenses/by/4.0/ "This work is licensed under a Creative Commons Attribution 4.0 International License.")
_The text of this blog post is licensed under a Creative Commons Attribution 4.0 International License._  
_The code in this blog post is licensed under the [MIT License](https://github.com/pingzing/UwpWndProc/blob/8f419a40192abf697044e409d4403014ce34dfc5/LICENSE)._