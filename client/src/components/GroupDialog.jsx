import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function GroupDialog({ chat, onClose }) {
  const [tab, setTab] = useState("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr("");
    const res = tab === "create" ? await chat.createGroup(name, pw) : await chat.joinGroup(code, pw);
    setBusy(false);
    if (res.ok) onClose?.();
    else setErr(res.error);
  };

  const open = async (g) => {
    const res = await chat.enterGroup(g);
    if (res.ok) onClose?.();
    else setErr(res.error);
  };

  const ready = tab === "create" ? name.trim().length >= 2 && pw.length >= 4 : code.trim().length >= 4 && pw.length >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Grup</h3>
          {onClose && <button onClick={onClose} aria-label="Tutup" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>}
        </div>

        {chat.groups.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">GRUP SAYA</p>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {chat.groups.map((g) => (
                <li key={g.id}>
                  <button onClick={() => open(g)} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent">
                    <span className="truncate">{g.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{g.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 rounded-md bg-muted p-1 text-sm">
          {[["join", "Gabung grup"], ["create", "Buat grup"]].map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setErr(""); }}
              className={cn("rounded py-1.5 font-medium", tab === k ? "bg-card shadow-sm" : "text-muted-foreground")}>{label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === "create" ? (
            <Input value={name} maxLength={30} placeholder="Nama grup" onChange={(e) => setName(e.target.value)} />
          ) : (
            <Input value={code} maxLength={6} placeholder="Kode grup (6 karakter)" className="font-mono uppercase tracking-widest"
              onChange={(e) => setCode(e.target.value.toUpperCase())} />
          )}
          <Input type="password" value={pw} maxLength={64} placeholder={tab === "create" ? "Buat password (min. 4 karakter)" : "Password grup"}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ready && submit()} />
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <Button className="w-full" onClick={submit} disabled={!ready || busy}>{tab === "create" ? "Buat grup" : "Gabung"}</Button>
        </div>
      </div>
    </div>
  );
}