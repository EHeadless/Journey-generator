'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { ExperienceType, JourneyPhase } from '@/lib/types';

// Default Disney example for testing
const DISNEY_EXAMPLE = {
  experienceType: 'marketing' as ExperienceType,
  industry: 'Theme Parks & Attractions',
  businessDescription: 'Walt Disney World is a world-renowned destination resort in Orlando, Florida, comprising four theme parks (Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom), two water parks, and numerous resort hotels. The challenge is maximizing guest lifetime value by driving multi-day stays, encouraging park-hopping behavior, and increasing per-guest spend on dining, merchandise, and premium experiences like Genie+ and Lightning Lane. Many guests treat visits as once-in-a-lifetime rather than repeatable traditions.',
  personaContext: 'US families with children, International tourists, Annual Passholders, Disney Adults',
  painPoints: 'High perceived cost, overwhelming planning complexity, long wait times, difficulty booking popular experiences, inconsistent mobile app experience',
  channels: 'Email, SMS, Push, My Disney Experience App, Web, MagicBand, In-Park Digital',
};

const EXPERIENCE_TYPES: { value: ExperienceType; label: string; color: string; bgColor: string; icon: React.ReactNode }[] = [
  {
    value: 'marketing',
    label: 'Marketing',
    color: '#2e5bff',
    bgColor: 'bg-[#2e5bff]/5',
    icon: <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/></svg>,
  },
  {
    value: 'product',
    label: 'Product',
    color: '#4ade80',
    bgColor: 'bg-[#4ade80]/5',
    icon: <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>,
  },
  {
    value: 'service',
    label: 'Service',
    color: '#a855f7',
    bgColor: 'bg-[#a855f7]/5',
    icon: <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M18 11.03A6.04 6.04 0 0012.05 6c-3.03 0-6.29 2.51-6.03 6.45a8.075 8.075 0 004.86-5.89c1.31 2.63 4 4.44 7.12 4.47z"/></svg>,
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

export default function InputForm() {
  const router = useRouter();
  const createModel = useStore((state) => state.createModel);
  const setJourneyPhases = useStore((state) => state.setJourneyPhases);

  // Initialize with Disney example
  const [experienceType, setExperienceType] = useState<ExperienceType>(DISNEY_EXAMPLE.experienceType);
  const [industry, setIndustry] = useState(DISNEY_EXAMPLE.industry);
  const [customIndustry, setCustomIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState(DISNEY_EXAMPLE.businessDescription);
  const [personaContext, setPersonaContext] = useState(DISNEY_EXAMPLE.personaContext);
  const [painPoints, setPainPoints] = useState(DISNEY_EXAMPLE.painPoints);
  const [channels, setChannels] = useState(DISNEY_EXAMPLE.channels);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExample = () => {
    setExperienceType(DISNEY_EXAMPLE.experienceType);
    setIndustry(DISNEY_EXAMPLE.industry);
    setCustomIndustry('');
    setBusinessDescription(DISNEY_EXAMPLE.businessDescription);
    setPersonaContext(DISNEY_EXAMPLE.personaContext);
    setPainPoints(DISNEY_EXAMPLE.painPoints);
    setChannels(DISNEY_EXAMPLE.channels);
  };

  const clearForm = () => {
    setExperienceType('marketing');
    setIndustry('');
    setCustomIndustry('');
    setBusinessDescription('');
    setPersonaContext('');
    setPainPoints('');
    setChannels('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const finalIndustry = industry === 'Other' ? customIndustry : industry;

    const input = {
      experienceType,
      industry: finalIndustry,
      businessDescription,
      personaContext: personaContext || undefined,
      painPoints: painPoints || undefined,
      channels: channels ? channels.split(',').map(c => c.trim()).filter(Boolean) : undefined,
    };

    const modelId = createModel(input);

    // Auto-generate journey phases
    try {
      const response = await fetch('/api/generate-journey-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const data = await response.json();
        setJourneyPhases(data.journeyPhases);
      }
    } catch (err) {
      console.error('Failed to auto-generate journey phases:', err);
    }

    router.push(`/model/${modelId}`);
  };

  const isValid =
    experienceType &&
    (industry && (industry !== 'Other' || customIndustry)) &&
    businessDescription.length >= 50;

  const selectedType = EXPERIENCE_TYPES.find(t => t.value === experienceType);

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

      {/* Experience Type */}
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-[0.15em] text-[#c4c5d9]/50">
          1. Experience Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {EXPERIENCE_TYPES.map((type) => (
            <label key={type.value} className="relative cursor-pointer group">
              <input
                type="radio"
                name="exp_type"
                checked={experienceType === type.value}
                onChange={() => setExperienceType(type.value)}
                className="peer sr-only"
              />
              <div
                className={`bg-[#1b1b1b] p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center ${
                  experienceType === type.value
                    ? `border-[${type.color}] ${type.bgColor}`
                    : 'border-transparent hover:border-[#434656]/30'
                }`}
                style={{
                  borderColor: experienceType === type.value ? type.color : undefined,
                  backgroundColor: experienceType === type.value ? `${type.color}08` : undefined,
                }}
              >
                <span
                  className="mb-2 transition-transform group-hover:scale-110"
                  style={{ color: type.color }}
                >
                  {type.icon}
                </span>
                <span className="font-bold text-sm">{type.label}</span>
              </div>
            </label>
          ))}
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
        {businessDescription.length > 0 && businessDescription.length < 50 && (
          <p className="text-xs text-[#ffb4ab]">Minimum 50 characters required</p>
        )}
      </div>

      {/* Optional Fields - More Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Persona Context */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-[#c4c5d9]/40">
            Target Persona <span className="font-normal opacity-50">(Optional)</span>
          </label>
          <input
            type="text"
            value={personaContext}
            onChange={(e) => setPersonaContext(e.target.value)}
            placeholder="e.g. Gen-Z Digital Nomads"
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30"
          />
        </div>

        {/* Pain Points */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-[#c4c5d9]/40">
            Known Pain Points <span className="font-normal opacity-50">(Optional)</span>
          </label>
          <input
            type="text"
            value={painPoints}
            onChange={(e) => setPainPoints(e.target.value)}
            placeholder="e.g. Long wait times, poor UX"
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30"
          />
        </div>

        {/* Channels */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-[#c4c5d9]/40">
            Channels <span className="font-normal opacity-50">(Optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={channels}
            onChange={(e) => setChannels(e.target.value)}
            placeholder="e.g. Email, SMS, Push, In-App, Web"
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30"
          />
        </div>
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
      </div>
    </form>
  );
}
