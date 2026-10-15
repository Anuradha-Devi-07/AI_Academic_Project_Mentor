/**
 * Rule-based stand-ins for the AI agents, used only in demo mode (no VITE_API_BASE_URL).
 * They produce realistic, input-dependent output so the UI and data flow can be built and
 * tested before the backend's LLM agents exist. Replace with real agent responses, not by editing these rules.
 */
import { DOMAIN_LABELS } from '../lib/skills'
import type { AgentId, ProjectBlueprint, ProjectDomain, ProjectIdea, Severity, StudentProfile } from '../types/models'

const DOMAIN_SKILLS: Record<ProjectDomain, string[]> = {
  ai_ml: ['Python', 'Machine Learning', 'Data analysis'],
  web: ['JavaScript', 'React', 'HTML / CSS', 'Node.js'],
  mobile: ['JavaScript', 'React', 'Java'],
  iot: ['C / C++', 'Arduino / IoT', 'Python'],
  data: ['Python', 'SQL', 'Data analysis'],
  other: [],
}

const COMPLEXITY_KEYWORDS: [RegExp, number, string][] = [
  [/real[- ]?time|live/i, 40, 'real-time features'],
  [/blockchain|web3/i, 60, 'blockchain'],
  [/\b(ar|vr|augmented|virtual reality)\b/i, 60, 'AR/VR'],
  [/chat ?bot|llm|gpt|generative/i, 30, 'conversational AI'],
  [/recommend/i, 25, 'recommendations'],
  [/image|vision|camera|face/i, 35, 'computer vision'],
  [/login|auth|account/i, 10, 'user accounts'],
  [/payment/i, 25, 'payments'],
  [/dashboard|analytics/i, 10, 'dashboards'],
]

export interface DemoAgentOutput {
  blueprint: ProjectBlueprint
  summaries: Record<AgentId, string>
}

