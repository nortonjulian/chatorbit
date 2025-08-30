export async function transcribeFromUrl(url, language = 'en-US') {
// Minimal fake transcript; replace with real STT later
return {
language,
segments: [
{ start: 0.0, end: 1.8, text: 'This is a mock transcription.' },
{ start: 1.8, end: 3.6, text: 'Replace me with a real STT provider.' }
]
};
}