Title: This Website's Architecture; or, My Personal Soapbox
Date: 2021-01-16 12:02PM
Category: Programming
Tags: programming, slim-website, soapboxing, personal-philosophy
Slug: this-websites-architecture-personal-soapbox
Authors: Neil McAlister
Summary: The philosophy behind my little page in this corner of the web.

## What am I on about?

This website began life as a free, hosted WordPress blog. I wanted some place to share my travel experiences for family members to follow along, and WordPress was free and easy. Some time later, I thought it would be fun to (finally) learn how to go about getting a website hosted, so I moved the content off of WordPress, and into a [static site generator](https://blog.getpelican.com/) because that was the easiest (and cheapest) thing to host.

Then, I spent five years working in the software industry.

There, I learned that modern web dev is a [hopelessly-complicated](https://hackernoon.com/how-it-feels-to-learn-javascript-in-2016-d3a717dd577f), labyrinthine, kafkaesque nightmare that encourages reams and reams of Javascript, which require generators, preprocessors, bundlers, frameworks, and transpilers, all in an effort to wrench the web into a half-functional application framework.

If this were just in service of waking web applications, I might even be okay with that; taken individually, all these descisions make a fair amount of sense in context. But a lot of the time, websites whose primary purpose is to display text and the occasional image or two, are forced to lug around a megabyte and a half of web framework and Javascript.

This frustrates me. And I'm [not the only one](http://bettermotherfuckingwebsite.com/).

Moreover, I'm also made uneasy by the way that tech giants have collected all of us into about four or five walled-garden megaplatforms: Reddit, Twitter, Instagram, Facebook, YouTube, etc. The age of the personal homepage is dead and buried, and Facebook has even begun eating small business sites too. After all, why hire someone to make you a webpage when Facebook provides all the tools for free? All they demand is your users' data, and that's not a price that _you're_ paying.

So: this website. My own personal homepage, where I can say whatever nonsense I like, style pages in whatever way I please, and even–horror of horrors–embed auto-playing MIDIs. 

...though modern browsers are probably smart enough to mute that nonsense right away. Thank heavens.

Instead of just wallowing in nostalgia for a bygone era, I've tried to draw inspiration from it, and take advantage of all that we've learned in the intervening twenty years or so. So let's talk architecture.

## Architecture

The basic philosophy is driven by two goals: simplicity, and size. I want the site to be both uncomplicated, and have as small a footprint as possible. So, static HTML is the way to go. No backend, because hosting server software is about ten times more complicated than just hosting static files. I also wanted to author content in Markdown instead of raw HTML, so that means I'll want a site generator. There are [more static site generators](https://jamstack.org/generators/) than you can shake a stick at out there. I landed on [Pelican](https://docs.getpelican.com/en/latest/#) mostly because it supported Markdown and could import from WordPress. It also has a pretty simple (though, typical of Python projects, poorly-documented) plugin system, so customizing it is pretty easy.

Pelican provides a number of community-maintained themes, and the theme I'm using is a version of [cebong](https://github.com/getpelican/pelican-themes/tree/master/cebong) I've modified to support article cover images, and teaser text for featured articles. There's a lot of stuff in the template/theme I don't need that I'm slowly winnowing down in an effort to bring file size down--my CSS files are about 16kB, and I bet I can get that smaller. It also imports about 30kB of webfonts which I _could_ trim out, but I like how they look, so I'm willing to put up with it.

So I write my blog posts and pages in Markdown, and run them through Pelican, which transforms everything into HTML, handles resolving relative links, generates thumbnails, that kind of thing.

In addition, I have a single TypeScript file that, once compiled to Javascript, takes up about 12kB that powers the comments. I intend for _that_ whole mess to be the subject of a future blog post, because putting it together was an interesting experiment in stitching things together.

The end result is that this article is about 57kB of CSS/JS, plus about 10kB of HTML for a total file size of 70kB. That's about 3 or 4 seconds on a 56k dial-up connection. Not bad. Images, of course, will immediately blow that number up by orders of magnitude, but 

An image looks like this: 
[![Alt-text]({photo}imagename.jpg)]({static}images/imagename.jpg "Mouseover text here")

An internal link looks like this:
[Text to show]({static}/absolute/path/relative/to-root.md)
or, a relative path:
[Text to show]({static}../relative/to-current-file.md)

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