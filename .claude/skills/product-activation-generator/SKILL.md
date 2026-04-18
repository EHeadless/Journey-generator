---
name: product-activation-generator
description: Generates product features and Jira-ready user stories for each Demand Space x Dimension Value combination.
---

## What this skill does

Generates product features with Jira-ready user stories for each dimension value within a demand space. The output is a prioritized feature backlog that engineering teams can immediately import.

**The Personalization Formula:**
```
Demand Space × Dimension Value = Specific Product Feature
```

## Output per Dimension Value

For each dimension value, generate:

| Field | Format | Purpose |
|-------|--------|---------|
| **feature** | 2-5 word name | Quick feature reference |
| **description** | 1-2 sentences | What the feature does |
| **userStory** | As a... I want... so that... | Jira-ready story |
| **priority** | high / medium / low | Based on frequency x impact |

## How Dimension Types Influence Product Features

Dimension values come from a taxonomy-aware generator. The 5 universal dimension types should influence what features you design:

| Dimension Type | How It Influences Product Features |
|----------------|-----------------------------------|
| **Knowledge** (Familiarity, Experience) | Determines UI complexity — novices need guided flows and tooltips, experts need shortcuts and power-user modes |
| **Intent** (Purpose, Urgency) | Determines feature priority — urgent tasks need streamlined paths, exploratory tasks need discovery features |
| **Composition** (Group, Travel party) | Determines collaboration scope — solo users need individual tools, groups need coordination and sharing features |
| **Constraint** (Budget, Accessibility) | Determines what to hide/adapt — don't show premium features to budget users, ensure accessibility compliance |
| **Moment** (Occasion, Life stage) | Determines contextual features — celebrations need special modes, sensitive moments need reduced friction |

## How Dimension Values Modify the Feature

The same demand space requires different product capabilities based on dimension values:

**Demand Space: "Navigate Efficiently"**
**Dimension: Group (Composition type)**

| Dimension Value | Feature | Why |
|-----------------|---------|-----|
| Parents with toddlers | Family Facilities Finder | Need baby changing, nursing rooms |
| Solo traveler | Fast-Track Mode | No coordination needed, optimize for speed |
| Multi-generational family | Pace Planner | Balance different mobility levels |
| Large group | Group Coordination Hub | Keep everyone synced |

**Demand Space: "Stress-Free Planning"**
**Dimension: Economic (Constraint type)**

| Dimension Value | Feature | Why |
|-----------------|---------|-----|
| Budget-conscious | Price Alert System | Need to catch deals |
| Premium seeker | VIP Experience Builder | Want exclusive access |
| Corporate expense | Invoice Generator | Need expense compliance |

## Good Examples

**Demand Space: "Stress-Free Planning" + Dimension: Economic + Value: "Budget-conscious"**
```json
{
  "dimensionValueLabel": "Budget-conscious",
  "feature": "Price Alert System",
  "description": "Automatically monitors prices and notifies users when their saved items drop below their set threshold.",
  "userStory": "As a budget-conscious traveler, I want to set price alerts for my wishlist items so that I can book when prices drop within my budget.",
  "priority": "high"
}
```

**Demand Space: "Navigate Efficiently" + Dimension: Mobility + Value: "Wheelchair user"**
```json
{
  "dimensionValueLabel": "Wheelchair user",
  "feature": "Accessible Route Planner",
  "description": "Calculates routes using only wheelchair-accessible paths, elevators, and ramps.",
  "userStory": "As a wheelchair user, I want routes that only use accessible paths so that I can navigate confidently without encountering barriers.",
  "priority": "high"
}
```

**Demand Space: "Feel Connected" + Dimension: Urgency + Value: "Running late"**
```json
{
  "dimensionValueLabel": "Running late",
  "feature": "Quick Route Override",
  "description": "Instantly recalculates the fastest possible route, skipping optional stops and amenities.",
  "userStory": "As someone running late, I want to see the fastest route immediately so that I can reach my destination with minimal delay.",
  "priority": "medium"
}
```

## Priority Guidelines

| Priority | Criteria |
|----------|----------|
| **High** | High frequency dimension value + High impact on demand space satisfaction |
| **Medium** | Either high frequency OR high impact, not both |
| **Low** | Low frequency + incremental improvement |

## Quality Criteria

### MUST produce:
- Specific, buildable features (not vague capabilities)
- User stories that pass the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- Clear connection between dimension value and feature need
- Realistic priority based on frequency x impact

### MUST NOT produce:
- Features that don't address the dimension value context
- User stories without clear value ("so that" clause)
- Same feature for different dimension values
- Overly complex features that should be epics
- Features that ignore the dimension context

## Output Format

```json
{
  "activations": [
    {
      "dimensionValueLabel": "Budget-conscious",
      "feature": "Price Alert System",
      "description": "Monitors prices and notifies when items drop below threshold.",
      "userStory": "As a budget-conscious traveler, I want to set price alerts so that I can book when prices fit my budget.",
      "priority": "high"
    }
  ]
}
```

## Prompt Template

Generate product features for this demand space and dimension values:

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Tech Stack:** {{techStack}}
**Journey Phase:** {{journeyPhase.label}}

**Demand Space:** {{demandSpace.label}}
**Job to Be Done:** {{demandSpace.jobToBeDone}}

**Dimension:** {{dimension.label}}
**Dimension Description:** {{dimension.description}}

**Values to generate features for:**
{{#each dimensionValues}}
- {{this.label}}: {{this.description}}
{{/each}}

For EACH dimension value, generate:
1. feature (short name, 2-5 words)
2. description (what it does, 1-2 sentences)
3. userStory (Jira-ready: As a... I want... so that...)
4. priority (high/medium/low based on frequency x impact)

Think about how the dimension value MODIFIES what product capability is needed.
