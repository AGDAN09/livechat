// client: form tambah story
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shrinkImage } from "@/lib/utils";

// batas
const MAX_SEC = 120; // 2 menit
const MAX_VIDEO = 80 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
const VIDEO_OK = ["video/mp4", "video/webm", "video/quicktime"];

// baca durasi video
const readDuration = (url) =>
  new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.duration);
    v.onerror = () => reject(new Error("Video tidak bisa dibaca oleh browser."));
    v.src = url;
  });

export default function StoryComposer({ onPost, onClose }) {
  // state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { url, kind }
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // bersihkan URL pratinjau
  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  // pilih file
  const pick = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    try {
      if (f.type.startsWith("video/")) {
        if (!VIDEO_OK.includes(f.type)) throw new Error("Format video harus MP4, WebM, atau MOV.");
        if (f.size > MAX_VIDEO) throw new Error("Ukuran video maksimal 80 MB.");
        const url = URL.createObjectURL(f);
        let dur;
        try { dur = await readDuration(url); } catch (x) { URL.revokeObjectURL(url); throw x; }
        if (dur > MAX_SEC + 0.5) { URL.revokeObjectURL(url); throw new Error("Durasi video maksimal 2 menit."); }
        setFile(f);
        setPreview({ url, kind: "video" });
      } else if (f.type.startsWith("image/")) {
        const out = f.type === "image/gif" ? f : await shrinkImage(f);
        if (out.size > MAX_IMAGE) throw new Error("Ukuran foto maksimal 10 MB.");
        setFile(out);
        setPreview({ url: URL.createObjectURL(out), kind: "image" });
      } else {
        throw new Error("Pilih foto atau video.");
      }
    } catch (x) {
      setErr(x.message);
    }
  };

  // bagikan
  const post = async () => {
    setBusy(true);
    setErr("");
    setProgress(0);
    const res = await onPost(file, caption.trim().slice(0, 200), setProgress);
    setBusy(false);
    if (res.ok) onClose();
    else setErr(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        {/* judul */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tambah story</h3>
          <button onClick={onClose} disabled={busy} aria-label="Tutup" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <input ref={inputRef} type="file" className="hidden" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={pick} />

        {/* pratinjau / pilih file */}
        {preview ? (
          <div className="overflow-hidden rounded-lg bg-black">
            {preview.kind === "video"
              ? <video src={preview.url} controls playsInline className="max-h-80 w-full object-contain" /> // ubah: muted dihapus
              : <img src={preview.url} alt="Pratinjau" className="max-h-80 w-full object-contain" />}
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-accent">
            <ImagePlus size={28} />
            Pilih foto atau video
            <span className="text-xs">Video maksimal 2 menit · hilang setelah 24 jam</span>
          </button>
        )}

        {/* caption & progres */}
        {preview && (
          <div className="mt-3 space-y-3">
            <Input value={caption} maxLength={200} placeholder="Tambahkan teks (opsional)" onChange={(e) => setCaption(e.target.value)} disabled={busy} />
            {busy && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}

        {/* tombol */}
        <div className="mt-4 flex justify-end gap-2">
          {preview && <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>Ganti</Button>}
          <Button onClick={post} disabled={!file || busy}>{busy ? `Mengunggah ${Math.round(progress * 100)}%` : "Bagikan"}</Button>
        </div>
      </div>
    </div>
  );
}