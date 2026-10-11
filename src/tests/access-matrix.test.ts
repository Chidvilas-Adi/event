import { describe, it, expect, beforeAll } from 'vitest';
import { PolicyEngine } from '../lib/auth/policy';
import { UserSession } from '../lib/auth/session';
import { runSeed } from '../../scripts/seed';

describe('Access Control Matrix - Role Permissions & Field Filtering', () => {
  beforeAll(async () => {
    await runSeed();
  });

  const participantUser: UserSession = {
    userId: 'vc_p_001',
    role: 'participant',
    name: 'Aarav Sharma',
    companyId: 'comp_swiftcart',
    isElevated: false,
  };

  const companyLeadUser: UserSession = {
    userId: 'vc_p_002',
    role: 'company_lead',
    name: 'Vivaan Patel',
    companyId: 'comp_swiftcart',
    isElevated: false,
  };

  const volunteerBankUser: UserSession = {
    userId: 'op_bank',
    role: 'volunteer',
    name: 'Apex Bank Teller',
    institutionId: 'bank',
    isElevated: true,
  };

  const observerUser: UserSession = {
    userId: 'op_observer',
    role: 'observer',
    name: 'Ecosystem Scout',
    isElevated: true,
  };

  const adminUser: UserSession = {
    userId: 'op_admin',
    role: 'admin',
    name: 'Tech Admin',
    isElevated: true,
  };

  const gmUser: UserSession = {
    userId: 'op_gm',
    role: 'gm',
    name: 'Game Master',
    isElevated: true,
  };

  it('Participant A cannot see Company B private data (cap table / vault)', () => {
    // Participant in comp_swiftcart tries to view comp_ledgerly private data
    const canSeePrivate = PolicyEngine.can(participantUser, 'VIEW_COMPANY_PRIVATE', {
      companyId: 'comp_ledgerly',
    });
    expect(canSeePrivate).toBe(false);

    // Filter layer strips vault_balance and internal fields
    const companyBData = {
      id: 'comp_ledgerly',
      name: 'Ledgerly',
      vault_balance: 40000,
      cap_table: { founders: 100 },
      is_hidden: false,
    };

    const filtered = PolicyEngine.filterObject(companyBData, 'company', participantUser);
    expect(filtered.vault_balance).toBeUndefined();
    expect(filtered.cap_table).toBeUndefined();
    expect(filtered.name).toBe('Ledgerly');
  });

  it('Participant A can see their OWN company private data', () => {
    const canSeeOwnPrivate = PolicyEngine.can(participantUser, 'VIEW_COMPANY_PRIVATE', {
      companyId: 'comp_swiftcart',
    });
    expect(canSeeOwnPrivate).toBe(true);

    const companyAData = {
      id: 'comp_swiftcart',
      name: 'SwiftCart',
      vault_balance: 35000,
    };
    const filtered = PolicyEngine.filterObject(companyAData, 'company', participantUser);
    expect(filtered.vault_balance).toBe(35000);
  });

  it('Participant cannot see another participant wallet balance', () => {
    const canSeeOtherWallet = PolicyEngine.can(participantUser, 'VIEW_ANY_WALLET');
    expect(canSeeOtherWallet).toBe(false);

    const otherCitizen = {
      id: 'vc_p_002',
      name: 'Vivaan Patel',
      wallet_balance: 1500,
      event_code: 'VC2026',
    };

    const filtered = PolicyEngine.filterObject(otherCitizen, 'participant', participantUser);
    expect(filtered.wallet_balance).toBeUndefined();
    expect(filtered.event_code).toBeUndefined();
    expect(filtered.name).toBe('Vivaan Patel');
  });

  it('Institution volunteer cannot manage other institutions', () => {
    // Volunteer at 'bank' attempting to manage 'supplier'
    const canManageSupplier = PolicyEngine.can(volunteerBankUser, 'MANAGE_INSTITUTION', {
      institutionId: 'supplier',
    });
    expect(canManageSupplier).toBe(false);

    // Volunteer can manage own institution
    const canManageBank = PolicyEngine.can(volunteerBankUser, 'MANAGE_INSTITUTION', {
      institutionId: 'bank',
    });
    expect(canManageBank).toBe(true);
  });

  it('Admin CANNOT move VB directly or execute GM overrides', () => {
    // Admin role policy check
    const adminCanGrantVB = PolicyEngine.can(adminUser, 'GM_GRANT_VB');
    expect(adminCanGrantVB).toBe(false);

    const adminCanFreeze = PolicyEngine.can(adminUser, 'FREEZE_WORLD');
    expect(adminCanFreeze).toBe(false);

    const adminCanControlClock = PolicyEngine.can(adminUser, 'CONTROL_WORLD_CLOCK');
    expect(adminCanControlClock).toBe(false);
  });

  it('Nobody but GM can see hidden fields and secret missions', () => {
    const mission = {
      id: 'msn_secret_01',
      title: 'Intercept Supply Chain Intelligence',
      gm_notes: 'Planted crisis trigger to force Kavach into bidding war',
      hidden_opportunity: { reward: 5000 },
      is_secret: true,
      recipient_id: 'vc_p_099',
    };

    // Filtered for non-GM (Admin, Participant, Volunteer)
    const adminView = PolicyEngine.filterObject(mission, 'mission', adminUser);
    expect(adminView.gm_notes).toBeUndefined();
    expect(adminView.hidden_opportunity).toBeUndefined();

    const participantView = PolicyEngine.filterObject(mission, 'mission', participantUser);
    expect(participantView.gm_notes).toBeUndefined();
    // Secret mission for someone else returns empty object
    expect(Object.keys(participantView).length).toBe(0);

    // GM sees EVERYTHING
    const gmView = PolicyEngine.filterObject(mission, 'mission', gmUser);
    expect(gmView.gm_notes).toBe('Planted crisis trigger to force Kavach into bidding war');
    expect(gmView.hidden_opportunity).toBeDefined();
  });

  it('Game Master has unrestricted access across all actions', () => {
    expect(PolicyEngine.can(gmUser, 'VIEW_WORLD_CLOCK')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'CONTROL_WORLD_CLOCK')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'FREEZE_WORLD')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'GM_GRANT_VB')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'VIEW_ANY_WALLET')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'VIEW_COMPANY_PRIVATE', { companyId: 'comp_ledgerly' })).toBe(true);
    expect(PolicyEngine.can(gmUser, 'MANAGE_INSTITUTION', { institutionId: 'bank' })).toBe(true);
  });
});
