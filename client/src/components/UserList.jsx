import { useState } from "react";
import { Check, Copy, LogOut, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import GroupDialog from "@/components/GroupDialog";
import { cn } from "@/lib/utils";

export default function UserList({ chat }) {
  const { users, me, group, groups, enterGroup, leaveGroup } = chat;
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(group.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const leave = () => window.confirm(`Keluar dari grup "${group.name}"?`) && leaveGroup(group.id);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="border-b p-4">
        <p className="truncate font-semibold">{group.name}</p>
        <button onClick={copy} title="Salin kode grup"
          className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          Kode: <span className="font-mono tracking-wider text-foreground">{group.id}</span>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      <div className="border-b p-2">
        <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground">
          <span>GRUP SAYA</span>
          <button onClick={() => setDialog(true)} aria-label="Tambah grup" className="rounded p-1 hover:bg-accent"><Plus size={14} /></button>
        </div>
        <ul className="max-h-40 overflow-y-auto">
          {groups.map((g) => (
            <li key={g.id}>
              <button onClick={() => g.id !== group.id && enterGroup(g)}
                className={cn("w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent", g.id === group.id && "bg-accent font-medium")}>
                {g.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">ONLINE</span>
        <Badge>{users.length}</Badge>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-2.5 rounded-md p-2">
            <div className="relative">
              <Avatar name={u.username} src={u.avatar} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
            </div>
            <span className="truncate text-sm">{u.username}{u.id === me.id && <span className="text-muted-foreground"> (kamu)</span>}</span>
          </li>
        ))}
      </ul>

      <button onClick={leave} className="flex items-center gap-2 border-t p-3 text-sm text-muted-foreground hover:text-red-600">
        <LogOut size={15} />Keluar grup
      </button>
      {dialog && <GroupDialog chat={chat} onClose={() => setDialog(false)} />}
    </aside>
  );
}