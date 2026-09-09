import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export interface UploadedFile {
  url: string;
  key: string;
  bucket: string;
}

const MAX_ADMISSION_IMAGE_BYTES = 5 * 1024 * 1024;

function isSupportedImage(buffer: Buffer) {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

export async function uploadFile(
  base64String: string,
  fileName: string,
  fileType: string,
  requestBaseUrl?: string
): Promise<UploadedFile> {
  const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'mock_cloud_name' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_ADMISSION_IMAGE_BYTES || !isSupportedImage(buffer)) {
    throw new Error('Invalid or unsupported image upload');
  }
  const uniqueFileName = `${Date.now()}-${fileName}`;

  if (isCloudinaryConfigured) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      // Cloudinary accepts base64 data URI format directly!
      const dataUri = `data:image/jpeg;base64,${cleanBase64}`;
      
      const response = await cloudinary.uploader.upload(dataUri, {
        folder: `hostelhub/${fileType}`,
        public_id: path.parse(fileName).name + '-' + Date.now(),
      });

      return {
        url: response.secure_url,
        key: response.public_id,
        bucket: response.folder || 'hostelhub',
      };
    } catch (error) {
      console.error('Cloudinary upload failed, falling back to local storage:', error);
    }
  }

  // Fallback: Local disk storage
  const filePath = path.join(uploadsDir, uniqueFileName);
  fs.writeFileSync(filePath, buffer);

  // Prefer the host the client actually used to reach this server (LAN IP, tunnel domain,
  // production domain) over a static env var, so the URL resolves for that same client later.
  const backendUrl = requestBaseUrl || process.env.BACKEND_URL || 'http://localhost:5000';
  const url = `${backendUrl}/uploads/${uniqueFileName}`;
  const key = `local/${fileType}/${uniqueFileName}`;

  return {
    url,
    key,
    bucket: 'local-disk',
  };
}

export async function deleteUploadedFile(key: string, bucket: string) {
  if (bucket === 'local-disk') {
    const fileName = path.basename(key);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    const filePath = path.resolve(uploadsDir, fileName);
    if (path.dirname(filePath) !== resolvedUploadsDir) {
      throw new Error('Refusing to remove a file outside the uploads directory');
    }
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  await cloudinary.uploader.destroy(key, { resource_type: 'image', invalidate: true });
}
