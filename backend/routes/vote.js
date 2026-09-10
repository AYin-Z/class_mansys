const express = require('express');
const router = express.Router();
const VoteController = require('../controllers/VoteController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.get('/', authenticateToken, VoteController.listVotes);
router.post('/', authenticateToken, requirePermission('CREATE_VOTE'), validateBody(schemas.voteCreate), VoteController.createVote);
router.get('/:id', authenticateToken, VoteController.getVoteDetail);
router.post('/:id/cast', authenticateToken, VoteController.castVote);
router.post('/:id/close', authenticateToken, requirePermission('CLOSE_VOTE'), VoteController.closeVote);

module.exports = router;
