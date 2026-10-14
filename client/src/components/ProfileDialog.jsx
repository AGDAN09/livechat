import { useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toAvatar } from "@/lib/utils";

export default function ProfileDialog({ me, onSave, onClose }) {
  const [name, setName] = useState(me.username);
  const [avatar, setAvatar] = useState(me.avatar || null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("File harus berupa gambar.");
    try { setAvatar(await toAvatar(f)); setErr(""); } catch (x) { setErr(x.message); }
  };

  const save = async () => {
    setSaving(true);
    const res = await onSave({ username: name, avatar });
    setSaving(false);
    if (res.ok) onClose();
    else setErr(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ubah profil</h3>
          <button onClick={onClose} aria-label="Tutup" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Avatar name={name} src={avatar} className="h-24 w-24 text-2xl" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Camera size={16} />Ganti foto</Button>
            {avatar && <Button variant="ghost" onClick={() => setAvatar(null)}><Trash2 size={16} />Hapus</Button>}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="text-sm font-medium">Nama</label>
          <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={save} disabled={saving || name.trim().length < 2}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  );
}