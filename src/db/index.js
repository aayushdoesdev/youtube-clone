import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );

    console.log(
      `DB Connected Successfully on Host: ${connectionInstance.connection.host}`
    );
  } catch (err) {
    console.error("Error", err);
    process.exit(1);
  }
};


export default connectDB