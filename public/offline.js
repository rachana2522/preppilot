(function (root, factory) {
  const knowledge = typeof module !== 'undefined' && module.exports
    ? require('./knowledge')
    : root.PREP_KNOWLEDGE;
  const api = factory(knowledge, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PrepOffline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (knowledge, root) {
  const { skills: SKILLS, roles: ROLES, behavioral } = knowledge;
  const byName = Object.fromEntries(SKILLS.map((s) => [s.name, s]));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matchers = SKILLS.map((skill) => ({
    skill,
    re: new RegExp(`(?<![a-z0-9+#])(?:${skill.aliases.concat(skill.name).map((a) => esc(a.toLowerCase())).join('|')})(?![a-z0-9+#])`, 'i'),
  }));
  const detectSkills = (text) => matchers.filter((m) => m.re.test(text)).map((m) => m.skill.name);

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
    return text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && l.length < 40 && /^[A-Za-z .'-]+$/.test(l)) || '';
  }

  function pickRole(roleInput, resumeSkills) {
    const wanted = (roleInput || '').toLowerCase();
    if (wanted) {
      let hit = null;
      for (const [title, role] of Object.entries(ROLES)) {
        for (const key of role.match.concat(title.toLowerCase())) {
          if (wanted.includes(key) && (!hit || key.length > hit.len)) hit = { title, len: key.length };
        }
      }
      if (hit) return { title: roleInput.trim(), tpl: ROLES[hit.title] };
    }
    let best = ['Software Engineer', -1];
    for (const [title, role] of Object.entries(ROLES)) {
      const score = role.keys.filter((key) => resumeSkills.includes(key)).length / role.keys.length;
      if (score > best[1]) best = [title, score];
    }
    return { title: roleInput ? roleInput.trim() : best[0], tpl: ROLES[best[0]] };
  }

  function generate({ resumeText, company, role, jdText }) {
    const resumeSkills = detectSkills(resumeText);
    const years = guessYears(resumeText);
    const { title, tpl } = pickRole(role, resumeSkills);
    let required = jdText ? detectSkills(jdText) : [];
    if (required.length < 3) required = [...new Set([...required, ...tpl.keys])];
    const matched = required.filter((s) => resumeSkills.includes(s));
    const missing = required.filter((s) => !resumeSkills.includes(s));
    const score = Math.round((matched.length / Math.max(required.length, 1)) * 100);
    const job = {
      title, company, generated: !jdText,
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
        name: s, priority: missing.includes(s) ? 'High' : 'Medium',
        why: missing.includes(s) ? 'Required for this role but not clearly shown on your resume — close this gap.' : 'Listed on your resume and needed for this role — expect deep questions.',
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
        'Do you have questions for us? (Prepare 3 about team, tech and growth.)',
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
      job, match: { score, matched, missing },
      rounds: tpl.rounds.map((description, i) => ({ name: `Round ${i + 1}`, description })),
      topics, questions, plan, tips,
    };
  }

  const VERBS = ['led', 'built', 'developed', 'designed', 'implemented', 'created', 'improved', 'reduced', 'increased', 'managed', 'optimized', 'optimised', 'delivered', 'launched', 'automated', 'analyzed', 'analysed', 'collaborated', 'migrated', 'deployed', 'architected', 'mentored', 'achieved', 'established', 'streamlined', 'resolved', 'integrated', 'engineered'];
  function checkResume(text, match) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const lower = text.toLowerCase();
    const verbs = new Set(VERBS.filter((v) => new RegExp(`\\b${v}\\b`).test(lower)));
    const metrics = (text.match(/\d+\s?%|\$\s?\d+|\d+\s?\+|\d+\s?x\b|\d+\s?(?:k|m)\b|\d+\s?(?:users|ms|hours|days|customers)/gi) || []).length;
    const bullets = (text.match(/^\s*[•▪●◦*\-–]\s+\S/gm) || []).length;
    const missing = (match?.missing || []).slice(0, 4).join(', ');
    const checks = [
      ['Email address', 10, /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text), 'Add a professional email address at the top.'],
      ['Phone number', 5, /(?:\+?\d[\d\s().-]{8,}\d)/.test(text), 'Add a phone number recruiters can call.'],
      ['LinkedIn / GitHub / portfolio link', 5, /linkedin\.com|github\.com|portfolio|behance\.net/i.test(text), 'Add your LinkedIn and GitHub (or portfolio) link.'],
      ['Summary / objective', 5, /\b(summary|objective|profile)\b/i.test(text), 'Add a 2–3 line summary tailored to the role.'],
      ['Experience or projects', 10, /\b(experience|employment|internship|work history|projects?)\b/i.test(text), 'Add an Experience or Projects section.'],
      ['Education', 10, /\beducation\b|b\.?tech|b\.?e\b|bachelor|master|degree|university|college/i.test(text), 'Add your education details.'],
      ['Skills section', 10, /\bskills?\b/i.test(text), 'Add a clear Skills section with the tools you know.'],
      ['Good length (200–900 words)', 10, words >= 200 && words <= 900, words < 200 ? `Too short (${words} words) — add detail about projects and impact.` : `Too long (${words} words) — keep it to 1–2 pages.`],
      ['Bullet points', 5, bullets >= 4, 'Use bullet points (4+) instead of long paragraphs.'],
      ['Strong action verbs', 10, verbs.size >= 5, 'Start bullets with action verbs like Built, Led, Improved, Reduced, Delivered.'],
      ['Quantified results', 10, metrics >= 3, 'Add numbers: “reduced load time by 40%”, “served 10k users”.'],
      ['Keywords match the role', 10, (match?.score ?? 0) >= 70, missing ? `Add relevant keywords you genuinely know: ${missing}.` : 'Mirror keywords from the job description.'],
    ].map(([label, points, pass, tip]) => ({ label, points, pass: !!pass, tip }));
    return { score: checks.reduce((s, c) => s + (c.pass ? c.points : 0), 0), checks };
  }

  const count = (text, re) => (text.match(re) || []).length;
  function feedback({ answer, type, skill }) {
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
      const topic = SKILLS.find((s) => s.name === skill);
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

  async function extractText(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5 MB).');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') return file.text();
    if (ext === 'docx') {
      if (!root.mammoth) throw new Error('DOCX reader did not load. Refresh the page and try again.');
      const result = await root.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    }
    if (ext === 'pdf') {
      const pdfjs = await import('./vendor/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', document.baseURI).href;
      const loadingTask = pdfjs.getDocument({
        data: await file.arrayBuffer(),
        cMapUrl: new URL('./vendor/cmaps/', document.baseURI).href,
        cMapPacked: true,
        standardFontDataUrl: new URL('./vendor/standard_fonts/', document.baseURI).href,
        isEvalSupported: false,
      });
      try {
        const pdf = await loadingTask.promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => item.str || '').join(' '));
        }
        return pages.join('\n');
      } finally {
        await loadingTask.destroy();
      }
    }
    throw new Error('Unsupported file type. Please use PDF, DOCX or TXT.');
  }

  return { generate, checkResume, feedback, extractText };
});
