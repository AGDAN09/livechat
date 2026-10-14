// client: tampilan story layar penuh
import { useEffect, useRef, useState } from "react";
import { Eye, Heart, MessageCircle, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SERVER_URL } from "@/lib/socket";
import { cn, timeAgo } from "@/lib/utils";

const IMAGE_MS = 5000;
const firstUnseen = (g) => Math.max(0, g?.items.findIndex((i) => !i.seen) ?? 0);

export default function StoryViewer({ order, stories, me, onView, onDelete, onLike, onReply, onClose }) {
  // state
  const [gi, setGi] = useState(0);
  const [ii, setIi] = useState(() => firstUnseen(stories.find((s) => s.pid === order[0])));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState(false); // false | "views" | "likes" | "replies"
  const [text, setText] = useState("");
  const [typingReply, setTypingReply] = useState(false);
  const [note, setNote] = useState("");
  const [burst, setBurst] = useState(false);
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const nextRef = useRef(() => {});
  const prevRef = useRef(() => {});

  const grp = stories.find((s) => s.pid === order[gi]);
  const idx = grp ? Math.min(ii, grp.items.length - 1) : 0;
  const item = grp?.items[idx];
  const mine = grp?.pid === me.pid;
  const hold = paused || !!panel || typingReply; // jeda saat panel/mengetik

  // pindah grup / item
  const goGroup = (n) => {
    setProgress(0);
    setPanel(false);
    if (n < 0) return setIi(0);
    if (n >= order.length) return onClose();
    setGi(n);
    setIi(firstUnseen(stories.find((s) => s.pid === order[n])));
  };
  nextRef.current = () => {
    if (grp && idx < grp.items.length - 1) { setIi(idx + 1); setProgress(0); }
    else goGroup(gi + 1);
  };
  prevRef.current = () => {
    if (idx > 0) { setIi(idx - 1); setProgress(0); }
    else goGroup(gi - 1);
  };

  // grup hilang -> lanjut
  useEffect(() => { if (!grp) goGroup(gi + 1); }, [grp]); // eslint-disable-line

  // tandai dilihat
  useEffect(() => { if (item && !item.seen && !mine) onView(item.id); }, [item?.id]); // eslint-disable-line

  // reset balasan saat pindah story
  useEffect(() => { setText(""); setNote(""); }, [item?.id]);

  // timer foto
  useEffect(() => {
    if (!item || item.type !== "image" || hold) return;
    const t0 = Date.now() - progress * IMAGE_MS;
    const id = setInterval(() => {
      const p = (Date.now() - t0) / IMAGE_MS;
      if (p >= 1) { clearInterval(id); nextRef.current(); } else setProgress(p);
    }, 50);
    return () => clearInterval(id);
  }, [item?.id, hold]); // eslint-disable-line

  // sinkron suara ke elemen video
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, item?.id]);

  // putar / jeda video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hold) v.pause();
    else v.play().catch(() => { setMuted(true); v.muted = true; v.play().catch(() => {}); });
  }, [item?.id, hold]);

  // tombol suara
  const toggleSound = () => {
    const v = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (v) { v.muted = next; if (!next && !hold) v.play().catch(() => {}); }
  };

  // keyboard (panah nonaktif saat mengetik)
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") nextRef.current();
      if (e.key === "ArrowLeft") prevRef.current();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []); // eslint-disable-line

  if (!grp || !item) return null;
  const src = SERVER_URL + item.url;
  const views = item.views ?? [];
  const likes = item.likes ?? [];
  const replies = item.replies ?? [];
  const likedBy = new Set(likes.map((l) => l.username));

  // hapus story
  const remove = async () => {
    setPaused(true);
    if (window.confirm("Hapus story ini?")) await onDelete(item.id);
    setPaused(false);
  };

  // like
  const like = () => {
    if (!item.liked) { setBurst(true); setTimeout(() => setBurst(false), 700); }
    onLike(item.id);
  };

  // kirim balasan
  const sendReply = async () => {
    const t = text.trim();
    if (!t) return;
    const res = await onReply(item.id, t);
    if (res.ok) { setText(""); setNote("Balasan terkirim"); inputRef.current?.blur(); }
    else setNote(res.error);
    setTimeout(() => setNote(""), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-md bg-black">
        {/* media */}
        {item.type === "video" ? (
          <video key={item.id} ref={videoRef} src={src} playsInline
            onTimeUpdate={(e) => e.target.duration && setProgress(e.target.currentTime / e.target.duration)}
            onEnded={() => nextRef.current()} className="h-full w-full object-contain" />
        ) : (
          <img key={item.id} src={src} alt="" className="h-full w-full object-contain" />
        )}

        {/* area ketuk: kiri mundur, tengah jeda, kanan maju */}
        <div className="absolute inset-0 flex">
          <button aria-label="Sebelumnya" className="h-full w-1/3" onClick={() => prevRef.current()} />
          <button aria-label="Jeda" className="h-full w-1/3" onClick={() => setPaused((p) => !p)} />
          <button aria-label="Berikutnya" className="h-full w-1/3" onClick={() => nextRef.current()} />
        </div>

        {paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">Dijeda</span>
          </div>
        )}

        {/* animasi like */}
        {burst && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Heart size={96} className="animate-ping fill-red-500 text-red-500" />
          </div>
        )}

        {/* progres + header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 pt-4">
          <div className="flex gap-1">
            {grp.items.map((it, i) => (
              <div key={it.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
                <div className="h-full bg-white" style={{ width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2 text-white">
            <Avatar name={grp.username} src={grp.avatar} className="h-9 w-9" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{mine ? "Story kamu" : grp.username}</p>
              <p className="text-xs opacity-80">{timeAgo(item.ts)}</p>
            </div>
            {item.type === "video" && (
              <button onClick={toggleSound} aria-label="Suara" className="rounded-full p-2 hover:bg-white/20">
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}
            {mine && (
              <button onClick={remove} aria-label="Hapus story" className="rounded-full p-2 hover:bg-white/20"><Trash2 size={18} /></button>
            )}
            <button onClick={onClose} aria-label="Tutup" className="rounded-full p-2 hover:bg-white/20"><X size={20} /></button>
          </div>
        </div>

        {/* caption */}
        {item.caption && (
          <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-white", mine ? "pb-16" : "pb-20")}>
            <p className="whitespace-pre-wrap break-words text-sm">{item.caption}</p>
          </div>
        )}

        {/* penonton: kolom balas + like */}
        {!mine && (
          <>
            {note && (
              <p className="absolute inset-x-0 bottom-20 z-10 text-center text-sm text-white drop-shadow">{note}</p>
            )}
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
              <input ref={inputRef} value={text} maxLength={300} placeholder="Balas story…"
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setTypingReply(true)} onBlur={() => setTypingReply(false)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                className="h-10 flex-1 rounded-full border border-white/40 bg-black/30 px-4 text-sm text-white placeholder:text-white/70 focus:border-white focus:outline-none" />
              {text.trim() && (
                <button onClick={sendReply} aria-label="Kirim balasan" className="rounded-full p-2 text-white hover:bg-white/20"><Send size={20} /></button>
              )}
              <button onClick={like} aria-label={item.liked ? "Batal suka" : "Suka"} className="rounded-full p-2 hover:bg-white/20">
                <Heart size={24} className={item.liked ? "fill-red-500 text-red-500" : "text-white"} />
              </button>
            </div>
          </>
        )}

        {/* pemilik: ringkasan dilihat / suka / balasan */}
        {mine && (
          <button onClick={() => setPanel("views")}
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">
            <span className="flex items-center gap-1"><Eye size={16} />{views.length}</span>
            <span className="flex items-center gap-1"><Heart size={16} />{likes.length}</span>
            <span className="flex items-center gap-1"><MessageCircle size={16} />{replies.length}</span>
          </button>
        )}

        {/* panel pemilik */}
        {mine && panel && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[65%] overflow-y-auto rounded-t-2xl bg-card p-4 text-foreground shadow-lg">
            <div className="mb-3 flex items-center gap-1">
              <div className="flex flex-1 gap-1 rounded-md bg-muted p-1">
                {[["views", "Dilihat", views.length], ["likes", "Suka", likes.length], ["replies", "Balasan", replies.length]].map(([k, label, n]) => (
                  <button key={k} onClick={() => setPanel(k)}
                    className={cn("flex-1 rounded py-1.5 text-sm font-medium", panel === k ? "bg-card shadow-sm" : "text-muted-foreground")}>
                    {label} {n}
                  </button>
                ))}
              </div>
              <button onClick={() => setPanel(false)} aria-label="Tutup daftar" className="p-2"><X size={18} /></button>
            </div>

            {panel === "views" && (views.length === 0
              ? <p className="text-sm text-muted-foreground">Belum ada yang melihat.</p>
              : views.map((v) => (
                <div key={v.username + v.ts} className="flex items-center gap-3 py-1.5">
                  <Avatar name={v.username} />
                  <span className="flex-1 truncate text-sm">{v.username}</span>
                  {likedBy.has(v.username) && <Heart size={14} className="fill-red-500 text-red-500" />}
                  <span className="text-xs text-muted-foreground">{timeAgo(v.ts)}</span>
                </div>
              )))}

            {panel === "likes" && (likes.length === 0
              ? <p className="text-sm text-muted-foreground">Belum ada yang menyukai.</p>
              : likes.map((l) => (
                <div key={l.username + l.ts} className="flex items-center gap-3 py-1.5">
                  <Avatar name={l.username} />
                  <span className="flex-1 truncate text-sm">{l.username}</span>
                  <Heart size={14} className="fill-red-500 text-red-500" />
                  <span className="text-xs text-muted-foreground">{timeAgo(l.ts)}</span>
                </div>
              )))}

            {panel === "replies" && (replies.length === 0
              ? <p className="text-sm text-muted-foreground">Belum ada balasan.</p>
              : replies.map((r) => (
                <div key={r.id} className="flex items-start gap-3 py-2">
                  <Avatar name={r.username} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.username} <span className="text-xs font-normal text-muted-foreground">{timeAgo(r.ts)}</span></p>
                    <p className="whitespace-pre-wrap break-words text-sm">{r.text}</p>
                  </div>
                </div>
              )))}
          </div>
        )}
      </div>
    </div>
  );
}