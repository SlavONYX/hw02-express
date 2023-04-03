const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const path = require('path');
const fs = require('fs/promises');
const Jimp = require("jimp");
const gravatar = require('gravatar');
const User = require("../models/user")
const { RequestError } = require("../helpers")
const avatarsDir = path.join(__dirname, '../', 'public', 'avatars');
const { TOKEN_KEY } = process.env
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../helpers')

const register = async (req, res, next) => {
    const { email, password } = req.body
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        throw RequestError(409, `Email in use`)
    }
    const verificationToken = uuidv4()
    const avatarURL = gravatar.url(email, { protocol: 'https', s: '100' });
    const hashedPassword = await bcrypt.hash(password, 10)
    const mail = {
        to: email,
        subject: 'Verify your email',
        html: `<a target="_blank" href="http://localhost:3000/users/verify/${verificationToken}">Verify your email</a>`
    }
    await sendEmail(mail)
    const user = await User.create({ email, password: hashedPassword, avatarURL, verificationToken })
    res.status(201).json({
        email: user.email,
        subscription: user.subscription,
        avatarURL
    })
}

const login = async (req, res, next) => {
    const { email, password } = req.body
    const existingUser = await User.findOne({ email })
    const isPasswordValid = await bcrypt.compare(password, existingUser.password)
    if (!isPasswordValid || !existingUser || !existingUser.verify) {
        throw RequestError(401, "Email or password is wrong or email is not verify")
    }
    const payload = {
        id: existingUser._id,
    }
    const token = jwt.sign(payload, TOKEN_KEY, { expiresIn: "1h" })
    await User.findByIdAndUpdate(existingUser._id, { token })
    res.json({ token })
}

const logout = async (req, res, next) => {
    const { _id } = req.user
    await User.findByIdAndUpdate(_id, { token: "" })
    res.status(204).json({
        message: "No Content",
    })
}

const avatars = async (req, res, next) => {
    try {
        const { _id: id } = req.user;
        const { path: tempDir, originalname } = req.file;
        const [extention] = originalname.split(".").reverse()
        const avatarName = `${id}.${extention}`
        const resultUpload = path.join(avatarsDir, avatarName);
        const image = await Jimp.read(`./tmp/${originalname}`);
        await image.resize(250, 250);
        await image.writeAsync(`./tmp/${originalname}`);
        await fs.rename(tempDir, resultUpload);
        const avatarURL = path.join('public', 'avatars', avatarName);
        await User.findByIdAndUpdate(id, { avatarURL })
        res.status(201).json(avatarURL);
    } catch (error) {
        await fs.unlink(req.file.path);
        next(error)
    }
}

const verifyEmail = async (req, res) => {
    const { verificationToken } = req.params
    const user = await User.findOne({ verificationToken })
    if (!user) {
        throw RequestError(404, 'User not found')
    }
    await User.findByIdAndUpdate(user._id, { verify: true, verificationToken: null })
    res.json({
        message: 'Verification successful'
    })
}


const secondaryVerify = async (req, res, next) => {
    const { email } = req.body
    const existingUser = await User.findOne({ email })

    if (!existingUser) {
        throw RequestError(400, `Missing required field email`)
    }

    if (existingUser.verify) {
        throw RequestError(400, "Verification has already been passed")
    }

    const verificationToken = uuidv4()

    const mail = {
        to: email,
        subject: 'Verify your email',
        html: `<a target="_blank" href="http://localhost:3000/users/verify/${verificationToken}">Verify your email</a>`
    }

    await sendEmail(mail)
    await User.findOneAndUpdate({ email }, { verify: false, verificationToken })

    res.json({ message: "Verification email sent" })
}


module.exports = { register, login, logout, current, avatars, verifyEmail, secondaryVerify }