import jwt from 'jsonwebtoken'

// Access Token Generator
export const accessTokenGenerator = (payload)=>{
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '30m'
    });
};

// Refresh Token Generator
export const refreshTokenGenerator = (payload)=>{
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET);
};
