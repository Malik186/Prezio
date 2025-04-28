const express = require('express');
const { createClient, getClients, updateClient, deleteClient } = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');
const router = express.Router();


router.post('/', auth, createClient);
router.get('/', auth, getClients);
router.put('/:id', auth, updateClient);
router.delete('/:id', auth, deleteClient);

module.exports = router;
