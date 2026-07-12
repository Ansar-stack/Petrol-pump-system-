import prisma from "../configs/db/db.config.js";

export const verifiedOwnerGuard = async (req, res, next) => {
    if (!req.user || req.user.role !== 'owner') {
        return res.respond(403, "Owner role required", { code: "NOT_OWNER" });
    }

    const owner = await prisma.owner.findUnique({
        where: { userId: req.user.id },
    });

    if (!owner) {
        return res.respond(403, "Owner profile not found", { code: "OWNER_NOT_FOUND" });
    }

    if (owner.status !== 'verified') {
        return res.respond(403, "Your account is pending verification. You cannot perform this action until verified.", {
            code: "OWNER_NOT_VERIFIED",
            status: owner.status,
        });
    }

    req.owner = owner;
    next();
};
