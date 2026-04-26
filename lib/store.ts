import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  Model,
  ModelInput,
  Journey,
  JourneyPhase,
  DemandSpace,
  Circumstance,
  MarketingActivation,
  ProductActivation,
  ServiceActivation,
  PersonaMapping,
  DiscoveryPlan,
  Evidence,
  Signal,
  Mapping,
  Proposal,
  DiscoveryBundle,
  ConsultancyStep,
  Workshop,
  WorkshopQuestion,
  WorkshopAgendaItem,
  WorkshopAttendee,
  BriefDocument,
  ResearchDocument,
  HypothesisVariant,
  InformedLandscapeVariant,
} from './types';

/**
 * Accept either the new `{ title, names? }` shape or legacy `string[]` and
 * normalize to `WorkshopAttendee[]` with stable ids.
 */
function normalizeAttendees(
  input: unknown
): WorkshopAttendee[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item): WorkshopAttendee | null => {
      if (typeof item === 'string') {
        const title = item.trim();
        if (!title) return null;
        return { id: uuidv4(), title };
      }
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const title =
          typeof rec.title === 'string'
            ? rec.title
            : typeof rec.role === 'string'
            ? (rec.role as string)
            : '';
        if (!title.trim()) return null;
        const namesRaw = rec.names;
        const names = Array.isArray(namesRaw)
          ? (namesRaw.filter((n) => typeof n === 'string' && n.trim()) as string[])
          : undefined;
        const id =
          typeof rec.id === 'string' && rec.id ? rec.id : uuidv4();
        return {
          id,
          title: title.trim(),
          ...(names && names.length ? { names } : {}),
        };
      }
      return null;
    })
    .filter((a): a is WorkshopAttendee => a !== null);
}

/** Input shape for setWorkshops/addWorkshop — attendees without stable ids. */
type WorkshopInputAttendee = { title: string; names?: string[] };

