Title: The Frankenstein Comment System
Date: 2021-01-30 14:41
Category: Programming
Tags: programming, slim-website, soapboxing, comments, azure, serverless
Slug: the-frankentstein-comment-system
Authors: Neil McAlister
Summary: Stitching together a comment system for a static website.
image: {photo}franken_cover.png

So I promised in my [other post]({filename}this-websites-architecture-personal-soapbox.md) to explain how this site's comment system works. Fair warning, this is not a detailed how-to guide, or a tutorial. It's a more conceptual accounting of my goals and process as I put it together. That said, if you've got a little bit of experience and know-how, you can probably lift the ideas from here to do something similar.

I also drew inspiration from Tania Rascia's excellent [Roll Your Own Comment System for a Static Site](https://www.taniarascia.com/add-comments-to-static-site/), and Khalil Stemmler's spiritual successor, [How to Prerender Comments](https://khalilstemmler.com/articles/gatsbyjs/prerender-comments-for-seo/). If you're loooking for more inspiration, you should definitely check those out.

So! This site is composed entirely of pre-rendered HTML and CSS that I generate on my computer, then upload to a webserver that is–_waves hands_–somewhere. I don't have a backend server that I can use to re-render the page each time a new comment gets added to it. Furthermore, I don't really _want_ one. But I do want a comment system.

What do we do?

We cheat!

At a high level, the cheating is twofold. The easiest solution is just to use a little bit of Javascript to fetch the comments on the client once the page finishes loading. This is _okay_, but having comments visible without making the search engine crawler run Javascript will (might? honestly, SEO is black magic) improve the page's search ranking. Some search engines don't run Javascript at all. So in addition to fetching comments on page load, we'll _also_ pre-render any comments already in the database when we generate the site.

## Location, Location, Location
If we want comments, we'll need some place to store them. That means a database in some fashion. The cheapest and easiest database-y thing I'm aware of [Azure Table Storage](https://docs.microsoft.com/en-us/azure/storage/tables/table-storage-overview), which comes included with any Azure Storage service. At around $0.075 per GB for storage, and $0.00036 per 10,000 transactions (which include reads, writes and deletes), it costs me literal pennies per month. Not a great solution without some extra effort for a larger site, but for a little homepage? Perfect!

We've got a place to store them. Now we need some way of pulling them all down just before I run the site generator so that they can be injected into the relevant pages. Table Storage has a [REST API](https://docs.microsoft.com/en-us/rest/api/storageservices/table-service-rest-api), but writing against a REST API directly is for the birds. Besides, a [shiny C# SDK](https://github.com/Azure/azure-sdk-for-net/tree/master/sdk/tables/Azure.Data.Tables) exists. In fact, like, three of them exist, all of which are–at the time of writing–in various states of either deprecation, or prerelease. The one I have linked is above is _currently_ the latest-and-greatest, but is definitely missing a few features compared to the [older SDK](https://github.com/Azure/azure-cosmos-table-dotnet), though the newer SDK is a bit more user-friendly.

We'll also need to figure out some kind of schema for comments. Table Storage may be a document-based database that can store arbitrary kind-of-JSON, but that's no reason to be sloppy with our data modelling. 

A comment should have a unique ID, an author, a post date, and a body. It should also be associated with the article it belongs to. I also want to give myself the ability to post mark a comment as coming from me, and to reply to comments.

    :::csharp
    public class Comment 
    {
        public Guid? CommentId { get; set; } = null!;
        public string Poster { get; set; } = null!;
        public DateTimeOffset Date { get; set; }
        public string ArticleSlug { get; set; } = null!;
        public Guid? ParentComment { get; set; } = null;
        public string Body { get; set; } = null!;
        public bool IsOwnerComment { get; set; } = false;
    }

`CommentId` is nullable for reasons I'll explain further below.

Okay, that's individual comments figured out. What about the overall database? 

Well, I know that table creation and deletion in Table Storage is _super_ fast and computationally inexpensive. Let's have one table per article. That also allows me to easily nuke an entire article's comments without having to remove individual rows from a larger table. Table names also have to be unique, and have a few requirements that are pretty restrictive:

 - Must begin with an alphabetical character
 - Must be at least 3 characters long
 - Must be at most 63 characters long
 - Can only feature ASCII letters, and numbers

I need something reasonably unique, and relatively simple to massage into the required format. An ID would be ideal, but Pelican doesn't have a concept of article IDs out of the box. It _does_ have article slugs though! Those are user-definable, and are usually just URL-friendly versions of article titles. As long as I never name two articles the same thing, that should work just fine. Let's write some code to turn an article slug into a table name.

    :::csharp
    private static Regex _validTableName = new Regex("[^A-Za-z0-9]");
    private string ToTableName(string articleSlug)
    {
        string sanitizedTableName = _validTableName.Replace(articleSlug, "");        
        if(char.IsDigit(sanitizedTableName.First())) 
        {
            // prefix the slug with "t" so that the table name begins with a non-numeric
            sanitizedTableName = $"t{sanitizedTableName}";
        }
        if (sanitizedTableName.Length < 3)
        {
            // Table names must  be at least 3 chars
            sanitizedTableName.PadLeft(3, 't');
        }
        if (sanitizedTableName.Length > 63)
        {
            // Table names must be at MAX 63 chars
            sanitizedTableName = sanitizedTableName.Substring(0, 63);
        }

        return sanitizedTableName;
    }

Bit of an explanation for the Regex: that `^` means _negation_. That Regex will match any character that is NOT `[A-Za-z0-9]`. Or, in plain English, not A through Z (uppercase or lowercase) or 0 through 9. Then `_validTableName.Replace(articleSlug, "")` will replace any of those invalid characters with an empty string, effectively erasing them from the article slug.

A little rough-and-ready, but it'll get the job done. 

Azure Table Storage also only gives you two keys (which are automatically indexed) per entity: a Partition Key, and a Row Key. A Partition Key is meant to be unique across some arbitrary collection of elements, which is useful if you want to query against some user-defined subset of elements in a given table. Then there's the Row Key, which should be unique per entity.

In my case, I don't really need partitioning–my one-table-per-article design already takes care of that. So my Partition Key and Row Key will be the same: a GUID that gets generated when a new comment is added to the database.

Adding a comment to the database is just a process of  
  1) Creating the comment table for that article if it doesn't exist  
  2) Generating a GUID so the comment has an ID, and  
  3) Adding it to that article's comment table. Upon completion, the comment ID is returned to the caller.  

