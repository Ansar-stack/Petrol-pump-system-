import cloudinary from '../configs/cloudinary/cloudinary.config.js';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = resolve(__dirname, '../../uploads/logo/default.jpg');

const buildWatermarkedBuffer = async (inputBuffer) => {
    const base = sharp(inputBuffer).rotate().resize({ width: 1280, withoutEnlargement: true });
    const { width, height } = await base.clone().metadata();

    // Small: 10% of the smaller dimension
    const logoSize = Math.round(Math.min(width, height) * 0.10);

    const { data, info } = await sharp(await readFile(LOGO_PATH))
        .resize(logoSize, logoSize, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Remove white background only, keep original colors
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 220 && g > 220 && b > 220) {
            data[i + 3] = 0;
        }
    }

    const transparentLogo = await sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toBuffer();

    return base.clone()
        .composite([{ input: transparentLogo, gravity: 'southeast', blend: 'over' }])
        .webp({ quality: 70, effort: 2 })
        .toBuffer();
};

// Upload a buffer to Cloudinary
export const uploadImage = async (buffer, folder, type = 'upload') => {
    const compressed = await sharp(buffer)
        .rotate()
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 70, effort: 2 })
        .toBuffer();

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, type, resource_type: 'image', format: 'webp' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(compressed);
    });
};

// Upload a property image with watermark
export const uploadPropertyImage = async (buffer, folder, type = 'upload') => {
    const watermarked = await buildWatermarkedBuffer(buffer);
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, type, resource_type: 'image', format: 'webp' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(watermarked);
    });
};

// Delete an image from Cloudinary by public_id
export const deleteImage = async (publicId, type = 'upload') => {
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image', type });
};

// Generate a short-lived signed URL for private images (jawaz)
export const getSignedUrl = (publicId, expiresInSeconds = 300) => {
    return cloudinary.utils.private_download_url(publicId, 'webp', {
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
};



// Folder constants
export const FOLDERS = {
    JAWAZ: 'real-estate/jawaz',
    PROFILE: 'real-estate/profiles',
    COVER: 'real-estate/covers',
    PROPERTY: 'real-estate/properties',
};
