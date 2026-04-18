---
name: service-activation-generator
description: Generates agent specifications for each Demand Space x Dimension Value combination.
---

## What this skill does

Generates service agent specifications for each dimension value within a demand space. The output is a dimension catalog with tools, knowledge, and handoff rules that agents use to serve customers.

**The Personalization Formula:**
```
Demand Space × Dimension Value = Specific Agent Specification
```

## Output per Dimension Value

For each dimension value, generate:

| Field | What it contains | Purpose |
|-------|------------------|---------|
| **tools** | CRM actions, backend systems, dispatch tools | What the agent can DO |
| **knowledge** | Articles, scripts, procedures | What the agent should KNOW |
| **c360Signals** | Customer data points to surface | What the agent should SEE |
| **handoffRules** | Escalation triggers, transfer rules | When to ESCALATE |

## How Dimension Types Influence Agent Specifications

Dimension values come from a taxonomy-aware generator. The 5 universal dimension types should influence what you include in agent specs:

| Dimension Type | How It Influences Agent Specs |
|----------------|------------------------------|
| **Knowledge** (Familiarity, Experience) | Determines script complexity — novices need more guidance and hand-holding, experts need efficiency and shortcuts |
| **Intent** (Purpose, Urgency) | Determines response SLA and tone — emergencies need immediate escalation, routine queries need standard handling |
| **Composition** (Group, Travel party) | Determines who agent addresses — multiple travelers may need group coordination, solo callers need individual focus |
| **Constraint** (Budget, Accessibility) | Determines what options to surface — don't offer premium upsells to budget callers, adapt for accessibility needs |
| **Moment** (Occasion, Life stage) | Determines emotional sensitivity — bereavement travel needs care, celebrations need enthusiasm |

## How Dimension Values Modify Agent Behavior

The same demand space requires different agent tooling based on dimension values:

**Demand Space: "Resolve Issues Quickly"**
**Dimension: Economic (Constraint type)**

| Dimension Value | Key Agent Modifications |
|-----------------|-------------------------|
| Budget-conscious | Fee waiver calculator, payment plans, price-match tools |
| Premium seeker | Concierge line, upgrade options, premium resolution paths |
| Corporate expense | Invoice tools, PO matching, compliance documentation |

**Demand Space: "Feel Recognized"**
**Dimension: Loyalty (Knowledge type)**

| Dimension Value | Key Agent Modifications |
|-----------------|-------------------------|
| New customer | Welcome script, onboarding guide, patience protocols |
| Regular | Preference history, personalization tools, loyalty perks |
| VIP member | Direct VIP desk, privacy mode, relationship manager alert |

## Good Examples

**Demand Space: "Resolve Issues Quickly" + Dimension: Economic + Value: "Budget-conscious"**
```json
{
  "dimensionValueLabel": "Budget-conscious",
  "tools": "Refund calculator with fee waiver authority, alternative rebooking tool sorted by price",
  "knowledge": "Budget-friendly resolution options, payment plan eligibility, fee waiver guidelines",
  "c360Signals": "Price sensitivity score, past complaint history, loyalty tier, total spend",
  "handoffRules": "Escalate to supervisor if refund exceeds $500 or if customer requests manager"
}
```

**Demand Space: "Feel Recognized" + Dimension: Loyalty + Value: "VIP member"**
```json
{
  "dimensionValueLabel": "VIP member",
  "tools": "VIP protocol activation, privacy mode toggle, direct escalation to VIP desk",
  "knowledge": "VIP handling procedures, media protocol, privacy requirements",
  "c360Signals": "VIP tier, special requirements, past preferences, assigned relationship manager",
  "handoffRules": "Immediate transfer to VIP desk, never place on hold, supervisor notified automatically"
}
```

**Demand Space: "Navigate Efficiently" + Dimension: Group + Value: "Parents with toddlers"**
```json
{
  "dimensionValueLabel": "Parents with toddlers",
  "tools": "Family services locator, stroller/wheelchair dispatch, priority queue override",
  "knowledge": "Baby facilities locations, family-friendly routes, child safety procedures",
  "c360Signals": "Family profile, child ages, accessibility needs, past service requests",
  "handoffRules": "Transfer to family services desk for complex requests, escalate safety concerns immediately"
}
```

**Demand Space: "Resolve Issues Quickly" + Dimension: Urgency + Value: "Emergency"**
```json
{
  "dimensionValueLabel": "Emergency",
  "tools": "Emergency protocol activation, medical liaison dispatch, security alert system",
  "knowledge": "Emergency procedures, medical response protocols, evacuation routes",
  "c360Signals": "Medical flag, emergency contacts, location data, special needs",
  "handoffRules": "Immediate escalation to emergency team, supervisor auto-notified, all other issues paused"
}
```

## Quality Criteria

### MUST produce:
- Specific tools (not vague "CRM access")
- Knowledge that's surfaceable (articles, scripts, not tribal knowledge)
- C360 signals that exist in typical customer data platforms
- Clear escalation triggers (not "when appropriate")
- Different specs for different dimension values

### MUST NOT produce:
- Generic "access to customer information"
- Tools that don't exist in typical service stacks
- Handoff rules without clear triggers
- Same specifications for different dimension values
- Specs that ignore the dimension context

## C360 Signal Categories

Common signals to consider:
- **Loyalty**: Tier, tenure, lifetime value, engagement score
- **Behavioral**: Purchase history, channel preferences, past issues
- **Profile**: Demographics, preferences, special needs
- **Contextual**: Current journey stage, recent interactions, open tickets
- **Risk**: Churn score, complaint history, NPS

## Handoff Rule Triggers

Common escalation triggers:
- **Value threshold**: Issue value exceeds agent authority
- **Complexity**: Multiple systems involved, policy exception needed
- **Sentiment**: Customer expressing strong negative emotion
- **Safety**: Any safety or security concern
- **VIP**: Customer has elevated service tier
- **Time**: Issue unresolved after X minutes

## Output Format

```json
{
  "activations": [
    {
      "dimensionValueLabel": "Budget-conscious",
      "tools": "Fee waiver calculator, price-match tool, payment plan generator",
      "knowledge": "Budget options guide, waiver policies, competitor pricing",
      "c360Signals": "Price sensitivity, spend history, loyalty tier",
      "handoffRules": "Escalate if refund > $500 or customer requests manager"
    }
  ]
}
```

## Prompt Template

Generate service specifications for this demand space and dimension values:

**Industry:** {{industry}}
**Business Description:** {{businessDescription}}
**Tech Stack:** {{techStack}}
**Journey Phase:** {{journeyPhase.label}}

**Demand Space:** {{demandSpace.label}}
**Job to Be Done:** {{demandSpace.jobToBeDone}}

**Dimension:** {{dimension.label}}
**Dimension Description:** {{dimension.description}}

**Values to generate specs for:**
{{#each dimensionValues}}
- {{this.label}}: {{this.description}}
{{/each}}

For EACH dimension value, generate agent specifications:
1. tools (systems/tools to use - CRM actions, backend systems, dispatch tools)
2. knowledge (articles, scripts, procedures to surface)
3. c360Signals (customer data points to show the agent)
4. handoffRules (when/how to escalate or transfer)

Think about how the dimension value MODIFIES what the agent needs to serve this customer.
