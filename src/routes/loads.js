const express = require('express');
const router = express.Router();
const LoadController = require('../controllers/loadController');
const auth = require('../middleware/auth');
const { validateLoad } = require('../middleware/validate');

router.post('/', auth, validateLoad, LoadController.createLoad);
router.get('/', auth, LoadController.getAllLoads);
router.get('/search', auth, LoadController.searchLoads);
router.put('/:id', auth, validateLoad, LoadController.updateLoad);
router.delete('/:id', auth, LoadController.deleteLoad);
router.get('/view-loads', auth, LoadController.viewLoads);
router.post('/:loadId/request', auth, LoadController.requestLoad);
router.get('/:loadId/requests', auth, LoadController.getLoadRequests);

module.exports = router; 