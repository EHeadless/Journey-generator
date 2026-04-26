'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, Loader2, Lock, Check } from 'lucide-react';
import { useStore } from '@/lib/store';
import { AppHeader } from '@/components/AppHeader';
import {
  CaptureWorkshopCard,
  useHydratedCaptureStore,
} from '@/components/capture/CaptureWorkshopCard';
import { useHasDiagnostics } from '@/lib/captureStore';
import { BulkZipUpload } from '@/components/capture/BulkZipUpload';
import { SignalReview } from '@/components/capture/SignalReview';
import { QuestionAnswerReview } from '@/components/capture/QuestionAnswerReview';
import { useUnsavedWorkWarning } from '@/lib/hooks/useUnsavedWorkWarning';
import { useApiKey } from '@/lib/hooks/useApiKey';
import {
  generateAndDownloadSyntheticTranscripts,
  type SyntheticProgress,
} from '@/lib/synthetic-transcript-export';

/**
 * Capture flow tabs, in dependency order:
 *   1. capture   — upload workshop transcripts/notes
 *   2. questions — confirm or edit Q&A backfilled from transcripts
 *   3. review    — review extracted findings (problems/needs/opps/gaps)
 *
 * Tab 3 is hard-gated until the user has explicitly confirmed (or
 * skipped) the Q&A on tab 2. The reason: edits to Q&A change what
 * downstream extraction would produce, so it's misleading to let users
 * curate signals against a still-mutable Q&A set.
 *
 * Problem Diagnostics is now its own top-level step in the header
 * (after Capture, before Definition). The Review tab points users to
 * it once findings are accepted.
 */
type CaptureTab = 'capture' | 'questions' | 'review';

const TAB_ORDER: CaptureTab[] = ['capture', 'questions', 'review'];

const TAB_LABELS: Record<CaptureTab, string> = {
  capture: 'Capture',
  questions: 'Q&A',
  review: 'Review Findings',
};

