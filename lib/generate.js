const { skills: SKILLS, roles: ROLES, behavioral } = require('./knowledge');
const llm = require('./llm');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matchers = SKILLS.map((s) => ({
  skill: s,
  re: new RegExp(`(?<![a-z0-9+#])(?:${s.aliases.concat(s.name).map((a) => esc(a.toLowerCase())).join('|')})(?![a-z0-9+#])`, 'i'),
}));

function detectSkills(text) {
  return matchers.filter((m) => m.re.test(text)).map((m) => m.skill.name);
}

function guessYears(text) {
  const nums = [...text.matchAll(/(\d{1,2})(?:\.\d)?\+?\s*(?:years?|yrs?)/gi)].map((m) => +m[1]).filter((n) => n <= 40);
  return nums.length ? Math.max(...nums) : 0;
}

function levelFor(years) {
  if (years < 1) return 'Fresher / Entry level';
  if (years < 3) return 'Junior (1–3 yrs)';
  if (years < 6) return 'Mid-level (3–6 yrs)';
  return 'Senior (6+ yrs)';
}

function guessName(text) {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && l.length < 40 && /^[A-Za-z .'-]+$/.test(l));
  return line || '';
}

function pickRole(roleInput, resumeSkills) {
  const wanted = (roleInput || '').toLowerCase();
  if (wanted) {
    let hit = null;
    for (const [title, r] of Object.entries(ROLES)) {
      for (const k of r.match.concat(title.toLowerCase())) {
        if (wanted.includes(k) && (!hit || k.length > hit.len)) hit = { title, len: k.length };
      }
    }
    if (hit) return { title: roleInput.trim(), tpl: ROLES[hit.title] };
  }
  let best = ['Software Engineer', -1];
  for (const [title, r] of Object.entries(ROLES)) {
    const score = r.keys.filter((k) => resumeSkills.includes(k)).length / r.keys.length;
    if (score > best[1]) best = [title, score];
  }
  return { title: roleInput ? roleInput.trim() : best[0], tpl: ROLES[best[0]] };
}

const byName = Object.fromEntries(SKILLS.map((s) => [s.name, s]));

function offline({ resumeText, company, role, jdText }) {
  const resumeSkills = detectSkills(resumeText);
  const years = guessYears(resumeText);
  const { title, tpl } = pickRole(role, resumeSkills);

  let required = jdText ? detectSkills(jdText) : [];
  if (required.length < 3) required = [...new Set([...required, ...tpl.keys])];
  const matched = required.filter((s) => resumeSkills.includes(s));
  const missing = required.filter((s) => !resumeSkills.includes(s));
  const score = Math.round((matched.length / Math.max(required.length, 1)) * 100);

  const job = {
    title,
    company,
    generated: !jdText,
    summary: `${company} is hiring a ${title} to join its engineering and business teams. You will own deliverables end-to-end, work with cross-functional partners and help ${company} ship reliable, high-quality products.`,
    responsibilities: tpl.resp,
    requirements: [
      ...required.map((s) => `Hands-on experience with ${s}`),
      years >= 3 ? `${Math.max(years - 2, 2)}+ years of relevant experience` : 'Bachelor’s degree in a relevant field or equivalent experience',
      'Strong problem-solving and communication skills',
    ],
    niceToHave: ['Open-source or personal projects', 'Exposure to agile delivery', 'Cloud platform familiarity'],
  };

  const topics = [
    { name: 'Your own resume & projects', priority: 'High', why: 'Interviewers almost always start with what you have written. Be ready to explain every line.', subtopics: ['Architecture & your role', 'Trade-offs you made', 'Metrics / impact', 'What you would improve'] },
    ...required.map((s) => ({
      name: s,
      priority: missing.includes(s) ? 'High' : 'Medium',
      why: missing.includes(s) ? `Required for this role but not clearly shown on your resume — close this gap.` : `Listed on your resume and needed for this role — expect deep questions.`,
      subtopics: byName[s].topics,
    })),
  ].sort((a, b) => (a.priority === 'High' ? 0 : 1) - (b.priority === 'High' ? 0 : 1));

  const technical = [];
  [...matched, ...missing].forEach((s) => byName[s].questions.slice(0, 3).forEach((q) => technical.push({ q, skill: s })));
  resumeSkills.filter((s) => !required.includes(s)).slice(0, 4).forEach((s) => technical.push({ q: byName[s].questions[0], skill: s }));

  const questions = {
    technical: technical.slice(0, 30),
    behavioral: behavioral.map((q) => ({ q })),
    company: [
      `Why do you want to work at ${company}?`,
      `What do you know about ${company}’s products, customers and competitors?`,
      `Why are you a good fit for the ${title} role at ${company}?`,
      `What would you do in your first 90 days at ${company}?`,
      `Do you have questions for us? (Prepare 3 about team, tech and growth.)`,
    ].map((q) => ({ q })),
  };

  const top = topics.slice(1, 4).map((t) => t.name);
  const plan = [
    ['Day 1', `Research ${company}: products, culture, news, tech blog. Rewrite your resume bullets with metrics.`],
    ['Day 2', `Fundamentals: ${top[0] || 'core skills'}.`],
    ['Day 3', `Fundamentals: ${top[1] || 'core skills'} and ${top[2] || 'related topics'}.`],
    ['Day 4', 'Coding / problem-solving practice (2–3 timed problems) or a case study for non-coding roles.'],
    ['Day 5', 'Design / scenario questions + deep-dive into your top 2 projects.'],
    ['Day 6', 'Behavioural stories in STAR format (5 stories) and a full mock interview.'],
    ['Day 7', 'Revise weak areas, prepare questions for the interviewer, rest well.'],
  ].map(([day, focus]) => ({ day, focus }));

  const tips = [
    missing.length ? `Priority gaps: ${missing.join(', ')}. Even a small hands-on project in each will help.` : 'Your resume covers the core skills — focus on depth and communication.',
    'Use the STAR method (Situation, Task, Action, Result) for behavioural answers.',
    'Think aloud while solving problems — interviewers grade your reasoning.',
    jdText ? 'Mirror keywords from the real job description in your resume.' : 'Paste the real job description for more accurate preparation.',
  ];

  return {
    mode: 'offline',
    profile: { name: guessName(resumeText), skills: resumeSkills, years, level: levelFor(years) },
    job,
    match: { score, matched, missing },
    rounds: tpl.rounds.map((r, i) => ({ name: `Round ${i + 1}`, description: r })),
    topics, questions, plan, tips,
  };
}

const SYSTEM = `You are an expert career coach and technical recruiter. Given a candidate resume, a target company, a role and optionally a pasted job description, respond ONLY with JSON of this exact shape:
{"profile":{"name":"","skills":[""],"years":0,"level":""},
"job":{"title":"","company":"","summary":"","responsibilities":[""],"requirements":[""],"niceToHave":[""]},
"match":{"score":0,"matched":[""],"missing":[""]},
"rounds":[{"name":"","description":""}],
"topics":[{"name":"","priority":"High|Medium|Low","why":"","subtopics":[""]}],
"questions":{"technical":[{"q":"","skill":""}],"behavioral":[{"q":""}],"company":[{"q":""}]},
"plan":[{"day":"","focus":""}],"tips":[""]}
Make the job description realistic for the company and role (use the pasted JD if given). Provide 6-10 topics, 20-30 technical questions, 8 behavioral, 5 company-specific, a 7-day plan, and the typical interview rounds for that company. Tailor everything to the resume.`;

async function viaLLM({ resumeText, company, role, jdText }) {
  const data = await llm.chatJSON([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Company: ${company}\nRole: ${role || '(infer from resume)'}\n\nJob description (may be empty):\n${(jdText || '').slice(0, 6000)}\n\nResume:\n${resumeText.slice(0, 12000)}` },
  ]);
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    mode: 'ai',
    profile: { name: '', skills: [], years: 0, level: '', ...data.profile },
    job: { title: role || '', company, summary: '', ...data.job, responsibilities: arr(data.job?.responsibilities), requirements: arr(data.job?.requirements), niceToHave: arr(data.job?.niceToHave) },
    match: { score: 0, ...data.match, matched: arr(data.match?.matched), missing: arr(data.match?.missing) },
    rounds: arr(data.rounds), topics: arr(data.topics).map((t) => ({ ...t, subtopics: arr(t.subtopics) })),
    questions: { technical: arr(data.questions?.technical), behavioral: arr(data.questions?.behavioral), company: arr(data.questions?.company) },
    plan: arr(data.plan), tips: arr(data.tips),
  };
}

async function generate(input) {
  if (process.env.OPENAI_API_KEY) {
    try { return await viaLLM(input); }
    catch (e) {
      console.error('LLM failed, using offline engine:', e.message);
      return { ...offline(input), notice: 'AI service unavailable — showing built-in offline results.' };
    }
  }
  return offline(input);
}

module.exports = { generate };
