import { useChat } from "@/hooks/useChat";
import JoinScreen from "@/components/JoinScreen";
import ChatRoom from "@/components/ChatRoom";
import GroupDialog from "@/components/GroupDialog";

export default function App() {
  const chat = useChat();
  if (chat.booting) return null;
  if (!chat.me) return <JoinScreen onJoin={chat.login} error={chat.error} />;
  if (!chat.group) return <GroupDialog chat={chat} />;
  return <ChatRoom key={chat.group.id} chat={chat} />;
}