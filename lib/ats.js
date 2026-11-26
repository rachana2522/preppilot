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

module.exports = { checkResume };
