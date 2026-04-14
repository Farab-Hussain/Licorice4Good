import nodemailer from "nodemailer";

// Helper to get SMTP configuration from environment variables
// Defaults to GoDaddy's SMTP server which works with regular passwords
const getSmtpConfig = () => {
  // If EMAIL_HOST is explicitly set, use it
  // Otherwise, check EMAIL_PROVIDER or default to GoDaddy
  let defaultHost = "smtpout.secureserver.net"; // GoDaddy SMTP

  if (process.env.EMAIL_PROVIDER === "godaddy") {
    defaultHost = "smtpout.secureserver.net";
  } else if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_HOST.includes("office365")
  ) {
    defaultHost = "smtp.office365.com";
  }

  return {
    host: process.env.EMAIL_HOST || defaultHost,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure:
      process.env.EMAIL_SECURE === "true" || process.env.EMAIL_PORT === "465",
  };
};

export const sendResetEmail = async (to: string, code: string) => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Using Ethereal email for development."
    );
    console.warn(
      "📧 To enable real email functionality, add EMAIL_USER and EMAIL_PASS to your .env file"
    );

    try {
      // Use Ethereal email for development (fake SMTP)
      const testAccount = await nodemailer.createTestAccount();

      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const mailOptions = {
        from: `"Nathan " <${testAccount.user}>`,
        to,
        subject: "Password Reset Code",
        html: `
          <h2>Password Reset Code</h2>
          <p>You requested a password reset for your account.</p>
          <p><strong>Your 6-digit reset code is:</strong></p>
          <div style="background: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>This code will expire in 10 minutes</li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
          <p>Enter this code in the password reset form to continue.</p>
        `,
      };

      const info = await transporter.sendMail(mailOptions);

      return;
    } catch (error) {
      console.error("❌ Error with Ethereal email:", error);
      // Fallback to just logging the code
      return;
    }
  }

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const mailOptions = {
      from: `"Licorice4Good" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to,
      subject: "Password Reset Code",
      html: `
        <h2>Password Reset Code</h2>
        <p>You requested a password reset for your account.</p>
        <p><strong>Your 6-digit reset code is:</strong></p>
        <div style="background: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
        </div>
        <p><strong>Important:</strong></p>
        <ul>
          <li>This code will expire in 10 minutes</li>
          <li>Do not share this code with anyone</li>
          <li>If you didn't request this, please ignore this email</li>
        </ul>
        <p>Enter this code in the password reset form to continue.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error("❌ Error sending email:", error);

    // Check for connection timeout errors
    if (error?.code === "ETIMEDOUT" || error?.code === "ECONNREFUSED") {
      const smtpConfig = getSmtpConfig();
      console.error("❌ Connection timeout/refused. Current SMTP settings:");
      console.error(`   Host: ${smtpConfig.host}`);
      console.error(`   Port: ${smtpConfig.port}`);
      console.error("   💡 For GoDaddy, make sure your .env has:");
      console.error("      EMAIL_HOST=smtpout.secureserver.net");
      console.error("      EMAIL_PORT=587");
      console.error("      EMAIL_USER=your-email@yourdomain.com");
      console.error("      EMAIL_PASS=your-password");
    }

    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH" ||
      error?.responseCode === 535
    ) {
      const smtpConfig = getSmtpConfig();
      console.error("⚠️  Authentication rejected (535 error)");
      console.error("📧 Troubleshooting steps:");
      console.error("   1. Make sure your password is correct");
      console.error(
        "   2. If password contains special characters (@, $, etc.), quote it in .env:"
      );
      console.error('      EMAIL_PASS="your-password-with-special-chars"');
      console.error(
        "   3. For GoDaddy, try using GoDaddy's SMTP server instead:"
      );
      console.error("      EMAIL_HOST=smtpout.secureserver.net");
      console.error("      EMAIL_PROVIDER=godaddy");
      console.error("   4. Current settings:");
      console.error(`      Host: ${smtpConfig.host}`);
      console.error(`      Port: ${smtpConfig.port}`);
      console.error(`      User: ${process.env.EMAIL_USER}`);
    }
    // Fallback to Ethereal in case of SMTP auth issues, do not throw to keep UX smooth in dev/test
    try {
      const testAccount = await nodemailer.createTestAccount();
      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      const mailOptions = {
        from: `Nathan  <${testAccount.user}>`,
        to,
        subject: "Password Reset Code",
        html: `
          <h2>Password Reset Code</h2>
          <p>You requested a password reset for your account.</p>
          <p><strong>Your 6-digit reset code is:</strong></p>
          <div style="background: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>This code will expire in 10 minutes</li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
          <p>Enter this code in the password reset form to continue.</p>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      return;
    } catch (fallbackErr) {
      console.error("❌ Ethereal fallback failed:", fallbackErr);
      // Do not throw - we still want the flow to continue and user to see success
      return;
    }
  }
};

export const sendVerificationEmail = async (
  to: string,
  token: string,
  code: string
) => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Using Ethereal email for development."
    );
    console.warn(
      "📧 To enable real email functionality, add EMAIL_USER and EMAIL_PASS to your .env file"
    );

    try {
      // Use Ethereal email for development (fake SMTP)
      const testAccount = await nodemailer.createTestAccount();

      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const verificationUrl = `${
        process.env.CLIENT_URL || "https://licorice4good.com"
      }/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

      const mailOptions = {
        from: `"Nathan " <${testAccount.user}>`,
        to,
        subject: "Verify Your Email Address",
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Nathan!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Please verify your email address</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi there!</p>
              
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Thank you for registering with Nathan! To complete your account setup, please verify your email address.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <div style="background: #e9ecef; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #495057;">
                  <strong>Alternative Method:</strong> If the button doesn't work, you can also use this 6-digit code:
                </p>
                <div style="background: white; border: 2px solid #007bff; border-radius: 8px; padding: 15px; text-align: center; margin: 10px 0;">
                  <h2 style="color: #007bff; font-size: 24px; margin: 0; letter-spacing: 3px;">${code}</h2>
                </div>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>Important:</strong>
                </p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #856404;">
                  <li>This verification link will expire in 24 hours</li>
                  <li>If you didn't create an account, please ignore this email</li>
                  <li>For security, don't share this code or link with anyone</li>
                </ul>
              </div>
              
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
                If you're having trouble, you can also copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
              </p>
            </div>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);

      return;
    } catch (error) {
      console.error("❌ Error with Ethereal email:", error);
      const verificationUrl = `${
        process.env.CLIENT_URL || "https://licorice4good.com"
      }/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;
      return;
    }
  }

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const verificationUrl = `${
      process.env.CLIENT_URL || "https://licorice4good.com"
    }/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

    const mailOptions = {
      from: `"Licorice4Good" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to,
      subject: "Verify Your Email Address",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Nathan!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Please verify your email address</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi there!</p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Thank you for registering with Nathan! To complete your account setup, please verify your email address.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <div style="background: #e9ecef; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #495057;">
                <strong>Alternative Method:</strong> If the button doesn't work, you can also use this 6-digit code:
              </p>
              <div style="background: white; border: 2px solid #007bff; border-radius: 8px; padding: 15px; text-align: center; margin: 10px 0;">
                <h2 style="color: #007bff; font-size: 24px; margin: 0; letter-spacing: 3px;">${code}</h2>
              </div>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Important:</strong>
              </p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #856404;">
                <li>This verification link will expire in 24 hours</li>
                <li>If you didn't create an account, please ignore this email</li>
                <li>For security, don't share this code or link with anyone</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
              If you're having trouble, you can also copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error(
      "❌ Error sending verification email via Microsoft 365:",
      error
    );
    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH"
    ) {
      console.error(
        "⚠️  SMTP Authentication is disabled for your Microsoft 365 tenant."
      );
      console.error(
        "📧 To fix: Enable SMTP Authentication in GoDaddy Email & Office Dashboard:"
      );
      console.error(
        "   1. Go to Email & Office Dashboard → Manage → Advanced Settings"
      );
      console.error("   2. Toggle ON 'SMTP Authentication'");
      console.error(
        "   3. Or visit: https://aka.ms/smtp_auth_disabled for more info"
      );
    }
    // Fallback to Ethereal in case of SMTP auth issues
    try {
      const testAccount = await nodemailer.createTestAccount();
      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const verificationUrl = `${
        process.env.CLIENT_URL || "https://licorice4good.com"
      }/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

      const mailOptions = {
        from: `Nathan  <${testAccount.user}>`,
        to,
        subject: "Verify Your Email Address",
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Nathan!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Please verify your email address</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi there!</p>
              
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Thank you for registering with Nathan! To complete your account setup, please verify your email address.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <div style="background: #e9ecef; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #495057;">
                  <strong>Alternative Method:</strong> If the button doesn't work, you can also use this 6-digit code:
                </p>
                <div style="background: white; border: 2px solid #007bff; border-radius: 8px; padding: 15px; text-align: center; margin: 10px 0;">
                  <h2 style="color: #007bff; font-size: 24px; margin: 0; letter-spacing: 3px;">${code}</h2>
                </div>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>Important:</strong>
                </p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #856404;">
                  <li>This verification link will expire in 24 hours</li>
                  <li>If you didn't create an account, please ignore this email</li>
                  <li>For security, don't share this code or link with anyone</li>
                </ul>
              </div>
              
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
                If you're having trouble, you can also copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
              </p>
            </div>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      return;
    } catch (fallbackErr) {
      console.error("❌ Ethereal fallback failed:", fallbackErr);
      const verificationUrl = `${
        process.env.CLIENT_URL || "https://licorice4good.com"
      }/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;
      return;
    }
  }
};

// Order confirmation email
export const sendOrderConfirmationEmail = async (
  to: string,
  orderDetails: {
    orderId: string;
    customerName: string;
    total: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      variationName?: string | null;
      productName?: string | null;
      packItems?: Array<{
        name: string;
        variation: string;
        packSize: number | null;
      }>;
      isPack?: boolean;
    }>;
    shippingAddress: {
      street1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    shippingDetails?: {
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
      shippingCost?: number;
    };
  }
) => {
  const itemsHtml = orderDetails.items
    .map((item: any) => {
      // Use productName if available, otherwise use name
      const productName = item.productName || item.name || "Product";
      const variationName = item.variationName || null;
      const isPack = item.isPack || false;
      const packItems = item.packItems || [];

      // If it's a pack product, show pack name and list variations
      if (isPack && packItems.length > 0) {
        console.log(
          `📧 Rendering pack product in email: ${productName} with ${packItems.length} variations`
        );
        packItems.forEach((packItem: any, idx: number) => {
          console.log(
            `   Variation ${idx + 1}: packSize=${
              packItem.packSize
            }, variation="${packItem.variation}", name="${packItem.name}"`
          );
        });

        // Check if this is a Platinum 12-pack (all 3-pack variations)
        const isPlatinumPack = productName.includes("Platinum") && packItems.every((item: any) => item.packSize === 3);

        const variationsList = packItems
          .map((packItem: any) => {
            const packSizeLabel =
              packItem.packSize === 3
                ? "3-Pack"
                : packItem.packSize === 4
                ? "4-Pack"
                : "";
            // Prioritize 'variation' field, then 'variationName', then 'name', then fallback
            const variationText =
              packItem.variation ||
              packItem.variationName ||
              packItem.name ||
              "No variation";

            // For Platinum pack, show product title (name) + variation name
            // For other packs, keep existing format
            if (isPlatinumPack) {
              const productTitle = packItem.name || "3 Pack";
              console.log(`📧 Email Platinum variation item:`, {
                packSize: packItem.packSize,
                productTitle,
                variationName: variationText,
              });

              return `<div style="margin: 4px 0; padding-left: 12px; border-left: 2px solid #FF5D39;">
                <span style="font-weight: 600; color: #666;">${productTitle} -</span> 
                <span style="color: #FF5D39; font-weight: 500;">${variationText}</span>
              </div>`;
            } else {
              console.log(`📧 Email variation item:`, {
                packSize: packItem.packSize,
                packSizeLabel,
                variation: packItem.variation,
                variationName: packItem.variationName,
                name: packItem.name,
                finalText: variationText,
              });

              return `<div style="margin: 4px 0; padding-left: 12px; border-left: 2px solid #FF5D39;">
                <span style="font-weight: 600; color: #666;">${packSizeLabel}:</span> 
                <span style="color: #FF5D39; font-weight: 500;">${variationText}</span>
              </div>`;
            }
          })
          .join("");

        // If no variations listed, show a message
        if (!variationsList || variationsList.trim() === "") {
          console.warn(
            "⚠️ Pack product has no variations to display:",
            productName,
            "packItems:",
            JSON.stringify(packItems, null, 2)
          );
        }

        return `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 14px;">
            ${productName}
          </div>
          <div style="font-size: 12px; color: #555; margin-top: 8px; line-height: 1.8;">
            <strong style="color: #333;">Selected Variations:</strong>
            ${variationsList}
          </div>
        </td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: center; vertical-align: top;">${
          item.quantity
        }</td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: right; vertical-align: top;">$${item.price.toFixed(
          2
        )}</td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: right; vertical-align: top;">$${(
          item.quantity * item.price
        ).toFixed(2)}</td>
      </tr>
    `;
      }

      // Regular item with or without variation
      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; color: #333; margin-bottom: ${
            variationName ? "4px" : "0"
          };">
            ${productName}
          </div>
          ${
            variationName
              ? `
          <div style="font-size: 12px; color: #FF5D39; font-style: italic; margin-top: 2px; font-weight: 500;">
            Variation: ${variationName}
          </div>
          `
              : ""
          }
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center;">${
          item.quantity
        }</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">$${item.price.toFixed(
          2
        )}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">$${(
          item.quantity * item.price
        ).toFixed(2)}</td>
      </tr>
    `;
    })
    .join("");

  const emailHtml = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Confirmed!</h1>
        <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Thank you for your order, ${
          orderDetails.customerName
        }!</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <div style="background: #e7f5ff; border-left: 4px solid #339af0; padding: 15px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #1864ab;">
            <strong>Order Number:</strong> #${orderDetails.orderId}
          </p>
        </div>
        
        <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">Order Summary</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: white;">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr style="background: #f8f9fa; font-weight: bold;">
              <td colspan="3" style="padding: 15px; text-align: right;">Total:</td>
              <td style="padding: 15px; text-align: right; color: #28a745; font-size: 18px;">$${orderDetails.total.toFixed(
                2
              )}</td>
            </tr>
          </tbody>
        </table>
        
        <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; margin-top: 30px;">📦 Shipping Address</h2>
        <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #495057;">${
            orderDetails.shippingAddress.street1
          }</p>
          <p style="margin: 5px 0; color: #495057;">${
            orderDetails.shippingAddress.city
          }, ${orderDetails.shippingAddress.state} ${
    orderDetails.shippingAddress.zip
  }</p>
          <p style="margin: 5px 0; color: #495057;">${
            orderDetails.shippingAddress.country
          }</p>
        </div>
        
        ${
          orderDetails.shippingDetails
            ? `
        <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; margin-top: 30px;">🚚 Shipping Details</h2>
        <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
          ${
            orderDetails.shippingDetails.carrier
              ? `
            <p style="margin: 5px 0; color: #495057;"><strong>Carrier:</strong> ${orderDetails.shippingDetails.carrier}</p>
          `
              : ""
          }
          ${
            orderDetails.shippingDetails.shippingCost !== undefined
              ? `
            <p style="margin: 5px 0; color: #495057;"><strong>Shipping Cost:</strong> $${orderDetails.shippingDetails.shippingCost.toFixed(
              2
            )}</p>
          `
              : ""
          }
          ${
            orderDetails.shippingDetails.trackingNumber
              ? `
            <p style="margin: 5px 0; color: #495057;"><strong>Tracking Number:</strong> ${orderDetails.shippingDetails.trackingNumber}</p>
          `
              : ""
          }
          ${
            orderDetails.shippingDetails.trackingUrl
              ? `
            <div style="text-align: center; margin-top: 15px;">
              <a href="${orderDetails.shippingDetails.trackingUrl}" 
                 style="display: inline-block; background: #FF6B35; color: white; padding: 10px 25px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold;">
                🔍 Track Your Shipment
              </a>
            </div>
          `
              : ""
          }
        </div>
        `
            : `
        <div style="background: #d1f3d1; border: 1px solid #28a745; border-radius: 5px; padding: 15px; margin: 30px 0;">
          <p style="margin: 0; font-size: 14px; color: #155724;">
            <strong>✓ What's Next?</strong>
          </p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #155724;">
            <li>We're processing your order now</li>
            <li>You'll receive tracking details once your order ships</li>
          </ul>
        </div>
        `
        }
        
        <p style="font-size: 14px; color: #6c757d; margin-top: 30px; text-align: center;">
          Questions? Contact us at <a href="mailto:support@licorice4good.com" style="color: #007bff;">support@licorice4good.com</a>
        </p>
        
        <p style="font-size: 12px; color: #adb5bd; margin-top: 20px; text-align: center;">
          This is an automated email. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Using Ethereal email for development."
    );

    try {
      const testAccount = await nodemailer.createTestAccount();
      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const mailOptions = {
        from: `"Licrorice" <${testAccount.user}>`,
        to,
        bcc: "muaz786m786@gmail.com", // Owner receives copy of all orders
        subject: `Order Confirmation - #${orderDetails.orderId}`,
        html: emailHtml,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(
        `📧 Order confirmation email sent (Ethereal): ${nodemailer.getTestMessageUrl(
          info
        )}`
      );
      return;
    } catch (error) {
      console.error(
        "❌ Error sending order confirmation email (Ethereal):",
        error
      );
      return;
    }
  }

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const mailOptions = {
      from: `"Licorice4Good" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to,
      bcc: "muaz786m786@gmail.com", // Owner receives copy of all orders
      subject: `Order Confirmation - #${orderDetails.orderId}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Order confirmation email sent to ${to} (copy to owner)`);
  } catch (error: any) {
    console.error(
      "❌ Error sending order confirmation email via Microsoft 365:",
      error
    );
    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH"
    ) {
      console.error(
        "⚠️  SMTP Authentication is disabled for your Microsoft 365 tenant."
      );
      console.error(
        "📧 To fix: Enable SMTP Authentication in GoDaddy Email & Office Dashboard:"
      );
      console.error(
        "   1. Go to Email & Office Dashboard → Manage → Advanced Settings"
      );
      console.error("   2. Toggle ON 'SMTP Authentication'");
      console.error(
        "   3. Or visit: https://aka.ms/smtp_auth_disabled for more info"
      );
    }
    // Fallback to Ethereal
    try {
      const testAccount = await nodemailer.createTestAccount();
      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const mailOptions = {
        from: `"Licrorice" <${testAccount.user}>`,
        to,
        bcc: "muaz786m786@gmail.com", // Owner receives copy of all orders
        subject: `Order Confirmation - #${orderDetails.orderId}`,
        html: emailHtml,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(
        `📧 Order confirmation email sent (Ethereal fallback): ${nodemailer.getTestMessageUrl(
          info
        )}`
      );
      return;
    } catch (fallbackErr) {
      console.error("❌ Ethereal fallback failed:", fallbackErr);
      return;
    }
  }
};

