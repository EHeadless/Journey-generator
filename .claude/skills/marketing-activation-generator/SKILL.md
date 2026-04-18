---
name: marketing-activation-generator
description: Generates CRM marketing activations for each Demand Space x Dimension Value combination.
---

## What this skill does

Generates marketing activations using the 6 CRM levers for each dimension value within a demand space. The output is a CRM journey that can be built in Emarsys, Braze, or SFMC.

**The Personalization Formula:**
```
Demand Space × Dimension Value = Specific CRM Activation
```

## The 6 CRM Levers

For each dimension value, generate:

| Lever | Options | What it controls |
|-------|---------|-----------------|
| **messageDepth** | awareness / consideration / action | Where in the funnel to focus |
| **urgency** | low / medium / high | How time-sensitive the message should be |
| **channel** | email / SMS / push / in-app | Primary communication channel |
| **tone** | informative / empathetic / urgent / celebratory / reassuring | Message personality |
| **offer** | Deals, features, content to highlight | What value to present |
| **cadence** | Timing and frequency | When and how often to send |

## How Dimension Types Influence CRM Activations

Dimension values come from a taxonomy-aware generator. The 5 universal dimension types should influence how you craft activations:

| Dimension Type | How It Influences CRM Activation |
|----------------|----------------------------------|
| **Knowledge** (Familiarity, Experience) | Adjust education level — first-timers need more explanation, experts need efficiency |
| **Intent** (Purpose, Urgency) | Adjust tone and stakes — urgent vs. casual, functional vs. emotional messaging |
| **Composition** (Group, Travel party) | Adjust who you address — individual vs. group, buyer vs. user, decision-maker vs. participant |
| **Constraint** (Budget, Accessibility) | Adjust what you show — suppress irrelevant offers, adapt content to limitations |
| **Moment** (Occasion, Life stage) | Adjust timing and emotional register — celebratory for birthdays, sensitive for bereavement |

## How Dimension Values Modify Activation

The same demand space gets different CRM treatment based on dimension values:

**Demand Space: "Stress-Free Planning"**
**Dimension: Economic (Constraint type)**

| Dimension Value | Key Modifications |
|-----------------|-------------------|
| Budget-conscious | Medium urgency, price alerts, weekly deals digest |
| Premium seeker | Exclusive access, luxury packages, personalized concierge |
| Corporate expense | Invoice-ready pricing, bulk options, compliance docs |

**Demand Space: "Build Anticipation"**
**Dimension: Familiarity (Knowledge type)**

| Dimension Value | Key Modifications |
|-----------------|-------------------|
| First-timer | Low urgency, reassuring tone, educational drip |
| Returning guest | Medium urgency, "what's new" focus, preference reminders |
| Annual passholder | High urgency on exclusive access, insider tips |

## Good Examples

**Demand Space: "Build Anticipation" + Dimension: Familiarity + Value: "First-time visitor"**
```json
{
  "dimensionValueLabel": "First-time visitor",
  "messageDepth": "awareness",
  "urgency": "low",
  "channel": "email",
  "tone": "reassuring",
  "offer": "What to expect guides, FAQs, customer stories",
  "cadence": "Drip sequence: 7, 3, 1 days before"
}
```

**Demand Space: "Feel Recognized" + Dimension: Loyalty + Value: "VIP member"**
```json
{
  "dimensionValueLabel": "VIP member",
  "messageDepth": "action",
  "urgency": "high",
  "channel": "SMS",
  "tone": "exclusive",
  "offer": "Private access, dedicated host contact, skip-the-line",
  "cadence": "Immediate confirmation, 24hr before reminder"
}
```

**Demand Space: "Navigate Efficiently" + Dimension: Urgency + Value: "Running late"**
```json
{
  "dimensionValueLabel": "Running late",
  "messageDepth": "action",
  "urgency": "high",
  "channel": "push",
  "tone": "urgent",
  "offer": "Quick routes, skip-the-line options, time-saving tips",
  "cadence": "Immediate single touch"
}
```

## Quality Criteria

### MUST produce:
- All 6 levers for each dimension value
- Specific channel recommendations (not "omnichannel")
- Actionable cadence (timing, triggers, frequency)
- Offers that make sense for the dimension value
- Clear connection between dimension value and activation changes

### MUST NOT produce:
- Generic "personalized messaging" without specifics
- Same activation for different dimension values
- Channels that don't match the urgency
- Vague cadence like "as needed"
- Activations that ignore the dimension context

## Output Format

```json
{
  "activations": [
    {
      "dimensionValueLabel": "Budget-conscious",
      "messageDepth": "consideration",
      "urgency": "medium",
      "channel": "email",
      "tone": "helpful",
      "offer": "Price drop alerts, budget-friendly packages, payment plans",
      "cadence": "Trigger on price drop, weekly deals digest"
    }
  ]
}
```

## Prompt Template

Generate marketing activations for this demand space and dimension values:

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Journey Phase:** {{journeyPhase.label}}

**Demand Space:** {{demandSpace.label}}
**Job to Be Done:** {{demandSpace.jobToBeDone}}

**Dimension:** {{dimension.label}}
**Dimension Description:** {{dimension.description}}

**Values to generate activations for:**
{{#each dimensionValues}}
- {{this.label}}: {{this.description}}
{{/each}}

For EACH dimension value, generate the 6 CRM levers:
1. messageDepth (awareness/consideration/action)
2. urgency (low/medium/high)
3. channel (email/SMS/push/in-app/etc.)
4. tone (informative/empathetic/urgent/celebratory/reassuring/etc.)
5. offer (what to highlight or offer)
6. cadence (frequency and timing)

Think about how the dimension value MODIFIES how you'd communicate for this demand space.
