const test = require('node:test');
const assert = require('node:assert/strict');
const { isResumeText } = require('../public/offline');

test('accepts resumes with different combinations of sections', () => {
  assert.equal(isResumeText('Education: Bachelor of Science. Skills: communication and customer service.'), true);
  assert.equal(isResumeText('Work history: cashier and team lead. Certifications: first aid.'), true);
  assert.equal(isResumeText('Experience: student intern. Projects: designed an educational website.'), true);
});

test('rejects bills and documents with only one resume indicator', () => {
  assert.equal(isResumeText('Invoice for broadband service. Your experience matters. Total due: 500.'), false);
  assert.equal(isResumeText('Shopping list: apples, oranges, coffee, bread and cereal.'), false);
  assert.equal(isResumeText('Experience with customer service and work experience at a retail store.'), false);
});
