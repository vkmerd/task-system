import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import orgRoutes from './modules/org/org.routes.js';
import taskRoutes from './modules/tasks/tasks.routes.js';
import userRoutes from './modules/users/users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/org', orgRoutes);
router.use('/tasks', taskRoutes);
router.use('/users', userRoutes);

export default router;