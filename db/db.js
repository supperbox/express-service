import mongoose from 'mongoose';

const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MongoDB connection failed: MONGODB_URI is not defined in .env');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
};

export { connectMongo };
export default mongoose;
