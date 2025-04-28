const express = require('express');
const { createClient, getClients, updateClient, deleteClient, getDeletedClients, restoreClient } = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');
const router = express.Router();


router.post('/', auth, createClient);
router.get('/', auth, getClients);
router.put('/:id', auth, updateClient);
router.delete('/:id', auth, deleteClient);
router.get('/deleted', auth, getDeletedClients);
router.patch('/:id/restore', auth, restoreClient);

module.exports = router;
