// Section schemas — declarative description of every field in the four rich
// sections ported from the v0 mockup. The generic form renderer in fields.tsx
// walks these schemas so we don't hand-build 100+ JSX inputs.

export type FieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'date'
  | 'textarea'
  | 'select'
  | 'chips';

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  options?: string[]; // for select + chips
  full?: boolean; // spans grid width
  optional?: boolean;
  callout?: { type: 'info' | 'warn' | 'accent'; text: string };
};

export type SingleCard = {
  kind: 'single';
  title: string;
  hint?: string;
  callout?: { type: 'info' | 'warn' | 'accent'; text: string };
  fields: Field[];
};

export type RepeatCard = {
  kind: 'repeat';
  title: string;
  listId: string; // key under SectionData.items[listId]
  addLabel: string;
  hint?: string;
  callout?: { type: 'info' | 'warn' | 'accent'; text: string };
  maxItems?: number;
  fields: Field[];
};

export type Card = SingleCard | RepeatCard;

export type SectionSchema = {
  intro: string;
  rootCallout?: { type: 'info' | 'warn' | 'accent'; text: string };
  cards: Card[];
};

export const SCHEMAS: Record<string, SectionSchema> = {
  me: {
    intro: 'Your basic identity — names, dates, family. The first thing anyone looking for information will need.',
    cards: [
      {
        kind: 'single',
        title: 'Personal information',
        hint: 'Start here — the basics everyone will need.',
        fields: [
          { id: 'title', label: 'Title', type: 'select', options: ['Mrs', 'Mr', 'Miss', 'Mx', 'Dr'] },
          { id: 'pronouns', label: 'Preferred pronouns', type: 'text' },
          { id: 'firstName', label: 'First name', type: 'text' },
          { id: 'middleName', label: 'Middle name', type: 'text' },
          { id: 'surname', label: 'Surname', type: 'text' },
          { id: 'nicknames', label: 'Nicknames', type: 'text' },
          { id: 'dob', label: 'Date of birth', type: 'date' },
          { id: 'placeOfBirth', label: 'Place of birth', type: 'text' },
          { id: 'previousName', label: 'Have you ever been legally known by a different name?', type: 'text', full: true, placeholder: 'e.g. maiden name, previous legal name' },
          { id: 'ethnicity', label: 'Ethnicity', type: 'text', optional: true },
          { id: 'religion', label: 'Religion', type: 'text', optional: true },
          { id: 'nino', label: 'National Insurance / Social Security Number', type: 'text', full: true, callout: { type: 'info', text: 'Why we ask: needed to claim pensions and close tax accounts. Stored only on this device.' } },
        ],
      },
      {
        kind: 'single',
        title: 'Most recent address',
        fields: [
          { id: 'street', label: 'Street address', type: 'textarea', full: true },
          { id: 'postcode', label: 'Postcode', type: 'text' },
          { id: 'country', label: 'Country', type: 'text' },
          { id: 'homePhone', label: 'Home phone', type: 'tel' },
          { id: 'mobile', label: 'Mobile', type: 'tel' },
        ],
      },
      {
        kind: 'single',
        title: 'Marital status',
        fields: [
          { id: 'maritalStatus', label: 'Status', type: 'chips', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Civil partnership'], full: true },
          { id: 'spouse', label: 'Current spouse / partner', type: 'text' },
          { id: 'spousePhone', label: 'Phone', type: 'tel' },
        ],
      },
      {
        kind: 'repeat',
        title: 'Children & stepchildren',
        listId: 'children',
        addLabel: '＋ Add a child or stepchild',
        hint: 'Add each child, even if adult.',
        fields: [
          { id: 'name', label: 'Name', type: 'text' },
          { id: 'relationship', label: 'Relationship', type: 'select', options: ['Child', 'Stepchild', 'Adopted'] },
          { id: 'dob', label: 'Date of birth', type: 'date' },
          { id: 'phone', label: 'Phone', type: 'tel' },
        ],
      },
    ],
  },

  financial: {
    intro: 'Pointers to your accounts. Never write full passwords or PINs here — this tells survivors where to go.',
    rootCallout: {
      type: 'warn',
      text: 'Important: Do NOT enter passwords, PINs, CVVs or account balances. This book tells your family where to look — it is not a password vault. For logins, use a password manager and leave access instructions in the Digital section.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Will & Power of Attorney',
        fields: [
          { id: 'willHeldBy', label: 'Will held by', type: 'text', full: true, placeholder: 'Solicitor name & firm, phone' },
          { id: 'willCopyLocation', label: 'Copy at home', type: 'text', full: true, placeholder: 'e.g. Fireproof safe, blue folder' },
          { id: 'poa', label: 'I have given power of attorney to', type: 'text', full: true },
          { id: 'poaLocation', label: 'Where the POA document is kept', type: 'text', full: true },
        ],
      },
      {
        kind: 'repeat',
        title: 'Bank accounts',
        listId: 'accounts',
        addLabel: '＋ Add another account',
        hint: 'Add each account your family should know about. Include the purpose so they know what\u2019s what.',
        maxItems: 10,
        fields: [
          { id: 'purpose', label: 'Account purpose', type: 'text', placeholder: 'e.g. Main current account' },
          { id: 'bank', label: 'Bank', type: 'text' },
          { id: 'accountLast4', label: 'Account number (last 4 only)', type: 'text', placeholder: '•••• 4471' },
          { id: 'sortCode', label: 'Sort code', type: 'text' },
          { id: 'joint', label: 'Joint account?', type: 'chips', options: ['No', 'Yes'] },
          { id: 'paperwork', label: 'Where paperwork is kept', type: 'text' },
        ],
      },
      {
        kind: 'repeat',
        title: 'Life insurance & pension',
        listId: 'policies',
        addLabel: '＋ Add a policy or pension',
        fields: [
          { id: 'name', label: 'Provider', type: 'text' },
          { id: 'kind', label: 'Type', type: 'select', options: ['Life insurance', 'Workplace pension', 'Private pension', 'Home & contents', 'Health', 'Other'] },
          { id: 'policyNumber', label: 'Policy / member number', type: 'text' },
          { id: 'phone', label: 'Phone', type: 'tel' },
        ],
      },
    ],
  },

  digital: {
    intro: 'Start with the phone. Then passwords. Then accounts. This is the order your family will need them.',
    rootCallout: {
      type: 'accent',
      text: 'Most accounts now require a verification code sent to your phone. If your family cannot unlock your phone, they cannot get into anything else. Start here.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Your devices',
        hint: 'The first door. Without this, nothing else in this section matters.',
        callout: { type: 'warn', text: 'Do NOT write passcodes here. Write where to find them (e.g. "sealed envelope in kitchen drawer marked Codes").' },
        fields: [
          { id: 'mainPhone', label: 'Main phone (make & model)', type: 'text', placeholder: 'e.g. iPhone 15, Samsung Galaxy S24' },
          { id: 'phonePasscodeLocation', label: 'Where is the phone passcode?', type: 'text', full: true, placeholder: 'e.g. Sealed envelope in the safe, page 3 of the red notebook' },
          { id: 'phoneBiometric', label: 'Does it use Face ID or fingerprint?', type: 'select', options: ['Face ID', 'Fingerprint', 'Both', 'Neither'] },
          { id: 'phoneBiometricNote', label: 'If biometrics fail, what should they do?', type: 'textarea', full: true, placeholder: 'e.g. After 5 failed attempts, it asks for the passcode. Use the code from the sealed envelope.' },
          { id: 'simPin', label: 'SIM PIN (if set)', type: 'text', optional: true, placeholder: 'Where to find it, not the PIN itself' },
          { id: 'tablet', label: 'Tablet or second device', type: 'text', optional: true, placeholder: 'e.g. iPad \u2014 same passcode as phone' },
          { id: 'laptop', label: 'Laptop / desktop', type: 'text', optional: true, placeholder: 'e.g. MacBook \u2014 password in same envelope' },
        ],
      },
      {
        kind: 'single',
        title: 'Two-factor authentication (the second door)',
        hint: 'Many accounts send a code to your phone or use an authenticator app before they let anyone in. Your family needs to know how to get past this step.',
        fields: [
          { id: 'primaryCodePhone', label: 'Which phone receives most verification codes?', type: 'text', full: true, placeholder: 'e.g. My main phone (see above)' },
          { id: 'authApp', label: 'Authenticator app', type: 'text', placeholder: 'e.g. Google Authenticator, Authy, Microsoft Authenticator' },
          { id: 'authAppBackup', label: 'Can the authenticator be accessed from another device?', type: 'text', full: true, placeholder: 'e.g. Authy syncs across devices \u2014 also on the iPad' },
          { id: 'backupCodesLocation', label: 'Where are your backup codes stored?', type: 'textarea', full: true, placeholder: 'e.g. Printed sheet in the safe. Also saved in 1Password under "Backup codes".' },
          { id: 'recoveryEmail', label: 'Recovery email address', type: 'email', full: true, callout: { type: 'info', text: 'This is the email most accounts will try to send a reset link to. Make sure your family knows how to access it (see email section below).' } },
          { id: 'trustedPerson', label: 'Account recovery contact (e.g. Apple, Google)', type: 'text', full: true, optional: true, placeholder: 'e.g. My daughter Sarah is set as Apple Legacy Contact' },
        ],
      },
      {
        kind: 'single',
        title: 'Password manager',
        hint: 'This is where all your account passwords live. Your family only needs to get into this one thing.',
        fields: [
          { id: 'manager', label: 'Which manager', type: 'text', placeholder: '1Password, Bitwarden, LastPass\u2026' },
          { id: 'kitLocation', label: 'Emergency Kit / master password location', type: 'text', full: true, placeholder: 'e.g. Home safe, envelope marked \u201CDigital\u201D' },
          { id: 'recoveryContact', label: 'Designated recovery contact', type: 'text', full: true },
          { id: 'managerNote', label: 'Anything else they should know?', type: 'textarea', full: true, optional: true, placeholder: 'e.g. The vault is shared with my husband. He has his own login.' },
        ],
      },
      {
        kind: 'single',
        title: 'Email accounts',
        hint: 'Email is the master key. Almost every account can be reset via email.',
        fields: [
          { id: 'primary', label: 'Primary email', type: 'email' },
          { id: 'primaryRecovery', label: 'How to access it without you', type: 'text', full: true, placeholder: 'e.g. Password in 1Password. 2FA code goes to my phone.' },
          { id: 'secondary', label: 'Secondary email', type: 'email', optional: true },
          { id: 'secondaryRecovery', label: 'How to access secondary', type: 'text', full: true, optional: true },
          { id: 'work', label: 'Work email', type: 'email', optional: true },
          { id: 'workNote', label: 'Work email note', type: 'text', full: true, optional: true, placeholder: 'e.g. Contact IT at my employer \u2014 they can provide access or forward mail' },
        ],
      },
      {
        kind: 'repeat',
        title: 'Online accounts',
        listId: 'digitalAccounts',
        addLabel: '\uFF0B Add an account',
        hint: 'List the accounts that matter most. For each one, note how your family can get in and what should happen to it.',
        fields: [
          { id: 'service', label: 'Service', type: 'text', placeholder: 'e.g. Amazon, Netflix, Facebook, utility provider\u2026' },
          { id: 'handle', label: 'Username / email used', type: 'text' },
          { id: 'twoFactor', label: 'How is it verified?', type: 'select', options: ['Code to phone', 'Authenticator app', 'Email code', 'No 2FA', 'Not sure'] },
          { id: 'wish', label: 'What should happen', type: 'select', options: ['Keep active', 'Cancel / close', 'Transfer to someone', 'Memorialise', 'Delete'] },
          { id: 'notes', label: 'Notes', type: 'text', optional: true },
        ],
      },
    ],
  },

  funeral: {
    intro: 'Your wishes so your family don\u2019t have to guess during a painful time.',
    rootCallout: {
      type: 'info',
      text: 'Not legally binding. These wishes guide your loved ones but don\u2019t replace a Will. You can skip anything you\u2019d rather leave to them.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Burial or cremation',
        fields: [
          { id: 'preference', label: 'Preference', type: 'chips', options: ['Cemetery burial', 'Cremation', 'Natural woodland', 'At sea', 'Other'], full: true },
          { id: 'crematorium', label: 'Preferred crematorium / site', type: 'text' },
          { id: 'ashes', label: 'Ashes — what should happen', type: 'select', options: ['Scattered at a meaningful place', 'Kept by a relative', 'Buried in a family plot'] },
          { id: 'ashesWhere', label: 'Where exactly?', type: 'text', full: true, placeholder: 'A place that means something to you' },
        ],
      },
      {
        kind: 'single',
        title: 'The service',
        fields: [
          { id: 'style', label: 'Religious / secular', type: 'chips', options: ['Secular', 'Religious'] },
          { id: 'coffin', label: 'Coffin during service', type: 'chips', options: ['Open', 'Closed'] },
          { id: 'readings', label: 'Readings I\u2019d like', type: 'textarea', full: true },
          { id: 'music', label: 'Music', type: 'textarea', full: true },
          { id: 'dressCode', label: 'Dress code', type: 'text' },
          { id: 'flowers', label: 'Flowers', type: 'select', options: ['Family flowers only', 'Family and close friends', 'No flowers — donations instead'] },
        ],
      },
      {
        kind: 'single',
        title: 'After the service',
        fields: [
          { id: 'gathering', label: 'Gathering', type: 'text', full: true, placeholder: 'e.g. Buffet at The Lido' },
          { id: 'donations', label: 'Charities for donations', type: 'textarea', full: true, placeholder: 'One per line' },
        ],
      },
    ],
  },

  docs: {
    intro: 'Pointers to your most important legal and identity documents.',
    cards: [
      {
        kind: 'single',
        title: 'Will & legal documents',
        fields: [
          { id: 'willHeldBy', label: 'Will held by', type: 'text', full: true, placeholder: 'Solicitor name & firm, phone' },
          { id: 'willCopyLocation', label: 'Copy at home', type: 'text', full: true, placeholder: 'e.g. Fireproof safe, blue folder' },
          { id: 'lpa', label: 'Lasting Power of Attorney location', type: 'text', full: true, optional: true },
        ],
      },
      {
        kind: 'single',
        title: 'Identity documents',
        fields: [
          { id: 'passportLocation', label: 'Passport location', type: 'text', full: true, placeholder: 'e.g. Desk drawer, wall safe' },
          { id: 'birthCertLocation', label: 'Birth certificate location', type: 'text', full: true },
          { id: 'marriageCertLocation', label: 'Marriage certificate location', type: 'text', full: true, optional: true },
          { id: 'divorcePaperLocation', label: 'Divorce papers location', type: 'text', full: true, optional: true },
        ],
      },
      {
        kind: 'single',
        title: 'Property & vehicle documents',
        fields: [
          { id: 'deedLocation', label: 'Property deeds location', type: 'text', full: true, optional: true },
          { id: 'vehicleDocsLocation', label: 'Vehicle documents location', type: 'text', full: true, optional: true },
          { id: 'insuranceDocsLocation', label: 'Insurance documents location', type: 'text', full: true, optional: true },
          { id: 'otherDocsLocation', label: 'Other important documents', type: 'text', full: true, optional: true, placeholder: 'e.g. share certificates, mortgage deeds' },
        ],
      },
    ],
  },

  medical: {
    intro: 'Healthcare providers and medical information your doctors and family need to know.',
    rootCallout: {
      type: 'warn',
      text: 'Do not store full medical records here. This tells survivors who your doctors are and what conditions they should know about.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Healthcare providers',
        fields: [
          { id: 'gp', label: 'GP practice', type: 'text', placeholder: 'Name & location' },
          { id: 'gpPhone', label: 'GP phone', type: 'tel' },
          { id: 'hospital', label: 'Regular hospital / specialist', type: 'text', optional: true, placeholder: 'e.g. Royal Marsden NHS Trust' },
          { id: 'hospitalPhone', label: 'Hospital phone', type: 'tel', optional: true },
        ],
      },
      {
        kind: 'single',
        title: 'Medical conditions',
        fields: [
          { id: 'conditions', label: 'Active conditions', type: 'textarea', full: true, optional: true, placeholder: 'e.g. Type 2 diabetes, hypertension' },
          { id: 'medications', label: 'Current medications', type: 'textarea', full: true, optional: true, placeholder: 'One per line' },
          { id: 'allergies', label: 'Allergies', type: 'textarea', full: true, optional: true, placeholder: 'Drug allergies, food, latex, etc.' },
        ],
      },
      {
        kind: 'single',
        title: 'End-of-life wishes',
        fields: [
          { id: 'organDonation', label: 'Organ donation', type: 'chips', options: ['Register interest', 'Do not donate', 'Discussed with family'], optional: true },
          { id: 'bodyDonation', label: 'Body donation to science', type: 'chips', options: ['Yes', 'No', 'Maybe — discuss with family'], optional: true },
          { id: 'dnr', label: 'Do Not Resuscitate wishes', type: 'textarea', full: true, optional: true, placeholder: 'Your preferences for end-of-life care' },
        ],
      },
    ],
  },

  contacts: {
    intro: 'Key professional contacts your family will need to reach first.',
    cards: [
      {
        kind: 'repeat',
        title: 'Key professional contacts',
        listId: 'contacts',
        addLabel: '＋ Add a contact',
        hint: 'Solicitor, accountant, financial adviser, employer, union, insurance broker, etc.',
        maxItems: 15,
        fields: [
          { id: 'role', label: 'Role', type: 'text', placeholder: 'e.g. Solicitor, Accountant, Financial adviser' },
          { id: 'name', label: 'Contact name', type: 'text' },
          { id: 'phone', label: 'Phone', type: 'tel' },
          { id: 'email', label: 'Email', type: 'email', optional: true },
          { id: 'firm', label: 'Firm / organisation', type: 'text', optional: true },
          { id: 'notes', label: 'Notes', type: 'text', full: true, optional: true, placeholder: 'e.g. Handles my pension, known my family for 10 years' },
        ],
      },
    ],
  },

  dependants: {
    intro: 'Dependants who rely on you and who you want to protect.',
    cards: [
      {
        kind: 'single',
        title: 'Guardianship',
        fields: [
          { id: 'children', label: 'Do you have children under 18?', type: 'chips', options: ['Yes', 'No'], full: true },
          { id: 'guardianChoice', label: 'Your choice of guardian', type: 'text', full: true, optional: true, placeholder: 'The person you most want to care for your children' },
          { id: 'guardianBackup', label: 'Backup guardian', type: 'text', full: true, optional: true },
          { id: 'guardianDiscussed', label: 'Have you discussed with them?', type: 'chips', options: ['Yes', 'No', 'Not applicable'], optional: true },
        ],
      },
      {
        kind: 'repeat',
        title: 'Children & dependants',
        listId: 'dependants',
        addLabel: '＋ Add a dependant',
        hint: 'Children under 18, elderly parents, disabled family members requiring care.',
        maxItems: 10,
        fields: [
          { id: 'name', label: 'Name', type: 'text' },
          { id: 'relationship', label: 'Relationship', type: 'text', placeholder: 'e.g. Child, stepchild, parent, sibling' },
          { id: 'dob', label: 'Date of birth', type: 'date', optional: true },
          { id: 'school', label: 'School / nursery', type: 'text', optional: true },
          { id: 'needs', label: 'Special needs or care requirements', type: 'textarea', full: true, optional: true, placeholder: 'e.g. allergies, medical condition, educational plan' },
        ],
      },
    ],
  },

  pets: {
    intro: 'Care arrangements for your pets after you\u2019ve gone.',
    cards: [
      {
        kind: 'single',
        title: 'General pet care',
        fields: [
          { id: 'vet', label: 'Vet practice', type: 'text', placeholder: 'Name & location' },
          { id: 'vetPhone', label: 'Vet phone', type: 'tel' },
          { id: 'petOwner', label: 'Who should take your pets?', type: 'text', full: true, placeholder: 'Name(s) and their phone number' },
          { id: 'petOwnerBackup', label: 'Backup arrangement', type: 'text', full: true, optional: true, placeholder: 'If first choice can\u2019t take them' },
        ],
      },
      {
        kind: 'repeat',
        title: 'Individual pets',
        listId: 'pets',
        addLabel: '＋ Add a pet',
        hint: 'Food preferences, medication, insurance, routines — everything a new owner needs.',
        maxItems: 20,
        fields: [
          { id: 'name', label: 'Pet name', type: 'text' },
          { id: 'species', label: 'Species / breed', type: 'text', placeholder: 'e.g. Golden Retriever, tabby cat' },
          { id: 'microchip', label: 'Microchip / ID number', type: 'text', optional: true },
          { id: 'insurance', label: 'Pet insurance', type: 'text', optional: true, placeholder: 'Provider & policy number' },
          { id: 'food', label: 'Food & dietary needs', type: 'text' },
          { id: 'medication', label: 'Medication & health issues', type: 'text', optional: true },
          { id: 'routine', label: 'Daily routine & quirks', type: 'textarea', full: true, optional: true, placeholder: 'e.g. Needs a walk at 6am, scared of thunder, allergic to chicken' },
        ],
      },
    ],
  },

  insurances: {
    intro: 'All your insurance policies in one place — life, home, health, vehicle and travel.',
    rootCallout: {
      type: 'warn',
      text: 'Do not store policy numbers in full. Record only enough to identify the policy. Store actual policy documents separately in a safe location.',
    },
    cards: [
      {
        kind: 'repeat',
        title: 'Insurance policies',
        listId: 'insurances',
        addLabel: '＋ Add a policy',
        hint: 'Life, home, contents, health, car, travel — whoever manages these will need this information.',
        maxItems: 20,
        fields: [
          { id: 'type', label: 'Type', type: 'select', options: ['Life', 'Home', 'Home contents', 'Health', 'Car', 'Travel', 'Pet', 'Other'] },
          { id: 'provider', label: 'Provider', type: 'text' },
          { id: 'policyNumber', label: 'Policy number (last 4 only)', type: 'text', placeholder: '•••• 2847' },
          { id: 'phone', label: 'Provider phone', type: 'tel' },
          { id: 'renewal', label: 'Renewal date', type: 'date', optional: true },
          { id: 'notes', label: 'Notes', type: 'text', full: true, optional: true, placeholder: 'e.g. Covers mortgage, documents at accountant\u2019s' },
        ],
      },
    ],
  },

  business: {
    intro: 'If you run a business, your successors and family need to know how to handle it.',
    cards: [
      {
        kind: 'single',
        title: 'Business basics',
        fields: [
          { id: 'companyName', label: 'Company name', type: 'text' },
          { id: 'companyNumber', label: 'Company / registration number', type: 'text', optional: true },
          { id: 'businessType', label: 'Business type', type: 'text', placeholder: 'e.g. Sole trader, partnership, limited company' },
          { id: 'employees', label: 'Number of employees', type: 'text', optional: true },
        ],
      },
      {
        kind: 'single',
        title: 'Key business contacts',
        fields: [
          { id: 'accountant', label: 'Business accountant', type: 'text', placeholder: 'Name & phone' },
          { id: 'solicitor', label: 'Business solicitor', type: 'text', optional: true, placeholder: 'Name & phone' },
          { id: 'taxAdvisor', label: 'Tax adviser', type: 'text', optional: true, placeholder: 'Name & phone' },
          { id: 'businessBank', label: 'Business bank', type: 'text', full: true, placeholder: 'Bank name & account holder name' },
        ],
      },
      {
        kind: 'single',
        title: 'Ownership & succession',
        fields: [
          { id: 'shareholding', label: 'Your shareholding', type: 'text', full: true, optional: true, placeholder: '% owned, shares held, or notes on ownership' },
          { id: 'partnership', label: 'Partnership agreements', type: 'text', full: true, optional: true, placeholder: 'Who you\u2019re in partnership with & where agreement is stored' },
          { id: 'succession', label: 'Succession plan', type: 'textarea', full: true, optional: true, placeholder: 'Who should take over? What should happen to the business?' },
        ],
      },
    ],
  },

  property: {
    intro: 'Your homes, vehicles, valuables and who you want them to go to.',
    cards: [
      {
        kind: 'single',
        title: 'Residential property',
        fields: [
          { id: 'homeAddress', label: 'Property address', type: 'textarea', full: true },
          { id: 'ownership', label: 'Ownership', type: 'text', placeholder: 'Sole, joint, mortgaged' },
          { id: 'mortgage', label: 'Mortgage details', type: 'text', full: true, optional: true, placeholder: 'Lender & reference number' },
          { id: 'homeTo', label: 'Should go to', type: 'text', full: true, optional: true, placeholder: 'Name(s) — let your will be the legal authority' },
        ],
      },
      {
        kind: 'repeat',
        title: 'Vehicles',
        listId: 'vehicles',
        addLabel: '＋ Add a vehicle',
        hint: 'Cars, motorcycles, boats, caravans — any registered vehicles.',
        maxItems: 10,
        fields: [
          { id: 'type', label: 'Type', type: 'text', placeholder: 'e.g. Car, motorcycle, boat' },
          { id: 'make', label: 'Make & model', type: 'text' },
          { id: 'registration', label: 'Registration number', type: 'text' },
          { id: 'finance', label: 'Finance / lease details', type: 'text', optional: true, placeholder: 'If financed or leased' },
          { id: 'goesTo', label: 'Should go to', type: 'text', optional: true },
        ],
      },
      {
        kind: 'repeat',
        title: 'Valuables & heirlooms',
        listId: 'valuables',
        addLabel: '＋ Add an item',
        hint: 'Jewellery, artwork, collections, sentimental items.',
        maxItems: 20,
        fields: [
          { id: 'item', label: 'Item', type: 'text', placeholder: 'e.g. Mother\u2019s sapphire ring, signed first edition' },
          { id: 'location', label: 'Where it\u2019s kept', type: 'text', full: true, placeholder: 'e.g. Jewellery box, bedroom closet, safe deposit' },
          { id: 'value', label: 'Approximate value', type: 'text', optional: true, placeholder: 'Rough estimate for insurance purposes' },
          { id: 'goesTo', label: 'Should go to', type: 'text', optional: true, placeholder: 'Who treasures this item' },
          { id: 'notes', label: 'Story / significance', type: 'textarea', full: true, optional: true, placeholder: 'Why this matters to you' },
        ],
      },
    ],
  },

  pay: {
    intro: 'Regular payments and subscriptions that need to be paid or cancelled.',
    rootCallout: {
      type: 'info',
      text: 'List standing orders, direct debits, subscriptions and ongoing bills so your family can see what needs paying and what can be cancelled.',
    },
    cards: [
      {
        kind: 'repeat',
        title: 'Regular payments',
        listId: 'payments',
        addLabel: '＋ Add a payment',
        hint: 'Mortgage or rent, utilities, subscriptions, charity donations — everything that comes out monthly.',
        maxItems: 25,
        fields: [
          { id: 'payee', label: 'Payment to', type: 'text', placeholder: 'e.g. Tesco Bank, Oxfam' },
          { id: 'type', label: 'Type', type: 'select', options: ['Mortgage/rent', 'Utilities', 'Insurance', 'Subscription', 'Loan', 'Charity', 'Other'] },
          { id: 'amount', label: 'Approximate amount', type: 'text', placeholder: 'e.g. £1,200' },
          { id: 'frequency', label: 'Frequency', type: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'Annually'] },
          { id: 'action', label: 'What should happen', type: 'select', options: ['Keep paying', 'Cancel', 'Transfer to someone', 'Discuss'] },
          { id: 'notes', label: 'Notes', type: 'text', full: true, optional: true, placeholder: 'e.g. Listed under spouse\u2019s name, automated' },
        ],
      },
    ],
  },

  access: {
    intro: 'Where to find important keys, access codes and important items.',
    cards: [
      {
        kind: 'single',
        title: 'Safe deposit & safes',
        fields: [
          { id: 'safeLocation', label: 'Safe location', type: 'text', full: true, placeholder: 'e.g. Study wall safe, bank vault' },
          { id: 'safeCode', label: 'Safe code location', type: 'text', full: true, placeholder: 'Where is the code written down? (Not the code itself)' },
          { id: 'bankBox', label: 'Bank safe deposit box', type: 'text', full: true, optional: true, placeholder: 'Bank, branch, box number' },
          { id: 'boxKey', label: 'Box key location', type: 'text', full: true, optional: true },
        ],
      },
      {
        kind: 'single',
        title: 'Keys & access',
        fields: [
          { id: 'houseKeys', label: 'House key location', type: 'text', full: true, placeholder: 'Where to find keys to the house' },
          { id: 'carKeys', label: 'Car key location', type: 'text', full: true, optional: true },
          { id: 'garageKey', label: 'Garage & storage keys', type: 'text', full: true, optional: true },
          { id: 'otherKeys', label: 'Other important keys', type: 'text', full: true, optional: true, placeholder: 'e.g. Office, locker, summer house' },
        ],
      },
      {
        kind: 'single',
        title: 'Alarm codes & access',
        fields: [
          { id: 'homeAlarm', label: 'Home alarm code location', type: 'text', full: true, placeholder: 'Where is the code written? (Not the code itself)' },
          { id: 'gateAccess', label: 'Gate / entry codes location', type: 'text', full: true, optional: true },
          { id: 'storageAccess', label: 'Storage unit or parking info', type: 'text', full: true, optional: true, placeholder: 'e.g. Address, unit number, access details location' },
        ],
      },
    ],
  },

  passing: {
    intro: 'What to do in the first hours and days after you\u2019ve gone.',
    rootCallout: {
      type: 'info',
      text: 'These are the immediate actions. Keep it practical and clear so your family isn\u2019t overwhelmed at a difficult time.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Who to contact first',
        fields: [
          { id: 'firstContact', label: 'First person to tell', type: 'text', placeholder: 'Name & phone number' },
          { id: 'secondContact', label: 'Second person', type: 'text', optional: true },
          { id: 'thirdContact', label: 'Third person', type: 'text', optional: true },
          { id: 'employer', label: 'Employer to notify', type: 'text', optional: true, placeholder: 'Name & phone' },
        ],
      },
      {
        kind: 'single',
        title: 'Body & donation wishes',
        fields: [
          { id: 'organDonation', label: 'Organ donation registered', type: 'chips', options: ['Yes', 'No', 'Check with NHS Donor Register'], full: true },
          { id: 'bodyDonation', label: 'Body donation to science', type: 'chips', options: ['Yes', 'No', 'See medical section'], full: true },
          { id: 'funeral', label: 'Funeral arrangements', type: 'text', full: true, optional: true, placeholder: 'Pre-paid plan provider, if applicable' },
          { id: 'wishes', label: 'Key wishes', type: 'textarea', full: true, optional: true, placeholder: 'Burial vs cremation (see Funeral section for full wishes)' },
        ],
      },
      {
        kind: 'single',
        title: 'Practical first steps',
        fields: [
          { id: 'deathCert', label: 'Get death certificate from', type: 'text', full: true, placeholder: 'Hospital, GP, or registrar' },
          { id: 'documents', label: 'Important documents location', type: 'text', full: true, placeholder: 'Where Will & other docs are kept (see Docs section)' },
          { id: 'timeline', label: 'Timeline notes', type: 'textarea', full: true, optional: true, placeholder: 'Any urgent deadlines (mortgage payment, school term, business matters)' },
        ],
      },
    ],
  },

  beneficiaries: {
    intro: 'What your beneficiaries can expect from your estate, insurance and pension.',
    cards: [
      {
        kind: 'single',
        title: 'Life insurance payouts',
        fields: [
          { id: 'lifeInsurance', label: 'Life insurance policies', type: 'text', full: true, placeholder: 'Total life insurance cover (pointers to policies in Insurances section)' },
          { id: 'lifeInsuranceDesignated', label: 'Designated for', type: 'text', full: true, optional: true, placeholder: 'Who receives the payout (by policy, not in detail)' },
          { id: 'lifeInsuranceNotes', label: 'Notes', type: 'textarea', full: true, optional: true, placeholder: 'e.g. Mortgage protection, family income benefit' },
        ],
      },
      {
        kind: 'single',
        title: 'Pensions & retirement accounts',
        fields: [
          { id: 'pensionProvider', label: 'Pension provider(s)', type: 'text', full: true, placeholder: 'Workplace and private pensions' },
          { id: 'pensionValue', label: 'Approximate combined value', type: 'text', optional: true, placeholder: 'Rough estimate' },
          { id: 'pensionBeneficiary', label: 'Designated beneficiary', type: 'text', full: true, optional: true },
          { id: 'pensionNotes', label: 'Notes', type: 'textarea', full: true, optional: true, placeholder: 'E.g. Survivor benefits, lump sum options' },
        ],
      },
      {
        kind: 'single',
        title: 'Trusts, bequests & estate',
        fields: [
          { id: 'trusts', label: 'Trust details', type: 'textarea', full: true, optional: true, placeholder: 'Any trusts set up — refer to Will' },
          { id: 'majorBequests', label: 'Major bequests from Will', type: 'textarea', full: true, optional: true, placeholder: 'E.g. House to spouse, art collection to sibling, charity donation' },
          { id: 'executorName', label: 'Executor(s) of your Will', type: 'text', full: true, optional: true },
          { id: 'executorContact', label: 'Executor contact details', type: 'text', full: true, optional: true },
        ],
      },
    ],
  },

  recommend: {
    intro: 'Things you love — places, people, books, films, experiences. A bit of you that lives on.',
    rootCallout: {
      type: 'info',
      text: 'This is the lighter section. Share what brings you joy so loved ones feel connected to you.',
    },
    cards: [
      {
        kind: 'single',
        title: 'Favourite places',
        fields: [
          { id: 'restaurants', label: 'Favourite restaurants', type: 'textarea', full: true, optional: true, placeholder: 'Name, location, what to order' },
          { id: 'travel', label: 'Places worth visiting', type: 'textarea', full: true, optional: true, placeholder: 'Your recommendation for a good trip' },
          { id: 'local', label: 'Local places I love', type: 'textarea', full: true, optional: true, placeholder: 'Parks, pubs, shops, hidden gems nearby' },
        ],
      },
      {
        kind: 'single',
        title: 'Books, films & culture',
        fields: [
          { id: 'books', label: 'Books I loved', type: 'textarea', full: true, optional: true, placeholder: 'Author & title, one per line' },
          { id: 'films', label: 'Films & shows', type: 'textarea', full: true, optional: true, placeholder: 'If you want to recommend them' },
          { id: 'music', label: 'Music & artists', type: 'textarea', full: true, optional: true, placeholder: 'Songs or albums that mean something' },
        ],
      },
      {
        kind: 'single',
        title: 'People & tradespeople',
        fields: [
          { id: 'tradespeople', label: 'Good tradespeople to know', type: 'textarea', full: true, optional: true, placeholder: 'Plumber, electrician, mechanic — trustworthy people who do good work' },
          { id: 'professionals', label: 'Professional recommendations', type: 'textarea', full: true, optional: true, placeholder: 'Good lawyers, doctors, advisers in your area' },
          { id: 'other', label: 'Other recommendations', type: 'textarea', full: true, optional: true, placeholder: 'Anything else you want to share' },
        ],
      },
    ],
  },

  gratitude: {
    intro: 'Words for the people you love. This is your chance to say what they mean to you.',
    rootCallout: {
      type: 'info',
      text: 'These messages will be read by people grieving you. Write from the heart. You can be heartfelt, funny, grateful, or all three.',
    },
    cards: [
      {
        kind: 'repeat',
        title: 'Messages & letters',
        listId: 'messages',
        addLabel: '＋ Add a message',
        hint: 'Write to the people who matter. This might be read at the funeral or privately.',
        maxItems: 50,
        fields: [
          { id: 'recipient', label: 'To', type: 'text', placeholder: 'Name of person or group (e.g. "My children", "Rachel")' },
          { id: 'message', label: 'Your message', type: 'textarea', full: true, placeholder: 'Write what you want them to know' },
        ],
      },
    ],
  },
};

// Count fields filled across a section — used for progress + status dots.
export function countFilled(
  schema: SectionSchema,
  fields: Record<string, unknown> | undefined,
  items: Record<string, Record<string, unknown>[]> | undefined,
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const card of schema.cards) {
    if (card.kind === 'single') {
      for (const f of card.fields) {
        if (f.optional) continue;
        total++;
        const v = fields?.[f.id];
        if (v !== undefined && String(v).trim() !== '') filled++;
      }
    } else {
      const list = items?.[card.listId] ?? [];
      total++;
      if (list.length > 0) filled++;
    }
  }
  return { filled, total };
}
