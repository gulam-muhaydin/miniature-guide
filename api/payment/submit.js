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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const token = getToken(req);
    const { method, transactionId, plan, userId: bodyUserId } = req.body;

    const headerUserId = req.headers['x-user-id'];
    let userId = bodyUserId || headerUserId || getUid(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        if (!userId) {
          return res.status(401).json({ message: 'Invalid session' });
        }
      }
    }

    if (!userId) return res.status(401).json({ message: 'No session' });

    await connectDB();

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
    const planKey = (plan || 'none').toString().trim().toLowerCase();
    const config = planConfig[planKey] || { limit: 0, pay: 0 };
    const now = new Date();

    const user = await User.findByIdAndUpdate(userId, {
      $set: {
        plan,
        videosLeft: config.limit,
        lastVideoResetAt: now,
        lastVideoPlan: planKey,
        paymentProof: {
          method,
          transactionId,
          date: new Date(),
          status: 'pending'
        }
      }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ message: 'Payment submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
