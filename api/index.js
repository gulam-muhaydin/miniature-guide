require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
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
        await fn(req, res);
    } catch (err) {
        console.error('API Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ message: err.message || 'Internal Server Error' });
        }
    }
};

app.post('/api/auth/login', handleVercel(require('../lib/api/auth/login')));
app.post('/api/auth/signup', handleVercel(require('../lib/api/auth/signup')));
app.post('/api/auth/logout', handleVercel(require('../lib/api/auth/logout')));
app.post('/api/payment/submit', handleVercel(require('../lib/api/payment/submit')));
app.get('/api/user/profile', handleVercel(require('../lib/api/user/profile')));
app.get('/api/user/referrals', handleVercel(require('../lib/api/user/referrals')));
app.post('/api/user/watch-video', handleVercel(require('../lib/api/user/watch-video')));
app.post('/api/user/withdraw', handleVercel(require('../lib/api/user/withdraw')));
app.get('/api/admin/list-pending', handleVercel(require('../lib/api/admin/list-pending')));
app.post('/api/admin/approve', handleVercel(require('../lib/api/admin/approve')));
app.get('/api/admin/withdrawals', handleVercel(require('../lib/api/admin/withdrawals')));
app.post('/api/admin/withdrawals-update', handleVercel(require('../lib/api/admin/withdrawals-update')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get(/^(?!\/api).*/, (req, res) => {
    const requestedPath = req.path === '/' ? 'index.html' : req.path.replace(/^\/+/, '');
    const safePath = path.normalize(requestedPath);
    if (safePath.startsWith('..') || path.isAbsolute(safePath)) {
        res.sendFile(path.join(publicDir, 'index.html'));
        return;
    }
    const filePath = path.join(publicDir, safePath);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
    }
    res.sendFile(path.join(publicDir, 'index.html'));
});

const handler = serverless(app);
handler.app = app;
module.exports = handler;
