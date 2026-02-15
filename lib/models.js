const mongoose = require('mongoose');
const Datastore = require('nedb-promises');
const path = require('path');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  plan: { type: String, default: 'none' },
  isApproved: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  videosLeft: { type: Number },
  lastWatchDate: { type: String },
  lastVideoResetAt: { type: Date },
  lastVideoPlan: { type: String },
  referralCount: { type: Number, default: 0 },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  withdrawalRequests: [{
    amount: Number,
    method: String,
    accountNumber: String,
    accountTitle: String,
    status: { type: String, default: 'pending' },
    createdAt: Date
  }],
  paymentProof: {
    method: String,
    transactionId: String,
    date: Date,
    status: { type: String, default: 'none' }
  }
}, { bufferCommands: false });

const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);

const isVercel = !!process.env.VERCEL;
const localDbPath = isVercel ? path.join('/tmp', 'users.db') : path.join(__dirname, 'users.db');
const localDB = Datastore.create({
  filename: localDbPath,
  autoload: true
});

const User = {
  async findOne(query) {
    if (mongoose.connections[0].readyState) {
      return await MongooseUser.findOne(query);
    }
    const result = await localDB.findOne(query);
    if (result) {
      result.id = result._id;
    }
    return result;
  },

  async create(data) {
    if (mongoose.connections[0].readyState) {
      return await MongooseUser.create(data);
    }
    const newUser = {
      plan: 'none',
      isApproved: false,
      isAdmin: false,
      balance: 0,
      withdrawalRequests: [],
      paymentProof: { status: 'none' },
      ...data
    };
    const result = await localDB.insert(newUser);
    result.id = result._id;
    return result;
  },

  async findById(id) {
    if (mongoose.connections[0].readyState) {
      return await MongooseUser.findById(id);
    }
    const result = await localDB.findOne({ _id: id });
    if (result) result.id = result._id;
    return result;
  },

  async find(query = {}) {
    if (mongoose.connections[0].readyState) {
      return await MongooseUser.find(query);
    }
    const results = await localDB.find(query);
    return results.map(r => ({ ...r, id: r._id }));
  },

  async findByIdAndUpdate(id, update) {
    if (mongoose.connections[0].readyState) {
      return await MongooseUser.findByIdAndUpdate(id, update, { new: true });
    }
    const current = await localDB.findOne({ _id: id });
    if (!current) return null;

    let finalUpdate = { ...current };
    if (update && typeof update === 'object') {
      if (update.$set && typeof update.$set === 'object') {
        finalUpdate = { ...finalUpdate, ...update.$set };
      }
      if (update.$inc && typeof update.$inc === 'object') {
        for (const [key, value] of Object.entries(update.$inc)) {
          const currentVal = typeof finalUpdate[key] === 'number' ? finalUpdate[key] : 0;
          const incVal = typeof value === 'number' ? value : Number(value);
          finalUpdate[key] = currentVal + (Number.isFinite(incVal) ? incVal : 0);
        }
      }
      const hasOperator = !!(update.$set || update.$inc);
      if (!hasOperator) {
        finalUpdate = { ...finalUpdate, ...update };
      }
    }
    await localDB.update({ _id: id }, finalUpdate);
    finalUpdate.id = finalUpdate._id;
    return finalUpdate;
  }
};

module.exports = { User };
