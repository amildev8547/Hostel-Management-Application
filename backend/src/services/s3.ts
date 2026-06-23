import fs from 'fs';
import path from 'path';

// If AWS S3 is desired, developers can install: npm install @aws-sdk/client-s3
// For V1, we implement a unified interface that supports S3 upload or local disk fallback.
// This allows HostelHub to run immediately without requiring S3 config.

const uploadsDir = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export interface UploadedFile {
  url: string;
  key: string;
  bucket: string;
}

export async function uploadFile(
  base64String: string,
  fileName: string,
  fileType: string
): Promise<UploadedFile> {
  const isAwsConfigured =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_ACCESS_KEY_ID !== 'mock_aws_access_key' &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_SECRET_ACCESS_KEY !== 'mock_aws_secret_key';

  const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const uniqueFileName = `${Date.now()}-${fileName}`;

  if (isAwsConfigured) {
    try {
      // Lazy load AWS SDK to prevent import errors if not installed
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const bucketName = process.env.AWS_S3_BUCKET_NAME || 'hostelhub-documents';
      const key = `${fileType}/${uniqueFileName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: 'image/jpeg', // Default or parsed from base64
          ACL: 'public-read',
        })
      );

      const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      return { url, key, bucket: bucketName };
    } catch (error) {
      console.error('AWS S3 upload failed, falling back to local storage:', error);
    }
  }

  // Fallback: Local disk storage
  const filePath = path.join(uploadsDir, uniqueFileName);
  fs.writeFileSync(filePath, buffer);

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const url = `${backendUrl}/uploads/${uniqueFileName}`;
  const key = `local/${fileType}/${uniqueFileName}`;

  return {
    url,
    key,
    bucket: 'local-disk',
  };
}