// Email subscription confirmation email (to user)
export const sendSubscriptionConfirmationEmail = async (to: string) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Using Ethereal email for development."
    );
    try {
      const testAccount = await nodemailer.createTestAccount();
      const smtpConfig = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const mailOptions = {
        from: `"Licorice4Good" <${testAccount.user}>`,
        to,
        subject: "🎉 Welcome to Licorice4Good Newsletter!",
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #FF5D39 0%, #FF8C5A 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Thank You for Subscribing!</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Hi there!
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Thank you for subscribing to the <strong>Licorice4Good</strong> newsletter! We're excited to have you join our community.
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6; margin-top: 15px; padding: 15px; background: #e7f5ff; border-left: 4px solid #339af0; border-radius: 4px;">
                <strong>✅ Your subscription is confirmed!</strong> You're all set to receive our latest updates, exclusive offers, and special promotions.
              </p>
              
              <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #FF5D39;">
                <p style="margin: 0; font-size: 15px; color: #555;">
                  <strong>What to expect:</strong>
                </p>
                <ul style="margin: 15px 0 0 0; padding-left: 20px; color: #555;">
                  <li style="margin: 8px 0;">Exclusive deals and special offers</li>
                  <li style="margin: 8px 0;">New product announcements</li>
                  <li style="margin: 8px 0;">Tips and recipes for your licorice treats</li>
                  <li style="margin: 8px 0;">Community updates and stories</li>
                </ul>
              </div>
              
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                We promise to only send you valuable content and never spam your inbox.
              </p>
              
              <p style="font-size: 16px; color: #333; line-height: 1.6; margin-top: 30px;">
                Happy snacking!<br>
                <strong>The Licorice4Good Team</strong>
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      console.error("❌ Error with Ethereal email:", error);
      return;
    }
  }

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const mailOptions = {
      from: `"Licorice4Good" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to,
      subject: "🎉 Welcome to Licorice4Good Newsletter!",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #FF5D39 0%, #FF8C5A 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Thank You for Subscribing!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Hi there!
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for subscribing to the <strong>Licorice4Good</strong> newsletter! We're excited to have you join our community.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-top: 15px; padding: 15px; background: #e7f5ff; border-left: 4px solid #339af0; border-radius: 4px;">
              <strong>✅ Your subscription is confirmed!</strong> You're all set to receive our latest updates, exclusive offers, and special promotions.
            </p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #FF5D39;">
              <p style="margin: 0; font-size: 15px; color: #555;">
                <strong>What to expect:</strong>
              </p>
              <ul style="margin: 15px 0 0 0; padding-left: 20px; color: #555;">
                <li style="margin: 8px 0;">Exclusive deals and special offers</li>
                <li style="margin: 8px 0;">New product announcements</li>
                <li style="margin: 8px 0;">Tips and recipes for your licorice treats</li>
                <li style="margin: 8px 0;">Community updates and stories</li>
              </ul>
            </div>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              We promise to only send you valuable content and never spam your inbox.
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-top: 30px;">
              Happy snacking!<br>
              <strong>The Licorice4Good Team</strong>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Subscription confirmation email sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Error sending subscription confirmation email:", error);
    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH"
    ) {
      console.error(
        "⚠️  SMTP Authentication is disabled for your Microsoft 365 tenant."
      );
      console.error(
        "📧 To fix: Enable SMTP Authentication in GoDaddy Email & Office Dashboard:"
      );
      console.error(
        "   1. Go to Email & Office Dashboard → Manage → Advanced Settings"
      );
      console.error("   2. Toggle ON 'SMTP Authentication'");
      console.error(
        "   3. Or visit: https://aka.ms/smtp_auth_disabled for more info"
      );
    }
    throw error;
  }
};

// Admin notification email for new subscription
export const sendAdminSubscriptionNotification = async (
  subscriberEmail: string,
  source?: string
) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  if (!adminEmail) {
    console.warn(
      "⚠️  ADMIN_EMAIL not configured. Skipping admin notification."
    );
    return;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Skipping admin notification."
    );
    return;
  }

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const mailOptions = {
      from: `"Licorice4Good System" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to: adminEmail,
      subject: `📧 New Newsletter Subscription: ${subscriberEmail}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #339af0 0%, #228be6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📧 New Newsletter Subscription</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              A new subscriber has joined your newsletter!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #339af0;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>Subscriber Email:</strong>
              </p>
              <p style="margin: 8px 0 0 0; font-size: 16px; color: #333; font-weight: 600;">
                ${subscriberEmail}
              </p>
              <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
                <strong>Subscription Date:</strong> ${new Date().toLocaleString()}
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This is an automated notification from your Licorice4Good system.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Admin subscription notification sent to ${adminEmail}`);
  } catch (error: any) {
    console.error("❌ Error sending admin subscription notification:", error);
    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH"
    ) {
      console.error(
        "⚠️  SMTP Authentication is disabled for your Microsoft 365 tenant."
      );
      console.error(
        "📧 To fix: Enable SMTP Authentication in GoDaddy Email & Office Dashboard:"
      );
      console.error(
        "   1. Go to Email & Office Dashboard → Manage → Advanced Settings"
      );
      console.error("   2. Toggle ON 'SMTP Authentication'");
      console.error(
        "   3. Or visit: https://aka.ms/smtp_auth_disabled for more info"
      );
    }
    // Don't throw - admin notification failure shouldn't break subscription
  }
};

