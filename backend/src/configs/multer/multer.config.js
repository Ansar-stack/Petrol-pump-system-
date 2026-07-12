import multer from 'multer';
import { uploadImage, uploadPropertyImage, FOLDERS } from '../../utils/cloudinary.util.js';

const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
    if (imageMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
};

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});

const getUploadOptions = (fieldname) => {
    switch (fieldname) {
        case 'jawazImages':  return { folder: FOLDERS.JAWAZ,    type: 'upload' };
        case 'profilePhoto': return { folder: FOLDERS.PROFILE,  type: 'upload' };
        case 'coverPhoto':   return { folder: FOLDERS.COVER,    type: 'upload' };
        case 'propertyImages': return { folder: FOLDERS.PROPERTY, type: 'upload' };
        case 'mapImage':       return { folder: 'real-estate/maps', type: 'upload' };
        default:             return { folder: 'real-estate/others', type: 'upload' };
    }
};

export const processUploadedImages = async (req, res, next) => {
    if (!req.files && !req.file) return next();

    try {
        const fileGroups = [];
        if (req.files) {
            for (const fieldname of Object.keys(req.files)) {
                fileGroups.push({ fieldname, files: req.files[fieldname] });
            }
        }
        if (req.file) {
            fileGroups.push({ fieldname: req.file.fieldname, files: [req.file] });
        }

        // Upload all files in parallel across all groups
        await Promise.all(
            fileGroups.flatMap(({ fieldname, files }) => {
                const { folder, type } = getUploadOptions(fieldname);
                return files.map(async (file) => {
                    const uploader = fieldname === 'propertyImages' ? uploadPropertyImage : uploadImage;
                    const result = await uploader(file.buffer, folder, type);
                    file.path = result.secure_url;
                    file.public_id = result.public_id;
                });
            })
        );

        next();
    } catch (error) {
        next(error);
    }
};
