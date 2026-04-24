"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import StreamerInfo from "@/components/StreamerInfo";

interface Suggestion {
  id: string;
  label: string;
  content: string;
  faqId?: string;
  faqQuestion?: string;
  feedback?: { action: string } | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTone, setSelectedTone] = useState<string>("natural");
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [shownFaqIds, setShownFaqIds] = useState<Set<string>>(new Set());
  // Track selected suggestion for tone re-polish
  const [selectedInfo, setSelectedInfo] = useState<{
    suggestionId: string;
    messageId: string;
  } | null>(null);
  const [streamerInfo, setStreamerInfo] = useState<Record<string, string> | null>(null);

  const tones = [
    { value: "natural", label: "自然" },
    { value: "lively", label: "活泼" },
    { value: "cute", label: "可爱" },
    { value: "professional", label: "专业" },
    { value: "gentle", label: "温柔" },
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, suggestions, scrollToBottom]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetch("/api/conversations")
        .then((r) => r.json())
        .then((data) => setConversations(data.conversations || []))
        .catch(console.error);
    }
  }, [user]);

  const loadConversation = async (id: string) => {
    setCurrentConversationId(id);
    setSuggestions([]);
    setSelectedInfo(null);
    setShownFaqIds(new Set());

    // Load streamer info
    fetch(`/api/conversations/streamer?conversationId=${id}`)
      .then((r) => r.json())
      .then((data) => setStreamerInfo(data.streamerInfo || null))
      .catch(() => setStreamerInfo(null));

    const res = await fetch(`/api/conversations?id=${id}`);
    const data = await res.json();
    if (data.conversation) {
      setMessages(
        (data.conversation.messages || []).filter(
          (m: { role: string }) => m.role === "user" || m.role === "assistant"
        )
      );
    }
  };

  const newConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setSuggestions([]);
    setReasoning("");
    setInput("");
    setSelectedInfo(null);
    setShownFaqIds(new Set());
    setStreamerInfo(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || submitting) return;

    const content = input.trim();
    setInput("");
    setSubmitting(true);
    setSuggestions([]);
    setSelectedInfo(null);
    setShownFaqIds(new Set());

    const tempId = "temp-" + Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: "user", content }]);

    try {
      const res = await fetch("/api/chat/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId: currentConversationId }),
      });

      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();

      setCurrentConversationId(data.conversationId);
      setSuggestions(data.suggestions || []);
      setReasoning(data.reasoning || "");

      // Load streamer info for new conversation
      if (!currentConversationId && data.conversationId) {
        fetch(`/api/conversations/streamer?conversationId=${data.conversationId}`)
          .then((r) => r.json())
          .then((d) => setStreamerInfo(d.streamerInfo || null))
          .catch(() => {});
      }

      // Track shown FAQ IDs
      const ids = new Set<string>();
      for (const s of data.suggestions || []) {
        if (s.faqId) ids.add(s.faqId);
      }
      setShownFaqIds(ids);

      fetch("/api/conversations")
        .then((r) => r.json())
        .then((d) => setConversations(d.conversations || []))
        .catch(console.error);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  // Called when user clicks the copy/select button
  const selectSuggestion = async (s: Suggestion) => {
    // Mark as selected
    setSuggestions((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, feedback: { action: "selected" } } : x))
    );

    let finalContent = s.content;

    // Polish if tone is not natural
    if (selectedTone !== "natural") {
      setPolishingId(s.id);
      try {
        const res = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: s.content,
            tone: selectedTone,
            streamerInfo,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          finalContent = data.polished || s.content;
        }
      } catch (err) {
        console.error("Polishing error:", err);
      } finally {
        setPolishingId(null);
      }
    }

    // Add as assistant message
    const msgId = "resp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "assistant", content: finalContent },
    ]);
    setSelectedInfo({ suggestionId: s.id, messageId: msgId });

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(finalContent);
      setTimeout(() => setCopiedId(s.id), 0);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = finalContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setTimeout(() => setCopiedId(s.id), 0);
      setTimeout(() => setCopiedId(null), 2000);
    }

    // Send feedback + boost weight
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: s.id, action: "selected", faqId: s.faqId }),
      });
    } catch (err) {
      console.error(err);
    }

    // Save assistant message to conversation history
    if (currentConversationId) {
      try {
        await fetch("/api/conversations/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: currentConversationId,
            role: "assistant",
            content: finalContent,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Re-polish when tone changes after selection
  useEffect(() => {
    if (!selectedInfo || selectedTone === "natural") return;

    const s = suggestions.find((x) => x.id === selectedInfo.suggestionId);
    if (!s || s.feedback?.action !== "selected") return;

    const doRepolish = async () => {
      setPolishingId(selectedInfo.suggestionId);
      try {
        const res = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: s.content,
            tone: selectedTone,
            streamerInfo,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const polished = data.polished || s.content;
          // Update the chat bubble
          setMessages((prev) =>
            prev.map((m) =>
              m.id === selectedInfo.messageId ? { ...m, content: polished } : m
            )
          );
        }
      } catch (err) {
        console.error("Re-polish error:", err);
      } finally {
        setPolishingId(null);
      }
    };

    doRepolish();
  }, [selectedTone, streamerInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const rejectSuggestion = async (s: Suggestion) => {
    setSuggestions((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, feedback: { action: "rejected" } } : x))
    );
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: s.id, action: "rejected" }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const refreshSuggestions = async () => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Mark all un-feedbacked suggestions as refresh
    for (const s of suggestions) {
      if (!s.feedback) {
        try {
          await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suggestionId: s.id, action: "refresh" }),
          });
        } catch {}
      }
    }

    setSuggestions([]);
    setSubmitting(true);
    setSelectedInfo(null);

    try {
      const excludeIds = Array.from(shownFaqIds);
      const res = await fetch("/api/chat/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: lastUserMsg.content,
          conversationId: currentConversationId,
          excludeIds,
        }),
      });
      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();

      setSuggestions(data.suggestions || []);
      setReasoning(data.reasoning || "");

      // Accumulate shown FAQ IDs
      if (data.suggestions) {
        setShownFaqIds((prev) => {
          const next = new Set(prev);
          for (const s of data.suggestions) {
            if (s.faqId) next.add(s.faqId);
          }
          return next;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
    if (currentConversationId === id) newConversation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={newConversation}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建对话
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div key={conv.id} className="group relative">
              <button
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentConversationId === conv.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100"
                } truncate`}
              >
                {conv.title || "新对话"}
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Welcome */}
          {messages.length === 0 && suggestions.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">欢迎使用直播公会助手</h2>
                <p className="text-gray-500">在下方输入对方主播的消息，系统会自动为您匹配最合适的FAQ话术建议。</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="text-xs text-gray-400 mb-1 ml-1">
                  {msg.role === "user" ? "对方主播" : "回复建议"}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "assistant"
                      ? "bg-indigo-50 border border-indigo-100 text-gray-900"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="animate-fade-in">
              {/* Reasoning + refresh */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{reasoning}</p>
                <button
                  onClick={refreshSuggestions}
                  disabled={submitting}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  换一批
                </button>
              </div>

              {/* Tone selector */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">语气:</span>
                {tones.map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => {
                      setSelectedTone(tone.value);
                      // Also set copied timeout marker
                    }}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      selectedTone === tone.value
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>

              {/* Suggestion cards */}
              <div className="space-y-3">
                {suggestions.map((s) => {
                  const isSelected = s.feedback?.action === "selected";
                  const isRejected = s.feedback?.action === "rejected";
                  const isPolishing = polishingId === s.id;
                  const isCopyTarget = copiedId === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? "border-indigo-300 bg-indigo-50"
                          : isRejected
                          ? "border-gray-200 bg-gray-50 opacity-60"
                          : "border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30"
                      }`}
                    >
                      {/* Row 1: Label + Content + Copy button */}
                      <div className="flex items-start gap-3 p-4 pb-2">
                        {/* Label badge */}
                        <span
                          className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-0.5 ${
                            s.label === "A"
                              ? "bg-green-100 text-green-700"
                              : s.label === "B"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {s.label}
                        </span>

                        {/* Content + match info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.content}</p>
                          {s.faqQuestion && (
                            <p className="text-xs text-gray-400 mt-1">FAQ: {s.faqQuestion}</p>
                          )}
                        </div>

                        {/* Copy button on the right */}
                        {isSelected ? (
                          <button
                            disabled
                            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-indigo-100 text-indigo-600 cursor-default"
                          >
                            <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            已复制
                          </button>
                        ) : isPolishing ? (
                          <button
                            disabled
                            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-400 cursor-wait"
                          >
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full inline mr-1" />
                            润色中
                          </button>
                        ) : (
                          <button
                            onClick={() => selectSuggestion(s)}
                            disabled={isRejected}
                            className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                              selectedTone !== "natural"
                                ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            复制
                          </button>
                        )}
                      </div>

                      {/* Row 2: Polish preview (when tone is selected and suggestion is selected) */}
                      {isSelected && selectedTone !== "natural" && (
                        <div className="px-4 pb-3 ml-10">
                          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs font-medium text-amber-600">
                                {tones.find((t) => t.value === selectedTone)?.label}
                              </span>
                              {isPolishing && (
                                <div className="animate-spin h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">
                              {isPolishing ? "润色中..." : messages.find((m) => m.id === selectedInfo?.messageId)?.content || s.content}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Reject button row */}
                      {!isSelected && !isRejected && (
                        <div className="px-4 pb-3 flex justify-end">
                          <button
                            onClick={() => rejectSuggestion(s)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                            title="不推荐"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            不推荐
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading */}
          {submitting && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-gray-500">正在匹配话术...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="粘贴对方主播的消息，获取匹配的话术建议..."
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || submitting}
              className="self-end px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {submitting ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Streamer info panel (right side) */}
      <aside className="w-64 flex-shrink-0 hidden lg:flex flex-col border-l border-gray-200 bg-white">
        <StreamerInfo conversationId={currentConversationId} />
      </aside>
    </div>
  );
}
