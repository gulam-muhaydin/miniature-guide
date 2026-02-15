const mongoose = require('mongoose');
const Datastore = require('nedb-promises');
const path = require('path');

let useLocalDB = false;
let localDB = null;

let lastMongoFailureAt = 0;
const getMongoRetryCooldownMs = () => {
  const fromEnv = Number(process.env.MONGO_RETRY_COOLDOWN_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 60_000;
};

const connectDB = async () => {
  const isProd = process.env.NODE_ENV === 'production';
  const isVercel = !!process.env.VERCEL;
  const hasMongoUri = typeof process.env.MONGODB_URI === 'string' && process.env.MONGODB_URI.trim().length > 0;
  const now = Date.now();

  // If already connected to Mongoose
  if (mongoose.connections[0].readyState) {
    return { type: 'mongodb' };
  }

  // Try connecting to MongoDB first
  const shouldTryMongo =
    hasMongoUri &&
    process.env.MONGODB_URI.startsWith('mongodb') &&
    (now - lastMongoFailureAt > getMongoRetryCooldownMs());

  if (shouldTryMongo) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: isProd || isVercel ? 10_000 : 1_500
      });
      console.log('MongoDB Connected successfully');
      lastMongoFailureAt = 0;
      return { type: 'mongodb' };
    } catch (error) {
      lastMongoFailureAt = now;
    }
  }

  try {
    if (isProd || isVercel) {
      useLocalDB = true;
      if (!localDB) {
        localDB = Datastore.create({
          inMemoryOnly: true
        });
      }
      return { type: hasMongoUri ? 'memory_fallback' : 'memory', db: localDB };
    }

    console.log('MongoDB connection failed, falling back to local file database...');
    useLocalDB = true;

    if (!localDB) {
      localDB = Datastore.create({
        filename: path.join(__dirname, 'data.db'),
        autoload: true
      });
    }
    return { type: 'local', db: localDB };
  } catch (error) {
    if (isProd || isVercel) {
      throw error;
    }
    throw error;
  }
};

module.exports = connectDB;
