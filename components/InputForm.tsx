'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { ExperienceType, TechStack, TechTool, Product, Persona } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import ComboboxMulti, { SelectionWithPurpose } from './ComboboxMulti';

// ============================================================================
// TOOL OPTIONS - Comprehensive lists for each tech category
// ============================================================================

const CLOUD_WAREHOUSE_OPTIONS = [
  'Snowflake',
  'Google BigQuery',
  'Amazon Redshift',
  'Databricks',
  'Azure Synapse Analytics',
  'Teradata',
  'Vertica',
  'ClickHouse',
  'Firebolt',
  'Dremio',
  'Starburst',
  'SingleStore',
];

const DATA_STORAGE_OPTIONS = [
  'AWS S3',
  'Azure Blob Storage',
  'Google Cloud Storage',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Amazon DynamoDB',
  'Azure Cosmos DB',
  'Redis',
  'Elasticsearch',
  'Cassandra',
  'Oracle Database',
  'Microsoft SQL Server',
  'Supabase',
  'PlanetScale',
  'CockroachDB',
];

const CRM_OPTIONS = [
  'Salesforce Sales Cloud',
  'Salesforce Service Cloud',
  'HubSpot CRM',
  'Microsoft Dynamics 365',
  'Zoho CRM',
  'Pipedrive',
  'Freshsales',
  'Monday Sales CRM',
  'Copper',
  'Insightly',
  'SugarCRM',
  'Zendesk Sell',
  'Close',
  'Keap',
  'Nimble',
];

const CDP_OPTIONS = [
  'Segment',
  'mParticle',
  'Tealium AudienceStream',
  'Adobe Real-Time CDP',
  'Salesforce Data Cloud',
  'Amperity',
  'Treasure Data',
  'BlueConic',
  'Lytics',
  'ActionIQ',
  'Simon Data',
  'Twilio Segment',
  'Rudderstack',
  'Hightouch',
  'Census',
];

const CEP_OPTIONS = [
  'Braze',
  'Salesforce Marketing Cloud',
  'Adobe Campaign',
  'Emarsys',
  'Iterable',
  'Klaviyo',
  'Customer.io',
  'Attentive',
  'Insider',
  'MoEngage',
  'CleverTap',
  'Airship',
  'OneSignal',
  'Pushwoosh',
  'Leanplum',
  'Cordial',
  'Ometria',
  'Dotdigital',
];

const DXP_OPTIONS = [
  'Adobe Experience Manager',
  'Optimizely',
  'Sitecore',
  'Contentful',
  'Contentstack',
  'Sanity',
  'Strapi',
  'Acquia',
  'Bloomreach',
  'Magnolia',
  'Liferay',
  'Episerver',
  'Kentico',
  'Progress Sitefinity',
  'Uniform',
  'Netlify',
  'Vercel',
];

const AI_MODEL_OPTIONS = [
  'GPT-4o',
  'GPT-4',
  'GPT-3.5 Turbo',
  'Claude 3.5 Sonnet',
  'Claude 3 Opus',
  'Claude 3 Haiku',
  'Gemini 1.5 Pro',
  'Gemini 1.5 Flash',
  'Llama 3.1 405B',
  'Llama 3.1 70B',
  'Mistral Large',
  'Mistral Medium',
  'Cohere Command R+',
  'Amazon Titan',
  'Anthropic Claude (via API)',
  'OpenAI (via API)',
];

const AI_PLATFORM_OPTIONS = [
  'Azure AI Foundry',
  'Azure OpenAI Service',
  'AWS Bedrock',
  'Google Vertex AI',
  'OpenAI Platform',
  'Anthropic API',
  'Hugging Face',
  'Databricks ML',
  'Snowflake Cortex',
  'Cohere',
  'AI21 Labs',
  'Replicate',
  'Modal',
  'Fireworks AI',
  'Together AI',
  'Anyscale',
];

// ============================================================================
// INDUSTRY PERSONAS
// ============================================================================

