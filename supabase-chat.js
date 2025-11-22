// supabase-chat.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TODO: replace with your actual values from Supabase → Settings → API
const SUPABASE_URL = "https://aokbylwdfdgyojhrdjuf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2J5bHdkZmRneW9qaHJkanVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzI0MzAsImV4cCI6MjA3OTQwODQzMH0.9fFJBxJa_iYHZMWBwLwGO3U036Cis2bTgUY5s9LpzLY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Grab elements
const authStatusTitle = document.getElementById("authStatusTitle");
const authSignedOut = document.getElementById("authSignedOut");
const authSignedIn = document.getElementById("authSignedIn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authUsername = document.getElementById("authUsername");
const authUserNameLabel = document.getElementById("authUserNameLabel");
const signUpBtn = document.getElementById("authSignUpBtn");
const signInBtn = document.getElementById("authSignInBtn");
const signOutBtn = document.getElementById("authSignOutBtn");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatHint = document.getElementById("chatHint");

let currentUser = null;
let currentProfile = null;

// ---------- Auth helpers ----------

async function loadProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("profile error", error);
    return null;
  }
  return data;
}

async function ensureProfile(userId, username) {
  if (!userId) return;
  // try existing
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("profile fetch error", error);
  }
  if (data) return data;

  // create new
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert([{ id: userId, username }])
    .select()
    .maybeSingle();

  if (insertError) {
    console.warn("profile insert error", insertError);
    return null;
  }

  return created;
}

function updateAuthUI() {
  if (!authStatusTitle) return;
  if (!currentUser) {
    authStatusTitle.textContent = "Not signed in";
    authSignedOut.style.display = "block";
    authSignedIn.style.display = "none";
    chatHint.textContent = "You must be signed in to chat.";
  } else {
    const name = currentProfile?.username || currentUser.email || "User";
    authStatusTitle.textContent = "Signed in";
    authSignedOut.style.display = "none";
    authSignedIn.style.display = "block";
    authUserNameLabel.textContent = name;
    chatHint.textContent = "Global chat – be chill and respect others.";
  }
}

// Sign up
signUpBtn?.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  const username = authUsername.value.trim() || "Player";

  if (!email || !password) {
    alert("Email and password are required.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    alert("Sign up error: " + error.message);
    return;
  }

  if (data.user) {
    await ensureProfile(data.user.id, username);
    alert("Account created! Check your email if confirmation is required.");
  }
});

// Sign in
signInBtn?.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    alert("Email and password are required.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Login error: " + error.message);
    return;
  }

  if (data.user) {
    currentUser = data.user;
    currentProfile = await loadProfile(currentUser.id);
    updateAuthUI();
  }
});

// Sign out
signOutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  updateAuthUI();
});

// Listen for auth changes
supabase.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    currentProfile = await loadProfile(currentUser.id);
  } else {
    currentProfile = null;
  }
  updateAuthUI();
});

// ---------- Chat ----------

function renderMessage(msg) {
  const div = document.createElement("div");
  const name = msg.username || "User";
  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : "";
  div.textContent = `[${time}] ${name}: ${msg.content}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadInitialMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.warn("load messages error", error);
    return;
  }
  chatMessages.innerHTML = "";
  data.forEach(renderMessage);
}

chatSendBtn?.addEventListener("click", async () => {
  if (!currentUser) {
    alert("You must be signed in to send messages.");
    return;
  }
  const text = chatInput.value.trim();
  if (!text) return;

  const username = currentProfile?.username || currentUser.email || "User";

  const { error } = await supabase.from("messages").insert([
    {
      user_id: currentUser.id,
      username,
      content: text
    }
  ]);

  if (error) {
    alert("Send failed: " + error.message);
    return;
  }
  chatInput.value = "";
});

// send on Enter
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    chatSendBtn.click();
  }
});

// Realtime subscription
supabase
  .channel("public:messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      renderMessage(payload.new);
    }
  )
  .subscribe();

// Load messages on startup
loadInitialMessages();
