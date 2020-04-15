Title: A Saner Windows Command Line - Part 1
Date: 2018-08-23 9:08
Category: Programming
Tags: Windows, command-line, programming, console, chocolatey, conemu, git
Slug: saner-command-line-1
Authors: Neil McAlister
Summary: Turbocharging the Windows Command Line, Pt. 1
cover_image: header-image.png

---

* Part 1 - You are here
* [Part 2]({filename}/saner-command-line-part-2.md) - In which we supercharge Git, fix console selection and copy/paste, and introduce ConEmu and friends.
* [Part 3]({filename}/saner-command-line-part-3.md) - In which we move to native SSH, update to `pwsh` and learn about the magic that is WSL.

---

I know what you're probably thinking. One of the reasons you use Windows is so you don't have to use the command line. But sometimes it's unavoidable—maybe you need to do some advanced git-wrangling, or you're developing in an environment with CLI-based tools that are far more mature than their GUI counterparts. But it doesn't have to be painful. With a little bit of tweaking, it can even be—dare I say?—more pleasant than a GUI-based experience.

A word of warning: most of the advice that follows only applies to Windows 7 SP1 and up. Proceed at your own risk if you're running anything earlier.


## The Basics

Let's be honest. What many people think of as "the default Windows command line", `cmd.exe`, is atrociously bad. Selection is awkward, resizing is hard, the syntax is arcane, the list goes on. If you do nothing else, there are two things you can do to make the basic, vanilla experience bearable.


