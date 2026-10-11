import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3,
  CircleHelp, Command, LogOut, MessageCircle, Plus, Search, Send, Settings2,
  Smile, Sparkles, Users, X
} from "lucide-react";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");
const API_URL = configuredApiUrl
  ? configuredApiUrl.endsWith("/api") ? configuredApiUrl : `${configuredApiUrl}/api`
  : import.meta.env.DEV ? "/api" : "";
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim().replace(/\/+$/, "");
const SOCKET_URL = configuredSocketUrl || (API_URL ? new URL(API_URL, window.location.origin).origin : "");
const AI_CHAT_ID = "orbit-ai";
const getToken = () => localStorage.getItem("orbit-token");
const getAiHistoryKey = (userId) => `orbit-ai-messages:${userId}`;
const initials = (name = "?") => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function readAiHistory(userId) {
  try {
    const history = JSON.parse(localStorage.getItem(getAiHistoryKey(userId)) || "[]");
    if (!Array.isArray(history)) return [];
    return history.filter((message) =>
      typeof message?._id === "string" &&
      typeof message?.text === "string" &&
      typeof message?.createdAt === "string" &&
      typeof message?.sender?._id === "string" &&
      typeof message?.sender?.name === "string"
    );
  } catch (error) {
    console.error("Unable to read saved AI chat history:", error);
    return [];
  }
}

function getRecentAiMessages(messages, userId) {
  const recent = [];
  let totalLength = 0;

  for (const message of [...messages].reverse()) {
    const role = message.sender?._id === userId
      ? "user"
      : message.sender?._id === AI_CHAT_ID ? "assistant" : null;
    const content = message.text;
    if (!role || typeof content !== "string" || !content.trim() || content.length > 4000) continue;
    if (recent.length >= 20 || totalLength + content.length > 12000) break;
    recent.push({ role, content });
    totalLength += content.length;
  }

  return recent.reverse();
}

async function request(path, options = {}) {
  if (!API_URL) {
    throw new Error("The chat API is not configured. Set VITE_API_URL to your deployed API URL and redeploy the client.");
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Can't reach the chat server. Start it with `npm run dev` from the project root, then try again.");
    }
    throw error;
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || "Something went wrong. Please try again.");
  return data;
}

