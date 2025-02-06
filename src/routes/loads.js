const express = require('express');
const router = express.Router();
const LoadController = require('../controllers/loadController');
const auth = require('../middleware/auth');
const { validateLoad, validateUpdateLoad } = require('../middleware/validate');

router.post('/', auth, validateLoad, LoadController.createLoad);
router.get('/', auth, LoadController.getAllLoads);
router.get('/search', auth, LoadController.searchLoads);
router.put('/:id', auth, validateUpdateLoad, LoadController.updateLoad);
router.delete('/:id', auth, LoadController.deleteLoad);
router.get('/view-loads', auth, LoadController.viewLoads);
router.get('/all-loads', auth, LoadController.allLoads);
router.post('/:loadId/request', auth, LoadController.requestLoad);
router.get('/:loadId/requests', auth, LoadController.getLoadRequests);
router.post('/import', auth, LoadController.importLoads);
router.get('/download-sample', LoadController.downloadSampleCSV);
router.get('/update-loads', auth, LoadController.updateExpiredLoads);

module.exports = router; 