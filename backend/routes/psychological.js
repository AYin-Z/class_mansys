const express = require('express');
const router = express.Router();
const PsychologicalController = require('../controllers/PsychologicalController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.post('/', authenticateToken, validateBody(schemas.psychologicalCreate), PsychologicalController.create);
router.get('/mine', authenticateToken, PsychologicalController.listMine);
router.get('/all', authenticateToken, requirePermission('HANDLE_PSYCHOLOGICAL'), PsychologicalController.listAll);
router.get('/:id', authenticateToken, PsychologicalController.detail);
router.put('/:id/handle', authenticateToken, requirePermission('HANDLE_PSYCHOLOGICAL'), PsychologicalController.handle);

module.exports = router;
