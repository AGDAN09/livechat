// client: hook utama chat
import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { uploadStory } from "@/lib/api";

// penyimpanan browser: profil & grup aktif per tab, daftar grup awet
const P = "livechat:profile", G = "livechat:groups", A = "livechat:active";
const storeOf = (k) => (k === G ? localStorage : sessionStorage);
const read = (k, d) => { try { return JSON.parse(storeOf(k).getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { storeOf(k).setItem(k, JSON.stringify(v)); } catch {} };

// ID rahasia per nama
const UK = (name) => `livechat:uid:${name.toLowerCase()}`;
const uidFor = (name) => {
  try {
    let id = localStorage.getItem(UK(name));
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(UK(name), id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
};

export function useChat() {
  // state
  const [saved] = useState(() => ({ profile: read(P, null), groups: read(G, []), active: read(A, null) }));
  const [me, setMe] = useState(null);
  const [group, setGroup] = useState(null);
  const [groups, setGroups] = useState(saved.groups);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [stories, setStories] = useState([]);
  const [typing, setTyping] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(!!saved.profile);
  const nameRef = useRef(saved.profile?.username ?? null);
  const avatarRef = useRef(saved.profile?.avatar ?? null);
  const uidRef = useRef(null);
  const groupsRef = useRef(saved.groups);
  const activeRef = useRef(saved.active);
  const typingTimer = useRef(null);

  // simpan daftar grup
  const saveGroups = useCallback((list) => {
    groupsRef.current = list;
    setGroups(list);
    write(G, list);
  }, []);

  // masuk ruangan grup
  const enter = useCallback(
    (g) =>
      new Promise((resolve) => {
        socket.emit("group:enter", { id: g.id, token: g.token }, (res) => {
          if (res?.ok) {
            setGroup(res.group); setUsers(res.users); setMessages(res.history);
            setStories(res.stories ?? []); setTyping({});
            activeRef.current = g.id; write(A, g.id);
          } else {
            if (res?.gone) saveGroups(groupsRef.current.filter((x) => x.id !== g.id));
            if (activeRef.current === g.id) { activeRef.current = null; write(A, null); setGroup(null); }
          }
          resolve(res || { ok: false, error: "Server tidak merespons." });
        });
      }),
    [saveGroups]
  );

  // masuk dengan nama
  const join = useCallback(
    (username) => {
      const uid = (uidRef.current = uidFor(username));
      socket.emit("join", { username, avatar: avatarRef.current, uid }, async (res) => {
        if (!res.ok) { nameRef.current = null; setBooting(false); return setError(res.error); }
        setError("");
        setMe(res.user);
        write(P, { username: res.user.username, avatar: res.user.avatar });
        const g = groupsRef.current.find((x) => x.id === activeRef.current);
        if (g) await enter(g);
        setBooting(false);
      });
    },
    [enter]
  );

  // event socket
  useEffect(() => {
    const onConnect = () => { setConnected(true); if (nameRef.current) join(nameRef.current); };
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setBooting(false);
    const onNew = (m) => setMessages((p) => [...p, m]);
    const onUsers = (list) => {
      setUsers(list);
      setTyping((t) => Object.fromEntries(Object.entries(t).filter(([id]) => list.some((u) => u.id === id))));
    };
    const onTyping = ({ userId, username, isTyping }) =>
      setTyping((t) => {
        const next = { ...t };
        if (isTyping) next[userId] = username;
        else delete next[userId];
        return next;
      });
    const onRead = ({ messageIds, reader }) =>
      setMessages((p) =>
        p.map((m) =>
          messageIds.includes(m.id) && !m.readBy.some((r) => r.id === reader.id)
            ? { ...m, readBy: [...m.readBy, reader] }
            : m
        )
      );
    const onReactions = ({ messageId, reactions }) =>
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    const onStories = (feed) => setStories(feed);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("message:new", onNew);
    socket.on("users:update", onUsers);
    socket.on("typing:update", onTyping);
    socket.on("message:read", onRead);
    socket.on("message:reactions", onReactions);
    socket.on("stories:update", onStories);

    if (nameRef.current && !socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect); socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onNew); socket.off("users:update", onUsers);
      socket.off("typing:update", onTyping); socket.off("message:read", onRead);
      socket.off("message:reactions", onReactions); socket.off("stories:update", onStories);
    };
  }, [join]);

  // tandai pesan dibaca
  useEffect(() => {
    if (!me || !group) return;
    const check = () => {
      if (document.hidden) return;
      const ids = messages
        .filter((m) => m.type === "user" && m.userId !== me.pid && !m.readBy.some((r) => r.id === me.pid))
        .map((m) => m.id);
      if (ids.length) socket.emit("message:read", { messageIds: ids });
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [messages, me, group]);

  // login
  const login = (username) => {
    setError("");
    nameRef.current = username.trim();
    if (socket.connected) join(nameRef.current);
    else socket.connect();
  };

  // grup: buat / gabung / keluar
  const addGroup = (res) => {
    const g = { id: res.group.id, name: res.group.name, token: res.token };
    saveGroups([...groupsRef.current.filter((x) => x.id !== g.id), g]);
    return enter(g);
  };
  const viaServer = (event, payload) =>
    new Promise((resolve) =>
      socket.emit(event, payload, async (res) =>
        resolve(res?.ok ? await addGroup(res) : res || { ok: false, error: "Server tidak merespons." })
      )
    );
  const createGroup = (name, password) => viaServer("group:create", { name, password });
  const joinGroup = (id, password) => viaServer("group:join", { id, password });

  const leaveGroup = (id) => {
    if (activeRef.current === id) {
      socket.emit("group:exit");
      activeRef.current = null; write(A, null);
      setGroup(null); setMessages([]); setUsers([]); setStories([]);
    }
    saveGroups(groupsRef.current.filter((x) => x.id !== id));
  };

  // pesan
  const notifyTyping = () => {
    if (!typingTimer.current) socket.emit("typing", true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { socket.emit("typing", false); typingTimer.current = null; }, 1500);
  };

  const send = (text, file, replyTo) =>
    new Promise((resolve) => {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
      socket.emit("typing", false);
      socket.emit(
        "message:send",
        { text, replyTo, file: file ? { name: file.name, data: file } : undefined },
        (res) => resolve(res || { ok: false, error: "Server tidak merespons." })
      );
    });

  const react = (messageId, emoji) => socket.emit("message:react", { messageId, emoji });

  // story
  const postStory = (file, caption, onProgress) => {
    const g = groupsRef.current.find((x) => x.id === activeRef.current);
    if (!g) return Promise.resolve({ ok: false, error: "Belum masuk ke grup." });
    return uploadStory({ groupId: g.id, token: g.token, uid: uidRef.current, file, caption, onProgress });
  };
  const viewStory = (storyId) => socket.emit("story:view", { storyId });
  const deleteStory = (storyId) => new Promise((resolve) => socket.emit("story:delete", { storyId }, resolve));
  const likeStory = (storyId) => socket.emit("story:like", { storyId }); // ubah
  const replyStory = (storyId, text) => // ubah
    new Promise((resolve) =>
      socket.emit("story:reply", { storyId, text }, (res) => resolve(res || { ok: false, error: "Server tidak merespons." }))
    );

  // profil
  const updateProfile = (profile) =>
    new Promise((resolve) => {
      socket.emit("profile:update", profile, (res) => {
        if (res?.ok) {
          nameRef.current = res.user.username;
          avatarRef.current = res.user.avatar;
          try { localStorage.setItem(UK(res.user.username), uidRef.current); } catch {}
          setMe(res.user);
          write(P, { username: res.user.username, avatar: res.user.avatar });
        }
        resolve(res || { ok: false, error: "Server tidak merespons." });
      });
    });

  const typingNames = Object.values(typing);
  return {
    me, group, groups, users, messages, stories, typingNames, connected, error, booting,
    login, send, react, notifyTyping, updateProfile,
    createGroup, joinGroup, enterGroup: enter, leaveGroup,
    postStory, viewStory, deleteStory, likeStory, replyStory, // ubah
  };
}