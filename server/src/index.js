// server: import
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { randomBytes, randomUUID, scryptSync, createHmac, timingSafeEqual } from "crypto";

// config
const PORT = process.env.PORT || 4000;
const ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
const MAX_HISTORY = 100;
const MAX_FILE = 5 * 1024 * 1024;
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// config story
const STORY_TTL = 24 * 60 * 60 * 1000; // 24 jam
const MAX_STORY_IMAGE = 10 * 1024 * 1024;
const MAX_STORY_VIDEO = 80 * 1024 * 1024;
const STORY_TYPES = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
};

// folder
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPLOAD_DIR = path.join(ROOT, "data", "uploads");
const STORY_DIR = path.join(ROOT, "data", "stories");
const DATA_FILE = path.join(ROOT, "data", "db.json");

const validAvatar = (a) =>
  a === null || (typeof a === "string" && a.length <= 40000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(a));

// db (file JSON)
let db = { secret: randomBytes(32).toString("hex"), groups: {}, avatars: {}, stories: {}, messages: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }; } catch {}
let saveTimer;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(db));
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  }, 300);
};
save();

// keamanan
const hashPw = (pw, salt) => scryptSync(pw, salt, 32).toString("hex");
const same = (a, b) => typeof a === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const tokenOf = (gid) => createHmac("sha256", db.secret).update(gid).digest("hex");
const pidOf = (uid) => createHmac("sha256", db.secret).update("pid:" + uid).digest("hex").slice(0, 16);
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => {
  let c;
  do { c = Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join(""); } while (db.groups[c]);
  return c;
};

// buat folder
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(STORY_DIR, { recursive: true });

