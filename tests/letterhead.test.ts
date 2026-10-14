import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLetterheadHtml, escapeHtml } from '../src/lib/letterheadTemplate.ts';

test('escapeHtml escapes dangerous HTML characters', () => {
  assert.equal(
    escapeHtml('<script>alert("xss & hello")</script>'),
    '&lt;script&gt;alert(&quot;xss &amp; hello&quot;)&lt;/script&gt;',
  );
});

test('generateLetterheadHtml includes brand header, officers, and custom text', () => {
  const html = generateLetterheadHtml({
    customText: 'सर्व सदस्यांची विशेष बैठक दिनांक २० ऑक्टोबर रोजी आयोजित केली आहे.',
    refNo: 'DMA/2026/101',
    date: '14/10/2026',
  });

  assert.ok(html.includes('डॉ. मंगेश आमले फाऊंडेशन'));
  assert.ok(html.includes('DR. MANGESH AMALE FOUNDATION'));
  assert.ok(html.includes('ठाणे/००००/१५०/२०२५'));
  assert.ok(html.includes('डॉ. मंगेश आमले'));
  assert.ok(html.includes('श्री. अरुण कोरडे'));
  assert.ok(html.includes('श्री. अभयसिंह पिसाळ'));
  assert.ok(html.includes('श्री. अक्षय बोराडे'));
  assert.ok(html.includes('श्री. किशोर दांगट'));
  assert.ok(html.includes('श्री. सुशांत चवरे'));
  assert.ok(html.includes('श्री. विकास बिराजदार'));
  assert.ok(html.includes('श्री. तानाजी बोळावे'));
  assert.ok(html.includes('श्री. नितीन खेडकर'));
  assert.ok(html.includes('सौ. तेजस्वी आमले'));
  assert.ok(html.includes('सौ. शुभांगी लोंढे'));
  assert.ok(html.includes('मुख्य कार्यालय'));
  assert.ok(html.includes('9082714026'));
  assert.ok(html.includes('www.dmafoundation.in'));
  assert.ok(html.includes('DMA/2026/101'));
  assert.ok(html.includes('14/10/2026'));
  assert.ok(html.includes('सर्व सदस्यांची विशेष बैठक'));
});

test('generateLetterheadHtml handles empty optional fields cleanly', () => {
  const html = generateLetterheadHtml({
    customText: 'Test message',
  });

  assert.ok(html.includes('Test message'));
  assert.ok(html.includes('Ref. No.'));
  assert.ok(!html.includes('undefined'));
});
