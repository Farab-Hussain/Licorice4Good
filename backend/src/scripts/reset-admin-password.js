/**
 * Reset Admin Password Script
 * 
 * This script resets the password for an admin user.
 * 
 * Usage: node src/scripts/reset-admin-password.js <email> <new-password>
 * Example: node src/scripts/reset-admin-password.js nathan747u@gmail.com newpassword123
 */

const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('❌ Usage: node src/scripts/reset-admin-password.js <email> <new-password>');
    console.log('   Example: node src/scripts/reset-admin-password.js nathan747u@gmail.com newpassword123');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.log('❌ Password must be at least 6 characters long');
    process.exit(1);
  }

  console.log(`🔐 Resetting password for admin user: ${email}\n`);

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    if (user.role !== 'admin') {
      console.log(`⚠️  Warning: User ${email} is not an admin (role: ${user.role})`);
      console.log('   Proceeding anyway...\n');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    });

    console.log('✅ Password reset successfully!');
    console.log('\n' + '═'.repeat(80));
    console.log('\n📝 Updated Admin Credentials:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Verified: ${user.isVerified ? '✅ Yes' : '❌ No'}`);
    console.log(`   New Password: ${newPassword}`);
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ You can now log in with these credentials!');
    
    if (!user.isVerified) {
      console.log('\n⚠️  WARNING: This user is not verified and cannot log in!');
      console.log('   You may need to verify the email first.');
    }

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetAdminPassword()
  .then(() => {
    console.log('\n🎉 Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
