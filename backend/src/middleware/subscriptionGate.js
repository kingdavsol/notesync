// Convert TypeScript-style middleware to JavaScript for Node.js compatibility

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

function subscriptionGate(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tier = req.user.subscription_tier || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.FREE;
    req.subscription = limits;
    next();
  } catch (error) {
    console.error('Subscription gate error:', error);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}

function requireFeature(feature) {
  return (req, res, next) => {
    if (!req.subscription?.features.includes(feature)) {
      return res.status(403).json({
        error: 'Feature not available in your tier',
        feature,
        currentTier: req.subscription?.tier,
        upgradeTo: feature.includes('ai') ? 'STARTER' : 'PRO',
      });
    }
    next();
  };
}

function checkNoteLimit() {
  return async (req, res, next) => {
    if (!req.user || !req.subscription) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const db = req.app.locals.db;
      const currentMonth = new Date();
      currentMonth.setDate(1);

      const result = await db.query(
        `SELECT COUNT(*) as count FROM notes 
         WHERE user_id = $1 
         AND created_at >= $2`,
        [req.user.id, currentMonth]
      );

      const noteCount = parseInt(result.rows[0]?.count || 0);
      const limit = req.subscription.notesPerMonth;

      if (noteCount >= limit) {
        return res.status(429).json({
          error: 'Monthly note limit reached',
          limit,
          used: noteCount,
          tier: req.subscription.tier,
          resetDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
        });
      }

      req.body._noteUsage = { used: noteCount, limit };
      next();
    } catch (error) {
      console.error('Note limit check error:', error);
      res.status(500).json({ error: 'Failed to check note limit' });
    }
  };
}

function getTierLimits(tier) {
  return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.FREE;
}

module.exports = {
  subscriptionGate,
  requireFeature,
  checkNoteLimit,
  getTierLimits,
  SUBSCRIPTION_LIMITS,
};
