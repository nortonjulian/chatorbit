import express from 'express';
import fetch from 'node-fetch';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/search', verifyToken, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ results: [] });

  const key = process.env.TENOR_API_KEY; // or GIPHY key
  if (!key) return res.status(501).json({ error: 'No sticker search key configured' });

  try {
    const url = new URL('https://tenor.googleapis.com/v2/search');
    url.searchParams.set('q', q);
    url.searchParams.set('key', key);
    url.searchParams.set('limit', '24');
    url.searchParams.set('media_filter', 'tinygif,mediumgif');

    const r = await fetch(url);
    const data = await r.json();

    const results = (data?.results || []).map((it) => {
      const tiny = it.media_formats?.tinygif?.url || it.media_formats?.gif?.url;
      const med = it.media_formats?.mediumgif?.url || it.media_formats?.gif?.url;
      return {
        id: it.id,
        kind: 'GIF',
        url: med || tiny,
        thumb: tiny || med,
        mimeType: 'image/gif',
        width: it.media_formats?.mediumgif?.dims?.[0] || null,
        height: it.media_formats?.mediumgif?.dims?.[1] || null,
      };
    });

    res.json({ results });
  } catch (e) {
    console.error('sticker search failed', e);
    res.status(500).json({ error: 'search failed' });
  }
});

export default router;