// Revive ISO date strings back into Date objects after localStorage rehydration.
// JSON.parse turns Dates into strings; this walks the model and converts them back.
const DATE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'date',
  'approvedAt',
  'uploadedAt',
  'generatedAt',
  'summarizedAt',
  'qaConfirmedAt',
  'qaSkippedAt',
]);
function reviveDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEYS.has(k) && typeof v === 'string') {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? v : d;
      } else {
        out[k] = reviveDates(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

type DeletedItemType = 'phase' | 'demandSpace' | 'circumstance';
type DeletedItem = JourneyPhase | DemandSpace | Circumstance;

interface EIStudioState {
  // Current model
  model: Model | null;

  // Loading states
  isGeneratingPhases: boolean;
  isGeneratingDemandSpaces: Record<string, boolean>; // keyed by journeyPhaseId
  isGeneratingCrossCuttingDemandSpaces: boolean; // there is exactly one cross-cutting silo per model
  isGeneratingCircumstances: Record<string, boolean>; // keyed by demandSpaceId
  isGeneratingActivations: Record<string, boolean>; // keyed by demandSpaceId
  isGeneratingPersonaMappings: boolean;

  // Undo state
  lastDeleted: { type: DeletedItemType; item: DeletedItem } | null;

  // Actions
  createModel: (
    input: ModelInput,
    journeys?: Array<
      Pick<Journey, 'name' | 'jtbdBlueprint'> & {
        /**
         * Optional preloaded phases for this journey. When provided, the
         * store seeds `model.journeyPhases` with these entries tagged
         * `source: 'user'` so the workspace renders them immediately and
         * skips the per-journey Generate step.
         */
        phases?: Array<{
          label: string;
          description?: string;
          trigger?: string;
        }>;
      }
    >
  ) => string;

  // Journey actions (the top-level "Arrival / Transit / Departure" layer).
  // Each journey owns its own phases, demand spaces, and activations.
  setJourneys: (
    journeys: Array<Pick<Journey, 'name' | 'jtbdBlueprint'>>
  ) => void;
  addJourney: (journey?: Partial<Pick<Journey, 'name' | 'jtbdBlueprint'>>) => string;
  updateJourney: (id: string, updates: Partial<Omit<Journey, 'id' | 'order'>>) => void;
  removeJourney: (id: string) => void;

  // Journey Phase actions
  /**
   * Replace the journey-phases for a single journey. Phases for other
   * journeys in the model are preserved. The journeyId is required so
   * generation for one journey doesn't wipe another's landscape.
   */
  setJourneyPhases: (
    journeyId: string,
    phases: Omit<JourneyPhase, 'id' | 'order' | 'journeyId'>[]
  ) => void;
  updateJourneyPhase: (id: string, updates: Partial<JourneyPhase>) => void;
  deleteJourneyPhase: (id: string) => void;
  addJourneyPhase: (journeyId: string) => void;

  // Demand Space actions
  setDemandSpaces: (
    journeyPhaseId: string,
    spaces: {
      label: string;
      jobToBeDone: string;
      description?: string;
      sourceProblemIds?: string[];
    }[]
  ) => void;
  updateDemandSpace: (id: string, updates: Partial<DemandSpace>) => void;
  deleteDemandSpace: (id: string) => void;
  addDemandSpace: (journeyPhaseId: string) => void;

  /**
   * Replace the cross-cutting demand-space silo for the model. These
   * JTBDs address systemic / cross-cutting problems and don't belong to
   * any phase. Generated by `/api/generate-cross-cutting-demand-spaces`
   * on the Informed Landscape route.
   */
  setCrossCuttingDemandSpaces: (
    spaces: {
      label: string;
      jobToBeDone: string;
      description?: string;
      sourceProblemIds?: string[];
    }[]
  ) => void;
  addCrossCuttingDemandSpace: () => string;
  updateCrossCuttingDemandSpace: (
    id: string,
    updates: Partial<DemandSpace>
  ) => void;
  deleteCrossCuttingDemandSpace: (id: string) => void;
  /**
   * Create a demand space plus its 5 circumstances in a single atomic
   * update. Returns the new demand space id so callers can scroll/focus
   * it. Used by the inline "Add demand space" form.
   */
  createDemandSpaceWithCircumstances: (
    journeyPhaseId: string,
    input: {
      label: string;
      jobToBeDone: string;
      description?: string;
      circumstances: Omit<Circumstance, 'id' | 'demandSpaceId' | 'order'>[];
    }
  ) => string;

  // Circumstance actions — each demand space holds exactly 5
  setCircumstances: (
    demandSpaceId: string,
    circumstances: Omit<Circumstance, 'id' | 'demandSpaceId' | 'order'>[]
  ) => void;
  updateCircumstance: (id: string, updates: Partial<Omit<Circumstance, 'id'>>) => void;
  deleteCircumstance: (id: string) => void;
  addCircumstance: (demandSpaceId: string) => void;

  // Activation actions — DEFERRED MIGRATION
  // One activation per circumstance. Generation is disabled in the UI
  // until the activation prompts are ported from dimension values to
  // circumstances. These setters are kept so existing cards/state can
  // still be inspected and edited.
  setMarketingActivations: (demandSpaceId: string, activations: Omit<MarketingActivation, 'id' | 'demandSpaceId'>[], circumstanceIds: string[]) => void;
  setProductActivations: (demandSpaceId: string, activations: Omit<ProductActivation, 'id' | 'demandSpaceId'>[], circumstanceIds: string[]) => void;
  setServiceActivations: (demandSpaceId: string, activations: Omit<ServiceActivation, 'id' | 'demandSpaceId'>[], circumstanceIds: string[]) => void;
  updateMarketingActivation: (id: string, updates: Partial<MarketingActivation>) => void;
  updateProductActivation: (id: string, updates: Partial<ProductActivation>) => void;
  updateServiceActivation: (id: string, updates: Partial<ServiceActivation>) => void;

  // Loading state actions
  setGeneratingPhases: (loading: boolean) => void;
  setGeneratingDemandSpaces: (journeyPhaseId: string, loading: boolean) => void;
  setGeneratingCrossCuttingDemandSpaces: (loading: boolean) => void;
  setGeneratingCircumstances: (demandSpaceId: string, loading: boolean) => void;
  setGeneratingActivations: (demandSpaceId: string, loading: boolean) => void;
  setGeneratingPersonaMappings: (loading: boolean) => void;
  stopAllGeneration: () => void;

  // Persona mapping actions
  setPersonaMappings: (mappings: PersonaMapping[]) => void;

  // Discovery & Signal Mapping actions (Phase 1)
  setDiscoveryPlan: (plan: DiscoveryPlan | undefined) => void;
  updateDiscoveryPlan: (updates: Partial<DiscoveryPlan>) => void;
  addEvidence: (evidence: Omit<Evidence, 'id'>) => void;
  updateEvidence: (id: string, updates: Partial<Evidence>) => void;
  removeEvidence: (id: string) => void;
  setSignals: (signals: Signal[]) => void;
  updateSignal: (id: string, updates: Partial<Signal>) => void;
  removeSignal: (id: string) => void;
  setMappings: (mappings: Mapping[]) => void;
  setProposals: (proposals: Proposal[]) => void;
  /** Capture-flow gating actions for the Q&A confirmation step. */
  confirmQa: () => void;
  skipQa: () => void;
  resetQa: () => void;
  approveDiscoveryBundle: (bundle: Omit<DiscoveryBundle, 'approvedAt'>) => void;
  setCurrentStep: (step: ConsultancyStep) => void;
  /**
   * Wipe generated landscape content. If a journeyId is passed, only that
   * journey's phases/demand spaces/dimensions/activations are cleared;
   * otherwise the whole model's landscape is reset (used for full refine).
   */
  resetLandscapeForRegen: (journeyId?: string) => void;

  // Brief & research uploads (home page + Research step)
  setBriefDocument: (brief: BriefDocument | undefined) => void;
  clearBriefDocument: () => void;
  addResearchDocument: (doc: Omit<ResearchDocument, 'id'>) => string;
  updateResearchDocument: (
    id: string,
    updates: Partial<Omit<ResearchDocument, 'id'>>
  ) => void;
  removeResearchDocument: (id: string) => void;

  // Hypothesis landscape variants (5 side-by-side blends)
  addHypothesisVariant: (variant: Omit<HypothesisVariant, 'id'>) => string;
  updateHypothesisVariant: (
    id: string,
    updates: Partial<Omit<HypothesisVariant, 'id'>>
  ) => void;
  removeHypothesisVariant: (id: string) => void;
  /**
   * Mark one Hypothesis variant active and clear the flag on the others.
   * Mirrors the active variant's `journeyPhases` onto
   * `Model.journeyPhases` so the downstream demand-space pipeline can
   * keep using the existing field.
   *
   * BIDIRECTIONAL INVARIANT: also clears `informedVariants[].isActive`
   * on every Informed variant. Only ONE landscape (Hypothesis OR
   * Informed) is "live" at any time.
   */
  setActiveHypothesisVariant: (id: string) => void;

  // Informed Landscape variants (4 side-by-side blends, anchored on classified problems)
  addInformedVariant: (
    variant: Omit<InformedLandscapeVariant, 'id'>
  ) => string;
  updateInformedVariant: (
    id: string,
    updates: Partial<Omit<InformedLandscapeVariant, 'id'>>
  ) => void;
  removeInformedVariant: (id: string) => void;
  /**
   * Mark one Informed variant active and clear the flag on the others.
   * Mirrors the variant's `journeyPhases` to `Model.journeyPhases` and
   * WIPES the downstream cascade (demand spaces, circumstances,
   * activations) — the previous landscape's downstream content is no
   * longer valid against new phase ids.
   *
   * BIDIRECTIONAL INVARIANT: also clears `hypothesisVariants[].isActive`
   * on every Hypothesis variant. Only ONE landscape (Hypothesis OR
   * Informed) is "live" at any time.
   */
  setActiveInformedVariant: (id: string) => void;

  // Workshop inventory actions (Plan step)
  setWorkshops: (
    workshops: Array<
      Omit<
        Workshop,
        'id' | 'order' | 'agenda' | 'clientAttendees' | 'agencyAttendees'
      > & {
        agenda?: Array<Omit<WorkshopAgendaItem, 'id'>>;
        clientAttendees?: WorkshopInputAttendee[] | string[];
        agencyAttendees?: WorkshopInputAttendee[] | string[];
      }
    >
  ) => void;
  addWorkshop: (
    partial?: Partial<
      Omit<Workshop, 'id' | 'order' | 'clientAttendees' | 'agencyAttendees'>
    > & {
      clientAttendees?: WorkshopInputAttendee[] | string[];
      agencyAttendees?: WorkshopInputAttendee[] | string[];
    }
  ) => string;
  updateWorkshop: (id: string, updates: Partial<Workshop>) => void;
  removeWorkshop: (id: string) => void;
  reorderWorkshops: (orderedIds: string[]) => void;

  // Attendee actions (client and agency roles with optional names)
  addAttendee: (
    workshopId: string,
    side: 'client' | 'agency',
    partial?: Partial<Omit<WorkshopAttendee, 'id'>>
  ) => void;
  updateAttendee: (
    workshopId: string,
    side: 'client' | 'agency',
    attendeeId: string,
    updates: Partial<WorkshopAttendee>
  ) => void;
  removeAttendee: (
    workshopId: string,
    side: 'client' | 'agency',
    attendeeId: string
  ) => void;

  // Agenda items (nested on workshops)
  setWorkshopAgenda: (
    workshopId: string,
    items: Array<Omit<WorkshopAgendaItem, 'id'>>
  ) => void;
  addAgendaItem: (workshopId: string) => void;
  updateAgendaItem: (
    workshopId: string,
    itemId: string,
    updates: Partial<WorkshopAgendaItem>
  ) => void;
  removeAgendaItem: (workshopId: string, itemId: string) => void;

  // Workshop question actions
  setWorkshopQuestions: (
    workshopId: string,
    questions: Array<Omit<WorkshopQuestion, 'id' | 'workshopId' | 'order'>>
  ) => void;
  addWorkshopQuestion: (
    workshopId: string,
    partial?: Partial<Omit<WorkshopQuestion, 'id' | 'workshopId' | 'order'>>
  ) => void;
  updateWorkshopQuestion: (
    id: string,
    updates: Partial<WorkshopQuestion>
  ) => void;
  removeWorkshopQuestion: (id: string) => void;

  // Undo
  undoDelete: () => void;
  clearUndo: () => void;
}

export const useStore = create<EIStudioState>()(
  persist(
    (set, get) => ({
  model: null,
  isGeneratingPhases: false,
  isGeneratingDemandSpaces: {},
  isGeneratingCrossCuttingDemandSpaces: false,
  isGeneratingCircumstances: {},
  isGeneratingActivations: {},
  isGeneratingPersonaMappings: false,
  lastDeleted: null,

  createModel: (input, journeys) => {
    const id = uuidv4();
    // Materialize the journey list the caller provided (or a single default)
    // so the model always has at least one journey to scope content to.
    // We keep a parallel array of any preloaded phases the caller supplied
    // so we can stamp them with the matching journeyId below.
    type JourneySeed = Parameters<EIStudioState['createModel']>[1];
    const incoming: NonNullable<JourneySeed> =
      journeys && journeys.length > 0
        ? journeys
        : [{ name: 'Journey', jtbdBlueprint: '' }];
    const seedJourneys: Journey[] = incoming.map((j, i) => ({
      id: uuidv4(),
      name: (j.name || `Journey ${i + 1}`).trim(),
      jtbdBlueprint: (j.jtbdBlueprint || '').trim(),
      order: i,
    }));
    // Seed phases that the caller preloaded (e.g. the Dubai Airport
    // example's 3 journeys × ~11 phases). Order is 0-indexed within each
    // journey. Empty-name rows are dropped. Phases are tagged `source:
    // 'user'` so the UI can show a "from brief" chip and the workspace
    // knows not to auto-generate on top of them.
    const seedPhases: JourneyPhase[] = seedJourneys.flatMap((journey, jIdx) => {
      const raw = incoming[jIdx]?.phases ?? [];
      return raw
        .map((p) => ({
          label: (p.label || '').trim(),
          description: (p.description || '').trim(),
          trigger: (p.trigger || '').trim(),
        }))
        .filter((p) => p.label.length > 0)
        .map((p, pIdx) => ({
          id: uuidv4(),
          journeyId: journey.id,
          label: p.label,
          description: p.description,
          trigger: p.trigger,
          order: pIdx,
          source: 'user' as const,
        }));
    });
    set({
      model: {
        id,
        input,
        journeys: seedJourneys,
        journeyPhases: seedPhases,
        demandSpaces: [],
        crossCuttingDemandSpaces: [],
        circumstances: [],
        marketingActivations: [],
        productActivations: [],
        serviceActivations: [],
        personaMappings: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return id;
  },

  // ----- Journey actions ----------------------------------------------

  setJourneys: (journeys) => {
    const { model } = get();
    if (!model) return;
    // Preserve ids on matching names when we can — keeps per-journey phase
    // linkage stable if the user re-submits the same list.
    const prevByName = new Map(
      (model.journeys || []).map((j) => [j.name.trim().toLowerCase(), j])
    );
    const next: Journey[] = journeys.map((j, i) => {
      const prev = prevByName.get((j.name || '').trim().toLowerCase());
      return {
        id: prev?.id ?? uuidv4(),
        name: (j.name || `Journey ${i + 1}`).trim(),
        jtbdBlueprint: (j.jtbdBlueprint || '').trim(),
        order: i,
      };
    });
    // Drop content that belonged to journeys no longer in the list.
    const keptJourneyIds = new Set(next.map((j) => j.id));
    const keptPhases = model.journeyPhases.filter(
      (p) => !p.journeyId || keptJourneyIds.has(p.journeyId)
    );
    const keptPhaseIds = new Set(keptPhases.map((p) => p.id));
    const keptDemandSpaces = model.demandSpaces.filter((ds) =>
      keptPhaseIds.has(ds.journeyPhaseId)
    );
    const keptDsIds = new Set(keptDemandSpaces.map((ds) => ds.id));
    set({
      model: {
        ...model,
        journeys: next,
        journeyPhases: keptPhases,
        demandSpaces: keptDemandSpaces,
        circumstances: model.circumstances.filter((c) => keptDsIds.has(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) =>
          keptDsIds.has(a.demandSpaceId)
        ),
        productActivations: model.productActivations.filter((a) =>
          keptDsIds.has(a.demandSpaceId)
        ),
        serviceActivations: model.serviceActivations.filter((a) =>
          keptDsIds.has(a.demandSpaceId)
        ),
        updatedAt: new Date(),
      },
    });
  },

  addJourney: (journey) => {
    const { model } = get();
    if (!model) return '';
    const next: Journey = {
      id: uuidv4(),
      name: (journey?.name || '').trim() || `Journey ${(model.journeys?.length ?? 0) + 1}`,
      jtbdBlueprint: (journey?.jtbdBlueprint || '').trim(),
      order: model.journeys?.length ?? 0,
    };
    set({
      model: {
        ...model,
        journeys: [...(model.journeys || []), next],
        updatedAt: new Date(),
      },
    });
    return next.id;
  },

  updateJourney: (id, updates) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        journeys: (model.journeys || []).map((j) =>
          j.id === id ? { ...j, ...updates } : j
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeJourney: (id) => {
    const { model } = get();
    if (!model) return;
    // Cascade: drop phases → demand spaces → dimensions / activations for
    // the removed journey. Persona mappings reference demand space ids
    // indirectly so they're rebuilt on the next mapping pass.
    const remainingJourneys = (model.journeys || []).filter((j) => j.id !== id);
    const droppedPhaseIds = new Set(
      model.journeyPhases.filter((p) => p.journeyId === id).map((p) => p.id)
    );
    const keptPhases = model.journeyPhases.filter((p) => p.journeyId !== id);
    const droppedDsIds = new Set(
      model.demandSpaces
        .filter((ds) => droppedPhaseIds.has(ds.journeyPhaseId))
        .map((ds) => ds.id)
    );
    set({
      model: {
        ...model,
        journeys: remainingJourneys.map((j, i) => ({ ...j, order: i })),
        journeyPhases: keptPhases,
        demandSpaces: model.demandSpaces.filter((ds) => !droppedPhaseIds.has(ds.journeyPhaseId)),
        circumstances: model.circumstances.filter((c) => !droppedDsIds.has(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        productActivations: model.productActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        serviceActivations: model.serviceActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        updatedAt: new Date(),
      },
    });
  },

  // Journey Phase actions (journey-scoped)
  setJourneyPhases: (journeyId, phases) => {
    const { model } = get();
    if (!model) return;

    // Only replace phases that belong to this journey. Other journeys'
    // landscape content stays intact so they can be regenerated
    // independently.
    const otherPhases = model.journeyPhases.filter(
      (p) => p.journeyId !== journeyId
    );
    const droppedPhaseIds = new Set(
      model.journeyPhases
        .filter((p) => p.journeyId === journeyId)
        .map((p) => p.id)
    );
    const droppedDsIds = new Set(
      model.demandSpaces
        .filter((ds) => droppedPhaseIds.has(ds.journeyPhaseId))
        .map((ds) => ds.id)
    );

    const newPhases: JourneyPhase[] = phases.map((phase, index) => ({
      ...phase,
      id: uuidv4(),
      journeyId,
      order: otherPhases.length + index,
    }));

    set({
      model: {
        ...model,
        journeyPhases: [...otherPhases, ...newPhases],
        // Cascade-clear downstream content that referenced the replaced
        // phases so stale demand spaces/circumstances don't linger.
        demandSpaces: model.demandSpaces.filter(
          (ds) => !droppedPhaseIds.has(ds.journeyPhaseId)
        ),
        circumstances: model.circumstances.filter((c) => !droppedDsIds.has(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        productActivations: model.productActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        serviceActivations: model.serviceActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        updatedAt: new Date(),
      },
    });
  },

  updateJourneyPhase: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        journeyPhases: model.journeyPhases.map((phase) =>
          phase.id === id ? { ...phase, ...updates } : phase
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteJourneyPhase: (id) => {
    const { model } = get();
    if (!model) return;

    const phase = model.journeyPhases.find((p) => p.id === id);
    if (!phase) return;

    // Get demand space IDs to clean up circumstances and activations
    const demandSpaceIds = model.demandSpaces
      .filter((ds) => ds.journeyPhaseId === id)
      .map((ds) => ds.id);

    set({
      model: {
        ...model,
        journeyPhases: model.journeyPhases.filter((p) => p.id !== id),
        demandSpaces: model.demandSpaces.filter((ds) => ds.journeyPhaseId !== id),
        circumstances: model.circumstances.filter((c) => !demandSpaceIds.includes(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        productActivations: model.productActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        serviceActivations: model.serviceActivations.filter((a) => !demandSpaceIds.includes(a.demandSpaceId)),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'phase', item: phase },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === phase.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addJourneyPhase: (journeyId) => {
    const { model } = get();
    if (!model) return;

    const newPhase: JourneyPhase = {
      id: uuidv4(),
      journeyId,
      label: '',
      description: '',
      trigger: '',
      order: model.journeyPhases.length,
    };

    set({
      model: {
        ...model,
        journeyPhases: [...model.journeyPhases, newPhase],
        updatedAt: new Date(),
      },
    });
  },

  // Demand Space actions
  setDemandSpaces: (journeyPhaseId, spaces) => {
    const { model } = get();
    if (!model) return;

    // Remove existing demand spaces for this phase
    const otherDemandSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId !== journeyPhaseId
    );

    // Create new demand spaces
    const newDemandSpaces: DemandSpace[] = spaces.map((space, index) => ({
      id: uuidv4(),
      journeyPhaseId,
      label: space.label,
      jobToBeDone: space.jobToBeDone,
      description: space.description,
      order: index,
      scope: 'phase' as const,
      sourceProblemIds: space.sourceProblemIds,
    }));

    set({
      model: {
        ...model,
        demandSpaces: [...otherDemandSpaces, ...newDemandSpaces],
        updatedAt: new Date(),
      },
    });
  },

  updateDemandSpace: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        demandSpaces: model.demandSpaces.map((ds) =>
          ds.id === id ? { ...ds, ...updates } : ds
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteDemandSpace: (id) => {
    const { model } = get();
    if (!model) return;

    const demandSpace = model.demandSpaces.find((ds) => ds.id === id);
    if (!demandSpace) return;

    set({
      model: {
        ...model,
        demandSpaces: model.demandSpaces.filter((ds) => ds.id !== id),
        circumstances: model.circumstances.filter((c) => c.demandSpaceId !== id),
        marketingActivations: model.marketingActivations.filter((a) => a.demandSpaceId !== id),
        productActivations: model.productActivations.filter((a) => a.demandSpaceId !== id),
        serviceActivations: model.serviceActivations.filter((a) => a.demandSpaceId !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'demandSpace', item: demandSpace },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === demandSpace.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addDemandSpace: (journeyPhaseId) => {
    const { model } = get();
    if (!model) return;

    const existingSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId === journeyPhaseId
    );

    const newSpace: DemandSpace = {
      id: uuidv4(),
      journeyPhaseId,
      label: '',
      jobToBeDone: '',
      order: existingSpaces.length,
      scope: 'phase' as const,
    };

    set({
      model: {
        ...model,
        demandSpaces: [...model.demandSpaces, newSpace],
        updatedAt: new Date(),
      },
    });
  },

  // Cross-cutting demand-space silo (Informed Landscape only)
  setCrossCuttingDemandSpaces: (spaces) => {
    const { model } = get();
    if (!model) return;

    const newSpaces: DemandSpace[] = spaces.map((space, index) => ({
      id: uuidv4(),
      // Cross-cutting demand spaces don't belong to any phase. We use the
      // sentinel '' here so the existing typing (journeyPhaseId: string)
      // stays intact while the `scope` field discriminates the bucket.
      journeyPhaseId: '',
      label: space.label,
      jobToBeDone: space.jobToBeDone,
      description: space.description,
      order: index,
      scope: 'cross-cutting' as const,
      sourceProblemIds: space.sourceProblemIds,
    }));

    // Drop circumstances tied to the old cross-cutting demand spaces so
    // the cascade can regenerate them cleanly. Per-phase circumstances
    // are untouched.
    const oldIds = new Set(
      (model.crossCuttingDemandSpaces || []).map((ds) => ds.id)
    );
    const survivingCircumstances = model.circumstances.filter(
      (c) => !oldIds.has(c.demandSpaceId)
    );

    set({
      model: {
        ...model,
        crossCuttingDemandSpaces: newSpaces,
        circumstances: survivingCircumstances,
        updatedAt: new Date(),
      },
    });
  },

  addCrossCuttingDemandSpace: () => {
    const { model } = get();
    if (!model) return '';

    const existing = model.crossCuttingDemandSpaces || [];
    const newSpace: DemandSpace = {
      id: uuidv4(),
      journeyPhaseId: '',
      label: '',
      jobToBeDone: '',
      order: existing.length,
      scope: 'cross-cutting' as const,
    };

    set({
      model: {
        ...model,
        crossCuttingDemandSpaces: [...existing, newSpace],
        updatedAt: new Date(),
      },
    });
    return newSpace.id;
  },

  updateCrossCuttingDemandSpace: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        crossCuttingDemandSpaces: (model.crossCuttingDemandSpaces || []).map((ds) =>
          ds.id === id ? { ...ds, ...updates } : ds
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteCrossCuttingDemandSpace: (id) => {
    const { model } = get();
    if (!model) return;

    const ds = (model.crossCuttingDemandSpaces || []).find((d) => d.id === id);
    if (!ds) return;

    set({
      model: {
        ...model,
        crossCuttingDemandSpaces: (model.crossCuttingDemandSpaces || []).filter(
          (d) => d.id !== id
        ),
        // Cross-cutting demand spaces own their circumstances just like
        // per-phase ones, so cascade-delete them via the existing
        // demandSpaceId FK.
        circumstances: model.circumstances.filter((c) => c.demandSpaceId !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'demandSpace', item: ds },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === ds.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  createDemandSpaceWithCircumstances: (journeyPhaseId, input) => {
    const { model } = get();
    const demandSpaceId = uuidv4();
    if (!model) return demandSpaceId;

    const existingSpaces = model.demandSpaces.filter(
      (ds) => ds.journeyPhaseId === journeyPhaseId
    );

    const newSpace: DemandSpace = {
      id: demandSpaceId,
      journeyPhaseId,
      label: input.label.trim(),
      jobToBeDone: input.jobToBeDone.trim(),
      description: input.description?.trim() || undefined,
      order: existingSpaces.length,
    };

    const newCircumstances: Circumstance[] = input.circumstances.map(
      (c, cIndex) => ({
        id: uuidv4(),
        demandSpaceId,
        order: cIndex,
        knowledge: (c.knowledge ?? '').trim(),
        intent: (c.intent ?? '').trim(),
        composition: (c.composition ?? '').trim(),
        constraint: (c.constraint ?? '').trim(),
        moment: (c.moment ?? '').trim(),
        context: (c.context ?? '').trim(),
        action: (c.action ?? '').trim(),
        outcome: (c.outcome ?? '').trim(),
        struggle: (c.struggle ?? '').trim(),
        progress: (c.progress ?? '').trim(),
        supportingSignalIds: c.supportingSignalIds,
        evidence: c.evidence,
      })
    );

    set({
      model: {
        ...model,
        demandSpaces: [...model.demandSpaces, newSpace],
        circumstances: [...model.circumstances, ...newCircumstances],
        updatedAt: new Date(),
      },
    });

    return demandSpaceId;
  },

  // Circumstance actions
  setCircumstances: (demandSpaceId, circumstances) => {
    const { model } = get();
    if (!model) return;

    const otherCircumstances = model.circumstances.filter(
      (c) => c.demandSpaceId !== demandSpaceId
    );

    const newCircumstances: Circumstance[] = circumstances.map((c, idx) => ({
      id: uuidv4(),
      demandSpaceId,
      order: idx,
      knowledge: c.knowledge,
      intent: c.intent,
      composition: c.composition,
      constraint: c.constraint,
      moment: c.moment,
      context: c.context,
      action: c.action,
      outcome: c.outcome,
      struggle: c.struggle,
      progress: c.progress,
      supportingSignalIds: c.supportingSignalIds,
      evidence: c.evidence,
    }));

    set({
      model: {
        ...model,
        circumstances: [...otherCircumstances, ...newCircumstances],
        updatedAt: new Date(),
      },
    });
  },

  updateCircumstance: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        circumstances: model.circumstances.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        updatedAt: new Date(),
      },
    });
  },

  deleteCircumstance: (id) => {
    const { model } = get();
    if (!model) return;

    const circumstance = model.circumstances.find((c) => c.id === id);
    if (!circumstance) return;

    set({
      model: {
        ...model,
        circumstances: model.circumstances.filter((c) => c.id !== id),
        marketingActivations: model.marketingActivations.filter((a) => a.circumstanceId !== id),
        productActivations: model.productActivations.filter((a) => a.circumstanceId !== id),
        serviceActivations: model.serviceActivations.filter((a) => a.circumstanceId !== id),
        updatedAt: new Date(),
      },
      lastDeleted: { type: 'circumstance', item: circumstance },
    });

    setTimeout(() => {
      const { lastDeleted } = get();
      if (lastDeleted?.item.id === circumstance.id) {
        set({ lastDeleted: null });
      }
    }, 10000);
  },

  addCircumstance: (demandSpaceId) => {
    const { model } = get();
    if (!model) return;

    const existingCircumstances = model.circumstances.filter(
      (c) => c.demandSpaceId === demandSpaceId
    );

    const newCircumstance: Circumstance = {
      id: uuidv4(),
      demandSpaceId,
      order: existingCircumstances.length,
      knowledge: '',
      intent: '',
      composition: '',
      constraint: '',
      moment: '',
      context: '',
      action: '',
      outcome: '',
      struggle: '',
      progress: '',
    };

    set({
      model: {
        ...model,
        circumstances: [...model.circumstances, newCircumstance],
        updatedAt: new Date(),
      },
    });
  },

  // Activation actions — one activation per circumstance.
  setMarketingActivations: (demandSpaceId, activations, circumstanceIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.marketingActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      circumstanceId: circumstanceIds[index],
    }));

    set({
      model: {
        ...model,
        marketingActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  setProductActivations: (demandSpaceId, activations, circumstanceIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.productActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      circumstanceId: circumstanceIds[index],
    }));

    set({
      model: {
        ...model,
        productActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  setServiceActivations: (demandSpaceId, activations, circumstanceIds) => {
    const { model } = get();
    if (!model) return;

    const otherActivations = model.serviceActivations.filter(
      (a) => a.demandSpaceId !== demandSpaceId
    );

    const newActivations = activations.map((act, index) => ({
      ...act,
      id: uuidv4(),
      demandSpaceId,
      circumstanceId: circumstanceIds[index],
    }));

    set({
      model: {
        ...model,
        serviceActivations: [...otherActivations, ...newActivations],
        updatedAt: new Date(),
      },
    });
  },

  updateMarketingActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        marketingActivations: model.marketingActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  updateProductActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        productActivations: model.productActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  updateServiceActivation: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        serviceActivations: model.serviceActivations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
        updatedAt: new Date(),
      },
    });
  },

  // Loading state actions
  setGeneratingPhases: (loading) => {
    set({ isGeneratingPhases: loading });
  },

  setGeneratingDemandSpaces: (journeyPhaseId, loading) => {
    set((state) => ({
      isGeneratingDemandSpaces: {
        ...state.isGeneratingDemandSpaces,
        [journeyPhaseId]: loading,
      },
    }));
  },

  setGeneratingCrossCuttingDemandSpaces: (loading) => {
    set({ isGeneratingCrossCuttingDemandSpaces: loading });
  },

  setGeneratingCircumstances: (demandSpaceId, loading) => {
    set((state) => ({
      isGeneratingCircumstances: {
        ...state.isGeneratingCircumstances,
        [demandSpaceId]: loading,
      },
    }));
  },

  setGeneratingActivations: (demandSpaceId, loading) => {
    set((state) => ({
      isGeneratingActivations: {
        ...state.isGeneratingActivations,
        [demandSpaceId]: loading,
      },
    }));
  },

  setGeneratingPersonaMappings: (loading) => {
    set({ isGeneratingPersonaMappings: loading });
  },

  stopAllGeneration: () => {
    set({
      isGeneratingPhases: false,
      isGeneratingDemandSpaces: {},
      isGeneratingCrossCuttingDemandSpaces: false,
      isGeneratingCircumstances: {},
      isGeneratingActivations: {},
      isGeneratingPersonaMappings: false,
    });
  },

  // Persona mapping actions
  setPersonaMappings: (mappings) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        personaMappings: mappings,
        updatedAt: new Date(),
      },
    });
  },

  // Undo
  undoDelete: () => {
    const { model, lastDeleted } = get();
    if (!model || !lastDeleted) return;

    switch (lastDeleted.type) {
      case 'phase': {
        const phase = lastDeleted.item as JourneyPhase;
        set({
          model: {
            ...model,
            journeyPhases: [...model.journeyPhases, phase].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'demandSpace': {
        const demandSpace = lastDeleted.item as DemandSpace;
        set({
          model: {
            ...model,
            demandSpaces: [...model.demandSpaces, demandSpace].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
      case 'circumstance': {
        const circumstance = lastDeleted.item as Circumstance;
        set({
          model: {
            ...model,
            circumstances: [...model.circumstances, circumstance].sort((a, b) => a.order - b.order),
            updatedAt: new Date(),
          },
          lastDeleted: null,
        });
        break;
      }
    }
  },

  clearUndo: () => {
    set({ lastDeleted: null });
  },

  // Discovery & Signal Mapping actions (Phase 1)
  setDiscoveryPlan: (plan) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        discoveryPlan: plan,
        updatedAt: new Date(),
      },
    });
  },

  updateDiscoveryPlan: (updates) => {
    const { model } = get();
    if (!model || !model.discoveryPlan) return;

    set({
      model: {
        ...model,
        discoveryPlan: {
          ...model.discoveryPlan,
          ...updates,
        },
        updatedAt: new Date(),
      },
    });
  },

  addEvidence: (evidence) => {
    const { model } = get();
    if (!model) return;

    const newEvidence: Evidence = {
      ...evidence,
      id: uuidv4(),
    };

    set({
      model: {
        ...model,
        evidenceRecords: [...(model.evidenceRecords || []), newEvidence],
        updatedAt: new Date(),
      },
    });
  },

  updateEvidence: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        evidenceRecords: (model.evidenceRecords || []).map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeEvidence: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        evidenceRecords: (model.evidenceRecords || []).filter((e) => e.id !== id),
        updatedAt: new Date(),
      },
    });
  },

  setSignals: (signals) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        signals,
        updatedAt: new Date(),
      },
    });
  },

  updateSignal: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        signals: (model.signals || []).map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeSignal: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        signals: (model.signals || []).filter((s) => s.id !== id),
        updatedAt: new Date(),
      },
    });
  },

  setMappings: (mappings) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        mappings,
        updatedAt: new Date(),
      },
    });
  },

  setProposals: (proposals) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        proposals,
        updatedAt: new Date(),
      },
    });
  },

  // ---------- Q&A confirmation gating ----------

  confirmQa: () => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        qaConfirmedAt: new Date(),
        qaSkippedAt: null,
        updatedAt: new Date(),
      },
    });
  },

  skipQa: () => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        qaConfirmedAt: null,
        qaSkippedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  resetQa: () => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        qaConfirmedAt: null,
        qaSkippedAt: null,
        updatedAt: new Date(),
      },
    });
  },

  approveDiscoveryBundle: (bundle) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        discoveryBundle: {
          ...bundle,
          approvedAt: new Date(),
        },
        updatedAt: new Date(),
      },
    });
  },

  setCurrentStep: (step) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        currentStep: step,
        updatedAt: new Date(),
      },
    });
  },

  resetLandscapeForRegen: (journeyId) => {
    const { model } = get();
    if (!model) return;

    // If no journeyId is passed, wipe the whole landscape (used for full
    // refine). If passed, wipe only that journey's content — other
    // journeys stay intact.
    if (!journeyId) {
      set({
        model: {
          ...model,
          journeyPhases: [],
          demandSpaces: [],
          crossCuttingDemandSpaces: [],
          circumstances: [],
          marketingActivations: [],
          productActivations: [],
          serviceActivations: [],
          personaMappings: [],
          mappings: [],
          proposals: [],
          updatedAt: new Date(),
        },
        isGeneratingPhases: false,
        isGeneratingDemandSpaces: {},
        isGeneratingCrossCuttingDemandSpaces: false,
        isGeneratingCircumstances: {},
        isGeneratingActivations: {},
        isGeneratingPersonaMappings: false,
      });
      return;
    }

    const droppedPhaseIds = new Set(
      model.journeyPhases.filter((p) => p.journeyId === journeyId).map((p) => p.id)
    );
    const droppedDsIds = new Set(
      model.demandSpaces
        .filter((ds) => droppedPhaseIds.has(ds.journeyPhaseId))
        .map((ds) => ds.id)
    );

    // Drop the per-phase / per-demand-space generation flags scoped to
    // this journey so the empty-state CTA shows up again.
    const phasesFlags = { ...get().isGeneratingDemandSpaces };
    droppedPhaseIds.forEach((pid) => delete phasesFlags[pid]);
    const circFlags = { ...get().isGeneratingCircumstances };
    const actsFlags = { ...get().isGeneratingActivations };
    droppedDsIds.forEach((dsid) => {
      delete circFlags[dsid];
      delete actsFlags[dsid];
    });

    set({
      model: {
        ...model,
        journeyPhases: model.journeyPhases.filter((p) => p.journeyId !== journeyId),
        demandSpaces: model.demandSpaces.filter((ds) => !droppedPhaseIds.has(ds.journeyPhaseId)),
        circumstances: model.circumstances.filter((c) => !droppedDsIds.has(c.demandSpaceId)),
        marketingActivations: model.marketingActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        productActivations: model.productActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        serviceActivations: model.serviceActivations.filter((a) => !droppedDsIds.has(a.demandSpaceId)),
        updatedAt: new Date(),
      },
      isGeneratingDemandSpaces: phasesFlags,
      isGeneratingCircumstances: circFlags,
      isGeneratingActivations: actsFlags,
    });
  },

  // ======================================
  // Brief & research uploads
  // ======================================

  setBriefDocument: (brief) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        input: {
          ...model.input,
          briefDocument: brief,
        },
        updatedAt: new Date(),
      },
    });
  },

  clearBriefDocument: () => {
    const { model } = get();
    if (!model) return;
    const nextInput = { ...model.input };
    delete nextInput.briefDocument;
    set({
      model: {
        ...model,
        input: nextInput,
        updatedAt: new Date(),
      },
    });
  },

  addResearchDocument: (doc) => {
    const { model } = get();
    const id = uuidv4();
    if (!model) return id;
    const next: ResearchDocument = { ...doc, id };
    set({
      model: {
        ...model,
        input: {
          ...model.input,
          researchDocuments: [
            ...(model.input.researchDocuments || []),
            next,
          ],
        },
        updatedAt: new Date(),
      },
    });
    return id;
  },

  updateResearchDocument: (id, updates) => {
    const { model } = get();
    if (!model) return;
    const docs = model.input.researchDocuments || [];
    set({
      model: {
        ...model,
        input: {
          ...model.input,
          researchDocuments: docs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        },
        updatedAt: new Date(),
      },
    });
  },

  removeResearchDocument: (id) => {
    const { model } = get();
    if (!model) return;
    const docs = model.input.researchDocuments || [];
    set({
      model: {
        ...model,
        input: {
          ...model.input,
          researchDocuments: docs.filter((d) => d.id !== id),
        },
        updatedAt: new Date(),
      },
    });
  },

  // ======================================
  // Hypothesis landscape variants
  // ======================================

  addHypothesisVariant: (variant) => {
    const { model } = get();
    const id = uuidv4();
    if (!model) return id;
    const next: HypothesisVariant = { ...variant, id };
    set({
      model: {
        ...model,
        hypothesisVariants: [...(model.hypothesisVariants || []), next],
        updatedAt: new Date(),
      },
    });
    return id;
  },

  updateHypothesisVariant: (id, updates) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        hypothesisVariants: (model.hypothesisVariants || []).map((v) =>
          v.id === id ? { ...v, ...updates } : v
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeHypothesisVariant: (id) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        hypothesisVariants: (model.hypothesisVariants || []).filter(
          (v) => v.id !== id
        ),
        updatedAt: new Date(),
      },
    });
  },

  setActiveHypothesisVariant: (id) => {
    const { model } = get();
    if (!model) return;
    const variants = model.hypothesisVariants || [];
    const target = variants.find((v) => v.id === id);
    if (!target) return;

    // Mirror the active variant's phases to journeyPhases so the existing
    // demand-space / circumstance pipeline keeps working unchanged.
    // Stamp every phase with the model's first journeyId so the
    // multi-journey scoping invariant holds. Variants today are
    // single-journey by construction; revisit when multi-journey
    // hypothesis blends land.
    const fallbackJourneyId = model.journeys?.[0]?.id;
    const mirroredPhases: JourneyPhase[] = target.journeyPhases.map((p) => ({
      ...p,
      journeyId: p.journeyId || fallbackJourneyId,
    }));

    // BIDIRECTIONAL INVARIANT: clear isActive on every Informed variant
    // so only one landscape is live at a time.
    const clearedInformed = (model.informedVariants || []).map((v) => ({
      ...v,
      isActive: false,
    }));

    set({
      model: {
        ...model,
        hypothesisVariants: variants.map((v) => ({
          ...v,
          isActive: v.id === id,
        })),
        informedVariants: clearedInformed,
        journeyPhases: mirroredPhases,
        updatedAt: new Date(),
      },
    });
  },

  // ======================================
  // Informed Landscape variants
  // ======================================

  addInformedVariant: (variant) => {
    const { model } = get();
    const id = uuidv4();
    if (!model) return id;
    const next: InformedLandscapeVariant = { ...variant, id };
    set({
      model: {
        ...model,
        informedVariants: [...(model.informedVariants || []), next],
        updatedAt: new Date(),
      },
    });
    return id;
  },

  updateInformedVariant: (id, updates) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        informedVariants: (model.informedVariants || []).map((v) =>
          v.id === id ? { ...v, ...updates } : v
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeInformedVariant: (id) => {
    const { model } = get();
    if (!model) return;
    set({
      model: {
        ...model,
        informedVariants: (model.informedVariants || []).filter(
          (v) => v.id !== id
        ),
        updatedAt: new Date(),
      },
    });
  },

  setActiveInformedVariant: (id) => {
    const { model } = get();
    if (!model) return;
    const variants = model.informedVariants || [];
    const target = variants.find((v) => v.id === id);
    if (!target) return;

    // Mirror the active variant's phases to journeyPhases. Stamp every
    // phase with `source: 'ai'` so the existing
    // demand-space/circumstance auto-cascade fires reliably.
    const fallbackJourneyId = model.journeys?.[0]?.id;
    const mirroredPhases: JourneyPhase[] = target.journeyPhases.map((p) => ({
      ...p,
      journeyId: p.journeyId || fallbackJourneyId,
      source: 'ai',
    }));

    // BIDIRECTIONAL INVARIANT: clear isActive on every Hypothesis variant.
    const clearedHypothesis = (model.hypothesisVariants || []).map((v) => ({
      ...v,
      isActive: false,
    }));

    // Switching landscapes invalidates downstream content tied to the
    // previous phase ids. Wipe demand spaces / circumstances /
    // activations so the auto-cascade re-runs against the new phases.
    set({
      model: {
        ...model,
        hypothesisVariants: clearedHypothesis,
        informedVariants: variants.map((v) => ({
          ...v,
          isActive: v.id === id,
        })),
        journeyPhases: mirroredPhases,
        demandSpaces: [],
        circumstances: [],
        marketingActivations: [],
        productActivations: [],
        serviceActivations: [],
        updatedAt: new Date(),
      },
    });
  },

  // ======================================
  // Workshop inventory actions (Plan step)
  // ======================================

  setWorkshops: (workshops) => {
    const { model } = get();
    if (!model) return;

    const newWorkshops: Workshop[] = workshops.map((w, idx) => ({
      id: uuidv4(),
      code: w.code,
      phase: w.phase,
      name: w.name,
      track: w.track,
      duration: w.duration,
      mode: w.mode,
      status: w.status,
      summary: w.summary,
      mainOutcomes: w.mainOutcomes || [],
      agenda: (w.agenda || []).map((a) => ({ ...a, id: uuidv4() })),
      clientAttendees: normalizeAttendees(w.clientAttendees),
      agencyAttendees: normalizeAttendees(w.agencyAttendees),
      preReads: w.preReads || [],
      dependencies: w.dependencies || [],
      notes: w.notes,
      order: idx,
    }));

    // Drop questions for workshops that no longer exist.
    const keptIds = new Set(newWorkshops.map((w) => w.id));
    const keptQuestions = (model.workshopQuestions || []).filter((q) =>
      keptIds.has(q.workshopId)
    );

    set({
      model: {
        ...model,
        workshops: newWorkshops,
        workshopQuestions: keptQuestions,
        updatedAt: new Date(),
      },
    });
  },

  addWorkshop: (partial) => {
    const { model } = get();
    if (!model) return '';

    const existing = model.workshops || [];
    const id = uuidv4();
    const nextOrder = existing.length;

    const newWorkshop: Workshop = {
      id,
      code: partial?.code || `W${String(nextOrder + 1).padStart(2, '0')}`,
      phase: partial?.phase || 'Discovery',
      name: partial?.name || 'Untitled workshop',
      track: partial?.track,
      duration: partial?.duration || '90 min',
      mode: partial?.mode || 'hybrid',
      status: partial?.status || 'draft',
      summary: partial?.summary || '',
      mainOutcomes: partial?.mainOutcomes || [],
      agenda: (partial?.agenda || []).map((a) => ({ ...a, id: a.id || uuidv4() })),
      clientAttendees: normalizeAttendees(partial?.clientAttendees),
      agencyAttendees: normalizeAttendees(partial?.agencyAttendees),
      preReads: partial?.preReads || [],
      dependencies: partial?.dependencies || [],
      notes: partial?.notes,
      order: nextOrder,
    };

    set({
      model: {
        ...model,
        workshops: [...existing, newWorkshop],
        updatedAt: new Date(),
      },
    });

    return id;
  },

  updateWorkshop: (id, updates) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === id ? { ...w, ...updates } : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeWorkshop: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        workshops: (model.workshops || []).filter((w) => w.id !== id),
        workshopQuestions: (model.workshopQuestions || []).filter(
          (q) => q.workshopId !== id
        ),
        updatedAt: new Date(),
      },
    });
  },

  reorderWorkshops: (orderedIds) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    const byId = new Map(model.workshops.map((w) => [w.id, w]));
    const reordered = orderedIds
      .map((id, idx) => {
        const w = byId.get(id);
        return w ? { ...w, order: idx } : null;
      })
      .filter((w): w is Workshop => w !== null);

    // Tack on any workshops not in the orderedIds list at the end, preserving
    // their original relative order.
    const missing = model.workshops
      .filter((w) => !orderedIds.includes(w.id))
      .map((w, idx) => ({ ...w, order: reordered.length + idx }));

    set({
      model: {
        ...model,
        workshops: [...reordered, ...missing],
        updatedAt: new Date(),
      },
    });
  },

  addAttendee: (workshopId, side, partial) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    const key: 'clientAttendees' | 'agencyAttendees' =
      side === 'client' ? 'clientAttendees' : 'agencyAttendees';

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) => {
          if (w.id !== workshopId) return w;
          const newAttendee: WorkshopAttendee = {
            id: uuidv4(),
            title: partial?.title || '',
            ...(partial?.names && partial.names.length
              ? { names: partial.names }
              : {}),
          };
          return { ...w, [key]: [...w[key], newAttendee] };
        }),
        updatedAt: new Date(),
      },
    });
  },

  updateAttendee: (workshopId, side, attendeeId, updates) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    const key: 'clientAttendees' | 'agencyAttendees' =
      side === 'client' ? 'clientAttendees' : 'agencyAttendees';

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? {
                ...w,
                [key]: w[key].map((a) =>
                  a.id === attendeeId ? { ...a, ...updates } : a
                ),
              }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeAttendee: (workshopId, side, attendeeId) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    const key: 'clientAttendees' | 'agencyAttendees' =
      side === 'client' ? 'clientAttendees' : 'agencyAttendees';

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? { ...w, [key]: w[key].filter((a) => a.id !== attendeeId) }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  setWorkshopAgenda: (workshopId, items) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? {
                ...w,
                agenda: items.map((a) => ({ ...a, id: uuidv4() })),
              }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  addAgendaItem: (workshopId) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? {
                ...w,
                agenda: [
                  ...w.agenda,
                  { id: uuidv4(), label: '', duration: '', notes: '' },
                ],
              }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  updateAgendaItem: (workshopId, itemId, updates) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? {
                ...w,
                agenda: w.agenda.map((a) =>
                  a.id === itemId ? { ...a, ...updates } : a
                ),
              }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeAgendaItem: (workshopId, itemId) => {
    const { model } = get();
    if (!model || !model.workshops) return;

    set({
      model: {
        ...model,
        workshops: model.workshops.map((w) =>
          w.id === workshopId
            ? { ...w, agenda: w.agenda.filter((a) => a.id !== itemId) }
            : w
        ),
        updatedAt: new Date(),
      },
    });
  },

  setWorkshopQuestions: (workshopId, questions) => {
    const { model } = get();
    if (!model) return;

    const other = (model.workshopQuestions || []).filter(
      (q) => q.workshopId !== workshopId
    );

    const newQs: WorkshopQuestion[] = questions.map((q, idx) => ({
      id: uuidv4(),
      workshopId,
      order: idx,
      targetRole: q.targetRole,
      text: q.text,
      intent: q.intent,
      journeyPhase: q.journeyPhase,
      rationale: q.rationale,
      notes: q.notes,
    }));

    set({
      model: {
        ...model,
        workshopQuestions: [...other, ...newQs],
        updatedAt: new Date(),
      },
    });
  },

  addWorkshopQuestion: (workshopId, partial) => {
    const { model } = get();
    if (!model) return;

    const existing = (model.workshopQuestions || []).filter(
      (q) => q.workshopId === workshopId
    );

    const newQuestion: WorkshopQuestion = {
      id: uuidv4(),
      workshopId,
      order: existing.length,
      targetRole: partial?.targetRole || '',
      text: partial?.text || '',
      intent: partial?.intent || 'problem',
      journeyPhase: partial?.journeyPhase,
      rationale: partial?.rationale,
      notes: partial?.notes,
    };

    set({
      model: {
        ...model,
        workshopQuestions: [...(model.workshopQuestions || []), newQuestion],
        updatedAt: new Date(),
      },
    });
  },

  updateWorkshopQuestion: (id, updates) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        workshopQuestions: (model.workshopQuestions || []).map((q) =>
          q.id === id ? { ...q, ...updates } : q
        ),
        updatedAt: new Date(),
      },
    });
  },

  removeWorkshopQuestion: (id) => {
    const { model } = get();
    if (!model) return;

    set({
      model: {
        ...model,
        workshopQuestions: (model.workshopQuestions || []).filter(
          (q) => q.id !== id
        ),
        updatedAt: new Date(),
      },
    });
  },
    }),
    {
      name: 'journey-generator-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist the model itself — loading flags and undo state stay transient.
      partialize: (state) => ({ model: state.model }),
      // Revive Date fields after rehydration from JSON.
      onRehydrateStorage: () => (state) => {
        if (state?.model) {
          state.model = reviveDates(state.model);

          // Migration: pre-multi-journey models don't have `journeys`.
          // Synthesize a single default journey and stamp every existing
          // phase with its id so the rest of the app can assume each
          // phase belongs to a journey. Only migrate if journeys is
          // completely missing (undefined/null), NOT if it's an empty array.
          if (!state.model.journeys || !Array.isArray(state.model.journeys)) {
            const defaultJourney: Journey = {
              id: uuidv4(),
              name: 'Journey',
              jtbdBlueprint: '',
              order: 0,
            };
            state.model.journeys = [defaultJourney];
            state.model.journeyPhases = (state.model.journeyPhases || []).map((p) => ({
              ...p,
              journeyId: defaultJourney.id,
            }));
          } else {
            // Journeys already exist, but some phases may be orphaned
            // (missing journeyId). Attach them to the first journey so
            // they don't silently disappear from the canvas.
            const fallbackId = state.model.journeys[0].id;
            state.model.journeyPhases = (state.model.journeyPhases || []).map((p) =>
              p.journeyId ? p : { ...p, journeyId: fallbackId }
            );
          }

          // Migrate legacy `dimensions` field off the model. Pre-circumstance
          // models persisted a `dimensions: Dimension[]` array on Model that
          // is no longer part of the shape. Strip it (and any null
          // circumstance arrays) so the rehydrated model matches the
          // current TypeScript contract. Content loss is intentional —
          // regenerate circumstances for old demand spaces.
          const legacyModel = state.model as unknown as { dimensions?: unknown };
          if ('dimensions' in legacyModel) {
            delete legacyModel.dimensions;
          }
          if (!Array.isArray(state.model.circumstances)) {
            state.model.circumstances = [];
          } else {
            // Old legacy Circumstance shape was { id, demandSpaceId, label,
            // order }. Drop any entries missing the new axis fields so the
            // UI doesn't render half-empty cards.
            state.model.circumstances = state.model.circumstances.filter(
              (c) =>
                c &&
                typeof (c as Circumstance).knowledge === 'string' &&
                typeof (c as Circumstance).context === 'string'
            );
          }

          // Migration: pre-provenance models don't have the cross-cutting
          // demand-space silo or `scope` discriminator on existing demand
          // spaces. Default both so the new Informed Landscape provenance
          // flow has a stable shape to write into.
          if (!Array.isArray(state.model.crossCuttingDemandSpaces)) {
            state.model.crossCuttingDemandSpaces = [];
          }
          if (Array.isArray(state.model.demandSpaces)) {
            state.model.demandSpaces = state.model.demandSpaces.map((ds) =>
              ds.scope ? ds : { ...ds, scope: 'phase' as const }
            );
          }

          // Migrate legacy workshop attendee shape (string[] → WorkshopAttendee[])
          if (state.model.workshops) {
            state.model.workshops = state.model.workshops.map((w) => ({
              ...w,
              clientAttendees: normalizeAttendees(
                w.clientAttendees as unknown
              ),
              agencyAttendees: normalizeAttendees(
                w.agencyAttendees as unknown
              ),
            }));
          }
        }
      },
    }
  )
);
