// texts.mjs: English texts for the quiz "Does the Slovak e-invoice mandate apply to me?".
// Same structure as /efaktura/kviz/texty.mjs; sources per paragraph live in /efaktura/kviz/logika.mjs.
// Quotes from Slovak sources are shown as our translation (citaty below), marked in the UI.
// No dashes, no countdowns, no pressure; 1 January 2027 is the real date (FAQ question 17).

const TOOL = '/efaktura/en/';

export default {
  jazyk: 'en',
  ui: {
    postup: (n, max) => `Question ${n} of ${max}`,
    spat: 'Back',
    klavesy: 'Keyboard: a number picks an answer, Backspace goes back one step.',
    nacitava: 'Loading the quiz.',
    vysledok: 'Result',
    istota: {
      iste: 'The Financial Administration FAQ says this directly.',
      overit: 'We recommend checking this case with a tax adviser or accountant.',
    },
    coRobit: 'What we suggest',
    zdrojeNadpis: 'Sources for this result',
    zdrojeUvod: 'FAQ means: Financial Directorate of the Slovak Republic, Najčastejšie otázky a odpovede k eFaktúre (FAQ on eInvoicing), 9/DPH/2025/IM, version of 15 September 2026, in Slovak. Quotes from Slovak sources are our translation; page numbers refer to that PDF, checked on 26 September 2026.',
    odpovedeNadpis: 'Your answers',
    zmenit: 'Change answers',
    znova: 'Start again',
    otvorit: 'open',
    preklad: '(our translation)',
    uvodzovky: ['“', '”'],
  },

  otazky: {
    q1: {
      nadpis: 'Are you a VAT payer in Slovakia?',
      pomoc: 'This decides whether you must issue e-invoices or only receive them.',
      moznosti: {
        platitel: { text: 'Yes, I am a VAT payer', pomoc: 'Registered under section 4 of the Slovak VAT Act; your invoices usually charge VAT.' },
        par7: { text: 'I only have a VAT ID under section 7 or 7a', pomoc: 'For example because of services bought from abroad, without being a VAT payer.' },
        neplatitel: { text: 'No, I am not a VAT payer' },
        par5: { text: 'We are a foreign company registered in Slovakia under section 5' },
        neviem: { text: 'I don’t know' },
      },
      varianty: {
        B: { nadpis: 'How are you registered for VAT in Slovakia?' },
      },
    },
    q2: {
      nadpis: 'Who do you invoice?',
      pomoc: 'Public offices, municipalities, associations and foundations count as organisations.',
      moznosti: {
        firmy: { text: 'Companies, sole traders, public offices or organisations' },
        obom: { text: 'Both companies and private individuals' },
        ludia: { text: 'Only private individuals (consumers)' },
      },
    },
    q3: {
      nadpis: 'Where are your customers based?',
      pomoc: 'We mean the companies, sole traders and organisations you invoice.',
      moznosti: {
        sk: { text: 'Only in Slovakia' },
        sk_de: { text: 'In Slovakia and in Germany' },
        sk_zahr: { text: 'In Slovakia and elsewhere abroad' },
        zahr: { text: 'Only abroad' },
      },
    },
    q4: {
      nadpis: 'What do you use to issue invoices today?',
      moznosti: {
        excel: { text: 'Excel, Word or paper' },
        appka: { text: 'An invoicing app or program without e-invoicing' },
        softver: { text: 'Accounting software that already handles e-invoices' },
        neviem: { text: 'I don’t know if my software can do it' },
      },
    },
    q5: {
      nadpis: 'Who will send your e-invoices through a Digital Postman?',
      pomoc: 'A Digital Postman (digitálny poštár) is a certified provider that delivers e-invoices in the Peppol network.',
      moznosti: {
        niekto: { text: 'My accountant or IT, already sorted' },
        sam: { text: 'I will do it myself' },
        neviem: { text: 'Not sure yet' },
      },
    },
    q6: {
      nadpis: 'Roughly how many invoices do you issue a month?',
      moznosti: {
        '1_3': { text: '1 to 3' },
        '4_20': { text: '4 to 20' },
        nad_20: { text: 'More than 20' },
      },
    },
  },

  tykaSaUvod: [
    'As a VAT payer, from 1 January 2027 you will issue invoices to companies, sole traders, public offices and organisations in Slovakia as e-invoices: a structured XML file under the EN 16931 standard, not a PDF. The legal basis is Act No. 385/2025 Coll., which amends the Slovak VAT Act.',
    'From the same day you must also be able to receive e-invoices from your suppliers. 2026 is a transition year: you may send e-invoices voluntarily if your customer also has a Digital Postman.',
  ],

  segmenty: {
    nie_platitel: {
      nadpis: 'You do not have to issue e-invoices. From 1 January 2027 you must be able to receive them.',
      odseky: [
        'From 1 January 2027 the obligation to issue an e-invoice does not apply to a business that is not a VAT payer.',
        'But every legal person and every business must be able to receive e-invoices from 1 January 2027, so you will need a contract with a Digital Postman. You may join voluntarily and send e-invoices too; that does not oblige you to send all your invoices this way.',
        'When an e-invoice arrives as an XML file, you can read it here free of charge as an ordinary document and save it as a PDF.',
      ],
    },
    registracia_7a: {
      nadpis: 'The Financial Administration FAQ does not cover your case explicitly.',
      odseky: [
        'Under section 85o(2) of the VAT Act as quoted by the Financial Administration, the obligation to issue an e-invoice lies with a domestic VAT payer registered under section 4, 4b or 4c. Registration under section 7 or 7a is not on that list, and the FAQ does not address it separately.',
        'One thing is certain: every business must be able to receive e-invoices from 1 January 2027, and that includes you.',
      ],
    },
    registracia_5: {
      nadpis: 'As a company registered under section 5, you do not have to issue e-invoices or receive them through the delivery service until 30 June 2030.',
      odseky: [
        'The Financial Administration states that a person registered under section 5 is not obliged to issue an electronic invoice, nor to ensure its receipt through the delivery service, from 1 January 2027 to 30 June 2030.',
        'Check the position after 30 June 2030 with a tax adviser.',
      ],
    },
    neviem_status: {
      nadpis: 'First find out whether you are a VAT payer. Almost everything depends on it.',
      odseky: [
        'If you are a VAT payer, from 1 January 2027 you will issue invoices to companies, sole traders and public offices in Slovakia as e-invoices. If you are not, you do not have to issue them.',
        'Every business must be able to receive e-invoices from 1 January 2027, whatever its VAT status.',
        'Ask your accountant, then take the quiz again.',
      ],
    },
    len_spotrebitelia: {
      nadpis: 'Invoices to private individuals do not have to be e-invoices. You must still be able to receive e-invoices.',
      odseky: [
        'According to the Financial Administration, the e-invoice covers only invoicing between businesses (B2B) and between businesses and public administration (B2G). It does not concern end consumers.',
        'Once you invoice a company, sole trader or public office in Slovakia, those invoices will be e-invoices.',
        'From 1 January 2027 you must be able to receive e-invoices from your suppliers. When an XML file arrives, you can read it here free of charge as an ordinary document.',
      ],
    },
    len_zahranicie: {
      nadpis: 'If you only invoice customers abroad, issuing e-invoices from 1 January 2027 does not concern you yet. Receiving does.',
      odseky: [
        'The obligation from 1 January 2027 concerns only domestic persons and domestic transactions, and the Slovak e-invoice system is for now only for invoices within Slovakia. The Financial Administration expects an extension to cross-border supplies from 1 July 2030.',
        'From 1 January 2027 you must be able to receive e-invoices from Slovak suppliers.',
        'Whether the place of supply of your services or goods really is abroad, check with a tax adviser. If your customers want an e-invoice (for example XRechnung in Germany), you can check the file here free of charge before you send it.',
      ],
    },
    tyka_sa_riesenie: {
      nadpis: 'Yes, the e-invoice applies to you from 1 January 2027. You probably have a solution already.',
      uvod: true,
      odseky: [
        'From your answers, your software can produce e-invoices or your accountant or IT handles them. Ask your software supplier whether it will also send and receive e-invoices through a Digital Postman.',
        'You do not need to buy anything from us. Before sending, you can check the XML from your software free of charge against the EN 16931 and Peppol BIS Billing 3.0 rules.',
      ],
    },
    tyka_sa_malo: {
      nadpis: 'Yes, the e-invoice applies to you from 1 January 2027.',
      uvod: true,
      odseky: [
        'With 1 to 3 invoices a month, paying per invoice is cheaper: the XML of one invoice costs 2.90 € excl. VAT here, so three invoices cost 8.70 € excl. VAT, while 30 days cost 9.90 € excl. VAT. The form and the preview are free; you only pay when you download the finished XML.',
      ],
    },
    tyka_sa_stredne: {
      nadpis: 'Yes, the e-invoice applies to you from 1 January 2027.',
      uvod: true,
      odseky: [
        'With 4 or more invoices a month, 30 days with no limit on the number of invoices for 9.90 € excl. VAT is cheaper. Four invoices paid one by one would cost 11.60 € excl. VAT. It is a one-time payment, no subscription. The form and the preview are free.',
      ],
    },
    tyka_sa_vela: {
      nadpis: 'Yes, the e-invoice applies to you from 1 January 2027.',
      uvod: true,
      odseky: [
        'With more than 20 invoices a month, 30 days for 9.90 € excl. VAT is the better deal, including a CSV batch in one ZIP. It is a one-time payment, no subscription.',
        'For businesses with a few dozen invoices, the Financial Administration writes that an expensive automated system is not needed. If you have many more and the number grows, consider accounting software that creates and sends e-invoices by itself.',
      ],
    },
  },

  poznamky: {
    vynimky: {
      nadpis: 'Exceptions to the obligation',
      text: 'You do not have to issue an e-invoice for a supply exempt from VAT under sections 28 to 43 and 47 of the VAT Act, or when you issue a simplified invoice (an eKasa receipt up to 400 € or a document up to 100 €). You must not issue one if the recipient is the Slovak Information Service or Military Intelligence, or if the supply involves classified information. If one of these exceptions applies to you, check the procedure with a tax adviser.',
      rozbalit: true,
    },
    postar: {
      nadpis: 'To send, you need a Digital Postman',
      text: 'You choose the Digital Postman yourself. Our tool creates and checks the XML, but it does not send it into the Peppol network. The Financial Administration estimates that a simple Digital Postman app will cost no more than the EU average of 5 to 12 € a month, and it describes the route where you create the XML elsewhere and simply upload and send it in the postman’s app. Whether your postman allows that, ask them.',
    },
    aj_spotrebitelia: {
      nadpis: 'Invoices to private individuals',
      text: 'Invoices to private individuals (consumers) are not covered by the obligation. It concerns invoices to companies, sole traders, public offices and organisations.',
    },
    zahranicie: {
      nadpis: 'Invoices to customers abroad',
      text: 'Invoices to customers abroad are not part of the obligation from 1 January 2027, which concerns only domestic persons and domestic transactions. The Financial Administration expects an extension to cross-border supplies from 1 July 2030.',
    },
    nemecko: {
      nadpis: 'Customers in Germany',
      text: 'German rules apply in Germany, and we have not checked them for a supplier from Slovakia. What we know from the source: businesses in Germany must be able to receive e-invoices from 1 January 2025, and XRechnung is one of the German e-invoice formats. If your customer asks for it, you can build and check it in our tool. Whether you are obliged to issue it, check with a tax adviser.',
    },
    spytajte_softver: {
      nadpis: 'Not sure your software can do it?',
      text: 'The Financial Administration advises asking your accounting software supplier whether it will be able to issue an e-invoice that you then upload and send through the Digital Postman app.',
    },
  },

  ciele: {
    kontrola: { href: TOOL + '?z=quiz#kontrola', text: 'Check your XML free', popis: 'No account, the file stays in your browser.' },
    nahlad: { href: TOOL + '?z=quiz#nahlad', text: 'Read an e-invoice free', popis: 'See a supplier’s XML as an ordinary document and save it as a PDF.' },
    vytvorit_jedna: { href: TOOL + '?z=quiz#vytvorit', text: 'Build an invoice in the form', popis: 'Form and preview free. XML of one invoice 2.90 € excl. VAT.' },
    vytvorit_30: { href: TOOL + '?z=quiz#vytvorit', text: 'Build invoices in the form', popis: 'Form and preview free. 30 days without limit for 9.90 € excl. VAT.' },
    vytvorit_xrechnung: { href: TOOL + '?z=quiz#vytvorit', text: 'Build an XRechnung for Germany', popis: 'The same form, XRechnung 3.x profile with Leitweg-ID.' },
    info: { href: 'https://www.financnasprava.sk/en/businesses/taxes-businesses#eInvoice', text: 'Financial Administration: eInvoice in English', popis: 'The official overview, linked from the FAQ (question 53).' },
    znova: { text: 'Take the quiz again' },
  },

  dokumenty: {
    faq: 'FAQ 9/DPH/2025/IM',
    zakon385: 'Act No. 385/2025 Coll. amending VAT Act No. 222/2004 Coll. (slov-lex.sk, in Slovak)',
    zakon222: 'VAT Act No. 222/2004 Coll., section 85o as in force from 1 January 2027 (slov-lex.sk, in Slovak)',
    bmf: 'German Federal Ministry of Finance, FAQ on mandatory e-invoicing from 1 January 2025 (checked 11 September 2026)',
    kosit: 'KoSIT, XRechnung, the German e-invoice specification (xeinkauf.de, checked 11 September 2026)',
    arling: 'ARLing, E-invoice tool (arling.sk/efaktura/en/)',
  },
  miesto: (z) => (z.priklad == null ? `part ${z.cast}, introduction, p. ${z.strana}` : `part ${z.cast}, question ${z.priklad}, p. ${z.strana}`),

  // Our translation of the Slovak FAQ quotes in logika.mjs (ZDROJE.*.citat).
  citaty: {
    faq_uvod: 'With effect from 1 January 2027, the amended VAT Act will introduce an obligation for VAT payers to issue and receive invoices for domestic supplies of goods and services in the prescribed electronic format.',
    faq_1: 'in a structured electronic XML format under the European standard EN16931 in the UBL or CII standard',
    faq_3: 'A PDF invoice is only an image document, whereas an eInvoice is a structured XML file',
    faq_4: 'No. At present, the eInvoice applies only to invoicing between businesses (B2B) and between businesses and public administration (B2G).',
    faq_6: 'You choose the Digital Postman yourself from the offers on the market.',
    faq_7: 'Every legal person and every taxable person (business) must be able to receive electronic invoices from 1.1.2027.',
    faq_10: 'We assume that a subscription to such a simple Digital Postman application will not cost more than the EU average of 5 to 12 euros a month.',
    faq_14_maly: 'Given the size and nature of the business of a taxpayer who issues or receives only a few dozen invoices, an expensive automated system is not needed.',
    faq_14_softver: 'Ask your accounting system supplier whether their system will be able to issue an electronic invoice, which you or your accountant then simply upload and send through the Digital Postman application.',
    faq_15: 'The transition period for introducing domestic electronic invoicing runs from 1 January 2026 to 31 December 2026.',
    faq_16: 'The eFaktúra system is currently intended only for exchanging invoices within the Slovak Republic.',
    faq_17: 'The obligation to invoice B2B and B2G transactions in Slovakia will apply from 1.1.2027.',
    faq_38: 'a domestic VAT payer (section 4, 4b or 4c) is obliged to issue an electronic invoice',
    faq_51: 'from 1.1.2027 a VAT payer will not be obliged to issue an electronic invoice if the supply of goods or services is exempt from VAT under sections 28 to 43 and 47, or if the payer issues a simplified invoice under section 74(3)(a) or (b) of the VAT Act (a document up to 100 euros or an eKasa receipt).',
    faq_57: 'With effect from 1.1.2027, the obligation to issue an electronic invoice under section 85o does not apply to a taxable person who is not a VAT payer.',
    faq_62_spotrebitelia: 'Who the obligation will not concern at all: end consumers',
    faq_62_2030: 'From 1 July 2030, the obligation is expected to extend to cross-border supplies of goods and services (EU and third countries).',
    faq_63: 'Yes, entities without a legal obligation (e.g. non-VAT payers) may also join the electronic invoicing system voluntarily.',
    faq_66: 'if a payer issues a simplified invoice from an eKasa cash register (up to 400 euros), it is not obliged to issue an electronic invoice.',
    faq_83: 'a payer must not issue an electronic invoice under paragraph 4 of section 85o of the VAT Act if the recipient is the Slovak Information Service or Military Intelligence, or if the supply is connected with classified information',
    faq_ii15_zakon: 'The amendment to the VAT Act published in the Collection of Laws as No. 385/2025 Coll. introduces, with effect from 1.1.2027, an obligation to issue an electronic invoice for domestic taxable transactions between domestic persons',
    faq_ii29_tuzemske: 'This transitional provision concerns only domestic persons and domestic transactions (Slovakia → Slovakia).',
    faq_ii29_par5: 'A person registered under section 5 of Act No. 222/2004 Coll. is not obliged under this transitional provision to issue an electronic invoice, nor to ensure receipt of electronic invoices through the delivery service, in the period from 1.1.2027 to 30.6.2030.',
  },

  // Sources without an FAQ quote. citat for arling_* is verbatim from products/arling-sk/efaktura/en/index.html (tested).
  zdroje: {
    bmf_prijem: { popis: 'Businesses in Germany must be able to receive e-invoices from 1 January 2025.' },
    kosit_xrechnung: { popis: 'XRechnung is the German e-invoice specification based on EN 16931.' },
    zakon_385: { popis: 'Amendment to the VAT Act, in force from 1 January 2027.' },
    zakon_85o: { popis: 'Transitional provision on mandatory electronic invoices.' },
    arling_kontrola: { citat: 'Drop in a UBL file and see at once which EN 16931, Peppol or XRechnung rule it breaks, and where. Free, no account, and the file never leaves your browser.' },
    arling_cena_jedna: { citat: 'The form and the preview are free. The finished XML is paid: 2.90 € excl. VAT for one invoice' },
    arling_cena_30: { citat: 'or 9.90 € excl. VAT for 30 days with no limit on the number of invoices.' },
    arling_cennik: { citat: 'Any number of invoices, including a CSV batch in one ZIP. One-time payment, no subscription.' },
    arling_bez_peppol: { citat: 'Delivery into the Peppol network is not included.' },
    arling_nahlad: { citat: 'Useful when a file arrives from a supplier and you have to read it without accounting software.' },
    arling_xrechnung: { citat: 'You can check and build XRechnung 3.x here, Leitweg-ID field included.' },
  },
};
