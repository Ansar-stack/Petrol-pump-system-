import prisma from "../configs/db/db.config.js";
import { verifyAccessToken } from "../utils/verifyToken.util.js";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
    const { accessToken, refreshToken } = req.cookies;
    if (!accessToken || !refreshToken) {
        console.log(req.cookies);
        return res.respond(401, "Unauthorized");
    }
    const verifyToken = verifyAccessToken(accessToken);
    if (verifyToken.valid) {
        console.log(verifyAccessToken)
        const user = await prisma.user.findUnique({ where: { id: verifyToken.decoded.id } });
        console.log(user);
        if (!user || user.isDeleted) return res.respond(401, "Unauthorized...");
        req.user = user;
        return next();
    }

    if (!verifyToken.valid && verifyToken.expired) {
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch {
            return res.respond(401, "Unauthorized");
        }
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user || user.isDeleted || user.refreshToken !== refreshToken) {
            return res.respond(401, "Unauthorized");
        }
        req.user = user;
        return next();
    }
    return res.respond(401, "Unauthorized");
};