## Use PowerShell
Banish `cmd.exe` from your shortcuts, and upgrade to its successor, PowerShell. It includes a _vast_ array of built in commands (known as [Cmdlets](https://msdn.microsoft.com/en-us/library/ms714395%28v=vs.85%29.aspx)) and scripts that support piping between each other, allowing you to compose actions from simple building blocks. If there's ever anything you're missing from the old cmd, you can always invoke `cmd.exe` from PowerShell. There's also tons of community support, so if there's something missing out of the box, odds are that somebody has filled that gap already. 
And, purely subjectively, I think the .ps1 syntax is a _lot_ more readable than the old .bat syntax.

[![Syntax comparison of .bat vs .ps1]({photo}bat-vs-ps1.png)]({filename}images/bat-vs-ps1.png "And better syntax highlighting, too!")
 Verbose, but at least you don't need a decoder ring.


## Upgrade to Windows 10
I know that this one will be a harder pill to swallow (and is likely impossible in some enterprise scenarios) but the benefits really can't be overstated. `conhost.exe`, Windows' basic console window host that underlies both cmd and PowerShell has seen some pretty substantial improvements. [This MSDN article](https://technet.microsoft.com/en-us/library/mt427362.aspx) lays out the details, but the high points are as follows:

* Drag-to-resize
* Automatic text reflowing on resize
* Ctrl + X/C/V support for cut/copy/paste
* Selection that does line-wrapping
* Transparency
* A full-screen mode

Already on Windows 10? You can enable these features by just right-clicking the console's title bar and going to Properties. Once there, you'll want to enable the following in the **Options** tab:

* Enable Ctrl key shortcuts
* Filter clipboard contents on paste
* Enable line wrapping selection
* Extended text selection keys

then, in the **Layout** tab:

* Wrap text output on resize

[![Annotated instructions for doing that thing above]({photo}how-to-console.png)]({filename}images/how-to-console.png "It'd be nice if these were defaults.")
 
Like so.

In addition, Windows 10 also bundles [PsReadLine](https://github.com/lzybkr/PSReadLine) and [OneGet](https://github.com/OneGet/oneget) (though it calls it PackageManagement), which make the PowerShell experience leaps and bounds better.
PSReadLine gives you a lot of syntax and autocompletion goodies, and I'll be going into more detail about PackageManagement in a little bit.


Just those two changes will make your command line experience significantly more palatable...but we can go further.


## Improving Usability

First, lets take care of anybody who can't upgrade to Windows 10—you can still get a lot of the goodness that follows. You'll need to do two things to catch up to the Windows 10 default experience. If you're already on Windows 10, you can skip to to the "Package Management" section.

### Install WMF 5.0

[Windows Management Framework 5.0](https://www.microsoft.com/en-us/download/details.aspx?id=50395) will give you OneGet/PackageManagement (which I'll be talking about soon, I swear), and enables easy installation of modules from the [PowerShell Gallery](https://www.powershellgallery.com/). We need that second piece because next, we're going to...


### Install PsReadLine

[PsReadLine](https://github.com/lzybkr/PSReadLine) gives you syntax highlighting, context-sensitive autocompletion via Ctrl + Space, supercharged tab-completion and a whole lot more. The project's Github page has more information, and links to articles of deep dives into it, so check those out if you're curious. To install it, just make sure that WMF 5.0 is installed, open a PowerShell prompt, and enter: 

```PowerShell
Install-Module PSReadline
```

Voila!


### <s>Package Management
This is where it starts getting good. If you've ever used Debian or any of its derivatives, you've probably been a little jealous of apt-get. Well, Windows (finally!) has an answer to that in the form of the PackageManagement module. The project itself is open source, and goes by the name of [OneGet](https://github.com/OneGet/oneget). 

Why don't we try it out? Let's go get the Powershell Community Extensions from the PowerShell Gallery. I happen to know that the name of the package I'm after is "PSCX", so:

```PowerShell
Install-Package Pscx
```

Easy. 

PackageManagement is actually more of a "Package Manager Manager"—it doesn't provide packages itself, but provides a common interface to other package providers. By default, PackageManagement only has one provider: PowerShellGet, which uses the [PowerShell Gallery](https://www.powershellgallery.com/) as its source. In fact, if you installed PsReadLine earlier, you were using PowerShellGet directly with that 'Install-Module' call!  
That's pretty neat, but fairly limited in scope. We want a provider that points toward a more general software repository. Fortunately, just such a thing exists, in the form of [Chocolatey](https://chocolatey.org/)! 

At this point, we have two options—we can install Chocolatey manually, or we can do it through PackageManagement. Unfortunately, the Chocolatey provider for PackageManagement isn't ready for prime time just yet. It works, but it's out of date compared to the standalone Chocolatey client, and isn't recommended. The Chocolatey team hopes to have the PackageManagement provider ready some time this year, but for now,</s> head over to [chocolatey.org](https://chocolatey.org/) and follow their instructions to get the standalone client installed.

### EDIT - April 15, 2020:
The promise of PackageManagement never quite panned out. I'd recommend skipping to the part where we head over to [chocolatey.org](https://chocolatey.org/) and follow their instructions to get the standalone client installed.

### Chocolatey

In Part 2 of this series, we're going to be leaning on Chocolatey pretty heavily to improve our Git experience, but for now, let's just take it for a test drive. 
You can invoke it with 'chocolatey', but brevity is nice, and it responds to 'choco' as well.
Now, I always find myself needing a simple, lightweight image editor with a bit more power than Paint. I'm a big fan of [Paint.NET](http://www.getpaint.net/index.html), so why don't we see if we can get it from chocolatey?

```cmd
C:\Users\mcali> choco list paint.net
jivkok.dev1 1.1.0.8
kellyelton.devenvironment 1.0.0.11
paint.net 4.0.6
Pinta 1.5.0.20130501
4 packages found.
```

Yep, there it is!

'choco list' does a search of the chocolatey gallery, with an optional search term. You can also ask it to show you locally-installed packages with the '--local-only' or '-l' flag. For example, my work laptop lists the following for locally-installed packages:

```cmd
C:\Users\neilm> choco list -l
chocolatey 0.9.9.12
ConEmu 16.3.13.0
DotNet4.5.1 4.5.1.20140606
git 2.7.4
git.install 2.7.4
notepadplusplus 6.9
notepadplusplus.install 6.9
poshgit 0.6.0.20160310
rust 1.7.0
VisualStudioCode 0.10.11
10 packages installed.
```

Let's get Paint.NET installed, and see if chocolatey delivers on its promise.

```
C:\Users\mcali> choco install paint.net
Installing the following packages:
paint.net
By installing you accept licenses for the packages.

<info-log snipped for brevity>

Chocolatey installed 1/1 package(s). 0 package(s) failed.
See the log for details (C:\ProgramData\chocolatey\logs\chocolatey.log).
```

In Paint.NET's case, chocolatey just fires up the .exe installer in silent mode, which then takes over.

[![Chocolatey installing Paint.NET]({photo}install-pdn.png)]({filename}images/install-pdn.png "Sort of like magic-ish.")

Look Ma, no Googling!

But actually, maybe I've had a change of heart. I don't need an image editor after all. Let's uninstall it:

```cmd
C:\Users\mcali> choco uninstall paint.net
Uninstalling the following packages:
paint.net

paint.net v4.0.6
    Skipping auto uninstaller - AutoUninstaller feature is not enabled.
    paint.net has been successfully uninstalled.

Chocolatey uninstalled 1/1 packages. 0 packages failed.
See the log for details (C:\ProgramData\chocolatey\logs\chocolatey.log).
```

Note that it hasn't been _completely_ removed. The package didn't include a `chocolateyUninstall.ps1`, and Chocolatey defaults to the more conservative option, and doesn't attempt to uninstall it from the system without that script. If you'd rather it were just removed completely, even if the package doesn't have a dedicated uninstaller, you can set `choco feature enable -n autoUninstaller` and it'll remove everything when you do an 'uninstall'. 
And of course, like any good package manager, Chocolatey can keep your packages updated. Either by name:

```cmd
choco upgrade paint.net
```

or all at once:

```cmd
choco upgrade all
```

## Next time
That's all for now! At the very least, now you've got some better syntax highlighting, tab-and-auto-completion, and a nice package manager or two.  
Next time, we'll be talking about better Git integration, and improvements to the actual console experience. Look forward to tabs, splitting your console, and better resize support for non-Windows 10 machines!


Part 2 is now available [here]({filename}/saner-command-line-part-2.md)!

[![Creative Commons BY badge]({filename}images/cc-by.png)](https://creativecommons.org/licenses/by/4.0/ "This work is licensed under a Creative Commons Attribution 4.0 International License.")

_This work is licensed under a Creative Commons Attribution 4.0 International License._
_Originally posted on the Futurice blog at https://www.futurice.com/blog/a-saner-windows-command-line-part-1/

_Updated April 15, 2020 to update information about PackageManagement_