const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/locations',    require('./routes/locations'));
app.use('/api/items',        require('./routes/items'));
app.use('/api/assets',       require('./routes/assets'));
app.use('/api/students',     require('./routes/students'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/stock',        require('./routes/stock'));
app.use('/api/reports',      require('./routes/reports'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    database: databaseConnected ? 'connected' : 'disconnected',
    message: 'Department Inventory Management API is running 🚀',
    version: '1.0.0',
    endpoints: {
      auth:         '/api/auth',
      locations:    '/api/locations',
      items:        '/api/items',
      assets:       '/api/assets',
      students:     '/api/students',
      transactions: '/api/transactions',
      stock:        '/api/stock',
      reports:      '/api/reports',
    },
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const start = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Set it in the backend .env file.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Set it in the backend .env file.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected');

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📄 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start().catch((err) => {
  console.error('❌ Backend startup failed:', err.message);
  process.exit(1);
});
