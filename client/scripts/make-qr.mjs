import QRCode from 'qrcode';
const url = 'https://go.chatforia.com/app'; // generic smart link
await QRCode.toFile('public/qr-chatforia.png', url, { width: 512, margin: 1 });
console.log('QR saved to public/qr-chatforia.png');
