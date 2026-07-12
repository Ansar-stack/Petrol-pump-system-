import jwt from "jsonwebtoken";
// import prisma from "../configs/db/db.config.js";

export const verifyAccessToken = (token) => {
    if (!token) {
        throw new Error("ACCESS_TOKEN_MISSING");
    }
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return {
            valid: true,
            expired: false,
            decoded,
        };
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return {
                valid: false,
                expired: true,
                decoded: null,
            };
        }

        return {
            valid: false,
            expired: false,
            decoded: null,
        };
    }
};

export const verifyAndRotateRefreshToken = async (refreshToken) => {
    
    if (!refreshToken) {
        return {
            valid: false,
            expired: false,
            user: null,
        };
    }

    try {
        // 1. Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const userId = decoded.id;

        // 2. Check token exists in DB (security check)
        const storedToken = await prisma.refreshToken.findFirst({
            where: {
                token: refreshToken,
                userId: userId,
            },
        });

        if (!storedToken) {
            return {
                valid: false,
                expired: false,
                user: null,
            };
        }

        // 3. Generate new refresh token (rotation)
        const newRefreshToken = jwt.sign(
            { id: userId },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: "30d" }
        );

        // 4. Replace old token in DB
        await prisma.refreshToken.update({
            where: {
                id: storedToken.id,
            },
            data: {
                token: newRefreshToken,
            },
        });
        // 5. Return success
        return {
            valid: true,
            expired: false,
            user: decoded,
            newRefreshToken,
        };
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return {
                valid: false,
                expired: true,
                user: null,
            };
        }
        return {
            valid: false,
            expired: false,
            user: null,
        };
    }
};