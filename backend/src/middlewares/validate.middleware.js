import express from 'express';
import { validationResult } from 'express-validator';

export const requestValidator = (req, res, next) => {
    const errors = validationResult(req);
    const firstError = errors.array()[0]?.msg || 'Validation error';
    if(!errors.isEmpty()) {
        return res.respond(400, firstError);
    }
    next();
};

