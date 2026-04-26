'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  LayoutDashboard,
  Headphones,
  Sparkles,
  Zap,
  Check,
  Circle,
  Loader2,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
  FolderOpen,
  Trash2,
  Upload,
  FileText,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { ExperienceType, TechStack, TechTool, Product, Persona, BriefDocument } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { useApiKey } from '@/lib/hooks/useApiKey';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TOOL OPTIONS
// ============================================================================

const CLOUD_WAREHOUSE_OPTIONS = [
  'Snowflake', 'Google BigQuery', 'Amazon Redshift', 'Databricks',
  'Azure Synapse Analytics', 'Teradata', 'Vertica', 'ClickHouse',
];

const DATA_STORAGE_OPTIONS = [
  'AWS S3', 'Azure Blob Storage', 'Google Cloud Storage', 'PostgreSQL',
  'MySQL', 'MongoDB', 'Amazon DynamoDB', 'Azure Cosmos DB', 'Redis',
  'Elasticsearch', 'Supabase', 'PlanetScale',
];

const CRM_OPTIONS = [
  'Salesforce Sales Cloud', 'Salesforce Service Cloud', 'HubSpot CRM',
  'Microsoft Dynamics 365', 'Zoho CRM', 'Pipedrive', 'Freshsales',
];

const CDP_OPTIONS = [
  'Segment', 'mParticle', 'Tealium AudienceStream', 'Adobe Real-Time CDP',
  'Salesforce Data Cloud', 'Amperity', 'Treasure Data', 'BlueConic',
  'Rudderstack', 'Hightouch', 'Census',
];

const CEP_OPTIONS = [
  'Braze', 'Salesforce Marketing Cloud', 'Adobe Campaign', 'Emarsys',
  'Iterable', 'Klaviyo', 'Customer.io', 'Attentive', 'Insider', 'MoEngage',
];

const DXP_OPTIONS = [
  'Adobe Experience Manager', 'Optimizely', 'Sitecore', 'Contentful',
  'Contentstack', 'Sanity', 'Strapi', 'Acquia', 'Bloomreach',
];

const AI_MODEL_OPTIONS = [
  'GPT-4o', 'GPT-4', 'GPT-3.5 Turbo', 'Claude 3.5 Sonnet', 'Claude 3 Opus',
  'Claude 3 Haiku', 'Gemini 1.5 Pro', 'Gemini 1.5 Flash', 'Llama 3.1 405B',
];

const AI_PLATFORM_OPTIONS = [
  'Azure AI Foundry', 'Azure OpenAI Service', 'AWS Bedrock', 'Google Vertex AI',
  'OpenAI Platform', 'Anthropic API', 'Hugging Face', 'Databricks ML',
];

// ============================================================================
// INDUSTRY & PERSONAS
// ============================================================================

const INDUSTRIES = [
  'Theme Parks & Attractions',
  'Consumer Packaged Goods',
  'Financial Services',
  'Healthcare',
  'Retail & E-commerce',
  'Travel & Hospitality',
  'Telecommunications',
  'Automotive',
  'Technology',
  'Media & Entertainment',
  'Real Estate & Property',
  'Airlines & Aviation',
  'Quick Service Restaurant',
  'Other',
];

const INDUSTRY_PERSONAS: Record<string, string[]> = {
  'Theme Parks & Attractions': [
    'US families with children', 'International tourists', 'Annual Passholders',
    'Disney Adults (no kids)', 'School/youth groups', 'Corporate event planners',
  ],
  'Financial Services': [
    'Young professionals', 'High-net-worth individuals', 'Small business owners',
    'Retirees', 'First-time investors', 'Debt consolidators',
  ],
  'Healthcare': [
    'Chronic condition managers', 'Preventive care seekers', 'Caregivers',
    'New patients', 'Elderly patients', 'Parents with children',
  ],
  'Retail & E-commerce': [
    'Deal hunters', 'Brand loyalists', 'Impulse buyers',
    'Research-heavy buyers', 'Gift shoppers', 'Subscription customers',
  ],
};

// ============================================================================
// EXPERIENCE TYPES
// ============================================================================

const EXPERIENCE_TYPES: { id: ExperienceType; label: string; desc: string; icon: typeof Megaphone }[] = [
  { id: 'marketing', label: 'Marketing', desc: 'Acquire, nurture, convert.', icon: Megaphone },
  { id: 'product', label: 'Product', desc: 'Onboarding, activation, retention.', icon: LayoutDashboard },
  { id: 'service', label: 'Service', desc: 'Support, recovery, loyalty.', icon: Headphones },
];

// ============================================================================
// DISNEY EXAMPLE
// ============================================================================

const DISNEY_EXAMPLE = {
  experienceTypes: ['marketing'] as ExperienceType[],
  industry: 'Theme Parks & Attractions',
  businessDescription: 'Walt Disney World is a world-renowned destination resort in Orlando, Florida, comprising four theme parks (Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom), two water parks, and numerous resort hotels. The challenge is maximizing guest lifetime value by driving multi-day stays, encouraging park-hopping behavior, and increasing per-guest spend on dining, merchandise, and premium experiences like Genie+ and Lightning Lane.',
  techStack: {
    cloudWarehouse: [{ id: '1', value: 'Snowflake', purpose: 'Guest analytics & reporting' }],
    dataStorage: [{ id: '2', value: 'AWS S3', purpose: 'Data lake storage' }],
    crm: [{ id: '3', value: 'Salesforce Sales Cloud', purpose: 'Guest relationship management' }],
    cdp: [{ id: '4', value: 'Segment', purpose: 'Event tracking & identity resolution' }],
    cep: [{ id: '5', value: 'Braze', purpose: 'Push, email, in-app messaging' }],
    dxp: [{ id: '6', value: 'Adobe Experience Manager', purpose: 'Web content management' }],
    aiModels: [{ id: '7', value: 'GPT-4o', purpose: 'Conversational AI & recommendations' }],
    aiPlatform: [{ id: '9', value: 'Azure OpenAI Service', purpose: 'Enterprise AI deployment' }],
  } as TechStack,
  products: [
    { id: '1', name: 'My Disney Experience App', description: 'Mobile app for park navigation, dining reservations, Genie+ bookings' },
    { id: '2', name: 'DisneyWorld.com', description: 'Primary website for trip planning, ticket purchases, and resort bookings' },
  ] as Product[],
  painPoints: 'High perceived cost limits repeat visits\nOverwhelming planning complexity deters first-timers\nLong wait times cause frustration on-site\nDifficulty booking popular dining and experiences',
  channels: 'Email, SMS, Push, In-App, Web',
};