export default function CapturePage() {
  const params = useParams();
  const router = useRouter();
  const model = useStore((s) => s.model);
  const [activeTab, setActiveTab] = useState<CaptureTab>('capture');

  useUnsavedWorkWarning();
  useHydratedCaptureStore((params.id as string) || '');
  const hasDiagnostics = useHasDiagnostics((params.id as string) || '');

  useEffect(() => {
    if (!model || model.id !== params.id) {
      router.push('/');
    }
  }, [model, params.id, router]);

  const [apiKey] = useApiKey();

  const [syntheticBusy, setSyntheticBusy] = useState(false);
  const [syntheticProgress, setSyntheticProgress] = useState<SyntheticProgress | null>(null);

  if (!model) return null;

  // Q&A gate: Review and Diagnostics both unlock after explicit
  // Confirm or Skip on tab 2.
  const qaResolved = !!(model.qaConfirmedAt || model.qaSkippedAt);
  const qaConfirmed = !!model.qaConfirmedAt;
  const qaSkipped = !!model.qaSkippedAt;
  const isTabLocked = (t: CaptureTab) => t === 'review' && !qaResolved;

  // Get all Discovery workshops
  const discoveryWorkshops = (model.workshops || [])
    .filter((w) => w.phase === 'Discovery')
    .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const handleGenerateSynthetic = async () => {
    if (!apiKey.trim()) {
      alert('Add your OpenAI API key in the header before generating synthetic transcripts.');
      return;
    }
    if (discoveryWorkshops.length === 0) {
      alert('No Discovery workshops defined yet. Add workshops in Discovery first.');
      return;
    }
    if (syntheticBusy) return;

    setSyntheticBusy(true);
    setSyntheticProgress(null);
    try {
      const result = await generateAndDownloadSyntheticTranscripts({
        apiKey,
        workshops: discoveryWorkshops,
        workshopQuestions: model.workshopQuestions || [],
        brief: model.input,
        onProgress: (p) => setSyntheticProgress(p),
        zipName: `synthetic-workshops_${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19)}.zip`,
      });
      if (result.failureCount > 0) {
        alert(
          `Generated ${result.successCount}/${result.successCount + result.failureCount} transcripts. ${result.failureCount} failed:\n\n` +
            result.failures.map((f) => `• ${f.workshop}: ${f.error}`).join('\n')
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to generate synthetic transcripts: ${msg}`);
    } finally {
      setSyntheticBusy(false);
      setSyntheticProgress(null);
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      {/* App Header */}
      <div className="sticky top-0 z-50">
        <AppHeader
          modelId={model.id}
          signalsCount={model.signals?.length || 0}
          hasDiscoveryBundle={!!model.discoveryBundle}
          hasJourneyPhases={model.journeyPhases.length > 0}
          hasDiagnostics={hasDiagnostics}
          currentStep="capture"
        />
      </div>

      {/* Folder Tabs — numbered to make the order obvious */}
      <div
        className="flex items-center gap-1 px-8 pt-6 pb-0 border-b overflow-x-auto scrollbar-hide"
        style={{ borderColor: 'var(--border-1)' }}
      >
        {TAB_ORDER.map((t, idx) => {
          const locked = isTabLocked(t);
          const active = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => {
                if (locked) return;
                setActiveTab(t);
              }}
              disabled={locked}
              className={`relative px-6 py-3 rounded-t-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                active ? '' : 'opacity-60 hover:opacity-80'
              } ${locked ? 'cursor-not-allowed' : ''}`}
              style={{
                background: active ? 'var(--bg-1)' : 'transparent',
                color: 'var(--fg-1)',
                borderBottom: active ? '2px solid var(--accent)' : 'none',
                opacity: locked ? 0.4 : active ? 1 : 0.6,
              }}
              title={
                locked
                  ? 'Confirm or skip Q&A first to unlock this step'
                  : undefined
              }
            >
              <span style={{ color: 'var(--fg-3)' }}>{idx + 1}.</span>
              {TAB_LABELS[t]}
              {locked && <Lock size={12} style={{ color: 'var(--fg-3)' }} />}
              {t === 'questions' && qaConfirmed && (
                <Check size={12} style={{ color: 'var(--success)' }} />
              )}
              {t === 'questions' && qaSkipped && (
                <span className="text-[10px] uppercase" style={{ color: 'var(--fg-3)' }}>
                  skipped
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'capture' && (
          <div className="max-w-6xl mx-auto px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold" style={{ color: 'var(--fg-1)' }}>
                  1. Upload Workshop Materials
                </h1>
                <button
                  type="button"
                  onClick={handleGenerateSynthetic}
                  disabled={
                    syntheticBusy ||
                    !apiKey.trim() ||
                    discoveryWorkshops.length === 0
                  }
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-opacity"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    opacity:
                      syntheticBusy ||
                      !apiKey.trim() ||
                      discoveryWorkshops.length === 0
                        ? 0.4
                        : 1,
                    cursor:
                      syntheticBusy ||
                      !apiKey.trim() ||
                      discoveryWorkshops.length === 0
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                  title={
                    !apiKey.trim()
                      ? 'Add an OpenAI API key in the header first'
                      : discoveryWorkshops.length === 0
                        ? 'No Discovery workshops defined yet'
                        : 'Generate synthetic transcripts for every Discovery workshop and download as a zip of PDFs'
                  }
                  aria-label="Generate synthetic transcripts"
                >
                  {syntheticBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
                Upload transcript and notes for each Discovery workshop below. Both files are optional but recommended for complete evidence capture.
              </p>
              {syntheticBusy && syntheticProgress && (
                <p className="text-xs mt-2" style={{ color: 'var(--fg-3)' }}>
                  {syntheticProgress.status === 'generating'
                    ? 'Generating'
                    : syntheticProgress.status === 'rendering'
                      ? 'Rendering PDF'
                      : syntheticProgress.status}{' '}
                  ({syntheticProgress.index + 1}/{syntheticProgress.total}):{' '}
                  {syntheticProgress.workshopLabel}
                  {syntheticProgress.message ? ` — ${syntheticProgress.message}` : ''}
                </p>
              )}
            </div>

            {/* Bulk zip upload — fuzzy-matches files to workshops */}
            {discoveryWorkshops.length > 0 && (
              <BulkZipUpload
                modelId={model.id}
                workshops={discoveryWorkshops}
                apiKey={apiKey}
              />
            )}

            {/* Workshop List */}
            {discoveryWorkshops.length === 0 ? (
              <div
                className="text-center py-16 rounded-lg border"
                style={{
                  background: 'var(--bg-1)',
                  borderColor: 'var(--border-1)',
                  color: 'var(--fg-3)',
                }}
              >
                <p className="text-sm">No Discovery workshops found. Create workshops in the Discovery step first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {discoveryWorkshops.map((workshop) => (
                  <CaptureWorkshopCard
                    key={workshop.id}
                    workshop={workshop}
                    modelId={model.id}
                    apiKey={apiKey}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--fg-1)' }}>
                2. Confirm Q&A
              </h1>
              <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
                Review the answers extracted from your workshop transcripts. Edit
                any that are wrong, then Confirm — this unlocks Findings and
                Diagnostics. If you don&apos;t need Q&A for this engagement, Skip
                instead.
              </p>
            </div>
            <QuestionAnswerReview modelId={model.id} />
          </div>
        )}

        {activeTab === 'review' && (
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--fg-1)' }}>
                3. Review Findings
              </h1>
              <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
                Accept, edit, or reject the problems, needs, opportunities, and
                gaps extracted from your transcripts. When you&apos;re done,
                continue to the <strong>Problem Diagnostics</strong> step in
                the header — duplicates are merged and the report builds
                automatically on arrival.
              </p>
            </div>
            <SignalReview modelId={model.id} apiKey={apiKey} />
          </div>
        )}
      </div>
    </div>
  );
}
