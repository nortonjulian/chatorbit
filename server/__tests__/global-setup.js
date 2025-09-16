import { execa } from 'execa';
export default async () => {
  // Migrate schema for test DB
  await execa('npx', ['prisma', 'migrate', 'deploy'], { cwd: 'server', stdio: 'inherit' });
};
