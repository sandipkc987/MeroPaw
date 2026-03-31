import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Conditionally import image-manipulator (not available on web)
// Check platform at top level to avoid Metro bundling it for web
let ImageManipulator: any = null;

if (Platform.OS !== 'web') {
  try {
    ImageManipulator = require('expo-image-manipulator');
  } catch (error) {
    console.warn('ImageCompression: expo-image-manipulator not available', error);
  }
}

/**
 * Compress and resize image like Instagram/Facebook
 * - Max width: 1080px (Instagram standard)
 * - Quality: 0.75-0.85 (good balance between quality and size)
 * - Maintains aspect ratio
 * 
 * This reduces file size dramatically while maintaining good visual quality
 * 
 * NOTE: On web, compression is skipped (returns original URI)
 * because expo-image-manipulator requires native modules
 */
export async function compressImage(uri: string, options?: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compress?: boolean;
}): Promise<string> {
  // Skip compression on web - ImagePicker quality settings are used instead
  if (Platform.OS === 'web' || !ImageManipulator) {
    console.log('ImageCompression: Skipping compression on web or if manipulator unavailable');
    return uri;
  }

  try {
    const {
      maxWidth = 1080, // Instagram standard for square images
      maxHeight = 1080,
      quality = 0.75, // Balance between quality and size (75% quality)
      compress = true,
    } = options || {};

    // Get image info first (without manipulation)
    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });

    // Calculate resize dimensions while maintaining aspect ratio
    let resizeWidth = imageInfo.width;
    let resizeHeight = imageInfo.height;

    if (resizeWidth > maxWidth || resizeHeight > maxHeight) {
      const widthRatio = maxWidth / resizeWidth;
      const heightRatio = maxHeight / resizeHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      resizeWidth = Math.round(resizeWidth * ratio);
      resizeHeight = Math.round(resizeHeight * ratio);
    }

    // Build actions array - resize if needed
    const actions: any[] = [];
    
    if (resizeWidth !== imageInfo.width || resizeHeight !== imageInfo.height) {
      actions.push({ resize: { width: resizeWidth, height: resizeHeight } });
    }

    // If no resizing needed and compression disabled, return original
    if (actions.length === 0 && !compress) {
      return uri;
    }

    // Manipulate the image (resize and/or compress)
    // If no resize needed but compression requested, still need to manipulate for compression
    const manipulateOptions: any = {
      compress: compress ? quality : 1, // Quality value (0-1), 1 = no compression
      format: ImageManipulator.SaveFormat.JPEG,
    };

    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      actions.length > 0 ? actions : [], // Empty array if no resize, but still compress
      manipulateOptions
    );

    // Get file size for logging
    const fileInfo = await FileSystem.getInfoAsync(manipulatedImage.uri);
    const originalFileInfo = await FileSystem.getInfoAsync(uri);
    
    const originalSize = (originalFileInfo as any).size || 0;
    const compressedSize = (fileInfo as any).size || 0;
    const reduction = originalSize > 0 
      ? ((1 - compressedSize / originalSize) * 100).toFixed(1) 
      : 0;

    console.log('ImageCompression: Compressed image', {
      originalSize: `${(originalSize / 1024).toFixed(1)} KB`,
      compressedSize: `${(compressedSize / 1024).toFixed(1)} KB`,
      reduction: `${reduction}%`,
      dimensions: `${resizeWidth}x${resizeHeight}`,
      quality,
    });

    return manipulatedImage.uri;
  } catch (error) {
    console.error('ImageCompression: Failed to compress image', error);
    // Return original URI if compression fails
    return uri;
  }
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  uris: string[],
  options?: Parameters<typeof compressImage>[1]
): Promise<string[]> {
  return Promise.all(uris.map(uri => compressImage(uri, options)));
}

const MAX_CAPTION_IMAGE_SIZE = 768;

/**
 * Resize image to max 768px (longest side) and return base64.
 * Used for caption generation only - keeps Gemini token cost at ~258 tokens per image.
 * On web or when ImageManipulator is unavailable, returns original image as base64.
 */
export async function resizeImageForCaption(uri: string): Promise<{ base64: string; mimeType: string }> {
  const mimeType = uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

  const getBase64FromUri = async (): Promise<string> => {
    if (uri.startsWith('data:')) return uri.split(',')[1];
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const res = await fetch(uri);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  };

  if (Platform.OS === 'web' || !ImageManipulator) {
    const base64 = await getBase64FromUri();
    return { base64, mimeType };
  }

  try {
    // Only resize when we have a file path (picker on device)
    if (!uri.startsWith('file://') && !uri.startsWith('/')) {
      const base64 = await getBase64FromUri();
      return { base64, mimeType };
    }

    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    let resizeWidth = imageInfo.width;
    let resizeHeight = imageInfo.height;

    if (resizeWidth > MAX_CAPTION_IMAGE_SIZE || resizeHeight > MAX_CAPTION_IMAGE_SIZE) {
      const ratio = Math.min(
        MAX_CAPTION_IMAGE_SIZE / resizeWidth,
        MAX_CAPTION_IMAGE_SIZE / resizeHeight
      );
      resizeWidth = Math.round(resizeWidth * ratio);
      resizeHeight = Math.round(resizeHeight * ratio);
    }

    const actions: any[] = [];
    if (resizeWidth !== imageInfo.width || resizeHeight !== imageInfo.height) {
      actions.push({ resize: { width: resizeWidth, height: resizeHeight } });
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 }
    );

    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { base64, mimeType: 'image/jpeg' };
  } catch (error) {
    console.warn('resizeImageForCaption failed, using original', error);
    const base64 = await getBase64FromUri();
    return { base64, mimeType };
  }
}

