// client: ruang chat
import { useEffect, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Paperclip, Reply, Send, Smile, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MessageBubble from "@/components/MessageBubble";
import UserList from "@/components/UserList";
import ThemeToggle from "@/components/ThemeToggle";
import ProfileDialog from "@/components/ProfileDialog";
import StoryBar from "@/components/StoryBar";
import { MAX_FILE, fmtSize } from "@/lib/utils";

export default function ChatRoom({ chat }) {
  const { me, users, messages, typingNames, connected, send, react, notifyTyping, updateProfile } = chat;

  // state
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const userMap = Object.fromEntries(users.map((u) => [u.pid, u])); // ubah: kunci = pid

  // auto scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingNames.length]);

  // tutup picker emoji
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e) => { if (!emojiRef.current?.contains(e.target)) setEmojiOpen(false); };
    const onKey = (e) => e.key === "Escape" && setEmojiOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  // sisipkan emoji di posisi kursor
  const addEmoji = (emoji) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText((text.slice(0, start) + emoji + text.slice(end)).slice(0, 1000));
    notifyTyping();
    const pos = start + emoji.length;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos, pos); });
  };

  // pilih file
  const pick = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE) return setErr("Ukuran file maksimal 5 MB.");
    setErr("");
    setFile(f);
  };

  // kirim
  const submit = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    const res = await send(text, file, replyTo?.id);
    setSending(false);
    if (res.ok) { setText(""); setFile(null); setReplyTo(null); setErr(""); setEmojiOpen(false); }
    else setErr(res.error);
  };

  const typingLabel =
    typingNames.length === 0 ? "" :
    typingNames.length === 1 ? `${typingNames[0]} sedang mengetik…` :
    `${typingNames.slice(0, 2).join(", ")}${typingNames.length > 2 ? " dan lainnya" : ""} sedang mengetik…`;

  return (
    <div className="mx-auto flex h-full max-w-5xl overflow-hidden bg-background md:my-4 md:h-[calc(100%-2rem)] md:rounded-lg md:border md:shadow-sm">
      {/* sidebar */}
      <UserList chat={chat} />

      <section className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">{chat.group.name}</h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-amber-500"}`} />
              {connected ? "Terhubung" : "Menyambung ulang…"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground md:hidden"><Users size={16} />{users.length}</span>
            <ThemeToggle />
            <button onClick={() => setProfileOpen(true)} aria-label="Ubah profil"
              className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar name={me.username} src={me.avatar} className="h-8 w-8" />
            </button>
          </div>
        </header>

        {/* story */}
        <StoryBar chat={chat} />

        {/* daftar pesan */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
          {messages.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">Belum ada pesan. Kirim yang pertama.</p>}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} mine={m.userId === me.pid} meId={me.pid} userMap={userMap} // ubah: pid
              onReply={setReplyTo} onReact={react} />
          ))}
          <div ref={endRef} />
        </div>

        <div className="h-5 px-4 text-xs italic text-muted-foreground">{typingLabel}</div>

        {/* balasan */}
        {replyTo && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border-l-4 border-primary bg-muted/50 px-3 py-2 text-sm">
            <Reply size={15} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">Membalas {userMap[replyTo.userId]?.username ?? replyTo.username}</p>
              <p className="truncate text-muted-foreground">{replyTo.text || (replyTo.attachment ? replyTo.attachment.name : "")}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Batal membalas" className="shrink-0 text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
        )}

        {/* lampiran & error */}
        {(file || err) && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
            {file && (<>
              <Paperclip size={15} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtSize(file.size)}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Hapus lampiran" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </>)}
            {err && <span className={`text-red-600 dark:text-red-400 ${file ? "" : "flex-1"}`}>{err}</span>}
          </div>
        )}

        {/* form kirim */}
        <form onSubmit={submit} className="relative flex gap-2 border-t p-3">
          <input ref={fileRef} type="file" className="hidden" onChange={pick} />

          <div ref={emojiRef}>
            <Button type="button" variant="ghost" size="icon" aria-label="Pilih emoji" onClick={() => setEmojiOpen((v) => !v)}
              className={emojiOpen ? "bg-accent" : ""}>
              <Smile size={18} />
            </Button>
            {emojiOpen && (
              <div className="absolute bottom-full left-3 z-20 mb-1 w-[350px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-lg border shadow-lg">
                <EmojiPicker
                  onEmojiClick={(d) => addEmoji(d.emoji)}
                  theme={document.documentElement.classList.contains("dark") ? Theme.DARK : Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  width="100%"
                  height={380}
                  lazyLoadEmojis
                  searchPlaceholder="Cari emoji"
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          <Button type="button" variant="ghost" size="icon" aria-label="Lampirkan file" onClick={() => fileRef.current?.click()}>
            <Paperclip size={18} />
          </Button>
          <Input ref={inputRef} value={text} maxLength={1000} placeholder="Tulis pesan…"
            onChange={(e) => { setText(e.target.value); notifyTyping(); }} />
          <Button type="submit" size="icon" aria-label="Kirim" disabled={(!text.trim() && !file) || !connected || sending}>
            <Send size={18} />
          </Button>
        </form>
      </section>

      {/* dialog profil */}
      {profileOpen && <ProfileDialog me={me} onSave={updateProfile} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}