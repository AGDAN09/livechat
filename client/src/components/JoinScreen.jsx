import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinScreen({ onJoin, error }) {
  const [name, setName] = useState("");
  const submit = () => { if (name.trim().length >= 2) onJoin(name); };

  return (
    <div className="relative flex h-full items-center justify-center p-4">
  <ThemeToggle className="absolute right-4 top-4" />
  <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessageCircle size={22} />
        </div>
        <h1 className="text-xl font-semibold">Masuk ke obrolan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih username yang akan tampil di ruang chat.</p>
        <div className="mt-5 space-y-3">
          <Input autoFocus maxLength={24} placeholder="Nama kamu" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={name.trim().length < 2}>Mulai chat</Button>
        </div>
      </div>
    </div>
  );
}