const INDUSTRY_PERSONAS: Record<string, string[]> = {
  'Theme Parks & Attractions': [
    'US families with children',
    'International tourists',
    'Annual Passholders',
    'Disney Adults (no kids)',
    'School/youth groups',
    'Corporate event planners',
  ],
  'Hospitality & Hotels': [
    'Business travelers',
    'Leisure couples',
    'Families with kids',
    'Group travelers',
    'Loyalty members',
    'Event attendees',
  ],
  'Airlines & Aviation': [
    'Frequent business flyers',
    'Budget leisure travelers',
    'Premium cabin seekers',
    'Family vacationers',
    'First-time flyers',
    'Connecting passengers',
  ],
  'Real Estate & Property': [
    'First-time homebuyers',
    'Luxury buyers',
    'Investors',
    'Renters',
    'Downsizers',
    'Relocating professionals',
  ],
  'Retail & E-commerce': [
    'Deal hunters',
    'Brand loyalists',
    'Impulse buyers',
    'Research-heavy buyers',
    'Gift shoppers',
    'Subscription customers',
  ],
  'Financial Services': [
    'Young professionals',
    'High-net-worth individuals',
    'Small business owners',
    'Retirees',
    'First-time investors',
    'Debt consolidators',
  ],
  'Healthcare': [
    'Chronic condition managers',
    'Preventive care seekers',
    'Caregivers',
    'New patients',
    'Elderly patients',
    'Parents with children',
  ],
  'Telecommunications': [
    'Heavy data users',
    'Family plan managers',
    'Budget-conscious switchers',
    'Tech enthusiasts',
    'Business accounts',
    'Senior users',
  ],
  'Quick Service Restaurant': [
    'Lunch rush workers',
    'Families with kids',
    'Late-night diners',
    'Health-conscious eaters',
    'Loyalty app users',
    'Delivery-only customers',
  ],
  'Automotive': [
    'First-time car buyers',
    'Luxury seekers',
    'Family vehicle shoppers',
    'EV curious',
    'Fleet managers',
    'Used car shoppers',
  ],
};

// ============================================================================
// DEFAULT EXAMPLE
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
    aiModels: [
      { id: '7', value: 'GPT-4o', purpose: 'Conversational AI & recommendations' },
      { id: '8', value: 'Claude 3.5 Sonnet', purpose: 'Content generation' },
    ],
    aiPlatform: [{ id: '9', value: 'Azure OpenAI Service', purpose: 'Enterprise AI deployment' }],
  } as TechStack,
  products: [
    { id: '1', name: 'My Disney Experience App', description: 'Mobile app for park navigation, dining reservations, Genie+ bookings, and MagicBand management' },
    { id: '2', name: 'DisneyWorld.com', description: 'Primary website for trip planning, ticket purchases, and resort bookings' },
    { id: '3', name: 'In-Park Kiosks', description: 'Self-service kiosks for dining orders, PhotoPass, and Lightning Lane purchases' },
  ] as Product[],
  painPoints: 'High perceived cost limits repeat visits\nOverwhelming planning complexity deters first-timers\nLong wait times cause frustration on-site\nDifficulty booking popular dining and experiences\nInconsistent mobile app experience across park areas',
  channels: 'Email, SMS, Push, In-App, Web, MagicBand',
};

const EXPERIENCE_TYPES: { value: ExperienceType; label: string; color: string; icon: React.ReactNode }[] = [
  {
    value: 'marketing',
    label: 'Marketing',
    color: '#2e5bff',
    icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/></svg>,
  },
  {
    value: 'product',
    label: 'Product',
    color: '#4ade80',
    icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>,
  },
  {
    value: 'service',
    label: 'Service',
    color: '#a855f7',
    icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M18 11.03A6.04 6.04 0 0012.05 6c-3.03 0-6.29 2.51-6.03 6.45a8.075 8.075 0 004.86-5.89c1.31 2.63 4 4.44 7.12 4.47z"/></svg>,
  },
];

const INDUSTRIES = [
  'Theme Parks & Attractions',
  'Hospitality & Hotels',
  'Airlines & Aviation',
  'Real Estate & Property',
  'Retail & E-commerce',
  'Financial Services',
  'Healthcare',
  'Telecommunications',
  'Quick Service Restaurant',
  'Automotive',
  'Other',
];

// Helper to convert SelectionWithPurpose to TechTool
const toTechTools = (selections: SelectionWithPurpose[]): TechTool[] =>
  selections.map(s => ({ id: s.id, value: s.value, purpose: s.purpose }));

