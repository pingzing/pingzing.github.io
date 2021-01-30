const BASE_URL = "http://localhost:7071/api";

interface BlogComment {
    commentId?: string;
    poster: string;
    date: Date;
    articleSlug: string;
    parentComment?: string;
    body: string;
    isOwnerComment: boolean;
}

let _commentsForm: HTMLFormElement | null = null;
let _ownerCheckbox: HTMLInputElement | null = null;
let _posterNameInput: HTMLInputElement | null = null;
let _bodyTextarea: HTMLTextAreaElement | null = null;
let _ownerCheckboxLabel: HTMLElement | null = null;
let _ownerPasswordInput: HTMLInputElement | null = null;
let _commentsList: HTMLOListElement | null = null;

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
    const olChildren: Element[] = Array.from(_commentsList!.children);
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
        if (c.isOwnerComment) {
            h5.classList.add("owner-comment");
        }

        const abbr = document.createElement("abbr");
        abbr.classList.add("published");
        abbr.title = new Date(c.date).toISOString();
        abbr.textContent = new Date(c.date).toLocaleString('default', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'UTC' });

        const div = document.createElement("div");
        div.innerHTML = c.body;

        li.append(h5, abbr, div);
        return li;
    });

    _commentsList?.append(...newLiItems);
    tryScrollFragmentIntoView();
}

async function submitComment(event: Event): Promise<void> {
    event.preventDefault();

    const articleSlug = window.location.pathname.replace('/', "").split('.')[0] ?? "invalid";    
        
    const comment: BlogComment = {
        commentId: undefined,
        poster: _posterNameInput?.value ?? "",
        date: new Date(Date.now()),
        articleSlug: articleSlug,
        parentComment: undefined,
        body: _bodyTextarea?.value ?? "",
        isOwnerComment: _ownerCheckbox?.checked ?? false
    };

    let url: string;
    if (_ownerCheckbox?.checked) {
        url = `${BASE_URL}/owner/${articleSlug}?code=${_ownerPasswordInput?.value}`;
    } else {
        url = `${BASE_URL}/${articleSlug}`;
    }

    const response = await fetch(url, {
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

function onOwnerCheckboxChanged(_: Event): void {            
    if (_ownerCheckbox?.checked) {
        _ownerCheckboxLabel?.classList.remove("hidden");
        _ownerPasswordInput?.classList.remove("hidden");        
        _ownerPasswordInput!.disabled = false;
        _posterNameInput!.disabled = true;
    } else {
        _ownerCheckboxLabel?.classList.add("hidden");
        _ownerPasswordInput?.classList.add("hidden"); 
        _ownerPasswordInput!.value = "";
        _ownerPasswordInput!.disabled = true;   
        _posterNameInput!.disabled = false;     
    }

}

async function onLoaded(): Promise<void> {
    _commentsForm = document.getElementById("comments-form") as HTMLFormElement;
    _commentsForm?.addEventListener("submit", submitComment);

    _ownerCheckbox = document.getElementById("owner-checkbox") as HTMLInputElement;
    _ownerCheckbox?.addEventListener("change", onOwnerCheckboxChanged);

    _posterNameInput = document.getElementById("comment-name") as HTMLInputElement;
    _bodyTextarea = document.getElementById("add-comment") as HTMLTextAreaElement;
    _ownerCheckboxLabel = document.getElementById("comment-owner-password-label");
    _ownerPasswordInput = document.getElementById("comment-owner-password-input") as HTMLInputElement;
    _commentsList = document.getElementById("comments-list") as HTMLOListElement;

    await updateComments();    
}

window.addEventListener("DOMContentLoaded", onLoaded);
tryScrollFragmentIntoView();