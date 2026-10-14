import { useState } from "react";
import { Check, CheckCheck, Download, FileText, Reply, Smile } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SERVER_URL } from "@/lib/socket";
import { cn, fmtSize, timeOf } from "@/lib/utils";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function Attachment({ file, mine }) {
  const url = SERVER_URL + file.url;
  if (file.isImage)
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={file.name} loading="lazy" className="max-h-64 max-w-full rounded-lg object-cover" />
      </a>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className={cn("flex items-center gap-3 rounded-lg p-2 pr-3", mine ? "bg-white/15" : "bg-muted")}>
      <FileText size={22} className="shrink-0" />
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate font-medium">{file.name}</span>
        <span className="block text-xs opacity-70">{fmtSize(file.size)}</span>
      </span>
      <Download size={16} className="shrink-0 opacity-70" />
    </a>
  );
}

export default function MessageBubble({ msg, mine, meId, userMap = {}, onReply, onReact }) {
  const [picker, setPicker] = useState(false);

  if (msg.type === "system")
    return <p className="py-1 text-center text-xs text-muted-foreground">{msg.text}</p>;

  const read = msg.readBy.length > 0;
  const sender = userMap[msg.userId];
  const name = sender?.username ?? msg.username;
  const reactions = Object.entries(msg.reactions || {});

  return (
    <div className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
      {!mine && <Avatar name={name} src={sender?.avatar} className="h-8 w-8" />}
      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {!mine && <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{name}</span>}

        <div className={cn("flex items-center gap-1", mine && "flex-row-reverse")}>
          <div className={cn("min-w-0 space-y-2 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
            msg.attachment && "p-1.5",
            mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>
            {msg.replyTo && (
              <div className={cn("rounded-md border-l-4 px-2 py-1 text-xs",
                mine ? "border-white/70 bg-white/15" : "border-primary bg-muted")}>
                <p className="font-semibold">{msg.replyTo.username}</p>
                <p className="line-clamp-2 opacity-80">{msg.replyTo.text}</p>
              </div>
            )}
            {msg.attachment && <Attachment file={msg.attachment} mine={mine} />}
            {msg.text && <p className={cn(msg.attachment && "px-2 pb-1")}>{msg.text}</p>}
          </div>

          <div className={cn(
            "relative flex shrink-0 gap-0.5 text-muted-foreground opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            picker && "opacity-100")}>
            <button onClick={() => onReply?.(msg)} aria-label="Balas" className="rounded-full p-1.5 hover:bg-accent"><Reply size={15} /></button>
            <button onClick={() => setPicker((v) => !v)} aria-label="Beri reaksi" className="rounded-full p-1.5 hover:bg-accent"><Smile size={15} /></button>
            {picker && (
              <div className={cn("absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border bg-card p-1 shadow-md", mine ? "right-0" : "left-0")}>
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { onReact?.(msg.id, e); setPicker(false); }}
                    className="rounded-full px-1 text-lg hover:bg-accent">{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {reactions.map(([emoji, list]) => (
              <button key={emoji} onClick={() => onReact?.(msg.id, emoji)}
                title={list.map((r) => userMap[r.id]?.username ?? r.username).join(", ")}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  list.some((r) => r.id === meId) ? "border-primary bg-primary/10" : "bg-card")}>
                <span>{emoji}</span><span>{list.length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          <span>{timeOf(msg.ts)}</span>
          {mine && (
            <span className={cn("flex items-center gap-1", read && "text-primary")}>
              {read ? <CheckCheck size={13} /> : <Check size={13} />}
              {read ? `Dibaca ${msg.readBy.map((r) => userMap[r.id]?.username ?? r.username).join(", ")}` : "Terkirim"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}