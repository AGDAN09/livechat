// client: deretan story di atas chat
import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import StoryComposer from "@/components/StoryComposer";
import StoryViewer from "@/components/StoryViewer";
import { cn } from "@/lib/utils";

const unseen = (g) => g.items.some((i) => !i.seen);
const last = (g) => g.items[g.items.length - 1].ts;

// satu lingkaran story
function Tile({ name, src, label, ring, onClick, onPlus }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <div className="relative">
        <button onClick={onClick} aria-label={label}
          className={cn("rounded-full p-[2.5px]",
            ring === "unseen" && "bg-gradient-to-tr from-primary to-fuchsia-500",
            ring === "own" && "bg-primary",
            ring === "seen" && "bg-border",
            ring === "none" && "bg-transparent")}>
          <span className="block rounded-full bg-background p-0.5">
            <Avatar name={name} src={src} className="h-12 w-12" />
          </span>
        </button>
        {onPlus && (
          <button onClick={onPlus} aria-label="Tambah story"
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <Plus size={12} />
          </button>
        )}
      </div>
      <span className="w-full truncate text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function StoryBar({ chat }) {
  const { me, stories, postStory, viewStory, deleteStory, likeStory, replyStory } = chat; // ubah
  const [composer, setComposer] = useState(false);
  const [order, setOrder] = useState(null); // urutan pid yang diputar

  const mine = stories.find((s) => s.pid === me.pid);
  const others = stories
    .filter((s) => s.pid !== me.pid)
    .sort((a, b) => Number(unseen(b)) - Number(unseen(a)) || last(b) - last(a));
  const all = mine ? [mine, ...others] : others;
  const open = (pid) => setOrder(all.map((g) => g.pid).slice(all.findIndex((g) => g.pid === pid)));

  return (
    <>
      <div className="flex gap-3 overflow-x-auto border-b px-4 py-3">
        <Tile name={me.username} src={me.avatar} label="Story kamu" ring={mine ? "own" : "none"}
          onClick={() => (mine ? open(me.pid) : setComposer(true))} onPlus={() => setComposer(true)} />
        {others.map((g) => (
          <Tile key={g.pid} name={g.username} src={g.avatar} label={g.username}
            ring={unseen(g) ? "unseen" : "seen"} onClick={() => open(g.pid)} />
        ))}
      </div>

      {composer && <StoryComposer onPost={postStory} onClose={() => setComposer(false)} />}
      {order && (
        <StoryViewer order={order} stories={stories} me={me} onView={viewStory}
          onDelete={deleteStory} onLike={likeStory} onReply={replyStory} onClose={() => setOrder(null)} /> // ubah
      )}
    </>
  );
}