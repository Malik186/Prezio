const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow system-generated activities
    },
    action: {
        type: String,
        required: true,
        enum: [
            'LOGIN',
            'SIGN_UP',
            'PASSWORD_RESET',
            'PASSWORD_RESET_REQUEST',
            'RECOVERY_LOGIN',
            'LOGOUT',
            'UPDATE_PROFILE',
            'ACCOUNT_TERMINATION_REQUEST',
            'ACCOUNT_TERMINATION_ABORTED',
            'CREATE_INVOICE',
            'SEND_INVOICE',
            'PROFILE_UPDATE',
            'UPDATE_INVOICE',
            'DELETE_INVOICE',
            'RESTORE_INVOICE',
            'CREATE_INVOICE_FROM_QUOTATION',
            'CREATE_QUOTATION',
            'SEND_QUOTATION',
            'UPDATE_QUOTATION',
            'DELETE_QUOTATION',
            'RESTORE_QUOTATION',
            'CREATE_RECEIPT',
            'AUTO_GENERATE_RECEIPT',
            'RESTORE_RECEIPT',
            'SEND_RECEIPT',
            'DELETE_RECEIPT',
            'CREATE_CLIENT',
            'UPDATE_CLIENT',
            'DELETE_CLIENT',
            'RESTORE_CLIENT',
            'TERMINATE_SESSION',
            'ENABLE_2FA',
            'DISABLE_2FA',
            'ACCOUNT_CLEANUP',
            'CLIENT_CLEANUP',
            'INVOICE_CLEANUP',
            'LARGE_INVOICE_CLEANUP',
            'RECEIPT_CLEANUP',
            'QUOTATION_CLEANUP',
            'NOTIFICATION_CLEANUP',
            'SYSTEM_MAINTENANCE',
            'UPLOAD_TEMPLATE',
            'DELETE_TEMPLATE',
            'UPLOAD_INVOICE_TEMPLATE',
            'EMAIL_SENT'
        ]
    },
    description: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 30 * 24 * 60 * 60 // Auto-delete after 30 days
    }
});

// Indexes for better query performance
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);