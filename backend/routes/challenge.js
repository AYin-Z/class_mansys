const express = require('express');
const router = express.Router();
const ChallengeController = require('../controllers/ChallengeController');
const { authenticateToken } = require('../middleware/auth');
const { uploadLeaveProof } = require('../config/multer');

router.get('/', authenticateToken, ChallengeController.list);
router.post('/', authenticateToken, ChallengeController.create);
router.get('/my-applications', authenticateToken, ChallengeController.myApplications);
router.post('/upload-proof', authenticateToken, uploadLeaveProof.single('file'), ChallengeController.uploadProof);
router.get('/:id', authenticateToken, ChallengeController.detail);
router.post('/:id/apply', authenticateToken, ChallengeController.apply);
router.put('/application/:applicationId/judge', authenticateToken, ChallengeController.judge);
router.post('/:id/record', authenticateToken, ChallengeController.record);

module.exports = router;