function Avatar({ name, online = false, group = false, small = false, ai = false }) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""} ${group ? "avatar-group" : ""} ${ai ? "avatar-ai" : ""}`}>
      {ai ? <Sparkles size={small ? 14 : 18} /> : group ? <Users size={small ? 15 : 18} /> : initials(name)}
      {online && <i className="online-dot" />}
    </span>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await request(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      localStorage.setItem("orbit-token", result.token);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <a className="brand brand-light" href="#" aria-label="Orbit home">
          <span className="brand-mark"><MessageCircle size={19} fill="currentColor" /></span>
          <span>orbit<span className="brand-period">.</span></span>
        </a>
        <div className="story-copy">
          <div className="story-pill"><span /> YOUR PEOPLE, RIGHT HERE</div>
          <h1>Good conversations<br />move us <em>forward.</em></h1>
          <p>A little more connected. A lot less scattered. Make space for the conversations that matter.</p>
          <div className="story-proof">
            <div className="proof-avatars">
              {["AL", "JM", "SK", "TR"].map((text, index) => <span key={text} className={`proof-avatar proof-${index}`}>{text}</span>)}
            </div>
            <span>Good things happen when we talk.</span>
          </div>
        </div>
        <div className="story-bottom"><span>Thoughtfully made for your everyday.</span><span>01 — 04</span></div>
        <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-topline"><span>Already have an account?</span><button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create account" : "Sign in"} <ArrowUpRight size={14} /></button></div>
        <div className="auth-form-wrap">
          <div className="auth-welcome"><span className="welcome-sparkle"><Sparkles size={18} /></span><span>YOUR SPACE IS WAITING</span></div>
          <h2>{mode === "login" ? "Welcome back" : "Let’s get you started"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Pick up right where your people are." : "Create an account and bring your people together."}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we call you?" autoComplete="name" required minLength={2} maxLength={60} /></label>}
            <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "One moment…" : mode === "login" ? "Sign in to Orbit" : "Create your account"} <ArrowUpRight size={17} /></button>
          </form>
          <div className="auth-terms">By continuing, you agree to keep conversations kind and your account secure.</div>
        </div>
        <div className="auth-footer"><span>© 2026 Orbit</span><span><CircleHelp size={14} /> Made for better conversations</span></div>
      </section>
    </main>
  );
}

function ChatModal({
  onClose,
  users,
  onCreate,
  creating,
  loadingPeople,
  peopleError,
  refreshPeople,
  initialGroup = false,
  createError,
  clearCreateError
}) {
  const [group, setGroup] = useState(initialGroup);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const filteredUsers = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    clearCreateError("");
    refreshPeople();
  }, [clearCreateError, refreshPeople]);

  const choose = (user) => {
    clearCreateError();
    setSelectionError("");
    if (!group) {
      onCreate({ participantIds: [user.id], isGroup: false });
      return;
    }
    if (!selected.includes(user.id) && selected.length >= 30) {
      setSelectionError("A group can have up to 30 invited people.");
      return;
    }
    setSelectionError("");
    setSelected((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id]);
  };

  const createGroup = async () => {
    clearCreateError();
    const result = await onCreate({ participantIds: selected, isGroup: true, groupName });
    if (result?.staleParticipants) {
      setSelected([]);
      await refreshPeople();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="chat-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">A FRESH LITTLE START</span><h2 id="modal-title">{group ? "Gather your people" : "Say hello"}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <div className="modal-switch">
          <button className={!group ? "active" : ""} onClick={() => { clearCreateError(); setGroup(false); setSelected([]); }}>Direct message</button>
          <button className={group ? "active" : ""} onClick={() => { clearCreateError(); setGroup(true); setSelected([]); }}>Group chat</button>
        </div>
        {group && <label className="modal-name">Group name<input value={groupName} onChange={(e) => { clearCreateError(); setGroupName(e.target.value); }} placeholder="e.g. Friday plans" minLength={2} maxLength={80} /><small className="group-field-hint">Choose a name and at least two people to create your group.</small></label>}
        <div className="modal-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find someone by name or email" autoFocus /></div>
        {group && <div className="group-selection-count" aria-live="polite">{selected.length} of 30 people selected <span>· at least 2 required</span></div>}
        <div className="people-list">
          {filteredUsers.map((user) => {
            const checked = selected.includes(user.id);
            return (
              <button key={user.id} className={`person-row ${checked ? "selected" : ""}`} onClick={() => choose(user)}>
                <Avatar name={user.name} online />
                <span className="person-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
                {group ? <span className={`check-box ${checked ? "checked" : ""}`}>{checked && <Check size={13} />}</span> : <ArrowUpRight size={16} className="person-arrow" />}
              </button>
            );
          })}
          {loadingPeople && <div className="no-people">Refreshing people…</div>}
          {!loadingPeople && peopleError && <div className="no-people">{peopleError}<button className="people-retry" onClick={refreshPeople}>Try again</button></div>}
          {!loadingPeople && !peopleError && filteredUsers.length === 0 && <div className="no-people">{users.length ? "No people found. Try another search." : "No other accounts yet. Invite someone by sharing Orbit with them."}</div>}
        </div>
        {selectionError && <div className="form-error modal-error" role="alert">{selectionError}</div>}
        {createError && <div className="form-error modal-error" role="alert">{createError}</div>}
        {group && <button className="primary-button create-group-button" disabled={creating || loadingPeople || Boolean(peopleError) || selected.length < 2 || groupName.trim().length < 2} onClick={createGroup}>{creating ? "Creating…" : `Create group${selected.length ? ` · ${selected.length} people` : ""}`} <ArrowUpRight size={16} /></button>}
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiConfigured, setAiConfigured] = useState(null);
  const [aiModel, setAiModel] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalGroup, setModalGroup] = useState(false);
  const [modalError, setModalError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const socketRef = useRef(null);
  const activeIdRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const handleAuthenticated = (authenticatedUser) => {
    setAiMessages(readAiHistory(authenticatedUser.id));
    setUser(authenticatedUser);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    request("/auth/me")
      .then((result) => handleAuthenticated(result.user))
      .catch(() => localStorage.removeItem("orbit-token"))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(getAiHistoryKey(user.id), JSON.stringify(aiMessages));
    } catch (storageError) {
      console.error("Unable to save AI chat history:", storageError);
      setError("Orbit AI chat history could not be saved in this browser.");
    }
  }, [user, aiMessages]);

  useEffect(() => {
    if (!user) {
      setAiConfigured(null);
      return;
    }

    let cancelled = false;
    request("/ai/status")
      .then(({ configured, model }) => {
        if (!cancelled) {
          setAiConfigured(configured);
          setAiModel(model || "");
        }
      })
      .catch((statusError) => {
        if (!cancelled) {
          setAiConfigured(false);
          setAiModel("");
          setError(statusError.message);
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const result = await request("/chats");
      setChats(result);
      setActiveId((current) => current === AI_CHAT_ID || current && result.some((chat) => chat._id === current) ? current : result[0]?._id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const refreshPeople = useCallback(async () => {
    setLoadingPeople(true);
    setPeopleError("");
    setPeople([]);
    try {
      const result = await request("/users");
      setPeople(result);
      return result;
    } catch (err) {
      setPeopleError(err.message);
      return null;
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!user) return;
    loadChats();
    if (!SOCKET_URL) {
      setError("The chat API is not configured. Set VITE_API_URL to your deployed API URL and redeploy the client.");
      return;
    }
    const socket = io(SOCKET_URL, { auth: { token: getToken() }, reconnection: true });
    socketRef.current = socket;
    socket.on("connect_error", (connectionError) => {
      if (connectionError.message === "Invalid or expired authentication token." || connectionError.message === "Authentication required.") {
        setError("Your session expired. Sign out and sign back in to restore live messaging.");
        return;
      }
      setError("Live connection unavailable. Check that the API server is running and try again.");
    });
    socket.on("connect", () => setError(""));
    socket.on("message:new", ({ conversationId, message }) => {
      setMessages((current) => conversationId === activeIdRef.current && !current.some((item) => item._id === message._id) ? [...current, message] : current);
      setChats((current) => {
        const updated = current.map((chat) => chat._id === conversationId ? { ...chat, lastMessage: message, updatedAt: message.createdAt } : chat);
        return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, loadChats]);

  useEffect(() => {
    if (!user || !activeId) {
      setMessages([]);
      return;
    }
    if (activeId === AI_CHAT_ID) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    request(`/chats/${activeId}/messages`)
      .then((result) => { if (!cancelled) setMessages(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [user, activeId]);

  const displayedMessages = activeId === AI_CHAT_ID ? aiMessages : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages, activeId, aiSending]);

  const isAIChat = activeId === AI_CHAT_ID;
  const activeChat = isAIChat
    ? { _id: AI_CHAT_ID, isGroup: false, isAI: true, participants: [] }
    : chats.find((chat) => chat._id === activeId);
  const otherPeople = activeChat?.participants?.filter((person) => person._id !== user?.id) || [];
  const activeName = activeChat?.isAI ? "Orbit AI" : activeChat?.isGroup ? activeChat.groupName : otherPeople[0]?.name || "Conversation";
  const filteredChats = useMemo(() => chats.filter((chat) => {
    const otherNames = chat.isGroup ? chat.groupName : chat.participants.filter((person) => person._id !== user?.id).map((person) => person.name).join(" ");
    return `${otherNames} ${chat.lastMessage?.text || ""}`.toLowerCase().includes(search.toLowerCase());
  }), [chats, search, user]);
  const aiPreview = aiMessages.at(-1)?.text || "Your private AI assistant";
  const aiMatchesSearch = `orbit ai ${aiPreview}`.toLowerCase().includes(search.toLowerCase());

  const startAiChat = () => {
    setError("");
    setActiveId(AI_CHAT_ID);
    setMobileChatOpen(true);
  };

  const createChat = async (details) => {
    setModalError("");
    setCreating(true);
    try {
      const chat = await request("/chats", { method: "POST", body: JSON.stringify(details) });
      setChats((current) => [chat, ...current.filter((item) => item._id !== chat._id)]);
      setActiveId(chat._id);
      setMessages([]);
      setMobileChatOpen(true);
      setModalOpen(false);
      return { success: true };
    } catch (err) {
      const staleParticipants = err.message === "One or more selected accounts no longer exist.";
      setModalError(staleParticipants
        ? "Some selected people are no longer available. The list will refresh; select the current members and try again."
        : err.message);
      return { success: false, staleParticipants };
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    if (isAIChat) {
      if (aiSending) return;
      if (aiConfigured !== true) {
        setError(aiConfigured === false
          ? `Local Orbit AI is unavailable. Start Ollama and run "ollama run ${aiModel || "qwen2.5:1.5b"}" to download its model.`
          : "Checking local Orbit AI setup. Please try sending again in a moment.");
        return;
      }
    } else if (!socketRef.current?.connected) {
      setError("Reconnect to the server before sending.");
      return;
    }
    setDraft("");
    if (isAIChat) {
      const userMessage = {
        _id: crypto.randomUUID(),
        sender: { _id: user.id, name: user.name },
        text,
        createdAt: new Date().toISOString()
      };
      const nextMessages = [...aiMessages, userMessage];
      setError("");
      setAiSending(true);
      try {
        const result = await request("/ai/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: getRecentAiMessages(nextMessages, user.id)
          })
        });
        const assistantMessage = {
          _id: crypto.randomUUID(),
          sender: { _id: AI_CHAT_ID, name: "Orbit AI" },
          text: result.reply,
          createdAt: new Date().toISOString()
        };
        setAiMessages([...nextMessages, assistantMessage]);
      } catch (requestError) {
        setDraft(text);
        setError(requestError.message);
      } finally {
        setAiSending(false);
      }
      return;
    }
    socketRef.current.emit("message:send", { conversationId: activeId, text }, (result) => {
      if (result?.error) {
        setDraft(text);
        setError(result.error);
      }
    });
  };

  const addEmoji = () => {
    setDraft((current) => `${current} 😊`);
    inputRef.current?.focus();
  };

  const signOut = () => {
    localStorage.removeItem("orbit-token");
    socketRef.current?.disconnect();
    setUser(null);
    setChats([]);
    setMessages([]);
    setAiMessages([]);
  };

  if (!authChecked) return <div className="loading-screen"><span className="brand-mark"><MessageCircle size={19} fill="currentColor" /></span><span>Finding your orbit…</span></div>;
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <main className={`app-shell ${mobileChatOpen ? "mobile-chat-open" : ""} ${isAIChat ? "ai-chat-layout" : ""}`}>
      <aside className="sidebar">
        <div className="workspace-header">
          <a className="brand" href="#" aria-label="Orbit home"><span className="brand-mark"><MessageCircle size={18} fill="currentColor" /></span><span>orbit<span className="brand-period">.</span></span></a>
          <button className="workspace-switch" aria-label="Workspace menu"><span className="workspace-avatar">O</span><span className="workspace-label"><strong>Personal space</strong><small>Free workspace</small></span><ChevronDown size={15} /></button>
        </div>
        <div className="sidebar-quick">
          <button onClick={() => { setModalGroup(false); setModalOpen(true); }}><Plus size={16} /><span>New message</span><kbd>⌘ K</kbd></button>
          <button onClick={startAiChat}><Sparkles size={16} /><span>Ask Orbit AI</span></button>
        </div>
        <div className="section-heading">
          <div className="conversation-tabs" role="tablist" aria-label="Conversation views">
            <button className="conversation-tab active" role="tab" aria-selected="true"><Clock3 size={13} /> Recent chats</button>
          </div>
          <button onClick={() => { setModalGroup(false); setModalOpen(true); }} aria-label="Add conversation"><Plus size={16} /></button>
        </div>
        <label className="conversation-search"><Search size={15} /><input placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>/</kbd></label>
        <div className="conversation-list">
          {loadingChats && chats.length === 0 && <div className="sidebar-message">Getting your conversations…</div>}
          {aiMatchesSearch && <button className={`conversation-row ai-conversation-row ${isAIChat ? "active" : ""}`} onClick={startAiChat}>
            <Avatar name="Orbit AI" ai />
            <span className="conversation-copy"><span className="conversation-name">Orbit AI <span className="ai-label">AI</span></span><span className="conversation-preview">{aiPreview}</span></span>
            <span className="conversation-meta"><time>{aiMessages.length ? formatTime(aiMessages.at(-1).createdAt) : ""}</time></span>
          </button>}
          {!loadingChats && filteredChats.length === 0 && !aiMatchesSearch && <div className="sidebar-empty"><span className="empty-icon"><MessageCircle size={17} /></span><strong>{search ? "No matches" : "A quiet start"}</strong><span>{search ? "Try a different search." : "Your conversations will show up here."}</span>{!search && <button onClick={() => { setModalGroup(false); setModalOpen(true); }}>Start a conversation <ArrowUpRight size={14} /></button>}</div>}
          {filteredChats.map((chat) => {
            const name = chat.isGroup ? chat.groupName : chat.participants.find((person) => person._id !== user.id)?.name || "Conversation";
            const isActive = chat._id === activeId;
            return (
              <button key={chat._id} className={`conversation-row ${isActive ? "active" : ""}`} onClick={() => { setActiveId(chat._id); setMobileChatOpen(true); }}>
                <Avatar name={name} online={!chat.isGroup} group={chat.isGroup} />
                <span className="conversation-copy"><span className="conversation-name">{name}</span><span className="conversation-preview">{chat.lastMessage?.sender?._id === user.id ? "You: " : ""}{chat.lastMessage?.text || "Start a conversation"}</span></span>
                <span className="conversation-meta"><time>{chat.lastMessage?.createdAt ? formatTime(chat.lastMessage.createdAt) : ""}</time></span>
              </button>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <div className="user-profile"><Avatar name={user.name} online /><span className="profile-copy"><strong>{user.name}</strong><small>Available</small></span><button className="profile-menu" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></div>
        </div>
      </aside>

      <section className="chat-area">
        {error && <div className="connection-notice" role="status"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
        {activeChat ? <>
          <header className="chat-header">
            <button className="back-mobile icon-button" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations"><ArrowLeft size={19} /></button>
            <Avatar name={activeName} online={!activeChat.isGroup && !activeChat.isAI} group={activeChat.isGroup} ai={activeChat.isAI} />
            <div className="chat-heading-copy"><div className="chat-title">{activeName}<span className="verified-mark"><Check size={10} /></span></div><div className="chat-status">{activeChat.isAI ? <><Sparkles size={12} /> Local AI · {aiModel || "Qwen 2.5"}</> : activeChat.isGroup ? <><span className="status-dot" /> {activeChat.participants.length} people · Your little corner of the internet</> : <><span className="status-dot" /> Around and ready to chat</>}</div></div>
            <div className="chat-actions"><button className={`icon-button ${showDetails ? "icon-selected" : ""}`} aria-label="Conversation details" onClick={() => setShowDetails((value) => !value)}><Settings2 size={18} /></button></div>
          </header>
          <div className={`chat-content ${showDetails ? "with-details" : ""}`}>
            <section className="message-panel">
              <div className="messages-scroll">
                {!loadingMessages && displayedMessages.length === 0 && <div className="chat-intro"><div className="intro-orb">{activeChat.isAI ? <Sparkles size={24} /> : <MessageCircle size={24} />}</div><span className="eyebrow">{activeChat.isAI ? "PRIVATE, ON-DEVICE AI" : "A GOOD PLACE TO START"}</span><h2>{activeChat.isAI ? aiConfigured === false ? "Local AI needs setup" : "What’s on your mind?" : "You’re in good company."}</h2><p>{activeChat.isAI ? aiConfigured === false ? <>Start Ollama and download <code>{aiModel || "qwen2.5:1.5b"}</code> to run replies on this computer, without an API bill.</> : "Ask a question, talk through an idea, or get help finding the right words." : <>This is the beginning of your conversation with <strong>{activeChat.isGroup ? activeChat.groupName : activeName}</strong>.</>}</p><div className="intro-date"><span /> TODAY <span /></div></div>}
                {loadingMessages && <div className="messages-loading">Loading messages…</div>}
                {displayedMessages.map((message, index) => {
                  const own = message.sender?._id === user.id || message.sender === user.id;
                  const previous = displayedMessages[index - 1];
                  const showSender = activeChat.isGroup && !own && previous?.sender?._id !== message.sender?._id;
                  return (
                    <article key={message._id} className={`message-row ${own ? "own-message" : ""} ${activeChat.isAI && !own ? "ai-assistant-message" : ""}`}>
                      {!own && (showSender || !activeChat.isGroup) ? <Avatar name={message.sender?.name || "?"} small ai={message.sender?._id === AI_CHAT_ID} /> : !own ? <span className="avatar-spacer" /> : null}
                      <div className="message-body">
                        {showSender && <span className="message-sender">{message.sender?.name}</span>}
                        <div className="message-bubble">{message.text}</div>
                        <div className="message-meta"><time>{formatTime(message.createdAt)}</time>{own && <CheckCheck size={14} className="read-check" />}</div>
                      </div>
                    </article>
                  );
                })}
                {aiSending && <div className="ai-typing" role="status"><Sparkles size={14} /> Orbit AI is thinking…</div>}
                {!loadingMessages && displayedMessages.length === 0 && !activeChat.isAI && <div className="first-message-hint"><ArrowDownLeft size={15} /> Go on, make the first move.</div>}
                <div ref={bottomRef} />
              </div>
              <form className="composer" onSubmit={sendMessage}>
                <div className="composer-box">
                  <textarea ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }} placeholder={activeChat.isAI ? "Ask Orbit AI anything…" : `Message ${activeChat.isGroup ? activeChat.groupName : activeName}…`} rows={1} maxLength={4000} disabled={aiSending} />
                  <div className="composer-toolbar"><div className="composer-tools"><button type="button" className="tool-button" onClick={addEmoji} aria-label="Add emoji"><Smile size={17} /></button></div><div className="composer-send-side"><span className="send-hint"><kbd>↵</kbd> to send</span><button className="send-button" disabled={!draft.trim() || aiSending || activeChat.isAI && aiConfigured === null} aria-label="Send message"><Send size={16} /></button></div></div>
                </div>
                <div className="composer-footnote"><span>{activeChat.isAI ? aiConfigured === false ? "Local model required; once downloaded, it runs on this computer for free." : `Running locally (${aiModel || "Qwen 2.5"}); no API bill.` : "Keep it kind, keep it human."}</span><span><Command size={12} /> + Enter for a new line</span></div>
              </form>
            </section>
            {showDetails && <aside className="details-panel"><div className="details-top"><strong>Details</strong><button className="icon-button" onClick={() => setShowDetails(false)} aria-label="Close details"><X size={17} /></button></div><div className="details-person"><Avatar name={activeName} online={!activeChat.isGroup && !activeChat.isAI} group={activeChat.isGroup} ai={activeChat.isAI} /><h3>{activeName}</h3><p>{activeChat.isAI ? "Your private AI assistant" : activeChat.isGroup ? `${activeChat.participants.length} members` : otherPeople[0]?.email}</p><span className="details-online"><i /> {activeChat.isAI ? `Running locally · ${aiModel || "Qwen 2.5"}` : "Available to chat"}</span></div><div className="details-section"><span className="eyebrow">{activeChat.isAI ? "ABOUT ORBIT AI" : "IN THIS CONVERSATION"}</span>{activeChat.isAI ? <div className="details-tip"><Sparkles size={16} /><span>Your recent conversation is saved in this browser and processed by the local model on this computer.</span></div> : activeChat.participants.map((person) => <div className="member-row" key={person._id}><Avatar name={person.name} online small /><span><strong>{person.name}</strong><small>{person._id === user.id ? "You" : person.email}</small></span></div>)}</div>{!activeChat.isAI && <div className="details-tip"><Sparkles size={16} /><span>Every great friendship starts with a little conversation.</span></div>}</aside>}
          </div>
        </> : <div className="welcome-panel"><div className="welcome-decoration deco-left" /><div className="welcome-decoration deco-right" /><span className="welcome-badge"><Sparkles size={14} /> A SPACE OF YOUR OWN</span><div className="welcome-illustration"><span className="welcome-bubble bubble-a"><MessageCircle size={20} /></span><span className="welcome-bubble bubble-b"><Smile size={20} /></span><span className="welcome-center"><MessageCircle size={35} /></span><span className="welcome-star star-a">✳</span><span className="welcome-star star-b">✦</span></div><h1>Make room for<br /><em>good conversation.</em></h1><p>Little check-ins, big life updates, and all the in-between. It all belongs here.</p><button className="primary-button welcome-cta" onClick={() => { setModalGroup(false); setModalOpen(true); }}><Plus size={17} /> Start a conversation</button><div className="welcome-keyboard">A little space for your people, just the way it should be.</div></div>}
      </section>
      {modalOpen && <ChatModal users={people} onClose={() => setModalOpen(false)} onCreate={createChat} creating={creating} loadingPeople={loadingPeople} peopleError={peopleError} refreshPeople={refreshPeople} initialGroup={modalGroup} createError={modalError} clearCreateError={setModalError} />}
    </main>
  );
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default App;
