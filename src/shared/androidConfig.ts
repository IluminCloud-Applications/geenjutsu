export interface AndroidDeviceIdentity {
  serialNo: string;
  androidId: string;
  imei1: string;
  imei2: string;
  macAddress: string;
  imsi: string;
  iccid: string;
  phoneNum: string;
  wifiBssid: string;
  wifiSsid: string;
}

export const ANDROID_STEALTH_CONFIG = {
  // Imagem oficial no GitHub Container Registry (GHCR)
  REMOTE_IMAGE: 'ghcr.io/ilumincloud-applications/geenjutsu-android:1.0',
  REMOTE_IMAGE_LATEST: 'ghcr.io/ilumincloud-applications/geenjutsu-android:latest',
  // Imagem local construída
  LOCAL_IMAGE: 'geenjutsu/android12-camoufox:latest',

  // Especificações nativas do Samsung Galaxy S22 5G (SM-S901B)
  DEVICE: {
    id: 'samsung-s22-stealth',
    brand: 'Samsung',
    model: 'SM-S901B',
    name: 'Galaxy S22 5G',
    device: 'r0s',
    board: 'exynos2200',
    hardware: 'exynos2200',
    resolution: '1080x2340',
    width: 1080,
    height: 2340,
    dpi: 420,
    fps: 60,
    androidVersion: '12',
    fingerprint: 'samsung/r0sxxx/r0s:12/SP1A.210812.016/S901BXXU1AVA7:user/release-keys',
    securityPatch: '2023-08-01',
    abi: 'arm64-v8a,armeabi-v7a,armeabi',
    gpu: 'Samsung Xclipse 920',
  }
};

/**
 * Gera um dígito verificador Luhn válido para um prefixo TAC de 14 dígitos
 */
export function generateLuhnImei(tac8: string = '35407215'): string {
  const digits: number[] = [];
  for (let i = 0; i < 8; i++) {
    digits.push(parseInt(tac8[i], 10));
  }
  for (let i = 8; i < 14; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  digits.push(check);
  return digits.join('');
}

/**
 * Gera um endereço MAC autêntico Samsung (OUI A8:7C:01)
 */
export function generateSamsungMac(seed?: string): string {
  if (seed) {
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < seed.length; i++) {
      h1 = (h1 * 31 + seed.charCodeAt(i)) >>> 0;
      h2 = (h2 * 17 + seed.charCodeAt(i)) >>> 0;
    }
    const b4 = (h1 & 0xff).toString(16).padStart(2, '0');
    const b5 = ((h1 >> 8) & 0xff).toString(16).padStart(2, '0');
    const b6 = (h2 & 0xff).toString(16).padStart(2, '0');
    return `a8:7c:01:${b4}:${b5}:${b6}`.toLowerCase();
  }
  const byte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `a8:7c:01:${byte()}:${byte()}:${byte()}`.toLowerCase();
}

/**
 * Gera um número de série de smartphone Samsung oficial (formato R5CT...)
 */
export function generateSamsungSerial(seed?: string): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 37 + seed.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < 7; i++) {
      hash = (hash * 31 + i) >>> 0;
      suffix += chars[hash % chars.length];
    }
  } else {
    for (let i = 0; i < 7; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `R5CT${suffix}`;
}

/**
 * Gera um Android ID hexadecimal de 16 caracteres
 */
export function generateAndroidId(seed?: string): string {
  if (seed) {
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < seed.length; i++) {
      h1 = (h1 * 31 + seed.charCodeAt(i)) >>> 0;
      h2 = (h2 * 19 + seed.charCodeAt(i)) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
  }
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

/**
 * Gera a identidade anti-detect completa e exclusiva para um novo perfil Android
 */
export function generateAndroidIdentity(seed?: string): AndroidDeviceIdentity {
  const randomDigits = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) res += Math.floor(Math.random() * 10).toString();
    return res;
  };
  const randomHex = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) res += Math.floor(Math.random() * 16).toString(16).toUpperCase();
    return res;
  };

  const byte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');

  return {
    serialNo: generateSamsungSerial(seed),
    androidId: generateAndroidId(seed),
    imei1: generateLuhnImei('35407215'),
    imei2: generateLuhnImei('35407215'),
    macAddress: generateSamsungMac(seed),
    imsi: `72410${randomDigits(10)}`,
    iccid: `895502${randomDigits(13)}`,
    phoneNum: `+55119${randomDigits(8)}`,
    wifiBssid: `34:97:f6:${byte()}:${byte()}:${byte()}`,
    wifiSsid: `Vivo-Fibra-${randomHex(4)}`,
  };
}
