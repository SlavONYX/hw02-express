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

const register = async (req, res, next) => {
    const { email, password } = req.body
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        throw RequestError(409, `Email in use`)
    }
    const avatarURL = gravatar.url(email, { protocol: 'https', s: '100' });
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({ email, password: hashedPassword, avatarURL })
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
    if (!isPasswordValid || !existingUser) {
        throw RequestError(401, "Email or password is wrong")
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

module.exports = { register, login, logout, current, avatars }