export function runDemoAgents(profile: StudentProfile, project: ProjectIdea): DemoAgentOutput {
  const level = (skill: string) => profile.skills.find(s => s.skill === skill)?.level ?? 0
  const knows = (skill: string) => level(skill) > 0

  // ── Feasibility Analyst ──
  const required = DOMAIN_SKILLS[project.domain]
  const fitTarget = Math.min(2, required.length) * 3
  const fit = fitTarget ? Math.min(1, required.reduce((sum, s) => sum + level(s), 0) / fitTarget) : .6
  const complexityHits = COMPLEXITY_KEYWORDS.filter(([re]) => re.test(project.description))
  const effortHours = 60 + complexityHits.reduce((sum, [, hours]) => sum + hours, 0) + Math.round(project.description.length / 20)
  const capacityHours = profile.weeklyHours * profile.teamSize * project.durationWeeks
  const capacityRatio = capacityHours / effortHours

  let score = 55 + Math.round(fit * 20) + { none: 0, one: 5, several: 8 }[profile.priorProjects]
  score += capacityRatio >= 3 ? 12 : capacityRatio >= 1.5 ? 6 : capacityRatio < 1 ? -15 : 0
  score = Math.max(30, Math.min(95, score))
  const verdict = score >= 75 ? 'strong' : score >= 55 ? 'workable' : 'stretch'

  const notes = [
    fit >= .7 ? `Your skills line up well with ${DOMAIN_LABELS[project.domain].toLowerCase()} work.` : fit >= .35 ? `You have a partial skill match for ${DOMAIN_LABELS[project.domain].toLowerCase()} — expect some learning along the way.` : `This domain is new territory for you, so plan extra time for learning.`,
    `About ${capacityHours} person-hours available (${profile.weeklyHours}h/week × ${profile.teamSize} × ${project.durationWeeks} weeks) for an estimated ${effortHours}h core build.`,
  ]
  if (complexityHits.length) notes.push(`Ambitious parts detected: ${complexityHits.map(([, , label]) => label).join(', ')}. Consider making one of them a stretch goal.`)

  // ── Tech Stack Advisor ──
  const techStack = recommendStack(project.domain, knows, level)
  techStack.push({ layer: 'Collaboration', choice: 'Git + GitHub', reason: knows('Git') ? 'You already use Git — set up branches and pull requests from day one.' : 'Worth learning in week 1; it protects your work and makes teamwork far easier.' })

  // ── Risk Assessor ──
  const risks: ProjectBlueprint['risks'] = []
  // Mobile skills are alternatives (any one of them is enough); other domains need all of them.
  const missing = project.domain === 'mobile' && required.some(knows) ? [] : required.filter(s => !knows(s))
  if (missing.length) {
    const allMissing = missing.length === required.length
    const topic = allMissing ? techStack[0].choice : missing[0]
    risks.push({ title: `Learning curve: ${allMissing ? techStack[0].choice : missing.slice(0, 2).join(' & ')}`, severity: allMissing ? 'high' : 'medium', mitigation: `Budget the first two weeks for a short course or tutorial project in ${topic} before building features.` })
  }
  if (capacityRatio < 1.5) risks.push({ title: 'Scope larger than available time', severity: 'high', mitigation: 'Cut to 2–3 must-have features for the MVP and list everything else as "future work".' })
  if (project.domain === 'ai_ml' || project.domain === 'data') risks.push({ title: 'Finding a usable dataset', severity: 'medium', mitigation: 'Pick a dataset in week 1 (Kaggle, UCI, data.gov.in) and check its size, licence and labels before committing.' })
  if (project.domain === 'iot') risks.push({ title: 'Hardware delivery and faults', severity: 'medium', mitigation: 'Order components early, keep spares, and simulate sensors (e.g. Wokwi) while you wait.' })
  if (profile.teamSize > 1) risks.push({ title: 'Uneven workload across the team', severity: 'low', mitigation: 'Assign an owner per module and hold a 15-minute weekly check-in.' })
  risks.push({ title: 'Scope creep', severity: 'medium', mitigation: 'Freeze the feature list after the design milestone; new ideas go to a backlog.' })
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  risks.sort((a, b) => order[a.severity] - order[b.severity])

  // ── Milestone Planner ──
  const milestones = planMilestones(project.durationWeeks, techStack[0]?.choice ?? 'your stack')

  // ── Mentor ──
  const mentorTips = [
    'Write a one-paragraph problem statement this week and share it with your project guide.',
    `Decide what "done" means: list the 3 must-have features for your MVP before ${milestones[1]?.weeks.toLowerCase() ?? 'week 2'} ends.`,
    profile.assessment.level === 'beginner' ? 'Build a tutorial-sized version of your core feature first — momentum beats perfection.' : 'Prototype the riskiest part first so you learn early whether the approach works.',
    ...(profile.assessment.growthAreas[0] ? [`Growth focus: ${profile.assessment.growthAreas[0]}.`] : []),
    'Reflect: who exactly is your user, and how will you know the project helped them?',
  ]

  // ── Documentation Assistant ──
  const synopsis = `${project.title} is a ${DOMAIN_LABELS[project.domain].toLowerCase()} project to be completed over ${project.durationWeeks} weeks${profile.teamSize > 1 ? ` by a team of ${profile.teamSize}` : ''}. ${firstSentence(project.description)} The proposed solution will be built with ${techStack.slice(0, 3).map(t => t.choice).join(', ')}. Work is organised into ${milestones.length} milestones, from problem definition through implementation to testing and documentation. Key risks identified include ${risks.slice(0, 2).map(r => r.title.toLowerCase()).join(' and ')}, each with a planned mitigation.`

  const highRisks = risks.filter(r => r.severity === 'high').length
  return {
    blueprint: { feasibility: { score, verdict, notes }, techStack, risks, milestones, mentorTips, synopsis },
    summaries: {
      feasibility: `Feasibility ${score}/100 — ${verdict === 'strong' ? 'strong fit' : verdict === 'workable' ? 'workable with focus' : 'a stretch; scope down'}.`,
      tech_stack: `Recommended ${techStack.length} technologies, led by ${techStack.slice(0, 2).map(t => t.choice).join(' and ')}.`,
      risk: `Found ${risks.length} risks${highRisks ? `, ${highRisks} high priority` : ''}.`,
      planner: `Planned ${milestones.length} milestones across ${project.durationWeeks} weeks.`,
      mentor: `Prepared ${mentorTips.length} first steps for you.`,
      documentation: `Drafted a ${synopsis.split(/\s+/).length}-word synopsis.`,
    },
  }
}

