import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export function uploadBuffer(buffer, { folder, resource_type = 'auto', filename } = {}) {
  const cld = getCloudinary();
  const targetFolder = [process.env.CLOUDINARY_FOLDER || 'student-loan', folder]
    .filter(Boolean)
    .join('/');
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type,
        use_filename: !!filename,
        unique_filename: true,
        filename_override: filename,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

export async function destroyAsset(publicId, resourceType = 'auto') {
  if (!publicId) return;
  try {
    await getCloudinary().uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.warn('[cloudinary] destroy failed', publicId, e.message);
  }
}
