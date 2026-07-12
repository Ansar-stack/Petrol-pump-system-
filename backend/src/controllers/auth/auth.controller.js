import { asyncHandler } from "../../utils/AsyncHandler.util.js";
import { accessTokenGenerator, refreshTokenGenerator } from "../../utils/genToken.util.js";
import { comparePassword, hashPassword } from "../../utils/hash.util.js";
import { sentCookie } from "../../utils/sentCookie.util.js";
import prisma from "../../configs/db/db.config.js";
import { sendResetToken } from "../../services/Email/email.js";
import jwt from "jsonwebtoken";
import { deleteImage } from "../../utils/cloudinary.util.js";

// Register the owner
export const registerOwner = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    bio,
    jawaz_number,
  } = req.body;

  /* ---------------- File Validation ---------------- */

  const jawazFiles = req.files?.jawazImages || [];

  if (jawazFiles.length <= 1) {
    return res.respond(
      400,
      "auth.register.jawazMinImages"
    );
  }

  if (jawazFiles.length > 3) {
    return res.respond(
      400,
      "auth.register.jawazMaxImages"
    );
  }

  /* ---------------- Duplicate Checks ---------------- */

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.respond(400, "auth.register.emailExists");
  }

  const existingJwaz = await prisma.jawaz.findUnique({
    where: { number: jawaz_number },
  });

  if (existingJwaz) {
    return res.respond(
      400,
      "auth.register.jawazExists"
    );
  }

  /* ---------------- Hash Password ---------------- */

  const hashPwd = await hashPassword(password);

  /* ---------------- Prepare Images ---------------- */

  const jawazImages = jawazFiles.map(
    (file) => file.path
  );

  // Profile Photo — use Cloudinary default if not uploaded
  const profilePhoto = req.files?.profilePhoto?.[0]?.path || process.env.DEFAULT_PROFILE_URL;

  // Cover Photo — use Cloudinary default if not uploaded
  const coverPhoto = req.files?.coverPhoto?.[0]?.path || process.env.DEFAULT_COVER_URL;

  /* ---------------- Transaction ---------------- */
  let createdUser;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        /* ---------- Create User ---------- */

        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashPwd,
            role: "owner"
          },
        });

        /* ---------- Create Owner ---------- */

        const owner = await tx.owner.create({
          data: {
            userId: user.id,
            phone,
            bio,
            profile:profilePhoto,
            cover:coverPhoto,
          },
        });

        /* ---------- Create Jawaz ---------- */
        await tx.jawaz.create({
          data: {
            number: jawaz_number,
            images: jawazImages,
            ownerId: owner.id,
          },
        });

        return { user };
      }
    );

    createdUser = result.user;

  } catch (error) {
    // Delete uploaded Cloudinary images if transaction fails
    if (req.files) {
      const allFiles = [
        ...(req.files.jawazImages || []),
        ...(req.files.profilePhoto || []),
        ...(req.files.coverPhoto || []),
      ];
      await Promise.allSettled(
        allFiles.filter(f => f.public_id).map(f => deleteImage(f.public_id))
      );
    }
    console.error(error);
    return res.respond(500, "auth.register.ownerFailed");
  }

  /* ---------------- Token Generation ---------------- */
  const refreshToken = refreshTokenGenerator({
    id: createdUser.id,
  });

  await prisma.user.update({
    where: { id: createdUser.id },
    data: { refreshToken },
  });

  const accessToken = accessTokenGenerator({
    id: createdUser.id,
  });

  sentCookie("accessToken", res, accessToken);
  sentCookie("refreshToken", res, refreshToken);

  return res.respond(
    200,
    "auth.register.ownerSuccess"
  );
});

// Register the User
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  // Check if email already exists in the database
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    return res.respond(400, "auth.register.emailExists");
  }
  // Hash the password before saving to the database
  const hashPwd = await hashPassword(password);
  // Create the user in the database
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashPwd,
    },
  });
  // Generate the Refresh Token and Access Token for the user
  const refreshToken = refreshTokenGenerator({ id: user.id });
  // Save the refresh token in the database
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });
  // Generate the access token for the user
  const accessToken = accessTokenGenerator({ id: user.id });
  // Send the tokens to client
  sentCookie("accessToken", res, accessToken);
  sentCookie("refreshToken", res, refreshToken);
  res.respond(200, "auth.register.userSuccess", { id: user.id, role: user.role, name: user.name });
});

// Get authenticated user profile
export const verifyUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      owner: {
        include: {
          jawaz: true,
        },
      },
    },
  });

  if (!user) {
    return res.respond(404, "auth.profile.userNotFound");
  }

  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    status: user.owner?.status || null,
    comment: user.owner?.comment || null,
    profile_image: user.owner?.profile || null,
    cover_image: user.owner?.cover || null,
    owner: user.owner
      ? {
          phone: user.owner.phone,
          bio: user.owner.bio,
          jawaz_number: user.owner.jawaz?.number || null,
          jawaz_images: user.owner.jawaz?.images || [],
        }
      : null,
  };

  res.respond(200, "auth.profile.fetchSuccess", { profile });
});

