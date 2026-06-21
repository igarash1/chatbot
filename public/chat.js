// Vanilla front-end for the support chat. Holds the conversation history in
// memory and round-trips it to POST /chat each turn — the server is stateless.

const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");

// Opaque to us: whatever the server returns, we send back next turn.
let history = [];

/** Append a message bubble and keep the view scrolled to the latest. */
function addBubble(text, kind) {
  const el = document.createElement("div");
  el.className = `bubble ${kind}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function setBusy(busy) {
  inputEl.disabled = busy;
  sendEl.disabled = busy;
  if (!busy) inputEl.focus();
}

async function sendMessage(message) {
  addBubble(message, "user");
  setBusy(true);
  const typing = addBubble("…", "bot typing");

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    typing.remove();

    if (!res.ok) {
      addBubble("Sorry, something went wrong. Please try again.", "error");
      return;
    }

    const data = await res.json();
    // Trust but verify: keep the prior history if the server returns something odd.
    history = Array.isArray(data.history) ? data.history : history;
    addBubble(data.reply, "bot");
  } catch {
    typing.remove();
    addBubble("Couldn't reach the server. Check your connection and try again.", "error");
  } finally {
    setBusy(false);
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = inputEl.value.trim();
  if (!message) return;
  inputEl.value = "";
  sendMessage(message);
});

addBubble("Hi! How can I help you today?", "bot");
inputEl.focus();
