require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { extractText } = require('./lib/parse');
const { generate } = require('./lib/generate');
const { checkResume } = require('./lib/ats');
const { feedback } = require('./lib/feedback');
const { isResumeText } = require('./public/offline');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));

app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => res.json({ ai: !!process.env.OPENAI_API_KEY }));

app.post('/api/analyze', upload.single('resume'), async (req, res) => {
  try {
    const company = (req.body.company || '').trim();
    if (!company) return res.status(400).json({ error: 'Please enter the company you are applying to.' });
    if (!req.file) return res.status(400).json({ error: 'Please upload your resume.' });

    const resumeText = (await extractText(req.file)).replace(/\u0000/g, '').trim();
    if (resumeText.length < 50) return res.status(400).json({ error: 'Could not read text from this resume. Try a text-based PDF or DOCX.' });
    if (!isResumeText(resumeText)) return res.status(400).json({ error: 'This file does not appear to be a resume. Please upload a resume with sections such as experience, education, skills or projects.' });

    const result = await generate({ resumeText, company, role: (req.body.role || '').trim(), jdText: (req.body.jd || '').trim() });
    result.ats = checkResume(resumeText, result.match);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong while analysing your resume.' });
  }
});

app.post('/api/feedback', async (req, res) => {
  const { question, answer, type, skill, company, role } = req.body || {};
  if (!question || typeof answer !== 'string' || !answer.trim()) return res.status(400).json({ error: 'Please write or speak an answer first.' });
  res.json(await feedback({ question: String(question), answer: answer.trim(), type: type === 'technical' ? 'technical' : 'behavioral', skill, company, role }));
});

app.use((err, _req, res, _next) => {
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB).' : 'Server error.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Interview Prep running at http://localhost:${port}`));
