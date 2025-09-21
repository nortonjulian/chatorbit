if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    process.env.NODE_ENV === 'test' ? 'test_secret' : 'dev_secret';
}
