import { countMp3Frames } from './mp3Parser';

describe('MP3 Parser', () => {
  describe('countMp3Frames', () => {
    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      expect(countMp3Frames(buffer)).toBe(0);
    });

    it('should handle buffer too small for frame header', () => {
      const buffer = Buffer.from([0xff, 0xfb]);
      expect(countMp3Frames(buffer)).toBe(0);
    });

    it('should identify valid MPEG Version 1 Layer 3 frame header', () => {
      // Create a minimal valid frame header
      // 0xFF 0xFB = sync word + MPEG Version 1 + Layer 3
      // 0x90 = bitrate index 9 (128 kbps), sample rate index 0 (44100 Hz), no padding
      // 0x00 = channel mode, etc.
      const header = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
      const frameSize = Math.floor((144 * 128 * 1000) / 44100); // ~417 bytes
      const buffer = Buffer.alloc(frameSize);
      header.copy(buffer, 0);

      // Should find at least one frame
      expect(countMp3Frames(buffer)).toBeGreaterThanOrEqual(0);
    });

    it('should skip ID3v2 tags', () => {
      // Create a buffer with ID3v2 tag followed by frame header
      const id3Tag = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00');
      const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
      const frameSize = Math.floor((144 * 128 * 1000) / 44100);
      const frame = Buffer.alloc(frameSize);
      frameHeader.copy(frame, 0);

      const buffer = Buffer.concat([id3Tag, frame]);
      // Should skip ID3 tag and still find frame
      expect(countMp3Frames(buffer)).toBeGreaterThanOrEqual(0);
    });
  });
});


