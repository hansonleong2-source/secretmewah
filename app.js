let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let currentView = "home";
let currentSearch = "";

const $ = id => document.getElementById(id);
const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const avatar = (profile, cls="") => profile?.avatar_url
  ? `<img class="avatar ${cls}" src="${escapeHTML(profile.avatar_url)}" alt="">`
  : `<span class="avatar ${cls}">${escapeHTML((profile?.display_name || profile?.username || "S")[0].toUpperCase())}</span>`;

function toast(message) {
  const el=document.createElement("div"); el.className="toast"; el.textContent=message;
  $("toastContainer").appendChild(el); setTimeout(()=>el.remove(),2800);
}
function showAuthMessage(msg){$("authMessage").textContent=msg;$("authMessage").classList.remove("hidden")}
function clearAuthMessage(){$("authMessage").classList.add("hidden")}
function setView(v){currentView=v; document.querySelectorAll("[data-view]").forEach(x=>{x.classList.toggle("selected",x.dataset.view===v&&x.classList.contains("nav-item"));x.classList.toggle("active",x.dataset.view===v&&x.classList.contains("icon-btn"));});}

async function init(){
  const cfg=window.SECRETMewahConfig||{};
  if(!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("PASTE_") || !cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_")){
    showAuthMessage("Add your Supabase URL and publishable key in config.js first.");
    return;
  }
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session) await enterApp(session.user); else showAuth();
  supabaseClient.auth.onAuthStateChange(async (event,session)=>{
    if(session) await enterApp(session.user); else showAuth();
  });
}

