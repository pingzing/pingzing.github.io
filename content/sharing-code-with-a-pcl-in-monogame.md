Title: Sharing Code with a PCL in MonoGame
Date: 2017-06-19
Category: Programming
Tags: programming, games, monogame, xna, c#, csharp
Slug: sharing-code-with-a-pcl-in-monogame
Authors: Neil McAlister
Summary: How to structure a MonoGame project for crossplat code-sharing


I've dabbled briefly with making games in the past. I've tried [Unity](https://unity3d.com/), [LÖVE](https://love2d.org/), XNA and it's more modern successor [MonoGame](http://www.monogame.net/).
I rarely get very far, but it's always a fun little exercise. This time around, I'm trying to make a more 
determined stab at it with MonoGame. So far, I've made it further than I ever have before--I actually have working collision!

![Animated game collision example]({static}/images/early-collision-test-02.gif)

For this little experiment, I decided to give [MonoGame](http://www.monogame.net/) another try because I'm a big ol' C# fanboy, and Lua made me angry. One thing that bit me
pretty quickly (aside from the truly frustrating lack of architectural advice) was that there weren't any guides on how to structure a multiplatform MonoGame project. 

One of MonoGame's promises is that it supports just about everything under the sun (even including the Nintendo Switch!), but figuring out
how to actually structure your code in a way that makes this easy seemed to be entirely absent from the internet. This post is an attempt to remedy that!

# tl;dr
For those short of time:

 [![Create Monogame project]({photo}monogame-tldr-1.png){loading='lazy'}]({static}/images/monogame-tldr-1.png "Make thing.")

1.) Make your first platform project. It can target whatever it is that you want to target.

 [![Add PCL]({photo}monogame-tldr-2.png)]({static}/images/monogame-tldr-2.png "Prepare to thing to thing")

2.) Add a new project to the solution. This will be your PCL.

 [![Continue adding PCL]({photo}monogame-tldr-3.png)]({static}/images/monogame-tldr-3.png "Add thing to thing")

3.) You'll want to make sure you choose "PORTABLE Class Library", and not use "Class Library" of some flavor.

 [![Finish adding PCL]({photo}monogame-tldr-4.png)]({static}/images/monogame-tldr-4.png "Finish adding thing to thing")

4.) Choose all the targets you plan on hitting. Fewer is likely to offer you more APIs, but if you have to support one you don't select later, you may be in for pain.

 [![Move Game1.cs]({photo}monogame-tldr-5.png)]({static}/images/monogame-tldr-5.png "Move thing to new thing")

5.) Move your Game.cs to the PCL. We'll clean up references and namespaces in a moment. Delete the copy left in the platform project.

 [![Add MonoGame to PCL]({photo}monogame-tldr-7.png)]({static}/images/monogame-tldr-7.png "Add library to thing")

6.) Add the MonoGame.Portable NuGet package to the PCL.

 [![Add reference to PCL]({photo}monogame-tldr-6.png)]({static}/images/monogame-tldr-6.png "Add reference to thing")

7.) Add a reference to the PCL to the platform project.

(If you get grief about the .NET version, just go to Game1's Properties, and bump the .NET Framework version to 4.5.1.)

 [![Clean up namespaces]({photo}monogame-tldr-8.png)]({static}/images/monogame-tldr-8.png "Make thing look for right thing") 

8.) Note that you could also just add a `using ClassLibrary` statement to the top of `Program.cs` in most cases, but because in this little example, `Game1` is both a class name and a namespace name, it would cause problems, so I just give it the fully-qualified namespace.

9.) Done!

# ts;wm (Too Short; Wanted More)
<br>
You want the long version, eh? Well, okay. Keep on going, and hopefully you won't be disappointed.

## Options
MonoGame's projects are pretty vanilla C# projects--there's not a lot of exotic build-time magic happening here. As such, you've got a quite a few options for code-sharing:

### Just Use the Same Files
One approach I've seen before is to throw all your shared files into a single folder (usually named "Common") and then, in all your projects, you use Visual Studio's "Add As Link" function to add the files to your project. 

[![Add as Link example]({photo}addaslink.png)]({static}/images/addaslink.png "It's weirdly hard to find.")

This leaves the files where they are, and multiple projects can have references to the same file this way.

...I don't like this solution very much. I find that it's easier to reason about a project if it mirrors the underlying folder structure as closely as possible. Using file links this way completely breaks this assumption--from Visual Studio's Solution Explorer, it looks like you have a bunch of different copies of the file in the project folders, but they're all just links to the same set of files. It also involves manual work every time you want to add a new project into the solution, and that's no fun.

### A Shared Project
Another approach is to use a Shared Project. Visual Studio has better support for this, and you can just add all your cross-platform code to Shared Project. The only things you'll need to add to your platform-specific projects are initialization and bootstrapping of that platform's basic window/frame/host.

...I don't like this solution either. The primary reasons are that I feel like it encourages using `#IFDEF`s to handle platform-specific code (which is almost always bad practice), and the fact that it  doesn't generate its own assembly can make debugging and adding NuGet packages a real pain.

