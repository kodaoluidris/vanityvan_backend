const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
    async login(email, password) {
        try {
            // Find user by email
            const user = await db.User.findOne({ where: { email } });
            if (!user) {
                throw new Error('User not found');
            }

            // Check password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id,
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    companyName: user.companyName,
                    role: user.role
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async register(userData) {
        try {
            // Check if user already exists
            const existingUser = await db.User.findOne({
                where: { email: userData.email }
            });

            if (existingUser) {
                throw new Error('Email already registered');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Create user
            const user = await db.User.create({
                ...userData,
                password: hashedPassword
            });

            // Generate token
            const token = jwt.sign(
                { 
                    id: user.id,
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    companyName: user.companyName,
                    role: user.role
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await db.User.findByPk(decoded.id);
            
            if (!user) {
                throw new Error('User not found');
            }

            return user;
        } catch (error) {
            console.error('Token verification error:', error);
            throw error;
        }
    }
}

module.exports = new AuthService();