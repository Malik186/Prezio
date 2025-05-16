const EmailLog = require('../models/EmailLog');

const checkEmailHealth = async () => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get email statistics for the last 24 hours
  const [totalEmails, failedEmails, emailsByType] = await Promise.all([
    EmailLog.countDocuments({ sentAt: { $gte: last24Hours } }),
    EmailLog.countDocuments({ 
      sentAt: { $gte: last24Hours },
      status: 'failed'
    }),
    EmailLog.aggregate([
      { $match: { sentAt: { $gte: last24Hours } } },
      { $group: {
        _id: '$type',
        count: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }}
    ])
  ]);

  // Calculate success rate
  const successRate = totalEmails > 0 
    ? ((totalEmails - failedEmails) / totalEmails) * 100 
    : 100;

  // Determine health status
  const health = successRate >= 95 ? 'healthy' : 
                 successRate >= 80 ? 'degraded' : 
                 'unhealthy';

  return {
    status: health,
    statistics: {
      last24Hours: {
        total: totalEmails,
        failed: failedEmails,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      },
      byType: emailsByType.reduce((acc, type) => ({
        ...acc,
        [type._id]: {
          total: type.count,
          successful: type.successful,
          failed: type.failed
        }
      }), {})
    }
  };
};

module.exports = checkEmailHealth;