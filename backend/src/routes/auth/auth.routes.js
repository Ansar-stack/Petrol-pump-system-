import express from 'express'
import { changePassword, forgotPassword, loginUser, logoutUser, registerOwner, registerUser, resetPassword, verifyUser, updateProfile, deleteAccount, resubmitVerification, upgradeToOwner } from '../../controllers/auth/auth.controller.js';
import { requestValidator } from '../../middlewares/validate.middleware.js';
import { changePasswordValidator, forgotPasswordValidator, loginValidator, ownerValidator, resetPasswordValidator, userValidator, updateProfileValidator, deleteAccountValidator, resubmitVerificationValidator, upgradeToOwnerValidator } from '../../validator/auth/auth.validator.js';
import { upload, processUploadedImages } from '../../configs/multer/multer.config.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
const authRouter = express.Router();

// Register the user
authRouter.post('/register/user', userValidator, requestValidator,  registerUser);

// Register the owner
authRouter.post('/register/owner', upload.fields([
  { name: "jawazImages", maxCount: 3 },
  { name: "profilePhoto", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]), processUploadedImages, ownerValidator, requestValidator, registerOwner);

// Profile endpoints
authRouter.get('/me', authMiddleware,  verifyUser);
authRouter.get('/profile', authMiddleware, verifyUser);
authRouter.patch('/me', authMiddleware, upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]), processUploadedImages, updateProfileValidator, requestValidator, updateProfile);
authRouter.delete('/me', authMiddleware, deleteAccountValidator, requestValidator, deleteAccount);
authRouter.post('/me/verification', authMiddleware, upload.fields([
  { name: "jawazImages", maxCount: 3 },
]), processUploadedImages, resubmitVerificationValidator, requestValidator, resubmitVerification);
authRouter.post('/me/upgrade-owner', authMiddleware, upload.fields([
  { name: "jawazImages", maxCount: 3 },
  { name: "profilePhoto", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]), processUploadedImages, upgradeToOwnerValidator, requestValidator, upgradeToOwner);

// Login the user
authRouter.post("/login", loginValidator, requestValidator, loginUser);

// Logout the user
authRouter.get('/logout', authMiddleware, logoutUser);

// Forgot password
authRouter.post('/forgot-password', forgotPasswordValidator, requestValidator, forgotPassword);

// Reset password
authRouter.post('/reset-password', resetPasswordValidator, requestValidator, resetPassword);

// change the password 
authRouter.post("/change-password", authMiddleware, changePasswordValidator, requestValidator, changePassword);
export default authRouter;