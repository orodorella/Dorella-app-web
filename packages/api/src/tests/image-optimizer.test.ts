import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeToWebp, withWebpExtension, MAX_DIMENSION } from '../utils/image-optimizer.js';

async function makePng(width: number, height: number, hasAlpha: boolean): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: hasAlpha ? 4 : 3,
      background: hasAlpha ? { r: 200, g: 50, b: 50, alpha: 1 } : { r: 200, g: 50, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe('optimizeToWebp', () => {
  it('converts a PNG to WebP', async () => {
    const png = await makePng(400, 400, false);
    const optimized = await optimizeToWebp(png);
    const meta = await sharp(optimized).metadata();
    expect(meta.format).toBe('webp');
  });

  it('caps dimensions at MAX_DIMENSION without upscaling smaller images', async () => {
    const largePng = await makePng(3000, 2000, false);
    const optimizedLarge = await sharp(await optimizeToWebp(largePng)).metadata();
    expect(optimizedLarge.width).toBeLessThanOrEqual(MAX_DIMENSION);
    expect(optimizedLarge.height).toBeLessThanOrEqual(MAX_DIMENSION);

    const smallPng = await makePng(100, 80, false);
    const optimizedSmall = await sharp(await optimizeToWebp(smallPng)).metadata();
    expect(optimizedSmall.width).toBe(100);
    expect(optimizedSmall.height).toBe(80);
  });

  it('never produces a file larger than the original', async () => {
    const png = await makePng(200, 200, false);
    const optimized = await optimizeToWebp(png);
    expect(optimized.length).toBeLessThanOrEqual(png.length);
  });

  it('preserves a real (non-fully-opaque) alpha channel', async () => {
    const png = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const optimized = await optimizeToWebp(png);
    const meta = await sharp(optimized).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it('flattens a fully-opaque alpha channel to save bytes', async () => {
    const png = await makePng(200, 200, true);
    const optimized = await optimizeToWebp(png);
    const meta = await sharp(optimized).metadata();
    expect(meta.hasAlpha).toBe(false);
  });
});

describe('withWebpExtension', () => {
  it('replaces any extension with .webp', () => {
    expect(withWebpExtension('DIR028_0068.png')).toBe('DIR028_0068.webp');
    expect(withWebpExtension('photo.JPEG')).toBe('photo.webp');
    expect(withWebpExtension('1786210785638-0.PNG')).toBe('1786210785638-0.webp');
  });

  it('is idempotent on files already named .webp', () => {
    expect(withWebpExtension('already.webp')).toBe('already.webp');
  });
});
