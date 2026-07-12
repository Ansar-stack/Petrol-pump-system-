import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../db/db.config.js';

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const name = profile.displayName;
                const providerUserId = profile.id;

                // Check if OAuth account already exists
                const existingOAuth = await prisma.oAuthAccount.findUnique({
                    where: {
                        provider_providerUserId: {
                            provider: 'google',
                            providerUserId,
                        },
                    },
                    include: { user: true },
                });

                if (existingOAuth) {
                    await prisma.oAuthAccount.update({
                        where: { id: existingOAuth.id },
                        data: { accessToken, refreshToken },
                    });
                    return done(null, existingOAuth.user);
                }

                // Check if user with same email exists
                let user = await prisma.user.findUnique({ where: { email } });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            name,
                            email,
                            password: '',
                            role: 'user',
                            isEmailVerified: true,
                        },
                    });
                }

                // Create OAuth account record
                await prisma.oAuthAccount.create({
                    data: {
                        userId: user.id,
                        provider: 'google',
                        providerUserId,
                        accessToken,
                        refreshToken,
                    },
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

export default passport;
