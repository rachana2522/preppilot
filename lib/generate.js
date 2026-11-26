const { generate: offlineGenerate } = require('../public/offline');
const llm = require('./llm');

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
    rounds: arr(data.rounds),
    topics: arr(data.topics).map((t) => ({ ...t, subtopics: arr(t.subtopics) })),
    questions: { technical: arr(data.questions?.technical), behavioral: arr(data.questions?.behavioral), company: arr(data.questions?.company) },
    plan: arr(data.plan),
    tips: arr(data.tips),
  };
}

async function generate(input) {
  if (llm.enabled()) {
    try { return await viaLLM(input); }
    catch (e) {
      console.error('LLM failed, using offline engine:', e.message);
      return { ...offlineGenerate(input), notice: 'AI service unavailable — showing built-in offline results.' };
    }
  }
  return offlineGenerate(input);
}

module.exports = { generate };
