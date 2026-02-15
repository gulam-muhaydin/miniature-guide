const connectDB = require('../../db');
const { User } = require('../../models');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { userId, createdAt, status } = req.body || {};
    if (!userId || !createdAt || !status) {
      return res.status(400).json({ message: 'Missing data' });
    }
    if (!['pending', 'completed', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const requests = Array.isArray(user.withdrawalRequests) ? user.withdrawalRequests : [];
    const targetTime = new Date(createdAt).getTime();
    if (!Number.isFinite(targetTime)) {
      return res.status(400).json({ message: 'Invalid createdAt' });
    }

    const idx = requests.findIndex((r) => {
      const t = r?.createdAt ? new Date(r.createdAt).getTime() : NaN;
      return Number.isFinite(t) && t === targetTime;
    });

    if (idx === -1) return res.status(404).json({ message: 'Withdrawal request not found' });

    const updatedRequests = requests.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, status };
    });

    await User.findByIdAndUpdate(user._id || user.id, {
      withdrawalRequests: updatedRequests
    });

    res.status(200).json({ message: 'Withdrawal updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
