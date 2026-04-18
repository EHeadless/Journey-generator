---
name: dimension-generator
description: Generates dimensions (named axes of customer context) with values for a demand space × journey phase crossing.
---

## What this skill does

Generates 3-5 **dimensions** with 2-4 **values** each for a specific demand space within a journey phase. Dimensions are named axes of customer context that change HOW a demand space should be fulfilled.

**The Personalization Formula:**
```
Demand Space × Dimension Value = Specific Activation
```

## Universal Dimension Types (The Taxonomy)

Every dimension you generate should be an **industry-specific instance** of one of these 5 universal types. The types are the thinking framework; the labels are what the strategist sees.

### 1. Knowledge (The Friction Dimension)
**Definition:** The gap between the user's current mental model and the expert path. How much does this person already know about the product, place, process, or category?

| Industry | Example Dimension Labels | Example Values |
|----------|-------------------------|----------------|
| Banking | Financial literacy | First-time homebuyer (high education need), Seasoned day trader (high speed need) |
| SaaS/AI | Technical proficiency | Non-technical manager (needs templates/GUI), Engineer (needs API docs/CLI) |
| Healthcare | Condition familiarity | Patient managing chronic condition (expert), Sudden acute injury (panicked novice) |
| Theme park | Familiarity | First-time visitor (needs wayfinding), Annual passholder (wants what's new) |
| E-commerce | Brand familiarity | New to brand (needs social proof), Repeat buyer (wants quick reorder) |

### 2. Intent (The Stakes Dimension)
**Definition:** The urgency, emotional weight, and definition of success for this specific interaction. What's at stake right now?

| Industry | Example Dimension Labels | Example Values |
|----------|-------------------------|----------------|
| Travel/Aviation | Trip purpose | High-stakes board meeting (reliability, WiFi), Long-saved family vacation (experience, joy) |
| Retail/E-commerce | Purchase context | Replenishing essentials (efficiency), Gifting (curation, wrapping, social proof) |
| Real Estate | Buying motivation | Buying a home (emotional, safe), Buying an asset (yield, data-driven) |
| Theme park | Visit occasion | Birthday celebration (make it special), Casual weekend visit (low-key fun) |
| Healthcare | Visit urgency | Routine checkup (efficiency), Scary new diagnosis (empathy, information) |

### 3. Composition (The Ecosystem Dimension)
**Definition:** The social or technical environment surrounding the user during the job. Who or what is around them?

| Industry | Example Dimension Labels | Example Values |
|----------|-------------------------|----------------|
| Media/Streaming | Viewing context | Watching solo (personalized, niche), Co-viewing with partner (finding middle ground) |
| Automotive | Passenger context | Driving a commute (solo, efficiency), School run (multi-passenger, safety) |
| B2B Software | User role | Individual contributor (task-level), Decision maker (dashboard, org-level) |
| Theme park | Group | Solo thrill-seeker, Multi-generational family, Corporate team-building |
| Airport | Travel party | Solo business traveler, Family with kids and luggage, Elderly couple needing assistance |

### 4. Constraint (The Limitation Dimension)
**Definition:** External factors limiting what's possible right now. What's outside the person's control that the business must account for?

| Industry | Example Dimension Labels | Example Values |
|----------|-------------------------|----------------|
| Theme park | Accessibility | Wheelchair user, Stroller-dependent, Height-restricted child, Extreme heat day |
| Aviation | Travel constraints | Tight connection (15min), Visa restriction, Oversized luggage, Language barrier |
| E-commerce | Fulfillment limitations | Rural delivery address, Payment method limitation, Item out of stock |
| Healthcare | Coverage constraints | Insurance doesn't cover procedure, Mobility limitation, Allergies |
| Real Estate | Financial constraints | Mortgage pre-approval cap, Visa/residency restriction, Construction delay |

### 5. Moment (The Temporal Dimension)
**Definition:** The life context, calendar context, or emotional moment the person is in. What's the bigger picture around this interaction?

| Industry | Example Dimension Labels | Example Values |
|----------|-------------------------|----------------|
| Theme park | Life moment | Birthday, Ramadan, School holidays, Last day of trip, Anniversary |
| E-commerce | Life context | Holiday rush, Moving house, New baby, Back to school, Just because |
| Real Estate | Life transition | Lease expiring, Expecting a child, Relocating for work, Retirement, Divorce |
| Aviation | Travel occasion | Honeymoon, Bereavement travel, Annual family visit, Conference season |
| Healthcare | Health timeline | Post-surgery recovery, Pregnancy, Annual wellness, End-of-year insurance deadline |

## Generation Rules

1. **Consider all 5 types** — Before generating, mentally check each universal type against this demand space × phase crossing
2. **Produce at least 3 types** — Most crossings should have dimensions from at least 3 of the 5 types
3. **Skip when genuinely irrelevant** — If a type doesn't apply to this crossing, skip it. But be deliberate, not lazy.
4. **Use industry-specific labels** — Don't output "Knowledge" — output "Familiarity", "Experience level", or "Technical proficiency" depending on industry. The universal types are invisible scaffolding.
5. **Custom 6th dimension is rare** — You MAY produce a dimension outside the 5 types if the industry demands it (e.g., "Regulatory status" for financial services, "Clinical acuity" for healthcare) — but this should be rare and justified.
6. **Total dimensions: 3-5** — This hasn't changed. The taxonomy helps you think comprehensively, but you still output 3-5 dimensions.

## Key Concepts

### Dimensions
Dimensions are **named axes** of customer context — aspects of a person's situation that would change how you serve them. They are NOT organizational buckets or system categories.

**Good Dimensions (industry-specific instances of the 5 types):**
- **Familiarity** (Knowledge type) — how well they know the experience
- **Group** (Composition type) — who they're with
- **Economic** (Constraint type) — budget context
- **Occasion** (Moment type) — what's happening in their life
- **Mobility** (Constraint type) — physical constraints
- **Urgency** (Intent type) — time pressure
- **Purpose** (Intent type) — why they're here
- **Loyalty** (Knowledge type) — relationship depth

**Bad Dimensions (REJECT these):**
- "Digital Engagement" — channel metric, not customer situation
- "Guest Demographics" — data table, not experience axis
- "Touchpoint Integration" — systems architecture concept
- "Pass Holder Lifecycle" — CRM segment, not situation
- "Personal Condition" — too vague, not actionable
- "Temporal/Life Moment" — too abstract, use specific dimensions like Occasion or Urgency

### Values
Values are **specific positions** on a dimension axis — concrete situations a customer might be in.

**Good Values for "Group" dimension (Composition type):**
- Solo traveler
- Couple
- Parents with toddlers
- Multi-generational family
- School trip group
- Corporate delegation

**Good Values for "Economic" dimension (Constraint type):**
- Budget-conscious
- Deal-driven
- Comfort spender
- Luxury seeker
- Corporate expense account

### The Quality Test

Every dimension must pass: **"Would a customer use this word to describe an aspect of their situation?"**

- ✅ "I'm on a budget" → Economic dimension (Constraint type)
- ✅ "I'm here with my grandparents" → Group dimension (Composition type)
- ✅ "It's my first time" → Familiarity dimension (Knowledge type)
- ❌ "My digital engagement is high" — no customer says this
- ❌ "I'm in the consideration phase" — marketing funnel, not situation

## Key Rules

1. **Dimensions are dynamic** — generated per demand space × journey phase crossing, NOT fixed or hardcoded
2. **3-5 dimensions per crossing** — enough to personalize, not so many it's overwhelming
3. **2-4 values per dimension** — specific enough to be actionable
4. **Dimensions change per phase** — Mobility (Constraint) matters on-site, not during online browsing
5. **Values change per demand space** — "Thrill Seekers" get different Group values than "Family Memory Makers"
6. **Multiple values can be active** — a person can be "First-timer" AND "Budget-conscious" AND "Traveling with toddlers"
7. **Operational exceptions become values** — lost child, system outage become values within Crisis or Urgency dimensions

## Phase-Specific Dimension Coverage

Different phases surface different dimension types:

### Theme Park Example

**Explore & Plan phase:**
- Familiarity (Knowledge) — First-timer, Been before, Annual passholder
- Group (Composition) — Solo, Couple, Family, Large group
- Economic (Constraint) — Budget, Mid-range, Premium
- Occasion (Moment) — Regular day out, Birthday, Holiday

**On-Site phase:**
- Familiarity (Knowledge) — same
- Group (Composition) — same
- Mobility (Constraint) — Full mobility, With stroller, Wheelchair user
- Urgency (Intent) — Relaxed pace, Time-constrained, Emergency

Notice: **Mobility** (Constraint) appears on-site but not during planning. **Occasion** (Moment) matters during planning but less so on-site.

### Real Estate Example

**Search phase:**
- Purpose (Intent) — Investment, Primary residence, Rental
- Financial position (Constraint) — First-time buyer, Upsizer, Downsizer
- Urgency (Intent) — Browsing, Active search, Must move soon
- Market familiarity (Knowledge) — New to market, Experienced buyer

**In-Life phase:**
- Tenure (Knowledge) — New resident, Established, Long-term
- Household (Composition) — Single, Family, Elderly
- Engagement (Intent) — Hands-off, Active community member
- Crisis (Constraint) — Normal, Maintenance issue, Emergency

## Crossing Examples

**Demand Space: "Thrill-Seeking Escape"**
**Dimension: Group (Composition type)**
**Values:**
- Solo thrill-seeker → Activation: Fast-pass solo queue, extreme ride recommendations
- Group of friends → Activation: Group challenges, photo packages, competitive leaderboards
- Couple → Activation: Shared experiences, romantic thrill combos
- Teen with parents → Activation: Teen zones, parent waiting areas, meetup points

**Demand Space: "Planned Family Holiday"**
**Dimension: Group (Composition type)**
**Values:**
- Parents with toddlers → Activation: Stroller parking, nap room locations, toddler-friendly rides
- Multi-generational family → Activation: Accessibility info, rest areas, varied pace itineraries
- Single parent with kids → Activation: Safety features, easy-watch zones, helper services

## Operational Exceptions

Instead of a separate "Operational Exceptions" category, exceptions become values within relevant dimensions:

**Urgency dimension (Intent type):**
- Relaxed
- Time-constrained
- Running late
- Emergency (lost child, medical issue)

**Or a dedicated Crisis dimension (Constraint type) for high-risk industries:**
- Normal operations
- Minor disruption (ride closed, delay)
- Major disruption (weather, system outage)
- Safety emergency (lost child, medical, evacuation)

## Output Format

Return a JSON object with dimensions array:

```json
{
  "dimensions": [
    {
      "label": "Familiarity",
      "description": "How well the customer knows this experience",
      "values": [
        {
          "label": "First-time visitor",
          "description": "Never been here before, needs orientation",
          "impact": "Requires wayfinding, basic info, confidence-building"
        },
        {
          "label": "Returning guest",
          "description": "Has been before, knows the basics",
          "impact": "Focus on what's new, deeper experiences, efficiency"
        },
        {
          "label": "Annual passholder",
          "description": "Frequent visitor, knows everything",
          "impact": "Insider tips, exclusive access, recognition"
        }
      ]
    }
  ]
}
```

## Prompt Template

You are generating dimensions for a behavioral strategy model.

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Experience Type:** {{experienceType}}
**Journey Phase:** {{journeyPhase.label}}
**Phase Description:** {{journeyPhase.description}}
**Demand Space:** {{demandSpace.label}}
**Job to Be Done:** {{demandSpace.jobToBeDone}}
{{#if personaContext}}
**Persona Context:** {{personaContext}}
{{/if}}

Generate 3-5 dimensions that are relevant to THIS demand space in THIS journey phase.

**Use the 5 Universal Dimension Types as your scaffold:**
1. **Knowledge** — How much does this person know? (outputs: Familiarity, Experience level, Technical proficiency)
2. **Intent** — What's at stake? (outputs: Purpose, Urgency, Visit occasion)
3. **Composition** — Who/what is around them? (outputs: Group, Travel party, Viewing context)
4. **Constraint** — What limits them? (outputs: Mobility, Budget, Accessibility, Time)
5. **Moment** — What's the bigger picture? (outputs: Life stage, Calendar context, Occasion)

Consider all 5 types. Include at least 3 that are relevant. Skip types that genuinely don't apply. Use industry-specific labels, NOT the type names themselves.

For each dimension, generate 2-4 values — specific positions on that axis that would change how this demand space should be fulfilled.

**The Personalization Formula:** Demand Space × Dimension Value = Specific Activation

CRITICAL RULES:
1. Dimensions must be named axes of CUSTOMER CONTEXT (Familiarity, Group, Economic, Mobility, etc.)
2. Dimensions must be relevant to this phase — Mobility matters on-site, not during online browsing
3. Values must be SPECIFIC SITUATIONS — "First-time visitor", "Budget-conscious", NOT abstract concepts
4. Every dimension must pass the test: "Would a customer use this word to describe their situation?"
5. Labels must be industry-specific — output "Familiarity" not "Knowledge", "Group" not "Composition"

DO NOT generate:
- System concepts (Digital Engagement, Touchpoint Integration)
- Data categories (Guest Demographics, Pass Holder Lifecycle)
- Abstract buckets (Personal Condition, Temporal Moment)
- Marketing funnel stages (Awareness, Consideration)
- The universal type names themselves (Knowledge, Intent, Composition, Constraint, Moment)

Return ONLY valid JSON, no other text.
