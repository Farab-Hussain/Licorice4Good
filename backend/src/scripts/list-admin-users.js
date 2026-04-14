/**
 * List Admin Users Script
 * 
 * This script lists all admin users in the database.
 * 
 * Run with: node src/scripts/list-admin-users.js
 * or: npm run list-admin-users (if added to package.json)
 */

const { PrismaClient } = require('../generated/prisma');
require('dotenv').config();

const prisma = new PrismaClient();

async function listAdminUsers() {
  console.log('🔍 Searching for admin users...\n');
  
  try {
    // Find all users with admin role
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
        // Note: We don't show passwords for security reasons
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found in the database.');
      console.log('\n💡 To create an admin user:');
      console.log('   1. Register a user through the registration endpoint');
      console.log('   2. Update the user\'s role to "admin" in the database');
      console.log('   3. Make sure isVerified is set to true');
      return;
    }

    console.log(`✅ Found ${adminUsers.length} admin user(s):\n`);
    console.log('═'.repeat(80));
    
    adminUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. Admin User:`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Verified: ${user.isVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log(`   ID: ${user.id}`);
      
      if (!user.isVerified) {
        console.log(`   ⚠️  WARNING: This user is not verified and cannot log in!`);
      }
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n📝 Login Credentials:');
    console.log('   Email: Use the email shown above');
    console.log('   Password: The password set during registration (not stored in plain text)');
    console.log('\n⚠️  Note: Passwords are hashed and cannot be retrieved.');
    console.log('   If you forgot the password, use the password reset feature.');
    
  } catch (error) {
    console.error('❌ Error listing admin users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
listAdminUsers()
  .then(() => {
    console.log('\n🎉 Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
