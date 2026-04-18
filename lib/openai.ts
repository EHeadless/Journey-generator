import OpenAI from 'openai';

export async function generateWithRetry<T>(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  maxRetries = 2
): Promise<T> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const openai = new OpenAI({ apiKey });
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse and validate JSON
      const parsed = JSON.parse(content);

      // Handle both array responses and wrapped responses
      if (Array.isArray(parsed)) {
        return parsed as T;
      }

      // Check for common wrapper keys
      if (parsed.journeyPhases) return parsed.journeyPhases as T;
      if (parsed.demandSpaces) return parsed.demandSpaces as T;
      if (parsed.categories) return parsed.categories as T;
      if (parsed.circumstances) return parsed.circumstances as T;
      if (parsed.activations) return parsed.activations as T;
      if (parsed.phases) return parsed.phases as T;
      if (parsed.spaces) return parsed.spaces as T;
      if (parsed.data) return parsed.data as T;
      if (parsed.results) return parsed.results as T;

      // If it's an object with items array
      if (parsed.items && Array.isArray(parsed.items)) {
        return parsed.items as T;
      }

      // Return as-is if none of the above
      return parsed as T;
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Generation failed');
}