It does have its merits though--the fact that it _does_ allow you to use `#IFDEF`s to get at platform-specific APIs gives you an easy escape hatch if you just need to do something fast. In practice though, I've found that it's too alluring a prospect to ever use just once. Invariably, the codebase becomes riddled with `#if __IOS__` and `#elif __ANDROID__`, etc.

### A Portable Class Library
The workhorse of cross-platform code sharing in .NET land, the PCL is similar to a Shared Project in that you'll keep all your shared code in this project. 

It differs from a Shared Project in that it actually produces an assembly in the form of a .DLL file, which tends to make debugging simpler. There's also no danger of having the wrong platform selected in Visual Studio, and _thinking_ you're writing cross-platform code, when you're actually only writing code that will run on one platform. In addition, adding NuGet packages tends to be much simpler: if they support PCLs, they work in the project with the shared code.

One extra advantage is that if MonoGame ever gets .NET Standard support, migration from a PCL to a .NET Standard library will be fairly simple.

This is my preferred solution, and what the rest of this blog post will assume.

## The Solution Structure
Let me get this out of the way right up front. Here's a screenshot (more or less) of what your solution is going to look like when you're done:

[![Solution Explorer screenshot]({photo}monogame-solution-explorer.png)]({static}/images/monogame-solution-explorer.png "I mean, if you're making a real game, you'll probably be supporting more than just DesktopGL.")

Up in that screenshot there, the `monogame-test.Core` is my PCL. It happens to target Profile 44 (Windows 8.1, .NET 4.5.1, Xamarin.iOS, Xamarin.Android, Xamarin.Mac), which happens to correspond with .NET Standard 1.2. Most of my game code will end up living in there. You can even move your `Game1.cs` (or whatever you've renamed it) into the PCL.

The `monogame-test.DesktopGL` is a platform-specific project. Its job is mainly to set up the game's platform-specific environment. This platform is MonoGame's "DesktopGL", which by some SDL and OpenGL magic, uses a single codebase to support Windows, Mac and Linux desktop platforms. 

The only code in the DesktopGL project is in `Program.cs`. It looks like this:

    :::c#
    using monogame_test.Core;
    using System;
    
    namespace monogame_test.DesktopGL
    {    
        public static class Program
        {        
            [STAThread]
            static void Main()
            {
                using (var game = new Game())
                    game.Run();
            }
        }
    }

Your platform-specific projects will also host content, including your `.mgcb` file. There might be way to move this into your PCL as well, but I haven't figured it out yet.

## The Deets
Some of the squirrely bits of getting this up and running include:

 * Actually Getting MonoGame Working
 * Dealing with things you need to talk to the Platform for

 The first is pretty simple. As of March 1 2017, MonoGame has a [PCL-compatible NuGet package](https://www.nuget.org/packages/MonoGame.Framework.Portable/). You simply add this package to your PCL, and bam. You should be up and running. If your platform-specific projects complain that MonoGame is missing, make sure you've either added it to your references manually, or you've added the appropriate NuGet package to that particular platform project.

 Note that apparently the PCL library is [not without issues](https://github.com/MonoGame/MonoGame/issues/5724), and it apparently has issues supporting NuGet 3.5+ (and thus UWP) at the moment, but it looks like the MonoGame guys are working on it.

 The second is a little more complicated, and also going to be something of an exercise left to the reader (sorry!).

 Part of the issue is that PCLs don't have access to certain APIs because there's no good cross-platform way to abstract them away. One example of those is file IO APIs--a PCL has no way to talk to the filesystem out of the box. In this particular case, there's an excellent library called PCLStorage that presents a cross-platform file API that PCLs can consume. But what if you need access to something that no kind soul has written a library for?

 One possible solution is to mimic [Xamarin's Dependency Service](https://developer.xamarin.com/guides/xamarin-forms/application-fundamentals/dependency-service/introduction/). That is, you define an interface for the thing you'd like to be able to do in your PCL, and then each of your platform-specific projects will implement that interface. How you actually go about retriving the appropiate concrete implementation of that interface at runtime is an open question. 
 
 One of the simplest, dumbest solutions would be to just have a class in the PCL that looks something like this:

    :::c#
    public static class ServiceLocator
    {
        private static Dictionary<Type, IService> _serviceRegistry = new Dictionary<Type, IService>();

        public static void Register<TService>(IService implementation)
        {
            _serviceRegistry.Add(typeof(TService), implementation);
        }

        public static IService Get<TService>()
        {
            return _serviceRegistry[typeof(TService)];
        }
    }

...and then your platform-specific projects register all their implementations before calling `Game.Run()`. Then, when your PCL needs a service, it can just do `ServiceLocator.Get<YourService>().ServiceThings()`. Of course, even with that solution, you'd want to do things like null-checking, existence-checking, etc.

# That's All, Folks
Hope this helped! If you'd like to contact me, I'm [@pingzingy](https://twitter.com/pingzingy) on Twitter, and [pingzing](https://github.com/pingzing/) on GitHub!