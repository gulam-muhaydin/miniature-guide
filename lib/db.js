const mongoose = require('mongoose');
const Datastore = require('nedb-promises');
const path = require('path');

let useLocalDB = false;
let localDB = null;

const connectDB = async () => {
  const isProd = process.env.NODE_ENV === 'production';
  const isVercel = !!process.env.VERCEL;
  const hasMongoUri = typeof process.env.MONGODB_URI === 'string' && process.env.MONGODB_URI.trim().length > 0;

  // If already connected to Mongoose
  if (mongoose.connections[0].readyState) {
    return { type: 'mongodb' };
  }

  // Try connecting to MongoDB first
  try {
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb')) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
      });
      console.log('MongoDB Connected successfully');
      return { type: 'mongodb' };
    }
    throw new Error('No valid MONGODB_URI');
  } catch (error) {
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
  }
};

module.exports = connectDB;
