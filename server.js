require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Connect to Database
connectDB().then(res => {
    if (res.type === 'mongodb') {
        console.log('Connected to MongoDB Cloud');
    } else {
        console.log('Using Local File Database (No MongoDB required)');
    }
}).catch(err => {
    console.error('Database initialization error:', err.message);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to convert Vercel serverless function to Express middleware
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

// API Routes
app.post('/api/auth/login', handleVercel(require('./api/auth/login')));
app.post('/api/auth/signup', handleVercel(require('./api/auth/signup')));
app.post('/api/auth/logout', handleVercel(require('./api/auth/logout')));
app.post('/api/payment/submit', handleVercel(require('./api/payment/submit')));
app.get('/api/user/profile', handleVercel(require('./api/user/profile')));
app.get('/api/user/referrals', handleVercel(require('./api/user/referrals')));
app.post('/api/user/watch-video', handleVercel(require('./api/user/watch-video')));
app.post('/api/user/withdraw', handleVercel(require('./api/user/withdraw')));
app.get('/api/admin/list-pending', handleVercel(require('./api/admin/list-pending')));
app.post('/api/admin/approve', handleVercel(require('./api/admin/approve')));
app.get('/api/admin/withdrawals', handleVercel(require('./api/admin/withdrawals')));
app.post('/api/admin/withdrawals-update', handleVercel(require('./api/admin/withdrawals-update')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve main app for any other routes (SPA support)
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
