process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mrdonlineclinic_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-key-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-key-32chars!!';
process.env.CLIENT_URL = 'http://localhost:3000';
