import QRCode from 'qrcode';
const url = 'https://go.chatorbit.com/app'; // generic smart link
await QRCode.toFile('public/qr-chatorbit.png', url, { width: 512, margin: 1 });
console.log('QR saved to public/qr-chatorbit.png');
