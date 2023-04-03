const sgMail = require('@sendgrid/mail')
require('dotenv').config()

const { SENDGRID_API_KEY } = process.env


sgMail.setApiKey(SENDGRID_API_KEY)

const sendEmail = async (data) => {
    const mail = { ...data, from: 'nataliam110388@gmail.com' }

    try {
        await sgMail.send(mail)
        return true
    } catch (error) {
        console.error(error);
    }
}

module.exports = sendEmail