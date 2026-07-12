
export const sentCookie = (name, res, token)=>{
    res.cookie(name, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    });
};