// Helper to convert TechTool to SelectionWithPurpose
const toSelections = (tools: TechTool[] | undefined): SelectionWithPurpose[] =>
  tools?.map(t => ({ id: t.id, value: t.value, purpose: t.purpose })) || [];

export default function InputForm() {
  const router = useRouter();
  const createModel = useStore((state) => state.createModel);
  const setJourneyPhases = useStore((state) => state.setJourneyPhases);

  // Form state
  const [experienceTypes, setExperienceTypes] = useState<ExperienceType[]>(DISNEY_EXAMPLE.experienceTypes);
  const [industry, setIndustry] = useState(DISNEY_EXAMPLE.industry);
  const [customIndustry, setCustomIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState(DISNEY_EXAMPLE.businessDescription);

  // Tech stack - each field is an array of selections
  const [cloudWarehouse, setCloudWarehouse] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.cloudWarehouse));
  const [dataStorage, setDataStorage] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.dataStorage));
  const [crm, setCrm] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.crm));
  const [cdp, setCdp] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.cdp));
  const [cep, setCep] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.cep));
  const [dxp, setDxp] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.dxp));
  const [aiModels, setAiModels] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.aiModels));
  const [aiPlatform, setAiPlatform] = useState<SelectionWithPurpose[]>(toSelections(DISNEY_EXAMPLE.techStack.aiPlatform));

  // Products
  const [products, setProducts] = useState<Product[]>(DISNEY_EXAMPLE.products);

  // Personas (auto-generated, editable)
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Pain points
  const [painPoints, setPainPoints] = useState(DISNEY_EXAMPLE.painPoints);

  // Channels
  const [channels, setChannels] = useState(DISNEY_EXAMPLE.channels);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate personas when industry changes
  useEffect(() => {
    const finalIndustry = industry === 'Other' ? customIndustry : industry;
    const defaultPersonas = INDUSTRY_PERSONAS[finalIndustry] || [];
    setPersonas(defaultPersonas.map(label => ({ id: uuidv4(), label })));
  }, [industry, customIndustry]);

  const toggleExperienceType = (type: ExperienceType) => {
    setExperienceTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
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

  const loadExample = () => {
    setExperienceTypes(DISNEY_EXAMPLE.experienceTypes);
    setIndustry(DISNEY_EXAMPLE.industry);
    setCustomIndustry('');
    setBusinessDescription(DISNEY_EXAMPLE.businessDescription);
    setCloudWarehouse(toSelections(DISNEY_EXAMPLE.techStack.cloudWarehouse));
    setDataStorage(toSelections(DISNEY_EXAMPLE.techStack.dataStorage));
    setCrm(toSelections(DISNEY_EXAMPLE.techStack.crm));
    setCdp(toSelections(DISNEY_EXAMPLE.techStack.cdp));
    setCep(toSelections(DISNEY_EXAMPLE.techStack.cep));
    setDxp(toSelections(DISNEY_EXAMPLE.techStack.dxp));
    setAiModels(toSelections(DISNEY_EXAMPLE.techStack.aiModels));
    setAiPlatform(toSelections(DISNEY_EXAMPLE.techStack.aiPlatform));
    setProducts(DISNEY_EXAMPLE.products);
    setPainPoints(DISNEY_EXAMPLE.painPoints);
    setChannels(DISNEY_EXAMPLE.channels);
  };

  const clearForm = () => {
    setExperienceTypes([]);
    setIndustry('');
    setCustomIndustry('');
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const finalIndustry = industry === 'Other' ? customIndustry : industry;

    // Build tech stack from selections
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
      industry: finalIndustry,
      businessDescription,
      techStack: hasTechStack ? techStack : undefined,
      products: products.filter(p => p.name).length > 0 ? products.filter(p => p.name) : undefined,
      personas: personas.filter(p => p.label).length > 0 ? personas.filter(p => p.label) : undefined,
      painPoints: painPoints || undefined,
      channels: channels ? channels.split(',').map(c => c.trim()).filter(Boolean) : undefined,
    };

    const modelId = createModel(input);

    // Auto-generate journey phases against the default journey seeded by
    // createModel. (This legacy InputForm isn't imported from anywhere in
    // the current app; kept so the file still compiles under the
    // multi-journey data model.)
    try {
      const response = await fetch('/api/generate-journey-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const data = await response.json();
        const defaultJourneyId = useStore.getState().model?.journeys?.[0]?.id;
        if (defaultJourneyId) {
          setJourneyPhases(defaultJourneyId, data.journeyPhases);
        }
      }
    } catch (err) {
      console.error('Failed to auto-generate journey phases:', err);
    }

    router.push(`/model/${modelId}`);
  };

  const isValid = experienceTypes.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Example Controls */}
      <div className="flex items-center gap-3 p-4 bg-[#1b1b1b] rounded-xl border border-[#434656]/20">
        <span className="text-xs text-[#c4c5d9]/50 uppercase tracking-wider font-medium">Quick Start:</span>
        <button
          type="button"
          onClick={loadExample}
          className="px-3 py-1.5 text-xs font-medium bg-[#2e5bff]/20 text-[#b8c3ff] rounded-lg hover:bg-[#2e5bff]/30 transition-colors"
        >
          Load Disney Example
        </button>
        <button
          type="button"
          onClick={clearForm}
          className="px-3 py-1.5 text-xs font-medium bg-[#434656]/20 text-[#c4c5d9]/70 rounded-lg hover:bg-[#434656]/30 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Experience Type - Multi-select */}
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          1. Experience Type <span className="font-normal opacity-50">(select all that apply)</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {EXPERIENCE_TYPES.map((type) => {
            const isSelected = experienceTypes.includes(type.value);
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => toggleExperienceType(type.value)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center ${
                  isSelected
                    ? 'border-current'
                    : 'border-transparent bg-[#1b1b1b] hover:border-[#434656]/30'
                }`}
                style={{
                  borderColor: isSelected ? type.color : undefined,
                  backgroundColor: isSelected ? `${type.color}10` : undefined,
                  color: isSelected ? type.color : '#c4c5d9',
                }}
              >
                <span className={`mb-2 transition-transform ${isSelected ? 'scale-110' : ''}`}>
                  {type.icon}
                </span>
                <span className="font-bold text-sm">{type.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 mt-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Industry */}
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          2. Vertical
        </label>
        <div className="relative">
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-5 py-4 appearance-none focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-base font-medium text-[#e2e2e2]"
          >
            <option value="" className="text-[#c4c5d9]/50">Select an industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          <svg className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none w-5 h-5 text-[#c4c5d9]/50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        {industry === 'Other' && (
          <input
            type="text"
            value={customIndustry}
            onChange={(e) => setCustomIndustry(e.target.value)}
            placeholder="Enter your industry..."
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-base placeholder:text-[#c4c5d9]/30"
          />
        )}
      </div>

      {/* Business Description */}
      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
            3. Strategy Brief
          </label>
          <span className="text-xs font-mono text-[#c4c5d9]/30">
            {businessDescription.length} chars
          </span>
        </div>
        <textarea
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          placeholder="Describe the core business challenge and current behavioral barriers..."
          rows={4}
          className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-base placeholder:text-[#c4c5d9]/30 resize-none"
        />
      </div>

      {/* Tech Stack */}
      <div className="space-y-4">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          4. Tech Stack <span className="font-normal opacity-50">(Optional - searchable, multi-select)</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ComboboxMulti
            label="Cloud Warehouse / Data Lake"
            options={CLOUD_WAREHOUSE_OPTIONS}
            selections={cloudWarehouse}
            onChange={setCloudWarehouse}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Snowflake, BigQuery..."
          />

          <ComboboxMulti
            label="Data Storage"
            options={DATA_STORAGE_OPTIONS}
            selections={dataStorage}
            onChange={setDataStorage}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search AWS S3, PostgreSQL..."
          />

          <ComboboxMulti
            label="CRM"
            options={CRM_OPTIONS}
            selections={crm}
            onChange={setCrm}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Salesforce, HubSpot..."
          />

          <ComboboxMulti
            label="CDP (Customer Data Platform)"
            options={CDP_OPTIONS}
            selections={cdp}
            onChange={setCdp}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Segment, mParticle..."
          />

          <ComboboxMulti
            label="CEP (Customer Engagement Platform)"
            options={CEP_OPTIONS}
            selections={cep}
            onChange={setCep}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Braze, SFMC, Emarsys..."
          />

          <ComboboxMulti
            label="DXP (Digital Experience Platform)"
            options={DXP_OPTIONS}
            selections={dxp}
            onChange={setDxp}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Adobe AEM, Optimizely..."
          />

          <ComboboxMulti
            label="AI Models"
            options={AI_MODEL_OPTIONS}
            selections={aiModels}
            onChange={setAiModels}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search GPT-4, Claude, Gemini..."
          />

          <ComboboxMulti
            label="AI Platform / Infrastructure"
            options={AI_PLATFORM_OPTIONS}
            selections={aiPlatform}
            onChange={setAiPlatform}
            showPurpose
            purposePlaceholder="Used for..."
            placeholder="Search Azure AI, Bedrock, Vertex..."
          />
        </div>
      </div>

      {/* Products */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
            5. Products / Channels <span className="font-normal opacity-50">(Optional)</span>
          </label>
          <button
            type="button"
            onClick={addProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2e5bff]/20 text-[#b8c3ff] rounded-lg hover:bg-[#2e5bff]/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                  placeholder="Product name (e.g., Mobile App)"
                  className="bg-[#1b1b1b] border border-[#434656]/30 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30"
                />
                <input
                  type="text"
                  value={product.description}
                  onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                  placeholder="Description of what this product does..."
                  className="md:col-span-2 bg-[#1b1b1b] border border-[#434656]/30 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProduct(product.id)}
                className="p-2 text-[#c4c5d9]/40 hover:text-[#ffb4ab] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-[#c4c5d9]/30 italic">No products added. Click "+ Add Product" to add one.</p>
          )}
        </div>
      </div>

      {/* Target Personas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
            6. Target Personas <span className="font-normal opacity-50">(Auto-generated, editable)</span>
          </label>
          <button
            type="button"
            onClick={addPersona}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2e5bff]/20 text-[#b8c3ff] rounded-lg hover:bg-[#2e5bff]/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Persona
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center gap-2 bg-[#1b1b1b] border border-[#434656]/30 rounded-lg pl-3 pr-1 py-1"
            >
              <input
                type="text"
                value={persona.label}
                onChange={(e) => updatePersona(persona.id, e.target.value)}
                placeholder="Persona..."
                className="bg-transparent border-none focus:outline-none text-sm text-[#e2e2e2] placeholder:text-[#c4c5d9]/30 w-40"
              />
              <button
                type="button"
                onClick={() => removePersona(persona.id)}
                className="p-1 text-[#c4c5d9]/40 hover:text-[#ffb4ab] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {personas.length === 0 && (
            <p className="text-sm text-[#c4c5d9]/30 italic">Select a vertical to auto-generate personas.</p>
          )}
        </div>
      </div>

      {/* Pain Points - Textarea */}
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          7. Known Pain Points <span className="font-normal opacity-50">(Optional)</span>
        </label>
        <textarea
          value={painPoints}
          onChange={(e) => setPainPoints(e.target.value)}
          placeholder="Enter pain points, one per line...&#10;&#10;Example:&#10;Long wait times cause frustration&#10;Booking system is confusing&#10;Mobile app crashes frequently"
          rows={5}
          className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-base placeholder:text-[#c4c5d9]/30 resize-none"
        />
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          8. Channels <span className="font-normal opacity-50">(Optional, comma-separated)</span>
        </label>
        <input
          type="text"
          value={channels}
          onChange={(e) => setChannels(e.target.value)}
          placeholder="e.g., Email, SMS, Push, In-App, Web"
          className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-base placeholder:text-[#c4c5d9]/30"
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
            isValid && !isSubmitting
              ? 'bg-[#2e5bff] text-white hover:brightness-110'
              : 'bg-[#353535] text-[#8e90a2] cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Initializing...' : 'Initialize Modeling Engine'}
        </button>
        {!isValid && (
          <p className="text-xs text-[#ffb4ab] mt-2 text-center">Select at least one experience type to continue</p>
        )}
      </div>
    </form>
  );
}
