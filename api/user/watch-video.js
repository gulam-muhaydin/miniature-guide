const connectDB = require('../../lib/db');
const { User } = require('../../lib/models');
const jwt = require('jsonwebtoken');

const getToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const tokenCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
  if (!tokenCookie) return null;
  return decodeURIComponent(tokenCookie.split('=').slice(1).join('='));
};

const getUid = (req) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const uidCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('uid='));
  if (!uidCookie) return null;
  return decodeURIComponent(uidCookie.split('=').slice(1).join('='));
};

const planConfig = {
  'basic': { limit: 5, pay: 20 },
  'silver': { limit: 10, pay: 25 },
  'premium': { limit: 15, pay: 30 },
  'gold': { limit: 25, pay: 40 },
  'diamond': { limit: 50, pay: 50 },
  'platinum': { limit: 80, pay: 65 },
  'emerald': { limit: 120, pay: 100 },
  'sapphire': { limit: 200, pay: 150 },
  'ruby': { limit: 999999, pay: 200 }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = getToken(req);
    const headerUserId = req.headers['x-user-id'];
    let sessionUserId = headerUserId || getUid(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        sessionUserId = decoded.userId;
      } catch (e) {
        if (!sessionUserId) {
          return res.status(401).json({ message: 'Invalid session' });
        }
      }
    }
    if (!sessionUserId) return res.status(401).json({ message: 'No session' });

    await connectDB();
    const user = await User.findById(sessionUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const planKey = (user.plan || 'none').toString().trim().toLowerCase();
    const config = planConfig[planKey] || { limit: 0, pay: 0 };
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let lastResetAt = user.lastVideoResetAt ? new Date(user.lastVideoResetAt) : null;
    if ((!lastResetAt || Number.isNaN(lastResetAt.getTime())) && user.lastWatchDate) {
      const parsedDate = new Date(user.lastWatchDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        lastResetAt = parsedDate;
      }
    }

    let videosLeft = typeof user.videosLeft === 'number' ? user.videosLeft : config.limit;
    if (typeof videosLeft === 'number' && typeof config.limit === 'number' && config.limit > 0) {
      if (videosLeft < 0 || videosLeft > config.limit) videosLeft = config.limit;
    }
    const planChanged = user.lastVideoPlan !== planKey;
    const needsRepairReset = typeof config.limit === 'number' && config.limit >= 1000 && typeof user.videosLeft === 'number' && user.videosLeft <= 0;
    const needsReset = needsRepairReset || planChanged || !lastResetAt || (now - lastResetAt) >= DAY_MS;

    if (needsReset) {
      videosLeft = config.limit;
      await User.findByIdAndUpdate(user.id || user._id, {
        videosLeft: videosLeft,
        lastVideoResetAt: now,
        lastWatchDate: now.toISOString().split('T')[0],
        lastVideoPlan: planKey
      });
    }

    if (videosLeft <= 0) {
      return res.status(400).json({ message: 'Daily video limit reached' });
    }

    const newBalance = (user.balance || 0) + config.pay;
    const newVideosLeft = videosLeft - 1;

    await User.findByIdAndUpdate(user.id || user._id, {
      balance: newBalance,
      videosLeft: newVideosLeft,
      lastVideoResetAt: needsReset ? now : (user.lastVideoResetAt || now),
      lastVideoPlan: planKey,
      lastWatchDate: now.toISOString().split('T')[0]
    });

    res.status(200).json({ 
      message: 'Earning added successfully', 
      balance: newBalance,
      videosLeft: newVideosLeft
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
