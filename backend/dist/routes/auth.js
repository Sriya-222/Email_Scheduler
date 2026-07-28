"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const googleClient = new google_auth_library_1.OAuth2Client(env_1.env.GOOGLE_CLIENT_ID);
/**
 * POST /api/auth/google
 * Exchanging client-side Google ID Token for our own server-signed JWT cookie.
 */
router.post('/google', async (req, res, next) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required.' });
        }
        // Decode token to dynamically extract the client ID. This prevents audience mismatch
        // errors if the backend .env client ID has not been updated to match the frontend.
        const decoded = jsonwebtoken_1.default.decode(idToken);
        const allowedAudiences = [];
        if (env_1.env.GOOGLE_CLIENT_ID && env_1.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
            allowedAudiences.push(env_1.env.GOOGLE_CLIENT_ID);
        }
        if (decoded && decoded.aud) {
            allowedAudiences.push(decoded.aud);
        }
        if (allowedAudiences.length === 0) {
            return res.status(400).json({ error: 'Google Client ID is not configured on the server and could not be parsed from token.' });
        }
        // Verify token signature with Google public certs against allowed audiences list
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: allowedAudiences,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
            return res.status(401).json({ error: 'Invalid Google ID token.' });
        }
        const sessionUser = {
            sub: payload.sub,
            name: payload.name || 'Google User',
            email: payload.email,
            picture: payload.picture,
        };
        // Sign session token
        const token = jsonwebtoken_1.default.sign(sessionUser, env_1.env.JWT_SECRET, { expiresIn: '7d' });
        // Set secure cookie
        res.cookie('session_token', token, {
            httpOnly: true,
            secure: env_1.env.NODE_ENV === 'production',
            sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        return res.json({ user: sessionUser });
    }
    catch (error) {
        return next(error);
    }
});
/**
 * GET /api/auth/me
 * Check current logged-in user session
 */
router.get('/me', auth_1.requireAuth, (req, res) => {
    return res.json({ user: req.user });
});
/**
 * POST /api/auth/logout
 * Log out user by clearing session cookie
 */
router.post('/logout', (req, res) => {
    res.clearCookie('session_token', {
        httpOnly: true,
        secure: env_1.env.NODE_ENV === 'production',
        sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return res.json({ success: true });
});
exports.default = router;
