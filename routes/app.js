var express = require('express');
var router = express.Router();
var dockerContainerCreate = require('../controllers/dockerContainerCreate')

router.post('/create', dockerContainerCreate.createContainer);
router.get('/list', dockerContainerCreate.listContainer);

module.exports = router;