import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDatabase, queryOne } from './db';
import { seedDemoData } from './seed';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import inventoryRoutes from './routes/inventory';
import posRoutes from './routes/pos';
import invoiceRoutes from './routes/invoices';
import returnRoutes from './routes/returns';
import purchaseRoutes from './routes/purchases';
import customerRoutes from './routes/customers';
import expenseRoutes from './routes/expenses';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema and auto-seed demo data if empty
async function bootstrap() {
  await initDatabase();

  const prodCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products');
  if (!prodCount || prodCount.count === 0) {
    try {
      await seedDemoData();
      console.log('🌸 Initial AAVNI ETHNICWEAR demo catalog seeded successfully');
    } catch (err: any) {
      console.error('Failed to auto-seed initial data:', err.message);
    }
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    store: 'AAVNI ETHNICWEAR',
    city: 'Jabalpur'
  });
});

// Serve frontend in production build
const clientDist = path.resolve(__dirname, '../dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    // If request has not been handled by an API route and is not an API route, send index.html
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

bootstrap().then(() => {
  app.listen(PORT, () => {
    console.log(`🌸 AAVNI ETHNICWEAR POS Server running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to bootstrap server:', err);
});

export default app;
