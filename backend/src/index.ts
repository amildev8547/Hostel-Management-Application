import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import authRoutes from './routes/authRoutes';
import branchRoutes from './routes/branchRoutes';
import roomRoutes from './routes/roomRoutes';
import admissionRoutes from './routes/admissionRoutes';
import tenantRoutes from './routes/tenantRoutes';
import paymentRoutes from './routes/paymentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import settingRoutes from './routes/settingRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import publicRoutes from './routes/publicRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Set JSON limit to 10MB to accommodate base64 photos/Aadhaar cards
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve local uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Mount Public HTML routers
app.use('/', publicRoutes);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'HostelHub API is running smoothly' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   HostelHub Backend Server Active on Port ${PORT} `);
  console.log(`   API Base URL: http://localhost:${PORT}/api   `);
  console.log(`===============================================`);
});
