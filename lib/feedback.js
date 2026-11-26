const { skills } = require('./knowledge');
const llm = require('./llm');

const count = (text, re) => (text.match(re) || []).length;

function offline({ question, answer, type, skill }) {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const lower = answer.toLowerCase();
  const strengths = [];
  const improvements = [];
  let score = 0;

  const [min, max] = type === 'behavioral' ? [90, 250] : [40, 200];
  if (words >= min && words <= max) { score += 20; strengths.push(`Good length (${words} words).`); }
  else if (words < min) { score += Math.round((words / min) * 12); improvements.push(`Too short (${words} words). Aim for ${min}–${max} words with a concrete example.`); }
  else { score += 12; improvements.push(`A bit long (${words} words). Tighten it to ${min}–${max} words.`); }

  if (type === 'behavioral') {
    const star = [
      ['Situation', /\b(when|while|during|at my|in my|project|team|situation)\b/],
      ['Task', /\b(task|goal|responsible|needed to|had to|challenge|objective)\b/],
      ['Action', /\b(i (?:built|led|decided|implemented|created|designed|wrote|organi[sz]ed|proposed|worked|fixed|analy[sz]ed|developed|talked|spoke))\b|\bi \w+ed\b/],
      ['Result', /\b(result|outcome|as a result|improved|reduced|increased|saved|achieved|learned|delivered)\b/],
    ];
    const hit = star.filter(([, re]) => re.test(lower)).map(([n]) => n);
    score += hit.length * 9;
    if (hit.length === 4) strengths.push('Covers the full STAR structure.');
    else improvements.push(`Missing STAR parts: ${star.map(([n]) => n).filter((n) => !hit.includes(n)).join(', ')}.`);
  } else {
    const topic = skills.find((s) => s.name === skill);
    const terms = topic ? [...new Set(topic.topics.join(' ').toLowerCase().match(/[a-z][a-z+#/.]{3,}/g) || [])].filter((t) => !['with', 'basics', 'best', 'practices', 'and'].includes(t)) : [];
    const covered = terms.filter((t) => lower.includes(t));
    if (terms.length) {
      score += Math.min(36, covered.length * 12);
      covered.length >= 3 ? strengths.push(`Mentions key concepts: ${covered.slice(0, 4).join(', ')}.`) : improvements.push(`Cover more key ${skill} concepts (e.g. ${terms.slice(0, 4).join(', ')}).`);
    } else score += 18;
    if (/\b(because|therefore|trade-?off|vs\.?|versus|whereas|however)\b/.test(lower)) strengths.push('Explains reasoning and trade-offs.');
    else improvements.push('Explain the “why” and compare alternatives or trade-offs.');
  }

  if (/\b(for example|for instance|e\.g\.|such as|in my project|in my last|i used)\b/.test(lower)) { score += 12; strengths.push('Backs the answer with a real example.'); }
  else improvements.push('Add a real example from your own project or internship.');

  if (count(answer, /\d+\s?%|\d+\s?(?:x|k|ms|users|hours|days|people|members)/gi) >= 1) { score += 8; strengths.push('Uses numbers to show impact.'); }
  else improvements.push('Include at least one measurable result (%, time saved, users).');

  const i = count(lower, /\bi\b/g), we = count(lower, /\bwe\b/g);
  if (type === 'behavioral') {
    if (i >= 3 && i >= we) { score += 10; strengths.push('Clearly shows your personal contribution.'); }
    else improvements.push('Say “I” more — interviewers want YOUR contribution, not just the team’s.');
  } else score += 10;

  const fillers = count(lower, /\b(um+|uh+|basically|you know|kind of|sort of|actually|like,)\b/g);
  if (fillers <= 2) { score += 15; if (words > 20) strengths.push('Clear, confident wording.'); }
  else { score += Math.max(0, 15 - fillers * 3); improvements.push(`Cut filler words (${fillers} found): “basically”, “you know”, “um”.`); }

  if (words < 8) { score = Math.min(score, 15); improvements.unshift('Write or speak a full answer to get useful feedback.'); }
  return { score: Math.max(0, Math.min(100, score)), strengths, improvements, mode: 'offline' };
}

async function feedback(input) {
  if (llm.enabled()) {
    try {
      const data = await llm.chatJSON([
        { role: 'system', content: 'You are a strict but encouraging interview coach. Evaluate the candidate answer. Respond ONLY with JSON: {"score":0-100,"strengths":[""],"improvements":[""],"betterAnswer":"a concise model answer"}.' },
        { role: 'user', content: `Company: ${input.company || 'n/a'}\nRole: ${input.role || 'n/a'}\nQuestion: ${input.question}\n\nCandidate answer:\n${input.answer.slice(0, 4000)}` },
      ]);
      return { mode: 'ai', score: Math.max(0, Math.min(100, +data.score || 0)), strengths: data.strengths || [], improvements: data.improvements || [], betterAnswer: data.betterAnswer || '' };
    } catch (e) { console.error('LLM feedback failed:', e.message); }
  }
  return offline(input);
}

module.exports = { feedback };