const DUBAI_AIRPORT_EXAMPLE = {
  experienceTypes: ['product', 'marketing', 'service'] as ExperienceType[],
  industry: 'Airlines & Aviation',
  businessDescription: 'Dubai International Airport digital transformation initiative focused on three core objectives: revenue generation through digital channels, enhanced customer experience and satisfaction across all touchpoints, and innovation through emerging technologies. Key deliverables include comprehensive redesign of mobile app and website with quick wins targeted for 2026, followed by advanced projects for 2027 and beyond including an agentic AI layer for personalized assistance and innovative service features. Strategic expansion opportunities include integration with taxis, hotels, ticketing platforms, and other travel ecosystem partners to create a seamless end-to-end journey experience.',
  techStack: {
    cloudWarehouse: [{ id: '1', name: 'Snowflake', description: 'for customer data and ops data' }],
    dataStorage: [{ id: '2', name: 'Microsoft Azure', description: '' }],
    cdp: [{ id: '3', name: 'Snowflake', description: '' }],
    dxp: [{ id: '4', name: 'Optimizely', description: '' }],
  },
  products: [
    { id: '1', name: 'Mobile App', description: 'Primary passenger interface for journey management' },
    { id: '2', name: 'Website', description: 'Digital planning and information hub' },
    { id: '3', name: 'Wayfinding', description: 'In-terminal navigation and directions' },
    { id: '4', name: 'Kiosks', description: 'Self-service touchpoints throughout terminals' },
    { id: '5', name: 'Digital Signage', description: 'Dynamic information displays and advertising' },
    { id: '6', name: 'Digital Services', description: 'Digital Services scope and the Information Channel Foundation (ICF)' },

  ] as Product[],
  painPoints: '',
  channels: 'Email, SMS, In-App Push, Push Notifications, WhatsApp',
  journeys: [
    {
      name: 'Departure',
      jtbdBlueprint: 'Get from planning to boarding smoothly, confidently, and on time.',
      phases: [
        { id: '1', name: 'pre-booking' },
        { id: '2', name: 'post-booking' },
        { id: '3', name: 'pre-journey' },
        { id: '4', name: 'arrival' },
        { id: '5', name: 'security' },
        { id: '6', name: 'dwell' },
        { id: '7', name: 'lounge' },
        { id: '8', name: 'retail' },
        { id: '9', name: 'gate' },
        { id: '10', name: 'boarding' },
        { id: '11', name: 'feedback' },
      ],
    },
    {
      name: 'Arrival',
      jtbdBlueprint: 'Land, clear formalities, and transition into my destination with minimal friction.',
      phases: [
        { id: '1', name: 'departure from country of origin' },
        { id: '2', name: 'in-flight' },
        { id: '3', name: 'landing' },
        { id: '4', name: 'disembarkation' },
        { id: '5', name: 'immigration' },
        { id: '6', name: 'baggage claim' },
        { id: '7', name: 'customs' },
        { id: '8', name: 'arrivals hall' },
        { id: '9', name: 'pickup and onward transport' },
        { id: '10', name: 'post-arrival' },
        { id: '11', name: 'feedback' },
      ],
    },
    {
      name: 'Transit',
      jtbdBlueprint: 'Make my connection efficiently while staying comfortable and informed.',
      phases: [
        { id: '1', name: 'departure from country of origin' },
        { id: '2', name: 'in-flight' },
        { id: '3', name: 'landing' },
        { id: '4', name: 'disembarkation' },
        { id: '5', name: 'transfer and wayfinding' },
        { id: '6', name: 'security re-screening' },
        { id: '7', name: 'dwell' },
        { id: '8', name: 'lounge' },
        { id: '9', name: 'retail' },
        { id: '10', name: 'gate' },
        { id: '11', name: 'boarding' },
        { id: '12', name: 'in-flight to final destination' },
        { id: '13', name: 'feedback' },
      ],
    },
  ],
};

// Helper to convert TechItem to TechTool for API
const toTechTools = (items: { id: string; name: string; description: string }[]): TechTool[] =>
  items.map(item => ({ id: item.id, value: item.name, purpose: item.description }));

// ============================================================================
// COMPONENTS
// ============================================================================

