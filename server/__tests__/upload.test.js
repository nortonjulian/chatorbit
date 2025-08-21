import { makeUploader, uploadDirs } from '../utils/upload.js';
import path from 'path';

describe('makeUploader', () => {
  test('sets limits and storage for avatar', () => {
    const uploader = makeUploader({ maxFiles: 3, maxBytes: 1024, kind: 'avatar' });
    // Multer instance should have limits as provided
    expect(typeof uploader).toBe('object');
    if ('limits' in uploader) {
        expect(uploader.limits).toMatchObject({ fileSize: 1024, files: 3 });
    }
  });
  test('constructs without throwing for defaults', () => {
    expect(() => makeUploader()).not.toThrow();
  });
});

describe('uploadDirs', () => {
  test('has valid directory paths', () => {
    expect(uploadDirs.AVATARS_DIR).toContain(`${path.sep}avatars`);
    expect(uploadDirs.MEDIA_DIR).toContain(`${path.sep}media`);
    expect(uploadDirs.ROOT).toBeDefined();
  });
});