// Logout the user
export const logoutUser = asyncHandler(async (req, res) => {
  const id = req.user.id;
  // Remove the refresh token from the database
  await prisma.user.update({
    where: { id },
    data: { refreshToken: null },
  });
  // Clear the cookies
  sentCookie("accessToken", res, null, { maxAge: 0 });
  sentCookie("refreshToken", res, null, { maxAge: 0 });
  res.respond(200, "auth.logout.success");
});

// login the user
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Check if email exists
  const existUser = await prisma.user.findUnique({
    where: { email },
  });
  if (!existUser) return res.respond(400, "auth.login.emailNotFound");
  if (!existUser.password) return res.respond(400, "auth.login.googleSignIn");
  // Compare the password
  const isPasswordMatch = await comparePassword(password, existUser.password);
  if (!isPasswordMatch) return res.respond(200, "auth.login.incorrectPassword");
  // Generate the Refresh Token and Access Token for the user
  const refreshToken = refreshTokenGenerator({ id: existUser.id });
  // Save the refresh token in the database
  await prisma.user.update({
    where: { id: existUser.id },
    data: { refreshToken },
  });
  // Generate the access token for the user
  const accessToken = accessTokenGenerator({ id: existUser.id });
  // Send the tokens to client
  sentCookie("accessToken", res, accessToken);
  sentCookie("refreshToken", res, refreshToken);
  res.respond(200, "auth.login.success", {id: existUser.id, name: existUser.name, role: existUser.role});
});
// forggot password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const existUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existUser)
    return res.respond(400, "auth.login.emailNotFound");

  const jwtToken = accessTokenGenerator(
    { id: existUser.id },
    "15m"
  );

  const emailResult = await sendResetToken(
    email,
    jwtToken
  );

  if (!emailResult.success) {
    console.error(emailResult.error);

    return res.respond(
      500,
      "auth.password.resetEmailFailed"
    );
  }

  res.respond(
    200,
    "auth.password.resetLinkSent"
  );
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  if (!user) {
    return res.respond(401, "auth.unauthorized");
  }

  const isPasswordMatch = await comparePassword(currentPassword, user.password);
  if (!isPasswordMatch) {
    return res.respond(400, "auth.password.currentIncorrect");
  }

  const hashPwd = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashPwd },
  });

  res.respond(200, "auth.password.changeSuccess");
});

// Update owner profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, bio } = req.body;
  const profilePhoto = req.files?.profilePhoto?.[0]?.path;
  const coverPhoto = req.files?.coverPhoto?.[0]?.path;

  const userUpdates = {};
  if (name) userUpdates.name = name;

  const ownerUpdates = {};
  if (phone) ownerUpdates.phone = phone;
  if (bio !== undefined) ownerUpdates.bio = bio;
  if (profilePhoto) ownerUpdates.profile = profilePhoto;
  if (coverPhoto) ownerUpdates.cover = coverPhoto;

  if (!Object.keys(userUpdates).length && !Object.keys(ownerUpdates).length) {
    return res.respond(400, "auth.profile.noFieldsProvided");
  }

  // Fetch old images before update to delete from Cloudinary
  if (profilePhoto || coverPhoto) {
    const existingOwner = await prisma.owner.findUnique({
      where: { userId: req.user.id },
      select: { profile: true, cover: true }
    });
    if (existingOwner) {
      const toDelete = [];
      if (profilePhoto && existingOwner.profile) toDelete.push(existingOwner.profile);
      if (coverPhoto && existingOwner.cover) toDelete.push(existingOwner.cover);
      await Promise.allSettled(
        toDelete.map(url => {
          const publicId = extractPublicId(url);
          return publicId ? deleteImage(publicId) : Promise.resolve();
        })
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdates).length) {
      await tx.user.update({ where: { id: req.user.id }, data: userUpdates });
    }
    if (Object.keys(ownerUpdates).length) {
      await tx.owner.update({ where: { userId: req.user.id }, data: ownerUpdates });
    }
  });

  res.respond(200, "auth.profile.updateSuccess");
});

// Get full owner profile
export const getProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.respond(403, "auth.profile.ownerRoleRequired");
  }

  const owner = await prisma.owner.findUnique({
    where: { userId: req.user.id },
    select: {
      id: true, phone: true, bio: true, profile: true, cover: true,
      status: true, comment: true,
      user: { select: { id: true, name: true, email: true, isEmailVerified: true } },
      jawaz: { select: { number: true, images: true } }
    }
  });

  if (!owner) return res.respond(404, "auth.profile.ownerNotFound");

  res.respond(200, "auth.profile.fetchSuccess", { profile: owner });
});

// Extract Cloudinary public_id from a secure_url
const extractPublicId = (url) => {
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;
    const afterUpload = parts.slice(uploadIndex + 1);
    if (afterUpload[0]?.startsWith('v')) afterUpload.shift();
    return afterUpload.join('/').replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return res.respond(400, "auth.password.invalidToken");
  }
  const hashPwd = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: decoded.id },
    data: { password: hashPwd },
  });
  res.respond(200, "auth.password.resetSuccess");
});

