---
name: demand-space-generator
description: Generates demand spaces (Jobs to Be Done) with circumstances for a specific journey phase.
---

## What this skill does

Generates 8-12 demand spaces (Jobs to Be Done) for a specific journey phase. Each demand space includes:
- A label (2-4 words)
- A Job to Be Done statement (When I... I want... So that...)
- 5-10 circumstances (short labels describing situational factors)

## The "Remove the Product" Test

Every demand space MUST pass this test:
> If you remove the company's product entirely, does the demand space still exist?

- ✅ "Planned Family Holiday" — exists whether or not Miral has an app
- ✅ "Live Comfortably Without Friction" — exists whether or not the property has a portal
- ❌ "I want the app to enhance my visit" — does NOT exist without the app

## Quality Criteria

### MUST produce:
- 8-12 demand spaces per journey phase
- **Label**: Short label (2-4 words) that evokes the human motivation
- **Job to Be Done**: "When I [situation], I want to [action], so that [outcome]"
- **Circumstances**: 5-10 short labels (2-6 words each) describing situational factors that modify how this demand space should be fulfilled

### MUST NOT produce:
- Product features disguised as motivations ("I want the app to...")
- UX requirements ("Seamless experience", "Easy checkout")
- Use cases ("Book a ticket", "Check my balance")
- Generic motivations that apply to everyone ("Save money", "Be happy")

## Good Examples

### Theme Park - Pre-Arrival Phase:

```json
{
  "label": "Planned Family Holiday",
  "jobToBeDone": "When I have school holidays coming up, I want to create lasting memories with my kids, so that we bond as a family and they have amazing childhood experiences",
  "circumstances": [
    "First-time visitor",
    "Parents with toddlers",
    "Multi-generational group",
    "Traveling with teens",
    "Birthday celebration",
    "Budget-conscious family",
    "International tourist",
    "Special needs child"
  ]
}
```

```json
{
  "label": "Thrill-Seeking Escape",
  "jobToBeDone": "When I need a break from routine, I want to experience adrenaline and excitement, so that I feel alive and have stories to tell",
  "circumstances": [
    "Solo thrill-seeker",
    "Group of friends",
    "Height-anxious companion",
    "First-time at park",
    "Annual pass holder",
    "Competitive about rides",
    "Limited time available"
  ]
}
```

### Real Estate - In-Life Phase:

```json
{
  "label": "Live Without Friction",
  "jobToBeDone": "When something breaks or needs attention in my home, I want it resolved quickly and painlessly, so that I can focus on living my life",
  "circumstances": [
    "Working from home",
    "Elderly resident",
    "Tenant with pets",
    "First-time renter",
    "Frequent traveler",
    "Non-English speaker",
    "Has accessibility needs"
  ]
}
```

## Bad Examples (REJECT these patterns)

| Bad Example | Why it's bad | What to generate instead |
|-------------|--------------|-------------------------|
| "I want to track my maintenance request" | Product feature, not motivation | "Live Without Friction" |
| "Seamless booking experience" | UX requirement | "Spontaneous Day Out" |
| "I want the app to help me plan" | Fails remove-the-product test | "Stress-Free Arrival" |
| Long circumstance descriptions | Should be 2-6 word labels | "First-time visitor" |

## Circumstance Quality Rules

Circumstances should be:
1. **Short labels** (2-6 words) — e.g., "Budget traveler", NOT "A person who is concerned about spending too much money"
2. **Person or situation descriptors** — describe WHO they are or WHAT situation they're in
3. **Universal enough** to apply to this demand space regardless of product
4. **Specific enough** to change how the business should respond

Common circumstance types:
- **Personal**: First-timer, VIP, Expat, Elderly
- **Group**: Solo, Couple, Family with kids, Large group
- **Economic**: Budget-conscious, Luxury spender, Strict per diem
- **Temporal**: Running late, Has extra time, Jet-lagged, Celebrating
- **Accessibility**: Wheelchair user, Visually impaired, Dietary restrictions
- **Crisis**: Lost child, Medical issue, Missed connection

## Output Format

Return a JSON array with 8-12 objects:

```json
[
  {
    "label": "2-4 Word Label",
    "jobToBeDone": "When I [situation], I want to [action], so that [outcome]",
    "circumstances": [
      "Short label 1",
      "Short label 2",
      "Short label 3"
    ]
  }
]
```

## Prompt Template

You are generating demand spaces (Jobs to Be Done) with circumstances for a behavioral strategy model.

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Experience Type:** {{experienceType}}
**Journey Phase:** {{journeyPhase.label}}
**Phase Description:** {{journeyPhase.description}}
{{#if personaContext}}
**Persona Context:** {{personaContext}}
{{/if}}

Generate 8-12 demand spaces that represent the HUMAN MOTIVATIONS that bring customers into this journey phase.

For EACH demand space, also generate 5-10 circumstances — short labels (2-6 words) describing situational factors that would change HOW this demand space should be fulfilled.

CRITICAL: Every demand space must pass the "remove the product" test:
> If you remove this company's product entirely, does the motivation still exist?

Requirements for Demand Spaces:
1. Label must be 2-4 evocative words (NOT "I want to...")
2. Job to Be Done follows: "When I [situation], I want to [action], so that [outcome]"
3. Each demand space must be distinct — no overlapping motivations
4. Think about the HUMAN NEED, not what the product does

Requirements for Circumstances:
1. Each circumstance is a SHORT LABEL (2-6 words)
2. Describe WHO the person is or WHAT SITUATION they're in
3. Include a mix: personal, group, economic, temporal, accessibility, crisis
4. Circumstances should change how the business responds to this demand space

Return ONLY valid JSON array, no other text.
