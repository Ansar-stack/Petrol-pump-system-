import { asyncHandler } from '../../utils/AsyncHandler.util.js';

export const healthCheck = asyncHandler(async (req, res) => {
    const data = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    };

    res.respond(200, 'Server is up and running', data);
});
