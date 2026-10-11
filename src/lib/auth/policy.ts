import { UserSession } from './session';

// In-memory sliding window rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 30, windowSeconds = 60): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}

export type ActionType =
  | 'VIEW_WORLD_CLOCK'
  | 'CONTROL_WORLD_CLOCK'
  | 'FREEZE_WORLD'
  | 'VIEW_COMPANIES'
  | 'VIEW_COMPANY_PRIVATE'
  | 'VIEW_PARTICIPANTS'
  | 'VIEW_OWN_WALLET'
  | 'VIEW_ANY_WALLET'
  | 'INITIATE_TRANSFER'
  | 'CONFIRM_TRANSFER'
  | 'GM_GRANT_VB'
  | 'GM_OVERRIDE'
  | 'PUBLISH_ANNOUNCEMENT'
  | 'VIEW_AUDIT_LOG'
  | 'VIEW_INSTITUTION'
  | 'MANAGE_INSTITUTION'
  | 'EXPORT_DATA'
  | 'RECORD_FOUNDER_EVIDENCE';

export class PolicyEngine {
  /**
   * Central authorization check. Default DENY.
   */
  static can(
    user: UserSession | null,
    action: ActionType,
    context?: { companyId?: string; participantId?: string; institutionId?: string }
  ): boolean {
    if (!user) return false;

    // GM has complete access across all actions
    if (user.role === 'gm') return true;

    switch (action) {
      case 'VIEW_WORLD_CLOCK':
        return true; // Clock is public to all authenticated citizens and operators

      case 'CONTROL_WORLD_CLOCK':
      case 'FREEZE_WORLD':
      case 'GM_GRANT_VB':
      case 'GM_OVERRIDE':
        // Only GM can control world state or grant VB directly
        // Admin CANNOT unilaterally move VB or change game state!
        return false;

      case 'PUBLISH_ANNOUNCEMENT':
        return user.role === 'event_lead';

      case 'VIEW_AUDIT_LOG':
        return user.role === 'admin' || user.role === 'event_lead';

      case 'VIEW_COMPANIES':
        return true; // Basic company names/descriptions are public

      case 'VIEW_COMPANY_PRIVATE':
        if (context?.companyId && user.companyId === context.companyId) return true;
        // Station operators (Bank, Investor, Gov, etc.), Observers, Admins, and Leads can inspect company state
        if (user.role === 'volunteer' || user.role === 'observer' || user.role === 'admin' || user.role === 'event_lead') return true;
        return false;

      case 'VIEW_PARTICIPANTS':
        // Directory search is permitted, but wallets are masked for non-GM
        return true;

      case 'VIEW_OWN_WALLET':
        return Boolean(context?.participantId && user.userId === context.participantId);

      case 'VIEW_ANY_WALLET':
        return false;

      case 'INITIATE_TRANSFER':
        // Participant or company lead initiating from their own balance
        return user.role === 'participant' || user.role === 'company_lead';

      case 'CONFIRM_TRANSFER':
        return user.role === 'participant' || user.role === 'company_lead';

      case 'VIEW_INSTITUTION':
        if (user.role === 'admin' || user.role === 'event_lead') return true;
        if (user.role === 'volunteer') {
          return !context?.institutionId || user.institutionId === context.institutionId;
        }
        return true; // Public institution status is open to participants

      case 'MANAGE_INSTITUTION':
        if (user.role === 'volunteer' && context?.institutionId && user.institutionId === context.institutionId) {
          return true;
        }
        return false;

      case 'EXPORT_DATA':
        return user.role === 'admin' || user.role === 'event_lead';

      case 'RECORD_FOUNDER_EVIDENCE':
        return user.role === 'observer';

      default:
        return false;
    }
  }

  /**
   * Field-level filtering layer.
   * Strips hidden/private fields from raw database objects before serialization.
   */
  static filterObject<T extends Record<string, any>>(
    obj: T,
    type: 'company' | 'participant' | 'institution' | 'mission',
    user: UserSession | null
  ): Partial<T> {
    if (!obj) return obj;
    if (user?.role === 'gm') return { ...obj }; // GM sees everything

    const filtered = { ...obj };

    if (type === 'company') {
      const isMember = user?.companyId && user.companyId === obj.id;
      if (!isMember) {
        delete filtered.vault_balance;
        delete filtered.cap_table;
        delete filtered.internal_notes;
        delete filtered.is_hidden;
      }
    }

    if (type === 'participant') {
      const isSelf = user?.userId && user.userId === obj.id;
      if (!isSelf) {
        delete filtered.wallet_balance;
        delete filtered.event_code;
        delete filtered.private_notes;
      }
    }

    if (type === 'mission') {
      delete filtered.gm_notes;
      delete filtered.hidden_opportunity;
      if (filtered.is_secret && (!user?.userId || filtered.recipient_id !== user.userId)) {
        return {} as Partial<T>; // Completely hide secret missions intended for someone else
      }
    }

    return filtered;
  }
}
