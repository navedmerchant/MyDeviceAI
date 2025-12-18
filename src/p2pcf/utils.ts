/**
 * P2PCF Utilities
 * Encoding/decoding utilities with zero external dependencies
 */

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  // Remove padding
  const base64Clean = base64.replace(/[=]/g, '');

  // Base64 alphabet
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // Calculate output size
  const len = base64Clean.length;
  const bytes = new Uint8Array((len * 3) / 4);

  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(base64Clean[i] || '');
    const enc2 = chars.indexOf(base64Clean[i + 1] || '');
    const enc3 = chars.indexOf(base64Clean[i + 2] || '');
    const enc4 = chars.indexOf(base64Clean[i + 3] || '');

    bytes[byteIndex++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1) {
      bytes[byteIndex++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (enc4 !== -1) {
      bytes[byteIndex++] = ((enc3 & 3) << 6) | enc4;
    }
  }

  return bytes.slice(0, byteIndex);
}

/**
 * Convert Uint8Array to base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i] ?? 0;
    const byte2 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const byte3 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    base64 += (chars[enc1] ?? '') + (chars[enc2] ?? '');
    base64 += i + 1 < bytes.length ? (chars[enc3] ?? '') : '=';
    base64 += i + 2 < bytes.length ? (chars[enc4] ?? '') : '=';
  }

  return base64;
}

/**
 * Convert string to Uint8Array (UTF-8 encoding)
 */
export function stringToBytes(str: string): Uint8Array {
  // Use TextEncoder if available (modern browsers and Node.js)
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }

  // Fallback for older environments
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    } else {
      // UTF-16 surrogate pair
      i++;
      charcode =
        0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }
  return new Uint8Array(utf8);
}

/**
 * Convert Uint8Array to string (UTF-8 decoding)
 */
export function bytesToString(bytes: Uint8Array): string {
  // Use TextDecoder if available
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  // Fallback for older environments
  let str = '';
  let i = 0;

  while (i < bytes.length) {
    const byte1 = bytes[i++] ?? 0;

    if (byte1 < 0x80) {
      str += String.fromCharCode(byte1);
    } else if (byte1 >= 0xc0 && byte1 < 0xe0) {
      const byte2 = bytes[i++] ?? 0;
      str += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >= 0xe0 && byte1 < 0xf0) {
      const byte2 = bytes[i++] ?? 0;
      const byte3 = bytes[i++] ?? 0;
      str += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    } else if (byte1 >= 0xf0) {
      const byte2 = bytes[i++] ?? 0;
      const byte3 = bytes[i++] ?? 0;
      const byte4 = bytes[i++] ?? 0;
      const codepoint =
        ((byte1 & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);
      const high = ((codepoint - 0x10000) >> 10) + 0xd800;
      const low = ((codepoint - 0x10000) & 0x3ff) + 0xdc00;
      str += String.fromCharCode(high, low);
    }
  }

  return str;
}

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }

  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  return generateUUID().replace(/-/g, '');
}
