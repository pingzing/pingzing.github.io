const BASE_URL = "http://localhost:7071";

interface BlogComment {
    id?: string;
    poster: string;
    date: Date;
    articleSlug: string;
    parentComment?: string;
    body: string;
}

async function getComments(): Promise<number> {
    return Promise.resolve(5);
}

async function submitComment(event: Event): Promise<void> {
    event.preventDefault();    
    
    const url = `${BASE_URL}/api/PostComment`;

    const articleSlug = window.location.pathname.replace('/', "").split('.')[0] ?? "invalid";
    console.log("articleSlug is: " + articleSlug);
    const posterInput = document.getElementById("comment-name") as HTMLInputElement;
    const bodyTextarea = document.getElementById("add-comment") as HTMLTextAreaElement;
    const comment: BlogComment = {
        id: undefined,
        poster: posterInput.value,
        date: new Date(Date.now()),
        articleSlug: articleSlug,
        parentComment: undefined,
        body: bodyTextarea.value
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(comment)
    });

    console.log(`Response from server: ${await response.text()}, Status: ${response.status}`);
}

function registerSubmitListener() {
    const form = document.getElementById("comments-form");    
    form?.addEventListener("submit", submitComment);
}

window.onload = registerSubmitListener;