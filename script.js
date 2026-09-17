const STORAGE_KEY = "secretmewah_posts_v1";
const THEME_KEY = "secretmewah_theme";
const USER_KEY = "secretmewah_user";

const demoPosts = [
  { id: 1, user: "serein", handle: "@serein", time: "2h", avatar: "S", caption: "Good vibes only. ☀️", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85", likes: 245, comments: 18, liked: false },
  { id: 2, user: "ryan", handle: "@ryan_", time: "5h", avatar: "R", caption: "Small steps, big dreams. 💪", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85", likes: 189, comments: 12, liked: false },
  { id: 3, user: "luna", handle: "@luna.t", time: "1d", avatar: "L", caption: "A quiet corner of the world.", image: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=85", likes: 97, comments: 7, liked: false }
];

const suggestions = [
  ["ellyn", "@ellyn_", "E"], ["kevin", "@kevinx", "K"], ["luna", "@luna.t", "L"], ["thanaphat", "@thanaphat_", "T"], ["nana", "@nana.99", "N"]
];

let posts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || demoPosts;
let currentView = "home";
let followed = new Set(JSON.parse(localStorage.getItem("secretmewah_followed") || "[]"));

const content = document.getElementById("content");
const rightbar = document.getElementById("rightbar");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalContent = document.getElementById("modalContent");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  localStorage.setItem("secretmewah_followed", JSON.stringify([...followed]));
}

function avatar(letter, cls = "") {
  return `<span class="avatar ${cls}">${letter}</span>`;
}

function render() {
  document.querySelectorAll("[data-view]").forEach(el => {
    el.classList.toggle("selected", el.dataset.view === currentView && el.classList.contains("nav-item"));
    el.classList.toggle("active", el.dataset.view === currentView && el.classList.contains("icon-btn"));
  });

  if (currentView === "home") renderHome();
  else if (currentView === "explore") renderExplore();
  else if (currentView === "messages") renderMessages();
  else if (currentView === "notifications") renderNotifications();
  else if (currentView === "profile") renderProfile();
  else if (currentView === "settings") renderSettings();

  renderRightbar();
}

function renderHome() {
  content.innerHTML = `
    <div class="card composer">
      <div class="composer-top">
        ${avatar("S", "avatar-self")}
        <div class="composer-input" data-action="open-create">What's on your mind?</div>
      </div>
      <div class="composer-actions">
        <button class="composer-action" data-action="open-create">▧ Photo</button>
        <button class="composer-action" data-action="open-create">▣ Video</button>
        <button class="composer-action" data-action="open-create">☺ Feeling</button>
        <button class="primary-btn" data-action="open-create">Post</button>
      </div>
    </div>
    ${posts.map(postCard).join("")}
  `;
}

function postCard(post) {
  return `
    <article class="card post" data-post-id="${post.id}">
      <div class="post-head">
        ${avatar(post.avatar)}
        <div class="post-user"><strong>${escapeHTML(post.user)}</strong><small>${escapeHTML(post.handle)} · ${post.time}</small></div>
        <button class="more" title="More options">•••</button>
      </div>
      <div class="post-caption">${escapeHTML(post.caption)}</div>
      ${post.image ? `<img class="post-image" src="${post.image}" alt="Post image" loading="lazy" />` : ""}
      <div class="post-actions">
        <button class="action-button like-btn ${post.liked ? "liked" : ""}" data-action="like" data-id="${post.id}"><span class="symbol">${post.liked ? "♥" : "♡"}</span><span>${post.likes}</span></button>
        <button class="action-button" data-action="comment" data-id="${post.id}"><span class="symbol">◯</span><span>${post.comments}</span></button>
        <button class="action-button" data-action="share"><span class="symbol">⌁</span></button>
        <button class="action-button bookmark" data-action="bookmark"><span class="symbol">♧</span></button>
      </div>
    </article>
  `;
}

function renderExplore() {
  content.innerHTML = `
    <div class="page-heading"><h2>Explore</h2><span class="muted">Discover something new</span></div>
    <div class="gallery card" style="padding:8px">${Array.from({length: 12}, (_, i) => `<div style="background-image:url('https://images.unsplash.com/photo-${["1497250681960-ef046c08a56e","1519681393784-d120267933ba","1500534623283-312aade485b7","1518837695005-2083093ee35b","1493246507139-91e8fad9978e","1500530855697-b586d89ba3ee"][i%6]}?auto=format&fit=crop&w=500&q=80');background-size:cover;background-position:center"></div>`).join("")}</div>
  `;
}

function renderMessages() {
  const people = [["serein","Good morning! How are you?", "S"],["ryan","Sent you a photo", "R"],["ellyn","You: Thanks!", "E"],["luna","Let's catch up soon.", "L"]];
  content.innerHTML = `<div class="page-heading"><h2>Messages</h2><button class="primary-btn" style="margin:0" data-action="new-message">New</button></div>
    <div class="card message-list">${people.map((p,i)=>`<div class="message-row" data-action="message"><div>${avatar(p[2])}</div><div class="message-copy"><strong>${p[0]}</strong><small>${p[1]}</small></div>${i<2?'<span class="unread-dot"></span>':''}</div>`).join("")}</div>`;
}

function renderNotifications() {
  content.innerHTML = `<div class="page-heading"><h2>Notifications</h2><span class="muted">Recent activity</span></div>
    <div class="card message-list">
      ${[
        ["ellyn","liked your post","E"],["ryan","started following you","R"],["luna","commented: “Love this!”","L"],["thanaphat","mentioned you in a post","T"]
      ].map(x=>`<div class="message-row"><div>${avatar(x[2])}</div><div class="message-copy"><strong>${x[0]}</strong><small>${x[1]} · recently</small></div></div>`).join("")}
    </div>`;
}

function renderProfile() {
  content.innerHTML = `<div class="card">
    <div class="profile-cover"></div><div class="profile-body" style="padding-top:0">
      ${avatar("S", "profile-avatar avatar-self")}
      <h3>secretmewah</h3><p>@secretmewah · Connect • Share • Be Yourself</p>
      <div class="stats"><div><strong>${posts.filter(p=>p.user==="secretmewah").length}</strong><span>Posts</span></div><div><strong>248</strong><span>Followers</span></div><div><strong>56</strong><span>Following</span></div></div>
      <button class="outline-btn" data-action="edit-profile">Edit Profile</button>
    </div>
  </div>
  <div class="page-heading" style="margin-top:24px"><h2>Your posts</h2></div>
  ${posts.filter(p=>p.user==="secretmewah").length ? posts.filter(p=>p.user==="secretmewah").map(postCard).join("") : `<div class="card empty-state"><div class="empty-icon">▧</div><div>You haven't posted anything yet.</div></div>`}`;
}

function renderSettings() {
  content.innerHTML = `<div class="page-heading"><h2>Settings</h2></div>
    <div class="card section-card">
      ${["Account","Privacy","Appearance","Notifications","Help Center"].map((x,i)=>`<button class="message-row" style="width:100%;background:transparent;text-align:left;border:0" data-action="setting" data-setting="${x}"><span style="font-size:22px">${["♙","♧","☾","♢","?"][i]}</span><span style="flex:1">${x}</span><span>›</span></button>`).join("")}
      <button class="message-row" style="width:100%;background:transparent;text-align:left;border:0;color:#ff5964" data-action="logout"><span>⇥</span><span>Log Out</span></button>
    </div>`;
}

function renderRightbar() {
  rightbar.innerHTML = `
    <div class="card section-card">
      <div class="section-title"><h3>Suggested for you</h3><a>See all</a></div>
      ${suggestions.map(s => `<div class="person-row">${avatar(s[2], "small")}<div class="person-info"><strong>${s[0]}</strong><small>${s[1]}</small></div><button class="follow-btn ${followed.has(s[0]) ? "following":""}" data-action="follow" data-name="${s[0]}">${followed.has(s[0]) ? "Following" : "Follow"}</button></div>`).join("")}
    </div>
    <div class="card section-card">
      <div class="section-title"><h3>Trending</h3><a>See all</a></div>
      ${[["#life","128K posts"],["#travel","95K posts"],["#aesthetic","82K posts"],["#goodvibes","67K posts"],["#friends","52K posts"]].map(t=>`<div class="trend"><strong>${t[0]}</strong><small>${t[1]}</small></div>`).join("")}
    </div>
    <div class="card section-card">
      <div class="section-title"><h3>Contacts</h3><a>See all</a></div>
      ${[["serein","S"],["ryan","R"],["ellyn","E"],["luna","L"]].map(p=>`<div class="person-row">${avatar(p[1],"small")}<div class="person-info"><strong>${p[0]}</strong><small>● Online</small></div><button class="more" data-action="message">▢</button></div>`).join("")}
    </div>
    <div class="card">
      <div class="profile-cover"></div>
      <div class="profile-body">
        ${avatar("S", "profile-avatar avatar-self")}
        <h3>secretmewah</h3><p>@secretmewah</p>
        <div class="stats"><div><strong>${posts.filter(p=>p.user==="secretmewah").length}</strong><span>Posts</span></div><div><strong>248</strong><span>Followers</span></div><div><strong>56</strong><span>Following</span></div></div>
        <button class="outline-btn" data-view="profile">View Profile</button>
      </div>
    </div>
    <div class="card section-card">
      <div class="section-title"><h3>Recent Photos</h3><a>See all</a></div>
      <div class="gallery">${[1,2,3,4,5,6].map((_,i)=>`<div></div>`).join("")}</div>
    </div>`;
}

function openCreateModal() {
  modalContent.innerHTML = `<h2>Create a post</h2>
    <div class="form-group"><label>What's on your mind?</label><textarea id="postText" rows="4" placeholder="Share something with your community..."></textarea></div>
    <div class="form-group"><label>Image URL (optional)</label><input id="postImage" placeholder="https://..." /></div>
    <button class="form-submit" id="submitPost">Publish post</button>`;
  openModal();
  document.getElementById("submitPost").onclick = () => {
    const caption = document.getElementById("postText").value.trim();
    const image = document.getElementById("postImage").value.trim();
    if (!caption && !image) return toast("Write something or add an image first.");
    posts.unshift({id: Date.now(), user:"secretmewah", handle:"@secretmewah", time:"now", avatar:"S", caption: caption || "📷", image, likes:0, comments:0, liked:false});
    save(); closeModal(); currentView="home"; render(); toast("Your post has been published!");
  };
}

function openModal() { modalBackdrop.classList.remove("hidden"); }
function closeModal() { modalBackdrop.classList.add("hidden"); }

function toast(message) {
  const el = document.createElement("div"); el.className="toast"; el.textContent=message;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(()=>el.remove(), 2800);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-view], [data-action]");
  if (!target) return;
  if (target.dataset.view) { currentView = target.dataset.view; render(); window.scrollTo({top:0, behavior:"smooth"}); return; }
  const action = target.dataset.action;
  if (action === "open-create") openCreateModal();
  if (action === "like") {
    const p = posts.find(x=>x.id == target.dataset.id); if (!p) return;
    p.liked = !p.liked; p.likes += p.liked ? 1 : -1; save(); render();
  }
  if (action === "comment") {
    const p = posts.find(x=>x.id == target.dataset.id); const text = prompt("Write a comment:");
    if (text && text.trim()) { p.comments++; save(); render(); toast("Comment added."); }
  }
  if (action === "share") { navigator.clipboard?.writeText(location.href); toast("Post link copied!"); }
  if (action === "bookmark") toast("Saved to your bookmarks.");
  if (action === "follow") {
    const name = target.dataset.name;
    followed.has(name) ? followed.delete(name) : followed.add(name);
    save(); renderRightbar(); toast(followed.has(name) ? `You are now following ${name}.` : `Unfollowed ${name}.`);
  }
  if (action === "message" || action === "new-message") toast("Messaging UI is ready for backend integration.");
  if (action === "edit-profile") toast("Profile editing will be connected to your account database later.");
  if (action === "setting") toast(`${target.dataset.setting} settings selected.`);
  if (action === "logout") toast("Demo mode: you are still logged in.");
});

document.getElementById("modalClose").onclick = closeModal;
modalBackdrop.addEventListener("click", e => { if (e.target === modalBackdrop) closeModal(); });

document.getElementById("themeToggle").addEventListener("change", e => {
  document.body.classList.toggle("dark", e.target.checked);
  localStorage.setItem(THEME_KEY, e.target.checked ? "dark" : "light");
});
if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  document.getElementById("themeToggle").checked = true;
}

document.getElementById("globalSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { if (currentView === "home") renderHome(); return; }
  const results = posts.filter(p => `${p.user} ${p.caption} ${p.handle}`.toLowerCase().includes(q));
  content.innerHTML = `<div class="page-heading"><h2>Search results</h2></div>${results.length ? results.map(postCard).join("") : `<div class="card empty-state"><div class="empty-icon">⌕</div>No results found.</div>`}`;
});

render();
