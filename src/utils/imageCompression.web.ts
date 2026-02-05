/**
 * Web version - compression is skipped
 * expo-image-manipulator doesn't work on web
 */
const blobToDataUrl = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
};

export async function compressImage(uri: string, options?: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compress?: boolean;
}): Promise<string> {
  // On web, ImagePicker quality settings handle compression
  // Convert blob URLs to data URLs so they survive refresh
  console.log('ImageCompression: Skipping compression on web (using ImagePicker quality settings)');
  if (!uri) return uri;
  if (uri.startsWith('data:')) return uri;
  if (uri.startsWith('blob:')) {
    try {
      return await blobToDataUrl(uri);
    } catch (error) {
      console.warn('ImageCompression: Failed to convert blob to data URL, using original URI', error);
      return uri;
    }
  }
  return uri;
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


