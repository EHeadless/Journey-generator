import { NextRequest, NextResponse } from 'next/server';
import { generateWithRetry } from '@/lib/openai';
import { Model, MapPersonasResponse } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// Read the persona-mapper agent instructions
const AGENT_INSTRUCTIONS = fs.readFileSync(
  path.join(process.cwd(), '.claude/agents/persona-mapper.md'),
  'utf-8'
);

export async function POST(request: NextRequest) {
  try {
    const body: {
      model: Model;
      apiKey?: string;
    } = await request.json();

    const { model, apiKey } = body;

    console.log('Mapping personas to demand spaces and circumstances');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!model || !model.input.personas || model.input.personas.length === 0) {
      return NextResponse.json(
        { error: 'No personas to map' },
        { status: 400 }
      );
    }

    // Build the prompt with full model context
    const prompt = `
Industry: ${model.input.industry}
Business Description: ${model.input.businessDescription}

Target Personas:
${JSON.stringify(model.input.personas, null, 2)}

Journey Phases:
${JSON.stringify(model.journeyPhases, null, 2)}

Demand Spaces:
${JSON.stringify(model.demandSpaces, null, 2)}

Circumstances:
${JSON.stringify(
  model.circumstances.map(c => ({
    id: c.id,
    demandSpaceId: c.demandSpaceId,
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
  })),
  null,
  2
)}

Based on the above context, map each persona to the demand spaces they care about and the circumstances that describe them.
`;

    const parsed = await generateWithRetry<MapPersonasResponse>(
      prompt,
      AGENT_INSTRUCTIONS,
      apiKey
    );

    console.log('Persona mapping response:', parsed);

    // Validate the response structure
    if (!parsed.personaMappings || !Array.isArray(parsed.personaMappings)) {
      throw new Error('Invalid response structure: missing personaMappings array');
    }

    const totalPhases = model.journeyPhases.length;
    const phaseIds = new Set(model.journeyPhases.map(p => p.id));

    // Validate each mapping (phase-structured)
    for (const mapping of parsed.personaMappings) {
      if (!mapping.personaId) {
        throw new Error('Invalid mapping: missing personaId');
      }

      if (!mapping.mappingsByPhase || !Array.isArray(mapping.mappingsByPhase)) {
        throw new Error(`Invalid mapping for persona ${mapping.personaId}: missing mappingsByPhase array`);
      }

      // CRITICAL: Ensure every phase is covered
      if (mapping.mappingsByPhase.length !== totalPhases) {
        throw new Error(
          `Persona ${mapping.personaId} is missing phase coverage. ` +
          `Expected ${totalPhases} phases, got ${mapping.mappingsByPhase.length}`
        );
      }

      // Validate each phase mapping
      const mappedPhaseIds = new Set<string>();
      for (const phaseMapping of mapping.mappingsByPhase) {
        if (!phaseMapping.phaseId || !phaseIds.has(phaseMapping.phaseId)) {
          throw new Error(`Invalid phaseId: ${phaseMapping.phaseId}`);
        }

        if (mappedPhaseIds.has(phaseMapping.phaseId)) {
          throw new Error(`Duplicate phase mapping for phaseId: ${phaseMapping.phaseId}`);
        }
        mappedPhaseIds.add(phaseMapping.phaseId);

        if (!Array.isArray(phaseMapping.demandSpaceIds) || phaseMapping.demandSpaceIds.length === 0) {
          throw new Error(`Phase ${phaseMapping.phaseId} has no demand spaces for persona ${mapping.personaId}`);
        }

        if (!Array.isArray(phaseMapping.circumstanceIds) || phaseMapping.circumstanceIds.length === 0) {
          throw new Error(`Phase ${phaseMapping.phaseId} has no circumstances for persona ${mapping.personaId}`);
        }
      }

      // Ensure ALL phases are present
      for (const phaseId of phaseIds) {
        if (!mappedPhaseIds.has(phaseId)) {
          throw new Error(`Persona ${mapping.personaId} is missing mapping for phase ${phaseId}`);
        }
      }
    }

    console.log('✓ Persona mappings validated: All personas have complete phase coverage');
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error mapping personas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to map personas' },
      { status: 500 }
    );
  }
}
