const mongoose = require('mongoose');
const Datastore = require('nedb-promises');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;
const isMongoReady = () => mongoose.connections[0]?.readyState === 1;

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

let localDB = null;
const getLocalDB = () => {
  if (!localDB) {
    const dir =
      (isVercel && '/tmp') ||
      (isProd && (process.env.TMPDIR || process.env.TEMP || process.env.TMP)) ||
      __dirname;

    const filename = path.join(dir, 'users.db');
    try {
      localDB = Datastore.create({
        filename,
        autoload: true
      });
    } catch (e) {
      localDB = Datastore.create({ inMemoryOnly: true });
    }
  }
  return localDB;
};

const User = {
  async findOne(query) {
    if (isMongoReady()) {
      return await MongooseUser.findOne(query);
    }
    const result = await getLocalDB().findOne(query);
    if (result) {
      result.id = result._id;
    }
    return result;
  },

  async create(data) {
    if (isMongoReady()) {
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
    const result = await getLocalDB().insert(newUser);
    result.id = result._id;
    return result;
  },

  async findById(id) {
    if (isMongoReady() && mongoose.isValidObjectId(id)) {
      return await MongooseUser.findById(id);
    }
    const result = await getLocalDB().findOne({ _id: id });
    if (result) result.id = result._id;
    return result;
  },

  async find(query = {}) {
    if (isMongoReady()) {
      return await MongooseUser.find(query);
    }
    const results = await getLocalDB().find(query);
    return results.map(r => ({ ...r, id: r._id }));
  },

  async findByIdAndUpdate(id, update) {
    if (isMongoReady() && mongoose.isValidObjectId(id)) {
      return await MongooseUser.findByIdAndUpdate(id, update, { new: true });
    }
    const current = await getLocalDB().findOne({ _id: id });
    if (!current) {
      let base = {
        _id: id,
        username: '',
        email: '',
        plan: 'none',
        isApproved: false,
        isAdmin: false,
        balance: 0,
        withdrawalRequests: [],
        paymentProof: { status: 'none' }
      };
      if (update && typeof update === 'object') {
        if (update.$set && typeof update.$set === 'object') {
          base = { ...base, ...update.$set };
        } else {
          base = { ...base, ...update };
        }
      }
      const inserted = await getLocalDB().insert(base);
      inserted.id = inserted._id;
      return inserted;
    }

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
    await getLocalDB().update({ _id: id }, finalUpdate);
    finalUpdate.id = finalUpdate._id;
    return finalUpdate;
  }
};

module.exports = { User };
