const path = require('path');

async function extractText(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.pdf') {
    const pdf = require('pdf-parse');
    return (await pdf(file.buffer)).text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  }
  if (ext === '.txt' || ext === '.md') return file.buffer.toString('utf8');
  const err = new Error('Unsupported file type. Please upload a PDF, DOCX or TXT resume.');
  err.status = 400;
  throw err;
}

module.exports = { extractText };
