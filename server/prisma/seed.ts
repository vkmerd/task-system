import { PrismaClient, AdminType, Role, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@ajans.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(password),
      firstName: 'Sistem',
      lastName: 'Yöneticisi',
      role: Role.ADMIN,
      adminType: AdminType.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash: await hashPassword(password),
      firstName: 'Sistem',
      lastName: 'Yöneticisi',
      role: Role.ADMIN,
      adminType: AdminType.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const legacyDepartments = ['Strateji ve Operasyon', 'Yaratıcı Stüdyo', 'Growth ve Medya'];
  for (const name of legacyDepartments) {
    const legacy = await prisma.department.findUnique({ where: { name }, include: { _count: { select: { employees: true } } } });
    if (legacy && legacy._count.employees === 0) {
      await prisma.jobTitle.deleteMany({ where: { departmentId: legacy.id } });
      await prisma.department.delete({ where: { id: legacy.id } });
    }
  }

  const departments = [
    { name: 'Software', color: '#5b8def', titles: ['Web Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer'] },
    { name: 'SEO', color: '#72c96d', titles: ['SEO Specialist', 'Technical SEO Specialist', 'SEO Content Strategist', 'SEO Analyst'] },
    { name: 'Digital Marketing', color: '#3ba6a5', titles: ['Meta Ads Specialist', 'Google Ads Specialist', 'Performance Marketing Specialist', 'Email Marketing Specialist', 'Growth Marketing Manager'] },
    { name: 'Design', color: '#c68ee8', titles: ['Web Designer', 'UI/UX Designer', 'Graphic Designer', 'Art Director', 'Motion Designer'] },
  ];

  for (const departmentInput of departments) {
    const department = await prisma.department.upsert({
      where: { name: departmentInput.name },
      update: { color: departmentInput.color },
      create: { name: departmentInput.name, color: departmentInput.color },
    });

    for (const title of departmentInput.titles) {
      await prisma.jobTitle.upsert({
        where: { name_departmentId: { name: title, departmentId: department.id } },
        update: {},
        create: { name: title, departmentId: department.id, level: 2 },
      });
    }
  }

  console.log(`Seed tamamlandi: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());