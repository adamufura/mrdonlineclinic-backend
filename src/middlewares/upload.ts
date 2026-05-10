import multer from 'multer';

const memory = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export const uploadSingleFile = multer({
  storage: memory,
  limits: { fileSize: 15 * 1024 * 1024 },
}).single('file');
