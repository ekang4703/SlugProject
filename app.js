const storageKeys = {
  posts: "slugride-posts",
  conversations: "slugride-conversations",
  profile: "slugride-profile",
};

const samplePosts = [
  {
    id: crypto.randomUUID(),
    type: "offer",
    name: "Nina",
    creatorId: "demo-nina",
    from: "UCSC West Entrance",
    to: "SJC Airport",
    datetime: "2026-05-22T13:30",
    seats: 3,
    vehicle: "Silver Honda Civic",
    notes: "Happy to stop for coffee on the way. One carry-on and one backpack per rider.",
    affiliation: "Fourth-year, Merrill",
    createdAt: Date.now() - 1000 * 60 * 45,
  },
  {
    id: crypto.randomUUID(),
    type: "request",
    name: "Diego",
    creatorId: "demo-diego",
    from: "Rachel Carson College",
    to: "Los Angeles",
    datetime: "2026-06-14T09:00",
    seats: 1,
    vehicle: "$35 for gas",
    notes: "Flexible on leaving anytime Saturday morning. Just one suitcase.",
    affiliation: "Second-year, RCC",
    createdAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: crypto.randomUUID(),
    type: "offer",
    name: "Sasha",
    creatorId: "demo-sasha",
    from: "Downtown Santa Cruz",
    to: "San Francisco",
    datetime: "2026-04-29T17:15",
    seats: 2,
    vehicle: "White Subaru Outback",
    notes: "Leaving after my lab. Good for anyone connecting to BART or Caltrain.",
    affiliation: "Grad student, Baskin",
    createdAt: Date.now() - 1000 * 60 * 10,
  },
];

const sampleConversations = [
  {
    id: crypto.randomUUID(),
    postId: "",
    title: "Nina to SJC",
    otherPerson: "Nina",
    messages: [
      {
        id: crypto.randomUUID(),
        sender: "Nina",
        isSelf: false,
        text: "I can pick up near the bookstore if that helps.",
        timestamp: Date.now() - 1000 * 60 * 30,
      },
      {
        id: crypto.randomUUID(),
        sender: "You",
        isSelf: true,
        text: "That works. Do you have room for one medium suitcase?",
        timestamp: Date.now() - 1000 * 60 * 18,
      },
    ],
  },
];

const state = {
  posts: [],
  conversations: [],
  activeConversationId: null,
  profile: {
    displayName: "You",
    affiliation: "UCSC student",
    bio: "",
  },
  user: null,
  supabase: null,
  configured: false,
  realtimeChannel: null,
  refreshTimer: null,
  pollingTimer: null,
};

