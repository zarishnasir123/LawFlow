// clientMockData.ts
import type { ChatMessage, ClientChatThread } from "../../../types/chat";

export const mockClientThreads: ClientChatThread[] = [
  {
    id: "t-1",
    lawyer: { id: "l-1", name: "Ayesha Khan", initials: "A", status: "online" },
    caseId: "LC-2024-0156",
    tags: ["Property Dispute", "Urgent"],
    lastMessage: "Please send the documents.",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    unreadCount: 2,
  },
  {
    id: "t-2",
    lawyer: { id: "l-2", name: "Bilal Ahmed", initials: "B", status: "offline" },
    caseId: "LC-2024-0142",
    tags: ["Child Custody"],
    lastMessage: "Next hearing is on Jan 28th.",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    unreadCount: 0,
  },
  {
    id: "t-3",
    lawyer: { id: "l-3", name: "Fatima Noor", initials: "F", status: "online" },
    caseId: "LC-2024-0138",
    tags: ["Document Review"],
    lastMessage: "Please review the documents before signing.",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    unreadCount: 1,
  },
];

// Key: threadId -> messages
export const mockClientMessages: Record<string, ChatMessage[]> = {
  "t-1": [
    {
      id: "m-1",
      threadId: "t-1",
      sender: "client",
      text: "Hello, I have uploaded the documents.",
      createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    },
    {
      id: "m-2",
      threadId: "t-1",
      sender: "lawyer",
      text: "Thanks! I will review them today.",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ],
  "t-2": [
    {
      id: "m-1",
      threadId: "t-2",
      sender: "client",
      text: "Can you tell me the date of the next hearing?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: "m-2",
      threadId: "t-2",
      sender: "lawyer",
      text: "Next hearing is scheduled on Jan 28th at 10 AM.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ],
  "t-3": [
    {
      id: "m-1",
      threadId: "t-3",
      sender: "lawyer",
      text: "Please review the documents before signing.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
};
