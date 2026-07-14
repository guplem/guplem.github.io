---
name: research-agents
description: Launch N parallel research agents that explore different improvement approaches, cross-pollinate ideas, and converge on a unified plan
argument-hint: "<target feature or area to improve>" [--agents=<N>] [--rounds=<N>] [--angles="angle1,angle2,..."]
---

# Multi-Agent Research Orchestrator

Launch several research agents in parallel. Each one explores a different angle of improvement for a feature or area. Then they run rounds of cross-pollination (each agent reads what the others found and builds on it) until they converge on one shared recommendation.

## 1. Parse Arguments

`$ARGUMENTS` contains the target to improve and optional configuration:

- `TARGET`: The feature, area, or system to improve (e.g., "particle simulation performance", "work cards layout", "photo-editor UX")
- `AGENTS`: Number of agents to run (default: 4, range: 2-6)
- `ROUNDS`: Number of rounds. Default is 2: one independent round, then one cross-pollination round.
- `ANGLES`: Comma-separated research angles (optional. If provided, skip the proposal step in Step 3)

## 2. Explore the Target

Before doing anything else, YOU (the orchestrator: the main agent that runs and coordinates the others) must understand what is being improved. Use parallel exploration agents to read the target codebase:

- Identify ALL relevant source files (HTML, CSS, JS, JSON, tests, configs)
- Understand the current flow end-to-end
- Map external dependencies (CDN imports, APIs, data files)
- Note recent changes (`git log --oneline -20` for the target directory)
- Identify the **nature** of the system: Is it a rendering module? A standalone web-project? A data pipeline? A simulation? This determines what research angles are relevant.

Produce a concise **Target Summary** that every research agent will receive as shared context.

## 3. Propose Research Angles (Interactive)

This is the most important step. The angles determine the entire research direction.

**If the user provided `--angles`**: Use those directly, but still present the plan for confirmation.

**If the user did NOT provide angles**: Propose angles tailored to this specific target based on Step 2.

### How to choose angles

Think about what dimensions of improvement actually matter for THIS system:

- What are the biggest performance bottlenecks?
- What are the quality or UX issues?
- What domain-specific knowledge could help?
- What non-obvious angles might surface insights?

Different systems call for fundamentally different angles:

| System Type | Example Angles |
|-------------|---------------|
| Canvas simulation | Physics accuracy, Rendering performance, Visual quality, Memory/GC optimization |
| Web-project game | Game feel/UX, Performance, Code architecture, Accessibility |
| Layout/rendering | DOM performance, Responsive design, Animation smoothness, Semantic structure |
| Data pipeline | Schema design, Loading performance, Caching strategy, Error resilience |
| CSS/styling | Design token usage, Responsive patterns, Animation performance, Consistency |

These are starting points, not templates. The best angles are specific to the actual code you just read.

### Present the proposal

Present the user with:

1. A 2-3 sentence summary of what you found during exploration
2. The proposed agent roster (the list of agents). For each agent:
   - **Name**: Short descriptive name
   - **Angle**: One sentence describing the research focus
   - **Why this angle**: One sentence grounded in what you saw in the code
   - **Web research?**: Whether this agent should search the web or focus on code analysis
3. Number of rounds
4. Questions:
   - "Are there aspects I might have missed that deserve a dedicated agent?"
   - "Should any angles be split or merged?"
   - "Is there a dimension you care about most?"

### Wait for confirmation

Do NOT proceed until the user confirms or adjusts the plan.

## 4. Create the Planning Workspace

Create this structure inside the target directory:

```
<target-dir>/planning-workspace/
+-- config.md
+-- target-summary.md
+-- agents/
|   +-- agent-1-<name>/
|   |   +-- brief.md
|   +-- agent-2-<name>/
|   |   +-- brief.md
|   +-- ...
+-- synthesis/
```

**config.md**: Improvement goal, agent roster, rounds, relevant files, consensus criteria.

**target-summary.md**: Codebase analysis from Step 2.

