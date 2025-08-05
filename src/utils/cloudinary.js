import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import { ApiError } from "./apiError.js";



const uploadOnCloudinary=async(localFilePath)=>{

  try{
    if (!localFilePath)return null
    //upload the file on cloudinary

    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const response =await cloudinary.uploader
       .upload(
           localFilePath,{
              resource_type:"auto"
           }
       )
       
       //file has been uploaded successfully
       if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (unlinkErr) {
          console.error("Failed to delete local file:", unlinkErr.message);
        }
      }
       
       return response

  }catch(error){
     // Try deleting only if file exists and remove the locally saved temporary file
    if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (unlinkErr) {
          console.error("Failed to delete local file:", unlinkErr.message);
        }
      }
  
    throw new ApiError(500,"Something went wrong while registering the user") 
  }
}

export {uploadOnCloudinary}