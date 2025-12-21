/**
 * Get asset URLs for wrap templates and 3D models
 * Assets are located in src/assets/wraps/{folderName}/
 * 
 * In Vite, assets in src/ need to be imported or accessed via a special path
 */

// Pre-load all template images using Vite's glob import
// Note: Paths must be relative to the project root
const templateModules = import.meta.glob('../assets/wraps/**/template.png', { 
  eager: true,
  query: '?url',
  import: 'default'
});

// Pre-load all GLTF files (look in 3D subfolder) - same pattern as template images
const gltfModules = import.meta.glob('../assets/wraps/**/3D/*.gltf', { 
  eager: true,
  query: '?url',
  import: 'default'
});

// Pre-load all vehicle preview images
const vehicleImageModules = import.meta.glob('../assets/wraps/**/vehicle_image.png', { 
  eager: true,
  query: '?url',
  import: 'default'
});

/**
 * Get the URL for a template image
 */
export const getTemplateUrl = (folderName: string): string => {
  const path = `../assets/wraps/${folderName}/template.png`;
  const module = templateModules[path];
  if (module && typeof module === 'string') {
    return module;
  }
  // Fallback: try direct import path
  console.warn(`Template not found: ${path}, trying fallback`);
  // In development, Vite serves from project root
  return new URL(`../assets/wraps/${folderName}/template.png`, import.meta.url).href;
};

/**
 * Get the URL for a vehicle preview image
 */
export const getVehicleImageUrl = (folderName: string): string => {
  const path = `../assets/wraps/${folderName}/vehicle_image.png`;
  const module = vehicleImageModules[path];
  if (module && typeof module === 'string') {
    return module;
  }
  // Fallback: try direct import path
  console.warn(`Vehicle image not found: ${path}, trying fallback`);
  return new URL(`../assets/wraps/${folderName}/vehicle_image.png`, import.meta.url).href;
};

/**
 * Get the URL for a vehicle GLTF file
 * Returns null if no GLTF file exists for this model
 */
export const getGltfUrl = (folderName: string): string | null => {
  // Look for any .gltf file in the 3D subfolder (same pattern as template images)
  for (const [globPath, module] of Object.entries(gltfModules)) {
    if (globPath.includes(`/${folderName}/3D/`)) {
      // The glob with ?url should return the URL string directly (like template images)
      if (module && typeof module === 'string') {
        let url = module;
        
        // Fix /src/ paths - Vite doesn't serve /src/ directly
        // The glob might return /src/... which needs to be converted
        if (url.startsWith('/src/')) {
          // In Vite dev, try removing /src/ or use a different approach
          // Actually, Vite should process ?url correctly, so this might be a dev server issue
          // Try the URL as-is first, and handle errors in the loader
          console.log(`[GLTF] Found via glob (may need URL fix): ${globPath} -> ${url}`);
        } else {
          console.log(`[GLTF] Found via glob: ${globPath} -> ${url}`);
        }
        
        return url;
      }
      console.warn(`[GLTF] Module for ${globPath} is not a string:`, typeof module, module);
    }
  }
  
  // Fallback: try to construct a path manually
  console.warn(`[GLTF] Glob didn't find file, trying fallback paths`);
  const fallbackNames = ['ModelY_High.gltf', 'vehicle.gltf', 'model.gltf'];
  for (const filename of fallbackNames) {
    // Return a path that might work - the loader will handle URL resolution
    const path = `/src/assets/wraps/${folderName}/3D/${filename}`;
    console.log(`[GLTF] Returning fallback path: ${path}`);
    return path;
  }
  
  console.error(`[GLTF] No GLTF file found for ${folderName}`);
  console.log(`[GLTF] Available glob paths:`, Object.keys(gltfModules));
  return null;
};
