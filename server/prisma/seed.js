import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      username: 'testuser',
      email: 'test@example.com',
      phoneNumber: '123456789',
    },
  });
  console.log('Created user:', user);
}

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
