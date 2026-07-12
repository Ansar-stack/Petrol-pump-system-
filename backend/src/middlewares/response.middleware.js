
export const responseMiddleware = (req, res, next) => {
    res.respond = function(status, message = "Success", data = null) {
        // Support translation: check if message is a translation key
        let translatedMessage = message;
        
        if (req.t && typeof message === 'string') {
            // Check if it's a translation key (contains dot notation like 'auth.login.success')
            if (message.includes('.')) {
                // Extract params if data contains them
                const params = data?.params || {};
                translatedMessage = req.t(message, params);
            } else {
                // Try translation, fallback to original message
                const translated = req.t(message);
                // Only use translation if it's different from the key (i.e., translation exists)
                translatedMessage = translated !== message ? translated : message;
            }
        }
        
        const responseBody = {
            success: status >= 200 && status < 300, 
            message: translatedMessage, 
            status: status
        };
        
        // Add data but exclude params object used for translation
        if (data && typeof data === "object") {
            const { params, ...actualData } = data;
            if (Object.keys(actualData).length > 0) {
                Object.assign(responseBody, { data: actualData });
            }
        }
        
        res.status(status).json(responseBody);
    }
    next();
}