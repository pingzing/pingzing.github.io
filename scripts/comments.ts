const BASE_URL = "http://localhost:7071/api";

interface BlogComment {
    commentId?: string;
    poster: string;
    date: Date;
    articleSlug: string;
    parentComment?: string;
    body: string;
}

async function updateComments(): Promise<void> {

    // Get latest comments
    const articleSlug = window.location.pathname.replace('/', "").split('.')[0] ?? "invalid";
    const commentsResponse = await fetch(`${BASE_URL}/${articleSlug}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    if (!commentsResponse.ok) {
        console.log(`Failed to get comments. ${commentsResponse.status}: ${await commentsResponse.text()}`);
        return;
    }

    const commentsArray: BlogComment[] = (await commentsResponse.json()).comments;

    // Add comments that are missing
    const existingComments = document.getElementById("comments-list") as HTMLOListElement;
    const olChildren: Element[] = Array.from(existingComments.children);
    const postedIds = olChildren.map(e => { return e.id; });
    const commentsToAdd = commentsArray.filter((c) => {
        return !postedIds.includes(c.commentId ?? "");
    });

    commentsToAdd.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Construct new elements, add as children of the <ol>
    // TODO: A few inconsistencies with dates in these comments compared to pregenerated ones:
    // Pregenerated abbr-title datetimes are: YYYY-MM-DD HH:MM:SS+ZZZZ.
    // JS-generated abbr-title datetimes are: YYYY-MM-DDTHH:MM:SSZ (that's a literal Z, btw)
    // TODO: Maybe removes dates from pre-generation entirely, and do date-display client-side? would be nicer for readers.
    const newLiItems = commentsToAdd.map((c) => {
        const li = document.createElement("li");
        li.classList.add("comment");
        if (c.parentComment) { li.classList.add("parented"); }
        li.id = c.commentId ?? "no ID!";
        li.dataset["date"] = new Date(c.date).toISOString();

        const h5 = document.createElement("h5");
        h5.textContent = c.poster;

        const abbr = document.createElement("abbr");
        abbr.classList.add("published");
        abbr.title = new Date(c.date).toISOString();
        abbr.textContent = new Date(c.date).toLocaleString('default', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'UTC' });

        const div = document.createElement("div");
        div.innerHTML = c.body;

        li.append(h5, abbr, div);
        return li;
    });

    existingComments.append(...newLiItems);
    tryScrollFragmentIntoView();
}

async function submitComment(event: Event): Promise<void> {
    event.preventDefault();

    const articleSlug = window.location.pathname.replace('/', "").split('.')[0] ?? "invalid";

    console.log("articleSlug is: " + articleSlug);
    const posterInput = document.getElementById("comment-name") as HTMLInputElement;
    const bodyTextarea = document.getElementById("add-comment") as HTMLTextAreaElement;
    const comment: BlogComment = {
        commentId: undefined,
        poster: posterInput.value,
        date: new Date(Date.now()),
        articleSlug: articleSlug,
        parentComment: undefined,
        body: bodyTextarea.value
    };

    const response = await fetch(`${BASE_URL}/${articleSlug}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(comment)
    });

    if (!response.ok) {
        console.log(`Failed to post comment. ${response.status}: ${await response.text()}`);
        return;
    }

    const addedCommentId = response.headers.get('Location');
    console.log(`${response.headers}`);

    window.location.hash = `#${addedCommentId}`;
    window.location.reload();
    // The browser will try to scroll the fragment into view after async comments get loaded in
}

function tryScrollFragmentIntoView(): void {    
    if (window.location.hash === "") {
        return;
    }

    const fragment = window.location.hash.replace("#", "");
    const element = document.getElementById(fragment);
    if (element) {
        element.scrollIntoView();
    }
}

async function registerSubmitListener(): Promise<void> {
    const form = document.getElementById("comments-form");
    form?.addEventListener("submit", submitComment);
    await updateComments();
}

window.onload = registerSubmitListener;
tryScrollFragmentIntoView();