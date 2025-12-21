import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls, GLTFLoader } from 'three-stdlib';
import { FileLoader } from 'three';
import { useEditorStore } from '../editor/state/useEditorStore';
import { carModels } from '../data/carModels';
import { getGltfUrl } from '../utils/assets';
import type { Stage as StageType } from 'konva/lib/Stage';
import { 
  X, 
  RotateCcw, 
  Play, 
  Pause, 
  ZoomIn, 
  ZoomOut, 
  Move3D, 
  MousePointer2, 
  Maximize2,
  Info,
  Trash2,
  Upload,
  FlipVertical,
  RefreshCw
} from 'lucide-react';

interface ThreeViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stageRef: React.RefObject<StageType | null>;
}

export const ThreeViewer = ({ isOpen, onClose, stageRef }: ThreeViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const bodyMeshesRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  
  const textureInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [customTextureName, setCustomTextureName] = useState<string | null>(null);
  const [textureFlipY, setTextureFlipY] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [flatShading, setFlatShading] = useState(false);
  const [modelFormat, setModelFormat] = useState<'gltf' | null>(null);

  const { currentModelId, layers, baseColor } = useEditorStore();
  const currentModel = carModels.find((m) => m.id === currentModelId) || carModels[0];

  // Reset camera to initial position
  const resetCamera = useCallback(() => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.reset();
      cameraRef.current.position.set(3, 1.5, 3);
      cameraRef.current.lookAt(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (controlsRef.current) {
      const camera = cameraRef.current;
      if (camera) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.addScaledVector(direction, 0.5);
        controlsRef.current.update();
      }
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (controlsRef.current) {
      const camera = cameraRef.current;
      if (camera) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.addScaledVector(direction, -0.5);
        controlsRef.current.update();
      }
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (containerRef.current?.parentElement) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.parentElement.requestFullscreen();
      }
    }
  }, []);

  // Clear all textures (debug)
  const clearTextures = useCallback(() => {
    bodyMeshesRef.current.forEach((mesh) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.5,
        side: THREE.DoubleSide,
      });
      mesh.material = material;
    });
    setCustomTextureName(null);
    console.log('[DEBUG] Textures cleared - using gray material');
  }, []);

  // Upload custom texture (debug)
  const handleCustomTextureUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !rendererRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = textureFlipY;
        texture.anisotropy = rendererRef.current!.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        textureRef.current = texture;

        bodyMeshesRef.current.forEach((mesh) => {
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.4,
            metalness: 0.6,
            envMapIntensity: 1.0,
            side: THREE.DoubleSide,
          });
          mesh.material = material;
        });

        setCustomTextureName(file.name);
        console.log(`[DEBUG] Custom texture loaded: ${file.name} (${img.width}x${img.height}), flipY: ${textureFlipY}`);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [textureFlipY]);

  // Toggle flipY and reapply texture
  const toggleFlipY = useCallback(() => {
    setTextureFlipY(prev => {
      const newFlipY = !prev;
      if (textureRef.current) {
        textureRef.current.flipY = newFlipY;
        textureRef.current.needsUpdate = true;
        console.log(`[DEBUG] Texture flipY set to: ${newFlipY}`);
      }
      return newFlipY;
    });
  }, []);

  // Reapply canvas texture
  const reapplyCanvasTexture = useCallback(() => {
    if (!stageRef.current || !rendererRef.current) return;

    const stage = stageRef.current;
    const canvas = stage.toCanvas({ pixelRatio: 4 });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = textureFlipY;
    texture.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    textureRef.current = texture;

    bodyMeshesRef.current.forEach((mesh) => {
      // Ensure geometry has smooth normals
      if (mesh.geometry) {
        mesh.geometry.computeVertexNormals();
      }
      
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.6,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
        wireframe: wireframeMode,
        flatShading: flatShading, // Only flat if explicitly enabled via debug toggle
      });
      mesh.material = material;
    });

    setCustomTextureName(null);
    console.log(`[DEBUG] Canvas texture reapplied, flipY: ${textureFlipY}`);
  }, [stageRef, textureFlipY, wireframeMode, flatShading]);

  // Toggle wireframe mode
  const toggleWireframe = useCallback(() => {
    setWireframeMode(prev => {
      const newMode = !prev;
      bodyMeshesRef.current.forEach((mesh) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.wireframe = newMode;
          mesh.material.needsUpdate = true;
        }
      });
      console.log(`[DEBUG] Wireframe mode: ${newMode}`);
      return newMode;
    });
  }, []);

  // Toggle flat shading
  const toggleFlatShading = useCallback(() => {
    setFlatShading(prev => {
      const newMode = !prev;
      bodyMeshesRef.current.forEach((mesh) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.flatShading = newMode;
          mesh.material.needsUpdate = true;
        }
      });
      console.log(`[DEBUG] Flat shading: ${newMode}`);
      return newMode;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    setLoading(true);
    setLoadingProgress(0);
    setError(null);

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Initialize scene with gradient background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1c);
    sceneRef.current = scene;

    // Add fog for depth
    scene.fog = new THREE.Fog(0x1a1a1c, 8, 20);

    // Camera with better FOV for car viewing
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(3, 1.5, 3);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // High quality renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls for intuitive interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2 + 0.3; // Limit vertical rotation
    controls.minPolarAngle = 0.2;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.0;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lighting setup for car visualization
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Key light (main directional light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.02; // Helps reduce shadow acne artifacts
    scene.add(keyLight);

    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0xb4c6e0, 0.6);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Rim light (backlight for edge definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 5, -8);
    scene.add(rimLight);

    // Ground light (bounce light from below)
    const groundLight = new THREE.DirectionalLight(0x404040, 0.3);
    groundLight.position.set(0, -5, 0);
    scene.add(groundLight);

    // Ground plane with reflection
    const groundGeometry = new THREE.CircleGeometry(15, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1c,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for visual reference
    const gridHelper = new THREE.GridHelper(10, 20, 0x333333, 0x222222);
    gridHelper.position.y = -0.49;
    scene.add(gridHelper);

    // Helper function to apply wrap texture to meshes
    const applyWrapTexture = (object: THREE.Group, gltfMaterials?: any[]) => {
      if (!stageRef.current) return;

      const stage = stageRef.current;
      // High resolution texture (4x for crisp details)
      const canvas = stage.toCanvas({ pixelRatio: 4 });
      
      // Debug canvas size
      console.log(`[3D] Canvas texture size: ${canvas.width}x${canvas.height}`);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Canvas textures need flipY = false because canvas origin is top-left
    // and the UV coordinates in the GLTF model expect this orientation
    texture.flipY = false;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // Ensure texture wrapping is set properly
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    textureRef.current = texture;
    
    // Debug texture properties
    console.log(`[3D] Texture properties - Anisotropy: ${texture.anisotropy}, MinFilter: LinearMipmapLinear, MagFilter: Linear`);

      // Collect all meshes that should have the wrap texture applied
      // Only apply to paint/exterior materials, not glass, interior, lights, etc.
      const meshesToUpdate: THREE.Mesh[] = [];
      
      // Material names that should receive the wrap texture (from GLTF analysis)
      // Note: Include "Fade" variants which are paint materials with edge blending
      const paintMaterialNames = ['Paint', 'Exterior'];
      const excludeMaterialNames = ['Glass', 'Interior', 'Lights', 'Leather', 'Plastic', 'Chrome', 'Aluminum', 'Rubber', 'Carpet', 'Seatbelts', 'Grille', 'Chargeport', 'Plates', 'Ground', 'Mirror', 'Suede', 'Decor', 'Screen', 'Zero_Black', 'Frunk'];
      
      // Build a map of material indices to names if GLTF materials are available
      const materialIndexToName = new Map<number, string>();
      if (gltfMaterials && Array.isArray(gltfMaterials)) {
        gltfMaterials.forEach((mat: any, index: number) => {
          if (mat.name) {
            materialIndexToName.set(index, mat.name);
          }
        });
      }
      
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material;
          let shouldApplyWrap = false;
          let materialName = '';
          
          if (material) {
            // Try to get material name from various sources
            materialName = (material as any).name || 
                          (material as any).userData?.gltfMaterialName || 
                          '';
            
            // GLTFLoader may store material reference in userData
            // Try to get the original GLTF material index
            let materialIndex: number | undefined = undefined;
            
            // Check various places where GLTFLoader might store material index
            if ((material as any).userData?.gltfMaterialIndex !== undefined) {
              materialIndex = (material as any).userData.gltfMaterialIndex;
            } else if ((material as any).userData?.materialIndex !== undefined) {
              materialIndex = (material as any).userData.materialIndex;
            }
            
            // If we have material index and GLTF materials array, get the name
            if (!materialName && materialIndex !== undefined && materialIndexToName.has(materialIndex)) {
              materialName = materialIndexToName.get(materialIndex) || '';
            }
            
            // Debug logging for material properties
            if (process.env.NODE_ENV === 'development' && material instanceof THREE.MeshStandardMaterial) {
              console.log(`[3D Material] Mesh material - name: "${materialName}", index: ${materialIndex}, transparent: ${material.transparent}, opacity: ${material.opacity}`);
            }
            
            // Check if material name indicates it's paint/exterior
            const isPaintMaterial = paintMaterialNames.some(name => 
              materialName.includes(name)
            );
            
            // Check if material should be excluded (glass, interior, etc.)
            const isExcluded = excludeMaterialNames.some(name => 
              materialName.includes(name)
            );
            
            // Special handling for "Fade" materials - these are paint materials with edge blending
            const isFadePaintMaterial = (materialName.includes('ExteriorFade') || 
                                       materialName.includes('PaintFade')) && 
                                      !isExcluded;
            
            // Determine if wrap should be applied
            if (material instanceof THREE.MeshStandardMaterial || 
                material instanceof THREE.MeshPhysicalMaterial) {
              
              // Check if truly transparent (glass, windows)
              const isGlassMaterial = materialName.includes('Glass') || 
                                    (material.transparent && material.opacity < 0.5);
              
              if (isGlassMaterial) {
                // Never apply wrap to glass
                shouldApplyWrap = false;
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[3D Material] Excluding glass material: "${materialName}"`);
                }
              } else if (isFadePaintMaterial) {
                // Always apply wrap to fade paint materials regardless of transparency
                shouldApplyWrap = true;
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[3D Material] Including fade paint material: "${materialName}" (transparent=${material.transparent})`);
                }
              } else if (isPaintMaterial && !isExcluded) {
                // Standard paint materials
                shouldApplyWrap = true;
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[3D Material] Identified paint material by name: "${materialName}"`);
                }
              } else if (!materialName || materialName === 'unnamed') {
                // Fallback heuristic for unnamed materials
                const isOpaque = !material.transparent || material.opacity >= 0.9;
                const hasMetalness = material.metalness !== undefined && material.metalness > 0.3;
                const isNotTooRough = material.roughness !== undefined && material.roughness < 0.8;
                
                shouldApplyWrap = isOpaque && hasMetalness && isNotTooRough && !isExcluded;
                
                if (process.env.NODE_ENV === 'development' && shouldApplyWrap) {
                  console.log(`[3D Material] Identified paint material by properties: metalness=${material.metalness}, roughness=${material.roughness}`);
                }
              }
            }
          }
          
          if (shouldApplyWrap) {
            meshesToUpdate.push(child);
            
            // Store original material name for debugging
            child.userData.originalMaterialName = materialName;
            
            // Ensure geometry has proper normals for smooth shading
            if (child.geometry) {
              // Ensure geometry is indexed (required for proper normal computation)
              if (!child.geometry.index) {
                child.geometry = child.geometry.toNonIndexed();
              }
              
              // Compute smooth vertex normals
              // This creates smooth shading by averaging face normals at shared vertices
              child.geometry.computeVertexNormals();
              
              // Mark geometry as needing update
              child.geometry.attributes.position.needsUpdate = true;
              if (child.geometry.attributes.normal) {
                child.geometry.attributes.normal.needsUpdate = true;
              }
            }
            
            // Preserve original material properties where possible
            const originalMaterial = material instanceof THREE.MeshStandardMaterial || 
                                   material instanceof THREE.MeshPhysicalMaterial ? material : null;
            
            // Check if this is a fade material that needs transparency preserved
            const isFadeMaterial = materialName.includes('Fade');
            
            // Create high-quality car paint material with wrap texture
            const wrapMaterial = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: originalMaterial?.roughness ?? 0.4,
              metalness: originalMaterial?.metalness ?? 0.6,
              envMapIntensity: originalMaterial?.envMapIntensity ?? 1.0,
              side: originalMaterial?.side ?? THREE.DoubleSide,
              // Ensure smooth shading (not flat) - this prevents faceted appearance
              flatShading: false,
              // Preserve other important properties
              color: originalMaterial?.color ?? new THREE.Color(0xffffff),
              emissive: originalMaterial?.emissive ?? new THREE.Color(0x000000),
              emissiveIntensity: originalMaterial?.emissiveIntensity ?? 0,
              // Preserve transparency for fade materials
              transparent: isFadeMaterial && originalMaterial?.transparent ? true : false,
              opacity: isFadeMaterial && originalMaterial?.opacity !== undefined ? originalMaterial.opacity : 1.0,
              alphaTest: originalMaterial?.alphaTest ?? 0,
              // For transparent materials, ensure correct depth handling
              depthWrite: isFadeMaterial ? false : true,
              depthTest: true,
            });
            
            // Special handling for fade materials to ensure proper rendering
            if (isFadeMaterial) {
              child.renderOrder = 100; // Render after opaque objects
              console.log(`[3D] Fade material "${materialName}" - transparent: ${wrapMaterial.transparent}, opacity: ${wrapMaterial.opacity}, depthWrite: ${wrapMaterial.depthWrite}`);
            }
            
            // Ensure material updates
            wrapMaterial.needsUpdate = true;

            child.material = wrapMaterial;
          } else {
            // For non-paint materials (glass, interior, etc.), ensure they render correctly
            if (material instanceof THREE.MeshStandardMaterial || 
                material instanceof THREE.MeshPhysicalMaterial) {
              // Ensure smooth shading for all materials (prevents faceted appearance)
              material.flatShading = false;
              // Ensure material updates
              material.needsUpdate = true;
              // Ensure geometry has normals for smooth rendering
              if (child.geometry) {
                // Ensure geometry is indexed
                if (!child.geometry.index) {
                  child.geometry = child.geometry.toNonIndexed();
                }
                
                // Compute smooth vertex normals
                child.geometry.computeVertexNormals();
                
                // Mark geometry as needing update
                child.geometry.attributes.position.needsUpdate = true;
                if (child.geometry.attributes.normal) {
                  child.geometry.attributes.normal.needsUpdate = true;
                }
              }
            }
          }
          
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      bodyMeshesRef.current = meshesToUpdate;
      
      // Debug: log material identification
      const totalMeshes: THREE.Mesh[] = [];
      const meshesWithUVs: THREE.Mesh[] = [];
      const meshesWithoutUVs: THREE.Mesh[] = [];
      
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          totalMeshes.push(child);
          // Check for UV coordinates
          if (child.geometry.attributes.uv) {
            meshesWithUVs.push(child);
          } else {
            meshesWithoutUVs.push(child);
          }
        }
      });
      
      console.log(`[3D] Applied wrap texture to ${meshesToUpdate.length} of ${totalMeshes.length} total meshes`);
      console.log(`[3D] Preserved original materials for ${totalMeshes.length - meshesToUpdate.length} meshes (glass, interior, lights, etc.)`);
      console.log(`[3D] UV mapping: ${meshesWithUVs.length} meshes have UVs, ${meshesWithoutUVs.length} meshes missing UVs`);
      
      // Check if any wrap meshes are missing UVs
      const wrapMeshesWithoutUVs = meshesToUpdate.filter(mesh => !mesh.geometry.attributes.uv);
      if (wrapMeshesWithoutUVs.length > 0) {
        console.warn(`[3D] Warning: ${wrapMeshesWithoutUVs.length} wrap meshes are missing UV coordinates!`);
      }
      
      // Verify geometry and materials are correct
      let transparentCount = 0;
      let paintCount = 0;
      let fadePaintCount = 0;
      let fadeMaterialNames: string[] = [];
      
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            if (mat.transparent || mat.opacity < 0.9) {
              transparentCount++;
            }
            if (meshesToUpdate.includes(child)) {
              paintCount++;
              // Check original material name from userData
              const originalMatName = child.userData.originalMaterialName || '';
              if (originalMatName.includes('Fade')) {
                fadePaintCount++;
                fadeMaterialNames.push(originalMatName);
              }
            }
          }
        }
      });
      console.log(`[3D] Material summary: ${transparentCount} transparent (including fade), ${paintCount} paint (wrap applied), ${fadePaintCount} fade paint`);
      if (fadeMaterialNames.length > 0) {
        console.log(`[3D] Fade paint materials: ${fadeMaterialNames.join(', ')}`);
      }
      
      // Log texture information
      if (textureRef.current) {
        console.log(`[3D] Texture info - Size: ${textureRef.current.image.width}x${textureRef.current.image.height}, Anisotropy: ${textureRef.current.anisotropy}`);
      }
    };

    // Helper to center and scale model after loading
    const centerAndScaleModel = (object: THREE.Group | THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      object.scale.multiplyScalar(scale);
      object.position.sub(center.multiplyScalar(scale));
      object.position.y += 0.3; // Slight lift off ground

      scene.add(object);
      meshRef.current = object as THREE.Group;
    };

    // Load GLTF model
    const loadGLTFModel = () => {
      setLoadingProgress(10);
      
      const gltfUrl = getGltfUrl(currentModel.folderName);
      
      if (!gltfUrl) {
        console.error('[3D] No GLTF file found for model:', currentModel.folderName);
        setError('No 3D model file found');
        setLoading(false);
        return;
      }

      console.log('[3D] Loading GLTF:', gltfUrl);
      
      const gltfLoader = new GLTFLoader();
      
      // Handle /src/ paths - Vite's glob might return this format
      // If we get /src/, use it directly for both GLTF and binary/texture resolution
      let loadUrl = gltfUrl;
      
      // Set the path so textures and binary files can be resolved relative to the GLTF file
      // If URL starts with /src/, keep it for the path too
      const gltfPath = gltfUrl.substring(0, gltfUrl.lastIndexOf('/') + 1);
      gltfLoader.setPath(gltfPath);
      console.log('[3D] GLTF texture/binary path set to:', gltfPath);
      
      setLoadingProgress(20);
      
      // Try using GLTFLoader.load() directly first - it handles binary files automatically
      if (gltfUrl.startsWith('/src/')) {
        console.log('[3D] Using /src/ path - GLTFLoader will handle binary files');
        // Use GLTFLoader.load() directly - it can handle /src/ paths
        gltfLoader.load(
          gltfUrl,
          (gltf) => {
            console.log('[3D] GLTF loaded successfully', gltf);
            setLoadingProgress(80);
            setModelFormat('gltf');
            
            const model = gltf.scene;
            
            // Store GLTF materials array for material identification
            // GLTFLoader stores materials in gltf.parser.json.materials
            const gltfMaterials = (gltf as any).parser?.json?.materials || [];
            console.log(`[3D] GLTF has ${gltfMaterials.length} materials`);
            
            // Also try to get materials from the GLTF object directly
            const gltfMaterialsAlt = (gltf as any).materials || [];
            const allGltfMaterials = gltfMaterials.length > 0 ? gltfMaterials : gltfMaterialsAlt;
            
            // Log material names for debugging
            if (allGltfMaterials.length > 0) {
              console.log('[3D] GLTF Material names:', allGltfMaterials.map((m: any, i: number) => `${i}: ${m.name || 'unnamed'}`).slice(0, 10));
            }
            
            // Store material index mapping for later use
            if (allGltfMaterials.length > 0) {
              model.userData.gltfMaterials = allGltfMaterials;
            }
            
            applyWrapTexture(model as THREE.Group, allGltfMaterials);
            centerAndScaleModel(model);
            
            setLoadingProgress(100);
            setTimeout(() => setLoading(false), 300);
          },
          (progress) => {
            if (progress.total > 0) {
              setLoadingProgress(Math.round((progress.loaded / progress.total) * 60) + 20);
            }
          },
          (err) => {
            console.error('[3D] GLTFLoader.load() failed, trying FileLoader approach:', err);
            // Fall back to FileLoader if GLTFLoader.load() fails
            useFileLoaderFallback();
          }
        );
        return;
      }
      
      // Normal GLTFLoader.load() for non-/src/ paths
      gltfLoader.load(
        loadUrl,
        (gltf) => {
          console.log('[3D] GLTF loaded successfully', gltf);
          setLoadingProgress(80);
          setModelFormat('gltf');
          
          const model = gltf.scene;
          
          // Store GLTF materials array for material identification
          const gltfMaterials = (gltf as any).parser?.json?.materials || (gltf as any).materials || [];
          if (gltfMaterials.length > 0) {
            model.userData.gltfMaterials = gltfMaterials;
          }
          
          applyWrapTexture(model as THREE.Group, gltfMaterials);
          centerAndScaleModel(model);
          
          setLoadingProgress(100);
          setTimeout(() => setLoading(false), 300);
        },
        (progress) => {
          if (progress.total > 0) {
            setLoadingProgress(Math.round((progress.loaded / progress.total) * 60) + 20);
          }
        },
        (err) => {
          console.error('[3D] Failed to load GLTF:', err);
          setError('Failed to load 3D model');
          setLoading(false);
        }
      );
      
      // FileLoader fallback function
      function useFileLoaderFallback() {
        if (!gltfUrl) {
          console.error('[3D] No GLTF URL available for FileLoader fallback');
          setError('Failed to load 3D model file');
          setLoading(false);
          return;
        }
        
        // Use FileLoader to load the GLTF file content directly
        console.log('[3D] Using FileLoader fallback to load GLTF file...');
        const fileLoader = new FileLoader();
        fileLoader.setResponseType('text');
        
        // Try different URL formats to find one that works
        // Keep /src/ path for binary file resolution
        const urlAttempts = [
          gltfUrl, // Try original /src/ path first
          gltfUrl.replace(/^\/src/, ''), // Remove /src/ prefix
        ];
        
        let attemptIndex = 0;
        const tryNextUrl = () => {
          if (attemptIndex >= urlAttempts.length) {
            console.error('[3D] All URL attempts failed');
            setError('Failed to load 3D model file. Try restarting the dev server.');
            setLoading(false);
            return;
          }
          
          const attemptUrl = urlAttempts[attemptIndex];
          console.log(`[3D] FileLoader attempt ${attemptIndex + 1}: ${attemptUrl}`);
          
          fileLoader.load(
            attemptUrl,
            (response) => {
              try {
                // FileLoader with text response type returns string
                const text = typeof response === 'string' ? response : String(response);
                const json = JSON.parse(text);
                
                // GLTFLoader.parse takes (data, path, onLoad, onError)
                // Use the same path as the GLTF file for binary/texture resolution
                gltfLoader.parse(
                  json,
                  gltfPath, // This should match the GLTF file's directory
                  (gltf) => {
                    console.log('[3D] GLTF loaded successfully via FileLoader', gltf);
                    setLoadingProgress(80);
                    setModelFormat('gltf');
                    
                    const model = gltf.scene;
                    
                    // Store GLTF materials array for material identification
                    const gltfMaterials = json.materials || [];
                    console.log(`[3D] FileLoader: GLTF has ${gltfMaterials.length} materials`);
                    if (gltfMaterials.length > 0) {
                      model.userData.gltfMaterials = gltfMaterials;
                      console.log('[3D] FileLoader: Material names:', gltfMaterials.map((m: any, i: number) => `${i}: ${m.name || 'unnamed'}`).slice(0, 10));
                    }
                    
                    applyWrapTexture(model as THREE.Group, gltfMaterials);
                    centerAndScaleModel(model);
                    
                    setLoadingProgress(100);
                    setTimeout(() => setLoading(false), 300);
                  },
                  (parseErr) => {
                    console.error('[3D] Failed to parse GLTF:', parseErr);
                    attemptIndex++;
                    tryNextUrl();
                  }
                );
              } catch (err) {
                console.error('[3D] Failed to process GLTF file:', err);
                attemptIndex++;
                tryNextUrl();
              }
            },
            (progress) => {
              if (progress.total > 0) {
                setLoadingProgress(Math.round((progress.loaded / progress.total) * 60) + 20);
              }
            },
            (err) => {
              console.error(`[3D] FileLoader attempt ${attemptIndex + 1} failed:`, err);
              attemptIndex++;
              tryNextUrl();
            }
          );
        };
        
        tryNextUrl();
      }
    };
    
    loadGLTFModel();

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        resetCamera();
      } else if (e.key === ' ') {
        e.preventDefault();
        setAutoRotate(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (textureRef.current) {
        textureRef.current.dispose();
      }
      bodyMeshesRef.current = [];
    };
  }, [isOpen, currentModel.folderName, stageRef, onClose, resetCamera]);

  // Update auto-rotate when state changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update texture when layers change
  useEffect(() => {
    if (textureRef.current && stageRef.current && isOpen) {
      const stage = stageRef.current;
      const canvas = stage.toCanvas({ pixelRatio: 4 });
      textureRef.current.image = canvas;
      textureRef.current.needsUpdate = true;
    }
  }, [layers, baseColor, isOpen, stageRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[#1a1a1c] rounded-2xl shadow-2xl w-[95vw] h-[95vh] max-w-[1800px] max-h-[1000px] flex flex-col overflow-hidden border border-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tesla-red to-red-700 flex items-center justify-center">
                <Move3D className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">3D Preview</h2>
                <p className="text-xs text-white/50">{currentModel.name}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Debug tools toggle */}
            <button
              onClick={() => setShowDebugTools(!showDebugTools)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${showDebugTools ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}`}
              title="Toggle debug tools"
            >
              🧪 Debug
            </button>

            {/* Controls hint toggle */}
            <button
              onClick={() => setShowControls(!showControls)}
              className={`p-2.5 rounded-xl transition-all ${showControls ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
              title="Toggle controls help"
            >
              <Info className="w-5 h-5" />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main viewport */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1c]/95 z-10">
              <div className="relative w-24 h-24 mb-6">
                {/* Animated spinner */}
                <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                <div 
                  className="absolute inset-0 border-4 border-transparent border-t-tesla-red rounded-full animate-spin"
                  style={{ animationDuration: '1s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{loadingProgress}%</span>
                </div>
              </div>
              <p className="text-white/60 text-sm">Loading 3D model...</p>
              {/* Progress bar */}
              <div className="w-64 h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-tesla-red to-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1c]/95 z-10">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-red-400 text-lg font-medium">{error}</p>
                <p className="text-white/40 text-sm mt-2">Please try again later</p>
              </div>
            </div>
          )}

          {/* Controls help panel */}
          {showControls && !loading && !error && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-4 border border-white/10 text-sm space-y-3 animate-in slide-in-from-left duration-300">
              <div className="flex items-center gap-3 text-white/70">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <MousePointer2 className="w-4 h-4" />
                </div>
                <span>Left click + drag to <span className="text-white">rotate</span></span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="8" y="2" width="8" height="12" rx="4" />
                    <line x1="12" y1="6" x2="12" y2="10" />
                  </svg>
                </div>
                <span>Scroll to <span className="text-white">zoom</span></span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-medium">
                  RMB
                </div>
                <span>Right click + drag to <span className="text-white">pan</span></span>
              </div>
              <div className="pt-2 border-t border-white/10 text-white/50 text-xs">
                <span className="bg-white/10 px-1.5 py-0.5 rounded">Space</span> toggle rotation • 
                <span className="bg-white/10 px-1.5 py-0.5 rounded ml-1">R</span> reset view
              </div>
            </div>
          )}

          {/* Debug Tools Panel */}
          {showDebugTools && !loading && !error && (
            <div className="absolute bottom-20 left-4 bg-yellow-900/30 backdrop-blur-md rounded-xl p-4 border border-yellow-500/30 text-sm space-y-3 animate-in slide-in-from-left duration-300 w-72">
              <div className="flex items-center gap-2 text-yellow-400 font-medium border-b border-yellow-500/20 pb-2">
                <span>🧪</span>
                <span>Texture Debug Tools</span>
              </div>
              
              {/* Current texture info */}
              <div className="text-xs text-white/60 bg-black/30 rounded-lg p-2 space-y-1">
                <div>Model Format: <span className={modelFormat === 'gltf' ? 'text-green-400 font-bold' : 'text-yellow-400'}>{modelFormat?.toUpperCase() || 'Loading...'}</span></div>
                <div>Texture: <span className="text-white">{customTextureName || 'Canvas'}</span></div>
                <div>FlipY: <span className={textureFlipY ? 'text-green-400' : 'text-red-400'}>{textureFlipY ? 'true' : 'false'}</span></div>
                <div>Wireframe: <span className={wireframeMode ? 'text-green-400' : 'text-red-400'}>{wireframeMode ? 'ON' : 'OFF'}</span></div>
                <div>Flat Shading: <span className={flatShading ? 'text-green-400' : 'text-red-400'}>{flatShading ? 'ON' : 'OFF'}</span></div>
                <div>Meshes: <span className="text-white">{bodyMeshesRef.current.length}</span></div>
              </div>

              {/* Toggle FlipY */}
              <button
                onClick={toggleFlipY}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
              >
                <FlipVertical className="w-4 h-4" />
                <span>Toggle FlipY ({textureFlipY ? 'ON' : 'OFF'})</span>
              </button>

              {/* Toggle Wireframe */}
              <button
                onClick={toggleWireframe}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${wireframeMode ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50' : 'bg-cyan-500/20 text-cyan-300/70 border-cyan-500/30'} border`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Wireframe ({wireframeMode ? 'ON' : 'OFF'})</span>
              </button>

              {/* Toggle Flat Shading */}
              <button
                onClick={toggleFlatShading}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${flatShading ? 'bg-orange-500/30 text-orange-300 border-orange-500/50' : 'bg-orange-500/20 text-orange-300/70 border-orange-500/30'} border`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
                </svg>
                <span>Flat Shading ({flatShading ? 'ON' : 'OFF'})</span>
              </button>

              {/* Reapply Canvas Texture */}
              <button
                onClick={reapplyCanvasTexture}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reapply Canvas Texture</span>
              </button>

              {/* Upload Custom Texture */}
              <input
                ref={textureInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomTextureUpload}
                className="hidden"
                aria-label="Upload custom texture image"
                title="Upload custom texture image"
              />
              <button
                onClick={() => textureInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Custom Texture</span>
              </button>

              {/* Clear Textures */}
              <button
                onClick={clearTextures}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Textures</span>
              </button>

              {/* Console hint */}
              <div className="text-xs text-white/40 pt-2 border-t border-yellow-500/20 space-y-1">
                <div>💡 Check browser console for debug logs</div>
                {modelFormat === 'gltf' && (
                  <div className="text-green-400/70">✓ GLTF model loaded (optimized format)</div>
                )}
              </div>
            </div>
          )}

          {/* Floating controls */}
          {!loading && !error && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-2xl p-2 border border-white/10 animate-in slide-in-from-bottom duration-300">
              {/* Auto rotate toggle */}
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                  autoRotate 
                    ? 'bg-tesla-red text-white' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
                title={autoRotate ? 'Pause rotation (Space)' : 'Resume rotation (Space)'}
              >
                {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="text-sm font-medium">{autoRotate ? 'Pause' : 'Rotate'}</span>
              </button>

              <div className="w-px h-8 bg-white/20" />

              {/* Zoom controls */}
              <button
                onClick={zoomIn}
                className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={zoomOut}
                className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>

              <div className="w-px h-8 bg-white/20" />

              {/* Reset view */}
              <button
                onClick={resetCamera}
                className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
                title="Reset view (R)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
                title="Toggle fullscreen"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
              
              {/* Debug Tools - only in development */}
              {process.env.NODE_ENV === 'development' && (
                <>
                  <div className="w-px h-8 bg-white/20" />
                  
                  {/* UV Debug */}
                  <button
                    onClick={() => {
                      if (!sceneRef.current || !bodyMeshesRef.current) return;
                      
                      // Toggle UV visualization
                      const showUVs = !(window as any).__showUVDebug;
                      (window as any).__showUVDebug = showUVs;
                      
                      bodyMeshesRef.current.forEach(mesh => {
                        if (mesh.material instanceof THREE.MeshStandardMaterial) {
                          if (showUVs) {
                            // Create UV debug texture
                            const uvCanvas = document.createElement('canvas');
                            uvCanvas.width = 1024;
                            uvCanvas.height = 1024;
                            const ctx = uvCanvas.getContext('2d')!;
                            
                            // Create UV grid pattern
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, 1024, 1024);
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2;
                            
                            // Draw grid
                            for (let i = 0; i <= 10; i++) {
                              const pos = (i / 10) * 1024;
                              ctx.beginPath();
                              ctx.moveTo(pos, 0);
                              ctx.lineTo(pos, 1024);
                              ctx.stroke();
                              ctx.beginPath();
                              ctx.moveTo(0, pos);
                              ctx.lineTo(1024, pos);
                              ctx.stroke();
                            }
                            
                            // Add labels
                            ctx.fillStyle = 'red';
                            ctx.font = '48px Arial';
                            ctx.fillText('U→', 20, 60);
                            ctx.save();
                            ctx.rotate(-Math.PI/2);
                            ctx.fillText('V→', -1000, 60);
                            ctx.restore();
                            
                            const uvTexture = new THREE.CanvasTexture(uvCanvas);
                            uvTexture.colorSpace = THREE.SRGBColorSpace;
                            mesh.material.map = uvTexture;
                            mesh.material.needsUpdate = true;
                          } else {
                            // Restore wrap texture
                            mesh.material.map = textureRef.current;
                            mesh.material.needsUpdate = true;
                          }
                        }
                      });
                      
                      console.log(`[3D Debug] UV visualization: ${showUVs ? 'ON' : 'OFF'}`);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-all text-sm font-medium"
                    title="Toggle UV coordinate visualization"
                  >
                    UV Debug
                  </button>
                  
                  {/* Material Filter */}
                  <button
                    onClick={() => {
                      if (!sceneRef.current || !bodyMeshesRef.current || !meshRef.current) return;
                      
                      // Cycle through material display modes
                      const mode = ((window as any).__materialDebugMode || 0) + 1;
                      (window as any).__materialDebugMode = mode % 4;
                      
                      const modes = ['All', 'Opaque Only', 'Fade Only', 'Non-Paint'];
                      console.log(`[3D Debug] Material filter: ${modes[mode % 4]}`);
                      
                      // Reset all mesh visibility
                      meshRef.current.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                          const matName = child.userData.originalMaterialName || '';
                          const isWrapMesh = bodyMeshesRef.current?.includes(child);
                          const isFadeMaterial = matName.includes('Fade');
                          
                          switch (mode % 4) {
                            case 0: // All
                              child.visible = true;
                              break;
                            case 1: // Opaque paint only
                              child.visible = isWrapMesh && !isFadeMaterial;
                              break;
                            case 2: // Fade paint only
                              child.visible = isWrapMesh && isFadeMaterial;
                              break;
                            case 3: // Non-paint only
                              child.visible = !isWrapMesh;
                              break;
                          }
                        }
                      });
                    }}
                    className="px-3 py-2.5 rounded-xl bg-green-600/20 text-green-300 hover:bg-green-600/30 transition-all text-sm font-medium"
                    title="Cycle through material visibility modes"
                  >
                    Filter
                  </button>
                  
                  {/* Solid Color Test */}
                  <button
                    onClick={() => {
                      if (!bodyMeshesRef.current) return;
                      
                      const useSolid = !(window as any).__solidColorDebug;
                      (window as any).__solidColorDebug = useSolid;
                      
                      bodyMeshesRef.current.forEach((mesh, index) => {
                        if (mesh.material instanceof THREE.MeshStandardMaterial) {
                          if (useSolid) {
                            // Apply solid color based on material type
                            const matName = mesh.userData.originalMaterialName || '';
                            const isFade = matName.includes('Fade');
                            mesh.material.map = null;
                            mesh.material.color = isFade 
                              ? new THREE.Color(0xff0000) // Red for fade materials
                              : new THREE.Color(0x00ff00); // Green for regular paint
                            mesh.material.needsUpdate = true;
                          } else {
                            // Restore texture and white color
                            mesh.material.map = textureRef.current;
                            mesh.material.color = new THREE.Color(0xffffff);
                            mesh.material.needsUpdate = true;
                          }
                        }
                      });
                      
                      console.log(`[3D Debug] Solid color test: ${useSolid ? 'ON (Red=Fade, Green=Regular)' : 'OFF'}`);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 transition-all text-sm font-medium"
                    title="Toggle solid color test mode"
                  >
                    Solid
                  </button>
                </>
              )}
            </div>
          )}

          {/* Model info badge */}
          {!loading && !error && (
            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 animate-in slide-in-from-right duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white/70 text-sm">Live Preview</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
