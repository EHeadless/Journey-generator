'use client';

/**
 * QuestionAnswerReview — review backfilled workshop-question answers.
 *
 * Groups by workshop, shows the model's proposed answer + citations,
 * lets the user Accept / Edit / Reject. Accepted answers carry an
 * "evidenced" flag that the Discovery page can pick up later.
 */

import { useState, useMemo } from 'react';
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  SkipForward,
  RotateCcw,
} from 'lucide-react';
import { useCaptureStore } from '@/lib/captureStore';
import { useStore } from '@/lib/store';
import { ConfidenceLegend } from './ConfidenceLegend';
import type { QuestionAnswer, WorkshopQuestion } from '@/lib/types';

interface Props {
  modelId: string;
}

export function QuestionAnswerReview({ modelId }: Props) {
  const questionAnswers = useCaptureStore((s) => s.questionAnswers);
  const uploads = useCaptureStore((s) => s.uploads);
  const updateQuestionAnswer = useCaptureStore((s) => s.updateQuestionAnswer);

  // Stable selectors — defaulting outside the selector so Zustand's
  // snapshot identity check doesn't see a fresh array each render.
  const workshopsRaw = useStore((s) => s.model?.workshops);
  const workshops = useMemo(() => workshopsRaw ?? [], [workshopsRaw]);
  const workshopQuestionsRaw = useStore((s) => s.model?.workshopQuestions);
  const workshopQuestions = useMemo(
    () => workshopQuestionsRaw ?? [],
    [workshopQuestionsRaw]
  );

  // Q&A gating actions — Confirm / Skip unlock Findings + Diagnostics tabs.
  const qaConfirmedAt = useStore((s) => s.model?.qaConfirmedAt);
  const qaSkippedAt = useStore((s) => s.model?.qaSkippedAt);
  const confirmQa = useStore((s) => s.confirmQa);
  const skipQa = useStore((s) => s.skipQa);
  const resetQa = useStore((s) => s.resetQa);

  const answersForModel = useMemo(
    () => questionAnswers.filter((a) => a.modelId === modelId),
    [questionAnswers, modelId]
  );

  const questionById = useMemo(() => {
    const m = new Map<string, WorkshopQuestion>();
    for (const q of workshopQuestions) m.set(q.id, q);
    return m;
  }, [workshopQuestions]);

  const uploadById = useMemo(() => new Map(uploads.map((u) => [u.id, u])), [uploads]);

  // Group answers by workshop.
  const groupedByWorkshop = useMemo(() => {
    const by = new Map<string, QuestionAnswer[]>();
    for (const a of answersForModel) {
      const q = questionById.get(a.workshopQuestionId);
      if (!q) continue;
      const list = by.get(q.workshopId) || [];
      list.push(a);
      by.set(q.workshopId, list);
    }
    return by;
  }, [answersForModel, questionById]);

  const [openWorkshops, setOpenWorkshops] = useState<Set<string>>(
    () => new Set(workshops.map((w) => w.id))
  );

  const toggleWorkshop = (id: string) => {
    setOpenWorkshops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Header that always appears: lets the user Confirm or Skip Q&A even
  // when there are no answers yet (e.g. an engagement that doesn't use
  // workshop questions still needs to escape the gate).
  const gateHeader = (
    <GateHeader
      confirmedAt={qaConfirmedAt ?? null}
      skippedAt={qaSkippedAt ?? null}
      hasAnyAnswers={answersForModel.length > 0}
      onConfirm={confirmQa}
      onSkip={skipQa}
      onReset={resetQa}
    />
  );

  if (answersForModel.length === 0) {
    return (
      <div className="space-y-6">
        {gateHeader}
        <div
          className="text-center py-16 rounded-lg border"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)', color: 'var(--fg-3)' }}
        >
          <p className="text-sm">No backfilled answers yet. Upload a transcript against a workshop with questions to populate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gateHeader}
      <ConfidenceLegend />
      {workshops.map((w) => {
        const list = groupedByWorkshop.get(w.id);
        if (!list || list.length === 0) return null;
        const open = openWorkshops.has(w.id);
        return (
          <section
            key={w.id}
            className="rounded-lg border"
            style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}
          >
            <header
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => toggleWorkshop(w.id)}
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <h3 className="text-sm font-bold flex-1" style={{ color: 'var(--fg-1)' }}>
                {w.code ? `${w.code} · ` : ''}{w.name} · {list.length} answer{list.length > 1 ? 's' : ''}
              </h3>
            </header>
            {open && (
              <ul className="divide-y" style={{ borderColor: 'var(--border-1)' }}>
                {list.map((a) => {
                  const question = questionById.get(a.workshopQuestionId);
                  const upload = uploadById.get(a.uploadId);
                  return (
                    <AnswerRow
                      key={a.id}
                      answer={a}
                      questionText={question?.text || 'Question removed'}
                      sourceLabel={upload?.filename || 'Unknown upload'}
                      onAccept={() =>
                        updateQuestionAnswer(a.id, {
                          accepted: true,
                          reviewedAt: new Date(),
                        })
                      }
                      onReject={() =>
                        updateQuestionAnswer(a.id, {
                          accepted: false,
                          reviewedAt: new Date(),
                        })
                      }
                      onEdit={(nextText) => {
                        const trimmed = nextText.trim();
                        if (!trimmed || trimmed === a.answerText) return;
                        void updateQuestionAnswer(a.id, { answerText: trimmed });
                      }}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AnswerRow({
  answer,
  questionText,
  sourceLabel,
  onAccept,
  onReject,
  onEdit,
}: {
  answer: QuestionAnswer;
  questionText: string;
  sourceLabel: string;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (nextText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.answerText);

  const accepted = answer.accepted === true;
  const rejected = answer.accepted === false;

  const confidenceColor =
    answer.confidence === 'high'
      ? 'var(--success)'
      : answer.confidence === 'medium'
      ? 'var(--accent)'
      : 'var(--fg-3)';

  return (
    <li className="px-4 py-3">
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--fg-2)' }}>
        Q: {questionText}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onEdit(draft);
                setEditing(false);
              }}
              autoFocus
              className="w-full text-sm p-2 rounded border resize-none"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--border-1)',
                color: 'var(--fg-1)',
              }}
              rows={2}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--fg-1)' }}>
              {answer.answerText}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: 'var(--fg-3)' }}>
            <span
              className="px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: 'color-mix(in srgb, ' + confidenceColor + ' 12%, transparent)',
                color: confidenceColor,
              }}
            >
              {answer.confidence}
            </span>
            <span>· {sourceLabel}</span>
            {answer.supportingChunkIds.length > 0 && (
              <span>· {answer.supportingChunkIds.length} chunk cite{answer.supportingChunkIds.length > 1 ? 's' : ''}</span>
            )}
            {answer.confidenceReason && (
              <span className="italic truncate" title={answer.confidenceReason}>
                · {answer.confidenceReason}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            title={accepted ? 'Accepted' : 'Accept'}
            onClick={onAccept}
            active={accepted}
            activeColor="var(--success)"
          >
            <Check size={14} />
          </IconButton>
          <IconButton title="Edit" onClick={() => setEditing((v) => !v)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton
            title={rejected ? 'Rejected' : 'Reject'}
            onClick={onReject}
            active={rejected}
            activeColor="var(--danger)"
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  children,
  onClick,
  title,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded border transition-colors"
      style={{
        background: active ? activeColor : 'var(--bg-2)',
        color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
        borderColor: 'var(--border-1)',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Confirm / Skip / Reset bar for the Q&A gate.
 *
 * The user has to make an explicit choice here before Findings and
 * Diagnostics unlock. We surface the current state with copy that
 * explains *why* this gate exists (edits to Q&A change downstream
 * extraction) so it doesn't feel like an arbitrary speedbump.
 */
function GateHeader({
  confirmedAt,
  skippedAt,
  hasAnyAnswers,
  onConfirm,
  onSkip,
  onReset,
}: {
  confirmedAt: Date | null;
  skippedAt: Date | null;
  hasAnyAnswers: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onReset: () => void;
}) {
  const resolved = !!(confirmedAt || skippedAt);
  return (
    <div
      className="rounded-lg border p-4 flex items-start gap-4 flex-wrap"
      style={{
        background: resolved
          ? 'color-mix(in srgb, var(--success) 6%, var(--bg-1))'
          : 'var(--bg-1)',
        borderColor: resolved ? 'var(--success)' : 'var(--border-1)',
      }}
    >
      <div className="flex-1 min-w-[280px]">
        {confirmedAt ? (
          <div>
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              Q&A confirmed
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
              Findings and Diagnostics are unlocked. Re-open the gate if you
              want to re-run extraction after editing answers.
            </p>
          </div>
        ) : skippedAt ? (
          <div>
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--fg-1)' }}>
              <SkipForward size={16} style={{ color: 'var(--fg-2)' }} />
              Q&A skipped
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
              Findings and Diagnostics are unlocked without Q&A confirmation.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--fg-1)' }}>
              Confirm Q&A to unlock Findings and Diagnostics
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
              {hasAnyAnswers
                ? 'Edits to these answers change what extraction would produce. Confirm when you\'re happy with the set, or Skip if you don\'t need Q&A for this engagement.'
                : 'No Q&A answers yet for this model. If you don\'t plan to use Q&A, click Skip to unlock the next steps.'}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {resolved ? (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--border-1)',
              color: 'var(--fg-1)',
            }}
            title="Re-lock the gate so you can edit Q&A and re-confirm"
          >
            <RotateCcw size={14} />
            Reopen gate
          </button>
        ) : (
          <>
            <button
              onClick={onSkip}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--border-1)',
                color: 'var(--fg-1)',
              }}
            >
              <SkipForward size={14} />
              Skip
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md font-semibold"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <CheckCircle2 size={14} />
              Confirm Q&A
            </button>
          </>
        )}
      </div>
    </div>
  );
}