function recommendStack(domain: ProjectDomain, knows: (s: string) => boolean, level: (s: string) => number): ProjectBlueprint['techStack'] {
  const ui = knows('React') ? { choice: 'React', reason: 'You already know React.' } : knows('JavaScript') || knows('HTML / CSS') ? { choice: 'HTML, CSS & JavaScript', reason: 'Builds on what you know without a framework to learn.' } : null
  switch (domain) {
    case 'ai_ml': return [
      { layer: 'Language', choice: 'Python', reason: knows('Python') ? 'Your strongest fit for ML work.' : 'The standard for ML — worth learning first.' },
      { layer: 'Modelling', choice: level('Machine Learning') >= 3 ? 'PyTorch' : 'scikit-learn', reason: level('Machine Learning') >= 3 ? 'You have the ML depth to use deep learning.' : 'Gentle learning curve with strong classical models.' },
      { layer: 'API', choice: 'FastAPI', reason: 'Serves your model with very little code.' },
      { layer: 'Interface', choice: ui?.choice ?? 'Streamlit', reason: ui?.reason ?? 'Turns Python scripts into a usable UI in minutes.' },
    ]
    case 'web': return [
      { layer: 'Frontend', choice: ui?.choice ?? 'React', reason: ui?.reason ?? 'Most widely used, with plenty of learning resources.' },
      knows('Node.js') || knows('JavaScript') ? { layer: 'Backend', choice: 'Node.js + Express', reason: 'One language across the whole stack.' }
        : knows('Python') ? { layer: 'Backend', choice: 'Python + FastAPI', reason: 'Uses your Python skills.' }
          : knows('Java') ? { layer: 'Backend', choice: 'Java + Spring Boot', reason: 'Uses your Java skills.' }
            : { layer: 'Backend', choice: 'Node.js + Express', reason: 'Simple to start and pairs with a JavaScript frontend.' },
      { layer: 'Database', choice: 'PostgreSQL', reason: knows('SQL') ? 'Your SQL skills apply directly.' : 'Reliable, free and well documented.' },
      { layer: 'Hosting', choice: 'Vercel + Render', reason: 'Free tiers are enough for a student demo.' },
    ]
    case 'mobile': return [
      knows('React') || knows('JavaScript') ? { layer: 'App', choice: 'React Native (Expo)', reason: 'Reuses your JavaScript/React knowledge.' }
        : knows('Java') ? { layer: 'App', choice: 'Android (Kotlin)', reason: 'Closest to your Java background.' }
          : { layer: 'App', choice: 'Flutter', reason: 'One codebase for Android and iOS with good docs.' },
      { layer: 'Backend', choice: 'Firebase', reason: 'Auth, database and hosting without running a server.' },
    ]
    case 'iot': return [
      { layer: 'Hardware', choice: 'ESP32', reason: 'Cheap, Wi-Fi built in and well supported.' },
      { layer: 'Firmware', choice: 'Arduino (C++)', reason: knows('C / C++') ? 'Uses your C/C++ skills.' : 'Huge library ecosystem and examples.' },
      { layer: 'Messaging', choice: 'MQTT', reason: 'Lightweight protocol designed for sensors.' },
      { layer: 'Dashboard', choice: knows('Python') ? 'Python + Streamlit' : 'Node-RED', reason: knows('Python') ? 'Uses your Python skills.' : 'Visual, low-code dashboards.' },
    ]
    case 'data': return [
      { layer: 'Analysis', choice: 'Python + pandas', reason: knows('Python') ? 'Your Python skills apply directly.' : 'The standard toolkit for data work.' },
      { layer: 'Storage', choice: knows('SQL') ? 'PostgreSQL' : 'SQLite', reason: knows('SQL') ? 'Your SQL skills apply directly.' : 'Zero-setup database for a single project.' },
      { layer: 'Visualisation', choice: 'Plotly + Streamlit', reason: 'Interactive charts and a shareable dashboard.' },
    ]
    default: return [
      { layer: 'Core', choice: knows('Python') ? 'Python' : knows('Java') ? 'Java' : knows('JavaScript') ? 'JavaScript' : 'Python', reason: 'Starts from the language you know best.' },
      ...(ui ? [{ layer: 'Interface', ...ui }] : []),
    ]
  }
}

function planMilestones(weeks: number, leadTech: string): ProjectBlueprint['milestones'] {
  const phases = [
    { share: .15, title: 'Define & research', deliverables: ['Problem statement', 'Literature / existing-solution review', 'MVP feature list'] },
    { share: .15, title: 'Design & set up', deliverables: ['Architecture diagram', `${leadTech} project scaffold`, 'Repository and task board'] },
    { share: .35, title: 'Build the core', deliverables: ['Must-have features working end to end', 'Weekly demo to your guide'] },
    { share: .2, title: 'Test & refine', deliverables: ['Test cases and bug fixes', 'Feedback from 3+ real users'] },
    { share: .15, title: 'Document & present', deliverables: ['Final report', 'Demo video and presentation'] },
  ]
  // Short projects: fold the last two phases together until every phase gets at least a week.
  while (phases.length > weeks && phases.length > 1) {
    const last = phases.pop()!, prev = phases.pop()!
    phases.push({ share: prev.share + last.share, title: `${prev.title.split(' & ')[0]}, ${last.title.toLowerCase()}`, deliverables: [...prev.deliverables, ...last.deliverables] })
  }
  let start = 1
  return phases.map((phase, i) => {
    const remaining = phases.length - i - 1
    const length = i === phases.length - 1 ? weeks - start + 1 : Math.max(1, Math.min(Math.round(weeks * phase.share), weeks - start + 1 - remaining))
    const end = start + length - 1
    const range = length === 1 ? `Week ${start}` : `Weeks ${start}–${end}`
    start = end + 1
    return { weeks: range, title: phase.title, deliverables: phase.deliverables }
  })
}

const firstSentence = (text: string) => {
  const sentence = text.trim().match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text.trim()
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}