## Meanwhile, Up Front
This is fine and dandy for pre-rendering on my machine, but what about when a user on the actual site wants to post a comment? Well, especially in the absence of a backend webserver, Javascript is our only choice here.

Now, I really don't like modern web dev. I hate NPM, I hate Webpack and its kin, and SPAs and frameworks are so often way more than what most websites actually need. And Javascript itself is a terrible, terrible language.

TypeScript however, is Very Okay, and it turns out that the absolute minimal TypeScript project is just a single `tconfig.json` file, and a single TypeScript `.ts` file. I'm willing to suck it up and write One Whole TypeScript file. I can import it on article pages, and it'll handle sending comments up to my comments database.

It's about 170 lines, [most of it uninteresting](https://github.com/pingzing/pingzing.github.io/blob/main/site-scripts/comments.ts). It does two important things:
 
First, when the page loads, it fetches comments from the database, and glues the prerendered comments and the latest comments together. (Constructing HTML elements in code sucks. I can see why no one does it.)
 
Second, when you click the "Submit" button, it serializes your comment and sends it up to the database. It then reloads the page with the newly-added comment's ID added as a `#fragment` in the URL. Once the page reloads, it fetches all the comments, including the one just added, and scrolls to the `#fragment`.

 And remember how I mentioned that the `CommentId` is nullable up above? It's because my database expects a `Comment` object from the website, but of course the comment doesn't have an ID yet, so it can't send one up. That's also the reason that the database call returns the comment ID–so that the website can insert it into the URL as a `#fragment` before reloading.
  
