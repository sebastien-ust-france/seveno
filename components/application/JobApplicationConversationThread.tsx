'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { getJobApplicationConversationClient, markJobApplicationConversationReadClient, sendJobApplicationConversationMessageClient } from '@/lib/seveno-job-applications';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import type {
  JobApplicationConversationStatus,
  JobApplicationStatus,
  SerializedCandidateJobApplication,
  SerializedJobApplicationConversationMessage,
} from '@/types/seveno-job-applications';

type JobApplicationConversationThreadProps = {
  authUser: User;
  applicationId: string;
  applicationStatus: JobApplicationStatus;
  conversationStatus: JobApplicationConversationStatus | null;
  className?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  readonlyMode?: boolean;
  onApplicationChange?: (application: SerializedCandidateJobApplication) => void;
};

function formatMessageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function JobApplicationConversationThread({
  authUser,
  applicationId,
  applicationStatus,
  conversationStatus,
  className,
  title = 'Conversation sécurisée',
  description = 'Échangez uniquement après ouverture explicite de la relation.',
  emptyMessage = 'Aucun message pour le moment.',
  readonlyMode = false,
  onApplicationChange,
}: JobApplicationConversationThreadProps) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SerializedJobApplicationConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = conversationStatus === 'open';
  const canReply = isOpen && !readonlyMode && applicationStatus !== 'closed';
  const conversationMessages = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    let active = true;

    async function loadConversation() {
      if (!isOpen) {
        setLoading(false);
        setMessages([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await getJobApplicationConversationClient(authUser, applicationId);
        if (!active) {
          return;
        }

        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        onApplicationChange?.(payload.application);

        try {
          const readPayload = await markJobApplicationConversationReadClient(authUser, applicationId);
          if (active) {
            onApplicationChange?.(readPayload.application);
          }
        } catch {
          // Acknowledging read state is best-effort.
        }
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'La conversation n a pas pu etre chargee.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadConversation();

    return () => {
      active = false;
    };
  }, [applicationId, applicationStatus, authUser, isOpen, onApplicationChange]);

  const messageCountLabel = useMemo(() => {
    if (!isOpen) {
      return 'Conversation fermée';
    }

    return conversationMessages.length > 0 ? `${conversationMessages.length} message(s)` : 'Aucun message';
  }, [conversationMessages.length, isOpen]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReply || !draft.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const payload = await sendJobApplicationConversationMessageClient(authUser, applicationId, draft.trim());
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      onApplicationChange?.(payload.application);
      setDraft('');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le message n a pas pu etre envoye.');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) {
    return (
      <SevenoPanel tone="neutral" className={className ?? 'p-5'}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{title}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{messageCountLabel}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
        <p className="mt-4 text-sm text-slate-400">{emptyMessage}</p>
      </SevenoPanel>
    );
  }

  return (
    <SevenoPanel tone="neutral" className={className ?? 'p-5'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{title}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{messageCountLabel}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
          {readonlyMode ? 'Lecture seule' : 'Dialogue privé'}
        </p>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">Chargement de la conversation...</p>
      ) : error ? (
        <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {conversationMessages.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
              {emptyMessage}
            </p>
          ) : (
            conversationMessages.map((message) => {
              const isOwnMessage = message.senderUid === authUser.uid;
              return (
                <article
                  key={message.id}
                  className={
                    'max-w-[88%] rounded-[22px] border px-4 py-3 text-sm leading-7 ' +
                    (isOwnMessage
                      ? 'ml-auto border-cyan-300/20 bg-cyan-400/10 text-cyan-50'
                      : 'border-white/10 bg-white/5 text-slate-100')
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em]">
                    <span className={isOwnMessage ? 'text-cyan-100' : 'text-slate-400'}>
                      {isOwnMessage ? 'Vous' : message.senderRole === 'company' ? 'Entreprise' : 'Candidat'}
                    </span>
                    <span className={isOwnMessage ? 'text-cyan-100/70' : 'text-slate-500'}>
                      {formatMessageDate(message.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap">{message.body}</p>
                </article>
              );
            })
          )}
        </div>
      )}

      {canReply ? (
        <form className="mt-5 space-y-3" onSubmit={(event) => void handleSend(event)}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Écrire un message..."
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Envoi...' : 'Envoyer'}
            </button>
            <p className="text-sm text-slate-400">
              Les coordonnées restent masquées tant que la mise en relation n a pas été acceptée.
            </p>
          </div>
        </form>
      ) : null}
    </SevenoPanel>
  );
}
