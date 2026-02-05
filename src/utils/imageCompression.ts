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