**brief.md** per agent: Tailored research mission, 4-6 concrete tasks, relevant files, web search instructions, awareness of other agents.

## 5. Round 1: Diverge (Independent Research)

Launch ALL agents in parallel in a SINGLE message. Each agent uses the `research-agent` agent definition with this prompt structure:

```
You are Agent {N}: "{Agent Name}", one of {TOTAL} parallel research agents
exploring improvements to {TARGET}.

YOUR ANGLE: {specific research focus from brief.md}

THE OTHER AGENTS (for awareness):
- Agent 1: {name}, {angle}
- Agent 2: {name}, {angle}
- ...

ROUND: 1 of {ROUNDS} (independent research)
Do NOT read other agents' folders. They are empty.

SHARED CONTEXT:
{path}/planning-workspace/target-summary.md

YOUR BRIEF:
{path}/planning-workspace/agents/agent-{N}-{name}/brief.md

OUTPUT: Write findings to:
{path}/planning-workspace/agents/agent-{N}-{name}/round-1.md

Use this structure:
## Key Findings
(Main discoveries, grounded in code evidence and/or research)

## Concrete Recommendations
For each:
- What: the change
- Why: evidence/reasoning
- How: implementation sketch (file paths, code changes)
- Risk: what could go wrong
- Effort: S/M/L

## Open Questions

## Interactions With Other Agents' Domains
```

## 6. Round 2+: Cross-Pollinate

Launch ALL agents again in parallel:

```
You are Agent {N}: "{Agent Name}".
ROUND: {R} of {ROUNDS} (cross-pollination)

MANDATORY READING (read ALL before writing):
- Your own Round {R-1}: {path}/agents/agent-{N}-{name}/round-{R-1}.md
- All other agents' Round {R-1} outputs

YOUR TASK:
1. Read every other agent's output carefully
2. Identify reinforcements, conflicts, complements
3. Revise recommendations incorporating cross-agent insights
4. Flag remaining disagreements with reasoning

OUTPUT: Write to {path}/planning-workspace/agents/agent-{N}-{name}/round-{R}.md

Structure:
## Revised Recommendations
## Adopted From Other Agents
## Remaining Disagreements
## Consensus Points
## Top 3 Priorities
```

**When to stop early**: If "Remaining Disagreements" sections are short/empty and Top 3 priorities are aligned.

## 7. Synthesize

Launch ONE synthesis agent (use `research-synthesizer` agent):

```
Read ALL outputs from ALL rounds.
Also read target-summary.md.

SYNTHESIS RULES:
- Consensus points go to the top (high confidence)
- Where agents disagree, make a judgment call, and cite which evidence won
- Preserve the BEST specific details (file paths, code snippets, citations)
- Identify synergies between agents' recommendations
- Flag genuine tradeoffs the user must decide

OUTPUT: Write to {path}/planning-workspace/synthesis/final-plan.md

Structure:
## Executive Summary
## High-Confidence Recommendations (Consensus)
## Strategic Recommendations (Synthesized)
## Implementation Roadmap
  Phase 1: quick wins
  Phase 2: medium effort
  Phase 3: larger changes
## Tradeoffs Requiring User Input
## Sources & References
## Agent Contribution Map
```

## 8. Present Results

After synthesis:

1. Read `final-plan.md`
2. Present the Executive Summary
3. Highlight "Tradeoffs Requiring User Input"
4. Link to the full plan
5. Offer to dive deeper or begin implementation

## Important Rules

- **All agents in a round launch in ONE message.** Never sequentially.
- **Agents must read actual code.** The summary provides context, but each agent deep-dives into relevant files.
- **The synthesis agent is a judge, not a summarizer.** It makes decisions when agents disagree.
- **The workspace is inspectable.** Don't delete intermediate files.
- **Web research is angle-dependent.** Be explicit about what to search for.
- **The proposal step is mandatory.** Present the plan and get confirmation even if the user seems to know what they want.
