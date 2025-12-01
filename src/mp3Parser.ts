/**
 * MP3 Frame Parser for MPEG Version 1 Audio Layer 3 files
 *
 * This parser manually counts frames by:
 * 1. Scanning for frame sync headers (11 bits set to 1)
 * 2. Validating MPEG Version 1 Layer 3 format
 * 3. Calculating frame size from bitrate and sampling frequency
 * 4. Skipping to the next frame and counting
 */

export interface FrameHeader {
  version: number; // MPEG version (3 = Version 1)
  layer: number; // Layer (1 = Layer 3)
  bitrateIndex: number;
  sampleRateIndex: number;
  padding: boolean;
  frameSize: number;
}

// Bitrate lookup table for MPEG Version 1 Layer 3 (in kbps)
const BITRATE_TABLE: { [key: number]: number } = {
  0b0001: 32,
  0b0010: 40,
  0b0011: 48,
  0b0100: 56,
  0b0101: 64,
  0b0110: 80,
  0b0111: 96,
  0b1000: 112,
  0b1001: 128,
  0b1010: 160,
  0b1011: 192,
  0b1100: 224,
  0b1101: 256,
  0b1110: 320,
};

// Sampling frequency lookup table for MPEG Version 1 (in Hz)
const SAMPLE_RATE_TABLE: { [key: number]: number } = {
  0b00: 44100,
  0b01: 48000,
  0b10: 32000,
};

/**
 * Reads a byte from the buffer at the given position
 */
function readByte(buffer: Buffer, position: number): number {
  if (position >= buffer.length) {
    throw new Error('Buffer overflow');
  }
  return buffer[position];
}

/**
 * Checks if a position contains a valid MPEG Version 1 Layer 3 frame header
 */
function parseFrameHeader(buffer: Buffer, position: number): FrameHeader | null {
  if (position + 4 > buffer.length) {
    return null;
  }

  // Check sync word (first 11 bits should be 1)
  const byte1 = readByte(buffer, position);
  const byte2 = readByte(buffer, position + 1);

  if (byte1 !== 0xff || (byte2 & 0xe0) !== 0xe0) {
    return null;
  }

  // Extract MPEG version (bits 11-12)
  const version = (byte2 >> 3) & 0x03;
  // Version 3 = MPEG Version 1
  if (version !== 0b11) {
    return null;
  }

  // Extract layer (bits 13-14)
  const layer = (byte2 >> 1) & 0x03;
  // Layer 1 = Layer 3
  if (layer !== 0b01) {
    return null;
  }

  // Extract bitrate index (bits 16-19)
  const byte3 = readByte(buffer, position + 2);
  const bitrateIndex = (byte3 >> 4) & 0x0f;

  // Bitrate index 0 and 15 are invalid
  if (bitrateIndex === 0 || bitrateIndex === 15) {
    return null;
  }

  // Extract sampling frequency (bits 20-21)
  const sampleRateIndex = (byte3 >> 2) & 0x03;
  if (sampleRateIndex === 0b11) {
    return null; // Invalid sample rate index
  }

  // Extract padding bit (bit 22)
  const padding = ((byte3 >> 1) & 0x01) === 1;

  // Get bitrate and sample rate
  const bitrate = BITRATE_TABLE[bitrateIndex];
  const sampleRate = SAMPLE_RATE_TABLE[sampleRateIndex];

  if (!bitrate || !sampleRate) {
    return null;
  }

  // Calculate frame size in bytes
  // Formula: ((144 * bitrate) / sampleRate) + padding
  const frameSize = Math.floor((144 * bitrate * 1000) / sampleRate) + (padding ? 1 : 0);

  return {
    version,
    layer,
    bitrateIndex,
    sampleRateIndex,
    padding,
    frameSize,
  };
}

/**
 * Counts the number of MPEG Version 1 Audio Layer 3 frames in the buffer
 */
export function countMp3Frames(buffer: Buffer): number {
  let frameCount = 0;
  let position = 0;

  // Skip potential ID3v2 tag if present (starts with "ID3")
  if (buffer.length >= 10) {
    const id3Header = buffer.toString('ascii', 0, 3);
    if (id3Header === 'ID3') {
      // ID3v2 tag size is stored in bytes 6-9 (synchsafe integer)
      const sizeByte6 = readByte(buffer, 6);
      const sizeByte7 = readByte(buffer, 7);
      const sizeByte8 = readByte(buffer, 8);
      const sizeByte9 = readByte(buffer, 9);

      const id3Size =
        (sizeByte6 << 21) | (sizeByte7 << 14) | (sizeByte8 << 7) | sizeByte9;
      position = 10 + id3Size;
    }
  }

  // Scan for frames
  while (position < buffer.length - 4) {
    try {
      const header = parseFrameHeader(buffer, position);

      if (header) {
        // Validate frame size is reasonable (minimum 4 bytes for header, maximum ~1440 bytes for 320kbps)
        if (header.frameSize < 4 || header.frameSize > 1440) {
          position++;
          continue;
        }

        // Check if frame fits within buffer
        if (position + header.frameSize > buffer.length) {
          // Frame extends beyond buffer, might be last frame or invalid
          // If we're close to the end, count it as a partial frame
          if (position + 4 <= buffer.length) {
            frameCount++;
          }
          break;
        }

        // Count the frame
        frameCount++;

        // Move to the next expected frame position
        const nextFramePos = position + header.frameSize;
        if (nextFramePos >= buffer.length - 4) {
          // Reached end of buffer
          break;
        }

        // Try to verify next frame exists at expected position
        const nextHeader = parseFrameHeader(buffer, nextFramePos);
        if (nextHeader && nextHeader.frameSize >= 4 && nextHeader.frameSize <= 1440) {
          // Next frame is valid, jump to it for efficiency
          position = nextFramePos;
          continue;
        }

        // Next frame not found at expected position
        // This could be due to:
        // - Variable bitrate (VBR) files with different frame sizes
        // - Padding differences
        // - Corrupted data
        // Scan from the expected position to find the next frame
        position = nextFramePos;
      } else {
        position++;
      }
    } catch {
      // Buffer overflow or other error, skip this position
      position++;
    }
  }

  return frameCount;
}