const els = {
  listingGrid: document.querySelector("#listingGrid"),
  listingTemplate: document.querySelector("#listingTemplate"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  resultsLabel: document.querySelector("#resultsLabel"),
  offerForm: document.querySelector("#offerForm"),
  requestForm: document.querySelector("#requestForm"),
  offerSubmitButton: document.querySelector("#offerSubmitButton"),
  requestSubmitButton: document.querySelector("#requestSubmitButton"),
  offerCount: document.querySelector("#offerCount"),
  requestCount: document.querySelector("#requestCount"),
  messageCount: document.querySelector("#messageCount"),
  heroPreview: document.querySelector("#heroPreview"),
  threadList: document.querySelector("#threadList"),
  chatHeader: document.querySelector("#chatHeader"),
  chatLog: document.querySelector("#chatLog"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatSendButton: document.querySelector("#chatSendButton"),
  profileButton: document.querySelector("#profileButton"),
  profileDialog: document.querySelector("#profileDialog"),
  profileForm: document.querySelector("#profileForm"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  authBanner: document.querySelector("#authBanner"),
  authHeadline: document.querySelector("#authHeadline"),
  authStatusText: document.querySelector("#authStatusText"),
  messageColumn: document.querySelector(".message-column"),
};

function hasSupabaseConfig() {
  const url = window.SLUGRIDE_SUPABASE_URL || "";
  const key = window.SLUGRIDE_SUPABASE_ANON_KEY || "";
  return Boolean(
    url &&
    key &&
    !url.includes("YOUR_SUPABASE_URL") &&
    !key.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

function seedConversations() {
  const seeded = structuredClone(sampleConversations);
  const ninaPost = samplePosts.find((post) => post.name === "Nina");
  if (seeded[0] && ninaPost) {
    seeded[0].postId = ninaPost.id;
  }
  return seeded;
}

function loadDemoState() {
  const savedPosts = JSON.parse(localStorage.getItem(storageKeys.posts) || "null");
  const savedConversations = JSON.parse(localStorage.getItem(storageKeys.conversations) || "null");
  const savedProfile = JSON.parse(localStorage.getItem(storageKeys.profile) || "null");

  state.posts = Array.isArray(savedPosts) && savedPosts.length ? savedPosts : structuredClone(samplePosts);
  state.conversations = Array.isArray(savedConversations) && savedConversations.length ? savedConversations : seedConversations();
  state.profile = savedProfile ? { ...state.profile, ...savedProfile } : state.profile;
}

function saveDemoState() {
  localStorage.setItem(storageKeys.posts, JSON.stringify(state.posts));
  localStorage.setItem(storageKeys.conversations, JSON.stringify(state.conversations));
  localStorage.setItem(storageKeys.profile, JSON.stringify(state.profile));
}

function formatDateTime(datetime) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(datetime));
}

function formatRelativeTime(timestamp) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function setBanner(headline, body, tone = "default") {
  if (!els.authBanner || !els.authHeadline || !els.authStatusText) return;
  els.authHeadline.textContent = headline;
  els.authStatusText.textContent = body;
  els.authBanner.classList.remove("success", "warning");
  if (tone === "success" || tone === "warning") {
    els.authBanner.classList.add(tone);
  }
}

function updateAuthUI() {
  const signedIn = Boolean(state.user);
  if (els.signInButton) els.signInButton.hidden = signedIn;
  if (els.signOutButton) els.signOutButton.hidden = !signedIn;
  if (els.profileButton) els.profileButton.disabled = !state.configured || !signedIn;

  if (!state.configured) {
    setBanner(
      "Demo mode",
      "Add Supabase config to turn on Google sign-in, shared listings, and account-based messaging.",
      "warning"
    );
  } else if (!signedIn) {
    setBanner(
      "Sign in required for posting and messaging",
      "Public ride listings load from the database, but private messaging and new posts require a signed-in account.",
      "warning"
    );
  } else {
    setBanner(
      `Signed in as ${state.profile.displayName || state.user.email || "UCSC student"}`,
      "Your rides, profile, and messages are now tied to your account.",
      "success"
    );
  }

  updateActionAvailability();
}

function updateActionAvailability() {
  const canPost = state.configured ? Boolean(state.user) : true;
  const nameInputs = [
    els.offerForm?.elements?.name,
    els.requestForm?.elements?.name,
  ].filter(Boolean);

  nameInputs.forEach((input) => {
    input.readOnly = state.configured;
  });

  if (els.offerSubmitButton) {
    els.offerSubmitButton.disabled = !canPost;
  }
  if (els.requestSubmitButton) {
    els.requestSubmitButton.disabled = !canPost;
  }
}

function getFilteredPosts() {
  const query = (els.searchInput?.value || "").trim().toLowerCase();
  const filter = els.typeFilter?.value || "all";

  return [...state.posts]
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .filter((post) => {
      const matchesType = filter === "all" || post.type === filter;
      const haystack = `${post.name} ${post.from} ${post.to} ${post.vehicle} ${post.notes}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesType && matchesQuery;
    });
}

function renderListings() {
  if (!els.listingGrid || !els.listingTemplate || !els.resultsLabel) return;

  const posts = getFilteredPosts();
  els.resultsLabel.textContent = `${posts.length} result${posts.length === 1 ? "" : "s"}`;
  els.listingGrid.innerHTML = "";

  if (!posts.length) {
    els.listingGrid.innerHTML = `<div class="empty-state">No rides match that search yet. Try a broader route or create the first post.</div>`;
    return;
  }

  posts.forEach((post) => {
    const node = els.listingTemplate.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".message-trigger");
    node.querySelector(".type-pill").textContent = post.type === "offer" ? "Ride offer" : "Ride request";
    node.querySelector(".type-pill").classList.add(post.type);
    node.querySelector(".post-time").textContent = formatRelativeTime(post.createdAt);
    node.querySelector(".route-line").textContent = `${post.from} -> ${post.to}`;
    node.querySelector(".meta-line").textContent = `${formatDateTime(post.datetime)} | ${post.type === "offer" ? "driver" : "rider"} post`;
    node.querySelector(".seats-chip").textContent = `${post.seats} ${post.type === "offer" ? "seat" : "rider"}${post.seats === 1 ? "" : "s"}`;
    node.querySelector(".vehicle-chip").textContent = post.vehicle || (post.type === "offer" ? "Vehicle TBD" : "Budget flexible");
    node.querySelector(".notes-line").textContent = post.notes || "No extra notes yet.";
    node.querySelector(".author-name").textContent = post.name;
    node.querySelector(".author-affiliation").textContent = post.affiliation || "UCSC student";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "Opening...";
      try {
        await openConversationForPost(post.id);
      } catch (error) {
        setBanner("Message button failed", error.message || "Unexpected error while opening the conversation.", "warning");
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
    els.listingGrid.appendChild(node);
  });
}

function renderCounts() {
  const offers = state.posts.filter((post) => post.type === "offer").length;
  const requests = state.posts.filter((post) => post.type === "request").length;

  if (els.offerCount) els.offerCount.textContent = String(offers);
  if (els.requestCount) els.requestCount.textContent = String(requests);
  if (els.messageCount) els.messageCount.textContent = String(state.conversations.length);

  if (els.heroPreview) {
    const previewPosts = [...state.posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    els.heroPreview.innerHTML = previewPosts
      .map(
        (post) => `
          <div class="mini-item">
            <strong>${post.from} -> ${post.to}</strong>
            <span>${formatDateTime(post.datetime)} | ${post.name}</span>
          </div>
        `
      )
      .join("");
  }
}

function renderThreads() {
  if (!els.threadList) return;

  els.threadList.innerHTML = "";

  if (!state.conversations.length) {
    els.threadList.innerHTML = `<div class="empty-state">${state.user ? "No conversations yet." : "Sign in to access private conversations."}</div>`;
    return;
  }

  state.conversations
    .sort((a, b) => b.messages.at(-1).timestamp - a.messages.at(-1).timestamp)
    .forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `thread-item ${conversation.id === state.activeConversationId ? "active" : ""}`;
      button.innerHTML = `
        <strong>${conversation.otherPerson}</strong>
        <span>${conversation.title}</span>
        <p class="thread-snippet">${conversation.messages.at(-1).text}</p>
      `;
      button.addEventListener("click", () => {
        state.activeConversationId = conversation.id;
        renderThreads();
        renderChat();
      });
      els.threadList.appendChild(button);
    });
}

function renderChat() {
  if (!els.chatHeader || !els.chatLog || !els.chatInput || !els.chatSendButton) return;

  const conversation = state.conversations.find((item) => item.id === state.activeConversationId);

  if (!conversation) {
    els.chatHeader.innerHTML = "<strong>Select a conversation</strong><span>Open a ride card and tap message</span>";
    els.chatLog.innerHTML = `<div class="empty-state">${state.user ? "Messages will show up here once you start a conversation." : "Sign in to read or send private messages."}</div>`;
    els.chatInput.disabled = true;
    els.chatSendButton.disabled = true;
    return;
  }

  els.chatHeader.innerHTML = `<strong>${conversation.title}</strong><span>Chatting with ${conversation.otherPerson}</span>`;
  els.chatLog.innerHTML = "";
  conversation.messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.isSelf ? "self" : "other"}`;
    bubble.innerHTML = `
      <span class="chat-meta">${message.sender} | ${formatDateTime(message.timestamp)}</span>
      ${message.text}
    `;
    els.chatLog.appendChild(bubble);
  });
  const isNearBottom = els.chatLog.scrollHeight - els.chatLog.scrollTop - els.chatLog.clientHeight < 80;
  if (isNearBottom) els.chatLog.scrollTop = els.chatLog.scrollHeight;
  els.chatInput.disabled = !state.user;
  els.chatSendButton.disabled = !state.user;
}

function syncProfileIntoForms() {
  const defaultName = state.profile.displayName === "You" ? "" : state.profile.displayName;
  if (els.offerForm?.elements?.name) {
    els.offerForm.elements.name.value = defaultName;
  }
  if (els.requestForm?.elements?.name) {
    els.requestForm.elements.name.value = defaultName;
  }
}

function renderAll() {
  updateAuthUI();
  renderCounts();
  renderListings();
  renderThreads();
  renderChat();
}

function mapPostRow(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.profiles?.display_name || row.profiles?.email || "UCSC student",
    creatorId: row.creator_id,
    from: row.origin,
    to: row.destination,
    datetime: row.departure_time,
    seats: row.seats,
    vehicle: row.vehicle || "",
    notes: row.notes || "",
    affiliation: row.profiles?.affiliation || "UCSC student",
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function loadRemotePosts() {
  const { data, error } = await state.supabase
    .from("ride_posts")
    .select("id, type, creator_id, origin, destination, departure_time, seats, vehicle, notes, created_at, profiles:creator_id(display_name, affiliation)")
    .order("departure_time", { ascending: true });

  if (error) throw error;
  state.posts = data.map(mapPostRow);
}

async function loadRemoteProfile() {
  if (!state.user) return;
  const fallbackName = state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email?.split("@")[0] || "UCSC student";
  const existing = await state.supabase
    .from("profiles")
    .select("display_name, affiliation, bio")
    .eq("id", state.user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;

  state.profile = {
    displayName: existing.data?.display_name || fallbackName,
    affiliation: existing.data?.affiliation || "UCSC student",
    bio: existing.data?.bio || "",
  };
}

async function loadRemoteConversations() {
  if (!state.user) {
    state.conversations = [];
    state.activeConversationId = null;
    return;
  }

  const conversationsResult = await state.supabase.rpc("get_user_conversations");
  if (conversationsResult.error) throw conversationsResult.error;

  const conversationRows = conversationsResult.data || [];
  if (!conversationRows.length) {
    state.conversations = [];
    state.activeConversationId = null;
    return;
  }

  const messageResults = await Promise.all(
    conversationRows.map((conversation) =>
      state.supabase.rpc("get_conversation_messages", {
        p_conversation_id: conversation.id,
      })
    )
  );

  const firstMessageError = messageResults.find((result) => result.error);
  if (firstMessageError) throw firstMessageError.error;

  const postMap = new Map(state.posts.map((post) => [post.id, post]));
  state.conversations = conversationRows.map((conversation, index) => {
    const relatedPost = postMap.get(conversation.ride_post_id);
    const messages = (messageResults[index].data || []).map((message) => ({
      id: message.id,
      sender: message.sender_name || "UCSC student",
      isSelf: message.sender_id === state.user.id,
      text: message.body,
      timestamp: new Date(message.created_at).getTime(),
    }));
    return {
      id: conversation.id,
      postId: conversation.ride_post_id,
      title: relatedPost ? `${relatedPost.from} -> ${relatedPost.to}` : "Ride conversation",
      otherPerson: conversation.other_display_name || "UCSC student",
      messages: messages.length
        ? messages
        : [
            {
              id: crypto.randomUUID(),
              sender: conversation.other_display_name || "UCSC student",
              isSelf: false,
              text: "Conversation started.",
              timestamp: new Date(conversation.created_at).getTime(),
            },
          ],
    };
  });

  if (!state.conversations.find((item) => item.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[0]?.id || null;
  }
}

async function refreshRemoteData() {
  await loadRemotePosts();
  await loadRemoteConversations();
  renderAll();
}

function queueRealtimeRefresh() {
  if (!state.configured || !state.user) return;
  if (state.refreshTimer) {
    window.clearTimeout(state.refreshTimer);
  }
  state.refreshTimer = window.setTimeout(async () => {
    try {
      await refreshRemoteData();
    } catch (error) {
      setBanner("Realtime refresh failed", error.message || "A new update arrived, but the app could not refresh it.", "warning");
    }
  }, 150);
}

function stopRealtimeSubscription() {
  if (state.realtimeChannel && state.supabase) {
    state.supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }
  if (state.refreshTimer) {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
  }
  if (state.pollingTimer) {
    window.clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

function startRealtimeSubscription() {
  if (!state.configured || !state.supabase || !state.user) return;

  stopRealtimeSubscription();

  const userId = state.user.id;
  const channel = state.supabase
    .channel(`slugride-live-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ride_posts",
      },
      () => queueRealtimeRefresh()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
      },
      () => queueRealtimeRefresh()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversation_members",
      },
      () => setTimeout(() => queueRealtimeRefresh(), 800)
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
      () => queueRealtimeRefresh()
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        setBanner("Realtime connection failed", "Messages still work, but live updates could not connect.", "warning");
      }
    });

  state.realtimeChannel = channel;

  state.pollingTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      queueRealtimeRefresh();
    }
  }, 2500);
}

async function openConversationForPost(postId) {
  const post = state.posts.find((item) => item.id === postId);
  if (!post) return;

  if (els.chatHeader && els.chatLog) {
    els.chatHeader.innerHTML = `<strong>Opening conversation...</strong><span>Getting your private thread with ${post.name}</span>`;
    els.chatLog.innerHTML = `<div class="empty-state">Opening your private conversation with ${post.name}...</div>`;
  }
  els.messageColumn?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!state.configured) {
    setBanner(
      "Supabase not connected yet",
      "Fill in supabase-config.js and run the SQL schema before private messaging can be account-based.",
      "warning"
    );
    return;
  }

  if (!state.user) {
    setBanner(
      "Sign in first",
      "Google sign-in is required before you can open a private conversation.",
      "warning"
    );
    return;
  }

  if (post.creatorId === state.user.id) {
    setBanner(
      "This is your own post",
      "You can edit or remove your own post later, but you do not need to message yourself.",
      "warning"
    );
    return;
  }

  const { data, error } = await state.supabase.rpc("ensure_conversation", {
    p_ride_post_id: postId,
    p_other_user_id: post.creatorId,
  });

  if (error) {
    setBanner("Could not open conversation", error.message, "warning");
    return;
  }

  try {
    await loadRemoteConversations();
    state.activeConversationId = data;
    renderThreads();
    renderChat();
    setBanner("Conversation opened", `You can now message ${post.name}.`, "success");
    els.messageColumn?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (loadError) {
    setBanner("Conversation was created but could not load", loadError.message || "Check the conversation policies in Supabase.", "warning");
    if (els.chatHeader && els.chatLog) {
      els.chatHeader.innerHTML = `<strong>Could not load conversation</strong><span>See the status banner for details</span>`;
      els.chatLog.innerHTML = `<div class="empty-state">${loadError.message || "The conversation exists, but the app could not load it yet."}</div>`;
    }
  }
}

async function createRemotePost(type, formData) {
  if (!state.user) {
    setBanner("Sign in required", "You must be signed in to create a ride post.", "warning");
    return;
  }

  const payload = {
    creator_id: state.user.id,
    type,
    origin: formData.get("from").trim(),
    destination: formData.get("to").trim(),
    departure_time: new Date(formData.get("datetime")).toISOString(),
    seats: Number(formData.get("seats")),
    vehicle: formData.get("vehicle").trim(),
    notes: formData.get("notes").trim(),
  };

  const { error } = await state.supabase.from("ride_posts").insert(payload);
  if (error) {
    setBanner("Could not post ride", error.message, "warning");
    return;
  }

  await loadRemotePosts();
  renderAll();
}

function createDemoPost(type, formData) {
  const post = {
    id: crypto.randomUUID(),
    type,
    name: formData.get("name").trim(),
    creatorId: crypto.randomUUID(),
    from: formData.get("from").trim(),
    to: formData.get("to").trim(),
    datetime: formData.get("datetime"),
    seats: Number(formData.get("seats")),
    vehicle: formData.get("vehicle").trim(),
    notes: formData.get("notes").trim(),
    affiliation: state.profile.affiliation || "UCSC student",
    createdAt: Date.now(),
  };

  state.posts.push(post);
  saveDemoState();
  renderAll();
}

async function handlePostSubmit(type, form) {
  const formData = new FormData(form);
  if (state.configured) {
    await createRemotePost(type, formData);
  } else {
    createDemoPost(type, formData);
  }
  form.reset();
  syncProfileIntoForms();
}

async function sendRemoteMessage(text) {
  const conversation = state.conversations.find((item) => item.id === state.activeConversationId);
  if (!conversation || !state.user) return;

  const { data, error } = await state.supabase.rpc("send_conversation_message", {
    p_conversation_id: conversation.id,
    p_body: text,
  });

  if (error) {
    setBanner("Could not send message", error.message, "warning");
    return;
  }

  const insertedMessage = Array.isArray(data) ? data[0] : data;
  if (!insertedMessage) {
    setBanner("Could not send message", "The database did not return the new message record.", "warning");
    return;
  }

  conversation.messages.push({
    id: insertedMessage.id,
    sender: state.profile.displayName || state.user.email || "You",
    isSelf: true,
    text,
    timestamp: new Date(insertedMessage.created_at).getTime(),
  });
  renderThreads();
  renderChat();
  setBanner("Message sent", `Your message to ${conversation.otherPerson} was sent.`, "success");

  try {
    await loadRemoteConversations();
    renderThreads();
    renderChat();
  } catch (refreshError) {
    setBanner(
      "Message sent, but refresh failed",
      refreshError.message || "The message was inserted, but the conversation could not be reloaded.",
      "warning"
    );
  }
}

function sendDemoMessage(text) {
  const conversation = state.conversations.find((item) => item.id === state.activeConversationId);
  if (!conversation) return;

  conversation.messages.push({
    id: crypto.randomUUID(),
    sender: state.profile.displayName || "You",
    isSelf: true,
    text,
    timestamp: Date.now(),
  });
  saveDemoState();
  renderThreads();
  renderChat();
}

function bindForms() {
  if (els.offerForm) {
    els.offerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handlePostSubmit("offer", els.offerForm);
    });
  }

  if (els.requestForm) {
    els.requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handlePostSubmit("request", els.requestForm);
    });
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("input", renderListings);
  }

  if (els.typeFilter) {
    els.typeFilter.addEventListener("change", renderListings);
  }

  if (els.chatForm) {
    els.chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text) return;

      try {
        if (state.configured) {
          await sendRemoteMessage(text);
        } else {
          sendDemoMessage(text);
        }
        els.chatInput.value = "";
      } catch (submitError) {
        setBanner("Could not send message", submitError.message || "Unexpected error while sending the message.", "warning");
      }
    });
  }
}

function bindProfile() {
  if (!els.profileButton || !els.profileDialog || !els.profileForm || !els.saveProfileButton) return;

  els.profileButton.addEventListener("click", () => {
    els.profileForm.displayName.value = state.profile.displayName || "";
    els.profileForm.affiliation.value = state.profile.affiliation || "";
    els.profileForm.bio.value = state.profile.bio || "";
    els.profileDialog.showModal();
  });

  els.saveProfileButton.addEventListener("click", async () => {
    state.profile = {
      displayName: els.profileForm.displayName.value.trim() || "You",
      affiliation: els.profileForm.affiliation.value.trim() || "UCSC student",
      bio: els.profileForm.bio.value.trim(),
    };

    if (state.configured && state.user) {
      const { error } = await state.supabase.from("profiles").upsert({
        id: state.user.id,
        display_name: state.profile.displayName,
        affiliation: state.profile.affiliation,
        bio: state.profile.bio,
        email: state.user.email,
      });

      if (error) {
        setBanner("Could not save profile", error.message, "warning");
        return;
      }
    } else {
      saveDemoState();
    }

    syncProfileIntoForms();
    updateAuthUI();
    els.profileDialog.close();
  });
}

function bindAuth() {
  if (els.signInButton) {
    els.signInButton.addEventListener("click", async () => {
      if (!state.configured) {
        setBanner(
          "Supabase not configured",
          "Open supabase-config.js and replace the placeholder URL and anon key first.",
          "warning"
        );
        return;
      }

      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        setBanner("Could not start Google sign-in", error.message, "warning");
      }
    });
  }

  if (els.signOutButton) {
    els.signOutButton.addEventListener("click", async () => {
      if (!state.configured) return;
      const { error } = await state.supabase.auth.signOut();
      if (error) {
        setBanner("Could not sign out", error.message, "warning");
      }
    });
  }
}

async function initializeSupabaseMode() {
  state.configured = hasSupabaseConfig() && Boolean(window.supabase?.createClient);
  if (!state.configured) {
    loadDemoState();
    if (state.conversations.length) {
      state.activeConversationId = state.conversations[0].id;
    }
    renderAll();
    return;
  }

  state.supabase = window.supabase.createClient(
    window.SLUGRIDE_SUPABASE_URL,
    window.SLUGRIDE_SUPABASE_ANON_KEY
  );

  const sessionResult = await state.supabase.auth.getSession();
  state.user = sessionResult.data.session?.user || null;

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      await loadRemoteProfile();
      await refreshRemoteData();
      startRealtimeSubscription();
    } else {
      stopRealtimeSubscription();
      state.profile = {
        displayName: "You",
        affiliation: "UCSC student",
        bio: "",
      };
      await loadRemotePosts();
      state.conversations = [];
      state.activeConversationId = null;
      renderAll();
    }
    syncProfileIntoForms();
  });

  await loadRemotePosts();
  if (state.user) {
    await loadRemoteProfile();
    await loadRemoteConversations();
    startRealtimeSubscription();
  }
  renderAll();
}

bindForms();
bindProfile();
bindAuth();
initializeSupabaseMode()
  .then(() => {
    syncProfileIntoForms();
  })
  .catch((error) => {
    loadDemoState();
    if (state.conversations.length) {
      state.activeConversationId = state.conversations[0].id;
    }
    setBanner("Fell back to demo mode", error.message, "warning");
    renderAll();
  });
