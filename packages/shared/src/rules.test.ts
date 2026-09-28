import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadCapBytes, isAcceptedFile, isPreviewable } from './rules';

test('accepts RAW and rejects video', () => {
  assert.equal(isAcceptedFile('IMG_0001.CR3'), true);
  assert.equal(isAcceptedFile('clip.mp4'), false);
  assert.equal(isAcceptedFile('noextension'), false);
});

test('previews only JPG and PNG', () => {
  assert.equal(isPreviewable('a.JPEG'), true);
  assert.equal(isPreviewable('a.nef'), false);
});

test('cap is twice the gallery size', () => {
  assert.equal(downloadCapBytes(9_000_000_000n), 18_000_000_000n);
});
