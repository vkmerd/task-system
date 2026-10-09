import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { getQuery, validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  contactSchema,
  createCustomerSchema,
  customerServiceSchema,
  listCustomersSchema,
  teamSeatSchema,
  updateCustomerSchema,
  type ListCustomersQuery,
} from './customers.schemas.js';
import * as service from './customers.service.js';

const router = Router();
router.use(authenticate);

const canRead = requirePermission(PERMISSIONS.CUSTOMER_READ_ALL, PERMISSIONS.CUSTOMER_READ_ASSIGNED);
const canWrite = requirePermission(PERMISSIONS.CUSTOMER_WRITE);

router.get('/', canRead, validate(listCustomersSchema, 'query'), async (req, res) => {
  res.json(await service.list(req.user!, getQuery<ListCustomersQuery>(req)));
});

router.get('/:id', canRead, async (req, res) => {
  res.json(await service.getById(req.user!, req.params.id as string));
});

router.post('/', canWrite, validate(createCustomerSchema), async (req, res) => {
  res.status(201).json(await service.create(req.body));
});

router.patch('/:id', canWrite, validate(updateCustomerSchema), async (req, res) => {
  res.json(await service.update(req.user!, req.params.id as string, req.body));
});

router.delete('/:id', requirePermission(PERMISSIONS.CUSTOMER_DELETE), async (req, res) => {
  await service.softDelete(req.params.id as string);
  res.status(204).end();
});

// --- Hizmet kalemleri ---
router.put('/:id/services', canWrite, validate(customerServiceSchema), async (req, res) => {
  res.json(await service.upsertService(req.user!, req.params.id as string, req.body));
});

router.delete('/:id/services/:serviceId', canWrite, async (req, res) => {
  await service.removeService(req.user!, req.params.id as string, req.params.serviceId as string);
  res.status(204).end();
});

// --- Kadro / is dagilimi ---
router.post('/:id/team', canWrite, validate(teamSeatSchema), async (req, res) => {
  res.status(201).json(await service.addTeamSeat(req.user!, req.params.id as string, req.body));
});

router.patch('/:id/team/:seatId', canWrite, validate(teamSeatSchema.partial()), async (req, res) => {
  res.json(await service.updateTeamSeat(req.user!, req.params.id as string, req.params.seatId as string, req.body));
});

router.delete('/:id/team/:seatId', canWrite, async (req, res) => {
  await service.removeTeamSeat(req.user!, req.params.id as string, req.params.seatId as string);
  res.status(204).end();
});

// --- Musteri tarafi kisiler ---
router.post('/:id/contacts', canWrite, validate(contactSchema), async (req, res) => {
  res.status(201).json(await service.addContact(req.user!, req.params.id as string, req.body));
});

router.patch('/:id/contacts/:contactId', canWrite, validate(contactSchema.partial()), async (req, res) => {
  res.json(await service.updateContact(req.user!, req.params.id as string, req.params.contactId as string, req.body));
});

router.delete('/:id/contacts/:contactId', canWrite, async (req, res) => {
  await service.removeContact(req.user!, req.params.id as string, req.params.contactId as string);
  res.status(204).end();
});

export default router;
