// Core types for Journey Generator

export type ExperienceType = 'product' | 'marketing' | 'service';

export interface JourneyPhase {
  id: string;
  label: string;
  description: string;
  trigger: string; // What event marks entry into this phase
  order: number;
}

export interface DemandSpace {
  id: string;
  journeyPhaseId: string;
  label: string; // 2-4 words
  jobToBeDone: string; // "When I [situation], I want to [action], so that [outcome]"
  description?: string; // Optional 2-3 sentences (kept for backwards compatibility)
  order: number;
}

// Dimensions are named axes of customer context
// They change HOW a demand space should be fulfilled
export interface DimensionValue {
  id: string;
  dimensionId: string;
  label: string; // e.g., "First-time visitor", "Budget-conscious"
  description: string; // What this value means
  impact: string; // How this changes what we do
  order: number;
}

export interface Dimension {
  id: string;
  demandSpaceId: string;
  label: string; // e.g., "Familiarity", "Group", "Economic"
  description: string; // What this axis represents
  values: DimensionValue[];
  order: number;
}

// Legacy: Keep Circumstance for backwards compatibility during migration
export interface Circumstance {
  id: string;
  demandSpaceId: string;
  label: string;
  order: number;
}

// Tech stack tool with purpose
export interface TechTool {
  id: string;
  value: string;     // Tool name
  purpose?: string;  // What this tool is used for
}

// Tech stack structured input - each field supports multiple selections
export interface TechStack {
  cloudWarehouse?: TechTool[];     // e.g., Snowflake, BigQuery, Redshift, Databricks
  dataStorage?: TechTool[];        // e.g., AWS S3, Azure Blob, PostgreSQL, MongoDB
  crm?: TechTool[];                // e.g., Salesforce, HubSpot, Microsoft Dynamics
  cdp?: TechTool[];                // e.g., Segment, mParticle, Tealium, Adobe CDP
  cep?: TechTool[];                // e.g., Braze, Emarsys, SFMC, Iterable
  dxp?: TechTool[];                // e.g., Optimizely, Adobe Experience Manager, Sitecore
  aiModels?: TechTool[];           // e.g., GPT-4, Claude, Gemini, Llama
  aiPlatform?: TechTool[];         // e.g., Azure AI Foundry, AWS Bedrock, Vertex AI
}

// Product/channel with description
export interface Product {
  id: string;
  name: string;        // e.g., "Mobile App", "Website", "Kiosk"
  description: string; // What this product/channel does
}

// Target persona
export interface Persona {
  id: string;
  label: string;       // e.g., "Budget-conscious families"
}

export interface ModelInput {
  experienceTypes: ExperienceType[];  // Now supports multiple selection
  industry: string;
  businessDescription: string;
  techStack?: TechStack;
  products?: Product[];
  channels?: string[];
  personas?: Persona[];
  painPoints?: string;  // Now a textarea (multi-line)
}

// Activation types - what to do for each Demand Space × Dimension Value combination

// Marketing: 6 CRM levers
export interface MarketingActivation {
  id: string;
  demandSpaceId: string;
  dimensionValueId: string; // Changed from circumstanceId
  messageDepth: string; // awareness, consideration, action
  urgency: string; // low, medium, high
  channel: string; // email, SMS, push, in-app, etc.
  tone: string; // informative, empathetic, urgent, celebratory
  offer: string; // what to offer
  cadence: string; // frequency and timing
}

// Product: Features that become user stories
export interface ProductActivation {
  id: string;
  demandSpaceId: string;
  dimensionValueId: string; // Changed from circumstanceId
  feature: string; // feature name
  description: string; // what it does
  userStory: string; // As a... I want... So that...
  priority: 'high' | 'medium' | 'low';
}

// Service: Agent tools and knowledge
export interface ServiceActivation {
  id: string;
  demandSpaceId: string;
  dimensionValueId: string; // Changed from circumstanceId
  tools: string; // tools/systems to use
  knowledge: string; // knowledge articles to surface
  c360Signals: string; // customer 360 data points to show
  handoffRules: string; // when/how to escalate or transfer
}

export interface Model {
  id: string;
  input: ModelInput;
  journeyPhases: JourneyPhase[];
  demandSpaces: DemandSpace[];
  dimensions: Dimension[]; // New: dimensions per demand space
  circumstances: Circumstance[]; // Legacy: keep for backwards compatibility
  marketingActivations: MarketingActivation[];
  productActivations: ProductActivation[];
  serviceActivations: ServiceActivation[];
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface GenerateJourneyPhasesResponse {
  journeyPhases: Omit<JourneyPhase, 'id' | 'order'>[];
}

// Demand spaces response - no longer includes circumstances
export interface GenerateDemandSpacesResponse {
  demandSpaces: {
    label: string;
    jobToBeDone: string;
    description?: string;
  }[];
}

// Dimensions response - for generating dimensions per demand space × phase
export interface GenerateDimensionsResponse {
  dimensions: {
    label: string;
    description: string;
    values: {
      label: string;
      description: string;
      impact: string;
    }[];
  }[];
}

// Activation response types
export interface GenerateMarketingActivationsResponse {
  activations: {
    dimensionValueLabel: string;
    messageDepth: string;
    urgency: string;
    channel: string;
    tone: string;
    offer: string;
    cadence: string;
  }[];
}

export interface GenerateProductActivationsResponse {
  activations: {
    dimensionValueLabel: string;
    feature: string;
    description: string;
    userStory: string;
    priority: string;
  }[];
}

export interface GenerateServiceActivationsResponse {
  activations: {
    dimensionValueLabel: string;
    tools: string;
    knowledge: string;
    c360Signals: string;
    handoffRules: string;
  }[];
}