// express
const app = express();
app.use(cors({ origin: ORIGINS }));
app.get("/health", (_, res) => res.json({ ok: true, online: users.size, groups: Object.keys(db.groups).length }));
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res, file) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!IMAGE_EXT.includes(path.extname(file).toLowerCase())) res.setHeader("Content-Disposition", "attachment");
  },
}));
app.use("/stories", express.static(STORY_DIR, {
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

// upload story
app.post("/api/stories", (req, res) => {
  const fail = (code, error) => { res.set("Connection", "close"); return res.status(code).json({ error }); };

  const gid = String(req.get("x-group-id") || "");
  const g = db.groups[gid];
  if (!g || !same(req.get("x-token"), tokenOf(gid))) return fail(403, "Akses grup tidak valid.");

  const uid = String(req.get("x-uid") || "");
  const poster = uid.length >= 8 ? memberByUid(gid, uid) : null;
  if (!poster) return fail(403, "Masuk ke grup ini dulu.");

  const ctype = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = STORY_TYPES[ctype];
  if (!ext) return fail(415, "Format tidak didukung. Gunakan JPG/PNG/WebP/GIF atau MP4/WebM/MOV.");
  const isVideo = ctype.startsWith("video/");
  const max = isVideo ? MAX_STORY_VIDEO : MAX_STORY_IMAGE;
  if (Number(req.get("content-length")) > max) return fail(413, `Ukuran maksimal ${max / 1024 / 1024} MB.`);

  const active = Object.values(db.stories).filter((s) => s.gid === gid && s.pid === poster.pid).length;
  if (active >= 20) return fail(429, "Batas 20 story aktif per orang.");

  let caption = "";
  try { caption = decodeURIComponent(req.get("x-caption") || "").trim().slice(0, 200); } catch {}

  const id = randomUUID();
  const file = `${id}${ext}`;
  const fp = path.join(STORY_DIR, file);
  const out = fs.createWriteStream(fp);
  let size = 0, dead = false;
  const abort = (code, msg) => {
    if (dead) return;
    dead = true;
    req.unpipe(out);
    out.destroy();
    fs.unlink(fp, () => {});
    if (!res.headersSent) fail(code, msg);
  };
  req.on("data", (c) => { size += c.length; if (size > max) abort(413, `Ukuran maksimal ${max / 1024 / 1024} MB.`); });
  req.on("close", () => { if (!req.complete) abort(400, "Upload dibatalkan."); });
  out.on("error", () => abort(500, "Gagal menyimpan file."));
  out.on("finish", () => {
    if (dead) return;
    if (!size) { dead = true; fs.unlink(fp, () => {}); return fail(400, "File kosong."); }
    const now = Date.now();
    db.stories[id] = {
      id, gid, pid: poster.pid, username: poster.username, type: isVideo ? "video" : "image",
      file, caption, ts: now, expiresAt: now + STORY_TTL, views: {}, likes: {}, replies: [], // ubah
    };
    save();
    emitStories(gid);
    res.json({ ok: true });
  });
  req.pipe(out);
});

// socket.io
const server = http.createServer(app);
server.requestTimeout = 10 * 60 * 1000;
const io = new Server(server, { cors: { origin: ORIGINS }, maxHttpBufferSize: MAX_FILE + 512 * 1024 });

const users = new Map(); // socket.id -> user (di memori)

// helper
const pub = ({ uid, ...u }) => u; // uid rahasia, jangan dikirim ke klien
const roomMsgs = (gid) => (db.messages[gid] ||= []);
const members = (gid) =>
  [...(io.sockets.adapter.rooms.get(`g:${gid}`) ?? [])].map((id) => users.get(id)).filter(Boolean).map(pub);
const memberByUid = (gid, uid) => {
  for (const sid of io.sockets.adapter.rooms.get(`g:${gid}`) ?? []) {
    const u = users.get(sid);
    if (u && u.uid === uid) return u;
  }
};
const removeFile = (m) =>
  m?.attachment && fs.unlink(path.join(UPLOAD_DIR, path.basename(m.attachment.url)), () => {});
const push = (gid, msg) => {
  const list = roomMsgs(gid);
  list.push(msg);
  if (list.length > MAX_HISTORY) removeFile(list.shift());
  save();
  return msg;
};
const system = (gid, text) => ({ id: randomUUID(), type: "system", text, ts: Date.now(), readBy: [] });

// story: umpan, kirim, bersihkan
const feedFor = (gid, viewerPid) => {
  const now = Date.now(), map = new Map();
  for (const s of Object.values(db.stories)) {
    if (s.gid !== gid || s.expiresAt <= now) continue;
    const mine = s.pid === viewerPid;
    if (!map.has(s.pid))
      map.set(s.pid, { pid: s.pid, username: s.username, avatar: db.avatars[s.username.toLowerCase()] ?? null, items: [] });
    map.get(s.pid).items.push({
      id: s.id, type: s.type, url: `/stories/${s.file}`, caption: s.caption, ts: s.ts, expiresAt: s.expiresAt,
      seen: mine || !!s.views[viewerPid],
      liked: !!s.likes?.[viewerPid], // ubah: apakah aku sudah like
      ...(mine ? { views: Object.values(s.views), likes: Object.values(s.likes ?? {}), replies: s.replies ?? [] } : {}), // ubah: hanya pemilik
    });
  }
  const out = [...map.values()];
  out.forEach((g) => g.items.sort((a, b) => a.ts - b.ts));
  return out;
};
const emitStories = (gid) => {
  for (const sid of io.sockets.adapter.rooms.get(`g:${gid}`) ?? []) {
    const u = users.get(sid);
    if (u) io.to(sid).emit("stories:update", feedFor(gid, u.pid));
  }
};

const rmStory = (s) => {
  fs.unlink(path.join(STORY_DIR, s.file), () => {});
  delete db.stories[s.id];
};
const purge = () => {
  const now = Date.now(), gids = new Set();
  for (const s of Object.values(db.stories))
    if (s.expiresAt <= now) { gids.add(s.gid); rmStory(s); }
  if (gids.size) { save(); gids.forEach(emitStories); }
};

io.on("connection", (socket) => {
  let fails = 0, lockUntil = 0;

  // keluar ruangan
  const leaveRoom = () => {
    const gid = socket.data.groupId, user = users.get(socket.id);
    if (!gid || !user) return;
    socket.leave(`g:${gid}`);
    socket.data.groupId = null;
    io.to(`g:${gid}`).emit("typing:update", { userId: user.id, username: user.username, isTyping: false });
    io.to(`g:${gid}`).emit("users:update", members(gid));
    io.to(`g:${gid}`).emit("message:new", system(gid, `${user.username} keluar`));
  };

  // masuk
  socket.on("join", ({ username, avatar, uid } = {}, ack = () => {}) => {
    const name = String(username || "").trim().slice(0, 24);
    if (name.length < 2) return ack({ ok: false, error: "Nama minimal 2 karakter." });
    const id = String(uid || "").slice(0, 64);
    if (id.length < 8) return ack({ ok: false, error: "ID perangkat tidak valid." });
    const key = name.toLowerCase();
    const user = {
      id: socket.id,
      uid: id,
      pid: pidOf(id),
      username: name,
      avatar: validAvatar(avatar) && avatar ? avatar : (db.avatars[key] ?? null),
    };
    users.set(socket.id, user);
    if (user.avatar) { db.avatars[key] = user.avatar; save(); }
    ack({ ok: true, user: pub(user) });
  });

  // grup: buat
  socket.on("group:create", ({ name, password } = {}, ack = () => {}) => {
    if (!users.has(socket.id)) return ack({ ok: false, error: "Belum masuk." });
    const n = String(name || "").trim().slice(0, 30);
    const pw = String(password || "");
    if (n.length < 2) return ack({ ok: false, error: "Nama grup minimal 2 karakter." });
    if (pw.length < 4 || pw.length > 64) return ack({ ok: false, error: "Password 4–64 karakter." });
    const id = newCode();
    const salt = randomBytes(16).toString("hex");
    db.groups[id] = { id, name: n, salt, hash: hashPw(pw, salt), createdAt: Date.now() };
    save();
    ack({ ok: true, group: { id, name: n }, token: tokenOf(id) });
  });

  // grup: gabung (kode + password)
  socket.on("group:join", ({ id, password } = {}, ack = () => {}) => {
    if (!users.has(socket.id)) return ack({ ok: false, error: "Belum masuk." });
    if (Date.now() < lockUntil) return ack({ ok: false, error: "Terlalu banyak percobaan. Coba lagi sebentar." });
    const g = db.groups[String(id || "").trim().toUpperCase()];
    if (!g || !same(hashPw(String(password || ""), g.salt), g.hash)) {
      if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
      return ack({ ok: false, error: "Kode grup atau password salah." });
    }
    fails = 0;
    ack({ ok: true, group: { id: g.id, name: g.name }, token: tokenOf(g.id) });
  });

  // grup: masuk ruangan (pakai token)
  socket.on("group:enter", ({ id, token } = {}, ack = () => {}) => {
    const user = users.get(socket.id);
    if (!user) return ack({ ok: false, error: "Belum masuk." });
    const g = db.groups[id];
    if (!g || !same(token, tokenOf(g.id)))
      return ack({ ok: false, gone: true, error: "Grup tidak ditemukan atau akses tidak valid." });

    const info = { id: g.id, name: g.name };
    if (socket.data.groupId === g.id)
      return ack({ ok: true, group: info, users: members(g.id), history: roomMsgs(g.id), stories: feedFor(g.id, user.pid) });
    if (members(g.id).some((u) => u.id !== socket.id && u.username.toLowerCase() === user.username.toLowerCase()))
      return ack({ ok: false, error: "Nama sudah dipakai di grup ini." });

    leaveRoom();
    socket.data.groupId = g.id;
    socket.join(`g:${g.id}`);
    ack({ ok: true, group: info, users: members(g.id), history: roomMsgs(g.id), stories: feedFor(g.id, user.pid) });
    io.to(`g:${g.id}`).emit("users:update", members(g.id));
    io.to(`g:${g.id}`).emit("message:new", system(g.id, `${user.username} bergabung`));
  });

  socket.on("group:exit", () => leaveRoom());

  // profil
  socket.on("profile:update", ({ username, avatar } = {}, ack = () => {}) => {
    const user = users.get(socket.id);
    if (!user) return ack({ ok: false, error: "Belum masuk ke chat." });
    const gid = socket.data.groupId;

    const name = String(username ?? user.username).trim().slice(0, 24);
    if (name.length < 2) return ack({ ok: false, error: "Nama minimal 2 karakter." });
    if (gid && members(gid).some((u) => u.id !== socket.id && u.username.toLowerCase() === name.toLowerCase()))
      return ack({ ok: false, error: "Nama sudah dipakai di grup ini." });
    if (avatar !== undefined && !validAvatar(avatar))
      return ack({ ok: false, error: "Foto tidak valid atau terlalu besar." });

    const old = user.username;
    user.username = name;
    if (avatar !== undefined) user.avatar = avatar;
    delete db.avatars[old.toLowerCase()];
    if (user.avatar) db.avatars[name.toLowerCase()] = user.avatar;

    const touched = new Set();
    for (const s of Object.values(db.stories)) if (s.pid === user.pid) { s.username = name; touched.add(s.gid); }

    if (old !== name) {
      for (const list of Object.values(db.messages))
        for (const m of list) {
          if (m.userId === user.pid) m.username = name;
          for (const r of m.readBy || []) if (r.id === user.pid) r.username = name;
        }
      if (gid) io.to(`g:${gid}`).emit("message:new", system(gid, `${old} mengganti nama menjadi ${name}`));
    }
    save();
    if (gid) io.to(`g:${gid}`).emit("users:update", members(gid));
    touched.forEach(emitStories);
    ack({ ok: true, user: pub(user) });
  });

  // pesan: kirim
  socket.on("message:send", ({ text, file, replyTo: replyId } = {}, ack = () => {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    if (!user || !gid) return ack({ ok: false, error: "Belum masuk ke grup." });
    const body = String(text || "").trim().slice(0, 1000);

    let attachment = null;
    if (file) {
      const buf = file.data;
      if (!Buffer.isBuffer(buf) || !buf.length) return ack({ ok: false, error: "File tidak valid." });
      if (buf.length > MAX_FILE) return ack({ ok: false, error: "Ukuran file maksimal 5 MB." });
      const name = path.basename(String(file.name || "file")).slice(-80) || "file";
      const safe = name.replace(/[^\w.\-]/g, "_");
      const stored = `${randomUUID()}-${safe}`;
      try {
        fs.writeFileSync(path.join(UPLOAD_DIR, stored), buf);
      } catch {
        return ack({ ok: false, error: "Gagal menyimpan file di server." });
      }
      attachment = {
        url: `/uploads/${stored}`, name, size: buf.length,
        isImage: IMAGE_EXT.includes(path.extname(safe).toLowerCase()),
      };
    }
    if (!body && !attachment) return ack({ ok: false, error: "Pesan kosong." });

    let replyTo = null;
    const target = replyId && roomMsgs(gid).find((x) => x.id === replyId && x.type === "user");
    if (target) {
      const preview = target.text || (target.attachment ? (target.attachment.isImage ? "📷 Foto" : `📎 ${target.attachment.name}`) : "");
      replyTo = { id: target.id, username: target.username, text: preview.slice(0, 100) };
    }

    const msg = push(gid, {
      id: randomUUID(), type: "user", userId: user.pid, username: user.username,
      text: body, attachment, replyTo, reactions: {}, ts: Date.now(), readBy: [],
    });
    io.to(`g:${gid}`).emit("message:new", msg);
    socket.to(`g:${gid}`).emit("typing:update", { userId: user.id, username: user.username, isTyping: false });
    ack({ ok: true });
  });

  // pesan: reaksi
  socket.on("message:react", ({ messageId, emoji } = {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    const m = gid && roomMsgs(gid).find((x) => x.id === messageId);
    if (!user || !m || m.type !== "user" || !EMOJIS.includes(emoji)) return;

    const had = m.reactions[emoji]?.some((r) => r.id === user.pid);
    for (const e of Object.keys(m.reactions)) {
      m.reactions[e] = m.reactions[e].filter((r) => r.id !== user.pid);
      if (!m.reactions[e].length) delete m.reactions[e];
    }
    if (!had) (m.reactions[emoji] ||= []).push({ id: user.pid, username: user.username });
    save();
    io.to(`g:${gid}`).emit("message:reactions", { messageId, reactions: m.reactions });
  });

  // mengetik
  socket.on("typing", (isTyping) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    if (!user || !gid) return;
    socket.to(`g:${gid}`).emit("typing:update", { userId: user.id, username: user.username, isTyping: !!isTyping });
  });

  // pesan: dibaca
  socket.on("message:read", ({ messageIds } = {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    if (!user || !gid || !Array.isArray(messageIds)) return;
    const changed = [];
    for (const m of roomMsgs(gid)) {
      if (m.type !== "user" || m.userId === user.pid || !messageIds.includes(m.id)) continue;
      if (m.readBy.some((r) => r.id === user.pid)) continue;
      m.readBy.push({ id: user.pid, username: user.username });
      changed.push(m.id);
    }
    if (changed.length) {
      save();
      io.to(`g:${gid}`).emit("message:read", { messageIds: changed, reader: { id: user.pid, username: user.username } });
    }
  });

  // story: dilihat
  socket.on("story:view", ({ storyId } = {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    const s = db.stories[storyId];
    if (!user || !gid || !s || s.gid !== gid || s.expiresAt <= Date.now() || s.pid === user.pid || s.views[user.pid]) return;
    s.views[user.pid] = { username: user.username, ts: Date.now() };
    save();
    emitStories(gid);
  });

  // story: like (klik lagi = batal) // ubah: baru
  socket.on("story:like", ({ storyId } = {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    const s = db.stories[storyId];
    if (!user || !gid || !s || s.gid !== gid || s.expiresAt <= Date.now() || s.pid === user.pid) return;
    s.likes ||= {};
    if (s.likes[user.pid]) delete s.likes[user.pid];
    else s.likes[user.pid] = { username: user.username, ts: Date.now() };
    save();
    emitStories(gid);
  });

  // story: balas (hanya pemilik yang bisa melihat) // ubah: baru
  socket.on("story:reply", ({ storyId, text } = {}, ack = () => {}) => {
    const user = users.get(socket.id);
    const gid = socket.data.groupId;
    const s = db.stories[storyId];
    if (!user || !gid || !s || s.gid !== gid || s.expiresAt <= Date.now() || s.pid === user.pid)
      return ack({ ok: false, error: "Story tidak tersedia." });
    const body = String(text || "").trim().slice(0, 300);
    if (!body) return ack({ ok: false, error: "Balasan kosong." });
    s.replies ||= [];
    if (s.replies.length >= 100) return ack({ ok: false, error: "Balasan story ini sudah penuh." });
    s.replies.push({ id: randomUUID(), username: user.username, text: body, ts: Date.now() });
    save();
    emitStories(gid);
    ack({ ok: true });
  });

  // story: hapus
  socket.on("story:delete", ({ storyId } = {}, ack = () => {}) => {
    const user = users.get(socket.id);
    const s = db.stories[storyId];
    if (!user || !s || s.pid !== user.pid || s.gid !== socket.data.groupId) return ack({ ok: false });
    rmStory(s);
    save();
    emitStories(s.gid);
    ack({ ok: true });
  });

  // putus
  socket.on("disconnect", () => {
    leaveRoom();
    users.delete(socket.id);
  });
});

// bersihkan file & story kedaluwarsa
const used = new Set(Object.values(db.stories).map((s) => s.file));
for (const f of fs.readdirSync(STORY_DIR)) if (!used.has(f)) fs.unlink(path.join(STORY_DIR, f), () => {});
const keep = new Set(Object.values(db.messages).flat().map((m) => m.attachment && path.basename(m.attachment.url)).filter(Boolean));
for (const f of fs.readdirSync(UPLOAD_DIR)) if (!keep.has(f)) fs.unlink(path.join(UPLOAD_DIR, f), () => {});
purge();
setInterval(purge, 60 * 1000);

// jalan
server.listen(PORT, () => console.log(`Socket.IO server jalan di port ${PORT}`));