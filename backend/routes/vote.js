const express = require('express');
const router = express.Router();
const VoteController = require('../controllers/VoteController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, VoteController.listVotes);
router.post('/', authenticateToken, VoteController.createVote);
router.get('/:id', authenticateToken, VoteController.getVoteDetail);
router.post('/:id/cast', authenticateToken, VoteController.castVote);
router.post('/:id/close', authenticateToken, VoteController.closeVote);

module.exports = router;
