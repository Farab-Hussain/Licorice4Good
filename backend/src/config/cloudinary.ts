import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ,
  api_key: process.env.CLOUDINARY_API_KEY ,
  api_secret: process.env.CLOUDINARY_API_SECRET ,
  secure: true,
});

export default cloudinary;

// Maximum file size before compression (10MB - Cloudinary free plan limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Helper function to compress image if needed
const compressImageIfNeeded = async (
  file: Express.Multer.File
): Promise<Buffer> => {
  const fileSize = file.buffer.length;
  console.log(`Original file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  // If file is already under limit, return as-is
  if (fileSize <= MAX_FILE_SIZE) {
    console.log('File size is acceptable, no compression needed');
    return file.buffer;
  }

  console.log('File size exceeds limit, compressing image...');
  
  try {
    // Check if file is a valid image format that sharp can process
    const metadata = await sharp(file.buffer).metadata();
    const originalFormat = metadata.format?.toLowerCase();
    console.log(`Image format: ${originalFormat}, dimensions: ${metadata.width}x${metadata.height}, hasAlpha: ${metadata.hasAlpha}`);

    // Determine if image has transparency (PNG, WebP with alpha, etc.)
    const hasTransparency = metadata.hasAlpha === true;
    const isPNG = originalFormat === 'png';
    const isJPEG = originalFormat === 'jpeg' || originalFormat === 'jpg';
    const isWebP = originalFormat === 'webp';

    // Create base sharp instance with resize
    const createSharpInstance = (maxSize: number) => {
      let instance = sharp(file.buffer).resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Preserve format and transparency
      if (isPNG || (isWebP && hasTransparency)) {
        // For PNG or transparent WebP, keep as PNG to preserve transparency
        return instance.png({ 
          quality: 90, 
          compressionLevel: 9,
          adaptiveFiltering: true,
        });
      } else if (isJPEG) {
        // For JPEG, keep as JPEG
        return instance.jpeg({ quality: 85, mozjpeg: true });
      } else if (isWebP) {
        // For non-transparent WebP, keep as WebP
        return instance.webp({ quality: 85 });
      } else {
        // For other formats, convert to PNG if has transparency, otherwise JPEG
        if (hasTransparency) {
          return instance.png({ 
            quality: 90, 
            compressionLevel: 9,
            adaptiveFiltering: true,
          });
        } else {
          return instance.jpeg({ quality: 85, mozjpeg: true });
        }
      }
    };

    // Try progressive compression levels
    let compressedBuffer: Buffer;
    let compressedSize: number;

    // Level 1: Resize to 2000x2000
    console.log('Applying compression level 1 (2000x2000)...');
    compressedBuffer = await createSharpInstance(2000).toBuffer();
    compressedSize = compressedBuffer.length;
    console.log(`Compressed file size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${originalFormat})`);
    console.log(`Size reduction: ${((1 - compressedSize / fileSize) * 100).toFixed(1)}%`);

    // Level 2: If still too large, resize to 1500x1500 with lower quality
    if (compressedSize > MAX_FILE_SIZE) {
      console.log('File still too large, applying compression level 2 (1500x1500)...');
      if (isPNG || (isWebP && hasTransparency)) {
        compressedBuffer = await sharp(file.buffer)
          .resize(1500, 1500, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png({ 
            quality: 85, 
            compressionLevel: 9,
            adaptiveFiltering: true,
          })
          .toBuffer();
      } else if (isJPEG) {
        compressedBuffer = await sharp(file.buffer)
          .resize(1500, 1500, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 75, mozjpeg: true })
          .toBuffer();
      } else {
        compressedBuffer = await createSharpInstance(1500).toBuffer();
      }
      compressedSize = compressedBuffer.length;
      console.log(`Aggressively compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${originalFormat})`);

      // Level 3: If still too large, resize to 1200x1200 with maximum compression
      if (compressedSize > MAX_FILE_SIZE) {
        console.log('File still too large, applying compression level 3 (1200x1200)...');
        if (isPNG || (isWebP && hasTransparency)) {
          compressedBuffer = await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .png({ 
              quality: 80, 
              compressionLevel: 9,
              adaptiveFiltering: true,
            })
            .toBuffer();
        } else if (isJPEG) {
          compressedBuffer = await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 65, mozjpeg: true })
            .toBuffer();
        } else {
          compressedBuffer = await createSharpInstance(1200).toBuffer();
        }
        compressedSize = compressedBuffer.length;
        console.log(`Maximum compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${originalFormat})`);

        if (compressedSize > MAX_FILE_SIZE) {
          throw new Error(
            `Image is too large even after maximum compression (${(compressedSize / 1024 / 1024).toFixed(2)}MB). Please use an image smaller than 10MB or compress it before uploading.`
          );
        }
      }
    }

    console.log(`Final compressed image: ${(compressedSize / 1024 / 1024).toFixed(2)} MB, format preserved: ${originalFormat}`);
    return compressedBuffer;
  } catch (error: any) {
    // If sharp fails (e.g., not an image or compression error), handle appropriately
    if (error.message && error.message.includes('too large')) {
      throw error;
    }
    // If it's a sharp processing error, try to return original (but this might still fail at Cloudinary)
    if (error.message && (error.message.includes('Input') || error.message.includes('unsupported'))) {
      console.warn('Image processing failed, file may not be a valid image:', error.message);
      // Still try to upload original - Cloudinary might handle it
      return file.buffer;
    }
    console.warn('Image compression failed, using original:', error.message);
    return file.buffer;
  }
};

// Helper function to upload image to Cloudinary
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = 'products'
): Promise<{ url: string; public_id: string }> => {
  try {
    // Compress image if needed before uploading
    const processedBuffer = await compressImageIfNeeded(file);

    // Detect format from processed buffer to preserve original format
    let detectedFormat: string | undefined;
    try {
      const metadata = await sharp(processedBuffer).metadata();
      detectedFormat = metadata.format?.toLowerCase();
      console.log(`Detected format after compression: ${detectedFormat}`);
    } catch (err) {
      console.warn('Could not detect format, using default settings');
    }

    return new Promise((resolve, reject) => {
      // Upload settings - preserve original format, no forced conversion
      const uploadOptions: any = {
        folder: `licrorice/${folder}`,
        resource_type: 'image',
        // Don't apply transformations that would convert format
        // Cloudinary will store the image in the format we upload
      };

      // Only add format-specific options if we detected a format
      // This ensures PNG stays PNG and JPEG stays JPEG
      if (detectedFormat === 'png') {
        // For PNG, explicitly preserve PNG format to maintain transparency
        uploadOptions.format = 'png';
      } else if (detectedFormat === 'jpeg' || detectedFormat === 'jpg') {
        // For JPEG, explicitly preserve JPEG format
        uploadOptions.format = 'jpg';
      }
      // For other formats, let Cloudinary handle it

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            // Provide more detailed error messages
            if (error.http_code === 400 && error.message?.includes('File size too large')) {
              reject(new Error(
                'Image file is too large (maximum 10MB). Please compress the image or use a smaller file.'
              ));
            } else {
              reject(error);
            }
          } else if (result) {
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Pipe processed buffer to upload stream
      uploadStream.end(processedBuffer);
    });
  } catch (error: any) {
    // Re-throw with better error message
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to process image: ${error.message || 'Unknown error'}`);
  }
};

// Helper function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};




