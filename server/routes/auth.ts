import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, queryAll, run } from '../db';
import { JWT_SECRET, requireAuth, requireRole, AuthUser } from '../middleware/auth';

const router = Router();

// Check if any admin account exists (for initial setup wizard)
router.get('/setup-status', async (req: Request, res: Response) => {
  try {
    const adminUser = await queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    res.json({ needsAdminSetup: !adminUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Setup initial admin account
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    const existingAdmin = await queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin account already configured' });
    }

    const { name, username, password } = req.body;
    if (!name || !username || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, username, and password (min 6 chars) are required' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const info = await run(
      `INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')`,
      [name.trim(), username.trim().toLowerCase(), hash]
    );

    const user: AuthUser = {
      id: info.lastInsertRowid,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role: 'admin'
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'SETUP_ADMIN', 'user', ?, 'Initial administrator account created')`,
      [user.id, String(user.id)]
    );

    res.status(201).json({ message: 'Administrator initialized successfully', user, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const userRecord = await queryOne(
      `SELECT id, name, username, password_hash, role, is_active FROM users WHERE username = ?`,
      [username.trim().toLowerCase()]
    );

    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!userRecord.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact store owner.' });
    }

    const isValid = bcrypt.compareSync(password, userRecord.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const authUser: AuthUser = {
      id: userRecord.id,
      name: userRecord.name,
      username: userRecord.username,
      role: userRecord.role
    };

    const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: '7d' });

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'LOGIN', 'user', ?, 'User logged in successfully')`,
      [userRecord.id, String(userRecord.id)]
    );

    res.json({ user: authUser, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Current user profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRecord = await queryOne(
      `SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?`,
      [req.user!.id]
    );
    res.json({ user: userRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all users (Admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const users = await queryAll(
      `SELECT id, name, username, role, is_active, created_at FROM users ORDER BY id ASC`
    );
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user (Admin only)
router.post('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'Name, username, password and role are required' });
    }
    if (!['admin', 'manager', 'cashier'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, manager, or cashier' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const info = await run(
      `INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      [name.trim(), username.trim().toLowerCase(), hash, role]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'CREATE_USER', 'user', ?, ?)`,
      [req.user!.id, String(info.lastInsertRowid), `Created user ${username} with role ${role}`]
    );

    res.status(201).json({ message: 'User created successfully', id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
