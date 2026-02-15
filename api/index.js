require('dotenv').config();
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const connectDB = require('../lib/db');

const app = express();
const publicDir = path.join(__dirname, '..', 'public');

connectDB().then(res => {
    if (res.type === 'mongodb') {
        console.log('Connected to MongoDB Cloud');
    } else {
        console.log('Using Local File Database (No MongoDB required)');
    }
}).catch(err => {
    console.error('Database initialization error:', err.message);
});

app.use(express.json());
app.use(express.static(publicDir));

const handleVercel = (fn) => async (req, res) => {
    try {
        await connectDB();
        await fn(req, res);
    } catch (err) {
        console.error('API Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ message: err.message || 'Internal Server Error' });
        }
    }
};

app.post('/api/auth/login', handleVercel(require('./auth/login')));
app.post('/api/auth/signup', handleVercel(require('./auth/signup')));
app.post('/api/auth/logout', handleVercel(require('./auth/logout')));
app.post('/api/payment/submit', handleVercel(require('./payment/submit')));
app.get('/api/user/profile', handleVercel(require('./user/profile')));
app.get('/api/user/referrals', handleVercel(require('./user/referrals')));
app.post('/api/user/watch-video', handleVercel(require('./user/watch-video')));
app.post('/api/user/withdraw', handleVercel(require('./user/withdraw')));
app.get('/api/admin/list-pending', handleVercel(require('./admin/list-pending')));
app.post('/api/admin/approve', handleVercel(require('./admin/approve')));
app.get('/api/admin/withdrawals', handleVercel(require('./admin/withdrawals')));
app.post('/api/admin/withdrawals-update', handleVercel(require('./admin/withdrawals-update')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = serverless(app);
