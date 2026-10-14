import { FOUNDATION_LOGO_BASE64 } from './letterheadLogo.ts';

export interface LetterheadData {
  customText: string;
  refNo?: string;
  date?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateLetterheadHtml({ customText, refNo = '', date = '' }: LetterheadData): string {
  const safeText = escapeHtml(customText || '').trim();
  const safeRefNo = escapeHtml(refNo.trim());
  const safeDate = escapeHtml(date.trim());

  return `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dr. Mangesh Amale Foundation</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Mukta', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 100%;
      max-width: 190mm;
      min-height: 275mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    /* HEADER */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
    }

    .logo-container {
      width: 88px;
      height: 88px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-container img {
      width: 86px;
      height: 86px;
      object-fit: contain;
    }

    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 10px;
    }

    .title-marathi {
      font-size: 26px;
      font-weight: 800;
      color: #152764;
      line-height: 1.15;
      letter-spacing: 0.2px;
    }

    .title-english {
      font-size: 17px;
      font-weight: 800;
      color: #152764;
      letter-spacing: 0.8px;
      line-height: 1.2;
      margin-top: 1px;
    }

    .reg-no {
      font-size: 13px;
      font-weight: 600;
      color: #111;
      line-height: 1.3;
      margin-top: 2px;
    }

    .tagline {
      font-size: 13px;
      font-weight: 700;
      color: #111;
      line-height: 1.3;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }

    .header-divider {
      height: 2.5px;
      background-color: #152764;
      width: 100%;
      margin-top: 4px;
      margin-bottom: 6px;
    }

    /* MAIN BODY - 2 COLUMNS */
    .content-area {
      flex: 1;
      display: flex;
      min-height: 215mm;
    }

    .sidebar {
      width: 52mm;
      min-width: 52mm;
      border-right: 1.5px solid #152764;
      padding-right: 8px;
      padding-top: 4px;
      padding-bottom: 8px;
    }

    .officer {
      margin-bottom: 12px;
    }

    .officer-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #111;
      line-height: 1.25;
    }

    .officer-post {
      font-size: 11.5px;
      font-weight: 600;
      color: #333;
      line-height: 1.2;
    }

    .officer-desc {
      font-size: 8px;
      font-weight: 500;
      color: #222;
      line-height: 1.25;
      margin-top: 2px;
    }

    .members-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #111;
      margin-top: 14px;
      margin-bottom: 4px;
    }

    .member-item {
      font-size: 11.5px;
      font-weight: 500;
      color: #222;
      line-height: 1.35;
    }

    .main-body {
      flex: 1;
      padding-left: 14px;
      padding-top: 4px;
      padding-bottom: 12px;
      display: flex;
      flex-direction: column;
    }

    .ref-date-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13.5px;
      font-weight: 600;
      color: #111;
      margin-bottom: 16px;
      padding-bottom: 4px;
    }

    .ref-no-label {
      font-weight: 700;
      color: #111;
    }

    .letter-text {
      flex: 1;
      font-size: 14px;
      line-height: 1.65;
      color: #1a1a1a;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
    }

    /* FOOTER */
    .footer-divider {
      height: 1.5px;
      background-color: #152764;
      width: 100%;
      margin-top: 8px;
      margin-bottom: 5px;
    }

    .footer {
      text-align: center;
      padding-bottom: 4px;
    }

    .footer-address {
      font-size: 11px;
      font-weight: 600;
      color: #152764;
      line-height: 1.35;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    .footer-contacts {
      font-size: 11px;
      font-weight: 700;
      color: #152764;
      line-height: 1.35;
      margin-top: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .contact-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .icon-svg {
      display: inline-block;
      vertical-align: middle;
      width: 12px;
      height: 12px;
      fill: #152764;
    }
  </style>
</head>
<body>
  <div class="page">
    <div>
      <div class="header">
        <div class="logo-container">
          <img src="${FOUNDATION_LOGO_BASE64}" alt="Foundation Logo" />
        </div>
        <div class="header-center">
          <div class="title-marathi">डॉ. मंगेश आमले फाऊंडेशन</div>
          <div class="title-english">DR. MANGESH AMALE FOUNDATION</div>
          <div class="reg-no">नोंदणी क्र. ठाणे/००००/१५०/२०२५</div>
          <div class="tagline">&#9679; समता &#9679; स्वतंत्रता &#9679; सन्मान &#9679; सेवा &#9679; समृद्धी &#9679; सहकार</div>
        </div>
      </div>
      <div class="header-divider"></div>
    </div>

    <div class="content-area">
      <div class="sidebar">
        <div class="officer">
          <div class="officer-name">डॉ. मंगेश आमले</div>
          <div class="officer-post">अध्यक्ष</div>
          <div class="officer-desc">
            D.Litt, PhD, PDC, MBA, PGDCS, PGDBT,<br>
            DIM, EMBA - Washington University<br>
            IITian from IIT Bombay &amp; IIT Jammu
          </div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. अरुण कोरडे</div>
          <div class="officer-post">उपाध्यक्ष</div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. अभयसिंह पिसाळ</div>
          <div class="officer-post">सचिव</div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. अक्षय बोराडे</div>
          <div class="officer-post">सह सचिव</div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. किशोर दांगट</div>
          <div class="officer-post">खजिनदार</div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. सुशांत चवरे</div>
          <div class="officer-post">सह खजिनदार</div>
        </div>

        <div class="officer">
          <div class="officer-name">श्री. विकास बिराजदार</div>
          <div class="officer-post">सल्लागार</div>
        </div>

        <div class="members-title">सभासद</div>
        <div class="member-item">श्री. तानाजी बोळावे</div>
        <div class="member-item">श्री. नितीन खेडकर</div>
        <div class="member-item">सौ. तेजस्वी आमले</div>
        <div class="member-item">सौ. शुभांगी लोंढे</div>
      </div>

      <div class="main-body">
        <div class="ref-date-row">
          <div><span class="ref-no-label">Ref. No.</span> ${safeRefNo ? `: ${safeRefNo}` : ''}</div>
          ${safeDate ? `<div>Date: ${safeDate}</div>` : ''}
        </div>
        <div class="letter-text">${safeText}</div>
      </div>
    </div>

    <div>
      <div class="footer-divider"></div>
      <div class="footer">
        <div class="footer-address">
          <svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          मुख्य कार्यालय : ऑफिस नं. ०५, तळमजला, निळकंठ कॉर्नर, सेक्टर २, सानपाडा, नवी मुंबई-४००७०५.
        </div>
        <div class="footer-contacts">
          <span class="contact-item">
            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            9082714026 / 9870417763
          </span>
          <span class="contact-item">
            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            www.dmafoundation.in
          </span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
