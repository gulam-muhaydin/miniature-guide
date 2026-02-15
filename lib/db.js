const mongoose = require('mongoose');
const Datastore = require('nedb-promises');
const path = require('path');

let useLocalDB = false;
let localDB = null;

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('MongoDB connection timeout')), ms);
  promise
    .then((v) => {
      clearTimeout(t);
      resolve(v);
    })
    .catch((e) => {
      clearTimeout(t);
      reject(e);
    });
});

const connectDB = async () => {
  // If already connected to Mongoose
  if (mongoose.connections[0].readyState === 1) {
    return { type: 'mongodb' };
  }

  // Try connecting to MongoDB first
  try {
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb')) {
      await withTimeout(mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        socketTimeoutMS: 2000
      }), 2500);
      console.log('MongoDB Connected successfully');
      return { type: 'mongodb' };
    }
    throw new Error('No valid MONGODB_URI');
  } catch (error) {
    console.log('MongoDB connection failed, falling back to local file database...');
    useLocalDB = true;
    
    if (!localDB) {
      const isVercel = !!process.env.VERCEL;
      const localPath = isVercel ? path.join('/tmp', 'data.db') : path.join(__dirname, 'data.db');
      localDB = Datastore.create({
        filename: localPath,
        autoload: true
      });
    }
    return { type: 'local', db: localDB };
  }
};

module.exports = connectDB;
