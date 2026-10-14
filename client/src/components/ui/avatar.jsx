import { cn, initials } from "@/lib/utils";

const hues = [221, 262, 340, 25, 160, 190];
const hueOf = (s = "") => hues[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];

export function Avatar({ name, src, className }) {
  if (src)
    return <img src={src} alt={name} title={name} className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)} />;
  return (
    <div
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", className)}
      style={{ backgroundColor: `hsl(${hueOf(name)} 65% 48%)` }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}