function Field({
  label,
  hint,
  children,
  num,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  num?: string;
}) {
  return (
    <div className="mb-12">
      <div className="flex items-baseline gap-3 mb-4">
        {num && (
          <span className="font-mono text-[10px] font-bold tracking-tighter uppercase" style={{ color: 'var(--fg-2)' }}>{num}</span>
        )}
        <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: 'var(--fg-1)' }}>{label}</h3>
        {hint && <span className="text-[10px] font-semibold ml-auto uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ExperienceGrid({ value, onChange }: { value: ExperienceType[]; onChange: (v: ExperienceType[]) => void }) {
  const toggle = (id: ExperienceType) => {
    const has = value.includes(id);
    onChange(has ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {EXPERIENCE_TYPES.map((t) => {
        const active = value.includes(t.id);
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className="text-left p-5 rounded-xl cursor-pointer transition-all"
            style={{
              background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
              border: active ? '2px solid var(--accent)' : '1px solid var(--border-1)',
              boxShadow: active ? '0 8px 20px rgba(0,0,0,.12)' : 'none',
              transform: active ? 'scale(1.02)' : 'none',
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{
                background: active ? 'var(--accent)' : 'var(--bg-3)',
                color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
              }}
            >
              <Icon size={20} />
            </div>
            <div className="text-sm font-bold mb-1" style={{ color: 'var(--fg-1)' }}>{t.label}</div>
            <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--fg-2)' }}>{t.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function IndustryField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = INDUSTRIES.filter((i) => i.toLowerCase().includes((q || value).toLowerCase()));

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Theme Parks & Attractions"
        className="w-full rounded-xl py-3.5 px-4 text-sm outline-none transition-all"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border-1)',
          color: 'var(--fg-1)',
        }}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-xl p-1 z-10 max-h-60 overflow-auto"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {filtered.map((i) => (
            <div
              key={i}
              onMouseDown={() => {
                onChange(i);
                setOpen(false);
              }}
              className="py-2.5 px-3 rounded-lg cursor-pointer text-sm transition-colors"
              style={{ color: 'var(--fg-1)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {i}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DescField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the business model, strategic challenge, and customer interaction points..."
        rows={6}
        className="w-full rounded-xl p-4 text-sm outline-none resize-none transition-all"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border-1)',
          color: 'var(--fg-1)',
        }}
      />
      <div
        className="absolute bottom-3 right-3 text-[10px] font-mono font-medium px-2.5 py-1 rounded-lg"
        style={{
          background: value.length > 40 ? 'var(--success)' : 'var(--bg-3)',
          color: value.length > 40 ? 'var(--accent-fg)' : 'var(--fg-3)',
          opacity: value.length > 40 ? 0.9 : 0.7,
        }}
      >
        {value.length} / 400+
      </div>
    </div>
  );
}

