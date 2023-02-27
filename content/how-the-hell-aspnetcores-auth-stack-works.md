Title: How the Hell ASP.NET Core's Auth Stack Works
Date: 2022-10-13 23:00
Category: Programming
Tags: progrmaming, backend, web api, asp.net core, .net core, .net, web dev, screaming
Slug: how-the-hell-aspnetcores-auth-stack-works
Authors: Neil McAlister
Summary: A simple explanation of how authentication and authorization work in ASP.NET Core
Status: draft
image: {photo}image_folder_relative_path.png
teaser: <p> Raw HTML text that will get used for a teaser, instead of trying to auto-generate one. Only used when this is the topmost article in a list. </p>

I have recently had the dubious fortune of having some company-~~mandated~~recommended free time while at work. During it, I took the opportunity to try to rewrite
our C# auth code. Because ASP.NET is the only game in town when it comes to web frameworks for C#, this means that you either learn how it works, or you go home. So, after about a week of reading, 
writing code, and generally noodling about, I think I've _finally_ wrapped my head around how it all fits together. 

Now that I have, I want to share this cursed trove of knowledge because a) I wish some explanation like this had existed when I was doing the work, and b) I'm 90% sure I'll wind up referring back to this later.

Let's get to it.

## Authentication vs. Authorization

One thing that ASP.NET Core demands that you understand is the difference between _Authentication_ and _Authorization_. 
Other web frameworks, like the ubiquitous Express in Javascript, are a little muddier about the distinction--they'll handle authenticating the user for you, but authorizing them is something that you just handle yourself in router code.

So before we can move any further, we gotta understand the distinction. 

_Authentication_ is identifying "who you are". It's the process of taking in, say, a username and password, and verifying that they're valid input.

_Authorization_ is identifying "what you have access to". This is the process of saying that you're allowed to visit the homepage and your profile, but not the administrator dashboard.

Okay. That's some basic groundwork. Let's move on to specifics.

## ASP.NET Core Stuff: Schemes and Policies

The cornerstones of handling Auth Stuff(tm) in ASP.NET Core are Schemes and Policies.

There are a million tutorials that explain how to use these, and how to write little toy-code examples of these, but precious few that explain _what the hell they are_.

They're very simple, as it turns out.

A _Scheme_ is a method of _authenticating_ (See? There's a reason I had that vocabulary lesson up above) the user. A Scheme is uniquely identified by a `string` name.

A _Policy_, on the other hand, is a set of criteria that must be met in order for the caller to be consider _authorized_ (eh? eh?) for whatever thing we're protecting. These criteria are individually called Requirements. A Policy is also uniquely identified by a `string` name.