function showAuth(){
  $("authScreen").classList.remove("hidden");$("app").classList.add("hidden");
}
async function enterApp(user){
  currentUser=user;
  $("authScreen").classList.add("hidden");$("app").classList.remove("hidden");
  await loadProfile();
  setTheme();
  await render();
  subscribeRealtime();
}
async function loadProfile(){
  const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",currentUser.id).single();
  if(error){toast("Could not load your profile.");console.error(error);return}
  currentProfile=data; $("topAvatar").outerHTML=avatar(currentProfile,"avatar-self"); $("topAvatar")?.remove?.();
}
function setTheme(){
  const dark=localStorage.getItem("secretmewah_theme")==="dark";
  document.body.classList.toggle("dark",dark); $("themeToggle").checked=dark;
}
async function render(){
  setView(currentView);
  if(currentView==="home") await renderHome();
  if(currentView==="explore") await renderExplore();
  if(currentView==="profile") await renderProfile();
  if(currentView==="messages") await renderMessages();
  if(currentView==="notifications") await renderNotifications();
  if(currentView==="settings") renderSettings();
  await renderRightbar();
  await updateCounts();
}
async function getPosts(limit=20){
  let q=supabaseClient.from("posts").select("id,user_id,caption,image_url,created_at,profiles(id,username,display_name,avatar_url),post_likes(user_id),comments(count)").order("created_at",{ascending:false}).limit(limit);
  const {data,error}=await q;if(error){console.error(error);return []}
  return (data||[]).map(p=>({...p,liked:p.post_likes?.some(l=>l.user_id===currentUser.id),likes:p.post_likes?.length||0,commentsCount:p.comments?.[0]?.count||0}));
}
async function renderHome(){
  const posts=await getPosts();
  const filtered=currentSearch?posts.filter(p=>`${p.profiles?.username} ${p.profiles?.display_name} ${p.caption}`.toLowerCase().includes(currentSearch)):posts;
  $("content").innerHTML=`<div class="card composer"><div class="composer-top">${avatar(currentProfile,"avatar-self")}<div class="composer-input" data-action="open-create">What's on your mind?</div></div><div class="composer-actions"><button class="composer-action" data-action="open-create">▧ Photo</button><button class="composer-action" data-action="open-create">▣ Video</button><button class="composer-action" data-action="open-create">☺ Feeling</button><button class="primary-btn" data-action="open-create">Post</button></div></div>${filtered.length?filtered.map(postCard).join(""):`<div class="card empty-state"><div class="empty-icon">⌂</div>No posts yet. Be the first to share something.</div>`}`;
}
function postCard(p){
  return `<article class="card post" data-post-id="${p.id}"><div class="post-head">${avatar(p.profiles)}<div class="post-user"><strong>${escapeHTML(p.profiles?.display_name||p.profiles?.username)}</strong><small>@${escapeHTML(p.profiles?.username)} · ${timeAgo(p.created_at)}</small></div><button class="more" data-action="post-menu" data-id="${p.id}">•••</button></div><div class="post-caption">${escapeHTML(p.caption)}</div>${p.image_url?`<img class="post-image" src="${escapeHTML(p.image_url)}" alt="Post image" loading="lazy">`:""}<div class="post-actions"><button class="action-button ${p.liked?"liked":""}" data-action="like" data-id="${p.id}"><span class="symbol">${p.liked?"♥":"♡"}</span><span>${p.likes}</span></button><button class="action-button" data-action="comment" data-id="${p.id}"><span class="symbol">◯</span><span>${p.commentsCount}</span></button><button class="action-button" data-action="share" data-id="${p.id}"><span class="symbol">⌁</span></button><button class="action-button bookmark" data-action="bookmark"><span class="symbol">♧</span></button></div></article>`;
}
async function renderExplore(){
  const posts=await getPosts(40);
  $("content").innerHTML=`<div class="page-heading"><h2>Explore</h2><span class="muted">Discover the community</span></div><div class="gallery card">${posts.filter(p=>p.image_url).map(p=>`<div style="background-image:url('${escapeHTML(p.image_url)}')"></div>`).join("")||`<div class="empty-state" style="grid-column:1/-1">No public photos yet.</div>`}</div>`;
}
async function renderProfile(){
  const {data:posts}=await supabaseClient.from("posts").select("id,user_id,caption,image_url,created_at,profiles(id,username,display_name,avatar_url),post_likes(user_id),comments(count)").eq("user_id",currentUser.id).order("created_at",{ascending:false});
  const count=posts?.length||0;
  const {count:followers}=await supabaseClient.from("follows").select("*",{count:"exact",head:true}).eq("following_id",currentUser.id);
  const {count:following}=await supabaseClient.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",currentUser.id);
  $("content").innerHTML=`<div class="card"><div class="profile-cover"></div><div class="profile-body">${avatar(currentProfile,"profile-avatar avatar-self")}<h3>${escapeHTML(currentProfile.display_name)}</h3><p>@${escapeHTML(currentProfile.username)}${currentProfile.bio?` · ${escapeHTML(currentProfile.bio)}`:""}</p><div class="stats"><div><strong>${count}</strong><span>Posts</span></div><div><strong>${followers||0}</strong><span>Followers</span></div><div><strong>${following||0}</strong><span>Following</span></div></div><button class="outline-btn" data-action="edit-profile">Edit Profile</button></div></div><div class="page-heading" style="margin-top:24px"><h2>Your posts</h2></div>${count?posts.map(p=>postCard({...p,liked:p.post_likes?.some(l=>l.user_id===currentUser.id),likes:p.post_likes?.length||0,commentsCount:p.comments?.[0]?.count||0})).join(""):`<div class="card empty-state"><div class="empty-icon">▧</div>You haven't posted anything yet.</div>`}`;
}
async function renderRightbar(){
  const {data:suggestions}=await supabaseClient.from("profiles").select("*").neq("id",currentUser.id).limit(5);
  const names=suggestions||[];
  const followingIds=(await supabaseClient.from("follows").select("following_id").eq("follower_id",currentUser.id)).data?.map(x=>x.following_id)||[];
  const trends=[["#life","128K posts"],["#travel","95K posts"],["#aesthetic","82K posts"],["#goodvibes","67K posts"],["#friends","52K posts"]];
  $("rightbar").innerHTML=`<div class="card section-card"><div class="section-title"><h3>Suggested for you</h3><a>See all</a></div>${names.map(p=>`<div class="person-row">${avatar(p,"small")}<div class="person-info"><strong>${escapeHTML(p.display_name||p.username)}</strong><small>@${escapeHTML(p.username)}</small></div><button class="follow-btn ${followingIds.includes(p.id)?"following":""}" data-action="follow" data-id="${p.id}">${followingIds.includes(p.id)?"Following":"Follow"}</button></div>`).join("")}</div><div class="card section-card"><div class="section-title"><h3>Trending</h3><a>See all</a></div>${trends.map(t=>`<div class="trend"><strong>${t[0]}</strong><small>${t[1]}</small></div>`).join("")}</div><div class="card section-card"><div class="section-title"><h3>Your account</h3></div>${avatar(currentProfile,"profile-avatar avatar-self")}<div style="margin-top:10px"><strong>${escapeHTML(currentProfile.display_name)}</strong><small style="display:block;color:var(--muted);margin-top:5px">@${escapeHTML(currentProfile.username)}</small></div><button class="outline-btn" style="margin-top:15px" data-view="profile">View Profile</button></div>`;
}
async function renderMessages(){
  const {data}=await supabaseClient.from("messages").select("*,sender:profiles!messages_sender_id_fkey(*),receiver:profiles!messages_receiver_id_fkey(*)").or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).order("created_at",{ascending:false}).limit(30);
  const rows=data||[];
  const seen=new Set(), unique=[];
  for(const m of rows){const other=m.sender_id===currentUser.id?m.receiver:m.sender;if(other&&!seen.has(other.id)){seen.add(other.id);unique.push({other,last:m});}}
  $("content").innerHTML=`<div class="page-heading"><h2>Messages</h2><button class="primary-btn" style="margin:0" data-action="new-message">New</button></div><div class="card message-list">${unique.length?unique.map(x=>`<div class="message-row" data-action="open-chat" data-user="${x.other.id}">${avatar(x.other)}<div class="message-copy"><strong>${escapeHTML(x.other.display_name||x.other.username)}</strong><small>${escapeHTML(x.last.body)}</small></div></div>`).join(""):`<div class="empty-state">No conversations yet.</div>`}</div>`;
}
async function openChat(otherId){
  const {data:other}=await supabaseClient.from("profiles").select("*").eq("id",otherId).single();
  const {data:msgs}=await supabaseClient.from("messages").select("*").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUser.id})`).order("created_at",{ascending:true}).limit(100);
  $("modalContent").innerHTML=`<h2>Chat with ${escapeHTML(other.display_name||other.username)}</h2><div id="chatMessages" style="max-height:350px;overflow:auto">${(msgs||[]).map(m=>`<div style="padding:9px 0;text-align:${m.sender_id===currentUser.id?"right":"left"}"><span style="display:inline-block;padding:9px 12px;border-radius:14px;background:var(--surface2);max-width:80%">${escapeHTML(m.body)}</span></div>`).join("")}</div><div style="display:flex;gap:8px;margin-top:12px"><input id="chatInput" style="flex:1;padding:11px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);color:var(--text)" placeholder="Write a message..."><button class="primary-btn" id="sendMessage">Send</button></div>`;
  openModal();
  $("sendMessage").onclick=async()=>{const body=$("chatInput").value.trim();if(!body)return;const {error}=await supabaseClient.from("messages").insert({sender_id:currentUser.id,receiver_id:otherId,body});if(error)toast(error.message);else{ $("chatInput").value=""; await openChat(otherId);}};
}
async function renderNotifications(){
  const {data}=await supabaseClient.from("notifications").select("*,actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_url)").order("created_at",{ascending:false}).limit(40);
  $("content").innerHTML=`<div class="page-heading"><h2>Notifications</h2><button class="outline-btn" style="width:auto;padding:9px 14px" data-action="mark-read">Mark all read</button></div><div class="card message-list">${(data||[]).map(n=>`<div class="message-row" style="${n.read?"":"background:var(--surface2)"}">${avatar(n.actor||{},"small")}<div class="message-copy"><strong>${escapeHTML(n.actor?.display_name||n.actor?.username||"Someone")}</strong><small>${notificationText(n.type)} · ${timeAgo(n.created_at)}</small></div>${n.read?"":"<span class='unread-dot'></span>"}</div>`).join("")||`<div class="empty-state">You're all caught up.</div>`}</div>`;
}
function notificationText(type){return {like:"liked your post",comment:"commented on your post",follow:"started following you",message:"sent you a message"}[type]||"interacted with you";}
function renderSettings(){
  $("content").innerHTML=`<div class="page-heading"><h2>Settings</h2></div><div class="card section-card">${["Account","Privacy","Appearance","Notifications","Help Center"].map((x,i)=>`<button class="message-row" style="width:100%;background:transparent;text-align:left;border:0" data-action="setting" data-setting="${x}"><span style="font-size:22px">${["♙","♧","☾","♢","?"][i]}</span><span style="flex:1">${x}</span><span>›</span></button>`).join("")}<button class="message-row" style="width:100%;background:transparent;text-align:left;border:0;color:#ff5964" data-action="logout"><span>⇥</span><span>Log Out</span></button></div>`;
}
async function updateCounts(){
  const {count}=await supabaseClient.from("notifications").select("*",{count:"exact",head:true}).eq("recipient_id",currentUser.id).eq("read",false);
  const n=count||0; $("notificationCount").textContent=n; $("sideNotificationCount").textContent=n;
  $("notificationCount").style.display=n?"grid":"none"; $("sideNotificationCount").style.display=n?"grid":"none";
}
function timeAgo(date){const s=Math.floor((Date.now()-new Date(date).getTime())/1000);if(s<60)return"now";if(s<3600)return`${Math.floor(s/60)}m`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`;}
function openModal(){ $("modalBackdrop").classList.remove("hidden");}
function closeModal(){ $("modalBackdrop").classList.add("hidden");}
async function openCreate(){
  $("modalContent").innerHTML=`<h2>Create a post</h2><div class="form-group"><label>What's on your mind?</label><textarea id="postText" rows="4" maxlength="5000" placeholder="Share something with your community..."></textarea></div><div class="form-group"><label>Photo (optional)</label><input id="postFile" type="file" accept="image/*"></div><button class="form-submit" id="publishPost">Publish post</button>`;
  openModal();
  $("publishPost").onclick=async()=>{
    const caption=$("postText").value.trim(), file=$("postFile").files[0];
    if(!caption&&!file){toast("Write something or choose a photo.");return}
    let image_url=null;
    if(file){const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;const up=await supabaseClient.storage.from("post-media").upload(path,file,{upsert:false,contentType:file.type});if(up.error){toast(up.error.message);return}image_url=supabaseClient.storage.from("post-media").getPublicUrl(path).data.publicUrl;}
    const {error}=await supabaseClient.from("posts").insert({user_id:currentUser.id,caption,image_url});
    if(error)toast(error.message);else{closeModal();toast("Your post is live!");currentView="home";await render();}
  };
}
async function likePost(id){
  const {data:existing}=await supabaseClient.from("post_likes").select("*").eq("post_id",id).eq("user_id",currentUser.id).maybeSingle();
  const result=existing?await supabaseClient.from("post_likes").delete().eq("post_id",id).eq("user_id",currentUser.id):await supabaseClient.from("post_likes").insert({post_id:id,user_id:currentUser.id});
  if(result.error)toast(result.error.message);else await render();
}
async function commentPost(id){
  const text=prompt("Write a comment:");if(!text?.trim())return;
  const {error}=await supabaseClient.from("comments").insert({post_id:id,user_id:currentUser.id,body:text.trim()});
  if(error)toast(error.message);else{toast("Comment added.");await render();}
}
async function followUser(id){
  const {data:existing}=await supabaseClient.from("follows").select("*").eq("follower_id",currentUser.id).eq("following_id",id).maybeSingle();
  const result=existing?await supabaseClient.from("follows").delete().eq("follower_id",currentUser.id).eq("following_id",id):await supabaseClient.from("follows").insert({follower_id:currentUser.id,following_id:id});
  if(result.error)toast(result.error.message);else await renderRightbar();
}
async function markRead(){await supabaseClient.from("notifications").update({read:true}).eq("recipient_id",currentUser.id);await render();}
async function editProfile(){
  $("modalContent").innerHTML=`<h2>Edit profile</h2><div class="form-group"><label>Display name</label><input id="editName" value="${escapeHTML(currentProfile.display_name)}"></div><div class="form-group"><label>Bio</label><textarea id="editBio" rows="3" maxlength="160">${escapeHTML(currentProfile.bio||"")}</textarea></div><button class="form-submit" id="saveProfile">Save changes</button>`;
  openModal();$("saveProfile").onclick=async()=>{const {data,error}=await supabaseClient.from("profiles").update({display_name:$("editName").value.trim(),bio:$("editBio").value.trim()}).eq("id",currentUser.id).select().single();if(error)toast(error.message);else{currentProfile=data;closeModal();toast("Profile updated.");await render();}};
}
function subscribeRealtime(){
  supabaseClient.channel("secretmewah-live").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_id=eq.${currentUser.id}`},()=>updateCounts()).on("postgres_changes",{event:"INSERT",schema:"public",table:"posts"},()=>{if(currentView==="home")renderHome()}).subscribe();
}

document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-view],[data-action]");if(!t)return;
  if(t.dataset.view){currentView=t.dataset.view;currentSearch="";$("globalSearch").value="";await render();window.scrollTo({top:0,behavior:"smooth"});return}
  const a=t.dataset.action;
  if(a==="open-create")return openCreate();
  if(a==="like")return likePost(t.dataset.id);
  if(a==="comment")return commentPost(t.dataset.id);
  if(a==="share"){try{await navigator.clipboard.writeText(location.href);toast("Website link copied.");}catch{toast("Copy the page URL from your browser.");}return}
  if(a==="bookmark")return toast("Bookmarks can be added in the next version.");
  if(a==="follow")return followUser(t.dataset.id);
  if(a==="open-chat")return openChat(t.dataset.user);
  if(a==="new-message")return toast("Open a user's profile to start a conversation.");
  if(a==="mark-read")return markRead();
  if(a==="edit-profile")return editProfile();
  if(a==="logout"){await supabaseClient.auth.signOut();return}
  if(a==="setting")return toast(`${t.dataset.setting} settings selected.`);
  if(a==="post-menu")return toast("Post options can be expanded with moderation/report tools.");
});

$("showSignup").onclick=()=>{$("loginForm").classList.add("hidden");$("signupForm").classList.remove("hidden");clearAuthMessage()};
$("showLogin").onclick=()=>{$("signupForm").classList.add("hidden");$("loginForm").classList.remove("hidden");clearAuthMessage()};
$("loginForm").onsubmit=async e=>{e.preventDefault();clearAuthMessage();const {error}=await supabaseClient.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)showAuthMessage(error.message)};
$("signupForm").onsubmit=async e=>{e.preventDefault();clearAuthMessage();const username=$("signupUsername").value.trim().toLowerCase();const display_name=$("signupDisplayName").value.trim();const email=$("signupEmail").value.trim();const password=$("signupPassword").value;if(!/^[a-z0-9_]{3,24}$/.test(username)){showAuthMessage("Username: 3–24 characters, letters, numbers and underscores only.");return}const {error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,display_name}}});if(error)showAuthMessage(error.message);else showAuthMessage("Account created. Check your email if email confirmation is enabled.")};
$("modalClose").onclick=closeModal;$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});
$("themeToggle").onchange=e=>{document.body.classList.toggle("dark",e.target.checked);localStorage.setItem("secretmewah_theme",e.target.checked?"dark":"light")};
$("globalSearch").oninput=async e=>{currentSearch=e.target.value.toLowerCase().trim();currentView="home";await renderHome()};
init();