// Admin notification email for new order
export const sendAdminOrderNotification = async (orderDetails: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variationName?: string | null;
    productName?: string | null;
    packItems?: Array<{
      name: string;
      variation: string;
      packSize: number | null;
    }>;
    isPack?: boolean;
  }>;
  shippingAddress: {
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  shippingDetails?: {
    trackingNumber?: string;
    trackingUrl?: string;
    carrier?: string;
    shippingCost?: number;
  };
}) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  if (!adminEmail) {
    console.warn(
      "⚠️  ADMIN_EMAIL not configured. Skipping admin order notification."
    );
    return;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "⚠️  Email credentials not configured. Skipping admin order notification."
    );
    return;
  }

  const itemsHtml = orderDetails.items
    .map((item: any) => {
      const productName = item.productName || item.name || "Product";
      const variationName = item.variationName || null;
      const isPack = item.isPack || false;
      const packItems = item.packItems || [];

      if (isPack && packItems.length > 0) {
        const variationsList = packItems
          .map((packItem: any) => {
            const packSizeLabel =
              packItem.packSize === 3
                ? "3-Pack"
                : packItem.packSize === 4
                ? "4-Pack"
                : "";
            const variationText =
              packItem.variation ||
              packItem.variationName ||
              packItem.name ||
              "No variation";

            return `<div style="margin: 4px 0; padding-left: 12px; border-left: 2px solid #FF5D39;">
              <span style="font-weight: 600; color: #666;">${packSizeLabel}:</span> 
              <span style="color: #FF5D39; font-weight: 500;">${variationText}</span>
            </div>`;
          })
          .join("");

        return `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 14px;">
            ${productName}
          </div>
          <div style="font-size: 12px; color: #555; margin-top: 8px; line-height: 1.8;">
            <strong style="color: #333;">Selected Variations:</strong>
            ${variationsList}
          </div>
        </td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: center; vertical-align: top;">${
          item.quantity
        }</td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: right; vertical-align: top;">$${item.price.toFixed(
          2
        )}</td>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef; text-align: right; vertical-align: top;">$${(
          item.quantity * item.price
        ).toFixed(2)}</td>
      </tr>
    `;
      }

      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; color: #333; margin-bottom: ${
            variationName ? "4px" : "0"
          };">
            ${productName}
          </div>
          ${
            variationName
              ? `
          <div style="font-size: 12px; color: #FF5D39; font-style: italic; margin-top: 2px; font-weight: 500;">
            Variation: ${variationName}
          </div>
          `
              : ""
          }
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center;">${
          item.quantity
        }</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">$${item.price.toFixed(
          2
        )}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">$${(
          item.quantity * item.price
        ).toFixed(2)}</td>
      </tr>
    `;
    })
    .join("");

  try {
    const smtpConfig = getSmtpConfig();
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();

    // Debug: Log SMTP config (without password for security)
    console.log("📧 SMTP Configuration:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: emailUser,
      passLength: emailPass?.length || 0,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Use appropriate TLS settings based on host
      tls: smtpConfig.host.includes("office365.com")
        ? {
            rejectUnauthorized: false,
            ciphers: "SSLv3",
          }
        : {
            rejectUnauthorized: false, // GoDaddy sometimes uses self-signed certs
            ciphers: "SSLv3",
          },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const mailOptions = {
      from: `"Licorice4Good System" <${
        process.env.EMAIL_USER || "info@licorice4good.com"
      }>`,
      to: adminEmail,
      subject: `🛒 New Order Received: #${orderDetails.orderId}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🛒 New Order Received!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: #e7f5ff; border-left: 4px solid #339af0; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #1864ab;">
                <strong>Order Number:</strong> #${orderDetails.orderId}
              </p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #1864ab;">
                <strong>Order Total:</strong> $${orderDetails.total.toFixed(2)}
              </p>
            </div>
            
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">Customer Information</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #495057;">
                <strong>Name:</strong> ${orderDetails.customerName}
              </p>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Email:</strong> ${orderDetails.customerEmail}
              </p>
            </div>
            
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">Order Summary</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: white;">
              <thead>
                <tr style="background: #e9ecef;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                  <th style="padding: 10px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr style="background: #f8f9fa; font-weight: bold;">
                  <td colspan="3" style="padding: 15px; text-align: right;">Total:</td>
                  <td style="padding: 15px; text-align: right; color: #28a745; font-size: 18px;">$${orderDetails.total.toFixed(
                    2
                  )}</td>
                </tr>
              </tbody>
            </table>
            
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; margin-top: 30px;">📦 Shipping Address</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
              <p style="margin: 5px 0; color: #495057;">${
                orderDetails.shippingAddress.street1
              }</p>
              <p style="margin: 5px 0; color: #495057;">
                ${orderDetails.shippingAddress.city}, ${
        orderDetails.shippingAddress.state
      } ${orderDetails.shippingAddress.zip}
              </p>
              <p style="margin: 5px 0; color: #495057;">${
                orderDetails.shippingAddress.country
              }</p>
            </div>
            
            ${
              orderDetails.shippingDetails?.trackingNumber
                ? `
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; margin-top: 30px;">🚚 Shipping Details</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
              <p style="margin: 5px 0; color: #495057;">
                <strong>Carrier:</strong> ${
                  orderDetails.shippingDetails.carrier || "N/A"
                }
              </p>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Tracking Number:</strong> ${
                  orderDetails.shippingDetails.trackingNumber
                }
              </p>
              ${
                orderDetails.shippingDetails.trackingUrl
                  ? `<p style="margin: 5px 0; color: #495057;">
                <strong>Tracking URL:</strong> <a href="${orderDetails.shippingDetails.trackingUrl}" style="color: #339af0;">${orderDetails.shippingDetails.trackingUrl}</a>
              </p>`
                  : ""
              }
              ${
                orderDetails.shippingDetails.shippingCost
                  ? `<p style="margin: 5px 0; color: #495057;">
                <strong>Shipping Cost:</strong> $${orderDetails.shippingDetails.shippingCost.toFixed(
                  2
                )}
              </p>`
                  : ""
              }
            </div>
            `
                : ""
            }
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 30px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Action Required:</strong> Please process this order and update the order status in your admin dashboard.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
              This is an automated notification from your Licorice4Good system.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Admin order notification sent to ${adminEmail} for order #${orderDetails.orderId}`
    );
  } catch (error: any) {
    console.error("❌ Error sending admin order notification:", error);
    // Check for SMTP AUTH disabled error
    if (
      error?.response?.includes("SmtpClientAuthentication is disabled") ||
      error?.code === "EAUTH"
    ) {
      console.error(
        "⚠️  SMTP Authentication is disabled for your Microsoft 365 tenant."
      );
      console.error(
        "📧 To fix: Enable SMTP Authentication in GoDaddy Email & Office Dashboard:"
      );
      console.error(
        "   1. Go to Email & Office Dashboard → Manage → Advanced Settings"
      );
      console.error("   2. Toggle ON 'SMTP Authentication'");
      console.error(
        "   3. Or visit: https://aka.ms/smtp_auth_disabled for more info"
      );
    }
    // Don't throw - admin notification failure shouldn't break order processing
  }
};