// Delete Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmation } = req.body;
  
  if (confirmation !== "DELETE") {
    return res.respond(400, "auth.account.deleteConfirmationInvalid");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    return res.respond(404, "auth.profile.userNotFound");
  }

  if (user.password) {
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      return res.respond(400, "auth.password.currentIncorrect");
    }
  }

  // Soft delete user
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      refreshToken: null,
    },
  });

  // Clear cookies
  sentCookie("accessToken", res, null, { maxAge: 0 });
  sentCookie("refreshToken", res, null, { maxAge: 0 });

  res.respond(200, "auth.account.deleteSuccess");
});

// Resubmit Verification (Owner)
export const resubmitVerification = asyncHandler(async (req, res) => {
  const { jawaz_number } = req.body;

  if (req.user.role !== 'owner') {
    return res.respond(403, "auth.verification.ownerOnly");
  }

  const jawazFiles = req.files?.jawazImages || [];

  if (jawazFiles.length < 2) {
    return res.respond(400, "auth.register.jawazMinImages");
  }

  if (jawazFiles.length > 3) {
    return res.respond(400, "auth.register.jawazMaxImages");
  }

  const owner = await prisma.owner.findUnique({
    where: { userId: req.user.id },
    include: { jawaz: true },
  });

  if (!owner) {
    return res.respond(404, "auth.profile.ownerNotFound");
  }

  // Check if jawaz number is taken by another owner
  const existingJawaz = await prisma.jawaz.findUnique({
    where: { number: jawaz_number },
  });

  if (existingJawaz && existingJawaz.ownerId !== owner.id) {
    return res.respond(400, "auth.register.jawazExists");
  }

  const jawazImages = jawazFiles.map(file => file.path);

  // Delete old jawaz images from Cloudinary
  if (owner.jawaz?.images) {
    await Promise.allSettled(
      owner.jawaz.images.map(url => {
        const publicId = extractPublicId(url);
        return publicId ? deleteImage(publicId) : Promise.resolve();
      })
    );
  }

  // Update owner status to pending and update jawaz
  await prisma.$transaction(async (tx) => {
    await tx.owner.update({
      where: { id: owner.id },
      data: {
        status: 'pending',
        comment: null,
      },
    });

    await tx.jawaz.upsert({
      where: { ownerId: owner.id },
      create: {
        number: jawaz_number,
        images: jawazImages,
        ownerId: owner.id,
      },
      update: {
        number: jawaz_number,
        images: jawazImages,
      },
    });
  });

  res.respond(200, "auth.verification.resubmitSuccess");
});

// Upgrade to Owner
export const upgradeToOwner = asyncHandler(async (req, res) => {
  const { phone, bio, jawaz_number } = req.body;

  if (req.user.role !== 'user') {
    return res.respond(400, "auth.upgrade.userRoleRequired");
  }

  const jawazFiles = req.files?.jawazImages || [];

  if (jawazFiles.length < 2) {
    return res.respond(400, "auth.register.jawazMinImages");
  }

  if (jawazFiles.length > 3) {
    return res.respond(400, "auth.register.jawazMaxImages");
  }

  // Check if jawaz number already exists
  const existingJawaz = await prisma.jawaz.findUnique({
    where: { number: jawaz_number },
  });

  if (existingJawaz) {
    return res.respond(400, "auth.register.jawazExists");
  }

  // Check if user already has owner record
  const existingOwner = await prisma.owner.findUnique({
    where: { userId: req.user.id },
  });

  if (existingOwner) {
    return res.respond(400, "auth.upgrade.alreadyOwner");
  }

  const jawazImages = jawazFiles.map(file => file.path);
  const profilePhoto = req.files?.profilePhoto?.[0]?.path || process.env.DEFAULT_PROFILE_URL;
  const coverPhoto = req.files?.coverPhoto?.[0]?.path || process.env.DEFAULT_COVER_URL;

  try {
    await prisma.$transaction(async (tx) => {
      // Update user role
      await tx.user.update({
        where: { id: req.user.id },
        data: { role: 'owner' },
      });

      // Create owner record
      const owner = await tx.owner.create({
        data: {
          userId: req.user.id,
          phone,
          bio,
          profile: profilePhoto,
          cover: coverPhoto,
        },
      });

      // Create jawaz
      await tx.jawaz.create({
        data: {
          number: jawaz_number,
          images: jawazImages,
          ownerId: owner.id,
        },
      });
    });

    res.respond(200, "auth.upgrade.success");
  } catch (error) {
    // Delete uploaded images if transaction fails
    if (req.files) {
      const allFiles = [
        ...(req.files.jawazImages || []),
        ...(req.files.profilePhoto || []),
        ...(req.files.coverPhoto || []),
      ];
      await Promise.allSettled(
        allFiles.filter(f => f.public_id).map(f => deleteImage(f.public_id))
      );
    }
    console.error(error);
    return res.respond(500, "auth.upgrade.failed");
  }
});
