import { createFileRoute } from "@tanstack/react-router";
import { FileText, Image, MessageCircle, Paperclip, Send, X, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Attachment = { name: string; mimeType: string; content: string };
type Contact = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  classes: { subject: string; grade: string }[];
};
type ChatMessage = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  attachments: Attachment[];
  createdAt: string;
};
export const Route = createFileRoute("/dashboard/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Search params arrive as strings when a conversation link is opened directly.
    // Accept both forms so the "Message student" action always selects its contact.
    contactId:
      typeof search.contactId === "number"
        ? search.contactId
        : typeof search.contactId === "string" && Number.isSafeInteger(Number(search.contactId))
          ? Number(search.contactId)
          : undefined,
  }),
  component: MessagesPage,
  head: () => ({ meta: [{ title: "Messages | Elimusphere" }] }),
});

function MessagesPage() {
  const initial = Route.useSearch().contactId;
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<number | undefined>(initial);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/chat/contacts", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([me, data]) => {
        setUser(me?.user ?? null);
        const next: Contact[] = Array.isArray(data?.contacts) ? data.contacts : [];
        setContacts(next);
        setContactId((current) =>
          current && next.some((c) => c.id === current) ? current : next[0]?.id,
        );
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!contactId) return;
    let stopped = false;
    const load = () =>
      fetch(`/api/chat/messages?contactId=${contactId}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!stopped) {
            setMessages(Array.isArray(data?.messages) ? data.messages : []);
            window.dispatchEvent(new Event("tusome:messages-read"));
          }
        });
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [contactId]);
  const selected = contacts.find((contact) => contact.id === contactId);
  const filteredContacts = contacts.filter(
    (contact) =>
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.classes.some((c) => c.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const acceptedTypes = new Set([
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    const allowed = Array.from(files)
      .slice(0, 3 - attachments.length)
      .filter(
        (file) =>
          file.size <= 4 * 1024 * 1024 &&
          (acceptedImageTypes.has(file.type) || acceptedTypes.has(file.type)),
      );
    if (allowed.length !== files.length)
      toast.error(
        "Attach up to 3 images or documents (PDF, Word, Excel, PowerPoint, TXT or CSV), each under 4 MB.",
      );
    const next = await Promise.all(
      allowed.map(
        (file) =>
          new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                content: String(reader.result),
              });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    );
    setAttachments((current) => [...current, ...next]);
  }
  async function send() {
    if (!contactId || (!text.trim() && !attachments.length) || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId: contactId, body: text, attachments }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.message || "Message could not be sent.");
        return;
      }
      setMessages((current) => [...current, payload.message]);
      setText("");
      setAttachments([]);
    } catch {
      toast.error("Message could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading messages…
      </main>
    );
  if (!user || (user.role !== "tutor" && user.role !== "learner"))
    return (
      <main className="grid min-h-screen place-items-center">
        Sign in as a tutor or learner to use messages.
      </main>
    );
  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="border-b pb-5 sm:pb-8">
          <p className="text-sm font-medium text-primary">Learning support</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Messages</h1>
          <p className="mt-3 hidden text-muted-foreground sm:block">
            Ask a question, share a photo or document, and get a reply from your class{" "}
            {user.role === "tutor" ? "learners" : "tutor"}.
          </p>
        </section>
        {contacts.length ? (
          <section className="mt-5 grid min-h-[calc(100dvh-12rem)] overflow-hidden rounded-2xl border bg-card shadow-sm md:mt-8 md:min-h-[580px] md:grid-cols-[280px_1fr]">
            <aside className="flex flex-col overflow-hidden border-b bg-muted/30 md:border-b-0 md:border-r">
              <div className="hidden p-3 md:block">
                <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversations
                </p>
              </div>
              <div className="hidden px-3 pb-2 md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-x-auto md:overflow-y-auto">
                <div className="flex gap-2 p-2 md:block md:space-y-1">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => setContactId(contact.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg p-2 text-left md:w-full md:gap-3 md:p-2.5 ${
                        contact.id === contactId
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold md:h-10 md:w-10 ${
                          contact.id === contactId
                            ? "bg-primary-foreground/20"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {getInitials(contact.firstName, contact.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium md:text-base">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p
                          className={`truncate text-xs md:text-xs ${
                            contact.id === contactId
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          }`}
                        >
                          {contact.classes.map((item) => item.subject).join(", ")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            <div className="flex min-h-0 flex-col">
              <header className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <p className="font-semibold">
                  {selected?.firstName} {selected?.lastName}
                </p>
                <p className="text-xs capitalize text-muted-foreground">{selected?.role}</p>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/10 p-3 sm:space-y-4 sm:p-5">
                {messages.length ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === user.id ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.senderId === user.id ? "bg-primary text-primary-foreground" : "bg-background shadow-sm"}`}
                      >
                        {message.body ? (
                          <p className="whitespace-pre-wrap">{message.body}</p>
                        ) : null}
                        {message.attachments.map((file) => (
                          <a
                            key={file.name}
                            href={file.content}
                            download={file.name}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-2 flex items-center gap-2 rounded-lg p-2 ${message.senderId === user.id ? "bg-primary-foreground/15" : "bg-muted"}`}
                          >
                            {file.mimeType.startsWith("image/") ? (
                              <Image className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            <span className="truncate">{file.name}</span>
                          </a>
                        ))}
                        <p
                          className={`mt-2 text-[10px] ${message.senderId === user.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid h-full place-items-center text-center text-muted-foreground">
                    <div>
                      <MessageCircle className="mx-auto h-7 w-7 text-primary" />
                      <p className="mt-3 text-sm">Start the conversation.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t p-3 sm:p-4">
                {attachments.length ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <span
                        key={`${file.name}-${index}`}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                      >
                        {file.name}
                        <button
                          onClick={() =>
                            setAttachments((current) => current.filter((_, i) => i !== index))
                          }
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx"
                    multiple
                    className="hidden"
                    onChange={(event) => void addFiles(event.target.files)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach a photo or document"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Write a message…"
                    className="min-h-11 resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={() => void send()}
                    disabled={sending}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
                  Enter to send · Shift + Enter for a new line · Photos and documents up to 4 MB
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-dashed bg-card p-10 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">No conversations available</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A chat opens when a learner registers for a tutor’s class.
            </p>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
