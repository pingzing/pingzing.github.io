Title: Talking to Win32 in Rust
Date: 2017-07-23 00:12
Category: Programming
Tags: Programming, Rust, Win32, Windows, VLC
Slug: talking-to-the-winapi-in-rust
Authors: Neil McAlister
Summary: How to make Rust do your bidding

I've [done](https://github.com/pingzing/articulator) [some](https://github.com/pingzing/voicepipe) [dabbling](https://github.com/pingzing/oxide-skies/tree/master/src) in [the Rust programming language](https://www.rust-lang.org/en-US/) in the past, so when a friend asked me if knew a way to force a VLC to the foreground in Windows with Rust, my answer was "yeah, probably".

Of course, I got curious, so I wasn't willing to just let it lie--I started digging into it, and tried to figure it out for myself.


## Planning
Doing anything involving windows in Windows inevitably requires talking to the Win32 API, which means either programming in C/C++, or using a bindings library to translate those C-based types into types that Rust can work with.

For this, there is the excellent [winapi](https://crates.io/crates/winapi) crate. It provides most of the types used in the Win32 library.

Next up, we need to figure out which functions we'll actually be calling to bring our window to the front. Some quick Googling turned up [`SetForegroundWindow`](https://msdn.microsoft.com/en-us/library/windows/desktop/ms633539(v=vs.85).aspx) and [`ShowWindow`](https://msdn.microsoft.com/en-us/library/windows/desktop/ms633548(v=vs.85).aspx) which at first glance appear to do very similar things. It turns out that for this particular task, we would need both! `SetForegroundWindow` sets the focus to the given window, but doesn't force it into the foreground--that's what `ShowWindow` is for.

According to the docs on MSDN, both of those functions live in user32.dll. The winapi crate mirrors this structure--one crate per DLL. So, we also need the [user32-sys](https://crates.io/crates/user32-sys) crate to get access to bindings for those two functions.

Our Rust program can finally begin to take shape. In our `Cargo.toml`, we'll need:

    :::rust
    [package]
    name = "rust-vlc-finder"
    version = "0.1.0"    
    
    [dependencies]
    winapi = "0.2"
    user32-sys = "0.2.0" 

And at the top of `main.rs`, we'll import our crates:

    :::rust
    extern crate winapi;
    extern crate user32;
    
    fn main() {
        // tbd...
    }

Now, we know ahead of time that we need both `ShowWindow` and `SetForegroundWindow`. If we look at their function signatures, we can see that both of them take an `HWND`--that is to say, a handle to a window (HWND, Handle Window, get it?).

There are a lot of ways to get one of those, but the quick-and-dirty way is to just ask for it by name. The Win32 function for that is [`FindWindow`](https://msdn.microsoft.com/en-us/library/windows/desktop/ms633499(v=vs.85).aspx), which takes an optional class name, and an (also optional) window name. Also of note, there are actually two functions here: `FindWindowA`, the ANSI variant and `FindWindowW`, the Unicode variant. Let's use `FindWindowA`, because 255 characters is enough for anyone, and also, getting a UTF-16 string in Rust that's compatible with the Win32 API is a _pain_.

So, we know how to get our window handle (we use `FindWindowA`), and we know how to make it show up afterward (we use `SetForegroundWindow` followed by `ShowWindow`). Now...how do we actually do that?

## Getting to it

Well, can't we just do something like this?

    :::rust
    extern crate winapi;
    extern crate user32;

    fn main() {        
        // Get a handle to the window based on its name.
        let window_handle = user32::FindWindowA(null, "VLC Media Player");        

        // Set it as the foreground window.
        user32::SetForegroundWindow(window_handle);

        // And show it with the SW_RESTORE flag, which, according to the docs, maps to '9'.
        user32::ShowWindow(window_handle, 9);       
    }

A big fat **nope**. The compiler fails out with an `expected i8, found str` on our "VLC Media Player" string. Also, `null` isn't a keyword in Rust.

In Rust, literal strings are of type `&str`--that is, a reference to some memory that contains a string. `FindWindowA` expects a `LPCSTR`--a long (16-bit) pointer to a constant string.

Lucky for us, the Rust standard library has a `CString` type inside the `std::ffi` module! Even luckier, it has an `as_ptr()` method!

Also-also, if we want to pass a null pointer, `std::ptr` has us covered with `null_mut()`. (It needs to be mutable, because the function might mutate it).

So `main` looks like this now:

    :::rust
    fn main() {   
        let window_name = CString::new("VLC Media Player").unwrap();     
        let window_handle = user32::FindWindowA(std::ptr::null_mut(), window_name.as_ptr());        
        user32::SetForegroundWindow(window_handle);
        user32::ShowWindow(window_handle, 9);       
    }

How about now? **Still nope!** The compiler complains, becasue `FindWindowA`, `SetForegroundWindow` and `ShowWindow` are all "unsafe" functions in Rust parlance--they don't obey the normal borrowing rules of Rust land. That unsafe marker is big red declaration that HERE BE DRAGONS.

So, you need to explicitly mark any code that touches unsafe code as `unsafe`:

    :::rust 
    fn main() {   
        let window_name = CString::new("VLC Media Player").unwrap();  
        unsafe{   
            let window_handle = user32::FindWindowA(std::ptr::null_mut(), window_name.as_ptr());        
            user32::SetForegroundWindow(window_handle);
            user32::ShowWindow(window_handle, 9);       
        }
    }

Ta-da! It compiles, it builds, it shows VLC (if it's open)!

## Extending it

This was a fun exercise, but it's a toy. It won't work if VLC is actually playing anything, because it changes its window name when it does. It becomes "<media file name\> - VLC Media Player". So we'd have to enumerate through our open windows, and look for one whose name _contains_ the phrase "VLC Media Player". Can't be that hard, right?

[Well...](https://github.com/pingzing/rust-vlc-finder/blob/80446376676e96c792100b98fb958aad558decd1/src/main.rs)

We'll leave that blog post for another day.

Anyway, hope this helped! If you'd like to contact me, I'm [@pingzingy](https://twitter.com/pingzingy) on Twitter, and [pingzing](https://github.com/pingzing/) on GitHub!