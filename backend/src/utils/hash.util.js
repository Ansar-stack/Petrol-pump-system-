import bcrypt from 'bcrypt';
// Hash the password using bcrypt
export const hashPassword = (password) => {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
}

// Compare the password with the hashed password
export const comparePassword = (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
}