function GeneratingOverlay({
  open,
  currentStep,
  steps,
}: {
  open: boolean;
  currentStep: number;
  steps: { label: string; done: boolean }[];
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{
        background: 'color-mix(in srgb, var(--bg-0) 85%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="text-center max-w-[440px]">
        <div
          className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            animation: 'jg-pulse 1.2s ease-in-out infinite',
          }}
        >
          <Sparkles size={26} />
        </div>
        <div className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--fg-1)' }}>
          Generating your journey
        </div>
        <div className="text-sm mb-6" style={{ color: 'var(--fg-2)' }}>
          {steps[currentStep]?.label || 'Processing...'}
        </div>
        <div className="flex flex-col gap-1.5 text-left">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 py-1.5 text-[13px] font-medium transition-opacity"
              style={{
                opacity: i <= currentStep ? 1 : 0.3,
                color: s.done ? 'var(--fg-3)' : 'var(--fg-1)',
                textDecoration: s.done ? 'line-through' : 'none',
              }}
            >
              {s.done ? (
                <Check size={14} style={{ color: 'var(--success)' }} />
              ) : i === currentStep ? (
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              ) : (
                <Circle size={14} style={{ color: 'var(--fg-3)' }} />
              )}
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function BriefPage() {
  const router = useRouter();
  const createModel = useStore((state) => state.createModel);
  const [apiKey] = useApiKey();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [techExpanded, setTechExpanded] = useState(false);

  // Brief upload state. The full parsed text is preserved on
  // briefDoc so we can pass it through to the model on submit;
  // downstream agents read it verbatim for richer context.
  const [briefDoc, setBriefDoc] = useState<BriefDocument | null>(null);
  const [briefBusy, setBriefBusy] = useState<'parsing' | 'extracting' | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefPrefillCount, setBriefPrefillCount] = useState<number | null>(null);
  const briefInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [experienceTypes, setExperienceTypes] = useState<ExperienceType[]>(['marketing']);
  const [industry, setIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  // Tech stack - individual items with name and description
  type TechItem = { id: string; name: string; description: string };
  const [cloudWarehouse, setCloudWarehouse] = useState<TechItem[]>([]);
  const [dataStorage, setDataStorage] = useState<TechItem[]>([]);
  const [crm, setCrm] = useState<TechItem[]>([]);
  const [cdp, setCdp] = useState<TechItem[]>([]);
  const [cep, setCep] = useState<TechItem[]>([]);
  const [dxp, setDxp] = useState<TechItem[]>([]);
  const [aiModels, setAiModels] = useState<TechItem[]>([]);
  const [aiPlatform, setAiPlatform] = useState<TechItem[]>([]);

  // Products
  const [products, setProducts] = useState<Product[]>([]);

  // Personas
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Pain points
  const [painPoints, setPainPoints] = useState('');

  // Channels
  const [channels, setChannels] = useState('');

  // Journeys (required — at least one). Each journey has a name and a
  // JTBD blueprint (one-liner that frames the customer's fundamental
  // motivation for this journey). A brief can describe multiple journeys
  // on the same model (e.g. an airport: Arrival / Transit / Departure),
  // and each journey is generated and explored independently on the
  // workspace page. Ids here are scratch ids; the store re-mints them
  // when the model is created.
  type DraftPhase = { id: string; name: string };
  type DraftJourney = { id: string; name: string; jtbdBlueprint: string; phases: DraftPhase[] };
  const [journeys, setJourneys] = useState<DraftJourney[]>([
    { id: uuidv4(), name: '', jtbdBlueprint: '', phases: [] },
  ]);

  // Auto-generate personas when industry changes
  useEffect(() => {
    const defaultPersonas = INDUSTRY_PERSONAS[industry] || [];
    setPersonas(defaultPersonas.map(label => ({ id: uuidv4(), label })));
  }, [industry]);

  const loadExample = () => {
    setExperienceTypes(DISNEY_EXAMPLE.experienceTypes);
    setIndustry(DISNEY_EXAMPLE.industry);
    setBusinessDescription(DISNEY_EXAMPLE.businessDescription);
    setCloudWarehouse(DISNEY_EXAMPLE.techStack.cloudWarehouse?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setDataStorage(DISNEY_EXAMPLE.techStack.dataStorage?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setCrm(DISNEY_EXAMPLE.techStack.crm?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setCdp(DISNEY_EXAMPLE.techStack.cdp?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setCep(DISNEY_EXAMPLE.techStack.cep?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setDxp(DISNEY_EXAMPLE.techStack.dxp?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setAiModels(DISNEY_EXAMPLE.techStack.aiModels?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setAiPlatform(DISNEY_EXAMPLE.techStack.aiPlatform?.map(t => ({ id: uuidv4(), name: t.value, description: t.purpose || '' })) || []);
    setProducts(DISNEY_EXAMPLE.products);
    setPainPoints(DISNEY_EXAMPLE.painPoints);
    setChannels(DISNEY_EXAMPLE.channels);
    // Disney blueprint doesn't preload phases, but seed a single named
    // journey so the Proceed button is immediately enabled and phases
    // from a previously-loaded example (e.g. Dubai Airport) don't carry
    // over. The user can rename / extend journeys before proceeding.
    setJourneys([
      {
        id: uuidv4(),
        name: 'Guest lifecycle',
        jtbdBlueprint:
          'Plan, book, and live a memorable Disney trip that feels worth every dollar.',
        phases: [],
      },
    ]);
  };

  const loadDubaiAirport = () => {
    setExperienceTypes(DUBAI_AIRPORT_EXAMPLE.experienceTypes);
    setIndustry(DUBAI_AIRPORT_EXAMPLE.industry);
    setBusinessDescription(DUBAI_AIRPORT_EXAMPLE.businessDescription);
    setCloudWarehouse(DUBAI_AIRPORT_EXAMPLE.techStack.cloudWarehouse?.map(t => ({ ...t, id: uuidv4() })) || []);
    setDataStorage(DUBAI_AIRPORT_EXAMPLE.techStack.dataStorage?.map(t => ({ ...t, id: uuidv4() })) || []);
    setCrm([]);
    setCdp(DUBAI_AIRPORT_EXAMPLE.techStack.cdp?.map(t => ({ ...t, id: uuidv4() })) || []);
    setCep([]);
    setDxp(DUBAI_AIRPORT_EXAMPLE.techStack.dxp?.map(t => ({ ...t, id: uuidv4() })) || []);
    setAiModels([]);
    setAiPlatform([]);
    setProducts(DUBAI_AIRPORT_EXAMPLE.products);
    setPainPoints(DUBAI_AIRPORT_EXAMPLE.painPoints);
    setChannels(DUBAI_AIRPORT_EXAMPLE.channels);
    // Load the three airport journeys with phases
    setJourneys(
      DUBAI_AIRPORT_EXAMPLE.journeys.map(j => ({
        id: uuidv4(),
        name: j.name,
        jtbdBlueprint: j.jtbdBlueprint,
        phases: j.phases.map(p => ({ ...p, id: uuidv4() })),
      }))
    );
  };

  const clearForm = () => {
    setExperienceTypes([]);
    setIndustry('');
    setBusinessDescription('');
    setCloudWarehouse([]);
    setDataStorage([]);
    setCrm([]);
    setCdp([]);
    setCep([]);
    setDxp([]);
    setAiModels([]);
    setAiPlatform([]);
    setProducts([]);
    setPersonas([]);
    setPainPoints('');
    setChannels('');
    setJourneys([{ id: uuidv4(), name: '', jtbdBlueprint: '', phases: [] }]);
    setBriefDoc(null);
    setBriefError(null);
    setBriefPrefillCount(null);
  };

  /**
   * Brief upload → parse-file → extract-brief-fields → merge-only-empty.
   *
   * The brief is treated as a *suggestion layer*: we never overwrite a
   * field the user already typed. The full parsed text is also retained
   * on briefDoc so it can ride along on the model and downstream agents
   * (journey-phase-generator, demand-space-generator,
   * discovery-question-generator) read the document verbatim — not just
   * the extracted summary.
   */
  const handleBriefUpload = async (file: File) => {
    if (!apiKey) {
      setBriefError('Add your OpenAI key in the header before uploading a brief.');
      return;
    }
    setBriefError(null);
    setBriefPrefillCount(null);
    setBriefBusy('parsing');
    try {
      // 1. Parse the file (PDF/DOCX/text) → plain text
      const fd = new FormData();
      fd.append('file', file);
      const parseRes = await fetch('/api/parse-file', { method: 'POST', body: fd });
      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}));
        throw new Error(err.error || `Parse failed (${parseRes.status})`);
      }
      const parsed = (await parseRes.json()) as {
        text: string;
        filename: string;
        sizeBytes: number;
        charCount: number;
      };

      const doc: BriefDocument = {
        filename: parsed.filename || file.name,
        text: parsed.text,
        uploadedAt: new Date(),
        sizeBytes: parsed.sizeBytes,
        charCount: parsed.charCount,
      };
      setBriefDoc(doc);

      // 2. Extract structured fields from the parsed text
      setBriefBusy('extracting');
      const extractRes = await fetch('/api/extract-brief-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          text: parsed.text,
          filename: parsed.filename || file.name,
        }),
      });
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error || `Extract failed (${extractRes.status})`);
      }
      const { fields } = (await extractRes.json()) as {
        fields: {
          industry?: string;
          experienceTypes?: ExperienceType[];
          businessDescription?: string;
          painPoints?: string;
          channels?: string[];
          personas?: string[];
          products?: Array<{ name?: string; description?: string }>;
          techStack?: Record<string, Array<{ value?: string; purpose?: string }>>;
          journeys?: Array<{ name?: string; jtbdBlueprint?: string; phases?: string[] }>;
        };
      };

      // 3. Merge only into empty fields. Counts how many fields the
      //    extraction actually populated so the UI can give feedback.
      let prefilled = 0;
      const techMap: Array<[string, React.Dispatch<React.SetStateAction<TechItem[]>>, TechItem[]]> = [
        ['cloudWarehouse', setCloudWarehouse, cloudWarehouse],
        ['dataStorage', setDataStorage, dataStorage],
        ['crm', setCrm, crm],
        ['cdp', setCdp, cdp],
        ['cep', setCep, cep],
        ['dxp', setDxp, dxp],
        ['aiModels', setAiModels, aiModels],
        ['aiPlatform', setAiPlatform, aiPlatform],
      ];

      if (fields.industry && industry.trim() === '') {
        setIndustry(fields.industry);
        prefilled++;
      }
      if (fields.experienceTypes && fields.experienceTypes.length > 0) {
        // Only override if the user is still on the default single 'marketing' selection
        if (experienceTypes.length <= 1) {
          setExperienceTypes(fields.experienceTypes);
          prefilled++;
        }
      }
      if (fields.businessDescription && businessDescription.trim() === '') {
        setBusinessDescription(fields.businessDescription);
        prefilled++;
      }
      if (fields.painPoints && painPoints.trim() === '') {
        setPainPoints(fields.painPoints);
        prefilled++;
      }
      if (fields.channels && fields.channels.length > 0 && channels.trim() === '') {
        setChannels(fields.channels.join(', '));
        prefilled++;
      }
      if (fields.personas && fields.personas.length > 0 && personas.filter(p => p.label.trim()).length === 0) {
        setPersonas(fields.personas.map(label => ({ id: uuidv4(), label })));
        prefilled++;
      }
      if (fields.products && fields.products.length > 0 && products.filter(p => p.name.trim()).length === 0) {
        setProducts(
          fields.products
            .filter(p => p.name && p.name.trim())
            .map(p => ({ id: uuidv4(), name: p.name || '', description: p.description || '' }))
        );
        prefilled++;
      }
      if (fields.techStack) {
        for (const [key, setter, current] of techMap) {
          const items = fields.techStack[key];
          if (items && items.length > 0 && current.length === 0) {
            setter(
              items
                .filter(it => it.value && it.value.trim())
                .map(it => ({ id: uuidv4(), name: it.value || '', description: it.purpose || '' }))
            );
            prefilled++;
          }
        }
      }
      if (
        fields.journeys &&
        fields.journeys.length > 0 &&
        journeys.filter(j => j.name.trim()).length === 0
      ) {
        setJourneys(
          fields.journeys
            .filter(j => j.name && j.name.trim())
            .map(j => ({
              id: uuidv4(),
              name: j.name || '',
              jtbdBlueprint: j.jtbdBlueprint || '',
              phases: (j.phases || []).map(name => ({ id: uuidv4(), name })),
            }))
        );
        prefilled++;
      }

      setBriefPrefillCount(prefilled);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setBriefError(msg);
    } finally {
      setBriefBusy(null);
      if (briefInputRef.current) briefInputRef.current.value = '';
    }
  };

  const addProduct = () => {
    setProducts(prev => [...prev, { id: uuidv4(), name: '', description: '' }]);
  };

  const updateProduct = (id: string, field: 'name' | 'description', value: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addPersona = () => {
    setPersonas(prev => [...prev, { id: uuidv4(), label: '' }]);
  };

  const updatePersona = (id: string, label: string) => {
    setPersonas(prev => prev.map(p => p.id === id ? { ...p, label } : p));
  };

  const removePersona = (id: string) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
  };

  // Tech stack item management
  const addTechItem = (setter: React.Dispatch<React.SetStateAction<TechItem[]>>) => {
    setter(prev => [...prev, { id: uuidv4(), name: '', description: '' }]);
  };

  const updateTechItem = (setter: React.Dispatch<React.SetStateAction<TechItem[]>>, id: string, field: 'name' | 'description', value: string) => {
    setter(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeTechItem = (setter: React.Dispatch<React.SetStateAction<TechItem[]>>, id: string) => {
    setter(prev => prev.filter(item => item.id !== id));
  };

  // Journey management
  const addJourneyDraft = () => {
    setJourneys(prev => [...prev, { id: uuidv4(), name: '', jtbdBlueprint: '', phases: [] }]);
  };

  const updateJourneyDraft = (id: string, field: 'name' | 'jtbdBlueprint', value: string) => {
    setJourneys(prev => prev.map(j => j.id === id ? { ...j, [field]: value } : j));
  };

  const removeJourneyDraft = (id: string) => {
    setJourneys(prev => {
      const next = prev.filter(j => j.id !== id);
      return next.length === 0 ? [{ id: uuidv4(), name: '', jtbdBlueprint: '', phases: [] }] : next;
    });
  };

  // Phase management within journeys
  const addPhase = (journeyId: string) => {
    setJourneys(prev => prev.map(j =>
      j.id === journeyId
        ? { ...j, phases: [...j.phases, { id: uuidv4(), name: '' }] }
        : j
    ));
  };

  const updatePhase = (journeyId: string, phaseId: string, name: string) => {
    setJourneys(prev => prev.map(j =>
      j.id === journeyId
        ? { ...j, phases: j.phases.map(p => p.id === phaseId ? { ...p, name } : p) }
        : j
    ));
  };

  const removePhase = (journeyId: string, phaseId: string) => {
    setJourneys(prev => prev.map(j =>
      j.id === journeyId
        ? { ...j, phases: j.phases.filter(p => p.id !== phaseId) }
        : j
    ));
  };

  // Preload an airport-style brief with Arrival / Transit / Departure so
  // the user can see how multi-journey briefs break down.
  const loadAirportJourneys = () => {
    setJourneys([
      { id: uuidv4(), name: 'Arrival', jtbdBlueprint: 'Get from the curb to my gate without stress or wasted time.', phases: [] },
      { id: uuidv4(), name: 'Transit', jtbdBlueprint: 'Make my layover feel productive, comfortable, and on track.', phases: [] },
      { id: uuidv4(), name: 'Departure', jtbdBlueprint: 'Land, reconnect, and step out into my onward plan smoothly.', phases: [] },
    ]);
  };

  const generationSteps = [
    { label: 'Saving the brief…', done: generationStep > 0 },
    { label: 'Opening your workspace…', done: generationStep > 1 },
  ];

  const handleSubmit = async () => {
    // API key no longer required here — we don't call OpenAI on this
    // page anymore. Each journey is generated on-demand from the
    // workspace, where the key is validated before the fetch.

    setError(null);
    setIsGenerating(true);
    setGenerationStep(0);

    // Build tech stack
    const techStack: TechStack = {
      cloudWarehouse: cloudWarehouse.length > 0 ? toTechTools(cloudWarehouse) : undefined,
      dataStorage: dataStorage.length > 0 ? toTechTools(dataStorage) : undefined,
      crm: crm.length > 0 ? toTechTools(crm) : undefined,
      cdp: cdp.length > 0 ? toTechTools(cdp) : undefined,
      cep: cep.length > 0 ? toTechTools(cep) : undefined,
      dxp: dxp.length > 0 ? toTechTools(dxp) : undefined,
      aiModels: aiModels.length > 0 ? toTechTools(aiModels) : undefined,
      aiPlatform: aiPlatform.length > 0 ? toTechTools(aiPlatform) : undefined,
    };

    const hasTechStack = Object.values(techStack).some(v => v && v.length > 0);

    const input = {
      experienceTypes,
      industry,
      businessDescription,
      techStack: hasTechStack ? techStack : undefined,
      products: products.filter(p => p.name).length > 0 ? products.filter(p => p.name) : undefined,
      personas: personas.filter(p => p.label).length > 0 ? personas.filter(p => p.label) : undefined,
      painPoints: painPoints || undefined,
      channels: channels ? channels.split(',').map(c => c.trim()).filter(Boolean) : undefined,
      briefDocument: briefDoc || undefined,
    };

    // Normalize journeys: drop empty rows, fall back to a single default
    // if the user somehow wiped them all. Names get trimmed; blueprints
    // are optional but preserved verbatim. Preloaded phases (from
    // examples like Dubai Airport, or typed by the user into the brief)
    // are carried through to the store so the workspace renders them
    // instead of asking for another round of generation.
    const cleanJourneys = journeys
      .map(j => ({
        name: j.name.trim(),
        jtbdBlueprint: j.jtbdBlueprint.trim(),
        phases: j.phases
          .map(p => ({ label: p.name.trim() }))
          .filter(p => p.label.length > 0),
      }))
      .filter(j => j.name.length > 0);
    const journeySeeds = cleanJourneys.length > 0
      ? cleanJourneys
      : [{ name: 'Journey', jtbdBlueprint: '', phases: [] }];

    // Create model + journeys + any preloaded phases in one shot.
    // Journeys without preloaded phases are generated per-journey from
    // the workspace.
    setGenerationStep(1);
    const modelId = createModel(input, journeySeeds);

    setGenerationStep(2);
    setTimeout(() => {
      router.push(`/model/${modelId}`);
    }, 350);
  };

  const isValid =
    experienceTypes.length > 0 &&
    industry.trim() !== '' &&
    businessDescription.trim().length > 40 &&
    journeys.some(j => j.name.trim().length > 0);

  // Keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isValid) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isValid, experienceTypes, industry, businessDescription, journeys]);

  const techCount = [cloudWarehouse, dataStorage, crm, cdp, cep, dxp, aiModels, aiPlatform]
    .reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <AppHeader currentStep="brief" />

      <main className="min-h-screen pb-40">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="max-w-[780px] mx-auto pt-24 px-6">
          <div className="mb-20">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest mb-6"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles size={12} /> New Project Brief
            </div>
            <h1
              className="text-[54px] font-extrabold leading-[1.05] tracking-[-0.035em] mb-6"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-1)' }}
            >
              What journey are we <br />
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)' }} className="pr-2">making sense of</span>?
            </h1>
            <p className="text-lg leading-relaxed max-w-[560px]" style={{ color: 'var(--fg-2)' }}>
              We'll synthesize journey phases, demand spaces, and circumstances from your brief — then you'll shape them on a canvas.
            </p>
          </div>

          {/* Brief Upload */}
          <div
            className="mb-4 p-5 rounded-xl"
            style={{
              background: briefDoc ? 'var(--accent-soft)' : 'var(--bg-2)',
              border: briefDoc ? '1px solid var(--accent)' : '1px dashed var(--border-2)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: briefDoc ? 'var(--accent)' : 'var(--bg-3)',
                  color: briefDoc ? 'var(--accent-fg)' : 'var(--fg-2)',
                }}
              >
                {briefDoc ? <FileText size={20} /> : <Upload size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--fg-1)' }}>
                  {briefDoc ? briefDoc.filename : 'Have a brief? Upload it.'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--fg-2)' }}>
                  {briefDoc ? (
                    <>
                      {Math.round(briefDoc.charCount / 1000)}k chars parsed
                      {briefPrefillCount !== null && (
                        <> · {briefPrefillCount} field{briefPrefillCount === 1 ? '' : 's'} pre-filled (review below)</>
                      )}
                    </>
                  ) : (
                    'PDF, DOCX, or text. We extract structured fields and pre-fill empty form sections — your typed values are never overwritten.'
                  )}
                </div>
              </div>
              <input
                ref={briefInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBriefUpload(f);
                }}
                className="hidden"
              />
              {briefDoc ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => briefInputRef.current?.click()}
                    disabled={!!briefBusy}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors"
                    style={{ background: 'var(--bg-3)', color: 'var(--fg-1)' }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBriefDoc(null);
                      setBriefError(null);
                      setBriefPrefillCount(null);
                    }}
                    disabled={!!briefBusy}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--fg-3)' }}
                    aria-label="Remove brief"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => briefInputRef.current?.click()}
                  disabled={!!briefBusy}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all flex-shrink-0"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    opacity: briefBusy ? 0.6 : 1,
                    cursor: briefBusy ? 'wait' : 'pointer',
                  }}
                >
                  {briefBusy === 'parsing' ? (
                    <><Loader2 size={14} className="animate-spin" /> Parsing…</>
                  ) : briefBusy === 'extracting' ? (
                    <><Loader2 size={14} className="animate-spin" /> Extracting…</>
                  ) : (
                    <><Upload size={14} /> Upload Brief</>
                  )}
                </button>
              )}
            </div>
            {briefError && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-[11px] font-medium"
                style={{ background: 'var(--danger-soft, var(--bg-3))', color: 'var(--danger)' }}
              >
                {briefError}
              </div>
            )}
          </div>

          {/* Quick Start Bar */}
          <div
            className="flex items-center gap-3 mb-16 p-2 rounded-xl"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
          >
            <div className="text-[10px] font-black uppercase tracking-widest pl-4" style={{ color: 'var(--fg-3)' }}>
              Quick Start:
            </div>
            <button
              type="button"
              onClick={loadExample}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all"
              style={{ background: 'var(--bg-3)', color: 'var(--fg-1)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            >
              <Zap size={14} style={{ color: 'var(--warn)' }} /> Load Disney Blueprint
            </button>
            <button
              type="button"
              onClick={loadDubaiAirport}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all"
              style={{ background: 'var(--bg-3)', color: 'var(--fg-1)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            >
              <Zap size={14} style={{ color: 'var(--warn)' }} /> Load Dubai Airport Blueprint
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-colors"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
            >
              Clear All
            </button>
          </div>

          <Field num="01" label="What are we mapping?" hint="Pick one or more">
            <ExperienceGrid value={experienceTypes} onChange={setExperienceTypes} />
          </Field>

          <Field num="02" label="Industry or category">
            <IndustryField value={industry} onChange={setIndustry} />
          </Field>

          <Field num="03" label="Business & challenge" hint="40+ words">
            <DescField value={businessDescription} onChange={setBusinessDescription} />
          </Field>

          {/* Tech Stack (collapsible) */}
          <div className="mb-12">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-mono text-[10px] font-bold tracking-tighter uppercase" style={{ color: 'var(--fg-2)' }}>04</span>
              <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: 'var(--fg-1)' }}>Tech Stack</h3>
              <span className="text-[10px] font-semibold ml-auto uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>Optional</span>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
            >
              <button
                type="button"
                onClick={() => setTechExpanded(!techExpanded)}
                className="w-full flex items-center gap-4 p-5 text-left transition-all"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-3)', color: 'var(--fg-2)' }}
                >
                  {techExpanded ? <Layers size={18} /> : <FolderOpen size={18} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--fg-1)' }}>Configure Stack</span>
                    {techCount > 0 && (
                      <span className="chip chip--accent">{techCount}</span>
                    )}
                  </div>
                  <div className="text-xs font-medium" style={{ color: 'var(--fg-3)' }}>
                    Cloud Warehouse, CRM, CDP, and AI Platform configurations
                  </div>
                </div>
                <span style={{ color: 'var(--fg-3)' }}>
                  {techExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>

              {techExpanded && (
                <div className="p-6 space-y-6" style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-1)' }}>
                  {/* Cloud Warehouse */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Cloud Warehouse</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setCloudWarehouse)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cloudWarehouse.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setCloudWarehouse, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {CLOUD_WAREHOUSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setCloudWarehouse, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setCloudWarehouse, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Data Storage */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Data Storage</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setDataStorage)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {dataStorage.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setDataStorage, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {DATA_STORAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setDataStorage, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setDataStorage, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CRM */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>CRM</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setCrm)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {crm.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setCrm, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {CRM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setCrm, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setCrm, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CDP */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>CDP</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setCdp)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cdp.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setCdp, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {CDP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setCdp, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setCdp, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CEP */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>CEP</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setCep)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cep.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setCep, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {CEP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setCep, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setCep, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DXP */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>DXP</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setDxp)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {dxp.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setDxp, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {DXP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setDxp, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setDxp, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Models */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>AI Models</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setAiModels)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiModels.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setAiModels, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {AI_MODEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setAiModels, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setAiModels, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Platform */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>AI Platform</span>
                      <button
                        type="button"
                        onClick={() => addTechItem(setAiPlatform)}
                        className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={12} className="inline mr-1" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiPlatform.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <select
                            value={item.name}
                            onChange={(e) => updateTechItem(setAiPlatform, item.id, 'name', e.target.value)}
                            className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          >
                            <option value="">Select...</option>
                            {AI_PLATFORM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTechItem(setAiPlatform, item.id, 'description', e.target.value)}
                            placeholder="Used for..."
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTechItem(setAiPlatform, item.id)}
                            className="p-2 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          <Field num="05" label="Products / Channels" hint="Key ecosystem assets">
            <div className="space-y-3 mb-4">
              {products.map((product) => (
                <div key={product.id} className="flex gap-3 items-center group/item">
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                    placeholder="Name"
                    className="w-1/3 rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                  />
                  <input
                    type="text"
                    value={product.description}
                    onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="p-2 transition-colors"
                    style={{ color: 'var(--fg-3)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addProduct}
              className="btn btn--ghost btn--sm"
            >
              <Plus size={16} /> Add Product
            </button>
          </Field>

          {/* Personas */}
          <Field num="06" label="Target Personas" hint="Auto-generated from industry">
            <div className="flex flex-wrap gap-2 mb-4">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className="flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full text-sm font-medium"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
                >
                  <input
                    type="text"
                    value={persona.label}
                    onChange={(e) => updatePersona(persona.id, e.target.value)}
                    placeholder="Persona name"
                    className="bg-transparent outline-none w-32"
                    style={{ color: 'var(--fg-1)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removePersona(persona.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                    style={{ color: 'var(--fg-3)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--danger)';
                      e.currentTarget.style.color = 'var(--accent-fg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--fg-3)';
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPersona}
                className="w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center transition-all"
                style={{ borderColor: 'var(--border-1)', color: 'var(--fg-3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-1)';
                  e.currentTarget.style.color = 'var(--fg-3)';
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </Field>

          {/* Pain Points */}
          <Field num="07" label="Known Pain Points" hint="One per line">
            <textarea
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              placeholder="Long wait times cause frustration&#10;Booking system is confusing..."
              className="w-full rounded-xl p-4 text-sm outline-none min-h-[120px] transition-all resize-none"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
            />
          </Field>

          {/* Channels */}
          <Field num="08" label="Primary Channels" hint="Comma-separated">
            <input
              type="text"
              value={channels}
              onChange={(e) => setChannels(e.target.value)}
              placeholder="Email, SMS, Push, In-App, Web"
              className="w-full rounded-xl py-3.5 px-4 text-sm outline-none transition-all"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
            />
          </Field>

          {/* Journeys (required — at least one) */}
          <div className="mb-12">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-[10px] font-bold tracking-tighter uppercase" style={{ color: 'var(--fg-2)' }}>09</span>
              <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: 'var(--fg-1)' }}>Journeys</h3>
              <button
                type="button"
                onClick={loadAirportJourneys}
                className="ml-auto text-[10px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: 'var(--fg-3)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
              >
                + Airport example
              </button>
            </div>
            <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--fg-3)' }}>
              One brief can cover several journeys on the same model — e.g. Arrival, Transit, Departure for an airport. Each journey has its own JTBD blueprint and is generated independently in the workspace.
            </p>

            <div className="space-y-4">
              {journeys.map((j, index) => (
                <div
                  key={j.id}
                  className="p-5 rounded-xl"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                      Journey {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeJourneyDraft(j.id)}
                      className="cursor-pointer transition-colors"
                      style={{ color: 'var(--fg-3)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                      aria-label="Remove journey"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={j.name}
                    onChange={(e) => updateJourneyDraft(j.id, 'name', e.target.value)}
                    placeholder="Name (e.g. Arrival)"
                    className="w-full mb-3 text-sm font-bold pb-2 outline-none bg-transparent"
                    style={{ borderBottom: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                  />
                  <textarea
                    value={j.jtbdBlueprint}
                    onChange={(e) => updateJourneyDraft(j.id, 'jtbdBlueprint', e.target.value)}
                    placeholder="Pre-discovery JTBD blueprint — one-liner framing the customer's fundamental motivation for this journey"
                    className="w-full text-xs p-3 rounded-lg border-none outline-none resize-none mb-4"
                    style={{ background: 'var(--bg-3)', color: 'var(--fg-2)' }}
                    rows={2}
                  />

                  {/* Phases */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                        Phases
                      </span>
                      <button
                        type="button"
                        onClick={() => addPhase(j.id)}
                        className="text-xs font-bold px-2 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                      >
                        <Plus size={10} className="inline mr-1" /> Add Phase
                      </button>
                    </div>
                    <div className="space-y-2">
                      {j.phases.map((phase) => (
                        <div key={phase.id} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) => updatePhase(j.id, phase.id, e.target.value)}
                            placeholder="Phase name"
                            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removePhase(j.id, phase.id)}
                            className="p-1.5 transition-colors"
                            style={{ color: 'var(--fg-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addJourneyDraft}
                className="w-full py-4 rounded-xl border-2 border-dashed text-xs font-bold transition-all"
                style={{ borderColor: 'var(--border-1)', color: 'var(--fg-3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-3)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-1)';
                  e.currentTarget.style.color = 'var(--fg-3)';
                }}
              >
                <Plus size={14} className="inline mr-2" /> Add Journey
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 mb-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Footer Island Bar */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-[840px] px-6 z-[100]">
            <div
              className="p-4 rounded-2xl flex items-center justify-between gap-6"
              style={{
                backdropFilter: 'blur(20px)',
                background: 'color-mix(in srgb, var(--bg-1) 92%, transparent)',
                border: '1px solid var(--border-1)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex-1 pl-6">
                <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>
                  Status
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--fg-2)' }}>
                  {isValid ? (
                    <span className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
                      />
                      {(() => {
                        const count = journeys.filter(j => j.name.trim().length > 0).length;
                        return count === 1
                          ? 'Ready — 1 journey to generate'
                          : `Ready — ${count} journeys to generate`;
                      })()}
                    </span>
                  ) : (
                    <span className="opacity-50 italic">Add industry, description, and at least one journey to enable...</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={clearForm}
                  className="px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors"
                  style={{ color: 'var(--fg-3)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={!isValid || isGenerating}
                  className="group flex items-center gap-3 px-10 py-4 rounded-xl font-black text-xs tracking-[0.1em] transition-all"
                  style={{
                    background: isValid ? 'var(--accent)' : 'var(--bg-3)',
                    color: isValid ? 'var(--accent-fg)' : 'var(--fg-3)',
                    cursor: isValid ? 'pointer' : 'not-allowed',
                    opacity: isValid ? 1 : 0.5,
                  }}
                >
                  <Zap size={16} />
                  PROCEED
                  <span
                    className="px-2 py-0.5 rounded-md text-[9px] ml-1"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    ⌘↵
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>

      <GeneratingOverlay open={isGenerating} currentStep={generationStep} steps={generationSteps} />
    </div>
  );
}
