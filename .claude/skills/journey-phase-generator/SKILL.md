---
name: journey-phase-generator
description: Generates sequential journey phases for a business based on their industry and description.
---

## What this skill does

Generates 4-7 sequential journey phases for a business based on their industry and description. Journey phases represent the customer lifecycle — the stages ALL customers move through regardless of their specific motivation.

## Quality Criteria

### MUST produce:
- 4-7 sequential phases that represent the business's actual customer lifecycle
- Each phase has: label, description, and trigger (what event marks entry)
- Phases are business-specific and reflect how THIS company thinks about their customers

### MUST NOT produce:
- Generic marketing funnels like "Awareness → Consideration → Decision → Purchase → Loyalty"
- Phases that describe demand spaces (motivations) instead of lifecycle stages
- Phases that are too granular (sub-steps within a phase)

## Good Examples

**Real Estate (residential communities):**
- Search → Onboarding → In-Life
- Trigger examples: "Signs lease", "Moves in", "Enters renewal period"

**Theme Park / Hospitality:**
- Inspire → Purchase → Pre-Arrival → On-Site → Post-Visit
- Trigger examples: "Books tickets", "Day before visit", "Enters park", "Leaves park"

**Airline:**
- Pre-Booking → Post-Booking → Pre-Journey → Arrival → Dwell → Boarding → In-Flight → Feedback
- Trigger examples: "Searches flights", "Confirms booking", "Check-in opens"

**QSR (Quick Service Restaurant):**
- Crave → Decide → Order → Wait → Eat → Remember
- Trigger examples: "Feels hungry", "Opens app", "Submits order", "Receives food"

## Bad Examples

**Generic marketing funnel (REJECT):**
- Awareness → Consideration → Decision → Purchase → Retention
- WHY BAD: Every business gets the same phases. No insight.

**Too granular (REJECT):**
- Homepage → Browse → Add to Cart → Checkout Step 1 → Checkout Step 2 → Payment → Confirmation
- WHY BAD: These are UX steps, not lifecycle phases.

**Demand spaces disguised as phases (REJECT):**
- Family Planning → Business Travel → Solo Adventure
- WHY BAD: These are motivations (demand spaces), not lifecycle stages.

## Output Format

Return a JSON array with 4-7 objects:

```json
[
  {
    "label": "Phase Name",
    "description": "What happens during this phase (1-2 sentences)",
    "trigger": "What event marks entry into this phase"
  }
]
```

## Prompt Template

You are generating journey phases for a behavioral strategy model.

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Experience Type:** {{experienceType}}

Generate 4-7 sequential journey phases that represent THIS business's customer lifecycle. These are the stages ALL customers move through, regardless of their specific motivation or segment.

Requirements:
1. Phases must be specific to this business and industry — NOT generic marketing funnels
2. Each phase needs a clear trigger (what event marks entry)
3. Phases should be sequential and non-overlapping
4. Think about how THIS company's customers actually progress through their lifecycle

Return ONLY valid JSON array, no other text.
