import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: { id: number; email: string };
  subscription?: { tier: string; notesPerMonth: number; devices: number; storage: number; features: string[] };
}

const SUBSCRIPTION_LIMITS = {
  FREE: {
    tier: 'FREE',
    notesPerMonth: 100,
    devices: 2,
    storage: 2 * 1024 * 1024 * 1024,
    features: ['basic-notes', 'folders', 'basic-templates'],
  },
  STARTER: {
    tier: 'STARTER',
    notesPerMonth: 999999,
    devices: 5,
    storage: 5 * 1024 * 1024 * 1024,
    features: ['basic-notes', 'folders', 'all-templates', 'basic-ai'],
  },
  PRO: {
    tier: 'PRO',
    notesPerMonth: 999999,
    devices: 999,
    storage: 20 * 1024 * 1024 * 1024,
    features: ['basic-notes', 'folders', 'all-templates', 'basic-ai', 'advanced-ai', 'analytics'],
  },
};

export async function subscriptionGate(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tier = req.user.subscription_tier || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[tier as keyof typeof SUBSCRIPTION_LIMITS] || SUBSCRIPTION_LIMITS.FREE;
    req.subscription = limits;
    next();
  } catch (error) {
    console.error('Subscription gate error:', error);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}

export function requireFeature(feature: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.subscription?.features.includes(feature)) {
      return res.status(403).json({
        error: 'Feature not available in your tier',
        feature,
        currentTier: req.subscription?.tier,
      });
    }
    next();
  };
}

export const getTierLimits = (tier: string) => {
  return SUBSCRIPTION_LIMITS[tier as keyof typeof SUBSCRIPTION_LIMITS] || SUBSCRIPTION_LIMITS.FREE;
};
