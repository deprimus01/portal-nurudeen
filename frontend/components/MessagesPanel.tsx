'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessageSquarePlus, Search, Send, Sparkles, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Contact, Conversation, Message } from '../lib/types';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '../lib/i18n/language-context';

const EASE = [0.16, 1, 0.3, 1] as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MessagesPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [drafting, setDrafting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // PRD Phase 7 — "Teacher message-drafting assistant." Scoped to teachers
  // in the UI since that's the feature as spec'd; the backend also allows
  // Admin, but the entry point here stays teacher-only to match.
  const canDraftWithAi = user?.role === 'TEACHER';

  async function loadConversations() {
    setLoadingList(true);
    try {
      const data = await api.get<Conversation[]>('/api/messages/conversations');
      data.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setConversations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadContacts() {
    try {
      const data = await api.get<Contact[]>('/api/messages/contacts');
      setContacts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts.');
    }
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openThread(userId: string, name: string) {
    setSelected({ userId, name });
    setShowContacts(false);
    setLoadingThread(true);
    setError(null);
    setShowAiPrompt(false);
    setAiInstruction('');
    try {
      const data = await api.get<Message[]>(`/api/messages/thread/${userId}`);
      setMessages(data);
      setConversations((prev) => prev.map((c) => (c.userId === userId ? { ...c, unreadCount: 0 } : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load conversation.');
    } finally {
      setLoadingThread(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.post<Message>('/api/messages', {
        recipientUserId: selected.userId,
        body: draft.trim(),
      });
      setMessages((prev) => [...prev, message]);
      setDraft('');
      await loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleAiDraft(e: FormEvent) {
    e.preventDefault();
    if (!selected || !aiInstruction.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const result = await api.post<{ draft: string }>('/api/ai/message-draft', {
        recipientUserId: selected.userId,
        instruction: aiInstruction.trim(),
      });
      setDraft(result.draft);
      setShowAiPrompt(false);
      setAiInstruction('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate a draft.');
    } finally {
      setDrafting(false);
    }
  }

  const filteredConversations = search.trim()
    ? conversations.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.messages.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>Direct messages with staff and parents.</p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setShowContacts((v) => !v);
            if (!contacts.length) loadContacts();
          }}
        >
          {showContacts ? <X size={15} /> : <MessageSquarePlus size={15} />}
          {showContacts ? t('common.cancel') : t('pages.messages.newButton')}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className={`msg-shell${selected ? ' thread-open' : ''}`}>
        <div className="conv-list">
          <div className="conv-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
            />
          </div>

          <div className="conv-scroll">
            {showContacts ? (
              contacts.length === 0 ? (
                <EmptyState icon={MessageSquarePlus} title="No contacts available" />
              ) : (
                contacts.map((c) => (
                  <button key={c.userId} onClick={() => openThread(c.userId, c.name)} className="conv-item">
                    <div className="shell-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                      {initialsFor(c.name)}
                    </div>
                    <div className="conv-text">
                      <div className="cn">{c.name}</div>
                      <div className="cm">{c.subtitle}</div>
                    </div>
                  </button>
                ))
              )
            ) : loadingList ? (
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10 }} />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={MessageSquarePlus}
                title="No conversations yet"
                description='Start one with "New Message".'
              />
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.userId}
                  onClick={() => openThread(c.userId, c.name)}
                  className={`conv-item${selected?.userId === c.userId ? ' active' : ''}`}
                >
                  <div className="shell-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                    {initialsFor(c.name)}
                  </div>
                  <div className="conv-text">
                    <div className="cn">{c.name}</div>
                    <div className="cm">{c.lastMessage}</div>
                  </div>
                  {c.unreadCount > 0 && <span className="unread-dot" />}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="chat-area">
          {!selected ? (
            <div style={{ margin: 'auto' }}>
              <EmptyState icon={MessageSquarePlus} title="Select a conversation" description="Choose a thread from the left to view messages." />
            </div>
          ) : (
            <>
              <div className="chat-head">
                <button className="chat-back" onClick={() => setSelected(null)} aria-label="Back to conversations">
                  <ArrowLeft size={18} />
                </button>
                <div className="shell-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                  {initialsFor(selected.name)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.name}</div>
              </div>

              <div className="chat-body">
                {loadingThread ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="skeleton" style={{ height: 34, width: '55%', borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 34, width: '40%', borderRadius: 16, alignSelf: 'flex-end' }} />
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((m) => {
                      const mine = m.senderId === user?.id;
                      return (
                        <motion.div
                          key={m.id}
                          className={`bubble ${mine ? 'out' : 'in'}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                        >
                          {m.body}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={bottomRef} />
              </div>

              {canDraftWithAi && (
                <AnimatePresence initial={false}>
                  {showAiPrompt ? (
                    <motion.form
                      onSubmit={handleAiDraft}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', gap: 6, padding: '0 0.85rem', marginBottom: 6, overflow: 'hidden' }}
                    >
                      <input
                        autoFocus
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="What should the message cover? e.g. remind about outstanding fees"
                        maxLength={300}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-outline" type="submit" disabled={drafting || !aiInstruction.trim()}>
                        {drafting ? <span className="login-spinner" aria-hidden="true" /> : 'Draft'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => setShowAiPrompt(false)} aria-label="Cancel AI draft">
                        <X size={14} />
                      </button>
                    </motion.form>
                  ) : (
                    <div style={{ padding: '0 0.85rem', marginBottom: 6 }}>
                      <button type="button" className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }} onClick={() => setShowAiPrompt(true)}>
                        <Sparkles size={13} /> Draft with AI
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              )}
              <form onSubmit={handleSend} className="chat-input">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  maxLength={4000}
                />
                <button className="btn chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send">
                  <Send size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
