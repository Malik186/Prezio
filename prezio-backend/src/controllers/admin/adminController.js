const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Client = require('../../models/Client');
const Invoice = require('../../models/Invoice');
const Receipt = require('../../models/Receipt');
const ActivityLog = require('../../models/ActivityLog');
const checkDBConnection = require('../../utils/checkDB');
const checkEmailHealth = require('../../utils/checkEmailHealth');

// GET /api/admin/dashboard
exports.getAdminDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalClients,
    totalInvoices,
    totalReceipts,
    recentActivities
  ] = await Promise.all([
    User.countDocuments(),
    Client.countDocuments(),
    Invoice.countDocuments(),
    Receipt.countDocuments(),
    ActivityLog.find()
      .populate('user', 'email name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .then(activities => activities.map(activity => ({
        ...activity,
        user: activity.user ? {
          id: activity.user._id,
          email: activity.user.email,
          name: activity.user.name
        } : 'System'
      })))
  ]);

  // Active clients: clients with invoices or receipts
  const activeClientIdsFromInvoices = await Invoice.distinct('client');
  const activeClientIdsFromReceipts = await Receipt.distinct('client');
  const activeClientSet = new Set([...activeClientIdsFromInvoices, ...activeClientIdsFromReceipts]);
  const totalActiveClients = activeClientSet.size;

  // System health
  const [dbStatus, emailHealth] = await Promise.all([
    checkDBConnection(),
    checkEmailHealth()
  ]);

  res.status(200).json({
    metrics: {
      totalUsers,
      totalClients,
      totalInvoices,
      totalReceipts,
      totalActiveClients
    },
    activityFeed: recentActivities,
    systemHealth: {
      database: dbStatus,
      email: emailHealth
    }
  });
});