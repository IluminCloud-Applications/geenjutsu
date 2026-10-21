export interface AndroidDeviceSpec {
  id: string;
  brand: 'Samsung' | 'Google' | 'Xiaomi' | 'Motorola' | 'OnePlus' | 'Asus' | string;
  name: string; // e.g. "Galaxy S24 Ultra"
  model: string; // e.g. "SM-S928B"
  device: string; // e.g. "e3q"
  board: string; // e.g. "kalama"
  fingerprint: string; // Real verified build fingerprint
  securityPatch: string; // e.g. "2024-04-01"
  androidVersion: string; // "12.0", "13.0", "14.0", "11.0"
  resolution: string; // e.g. "1080x2340"
  width: number;
  height: number;
  dpi: number; // e.g. 420
  abi: string; // "x86_64,arm64-v8a"
  gpu: string; // "Adreno 750"
  isFavorite?: boolean;
}

export type BrandFilter = 'all' | 'Samsung' | 'Google' | 'Xiaomi' | 'Motorola' | 'OnePlus';
