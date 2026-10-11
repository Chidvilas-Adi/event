export interface StationFlagInfo {
  name: string;
  flag: string;
  cost: number;
  clue: string;
}

export const STATION_FLAGS: Record<string, StationFlagInfo> = {
  bank: {
    name: 'Apex Reserve Bank',
    flag: 'FLAG-BANK-VAULT-2026',
    cost: 150,
    clue: 'Vault Reserve ledger verifies 80,000 VB baseline. Enter Flag [FLAG-BANK-VAULT-2026] into your mission verification terminal.',
  },
  government: {
    name: 'City Department of Commerce',
    flag: 'FLAG-GOV-SEAL-2026',
    cost: 150,
    clue: 'Sovereign commercial standing validated by Municipal Council. Enter Flag [FLAG-GOV-SEAL-2026] into your mission terminal.',
  },
  investor: {
    name: 'Frontier Venture Syndicate',
    flag: 'FLAG-INVESTOR-TERM-2026',
    cost: 150,
    clue: 'Seed syndicate term sheet approved. Cap table dilution verified. Enter Flag [FLAG-INVESTOR-TERM-2026].',
  },
  talent_exchange: {
    name: 'Metro Talent Exchange',
    flag: 'FLAG-TALENT-DRAFT-2026',
    cost: 150,
    clue: 'Specialist talent roster approved. Enter Flag [FLAG-TALENT-DRAFT-2026].',
  },
  supplier: {
    name: 'Prime Supplier Market',
    flag: 'FLAG-SUPPLY-STOCK-2026',
    cost: 150,
    clue: 'Wholesale materials bill of lading certified. Enter Flag [FLAG-SUPPLY-STOCK-2026].',
  },
  logistics: {
    name: 'Swift Logistics Provider',
    flag: 'FLAG-LOGISTICS-RUN-2026',
    cost: 150,
    clue: 'Intermodal freight priority clearance granted. Enter Flag [FLAG-LOGISTICS-RUN-2026].',
  },
  enterprise_customer: {
    name: 'Customer Procurement Desk',
    flag: 'FLAG-PROCURE-RFP-2026',
    cost: 150,
    clue: 'Enterprise master procurement order confirmed. Enter Flag [FLAG-PROCURE-RFP-2026].',
  },
  media: {
    name: 'The Daily Chronicle & Media',
    flag: 'FLAG-MEDIA-LEAK-2026',
    cost: 150,
    clue: 'Anonymous press dispatch confirmed by Chronicle editor. Enter Flag [FLAG-MEDIA-LEAK-2026].',
  },
  gm: {
    name: 'Game Master Citadel',
    flag: 'FLAG-GM-CITADEL-2026',
    cost: 250,
    clue: 'Game Master high-level regulatory authorization seal. Enter Flag [FLAG-GM-CITADEL-2026].',
  },
  admin: {
    name: 'Tech Admin Root',
    flag: 'FLAG-TECH-ROOT-2026',
    cost: 200,
    clue: 'Hardware photonic mesh quantum root key. Enter Flag [FLAG-TECH-ROOT-2026].',
  },
};
