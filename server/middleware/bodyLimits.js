import express from 'express';

export function bodyLimits() {
  const jsonLimit = process.env.JSON_BODY_LIMIT || '200kb';
  const urlLimit = process.env.URLENCODED_BODY_LIMIT || '100kb';
  return [
    express.json({ limit: jsonLimit }),
    express.urlencoded({ limit: urlLimit, extended: true }),
  ];
}
