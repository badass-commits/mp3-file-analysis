import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { countMp3Frames } from './mp3Parser';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept MP3 files
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else if (file.originalname.toLowerCase().endsWith('.mp3')) {
      // Fallback: check file extension
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'));
    }
  },
});

// Error handling middleware
function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err.message);
  res.status(400).json({
    error: err.message || 'An error occurred processing the file',
  });
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// File upload endpoint
app.post(
  '/file-upload',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'No file uploaded. Please upload an MP3 file using the "file" field.',
        });
        return;
      }

      const buffer = req.file.buffer;
      if (buffer.length === 0) {
        res.status(400).json({
          error: 'Uploaded file is empty',
        });
        return;
      }

      // Count frames in the MP3 file
      const frameCount = countMp3Frames(buffer);

      // Return JSON response with frame count
      res.json({
        frameCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Upload endpoint: http://localhost:${PORT}/file-upload`);
});

export default app;
