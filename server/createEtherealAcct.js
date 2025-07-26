import nodemailer from 'nodemailer'

nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.log('Failed to create test account:', err);
        process.exit(1);
    }

    console.log('Ethereal test Account Created!')
    console.log('---------------------------------')
    console.log(`User: ${account.user}`)
    console.log(`Pass: ${account.pass}`)
    console.log(`SMTP Host: ${account.smtp.host}`)
    console.log(`SMTP Port: ${account.smtp.port}`)
    console.log(`Secure: ${account.smtp.secure}`)
    console.log('---------------------------------')
    console.log('Save these files to your .env file!')
})