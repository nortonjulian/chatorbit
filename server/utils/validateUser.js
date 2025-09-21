import validator from 'validator';

export function validateRegistrationInput(username, email, password) {
  if (!username || !email || !password) {
    return 'Username, email, and password are required';
  }

  if (!validator.isEmail(email)) {
    return 'Invalid email address.';
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must be at least 8 characters long, include one uppercase letter, and one number.';
  }
}
