const express = require('express');
const router = express.Router();
const PsychologicalController = require('../controllers/PsychologicalController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, PsychologicalController.create);
router.get('/mine', authenticateToken, PsychologicalController.listMine);
router.get('/all', authenticateToken, PsychologicalController.listAll);
router.get('/:id', authenticateToken, PsychologicalController.detail);
router.put('/:id/handle', authenticateToken, PsychologicalController.handle);

module.exports = router;
