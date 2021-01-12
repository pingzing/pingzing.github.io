async function getComments(): Promise<number> {
    return Promise.resolve(5);
}

async function submitComment(event: Event): Promise<void> {
    event.preventDefault();    
    // do the thing
    alert("running submit comment!");    
}

function registerListeners() {
    const form = document.getElementById("comments");
    console.log(`Form is: ${form}`);
    form?.addEventListener("submit", submitComment);
}

window.onload = registerListeners;