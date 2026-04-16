// Canonical section list (from the book's table of contents).
// `triage` bucket drives the Survivor view's "Where to start" cards.

export type SectionDef = {
  slug: string;
  title: string;
  hint: string;
  triage: 'hours' | 'week' | 'month' | 'later';
};

export const SECTIONS: SectionDef[] = [
  { slug: 'me', title: 'All about me', hint: 'Names, address, family', triage: 'later' },
  { slug: 'docs', title: 'Important documents', hint: 'Will, passport, certificates', triage: 'hours' },
  { slug: 'medical', title: 'Medical information', hint: 'GP, conditions, medication', triage: 'hours' },
  { slug: 'contacts', title: 'Key contacts', hint: 'Attorney, advisor, insurer', triage: 'hours' },
  { slug: 'dependants', title: 'My dependants', hint: 'Children, parents, others', triage: 'hours' },
  { slug: 'pets', title: 'Pets', hint: 'Vet, insurance, care wishes', triage: 'hours' },
  { slug: 'financial', title: 'Financial information', hint: 'Banks, cards, debts (pointers only)', triage: 'month' },
  { slug: 'insurances', title: 'Insurances', hint: 'Life, home, health, vehicle', triage: 'month' },
  { slug: 'business', title: 'Business details', hint: 'Company, shareholdings', triage: 'month' },
  { slug: 'property', title: 'Personal property', hint: 'Residence, heirlooms, vehicles', triage: 'month' },
  { slug: 'pay', title: 'What to pay and when', hint: 'Bills, subscriptions, charities', triage: 'month' },
  { slug: 'access', title: 'Access & location', hint: 'Safe deposit, keys', triage: 'week' },
  { slug: 'digital', title: 'Digital assets', hint: 'Email, accounts (pointers only)', triage: 'week' },
  { slug: 'funeral', title: 'Funeral wishes', hint: 'Burial, service, music, readings', triage: 'week' },
  { slug: 'passing', title: 'At the time of passing', hint: 'People and orgs to contact', triage: 'hours' },
  { slug: 'beneficiaries', title: 'What beneficiaries can expect', hint: 'Life insurance, pension', triage: 'month' },
  { slug: 'recommend', title: 'Recommendations', hint: 'Things I loved, places, people', triage: 'later' },
  { slug: 'gratitude', title: 'Expression of gratitude', hint: 'A final message', triage: 'later' },
];

export function findSection(slug: string): SectionDef {
  return SECTIONS.find((s) => s.slug === slug) ?? SECTIONS[0];
}
