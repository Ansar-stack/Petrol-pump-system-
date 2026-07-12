import ApiError from "./ApiError.util.js";

export const asyncHandler = (fn)=> async (req, res, next)=>{
    try {
        await fn(req, res, next);
    } catch (error) {
        return next(new ApiError(error.status || 500, error.message));
    }
}