## The Lie
_Hold on_, I hear you asking, _you said this site didn't have a backend. What's that TypeScript file talking to?_

 Well, you see...

 I didn't _quite_ lie. I don't have a full backend serving up pages, static or not. I _do_ however have a [few so-called serverless functions](https://github.com/pingzing/pingzing.github.io/blob/main/backend/CommentsController.cs) using Azure Functions that serve as the bridge between the outside world, and my little comments database. They really only do five things: 

  - `GetCommentsForArticle` is used by the script on the article page to fetch all the comments.
  - `GetAllComments` is used by my local build process to prerender comments.
  - `PostComment` is used by the script on the article page to, well, post a comment.
  - `PostOwnerComment` which is protected by a key, and used to post a comment as Me.
  - `DeleteComment` which I don't actually use _yet_, but know I'll need some day.

One bonus here is that Azure Functions has an _excellent_ local development experience. There's a set of CLI tools, a VSCode extension (which sits on top of the CLI tools), and integration into Visual Studio (which has to be installed as a separate workload). Combine that with the Azure Storage emulator, and I'm able to test my whole setup locally. You can actually see my [`comments.ts` pointing to `localhost`](https://github.com/pingzing/pingzing.github.io/blob/c9279ab9d5d83301c047fe066645818caa493990/site-scripts/comments.ts#L1). That gets rewritten as part of my "generate site and publish to production" script.

## The Miscellaneous Bits

Of course there's a bit more glue to keep this thing from falling apart. There's a little bit of Python code in the form of [a Pelican plugin](https://github.com/pingzing/pingzing.github.io/blob/main/plugins/static_comments/static_comments.py) that pulls down all the comments, then listens for Pelican's `article_generator_write_article` signal. It then grabs the relevant comments from the earlier request, does a little bit of data massaging on them, and inserts them onto the `content` object, so that the Jinja template engine has access to them later.

And my publish scripts also make sure to run `tsc`, the TypeScript compiler, on my `comments.ts` file. The output Javascript file goes into `/site-scripts`, which is where article pages go looking for it.

## The Horrible Frankenstein Quilt

So really, there are four pieces to this: 

 - An Azure Table Storage account to act as my comments database
 - A set of Azure Functions to allow the world to interact with that database
 - Some TypeScript (or perhaps Javascript, depending on your point of view) that gets any comments that didn't get pre-rendered, and allow users to submit new comments
 - A bit of Python code that runs at site generation time that fetches comments and allows them to be pre-rendered.

It is _extremely_ simple, and the extra bit of Javscript adds a whole 736 _bytes_ to articles. And it's very cache-friendly!

**Some caveats!**

I don't know how this will hold up against spambots. Probably poorly. I'll tackle that if I ever get any spambots, I guess.

I'd love to add some caching to comment retrieval, but because of how Azure Functions works, that's not really possible. Ish.

If I go for a long time without generating a new version of the site, the difference between pre-rendered and actual comments could get quite large.

_This might actually be a really terrible idea???_ But who knows! It's not like this homepage gets a whole lot of traffic anyway. It'll probably be fine. `¯\_(ツ)\_/¯`

Thanks for reading! Hopefully you were entertained and/or horrified.

As ever, you can find me on Twitter as [@pingzingy](https://twitter.com/pingzingy)...  
...on GitHub as [PingZing](https://github.com/pingzing)...  
...or leave a comment below!

And this website's source code is available right on GitHub: [https://github.com/pingzing/pingzing.github.io](https://github.com/pingzing/pingzing.github.io)

[![Creative Commons BY badge]({filename}images/cc-by.png)](https://creativecommons.org/licenses/by/4.0/ "This work is licensed under a Creative Commons Attribution 4.0 International License.")
_The text of this blog post is licensed under a Creative Commons Attribution 4.0 International License._ 



<small>Yes, I know Frankenstein was the _doctor_, not the monster. But "The Frankenstein's Monster Comment System" just doesn't roll off the tongue the same way.</small>